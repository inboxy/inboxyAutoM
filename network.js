// ============================================
// network.js - Network Status Detection and UI Updates
// ============================================

export class NetworkManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.statusElement = null;
        this.callbacks = [];
        this.boundHandlers = {
            online: this.handleOnline.bind(this),
            offline: this.handleOffline.bind(this)
        };
        
        // Don't call init() here - wait for DOM ready
    }
    
    init() {
        // Get the online status element
        this.statusElement = document.getElementById('online-status');
        
        if (!this.statusElement) {
            console.warn('⚠️ online-status element not found in DOM');
            return false;
        }
        
        // Set up event listeners for online/offline events
        window.addEventListener('online', this.boundHandlers.online);
        window.addEventListener('offline', this.boundHandlers.offline);
        
        // Initial status update
        this.updateStatus();
        
        console.log('✅ NetworkManager initialized');
        return true;
    }
    
    handleOnline() {
        this.isOnline = true;
        this.updateStatus();
        this.notifyCallbacks('online');
        console.log('🌐 Network status: Online');
    }
    
    handleOffline() {
        this.isOnline = false;
        this.updateStatus();
        this.notifyCallbacks('offline');
        console.log('📴 Network status: Offline');
    }
    
    updateStatus() {
        if (!this.statusElement) {
            console.warn('Online status element not found');
            return;
        }
        
        if (this.isOnline) {
            this.statusElement.textContent = 'Online';
            this.statusElement.className = 'info-value online-status online';
        } else {
            this.statusElement.textContent = 'Offline';
            this.statusElement.className = 'info-value online-status offline';
        }
        
        // Update aria-label for accessibility
        this.statusElement.setAttribute('aria-label', `Network status: ${this.isOnline ? 'Online' : 'Offline'}`);
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
                callback(status, this.isOnline);
            } catch (error) {
                console.error('Error in network status callback:', error);
            }
        });
    }
    
    // Get current status
    getStatus() {
        return {
            isOnline: this.isOnline,
            status: this.isOnline ? 'online' : 'offline'
        };
    }
    
    // Test network connectivity with optional URL
    async testConnectivity(url = 'https://www.google.com/favicon.ico', timeout = 5000) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            
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
    
    // Enhanced status check with actual connectivity test
    async checkRealConnectivity() {
        const browserStatus = navigator.onLine;
        const actualConnectivity = await this.testConnectivity();
        
        // If browser says online but connectivity test fails, we're effectively offline
        const effectiveStatus = browserStatus && actualConnectivity;
        
        if (effectiveStatus !== this.isOnline) {
            this.isOnline = effectiveStatus;
            this.updateStatus();
            this.notifyCallbacks(effectiveStatus ? 'online' : 'offline');
        }
        
        return effectiveStatus;
    }
    
    // Start periodic connectivity checks
    startPeriodicCheck(interval = 30000) {
        this.stopPeriodicCheck(); // Clear any existing interval
        
        this.connectivityInterval = setInterval(async () => {
            await this.checkRealConnectivity();
        }, interval);
        
        console.log(`Started periodic connectivity check every ${interval}ms`);
    }
    
    // Stop periodic connectivity checks
    stopPeriodicCheck() {
        if (this.connectivityInterval) {
            clearInterval(this.connectivityInterval);
            this.connectivityInterval = null;
            console.log('Stopped periodic connectivity check');
        }
    }
    
    // Cleanup method
    destroy() {
        window.removeEventListener('online', this.boundHandlers.online);
        window.removeEventListener('offline', this.boundHandlers.offline);
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