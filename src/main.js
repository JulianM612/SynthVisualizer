import { AudioAnalyzer } from './audio.js';
import { Visualizer } from './scene.js';

class SynthesiaMachine {
    constructor() {
        this.canvas = document.getElementById('main-canvas');
        this.audioAnalyzer = new AudioAnalyzer();
        this.visualizer = new Visualizer(this.canvas);
        this.setupEventListeners();
    }

    setupEventListeners() {
        const audioInput = document.getElementById('audioFile');
        audioInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (file) {
                await this.loadAudio(file);
            }
        });
    }

    async loadAudio(file) {
        const audioElement = new Audio(URL.createObjectURL(file));
        await this.audioAnalyzer.init(audioElement);
        
        try {
            await audioElement.play();
            document.getElementById('info').textContent = `Now playing: ${file.name}`;
            this.startVisualization();
        } catch (err) {
            console.error('Error playing audio:', err);
            document.getElementById('info').textContent = 'Error playing audio file';
        }
    }

    startVisualization() {
        let lastTime = performance.now();
        
        const animate = () => {
            requestAnimationFrame(animate);
            const currentTime = performance.now();
            const deltaTime = (currentTime - lastTime) / 1000;
            lastTime = currentTime;

            try {
                const audioData = this.audioAnalyzer.getAudioData();
                if (audioData) {
                    this.visualizer.update(audioData, deltaTime);
                }
            } catch (err) {
                console.error('Visualization error:', err);
            }
        };
        animate();
    }
}

new SynthesiaMachine();