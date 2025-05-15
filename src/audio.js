export class AudioAnalyzer {
    constructor() {
        this.fftSize = 2048;
        this.smoothingTimeConstant = 0.8;
        this.frequencyBands = {
            bass: { low: 20, high: 140 },
            lowMid: { low: 140, high: 400 },
            mid: { low: 400, high: 2600 },
            highMid: { low: 2600, high: 5200 },
            treble: { low: 5200, high: 14000 }
        };
    }

    async init(audioElement) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = this.fftSize;
        this.analyser.smoothingTimeConstant = this.smoothingTimeConstant;

        const source = this.audioContext.createMediaElementSource(audioElement);
        source.connect(this.analyser);
        this.analyser.connect(this.audioContext.destination);

        this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
        this.timeDomainData = new Uint8Array(this.analyser.frequencyBinCount);
    }

    getAudioData() {
        if (!this.analyser) return null;

        this.analyser.getByteFrequencyData(this.frequencyData);
        this.analyser.getByteTimeDomainData(this.timeDomainData);

        return {
            frequencies: this.getFrequencyBands(),
            waveform: this.getNormalizedWaveform(),
            volume: this.getAverageVolume()
        };
    }

    getFrequencyBands() {
        const nyquist = this.audioContext.sampleRate / 2;
        const bands = {};

        for (const [name, range] of Object.entries(this.frequencyBands)) {
            const lowIndex = Math.floor(range.low * this.analyser.frequencyBinCount / nyquist);
            const highIndex = Math.floor(range.high * this.analyser.frequencyBinCount / nyquist);
            bands[name] = this.getAverageFromRange(lowIndex, highIndex);
        }

        return bands;
    }

    getAverageFromRange(low, high) {
        let sum = 0;
        for (let i = low; i <= high; i++) {
            sum += this.frequencyData[i];
        }
        return sum / (high - low + 1) / 255;
    }

    getNormalizedWaveform() {
        return Array.from(this.timeDomainData).map(v => (v - 128) / 128);
    }

    getAverageVolume() {
        const sum = this.timeDomainData.reduce((acc, val) => acc + Math.abs(val - 128), 0);
        return sum / this.timeDomainData.length / 128;
    }
}