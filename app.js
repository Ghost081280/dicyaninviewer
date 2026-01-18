/**
 * Dicyanin Viewer - Authentic Kilner Screen Replication
 * 
 * Based on Dr. Walter J. Kilner's 1911 research "The Human Atmosphere"
 * 
 * The authentic dicyanin filter characteristics:
 * - Dicyanin is a dark blue coal-tar dye used for infrared sensitization
 * - Blocks longer wavelengths (red >600nm, orange, yellow)
 * - Transmits shorter wavelengths (blue 450-500nm, violet 380-450nm)
 * - Very dark overall - Kilner noted it was hard on the eyes
 * - Creates conditions where edge contrast artifacts appear as "auras"
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
        this.facingMode = 'environment';
        this.intensity = 0.85; // Higher default for more authentic look
        this.isProcessing = false;
        this.animationId = null;
        this.filterEnabled = true;
        
        // App URL for sharing
        this.appUrl = window.location.href;
        
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
        this.shareBtn.addEventListener('click', () => this.shareToX());
        
        this.closeModalBtn.addEventListener('click', () => this.closeModal());
        this.downloadBtn.addEventListener('click', () => this.downloadImage());
        this.shareCaptureBtn.addEventListener('click', () => this.shareImageToX());
        
        this.retryBtn.addEventListener('click', () => this.startCamera());
        
        // Tap canvas to toggle filter
        this.canvas.addEventListener('click', () => this.toggleFilter());
        
        // Close modal on backdrop click
        this.captureModal.addEventListener('click', (e) => {
            if (e.target === this.captureModal) this.closeModal();
        });
    }
    
    async startCamera() {
        try {
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
     * AUTHENTIC KILNER DICYANIN FILTER
     * 
     * Replicating the actual optical properties of dicyanin dye:
     * 
     * 1. SPECTRAL ABSORPTION - Dicyanin heavily absorbs:
     *    - Red (600-700nm): ~95% absorption
     *    - Orange (590-620nm): ~90% absorption  
     *    - Yellow (570-590nm): ~85% absorption
     *    - Green (520-570nm): ~60% absorption
     *    - Passes blue/violet (380-500nm)
     * 
     * 2. DARKNESS - Original screens were very dark, Kilner noted
     *    prolonged viewing "had a very deleterious effect upon our eyes"
     * 
     * 3. EDGE ENHANCEMENT - The "aura" effect is partially from
     *    increased contrast at luminance boundaries
     * 
     * 4. VIOLET SHIFT - Dicyanin shifts perception toward violet
     */
    applyDicyaninFilter(imageData) {
        const data = imageData.data;
        const intensity = this.intensity;
        const width = imageData.width;
        const height = imageData.height;
        
        // Authentic dicyanin spectral coefficients
        // Based on coal-tar dye absorption spectrum
        const redAbsorption = 0.05;      // 95% red blocked
        const greenAbsorption = 0.20;    // 80% green blocked
        const blueTransmission = 0.95;   // Blue passes through
        const violetBoost = 0.12;        // Violet shift from red remnants
        
        // Overall darkness factor (dicyanin was VERY dark)
        const darknessFactor = 0.7;
        
        // Contrast enhancement for edge visibility
        const contrastBoost = 1.15;
        const contrastMidpoint = 128;
        
        for (let i = 0; i < data.length; i += 4) {
            let r = data[i];
            let g = data[i + 1];
            let b = data[i + 2];
            
            // Apply spectral absorption (authentic dicyanin)
            let filteredR = r * redAbsorption;
            let filteredG = g * greenAbsorption;
            let filteredB = b * blueTransmission + (r * violetBoost);
            
            // Apply darkness factor
            filteredR *= darknessFactor;
            filteredG *= darknessFactor;
            filteredB *= darknessFactor;
            
            // Apply contrast enhancement (makes edges more visible - "aura" effect)
            filteredR = ((filteredR - contrastMidpoint) * contrastBoost) + contrastMidpoint;
            filteredG = ((filteredG - contrastMidpoint) * contrastBoost) + contrastMidpoint;
            filteredB = ((filteredB - contrastMidpoint) * contrastBoost) + contrastMidpoint;
            
            // Blend with original based on intensity
            data[i] = Math.max(0, Math.min(255, r * (1 - intensity) + filteredR * intensity));
            data[i + 1] = Math.max(0, Math.min(255, g * (1 - intensity) + filteredG * intensity));
            data[i + 2] = Math.max(0, Math.min(255, b * (1 - intensity) + filteredB * intensity));
        }
        
        return imageData;
    }
    
    processFrame() {
        if (!this.isProcessing) return;
        
        this.ctx.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
        
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
            badge.innerHTML = '<span class="badge-dot" style="background: var(--danger); box-shadow: 0 0 8px var(--danger);"></span>FILTER DISABLED';
        }
    }
    
    async flipCamera() {
        this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
        await this.startCamera();
    }
    
    captureImage() {
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
        
        // Top watermark bar
        const topBarHeight = Math.max(60, height * 0.06);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, 0, width, topBarHeight);
        
        // Top border glow
        const topGradient = ctx.createLinearGradient(0, topBarHeight - 2, 0, topBarHeight);
        topGradient.addColorStop(0, 'rgba(74, 58, 255, 0.8)');
        topGradient.addColorStop(1, 'rgba(74, 58, 255, 0)');
        ctx.fillStyle = topGradient;
        ctx.fillRect(0, topBarHeight - 2, width, 4);
        
        // "DICYANIN FILTER ACTIVATED" text
        const fontSize = Math.max(16, width / 30);
        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Glowing text effect
        ctx.shadowColor = 'rgba(74, 58, 255, 0.8)';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#8b7aff';
        ctx.fillText('DICYANIN FILTER ACTIVATED', width / 2, topBarHeight / 2);
        
        // Reset shadow
        ctx.shadowBlur = 0;
        
        // Bottom watermark bar
        const bottomBarHeight = Math.max(50, height * 0.05);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.fillRect(0, height - bottomBarHeight, width, bottomBarHeight);
        
        // Bottom border glow
        const bottomGradient = ctx.createLinearGradient(0, height - bottomBarHeight, 0, height - bottomBarHeight + 2);
        bottomGradient.addColorStop(0, 'rgba(74, 58, 255, 0)');
        bottomGradient.addColorStop(1, 'rgba(74, 58, 255, 0.8)');
        ctx.fillStyle = bottomGradient;
        ctx.fillRect(0, height - bottomBarHeight - 2, width, 4);
        
        // Status indicator dot
        const dotSize = Math.max(8, width / 100);
        const dotX = width / 2 - ctx.measureText('dicyaninviewer.com').width / 2 - dotSize * 2;
        ctx.beginPath();
        ctx.arc(dotX, height - bottomBarHeight / 2, dotSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = '#10b981';
        ctx.shadowColor = '#10b981';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Website/branding
        const smallFontSize = Math.max(12, width / 45);
        ctx.font = `600 ${smallFontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.textAlign = 'center';
        ctx.fillText('dicyaninviewer.com', width / 2, height - bottomBarHeight / 2);
    }
    
    closeModal() {
        this.captureModal.classList.add('hidden');
    }
    
    async downloadImage() {
        try {
            const blob = await new Promise(resolve => {
                this.captureCanvas.toBlob(resolve, 'image/png');
            });
            
            const file = new File([blob], `dicyanin-scan-${Date.now()}.png`, { type: 'image/png' });
            
            // On mobile, use share sheet which allows "Save Image" to camera roll
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file]
                });
            } else {
                // Desktop fallback - regular download
                const link = document.createElement('a');
                link.download = file.name;
                link.href = URL.createObjectURL(blob);
                link.click();
                URL.revokeObjectURL(link.href);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                // Final fallback
                const link = document.createElement('a');
                link.download = `dicyanin-scan-${Date.now()}.png`;
                link.href = this.captureCanvas.toDataURL('image/png');
                link.click();
            }
        }
    }
    
    /**
     * Share app link directly to X (Twitter)
     */
    shareToX() {
        const text = "See what others can't. The legendary Kilner dicyanin filter - what will you see?";
        const url = this.appUrl;
        const xShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
        window.open(xShareUrl, '_blank', 'width=550,height=420');
    }
    
    /**
     * Share captured image to X
     * Since we can't directly upload images to X via intent,
     * we save the image and prompt user to share
     */
    async shareImageToX() {
        try {
            // Try Web Share API first (works on mobile)
            const blob = await new Promise(resolve => {
                this.captureCanvas.toBlob(resolve, 'image/png');
            });
            
            const file = new File([blob], 'dicyanin-scan.png', { type: 'image/png' });
            
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Dicyanin Filter Scan',
                    text: 'DICYANIN FILTER ACTIVATED - See what others cannot. What do you see?'
                });
            } else {
                // Fallback: Download image and open X with pre-filled text
                this.downloadImage();
                
                const text = "DICYANIN FILTER ACTIVATED - See what others cannot. What do you see?";
                const url = this.appUrl;
                const xShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
                
                // Small delay to let download start
                setTimeout(() => {
                    window.open(xShareUrl, '_blank', 'width=550,height=420');
                }, 500);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Share error:', error);
                // Fallback to just download
                this.downloadImage();
            }
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new DicyaninViewer();
});
