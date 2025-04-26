// Initialize Hydra with full window size
const hydra = new Hydra({
    canvas: document.getElementById('hydra-canvas'),
    detectAudio: false,
    width: window.innerWidth,
    height: window.innerHeight
});

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
        
        // Create a noise floor texture
        noise(3, 0.1)
            .thresh(0.5)
            .mult(
                noise(10, 0.1)
                .thresh(0.3)
            )
            .scale(2.0) // Scale beyond screen to ensure coverage
            .rotate(() => time * 0.01)
            .scrollX(() => time * 0.005)
            .scrollY(() => Math.sin(time * 0.01) * 0.05)
            .brightness(-0.1)
            .contrast(1.2)
            .saturate(0)
            .out(o3);
        
        // Combine all outputs with blend modes that ensure full screen coverage
        src(o0)
            .layer(
                src(o1)
                .blend(src(o3), () => 0.2 + level * 0.3)
            )
            .layer(
                src(o2)
                .blend(src(o3), () => 0.3 + level * 0.2)
            )
            .scale(1.5) // Scale beyond screen edges for full coverage
            .color(1, 1, 1) // Ensure white color (for chalk effect)
            .saturate(0) // Keep it black and white
            .mult(solid(1, 1, 1, () => opacity)) // Control global opacity with silence detection
            .out();
    },

    // Neon glow effect
    neon: (level, isSilent, opacity) => {
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

    // VHS Tape - simplified version
    vhsTape: (level, isSilent, opacity) => {
        // Simple base
        osc(10, 0.1, 1)
            .brightness(-0.5)
            .color(1.05, 0.95, 1.1)
            .out(o0);
        
        // Simple tracking lines
        osc(200, 0)
            .thresh(0.5)
            .color(1, 1, 1)
            .scrollY(() => time * 0.1)
            .scale(1, () => 1 + level * 2)
            .mult(solid(1, 1, 1, () => 0.3 + level * 0.3))
            .out(o1);
        
        // Final output
        src(o0)
            .layer(src(o1))
            // Add noise grain
            .add(noise(30).thresh(0.96).mult(solid(1, 1, 1, 0.05)))
            // Color jitter
            .color(
                () => 1 + Math.sin(time * 10) * 0.02 * level,
                () => 1 + Math.cos(time * 10) * 0.02 * level,
                () => 1 + Math.sin(time * 8) * 0.02 * level
            )
            // VHS static at bottom
            .layer(
                noise(10).thresh(0.2)
                .scale(1, 0.05)
                .scrollY(-0.5)
                .mult(solid(1, 1, 1, 0.15))
            )
            .mult(solid(1, 1, 1, () => opacity))
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
    
    // Set up source from video for use in visualizations
    try {
        s0.init({ src: videoBackground });
        console.log("Video source initialized successfully");
    } catch (err) {
        console.error("Error initializing video source:", err);
        // Create a fallback source if initialization fails
        solid(0, 0, 0, 1).out(s0);
    }
    
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
        
        try {
            // Get active visualizations as array
            const activeVizArray = Array.from(activeVisualizations);
            
            // If we have only one active visualization, just run it directly
            if (activeVizArray.length === 1) {
                const vizName = activeVizArray[0];
                if (visualizations[vizName]) {
                    visualizations[vizName](transitionLevel, isSilent, currentOpacity);
                }
                return;
            }
            
            // For multiple visualizations, we need a simpler approach to avoid buffer conflicts
            
            // Start with a clean slate for the first visualization
            solid(0, 0, 0, 1).out(o0);
            
            // Run visualizations one by one with simpler blending
            for (let i = 0; i < activeVizArray.length; i++) {
                const vizName = activeVizArray[i];
                
                if (!visualizations[vizName]) continue;
                
                // For the first visualization, just run it directly
                if (i === 0) {
                    visualizations[vizName](transitionLevel, isSilent, currentOpacity);
                    continue;
                }
                
                // For subsequent visualizations, store current output
                src(o0).out(o3);
                
                // Clear main buffer and run next visualization
                solid(0, 0, 0, 0).out(o0);
                visualizations[vizName](transitionLevel, isSilent, currentOpacity * 0.7);
                
                // Blend with stored result using a simple add blend
                src(o3).add(src(o0), 0.8).out(o0);
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
                // Get the selected visualization
                const selectedViz = button.getAttribute('data-viz');
                
                // Debug log
                console.log(`Toggling visualization: ${selectedViz}`);
                
                // Check if the visualization exists
                if (visualizations[selectedViz]) {
                    // Toggle active state for multi-select
                    if (e.ctrlKey || e.metaKey) {
                        // Multi-select mode (Ctrl/Cmd + click)
                        if (button.classList.contains('active') && activeVisualizations.size > 1) {
                            // Remove from active visualizations
                            activeVisualizations.delete(selectedViz);
                            console.log(`Removed ${selectedViz} from active visualizations`);
                        } else {
                            // Add to active visualizations
                            activeVisualizations.add(selectedViz);
                            console.log(`Added ${selectedViz} to active visualizations`);
                        }
                    } else {
                        // Single-select mode (normal click)
                        // Reset active visualizations
                        activeVisualizations.clear();
                        activeVisualizations.add(selectedViz);
                        
                        // Also update currentViz for compatibility
                        currentViz = selectedViz;
                        console.log(`Set ${selectedViz} as the only active visualization`);
                    }
                    
                    // Update UI
                    updateVisualizationUI();
                    
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
        } else {
            // Set to local video file
            videoBackground.querySelector('source').src = localVideoUrl;
        }
        
        // Reload the video to apply the new source
        videoBackground.load();
        
        // If video is currently active, play the new source
        if (videoBackgroundActive) {
            videoBackground.play().catch(err => {
                console.error('Error playing video after source change:', err);
            });
        }
    });

    videoToggle.addEventListener('change', () => {
        videoBackgroundActive = videoToggle.checked;
        
        if (videoBackgroundActive) {
            // Show and play video
            videoBackground.style.opacity = '0.8';
            videoBackground.play().catch(err => {
                console.error('Error playing video:', err);
                
                // If there's an error with the local file, try switching to the sample video
                if (!sampleVideoToggle.checked) {
                    console.log('Attempting to use sample video instead...');
                    sampleVideoToggle.checked = true;
                    
                    // Trigger the change event to update the video source
                    const event = new Event('change');
                    sampleVideoToggle.dispatchEvent(event);
                }
            });
            
            // Make hydra canvas semi-transparent to let video show through
            document.getElementById('hydra-canvas').style.opacity = '0.8';
        } else {
            // Hide video
            videoBackground.style.opacity = '0';
            videoBackground.pause();
            
            // Make hydra canvas fully opaque
            document.getElementById('hydra-canvas').style.opacity = '1';
        }
    });
});

// Handle window resize to keep canvas full-screen
window.addEventListener('resize', () => {
    hydra.setResolution(window.innerWidth, window.innerHeight);
    document.getElementById('hydra-canvas').style.width = '100vw';
    document.getElementById('hydra-canvas').style.height = '100vh';
}); 