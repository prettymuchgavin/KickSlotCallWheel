class Wheel {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        // Configuration
        this.segments = [];
        this.angle = 0; // Current rotation angle
        this.velocity = 0;
        this.isSpinning = false;
        this.friction = 0.985; // Deceleration factor
        this.size = 600; // Match CSS
        this.centerX = this.size / 2;
        this.centerY = this.size / 2;
        this.radius = 280; // Adjusted for 600px size

        // High DPI fix
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.size * dpr;
        this.canvas.height = this.size * dpr;
        this.ctx.scale(dpr, dpr);
        // Do not force inline styles, let CSS handle it

        this.onFinished = null;

        // Image cache removed since we don't use avatars anymore
    }

    updateSegments(newSegments) {
        this.segments = newSegments;
        if (!this.isSpinning) {
            this.draw();
        }
    }

    clear() {
        this.segments = [];
        this.draw();
    }

    spin(callback) {
        if (this.segments.length === 0) return;
        this.isSpinning = true;
        this.onFinished = callback;

        // Initial Impulse (Randomized)
        // High velocity to spin for a few seconds
        this.velocity = Math.random() * 0.5 + 0.8; // Speed between 0.8 and 1.3
    }

    draw() {
        this.ctx.clearRect(0, 0, this.size, this.size);

        if (this.isSpinning) {
            this.angle += this.velocity;
            this.velocity *= this.friction;

            // Stop condition
            if (this.velocity < 0.002) {
                this.isSpinning = false;
                this.velocity = 0;
                this.determineWinner();
            }
        }

        if (this.segments.length === 0) return;

        const arcSize = (2 * Math.PI) / this.segments.length;

        this.ctx.save();
        this.ctx.translate(this.centerX, this.centerY);
        this.ctx.rotate(this.angle);

        this.segments.forEach((segment, i) => {
            const startAngle = i * arcSize;
            const endAngle = startAngle + arcSize;

            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.arc(0, 0, this.radius, startAngle, endAngle);
            this.ctx.closePath();

            // Fill Segment
            this.ctx.fillStyle = segment.color || '#333';
            this.ctx.fill();
            this.ctx.strokeStyle = '#0b0e11';
            this.ctx.lineWidth = 4;
            this.ctx.stroke();

            // Text & Content Rotation
            this.ctx.save();
            this.ctx.rotate(startAngle + arcSize / 2);
            this.ctx.textAlign = 'right';
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 24px Inter';

            // Draw Slot/User Name
            // Text is drawn pushed out towards edge
            this.ctx.fillText(segment.username, this.radius - 60, 5);
            this.ctx.font = '16px Inter';
            this.ctx.fillStyle = 'rgba(255,255,255,0.8)';
            this.ctx.fillText(segment.slot_name, this.radius - 60, 25);

            // Replaced Avatar with simple dot
            this.ctx.beginPath();
            this.ctx.arc(this.radius - 30, 0, 5, 0, Math.PI * 2);
            this.ctx.fillStyle = '#53FC18';
            this.ctx.fill();

            this.ctx.restore();
        });

        this.ctx.restore();
    }

    determineWinner() {
        if (this.segments.length === 0) return;

        // Normalize angle to 0 - 2PI
        const currentRotation = this.angle % (2 * Math.PI);

        // The pointer is at -90deg (or 270deg / 3PI/2) 
        let pointerAngle = (-Math.PI / 2 - currentRotation) % (2 * Math.PI);
        if (pointerAngle < 0) pointerAngle += 2 * Math.PI;

        const arcSize = (2 * Math.PI) / this.segments.length;
        const winnerIndex = Math.floor(pointerAngle / arcSize);

        if (this.onFinished && this.segments[winnerIndex]) {
            this.onFinished(this.segments[winnerIndex]);
        }
    }
}
