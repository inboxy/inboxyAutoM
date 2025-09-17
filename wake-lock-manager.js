// ============================================
// wake-lock-manager.js - Screen Wake Lock Management
// ============================================

export class WakeLockManager {
    constructor() {
        this.wakeLock = null;
        this.isSupported = 'wakeLock' in navigator;
        this.isActive = false;
        this.statusCallbacks = [];

        // Listen for visibility changes to handle re-acquiring wake lock
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });

        console.log('🔋 WakeLockManager initialized', {
            supported: this.isSupported,
            userAgent: navigator.userAgent
        });
    }

    /**
     * Check if Screen Wake Lock API is supported
     * @returns {boolean} True if supported
     */
    isWakeLockSupported() {
        return this.isSupported;
    }

    /**
     * Request a screen wake lock
     * @returns {Promise<boolean>} True if wake lock was acquired successfully
     */
    async requestWakeLock() {
        if (!this.isSupported) {
            console.warn('⚠️ Screen Wake Lock API not supported');
            this.notifyStatusChange('unsupported', 'Screen Wake Lock not supported on this device');
            return false;
        }

        try {
            // Release existing wake lock first
            await this.releaseWakeLock();

            // Request new wake lock
            this.wakeLock = await navigator.wakeLock.request('screen');
            this.isActive = true;

            console.log('🔋 Screen wake lock acquired successfully');
            this.notifyStatusChange('active', 'Screen will stay awake during recording');

            // Listen for wake lock release (can happen automatically)
            this.wakeLock.addEventListener('release', () => {
                console.log('🔋 Screen wake lock was released');
                this.isActive = false;
                this.wakeLock = null;
                this.notifyStatusChange('released', 'Screen wake lock released');
            });

            return true;

        } catch (error) {
            console.error('❌ Failed to acquire screen wake lock:', error);
            this.isActive = false;
            this.wakeLock = null;

            // Provide user-friendly error messages
            let errorMessage = 'Failed to keep screen awake';
            if (error.name === 'NotAllowedError') {
                errorMessage = 'Permission denied for screen wake lock';
            } else if (error.name === 'AbortError') {
                errorMessage = 'Screen wake lock request was aborted';
            }

            this.notifyStatusChange('error', errorMessage);
            return false;
        }
    }

    /**
     * Release the current wake lock
     * @returns {Promise<void>}
     */
    async releaseWakeLock() {
        if (this.wakeLock) {
            try {
                await this.wakeLock.release();
                console.log('🔋 Screen wake lock released manually');
            } catch (error) {
                console.warn('⚠️ Error releasing wake lock:', error);
            }

            this.wakeLock = null;
            this.isActive = false;
            this.notifyStatusChange('released', 'Screen can now sleep normally');
        }
    }

    /**
     * Handle visibility changes - re-acquire wake lock when tab becomes visible
     */
    async handleVisibilityChange() {
        if (this.isActive && document.visibilityState === 'visible' && !this.wakeLock) {
            console.log('🔋 Tab became visible, re-acquiring wake lock');
            await this.requestWakeLock();
        }
    }

    /**
     * Get current wake lock status
     * @returns {Object} Status information
     */
    getStatus() {
        return {
            supported: this.isSupported,
            active: this.isActive,
            wakeLockExists: !!this.wakeLock,
            documentVisible: document.visibilityState === 'visible'
        };
    }

    /**
     * Add a callback for wake lock status changes
     * @param {Function} callback - Function to call when status changes
     */
    onStatusChange(callback) {
        if (typeof callback === 'function') {
            this.statusCallbacks.push(callback);
        }
    }

    /**
     * Remove a status change callback
     * @param {Function} callback - Function to remove
     */
    offStatusChange(callback) {
        const index = this.statusCallbacks.indexOf(callback);
        if (index > -1) {
            this.statusCallbacks.splice(index, 1);
        }
    }

    /**
     * Notify all callbacks of status changes
     * @param {string} status - Status type: 'active', 'released', 'error', 'unsupported'
     * @param {string} message - Human-readable status message
     */
    notifyStatusChange(status, message) {
        const statusInfo = {
            status,
            message,
            timestamp: new Date().toISOString(),
            wakeLockActive: this.isActive,
            ...this.getStatus()
        };

        this.statusCallbacks.forEach(callback => {
            try {
                callback(statusInfo);
            } catch (error) {
                console.error('❌ Error in wake lock status callback:', error);
            }
        });
    }

    /**
     * Get browser-specific wake lock information for debugging
     * @returns {Object} Browser and feature information
     */
    getDebugInfo() {
        return {
            userAgent: navigator.userAgent,
            wakeLockSupported: this.isSupported,
            currentStatus: this.getStatus(),
            visibilityState: document.visibilityState,
            documentHidden: document.hidden,
            wakeLockType: this.wakeLock?.type || null,
            wakeLockReleased: this.wakeLock?.released || null
        };
    }

    /**
     * Cleanup - release wake lock and remove listeners
     */
    async destroy() {
        await this.releaseWakeLock();
        this.statusCallbacks = [];

        // Note: We can't remove the visibilitychange listener easily
        // since it's bound to the class method, but it will be garbage collected
        // when the instance is destroyed

        console.log('🔋 WakeLockManager destroyed');
    }
}

// Export singleton instance
export const wakeLockManager = new WakeLockManager();

// Make it available globally for UI components
window.wakeLockManager = wakeLockManager;