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
    
    async getRecordings(userId = null, options = {}) {
        try {
            const { 
                limit = null, 
                offset = 0, 
                sortBy = 'timestamp', 
                sortOrder = 'desc' // Default to newest first for recordings
            } = options;
            
            const transaction = this.db.transaction(['recordings'], 'readonly');
            const store = transaction.objectStore('recordings');
            
            return new Promise((resolve, reject) => {
                const results = [];
                let skipCount = 0;
                let request;
                
                if (userId) {
                    const index = store.index('userId');
                    request = index.openCursor(userId);
                } else {
                    request = store.openCursor();
                }
                
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    
                    if (!cursor) {
                        // Sort and resolve results
                        const sortedResults = this._sortRecordings(results, sortBy, sortOrder);
                        resolve(sortedResults);
                        return;
                    }
                    
                    // Handle pagination
                    if (limit !== null) {
                        // Skip records for offset
                        if (skipCount < offset) {
                            skipCount++;
                            cursor.continue();
                            return;
                        }
                        
                        // Stop if we've reached the limit
                        if (results.length >= limit) {
                            const sortedResults = this._sortRecordings(results, sortBy, sortOrder);
                            resolve(sortedResults);
                            return;
                        }
                    }
                    
                    results.push(cursor.value);
                    cursor.continue();
                };
                
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            ErrorBoundary.handle(error, 'Get Recordings');
            throw error;
        }
    }
    
    // Helper method to sort recordings
    _sortRecordings(recordings, sortBy, sortOrder) {
        if (!sortBy || recordings.length === 0) return recordings;
        
        return recordings.sort((a, b) => {
            let aVal = a[sortBy];
            let bVal = b[sortBy];
            
            // Handle date strings
            if (sortBy === 'timestamp' || sortBy === 'endTime') {
                aVal = new Date(aVal).getTime();
                bVal = new Date(bVal).getTime();
            }
            
            // Handle different data types
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }
            
            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }
    
    // Get total count of recordings (for pagination info)
    async getRecordingsCount(userId = null) {
        try {
            const transaction = this.db.transaction(['recordings'], 'readonly');
            const store = transaction.objectStore('recordings');
            
            return new Promise((resolve, reject) => {
                let request;
                
                if (userId) {
                    const index = store.index('userId');
                    request = index.count(userId);
                } else {
                    request = store.count();
                }
                
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            ErrorBoundary.handle(error, 'Get Recordings Count');
            throw error;
        }
    }
    
    async getDataPoints(recordingId, options = {}) {
        try {
            const { 
                limit = null, 
                offset = 0, 
                sortBy = 'timestamp', 
                sortOrder = 'asc',
                fields = null // Allow field selection for memory optimization
            } = options;
            
            // For backwards compatibility, if no limit is specified, get all data
            if (limit === null) {
                return this._getAllDataPoints(recordingId);
            }
            
            // Use paginated approach for better memory management
            return this._getPaginatedDataPoints(recordingId, limit, offset, sortBy, sortOrder, fields);
            
        } catch (error) {
            ErrorBoundary.handle(error, 'Get Data Points');
            throw error;
        }
    }
    
    // Private method for getting all data points (backwards compatibility)
    async _getAllDataPoints(recordingId) {
        const transaction = this.db.transaction(['dataPoints'], 'readonly');
        const store = transaction.objectStore('dataPoints');
        const index = store.index('recordingId');
        
        return new Promise((resolve, reject) => {
            const request = index.getAll(recordingId);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
    
    // Private method for paginated data points
    async _getPaginatedDataPoints(recordingId, limit, offset, sortBy, sortOrder, fields) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['dataPoints'], 'readonly');
            const store = transaction.objectStore('dataPoints');
            const index = store.index('recordingId');
            const results = [];
            let skipCount = 0;
            
            const request = index.openCursor(recordingId);
            
            request.onsuccess = (event) => {
                const cursor = event.target.result;
                
                if (!cursor) {
                    // Sort results if needed (for in-memory sorting)
                    const sortedResults = this._sortDataPoints(results, sortBy, sortOrder);
                    resolve(sortedResults);
                    return;
                }
                
                // Skip records for offset
                if (skipCount < offset) {
                    skipCount++;
                    cursor.continue();
                    return;
                }
                
                // Stop if we've reached the limit
                if (results.length >= limit) {
                    const sortedResults = this._sortDataPoints(results, sortBy, sortOrder);
                    resolve(sortedResults);
                    return;
                }
                
                // Add record to results (with field selection if specified)
                const record = fields ? this._selectFields(cursor.value, fields) : cursor.value;
                results.push(record);
                
                cursor.continue();
            };
            
            request.onerror = () => reject(request.error);
        });
    }
    
    // Helper method to sort data points
    _sortDataPoints(dataPoints, sortBy, sortOrder) {
        if (!sortBy || dataPoints.length === 0) return dataPoints;
        
        return dataPoints.sort((a, b) => {
            let aVal = a[sortBy];
            let bVal = b[sortBy];
            
            // Handle different data types
            if (typeof aVal === 'string' && typeof bVal === 'string') {
                aVal = aVal.toLowerCase();
                bVal = bVal.toLowerCase();
            }
            
            if (aVal < bVal) return sortOrder === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortOrder === 'asc' ? 1 : -1;
            return 0;
        });
    }
    
    // Helper method to select specific fields from records
    _selectFields(record, fields) {
        if (!fields || !Array.isArray(fields)) return record;
        
        const selectedRecord = {};
        fields.forEach(field => {
            if (record.hasOwnProperty(field)) {
                selectedRecord[field] = record[field];
            }
        });
        
        return selectedRecord;
    }
    
    // Get total count of data points for a recording (for pagination info)
    async getDataPointsCount(recordingId) {
        try {
            const transaction = this.db.transaction(['dataPoints'], 'readonly');
            const store = transaction.objectStore('dataPoints');
            const index = store.index('recordingId');
            
            return new Promise((resolve, reject) => {
                const request = index.count(recordingId);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        } catch (error) {
            ErrorBoundary.handle(error, 'Get Data Points Count');
            throw error;
        }
    }
    
    // Get data points in batches for streaming/processing large datasets
    async* getDataPointsBatch(recordingId, batchSize = 1000) {
        try {
            let offset = 0;
            let batch;
            
            do {
                batch = await this.getDataPoints(recordingId, {
                    limit: batchSize,
                    offset: offset
                });
                
                if (batch.length > 0) {
                    yield batch;
                    offset += batch.length;
                }
            } while (batch.length === batchSize);
            
        } catch (error) {
            ErrorBoundary.handle(error, 'Get Data Points Batch');
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
