// ============================================
// material3-tabs.js - Material 3 Tab Navigation
// ============================================

class MaterialTabs {
    constructor() {
        this.activeTab = 'permissions';
        this.tabButtons = [];
        this.tabPanels = [];
        this.fab = null;
        this.isRecording = false;
        
        this.init();
    }
    
    init() {
        this.setupTabNavigation();
        this.setupKeyboardNavigation();
        this.setupSensorVisualizations();
        this.startPerformanceUpdates();
        
        console.log('✅ Material3 Tabs initialized');
    }
    
    startPerformanceUpdates() {
        // Update performance metrics regularly
        this.performanceUpdateInterval = setInterval(() => {
            if (this.activeTab === 'performance') {
                this.updatePerformanceMetrics();
            }
        }, 500); // Update every 500ms when on performance tab
    }
    
    setupTabNavigation() {
        this.tabButtons = document.querySelectorAll('.tab-button');
        this.tabPanels = document.querySelectorAll('.tab-panel');
        
        this.tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const tabId = e.currentTarget.dataset.tab;
                this.switchTab(tabId);
            });
        });
    }
    
    switchTab(tabId) {
        // Update active states
        this.tabButtons.forEach(button => {
            const isActive = button.dataset.tab === tabId;
            button.classList.toggle('active', isActive);
            button.setAttribute('aria-selected', isActive);
        });
        
        this.tabPanels.forEach(panel => {
            const isActive = panel.id === `${tabId}-panel`;
            panel.classList.toggle('active', isActive);
        });
        
        this.activeTab = tabId;
        
        // Trigger tab-specific updates
        this.handleTabSwitch(tabId);
    }
    
    handleTabSwitch(tabId) {
        switch(tabId) {
            case 'permissions':
                this.updatePermissionsTab();
                break;
            case 'performance':
                this.updatePerformanceTab();
                break;
            case 'sensors':
                this.updateSensorsTab();
                break;
            case 'data':
                this.updateDataTab();
                break;
        }
    }
    
    updatePermissionsTab() {
        // Update permission statuses if app is available
        if (window.app && window.app.sensorManager) {
            // Trigger permission check
            window.app.sensorManager.checkPermissions();
        }
    }
    
    updatePerformanceTab() {
        // Update performance metrics display
        this.updatePerformanceMetrics();
    }
    
    updateSensorsTab() {
        // Start sensor data updates if we're on this tab
        if (window.app && window.app.sensorManager) {
            this.startSensorDataUpdates();
        }
    }
    
    updateDataTab() {
        // Update data overview and recordings list
        this.updateDataOverview();
        this.updateRecordingsList();
    }
    
    
    
    
    
    setRecordingState(recording) {
        this.isRecording = recording;

        // Update recording indicator in header
        const indicator = document.getElementById('recording-indicator');
        if (indicator) {
            indicator.style.display = recording ? 'flex' : 'none';
        }
    }
    
    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            // Handle tab switching with arrow keys
            if (e.target.classList.contains('tab-button')) {
                const currentIndex = Array.from(this.tabButtons).indexOf(e.target);
                let newIndex;
                
                switch(e.key) {
                    case 'ArrowLeft':
                        newIndex = currentIndex > 0 ? currentIndex - 1 : this.tabButtons.length - 1;
                        break;
                    case 'ArrowRight':
                        newIndex = currentIndex < this.tabButtons.length - 1 ? currentIndex + 1 : 0;
                        break;
                    case 'Home':
                        newIndex = 0;
                        break;
                    case 'End':
                        newIndex = this.tabButtons.length - 1;
                        break;
                    default:
                        return;
                }
                
                e.preventDefault();
                this.tabButtons[newIndex].focus();
                this.switchTab(this.tabButtons[newIndex].dataset.tab);
            }
            
        });
    }
    
    setupSensorVisualizations() {
        // Initialize sensor data tracking
        this.sensorUpdateCount = 0;
        this.lastSensorUpdateTime = null;
        
        // Set up device orientation listener
        this.setupDeviceOrientation();
        
        // Initialize performance chart
        this.initPerformanceChart();
    }
    
    setupDeviceOrientation() {
        if (typeof DeviceOrientationEvent !== 'undefined') {
            window.addEventListener('deviceorientation', (event) => {
                if (this.activeTab === 'sensors') {
                    const { alpha, beta, gamma } = event;
                    this.updateElement('orientation-compass', alpha ? `${alpha.toFixed(1)}°` : '--°');
                    this.updateElement('orientation-beta', beta ? `${beta.toFixed(1)}°` : '--°');
                    this.updateElement('orientation-gamma', gamma ? `${gamma.toFixed(1)}°` : '--°');
                }
            });
        }
    }
    
    updateSensorData(sensorData) {
        if (this.activeTab !== 'sensors') return;
        
        // Track sensor updates
        this.sensorUpdateCount++;
        const now = Date.now();
        
        // Update accelerometer data
        if (sensorData.acceleration) {
            const { x, y, z } = sensorData.acceleration;
            this.updateElement('accel-x', x?.toFixed(2) || '0.00');
            this.updateElement('accel-y', y?.toFixed(2) || '0.00');
            this.updateElement('accel-z', z?.toFixed(2) || '0.00');
            
            // Calculate and display magnitude
            if (x !== null && y !== null && z !== null) {
                const magnitude = Math.sqrt(x*x + y*y + z*z);
                this.updateElement('accel-magnitude', magnitude.toFixed(2));
            }
        }
        
        // Update gyroscope data
        if (sensorData.rotationRate) {
            const { alpha, beta, gamma } = sensorData.rotationRate;
            this.updateElement('gyro-alpha', alpha?.toFixed(2) || '0.00');
            this.updateElement('gyro-beta', beta?.toFixed(2) || '0.00');
            this.updateElement('gyro-gamma', gamma?.toFixed(2) || '0.00');
        }
        
        
        // Update GPS data
        if (sensorData.position) {
            const { latitude, longitude, altitude, accuracy } = sensorData.position;
            this.updateElement('gps-lat', latitude?.toFixed(6) || '--');
            this.updateElement('gps-lon', longitude?.toFixed(6) || '--');
            this.updateElement('gps-altitude', altitude ? `${altitude.toFixed(1)} m` : '-- m');
            this.updateElement('gps-accuracy', accuracy ? `${accuracy.toFixed(1)} m` : '-- m');
        }
        
        // Update sensor status
        this.updateElement('live-data-count', this.sensorUpdateCount);
        this.updateElement('last-sensor-update', new Date().toLocaleTimeString());
        
        // Calculate and update sample rate
        if (!this.sampleRateBuffer) {
            this.sampleRateBuffer = [];
        }
        
        if (this.lastSensorUpdateTime) {
            const timeSinceLastUpdate = now - this.lastSensorUpdateTime;
            if (timeSinceLastUpdate > 0 && timeSinceLastUpdate < 1000) { // Only calculate if reasonable time difference
                const instantRate = 1000 / timeSinceLastUpdate;
                this.sampleRateBuffer.push(instantRate);
                
                // Keep only last 10 samples
                if (this.sampleRateBuffer.length > 10) {
                    this.sampleRateBuffer.shift();
                }
                
                // Calculate average
                if (this.sampleRateBuffer.length > 2) {
                    const avgRate = this.sampleRateBuffer.reduce((a, b) => a + b, 0) / this.sampleRateBuffer.length;
                    this.updateElement('live-sample-rate', `${avgRate.toFixed(1)} Hz`);
                }
            }
        }
        
        // Update timestamp for next calculation
        this.lastSensorUpdateTime = now;
        
        // Update performance chart if on performance tab
        if (this.activeTab === 'performance' && this.sampleRateBuffer && this.sampleRateBuffer.length > 0) {
            const avgRate = this.sampleRateBuffer.reduce((a, b) => a + b, 0) / this.sampleRateBuffer.length;
            this.updatePerformanceChart(avgRate);
        }
    }
    
    initPerformanceChart() {
        this.chartData = [];
        this.maxChartPoints = 50; // Keep last 50 data points
        this.chartInitialized = false;
    }
    
    updatePerformanceChart(sampleRate) {
        const chartContainer = document.getElementById('performance-monitor');
        if (!chartContainer) return;
        
        // Initialize chart if not done yet
        if (!this.chartInitialized) {
            this.setupChart(chartContainer);
            this.chartInitialized = true;
        }
        
        // Add new data point
        const now = Date.now();
        this.chartData.push({
            time: now,
            rate: sampleRate || 0
        });
        
        // Keep only the last N points
        if (this.chartData.length > this.maxChartPoints) {
            this.chartData.shift();
        }
        
        // Redraw chart
        this.drawChart();
    }
    
    setupChart(container) {
        container.innerHTML = `
            <div class="chart-header">
                <span class="chart-title">Sample Rate (Hz)</span>
                <span class="chart-current" id="chart-current">0.0 Hz</span>
            </div>
            <svg class="performance-chart-svg" id="performance-svg" width="100%" height="160" viewBox="0 0 400 160">
                <defs>
                    <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" style="stop-color:var(--md-sys-color-primary);stop-opacity:0.8" />
                        <stop offset="100%" style="stop-color:var(--md-sys-color-primary);stop-opacity:0.1" />
                    </linearGradient>
                </defs>
                <!-- Grid lines -->
                <g class="grid-lines">
                    <line x1="0" y1="40" x2="400" y2="40" stroke="var(--md-sys-color-outline-variant)" stroke-width="1" stroke-dasharray="2,2"/>
                    <line x1="0" y1="80" x2="400" y2="80" stroke="var(--md-sys-color-outline-variant)" stroke-width="1" stroke-dasharray="2,2"/>
                    <line x1="0" y1="120" x2="400" y2="120" stroke="var(--md-sys-color-outline-variant)" stroke-width="1" stroke-dasharray="2,2"/>
                </g>
                <!-- Chart area -->
                <path id="chart-area" fill="url(#chartGradient)" stroke="none"/>
                <path id="chart-line" fill="none" stroke="var(--md-sys-color-primary)" stroke-width="2"/>
                <!-- Y-axis labels -->
                <text x="5" y="15" fill="var(--md-sys-color-on-surface-variant)" font-size="10">140</text>
                <text x="5" y="45" fill="var(--md-sys-color-on-surface-variant)" font-size="10">100</text>
                <text x="5" y="85" fill="var(--md-sys-color-on-surface-variant)" font-size="10">60</text>
                <text x="5" y="125" fill="var(--md-sys-color-on-surface-variant)" font-size="10">20</text>
            </svg>
        `;
    }
    
    drawChart() {
        const svg = document.getElementById('performance-svg');
        const chartLine = document.getElementById('chart-line');
        const chartArea = document.getElementById('chart-area');
        const currentDisplay = document.getElementById('chart-current');
        
        if (!svg || !chartLine || !chartArea || this.chartData.length < 2) return;
        
        const width = 400;
        const height = 160;
        const padding = 20;
        const chartWidth = width - padding * 2;
        const chartHeight = height - padding;
        
        // Scale for sample rate (0-140 Hz)
        const maxRate = 140;
        const minRate = 0;
        
        // Generate path data
        let pathData = '';
        let areaData = '';
        
        this.chartData.forEach((point, index) => {
            const x = padding + (index / (this.maxChartPoints - 1)) * chartWidth;
            const y = height - padding - ((point.rate - minRate) / (maxRate - minRate)) * chartHeight;
            
            if (index === 0) {
                pathData = `M ${x} ${y}`;
                areaData = `M ${x} ${height - padding} L ${x} ${y}`;
            } else {
                pathData += ` L ${x} ${y}`;
                areaData += ` L ${x} ${y}`;
            }
        });
        
        // Close area path
        if (this.chartData.length > 0) {
            const lastIndex = this.chartData.length - 1;
            const lastX = padding + (lastIndex / (this.maxChartPoints - 1)) * chartWidth;
            areaData += ` L ${lastX} ${height - padding} Z`;
        }
        
        // Update SVG paths
        chartLine.setAttribute('d', pathData);
        chartArea.setAttribute('d', areaData);
        
        // Update current rate display
        if (currentDisplay && this.chartData.length > 0) {
            const currentRate = this.chartData[this.chartData.length - 1].rate;
            currentDisplay.textContent = `${currentRate.toFixed(1)} Hz`;
        }
    }
    
    
    updatePerformanceMetrics() {
        if (this.activeTab !== 'performance') return;
        
        // Get current sample rate from the live sensor data
        let currentSampleRate = 0;
        if (this.sampleRateBuffer && this.sampleRateBuffer.length > 0) {
            currentSampleRate = this.sampleRateBuffer.reduce((a, b) => a + b, 0) / this.sampleRateBuffer.length;
        }
        
        // Get performance data from the app
        if (window.app && window.app.workerManager) {
            const stats = window.app.workerManager.getStats?.() || {};
            console.log('📊 Material Tabs - Current stats:', stats);

            this.updateElement('data-count', stats.totalPoints || 0);
            this.updateElement('buffer-size', stats.bufferSize || 0);
            
            // Use current sample rate if available, otherwise use stats
            const displayRate = currentSampleRate > 0 ? currentSampleRate : (stats.averageHz || 0);
            this.updateElement('sample-rate', `${displayRate.toFixed(1)} Hz`);
            
            // Update rate bar
            const rateBar = document.getElementById('rate-bar');
            const targetRate = window.MotionRecorderConfig?.sensors?.targetRate || 140;
            const percentage = Math.min(displayRate / targetRate * 100, 100);
            
            if (rateBar) {
                rateBar.style.width = `${percentage}%`;
            }
            
            // Update performance chart
            this.updatePerformanceChart(displayRate);
        }
        
        // Update memory usage
        if (performance.memory) {
            const memoryMB = (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(1);
            this.updateElement('memory-usage', `${memoryMB} MB`);
        }
        
        // Update battery level
        if (navigator.getBattery) {
            navigator.getBattery().then(battery => {
                this.updateElement('battery-level', `${Math.round(battery.level * 100)}%`);
            }).catch(() => {
                this.updateElement('battery-level', 'N/A');
            });
        }
        
        // Update recording time
        if (this.isRecording && window.app?.startTime) {
            const elapsed = (Date.now() - new Date(window.app.startTime)) / 1000;
            const minutes = Math.floor(elapsed / 60);
            const seconds = Math.floor(elapsed % 60);
            this.updateElement('recording-time', `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        } else {
            this.updateElement('recording-time', '00:00');
        }
    }
    
    async updateDataOverview() {
        if (this.activeTab !== 'data') return;
        
        try {
            // Update total recordings
            if (window.app && window.app.databaseManager) {
                const userId = window.app.userManager?.getUserId();
                const recordings = await window.app.databaseManager.getRecordings(userId);
                this.updateElement('total-recordings', recordings?.length || 0);
                
                // Update user ID
                this.updateElement('user-id', userId || 'Unknown');
                
                // Calculate storage usage (rough estimate)
                let totalDataPoints = 0;
                for (const recording of recordings || []) {
                    totalDataPoints += recording.dataPointCount || 0;
                }
                
                // Estimate ~100 bytes per data point
                const storageMB = (totalDataPoints * 100 / 1024 / 1024).toFixed(1);
                this.updateElement('storage-used', `${storageMB} MB`);
            }
        } catch (error) {
            console.error('Failed to update data overview:', error);
        }
    }
    
    async updateRecordingsList() {
        if (this.activeTab !== 'data') return;
        
        const container = document.querySelector('.recordings-container');
        if (!container) return;
        
        try {
            if (window.app && window.app.databaseManager) {
                const userId = window.app.userManager?.getUserId();
                const recordings = await window.app.databaseManager.getRecordings(userId);
                
                if (recordings && recordings.length > 0) {
                    // Show recent recordings (limit to 5)
                    const recentRecordings = recordings.slice(0, 5);
                    
                    container.innerHTML = recentRecordings.map(recording => `
                        <div class="recording-item" style="
                            display: flex;
                            justify-content: space-between;
                            align-items: center;
                            padding: 12px;
                            border: 1px solid var(--md-sys-color-outline-variant);
                            border-radius: 8px;
                            margin-bottom: 8px;
                        ">
                            <div>
                                <div style="font-weight: 500; margin-bottom: 4px;">
                                    ${new Date(recording.timestamp).toLocaleDateString()} 
                                    ${new Date(recording.timestamp).toLocaleTimeString()}
                                </div>
                                <div style="font-size: 12px; color: var(--md-sys-color-on-surface-variant);">
                                    ${recording.dataPointCount || 0} data points • ${(recording.averageHz || 0).toFixed(1)} Hz
                                </div>
                            </div>
                            <div style="
                                padding: 4px 8px;
                                border-radius: 12px;
                                font-size: 12px;
                                background-color: var(--md-sys-color-success-container);
                                color: var(--md-sys-color-on-success-container);
                            ">
                                ${recording.status || 'completed'}
                            </div>
                        </div>
                    `).join('');
                } else {
                    container.innerHTML = `
                        <div class="empty-state">
                            <span class="material-icons">folder_open</span>
                            <p>No recordings yet. Start recording to see your data here.</p>
                        </div>
                    `;
                }
            }
        } catch (error) {
            console.error('Failed to update recordings list:', error);
            container.innerHTML = `
                <div class="empty-state">
                    <span class="material-icons">error</span>
                    <p>Failed to load recordings.</p>
                </div>
            `;
        }
    }
    
    startSensorDataUpdates() {
        // This will be called by the sensor manager to update the UI
        if (window.app && window.app.sensorManager) {
            // The sensor manager should call materialTabs.updateSensorData() with new data
        }
    }
    
    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }
    
    showLoadingState(message = 'Processing...') {
        const overlay = document.getElementById('loading-overlay');
        const text = document.getElementById('loading-text');
        
        if (overlay) {
            overlay.style.display = 'flex';
        }
        
        if (text) {
            text.textContent = message;
        }
    }
    
    hideLoadingState() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
    
    showNotification(message, type = 'info', duration = 8000) {
        const container = document.getElementById('notification-container');
        if (!container) return;
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <span class="material-icons">
                    ${type === 'error' ? 'error' : type === 'success' ? 'check_circle' : 'info'}
                </span>
                <span class="notification-text">${message}</span>
            </div>
            <button class="notification-close" aria-label="Close notification">
                <span class="material-icons">close</span>
            </button>
        `;
        
        // Add notification styles
        notification.style.cssText = `
            background: var(--md-sys-color-surface);
            border: 1px solid var(--md-sys-color-outline-variant);
            border-radius: 12px;
            padding: 16px;
            box-shadow: var(--md-sys-elevation-3);
            display: flex;
            align-items: center;
            justify-content: space-between;
            max-width: 400px;
            animation: slideIn 0.3s ease;
        `;
        
        const closeBtn = notification.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            notification.remove();
        });
        
        container.appendChild(notification);
        
        if (duration > 0) {
            // Extend duration for error and warning notifications
            let adjustedDuration = duration;
            if (type === 'error' || type === 'warning') {
                adjustedDuration = Math.max(duration, 10000); // At least 10 seconds for errors/warnings
            }

            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, adjustedDuration);
        }
    }
    
    // Cleanup method
    destroy() {
        if (this.performanceUpdateInterval) {
            clearInterval(this.performanceUpdateInterval);
        }
    }
    
    // Public API for external components
    getActiveTab() {
        return this.activeTab;
    }
    
    isRecordingActive() {
        return this.isRecording;
    }
}

// Initialize tabs when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.materialTabs = new MaterialTabs();
});

// Add notification animation styles
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
    }
    
    .notification-text {
        color: var(--md-sys-color-on-surface);
        font-size: 14px;
    }
    
    .notification-close {
        background: none;
        border: none;
        cursor: pointer;
        color: var(--md-sys-color-on-surface-variant);
        padding: 4px;
        border-radius: 4px;
    }
    
    .notification-close:hover {
        background-color: var(--md-sys-color-surface-variant);
    }
`;
document.head.appendChild(style);