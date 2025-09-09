// ============================================
// ui-manager.js - UI Management and Event Handling - Updated
// ============================================

import { showNotification } from './utils.js';

export class UIManager {
    constructor(app) {
        this.app = app;
        this.recordingTimeout = null;
    }
    
    init() {
        this.setupEventListeners();
        this.initNetworkMonitoring();
        this.updateOnlineStatus();
        this.initStorageMonitoring();
    }
    
    setupEventListeners() {
        // Recording controls
        document.getElementById('start-btn').addEventListener('click', () => {
            this.app.startRecording();
        });
        
        document.getElementById('stop-btn').addEventListener('click', () => {
            this.app.stopRecording();
        });
        
        // Data export controls
        document.getElementById('download-btn').addEventListener('click', () => {
            this.app.downloadCSV();
        });
        
        document.getElementById('upload-btn').addEventListener('click', () => {
            this.app.uploadJSON();
        });
        
        // Data management controls
        document.getElementById('clear-data-btn').addEventListener('click', () => {
            this.confirmAndClearData();
        });
        
        document.getElementById('export-data-btn').addEventListener('click', () => {
            this.app.exportAllData();
        });
        
        // Permission retry buttons
        const retryButtons = document.querySelectorAll('.retry-permission');
        retryButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sensor = e.target.id.replace('-retry', '');
                this.app.sensorManager.retryPermission(sensor);
            });
        });
    }
    
    async confirmAndClearData() {
        // Create a custom confirmation dialog
        const confirmed = await this.showConfirmDialog(
            'Clear All Data',
            'This will permanently delete all stored recordings, data points, performance metrics, and reset your user ID. This action cannot be undone.\n\nAre you sure you want to continue?'
        );
        
        if (confirmed) {
            try {
                this.showLoadingState('Clearing all data...');
                await this.app.clearAllData();
                this.hideLoadingState();
                this.showNotification('All data cleared successfully', 'success');
            } catch (error) {
                this.hideLoadingState();
                this.showNotification('Failed to clear data: ' + error.message, 'error');
            }
        }
    }
    
    showConfirmDialog(title, message) {
        return new Promise((resolve) => {
            // Create custom modal dialog
            const overlay = document.createElement('div');
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10000;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
            `;
            
            const dialog = document.createElement('div');
            dialog.style.cssText = `
                background: var(--md-sys-color-surface);
                border-radius: 12px;
                padding: 24px;
                max-width: 400px;
                width: 100%;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                color: var(--md-sys-color-on-surface);
            `;
            
            dialog.innerHTML = `
                <h3 style="margin: 0 0 16px 0; font-size: 20px; font-weight: 500; color: var(--md-sys-color-error);">
                    ⚠️ ${title}
                </h3>
                <p style="margin: 0 0 24px 0; line-height: 1.5; white-space: pre-line;">
                    ${message}
                </p>
                <div style="display: flex; gap: 12px; justify-content: flex-end;">
                    <button id="cancel-btn" style="
                        padding: 8px 16px;
                        border: 1px solid var(--md-sys-color-outline);
                        background: transparent;
                        color: var(--md-sys-color-on-surface);
                        border-radius: 20px;
                        cursor: pointer;
                        font-family: inherit;
                    ">Cancel</button>
                    <button id="confirm-btn" style="
                        padding: 8px 16px;
                        border: none;
                        background: var(--md-sys-color-error);
                        color: var(--md-sys-color-on-error);
                        border-radius: 20px;
                        cursor: pointer;
                        font-family: inherit;
                        font-weight: 500;
                    ">Clear Data</button>
                </div>
            `;
            
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);
            
            // Handle button clicks
            dialog.querySelector('#cancel-btn').addEventListener('click', () => {
                document.body.removeChild(overlay);
                resolve(false);
            });
            
            dialog.querySelector('#confirm-btn').addEventListener('click', () => {
                document.body.removeChild(overlay);
                resolve(true);
            });
            
            // Handle escape key
            const escapeHandler = (e) => {
                if (e.key === 'Escape') {
                    document.removeEventListener('keydown', escapeHandler);
                    document.body.removeChild(overlay);
                    resolve(false);
                }
            };
            document.addEventListener('keydown', escapeHandler);
            
            // Handle click outside
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    document.body.removeChild(overlay);
                    resolve(false);
                }
            });
        });
    }
    
    initNetworkMonitoring() {
        // Monitor online/offline status
        window.addEventListener('online', () => {
            this.updateOnlineStatus(true);
            // Try to upload any pending data
            if (this.app.uploadPendingData) {
                this.app.uploadPendingData();
            }
        });
        
        window.addEventListener('offline', () => {
            this.updateOnlineStatus(false);
        });
    }
    
    initStorageMonitoring() {
        // Update storage usage periodically
        this.updateStorageUsage();
        
        // Update every 30 seconds
        setInterval(() => {
            this.updateStorageUsage();
        }, 30000);
    }
    
    async updateStorageUsage() {
        try {
            if (this.app.databaseManager) {
                const storageInfo = await this.app.databaseManager.getDatabaseSize();
                const storageEl = document.getElementById('storage-usage');
                
                if (storageEl && storageInfo) {
                    const usageMB = (storageInfo.usage / 1048576).toFixed(1);
                    const quotaMB = (storageInfo.quota / 1048576).toFixed(0);
                    storageEl.textContent = `${usageMB} MB / ${quotaMB} MB (${storageInfo.usagePercent}%)`;
                } else if (storageEl) {
                    storageEl.textContent = 'Unknown';
                }
            }
        } catch (error) {
            console.warn('Failed to update storage usage:', error);
            const storageEl = document.getElementById('storage-usage');
            if (storageEl) {
                storageEl.textContent = 'Error';
            }
        }
    }
    
    updateOnlineStatus(isOnline = navigator.onLine) {
        const statusEl = document.getElementById('online-status');
        if (statusEl) {
            statusEl.textContent = isOnline ? 'Online' : 'Offline';
            statusEl.className = `info-value ${isOnline ? 'online' : 'offline'}`;
        }
    }
    
    showRecordingState() {
        // Update UI for recording state
        document.getElementById('start-btn').style.display = 'none';
        document.getElementById('stop-btn').style.display = 'inline-flex';
        document.getElementById('post-recording-controls').classList.remove('visible');
        
        const statusIndicator = document.getElementById('status-indicator');
        statusIndicator.className = 'status-indicator status-recording pulse';
        statusIndicator.innerHTML = '<span>● Recording...</span>';
        
        // Disable data management during recording
        document.getElementById('clear-data-btn').disabled = true;
        document.getElementById('export-data-btn').disabled = true;
    }
    
    showIdleState() {
        // Update UI for idle state
        document.getElementById('start-btn').style.display = 'inline-flex';
        document.getElementById('stop-btn').style.display = 'none';
        document.getElementById('post-recording-controls').classList.add('visible');
        
        const statusIndicator = document.getElementById('status-indicator');
        statusIndicator.className = 'status-indicator status-idle';
        statusIndicator.innerHTML = '<span>Recording completed</span>';
        
        // Re-enable data management
        document.getElementById('clear-data-btn').disabled = false;
        document.getElementById('export-data-btn').disabled = false;
        
        // Update storage usage after recording
        this.updateStorageUsage();
    }
    
    showReadyState() {
        // Update UI for ready state
        document.getElementById('start-btn').style.display = 'inline-flex';
        document.getElementById('stop-btn').style.display = 'none';
        document.getElementById('post-recording-controls').classList.remove('visible');
        
        const statusIndicator = document.getElementById('status-indicator');
        statusIndicator.className = 'status-indicator status-idle';
        statusIndicator.innerHTML = '<span>Ready to record</span>';
        
        // Ensure data management is enabled
        document.getElementById('clear-data-btn').disabled = false;
        document.getElementById('export-data-btn').disabled = false;
    }
    
    showLoadingState(message = 'Processing...') {
        const loading = document.getElementById('loading');
        if (loading) {
            const loadingText = loading.querySelector('.loading-text');
            if (loadingText) {
                loadingText.textContent = message;
            }
            loading.style.display = 'flex';
        }
    }
    
    hideLoadingState() {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = 'none';
        }
    }
    
    showNotification(message, type = 'info', duration = 5000) {
        showNotification(message, type, duration);
    }
    
    updateRecordingStats(stats) {
        // Update performance monitor if available
        if (window.performanceMonitor) {
            if (stats.totalPoints !== undefined) {
                document.getElementById('data-count').textContent = stats.totalPoints.toLocaleString();
            }
            
            if (stats.bufferSize !== undefined) {
                window.performanceMonitor.updateBufferSize(stats.bufferSize);
            }
            
            if (stats.averageHz !== undefined) {
                window.performanceMonitor.updateSampleRate(stats.averageHz);
            }
        }
    }
    
    setMaxRecordingDuration(duration) {
        if (this.recordingTimeout) {
            clearTimeout(this.recordingTimeout);
        }
        
        this.recordingTimeout = setTimeout(() => {
            this.app.stopRecording();
            this.showNotification('Maximum recording duration reached', 'info');
        }, duration);
    }
    
    clearRecordingTimeout() {
        if (this.recordingTimeout) {
            clearTimeout(this.recordingTimeout);
            this.recordingTimeout = null;
        }
    }
    
    updateAppStatus(status) {
        const statusElement = document.getElementById('app-status');
        if (statusElement) {
            statusElement.textContent = status;
        }
    }
    
    enableControls() {
        const buttons = document.querySelectorAll('.button');
        buttons.forEach(btn => {
            btn.disabled = false;
        });
    }
    
    disableControls() {
        const buttons = document.querySelectorAll('.button');
        buttons.forEach(btn => {
            btn.disabled = true;
        });
    }
    
    getFeatureSupport() {
        const requiredFeatures = {
            serviceWorker: 'serviceWorker' in navigator,
            indexedDB: 'indexedDB' in window,
            geolocation: 'geolocation' in navigator,
            deviceMotion: 'DeviceMotionEvent' in window,
            webWorkers: typeof Worker !== 'undefined'
        };
        
        // Display feature support info for debugging
        if (window.location.search.includes('debug=true')) {
            console.log('Feature support:', requiredFeatures);
        }
        
        // Warn about missing critical features
        const missingFeatures = Object.entries(requiredFeatures)
            .filter(([, supported]) => !supported)
            .map(([feature]) => feature);
            
        if (missingFeatures.length > 0) {
            console.warn('Missing features:', missingFeatures);
            this.showNotification(
                `Some features are not supported: ${missingFeatures.join(', ')}`, 
                'warning'
            );
        }
        
        return requiredFeatures;
    }
}
