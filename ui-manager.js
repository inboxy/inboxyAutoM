
// ============================================
// ui-manager.js - UI Management and Event Handling
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
        
        // Permission retry buttons
        const retryButtons = document.querySelectorAll('.retry-permission');
        retryButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const sensor = e.target.id.replace('-retry', '');
                this.app.sensorManager.retryPermission(sensor);
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
    
    updateOnlineStatus(isOnline = navigator.onLine) {
        const statusEl = document.getElementById('online-status');
        if (statusEl) {
            statusEl.className = isOnline ? 'online-status online' : 'online-status offline';
            statusEl.textContent = isOnline ? 'Online' : 'Offline';
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
    }
    
    showIdleState() {
        // Update UI for idle state
        document.getElementById('start-btn').style.display = 'inline-flex';
        document.getElementById('stop-btn').style.display = 'none';
        document.getElementById('post-recording-controls').classList.add('visible');
        
        const statusIndicator = document.getElementById('status-indicator');
        statusIndicator.className = 'status-indicator status-idle';
        statusIndicator.innerHTML = '<span>Recording completed</span>';
    }
    
    showReadyState() {
        // Update UI for ready state
        document.getElementById('start-btn').style.display = 'inline-flex';
        document.getElementById('stop-btn').style.display = 'none';
        document.getElementById('post-recording-controls').classList.remove('visible');
        
        const statusIndicator = document.getElementById('status-indicator');
        statusIndicator.className = 'status-indicator status-idle';
        statusIndicator.innerHTML = '<span>Ready to record</span>';
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
