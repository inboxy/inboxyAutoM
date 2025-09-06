// Configuration file for Motion Recorder PWA
// This file should be customized for your deployment environment

window.MotionRecorderConfig = {
    // API Configuration
    api: {
        // Replace with your actual API endpoint
        endpoint: 'https://your-api-endpoint.com/api/recordings',
        timeout: 30000, // 30 seconds
        retryAttempts: 3,
        retryDelay: 1000 // 1 second
    },
    
    // Sensor Configuration
    sensors: {
        targetRate: 50, // Hz - reduced from 140 for better compatibility
        gpsUpdateInterval: 1000, // milliseconds
        maxRecordingDuration: 3600000, // 1 hour in milliseconds
        dataValidation: true
    },
    
    // Storage Configuration
    storage: {
        maxDataPoints: 10000, // Maximum data points in memory
        chunkSize: 1000, // Process data in chunks
        cacheDuration: 86400000, // 24 hours in milliseconds
        maxCacheSize: 50 // Maximum cached requests
    },
    
    // User Interface Configuration
    ui: {
        permissionRetryLimit: 3,
        notificationDuration: 5000, // 5 seconds
        animationDuration: 300, // milliseconds
        debugMode: false // Set to true for development
    },
    
    // Security Configuration
    security: {
        httpsRequired: true,
        validateTimestamps: true,
        sanitizeData: true
    },
    
    // Feature Flags
    features: {
        backgroundSync: true,
        pushNotifications: false,
        periodicSync: false,
        offlineMode: true
    },
    
    // Development Configuration
    development: {
        mockApi: false, // Use mock API responses
        skipHTTPSCheck: false, // Skip HTTPS requirement for localhost
        verboseLogging: false,
        simulateSlowNetwork: false
    }
};

// Environment-specific overrides
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Development environment
    window.MotionRecorderConfig.development.skipHTTPSCheck = true;
    window.MotionRecorderConfig.development.verboseLogging = true;
    window.MotionRecorderConfig.ui.debugMode = true;
    
    // Use mock API for development
    window.MotionRecorderConfig.api.endpoint = '/api/recordings'; // Local development endpoint
}

// Production optimizations
if (window.location.protocol === 'https:' && !window.location.hostname.includes('localhost')) {
    // Production environment
    window.MotionRecorderConfig.sensors.targetRate = 100; // Higher rate for production
    window.MotionRecorderConfig.features.backgroundSync = true;
    window.MotionRecorderConfig.features.pushNotifications = true;
}

// Configuration validation
const validateConfig = () => {
    const config = window.MotionRecorderConfig;
    const errors = [];
    
    // Validate API endpoint
    if (!config.api.endpoint || config.api.endpoint === 'https://your-api-endpoint.com/api/recordings') {
        errors.push('API endpoint not configured. Please update config.js with your actual API endpoint.');
    }
    
    // Validate sensor rates
    if (config.sensors.targetRate < 1 || config.sensors.targetRate > 200) {
        errors.push('Invalid sensor target rate. Must be between 1 and 200 Hz.');
    }
    
    // Validate storage limits
    if (config.storage.maxDataPoints < 100) {
        errors.push('Max data points too low. Minimum recommended: 100.');
    }
    
    // Log configuration errors
    if (errors.length > 0) {
        console.warn('Configuration Issues:', errors);
        
        if (config.ui.debugMode) {
            alert('Configuration issues detected. Check console for details.');
        }
    }
    
    return errors.length === 0;
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.MotionRecorderConfig;
}

// Validate configuration on load
document.addEventListener('DOMContentLoaded', () => {
    validateConfig();
});
