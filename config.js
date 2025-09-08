// Configuration file for Motion Recorder PWA - Optimized for 140Hz
// This file should be customized for your deployment environment

window.MotionRecorderConfig = {
    // API Configuration
    api: {
        // Replace with your actual API endpoint
        endpoint: 'https://your-api-endpoint.com/api/recordings',
        timeout: 30000, // 30 seconds
        retryAttempts: 3,
        retryDelay: 1000, // 1 second
        maxPayloadSize: 10485760 // 10MB max upload size
    },
    
    // Sensor Configuration - OPTIMIZED FOR 140Hz
    sensors: {
        targetRate: 140, // Target 140Hz for high-frequency sampling
        fallbackRate: 60, // Fallback rate for devices that can't handle 140Hz
        adaptiveRateEnabled: true, // Automatically adjust based on device capability
        gpsUpdateInterval: 1000, // GPS updates every second
        maxRecordingDuration: 3600000, // 1 hour in milliseconds
        dataValidation: true,
        maxBufferSize: 5000, // Maximum data points before forced flush
        batchSize: 10, // Batch size for sending data to worker
        batchInterval: 100 // Send batches every 100ms
    },
    
    // Storage Configuration
    storage: {
        maxDataPoints: 100000, // Increased for 140Hz operation
        chunkSize: 1000, // Process data in chunks
        cacheDuration: 86400000, // 24 hours in milliseconds
        maxCacheSize: 100, // Increased cache size
        compressionEnabled: false, // Enable if needed for large datasets
        autoCleanup: true, // Automatically clean old recordings
        cleanupThreshold: 7 // Days to keep recordings
    },
    
    // Performance Configuration
    performance: {
        useRequestAnimationFrame: true, // Use RAF for smooth sampling
        throttleUIUpdates: true, // Throttle UI updates to 10Hz
        uiUpdateRate: 10, // UI update rate in Hz
        enableProfiling: false, // Enable performance profiling
        memoryWarningThreshold: 100, // MB - warn when memory usage exceeds
        cpuWarningThreshold: 80 // % - warn when CPU usage exceeds
    },
    
    // Battery Configuration
    battery: {
        enableAdaptiveRate: true, // Adjust sample rate based on battery
        lowBatteryThreshold: 0.2, // 20% battery
        mediumBatteryThreshold: 0.5, // 50% battery
        lowBatteryRate: 60, // Hz when battery is low
        mediumBatteryRate: 100, // Hz when battery is medium
        warningInterval: 60000 // Warn every minute when battery is low
    },
    
    // User Interface Configuration
    ui: {
        permissionRetryLimit: 3,
        notificationDuration: 5000, // 5 seconds
        animationDuration: 300, // milliseconds
        debugMode: false, // Set to true for development
        showPerformanceMonitor: true, // Show real-time performance stats
        showAdvancedStats: false, // Show detailed statistics
        theme: 'auto' // 'light', 'dark', or 'auto'
    },
    
    // Security Configuration
    security: {
        httpsRequired: true,
        validateTimestamps: true,
        sanitizeData: true,
        encryptLocalStorage: false, // Enable if storing sensitive data
        maxUploadRetries: 3,
        csrfProtection: true
    },
    
    // Feature Flags
    features: {
        backgroundSync: true,
        pushNotifications: false,
        periodicSync: false,
        offlineMode: true,
        errorReporting: true,
        analytics: false,
        experimentalFeatures: false
    },
    
    // Development Configuration
    development: {
        mockApi: false, // Use mock API responses
        skipHTTPSCheck: false, // Skip HTTPS requirement for localhost
        verboseLogging: false,
        simulateSlowNetwork: false,
        simulateLowBattery: false,
        forceHighFrequency: false, // Force 140Hz even on unsupported devices
        showDebugPanel: false
    },
    
    // Export Configuration
    export: {
        csvDelimiter: ',',
        csvEncoding: 'UTF-8',
        includeMetadata: true,
        includeStatistics: true,
        dateFormat: 'ISO', // 'ISO' or 'LOCAL'
        precision: 6, // Decimal places for numbers
        compressExports: false
    }
};

// Environment-specific overrides
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    // Development environment
    window.MotionRecorderConfig.development.skipHTTPSCheck = true;
    window.MotionRecorderConfig.development.verboseLogging = true;
    window.MotionRecorderConfig.ui.debugMode = true;
    window.MotionRecorderConfig.ui.showAdvancedStats = true;
    
    // Use local development endpoint
    window.MotionRecorderConfig.api.endpoint = '/api/recordings';
    
    // Enable all features for testing
    window.MotionRecorderConfig.features.experimentalFeatures = true;
    window.MotionRecorderConfig.development.showDebugPanel = true;
}

// Production optimizations
if (window.location.protocol === 'https:' && !window.location.hostname.includes('localhost')) {
    // Production environment
    window.MotionRecorderConfig.sensors.targetRate = 140; // Full rate for production
    window.MotionRecorderConfig.features.backgroundSync = true;
    window.MotionRecorderConfig.features.pushNotifications = true;
    window.MotionRecorderConfig.features.analytics = true;
    window.MotionRecorderConfig.security.encryptLocalStorage = true;
    window.MotionRecorderConfig.performance.enableProfiling = false;
}

// Device-specific optimizations
const detectDeviceCapabilities = () => {
    const ua = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);
    const isHighEnd = navigator.hardwareConcurrency > 4;
    
    if (isIOS) {
        // iOS typically caps at 60-100Hz
        window.MotionRecorderConfig.sensors.targetRate = 100;
        window.MotionRecorderConfig.sensors.fallbackRate = 60;
    } else if (isAndroid) {
        // Android varies widely
        if (isHighEnd) {
            window.MotionRecorderConfig.sensors.targetRate = 140;
        } else {
            window.MotionRecorderConfig.sensors.targetRate = 100;
        }
    }
    
    // Adjust buffer sizes based on available memory
    if ('deviceMemory' in navigator) {
        const memory = navigator.deviceMemory;
        if (memory < 4) {
            // Low memory device
            window.MotionRecorderConfig.storage.maxDataPoints = 50000;
            window.MotionRecorderConfig.sensors.maxBufferSize = 2500;
        } else if (memory >= 8) {
            // High memory device
            window.MotionRecorderConfig.storage.maxDataPoints = 200000;
            window.MotionRecorderConfig.sensors.maxBufferSize = 10000;
        }
    }
    
    console.log('Device capabilities detected:', {
        platform: isIOS ? 'iOS' : isAndroid ? 'Android' : 'Other',
        cores: navigator.hardwareConcurrency,
        memory: navigator.deviceMemory,
        targetRate: window.MotionRecorderConfig.sensors.targetRate
    });
};

// Configuration validation
const validateConfig = () => {
    const config = window.MotionRecorderConfig;
    const errors = [];
    const warnings = [];
    
    // Validate API endpoint
    if (!config.api.endpoint || config.api.endpoint === 'https://your-api-endpoint.com/api/recordings') {
        warnings.push('API endpoint not configured. Please update config.js with your actual API endpoint.');
    }
    
    // Validate sensor rates
    if (config.sensors.targetRate < 1 || config.sensors.targetRate > 200) {
        errors.push('Invalid sensor target rate. Must be between 1 and 200 Hz.');
    }
    
    if (config.sensors.targetRate > 100) {
        warnings.push(`Target rate of ${config.sensors.targetRate}Hz may not be achievable on all devices.`);
    }
    
    // Validate storage limits
    if (config.storage.maxDataPoints < 1000) {
        warnings.push('Max data points is very low. Recommended minimum: 1000.');
    }
    
    // Check for HTTPS in production
    if (config.security.httpsRequired && window.location.protocol !== 'https:' && !config.development.skipHTTPSCheck) {
        errors.push('HTTPS is required but the app is running on HTTP.');
    }
    
    // Validate battery thresholds
    if (config.battery.lowBatteryThreshold >= config.battery.mediumBatteryThreshold) {
        errors.push('Low battery threshold must be less than medium battery threshold.');
    }
    
    // Log configuration status
    if (errors.length > 0) {
        console.error('Configuration Errors:', errors);
        if (config.ui.debugMode) {
            alert('Critical configuration errors detected. Check console for details.');
        }
    }
    
    if (warnings.length > 0) {
        console.warn('Configuration Warnings:', warnings);
    }
    
    return errors.length === 0;
};

// Performance optimization settings
const optimizeForPerformance = () => {
    const config = window.MotionRecorderConfig;
    
    // Check if we should enable performance optimizations
    if ('connection' in navigator) {
        const connection = navigator.connection;
        
        // Adjust based on network speed
        if (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g') {
            config.features.backgroundSync = false;
            config.api.timeout = 60000; // Increase timeout for slow connections
        }
        
        // Save data mode
        if (connection.saveData) {
            config.features.analytics = false;
            config.export.compressExports = true;
        }
    }
    
    // Optimize based on device performance
    if ('requestIdleCallback' in window) {
        // Device supports idle callbacks, can be more aggressive with processing
        config.storage.chunkSize = 2000;
    } else {
        // Older device, be more conservative
        config.storage.chunkSize = 500;
    }
    
    console.log('Performance optimizations applied');
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = window.MotionRecorderConfig;
}

// Initialize configuration when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    detectDeviceCapabilities();
    optimizeForPerformance();
    const isValid = validateConfig();
    
    if (isValid) {
        console.log('Motion Recorder Configuration loaded successfully');
        console.log('Target sample rate:', window.MotionRecorderConfig.sensors.targetRate, 'Hz');
    }
});

// Configuration API for runtime updates
window.MotionRecorderConfig.update = function(path, value) {
    const keys = path.split('.');
    let obj = window.MotionRecorderConfig;
    
    for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]]) {
            console.error(`Invalid configuration path: ${path}`);
            return false;
        }
        obj = obj[keys[i]];
    }
    
    const oldValue = obj[keys[keys.length - 1]];
    obj[keys[keys.length - 1]] = value;
    
    console.log(`Configuration updated: ${path} = ${value} (was ${oldValue})`);
    return true;
};

// Get configuration value
window.MotionRecorderConfig.get = function(path) {
    const keys = path.split('.');
    let obj = window.MotionRecorderConfig;
    
    for (let i = 0; i < keys.length; i++) {
        if (!obj[keys[i]]) {
            return undefined;
        }
        obj = obj[keys[i]];
    }
    
    return obj;
};

// Reset configuration to defaults
window.MotionRecorderConfig.reset = function() {
    window.location.reload();
};
