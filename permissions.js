document.addEventListener('DOMContentLoaded', () => {
    const requestBtn = document.getElementById('request-permissions-btn');
    const helpText = document.getElementById('permission-help');
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const needsPermissionRequest = typeof DeviceMotionEvent !== 'undefined' && 
                                   typeof DeviceMotionEvent.requestPermission === 'function';
    
    if (isIOS || needsPermissionRequest) {
        requestBtn.style.display = 'flex';
        helpText.style.display = 'block';
        
        requestBtn.addEventListener('click', async () => {
            try {
                requestBtn.innerHTML = '<span class="material-icons">hourglass_empty</span>Requesting...';
                requestBtn.disabled = true;
                
                if (typeof DeviceMotionEvent.requestPermission === 'function') {
                    const permission = await DeviceMotionEvent.requestPermission();
                    
                    if (permission === 'granted') {
                        requestBtn.innerHTML = '<span class="material-icons">check_circle</span>Permissions Granted';
                        requestBtn.classList.remove('button-primary');
                        requestBtn.classList.add('button-success');
                        
                        if (window.app && window.app.sensorManager) {
                            setTimeout(() => window.app.sensorManager.checkPermissions(), 500);
                        }
                    } else {
                        requestBtn.innerHTML = '<span class="material-icons">error</span>Permission Denied';
                        requestBtn.classList.remove('button-primary');
                        requestBtn.classList.add('button-danger');
                        requestBtn.disabled = false;
                    }
                }
                
                if ('geolocation' in navigator) {
                    navigator.geolocation.getCurrentPosition(
                        () => console.log('GPS permission granted'),
                        () => console.log('GPS permission denied'),
                        { enableHighAccuracy: true, timeout: 5000 }
                    );
                }
                
            } catch (error) {
                console.error('Permission request failed:', error);
                requestBtn.innerHTML = '<span class="material-icons">error</span>Request Failed';
                requestBtn.classList.remove('button-primary');
                requestBtn.classList.add('button-danger');
                requestBtn.disabled = false;
            }
        });
    }
});