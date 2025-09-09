// ============================================
// sensors.js - Sensor Management and Data Collection - COMPLETE FIX
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
        
        // Start tracking immediately for UI display (not recording)
        this.startUITracking();
    }
    
    // Start tracking for UI display only (before recording starts)
    startUITracking() {
        this.startGPSForUI();
        this.startMotionForUI();
    }
    
    async checkPermissions() {
        // Check GPS permission
        if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
            try {
                await this.getCurrentPosition();
                this.updatePermissionStatus('gps', 'granted');
                // Start GPS tracking for UI immediately after permission granted
                this.startGPSForUI();
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
        if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window && typeof DeviceMotionEvent.requestPermission === 'function') {
            try {
                const permission = await DeviceMotionEvent.requestPermission();
                if (permission === 'granted') {
                    this.updatePermissionStatus('accel', 'granted');
                    this.updatePermissionStatus('gyro', 'granted');
                    // Start motion tracking for UI immediately after permission granted
                    this.startMotionForUI();
                } else {
                    this.updatePermissionStatus('accel', 'denied');
                    this.updatePermissionStatus('gyro', 'denied');
                    const accelRetry = document.getElementById('accel-retry');
                    const gyroRetry = document.getElementById('gyro-retry');
                    if (accelRetry) accelRetry.style.display = 'inline-block';
                    if (gyroRetry) gyroRetry.style.display = 'inline-block';
                }
            } catch (error) {
                this.updatePermissionStatus('accel', 'denied');
                this.updatePermissionStatus('gyro', 'denied');
            }
        } else if (typeof window !== 'undefined' && 'DeviceMotionEvent' in window) {
            // For non-iOS devices, test if we're getting data
            this.testMotionSensors();
        } else {
            this.updatePermissionStatus('accel', 'unsupported');
            this.updatePermissionStatus('gyro', 'unsupported');
        }
    }
    
    testMotionSensors() {
        if (typeof window === 'undefined') return;
        
        let hasData = false;
        
        const testHandler = (event) => {
            if (event.accelerationIncludingGravity || event.rotationRate) {
                hasData = true;
                this.updatePermissionStatus('accel', 'granted');
                this.updatePermissionStatus('gyro', 'granted');
                window.removeEventListener('devicemotion', testHandler);
                // Start motion tracking for UI after detecting data
                this.startMotionForUI();
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
                const retryBtn = document.getElementById('gps-retry');
                if (retryBtn) retryBtn.style.display = 'none';
                // Restart GPS tracking for UI
                this.startGPSForUI();
            } catch (error) {
                if (typeof window !== 'undefined' && window.app && window.app.showNotification) {
                    window.app.showNotification('GPS permission denied. Please enable in browser settings.', 'error');
                }
            }
        } else if (sensor === 'accel' || sensor === 'gyro') {
            if (typeof window !== 'undefined' && typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
                try {
                    const permission = await DeviceMotionEvent.requestPermission();
                    if (permission === 'granted') {
                        this.updatePermissionStatus('accel', 'granted');
                        this.updatePermissionStatus('gyro', 'granted');
                        const accelRetry = document.getElementById('accel-retry');
                        const gyroRetry = document.getElementById('gyro-retry');
                        if (accelRetry) accelRetry.style.display = 'none';
                        if (gyroRetry) gyroRetry.style.display = 'none';
                        // Restart motion tracking for UI
                        this.startMotionForUI();
                    }
                } catch (error) {
                    if (typeof window !== 'undefined' && window.app && window.app.showNotification) {
                        window.app.showNotification('Motion sensor permission denied. Please enable in browser settings.', 'error');
                    }
                }
            }
        }
    }
    
    updatePermissionStatus(sensor, status) {
        if (typeof document === 'undefined') return;
        
        const element = document.getElementById(`${sensor}-status`);
        if (element) {
            element.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            element.className = `permission-status status-${status}`;
        }
    }
    
    getCurrentPosition() {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            return Promise.reject(new Error('Geolocation not available'));
        }
        
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 5000
            });
        });
    }
    
    // Start GPS tracking for UI display (always active)
    startGPSForUI() {
        if (typeof navigator === 'undefined' || !navigator.geolocation) return;
        
        // Clear existing watch if any
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
        }
        
        const options = {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 2000
        };
        
        this.watchId = navigator.geolocation.watchPosition(
            (position) => {
                const { latitude, longitude, accuracy, altitude, altitudeAccuracy, heading, speed } = position.coords;
                const timestamp = new Date(position.timestamp).toISOString();
                
                console.log('GPS data received:', { latitude, longitude, accuracy });
                
                // Always update UI
                this.updateGPSUI(latitude, longitude, accuracy, altitude);
                
                // Send data if recording (tracking mode)
                if (this.isTracking && this.onDataCallback) {
                    this.onDataCallback({
                        recordingTimestamp: this.recordingStartTime,
                        userId: this.recordingUserId,
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
                    this.updatePermissionStatus('gps', 'error');
                }
            },
            options
        );
    }
    
    // Start motion tracking for UI display (always active)
    startMotionForUI() {
        if (typeof window === 'undefined') return;
        
        // Clean up existing motion tracking
        if (this.cleanupMotion) {
            this.cleanupMotion();
        }
        
        // Use passive listeners for better performance
        const options = { passive: true };
        
        // Store latest sensor data
        let latestMotionEvent = null;
        let lastProcessTime = 0;
        let lastUIUpdate = 0;
        
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
                    
                    console.log('Accel data received:', { x, y, z });
                    
                    if (validateSensorData('accel', { x, y, z })) {
                        // Throttled UI updates (10Hz) - Always update UI
                        if (currentTime - lastUIUpdate > 100) {
                            this.updateAccelUI(x, y, z);
                            lastUIUpdate = currentTime;
                        }
                        
                        // Send data if recording (tracking mode)
                        if (this.isTracking) {
                            accelBatch.push({
                                recordingTimestamp: this.recordingStartTime,
                                userId: this.recordingUserId,
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
                    
                    console.log('Gyro data received:', { alpha, beta, gamma });
                    
                    if (validateSensorData('gyro', { alpha, beta, gamma })) {
                        // Throttled UI updates - Always update UI
                        if (currentTime - lastUIUpdate > 100) {
                            this.updateGyroUI(alpha, beta, gamma);
                        }
                        
                        // Send data if recording (tracking mode)
                        if (this.isTracking) {
                            gyroBatch.push({
                                recordingTimestamp: this.recordingStartTime,
                                userId: this.recordingUserId,
                                gyroTimestamp: timestamp,
                                gyroAlpha: alpha,
                                gyroBeta: beta,
                                gyroGamma: gamma,
                                timestamp: now
                            });
                        }
                    }
                }
                
                // Send batches when they reach target size (only when recording)
                if (this.isTracking && this.onDataCallback && accelBatch.length >= 10) {
                    this.onDataCallback(accelBatch);
                    accelBatch = [];
                }
                
                if (this.isTracking && this.onDataCallback && gyroBatch.length >= 10) {
                    this.onDataCallback(gyroBatch);
                    gyroBatch = [];
                }
                
                lastProcessTime = currentTime;
            }
            
            this.sensorRafId = requestAnimationFrame(processMotionData);
        };
        
        // Start processing loop
        this.sensorRafId = requestAnimationFrame(processMotionData);
        
        // Periodic batch flush for remaining data (only when recording)
        this.batchInterval = setInterval(() => {
            if (this.isTracking && this.onDataCallback) {
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
                this.sensorRafId = null;
            }
            if (this.batchInterval) {
                clearInterval(this.batchInterval);
                this.batchInterval = null;
            }
        };
    }
    
    startTracking(startTime, userId) {
        this.isTracking = true;
        this.recordingStartTime = startTime;
        this.recordingUserId = userId;
        
        console.log('Started recording mode - sensors will now save data');
        
        // Sensors are already running for UI, just enable data collection
        // No need to restart - just set the recording flag and parameters
    }
    
    stopTracking() {
        this.isTracking = false;
        this.recordingStartTime = null;
        this.recordingUserId = null;
        
        console.log('Stopped recording mode - sensors continue for UI display only');
        
        // Don't stop sensors - keep them running for UI display
        // Just disable data collection for recording
    }
    
    // Legacy methods for backward compatibility - now just aliases
    startGPSTracking(startTime, userId) {
        this.startTracking(startTime, userId);
    }
    
    stopGPSTracking() {
        // Don't actually stop GPS - it should continue for UI
        // This is handled in stopTracking()
    }
    
    startMotionTracking(startTime, userId) {
        this.startTracking(startTime, userId);
    }
    
    stopMotionTracking() {
        // Don't actually stop motion sensors - they should continue for UI
        // This is handled in stopTracking()
    }
    
    updateGPSUI(lat, lon, accuracy, altitude) {
        if (typeof document === 'undefined') return;
        
        try {
            const latEl = document.getElementById('gps-lat');
            const lonEl = document.getElementById('gps-lon');
            const errorEl = document.getElementById('gps-error');
            const altEl = document.getElementById('gps-alt');
            
            if (latEl) latEl.textContent = lat.toFixed(6);
            if (lonEl) lonEl.textContent = lon.toFixed(6);
            if (errorEl) errorEl.textContent = `${accuracy.toFixed(1)} m`;
            if (altEl) altEl.textContent = altitude ? `${altitude.toFixed(1)} m` : '-- m';
        } catch (error) {
            console.warn('Error updating GPS UI:', error);
        }
    }
    
    updateAccelUI(x, y, z) {
        if (typeof document === 'undefined') return;
        
        try {
            const xEl = document.getElementById('accel-x');
            const yEl = document.getElementById('accel-y');
            const zEl = document.getElementById('accel-z');
            
            if (xEl) xEl.textContent = (x !== null && x !== undefined) ? `${x.toFixed(2)} m/s²` : '-- m/s²';
            if (yEl) yEl.textContent = (y !== null && y !== undefined) ? `${y.toFixed(2)} m/s²` : '-- m/s²';
            if (zEl) zEl.textContent = (z !== null && z !== undefined) ? `${z.toFixed(2)} m/s²` : '-- m/s²';
        } catch (error) {
            console.warn('Error updating accelerometer UI:', error);
        }
    }
    
    updateGyroUI(alpha, beta, gamma) {
        if (typeof document === 'undefined') return;
        
        try {
            const alphaEl = document.getElementById('gyro-alpha');
            const betaEl = document.getElementById('gyro-beta');
            const gammaEl = document.getElementById('gyro-gamma');
            
            if (alphaEl) alphaEl.textContent = (alpha !== null && alpha !== undefined) ? `${alpha.toFixed(2)} °/s` : '-- °/s';
            if (betaEl) betaEl.textContent = (beta !== null && beta !== undefined) ? `${beta.toFixed(2)} °/s` : '-- °/s';
            if (gammaEl) gammaEl.textContent = (gamma !== null && gamma !== undefined) ? `${gamma.toFixed(2)} °/s` : '-- °/s';
        } catch (error) {
            console.warn('Error updating gyroscope UI:', error);
        }
    }
    
    adjustSampleRateForBattery(batteryLevel) {
        if (batteryLevel < 0.2) {
            this.adaptiveSampleRate = 60;
            console.log('Battery low, reducing sample rate to 60Hz');
        } else if (batteryLevel < 0.5) {
            this.adaptiveSampleRate = 100;
        } else {
            const targetRate = (typeof window !== 'undefined' && window.MotionRecorderConfig?.sensors?.targetRate) || 140;
            this.adaptiveSampleRate = targetRate;
        }
    }
    
    checkRecordingPermissions() {
        if (typeof document === 'undefined') return false;
        
        const gpsStatus = document.getElementById('gps-status')?.textContent.toLowerCase();
        const accelStatus = document.getElementById('accel-status')?.textContent.toLowerCase();
        const gyroStatus = document.getElementById('gyro-status')?.textContent.toLowerCase();
        
        return (gpsStatus === 'granted' || gpsStatus === 'unsupported') &&
               (accelStatus === 'granted' || accelStatus === 'unsupported') &&
               (gyroStatus === 'granted' || gyroStatus === 'unsupported');
    }
    
    // Cleanup method to be called when app is destroyed
    destroy() {
        this.stopTracking();
        
        if (this.watchId && typeof navigator !== 'undefined' && navigator.geolocation) {
            navigator.geolocation.clearWatch(this.watchId);
            this.watchId = null;
        }
        
        if (this.cleanupMotion) {
            this.cleanupMotion();
            this.cleanupMotion = null;
        }
    }
}
