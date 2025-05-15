console.log("--- main.js: Step 5 - Full Animation Loop & Event Listeners ---");
import { AudioAnalyzer } from './audio.js';
import { Visualizer } from './scene.js';

class SynthesiaMachine {
    constructor() {
        console.log("SynthesiaMachine constructor (Step 5)");
        this.canvas = document.getElementById('main-canvas');
        this.audioInput = document.getElementById('audioFile');
        this.playPauseButton = document.getElementById('play-pause-button');
        this.volumeSlider = document.getElementById('volume-slider');
        this.infoElement = document.getElementById('info');

        if (!this.canvas) {
            console.error("CRITICAL: Canvas 'main-canvas' not found!");
            if(this.infoElement) this.infoElement.textContent = "ERROR: Canvas not found. App cannot start.";
            return; 
        }
        // Add checks for other essential elements if needed
        if (!this.audioInput && this.infoElement) this.infoElement.textContent = "Warning: Audio input element not found.";
        if (!this.playPauseButton && this.infoElement) this.infoElement.textContent = "Warning: Play/Pause button not found.";
        if (!this.volumeSlider && this.infoElement) this.infoElement.textContent = "Warning: Volume slider not found.";


        if (this.infoElement) this.infoElement.textContent = 'Initializing... (Step 5)';

        try {
            this.audioAnalyzer = new AudioAnalyzer();
            this.visualizer = new Visualizer(this.canvas); // Visualizer setup includes initial rendering
            if (this.infoElement) this.infoElement.textContent = 'Select an audio file to start. (Step 5)';
        } catch (e) {
            console.error("CRITICAL Error instantiating AudioAnalyzer or Visualizer:", e);
            if (this.infoElement) this.infoElement.textContent = 'ERROR setting up core components. App cannot run. (Step 5)';
            return; 
        }
        
        this.audioElement = null;
        this.animationFrameId = null;
        this.lastTime = performance.now();
    }

    setupEventListeners() {
        console.log("setupEventListeners called (Step 5)");
        if (!this.audioInput || !this.playPauseButton || !this.volumeSlider) {
            console.warn("One or more audio control DOM elements are missing. Event listeners not fully set up.");
            return;
        }

        this.audioInput.addEventListener('change', async (e) => {
            console.log("Audio file changed");
            const file = e.target.files[0];
            if (file) {
                if (this.audioElement && !this.audioElement.paused) {
                    this.audioElement.pause();
                    if(this.playPauseButton) this.playPauseButton.textContent = 'Play';
                }
                if (this.audioElement && this.audioElement.src.startsWith('blob:')) {
                    URL.revokeObjectURL(this.audioElement.src);
                    console.log("Revoked old audio object URL");
                }
                await this.loadAudio(file);
            }
        });

        this.playPauseButton.addEventListener('click', () => {
            console.log("Play/Pause button clicked");
            if (!this.audioElement) {
                if(this.infoElement) this.infoElement.textContent = 'Please load an audio file first.';
                return;
            }

            if (this.audioElement.paused) {
                this.audioElement.play().then(() => {
                    if(this.playPauseButton) this.playPauseButton.textContent = 'Pause';
                    this.audioAnalyzer.resumeContext(); // Important for some browsers after pause
                    console.log("Audio playing");
                }).catch(err => {
                    console.error('Error playing audio:', err);
                    if(this.infoElement) this.infoElement.textContent = 'Error playing audio. Try again.';
                    if(this.playPauseButton) this.playPauseButton.textContent = 'Play';
                });
            } else {
                this.audioElement.pause();
                if(this.playPauseButton) this.playPauseButton.textContent = 'Play';
                console.log("Audio paused");
            }
        });

        this.volumeSlider.addEventListener('input', () => {
            if (this.audioElement) {
                this.audioElement.volume = parseFloat(this.volumeSlider.value);
                // console.log("Volume changed to:", this.audioElement.volume); // Can be noisy
            }
        });
        console.log("Audio control event listeners set up.");
    }

    async loadAudio(file) {
        console.log("loadAudio called with file:", file.name);
        if(this.infoElement) this.infoElement.textContent = `Loading: ${file.name}...`;

        this.audioElement = new Audio(URL.createObjectURL(file));
        this.audioElement.loop = true; // Optional: loop the audio
        this.audioElement.volume = this.volumeSlider ? parseFloat(this.volumeSlider.value) : 0.5;

        this.audioElement.onended = () => {
            if(this.playPauseButton) this.playPauseButton.textContent = 'Play';
            console.log("Audio ended");
        };
        
        try {
            await this.audioAnalyzer.init(this.audioElement);
            console.log("AudioAnalyzer initialized for new audio.");
            await this.audioElement.play();
            if(this.playPauseButton) this.playPauseButton.textContent = 'Pause';
            if(this.infoElement) this.infoElement.textContent = `Now playing: ${file.name}`;
            console.log("Audio started playing after load.");
        } catch (err) {
            console.error('Error loading or playing audio:', err);
            if(this.infoElement) this.infoElement.textContent = 'Error processing audio. Please try a different file.';
            if(this.playPauseButton) this.playPauseButton.textContent = 'Play';
            this.audioElement = null; 
        }
    }

    startVisualizationLoop() {
        console.log("startVisualizationLoop called (Step 5 - full loop)");

        const animate = (timestamp) => {
            this.animationFrameId = requestAnimationFrame(animate); // Loop
            
            const currentTime = timestamp || performance.now();
            const deltaTime = Math.min(0.05, (currentTime - this.lastTime) / 1000); // Clamp deltaTime
            this.lastTime = currentTime;

            try {
                const audioData = (this.audioElement && !this.audioElement.paused) 
                                  ? this.audioAnalyzer.getAudioData() 
                                  : null;
                if (this.visualizer) {
                    this.visualizer.animateScene(deltaTime, audioData);
                }
            } catch (err) {
                console.error('Error in animation loop:', err);
                // Optionally, stop animation loop on critical error by not calling requestAnimationFrame again
                // or by explicitly cancelling:
                // if (this.animationFrameId) cancelAnimationFrame(this.animationFrameId);
                // this.animationFrameId = null; 
            }
        };

        if (!this.animationFrameId) { // Prevent multiple loops if called again
            animate();
            console.log("Animation loop started.");
        } else {
            console.log("Animation loop already running.");
        }
    }
}

window.addEventListener('DOMContentLoaded', () => {
    console.log("DOMContentLoaded event fired (Step 5)");
    try {
        const app = new SynthesiaMachine();
        console.log("SynthesiaMachine instance created (Step 5).");

        if (app && app.visualizer && app.audioAnalyzer) { // Check all essential components
            app.setupEventListeners(); 
            app.startVisualizationLoop(); 
        } else {
            console.error("CRITICAL: App, visualizer, or audioAnalyzer not properly initialized. Full functionality aborted.");
            const infoElem = document.getElementById('info');
            if(infoElem && infoElem.textContent.startsWith('Initializing')) { // Only update if not already an error
                infoElem.textContent = "App core component initialization failed. Cannot start. (Step 5)";
            }
        }

    } catch (e) {
        console.error("CRITICAL Error creating or setting up SynthesiaMachine (Step 5):", e);
        const infoElementError = document.getElementById('info');
        if (infoElementError) infoElementError.textContent = 'CRITICAL ERROR during app initialization. (Step 5)';
    }
});

console.log("--- main.js: Step 5 - Script fully parsed ---");