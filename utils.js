// ============================================
// utils.js - Utility Functions and Error Handling - FIXED
// ============================================

// Robust ID generation fallback (no dependency on nanoid)
export function generateId(length = 10) {
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

// Check if nanoid is available and working
export function setupNanoidFallback() {
    let nanoidAvailable = false;
    try {
        if (typeof window !== 'undefined' && typeof window.nanoid === 'function') {
            // Test nanoid to make sure it works
            const test = window.nanoid(5);
            if (test && test.length === 5) {
                nanoidAvailable = true;
            }
        }
    } catch (error) {
        console.warn('Nanoid not available or has errors, using fallback:', error.message);
    }

    // Set up fallback if nanoid is not available
    if (!nanoidAvailable) {
        if (typeof window !== 'undefined') {
            window.nanoid = generateId;
        }
        // Also create global nanoid for compatibility
        if (typeof globalThis !== 'undefined') {
            globalThis.nanoid = generateId;
        }
    }
    
    return nanoidAvailable;
}

// Enhanced error boundary for better error handling and recovery
export class ErrorBoundary {
    static errorCount = 0;
    static maxErrors = 10;
    static errorHistory = [];
    
    static handle(error, context, shouldRecover = true) {
        this.errorCount++;
        
        // Log detailed error information
        const errorInfo = {
            message: error?.message || 'Unknown error',
            stack: error?.stack || 'No stack trace',
            context,
            timestamp: new Date().toISOString(),
            userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Unknown',
            url: typeof window !== 'undefined' ? window.location.href : 'Unknown'
        };
        
        console.error(`[ErrorBoundary] Error #${this.errorCount} in ${context}:`, errorInfo);
        
        // Add to error history (keep last 20 errors)
        this.errorHistory.push(errorInfo);
        if (this.errorHistory.length > 20) {
            this.errorHistory.shift();
        }
        
        // Check for error storm (too many errors in short time)
        if (this.errorCount > this.maxErrors) {
            this.handleErrorStorm();
            return;
        }
        
        // Show user-friendly notification
        this.showUserNotification(error, context);
        
        // Report to monitoring service if configured
        if (typeof window !== 'undefined' && window.MotionRecorderConfig?.features?.errorReporting) {
            this.reportError(errorInfo, context);
        }
        
        // Attempt recovery if requested
        if (shouldRecover) {
            this.attemptRecovery(context);
        }
    }
    
    static handleErrorStorm() {
        console.error(`[ErrorBoundary] Error storm detected (${this.errorCount} errors). Entering safe mode.`);
        
        // Show critical error notification
        this.showUserNotification(
            new Error('Multiple errors detected. App entering safe mode.'),
            'Error Storm',
            'error',
            10000
        );
        
        // Disable non-essential features
        if (typeof window !== 'undefined' && window.app) {
            // Stop recording if active
            if (window.app.isRecording) {
                window.app.stopRecording();
            }
            
            // Clear intervals and timeouts
            if (window.performanceMonitor) {
                window.performanceMonitor.stop();
            }
        }
        
        // Reset error count after 30 seconds
        setTimeout(() => {
            this.errorCount = 0;
            console.log('[ErrorBoundary] Error count reset. Exiting safe mode.');
        }, 30000);
    }
    
    static showUserNotification(error, context, type = 'error', duration = 5000) {
        // Generate user-friendly error messages
        let userMessage = this.getUserFriendlyMessage(error, context);
        
        // Show notification through available channels
        if (typeof window !== 'undefined') {
            if (window.app && window.app.showNotification) {
                window.app.showNotification(userMessage, type, duration);
            } else if (window.materialTabs && window.materialTabs.showNotification) {
                window.materialTabs.showNotification(userMessage, type, duration);
            } else {
                // Fallback to basic notification
                showNotification(userMessage, type, duration);
            }
        }
    }
    
    static getUserFriendlyMessage(error, context) {
        // Map technical contexts to user-friendly messages
        const contextMessages = {
            'App Initialization': 'Failed to start the app. Please refresh the page.',
            'Start Recording': 'Could not start recording. Please check permissions.',
            'Stop Recording': 'Error while stopping recording. Your data may still be saved.',
            'Save Recording Data': 'Error saving recording data. Please try again.',
            'Download CSV': 'Could not download data. Please try again.',
            'Upload JSON': 'Upload failed. Your data is saved locally.',
            'Clear All Data': 'Error clearing data. Some data may remain.',
            'Database': 'Database error. Your data might not be saved properly.',
            'Sensor': 'Sensor error. Check device permissions.',
            'Network': 'Network error. Working in offline mode.',
            'Worker': 'Background processing error. Performance may be affected.'
        };
        
        return contextMessages[context] || `An error occurred in ${context}. Please try again.`;
    }
    
    static attemptRecovery(context) {
        console.log(`[ErrorBoundary] Attempting recovery for context: ${context}`);
        
        try {
            switch (context) {
                case 'Sensor':
                    // Try to reinitialize sensors
                    if (typeof window !== 'undefined' && window.app && window.app.sensorManager) {
                        setTimeout(() => {
                            window.app.sensorManager.checkPermissions();
                        }, 2000);
                    }
                    break;
                    
                case 'Database':
                    // Try to reinitialize database
                    if (typeof window !== 'undefined' && window.app && window.app.databaseManager) {
                        setTimeout(() => {
                            window.app.databaseManager.init();
                        }, 1000);
                    }
                    break;
                    
                case 'Network':
                    // Check network status
                    if (typeof window !== 'undefined' && window.networkManager) {
                        setTimeout(() => {
                            window.networkManager.checkRealConnectivity();
                        }, 5000);
                    }
                    break;
                    
                case 'Worker':
                    // Try to reinitialize worker
                    if (typeof window !== 'undefined' && window.app && window.app.workerManager) {
                        setTimeout(() => {
                            window.app.workerManager.terminate();
                            window.app.workerManager.init();
                        }, 3000);
                    }
                    break;
            }
        } catch (recoveryError) {
            console.warn(`[ErrorBoundary] Recovery attempt failed for ${context}:`, recoveryError);
        }
    }
    
    static reportError(errorInfo, context) {
        try {
            // Enhanced error reporting with more context
            const report = {
                ...errorInfo,
                errorCount: this.errorCount,
                recentErrors: this.errorHistory.slice(-3), // Last 3 errors for context
                appState: this.getAppState(),
                deviceInfo: this.getDeviceInfo()
            };
            
            console.log('[ErrorBoundary] Error report generated:', report);
            
            // TODO: Send to monitoring service (Sentry, LogRocket, etc.)
            // if (window.Sentry) {
            //     window.Sentry.captureException(error, { extra: report });
            // }
            
        } catch (reportingError) {
            console.warn('[ErrorBoundary] Failed to report error:', reportingError);
        }
    }
    
    static getAppState() {
        if (typeof window === 'undefined' || !window.app) return null;
        
        return {
            isRecording: window.app.isRecording || false,
            currentRecordingId: window.app.currentRecordingId || null,
            batteryLevel: window.app.batteryLevel || null,
            activeTab: window.materialTabs?.activeTab || null
        };
    }
    
    static getDeviceInfo() {
        if (typeof navigator === 'undefined') return null;
        
        return {
            userAgent: navigator.userAgent,
            platform: navigator.platform,
            language: navigator.language,
            cookieEnabled: navigator.cookieEnabled,
            onLine: navigator.onLine,
            hardwareConcurrency: navigator.hardwareConcurrency,
            deviceMemory: navigator.deviceMemory,
            connection: navigator.connection ? {
                effectiveType: navigator.connection.effectiveType,
                downlink: navigator.connection.downlink,
                rtt: navigator.connection.rtt
            } : null
        };
    }
    
    static getErrorHistory() {
        return [...this.errorHistory];
    }
    
    static clearErrorHistory() {
        this.errorHistory = [];
        this.errorCount = 0;
        console.log('[ErrorBoundary] Error history cleared');
    }
}

// Notification utility
export function showNotification(message, type = 'info', duration = 8000) {
    if (typeof document === 'undefined') return;
    
    const notification = document.getElementById('notification');
    if (!notification) return;
    
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.className = 'notification';
    }, duration);
}

// Data validation utilities
export function validateSensorData(type, data) {
    if (typeof window === 'undefined') return true;
    
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

// Cookie utilities
export function setCookie(name, value, days = 365) {
    if (typeof document === 'undefined') return;
    
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    
    // Add Secure flag only if on HTTPS
    const secureFlag = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? '; Secure' : '';
    document.cookie = `${name}=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Strict${secureFlag}`;
}

export function getCookie(name) {
    if (typeof document === 'undefined') return null;
    
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [cookieName, value] = cookie.trim().split('=');
        if (cookieName === name) {
            return value;
        }
    }
    return null;
}
