// ============================================
// network.js - Network Status Detection and UI Updates with Network Information API
// ============================================

export class NetworkManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.statusElement = null;
        this.callbacks = [];
        this.connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        this.networkInfo = {
            type: 'unknown',
            effectiveType: 'unknown',
            downlink: 0,
            rtt: 0,
            saveData: false
        };

        this.boundHandlers = {
            online: this.handleOnline.bind(this),
            offline: this.handleOffline.bind(this),
            connectionChange: this.handleConnectionChange.bind(this)
        };

        // Don't call init() here - wait for DOM ready
    }
    
    init() {
        // Get the online status element and connection icon
        this.statusElement = document.getElementById('online-status');
        this.iconElement = document.getElementById('connection-icon');

        if (!this.statusElement) {
            console.warn('⚠️ online-status element not found in DOM');
            return false;
        }

        if (!this.iconElement) {
            console.warn('⚠️ connection-icon element not found in DOM');
        }

        // Set up event listeners for online/offline events
        window.addEventListener('online', this.boundHandlers.online);
        window.addEventListener('offline', this.boundHandlers.offline);

        // Set up Network Information API listener if available
        if (this.connection) {
            this.connection.addEventListener('change', this.boundHandlers.connectionChange);
            this.updateNetworkInfo();
            console.log('✅ Network Information API available');
        } else {
            console.warn('⚠️ Network Information API not supported');
        }

        // Initial status update
        this.updateStatus();

        console.log('✅ NetworkManager initialized');
        return true;
    }
    
    handleOnline() {
        this.isOnline = true;
        this.updateNetworkInfo();
        this.updateStatus();
        this.notifyCallbacks('online');
        console.log('🌐 Network status: Online');
    }

    handleOffline() {
        this.isOnline = false;
        this.updateNetworkInfo();
        this.updateStatus();
        this.notifyCallbacks('offline');
        console.log('📴 Network status: Offline');
    }

    handleConnectionChange() {
        this.updateNetworkInfo();
        this.updateStatus();
        this.notifyCallbacks('connection-change');
        console.log('🔄 Network connection changed:', this.getConnectionInfo());
    }

    updateNetworkInfo() {
        if (!this.connection) return;

        this.networkInfo = {
            type: this.connection.type || 'unknown',
            effectiveType: this.connection.effectiveType || 'unknown',
            downlink: this.connection.downlink || 0,
            rtt: this.connection.rtt || 0,
            saveData: this.connection.saveData || false
        };
    }
    
    updateStatus() {
        if (!this.statusElement) {
            console.warn('Online status element not found');
            return;
        }

        const connectionText = this.getConnectionSummary();
        const connectionIcon = this.getConnectionIcon();

        // Update the text content
        this.statusElement.textContent = connectionText;

        // Update the icon if available
        if (this.iconElement) {
            this.iconElement.textContent = connectionIcon;
        }

        // Update CSS classes
        if (this.isOnline) {
            this.statusElement.className = `info-value online-status online ${this.getConnectionClass()}`;
        } else {
            this.statusElement.className = 'info-value online-status offline';
        }

        // Update aria-label for accessibility with detailed connection info
        const ariaLabel = this.isOnline
            ? `Network status: ${connectionText}, ${this.getDetailedConnectionInfo()}`
            : 'Network status: Offline';
        this.statusElement.setAttribute('aria-label', ariaLabel);
    }

    getConnectionSummary() {
        if (!this.isOnline) return 'Offline';

        if (!this.connection) return 'WiFi';

        const connectionType = this.networkInfo.type;
        const effectiveType = this.networkInfo.effectiveType;

        // Map connection types to display names
        if (connectionType === 'cellular') {
            switch (effectiveType) {
                case '4g':
                    return '4G';
                case '3g':
                    return '3G';
                case '2g':
                case 'slow-2g':
                    return '2G';
                default:
                    return 'Cellular';
            }
        } else if (connectionType === 'wifi') {
            return 'WiFi';
        } else if (connectionType === 'ethernet') {
            return 'Ethernet';
        } else if (connectionType === 'bluetooth') {
            return 'Bluetooth';
        } else {
            // Fall back to effective type for unknown connection types
            switch (effectiveType) {
                case '4g':
                    return '4G';
                case '3g':
                    return '3G';
                case '2g':
                case 'slow-2g':
                    return '2G';
                default:
                    return 'WiFi'; // Default assumption for unknown types
            }
        }
    }

    getConnectionIcon() {
        if (!this.isOnline) return 'signal_wifi_off';

        if (!this.connection) return 'wifi';

        const connectionType = this.networkInfo.type;
        const effectiveType = this.networkInfo.effectiveType;

        // Map connection types to Material Icons
        if (connectionType === 'cellular') {
            switch (effectiveType) {
                case '4g':
                    return 'signal_cellular_4_bar';
                case '3g':
                    return 'signal_cellular_3_bar';
                case '2g':
                case 'slow-2g':
                    return 'signal_cellular_2_bar';
                default:
                    return 'signal_cellular_4_bar';
            }
        } else if (connectionType === 'wifi') {
            return 'wifi';
        } else if (connectionType === 'ethernet') {
            return 'settings_ethernet';
        } else if (connectionType === 'bluetooth') {
            return 'bluetooth';
        } else {
            // Fall back based on effective type
            switch (effectiveType) {
                case '4g':
                    return 'signal_cellular_4_bar';
                case '3g':
                    return 'signal_cellular_3_bar';
                case '2g':
                case 'slow-2g':
                    return 'signal_cellular_2_bar';
                default:
                    return 'wifi'; // Default to WiFi icon
            }
        }
    }

    getConnectionClass() {
        if (!this.connection || !this.isOnline) return '';

        const effectiveType = this.networkInfo.effectiveType;

        switch (effectiveType) {
            case 'slow-2g':
            case '2g':
                return 'connection-slow';
            case '3g':
                return 'connection-medium';
            case '4g':
                return 'connection-fast';
            default:
                return 'connection-unknown';
        }
    }

    getDetailedConnectionInfo() {
        if (!this.connection || !this.isOnline) return 'connection details unavailable';

        const parts = [];
        if (this.networkInfo.effectiveType !== 'unknown') {
            parts.push(`${this.networkInfo.effectiveType} connection`);
        }
        if (this.networkInfo.downlink > 0) {
            parts.push(`${this.networkInfo.downlink} Mbps downlink`);
        }
        if (this.networkInfo.rtt > 0) {
            parts.push(`${this.networkInfo.rtt}ms latency`);
        }
        if (this.networkInfo.saveData) {
            parts.push('data saver enabled');
        }

        return parts.length > 0 ? parts.join(', ') : 'basic connection';
    }
    
    // Add callback for when network status changes
    onStatusChange(callback) {
        if (typeof callback === 'function') {
            this.callbacks.push(callback);
        }
    }
    
    // Remove callback
    removeStatusChangeCallback(callback) {
        const index = this.callbacks.indexOf(callback);
        if (index > -1) {
            this.callbacks.splice(index, 1);
        }
    }
    
    // Notify all registered callbacks
    notifyCallbacks(status) {
        this.callbacks.forEach(callback => {
            try {
                callback(status, this.isOnline, this.getConnectionInfo());
            } catch (error) {
                console.error('Error in network status callback:', error);
            }
        });
    }

    // Get current status with detailed connection information
    getStatus() {
        return {
            isOnline: this.isOnline,
            status: this.isOnline ? 'online' : 'offline',
            connection: this.getConnectionInfo()
        };
    }

    // Get detailed connection information
    getConnectionInfo() {
        if (!this.connection) {
            return {
                supported: false,
                type: 'unknown',
                effectiveType: 'unknown',
                downlink: 0,
                rtt: 0,
                saveData: false
            };
        }

        return {
            supported: true,
            ...this.networkInfo
        };
    }
    
    // Test network connectivity with optional URL, considering connection quality
    async testConnectivity(url = 'https://www.google.com/favicon.ico', timeout = null) {
        try {
            // Adjust timeout based on connection quality if Network Information API is available
            let adaptiveTimeout = timeout || 5000;

            if (this.connection && this.networkInfo.effectiveType) {
                switch (this.networkInfo.effectiveType) {
                    case 'slow-2g':
                        adaptiveTimeout = timeout || 15000;
                        break;
                    case '2g':
                        adaptiveTimeout = timeout || 10000;
                        break;
                    case '3g':
                        adaptiveTimeout = timeout || 7000;
                        break;
                    case '4g':
                        adaptiveTimeout = timeout || 3000;
                        break;
                }
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), adaptiveTimeout);

            const response = await fetch(url, {
                method: 'HEAD',
                mode: 'no-cors',
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return true;
        } catch (error) {
            console.warn('Connectivity test failed:', error.message);
            return false;
        }
    }

    // Enhanced status check with actual connectivity test and Network Information API
    async checkRealConnectivity() {
        const browserStatus = navigator.onLine;
        this.updateNetworkInfo(); // Update network info before testing

        const actualConnectivity = await this.testConnectivity();

        // If browser says online but connectivity test fails, we're effectively offline
        const effectiveStatus = browserStatus && actualConnectivity;

        if (effectiveStatus !== this.isOnline) {
            this.isOnline = effectiveStatus;
            this.updateStatus();
            this.notifyCallbacks(effectiveStatus ? 'online' : 'offline');
        }

        return {
            isOnline: effectiveStatus,
            connection: this.getConnectionInfo()
        };
    }
    
    // Start periodic connectivity checks with adaptive intervals based on connection quality
    startPeriodicCheck(interval = null) {
        this.stopPeriodicCheck(); // Clear any existing interval

        // Use adaptive interval based on connection quality if not specified
        let checkInterval = interval || this.getAdaptiveInterval();

        this.connectivityInterval = setInterval(async () => {
            await this.checkRealConnectivity();
            // Update interval based on current connection quality
            if (!interval) {
                const newInterval = this.getAdaptiveInterval();
                if (newInterval !== checkInterval) {
                    checkInterval = newInterval;
                    this.startPeriodicCheck(); // Restart with new interval
                }
            }
        }, checkInterval);

        console.log(`Started periodic connectivity check every ${checkInterval}ms`);
    }

    // Get adaptive check interval based on connection quality
    getAdaptiveInterval() {
        if (!this.connection || !this.networkInfo.effectiveType) {
            return 30000; // Default 30 seconds
        }

        switch (this.networkInfo.effectiveType) {
            case 'slow-2g':
            case '2g':
                return 60000; // 1 minute for slow connections
            case '3g':
                return 45000; // 45 seconds for medium connections
            case '4g':
                return 20000; // 20 seconds for fast connections
            default:
                return 30000; // Default 30 seconds
        }
    }
    
    // Stop periodic connectivity checks
    stopPeriodicCheck() {
        if (this.connectivityInterval) {
            clearInterval(this.connectivityInterval);
            this.connectivityInterval = null;
            console.log('Stopped periodic connectivity check');
        }
    }
    
    // Get connection quality assessment
    getConnectionQuality() {
        if (!this.connection || !this.isOnline) {
            return { quality: 'offline', description: 'No connection' };
        }

        const effectiveType = this.networkInfo.effectiveType;
        const downlink = this.networkInfo.downlink;
        const rtt = this.networkInfo.rtt;

        // Determine quality based on effective connection type and metrics
        let quality = 'unknown';
        let description = 'Unknown connection quality';

        if (effectiveType === 'slow-2g') {
            quality = 'poor';
            description = 'Very slow connection - limited functionality recommended';
        } else if (effectiveType === '2g') {
            quality = 'poor';
            description = 'Slow connection - basic functionality only';
        } else if (effectiveType === '3g') {
            quality = 'fair';
            description = 'Moderate connection - most features available';
        } else if (effectiveType === '4g') {
            quality = 'good';
            description = 'Fast connection - all features available';
        } else if (downlink > 0) {
            // Fall back to downlink speed if effectiveType is not available
            if (downlink < 0.5) {
                quality = 'poor';
                description = 'Very slow connection';
            } else if (downlink < 2) {
                quality = 'fair';
                description = 'Moderate connection';
            } else {
                quality = 'good';
                description = 'Fast connection';
            }
        }

        return {
            quality,
            description,
            metrics: {
                effectiveType,
                downlink,
                rtt,
                saveData: this.networkInfo.saveData
            }
        };
    }

    // Check if current connection supports high bandwidth operations
    supportsHighBandwidth() {
        const quality = this.getConnectionQuality();
        return quality.quality === 'good' && !this.networkInfo.saveData;
    }

    // Cleanup method
    destroy() {
        window.removeEventListener('online', this.boundHandlers.online);
        window.removeEventListener('offline', this.boundHandlers.offline);

        if (this.connection) {
            this.connection.removeEventListener('change', this.boundHandlers.connectionChange);
        }

        this.stopPeriodicCheck();
        this.callbacks = [];
        console.log('NetworkManager destroyed');
    }
}

// Create and export a singleton instance for global use
export const networkManager = new NetworkManager();

// Add to window for global access if needed
window.networkManager = networkManager;

// Auto-initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Initialize the network manager
    const initialized = networkManager.init();
    
    if (initialized) {
        // Start periodic connectivity checks (optional)
        if (window.MotionRecorderConfig?.features?.networkMonitoring !== false) {
            networkManager.startPeriodicCheck();
        }
    } else {
        console.error('❌ Failed to initialize NetworkManager - online-status element not found');
    }
});