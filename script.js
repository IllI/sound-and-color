// Initialize Hydra with full window size
const hydra = new Hydra({
    canvas: document.getElementById('hydra-canvas'),
    detectAudio: false,  // We'll handle audio ourselves
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

        analyser.fftSize = 1024; // Increased for better frequency resolution
        analyser.smoothingTimeConstant = 0.4; // Reduced for faster response
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
        // Check if video is active to use appropriate rendering
        if (videoBackgroundActive) {
            // Ensure video is in buffer o3
            src(s0).out(o3);
            
            // Sample video colors for better blending
            const color = getVideoColor(0, {r: 200, g: 200, b: 200});
            const normalizedColor = {
                r: color.r / 255, 
                g: color.g / 255, 
                b: color.b / 255
            };
            
            // Use the enhanced geometric with video colors function
            runGeometricWithColors(level, isSilent, opacity, normalizedColor);
            return;
        }
        
        // During silence, show a minimal static version
        if (isSilent) {
            // Minimal static pattern during silence
            shape(4, 0.4, 0)
                .repeat(3, 3)
                .scale(0.5)
                .kaleid(3)
                .scale(1.5)
                .mult(solid(1, 1, 1, 0.1)) // Very low opacity during silence
                .out(o0);
                
            // Even more minimal second layer
            shape(3, 0.3, 0.01)
                .scale(2)
                .color(1, 1, 1)
                .mult(solid(1, 1, 1, 0.05)) // Even lower opacity
                .out(o1);
                
            // Combined geometry at low opacity
            src(o0)
                .diff(src(o1))
                .out(o2);
                
            // Final output with greatly reduced opacity during silence
            src(o2)
                .color(1, 1, 1)
                .contrast(1.2)
                .saturate(0)
                .scale(1.5) // Fill screen
                .mult(solid(1, 1, 1, () => opacity * 0.2)) // Significantly reduced opacity
                .out();
        }
        // Normal audio-reactive mode
        else {
            // Standard geometric effect (used when video is not active)
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
        }
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
        
        // Always ensure video is enabled when VHS is active
        if (!videoBackgroundActive) {
            videoBackgroundActive = true;
            // Visually update toggle
            const videoToggle = document.getElementById('video-toggle');
            if (videoToggle && !videoToggle.checked) {
                videoToggle.checked = true;
            }
        }
        
        // Make sure video is properly configured
        const videoBackground = document.getElementById('video-background');
        if (videoBackground) {
            videoBackground.style.opacity = '1.0';
            
            // Try to play the video if it's paused
            if (videoBackground.paused) {
                videoBackground.play().catch(err => {
                    console.warn("Error playing video for VHS:", err);
                });
            }
        }
        
        // Generate strong VHS-style overlay
        // Use a different approach to ensure visibility even with other effects
        
        // For when the VHS effect is the only one active
        if (activeVisualizations.size === 1 && activeVisualizations.has('vhsTape')) {
            // When VHS is the only effect, use the standard implementation
            src(s0)
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
                
            // Strong horizontal tracking lines
            osc(300, 0)
                .rotate(Math.PI/2)
                .thresh(0.7)
                .color(1, 1, 1)
                .scrollX(() => time * (0.1 + level * 0.3))
                .scale(() => 1 + level * 5, 1)
                .mult(solid(1, 1, 1, () => audioActive ? 0.5 + level * 0.5 : 0))
                .out(o1);
                
            // VHS static/noise layer
            noise(40)
                .thresh(() => 0.94 - (level * 0.1))
                .mult(solid(1, 1, 1, () => audioActive ? 0.1 + level * 0.1 : 0.01))
                .out(o2);
                
            // Combine all layers
            src(o0)
                .layer(src(o1))
                .layer(src(o2))
                .out(o0);
        } else {
            // When VHS is combined with other effects, use a more visible overlay
            // that will stand out more clearly
            
            // Start with source
            src(s0)
                .color(1.5, 0.8, 1.2) // Extreme color shift - very noticeable
                .saturate(1.5)        // High saturation
                .contrast(1.3)        // High contrast
                .brightness(0.95)     // Very visible brightness
                .out(o1);
                
            // Create extremely noticeable scanlines
            osc(200, 0)
                .rotate(Math.PI/2)
                .thresh(0.6) 
                .color(0.2, 0.2, 0.2)
                .scrollX(() => time * 0.2)
                .mult(solid(1, 1, 1, 0.4)) // Always visible scanlines
                .out(o2);
                
            // Create obvious VHS static
            noise(20)
                .thresh(0.9)
                .mult(solid(1, 1, 1, 0.15)) // Always visible static
                .out(o3);
                
            // Combine into a single layer for overlay on other effects
            src(o1)
                .layer(src(o2))
                .layer(src(o3))
                .mult(solid(1, 1, 1, opacity)) // Use passed opacity
                .out(o0);
        }
        
        // Make sure VHS effect is activated if available
        if (typeof window.activateVHSEffect === 'function' && 
            (typeof window.isVHSActive === 'undefined' || !window.isVHSActive)) {
            try {
                window.activateVHSEffect(document.getElementById('hydra-canvas'));
                console.log("Activated VHS external effect from within visualization");
            } catch (err) {
                console.warn("Error activating VHS external effect:", err);
            }
        }
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
    const SILENCE_THRESHOLD = 2; // Lowered threshold for better sensitivity
    const FADE_SPEED = 0.05;     // Keep the same fade speed
    
    // State variables
    let currentOpacity = 1;
    let silenceFrames = 0;
    let lastAudioLevel = 0;
    
    function visualize() {
        requestAnimationFrame(visualize);
        
        // Get the frequency data
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate overall audio level with emphasis on mids and highs
        let totalSum = 0;
        let weightedSum = 0;
        for (let i = 0; i < bufferLength; i++) {
            const value = dataArray[i];
            totalSum += value;
            
            // Apply frequency weighting (emphasize mid-high frequencies)
            if (i > bufferLength * 0.1) { // Skip the lowest frequencies
                const weight = i < bufferLength * 0.7 ? 1.5 : 2.0; // Boost mids and highs
                weightedSum += value * weight;
            }
        }
        
        // Use weighted sum for more sensitivity to voice and music
        const audioLevel = weightedSum / (bufferLength * 1.5); // Normalize based on weighting
        
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
        
        // Normalize audio level (0-1) with higher gain for better reactivity
        const normalizedLevel = Math.min(1, audioLevel / 80); // Lower divisor for more sensitivity
        
        // Store last non-zero audio level for transitions
        if (normalizedLevel > 0.05) {
            lastAudioLevel = normalizedLevel;
        }
        
        // Use a transition level to avoid abrupt changes but be more responsive
        const transitionLevel = isSilent ? Math.max(0.05, lastAudioLevel * 0.4) : normalizedLevel;
        
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
            
            // If we have no active visualizations
            if (activeVizArray.length === 0) {
                // Just render black
                solid(0, 0, 0, 1).out(o0);
                return;
            }
            
            // Handle VHS effect activation/deactivation
            const hasVHS = activeVizArray.includes('vhsTape');
            
            // When VHS is activated, ensure video is enabled
            if (hasVHS && !videoBackgroundActive) {
                // Force video on for VHS
                videoBackgroundActive = true;
                const videoElement = document.getElementById('video-background');
                if (videoElement) {
                    videoElement.style.opacity = '1.0';
                    // Ensure video is playing
                    if (videoElement.paused) {
                        videoElement.play().catch(err => {
                            console.warn("Error playing video for VHS:", err);
                        });
                    }
                }
                // Update video toggle UI
                const videoToggle = document.getElementById('video-toggle');
                if (videoToggle) {
                    videoToggle.checked = true;
                }
            }
            
            // Activate VHS effect if needed
            if (hasVHS && typeof window.activateVHSEffect === 'function' && 
                (typeof window.isVHSActive === 'undefined' || !window.isVHSActive)) {
                const hydraCanvas = document.getElementById('hydra-canvas');
                window.activateVHSEffect(hydraCanvas);
            }
            // Deactivate VHS effect if not needed
            else if (!hasVHS && typeof window.isVHSActive !== 'undefined' && 
                     window.isVHSActive && typeof window.deactivateVHSEffect === 'function') {
                window.deactivateVHSEffect();
            }
            
            // Ensure video is loaded in source buffer
            if (videoBackgroundActive) {
                src(s0).out(o3);
            }
            
            // Clear main buffer before drawing
            solid(0, 0, 0, 1).out(o0);
            
            // If we have only one active visualization (including VHS)
            if (activeVizArray.length === 1) {
                const vizName = activeVizArray[0];
                if (visualizations[vizName]) {
                    // Run the visualization normally
                    visualizations[vizName](transitionLevel, isSilent, currentOpacity);
                }
                return;
            }
            
            // Handle multiple visualizations
            
            // Run visualizations one by one with proper blending
            for (let i = 0; i < activeVizArray.length; i++) {
                const vizName = activeVizArray[i];
                if (!visualizations[vizName]) continue;
                
                // For the first visualization, render directly
                if (i === 0) {
                    visualizations[vizName](transitionLevel, isSilent, currentOpacity);
                    continue;
                }
                
                // For each subsequent visualization, blend with previous
                src(o0).out(o2); // Store current state
                
                // Clear main buffer for new layer
                solid(0, 0, 0, 0).out(o0);
                
                // Run the visualization with standard opacity for clear visibility
                visualizations[vizName](transitionLevel, isSilent, currentOpacity);
                
                // Use simple blending to ensure effects remain visible
                // Layer blend mode works well for most combinations
                src(o2).layer(src(o0).mult(solid(1, 1, 1, 0.8))).out(o0);
            }
        } catch (error) {
            console.error("Error in visualize:", error);
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
        
        // Amplify audio level for more reactive visuals
        const amplifiedLevel = Math.min(1.0, audioLevel * 1.8);
        
        // Make sure video is in buffer o3
        if (videoBackgroundActive) {
            src(s0).out(o3);
        }
        
        // During silence, show a minimal static version of the effect
        if (isSilent) {
            // Create minimal static version during silence
            shape(4) // square base shape
                .color(color.r * 0.5, color.g * 0.5, color.b * 0.5) // Dimmed colors
                .scale(1.5) // Fixed scale
                .repeat(3, 3) // Fixed repeat
                .kaleid(2) // Minimal kaleidoscope
                .mult(solid(1, 1, 1, 0.2)) // Very low opacity
                .out(o1);
                
            shape(3) // triangle
                .color(color.b * 0.5, color.r * 0.5, color.g * 0.5) // Dimmed colors
                .scale(0.8) // Fixed scale
                .kaleid(4) // Fixed kaleidoscope
                .mult(solid(1, 1, 1, 0.1)) // Very low opacity
                .out(o2);
                
            // Output with extremely low opacity during silence
            if (videoBackgroundActive) {
                src(o3)
                    .layer(
                        src(o1)
                        .mask(src(o1).thresh(0.3))
                        .mult(solid(1, 1, 1, 0.2))
                    )
                    .layer(
                        src(o2)
                        .mask(src(o2).thresh(0.4))
                        .mult(solid(1, 1, 1, 0.1))
                    )
                    .mult(solid(1, 1, 1, opacity * 0.3)) // Further reduce opacity during silence
                    .out(o0);
            } else {
                src(o1)
                    .diff(src(o2))
                    .mult(solid(1, 1, 1, opacity * 0.2)) // Very low opacity during silence
                    .out(o0);
            }
        }
        // Normal audio-reactive mode
        else {
            // Create a custom version of the geometric visualization with color influence
            shape(4) // square base shape
                .color(color.r, color.g, color.b) // Use video colors
                .scale(() => 1.5 + amplifiedLevel * 3) // Increased audio influence
                .rotate(() => time * 0.1 + amplifiedLevel * 0.3) // Add audio influence to rotation
                .repeat(() => Math.floor(3 + amplifiedLevel * 8)) // More repetition with louder audio
                .kaleid(() => Math.floor(2 + amplifiedLevel * 5))
                .scale(() => 0.9 + amplifiedLevel * 0.5)
                .modulate(
                    noise(() => 2 + amplifiedLevel * 8)
                        .color(color.r, color.g, color.b)
                        .brightness(() => -0.5 + amplifiedLevel * 1.5)
                )
                .out(o1);
                
            // Create second geometric layer with different parameters
            shape(3)
                .color(color.b, color.r, color.g) // Different color order for variety
                .scale(() => 0.8 + amplifiedLevel * 2.5) // Increased audio influence
                .rotate(() => -time * 0.15 - amplifiedLevel * 0.5) // Add counter-rotation with audio
                .modulateRotate(osc(4, 0.1, 0), () => 0.5 + amplifiedLevel * 1.5)
                .kaleid(() => Math.floor(4 + amplifiedLevel * 6))
                .out(o2);
                
            // Blend with video source when active
            if (videoBackgroundActive) {
                // Start with video source
                src(o3)
                    // Add geometric patterns with blend modes that work well with video
                    .layer(
                        src(o1)
                        .mask(
                            src(o1).thresh(0.3 + amplifiedLevel * 0.2)
                        )
                        .mult(solid(1, 1, 1, () => 0.6 + amplifiedLevel * 0.4))
                    )
                    .layer(
                        src(o2)
                        .mask(
                            src(o2).thresh(0.4 + amplifiedLevel * 0.2)
                        )
                        .mult(solid(1, 1, 1, () => 0.5 + amplifiedLevel * 0.3))
                    )
                    // Enhance video with slight color modulation
                    .modulate(
                        src(o3).pixelate(50, 50),
                        0.02
                    )
                    .mult(solid(1, 1, 1, opacity))
                    .out(o0);
            } else {
                // Without video, blend the geometric patterns differently
                src(o1)
                    .diff(src(o2))
                    .modulate(
                        noise(3, 0.1),
                        () => 0.05 + amplifiedLevel * 0.1
                    )
                    .color(color.r, color.g, color.b)
                    .mult(solid(1, 1, 1, opacity))
                    .out(o0);
            }
        }
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
            helperMessage.textContent = 'Click visualizations to toggle them on/off';
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
            // Process all buttons, including VHS
            button.addEventListener('click', (e) => {
                e.preventDefault(); // Prevent default to handle everything ourselves
                
                // Get the selected visualization
                const selectedViz = button.getAttribute('data-viz');
                
                // Debug log
                console.log(`Toggling visualization: ${selectedViz}`);
                
                // Check if the visualization exists
                if (visualizations[selectedViz]) {
                    // Toggle the selected visualization
                    if (activeVisualizations.has(selectedViz)) {
                        // Toggle off if already active
                        activeVisualizations.delete(selectedViz);
                        console.log(`Removed ${selectedViz} from active visualizations`);
                        
                        // For VHS, handle special effect deactivation
                        if (selectedViz === 'vhsTape') {
                            // Ensure video is properly handled
                            if (!videoBackgroundActive) {
                                const videoBackground = document.getElementById('video-background');
                                if (videoBackground) {
                                    videoBackground.style.opacity = '0';
                                }
                            }
                        }
                    } else {
                        // Add to active visualizations
                        activeVisualizations.add(selectedViz);
                        console.log(`Added ${selectedViz} to active visualizations`);
                        
                        // Update currentViz for compatibility with old code
                        currentViz = selectedViz;
                        
                        // For VHS, ensure video is activated
                        if (selectedViz === 'vhsTape') {
                            // Make sure video is showing for VHS effect
                            const videoToggle = document.getElementById('video-toggle');
                            if (videoToggle && !videoToggle.checked) {
                                videoToggle.checked = true;
                                updateVideoBackground(true);
                            }
                            
                            // Ensure video is visible
                            const videoElement = document.getElementById('video-background');
                            if (videoElement) {
                                videoElement.style.display = 'block';
                                videoElement.style.opacity = '1.0';
                                
                                // Try to play the video if it's paused
                                if (videoElement.paused) {
                                    videoElement.play().catch(err => {
                                        console.warn("Error playing video:", err);
                                    });
                                }
                            }
                            
                            // Force enable video for VHS effect
                            videoBackgroundActive = true;
                        }
                    }
                    
                    // Update UI and hydra state
                    updateVisualizationUI();
                    
                    // Clear hydra buffers before applying new visualizations
                    solid(0, 0, 0, 0).out(o0);
                    solid(0, 0, 0, 0).out(o1);
                    solid(0, 0, 0, 0).out(o2);
                    
                    // For VHS effect specifically, handle activating/deactivating
                    if (selectedViz === 'vhsTape') {
                        const isVHSActive = activeVisualizations.has('vhsTape');
                        
                        if (isVHSActive) {
                            // When VHS is activated, ensure video background is on
                            videoBackgroundActive = true;
                            updateVideoBackground(true);
                            
                            // Try to explicitly activate VHS effect right away
                            const hydraCanvas = document.getElementById('hydra-canvas');
                            if (typeof window.activateVHSEffect === 'function') {
                                try {
                                    window.activateVHSEffect(hydraCanvas);
                                } catch (err) {
                                    console.warn("Error activating VHS effect:", err);
                                }
                            }
                        } else {
                            // When VHS is deactivated, deactivate effect if needed
                            if (typeof window.deactivateVHSEffect === 'function') {
                                try {
                                    window.deactivateVHSEffect();
                                } catch (err) {
                                    console.warn("Error deactivating VHS effect:", err);
                                }
                            }
                        }
                    }
                    
                    // Keep video in o3 if active
                    if (videoBackgroundActive) {
                        src(s0).out(o3);
                    } else {
                        solid(0, 0, 0, 0).out(o3);
                    }
                    
                    // Start color sampling if multiple visualizations
                    if (activeVisualizations.size > 1 && videoBackgroundActive && !isColorSamplingActive) {
                        startColorSampling();
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
            helperMessage.textContent = 'Click visualizations to toggle them on/off';
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
    
    // If no visualization is active, default to chalk
    if (activeVisualizations.size === 0) {
        activeVisualizations.add('chalk');
        currentViz = 'chalk';
        updateVisualizationUI();
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
    
    // Ensure video is active
    videoBackgroundActive = true;
    const videoToggle = document.getElementById('video-toggle');
    if (videoToggle && !videoToggle.checked) {
        videoToggle.checked = true;
        updateVideoBackground(true);
    }
    
    // Force activation of external VHS effect
    if (typeof window.activateVHSEffect === 'function') {
        const hydraCanvas = document.getElementById('hydra-canvas');
        try {
            window.activateVHSEffect(hydraCanvas);
            console.log("Activated external VHS effect from global activator");
        } catch (err) {
            console.warn("Error activating external VHS effect:", err);
        }
    }
    
    // Run the VHS visualization immediately
    if (visualizations.vhsTape) {
        visualizations.vhsTape(0.5, false, 1.0);
    }
};

// Add global function to deactivate VHS specifically
window.deactivateVHSVisualization = function() {
    console.log("Deactivating VHS visualization");
    
    // Remove VHS from active visualizations
    activeVisualizations.delete('vhsTape');
    
    // Deactivate external VHS effect
    if (typeof window.deactivateVHSEffect === 'function' && typeof window.isVHSActive !== 'undefined' && window.isVHSActive) {
        try {
            window.deactivateVHSEffect();
            console.log("Deactivated external VHS effect");
        } catch (err) {
            console.warn("Error deactivating external VHS effect:", err);
        }
    }
    
    // Update UI
    const vhsButton = document.querySelector('.viz-button[data-viz="vhsTape"]');
    if (vhsButton) {
        vhsButton.classList.remove('active');
    }
    
    updateVisualizationUI();
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

// Remove the custom VHS Button handler
document.addEventListener('DOMContentLoaded', function() {
    // No special VHS button handler needed here - remove this entire block
});

// Add core VHS effect functionality
// Simple VHS effect implementation
window.activateVHSEffect = function(canvas) {
    console.log("Activating VHS effect");
    
    // Set flag to track VHS state
    window.isVHSActive = true;
    
    // Apply strong video filter effects
    const video = document.getElementById('video-background');
    if (video) {
        video.style.filter = 'saturate(150%) contrast(120%) brightness(110%)';
    }
    
    // Apply dramatic canvas filter for very visible VHS look
    if (canvas) {
        canvas.style.filter = 'saturate(140%) contrast(125%) brightness(110%) hue-rotate(5deg)';
        
        // Add VHS overlay element if it doesn't exist
        let vhsOverlay = document.getElementById('vhs-effect-overlay');
        if (!vhsOverlay) {
            vhsOverlay = document.createElement('div');
            vhsOverlay.id = 'vhs-effect-overlay';
            vhsOverlay.style.position = 'fixed';
            vhsOverlay.style.top = '0';
            vhsOverlay.style.left = '0';
            vhsOverlay.style.width = '100%';
            vhsOverlay.style.height = '100%';
            vhsOverlay.style.pointerEvents = 'none';
            vhsOverlay.style.zIndex = '10'; // Above canvas
            vhsOverlay.style.mixBlendMode = 'soft-light';
            
            // Add scanlines
            vhsOverlay.style.background = 'linear-gradient(rgba(0,0,0,0), rgba(0,0,0,0.2)), repeating-linear-gradient(transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)';
            
            // Add animation
            vhsOverlay.style.animation = 'vhs-scanlines 5s linear infinite';
            
            // Add keyframes if they don't exist
            if (!document.getElementById('vhs-keyframes')) {
                const style = document.createElement('style');
                style.id = 'vhs-keyframes';
                style.textContent = `
                    @keyframes vhs-scanlines {
                        0% { background-position: 0 0; }
                        100% { background-position: 0 100px; }
                    }
                    @keyframes vhs-glitch {
                        0%, 90%, 100% { transform: translateX(0); }
                        92% { transform: translateX(5px); }
                        94% { transform: translateX(-3px); }
                        96% { transform: translateX(5px); }
                    }
                `;
                document.head.appendChild(style);
            }
            
            document.body.appendChild(vhsOverlay);
        } else {
            vhsOverlay.style.display = 'block';
        }
        
        // Add occasional subtle glitch effect
        if (window._vhsGlitchInterval) {
            clearInterval(window._vhsGlitchInterval);
        }
        
        window._vhsGlitchInterval = setInterval(() => {
            // Only glitch occasionally
            if (Math.random() < 0.2) { 
                // Apply a random horizontal shift
                const glitchX = Math.random() * 6 - 3; // -3 to 3 pixels
                canvas.style.transform = `translateX(${glitchX}px)`;
                
                // Reset after a short time
                setTimeout(() => {
                    canvas.style.transform = 'none';
                }, 100);
            }
        }, 500); // Check every 500ms
    }
    
    return true;
};

window.deactivateVHSEffect = function() {
    console.log("Deactivating VHS effect");
    
    // Reset VHS active flag
    window.isVHSActive = false;
    
    // Clear glitch interval if it exists
    if (window._vhsGlitchInterval) {
        clearInterval(window._vhsGlitchInterval);
        window._vhsGlitchInterval = null;
    }
    
    // Remove the VHS overlay
    const vhsOverlay = document.getElementById('vhs-effect-overlay');
    if (vhsOverlay) {
        vhsOverlay.style.display = 'none';
    }
    
    // Reset canvas effects
    const canvas = document.getElementById('hydra-canvas');
    if (canvas) {
        canvas.style.filter = 'none';
        canvas.style.transform = 'none';
    }
    
    // Reset video element
    const video = document.getElementById('video-background');
    if (video) {
        video.style.filter = 'none';
    }
    
    return true;
};

// Simple function to update VHS effect with audio levels
window.updateVHSAudio = function(audioLevel) {
    if (!window.isVHSActive) return false;
    
    // Apply clearly visible audio-reactive effects
    const canvas = document.getElementById('hydra-canvas');
    if (!canvas) return false;
    
    // Scale audio level for noticeable effect
    const scaledLevel = Math.max(0.1, Math.min(1.0, audioLevel * 1.5));
    
    // Add clearly visible audio-reactive filters
    const saturation = 115 + (scaledLevel * 15);  // 115-130%
    const contrast = 110 + (scaledLevel * 10);    // 110-120%
    canvas.style.filter = `saturate(${saturation}%) contrast(${contrast}%) brightness(105%)`;
    
    return true;
};