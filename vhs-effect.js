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
    
    // If tracking offset is very low (no audio), just return original color with minimal effect
    if (trackingOffset < 0.1) {
        // Add just a hint of noise and scanlines for the CRT look even when silent
        float minimalNoise = random(uv + vec2(time * 0.1, 0.0)) * 0.01;
        float minimalScanlines = sin(uv.y * 800.0) * 0.01;
        outColor = originalColor;
        outColor.rgb += vec3(minimalNoise);
        outColor.rgb -= vec3(minimalScanlines);
        return;
    }
    
    // Create VHS tracking effect - horizontal distortion that's directly tied to audio
    float tracking = sin(time * 0.5 + uv.y * 10.0) * 0.003;
    tracking = tracking * trackingOffset; // This is now modulated by audio level
    
    // Horizontal tracking lines that only appear with sufficient audio
    float trackingLineThreshold = mix(1.0, 0.9, trackingOffset * 0.5); // Lower threshold = more lines, tied to audio
    float trackingLine = step(trackingLineThreshold, sin(uv.y * 20.0 + time * 3.0) * 0.5 + 0.5);
    trackingLine = trackingLine * trackingOffset * 0.15; // Intensity tied to audio level
    
    // Create more tracking lines in bands, but distributed more evenly and tied to audio
    float trackingLinesBands = step(mix(1.0, 0.7, trackingOffset), 
                              random(vec2(floor(uv.y * 20.0), floor(time * 0.5)))) * trackingOffset * 0.1;
    
    // Apply noise with different intensity on different frames to simulate VHS noise, tied to audio
    float noise = random(uv + vec2(time * 0.1, 0.0));
    float noiseEffect = step(1.0 - (noiseAmount * trackingOffset), noise) * 0.2 * trackingOffset;
    
    // RGB offset (Chromatic aberration - color shifting), tied to audio
    float rOffset = sin(time * 0.2) * 0.003 * rgbOffset * trackingOffset;
    float gOffset = sin(time * 0.2 + 1.3) * 0.003 * rgbOffset * trackingOffset; 
    float bOffset = sin(time * 0.2 + 2.6) * 0.003 * rgbOffset * trackingOffset;
    
    // Sample with color shifting for ghosting/chromatic aberration
    vec4 rChannel = texture(src, vec2(uv.x + rOffset + tracking, uv.y));
    vec4 gChannel = texture(src, vec2(uv.x + gOffset + tracking, uv.y));
    vec4 bChannel = texture(src, vec2(uv.x + bOffset + tracking, uv.y));
    
    // Combine channels
    vec4 color = vec4(rChannel.r, gChannel.g, bChannel.b, (rChannel.a + gChannel.a + bChannel.a) / 3.0);
    
    // Add scanlines for VHS effect, intensity tied to audio
    float scanlines = sin(uv.y * 400.0) * 0.03 * scanlineIntensity * trackingOffset;
    color.rgb -= vec3(scanlines);
    
    // Apply tracking lines and noise
    color.rgb += vec3(trackingLine + trackingLinesBands + noiseEffect);
    
    // Bottom area artifacts only with sufficient audio
    float bottomStaticThreshold = mix(0.3, 0.1, trackingOffset);
    float bottomStatic = step(0.9, uv.y) * step(random(vec2(uv.x, time)), bottomStaticThreshold) * (0.2 * trackingOffset);
    color.rgb += vec3(bottomStatic);
    
    // Head switching noise (line at the bottom of the screen), tied to audio
    float headSwitchingNoise = step(0.95, uv.y) * 0.1 * trackingOffset;
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
let lastActiveHydraViz = 'chalk'; // Store last active visualization

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
    console.log("VHS Audio level:", audioLevel.toFixed(2));
}

// Setup a proper class-based approach that doesn't use !important
function setupUIStructure() {
    // Add a CSS class that doesn't override existing styles but adds proper layering
    const styleId = 'vhs-effect-styles';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
            /* Layering classes */
            .vhs-ui-layer { 
                position: relative;
                z-index: 50;
            }
            
            /* Optional - only applied when VHS is active */
            .vhs-active .hydra-canvas-container {
                z-index: 1;
            }
            
            .vhs-active .vhs-ui-layer {
                z-index: 50;
            }
            
            /* Ensure UI is always interactable */
            .vhs-ui-control {
                position: relative;
                z-index: 5;
            }
        `;
        document.head.appendChild(style);
    }
    
    // Structure the DOM properly rather than forcing z-index
    const controlPanel = document.getElementById('control-panel');
    const togglePanel = document.getElementById('toggle-panel');
    
    // Add classes instead of inline styles
    if (controlPanel && !controlPanel.classList.contains('vhs-ui-layer')) {
        controlPanel.classList.add('vhs-ui-layer');
    }
    
    if (togglePanel && !togglePanel.classList.contains('vhs-ui-layer')) {
        togglePanel.classList.add('vhs-ui-layer');
    }
    
    // Add class to buttons instead of forcing inline styles
    document.querySelectorAll('.viz-button').forEach(btn => {
        if (!btn.classList.contains('vhs-ui-control')) {
            btn.classList.add('vhs-ui-control');
        }
    });
    
    // Wrap hydra canvas in a container if needed
    const hydraCanvas = document.getElementById('hydra-canvas');
    if (hydraCanvas && !hydraCanvas.parentElement.classList.contains('hydra-canvas-container')) {
        // Only if it's not already wrapped
        const wrapper = document.createElement('div');
        wrapper.className = 'hydra-canvas-container';
        wrapper.style.position = 'fixed';
        wrapper.style.top = '0';
        wrapper.style.left = '0';
        wrapper.style.width = '100%';
        wrapper.style.height = '100%';
        
        // Move the canvas into the wrapper
        const parent = hydraCanvas.parentElement;
        parent.insertBefore(wrapper, hydraCanvas);
        wrapper.appendChild(hydraCanvas);
    }
}

// Function to manually update visualization buttons state
function updateVisualizationUI() {
    document.querySelectorAll('.viz-button').forEach(btn => {
        const vizName = btn.getAttribute('data-viz');
        if (isVHSActive && vizName === 'vhsTape') {
            btn.classList.add('active');
        } else if (isVHSActive && vizName !== 'vhsTape') {
            btn.classList.remove('active');
        } else if (!isVHSActive && vizName === lastActiveHydraViz) {
            btn.classList.add('active');
        }
    });
}

// Return to the previous visualization when VHS is deactivated
function restorePreviousVisualization() {
    // Find button for the last active visualization
    const prevVizButton = document.querySelector(`.viz-button[data-viz="${lastActiveHydraViz}"]`);
    if (prevVizButton) {
        // Simulate a click on the previous visualization button
        prevVizButton.click();
    }
}

// Function to activate the VHS effect
function activateVHSEffect(target) {
    // Setup proper UI structure first
    setupUIStructure();
    
    // If already active, remove it
    if (activeEffect) {
        try {
            document.body.classList.remove('vhs-active');
            isVHSActive = false;
            
            vfx.remove(activeEffect);
            activeEffect = null;
            console.log("VHS effect removed");
            
            // Find and update the VHS button
            const vhsButton = document.querySelector('.viz-button[data-viz="vhsTape"]');
            if (vhsButton) {
                vhsButton.classList.remove('active');
            }
            
            // Restore previous visualization
            restorePreviousVisualization();
            
            return;
        } catch (error) {
            console.error("Error removing VHS effect:", error);
        }
        return;
    }
    
    if (!vfx) {
        console.error("VFX not initialized");
        return;
    }
    
    // Remember the current active visualization (that's not VHS)
    document.querySelectorAll('.viz-button.active').forEach(btn => {
        const vizName = btn.getAttribute('data-viz');
        if (vizName !== 'vhsTape') {
            lastActiveHydraViz = vizName;
            console.log(`Saved last active visualization: ${lastActiveHydraViz}`);
        }
    });
    
    // Mark document as having VHS active
    document.body.classList.add('vhs-active');
    isVHSActive = true;
    
    // Get the canvas or a fallback target
    const hydraCanvas = document.getElementById('hydra-canvas');
    const effectTarget = hydraCanvas || target || document.body;
    
    console.log("Activating VHS effect on", effectTarget);
    
    // Add the effect with our custom shader
    try {
        activeEffect = vfx.add(effectTarget, {
            shader: vhsShader,
            uniforms: {
                time: () => performance.now() / 1000,
                noiseAmount: () => 0.03 + Math.random() * 0.03,
                trackingOffset: () => trackingIntensity,
                rgbOffset: () => Math.max(0.1, audioLevel * 3.0),
                scanlineIntensity: () => Math.max(0.1, audioLevel * 0.7)
            }
        });
        
        console.log("VHS effect activated successfully");
        updateVisualizationUI();
    } catch (error) {
        console.error("Failed to activate VHS effect:", error);
    }
}

// Initialize when everything is ready
window.addEventListener('load', async () => {
    try {
        console.log("Window loaded, initializing VFX");
        
        // Setup UI structure before anything else
        setupUIStructure();
        
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
        
        // Track visualization changes to remember the last active one
        document.querySelectorAll('.viz-button').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const vizName = btn.getAttribute('data-viz');
                if (vizName !== 'vhsTape') {
                    lastActiveHydraViz = vizName;
                }
            });
        });
        
        // Get the VHS Tape button from the existing controls
        const vhsTapeButton = Array.from(document.querySelectorAll('.viz-button'))
            .find(btn => btn.getAttribute('data-viz') === 'vhsTape');
        
        if (vhsTapeButton) {
            console.log("Found VHS Tape button");
            
            // Create clean event handler
            const originalClickHandler = vhsTapeButton.onclick;
            vhsTapeButton.onclick = null;
            
            // Add our click handler
            vhsTapeButton.addEventListener('click', (e) => {
                console.log("VHS Tape button clicked");
                
                // Prevent interference with Hydra's default handler
                e.stopPropagation();
                
                // Toggle VHS effect
                activateVHSEffect(document.getElementById('hydra-canvas'));
            });
        } else {
            console.log("VHS Tape button not found, creating our own");
            
            // Create a button to toggle the VHS effect
            const vhsButton = document.createElement('button');
            vhsButton.textContent = "Toggle VHS Effect";
            vhsButton.className = 'viz-button vhs-ui-control';
            vhsButton.setAttribute('data-viz', 'vhsTape');
            vhsButton.style.position = "fixed";
            vhsButton.style.top = "10px";
            vhsButton.style.right = "10px";
            vhsButton.style.padding = "10px";
            vhsButton.style.background = "#ff5555";
            vhsButton.style.color = "white";
            vhsButton.style.border = "none";
            vhsButton.style.borderRadius = "5px";
            vhsButton.style.cursor = "pointer";
            
            vhsButton.addEventListener('click', () => {
                activateVHSEffect(document.getElementById('hydra-canvas'));
            });
            
            document.body.appendChild(vhsButton);
        }
        
        // Try to hook into the existing audio analyzer
        window.updateVHSAudio = updateAudioIntensity;
    } catch (error) {
        console.error("Error in VHS effect initialization:", error);
    }
});

// Ensure our UI structure is maintained on resize
window.addEventListener('resize', setupUIStructure); 