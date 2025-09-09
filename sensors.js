// ============================================
// sensors.js - Sensor Management and Data Collection
// ============================================

import { ErrorBoundary, validateSensorData } from './utils.js';

export class SensorManager {
    constructor(onDataCallback) {
        this.onDataCallback = onDataCallback;
        this.watchId = null;
        this.sensorRafId = null;
        this.batchInterval = null;
        this.cleanupMotion = null;
        this.adaptiveSampleRate = 140;
        this.isTracking = false;
    }
    
    async checkPermissions() {
        // Check GPS permission
        if ('geolocation' in navigator) {
            try {
                await this.getCurrentPosition();
                this.updatePermissionStatus('gps', 'granted');
            } catch (error) {
                console.warn('GPS permission error:', error);
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
                document.getElementById('gps-retry').style.display = 'none';
            } catch (error) {
                if (window.app && window.app.showNotification) {
                    window.app.showNotification('GPS permission denied. Please enable in browser settings.', 'error');
                }
            }
        } else if (sensor === 'accel' || sensor === 'gyro') {
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                try {
                    const permission = await DeviceMotionEvent.requestPermission();
                    if (permission === 'granted') {
                        this.updatePermissionStatus('accel', 'granted');
                        this.updatePermissionStatus('gyro', 'granted');
                        document.getElementById('accel-retry').style.display = 'none';
                        document.getElementById('gyro-retry').style.display = 'none';
                    }
                } catch (error) {
                    if (window.app && window.app.showNotification) {
                        window.app.showNotification('Motion sensor permission denied. Please enable in browser settings.', 'error');
                    }
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
                timeout: 15000,
                maximumAge: 5000
            });
        });
    }
    
    startTracking(startTime, userId) {
        this.isTracking = true;
        this.startGPSTracking(startTime, userId);
        this.startMotionTracking(startTime, userId);
    }
    
    stopTracking() {
        this.isTracking = false;
        this.stopGPSTracking();
        this.stopMotionTracking();
    }
    
    startGPSTracking(startTime, userId) {
        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 2000
        };
        
        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, accuracy, altitude, altitudeAccuracy, heading, speed } = position.coords;
                const timestamp = new Date(position.timestamp).toISOString();
                
                // Update UI
                this.updateGPSUI(latitude, longitude, accuracy, altitude);
                
                // Send data if tracking
                if (this.isTracking && this.onDataCallback) {
                    this.onDataCallback({
                        recordingTimestamp: startTime,
                        userId: userId,
                        gpsTimestamp: timestamp,
                        gpsLat: latitude,
                        gpsLon: longitude,
                        gpsError: accuracy,
                        gpsAlt: altitude,
                        gpsAltAccuracy: altitudeAccuracy,
                        gpsHeading: heading,
                        gpsSpeed: speed,
                        timestamp: Date.now()
                    });
                }
            },
            (error) => {
                console.warn('GPS error:', error.message);
                if (error.code !== 3) { // TIMEOUT = 3
                    this.updatePermissionStatus('gps', 'denied');
                }
            },
            options
        );
    }
    
    stopGPSTracking() {
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
    }
    
    startMotionTracking(startTime, userId) {
        // Use passive listeners for better performance
        const options = { passive: true };
        
        // Store latest sensor data
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
        const targetInterval = 1000 / this.adaptiveSampleRate;
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
                    
                    if (validateSensorData('accel', { x, y, z })) {
                        // Throttled UI updates (10Hz)
                        if (currentTime - lastUIUpdate > 100) {
                            this.updateAccelUI(x, y, z);
                            lastUIUpdate = currentTime;
                        }
                        
                        if (this.isTracking) {
                            accelBatch.push({
                                recordingTimestamp: startTime,
                                userId: userId,
                                accelTimestamp: timestamp,
                                accelX: x,
                                accelY: y,
                                accelZ: z,
                                timestamp: now
                            });
                        }
                    }
                }
                
                // Process gyroscope
                if (latestMotionEvent.rotationRate) {
                    const { alpha, beta, gamma } = latestMotionEvent.rotationRate;
                    
                    if (validateSensorData('gyro', { alpha, beta, gamma })) {
                        // Throttled UI updates
                        if (currentTime - lastUIUpdate > 100) {
                            this.updateGyroUI(alpha, beta, gamma);
                        }
                        
                        if (this.isTracking) {
                            gyroBatch.push({
                                recordingTimestamp: startTime,
                                userId: userId,
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
                if (this.onDataCallback && accelBatch.length >= 10) {
                    this.onDataCallback(accelBatch);
                    accelBatch = [];
                }
                
                if (this.onDataCallback && gyroBatch.length >= 10) {
                    this.onDataCallback(gyroBatch);
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
            if (this.onDataCallback) {
                if (accelBatch.length > 0) {
                    this.onDataCallback(accelBatch);
                    accelBatch = [];
                }
                if (gyroBatch.length > 0) {
                    this.onDataCallback(gyroBatch);
                    gyroBatch = [];
                }
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
    
    stopMotionTracking() {
        if (this.cleanupMotion) {
            this.cleanupMotion();
            this.cleanupMotion = null;
        }
    }
    
    updateGPSUI(lat, lon, accuracy, altitude) {
        document.getElementById('gps-lat').textContent = lat.toFixed(6);
        document.getElementById('gps-lon').textContent = lon.toFixed(6);
        document.getElementById('gps-error').textContent = `${accuracy.toFixed(1)} m`;
        document.getElementById('gps-alt').textContent = altitude ? `${altitude.toFixed(1)} m` : '-- m';
    }
    
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
    
    adjustSampleRateForBattery(batteryLevel) {
        if (batteryLevel < 0.2) {
            this.adaptiveSampleRate = 60;
            console.log('Battery low, reducing sample rate to 60Hz');
        } else if (batteryLevel < 0.5) {
            this.adaptiveSampleRate = 100;
        } else {
            this.adaptiveSampleRate = window.MotionRecorderConfig?.sensors?.targetRate || 140;
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
}
