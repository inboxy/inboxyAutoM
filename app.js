// ============================================
// app.js - CORRECTED VERSION
// ============================================

// Robust ID generation fallback (no dependency on nanoid)
function generateId(length = 10) {
    // First try crypto API (most secure)
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars[array[i] % chars.length];
        }
        return result;
    }
    
    // Fallback to Math.random
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// Try to use nanoid if it loaded from CDN, otherwise use our fallback
if (typeof window !== 'undefined' && typeof nanoid === 'undefined') {
    window.nanoid = generateId;
}

// Error boundary for better error handling
class ErrorBoundary {
    static handle(error, context) {
        console.error(`Error in ${context}:`, error);
        
        // Show user-friendly notification
        if (window.app && window.app.showNotification) {
            window.app.showNotification(`An error occurred in ${context}. Please try again.`, 'error');
        }
        
        // Report to monitoring service if configured
        if (window.MotionRecorderConfig?.features?.errorReporting) {
            this.reportError(error, context);
        }
    }
    
    static reportError(error, context) {
        // Implement error reporting to your monitoring service
        console.log('Error reported:', { 
            error: error.message, 
            context, 
            timestamp: new Date().toISOString() 
        });
    }
}

class MotionRecorderApp {
    constructor() {
        this.userId = null;
        this.isRecording = false;
        this.recordingData = [];
        this.startTime = null;
        this.worker = null;
        this.db = null;
        this.currentRecordingId = null;
        this.watchId = null;
        this.sensorRafId = null;
        this.batchInterval = null;
        this.performanceMonitor = null;
        this.batteryLevel = 1;
        this.adaptiveSampleRate = 140; // Start with target rate
        this.recordingTimeout = null;
        this.cleanupMotion = null;
        
        this.init();
    }
    
    async init() {
        try {
            await this.initUserId();
            await this.initIndexedDB();
            this.initUI();
            this.initPerformanceMonitor();
            await this.checkPermissions();
            this.initWorker();
            this.initBatteryMonitoring();
            this.initNetworkMonitoring();
        } catch (error) {
            ErrorBoundary.handle(error, 'App Initialization');
        }
    }
    
    async initUserId() {
        // Check for existing user ID in cookie
        const cookies = document.cookie.split(';');
        let userId = null;
        
        for (let cookie of cookies) {
            const [name, value] = cookie.trim().split('=');
            if (name === 'userId') {
                userId = value;
                break;
            }
        }
        
        if (!userId) {
            // Generate new 10 character unique ID
            // Use nanoid if available, otherwise use our fallback
            if (typeof nanoid === 'function') {
                userId = nanoid(10);
            } else {
                userId = generateId(10);
            }
            
            // Store in cookie (expires in 1 year)
            const expires = new Date();
            expires.setFullYear(expires.getFullYear() + 1);
            
            // Add Secure flag only if on HTTPS
            const secureFlag = window.location.protocol === 'https:' ? '; Secure' : '';
            document.cookie = `userId=${userId}; expires=${expires.toUTCString()}; path=/; SameSite=Strict${secureFlag}`;
        }
        
        this.userId = userId;
        const userIdElement = document.getElementById('user-id');
        if (userIdElement) {
            userIdElement.textContent = userId;
        }
    }
    
    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('MotionRecorderDB', 2);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create recordings store if it doesn't exist
                if (!db.objectStoreNames.contains('recordings')) {
                    const recordingStore = db.createObjectStore('recordings', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    recordingStore.createIndex('timestamp', 'timestamp', { unique: false });
                    recordingStore.createIndex('userId', 'userId', { unique: false });
                }
                
                // Create data points store if it doesn't exist
                if (!db.objectStoreNames.contains('dataPoints')) {
                    const dataStore = db.createObjectStore('dataPoints', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    dataStore.createIndex('recordingId', 'recordingId', { unique: false });
                    dataStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                // Create performance metrics store
                if (!db.objectStoreNames.contains('performanceMetrics')) {
                    const metricsStore = db.createObjectStore('performanceMetrics', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    metricsStore.createIndex('recordingId', 'recordingId', { unique: false });
                }
            };
        });
    }
    
    initUI() {
        document.getElementById('start-btn').addEventListener('click', () => this.startRecording());
        document.getElementById('stop-btn').addEventListener('click', () => this.stopRecording());
        document.getElementById('download-btn').addEventListener('click', () => this.downloadCSV());
        document.getElementById('upload-btn').addEventListener('click', () => this.uploadJSON());
        
        // Add retry buttons for permissions
        const retryButtons = document.querySelectorAll('.retry-permission');
        retryButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sensor = e.target.id.replace('-retry', '');
                this.retryPermission(sensor);
            });
        });
    }
    
    initPerformanceMonitor() {
        if (window.performanceMonitor) {
            this.performanceMonitor = window.performanceMonitor;
        }
    }
    
    initWorker() {
        this.worker = new Worker('worker.js');
        
        this.worker.addEventListener('message', (e) => {
            const { type, data } = e.data;
            
            switch(type) {
                case 'RECORDING_STARTED':
                    console.log('Worker: Recording started');
                    break;
                    
                case 'RECORDING_STOPPED':
                    this.saveRecordingData(data.data, data.stats);
                    break;
                    
                case 'CSV_GENERATED':
                    this.downloadCSVFile(data);
                    break;
                    
                case 'STATS_UPDATE':
                    this.updateStats(data);
                    break;
                    
                case 'WORKER_ERROR':
                    ErrorBoundary.handle(new Error(data), 'Worker');
                    break;
            }
        });
        
        this.worker.addEventListener('error', (error) => {
            ErrorBoundary.handle(error, 'Worker');
        });
    }
    
    async initBatteryMonitoring() {
        if ('getBattery' in navigator) {
            try {
                const battery = await navigator.getBattery();
                this.batteryLevel = battery.level;
                
                battery.addEventListener('levelchange', () => {
                    this.batteryLevel = battery.level;
                    this.adjustSampleRateForBattery();
                });
                
                // Check battery level periodically during recording
                setInterval(() => {
                    if (this.isRecording && this.batteryLevel < 0.2) {
                        this.showNotification('Low battery: Sample rate reduced to conserve power', 'warning');
                    }
                }, 60000); // Check every minute
            } catch (error) {
                console.log('Battery API not available');
            }
        }
    }
    
    adjustSampleRateForBattery() {
        if (this.batteryLevel < 0.2) {
            this.adaptiveSampleRate = 60;
            console.log('Battery low, reducing sample rate to 60Hz');
        } else if (this.batteryLevel < 0.5) {
            this.adaptiveSampleRate = 100;
        } else {
            this.adaptiveSampleRate = window.MotionRecorderConfig?.sensors?.targetRate || 140;
        }
    }
    
    initNetworkMonitoring() {
        // Monitor online/offline status
        window.addEventListener('online', () => {
            const statusEl = document.getElementById('online-status');
            if (statusEl) {
                statusEl.className = 'online-status online';
                statusEl.textContent = 'Online';
            }
            
            // Try to upload any pending data
            this.uploadPendingData();
        });
        
        window.addEventListener('offline', () => {
            const statusEl = document.getElementById('online-status');
            if (statusEl) {
                statusEl.className = 'online-status offline';
                statusEl.textContent = 'Offline';
            }
        });
    }
    
    async checkPermissions() {
        // Check GPS permission
        if ('geolocation' in navigator) {
            try {
                await this.getCurrentPosition();
                this.updatePermissionStatus('gps', 'granted');
                this.startGPSTracking();
            } catch (error) {
                this.updatePermissionStatus('gps', 'denied');
                const retryBtn = document.getElementById('gps-retry');
                if (retryBtn) retryBtn.style.display = 'inline-block';
            }
        } else {
            this.updatePermissionStatus('gps', 'unsupported');
        }
        
        // Check motion sensors
        if ('DeviceMotionEvent' in window && typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceMotionEvent.requestPermission();
                if (permission === 'granted') {
                    this.updatePermissionStatus('accel', 'granted');
                    this.updatePermissionStatus('gyro', 'granted');
                    this.startMotionTracking();
                } else {
                    this.updatePermissionStatus('accel', 'denied');
                    this.updatePermissionStatus('gyro', 'denied');
                    document.getElementById('accel-retry').style.display = 'inline-block';
                    document.getElementById('gyro-retry').style.display = 'inline-block';
                }
            } catch (error) {
                this.updatePermissionStatus('accel', 'denied');
                this.updatePermissionStatus('gyro', 'denied');
            }
        } else if ('DeviceMotionEvent' in window) {
            // For non-iOS devices, test if we're getting data
            this.testMotionSensors();
        } else {
            this.updatePermissionStatus('accel', 'unsupported');
            this.updatePermissionStatus('gyro', 'unsupported');
        }
    }
    
    testMotionSensors() {
        let hasData = false;
        
        const testHandler = (event) => {
            if (event.accelerationIncludingGravity || event.rotationRate) {
                hasData = true;
                this.updatePermissionStatus('accel', 'granted');
                this.updatePermissionStatus('gyro', 'granted');
                window.removeEventListener('devicemotion', testHandler);
                this.startMotionTracking();
            }
        };
        
        window.addEventListener('devicemotion', testHandler);
        
        // If no data after 2 seconds, assume denied
        setTimeout(() => {
            if (!hasData) {
                window.removeEventListener('devicemotion', testHandler);
                this.updatePermissionStatus('accel', 'denied');
                this.updatePermissionStatus('gyro', 'denied');
            }
        }, 2000);
    }
    
    async retryPermission(sensor) {
        if (sensor === 'gps') {
            try {
                await this.getCurrentPosition();
                this.updatePermissionStatus('gps', 'granted');
                this.startGPSTracking();
                document.getElementById('gps-retry').style.display = 'none';
            } catch (error) {
                this.showNotification('GPS permission denied. Please enable in browser settings.', 'error');
            }
        } else if (sensor === 'accel' || sensor === 'gyro') {
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                try {
                    const permission = await DeviceMotionEvent.requestPermission();
                    if (permission === 'granted') {
                        this.updatePermissionStatus('accel', 'granted');
                        this.updatePermissionStatus('gyro', 'granted');
                        this.startMotionTracking();
                        document.getElementById('accel-retry').style.display = 'none';
                        document.getElementById('gyro-retry').style.display = 'none';
                    }
                } catch (error) {
                    this.showNotification('Motion sensor permission denied. Please enable in browser settings.', 'error');
                }
            }
        }
    }
    
    updatePermissionStatus(sensor, status) {
        const element = document.getElementById(`${sensor}-status`);
        if (element) {
            element.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            element.className = `permission-status status-${status}`;
        }
    }
    
    getCurrentPosition() {
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            });
        });
    }
    
    startGPSTracking() {
        const options = {
            enableHighAccuracy: true,
            timeout: 5000,
            maximumAge: 0
        };
        
        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, accuracy, altitude, altitudeAccuracy, heading, speed } = position.coords;
                const timestamp = new Date(position.timestamp).toISOString();
                
                // Update UI
                document.getElementById('gps-lat').textContent = latitude.toFixed(6);
                document.getElementById('gps-lon').textContent = longitude.toFixed(6);
                document.getElementById('gps-error').textContent = `${accuracy.toFixed(1)} m`;
                document.getElementById('gps-alt').textContent = altitude ? `${altitude.toFixed(1)} m` : '-- m';
                
                // Send to worker if recording
                if (this.isRecording) {
                    this.worker.postMessage({
                        type: 'ADD_DATA_POINT',
                        data: {
                            recordingTimestamp: this.startTime,
                            userId: this.userId,
                            gpsTimestamp: timestamp,
                            gpsLat: latitude,
                            gpsLon: longitude,
                            gpsError: accuracy,
                            gpsAlt: altitude,
                            gpsAltAccuracy: altitudeAccuracy,
                            gpsHeading: heading,
                            gpsSpeed: speed,
                            timestamp: Date.now()
                        }
                    });
                }
            },
            (error) => {
                console.error('GPS error:', error);
                this.updatePermissionStatus('gps', 'denied');
            },
            options
        );
    }
    
    startMotionTracking() {
        // Use passive listeners for better performance
        const options = { passive: true };
        
        // Store latest sensor data - no processing in event handler
        let latestMotionEvent = null;
        let lastProcessTime = 0;
        
        // Minimal event handler - just store data
        const motionHandler = (event) => {
            latestMotionEvent = {
                acceleration: event.accelerationIncludingGravity,
                rotationRate: event.rotationRate,
                timestamp: event.timeStamp || performance.now()
            };
        };
        
        window.addEventListener('devicemotion', motionHandler, options);
        
        // High-frequency processing loop
        const targetInterval = 1000 / this.adaptiveSampleRate; // ~7.14ms for 140Hz
        let accelBatch = [];
        let gyroBatch = [];
        let lastUIUpdate = 0;
        
        const processMotionData = (currentTime) => {
            if (!latestMotionEvent) {
                this.sensorRafId = requestAnimationFrame(processMotionData);
                return;
            }
            
            const deltaTime = currentTime - lastProcessTime;
            
            // Only process if enough time has passed (rate limiting)
            if (deltaTime >= targetInterval) {
                const now = Date.now();
                const timestamp = new Date().toISOString();
                
                // Process acceleration
                if (latestMotionEvent.acceleration) {
                    const { x, y, z } = latestMotionEvent.acceleration;
                    
                    if (this.validateSensorData('accel', { x, y, z })) {
                        // Throttled UI updates (10Hz)
                        if (currentTime - lastUIUpdate > 100) {
                            this.updateAccelUI(x, y, z);
                            lastUIUpdate = currentTime;
                        }
                        
                        if (this.isRecording) {
                            accelBatch.push({
                                recordingTimestamp: this.startTime,
                                userId: this.userId,
                                accelTimestamp: timestamp,
                                accelX: x,
                                accelY: y,
                                accelZ: z,
                                timestamp: now
                            });
                            
                            // Performance monitoring
                            if (this.performanceMonitor) {
                                this.performanceMonitor.addSample();
                            }
                        }
                    }
                }
                
                // Process gyroscope
                if (latestMotionEvent.rotationRate) {
                    const { alpha, beta, gamma } = latestMotionEvent.rotationRate;
                    
                    if (this.validateSensorData('gyro', { alpha, beta, gamma })) {
                        // Throttled UI updates
                        if (currentTime - lastUIUpdate > 100) {
                            this.updateGyroUI(alpha, beta, gamma);
                        }
                        
                        if (this.isRecording) {
                            gyroBatch.push({
                                recordingTimestamp: this.startTime,
                                userId: this.userId,
                                gyroTimestamp: timestamp,
                                gyroAlpha: alpha,
                                gyroBeta: beta,
                                gyroGamma: gamma,
                                timestamp: now
                            });
                        }
                    }
                }
                
                // Send batches when they reach target size
                if (accelBatch.length >= 10) {
                    this.worker.postMessage({
                        type: 'ADD_DATA_BATCH',
                        data: [...accelBatch]
                    });
                    accelBatch = [];
                }
                
                if (gyroBatch.length >= 10) {
                    this.worker.postMessage({
                        type: 'ADD_DATA_BATCH',
                        data: [...gyroBatch]
                    });
                    gyroBatch = [];
                }
                
                lastProcessTime = currentTime;
            }
            
            this.sensorRafId = requestAnimationFrame(processMotionData);
        };
        
        // Start processing loop
        this.sensorRafId = requestAnimationFrame(processMotionData);
        
        // Periodic batch flush for remaining data
        this.batchInterval = setInterval(() => {
            if (accelBatch.length > 0) {
                this.worker.postMessage({
                    type: 'ADD_DATA_BATCH',
                    data: [...accelBatch]
                });
                accelBatch = [];
            }
            if (gyroBatch.length > 0) {
                this.worker.postMessage({
                    type: 'ADD_DATA_BATCH',
                    data: [...gyroBatch]
                });
                gyroBatch = [];
            }
        }, 100);
        
        // Store cleanup function
        this.cleanupMotion = () => {
            window.removeEventListener('devicemotion', motionHandler);
            if (this.sensorRafId) {
                cancelAnimationFrame(this.sensorRafId);
            }
            if (this.batchInterval) {
                clearInterval(this.batchInterval);
            }
        };
    }
    
    // Separate UI update methods for better performance
    updateAccelUI(x, y, z) {
        document.getElementById('accel-x').textContent = x ? `${x.toFixed(2)} m/s²` : '-- m/s²';
        document.getElementById('accel-y').textContent = y ? `${y.toFixed(2)} m/s²` : '-- m/s²';
        document.getElementById('accel-z').textContent = z ? `${z.toFixed(2)} m/s²` : '-- m/s²';
    }
    
    updateGyroUI(alpha, beta, gamma) {
        document.getElementById('gyro-alpha').textContent = alpha ? `${alpha.toFixed(2)} °/s` : '-- °/s';
        document.getElementById('gyro-beta').textContent = beta ? `${beta.toFixed(2)} °/s` : '-- °/s';
        document.getElementById('gyro-gamma').textContent = gamma ? `${gamma.toFixed(2)} °/s` : '-- °/s';
    }
    
    stopMotionTracking() {
        if (this.cleanupMotion) {
            this.cleanupMotion();
            this.cleanupMotion = null;
        }
    }
    
    validateSensorData(type, data) {
        const config = window.MotionRecorderConfig?.sensors;
        if (!config?.dataValidation) return true;
        
        // Add NaN and Infinity checks
        const isValidNumber = (val) => typeof val === 'number' && isFinite(val);
        
        if (type === 'accel') {
            const maxAccel = 50; // m/s²
            if (!Object.values(data).every(isValidNumber)) return false;
            if (Math.abs(data.x) > maxAccel || 
                Math.abs(data.y) > maxAccel || 
                Math.abs(data.z) > maxAccel) {
                console.warn('Acceleration data out of range', data);
                return false;
            }
        } else if (type === 'gyro') {
            const maxGyro = 2000; // degrees/s
            if (!Object.values(data).every(isValidNumber)) return false;
            if (Math.abs(data.alpha) > maxGyro || 
                Math.abs(data.beta) > maxGyro || 
                Math.abs(data.gamma) > maxGyro) {
                console.warn('Gyroscope data out of range', data);
                return false;
            }
        }
        
        return true;
    }
    
    async startRecording() {
        try {
            // Check if we have necessary permissions
            const hasPermissions = this.checkRecordingPermissions();
            if (!hasPermissions) {
                this.showNotification('Please grant sensor permissions before recording', 'warning');
                return;
            }
            
            this.isRecording = true;
            this.startTime = new Date().toISOString();
            
            // Adjust sample rate based on battery
            this.adjustSampleRateForBattery();
            
            // Update UI
            document.getElementById('start-btn').style.display = 'none';
            document.getElementById('stop-btn').style.display = 'inline-flex';
            document.getElementById('post-recording-controls').classList.remove('visible');
            
            const statusIndicator = document.getElementById('status-indicator');
            statusIndicator.className = 'status-indicator status-recording pulse';
            statusIndicator.innerHTML = '<span>● Recording...</span>';
            
            // Start performance monitoring
            if (this.performanceMonitor) {
                this.performanceMonitor.start();
            }
            
            // Start worker recording
            this.worker.postMessage({ type: 'START_RECORDING' });
            
            // Create recording entry in IndexedDB
            const transaction = this.db.transaction(['recordings'], 'readwrite');
            const store = transaction.objectStore('recordings');
            
            const recording = {
                userId: this.userId,
                timestamp: this.startTime,
                status: 'recording',
                sampleRate: this.adaptiveSampleRate,
                batteryLevel: this.batteryLevel
            };
            
            const request = store.add(recording);
            request.onsuccess = () => {
                this.currentRecordingId = request.result;
            };
            
            // Set maximum recording duration
            const maxDuration = window.MotionRecorderConfig?.sensors?.maxRecordingDuration || 3600000;
            this.recordingTimeout = setTimeout(() => {
                this.stopRecording();
                this.showNotification('Maximum recording duration reached', 'info');
            }, maxDuration);
            
        } catch (error) {
            ErrorBoundary.handle(error, 'Start Recording');
            this.isRecording = false;
        }
    }
    
    checkRecordingPermissions() {
        const gpsStatus = document.getElementById('gps-status')?.textContent.toLowerCase();
        const accelStatus = document.getElementById('accel-status')?.textContent.toLowerCase();
        const gyroStatus = document.getElementById('gyro-status')?.textContent.toLowerCase();
        
        return (gpsStatus === 'granted' || gpsStatus === 'unsupported') &&
               (accelStatus === 'granted' || accelStatus === 'unsupported') &&
               (gyroStatus === 'granted' || gyroStatus === 'unsupported');
    }
    
    async stopRecording() {
        try {
            this.isRecording = false;
            
            // Clear recording timeout
            if (this.recordingTimeout) {
                clearTimeout(this.recordingTimeout);
                this.recordingTimeout = null;
            }
            
            // Stop performance monitoring
            if (this.performanceMonitor) {
                this.performanceMonitor.stop();
            }
            
            // Update UI
            document.getElementById('start-btn').style.display = 'inline-flex';
            document.getElementById('stop-btn').style.display = 'none';
            document.getElementById('post-recording-controls').classList.add('visible');
            
            const statusIndicator = document.getElementById('status-indicator');
            statusIndicator.className = 'status-indicator status-idle';
            statusIndicator.innerHTML = '<span>Recording completed</span>';
            
            // Stop worker recording
            this.worker.postMessage({ type: 'STOP_RECORDING' });
            
        } catch (error) {
            ErrorBoundary.handle(error, 'Stop Recording');
        }
    }
    
    async saveRecordingData(data, stats) {
        try {
            if (!this.currentRecordingId) return;
            
            // Update recording status
            const transaction = this.db.transaction(['recordings', 'performanceMetrics'], 'readwrite');
            const recordingStore = transaction.objectStore('recordings');
            const metricsStore = transaction.objectStore('performanceMetrics');
            
            const getRequest = recordingStore.get(this.currentRecordingId);
            getRequest.onsuccess = () => {
                const recording = getRequest.result;
                recording.status = 'completed';
                recording.endTime = new Date().toISOString();
                recording.dataPointCount = data.length;
                recording.averageHz = stats?.averageHz || 0;
                recordingStore.put(recording);
            };
            
            // Save performance metrics
            if (stats) {
                metricsStore.add({
                    recordingId: this.currentRecordingId,
                    totalPoints: stats.totalPoints,
                    averageHz: stats.averageHz,
                    timestamp: new Date().toISOString()
                });
            }
            
            // Save data points in chunks to avoid memory issues
            const CHUNK_SIZE = 1000;
            const chunks = Math.ceil(data.length / CHUNK_SIZE);
            
            for (let i = 0; i < chunks; i++) {
                const chunk = data.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
                const dataTransaction = this.db.transaction(['dataPoints'], 'readwrite');
                const dataStore = dataTransaction.objectStore('dataPoints');
                
                for (const point of chunk) {
                    point.recordingId = this.currentRecordingId;
                    dataStore.add(point);
                }
            }
            
            console.log(`Saved ${data.length} data points to IndexedDB`);
            this.showNotification(`Recording saved: ${data.length} data points at ${stats?.averageHz?.toFixed(1) || 0} Hz average`, 'success');
            
        } catch (error) {
            ErrorBoundary.handle(error, 'Save Recording Data');
        }
    }
    
    updateStats(stats) {
        if (this.performanceMonitor) {
            this.performanceMonitor.updateBufferSize(stats.bufferSize || 0);
        }
        
        // Update any other UI elements with stats
        if (stats.averageHz) {
            console.log(`Current average sample rate: ${stats.averageHz} Hz`);
        }
    }
    
    async downloadCSV() {
        try {
            if (!this.currentRecordingId) {
                this.showNotification('No recording available to download', 'warning');
                return;
            }
            
            // Show loading indicator
            this.
