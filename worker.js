// Enhanced worker.js with batch processing and performance optimizations

let recordingData = [];
let isRecording = false;
let dataBuffer = [];
const BUFFER_FLUSH_SIZE = 1000; // Flush buffer every 1000 points
const BUFFER_FLUSH_INTERVAL = 5000; // Flush buffer every 5 seconds

// Performance monitoring
let stats = {
    totalPoints: 0,
    startTime: null,
    lastFlush: null,
    averageRate: 0,
    peakRate: 0,
    minRate: Infinity,
    sampleRates: []
};

// Set up periodic buffer flush
let flushIntervalId = setInterval(() => {
    if (isRecording && dataBuffer.length > 0) {
        flushBuffer();
    }
    
    // Calculate real-time statistics
    if (isRecording && stats.sampleRates.length > 0) {
        updateStatistics();
    }
}, BUFFER_FLUSH_INTERVAL);

function flushBuffer() {
    if (dataBuffer.length === 0) return;
    
    // Add all buffered data to recording
    recordingData.push(...dataBuffer);
    const flushedCount = dataBuffer.length;
    dataBuffer = [];
    
    // Update stats
    stats.totalPoints += flushedCount;
    stats.lastFlush = Date.now();
    
    if (stats.startTime) {
        const elapsed = (Date.now() - stats.startTime) / 1000;
        const currentRate = flushedCount / (BUFFER_FLUSH_INTERVAL / 1000);
        
        // Track sample rates for statistics
        stats.sampleRates.push(currentRate);
        if (stats.sampleRates.length > 20) {
            stats.sampleRates.shift(); // Keep last 20 samples
        }
        
        // Calculate average rate
        stats.averageRate = stats.totalPoints / elapsed;
        
        // Track peak and min rates
        if (currentRate > stats.peakRate) {
            stats.peakRate = currentRate;
        }
        if (currentRate < stats.minRate && currentRate > 0) {
            stats.minRate = currentRate;
        }
    }
    
    // Send stats update
    self.postMessage({
        type: 'STATS_UPDATE',
        data: {
            totalPoints: stats.totalPoints,
            bufferSize: dataBuffer.length,
            averageHz: stats.averageRate,
            peakHz: stats.peakRate,
            currentHz: stats.sampleRates[stats.sampleRates.length - 1] || 0
        }
    });
}

function updateStatistics() {
    const recentRates = stats.sampleRates.slice(-5); // Last 5 samples
    const currentRate = recentRates.reduce((a, b) => a + b, 0) / recentRates.length;
    
    self.postMessage({
        type: 'STATS_UPDATE',
        data: {
            totalPoints: stats.totalPoints + dataBuffer.length,
            bufferSize: dataBuffer.length,
            averageHz: stats.averageRate,
            peakHz: stats.peakRate,
            currentHz: currentRate
        }
    });
}

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
    }
});

function startRecording() {
    recordingData = [];
    dataBuffer = [];
    isRecording = true;
    stats = {
        totalPoints: 0,
        startTime: Date.now(),
        lastFlush: Date.now(),
        averageRate: 0,
        peakRate: 0,
        minRate: Infinity,
        sampleRates: []
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
    const duration = (Date.now() - stats.startTime) / 1000;
    const finalStats = {
        totalPoints: stats.totalPoints,
        duration: duration,
        averageHz: stats.totalPoints / duration,
        peakHz: stats.peakRate,
        minHz: stats.minRate === Infinity ? 0 : stats.minRate
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
    
    // Flush if buffer is getting large
    if (dataBuffer.length >= BUFFER_FLUSH_SIZE) {
        flushBuffer();
    }
}

function addDataBatch(data) {
    if (!isRecording || !Array.isArray(data)) return;
    
    // Add all points from batch
    dataBuffer.push(...data);
    
    // Flush if buffer is getting large
    if (dataBuffer.length >= BUFFER_FLUSH_SIZE) {
        flushBuffer();
    }
}

function sendStats() {
    const currentStats = {
        totalPoints: stats.totalPoints + dataBuffer.length,
        bufferSize: dataBuffer.length,
        averageHz: stats.averageRate,
        peakHz: stats.peakRate,
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
    stats = {
        totalPoints: 0,
        startTime: null,
        lastFlush: null,
        averageRate: 0,
        peakRate: 0,
        minRate: Infinity,
        sampleRates: []
    };
    
    console.log('Worker: Data cleared');
}

function generateCSV(data) {
    try {
        console.log('Worker: Generating CSV for', data.length, 'data points');
        
        const headers = [
            'Recording Date Timestamp',
            'User ID',
            'GPS Date Timestamp',
            'GPS LAT',
            'GPS LON',
            'GPS ERROR',
            'GPS ALT',
            'GPS ALT ACCURACY',
            'GPS HEADING',
            'GPS SPEED',
            'Accel Date Timestamp',
            'Accel X',
            'Accel Y',
            'Accel Z',
            'Gyro Date Timestamp',
            'Gyro Alpha',
            'Gyro Beta',
            'Gyro Gamma',
            'Sample Time (ms)',
            'Frequency (Hz)'
        ];
        
        let csvContent = headers.join(',') + '\n';
        
        // Sort data by timestamp for proper ordering
        data.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
        
        let lastTimestamp = null;
        let frequencyWindow = [];
        
        for (let i = 0; i < data.length; i++) {
            const point = data[i];
            
            // Calculate time delta and instantaneous frequency
            let sampleTime = 0;
            let frequency = 0;
            
            if (lastTimestamp) {
                sampleTime = point.timestamp - lastTimestamp;
                if (sampleTime > 0) {
                    frequency = 1000 / sampleTime; // Convert to Hz
                    frequencyWindow.push(frequency);
                    if (frequencyWindow.length > 10) {
                        frequencyWindow.shift();
                    }
                }
            }
            lastTimestamp = point.timestamp;
            
            // Calculate average frequency over window
            const avgFrequency = frequencyWindow.length > 0 
                ? frequencyWindow.reduce((a, b) => a + b, 0) / frequencyWindow.length 
                : 0;
            
            const row = [
                escapeCSVField(point.recordingTimestamp || ''),
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
                sampleTime,
                avgFrequency.toFixed(2)
            ];
            csvContent += row.join(',') + '\n';
        }
        
        // Add summary statistics
        const duration = data.length > 0 
            ? (data[data.length - 1].timestamp - data[0].timestamp) / 1000 
            : 0;
        const averageHz = duration > 0 ? data.length / duration : 0;
        
        // Count different data types
        const gpsCount = data.filter(d => d.gpsLat !== undefined).length;
        const accelCount = data.filter(d => d.accelX !== undefined).length;
        const gyroCount = data.filter(d => d.gyroAlpha !== undefined).length;
        
        csvContent += '\n# Summary Statistics\n';
        csvContent += `# Total Samples,${data.length}\n`;
        csvContent += `# GPS Samples,${gpsCount}\n`;
        csvContent += `# Accelerometer Samples,${accelCount}\n`;
        csvContent += `# Gyroscope Samples,${gyroCount}\n`;
        csvContent += `# Duration (seconds),${duration.toFixed(2)}\n`;
        csvContent += `# Average Sample Rate (Hz),${averageHz.toFixed(2)}\n`;
        csvContent += `# GPS Sample Rate (Hz),${(gpsCount / duration).toFixed(2)}\n`;
        csvContent += `# Accelerometer Sample Rate (Hz),${(accelCount / duration).toFixed(2)}\n`;
        csvContent += `# Gyroscope Sample Rate (Hz),${(gyroCount / duration).toFixed(2)}\n`;
        
        console.log('Worker: CSV generated successfully');
        console.log('Worker: Summary - Total:', data.length, 'Duration:', duration.toFixed(2), 's', 'Rate:', averageHz.toFixed(2), 'Hz');
        
        self.postMessage({ 
            type: 'CSV_GENERATED', 
            data: csvContent 
        });
        
    } catch (error) {
        console.error('Worker: Error generating CSV:', error);
        self.postMessage({
            type: 'WORKER_ERROR',
            error: `Failed to generate CSV: ${error.message}`
        });
    }
}

function formatNumber(value) {
    if (value === undefined || value === null || value === '') {
        return '';
    }
    if (typeof value === 'number') {
        // Format with appropriate precision
        if (Number.isInteger(value)) {
            return value.toString();
        } else {
            return value.toFixed(6);
        }
    }
    return value;
}

function escapeCSVField(field) {
    if (typeof field === 'string') {
        // Check if field needs escaping
        if (field.includes(',') || field.includes('"') || field.includes('\n') || field.includes('\r')) {
            // Escape quotes by doubling them
            return '"' + field.replace(/"/g, '""') + '"';
        }
    }
    return field;
}

// Handle worker errors
self.addEventListener('error', function(error) {
    console.error('Worker error:', error);
    self.postMessage({
        type: 'WORKER_ERROR',
        error: error.message
    });
});

// Handle unhandled promise rejections
self.addEventListener('unhandledrejection', function(event) {
    console.error('Worker unhandled rejection:', event.reason);
    self.postMessage({
        type: 'WORKER_ERROR',
        error: event.reason
    });
});

console.log('Worker: Initialized and ready');
