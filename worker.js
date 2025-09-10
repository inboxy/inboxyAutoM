// worker.js - Optimized for high-frequency data processing
// This runs in a separate thread - no access to window, DOM, or external scripts

// Use larger buffers for 140Hz operation
const BUFFER_FLUSH_SIZE = 2000; // Increased buffer size
const BUFFER_FLUSH_INTERVAL = 2000; // Flush every 2 seconds
const MAX_BUFFER_SIZE = 5000; // Emergency flush threshold

// Pre-allocate arrays for better performance
let recordingData = [];
let dataBuffer = [];
let statsBuffer = new Array(100).fill(0); // Circular buffer for rate calculation
let statsIndex = 0;
let isRecording = false;

// Performance monitoring with reduced overhead
let stats = {
    totalPoints: 0,
    startTime: null,
    lastFlush: null,
    averageRate: 0,
    currentBatch: 0,
    lastStatsUpdate: 0
};

// Set up periodic buffer flush
let flushIntervalId = setInterval(() => {
    if (isRecording && dataBuffer.length > 0) {
        flushBuffer();
    }
    
    // Calculate real-time statistics
    if (isRecording && statsBuffer.some(rate => rate > 0)) {
        updateStatistics();
    }
}, BUFFER_FLUSH_INTERVAL);

// Optimized flush function
function flushBuffer() {
    if (dataBuffer.length === 0) return;
    
    const batchSize = dataBuffer.length;
    
    // Use more efficient array operations
    if (recordingData.length === 0) {
        recordingData = [...dataBuffer];
    } else {
        recordingData.push(...dataBuffer);
    }
    
    dataBuffer.length = 0; // Fast array clear
    
    // Update stats efficiently
    stats.totalPoints += batchSize;
    stats.lastFlush = Date.now();
    
    // Calculate rate using circular buffer
    if (stats.startTime) {
        const elapsed = (Date.now() - stats.startTime) / 1000;
        const currentRate = batchSize / (BUFFER_FLUSH_INTERVAL / 1000);
        
        statsBuffer[statsIndex] = currentRate;
        statsIndex = (statsIndex + 1) % statsBuffer.length;
        
        stats.averageRate = stats.totalPoints / elapsed;
    }
    
    // Throttle stats updates to reduce message overhead
    const now = Date.now();
    if (now - stats.lastStatsUpdate > 1000) { // Update every second
        self.postMessage({
            type: 'STATS_UPDATE',
            data: {
                totalPoints: stats.totalPoints,
                bufferSize: dataBuffer.length,
                averageHz: stats.averageRate,
                currentBatch: batchSize
            }
        });
        stats.lastStatsUpdate = now;
    }
}

function updateStatistics() {
    const recentRates = statsBuffer.filter(rate => rate > 0).slice(-5); // Last 5 non-zero samples
    const currentRate = recentRates.length > 0
        ? recentRates.reduce((a, b) => a + b, 0) / recentRates.length
        : 0;
    
    self.postMessage({
        type: 'STATS_UPDATE',
        data: {
            totalPoints: stats.totalPoints + dataBuffer.length,
            bufferSize: dataBuffer.length,
            averageHz: stats.averageRate,
            currentHz: currentRate
        }
    });
}

// Main message handler from the main thread
self.addEventListener('message', function(e) {
    const { type, data } = e.data;
    
    switch(type) {
        case 'START_RECORDING':
            startRecording();
            break;
            
        case 'STOP_RECORDING':
            stopRecording();
            break;
            
        case 'ADD_DATA_POINT':
            addDataPoint(data);
            break;
            
        case 'ADD_DATA_BATCH':
            addDataBatch(data);
            break;
            
        case 'GENERATE_CSV':
            generateCSV(data);
            break;
            
        case 'GET_STATS':
            sendStats();
            break;
            
        case 'CLEAR_DATA':
            clearData();
            break;
            
        default:
            console.warn('Worker: Unknown message type:', type);
    }
});

function startRecording() {
    recordingData = [];
    dataBuffer = [];
    isRecording = true;
    statsBuffer.fill(0);
    statsIndex = 0;
    stats = {
        totalPoints: 0,
        startTime: Date.now(),
        lastFlush: Date.now(),
        averageRate: 0,
        currentBatch: 0,
        lastStatsUpdate: 0
    };
    
    self.postMessage({ type: 'RECORDING_STARTED' });
    console.log('Worker: Recording started at', new Date().toISOString());
}

function stopRecording() {
    isRecording = false;
    
    // Flush any remaining buffered data
    if (dataBuffer.length > 0) {
        flushBuffer();
    }
    
    // Calculate final statistics
    const duration = stats.startTime ? (Date.now() - stats.startTime) / 1000 : 0;
    const finalStats = {
        totalPoints: stats.totalPoints,
        duration: duration,
        averageHz: duration > 0 ? stats.totalPoints / duration : 0,
        peakHz: Math.max(...statsBuffer.filter(rate => rate > 0)),
        minHz: Math.min(...statsBuffer.filter(rate => rate > 0)) || 0
    };
    
    console.log('Worker: Recording stopped. Stats:', finalStats);
    
    self.postMessage({ 
        type: 'RECORDING_STOPPED', 
        data: {
            data: recordingData,
            stats: finalStats
        }
    });
    
    // Clear data after sending
    recordingData = [];
    dataBuffer = [];
}

function addDataPoint(data) {
    if (!isRecording) return;
    
    dataBuffer.push(data);
    
    // Emergency flush for memory management
    if (dataBuffer.length >= MAX_BUFFER_SIZE) {
        console.warn('Worker: Emergency buffer flush at', dataBuffer.length, 'points');
        flushBuffer();
    } else if (dataBuffer.length >= BUFFER_FLUSH_SIZE) {
        flushBuffer();
    }
}

// Optimized batch processing
function addDataBatch(data) {
    if (!isRecording || !Array.isArray(data) || data.length === 0) return;
    
    // Direct array concatenation is faster than push(...data) for large arrays
    if (data.length > 100) {
        dataBuffer = dataBuffer.concat(data);
    } else {
        dataBuffer.push(...data);
    }
    
    // Emergency flush for memory management
    if (dataBuffer.length >= MAX_BUFFER_SIZE) {
        console.warn('Worker: Emergency buffer flush at', dataBuffer.length, 'points');
        flushBuffer();
    } else if (dataBuffer.length >= BUFFER_FLUSH_SIZE) {
        flushBuffer();
    }
}

function sendStats() {
    const currentStats = {
        totalPoints: stats.totalPoints + dataBuffer.length,
        bufferSize: dataBuffer.length,
        averageHz: stats.averageRate,
        isRecording: isRecording
    };
    
    self.postMessage({
        type: 'STATS_UPDATE',
        data: currentStats
    });
}

function clearData() {
    recordingData = [];
    dataBuffer = [];
    statsBuffer.fill(0);
    statsIndex = 0;
    stats = {
        totalPoints: 0,
        startTime: null,
        lastFlush: null,
        averageRate: 0,
        currentBatch: 0,
        lastStatsUpdate: 0
    };
    
    console.log('Worker: Data cleared');
}

// Optimized CSV generation with streaming approach
function generateCSV(data) {
    try {
        console.log('Worker: Generating CSV for', data.length, 'data points');
        
        // Updated headers with Recording Session Start column removed
        const headers = [
            'Data Point Timestamp', 'User ID', 'GPS Date Timestamp',
            'GPS LAT', 'GPS LON', 'GPS ERROR', 'GPS ALT', 'GPS ALT ACCURACY',
            'GPS HEADING', 'GPS SPEED', 'Accel Date Timestamp',
            'Accel X', 'Accel Y', 'Accel Z', 'Gyro Date Timestamp',
            'Gyro Alpha', 'Gyro Beta', 'Gyro Gamma', 'Sample Time (ms)', 'Frequency (Hz)'
        ];
        
        // Use array for better performance than string concatenation
        const csvLines = [headers.join(',')];
        
        // Sort data once by the actual timestamp (when the data point was captured)
        if (data && data.length > 0) {
            data.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        }
        
        let lastTimestamp = null;
        const frequencyWindow = new Array(10).fill(0);
        let windowIndex = 0;
        
        // Process in chunks to avoid blocking
        const CHUNK_SIZE = 1000;
        let currentIndex = 0;
        
        function processChunk() {
            const endIndex = Math.min(currentIndex + CHUNK_SIZE, data.length);
            
            for (let i = currentIndex; i < endIndex; i++) {
                const point = data[i];
                
                // Efficient frequency calculation using the actual data point timestamp
                let sampleTime = 0;
                let frequency = 0;
                
                if (lastTimestamp && point.timestamp) {
                    sampleTime = point.timestamp - lastTimestamp;
                    if (sampleTime > 0) {
                        frequency = 1000 / sampleTime;
                        frequencyWindow[windowIndex] = frequency;
                        windowIndex = (windowIndex + 1) % frequencyWindow.length;
                    }
                }
                lastTimestamp = point.timestamp;
                
                // Calculate average frequency
                const avgFrequency = frequencyWindow.reduce((a, b) => a + b, 0) / frequencyWindow.length;
                
                // Convert timestamp to readable format for the first column
                const dataPointTimestamp = point.timestamp ? new Date(point.timestamp).toISOString() : '';
                
                // Build row efficiently - Recording Session Start column removed
                const row = [
                    escapeCSVField(dataPointTimestamp),                    // Unique timestamp for each data point
                    escapeCSVField(point.userId || ''),
                    escapeCSVField(point.gpsTimestamp || ''),
                    formatNumber(point.gpsLat),
                    formatNumber(point.gpsLon),
                    formatNumber(point.gpsError),
                    formatNumber(point.gpsAlt),
                    formatNumber(point.gpsAltAccuracy),
                    formatNumber(point.gpsHeading),
                    formatNumber(point.gpsSpeed),
                    escapeCSVField(point.accelTimestamp || ''),
                    formatNumber(point.accelX),
                    formatNumber(point.accelY),
                    formatNumber(point.accelZ),
                    escapeCSVField(point.gyroTimestamp || ''),
                    formatNumber(point.gyroAlpha),
                    formatNumber(point.gyroBeta),
                    formatNumber(point.gyroGamma),
                    sampleTime.toFixed(2),
                    avgFrequency.toFixed(2)
                ];
                
                csvLines.push(row.join(','));
            }
            
            currentIndex = endIndex;
            
            // Continue processing or finish
            if (currentIndex < data.length) {
                // Use setTimeout for non-blocking processing
                setTimeout(processChunk, 0);
            } else {
                finishCSV();
            }
        }
        
        function finishCSV() {
            // Add summary statistics
            const duration = data.length > 1 
                ? (data[data.length - 1].timestamp - data[0].timestamp) / 1000 
                : 0;
            const averageHz = duration > 0 ? data.length / duration : 0;
            
            // Get userID from the first data point
            const userId = data.length > 0 ? data[0].userId : 'unknown';
            
            // Count different data types
            const gpsCount = data.filter(d => d.gpsLat !== undefined && d.gpsLat !== null).length;
            const accelCount = data.filter(d => d.accelX !== undefined && d.accelX !== null).length;
            const gyroCount = data.filter(d => d.gyroAlpha !== undefined && d.gyroAlpha !== null).length;
            
            csvLines.push('');
            csvLines.push('# Summary Statistics');
            csvLines.push(`# User ID,${userId}`);
            csvLines.push(`# Export Date,${new Date().toISOString()}`);
            csvLines.push(`# Total Samples,${data.length}`);
            csvLines.push(`# GPS Samples,${gpsCount}`);
            csvLines.push(`# Accelerometer Samples,${accelCount}`);
            csvLines.push(`# Gyroscope Samples,${gyroCount}`);
            csvLines.push(`# Duration (seconds),${duration.toFixed(2)}`);
            csvLines.push(`# Average Sample Rate (Hz),${averageHz.toFixed(2)}`);
            
            if (gpsCount > 0) {
                csvLines.push(`# GPS Sample Rate (Hz),${(gpsCount / duration).toFixed(2)}`);
            }
            if (accelCount > 0) {
                csvLines.push(`# Accelerometer Sample Rate (Hz),${(accelCount / duration).toFixed(2)}`);
            }
            if (gyroCount > 0) {
                csvLines.push(`# Gyroscope Sample Rate (Hz),${(gyroCount / duration).toFixed(2)}`);
            }
            
            const csvContent = csvLines.join('\n');
            console.log('Worker: CSV generated -', data.length, 'points,', averageHz.toFixed(2), 'Hz avg');
            
            // Include userID in the response so the main thread can use it for filename
            self.postMessage({ 
                type: 'CSV_GENERATED', 
                data: csvContent,
                userId: userId
            });
        }
        
        // Start processing
        processChunk();
        
    } catch (error) {
        console.error('Worker: Error generating CSV:', error);
        self.postMessage({
            type: 'WORKER_ERROR',
            data: `Failed to generate CSV: ${error.message}`
        });
    }
}

// Optimized number formatting
function formatNumber(value) {
    if (value == null || value === '') return '';
    
    if (typeof value === 'number') {
        // Fast path for integers
        if (value === Math.floor(value)) {
            return value.toString();
        }
        
        // Use appropriate precision based on magnitude
        if (Math.abs(value) > 100) {
            return value.toFixed(2);
        } else {
            return value.toFixed(6);
        }
    }
    
    return value.toString();
}

function escapeCSVField(field) {
    if (field === null || field === undefined) {
        return '';
    }
    
    // Convert to string
    field = field.toString();
    
    // Check if field needs escaping
    if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
        // Escape quotes by doubling them
        return '"' + field.replace(/"/g, '""') + '"';
    }
    
    return field;
}

// Handle worker errors
self.addEventListener('error', function(error) {
    console.error('Worker error:', error);
    self.postMessage({
        type: 'WORKER_ERROR',
        data: error.message || 'Unknown worker error'
    });
});

// Handle unhandled promise rejections
self.addEventListener('unhandledrejection', function(event) {
    console.error('Worker unhandled rejection:', event.reason);
    self.postMessage({
        type: 'WORKER_ERROR',
        data: event.reason || 'Unhandled promise rejection'
    });
});

console.log('Worker: Initialized and ready. Version 1.2.0 - Optimized for 140Hz with UserID in CSV');
