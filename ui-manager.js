// ============================================
// ui-manager.js - UI Management and Event Handling - FIXED VERSION
// ============================================

import { showNotification } from './utils.js';
import { networkManager } from './network.js';

export class UIManager {
    constructor(app) {
        this.app = app;
        this.recordingTimeout = null;
    }
    
    init() {
        // Use setTimeout to ensure DOM is fully ready
        setTimeout(() => {
            this.setupEventListeners();
        }, 100);
        this.initNetworkMonitoring();
        this.initStorageMonitoring();
    }
    
    setupEventListeners() {
        console.log('🔧 Setting up event listeners...');

        // Wait a bit more and try multiple times to find the button
        const tryAttachButton = (attempts = 0) => {
            const circularRecordBtn = document.getElementById('circular-record-btn');
            console.log(`🔍 Attempt ${attempts + 1}: Button search result:`, circularRecordBtn);

            if (circularRecordBtn) {
                console.log('✅ Circular record button found, attaching event listener');
                console.log('🔍 Button computed styles:', window.getComputedStyle(circularRecordBtn));

                // Remove any existing listeners
                circularRecordBtn.onclick = null;

                // Add click listener
                circularRecordBtn.addEventListener('click', (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    console.log('🔴 Circular record button clicked, recording state:', this.app.isRecording);
                    alert('Button clicked! Recording state: ' + this.app.isRecording);

                    if (this.app.isRecording) {
                        console.log('⏹️ Stopping recording...');
                        this.app.stopRecording();
                    } else {
                        console.log('🎬 Starting recording...');
                        this.app.startRecording();
                    }
                }, true);

                // Also add onclick as backup
                circularRecordBtn.onclick = () => {
                    console.log('🔴 Button onclick fired!');
                    alert('Onclick fired!');
                };

                console.log('✅ Event listeners attached successfully');
            } else {
                console.error(`❌ Circular record button not found on attempt ${attempts + 1}!`);
                if (attempts < 5) {
                    setTimeout(() => tryAttachButton(attempts + 1), 500);
                }
            }
        };

        tryAttachButton();
        
        // Data export controls
        const downloadBtn = document.getElementById('download-btn');
        const uploadBtn = document.getElementById('upload-btn');
        
        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                this.app.downloadCSV();
            });
        }
        
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => {
                this.app.uploadJSON();
            });
        }
        
        // Data management controls
        const clearBtn = document.getElementById('clear-data-btn');
        const exportBtn = document.getElementById('export-data-btn');
        
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.confirmAndClearData();
            });
        }
        
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.app.exportAllData();
            });
        }
        
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
        // Use the NetworkManager for network status monitoring
        networkManager.onStatusChange((status, isOnline) => {
            // Try to upload any pending data when coming online
            if (isOnline && this.app.uploadPendingData) {
                this.app.uploadPendingData();
            }
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
            if (this.app.databaseManager && this.app.databaseManager.db) {
                const storageInfo = await this.app.databaseManager.getDatabaseSize();
                const storageEl = document.getElementById('storage-usage');
                
                if (storageEl && storageInfo) {
                    const usageMB = (storageInfo.usage / 1048576).toFixed(1);
                    
                    if (storageInfo.quota > 0) {
                        const quotaMB = (storageInfo.quota / 1048576).toFixed(0);
                        storageEl.textContent = `${usageMB} MB / ${quotaMB} MB (${storageInfo.usagePercent}%)`;
                    } else {
                        storageEl.textContent = `${usageMB} MB used`;
                    }
                } else if (storageEl) {
                    storageEl.textContent = 'Calculating...';
                }
            } else {
                const storageEl = document.getElementById('storage-usage');
                if (storageEl) {
                    storageEl.textContent = 'Not initialized';
                }
            }
        } catch (error) {
            console.warn('Failed to update storage usage:', error);
            const storageEl = document.getElementById('storage-usage');
            if (storageEl) {
                storageEl.textContent = 'Error calculating';
            }
        }
    }
    
    
    showRecordingState() {
        // Update UI for recording state
        const postControls = document.getElementById('post-recording-controls');
        const circularRecordBtn = document.getElementById('circular-record-btn');
        const header = document.querySelector('.app-header');

        if (postControls) postControls.classList.remove('visible');

        // Update header background
        if (header) {
            header.classList.add('recording');
        }

        // Update circular record button
        if (circularRecordBtn) {
            circularRecordBtn.classList.add('recording');
            circularRecordBtn.querySelector('.material-icons').textContent = 'stop';
            circularRecordBtn.setAttribute('aria-label', 'Stop Recording');
        }

        // Disable data management during recording
        const clearBtn = document.getElementById('clear-data-btn');
        const exportBtn = document.getElementById('export-data-btn');
        if (clearBtn) clearBtn.disabled = true;
        if (exportBtn) exportBtn.disabled = true;
    }
    
    showIdleState() {
        // Update UI for idle state
        const postControls = document.getElementById('post-recording-controls');
        const circularRecordBtn = document.getElementById('circular-record-btn');
        const header = document.querySelector('.app-header');

        if (postControls) postControls.classList.add('visible');

        // Reset header background
        if (header) {
            header.classList.remove('recording');
        }

        // Update circular record button
        if (circularRecordBtn) {
            circularRecordBtn.classList.remove('recording');
            circularRecordBtn.querySelector('.material-icons').textContent = 'radio_button_checked';
            circularRecordBtn.setAttribute('aria-label', 'Start Recording');
        }

        // Re-enable data management
        const clearBtn = document.getElementById('clear-data-btn');
        const exportBtn = document.getElementById('export-data-btn');
        if (clearBtn) clearBtn.disabled = false;
        if (exportBtn) exportBtn.disabled = false;

        // Update storage usage after recording
        this.updateStorageUsage();
    }
    
    showReadyState() {
        // Update UI for ready state
        const postControls = document.getElementById('post-recording-controls');
        const circularRecordBtn = document.getElementById('circular-record-btn');
        const header = document.querySelector('.app-header');

        if (postControls) postControls.classList.remove('visible');

        // Reset header background to normal
        if (header) {
            header.classList.remove('recording');
        }

        // Update circular record button to ready state
        if (circularRecordBtn) {
            circularRecordBtn.classList.remove('recording');
            circularRecordBtn.querySelector('.material-icons').textContent = 'radio_button_checked';
            circularRecordBtn.setAttribute('aria-label', 'Start Recording');
        }

        // Ensure data management is enabled
        const clearBtn = document.getElementById('clear-data-btn');
        const exportBtn = document.getElementById('export-data-btn');
        if (clearBtn) clearBtn.disabled = false;
        if (exportBtn) exportBtn.disabled = false;
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
    
    showNotification(message, type = 'info', duration = 8000) {
        if (window.materialTabs) {
            window.materialTabs.showNotification(message, type, duration);
        } else {
            // Fallback to utils showNotification
            showNotification(message, type, duration);
        }
    }
    
    updateRecordingStats(stats) {
        // Update Material Tabs performance metrics
        if (window.materialTabs) {
            window.materialTabs.updatePerformanceMetrics();
        }
        
        // Update performance monitor if available
        if (window.performanceMonitor) {
            if (stats.totalPoints !== undefined) {
                const dataCountEl = document.getElementById('data-count');
                if (dataCountEl) {
                    dataCountEl.textContent = stats.totalPoints.toLocaleString();
                }
            }
            
            if (stats.bufferSize !== undefined) {
                window.performanceMonitor.updateBufferSize(stats.bufferSize);
            }
            
            if (stats.averageHz !== undefined) {
                window.performanceMonitor.updateSampleRate(stats.averageHz);
            }
        }
    }
    
    // Update sensor data display in Material Tabs
    updateSensorData(sensorData) {
        if (window.materialTabs) {
            window.materialTabs.updateSensorData(sensorData);
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
