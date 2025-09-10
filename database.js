// ============================================
// database.js - IndexedDB Management - Complete Fixed Version
// ============================================

import { ErrorBoundary } from './utils.js';

export class DatabaseManager {
    constructor() {
        this.db = null;
        this.dbName = 'MotionRecorderDB';
        this.dbVersion = 2;
    }
    
    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);
            
            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };
            
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create recordings store if it doesn't exist
                if (!db.objectStoreNames.contains('recordings')) {
                    const recordingStore = db.createObjectStore('recordings', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    recordingStore.createIndex('timestamp', 'timestamp', { unique: false });
                    recordingStore.createIndex('userId', 'userId', { unique: false });
                }
                
                // Create data points store if it doesn't exist
                if (!db.objectStoreNames.contains('dataPoints')) {
                    const dataStore = db.createObjectStore('dataPoints', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    dataStore.createIndex('recordingId', 'recordingId', { unique: false });
                    dataStore.createIndex('timestamp', 'timestamp', { unique: false });
                }
                
                // Create performance metrics store
                if (!db.objectStoreNames.contains('performanceMetrics')) {
                    const metricsStore = db.createObjectStore('performanceMetrics', {
                        keyPath: 'id',
                        autoIncrement: true
                    });
                    metricsStore.createIndex('recordingId', 'recordingId', { unique: false });
                }
            };
        });
    }
    
    async saveRecording(recording) {
        try {
            const transaction = this.db.transaction(['recordings'], 'readwrite');
            const store = transaction.objectStore('recordings');
            const request = store.add(recording);
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            ErrorBoundary.handle(error, 'Save Recording');
            throw error;
        }
    }
    
    async updateRecording(id, updates) {
        try {
            const transaction = this.db.transaction(['recordings'], 'readwrite');
            const store = transaction.objectStore('recordings');
            
            const getRequest = store.get(id);
            
            return new Promise((resolve, reject) => {
                getRequest.onsuccess = () => {
                    const recording = getRequest.result;
                    if (recording) {
                        Object.assign(recording, updates);
                        const updateRequest = store.put(recording);
                        updateRequest.onsuccess = () => resolve(recording);
                        updateRequest.onerror = () => reject(updateRequest.error);
                    } else {
                        reject(new Error('Recording not found'));
                    }
                };
                getRequest.onerror = () => reject(getRequest.error);
            });
        } catch (error) {
            ErrorBoundary.handle(error, 'Update Recording');
            throw error;
        }
    }
    
    async saveDataPoints(dataPoints, recordingId) {
        try {
            const CHUNK_SIZE = 1000;
            
            for (let i = 0; i < dataPoints.length; i += CHUNK_SIZE) {
                const chunk = dataPoints.slice(i, i + CHUNK_SIZE);
                await this.saveDataChunk(chunk, recordingId);
            }
        } catch (error) {
            ErrorBoundary.handle(error, 'Save Data Points');
            throw error;
        }
    }
    
    async saveDataChunk(chunk, recordingId) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['dataPoints'], 'readwrite');
            const store = transaction.objectStore('dataPoints');
            
            chunk.forEach(point => {
                point.recordingId = recordingId;
                store.add(point);
            });
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }
    
    async savePerformanceMetrics(metrics) {
        try {
            const transaction = this.db.transaction(['performanceMetrics'], 'readwrite');
            const store = transaction.objectStore('performanceMetrics');
            
            return new Promise((resolve, reject) => {
                const request = store.add(metrics);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            ErrorBoundary.handle(error, 'Save Performance Metrics');
            throw error;
        }
    }
    
    async getRecordings(userId = null) {
        try {
            const transaction = this.db.transaction(['recordings'], 'readonly');
            const store = transaction.objectStore('recordings');
            
            return new Promise((resolve, reject) => {
                let request;
                
                if (userId) {
                    const index = store.index('userId');
                    request = index.getAll(userId);
                } else {
                    request = store.getAll();
                }
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            ErrorBoundary.handle(error, 'Get Recordings');
            throw error;
        }
    }
    
    async getDataPoints(recordingId) {
        try {
            const transaction = this.db.transaction(['dataPoints'], 'readonly');
            const store = transaction.objectStore('dataPoints');
            const index = store.index('recordingId');
            
            return new Promise((resolve, reject) => {
                const request = index.getAll(recordingId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            ErrorBoundary.handle(error, 'Get Data Points');
            throw error;
        }
    }
    
    async deleteRecording(recordingId) {
        try {
            const transaction = this.db.transaction(['recordings', 'dataPoints', 'performanceMetrics'], 'readwrite');
            
            // Delete recording
            const recordingStore = transaction.objectStore('recordings');
            recordingStore.delete(recordingId);
            
            // Delete associated data points
            const dataStore = transaction.objectStore('dataPoints');
            const dataIndex = dataStore.index('recordingId');
            const dataRequest = dataIndex.openCursor(recordingId);
            
            dataRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                }
            };
            
            // Delete associated metrics
            const metricsStore = transaction.objectStore('performanceMetrics');
            const metricsIndex = metricsStore.index('recordingId');
            const metricsRequest = metricsIndex.openCursor(recordingId);
            
            metricsRequest.onsuccess = (event) => {
                const cursor = event.target.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                }
            };
            
            return new Promise((resolve, reject) => {
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            });
        } catch (error) {
            ErrorBoundary.handle(error, 'Delete Recording');
            throw error;
        }
    }
    
    async clearAllData() {
        try {
            const transaction = this.db.transaction(['recordings', 'dataPoints', 'performanceMetrics'], 'readwrite');
            
            transaction.objectStore('recordings').clear();
            transaction.objectStore('dataPoints').clear();
            transaction.objectStore('performanceMetrics').clear();
            
            return new Promise((resolve, reject) => {
                transaction.oncomplete = () => resolve();
                transaction.onerror = () => reject(transaction.error);
            });
        } catch (error) {
            ErrorBoundary.handle(error, 'Clear All Data');
            throw error;
        }
    }
    
    // Fixed storage size calculation
    async getDatabaseSize() {
        try {
            console.log('Calculating database size...');
            
            // Try modern storage API first
            if ('storage' in navigator && 'estimate' in navigator.storage) {
                const estimate = await navigator.storage.estimate();
                console.log('Storage estimate:', estimate);
                
                return {
                    usage: estimate.usage || 0,
                    quota: estimate.quota || 0,
                    usagePercent: estimate.quota ? ((estimate.usage || 0) / estimate.quota * 100).toFixed(1) : '0'
                };
            }
            
            // Fallback: try to estimate by counting records
            const recordingCount = await this.getRecordCount('recordings');
            const dataPointCount = await this.getRecordCount('dataPoints');
            const metricsCount = await this.getRecordCount('performanceMetrics');
            
            // Rough estimate: 
            // - Each recording: ~500 bytes
            // - Each data point: ~200 bytes  
            // - Each metric: ~100 bytes
            const estimatedUsage = (recordingCount * 500) + (dataPointCount * 200) + (metricsCount * 100);
            const estimatedQuota = 50 * 1024 * 1024; // Assume 50MB quota
            
            console.log('Fallback storage estimate:', {
                recordings: recordingCount,
                dataPoints: dataPointCount,
                metrics: metricsCount,
                estimatedUsage
            });
            
            return {
                usage: estimatedUsage,
                quota: estimatedQuota,
                usagePercent: (estimatedUsage / estimatedQuota * 100).toFixed(1)
            };
            
        } catch (error) {
            console.warn('Cannot calculate storage usage:', error);
            return {
                usage: 0,
                quota: 0,
                usagePercent: '0'
            };
        }
    }
    
    // Helper method to count records in a store - FIXED
    async getRecordCount(storeName) {
        try {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            
            return new Promise((resolve, reject) => {
                const request = store.count();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            console.warn(`Failed to count ${storeName}:`, error);
            return 0;
        }
    }
    
    // Get detailed storage statistics
    async getStorageStats() {
        try {
            const recordings = await this.getRecordings();
            let totalDataPoints = 0;
            
            for (const recording of recordings) {
                const dataPoints = await this.getDataPoints(recording.id);
                totalDataPoints += dataPoints.length;
            }
            
            const sizeInfo = await this.getDatabaseSize();
            
            return {
                recordings: recordings.length,
                dataPoints: totalDataPoints,
                storageUsage: sizeInfo.usage,
                storageQuota: sizeInfo.quota,
                usagePercent: sizeInfo.usagePercent
            };
        } catch (error) {
            console.warn('Failed to get storage stats:', error);
            return {
                recordings: 0,
                dataPoints: 0,
                storageUsage: 0,
                storageQuota: 0,
                usagePercent: '0'
            };
        }
    }
}
