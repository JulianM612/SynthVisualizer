export class AudioAnalyzer {
    constructor() {
        console.log("AudioAnalyzer: constructor called"); // Added for debugging
        this.fftSize = 2048;
        this.smoothingTimeConstant = 0.8;
        this.frequencyBands = {
            bass: { low: 20, high: 140 },
            lowMid: { low: 140, high: 400 },
            mid: { low: 400, high: 2600 },
            highMid: { low: 2600, high: 5200 },
            treble: { low: 5200, high: 14000 }
        };
        this.audioContext = null;
        this.analyser = null;
        this.source = null;
        this.frequencyData = null;
        this.timeDomainData = null;
    }

    async init(audioElement) {
        console.log("AudioAnalyzer: init called"); // Added for debugging
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            console.log("AudioAnalyzer: AudioContext created");
        }
        
        if (this.audioContext.state === 'suspended') {
            console.log("AudioAnalyzer: AudioContext is suspended, resuming...");
            await this.audioContext.resume();
            console.log("AudioAnalyzer: AudioContext resumed");
        }

        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = this.fftSize;
        this.analyser.smoothingTimeConstant = this.smoothingTimeConstant;
        console.log("AudioAnalyzer: Analyser created and configured");

        if (this.source) {
            try {
                this.source.disconnect();
                console.log("AudioAnalyzer: Previous source disconnected");
            } catch(e) {
                console.warn("AudioAnalyzer: Error disconnecting previous source (might be normal):", e);
            }
        }
        this.source = this.audioContext.createMediaElementSource(audioElement);
        this.source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);
        console.log("AudioAnalyzer: MediaElementSource created and connected");

        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.timeDomainData = new Uint8Array(this.analyser.fftSize); // Corrected size
        console.log("AudioAnalyzer: Data arrays initialized");
    }
    
    resumeContext() {
        if (this.audioContext && this.audioContext.state === 'suspended') {
            console.log("AudioAnalyzer: resumeContext called, resuming...");
            this.audioContext.resume().then(() => {
                console.log("AudioAnalyzer: AudioContext resumed via resumeContext");
            }).catch(err => console.error("AudioAnalyzer: Error resuming audio context via resumeContext:", err));
        } else if (this.audioContext) {
            console.log("AudioAnalyzer: resumeContext called, context state:", this.audioContext.state);
        } else {
            console.log("AudioAnalyzer: resumeContext called, but no audioContext yet.");
        }
    }

    getAudioData() {
        if (!this.analyser || !this.audioContext || this.audioContext.state !== 'running') {
            // console.log("AudioAnalyzer: getAudioData - prerequisites not met or context not running."); // Can be noisy
            return null;
        }

        this.analyser.getByteFrequencyData(this.frequencyData);
        this.analyser.getByteTimeDomainData(this.timeDomainData);

        return {
            frequencies: this.getFrequencyBands(),
            waveform: this.getNormalizedWaveform(),
            volume: this.getAverageVolume()
        };
    }

    getFrequencyBands() {
        if (!this.audioContext || !this.analyser || !this.frequencyData) {
            // console.warn("AudioAnalyzer: getFrequencyBands - prerequisites not met."); // Can be noisy
            return {};
        }
        const nyquist = this.audioContext.sampleRate / 2;
        const bands = {};

        for (const [name, range] of Object.entries(this.frequencyBands)) {
            const lowIndex = Math.max(0, Math.floor(range.low * this.analyser.frequencyBinCount / nyquist));
            const highIndex = Math.min(this.analyser.frequencyBinCount - 1, Math.floor(range.high * this.analyser.frequencyBinCount / nyquist));
            bands[name] = this.getAverageFromRange(lowIndex, highIndex);
        }
        return bands;
    }

    getAverageFromRange(low, high) {
        if (low > high || !this.frequencyData) return 0;
        let sum = 0;
        for (let i = low; i <= high; i++) {
            sum += this.frequencyData[i];
        }
        const count = high - low + 1;
        return count > 0 ? (sum / count / 255) : 0;
    }

    getNormalizedWaveform() {
        if (!this.timeDomainData) return [];
        return Array.from(this.timeDomainData).map(v => (v - 128) / 128);
    }

    getAverageVolume() {
        if (!this.timeDomainData || this.timeDomainData.length === 0) return 0;
        const sum = this.timeDomainData.reduce((acc, val) => acc + Math.abs(val - 128), 0);
        return sum / this.timeDomainData.length / 128;
    }
}
console.log("src/audio.js: Parsed and AudioAnalyzer class is exported."); // Top-level log