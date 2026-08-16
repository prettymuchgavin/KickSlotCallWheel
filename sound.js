/**
 * Sound Manager for DatKickWheel
 * Uses Web Audio API Synthesizer (Zero external dependencies)
 */

class SoundFX {
    constructor() {
        this.ctx = null;
        this.enabled = true;
        this.lastVictoryTime = 0;
    }

    init() {
        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                this.ctx = new AudioCtx();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTick() {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();

            osc.type = 'triangle';
            osc.frequency.setValueAtTime(600, this.ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(120, this.ctx.currentTime + 0.03);

            gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.03);

            osc.connect(gain);
            gain.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + 0.03);
        } catch (e) {}
    }

    playVictory() {
        if (!this.enabled) return;

        // Prevent victory sound from playing over itself 5 times when multi-wheels finish
        const now = Date.now();
        if (this.lastVictoryTime && (now - this.lastVictoryTime < 2500)) {
            return;
        }
        this.lastVictoryTime = now;

        this.init();
        if (!this.ctx) return;

        try {
            // Victorious Arpeggio (C5, E5, G5, C6)
            const notes = [523.25, 659.25, 783.99, 1046.50];
            notes.forEach((freq, i) => {
                const osc = this.ctx.createOscillator();
                const gain = this.ctx.createGain();
                const startTime = this.ctx.currentTime + i * 0.12;

                osc.type = 'sine';
                osc.frequency.setValueAtTime(freq, startTime);

                gain.gain.setValueAtTime(0.3, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.4);

                osc.connect(gain);
                gain.connect(this.ctx.destination);

                osc.start(startTime);
                osc.stop(startTime + 0.4);
            });
        } catch (e) {}
    }

    playWin() {
        this.playVictory();
    }
}

const soundManager = new SoundFX();
