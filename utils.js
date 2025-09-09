
// ============================================
// utils.js - Utility Functions and Error Handling
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
        if (typeof nanoid === 'function') {
            // Test nanoid to make sure it works
            const test = nanoid(5);
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

// Error boundary for better error handling
export class ErrorBoundary {
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

// Notification utility
export function showNotification(message, type = 'info', duration = 5000) {
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
    const expires = new Date();
    expires.setTime(expires.getTime() + (days * 24 * 60 * 60 * 1000));
    
    // Add Secure flag only if on HTTPS
    const secureFlag = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${name}=${value}; expires=${expires.toUTCString()}; path=/; SameSite=Strict${secureFlag}`;
}

export function getCookie(name) {
    const cookies = document.cookie.split(';');
    for (let cookie of cookies) {
        const [cookieName, value] = cookie.trim().split('=');
        if (cookieName === name) {
            return value;
        }
    }
    return null;
}
