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
    
    console.log('Worker: Generating CSV for', data.length, 'data points');
    console.log('Worker: Sample data point:', data[0]);
    
    for (const point of data) {
        const row = [
            escapeCSVField(point.recordingTimestamp || ''),
            escapeCSVField(point.userId || ''),
            escapeCSVField(point.gpsTimestamp || ''),
            point.gpsLat !== undefined && point.gpsLat !== '' ? point.gpsLat : '',
            point.gpsLon !== undefined && point.gpsLon !== '' ? point.gpsLon : '',
            point.gpsError !== undefined && point.gpsError !== '' ? point.gpsError : '',
            point.gpsAlt !== undefined && point.gpsAlt !== '' ? point.gpsAlt : '',
            escapeCSVField(point.accelTimestamp || ''),
            point.accelX !== undefined && point.accelX !== '' ? point.accelX : '',
            point.accelY !== undefined && point.accelY !== '' ? point.accelY : '',
            point.accelZ !== undefined && point.accelZ !== '' ? point.accelZ : '',
            escapeCSVField(point.gyroTimestamp || ''),
            point.gyroAlpha !== undefined && point.gyroAlpha !== '' ? point.gyroAlpha : '',
            point.gyroBeta !== undefined && point.gyroBeta !== '' ? point.gyroBeta : '',
            point.gyroGamma !== undefined && point.gyroGamma !== '' ? point.gyroGamma : ''
        ];
        csvContent += row.join(',') + '\n';
    }
    
    console.log('Worker: CSV generated with', data.length, 'rows');
    return csvContent;
}

function escapeCSVField(field) {
    if (typeof field === 'string' && (field.includes(',') || field.includes('"') || field.includes('\n'))) {
        return '"' + field.replace(/"/g, '""') + '"';
    }
    return field;
}

// Handle worker errors
self.addEventListener('error', function(error) {
    console.error('Worker error:', error);
});

// Handle unhandled promise rejections
self.addEventListener('unhandledrejection', function(event) {
    console.error('Worker unhandled rejection:', event.reason);
});
