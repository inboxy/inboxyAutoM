// ============================================
// worker-manager.js - Web Worker Management
// ============================================

import { ErrorBoundary } from './utils.js';

export class WorkerManager {
    constructor(onDataReceived, onStatsUpdate) {
        this.worker = null;
        this.onDataReceived = onDataReceived;
        this.onStatsUpdate = onStatsUpdate;
        this.isInitialized = false;
    }
    
    init() {
        try {
            this.worker = new Worker('worker.js');
            
            this.worker.addEventListener('message', (e) => {
                const { type, data } = e.data;
                
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
                        this.downloadCSVFile(data);
                        break;
                        
                    case 'STATS_UPDATE':
                        if (this.onStatsUpdate) {
                            this.onStatsUpdate(data);
                        }
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
        if (this.worker) {
            this.worker.postMessage({ type: 'GET_STATS' });
        }
    }
    
    clearData() {
        if (this.worker) {
            this.worker.postMessage({ type: 'CLEAR_DATA' });
        }
    }
    
    downloadCSVFile(csvContent) {
        try {
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = `motion-data-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            
            URL.revokeObjectURL(url);
            
            console.log('CSV download initiated');
            
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
