class Wheel {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        // Configuration
        this.segments = [];
        this.angle = 0; // Current rotation angle
        this.isSpinning = false;
        this.size = 600; // Match CSS
        this.centerX = this.size / 2;
        this.centerY = this.size / 2;
        this.radius = 280; // Adjusted for 600px size

        // High DPI fix
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.size * dpr;
        this.canvas.height = this.size * dpr;
        this.ctx.scale(dpr, dpr);

        this.onFinished = null;
        
        // Spin animation states
        this.spinStartTime = null;
        this.spinDuration = 4500; // 4.5 seconds spin
        this.startAngle = 0;
        this.targetAngle = 0;
        this.winner = null;
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

    spin(callback, forcedWinnerIndex = null, forcedDuration = null) {
        if (this.segments.length === 0) return;
        this.isSpinning = true;
        this.onFinished = callback;
        this.spinStartTime = null;
        
        // 1. Select the winner index immediately (so we can target its middle)
        const winnerIndex = forcedWinnerIndex !== null ? forcedWinnerIndex : Math.floor(Math.random() * this.segments.length);
        this.winner = this.segments[winnerIndex];
        
        // 2. Calculate target pointer angle relative to the canvas
        // Segment boundaries cover [index * arcSize, (index + 1) * arcSize]
        const arcSize = (2 * Math.PI) / this.segments.length;
        
        // Position pointer randomly between 20% and 80% of the segment size
        // to stay far away from the dividing lines.
        const offsetPercent = 0.2 + Math.random() * 0.6; 
        const targetPointerAngle = (winnerIndex + offsetPercent) * arcSize;
        
        // 3. Convert target pointer angle to canvas rotation angle
        // The pointer is visually at 12 o'clock (-Math.PI / 2).
        // For a canvas element drawn at targetPointerAngle to end up at 12 o'clock,
        // targetPointerAngle + canvasRotation = -Math.PI / 2
        // canvasRotation = -Math.PI / 2 - targetPointerAngle
        const baseTargetAngle = -Math.PI / 2 - targetPointerAngle;
        
        // 4. Spin several times before stopping
        this.startAngle = this.angle;
        const extraSpins = 5 + Math.floor(Math.random() * 3); // 5 to 7 full spins
        
        // Make sure targetAngle is greater than startAngle by at least the extra spins
        this.targetAngle = baseTargetAngle;
        while (this.targetAngle < this.startAngle + extraSpins * 2 * Math.PI) {
            this.targetAngle += 2 * Math.PI;
        }

        // Use forced duration or randomize slightly for variety (4.2s to 5.0s)
        this.spinDuration = forcedDuration !== null ? forcedDuration : (4200 + Math.random() * 800);

        return { winnerIndex, duration: this.spinDuration };
    }

    draw() {
        this.ctx.clearRect(0, 0, this.size, this.size);

        if (this.isSpinning) {
            if (!this.spinStartTime) {
                this.spinStartTime = performance.now();
            }
            const elapsed = performance.now() - this.spinStartTime;
            const progress = Math.min(elapsed / this.spinDuration, 1);

            // Easing function (easeOutQuint)
            const easeOutQuint = 1 - Math.pow(1 - progress, 5);
            this.angle = this.startAngle + (this.targetAngle - this.startAngle) * easeOutQuint;

            if (progress === 1) {
                this.isSpinning = false;
                this.determineWinner();
            }
        }

        // Draw empty wheel placeholder if no segments exist
        if (this.segments.length === 0) {
            this.drawPlaceholder();
            return;
        }

        const arcSize = (2 * Math.PI) / this.segments.length;

        this.ctx.save();
        this.ctx.translate(this.centerX, this.centerY);
        this.ctx.rotate(this.angle);

        // Adjust font sizes based on segment count
        let fontSize = 24;
        let subFontSize = 16;
        if (this.segments.length > 20) {
            fontSize = 11;
            subFontSize = 7;
        } else if (this.segments.length > 12) {
            fontSize = 14;
            subFontSize = 9;
        } else if (this.segments.length > 6) {
            fontSize = 18;
            subFontSize = 12;
        }

        this.segments.forEach((segment, i) => {
            const startAngle = i * arcSize;
            const endAngle = startAngle + arcSize;

            // Draw slice
            this.ctx.beginPath();
            this.ctx.moveTo(0, 0);
            this.ctx.arc(0, 0, this.radius, startAngle, endAngle);
            this.ctx.closePath();

            this.ctx.fillStyle = segment.color || '#333';
            this.ctx.fill();
            
            this.ctx.strokeStyle = '#0b0e11';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();

            // Draw text
            this.ctx.save();
            this.ctx.rotate(startAngle + arcSize / 2);
            this.ctx.textAlign = 'right';
            this.ctx.textBaseline = 'middle';

            // Truncate text dynamically if it's too long
            const maxChar = this.segments.length > 15 ? 10 : (this.segments.length > 8 ? 14 : 20);
            const displayName = segment.username.length > maxChar 
                ? segment.username.substring(0, maxChar - 2) + '..' 
                : segment.username;
            const displaySlot = segment.slot_name.length > maxChar 
                ? segment.slot_name.substring(0, maxChar - 2) + '..' 
                : segment.slot_name;

            // Draw Username
            this.ctx.fillStyle = '#fff';
            this.ctx.font = `bold ${fontSize}px Inter`;
            this.ctx.fillText(displayName, this.radius - 55, -fontSize / 2);

            // Draw Slot name
            this.ctx.font = `${subFontSize}px Inter`;
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
            this.ctx.fillText(displaySlot, this.radius - 55, subFontSize / 2 + 2);

            // Draw a decorative neon dot at the slice edge
            const dotRadius = this.segments.length > 20 ? 1.5 : (this.segments.length > 12 ? 2.5 : 4);
            this.ctx.beginPath();
            this.ctx.arc(this.radius - 25, 0, dotRadius, 0, Math.PI * 2);
            this.ctx.fillStyle = '#53FC18';
            this.ctx.fill();

            this.ctx.restore();
        });

        this.ctx.restore();
    }

    drawPlaceholder() {
        // Draw the outer glow/ring
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, this.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = '#14171a';
        this.ctx.fill();
        this.ctx.strokeStyle = 'rgba(83, 252, 24, 0.25)'; // Dim neon green
        this.ctx.lineWidth = 6;
        this.ctx.stroke();

        // Decorative inner dashed ring
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, this.radius - 35, 0, Math.PI * 2);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([6, 12]);
        this.ctx.stroke();
        this.ctx.setLineDash([]); // Reset line dash

        // Instruction Text (placed in empty halves to avoid central SPIN button)
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';

        // Upper Text
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.font = '600 16px Inter';
        this.ctx.fillText("WAITING FOR ENTRIES", this.centerX, this.centerY - 95);

        // Lower Text
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        this.ctx.font = '14px Inter';
        this.ctx.fillText("Send commands in chat to join", this.centerX, this.centerY + 95);
    }

    determineWinner() {
        if (this.onFinished && this.winner) {
            this.onFinished(this.winner);
        }
    }
}
