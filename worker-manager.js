// ============================================
// worker-manager.js - Web Worker Management with UserID Support
// ============================================

import { ErrorBoundary } from './utils.js';

export class WorkerManager {
    constructor(onDataReceived, onStatsUpdate) {
        this.worker = null;
        this.onDataReceived = onDataReceived;
        this.onStatsUpdate = onStatsUpdate;
        this.isInitialized = false;
        this.app = null; // Reference to main app for accessing userID
        this.currentStats = { totalPoints: 0, bufferSize: 0, averageHz: 0 }; // Cache for synchronous access
    }
    
    // Set app reference to access userManager
    setApp(app) {
        this.app = app;
    }
    
    init() {
        try {
            this.worker = new Worker('worker.js');
            
            this.worker.addEventListener('message', (e) => {
                const { type, data, userId, skipDownload } = e.data;

                switch(type) {
                    case 'RECORDING_STARTED':
                        console.log('Worker: Recording started');
                        break;

                    case 'RECORDING_STOPPED':
                        if (this.onDataReceived) {
                            this.onDataReceived(data.data, data.stats);
                        }
                        break;

                    case 'CSV_GENERATED':
                        // Only download if skipDownload is not set (for manual downloads)
                        // When uploading, skipDownload will be true and we skip this
                        if (!skipDownload) {
                            const userIdForFilename = userId || this.app?.userManager?.getUserId() || 'unknown';
                            this.downloadCSVFile(data, userIdForFilename);
                        }
                        break;
                        
                    case 'STATS_UPDATE':
                        // Update cached stats for synchronous access
                        this.currentStats = { ...data };
                        if (this.onStatsUpdate) {
                            this.onStatsUpdate(data);
                        }
                        break;

                    case 'GET_STATS_RESPONSE':
                        // Update cached stats when requested
                        this.currentStats = { ...data };
                        console.log('📊 Stats updated:', this.currentStats);
                        break;
                        
                    case 'WORKER_ERROR':
                        ErrorBoundary.handle(new Error(data), 'Worker');
                        break;
                }
            });
            
            this.worker.addEventListener('error', (error) => {
                console.error('Worker error details:', error);
                ErrorBoundary.handle(error, 'Worker');
            });
            
            this.isInitialized = true;
            
        } catch (error) {
            console.error('Failed to initialize worker:', error);
            ErrorBoundary.handle(error, 'Worker Initialization');
        }
    }
    
    startRecording() {
        if (this.worker) {
            this.worker.postMessage({ type: 'START_RECORDING' });
        }
    }
    
    stopRecording() {
        if (this.worker) {
            this.worker.postMessage({ type: 'STOP_RECORDING' });
        }
    }
    
    addDataPoint(data) {
        if (this.worker) {
            this.worker.postMessage({
                type: 'ADD_DATA_POINT',
                data: data
            });
        }
    }
    
    addDataBatch(data) {
        if (this.worker) {
            this.worker.postMessage({
                type: 'ADD_DATA_BATCH',
                data: data
            });
        }
    }
    
    generateCSV(data) {
        if (this.worker) {
            this.worker.postMessage({
                type: 'GENERATE_CSV',
                data: data
            });
        }
    }
    
    getStats() {
        // Request fresh stats from worker (async)
        if (this.worker) {
            this.worker.postMessage({ type: 'GET_STATS' });
        }
        // Return cached stats immediately for synchronous access
        return this.currentStats;
    }
    
    clearData() {
        if (this.worker) {
            this.worker.postMessage({ type: 'CLEAR_DATA' });
        }
    }
    
    downloadCSVFile(csvContent, userId = 'unknown') {
        try {
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            
            // Create filename with userID and timestamp
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `motion-data-${userId}-${timestamp}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            
            console.log('CSV download initiated with filename:', a.download);
            
        } catch (error) {
            console.error('Error downloading CSV:', error);
            ErrorBoundary.handle(error, 'CSV Download');
        }
    }
    
    terminate() {
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
            this.isInitialized = false;
        }
    }
    
    isAvailable() {
        return this.isInitialized && this.worker !== null;
    }
}
