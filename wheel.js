class Wheel {
    constructor(canvasId) {
        this.canvas = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
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

        // Sound tracking
        this.lastPegIndex = -1;

        // Custom Hub Logo Image
        this.hubLogoImg = null;
    }

    setHubLogo(url) {
        if (!url) {
            this.hubLogoImg = null;
            this.draw();
            return;
        }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            this.hubLogoImg = img;
            this.draw();
        };
        img.onerror = () => {
            this.hubLogoImg = null;
        };
        img.src = url;
    }

    updateSegments(newSegments) {
        this.segments = newSegments;
        this.computeSegmentAngles();
        if (!this.isSpinning) {
            this.draw();
        }
    }

    computeSegmentAngles() {
        if (this.segments.length === 0) return;
        const totalWeight = this.segments.reduce((sum, s) => sum + (s.weight || 1), 0);
        let currentAngle = 0;

        this.segments.forEach(s => {
            const weight = s.weight || 1;
            s._arcSize = (2 * Math.PI) * (weight / totalWeight);
            s._startAngle = currentAngle;
            s._endAngle = currentAngle + s._arcSize;
            currentAngle = s._endAngle;
        });
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
        this.lastPegIndex = -1;

        this.computeSegmentAngles();

        // 1. Select the winner index
        const winnerIndex = forcedWinnerIndex !== null ? forcedWinnerIndex : Math.floor(Math.random() * this.segments.length);
        this.winner = this.segments[winnerIndex];
        
        // 2. Calculate target pointer angle relative to the canvas
        const winnerSeg = this.winner;
        const offsetPercent = 0.2 + Math.random() * 0.6; // keep clear of dividing lines
        const targetPointerAngle = winnerSeg._startAngle + (offsetPercent * winnerSeg._arcSize);

        // 3. Convert target pointer angle to canvas rotation angle
        // The pointer is visually at 12 o'clock (-Math.PI / 2)
        const baseTargetAngle = -Math.PI / 2 - targetPointerAngle;
        
        // 4. Spin several times before stopping
        this.startAngle = this.angle;
        const extraSpins = 5 + Math.floor(Math.random() * 3); // 5 to 7 full spins
        
        this.targetAngle = baseTargetAngle;
        while (this.targetAngle < this.startAngle + extraSpins * 2 * Math.PI) {
            this.targetAngle += 2 * Math.PI;
        }

        // Spin duration (4.2s to 5.0s)
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

            // Tick sound tracking
            this.checkPegTick();

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

        this.segments.forEach((segment) => {
            const startAngle = segment._startAngle;
            const endAngle = segment._endAngle;
            const arcSize = segment._arcSize;

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

            const weightLabel = (segment.weight && segment.weight > 1) ? ` (${segment.weight}x)` : '';

            // Draw Username
            this.ctx.fillStyle = '#fff';
            this.ctx.font = `bold ${fontSize}px Inter`;
            this.ctx.fillText(displayName + weightLabel, this.radius - 55, -fontSize / 2);

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

        // Draw Canvas Center Logo if loaded
        if (this.hubLogoImg) {
            this.drawCenterLogo();
        }
    }

    checkPegTick() {
        if (typeof soundManager === 'undefined' || !this.segments.length) return;
        
        // Pointer is at 12 o'clock (-Math.PI / 2)
        // Normalize pointer angle relative to current canvas rotation
        const pointerNormalized = ((-Math.PI / 2 - this.angle) % (2 * Math.PI) + (2 * Math.PI)) % (2 * Math.PI);
        
        // Find which segment boundary index we are at
        let currentSegIdx = 0;
        for (let i = 0; i < this.segments.length; i++) {
            const s = this.segments[i];
            if (pointerNormalized >= s._startAngle && pointerNormalized < s._endAngle) {
                currentSegIdx = i;
                break;
            }
        }

        if (this.lastPegIndex !== currentSegIdx) {
            this.lastPegIndex = currentSegIdx;
            soundManager.playTick();
        }
    }

    drawCenterLogo() {
        if (!this.hubLogoImg) return;
        const logoSize = 80;
        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, logoSize / 2, 0, Math.PI * 2);
        this.ctx.clip();
        this.ctx.drawImage(this.hubLogoImg, this.centerX - logoSize / 2, this.centerY - logoSize / 2, logoSize, logoSize);
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

        if (this.hubLogoImg) {
            this.drawCenterLogo();
        }
    }

    determineWinner() {
        if (typeof soundManager !== 'undefined') {
            soundManager.playVictory();
        }
        if (this.onFinished && this.winner) {
            this.onFinished(this.winner);
        }
    }
}
