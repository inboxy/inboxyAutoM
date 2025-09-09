// ============================================
// sensor-debug.js - Debug Helper for Sensor Issues
// Add this script to your HTML to debug sensor problems
// ============================================

// Debug function to test sensors immediately
function debugSensors() {
    console.log('=== SENSOR DEBUG START ===');
    
    // Check browser capabilities
    console.log('Browser capabilities:');
    console.log('- navigator.geolocation:', 'geolocation' in navigator);
    console.log('- DeviceMotionEvent:', 'DeviceMotionEvent' in window);
    console.log('- requestPermission:', typeof DeviceMotionEvent.requestPermission);
    console.log('- User agent:', navigator.userAgent);
    
    // Test GPS immediately
    if ('geolocation' in navigator) {
        console.log('Testing GPS...');
        navigator.geolocation.getCurrentPosition(
            (position) => {
                console.log('✅ GPS working:', position.coords);
                // Update UI immediately
                document.getElementById('gps-lat').textContent = position.coords.latitude.toFixed(6);
                document.getElementById('gps-lon').textContent = position.coords.longitude.toFixed(6);
                document.getElementById('gps-error').textContent = `${position.coords.accuracy.toFixed(1)} m`;
            },
            (error) => {
                console.log('❌ GPS error:', error.message, error.code);
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
    }
    
    // Test motion sensors immediately
    if ('DeviceMotionEvent' in window) {
        console.log('Testing motion sensors...');
        
        let motionCount = 0;
        const motionHandler = (event) => {
            motionCount++;
            if (motionCount <= 5) { // Only log first 5 events
                console.log(`Motion event ${motionCount}:`, {
                    accel: event.accelerationIncludingGravity,
                    gyro: event.rotationRate,
                    interval: event.interval
                });
                
                // Update UI immediately
                if (event.accelerationIncludingGravity) {
                    const { x, y, z } = event.accelerationIncludingGravity;
                    if (x !== null) document.getElementById('accel-x').textContent = `${x.toFixed(2)} m/s²`;
                    if (y !== null) document.getElementById('accel-y').textContent = `${y.toFixed(2)} m/s²`;
                    if (z !== null) document.getElementById('accel-z').textContent = `${z.toFixed(2)} m/s²`;
                }
                
                if (event.rotationRate) {
                    const { alpha, beta, gamma } = event.rotationRate;
                    if (alpha !== null) document.getElementById('gyro-alpha').textContent = `${alpha.toFixed(2)} °/s`;
                    if (beta !== null) document.getElementById('gyro-beta').textContent = `${beta.toFixed(2)} °/s`;
                    if (gamma !== null) document.getElementById('gyro-gamma').textContent = `${gamma.toFixed(2)} °/s`;
                }
            }
            
            if (motionCount === 1) {
                console.log('✅ Motion sensors working');
            }
        };
        
        window.addEventListener('devicemotion', motionHandler);
        
        // Stop listening after 10 seconds
        setTimeout(() => {
            window.removeEventListener('devicemotion', motionHandler);
            if (motionCount === 0) {
                console.log('❌ No motion events received');
            } else {
                console.log(`✅ Received ${motionCount} motion events`);
            }
        }, 10000);
    }
    
    console.log('=== SENSOR DEBUG END ===');
}

// Check DOM elements
function checkDOMElements() {
    console.log('=== DOM ELEMENTS CHECK ===');
    
    const elements = [
        'gps-lat', 'gps-lon', 'gps-error', 'gps-alt',
        'accel-x', 'accel-y', 'accel-z',
        'gyro-alpha', 'gyro-beta', 'gyro-gamma',
        'gps-status', 'accel-status', 'gyro-status'
    ];
    
    elements.forEach(id => {
        const el = document.getElementById(id);
        console.log(`${id}:`, el ? '✅ Found' : '❌ Missing');
    });
    
    console.log('=== DOM ELEMENTS CHECK END ===');
}

// Auto-run debug when page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Starting sensor debug...');
    
    // Wait a moment for other scripts to load
    setTimeout(() => {
        checkDOMElements();
        debugSensors();
    }, 1000);
});

// Make functions available globally for manual testing
window.debugSensors = debugSensors;
window.checkDOMElements = checkDOMElements;

// Add a debug button to the page
document.addEventListener('DOMContentLoaded', () => {
    const debugButton = document.createElement('button');
    debugButton.textContent = 'Debug Sensors';
    debugButton.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 9999;
        background: #ff6b6b;
        color: white;
        border: none;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
    `;
    debugButton.onclick = () => {
        checkDOMElements();
        debugSensors();
    };
    document.body.appendChild(debugButton);
});

console.log('📊 Sensor debug helper loaded. Use debugSensors() or click the debug button.');
