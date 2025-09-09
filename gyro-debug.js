// ============================================
// gyro-debug.js - Specific Gyroscope Debug and Fix
// Add this temporarily to debug gyroscope issues
// ============================================

console.log('🔧 Gyroscope Debug Helper Loaded');

// Test gyroscope data access immediately
function testGyroscopeAccess() {
    console.log('=== GYROSCOPE SPECIFIC TEST ===');
    
    if (!('DeviceMotionEvent' in window)) {
        console.log('❌ DeviceMotionEvent not supported');
        return;
    }
    
    let eventCount = 0;
    
    const gyroHandler = (event) => {
        eventCount++;
        
        if (eventCount <= 10) {
            console.log(`Gyro Event ${eventCount}:`, {
                raw_event: event,
                rotationRate: event.rotationRate,
                rotationRate_alpha: event.rotationRate?.alpha,
                rotationRate_beta: event.rotationRate?.beta,
                rotationRate_gamma: event.rotationRate?.gamma
            });
            
            // Try different property access methods
            if (event.rotationRate) {
                const rate = event.rotationRate;
                console.log('Rotation Rate Properties:', {
                    alpha: rate.alpha,
                    beta: rate.beta, 
                    gamma: rate.gamma,
                    keys: Object.keys(rate)
                });
                
                // Update UI directly to test
                const alphaEl = document.getElementById('gyro-alpha');
                const betaEl = document.getElementById('gyro-beta');
                const gammaEl = document.getElementById('gyro-gamma');
                
                if (alphaEl && rate.alpha !== null && rate.alpha !== undefined) {
                    alphaEl.textContent = `${rate.alpha.toFixed(2)} °/s`;
                    alphaEl.style.color = 'green';
                    console.log('✅ Alpha updated:', rate.alpha);
                }
                
                if (betaEl && rate.beta !== null && rate.beta !== undefined) {
                    betaEl.textContent = `${rate.beta.toFixed(2)} °/s`;
                    betaEl.style.color = 'green';
                    console.log('✅ Beta updated:', rate.beta);
                }
                
                if (gammaEl && rate.gamma !== null && rate.gamma !== undefined) {
                    gammaEl.textContent = `${rate.gamma.toFixed(2)} °/s`;
                    gammaEl.style.color = 'green';
                    console.log('✅ Gamma updated:', rate.gamma);
                }
            } else {
                console.log('❌ No rotationRate in event');
            }
        }
        
        if (eventCount === 1) {
            console.log('✅ Gyroscope events are firing');
        }
    };
    
    window.addEventListener('devicemotion', gyroHandler);
    
    // Stop after 15 seconds
    setTimeout(() => {
        window.removeEventListener('devicemotion', gyroHandler);
        console.log(`🏁 Gyroscope test complete. Received ${eventCount} events.`);
        
        if (eventCount === 0) {
            console.log('❌ No gyroscope events received. Possible issues:');
            console.log('1. Device doesn\'t have gyroscope');
            console.log('2. Permission not granted');
            console.log('3. Browser doesn\'t support motion events');
            console.log('4. Device needs to be moved to activate sensors');
        }
    }, 15000);
    
    console.log('👂 Listening for gyroscope events... (move your device)');
}

// Test acceleration vs rotation data
function compareAccelAndGyro() {
    console.log('=== ACCELERATION vs GYROSCOPE COMPARISON ===');
    
    let count = 0;
    const handler = (event) => {
        count++;
        if (count <= 5) {
            console.log(`Event ${count}:`, {
                hasAcceleration: !!event.acceleration,
                hasAccelerationIncludingGravity: !!event.accelerationIncludingGravity,
                hasRotationRate: !!event.rotationRate,
                acceleration: event.acceleration,
                accelerationIncludingGravity: event.accelerationIncludingGravity,
                rotationRate: event.rotationRate
            });
        }
    };
    
    window.addEventListener('devicemotion', handler);
    setTimeout(() => {
        window.removeEventListener('devicemotion', handler);
        console.log('=== COMPARISON COMPLETE ===');
    }, 10000);
}

// Auto-run tests
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        console.log('🚀 Starting gyroscope-specific tests...');
        testGyroscopeAccess();
        compareAccelAndGyro();
    }, 2000);
});

// Manual test functions
window.testGyroscopeAccess = testGyroscopeAccess;
window.compareAccelAndGyro = compareAccelAndGyro;
