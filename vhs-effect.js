// VHS Tape effect using VFX-JS
console.log("Initializing VHS effect with VFX-JS");

// Create custom VHS shader
const vhsShader = `
precision highp float;
uniform vec2 resolution;
uniform vec2 offset;
uniform sampler2D src;
uniform float time;
uniform float noiseAmount;
uniform float trackingOffset;
uniform float rgbOffset;
uniform float scanlineIntensity;
out vec4 outColor;

// Random function for noise
float random(vec2 co) {
    return fract(sin(dot(co.xy, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
    vec2 uv = (gl_FragCoord.xy - offset) / resolution;
    
    // Sample the original texture first
    vec4 originalColor = texture(src, uv);
    
    // Create VHS tracking effect - horizontal distortion that's directly tied to audio
    float tracking = sin(time * 1.5 + uv.y * 15.0) * 0.006; // Increased strength
    tracking = tracking * (1.0 + trackingOffset * 2.0); // Increased audio influence
    
    // Horizontal tracking lines that only appear with sufficient audio - more visible
    float trackingLineThreshold = 0.7; // Lower threshold = more lines
    float trackingLine = step(trackingLineThreshold, sin(uv.y * 30.0 + time * 5.0) * 0.5 + 0.5);
    trackingLine = trackingLine * (0.3 + trackingOffset * 0.3); // Higher base intensity
    
    // Create more tracking lines in bands - more visible
    float trackingLinesBands = step(0.6,  
                          random(vec2(floor(uv.y * 40.0), floor(time * 1.0)))) * (0.2 + trackingOffset * 0.2);
    
    // Apply noise with different intensity - more visible
    float noise = random(uv + vec2(time * 0.5, 0.0));
    float noiseEffect = step(0.7, noise) * 0.3 * (0.5 + trackingOffset * 0.5);
    
    // RGB offset (Chromatic aberration - color shifting) - more visible
    float rOffset = sin(time * 0.5) * 0.006 * (1.0 + rgbOffset);
    float gOffset = sin(time * 0.5 + 1.3) * 0.006 * (1.0 + rgbOffset); 
    float bOffset = sin(time * 0.5 + 2.6) * 0.006 * (1.0 + rgbOffset);
    
    // Sample with color shifting for ghosting/chromatic aberration
    vec4 rChannel = texture(src, vec2(uv.x + rOffset + tracking, uv.y + tracking * 0.2));
    vec4 gChannel = texture(src, vec2(uv.x + gOffset, uv.y));
    vec4 bChannel = texture(src, vec2(uv.x + bOffset - tracking, uv.y - tracking * 0.2));
    
    // Combine channels with enhanced color separation
    vec4 color = vec4(rChannel.r * 1.2, gChannel.g, bChannel.b * 1.2, originalColor.a);
    
    // Add scanlines for VHS effect - more visible
    float scanlines = sin(uv.y * 800.0) * 0.07 * (0.5 + scanlineIntensity * 0.5);
    color.rgb -= vec3(scanlines);
    
    // Add more contrast and slight sepia tone for vintage look
    color.rgb = color.rgb * 1.2 - 0.1; // More contrast
    color.r = min(1.0, color.r * 1.1); // Slightly more red
    color.b = min(1.0, color.b * 0.95); // Slightly less blue
    
    // Apply tracking lines and noise
    color.rgb += vec3(trackingLine + trackingLinesBands + noiseEffect);
    
    // Bottom area artifacts only with sufficient audio - stronger
    float bottomStaticThreshold = 0.1;
    float bottomStatic = step(0.85, uv.y) * step(random(vec2(uv.x * 5.0, time)), bottomStaticThreshold) * 0.4 * (0.5 + trackingOffset * 0.5);
    color.rgb += vec3(bottomStatic);
    
    // Head switching noise (line at the bottom of the screen) - more visible
    float headSwitchingNoise = step(0.92, uv.y) * 0.2 * (0.5 + trackingOffset * 0.5);
    color.rgb += vec3(headSwitchingNoise);
    
    // Output the final color
    outColor = color;
}
`;

// Audio data and intensity data
let audioLevel = 0;
let lastAudioTime = 0;
let trackingIntensity = 0;
let vfx = null;
let activeEffect = null;
let isVHSActive = false;
let lastActiveHydraViz = 'chalk';
let uiContainer = null;
let originalUI = null;
let videoBackgroundState = null;
let videoObserver = null;
let isVideoEnabled = false;

// Expose VHS state to window/global scope
window.isVHSActive = false;

// Global variables to track state
let savedVideoBackgroundState = {
    wasActive: false,
    opacity: 1.0,
    zIndex: 1
};
let savedUIState = {
    controlsHidden: false
};

// Function to update audio intensity from the existing audio analyzer
function updateAudioIntensity(level) {
    // Add a threshold so there's no effect with very low audio
    if (level < 0.05) {
        audioLevel = 0;
    } else {
        // Apply non-linear mapping to make it more responsive
        audioLevel = Math.pow(level, 1.5); // Exponential response curve
    }
    
    // Increase tracking intensity when audio is louder with smoother transitions
    const targetIntensity = Math.min(1.0, audioLevel * 2.5);
    trackingIntensity = trackingIntensity * 0.85 + targetIntensity * 0.15; // Smoother transition
    
    // Debug info
    // console.log("VHS Audio level:", audioLevel.toFixed(2));
}

// Enforce video visibility - ensures video remains visible when it should be
function enforceVideoVisibility(forceVisible = true) {
    // Check if the global enforcer exists first
    if (typeof window.enforceVideoVisibility === 'function') {
        console.log("Using global video enforcer");
        window.enforceVideoVisibility(forceVisible);
        return;
    }
    
    // Otherwise use our local implementation
    const videoBackground = document.getElementById('video-background');
    if (!videoBackground) return;
    
    if (forceVisible) {
        // Check if there's a global video state we should respect
        if (typeof window.videoBackgroundActive !== 'undefined') {
            isVideoEnabled = window.videoBackgroundActive;
            
            if (!isVideoEnabled && !isVHSActive) {
                console.log("Video is globally disabled and VHS not active, not enforcing");
                return;
            }
        }
        
        if (videoBackground.style.display === 'none') {
            console.log("Video was hidden, making visible for VHS effect");
            videoBackground.style.display = 'block';
        }
        
        if (parseFloat(videoBackground.style.opacity) < 0.7) {
            videoBackground.style.opacity = '0.9';
        }
        
        // Ensure video is playing
        if (videoBackground.paused) {
            try {
                const playPromise = videoBackground.play();
                if (playPromise !== undefined) {
                    playPromise.catch(error => {
                        console.warn("Could not autoplay video:", error);
                    });
                }
            } catch (e) {
                console.warn("Error playing video:", e);
            }
        }
        
        // Make canvas semi-transparent
        const hydraCanvas = document.getElementById('hydra-canvas');
        if (hydraCanvas && parseFloat(hydraCanvas.style.opacity) > 0.9) {
            hydraCanvas.style.opacity = '0.8';
        }
    }
}

// Start monitoring video status across visualization changes
function startVideoObserver() {
    if (window.videoObserverInterval) {
        clearInterval(window.videoObserverInterval);
    }
    
    // Check immediately
    enforceVideoVisibility(true);
    
    // Then set up observer to keep checking
    window.videoObserverInterval = setInterval(() => {
        if (isVHSActive || isVideoEnabled) {
            enforceVideoVisibility(true);
        } else {
            clearInterval(window.videoObserverInterval);
            window.videoObserverInterval = null;
        }
    }, 1000); // Check every second
    
    console.log("Video observer started");
}

// Stop monitoring video status
function stopVideoObserver() {
    if (window.videoObserverInterval) {
        clearInterval(window.videoObserverInterval);
        window.videoObserverInterval = null;
        console.log("Stopped video observer");
    }
}

// Function to save the current state of the video background
function saveVideoBackgroundState() {
    const videoBackground = document.getElementById('video-background');
    if (videoBackground) {
        savedVideoBackgroundState.wasActive = videoBackground.style.display !== 'none';
        savedVideoBackgroundState.opacity = parseFloat(videoBackground.style.opacity) || 1.0;
        savedVideoBackgroundState.zIndex = parseInt(videoBackground.style.zIndex) || 1;
        console.log("Saved video background state:", savedVideoBackgroundState);
    }
    
    // Save the state of the video toggle
    const videoToggle = document.getElementById('video-toggle');
    if (videoToggle) {
        savedVideoBackgroundState.toggleChecked = videoToggle.checked;
    }
}

// Function to restore the video background to its saved state
function restoreVideoBackgroundState() {
    // If video is globally enabled, don't restore to a disabled state
    if (typeof window.videoBackgroundActive !== 'undefined' && window.videoBackgroundActive) {
        console.log("Video is globally enabled, not restoring to previous state");
        window.enforceVideoVisibility(true);
        return;
    }
    
    const videoBackground = document.getElementById('video-background');
    if (videoBackground) {
        if (!savedVideoBackgroundState.wasActive) {
            videoBackground.style.opacity = '0';
        } else {
            videoBackground.style.display = 'block';
            videoBackground.style.opacity = savedVideoBackgroundState.opacity;
            videoBackground.style.zIndex = savedVideoBackgroundState.zIndex;
        }
        console.log("Restored video background state:", savedVideoBackgroundState);
    }
    
    // Only restore the toggle if video is not globally enabled
    if (typeof window.videoBackgroundActive === 'undefined' || !window.videoBackgroundActive) {
        const videoToggle = document.getElementById('video-toggle');
        if (videoToggle && videoToggle.checked !== savedVideoBackgroundState.toggleChecked) {
            videoToggle.checked = savedVideoBackgroundState.toggleChecked;
            
            // Trigger change event to ensure any listeners are notified
            const event = new Event('change');
            videoToggle.dispatchEvent(event);
        }
    }
}

// Function to save UI state
function saveUI() {
    const controlPanel = document.querySelector('.control-panel');
    if (controlPanel) {
        savedUIState.controlsHidden = controlPanel.classList.contains('hidden');
    }
    console.log("Saved UI state:", savedUIState);
}

// Function to restore UI to normal
function restoreUI() {
    const controlPanel = document.querySelector('.control-panel');
    if (controlPanel) {
        if (savedUIState.controlsHidden) {
            controlPanel.classList.add('hidden');
        } else {
            controlPanel.classList.remove('hidden');
        }
    }
    console.log("Restored UI state:", savedUIState);
}

// Create a fixed UI container that will always stay on top
function createFixedUIContainer() {
    if (uiContainer) {
        // Already created
        return uiContainer;
    }
    
    // Create container
    uiContainer = document.createElement('div');
    uiContainer.id = 'vhs-ui-container';
    uiContainer.style.position = 'fixed';
    uiContainer.style.bottom = '20px';
    uiContainer.style.right = '20px';
    uiContainer.style.zIndex = '9999';
    uiContainer.style.pointerEvents = 'all';
    
    document.body.appendChild(uiContainer);
    
    return uiContainer;
}

// Move UI to safe container during VHS effect
function preserveUI() {
    // Only do this once
    if (originalUI) {
        return;
    }
    
    // Create container if needed
    const container = createFixedUIContainer();
    
    // Get original UI elements
    const controlPanel = document.getElementById('control-panel');
    const togglePanel = document.getElementById('toggle-panel');
    
    if (controlPanel) {
        // Save reference to original location
        originalUI = {
            controlPanel: controlPanel,
            controlParent: controlPanel.parentNode,
            controlNext: controlPanel.nextSibling,
            togglePanel: togglePanel,
            toggleParent: togglePanel ? togglePanel.parentNode : null,
            toggleNext: togglePanel ? togglePanel.nextSibling : null
        };
        
        // Move to our safe container
        container.appendChild(controlPanel);
        
        // Ensure proper styling
        controlPanel.style.position = 'static';
        controlPanel.style.transform = 'none';
        controlPanel.classList.remove('hidden');
        
        if (togglePanel) {
            // Also move toggle panel if it exists
            const computedStyle = window.getComputedStyle(togglePanel);
            const originalRight = computedStyle.right;
            const originalBottom = computedStyle.bottom;
            
            container.appendChild(togglePanel);
            
            // Adjust position to match original
            togglePanel.style.position = 'absolute';
            togglePanel.style.right = originalRight;
            togglePanel.style.bottom = originalBottom;
        }
    }
    
    // Preserve video background toggle functionality
    const videoToggle = document.getElementById('video-toggle');
    if (videoToggle) {
        videoToggle.addEventListener('change', handleVideoToggle);
    }
    
    const sampleVideoToggle = document.getElementById('use-sample-video');
    if (sampleVideoToggle) {
        sampleVideoToggle.addEventListener('change', handleSampleVideoToggle);
    }
}

// Handler for video toggle
function handleVideoToggle(e) {
    const videoToggle = e.target;
    const videoBackgroundActive = videoToggle.checked;
    
    // Update both local and global tracking of video state
    isVideoEnabled = videoBackgroundActive;
    
    // If we have access to the global video state, sync with it
    if (typeof window.videoBackgroundActive !== 'undefined') {
        window.videoBackgroundActive = videoBackgroundActive;
    }
    
    if (videoBackgroundActive) {
        // Call the global enforcer if available
        if (typeof window.enforceVideoVisibility === 'function') {
            window.enforceVideoVisibility(true);
        } else {
            // Otherwise use our local implementation
            enforceVideoVisibility(true);
        }
        
        // Ensure video observer is running
        startVideoObserver();
    } else if (!isVHSActive) {
        // Only hide video if VHS effect is not active
        const videoBackground = document.getElementById('video-background');
        if (videoBackground) {
            videoBackground.style.opacity = '0';
            videoBackground.pause();
        }
        
        // Make hydra canvas fully opaque
        const hydraCanvas = document.getElementById('hydra-canvas');
        if (hydraCanvas) {
            hydraCanvas.style.opacity = '1';
        }
        
        // Stop video observer since video is now disabled
        stopVideoObserver();
    }
    
    // Update our saved state
    if (videoBackgroundState) {
        videoBackgroundState.wasVisible = videoBackgroundActive;
        videoBackgroundState.wasPlaying = videoBackgroundActive;
        videoBackgroundState.videoToggleState = videoBackgroundActive;
    }
    
    // Notify any global handlers
    if (typeof window.videoStateChanged === 'function') {
        window.videoStateChanged(videoBackgroundActive);
    }
}

// Handler for sample video toggle
function handleSampleVideoToggle(e) {
    const sampleVideoToggle = e.target;
    const useSampleVideo = sampleVideoToggle.checked;
    const videoBackground = document.getElementById('video-background');
    
    if (!videoBackground) return;
    
    // Update video source
    if (useSampleVideo) {
        // Set to sample video from the web
        const source = videoBackground.querySelector('source');
        if (source) {
            source.src = 'https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4';
        }
    } else {
        // Set to local video file
        const source = videoBackground.querySelector('source');
        if (source) {
            source.src = 'video-background.mp4';
        }
    }
    
    // Reload the video to apply the new source
    videoBackground.load();
    
    // If video is currently active, play the new source
    const videoToggle = document.getElementById('video-toggle');
    const isVideoActive = videoToggle && videoToggle.checked;
    
    if (isVideoActive || isVHSActive) {
        videoBackground.play().catch(err => {
            console.error('Error playing video after source change:', err);
        });
    }
    
    // Update our saved state
    if (videoBackgroundState) {
        videoBackgroundState.sampleVideoState = useSampleVideo;
        videoBackgroundState.source = useSampleVideo ? 
            'https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4' : 
            'video-background.mp4';
    }
}

// Function to activate the VHS effect
function activateVHSEffect(target) {
    console.log("Activating VHS tape effect");
    try {
        // Force video to be visible for VHS effect
        isVideoEnabled = true;
        
        // Track VHS state globally
        isVHSActive = true;
        window.isVHSActive = true;
        
        // Check if there's a global video enabled flag
        if (typeof window.videoBackgroundActive !== 'undefined') {
            window.videoBackgroundActive = true;
        }
        
        // Update video toggle to reflect that video is enabled
        const videoToggle = document.getElementById('video-toggle');
        if (videoToggle && !videoToggle.checked) {
            videoToggle.checked = true;
            // Trigger any handlers that might be listening for changes
            const event = new Event('change');
            videoToggle.dispatchEvent(event);
        }
        
        // Get video element reference
        const videoBackground = document.getElementById('video-background');
        if (videoBackground) {
            // Make sure video is visible and playing
            videoBackground.style.display = 'block';
            videoBackground.style.opacity = '1.0';
            videoBackground.style.zIndex = '-1'; // Keep video behind everything
            
            // Try to play the video - important for the effect
            if (videoBackground.paused) {
                try {
                    videoBackground.play().catch(err => {
                        console.warn("Could not play video for VHS effect:", err);
                    });
                } catch (e) {
                    console.warn("Error playing video:", e);
                }
            }
        }
        
        // Remember current active visualization
        document.querySelectorAll('.viz-button.active').forEach(btn => {
            const vizName = btn.getAttribute('data-viz');
            if (vizName !== 'vhsTape') {
                lastActiveHydraViz = vizName;
                console.log(`Saved last active visualization: ${lastActiveHydraViz}`);
            }
        });
        
        // Save video background state
        saveVideoBackgroundState();
        
        // Move UI to safe container
        preserveUI();
        
        // Instead of targeting the canvas element directly, use the body
        // This will make the effect overlay the entire page, including the video
        const effectTarget = document.body;
        
        console.log("Activating VHS effect on", effectTarget);
        
        // Make sure any key elements are visible and properly styled
        const hydraCanvas = document.getElementById('hydra-canvas');
        if (hydraCanvas) {
            hydraCanvas.style.opacity = '0.4'; // Make canvas semi-transparent
            hydraCanvas.style.zIndex = '1'; // Position above video but below effect
        }
        
        // Make sure VFX is initialized - important change to ensure VFX is properly loaded
        initializeVFX();
        
        // Create the VHS overlay immediately
        let vhsOverlay = document.getElementById('vhs-overlay');
        if (!vhsOverlay) {
            vhsOverlay = document.createElement('div');
            vhsOverlay.id = 'vhs-overlay';
            vhsOverlay.style.position = 'fixed';
            vhsOverlay.style.top = '0';
            vhsOverlay.style.left = '0';
            vhsOverlay.style.width = '100%';
            vhsOverlay.style.height = '100%';
            vhsOverlay.style.zIndex = '10'; // IMPORTANT: Higher z-index to ensure it's above everything except UI
            vhsOverlay.style.pointerEvents = 'none'; // Allow clicks to pass through
            vhsOverlay.style.backgroundColor = 'rgba(20, 0, 30, 0.1)'; // Slight visible tint to confirm it's working
            vhsOverlay.style.mixBlendMode = 'multiply'; // Add blend mode for better video integration
            
            // Add a small indicator in the corner to confirm VHS mode is active
            const indicator = document.createElement('div');
            indicator.style.position = 'absolute';
            indicator.style.top = '10px';
            indicator.style.left = '10px';
            indicator.style.width = '10px';
            indicator.style.height = '10px';
            indicator.style.borderRadius = '50%';
            indicator.style.backgroundColor = 'red';
            indicator.style.opacity = '0.7';
            vhsOverlay.appendChild(indicator);
            
            document.body.appendChild(vhsOverlay);
            
            console.log("VHS overlay created with higher z-index and indicator");
        }
        
        // If we have VFX and no active effect, create one
        if (vfx && !activeEffect) {
            // Add the effect with our custom shader to the overlay
            try {
                console.log("Creating VHS shader effect with stronger parameters");
                
                // Explicitly ensure VFX is available
                if (!vfx && typeof window.VFX !== 'undefined') {
                    console.log("Reinitializing VFX");
                    vfx = new window.VFX();
                }
                
                if (!vfx) {
                    throw new Error("VFX object not available");
                }
                
                // Make effect more visible with stronger parameters
                activeEffect = vfx.add(vhsOverlay, {
                    shader: vhsShader,
                    uniforms: {
                        time: () => performance.now() / 1000,
                        noiseAmount: () => 0.1 + Math.random() * 0.1, // INCREASED noise
                        trackingOffset: () => Math.max(0.5, trackingIntensity), // INCREASED minimum tracking
                        rgbOffset: () => Math.max(0.5, audioLevel * 4.0),  // INCREASED color shift
                        scanlineIntensity: () => Math.max(0.5, audioLevel * 1.0) // INCREASED scanlines
                    }
                });
                
                // Force video to be 100% visible
                const videoBackground = document.getElementById('video-background');
                if (videoBackground) {
                    videoBackground.style.display = 'block';
                    videoBackground.style.opacity = '1.0';
                    videoBackground.style.zIndex = '0'; // Below everything
                    
                    // Ensure it's playing
                    if (videoBackground.paused) {
                        const playPromise = videoBackground.play();
                        if (playPromise !== undefined) {
                            playPromise.catch(error => {
                                console.warn("Could not autoplay video:", error);
                            });
                        }
                    }
                }
                
                console.log("VHS effect activated successfully with stronger settings");
            } catch (error) {
                console.error("Failed to add VHS shader:", error);
                
                // Add direct visual effect to the overlay as fallback
                vhsOverlay.style.background = 'linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.3)), repeating-linear-gradient(transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)';
                
                // Add CSS animation for scan lines
                const style = document.createElement('style');
                style.textContent = `
                    @keyframes scanlines {
                        0% { background-position: 0 0; }
                        100% { background-position: 0 30px; }
                    }
                    #vhs-overlay {
                        animation: scanlines 1s linear infinite;
                    }
                `;
                document.head.appendChild(style);
                
                // Fallback to the Hydra VHS visualization
                console.log("Falling back to Hydra VHS visualization");
                if (typeof window.activateVHSVisualization === 'function') {
                    window.activateVHSVisualization();
                }
            }
        } else {
            console.warn("Could not create VHS effect: VFX not available or effect already active");
        }
        
        // Start video observer to ensure it stays visible
        startVideoObserver();
        
        // Make VHS button active
        const vhsButton = document.querySelector('.viz-button[data-viz="vhsTape"]');
        if (vhsButton) {
            vhsButton.classList.add('active');
        }
        
        // Also activate the built-in VHS visualization as a fallback
        if (typeof window.activateVHSVisualization === 'function') {
            window.activateVHSVisualization();
        }
    } catch (error) {
        console.error("Failed to activate VHS effect:", error);
    }
}

// Helper function to ensure VFX is initialized
function initializeVFX() {
    // First, make sure we have a direct VFX instance
    if (!vfx && typeof window.VFX !== 'undefined') {
        try {
            vfx = new window.VFX();
            console.log("VFX initialized directly");
        } catch (err) {
            console.error("Failed to initialize VFX directly:", err);
        }
    }
    
    // If we still don't have VFX, try to get it from the global scope
    if (!vfx && typeof window.vfx !== 'undefined') {
        vfx = window.vfx;
        console.log("Using global VFX instance");
    }
    
    // If we still don't have VFX, try to create it with a synchronous approach
    if (!vfx) {
        console.log("No VFX instance available, trying to create one");
        
        // Try to import VFX directly
        if (typeof window.VFX === 'undefined') {
            console.log("Loading VFX-JS script synchronously");
            
            // Load VFX-JS library synchronously
            const script = document.createElement('script');
            script.src = 'https://esm.sh/@vfx-js/core';
            script.type = 'module';
            
            // For immediate execution
            document.head.appendChild(script);
            
            // Set a timeout to wait for the script to load
            setTimeout(() => {
                if (typeof window.VFX !== 'undefined') {
                    vfx = new window.VFX();
                    console.log("VFX created after timeout");
                    
                    // If effect isn't active yet but should be, create it
                    if (isVHSActive && !activeEffect) {
                        const vhsOverlay = document.getElementById('vhs-overlay');
                        if (vhsOverlay) {
                            activateVHSEffect(document.getElementById('hydra-canvas'));
                        }
                    }
                }
            }, 500);
        }
    }
    
    return vfx;
}

// Function to deactivate the VHS effect and restore previous state
function deactivateVHSEffect() {
    console.log("Deactivating VHS effect...");
    
    try {
        // Stop the video observer interval if it's running
        if (window.videoObserverInterval) {
            clearInterval(window.videoObserverInterval);
            window.videoObserverInterval = null;
            console.log("Stopped video observer interval");
        }
        
        // Destroy the active effect
        if (activeEffect) {
            activeEffect.destroy();
            activeEffect = null;
            console.log("Destroyed active VHS effect");
        }
        
        // Remove the overlay if it exists
        const vhsOverlay = document.getElementById('vhs-overlay');
        if (vhsOverlay) {
            document.body.removeChild(vhsOverlay);
        }
        
        // Set VHS as inactive both locally and globally
        isVHSActive = false;
        window.isVHSActive = false;
        
        // Restore the video background to its previous state
        // But only if video wasn't explicitly toggled on during VHS mode
        const videoToggle = document.getElementById('video-toggle');
        const videoCurrentlyWanted = videoToggle && videoToggle.checked;
        
        if (videoCurrentlyWanted) {
            // Keep video on because the toggle indicates it should be
            if (typeof window.enforceVideoVisibility === 'function') {
                window.enforceVideoVisibility(true);
            } else {
                enforceVideoVisibility(true);
            }
            
            // Reset hydra canvas to be fully visible
            const hydraCanvas = document.getElementById('hydra-canvas');
            if (hydraCanvas) {
                hydraCanvas.style.opacity = '1.0';
            }
            
            // Reinitialize video as source to fix any issues
            if (typeof window.s0 !== 'undefined') {
                try {
                    window.s0.init({src: document.getElementById('video-background'), dynamic: true});
                    
                    // Update output buffer for video source
                    if (typeof window.src === 'function') {
                        window.src(window.s0).out(window.o3);
                    }
                } catch (err) {
                    console.warn("Could not reinitialize video source:", err);
                }
            }
        } else {
            // Otherwise restore to previous state
            restoreVideoBackgroundState();
        }
        
        // Restore the UI
        restoreUI();
        
        // Make the VHS button inactive
        const vhsButton = document.querySelector('.viz-button[data-viz="vhsTape"]');
        if (vhsButton) {
            vhsButton.classList.remove('active');
            console.log("VHS button set to inactive");
        }
        
        // Let script.js know to update visualization if possible
        if (typeof window.resetViz === 'function') {
            window.resetViz();
        }
        
        console.log("VHS effect successfully deactivated");
    } catch (error) {
        console.error("Error deactivating VHS effect:", error);
    }
}

// Function to check if the VHS effect is visible and properly working
function checkVHSEffectVisibility() {
    const vhsOverlay = document.getElementById('vhs-overlay');
    
    if (isVHSActive && vhsOverlay) {
        console.log("VHS effect should be visible, checking state...");
        
        // Check if overlay is properly positioned and visible
        const computedStyle = window.getComputedStyle(vhsOverlay);
        
        if (computedStyle.display === 'none' || parseFloat(computedStyle.opacity) < 0.1) {
            console.log("VHS overlay is hidden, making visible");
            vhsOverlay.style.display = 'block';
            vhsOverlay.style.opacity = '1';
        }
        
        // Check z-index to ensure it's above canvas
        if (parseInt(computedStyle.zIndex) < 2) {
            console.log("VHS overlay z-index too low, fixing");
            vhsOverlay.style.zIndex = '5';
        }
        
        // If no active effect but we should have one, try to recreate
        if (!activeEffect && vfx) {
            console.log("No active effect but VHS should be active, recreating");
            
            try {
                activeEffect = vfx.add(vhsOverlay, {
                    shader: vhsShader,
                    uniforms: {
                        time: () => performance.now() / 1000,
                        noiseAmount: () => 0.05 + Math.random() * 0.05,
                        trackingOffset: () => Math.max(0.3, trackingIntensity), // Higher minimum
                        rgbOffset: () => Math.max(0.4, audioLevel * 3.0),  // Higher minimum
                        scanlineIntensity: () => Math.max(0.4, audioLevel * 0.7) // Higher minimum
                    }
                });
                console.log("Recreated VHS effect");
            } catch (err) {
                console.error("Failed to recreate effect:", err);
            }
        }
        
        return true;
    }
    return false;
}

// Initialize when everything is ready
window.addEventListener('load', async () => {
    try {
        console.log("Window loaded, initializing VFX");
        
        // Import VFX dynamically if needed
        if (typeof window.VFX === 'undefined') {
            console.log("VFX not found in window, trying to import");
            try {
                const module = await import('https://esm.sh/@vfx-js/core');
                window.VFX = module.VFX;
                console.log("VFX imported successfully");
            } catch (err) {
                console.error("Failed to import VFX:", err);
                return;
            }
        }
        
        // Initialize VFX
        vfx = new window.VFX();
        console.log("VFX initialized successfully");
        
        // Create a mutation observer to watch for DOM changes that might affect video visibility
        const bodyObserver = new MutationObserver((mutations) => {
            // If video is enabled, ensure it stays visible
            if (isVideoEnabled || 
                (typeof window.videoBackgroundActive !== 'undefined' && window.videoBackgroundActive)) {
                enforceVideoVisibility();
            }
            
            // Check if VHS effect is still visible
            if (isVHSActive) {
                checkVHSEffectVisibility();
            }
        });
        
        // Start observing the body for DOM changes
        bodyObserver.observe(document.body, { 
            childList: true, 
            subtree: true, 
            attributes: true,
            attributeFilter: ['style', 'class']
        });
        
        // Add global binding to toggle VHS effect
        window.activateVHSEffect = activateVHSEffect;
        window.deactivateVHSEffect = deactivateVHSEffect;
        
        // Fix visualization buttons that might have original click behavior
        // This allows the visualization buttons to work properly when video is active
        document.querySelectorAll('.viz-button').forEach(btn => {
            // Store the data-viz attribute
            const vizName = btn.getAttribute('data-viz');
            
            // Skip the VHS button, it has special handling
            if (vizName === 'vhsTape') {
                // Handle VHS button click special case
                btn.addEventListener('click', (e) => {
                    if (!isVHSActive) {
                        activateVHSEffect(document.getElementById('hydra-canvas'));
                    } else {
                        deactivateVHSEffect();
                        
                        // Reset any visualization state if needed
                        if (typeof window.resetViz === 'function') {
                            window.resetViz();
                        }
                    }
                    
                    // Don't prevent default - let normal viz activation happen too
                }, false);
            }
        });
        
        // Listen for global changes to video state
        if (typeof window.videoStateChanged === 'function') {
            const originalHandler = window.videoStateChanged;
            
            window.videoStateChanged = function(isActive) {
                // Call original handler
                originalHandler(isActive);
                
                // Update our local state
                isVideoEnabled = isActive;
                
                // Ensure video visibility if needed
                if (isActive || isVHSActive) {
                    // Use global enforcer if available
                    if (typeof window.enforceVideoVisibility === 'function') {
                        window.enforceVideoVisibility(true);
                    } else {
                        enforceVideoVisibility(true);
                    }
                    
                    // Start observer if not already running
                    if (!window.videoObserverInterval) {
                        startVideoObserver();
                    }
                }
            };
        }
        
        // Try to hook into the existing audio analyzer
        window.updateVHSAudio = updateAudioIntensity;
        
        // Listen for video toggle changes globally to track state
        const videoToggle = document.getElementById('video-toggle');
        if (videoToggle) {
            isVideoEnabled = videoToggle.checked;
            
            // Start video observer if video is enabled
            if (isVideoEnabled) {
                startVideoObserver();
                enforceVideoVisibility(true);
            }
        }
        
        // Periodically check if VHS effect is visible when it should be
        window.vhsVisibilityInterval = setInterval(() => {
            if (isVHSActive) {
                checkVHSEffectVisibility();
            } else {
                clearInterval(window.vhsVisibilityInterval);
                window.vhsVisibilityInterval = null;
            }
        }, 2000);
    } catch (error) {
        console.error("Error in VHS effect initialization:", error);
    }
}); 

// Make updateAudioIntensity globally available 
window.updateVHSAudio = updateAudioIntensity; 