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
        this.recordBtn = document.getElementById('record-btn');
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
        
        // Recording elements
        this.recordingIndicator = document.getElementById('recording-indicator');
        this.recordingTime = document.getElementById('recording-time');
        
        // Video preview modal elements
        this.videoModal = document.getElementById('video-modal');
        this.videoPreview = document.getElementById('video-preview');
        this.closeVideoModalBtn = document.getElementById('close-video-modal');
        this.downloadVideoBtn = document.getElementById('download-video-btn');
        this.shareVideoBtn = document.getElementById('share-video-btn');
        
        // State
        this.stream = null;
        this.facingMode = 'environment';
        this.intensity = 0.85;
        this.isProcessing = false;
        this.animationId = null;
        this.filterEnabled = true;
        
        // Recording state
        this.isRecording = false;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.recordingStartTime = null;
        this.recordingTimerInterval = null;
        this.maxRecordingDuration = 30000; // 30 seconds max
        this.recordedBlob = null;
        
        // Store blob URLs to prevent premature revocation
        this.currentImageBlob = null;
        this.currentVideoUrl = null;
        
        // App URL for sharing
        this.appUrl = 'https://ghost081280.github.io/dicyanin-viewer/';
        
        // Detect iOS
        this.isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        this.isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
        
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
        this.recordBtn.addEventListener('click', () => this.toggleRecording());
        this.shareBtn.addEventListener('click', () => this.shareToX());
        
        this.closeModalBtn.addEventListener('click', () => this.closeModal());
        this.downloadBtn.addEventListener('click', () => this.downloadImage());
        this.shareCaptureBtn.addEventListener('click', () => this.shareImageToX());
        
        // Video modal events
        this.closeVideoModalBtn.addEventListener('click', () => this.closeVideoModal());
        this.downloadVideoBtn.addEventListener('click', () => this.downloadVideo());
        this.shareVideoBtn.addEventListener('click', () => this.shareVideo());
        
        this.retryBtn.addEventListener('click', () => this.startCamera());
        
        // Tap canvas to toggle filter
        this.canvas.addEventListener('click', () => this.toggleFilter());
        
        // Close modals on backdrop click
        this.captureModal.addEventListener('click', (e) => {
            if (e.target === this.captureModal) this.closeModal();
        });
        this.videoModal.addEventListener('click', (e) => {
            if (e.target === this.videoModal) this.closeVideoModal();
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
     * Based on scientific testing of actual dicyanin screens:
     * Source: 1917 Bureau of Standards paper & spectral analysis
     * 
     * KEY FINDING: Dicyanin creates a GAP in the middle of the spectrum
     * "Tests on the dicyanin screens show that they almost fully cut out 
     * the light in the middle of the visible spectrum, letting through 
     * only the double image of the red and blue ends of the spectrum"
     * 
     * SPECTRAL TRANSMISSION:
     * - PASSES: Blue/Violet (380-500nm) - high transmission
     * - BLOCKS: Green (500-570nm) - almost complete absorption  
     * - BLOCKS: Yellow (570-590nm) - almost complete absorption
     * - PASSES: Deep Red/Near-IR (650-750nm+) - partial transmission
     * 
     * This creates the characteristic "double image" effect where 
     * blue and red light pass but green/yellow are eliminated,
     * producing the deep violet-purple appearance.
     * 
     * Kilner noted prolonged viewing "had a very deleterious effect 
     * upon our eyes, making them very painful" - the screens were DARK.
     */
    applyDicyaninFilter(imageData) {
        const data = imageData.data;
        const intensity = this.intensity;
        
        const redTransmission = 0.25;
        const greenTransmission = 0.05;
        const blueTransmission = 0.95;
        const darknessFactor = 0.55;
        const violetMix = 0.18;
        const contrastBoost = 1.2;
        const contrastMidpoint = 128;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            let filteredR = r * redTransmission;
            let filteredG = g * greenTransmission;
            let filteredB = (b * blueTransmission) + (r * violetMix);
            
            filteredR *= darknessFactor;
            filteredG *= darknessFactor;
            filteredB *= darknessFactor;
            
            filteredR = ((filteredR - contrastMidpoint) * contrastBoost) + contrastMidpoint;
            filteredG = ((filteredG - contrastMidpoint) * contrastBoost) + contrastMidpoint;
            filteredB = ((filteredB - contrastMidpoint) * contrastBoost) + contrastMidpoint;
            
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
        
        // Add recording watermark if recording
        if (this.isRecording) {
            this.addLiveWatermark();
        }
        
        this.animationId = requestAnimationFrame(this.processFrame);
    }
    
    /**
     * Add watermark to live canvas during recording
     */
    addLiveWatermark() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        // Top watermark bar
        const topBarHeight = Math.max(40, height * 0.045);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, width, topBarHeight);
        
        // Top border glow
        ctx.fillStyle = 'rgba(74, 58, 255, 0.6)';
        ctx.fillRect(0, topBarHeight - 2, width, 2);
        
        // "DICYANIN FILTER ACTIVATED" text
        const fontSize = Math.max(12, width / 50);
        ctx.font = `bold ${fontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#8b7aff';
        ctx.fillText('DICYANIN FILTER ACTIVATED', width / 2, topBarHeight / 2);
        
        // Bottom watermark bar
        const bottomBarHeight = Math.max(35, height * 0.04);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, height - bottomBarHeight, width, bottomBarHeight);
        
        // Bottom border glow
        ctx.fillStyle = 'rgba(74, 58, 255, 0.6)';
        ctx.fillRect(0, height - bottomBarHeight, width, 2);
        
        // Website/branding
        const smallFontSize = Math.max(10, width / 60);
        ctx.font = `600 ${smallFontSize}px -apple-system, BlinkMacSystemFont, sans-serif`;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.textAlign = 'center';
        ctx.fillText('ghost081280.github.io/dicyanin-viewer', width / 2, height - bottomBarHeight / 2);
    }
    
    toggleFilter() {
        this.filterEnabled = !this.filterEnabled;
        const badge = this.infoBadge;
        
        if (this.filterEnabled) {
            badge.innerHTML = '<span class="badge-dot"></span>DICYANIN FILTER ACTIVE';
        } else {
            badge.innerHTML = '<span class="badge-dot" style="background: var(--danger); box-shadow: 0 0 8px var(--danger);"></span>FILTER DISABLED';
        }
    }
    
    async flipCamera() {
        this.facingMode = this.facingMode === 'environment' ? 'user' : 'environment';
        await this.startCamera();
    }
    
    // ==================== IMAGE CAPTURE ====================
    
    captureImage() {
        this.captureCanvas.width = this.canvas.width;
        this.captureCanvas.height = this.canvas.height;
        
        // Copy current frame
        this.captureCtx.drawImage(this.canvas, 0, 0);
        
        // Add watermark
        this.addWatermark();
        
        // Generate blob immediately and store it
        this.captureCanvas.toBlob((blob) => {
            this.currentImageBlob = blob;
        }, 'image/png');
        
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
        ctx.fillText('ghost081280.github.io/dicyanin-viewer', width / 2, height - bottomBarHeight / 2);
    }
    
    closeModal() {
        this.captureModal.classList.add('hidden');
        // Don't clear the blob here - keep it for potential retry
    }
    
    /**
     * Download image with proper iOS/Safari handling
     */
    async downloadImage() {
        try {
            // Get blob - either from stored or generate fresh
            let blob = this.currentImageBlob;
            if (!blob) {
                blob = await new Promise(resolve => {
                    this.captureCanvas.toBlob(resolve, 'image/png');
                });
            }
            
            if (!blob) {
                this.showSaveError('Could not generate image');
                return;
            }
            
            const filename = `dicyanin-scan-${Date.now()}.png`;
            
            // Try Web Share API first (works best on mobile for saving to camera roll)
            if (navigator.share && navigator.canShare) {
                try {
                    const file = new File([blob], filename, { type: 'image/png' });
                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            files: [file],
                            title: 'Dicyanin Scan'
                        });
                        return; // Success
                    }
                } catch (shareError) {
                    // Share was cancelled or failed, fall through to other methods
                    if (shareError.name === 'AbortError') {
                        return; // User cancelled, don't show error
                    }
                    console.log('Share failed, trying fallback:', shareError);
                }
            }
            
            // iOS Safari fallback - open image in new tab for long-press save
            if (this.isIOS) {
                const url = URL.createObjectURL(blob);
                const newTab = window.open(url, '_blank');
                if (newTab) {
                    // Show instruction to user
                    setTimeout(() => {
                        alert('Long-press the image and tap "Add to Photos" to save');
                    }, 500);
                } else {
                    // Popup blocked - try inline
                    this.showImageForSave(blob);
                }
                return;
            }
            
            // Desktop fallback - standard download
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up after a delay
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            
        } catch (error) {
            console.error('Download error:', error);
            this.showSaveError('Failed to save image');
        }
    }
    
    /**
     * Show image inline for manual save (iOS fallback)
     */
    showImageForSave(blob) {
        const url = URL.createObjectURL(blob);
        
        // Create overlay
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.95);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
        `;
        
        const instruction = document.createElement('p');
        instruction.textContent = 'Long-press image and tap "Add to Photos"';
        instruction.style.cssText = `
            color: white;
            font-size: 16px;
            margin-bottom: 20px;
            text-align: center;
        `;
        
        const img = document.createElement('img');
        img.src = url;
        img.style.cssText = `
            max-width: 90%;
            max-height: 70vh;
            border-radius: 8px;
        `;
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = `
            margin-top: 20px;
            padding: 12px 32px;
            background: #4a3aff;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
        `;
        closeBtn.onclick = () => {
            document.body.removeChild(overlay);
            URL.revokeObjectURL(url);
        };
        
        overlay.appendChild(instruction);
        overlay.appendChild(img);
        overlay.appendChild(closeBtn);
        document.body.appendChild(overlay);
    }
    
    /**
     * Show error message to user
     */
    showSaveError(message) {
        alert(message + '. Please try again.');
    }
    
    // ==================== VIDEO RECORDING ====================
    
    toggleRecording() {
        if (this.isRecording) {
            this.stopRecording();
        } else {
            this.startRecording();
        }
    }
    
    startRecording() {
        try {
            // Get canvas stream with audio disabled
            const canvasStream = this.canvas.captureStream(30); // 30 FPS
            
            // Determine best supported format
            const mimeType = this.getSupportedMimeType();
            if (!mimeType) {
                alert('Video recording is not supported on this browser.');
                return;
            }
            
            this.mediaRecorder = new MediaRecorder(canvasStream, {
                mimeType: mimeType,
                videoBitsPerSecond: 5000000 // 5 Mbps for quality
            });
            
            this.recordedChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                this.processRecording();
            };
            
            this.mediaRecorder.start(100); // Collect data every 100ms
            this.isRecording = true;
            this.recordingStartTime = Date.now();
            
            // Update UI
            this.recordBtn.classList.add('recording');
            this.recordBtn.querySelector('span').textContent = 'Stop';
            this.recordingIndicator.classList.remove('hidden');
            
            // Start timer
            this.updateRecordingTimer();
            this.recordingTimerInterval = setInterval(() => {
                this.updateRecordingTimer();
            }, 100);
            
            // Auto-stop after max duration
            setTimeout(() => {
                if (this.isRecording) {
                    this.stopRecording();
                }
            }, this.maxRecordingDuration);
            
        } catch (error) {
            console.error('Recording error:', error);
            alert('Failed to start recording. Please try again.');
        }
    }
    
    getSupportedMimeType() {
        const types = [
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm',
            'video/mp4'
        ];
        
        for (const type of types) {
            if (MediaRecorder.isTypeSupported(type)) {
                return type;
            }
        }
        return null;
    }
    
    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            
            // Update UI
            this.recordBtn.classList.remove('recording');
            this.recordBtn.querySelector('span').textContent = 'Record';
            this.recordingIndicator.classList.add('hidden');
            
            // Stop timer
            if (this.recordingTimerInterval) {
                clearInterval(this.recordingTimerInterval);
                this.recordingTimerInterval = null;
            }
        }
    }
    
    updateRecordingTimer() {
        if (!this.recordingStartTime) return;
        
        const elapsed = Date.now() - this.recordingStartTime;
        const seconds = Math.floor(elapsed / 1000);
        const ms = Math.floor((elapsed % 1000) / 100);
        
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        
        this.recordingTime.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms}`;
        
        // Check max duration
        if (elapsed >= this.maxRecordingDuration) {
            this.stopRecording();
        }
    }
    
    processRecording() {
        const mimeType = this.getSupportedMimeType();
        this.recordedBlob = new Blob(this.recordedChunks, { type: mimeType });
        
        // Clean up old URL if exists
        if (this.currentVideoUrl) {
            URL.revokeObjectURL(this.currentVideoUrl);
        }
        
        // Create video preview URL and store it
        this.currentVideoUrl = URL.createObjectURL(this.recordedBlob);
        this.videoPreview.src = this.currentVideoUrl;
        
        // Show video modal
        this.videoModal.classList.remove('hidden');
    }
    
    closeVideoModal() {
        this.videoModal.classList.add('hidden');
        this.videoPreview.pause();
        // Don't revoke URL here - keep for retry attempts
    }
    
    /**
     * Download video with proper iOS/Safari handling
     */
    async downloadVideo() {
        if (!this.recordedBlob) {
            this.showSaveError('No video recorded');
            return;
        }
        
        try {
            const extension = this.recordedBlob.type.includes('mp4') ? 'mp4' : 'webm';
            const filename = `dicyanin-scan-${Date.now()}.${extension}`;
            
            // Try Web Share API first
            if (navigator.share && navigator.canShare) {
                try {
                    const file = new File([this.recordedBlob], filename, { type: this.recordedBlob.type });
                    if (navigator.canShare({ files: [file] })) {
                        await navigator.share({
                            files: [file],
                            title: 'Dicyanin Scan'
                        });
                        return; // Success
                    }
                } catch (shareError) {
                    if (shareError.name === 'AbortError') {
                        return; // User cancelled
                    }
                    console.log('Share failed, trying fallback:', shareError);
                }
            }
            
            // iOS Safari - videos are tricky, open in new tab
            if (this.isIOS) {
                const url = URL.createObjectURL(this.recordedBlob);
                const newTab = window.open(url, '_blank');
                if (newTab) {
                    setTimeout(() => {
                        alert('Tap the share button in Safari, then "Save Video" to save to camera roll');
                    }, 500);
                } else {
                    // Provide direct link
                    this.showVideoForSave();
                }
                return;
            }
            
            // Desktop fallback
            const url = URL.createObjectURL(this.recordedBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            setTimeout(() => URL.revokeObjectURL(url), 1000);
            
        } catch (error) {
            console.error('Download error:', error);
            this.showSaveError('Failed to save video');
        }
    }
    
    /**
     * Show video inline for manual save (iOS fallback)
     */
    showVideoForSave() {
        const url = URL.createObjectURL(this.recordedBlob);
        
        const overlay = document.createElement('div');
        overlay.style.cssText = `
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.95);
            z-index: 10000;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 20px;
        `;
        
        const instruction = document.createElement('p');
        instruction.textContent = 'Tap video to play, then use browser share to save';
        instruction.style.cssText = `
            color: white;
            font-size: 16px;
            margin-bottom: 20px;
            text-align: center;
        `;
        
        const video = document.createElement('video');
        video.src = url;
        video.controls = true;
        video.playsInline = true;
        video.style.cssText = `
            max-width: 90%;
            max-height: 60vh;
            border-radius: 8px;
        `;
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = `
            margin-top: 20px;
            padding: 12px 32px;
            background: #4a3aff;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            cursor: pointer;
        `;
        closeBtn.onclick = () => {
            document.body.removeChild(overlay);
            URL.revokeObjectURL(url);
        };
        
        overlay.appendChild(instruction);
        overlay.appendChild(video);
        overlay.appendChild(closeBtn);
        document.body.appendChild(overlay);
    }
    
    /**
     * Share video
     */
    async shareVideo() {
        if (!this.recordedBlob) {
            this.showSaveError('No video recorded');
            return;
        }
        
        try {
            const extension = this.recordedBlob.type.includes('mp4') ? 'mp4' : 'webm';
            const file = new File([this.recordedBlob], `dicyanin-scan.${extension}`, { 
                type: this.recordedBlob.type 
            });
            
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Dicyanin Filter Scan',
                    text: 'DICYANIN FILTER ACTIVATED - See what others cannot. What do you see? ' + this.appUrl
                });
            } else {
                // Fallback: Download video and open X with pre-filled text
                await this.downloadVideo();
                
                const text = "DICYANIN FILTER ACTIVATED - See what others cannot. What do you see?";
                const xShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(this.appUrl)}`;
                
                setTimeout(() => {
                    window.open(xShareUrl, '_blank', 'width=550,height=420');
                }, 500);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Share error:', error);
                // Still try to help user share
                const text = "DICYANIN FILTER ACTIVATED - See what others cannot. What do you see?";
                const xShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(this.appUrl)}`;
                window.open(xShareUrl, '_blank', 'width=550,height=420');
            }
        }
    }
    
    // ==================== SHARING ====================
    
    shareToX() {
        const text = "See what others can't. The legendary Kilner dicyanin filter - what will you see?";
        const url = this.appUrl;
        const xShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
        window.open(xShareUrl, '_blank', 'width=550,height=420');
    }
    
    async shareImageToX() {
        try {
            // Get blob
            let blob = this.currentImageBlob;
            if (!blob) {
                blob = await new Promise(resolve => {
                    this.captureCanvas.toBlob(resolve, 'image/png');
                });
            }
            
            if (!blob) {
                this.shareToX(); // Fallback to just sharing link
                return;
            }
            
            const file = new File([blob], 'dicyanin-scan.png', { type: 'image/png' });
            
            if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Dicyanin Filter Scan',
                    text: 'DICYANIN FILTER ACTIVATED - See what others cannot. What do you see?'
                });
            } else {
                // Download image first, then open X
                await this.downloadImage();
                
                const text = "DICYANIN FILTER ACTIVATED - See what others cannot. What do you see?";
                const xShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(this.appUrl)}`;
                
                setTimeout(() => {
                    window.open(xShareUrl, '_blank', 'width=550,height=420');
                }, 500);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Share error:', error);
                // Fallback to just X share
                this.shareToX();
            }
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    new DicyaninViewer();
});
