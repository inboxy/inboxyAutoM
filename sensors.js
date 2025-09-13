// ============================================
// sensors.js - Sensor Management - FIXED VERSION
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
        
        // Don't start UI tracking immediately - wait for permission check
        console.log('✅ SensorManager initialized');
    }
    
    async checkPermissions() {
        console.log('🔍 Checking sensor permissions...');
        
        // Check GPS permission first
        await this.checkGPSPermission();
        
        // Check motion sensors
        await this.checkMotionPermissions();
        
        // Start UI tracking after permissions are checked
        this.startUITracking();
    }
    
    async checkGPSPermission() {
        if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
            try {
                console.log('📍 Testing GPS permission...');
                const position = await this.getCurrentPosition();
                console.log('✅ GPS permission granted:', position);
                this.updatePermissionStatus('gps', 'granted');
                return true;
            } catch (error) {
                console.warn('❌ GPS permission error:', error);
                this.updatePermissionStatus('gps', 'denied');
                this.showRetryButton('gps');
                return false;
            }
        } else {
            console.log('❌ Geolocation not supported');
            this.updatePermissionStatus('gps', 'unsupported');
            return false;
        }
    }
    
    async checkMotionPermissions() {
        if (typeof window === 'undefined' || !('DeviceMotionEvent' in window)) {
            console.log('❌ DeviceMotionEvent not supported');
            this.updatePermissionStatus('accel', 'unsupported');
            this.updatePermissionStatus('gyro', 'unsupported');
            return false;
        }
        
        // Check if permission request is required (iOS 13+)
        if (typeof DeviceMotionEvent.requestPermission === 'function') {
            console.log('📱 iOS device detected - requesting motion permission...');
            try {
                const permission = await DeviceMotionEvent.requestPermission();
                console.log('Motion permission response:', permission);
                
                if (permission === 'granted') {
                    console.log('✅ Motion sensors permission granted');
                    this.updatePermissionStatus('accel', 'granted');
                    this.updatePermissionStatus('gyro', 'granted');
                    return true;
                } else {
                    console.log('❌ Motion sensors permission denied');
                    this.updatePermissionStatus('accel', 'denied');
                    this.updatePermissionStatus('gyro', 'denied');
                    this.showRetryButton('accel');
                    this.showRetryButton('gyro');
                    return false;
                }
            } catch (error) {
                console.error('Motion permission request failed:', error);
                this.updatePermissionStatus('accel', 'denied');
                this.updatePermissionStatus('gyro', 'denied');
                this.showRetryButton('accel');
                this.showRetryButton('gyro');
                return false;
            }
        } else {
            // For non-iOS devices, test if we can get data
            console.log('🤖 Non-iOS device - testing motion sensors...');
            return await this.testMotionSensors();
        }
    }
    
    testMotionSensors() {
        return new Promise((resolve) => {
            let hasAccelData = false;
            let hasGyroData = false;
            let eventCount = 0;
            
            const testHandler = (event) => {
                eventCount++;
                console.log(`Motion test event ${eventCount}:`, event);
                
                // Test acceleration data
                if (event.accelerationIncludingGravity) {
                    const { x, y, z } = event.accelerationIncludingGravity;
                    if (x !== null && y !== null && z !== null) {
                        hasAccelData = true;
                        console.log('✅ Accelerometer data detected:', { x, y, z });
                        this.updatePermissionStatus('accel', 'granted');
                    }
                }
                
                // Test gyroscope data
                if (event.rotationRate) {
                    const { alpha, beta, gamma } = event.rotationRate;
                    if (alpha !== null || beta !== null || gamma !== null) {
                        hasGyroData = true;
                        console.log('✅ Gyroscope data detected:', { alpha, beta, gamma });
                        this.updatePermissionStatus('gyro', 'granted');
                    }
                }
                
                // If we have both types of data, we can stop testing early
                if (hasAccelData && hasGyroData) {
                    window.removeEventListener('devicemotion', testHandler);
                    resolve(true);
                }
            };
            
            console.log('👂 Listening for motion events... (move your device)');
            window.addEventListener('devicemotion', testHandler);
            
            // Stop testing after 5 seconds
            setTimeout(() => {
                window.removeEventListener('devicemotion', testHandler);
                
                console.log(`Motion sensor test completed - Events: ${eventCount}, Accel: ${hasAccelData}, Gyro: ${hasGyroData}`);
                
                if (!hasAccelData) {
                    console.log('❌ No accelerometer data detected');
                    this.updatePermissionStatus('accel', 'denied');
                    this.showRetryButton('accel');
                }
                
                if (!hasGyroData) {
                    console.log('❌ No gyroscope data detected');
                    this.updatePermissionStatus('gyro', 'denied');
                    this.showRetryButton('gyro');
                }
                
                resolve(hasAccelData || hasGyroData);
            }, 5000);
        });
    }
    
    showRetryButton(sensor) {
        const retryBtn = document.getElementById(`${sensor}-retry`);
        if (retryBtn) {
            retryBtn.style.display = 'inline-block';
        }
    }
    
    hideRetryButton(sensor) {
        const retryBtn = document.getElementById(`${sensor}-retry`);
        if (retryBtn) {
            retryBtn.style.display = 'none';
        }
    }
    
    async retryPermission(sensor) {
        console.log(`🔄 Retrying permission for ${sensor}...`);
        
        if (sensor === 'gps') {
            const granted = await this.checkGPSPermission();
            if (granted) {
                this.hideRetryButton('gps');
                this.startGPSForUI();
            }
        } else if (sensor === 'accel' || sensor === 'gyro') {
            // For motion sensors, retry the permission check
            const granted = await this.checkMotionPermissions();
            if (granted) {
                this.hideRetryButton('accel');
                this.hideRetryButton('gyro');
                this.startMotionForUI();
            }
        }
    }
    
    updatePermissionStatus(sensor, status) {
        if (typeof document === 'undefined') return;
        
        const element = document.getElementById(`${sensor}-status`);
        if (element) {
            element.textContent = status.charAt(0).toUpperCase() + status.slice(1);
            element.className = `permission-status status-${status}`;
            console.log(`📊 ${sensor} status updated to: ${status}`);
        }
    }
    
    getCurrentPosition() {
        if (typeof navigator === 'undefined' || !navigator.geolocation) {
            return Promise.reject(new Error('Geolocation not available'));
        }
        
        return new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 5000
            });
        });
    }
    
    // Start tracking for UI display only (after permissions granted)
    startUITracking() {
        console.log('🚀 Starting UI tracking...');
        this.startGPSForUI();
        this.startMotionForUI();
    }
    
    // Start GPS tracking for UI display (always active)
    startGPSForUI() {
        if (typeof navigator === 'undefined' || !navigator.geolocation) return;
        
        console.log('🌐 Starting GPS tracking for UI...');
        
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
                
                console.log('📍 GPS data received:', { latitude, longitude, accuracy });
                
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
        
        console.log('📱 Starting motion tracking for UI...');
        
        // Clean up existing motion tracking
        if (this.cleanupMotion) {
            this.cleanupMotion();
        }
        
        // Store latest sensor data
        let latestMotionEvent = null;
        let lastProcessTime = 0;
        let lastUIUpdate = 0;
        
        // Motion handler
        const motionHandler = (event) => {
            latestMotionEvent = {
                acceleration: event.accelerationIncludingGravity,
                rotationRate: event.rotationRate,
                timestamp: event.timeStamp || performance.now()
            };
            
            // Log first few events for debugging
            if (performance.now() < 5000) { // First 5 seconds
                console.log('📱 Motion event:', {
                    accel: event.accelerationIncludingGravity,
                    gyro: event.rotationRate
                });
            }
        };
        
        window.addEventListener('devicemotion', motionHandler, { passive: true });
        
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
                    
                    if (validateSensorData('accel', { x, y, z })) {
                        // Update UI every 100ms (10Hz)
                        if (currentTime - lastUIUpdate > 100) {
                            this.updateAccelUI(x, y, z);
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
                    
                    if (this.isValidGyroData(alpha, beta, gamma)) {
                        // Update UI every 100ms (10Hz)
                        if (currentTime - lastUIUpdate > 100) {
                            this.updateGyroUI(alpha, beta, gamma);
                            lastUIUpdate = currentTime;
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
        
        console.log('✅ Motion tracking started');
    }
    
    // Enhanced gyroscope data validation
    isValidGyroData(alpha, beta, gamma) {
        // Check if at least one value is a valid number
        const isValidNumber = (val) => typeof val === 'number' && isFinite(val);
        
        return isValidNumber(alpha) || isValidNumber(beta) || isValidNumber(gamma);
    }
    
    startTracking(startTime, userId) {
        this.isTracking = true;
        this.recordingStartTime = startTime;
        this.recordingUserId = userId;
        
        console.log('🔴 Started recording mode - sensors will now save data');
    }
    
    stopTracking() {
        this.isTracking = false;
        this.recordingStartTime = null;
        this.recordingUserId = null;
        
        console.log('⏹️ Stopped recording mode - sensors continue for UI display only');
    }
    
    updateGPSUI(lat, lon, accuracy, altitude) {
        if (typeof document === 'undefined') return;
        
        try {
            const latEl = document.getElementById('gps-lat');
            const lonEl = document.getElementById('gps-lon');
            const accuracyEl = document.getElementById('gps-accuracy');
            const altitudeEl = document.getElementById('gps-altitude');
            
            if (latEl) latEl.textContent = lat.toFixed(6);
            if (lonEl) lonEl.textContent = lon.toFixed(6);
            if (accuracyEl) accuracyEl.textContent = `${accuracy.toFixed(1)} m`;
            if (altitudeEl) altitudeEl.textContent = altitude ? `${altitude.toFixed(1)} m` : '-- m';
            
            console.log('📍 GPS UI updated:', { lat: lat.toFixed(6), lon: lon.toFixed(6), accuracy: accuracy.toFixed(1) });
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
            const magnitudeEl = document.getElementById('accel-magnitude');
            
            if (xEl) xEl.textContent = (x !== null && x !== undefined) ? `${x.toFixed(2)}` : '0.00';
            if (yEl) yEl.textContent = (y !== null && y !== undefined) ? `${y.toFixed(2)}` : '0.00';
            if (zEl) zEl.textContent = (z !== null && z !== undefined) ? `${z.toFixed(2)}` : '0.00';
            
            // Calculate and display magnitude
            if (magnitudeEl && x !== null && y !== null && z !== null) {
                const magnitude = Math.sqrt(x*x + y*y + z*z);
                magnitudeEl.textContent = magnitude.toFixed(2);
            } else if (magnitudeEl) {
                magnitudeEl.textContent = '0.00';
            }
            
            // Log first few updates for debugging
            if (performance.now() < 5000 && x !== null && y !== null && z !== null) {
                console.log('📊 Accel UI updated:', { x: x.toFixed(2), y: y.toFixed(2), z: z.toFixed(2) });
            }
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
            
            if (alphaEl) {
                if (alpha !== null && alpha !== undefined && isFinite(alpha)) {
                    alphaEl.textContent = `${alpha.toFixed(2)} °/s`;
                } else {
                    alphaEl.textContent = '-- °/s';
                }
            }
            
            if (betaEl) {
                if (beta !== null && beta !== undefined && isFinite(beta)) {
                    betaEl.textContent = `${beta.toFixed(2)} °/s`;
                } else {
                    betaEl.textContent = '-- °/s';
                }
            }
            
            if (gammaEl) {
                if (gamma !== null && gamma !== undefined && isFinite(gamma)) {
                    gammaEl.textContent = `${gamma.toFixed(2)} °/s`;
                } else {
                    gammaEl.textContent = '-- °/s';
                }
            }
            
            // Log first few updates for debugging
            const validValues = [alpha, beta, gamma].filter(val => val !== null && val !== undefined && isFinite(val));
            if (performance.now() < 5000 && validValues.length > 0) {
                console.log('🌀 Gyro UI updated:', { alpha, beta, gamma });
            }
            
        } catch (error) {
            console.warn('Error updating gyroscope UI:', error);
        }
    }
    
    adjustSampleRateForBattery(batteryLevel) {
        if (batteryLevel < 0.2) {
            this.adaptiveSampleRate = 60;
            console.log('🔋 Battery low, reducing sample rate to 60Hz');
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
        
        const hasPermissions = (gpsStatus === 'granted' || gpsStatus === 'unsupported') &&
               (accelStatus === 'granted' || accelStatus === 'unsupported') &&
               (gyroStatus === 'granted' || gyroStatus === 'unsupported');
        
        console.log('🔐 Permission check:', { gpsStatus, accelStatus, gyroStatus, hasPermissions });
        
        return hasPermissions;
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
