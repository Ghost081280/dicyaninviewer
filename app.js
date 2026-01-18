/**
 * Dicyanin Viewer
 * Authentic spectral filter replication based on Walter Kilner's dicyanin dye research
 * 
 * The filter characteristics:
 * - Heavy absorption of longer wavelengths (red, orange, yellow) - blocks >550nm
 * - Strong transmission of shorter wavelengths (blue, violet) - passes 400-500nm
 * - Creates the deep blue/violet tint that Kilner documented
 */

class DicyaninViewer {
    constructor() {
        // DOM Elements
        this.video = document.getElementById('video');
        this.canvas = document.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        
        this.loadingScreen = document.getElementById('loading-screen');
        this.viewer = document.getElementById('viewer');
        this.errorScreen = document.getElementById('error-screen');
        
        this.intensitySlider = document.getElementById('intensity');
        this.intensityValue = document.getElementById('intensity-value');
        this.flipBtn = document.getElementById('flip-btn');
        this.captureBtn = document.getElementById('capture-btn');
        this.shareBtn = document.getElementById('share-btn');
        
        this.captureModal = document.getElementById('capture-modal');
        this.captureCanvas = document.getElementById('capture-canvas');
        this.captureCtx = this.captureCanvas.getContext('2d');
        this.closeModalBtn = document.getElementById('close-modal');
        this.downloadBtn = document.getElementById('download-btn');
        this.shareCaptureBtn = document.getElementById('share-capture-btn');
        
        this.retryBtn = document.getElementById('retry-btn');
        this.topBar = document.getElementById('top-bar');
        this.infoBadge = this.topBar.querySelector('.info-badge');
        
        // State
        this.stream = null;
        this.facingMode = 'environment'; // Start with rear camera
        this.intensity = 0.75;
        this.isProcessing = false;
        this.animationId = null;
        this.filterEnabled = true;
        
        // Bind methods
        this.processFrame = this.processFrame.bind(this);
        this.handleResize = this.handleResize.bind(this);
        
        // Initialize
        this.init();
    }
    
    async init() {
        this.bindEvents();
        await this.startCamera();
        window.addEventListener('resize', this.handleResize);
    }
    
    bindEvents() {
        this.intensitySlider.addEventListener('input', (e) => {
            this.intensity = e.target.value / 100;
            this.intensityValue.textContent = `${e.target.value}%`;
        });
        
        this.flipBtn.addEventListener('click', () => this.flipCamera());
        this.captureBtn.addEventListener('click', () => this.captureImage());
        this.shareBtn.addEventListener('click', () => this.shareApp());
        
        this.closeModalBtn.addEventListener('click', () => this.closeModal());
        this.downloadBtn.addEventListener('click', () => this.downloadImage());
        this.shareCaptureBtn.addEventListener('click', () => this.shareImage());
        
        this.retryBtn.addEventListener('click', () => this.startCamera());
        
        // Tap canvas to toggle filter (for comparison)
        this.canvas.addEventListener('click', () => this.toggleFilter());
        
        // Close modal on backdrop click
        this.captureModal.addEventListener('click', (e) => {
            if (e.target === this.captureModal) this.closeModal();
        });
    }
    
    async startCamera() {
        try {
            // Stop any existing stream
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
            }
            
            const constraints = {
                video: {
                    facingMode: this.facingMode,
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            };
            
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            
            this.video.onloadedmetadata = () => {
                this.video.play();
                this.handleResize();
                this.showViewer();
                this.startProcessing();
            };
            
        } catch (error) {
            console.error('Camera error:', error);
            this.showError();
        }
    }
    
    handleResize() {
        // Match canvas to video dimensions while maintaining aspect ratio
        const videoAspect = this.video.videoWidth / this.video.videoHeight;
        const windowAspect = window.innerWidth / window.innerHeight;
        
        if (windowAspect > videoAspect) {
            // Window is wider - fit to height
            this.canvas.height = window.innerHeight;
            this.canvas.width = window.innerHeight * videoAspect;
        } else {
            // Window is taller - fit to width
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerWidth / videoAspect;
        }
        
        // For processing, use actual video dimensions
        this.canvas.width = this.video.videoWidth || 1280;
        this.canvas.height = this.video.videoHeight || 720;
    }
    
    showViewer() {
        this.loadingScreen.classList.add('hidden');
        this.errorScreen.classList.add('hidden');
        this.viewer.classList.remove('hidden');
    }
    
    showError() {
        this.loadingScreen.classList.add('hidden');
        this.viewer.classList.add('hidden');
        this.errorScreen.classList.remove('hidden');
    }
    
    startProcessing() {
        if (this.isProcessing) return;
        this.isProcessing = true;
        this.processFrame();
    }
    
    stopProcessing() {
        this.isProcessing = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
    }
    
    /**
     * Apply authentic dicyanin filter
     * Based on Kilner's documentation:
     * - Dicyanin is a deep blue dye that blocks longer wavelengths
     * - Transmits primarily in the 400-500nm range (blue-violet)
     * - Creates a characteristic blue-violet tint
     * 
     * Color transformation approach:
     * - Heavily attenuate red channel (blocks wavelengths > 600nm)
     * - Moderately attenuate green channel (blocks 500-600nm partially)
     * - Preserve/enhance blue channel (passes 400-500nm)
     * - Add slight violet shift (some red mixed back into blue perception)
     */
    applyDicyaninFilter(imageData) {
        const data = imageData.data;
        const intensity = this.intensity;
        
        // Dicyanin spectral transmission coefficients
        // These approximate the dye's absorption curve
        const redMultiplier = 0.08;      // Heavy red absorption
        const greenMultiplier = 0.25;    // Moderate green absorption  
        const blueMultiplier = 1.0;      // Full blue transmission
        const violetShift = 0.15;        // Slight red->blue shift for violet tint
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Apply dicyanin spectral filtering
            let newR = r * redMultiplier;
            let newG = g * greenMultiplier;
            let newB = b * blueMultiplier + (r * violetShift); // Violet shift
            
            // Blend with original based on intensity
            data[i] = Math.min(255, r * (1 - intensity) + newR * intensity);
            data[i + 1] = Math.min(255, g * (1 - intensity) + newG * intensity);
            data[i + 2] = Math.min(255, b * (1 - intensity) + newB * intensity);
            // Alpha channel (data[i + 3]) stays unchanged
        }
        
        return imageData;
    }
    
    processFrame() {
        if (!this.isProcessing) return;
        
        // Draw video frame to canvas
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        
        // Apply filter if enabled
        if (this.filterEnabled && this.intensity > 0) {
            const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
            const filtered = this.applyDicyaninFilter(imageData);
            this.ctx.putImageData(filtered, 0, 0);
        }
        
        this.animationId = requestAnimationFrame(this.processFrame);
    }
    
    toggleFilter() {
        this.filterEnabled = !this.filterEnabled;
        const indicator = document.getElementById('filter-off-indicator');
        const badge = this.infoBadge;
        
        if (this.filterEnabled) {
            indicator.classList.add('hidden');
            badge.innerHTML = '<span class="badge-dot"></span>DICYANIN FILTER ACTIVE';
        } else {
            indicator.classList.remove('hidden');
            badge.innerHTML = '<span class="badge-dot" style="background: var(--danger)"></span>FILTER DISABLED';
        }
    }
    
    async flipCamera() {
        this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
        await this.startCamera();
    }
    
    captureImage() {
        // Set capture canvas to match main canvas
        this.captureCanvas.width = this.canvas.width;
        this.captureCanvas.height = this.canvas.height;
        
        // Copy current frame
        this.captureCtx.drawImage(this.canvas, 0, 0);
        
        // Add watermark
        this.addWatermark();
        
        // Show modal
        this.captureModal.classList.remove('hidden');
    }
    
    addWatermark() {
        const ctx = this.captureCtx;
        const width = this.captureCanvas.width;
        const height = this.captureCanvas.height;
        
        // Semi-transparent overlay at bottom
        const gradient = ctx.createLinearGradient(0, height - 80, 0, height);
        gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, height - 80, width, 80);
        
        // Watermark text
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.font = `${Math.max(14, width / 40)}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText('Captured with Dicyanin Viewer 👁', width / 2, height - 25);
    }
    
    closeModal() {
        this.captureModal.classList.add('hidden');
    }
    
    downloadImage() {
        const link = document.createElement('a');
        link.download = `dicyanin-capture-${Date.now()}.png`;
        link.href = this.captureCanvas.toDataURL('image/png');
        link.click();
    }
    
    async shareImage() {
        try {
            // Convert canvas to blob
            const blob = await new Promise(resolve => {
                this.captureCanvas.toBlob(resolve, 'image/png');
            });
            
            const file = new File([blob], 'dicyanin-capture.png', { type: 'image/png' });
            
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Dicyanin Viewer Capture',
                    text: 'Check out what I captured with Dicyanin Viewer! 👁✨'
                });
            } else if (navigator.share) {
                // Fallback to sharing just text/url if file sharing not supported
                await navigator.share({
                    title: 'Dicyanin Viewer Capture',
                    text: 'Check out Dicyanin Viewer - see the world through the legendary Kilner screen filter! 👁✨',
                    url: window.location.href
                });
            } else {
                // Fallback - download instead
                this.downloadImage();
                alert('Image saved! Share it manually from your gallery.');
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Share error:', error);
                this.downloadImage();
            }
        }
    }
    
    async shareApp() {
        const shareData = {
            title: 'Dicyanin Viewer',
            text: 'See the world through the legendary Kilner dicyanin filter! 👁✨ Based on Dr. Walter Kilner\'s 1911 aura research.',
            url: window.location.href
        };
        
        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                // Fallback - copy to clipboard
                await navigator.clipboard.writeText(`${shareData.text} ${shareData.url}`);
                alert('Link copied to clipboard!');
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Share error:', error);
            }
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new DicyaninViewer();
});
