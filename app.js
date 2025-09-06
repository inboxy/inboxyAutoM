// NanoID fallback if CDN fails
if (typeof nanoid === 'undefined') {
    window.nanoid = () => Math.random().toString(36).substring(2, 12);
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
        
        this.init();
    }
    
    async init() {
        await this.initUserId();
        await this.initIndexedDB();
        this.initUI();
        this.checkPermissions();
        this.initWorker();
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
            // Generate new 10 character unique ID using nanoid
            userId = nanoid(10);
            // Store in cookie (expires in 1 year)
            const expires = new Date();
            expires.setFullYear(expires.getFullYear() + 1);
            document.cookie = `userId=${userId}; expires=${expires.toUTCString()}; path=/`;
        }
        
        this.userId = userId;
        document.getElementById('user-id').textContent = userId;
    }
    
    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open('MotionRecorderDB', 1);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create recordings store
                const recordingStore = db.createObjectStore('recordings', {
                    keyPath: 'id',
                    autoIncrement: true
                });
                recordingStore.createIndex('timestamp', 'timestamp', { unique: false });
                recordingStore.createIndex('userId', 'userId', { unique: false });
                
                // Create data points store
                const dataStore = db.createObjectStore('dataPoints', {
                    keyPath: 'id',
                    autoIncrement: true
                });
                dataStore.createIndex('recordingId', 'recordingId', { unique: false });
                dataStore.createIndex('timestamp', 'timestamp', { unique: false });
            };
        });
    }
    
    initUI() {
        document.getElementById('start-btn').addEventListener('click', () => this.startRecording());
        document.getElementById('stop-btn').addEventListener('click', () => this.stopRecording());
        document.getElementById('download-btn').addEventListener('click', () => this.downloadCSV());
        document.getElementById('upload-btn').addEventListener('click', () => this.uploadJSON());
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
                    this.saveRecordingData(data);
                    break;
                    
                case 'CSV_GENERATED':
                    this.downloadCSVFile(data);
                    break;
            }
        });
        
        this.worker.addEventListener('error', (error) => {
            console.error('Worker error:', error);
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
            }
        } else {
            this.updatePermissionStatus('gps', 'denied');
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
                }
            } catch (error) {
                this.updatePermissionStatus('accel', 'denied');
                this.updatePermissionStatus('gyro', 'denied');
            }
        } else if ('DeviceMotionEvent' in window) {
            // For non-iOS devices, assume permission is granted
            this.updatePermissionStatus('accel', 'granted');
            this.updatePermissionStatus('gyro', 'granted');
            this.startMotionTracking();
        } else {
            this.updatePermissionStatus('accel', 'denied');
            this.updatePermissionStatus('gyro', 'denied');
        }
    }
    
    updatePermissionStatus(sensor, status) {
        const element = document.getElementById(`${sensor}-status`);
        element.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        element.className = `permission-status status-${status}`;
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
                const { latitude, longitude, accuracy, altitude } = position.coords;
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
        // Request high frequency for motion sensors
        let lastAccelUpdate = 0;
        const targetInterval = 1000 / 140; // 140Hz target
        
        window.addEventListener('devicemotion', (event) => {
            const now = Date.now();
            
            // Throttle to approximately 140Hz
            if (now - lastAccelUpdate < targetInterval) return;
            lastAccelUpdate = now;
            
            const acceleration = event.accelerationIncludingGravity;
            const rotationRate = event.rotationRate;
            
            if (acceleration) {
                const { x, y, z } = acceleration;
                
                // Update UI
                document.getElementById('accel-x').textContent = x ? `${x.toFixed(2)} m/s²` : '-- m/s²';
                document.getElementById('accel-y').textContent = y ? `${y.toFixed(2)} m/s²` : '-- m/s²';
                document.getElementById('accel-z').textContent = z ? `${z.toFixed(2)} m/s²` : '-- m/s²';
                
                // Send to worker if recording
                if (this.isRecording) {
                    this.worker.postMessage({
                        type: 'ADD_DATA_POINT',
                        data: {
                            recordingTimestamp: this.startTime,
                            userId: this.userId,
                            accelTimestamp: new Date().toISOString(),
                            accelX: x,
                            accelY: y,
                            accelZ: z,
                            timestamp: now
                        }
                    });
                }
            }
            
            if (rotationRate) {
                const { alpha, beta, gamma } = rotationRate;
                
                // Update UI
                document.getElementById('gyro-alpha').textContent = alpha ? `${alpha.toFixed(2)} °/s` : '-- °/s';
                document.getElementById('gyro-beta').textContent = beta ? `${beta.toFixed(2)} °/s` : '-- °/s';
                document.getElementById('gyro-gamma').textContent = gamma ? `${gamma.toFixed(2)} °/s` : '-- °/s';
                
                // Send to worker if recording
                if (this.isRecording) {
                    this.worker.postMessage({
                        type: 'ADD_DATA_POINT',
                        data: {
                            recordingTimestamp: this.startTime,
                            userId: this.userId,
                            gyroTimestamp: new Date().toISOString(),
                            gyroAlpha: alpha,
                            gyroBeta: beta,
                            gyroGamma: gamma,
                            timestamp: now
                        }
                    });
                }
            }
        });
    }
    
    async startRecording() {
        this.isRecording = true;
        this.startTime = new Date().toISOString();
        
        // Update UI
        document.getElementById('start-btn').style.display = 'none';
        document.getElementById('stop-btn').style.display = 'inline-flex';
        document.getElementById('post-recording-controls').classList.remove('visible');
        
        const statusIndicator = document.getElementById('status-indicator');
        statusIndicator.className = 'status-indicator status-recording pulse';
        statusIndicator.innerHTML = '<span>● Recording...</span>';
        
        // Start worker recording
        this.worker.postMessage({ type: 'START_RECORDING' });
        
        // Create recording entry in IndexedDB
        const transaction = this.db.transaction(['recordings'], 'readwrite');
        const store = transaction.objectStore('recordings');
        
        const recording = {
            userId: this.userId,
            timestamp: this.startTime,
            status: 'recording'
        };
        
        const request = store.add(recording);
        request.onsuccess = () => {
            this.currentRecordingId = request.result;
        };
    }
    
    async stopRecording() {
        this.isRecording = false;
        
        // Update UI
        document.getElementById('start-btn').style.display = 'inline-flex';
        document.getElementById('stop-btn').style.display = 'none';
        document.getElementById('post-recording-controls').classList.add('visible');
        
        const statusIndicator = document.getElementById('status-indicator');
        statusIndicator.className = 'status-indicator status-idle';
        statusIndicator.innerHTML = '<span>Recording completed</span>';
        
        // Stop worker recording
        this.worker.postMessage({ type: 'STOP_RECORDING' });
    }
    
    async saveRecordingData(data) {
        if (!this.currentRecordingId) return;
        
        // Update recording status
        const transaction = this.db.transaction(['recordings'], 'readwrite');
        const recordingStore = transaction.objectStore('recordings');
        
        const getRequest = recordingStore.get(this.currentRecordingId);
        getRequest.onsuccess = () => {
            const recording = getRequest.result;
            recording.status = 'completed';
            recording.endTime = new Date().toISOString();
            recording.dataPointCount = data.length;
            recordingStore.put(recording);
        };
        
        // Save data points
        const dataTransaction = this.db.transaction(['dataPoints'], 'readwrite');
        const dataStore = dataTransaction.objectStore('dataPoints');
        
        for (const point of data) {
            point.recordingId = this.currentRecordingId;
            dataStore.add(point);
        }
        
        console.log(`Saved ${data.length} data points to IndexedDB`);
    }
    
    async downloadCSV() {
        if (!this.currentRecordingId) return;
        
        // Retrieve data from IndexedDB
        const transaction = this.db.transaction(['dataPoints'], 'readonly');
        const store = transaction.objectStore('dataPoints');
        const index = store.index('recordingId');
        
        const request = index.getAll(this.currentRecordingId);
        request.onsuccess = () => {
            const data = request.result;
            this.worker.postMessage({
                type: 'GENERATE_CSV',
                data: data
            });
        };
    }
    
    downloadCSVFile(csvContent) {
        const now = new Date();
        const year = now.getUTCFullYear();
        const month = String(now.getUTCMonth() + 1).padStart(2, '0');
        const date = String(now.getUTCDate()).padStart(2, '0');
        const time = now.toISOString().substr(11, 8).replace(/:/g, '');
        
        const filename = `inbx_${this.userId}_${year}_${month}_${date}_${time}.csv`;
        
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }
    
    async uploadJSON() {
        if (!this.currentRecordingId) return;
        
        // Retrieve recording and data from IndexedDB
        const recordingTransaction = this.db.transaction(['recordings'], 'readonly');
        const recordingStore = recordingTransaction.objectStore('recordings');
        const recordingRequest = recordingStore.get(this.currentRecordingId);
        
        recordingRequest.onsuccess = () => {
            const recording = recordingRequest.result;
            
            const dataTransaction = this.db.transaction(['dataPoints'], 'readonly');
            const dataStore = dataTransaction.objectStore('dataPoints');
            const index = dataStore.index('recordingId');
            const dataRequest = index.getAll(this.currentRecordingId);
            
            dataRequest.onsuccess = () => {
                const dataPoints = dataRequest.result;
                
                const jsonData = {
                    recording: recording,
                    dataPoints: dataPoints,
                    exportTimestamp: new Date().toISOString(),
                    totalPoints: dataPoints.length
                };
                
                // Post to configured URL (example.com for development)
                fetch('https://example.com/api/recordings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(jsonData)
                })
                .then(response => {
                    if (response.ok) {
                        alert('Upload successful!');
                    } else {
                        alert('Upload failed. Please try again.');
                    }
                })
                .catch(error => {
                    console.error('Upload error:', error);
                    alert('Upload failed. Please check your connection.');
                });
            };
        };
    }
}

// Initialize the app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new MotionRecorderApp();
    });
} else {
    new MotionRecorderApp();
}

// Register service worker for PWA functionality
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then((registration) => {
                console.log('ServiceWorker registration successful:', registration.scope);
            })
            .catch((error) => {
                console.error('ServiceWorker registration failed:', error);
            });
    });
} else {
    console.log('Service workers are not supported');
}
        
