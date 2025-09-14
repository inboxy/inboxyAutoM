// ============================================
// app.js - Main Application (Complete Fixed Version)
// ============================================

import { ErrorBoundary } from './utils.js';
import { UserManager } from './user-manager.js';
import { DatabaseManager } from './database.js';
import { SensorManager } from './sensors.js';
import { WorkerManager } from './worker-manager.js';
import { UIManager } from './ui-manager.js';

class MotionRecorderApp {
    constructor() {
        // Core managers
        this.userManager = new UserManager();
        this.databaseManager = new DatabaseManager();
        this.sensorManager = new SensorManager(this.handleSensorData.bind(this));
        this.workerManager = new WorkerManager(
            this.saveRecordingData.bind(this),
            this.updateStats.bind(this)
        );
        this.uiManager = new UIManager(this);
        
        // Set app reference in worker manager for userID access
        this.workerManager.setApp(this);
        
        // Recording state
        this.isRecording = false;
        this.startTime = null;
        this.currentRecordingId = null;
        this.batteryLevel = 1;
        this.statsInterval = null;
        
        // Performance monitoring
        this.performanceMonitor = null;
        
        this.init();
    }
    
    async init() {
        try {
            await this.userManager.init();
            await this.databaseManager.init();
            this.uiManager.init();
            this.initPerformanceMonitor();
            await this.sensorManager.checkPermissions();
            this.workerManager.init();
            this.initBatteryMonitoring();
            
            this.uiManager.updateAppStatus('Ready');
            this.uiManager.enableControls();
            
        } catch (error) {
            ErrorBoundary.handle(error, 'App Initialization');
            this.uiManager.updateAppStatus('Error');
            this.uiManager.disableControls();
        }
    }
    
    initPerformanceMonitor() {
        if (window.performanceMonitor) {
            this.performanceMonitor = window.performanceMonitor;
        }
    }
    
    async initBatteryMonitoring() {
        if ('getBattery' in navigator) {
            try {
                const battery = await navigator.getBattery();
                this.batteryLevel = battery.level;
                
                battery.addEventListener('levelchange', () => {
                    this.batteryLevel = battery.level;
                    this.sensorManager.adjustSampleRateForBattery(this.batteryLevel);
                });
                
                // Check battery level periodically during recording
                setInterval(() => {
                    if (this.isRecording && this.batteryLevel < 0.2) {
                        this.uiManager.showNotification(
                            'Low battery: Sample rate reduced to conserve power', 
                            'warning'
                        );
                    }
                }, 60000); // Check every minute
            } catch (error) {
                console.log('Battery API not available');
            }
        }
    }
    
    handleSensorData(data) {
        if (this.isRecording && this.workerManager.isAvailable()) {
            if (Array.isArray(data)) {
                this.workerManager.addDataBatch(data);
            } else {
                this.workerManager.addDataPoint(data);
            }
            
            // Performance monitoring
            if (this.performanceMonitor && !Array.isArray(data)) {
                this.performanceMonitor.addSample();
            }
        }
        
        // Update UI with sensor data (both recording and live view)
        if (this.uiManager && !Array.isArray(data)) {
            this.uiManager.updateSensorData(data);
        }
    }
    
    async startRecording() {
        try {
            console.log('🎬 startRecording called');
            // Check if we have necessary permissions
            const hasPermissions = this.sensorManager.checkRecordingPermissions();
            console.log('📋 Permissions check result:', hasPermissions);
            if (!hasPermissions) {
                console.log('❌ Permissions denied, showing notification');
                this.uiManager.showNotification(
                    'Please grant sensor permissions before recording',
                    'warning'
                );
                return;
            }
            
            console.log('✅ Permissions granted, starting recording process...');
            this.isRecording = true;
            this.startTime = new Date().toISOString();
            console.log('⏰ Recording start time:', this.startTime);

            // Adjust sample rate based on battery
            this.sensorManager.adjustSampleRateForBattery(this.batteryLevel);
            console.log('🔋 Battery level:', this.batteryLevel);

            // Update UI
            console.log('🎨 Updating UI to recording state...');
            this.uiManager.showRecordingState();
            
            // Start performance monitoring
            if (this.performanceMonitor) {
                this.performanceMonitor.start();
            }
            
            // Start worker recording
            console.log('🛠️ Starting worker recording...');
            this.workerManager.startRecording();

            // Start sensor tracking
            const userId = this.userManager.getUserId();
            console.log('📊 Starting sensor tracking for user:', userId);
            this.sensorManager.startTracking(this.startTime, userId);

            // Create recording entry in IndexedDB
            const recording = {
                userId: userId,
                timestamp: this.startTime,
                status: 'recording',
                sampleRate: this.sensorManager.adaptiveSampleRate,
                batteryLevel: this.batteryLevel
            };

            console.log('💾 Saving recording to database:', recording);
            this.currentRecordingId = await this.databaseManager.saveRecording(recording);
            console.log('✅ Recording created with ID:', this.currentRecordingId);
            
            // Set maximum recording duration
            const maxDuration = window.MotionRecorderConfig?.sensors?.maxRecordingDuration || 3600000;
            this.uiManager.setMaxRecordingDuration(maxDuration);

            // Start periodic stats updates
            this.statsInterval = setInterval(() => {
                this.workerManager.getStats();
                // Also trigger Material Tabs performance metrics update
                if (window.materialTabs) {
                    window.materialTabs.updatePerformanceMetrics();
                }
            }, 1000); // Update every second
            
        } catch (error) {
            ErrorBoundary.handle(error, 'Start Recording');
            this.isRecording = false;
            this.uiManager.showReadyState();
        }
    }
    
    async stopRecording() {
        try {
            this.isRecording = false;

            // Clear recording timeout
            this.uiManager.clearRecordingTimeout();

            // Clear stats interval
            if (this.statsInterval) {
                clearInterval(this.statsInterval);
                this.statsInterval = null;
            }
            
            // Stop performance monitoring
            if (this.performanceMonitor) {
                this.performanceMonitor.stop();
            }
            
            // Stop sensor tracking
            this.sensorManager.stopTracking();
            
            // Update UI
            this.uiManager.showIdleState();
            
            // Stop worker recording
            this.workerManager.stopRecording();
            
        } catch (error) {
            ErrorBoundary.handle(error, 'Stop Recording');
        }
    }
    
    async saveRecordingData(data, stats) {
        try {
            if (!this.currentRecordingId) return;
            
            // Update recording status
            await this.databaseManager.updateRecording(this.currentRecordingId, {
                status: 'completed',
                endTime: new Date().toISOString(),
                dataPointCount: data.length,
                averageHz: stats?.averageHz || 0
            });
            
            // Save performance metrics
            if (stats) {
                await this.databaseManager.savePerformanceMetrics({
                    recordingId: this.currentRecordingId,
                    totalPoints: stats.totalPoints,
                    averageHz: stats.averageHz,
                    timestamp: new Date().toISOString()
                });
            }
            
            // Save data points in chunks to avoid memory issues
            await this.databaseManager.saveDataPoints(data, this.currentRecordingId);
            
            console.log('Recording saved successfully:', {
                recordingId: this.currentRecordingId,
                dataPoints: data.length,
                averageHz: stats?.averageHz
            });
            
            this.uiManager.showNotification(
                `Recording saved: ${data.length} data points at ${(stats?.averageHz || 0).toFixed(1)} Hz`,
                'success'
            );
            
        } catch (error) {
            ErrorBoundary.handle(error, 'Save Recording Data');
        }
    }
    
    updateStats(stats) {
        this.uiManager.updateRecordingStats(stats);
    }
    
    async downloadCSV() {
        try {
            if (!this.currentRecordingId) {
                this.uiManager.showNotification('No recording to download', 'warning');
                return;
            }
            
            this.uiManager.showLoadingState('Generating CSV...');
            
            // Get total count first to check data size
            const totalCount = await this.databaseManager.getDataPointsCount(this.currentRecordingId);
            
            if (totalCount === 0) {
                this.uiManager.showNotification('No data points to export', 'warning');
                this.uiManager.hideLoadingState();
                return;
            }
            
            // For large datasets, use batch processing to avoid memory issues
            if (totalCount > 10000) {
                this.uiManager.showLoadingState(`Processing ${totalCount} data points in batches...`);
                await this.downloadLargeCSV(this.currentRecordingId, totalCount);
            } else {
                // Get data from database (smaller datasets)
                const dataPoints = await this.databaseManager.getDataPoints(this.currentRecordingId);
                // Generate CSV using worker
                this.workerManager.generateCSV(dataPoints);
            }
            
            this.uiManager.hideLoadingState();
            
        } catch (error) {
            this.uiManager.hideLoadingState();
            ErrorBoundary.handle(error, 'Download CSV');
        }
    }
    
    async downloadLargeCSV(recordingId, totalCount) {
        try {
            const batchSize = 5000;
            const allDataPoints = [];
            let processed = 0;
            
            // Process in batches to avoid memory issues
            for await (const batch of this.databaseManager.getDataPointsBatch(recordingId, batchSize)) {
                allDataPoints.push(...batch);
                processed += batch.length;
                
                // Update progress
                const progress = Math.round((processed / totalCount) * 100);
                this.uiManager.showLoadingState(`Processing batch: ${progress}% (${processed}/${totalCount})`);
                
                // Give browser time to breathe
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            // Generate CSV using worker
            this.workerManager.generateCSV(allDataPoints);
            
        } catch (error) {
            ErrorBoundary.handle(error, 'Download Large CSV');
            throw error;
        }
    }
    
    async uploadJSON() {
        try {
            if (!this.currentRecordingId) {
                this.uiManager.showNotification('No recording to upload', 'warning');
                return;
            }
            
            const apiEndpoint = window.MotionRecorderConfig?.api?.endpoint;
            if (!apiEndpoint || apiEndpoint === 'https://your-api-endpoint.com/api/recordings') {
                this.uiManager.showNotification('API endpoint not configured', 'error');
                return;
            }
            
            this.uiManager.showLoadingState('Uploading data...');
            
            // Get recording and data from database
            const recordings = await this.databaseManager.getRecordings(this.userManager.getUserId());
            const recording = recordings.find(r => r.id === this.currentRecordingId);
            const dataPoints = await this.databaseManager.getDataPoints(this.currentRecordingId);
            
            const payload = {
                recording: recording,
                dataPoints: dataPoints,
                metadata: {
                    version: '2.0.0',
                    uploadTime: new Date().toISOString(),
                    userAgent: navigator.userAgent,
                    userId: this.userManager.getUserId() // Include userID in metadata
                }
            };
            
            const response = await fetch(apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });
            
            if (response.ok) {
                this.uiManager.showNotification('Data uploaded successfully', 'success');
            } else {
                throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
            }
            
            this.uiManager.hideLoadingState();
            
        } catch (error) {
            this.uiManager.hideLoadingState();
            ErrorBoundary.handle(error, 'Upload JSON');
            this.uiManager.showNotification('Upload failed. Data saved locally.', 'error');
        }
    }
    
    async exportAllData() {
        try {
            this.uiManager.showLoadingState('Exporting all data...');
            
            if (!this.databaseManager || !this.databaseManager.db) {
                throw new Error('Database not initialized');
            }
            
            // Get all recordings with basic info first
            const recordings = await this.databaseManager.getRecordings();
            
            if (recordings.length === 0) {
                this.uiManager.showNotification('No data to export. Record some data first.', 'warning');
                this.uiManager.hideLoadingState();
                return;
            }
            
            // Check total data size to determine export strategy
            let totalDataPoints = 0;
            const recordingCounts = [];
            
            for (const recording of recordings) {
                const count = await this.databaseManager.getDataPointsCount(recording.id);
                recordingCounts.push({ recordingId: recording.id, count });
                totalDataPoints += count;
            }
            
            const exportData = {
                metadata: {
                    exportDate: new Date().toISOString(),
                    userId: this.userManager.getUserId(),
                    version: '2.0.0',
                    totalRecordings: recordings.length,
                    totalDataPoints: totalDataPoints
                },
                recordings: []
            };
            
            // Process recordings with progress updates
            for (let i = 0; i < recordings.length; i++) {
                const recording = recordings[i];
                const recordingCount = recordingCounts[i].count;
                
                this.uiManager.showLoadingState(
                    `Processing recording ${i + 1}/${recordings.length} (${recordingCount} data points)...`
                );
                
                // For large recordings, use batch processing
                if (recordingCount > 5000) {
                    const dataPoints = [];
                    for await (const batch of this.databaseManager.getDataPointsBatch(recording.id, 2000)) {
                        dataPoints.push(...batch);
                        
                        // Update progress within large recording
                        const progress = Math.round((dataPoints.length / recordingCount) * 100);
                        this.uiManager.showLoadingState(
                            `Processing recording ${i + 1}/${recordings.length}: ${progress}% (${dataPoints.length}/${recordingCount})`
                        );
                        
                        // Give browser time to breathe
                        await new Promise(resolve => setTimeout(resolve, 10));
                    }
                    
                    exportData.recordings.push({
                        ...recording,
                        dataPoints: dataPoints
                    });
                } else {
                    // Smaller recordings can be processed normally
                    const dataPoints = await this.databaseManager.getDataPoints(recording.id);
                    exportData.recordings.push({
                        ...recording,
                        dataPoints: dataPoints
                    });
                }
                
                // Give browser time to breathe between recordings
                await new Promise(resolve => setTimeout(resolve, 5));
            }
            
            this.uiManager.showLoadingState('Generating export file...');
            
            // Create and download file with userID in filename
            const jsonContent = JSON.stringify(exportData, null, 2);
            const blob = new Blob([jsonContent], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const userId = this.userManager.getUserId();
            const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD format
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `motion-recorder-export-${userId}-${timestamp}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            
            this.uiManager.hideLoadingState();
            
            this.uiManager.showNotification(
                `✅ Exported ${recordings.length} recordings with ${totalDataPoints.toLocaleString()} data points`,
                'success'
            );
            console.log('✅ Export completed with filename:', a.download);
            
        } catch (error) {
            this.uiManager.hideLoadingState();
            console.error('Export failed:', error);
            ErrorBoundary.handle(error, 'Export All Data');
            this.uiManager.showNotification('❌ Export failed: ' + error.message, 'error');
        }
    }
    
    async clearAllData() {
        try {
            // Clear IndexedDB data
            if (this.databaseManager) {
                await this.databaseManager.clearAllData();
            }
            
            // Clear other storage
            if (typeof localStorage !== 'undefined') {
                localStorage.clear();
            }
            if (typeof sessionStorage !== 'undefined') {
                sessionStorage.clear();
            }
            
            // Clear and regenerate user ID
            if (this.userManager) {
                this.userManager.clearUserId();
                await this.userManager.init();
            }
            
            // Update UI
            if (this.uiManager) {
                await this.uiManager.updateStorageUsage();
            }
            
            console.log('✅ All data cleared successfully');
            
        } catch (error) {
            console.error('Failed to clear data:', error);
            throw error;
        }
    }
    
    async uploadPendingData() {
        try {
            // This would be called when connection is restored
            console.log('Checking for pending data to upload...');
            // Implementation for background sync would go here
        } catch (error) {
            console.warn('Failed to upload pending data:', error);
        }
    }
    
    // Expose methods for UI callbacks
    showNotification(message, type, duration) {
        this.uiManager.showNotification(message, type, duration);
    }
}

// Initialize the application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    try {
        console.log('🚀 Initializing Motion Recorder App...');
        window.app = new MotionRecorderApp();
        console.log('✅ Motion Recorder App initialized successfully');
        console.log('🔍 Global app object:', window.app);
        console.log('🔍 App methods:', {
            startRecording: typeof window.app.startRecording,
            stopRecording: typeof window.app.stopRecording,
            isRecording: window.app.isRecording
        });
    } catch (error) {
        console.error('❌ Failed to initialize Motion Recorder App:', error);
        ErrorBoundary.handle(error, 'App Initialization');
    }
});

// Export for global access if needed
window.MotionRecorderApp = MotionRecorderApp;
