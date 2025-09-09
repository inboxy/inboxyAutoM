// ============================================
// data-management-test.js - Test Data Management Functions
// Add this temporarily to test clear and export functionality
// ============================================

console.log('🧪 Data Management Test Helper Loaded');

// Test storage calculation
async function testStorageCalculation() {
    console.log('=== TESTING STORAGE CALCULATION ===');
    
    try {
        if (window.app && window.app.databaseManager) {
            console.log('Database manager found');
            
            // Test storage size calculation
            const storageInfo = await window.app.databaseManager.getDatabaseSize();
            console.log('Storage info:', storageInfo);
            
            // Test storage stats
            const stats = await window.app.databaseManager.getStorageStats();
            console.log('Storage stats:', stats);
            
            // Manually update UI
            const storageEl = document.getElementById('storage-usage');
            if (storageEl) {
                const usageMB = (storageInfo.usage / 1048576).toFixed(1);
                if (storageInfo.quota > 0) {
                    const quotaMB = (storageInfo.quota / 1048576).toFixed(0);
                    storageEl.textContent = `${usageMB} MB / ${quotaMB} MB (${storageInfo.usagePercent}%)`;
                } else {
                    storageEl.textContent = `${usageMB} MB used`;
                }
                console.log('✅ Storage UI updated manually');
            }
            
        } else {
            console.log('❌ App or database manager not found');
        }
    } catch (error) {
        console.log('❌ Storage calculation failed:', error);
    }
}

// Test clear data functionality
async function testClearData() {
    console.log('=== TESTING CLEAR DATA ===');
    
    try {
        if (window.app && window.app.clearAllData) {
            console.log('Clear data method found');
            
            // Show what data exists before clearing
            const recordings = await window.app.databaseManager.getRecordings();
            console.log(`Found ${recordings.length} recordings before clear`);
            
            // Test clear (you'll need to confirm in UI)
            console.log('To test clear data, click the button in the UI');
            console.log('Or call: window.app.clearAllData()');
            
        } else {
            console.log('❌ App or clearAllData method not found');
        }
    } catch (error) {
        console.log('❌ Clear data test failed:', error);
    }
}

// Test export data functionality
async function testExportData() {
    console.log('=== TESTING EXPORT DATA ===');
    
    try {
        if (window.app && window.app.exportAllData) {
            console.log('Export data method found');
            
            // Show what data exists
            const recordings = await window.app.databaseManager.getRecordings();
            console.log(`Found ${recordings.length} recordings to export`);
            
            if (recordings.length > 0) {
                console.log('To test export, click the button in the UI');
                console.log('Or call: window.app.exportAllData()');
            } else {
                console.log('No data to export - record some data first');
            }
            
        } else {
            console.log('❌ App or exportAllData method not found');
        }
    } catch (error) {
        console.log('❌ Export data test failed:', error);
    }
}

// Test button event listeners
function testButtonListeners() {
    console.log('=== TESTING BUTTON LISTENERS ===');
    
    const clearBtn = document.getElementById('clear-data-btn');
    const exportBtn = document.getElementById('export-data-btn');
    
    if (clearBtn) {
        console.log('✅ Clear data button found');
        console.log('Clear button disabled:', clearBtn.disabled);
        console.log('Clear button click listeners:', clearBtn.onclick !== null);
    } else {
        console.log('❌ Clear data button not found');
    }
    
    if (exportBtn) {
        console.log('✅ Export data button found');
        console.log('Export button disabled:', exportBtn.disabled);
        console.log('Export button click listeners:', exportBtn.onclick !== null);
    } else {
        console.log('❌ Export data button not found');
    }
}

// Create test data for testing export
async function createTestData() {
    console.log('=== CREATING TEST DATA ===');
    
    try {
        if (window.app && window.app.databaseManager) {
            const db = window.app.databaseManager;
            const userId = window.app.userManager.getUserId();
            
            // Create a test recording
            const testRecording = {
                userId: userId,
                timestamp: new Date().toISOString(),
                status: 'completed',
                sampleRate: 140,
                batteryLevel: 1.0,
                endTime: new Date().toISOString(),
                dataPointCount: 3,
                averageHz: 140
            };
            
            const recordingId = await db.saveRecording(testRecording);
            console.log('Created test recording:', recordingId);
            
            // Create some test data points
            const testDataPoints = [
                {
                    recordingTimestamp: testRecording.timestamp,
                    userId: userId,
                    gpsTimestamp: new Date().toISOString(),
                    gpsLat: 37.7749,
                    gpsLon: -122.4194,
                    gpsError: 5.0,
                    timestamp: Date.now()
                },
                {
                    recordingTimestamp: testRecording.timestamp,
                    userId: userId,
                    accelTimestamp: new Date().toISOString(),
                    accelX: 0.1,
                    accelY: 0.2,
                    accelZ: 9.8,
                    timestamp: Date.now()
                },
                {
                    recordingTimestamp: testRecording.timestamp,
                    userId: userId,
                    gyroTimestamp: new Date().toISOString(),
                    gyroAlpha: 1.5,
                    gyroBeta: -0.8,
                    gyroGamma: 0.3,
                    timestamp: Date.now()
                }
            ];
            
            await db.saveDataPoints(testDataPoints, recordingId);
            console.log('Created test data points');
            
            // Update storage display
            if (window.app.uiManager) {
                await window.app.uiManager.updateStorageUsage();
            }
            
            console.log('✅ Test data created successfully');
            return recordingId;
            
        } else {
            console.log('❌ App components not available');
        }
    } catch (error) {
        console.log('❌ Failed to create test data:', error);
    }
}

// Run all tests
async function runAllTests() {
    console.log('🚀 Running all data management tests...');
    
    testButtonListeners();
    await testStorageCalculation();
    await testClearData();
    await testExportData();
    
    console.log('✅ All tests completed');
}

// Auto-run tests when page loads
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(async () => {
        console.log('🧪 Starting data management tests...');
        await runAllTests();
    }, 3000); // Wait for app to initialize
});

// Add test buttons
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        // Add test storage button
        const testStorageBtn = document.createElement('button');
        testStorageBtn.textContent = 'Test Storage';
        testStorageBtn.style.cssText = `
            position: fixed;
            top: 130px;
            right: 10px;
            z-index: 9999;
            background: #6c757d;
            color: white;
            border: none;
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
        `;
        testStorageBtn.onclick = testStorageCalculation;
        document.body.appendChild(testStorageBtn);
        
        // Add create test data button
        const createDataBtn = document.createElement('button');
        createDataBtn.textContent = 'Create Test Data';
        createDataBtn.style.cssText = `
            position: fixed;
            top: 160px;
            right: 10px;
            z-index: 9999;
            background: #17a2b8;
            color: white;
            border: none;
            padding: 6px 10px;
            border-radius: 4px;
            font-size: 11px;
            cursor: pointer;
        `;
        createDataBtn.onclick = createTestData;
        document.body.appendChild(createDataBtn);
        
    }, 2000);
});

// Make functions available globally
window.testStorageCalculation = testStorageCalculation;
window.testClearData = testClearData;
window.testExportData = testExportData;
window.createTestData = createTestData;
window.runAllTests = runAllTests;

console.log('📊 Data Management Test Helper loaded. Use test functions or buttons.');
