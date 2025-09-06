let recordingData = [];
let isRecording = false;

self.addEventListener('message', function(e) {
    const { type, data } = e.data;
    
    switch(type) {
        case 'START_RECORDING':
            recordingData = [];
            isRecording = true;
            self.postMessage({ type: 'RECORDING_STARTED' });
            break;
            
        case 'STOP_RECORDING':
            isRecording = false;
            self.postMessage({ 
                type: 'RECORDING_STOPPED', 
                data: recordingData 
            });
            recordingData = [];
            break;
            
        case 'ADD_DATA_POINT':
            if (isRecording) {
                recordingData.push(data);
            }
            break;
            
        case 'GENERATE_CSV':
            const csv = generateCSV(data);
            self.postMessage({ type: 'CSV_GENERATED', data: csv });
            break;
    }
});

function generateCSV(data) {
    const headers = [
        'Recording Date Timestamp',
        'User ID',
        'GPS Date Timestamp',
        'GPS LAT',
        'GPS LON',
        'GPS ERROR',
        'GPS ALT',
        'Accel Date Timestamp',
        'X',
        'Y',
        'Z',
        'Gyro Date Timestamp',
        'Alpha',
        'Beta',
        'Gamma'
    ];
    
    let csvContent = headers.join(',') + '\n';
    
    for (const point of data) {
        const row = [
            point.recordingTimestamp || '',
            point.userId || '',
            point.gpsTimestamp || '',
            point.gpsLat || '',
            point.gpsLon || '',
            point.gpsError || '',
            point.gpsAlt || '',
            point.accelTimestamp || '',
            point.accelX || '',
            point.accelY || '',
            point.accelZ || '',
            point.gyroTimestamp || '',
            point.gyroAlpha || '',
            point.gyroBeta || '',
            point.gyroGamma || ''
        ];
        csvContent += row.join(',') + '\n';
    }
    
    return csvContent;
}

// Handle worker errors
self.addEventListener('error', function(error) {
    console.error('Worker error:', error);
});

// Handle unhandled promise rejections
self.addEventListener('unhandledrejection', function(event) {
    console.error('Worker unhandled rejection:', event.reason);
});
