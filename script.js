// Initialize Hydra with full window size
const hydra = new Hydra({
    canvas: document.getElementById('hydra-canvas'),
    detectAudio: false,
    width: window.innerWidth,
    height: window.innerHeight
});

// Enable video as Hydra source (correctly)
s0.init({src: document.getElementById('video-background'), dynamic: true});

// Force canvas to fill screen
document.getElementById('hydra-canvas').style.width = '100vw';
document.getElementById('hydra-canvas').style.height = '100vh';

// Set a black background from the start
solid(0, 0, 0, 1).out();

// Current visualization style
let currentViz = 'chalk';
// Track active visualizations
let activeVisualizations = new Set(['chalk']); // Start with chalk active

// Video background state
let videoBackgroundActive = false;
const videoBackground = document.getElementById('video-background');
const sampleVideoUrl = 'https://storage.googleapis.com/coverr-main/mp4/Mt_Baker.mp4';
const localVideoUrl = 'video-background.mp4';

// Ensure proper video element styling
videoBackground.style.position = 'fixed';
videoBackground.style.top = '0';
videoBackground.style.left = '0';
videoBackground.style.width = '100%';
videoBackground.style.height = '100%';
videoBackground.style.objectFit = 'cover';
videoBackground.style.zIndex = '-1'; // Behind canvas
videoBackground.style.opacity = '0'; // Start hidden

// Make the enforceVideoVisibility function globally available
window.enforceVideoVisibility = function(forceVisible = null) {
    // Get video toggle state
    const videoToggle = document.getElementById('video-toggle');
    const isVideoToggleOn = videoToggle && videoToggle.checked;
    
    // If forceVisible is passed, it overrides videoBackgroundActive
    // But still respect the toggle if it's explicitly off
    const shouldBeVisible = (forceVisible !== null) ? 
        (forceVisible && isVideoToggleOn) : 
        (videoBackgroundActive && isVideoToggleOn);
    
    if (shouldBeVisible) {
        // Ensure video is visible and properly styled
        videoBackground.style.display = 'block';
        videoBackground.style.opacity = '1.0'; // Fully visible
        videoBackground.style.zIndex = '-1';
        
        // If video is paused but should be playing, restart it
        if (videoBackground.paused && !window.isPlayingRequested) {
            window.isPlayingRequested = true;
            videoBackground.play()
                .catch(err => {
                    console.error("Error playing video during enforcement:", err);
                    window.isPlayingRequested = false;
                })
                .then(() => {
                    window.isPlayingRequested = false;
                });
        }
        
        // When video is playing, canvas should be fully opaque but blend with video source
        document.getElementById('hydra-canvas').style.opacity = '1.0';
        
        // Make sure Hydra is using the video as a source
        src(s0).out(o3); // Store video in buffer o3 for visualizations to use
    } else if (!shouldBeVisible && forceVisible !== true) {
        // Only hide if not explicitly forced to be visible
        videoBackground.style.opacity = '0';
        
        // Clear video buffer when video is disabled
        solid(0, 0, 0, 0).out(o3);
    }
};

// Check if a video is playable - returns a Promise
function checkVideoPlayable(videoElement) {
    return new Promise((resolve) => {
        // Set a timeout to make sure we don't wait forever
        const timeoutId = setTimeout(() => {
            console.log('Video playability check timed out');
            resolve(false);
        }, 3000);
        
        // Try to play the video
        const playPromise = videoElement.play();
        
        if (playPromise !== undefined) {
            playPromise.then(() => {
                // Video can play, pause it immediately
                videoElement.pause();
                clearTimeout(timeoutId);
                resolve(true);
            }).catch(err => {
                console.error('Error checking video playability:', err);
                clearTimeout(timeoutId);
                resolve(false);
            });
        } else {
            // For browsers that don't return a promise from play()
            // We'll just assume it's playable
            clearTimeout(timeoutId);
            resolve(true);
        }
    });
}

// Basic Hydra sketch (replace with audio-reactive sketch later)
// osci(40, 0.1, 0.8)
//   .diff(o3)
//   .modulate(o0,()=>mouse.x*0.0001)
//   .out();

// --- Audio Processing and Visualization Logic Below ---

async function setupAudio() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();

        analyser.fftSize = 256; // Smaller for faster response
        analyser.smoothingTimeConstant = 0.6; // Smoothing for better transitions
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);

        source.connect(analyser);
        console.log("Audio setup complete with buffer length:", bufferLength);

        return { analyser, dataArray, bufferLength };
    } catch (err) {
        console.error('Error accessing microphone:', err);
        alert('Error accessing microphone. Please allow microphone access and reload the page.');
        return null;
    }
}

// Different visualization styles
const visualizations = {
    // White chalk effect (current style)
    chalk: (level, isSilent, opacity) => {
        // Sample video if active
        if (videoBackgroundActive) {
            src(s0).out(o3);
        } else {
            solid(0, 0, 0, 0).out(o3);
        }
        
        // Create a base of voronoi cells that completely fill the screen
        voronoi(100, 0.5, 0.3)
            .modulateScale(
                noise(3).add(osc(5, 0).thresh(0.5).pixelate(20, 20)), 
                1.5
            )
            .scale(1.5) // Scale larger than 1 to ensure full coverage
            .brightness(-0.1)
            .contrast(1.2)
            .saturate(0)
            .out(o0);
        
        // Create dynamic chalk-like lines that fill the screen
        shape(2, 0.5, 0)
            .scale(10)
            .repeat(5, 5) // Creates a grid of shapes across the screen
            .scrollX(() => Math.sin(time * 0.1) * 0.1)
            .scrollY(() => Math.cos(time * 0.1) * 0.1)
            .thresh(0.5)
            .mult(
                osc(20, 0.01, 1)
                .rotate(() => time * 0.05)
                .kaleid(3)
                .scale(3)
            )
            .scale(1.5)
            .rotate(() => time * 0.1)
            .brightness(0.1)
            .contrast(1.5)
            .saturate(0)
            .out(o1);
        
        // Create expanding circles that react to audio
        shape(99, 0.01, 0.5)
            .scale(() => 15 * level + 5)
            .add(
                shape(99, 0.01, 0)
                .scale(() => 8 * level + 3)
            )
            .add(
                shape(99, 0.01, 0)
                .scale(() => 4 * level + 2)
            )
            .repeat(2, 2) // Repeat across screen
            .scale(1.5) // Scale beyond screen bounds
            .scrollX(() => Math.sin(time * 0.1) * 0.2)
            .scrollY(() => Math.cos(time * 0.1) * 0.2)
            .brightness(0.05)
            .contrast(1.5)
            .saturate(0)
            .out(o2);
        
        // Final chalk composition with video blend
        src(o0)
            .layer(
                src(o1)
                .blend(src(o2), () => 0.2 + level * 0.3)
            )
            .scale(1.5) // Scale beyond screen edges for full coverage
            .color(1, 1, 1) // Ensure white color (for chalk effect)
            .saturate(0) // Keep it black and white
            .mult(solid(1, 1, 1, () => opacity)) // Control global opacity
            .blend(src(o3), videoBackgroundActive ? 0.3 : 0) // Blend with video if active
            .out();
    },

    // Neon glow effect
    neon: (level, isSilent, opacity) => {
        // Sample video if active
        if (videoBackgroundActive) {
            src(s0).out(o3);
        } else {
            solid(0, 0, 0, 0).out(o3);
        }
        
        // Neon base
        osc(10, 0.1, 1.5)
            .color(0.5, 0.1, () => 0.2 + level * 3)
            .saturate(2)
            .kaleid(5)
            .scale(1.5)
            .rotate(() => time * 0.1 * (isSilent ? 0.05 : 0.5))
            .modulate(
                noise(3).scale(2),
                () => 0.05 + level * 0.2
            )
            .blend(o0, 0.8)
            .out(o0);
            
        // Neon lines
        shape(2, 0.01, 0.5)
            .scale(2)
            .repeat(5, 5)
            .modulate(
                noise(5).scale(1.5),
                () => 0.1 + level * 0.5
            )
            .scrollX(() => Math.sin(time * 0.1) * 0.05)
            .scrollY(() => Math.cos(time * 0.1) * 0.05)
            .color(0.5, 0.8, 1.0)
            .add(
                shape(4, 0.01, 0.5)
                .scale(() => 1 + level * 4)
                .rotate(() => time * 0.2)
                .color(1, 0.5, 0.8)
            )
            .scale(1.5)
            .mult(
                osc(20, 0.01, 0)
                .color(2, 1, 2)
                .kaleid(9)
            )
            .blend(o1, 0.8)
            .out(o1);
            
        // Reactive glow with video blend
        src(o0)
            .layer(src(o1))
            // Modulate with video if active for color effects
            .modulate(
                src(o3).pixelate(50, 50).brightness(0.2).contrast(1.5),
                videoBackgroundActive ? 0.1 : 0
            )
            .scale(1.01)
            .brightness(0.1)
            .saturate(() => 1 + level * 2)
            .posterize(5)
            .blend(o2, 0.9)
            .mult(solid(1, 1, 1, () => opacity))
            .out(o2);
            
        // Final render with neon glow and video blend
        src(o2)
            .layer(
                src(o2)
                .brightness(0.5)
                .blur(0.5)
                .mask(src(o1).thresh(0.5))
                .blend(src(o0), 0.5)
            )
            // Blend with video source for final composition
            .blend(
                src(o3),
                videoBackgroundActive ? () => 0.2 + level * 0.2 : 0
            )
            .out();
    },

    // Geometric patterns
    geometric: (level, isSilent, opacity) => {
        // Base pattern
        shape(4, 0.4, 0)
            .repeat(() => 3 + level * 5, () => 3 + level * 5)
            .scale(() => 0.5 + level * 2)
            .rotate(() => time * 0.1)
            .kaleid(() => Math.floor(3 + level * 8))
            .scale(1.5)
            .out(o0);
            
        // Modulated pattern
        shape(3, 0.3, 0.01)
            .scale(() => 2 + level * 3)
            .rotate(() => time * -0.2)
            .color(1, 1, 1)
            .mult(
                osc(20, 0.1, 0)
                .rotate(() => time * 0.05)
                .scale(2)
            )
            .modulate(
                noise(3, 0.1).scale(5),
                () => 0.2 + level * 0.3
            )
            .out(o1);
            
        // Combined geometry
        src(o0)
            .diff(src(o1))
            .out(o2);
            
        // Final output with geometric style
        src(o2)
            .modulate(
                src(o2).rotate(0.1).scale(1.01),
                0.1
            )
            .color(1, 1, 1)
            .contrast(1.2)
            .saturate(0)
            .scale(1.5) // Fill screen
            .mult(solid(1, 1, 1, () => opacity))
            .out();
    },

    // Particle system
    particles: (level, isSilent, opacity) => {
        // Particle source
        noise(10, 0.1)
            .thresh(0.6)
            .mult(
                noise(3, 0.01)
                .thresh(() => 0.3 + level * 0.5)
            )
            .modulate(
                noise(3, 0.1).scale(5),
                () => 0.1 + level * 0.2
            )
            .scrollY(() => time * (isSilent ? 0.05 : 0.5 + level))
            .scrollX(() => Math.sin(time * 0.1) * 0.05)
            .scale(1.5)
            .out(o0);
            
        // Secondary particle layer
        noise(5, 0.1)
            .thresh(0.4)
            .mult(
                shape(99, () => 0.01 + level * 0.1, 0)
                .scale(() => 10 + level * 30)
                .repeat(3, 3)
            )
            .scrollY(() => -time * (isSilent ? 0.1 : 0.7 + level * 0.5))
            .scale(1.5)
            .rotate(() => time * 0.05)
            .out(o1);
            
        // Flow field
        noise(3, 0.1)
            .thresh(0.3)
            .mult(
                osc(5, 0.1)
                .kaleid(9)
                .rotate(() => time * 0.1)
            )
            .scale(1.5)
            .out(o2);
            
        // Final particle system
        src(o0)
            .layer(
                src(o1)
                .blend(src(o2), 0.3)
            )
            .modulate(
                src(o2).scale(1.1),
                () => 0.05 + level * 0.1
            )
            .scale(1.2)
            .color(1, 1, 1)
            .saturate(0)
            .mult(solid(1, 1, 1, () => opacity))
            .out();
    },

    // Waveform visualization
    waveform: (level, isSilent, opacity) => {
        // Waveform base
        shape(99, () => 0.01 + level * 0.1, 0)
            .scale(() => 5 + level * 30)
            .repeat(1, 4) // Horizontal waveform lines
            .scrollY(0.2)
            .modulate(
                noise(5, 0.1).scale(0.5),
                () => level * 0.2
            )
            .scale(1.5)
            .out(o0);
            
        // Circular waveform
        shape(99, () => 0.02 + level * 0.1, 0)
            .scale(() => 2 + level * 10)
            .repeat(5, 1)
            .modulate(
                osc(10, 0.1)
                .rotate(() => time * 0.2)
                .scale(2),
                () => 0.1 + level * 0.2
            )
            .rotate(() => time * 0.1)
            .scale(1.5)
            .out(o1);
            
        // Freq spectrum
        shape(4, 0.5, 0)
            .scale(() => 0.5 + level * 3, 0.1)
            .repeat(10, 1)
            .scrollX(() => -time * 0.1)
            .scale(1.5)
            .out(o2);
            
        // Final waveform visualization
        src(o0)
            .layer(
                src(o1)
                .blend(src(o2), 0.5)
            )
            .modulate(
                noise(2, 0.1).scale(2),
                0.05
            )
            .scale(1.2)
            .color(1, 1, 1)
            .saturate(0)
            .mult(solid(1, 1, 1, () => opacity))
            .out();
    },

    // New visualizations inspired by awesome-audio-visualization

    // Circular Wave - inspired by Circular Audio Wave visualization mentioned in the repo
    circularWave: (level, isSilent, opacity) => {
        // Create concentric circular waves
        shape(99, () => 0.01 + level * 0.15, 0) // Thin circle outline
            .scale(() => 5 + level * 15)
            .add(
                shape(99, () => 0.01 + level * 0.1, 0)
                .scale(() => 4 + level * 13)
            )
            .add(
                shape(99, () => 0.01 + level * 0.05, 0)
                .scale(() => 3 + level * 11)
            )
            .add(
                shape(99, () => 0.01 + level * 0.03, 0)
                .scale(() => 2 + level * 9)
            )
            .add(
                shape(99, () => 0.01 + level * 0.02, 0)
                .scale(() => 1 + level * 7)
            )
            .modulate(
                noise(3, 0.1).scale(2),
                () => 0.1 + level * 0.3
            )
            .rotate(() => time * 0.05)
            .scale(1.5)
            .out(o0);
        
        // Radial ripple effect
        shape(99, 0.3, 0.6)
            .scale(() => 0.5 + level * 8)
            .modulateScale(
                osc(8, 0.1, 0).rotate(() => time * 0.2),
                () => 0.2 + level * 0.8
            )
            .repeat(3, 3)
            .scale(1.5)
            .out(o1);
        
        // Circular frequency bars
        osc(30, 0.01, 0)
            .mult(
                shape(4, 0.6, 0.001)
                .scale(0.5, 1.5)
                .repeat(20, 1)
                .modulateScale(
                    noise(5).scale(0.1),
                    () => level * 0.5
                )
            )
            .scale(() => 0.5 + level * 2)
            .rotate(() => time * 0.1)
            .scale(1.5)
            .out(o2);
        
        // Combine for final circular audio wave
        src(o0)
            .layer(src(o1).blend(src(o2), 0.5))
            .modulate(
                noise(2, 0.1),
                0.05
            )
            .scale(1.2)
            .color(1, 1, 1)
            .saturate(0)
            .mult(solid(1, 1, 1, () => opacity))
            .out();
    },
    
    // Fractal Spirals - inspired by Audible Visuals mentioned in the repo
    fractals: (level, isSilent, opacity) => {
        // Archimedes spiral base
        shape(99, 0.01, 0.001)
            .scale(() => 0.5 + level * 5)
            .scrollX(() => Math.sin(time * 0.2) * 0.1)
            .scrollY(() => Math.cos(time * 0.2) * 0.1)
            .repeat(16, 16)
            .modulateScale(
                osc(10, 0.1, 0),
                () => 0.1 + level * 0.5
            )
            .scale(1.5)
            .rotate(() => time * 0.05)
            .out(o0);
        
        // Fractal pattern
        osc(20, 0.01, 0)
            .color(1, 1, 1)
            .rotate(() => time * 0.1)
            .modulateScale(
                osc(5, 0.2, 0)
                .rotate(() => time * -0.1),
                () => 0.2 + level * 1.5
            )
            .scale(() => 0.8 + level * 3)
            .kaleid(() => Math.floor(2 + level * 7))
            .scale(1.5)
            .out(o1);
        
        // Recursive spiral layer
        shape(99, 0.2, 0.5)
            .scale(() => 0.1 + level * 2)
            .repeat(8, 8)
            .rotate(() => time * 0.1)
            .scrollX(() => Math.sin(time * 0.05) * 0.2)
            .scrollY(() => Math.cos(time * 0.05) * 0.2)
            .modulate(
                noise(3, 0.1).scale(3),
                () => 0.1 + level * 0.2
            )
            .scale(1.5)
            .out(o2);
        
        // Final fractal pattern
        src(o0)
            .diff(src(o1))
            .layer(src(o2).blend(src(o0), 0.3))
            .modulate(
                src(o0).scale(1.01).rotate(0.01),
                0.1
            )
            .scale(1.2)
            .color(1, 1, 1)
            .saturate(0)
            .mult(solid(1, 1, 1, () => opacity))
            .out();
    },
    
    // Frequency Grid - inspired by audioMotion-analyzer in the repo
    frequencyGrid: (level, isSilent, opacity) => {
        // Grid base
        osc(40, 0.05, 0)
            .thresh(0.5)
            .mult(
                osc(40, 0.1, 0)
                .rotate(Math.PI/2)
                .thresh(0.5)
            )
            .scale(1.5)
            .out(o0);
        
        // Frequency bars
        shape(4, 0.9, 0.01)
            .scale(0.5, () => 0.1 + level * 3)
            .repeat(16, 1)
            .modulateScale(
                noise(5, 0.1).scale(0.5),
                () => level * 0.5
            )
            .scale(1.5)
            .out(o1);
        
        // Frequency dots/peaks
        shape(99, 0.1, 0.4)
            .scale(0.2, () => 0.1 + level * 2)
            .repeat(16, 8)
            .modulateScale(
                osc(10, 0.1, 0),
                () => 0.1 + level * 0.3
            )
            .scale(1.5)
            .out(o2);
        
        // Final frequency grid visualization
        src(o0)
            .layer(
                src(o1)
                .mask(src(o0).invert())
            )
            .layer(
                src(o2)
                .mask(src(o0).thresh(0.7))
            )
            .modulate(
                noise(2, 0.01),
                0.05
            )
            .scale(1.2)
            .color(1, 1, 1)
            .saturate(0)
            .mult(solid(1, 1, 1, () => opacity))
            .out();
    },
    
    // Voronoi Field - inspired by various reactive cell-based visualizations
    voronoiField: (level, isSilent, opacity) => {
        // Voronoi cells base
        voronoi(40, 0.3, 0.2)
            .modulateScale(
                noise(4, 0.1).scale(2),
                () => 0.3 + level * 1.5
            )
            .scale(1.5)
            .out(o0);
        
        // Moving points
        shape(99, 0.15, 0.5)
            .scale(0.15)
            .repeat(10, 10)
            .scrollX(() => Math.sin(time * 0.1) * 0.1)
            .scrollY(() => Math.cos(time * 0.1) * 0.1)
            .modulateScale(
                noise(3, 0.2),
                () => 0.1 + level * 0.5
            )
            .scale(1.5)
            .out(o1);
        
        // Cell borders
        voronoi(20, 0.15, 0.05)
            .thresh(0.5)
            .modulateScale(
                osc(8, 0.1, 0).rotate(() => time * 0.1),
                () => 0.1 + level * 0.4
            )
            .scale(1.5)
            .out(o2);
        
        // Final voronoi field visualization
        src(o0)
            .mult(src(o1))
            .diff(src(o2))
            .modulate(
                src(o0).scale(1.01),
                0.1
            )
            .scale(1.2)
            .color(1, 1, 1)
            .saturate(0)
            .mult(solid(1, 1, 1, () => opacity))
            .out();
    },
    
    // Liquid Landscape - inspired by The Force mentioned in the repo
    liquidLandscape: (level, isSilent, opacity) => {
        // Liquid base
        noise(3, 0.1)
            .mult(
                osc(8, 0.1, 1)
                .modulate(
                    noise(3, 0.1),
                    () => 0.2 + level * 0.8
                )
            )
            .scale(1.5)
            .out(o0);
        
        // Flowing landscape
        noise(5, 0.1)
            .thresh(() => 0.3 + level * 0.4)
            .modulateScale(
                osc(6, 0.1, 0)
                .rotate(() => time * 0.2),
                () => 0.2 + level * 1
            )
            .scale(() => 1 + level * 2)
            .scrollX(() => time * 0.05)
            .scrollY(() => Math.sin(time * 0.1) * 0.05)
            .scale(1.5)
            .out(o1);
        
        // Height map
        noise(2, 0.1)
            .thresh(0.4)
            .modulateScale(
                shape(99, 0.3, 0.6)
                .scale(() => 0.5 + level * 3)
                .rotate(() => time * 0.1),
                () => 0.1 + level * 0.4
            )
            .scale(1.5)
            .out(o2);
        
        // Final liquid landscape
        src(o0)
            .diff(src(o1))
            .layer(
                src(o2)
                .mask(src(o1).thresh(0.5))
                .blend(src(o0), 0.3)
            )
            .modulate(
                src(o0).scale(1.01),
                () => 0.05 + level * 0.2
            )
            .scale(1.2)
            .color(1, 1, 1)
            .saturate(0)
            .mult(solid(1, 1, 1, () => opacity))
            .out();
    },
    
    // Neon Pulse - bright, colorful lines reacting to audio
    neonPulse: (level, isSilent, opacity) => {
        // Neon base
        osc(10, 0.1, 1.5)
            .color(0.5, 0.1, () => 0.2 + level * 3)
            .saturate(2)
            .kaleid(5)
            .scale(1.5)
            .rotate(() => time * 0.1 * (isSilent ? 0.05 : 0.5))
            .modulate(
                noise(3).scale(2),
                () => 0.05 + level * 0.2
            )
            .blend(o0, 0.8)
            .out(o0);
            
        // Neon lines
        shape(2, 0.01, 0.5)
            .scale(2)
            .repeat(5, 5)
            .modulate(
                noise(5).scale(1.5),
                () => 0.1 + level * 0.5
            )
            .scrollX(() => Math.sin(time * 0.1) * 0.05)
            .scrollY(() => Math.cos(time * 0.1) * 0.05)
            .color(0.5, 0.8, 1.0)
            .add(
                shape(4, 0.01, 0.5)
                .scale(() => 1 + level * 4)
                .rotate(() => time * 0.2)
                .color(1, 0.5, 0.8)
            )
            .scale(1.5)
            .mult(
                osc(20, 0.01, 0)
                .color(2, 1, 2)
                .kaleid(9)
            )
            .blend(o1, 0.8)
            .out(o1);
            
        // Reactive glow
        src(o0)
            .layer(src(o1))
            .modulate(
                noise(2, 0.1).scale(3),
                0.01
            )
            .scale(1.01)
            .brightness(0.1)
            .saturate(() => 1 + level * 2)
            .posterize(5)
            .blend(o2, 0.9)
            .mult(solid(1, 1, 1, () => opacity))
            .out(o2);
            
        // Final render with neon glow
        src(o2)
            .layer(
                src(o2)
                .brightness(0.5)
                .blur(0.5)
                .mask(src(o1).thresh(0.5))
                .blend(src(o0), 0.5)
            )
            .out();
    },
    
    // Mandala - circular patterns that evolve with the audio
    mandala: (level, isSilent, opacity) => {
        // Create concentric circular waves
        shape(99, () => 0.01 + level * 0.15, 0) // Thin circle outline
            .scale(() => 5 + level * 15)
            .add(
                shape(99, () => 0.01 + level * 0.1, 0)
                .scale(() => 4 + level * 13)
            )
            .add(
                shape(99, () => 0.01 + level * 0.05, 0)
                .scale(() => 3 + level * 11)
            )
            .add(
                shape(99, () => 0.01 + level * 0.03, 0)
                .scale(() => 2 + level * 9)
            )
            .add(
                shape(99, () => 0.01 + level * 0.02, 0)
                .scale(() => 1 + level * 7)
            )
            .modulate(
                noise(3, 0.1).scale(2),
                () => 0.1 + level * 0.3
            )
            .rotate(() => time * 0.05)
            .scale(1.5)
            .out(o0);
        
        // Radial ripple effect
        shape(99, 0.3, 0.6)
            .scale(() => 0.5 + level * 8)
            .modulateScale(
                osc(8, 0.1, 0).rotate(() => time * 0.2),
                () => 0.2 + level * 0.8
            )
            .repeat(3, 3)
            .scale(1.5)
            .out(o1);
        
        // Circular frequency bars
        osc(30, 0.01, 0)
            .mult(
                shape(4, 0.6, 0.001)
                .scale(0.5, 1.5)
                .repeat(20, 1)
                .modulateScale(
                    noise(5).scale(0.1),
                    () => level * 0.5
                )
            )
            .scale(() => 0.5 + level * 2)
            .rotate(() => time * 0.1)
            .scale(1.5)
            .out(o2);
        
        // Combine for final circular audio wave
        src(o0)
            .layer(src(o1).blend(src(o2), 0.5))
            .modulate(
                noise(2, 0.1),
                0.05
            )
            .scale(1.2)
            .color(1, 1, 1)
            .saturate(0)
            .mult(solid(1, 1, 1, () => opacity))
            .out();
    },
    
    // Liquid - flowing, fluid-like visualization with color shifts
    liquid: (level, isSilent, opacity) => {
        // Liquid base
        noise(3, 0.1)
            .mult(
                osc(8, 0.1, 1)
                .modulate(
                    noise(3, 0.1),
                    () => 0.2 + level * 0.8
                )
            )
            .scale(1.5)
            .out(o0);
        
        // Flowing landscape
        noise(5, 0.1)
            .thresh(() => 0.3 + level * 0.4)
            .modulateScale(
                osc(6, 0.1, 0)
                .rotate(() => time * 0.2),
                () => 0.2 + level * 1
            )
            .scale(() => 1 + level * 2)
            .scrollX(() => time * 0.05)
            .scrollY(() => Math.sin(time * 0.1) * 0.05)
            .scale(1.5)
            .out(o1);
        
        // Height map
        noise(2, 0.1)
            .thresh(0.4)
            .modulateScale(
                shape(99, 0.3, 0.6)
                .scale(() => 0.5 + level * 3)
                .rotate(() => time * 0.1),
                () => 0.1 + level * 0.4
            )
            .scale(1.5)
            .out(o2);
        
        // Final liquid landscape
        src(o0)
            .diff(src(o1))
            .layer(
                src(o2)
                .mask(src(o1).thresh(0.5))
                .blend(src(o0), 0.3)
            )
            .modulate(
                src(o0).scale(1.01),
                () => 0.05 + level * 0.2
            )
            .scale(1.2)
            .color(1, 1, 1)
            .saturate(0)
            .mult(solid(1, 1, 1, () => opacity))
            .out();
    },
    
    // Vaporwave - retro 80s/90s aesthetic with grids and neon colors
    vaporwave: (level, isSilent, opacity) => {
        // Base sunset gradient with blend mode that works well with video
        gradient(0.1)
            .add(osc(10, 0.1, 0.8).color(0.9, 0.4, 0.7))
            .add(shape(4, 0.7, 0).scrollY(0.3).color(0.9, 0.6, 0.9))
            .blend(src(o3), () => videoBackgroundActive ? 0.5 : 0) // Blend with video if active
            .mult(solid(1, 1, 1, () => opacity))
            .out(o0);
        
        // Grid floor with blend mode
        shape(2, 0.5, 0)
            .repeat(20, 6)
            .scale(1, 0.3)
            .scrollY(-0.7)
            .rotate(() => time * 0.05)
            .modulate(
                noise(3, 0.1),
                () => level * 0.3
            )
            .color(0.9, 0.2, 0.9)
            .blend(src(o3), () => videoBackgroundActive ? 0.4 : 0) // Blend with video if active
            .mult(solid(1, 1, 1, () => opacity * 0.8))
            .out(o1);
        
        // Sun/circle with glow effect
        shape(99, 0.5, 0)
            .scale(() => 0.5 + level * 0.5)
            .color(0.9, 0.4, 0.0)
            .add(
                shape(99, () => 0.3 + level * 0.2, 0)
                .color(0.9, 0.1, 0.4)
            )
            .mult(solid(1, 1, 1, () => opacity * 0.9))
            .out(o2);
        
        // Video input buffer (if active)
        solid(0, 0, 0, 0)
            .layer(src(s0).scale(1.1).scrollX(0.02).scrollY(0.02))
            .blend(noise(2, 0.1), 0.05)
            .out(o3);
        
        // Final composition with glitch effects
        src(o0)
            .layer(src(o1))
            .layer(src(o2))
            .modulate(
                noise(3, 0.1),
                () => level * 0.1
            )
            .blend(
                src(o3).pixelate(64, 32).scale(1.01).scrollX(0.001),
                () => videoBackgroundActive ? 0.2 : 0
            )
            .add(
                src(o3).posterize(3).contrast(1.5).pixelate(80, 40).mask(noise(3).thresh(0.3)),
                () => videoBackgroundActive ? 0.1 : 0
            )
            .mult(solid(1, 1, 1, () => opacity))
            .out();
    },

    // VHS Tape - enhanced version
    vhsTape: (level, isSilent, opacity) => {
        // If audio level is too low, hide most effects
        const audioActive = level > 0.05;
        const audioMultiplier = audioActive ? level * 2 : 0.01;
        
        // Only use video if it's actually enabled by the user
        if (videoBackgroundActive) {
            const videoBackground = document.getElementById('video-background');
            if (videoBackground) {
                videoBackground.style.display = 'block';
                videoBackground.style.opacity = '1.0';
                videoBackground.style.zIndex = '0'; // Make sure it's below our effects
            }
            
            // Capture video source to process and blend only if enabled
            src(s0).out(o3);
            
            // When video is active, base glitched effect on video
            src(s0)
                .pixelate(64, 64) // More extreme pixelation
                .modulate(
                    noise(3).add(osc(7, 0).thresh(0.5)), 
                    0.03 + (level * 0.04) // More distortion that reacts to audio
                )
                .scrollX(() => Math.sin(time * 0.2) * 0.01)
                .color(1.3, 0.85, 1.15) // More extreme color shift
                .contrast(1.2) // Higher contrast
                .brightness(0.05) // Darker for more dramatic look
                .out(o0);
        } else {
            // If video is not enabled, use static noise as base
            solid(0.1, 0.1, 0.1, 1) // Dark background
                .add(
                    noise(3)
                    .pixelate(64, 64)
                    .thresh(0.1)
                    .mult(osc(20, 0.1, 0).color(1.3, 0.85, 1.15))
                    .brightness(0.05)
                    .contrast(2)
                )
                .out(o3);
            
            // Create static-based glitched effect
            noise(10)
                .pixelate(64, 64)
                .modulate(
                    noise(3).add(osc(7, 0).thresh(0.5)), 
                    0.03 + (level * 0.04)
                )
                .scrollX(() => Math.sin(time * 0.2) * 0.01)
                .color(1.3, 0.85, 1.15)
                .contrast(1.2)
                .brightness(0.05)
                .out(o0);
        }
        
        // Make sure VHS effect is activated if available
        if (typeof window.activateVHSEffect === 'function' && 
            (typeof window.isVHSActive === 'undefined' || !window.isVHSActive)) {
            window.activateVHSEffect(document.getElementById('hydra-canvas'));
        }
        
        // Strong horizontal tracking lines that react to audio - only visible with sufficient audio
        osc(300, 0) // Higher frequency lines
            .rotate(Math.PI/2) // Rotate to make lines horizontal
            .thresh(0.7) // Thicker lines
            .color(1, 1, 1)
            .scrollX(() => time * (0.1 + level * 0.3)) // Scroll horizontally instead of vertically
            .scale(() => 1 + level * 5, 1) // Much stronger audio reaction on horizontal scale
            .mult(solid(1, 1, 1, () => audioActive ? 0.5 + level * 0.5 : 0)) // Only show with audio
            .out(o1);
        
        // VHS static/noise layer - more visible and reactive to audio
        noise(40)
            .thresh(() => 0.94 - (level * 0.1)) // Threshold changes with audio
            .mult(solid(1, 1, 1, () => audioActive ? 0.1 + level * 0.1 : 0.01)) // Very subtle if no audio
            .out(o2);
        
        // Final output with enhanced VHS effects
        src(o0)
            .layer(src(o1)) // Add tracking lines 
            .add(src(o2)) // Add noise grain
            
            // More dramatic color jitter tied to audio
            .color(
                () => 1 + Math.sin(time * 10) * 0.06 * audioMultiplier,
                () => 1 + Math.cos(time * 10) * 0.04 * audioMultiplier,
                () => 1 + Math.sin(time * 8) * 0.08 * audioMultiplier
            )
            
            // Head switching noise at bottom - larger and more visible with audio
            .layer(
                noise(10).thresh(0.08)
                .scale(1, 0.12) // Thicker bar
                .scrollY(-0.44)
                .mult(solid(1, 1, 1, () => audioActive ? 0.4 + level * 0.2 : 0)) // Only visible with audio
            )
            
            // More pronounced tracking jitter tied to audio
            .scrollX(() => Math.sin(time * 5 + Math.random()) * 0.008 * (audioActive ? level + 0.2 : 0.01))
            
            // More frequent vertical glitches tied to audio
            .scrollY(() => audioActive && Math.random() > (0.95 - level * 0.2) ? Math.random() * 0.04 - 0.02 : 0)
            
            // Enhanced RGB shift effect - more visible with audio
            .layer(
                src(o0)
                .scrollX(() => 0.003 + level * 0.002) // Audio reactive
                .scrollY(0.001)
                .color(1.4, 0, 0) // Stronger red
                .mult(solid(1, 1, 1, () => audioActive ? 0.25 + level * 0.1 : 0.05)) // Less visible without audio
            )
            .layer(
                src(o0)
                .scrollX(() => -0.003 - level * 0.002) // Audio reactive in opposite direction
                .scrollY(-0.001)
                .color(0, 0, 1.4) // Stronger blue
                .mult(solid(1, 1, 1, () => audioActive ? 0.15 + level * 0.1 : 0.03)) // Less visible without audio
            )
            
            // Horizontal scan lines - always somewhat visible but stronger with audio
            .layer(
                osc(800, 0, 0) // Higher frequency scan lines
                .rotate(Math.PI/2) // Rotate to make lines horizontal
                .thresh(0.85)
                .color(1, 1, 1)
                .mult(solid(1, 1, 1, () => 0.05 + (audioActive ? level * 0.1 : 0))) // Audio reactive
            )
            
            // Random horizontal glitches that happen occasionally with audio
            .layer(
                shape(4, 0.9, 0)
                .scale(2, 0.03)
                .scrollY(() => audioActive && Math.random() > 0.97 ? Math.random() * 2 - 1 : -2) // Only glitch with audio
                .color(2, 2, 2) // Bright white
                .mult(solid(1, 1, 1, () => audioActive && Math.random() > 0.97 ? 0.8 : 0)) // Only appear with audio
            )
            
            // Apply global opacity - make effect stronger with audio
            .mult(solid(1, 1, 1, () => opacity * (audioActive ? 1.0 : 0.5)))
            
            // Blend with source video for best results (only if video is active)
            .blend(src(o3), videoBackgroundActive ? 0.3 : 0.1)
            .out();
    },
};

// Call the setup function and start the visualization loop
setupAudio().then((audioData) => {
    if (!audioData) {
        console.error("Audio setup failed");
        return;
    }
    
    const { analyser, dataArray, bufferLength } = audioData;
    
    // Constants for silence detection
    const SILENCE_THRESHOLD = 5; // Threshold below which we consider silence
    const FADE_SPEED = 0.05; // Speed of fade to black during silence
    
    // State variables
    let currentOpacity = 0;
    let silenceFrames = 0;
    let lastAudioLevel = 0;
    
    function visualize() {
        requestAnimationFrame(visualize);
        
        // Get the frequency data
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate overall audio level
        let totalSum = 0;
        for (let i = 0; i < bufferLength; i++) {
            totalSum += dataArray[i];
        }
        const audioLevel = totalSum / bufferLength;
        
        // Silence detection
        const isSilent = audioLevel < SILENCE_THRESHOLD;
        
        if (isSilent) {
            silenceFrames++;
            // Gradually fade to black during silence
            if (currentOpacity > 0) {
                currentOpacity = Math.max(0, currentOpacity - FADE_SPEED);
            }
        } else {
            silenceFrames = 0;
            // Gradually fade in when sound is detected
            if (currentOpacity < 1) {
                currentOpacity = Math.min(1, currentOpacity + FADE_SPEED);
            }
        }
        
        // Normalize audio level (0-1)
        const normalizedLevel = Math.min(1, audioLevel / 128);
        
        // Store last non-zero audio level for transitions
        if (normalizedLevel > 0.05) {
            lastAudioLevel = normalizedLevel;
        }
        
        // Use a transition level to avoid abrupt changes
        const transitionLevel = isSilent ? Math.max(0.05, lastAudioLevel * 0.3) : normalizedLevel;
        
        // Update the VHS effect with audio level, if the function exists
        if (typeof window.updateVHSAudio === 'function') {
            window.updateVHSAudio(transitionLevel);
        }
        
        // Ensure video is properly captured as a source
        if (videoBackgroundActive) {
            src(s0).out(o3);
            
            // Ensure color sampling is active when video is visible
            if (!isColorSamplingActive && activeVisualizations.size > 0) {
                startColorSampling();
            }
        } else if (isColorSamplingActive && activeVisualizations.size <= 1) {
            // Stop color sampling if no longer needed
            stopColorSampling();
        }
        
        try {
            // Get active visualizations as array
            const activeVizArray = Array.from(activeVisualizations);
            
            // If we have no active visualizations or VHS is the only one
            if (activeVizArray.length === 0 || 
                (activeVizArray.length === 1 && activeVizArray[0] === 'vhsTape')) {
                // Just render black or let VHS handle it
                solid(0, 0, 0, 1).out(o0);
                return;
            }
            
            // If we have only one active visualization
            if (activeVizArray.length === 1) {
                const vizName = activeVizArray[0];
                if (visualizations[vizName]) {
                    // Run the visualization normally
                    visualizations[vizName](transitionLevel, isSilent, currentOpacity);
                }
                return;
            }
            
            // For multiple visualizations, we need a more sophisticated approach:
            
            // 1. Start with a clean slate
            solid(0, 0, 0, 1).out(o0);
            
            // 2. Run visualizations one by one with proper blending
            for (let i = 0; i < activeVizArray.length; i++) {
                const vizName = activeVizArray[i];
                
                if (!visualizations[vizName]) continue;
                
                // Special handling for complex visualizations
                if (vizName === 'geometric') {
                    // For geometric, we need to use colors from video and be careful with blending
                    try {
                        // Store current main output
                        src(o0).out(o2);
                        
                        // Clear o0 for the new viz
                        solid(0, 0, 0, 0).out(o0);
                        
                        // Sample video colors
                        const color = getVideoColor(0);
                        const normalizedColor = {
                            r: color.r / 255, 
                            g: color.g / 255, 
                            b: color.b / 255
                        };
                        
                        // Run geometric with video colors
                        runGeometricWithColors(
                            transitionLevel,
                            isSilent,
                            currentOpacity * 0.8,
                            normalizedColor
                        );
                        
                        // Blend back with stored output
                        src(o0).blend(src(o2), 0.7).out(o0);
                    } catch (err) {
                        console.warn("Error running geometric visualization:", err);
                        // Fall back to standard rendering
                        visualizations[vizName](transitionLevel, isSilent, currentOpacity * 0.7);
                    }
                    continue;
                }
                
                // For other visualizations:
                // Store current output
                src(o0).out(o2);
                
                // Clear main buffer for new visualization
                solid(0, 0, 0, 0).out(o0);
                
                // Customize params based on video colors if appropriate
                if (videoBackgroundActive && i > 0) {
                    // Use a different color for each visualization
                    const color = getVideoColor(i % videoColors.length);
                    const hslColor = rgbToHsl(color);
                    
                    // Apply custom parameters for this visualization
                    runVisualizationWithVideoColors(
                        vizName, 
                        transitionLevel,
                        isSilent,
                        currentOpacity * 0.7,
                        color,
                        hslColor
                    );
                } else {
                    // Standard rendering
                    visualizations[vizName](transitionLevel, isSilent, currentOpacity * 0.7);
                }
                
                // Blend with previous output - use different blend modes for variety
                const blendModes = ['add', 'mult', 'diff', 'layer'];
                const blendMode = blendModes[i % blendModes.length];
                
                if (blendMode === 'add') {
                    src(o0).add(src(o2), 0.8).out(o0);
                } else if (blendMode === 'mult') {
                    src(o0).mult(src(o2), 0.8).out(o0);
                } else if (blendMode === 'diff') {
                    src(o0).diff(src(o2), 0.5).out(o0);
                } else { // layer
                    src(o2).layer(src(o0).thresh(0.1, 0).mult(solid(1,1,1,0.8))).out(o0);
                }
            }
        } catch (error) {
            console.error("Error in visualization render:", error);
            // Fallback to single visualization on error
            if (visualizations[currentViz]) {
                visualizations[currentViz](transitionLevel, isSilent, currentOpacity);
            }
        }
    }

    visualize();
}).catch(err => {
    console.error("Error in audio visualization setup:", err);
});

// Function to run geometric visualization with video colors
function runGeometricWithColors(audioLevel, isSilent, opacity, color) {
    try {
        // Extract or compute parameters based on video colors
        const colorMultiplier = Math.max(0.3, (color.r + color.g + color.b) / 3);
        const hue = (color.r * 0.3 + color.g * 0.59 + color.b * 0.11) * 360;
        
        // Create a custom version of the geometric visualization with color influence
        shape(4) // square base shape
            .color(color.r, color.g, color.b) // Use video colors
            .scale(() => 1.5 + audioLevel * 2) // Scale based on audio
            .rotate(() => time * 0.1)
            .repeat(() => Math.floor(3 + audioLevel * 5)) // More repetition with louder audio
            .kaleid(() => Math.floor(2 + audioLevel * 3))
            .scale(() => 0.9 + audioLevel * 0.3)
            .modulate(
                noise(() => 2 + audioLevel * 5)
                    .color(color.r, color.g, color.b)
                    .brightness(() => -0.5 + audioLevel * 1)
            )
            .out(o0);
    } catch (err) {
        console.warn("Error in geometric color visualization:", err);
        // Fall back to standard geometric visualization
        if (visualizations.geometric) {
            visualizations.geometric(audioLevel, isSilent, opacity);
        }
    }
}

// Function to run any visualization with video color influence
function runVisualizationWithVideoColors(vizName, audioLevel, isSilent, opacity, rgbColor, hslColor) {
    try {
        // Default to standard visualization if no special handling
        if (!visualizations[vizName]) {
            return;
        }
        
        // Add specific color-influenced versions for each visualization
        switch(vizName) {
            case 'chalk':
                // Chalk with video color influence
                osc(10, 0.1, () => audioLevel * 1.5)
                    .color(rgbColor.r/255, rgbColor.g/255, rgbColor.b/255)
                    .kaleid(5)
                    .mask(shape(4, 0.5, 0.001)
                        .scale(() => 1.5 + audioLevel * 2)
                        .repeat(5, 5)
                    )
                    .modulateScale(noise(2, 0.1), 0.5)
                    .out(o0);
                break;
                
            case 'neon':
                // Neon with video colors
                osc(30, 0.1, () => audioLevel * 2)
                    .color(rgbColor.r/255, rgbColor.g/255, rgbColor.b/255)
                    .rotate(() => time * 0.1)
                    .modulate(noise(3, 0.1).brightness(-0.5))
                    .out(o0);
                break;
                
            // Add other visualization cases as needed
                
            default:
                // For other visualizations, just use the standard implementation
                visualizations[vizName](audioLevel, isSilent, opacity);
                break;
        }
    } catch (err) {
        console.warn(`Error applying video colors to ${vizName}:`, err);
        // Fall back to standard visualization
        visualizations[vizName](audioLevel, isSilent, opacity);
    }
}

// Video background toggle update
function updateVideoBackground(enabled) {
    // Update state before anything else
    videoBackgroundActive = enabled;
    
    // Get references
    const videoBackground = document.getElementById('video-background');
    const hydraCanvas = document.getElementById('hydra-canvas');
    
    if (!videoBackground || !hydraCanvas) {
        console.error("Missing video or hydra elements!");
        return;
    }
    
    // Handle VHS state - don't interfere with VHS if it's active
    if (typeof window.isVHSActive !== 'undefined' && window.isVHSActive) {
        if (!enabled) {
            console.log("VHS is active, not disabling video");
            return; // Don't disable video when VHS is active
        }
    }
    
    if (enabled) {
        // Show video with proper styling
        videoBackground.style.display = 'block';
        videoBackground.style.opacity = '1.0'; // Fully visible
        
        // Make canvas fully visible - effects will blend with video
        hydraCanvas.style.opacity = '1.0';
        
        // Track if we're already attempting to play
        if (videoBackground.paused && !window.isPlayingRequested) {
            window.isPlayingRequested = true;
            
            videoBackground.play().catch(err => {
                console.error('Error playing video:', err);
                window.isPlayingRequested = false;
                
                // If there's an error with the local file, try switching to the sample video
                const sampleVideoToggle = document.getElementById('use-sample-video');
                if (sampleVideoToggle && !sampleVideoToggle.checked) {
                    console.log('Attempting to use sample video instead...');
                    sampleVideoToggle.checked = true;
                    
                    // Trigger the change event to update the video source
                    const event = new Event('change');
                    sampleVideoToggle.dispatchEvent(event);
                }
            }).then(() => {
                window.isPlayingRequested = false;
            });
        }
        
        // Start color sampling if there are multiple visualizations active
        if (activeVisualizations.size > 1) {
            startColorSampling();
        }
        
        console.log("Video background enabled");
    } else {
        // Only hide video if VHS effect is not active
        if (typeof window.isVHSActive === 'undefined' || !window.isVHSActive) {
            // Hide video
            videoBackground.style.opacity = '0';
            
            // Optional: pause the video when hidden to save resources
            videoBackground.pause();
            
            // Make canvas fully opaque
            hydraCanvas.style.opacity = '1';
            
            // Stop color sampling if it's active
            if (isColorSamplingActive) {
                stopColorSampling();
            }
            
            console.log("Video background disabled");
        }
    }
    
    // Update Hydra
    if (enabled) {
        // Only reinitialize source if needed
        if (window.s0.src && window.s0.src._isDestroyed) {
            s0.init({src: videoBackground, dynamic: true});
        }
        src(s0).out(o3);
    } else if (typeof window.isVHSActive === 'undefined' || !window.isVHSActive) {
        // Only clear if VHS effect is not active
        solid(0, 0, 0, 0).out(o3);
    }
    
    // Notify any other components that care about video state
    if (typeof window.videoStateChanged === 'function') {
        window.videoStateChanged(enabled);
    }
}

// Initialize color sampling on page load
document.addEventListener('DOMContentLoaded', () => {
    console.log("Initializing color sampling module");
    
    // Initialize color sampling canvas
    initColorSampling();
    
    // Add video toggle functionality
    const videoToggle = document.getElementById('video-toggle');
    if (videoToggle) {
        videoToggle.addEventListener('change', function(e) {
            // Update video background state
            updateVideoBackground(e.target.checked);
            
            // Start or stop color sampling based on toggle state and active visualizations
            if (e.target.checked && activeVisualizations.size > 1) {
                startColorSampling();
            } else if (!e.target.checked && isColorSamplingActive && 
                       (!activeVisualizations.has('vhsTape') || activeVisualizations.size <= 1)) {
                stopColorSampling();
            }
        });
    }
    
    // Add a button to toggle between single and multi-visualization modes
    const buttonGroup = document.querySelector('.button-group');
    if (buttonGroup && !document.querySelector('.multi-viz-toggle')) {
        const toggleButton = document.createElement('button');
        toggleButton.className = 'multi-viz-toggle';
        toggleButton.textContent = 'Enable Multi-Viz Mode';
        toggleButton.style.marginTop = '10px';
        toggleButton.style.padding = '5px';
        toggleButton.style.backgroundColor = 'rgba(70, 130, 180, 0.6)';
        toggleButton.style.border = 'none';
        toggleButton.style.borderRadius = '3px';
        toggleButton.style.color = 'white';
        toggleButton.style.cursor = 'pointer';
        
        toggleButton.addEventListener('click', function() {
            const isMultiMode = this.classList.contains('active');
            
            if (isMultiMode) {
                // Switching to single mode
                this.classList.remove('active');
                this.textContent = 'Enable Multi-Viz Mode';
                this.style.backgroundColor = 'rgba(70, 130, 180, 0.6)';
                
                // If we have multiple visualizations, keep only the first one
                if (activeVisualizations.size > 1) {
                    const firstViz = Array.from(activeVisualizations)[0];
                    activeVisualizations.clear();
                    activeVisualizations.add(firstViz);
                    currentViz = firstViz;
                    
                    // Update UI
                    updateVisualizationUI();
                }
                
                // Stop color sampling if it's active
                if (isColorSamplingActive) {
                    stopColorSampling();
                }
            } else {
                // Switching to multi mode
                this.classList.add('active');
                this.textContent = 'Disable Multi-Viz Mode';
                this.style.backgroundColor = 'rgba(220, 20, 60, 0.6)';
                
                // Start color sampling if video is active
                if (videoBackgroundActive) {
                    startColorSampling();
                }
                
                // Show helper tip
                alert('Multi-visualization mode enabled! Click on multiple visualization buttons to layer them. The video background colors will be sampled to influence the visualizations.');
            }
        });
        
        buttonGroup.parentElement.appendChild(toggleButton);
    }
});

// Update visualization buttons based on active set
function updateVisualizationUI() {
    try {
        const buttonGroup = document.querySelector('.button-group');
        if (!buttonGroup) return;
        
        // Mark container when multiple selections are active
        if (activeVisualizations.size > 1) {
            buttonGroup.parentElement.classList.add('multi-viz-active');
        } else {
            buttonGroup.parentElement.classList.remove('multi-viz-active');
        }

        // Update button active state
        document.querySelectorAll('.viz-button').forEach(btn => {
            const vizName = btn.getAttribute('data-viz');
            if (activeVisualizations.has(vizName)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Update helper message
        let helperMessage = document.querySelector('.multi-select-helper');
        if (!helperMessage) {
            helperMessage = document.createElement('div');
            helperMessage.className = 'multi-select-helper';
            helperMessage.style.color = 'white';
            helperMessage.style.fontSize = '12px';
            helperMessage.style.opacity = '0.7';
            helperMessage.style.marginTop = '8px';
            helperMessage.style.textAlign = 'center';
            buttonGroup.parentElement.appendChild(helperMessage);
        }
        
        // Show different messages based on active visualizations
        if (activeVisualizations.size > 1) {
            helperMessage.textContent = 'Multiple visualizations active - colors sampled from video';
            // Start color sampling if it's not already active
            if (!isColorSamplingActive) {
                startColorSampling();
            }
        } else {
            helperMessage.textContent = 'Click to select or Ctrl+click for multiple';
            // Stop color sampling if not needed
            if (isColorSamplingActive && !videoBackgroundActive) {
                stopColorSampling();
            }
        }
    } catch (error) {
        console.error("Error updating visualization UI:", error);
    }
}

// UI Controls
document.addEventListener('DOMContentLoaded', () => {
    try {
        // Toggle panel
        const toggleBtn = document.getElementById('toggle-panel');
        const controlPanel = document.getElementById('control-panel');
        
        if (toggleBtn && controlPanel) {
            toggleBtn.addEventListener('click', () => {
                controlPanel.classList.toggle('hidden');
            });
        }
        
        // Visualization selection
        const vizButtons = document.querySelectorAll('.viz-button');
        
        vizButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent default to handle everything ourselves
                
                // Get the selected visualization
                const selectedViz = button.getAttribute('data-viz');
                
                // Debug log
                console.log(`Toggling visualization: ${selectedViz}`);
                
                // Special handling for VHS Tape - needs to be exclusive
                if (selectedViz === 'vhsTape') {
                    // If VHS is being deactivated
                    if (activeVisualizations.has('vhsTape')) {
                        // VHS is active, deactivate it
                        activeVisualizations.delete('vhsTape');
                        
                        // Deactivate external VHS effect if it exists
                        if (typeof window.isVHSActive !== 'undefined' && window.isVHSActive) {
                            if (typeof window.deactivateVHSEffect === 'function') {
                                try {
                                    window.deactivateVHSEffect();
                                    console.log("Deactivated external VHS effect");
                                } catch (err) {
                                    console.warn("Error deactivating external VHS effect:", err);
                                }
                            }
                        }
                        
                        // Update UI
                        updateVisualizationUI();
                        
                        // Keep video state consistent
                        setTimeout(() => {
                            if (videoBackgroundActive) {
                                enforceVideoVisibility(true);
                            }
                        }, 100);
                        
                        return;
                    } else {
                        // VHS is not active, make it the only active visualization
                        activeVisualizations.clear();
                        activeVisualizations.add('vhsTape');
                        
                        // Activate external VHS effect
                        if (typeof window.activateVHSEffect === 'function') {
                            try {
                                const hydraCanvas = document.getElementById('hydra-canvas');
                                window.activateVHSEffect(hydraCanvas);
                                console.log("Activated external VHS effect");
                            } catch (err) {
                                console.warn("Error activating external VHS effect:", err);
                            }
                        }
                        
                        // Update UI
                        updateVisualizationUI();
                        return;
                    }
                }
                
                // Check if the visualization exists
                if (visualizations[selectedViz]) {
                    // If VHS is currently active, deactivate it first
                    if (activeVisualizations.has('vhsTape')) {
                        activeVisualizations.delete('vhsTape');
                        
                        // Deactivate external VHS effect
                        if (typeof window.isVHSActive !== 'undefined' && window.isVHSActive) {
                            if (typeof window.deactivateVHSEffect === 'function') {
                                try {
                                    window.deactivateVHSEffect();
                                    console.log("Deactivated external VHS effect");
                                } catch (err) {
                                    console.warn("Error deactivating external VHS effect:", err);
                                }
                            }
                        }
                    }
                
                    // For all other visualizations - handle multi-select or toggle
                    if (e.ctrlKey || e.metaKey) {
                        // Multi-select mode (Ctrl/Cmd + click)
                        if (activeVisualizations.has(selectedViz)) {
                            // Toggle off if already active
                            activeVisualizations.delete(selectedViz);
                            console.log(`Removed ${selectedViz} from active visualizations`);
                        } else {
                            // Add to active visualizations
                            activeVisualizations.add(selectedViz);
                            console.log(`Added ${selectedViz} to active visualizations`);
                        }
                    } else {
                        // Single-select mode (normal click) - just toggle the clicked one
                        if (activeVisualizations.has(selectedViz)) {
                            // If this is the only active visualization, keep it active
                            if (activeVisualizations.size > 1) {
                                activeVisualizations.delete(selectedViz);
                            }
                        } else {
                            // Clear others and set this as the only active one
                            activeVisualizations.clear();
                            activeVisualizations.add(selectedViz);
                        }
                        
                        // Update currentViz for compatibility with old code
                        currentViz = selectedViz;
                    }
                    
                    // Special handling for geometric effect
                    if (selectedViz === 'geometric' && activeVisualizations.has('geometric')) {
                        // Ensure geometric gets proper initialization
                        try {
                            // Force geometry shader to reinitialize with proper params
                            console.log("Ensuring geometric visualization is properly initialized");
                            
                            // Add any special initialization for geometric here if needed
                            
                            // Start color sampling for geometric visualization
                            if (!isColorSamplingActive) {
                                startColorSampling();
                            }
                        } catch (err) {
                            console.warn("Error initializing geometric visualization:", err);
                        }
                    }
                    
                    // Update UI and hydra state
                    updateVisualizationUI();
                    
                    // Clear hydra buffers before applying new visualizations
                    solid(0, 0, 0, 0).out(o0);
                    solid(0, 0, 0, 0).out(o1);
                    solid(0, 0, 0, 0).out(o2);
                    
                    // Keep video in o3 if active
                    if (videoBackgroundActive) {
                        src(s0).out(o3);
                    } else {
                        solid(0, 0, 0, 0).out(o3);
                    }
                    
                    // Log active visualizations
                    console.log(`Currently active: ${Array.from(activeVisualizations).join(', ')}`);
                } else {
                    console.error(`Visualization '${selectedViz}' not found!`);
                }
            });
        });
        
        // Add helper message for multi-select if not already added
        const buttonGroup = document.querySelector('.button-group');
        if (buttonGroup && !document.querySelector('.multi-select-helper')) {
            const helperMessage = document.createElement('div');
            helperMessage.className = 'multi-select-helper';
            helperMessage.textContent = 'Ctrl+click to select multiple visualizations';
            helperMessage.style.color = 'white';
            helperMessage.style.fontSize = '12px';
            helperMessage.style.opacity = '0.7';
            helperMessage.style.marginTop = '8px';
            helperMessage.style.textAlign = 'center';
            buttonGroup.parentElement.appendChild(helperMessage);
        }
        
        // Initialize UI state
        updateVisualizationUI();
        
    } catch (error) {
        console.error("Error in DOM initialization:", error);
    }
    
    // Video background toggle
    const videoToggle = document.getElementById('video-toggle');
    const sampleVideoToggle = document.getElementById('use-sample-video');
    
    // Preload sample video for Safari compatibility
    if (/^((?!chrome|android).)*safari/i.test(navigator.userAgent)) {
        console.log('Safari detected, preloading sample video for compatibility');
        sampleVideoToggle.checked = true;
        videoBackground.querySelector('source').src = sampleVideoUrl;
        videoBackground.load();
    }

    // Handle sample video toggle
    sampleVideoToggle.addEventListener('change', () => {
        const useSampleVideo = sampleVideoToggle.checked;
        
        // Update video source
        if (useSampleVideo) {
            // Set to sample video from the web
            videoBackground.querySelector('source').src = sampleVideoUrl;
            console.log("Switching to sample video:", sampleVideoUrl);
        } else {
            // Set to local video file
            videoBackground.querySelector('source').src = localVideoUrl;
            console.log("Switching to local video:", localVideoUrl);
        }
        
        // Reload the video to apply the new source
        videoBackground.load();
        
        // If video is currently active, play the new source after it loads
        if (videoBackgroundActive) {
            videoBackground.addEventListener('loadeddata', () => {
                console.log("Video loaded, playing now");
                
                // Show video properly
                videoBackground.style.display = 'block';
                videoBackground.style.opacity = '1.0';
                
                // Only reinitialize if needed
                if (window.s0.src && window.s0.src._isDestroyed) {
                    s0.init({src: document.getElementById('video-background'), dynamic: true});
                }
                
                // Play the video with safety check
                if (!window.isPlayingRequested) {
                    window.isPlayingRequested = true;
                    videoBackground.play().catch(err => {
                        console.error('Error playing video after source change:', err);
                        window.isPlayingRequested = false;
                    }).then(() => {
                        window.isPlayingRequested = false;
                    });
                }
            }, { once: true });
        }
    });

    videoToggle.addEventListener('change', () => {
        updateVideoBackground(videoToggle.checked);
    });
});

// Handle window resize to keep canvas full-screen
window.addEventListener('resize', () => {
    hydra.setResolution(window.innerWidth, window.innerHeight);
    document.getElementById('hydra-canvas').style.width = '100vw';
    document.getElementById('hydra-canvas').style.height = '100vh';
});

// Make a global function to reset visualization state if needed
window.resetViz = function() {
    console.log("Resetting visualization state");
    
    // Force buffer reinitialize to ensure clean state
    solid(0, 0, 0, 0).out(o0);
    solid(0, 0, 0, 0).out(o1);
    solid(0, 0, 0, 0).out(o2);
    solid(0, 0, 0, 0).out(o3);
    
    // If there was a previously active visualization, reactivate it
    if (currentViz && currentViz !== 'vhsTape') {
        // Find the button for the current viz
        const vizButton = document.querySelector(`.viz-button[data-viz="${currentViz}"]`);
        if (vizButton) {
            // Update UI
            activeVisualizations.clear();
            activeVisualizations.add(currentViz);
            updateVisualizationUI();
        }
    }
};

// Add a global function to activate the VHS visualization
window.activateVHSVisualization = function() {
    console.log("Activating VHS visualization in Hydra");
    
    // Activate the VHS visualization
    document.querySelectorAll('.viz-button').forEach(btn => {
        btn.classList.remove('active');
    });
    
    const vhsButton = document.querySelector('.viz-button[data-viz="vhsTape"]');
    if (vhsButton) {
        vhsButton.classList.add('active');
        activeVisualizations.clear();
        activeVisualizations.add('vhsTape');
        updateVisualizationUI();
    }
};

// Add video color sampling functionality

// Create an off-screen canvas for video frame analysis
let videoColorCanvas;
let videoColorCtx;
let videoColors = [
    {r: 0, g: 0, b: 0},  // default colors if no video
    {r: 255, g: 255, b: 255},
    {r: 128, g: 128, b: 128},
    {r: 200, g: 200, b: 200},
    {r: 50, g: 50, b: 50}
];
let isColorSamplingActive = false;
let colorSamplingInterval = null;

// Initialize color sampling canvas
function initColorSampling() {
    if (!videoColorCanvas) {
        videoColorCanvas = document.createElement('canvas');
        videoColorCanvas.width = 320;  // smaller size for performance
        videoColorCanvas.height = 240;
        videoColorCtx = videoColorCanvas.getContext('2d', { willReadFrequently: true });
    }
}

// Sample colors from current video frame
function sampleColorsFromVideo() {
    if (!videoColorCanvas || !videoColorCtx) {
        initColorSampling();
    }
    
    const videoElement = document.getElementById('video-background');
    if (!videoElement || videoElement.paused || parseFloat(videoElement.style.opacity || 0) < 0.1) {
        return videoColors; // Return current colors if video isn't visible
    }
    
    try {
        // Draw current video frame to canvas
        videoColorCtx.drawImage(videoElement, 0, 0, videoColorCanvas.width, videoColorCanvas.height);
        
        // Sample regions (center, corners, etc.)
        const regions = [
            {x: videoColorCanvas.width/2, y: videoColorCanvas.height/2},  // center
            {x: videoColorCanvas.width/4, y: videoColorCanvas.height/4},  // top-left region
            {x: videoColorCanvas.width*3/4, y: videoColorCanvas.height/4},  // top-right region
            {x: videoColorCanvas.width/4, y: videoColorCanvas.height*3/4},  // bottom-left region
            {x: videoColorCanvas.width*3/4, y: videoColorCanvas.height*3/4}  // bottom-right region
        ];
        
        // Get pixel data from each region
        const newColors = regions.map(region => {
            const pixelData = videoColorCtx.getImageData(region.x, region.y, 1, 1).data;
            return {r: pixelData[0], g: pixelData[1], b: pixelData[2]};
        });
        
        // Update the global colors
        videoColors = newColors;
        return newColors;
    } catch (error) {
        console.error("Error sampling video colors:", error);
        return videoColors; // Return current colors on error
    }
}

// Start color sampling at regular intervals
function startColorSampling() {
    if (isColorSamplingActive) return;
    
    isColorSamplingActive = true;
    
    // Stop any existing interval
    if (colorSamplingInterval) {
        clearInterval(colorSamplingInterval);
    }
    
    // Sample colors every 100ms
    colorSamplingInterval = setInterval(() => {
        sampleColorsFromVideo();
    }, 100);
    
    console.log("Video color sampling started");
}

// Stop color sampling
function stopColorSampling() {
    isColorSamplingActive = false;
    
    if (colorSamplingInterval) {
        clearInterval(colorSamplingInterval);
        colorSamplingInterval = null;
    }
    
    console.log("Video color sampling stopped");
}

// Convert RGB color to hex string for hydra functions
function rgbToHex(rgb) {
    return `#${rgb.r.toString(16).padStart(2, '0')}${rgb.g.toString(16).padStart(2, '0')}${rgb.b.toString(16).padStart(2, '0')}`;
}

// Convert RGB to HSL (useful for some visualizations)
function rgbToHsl(rgb) {
    const r = rgb.r / 255;
    const g = rgb.g / 255;
    const b = rgb.b / 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
        h = s = 0; // achromatic
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        
        h /= 6;
    }
    
    return {h, s, l};
}

// Helper to get a normalized color for visualization
function getVideoColor(index = 0, fallbackColor = {r: 255, g: 255, b: 255}) {
    if (!videoColors || videoColors.length === 0) {
        return fallbackColor;
    }
    
    // Ensure index is within bounds
    const safeIndex = Math.min(index, videoColors.length - 1);
    return videoColors[safeIndex] || fallbackColor;
} 