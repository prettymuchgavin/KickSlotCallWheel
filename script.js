/**
 * Main Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const kickUsernameInput = document.getElementById('kick-username');
    const connectBtn = document.getElementById('connect-btn');
    const spinBtn = document.getElementById('spin-btn');
    const queueContainer = document.getElementById('queue-container');
    const queueCount = document.getElementById('queue-count');
    const clearQueueBtn = document.getElementById('clear-queue-btn');

    // Modal Elements
    const winnerModal = document.getElementById('winner-modal');
    const winnerName = document.getElementById('winner-name');
    const winnerSlot = document.getElementById('winner-slot');
    const winnerCover = document.getElementById('winner-cover');

    // State
    const queue = []; // Array of { username, slot_name }

    // Initialize Modules
    const wheel = new Wheel('wheel-canvas');
    const kickHandler = new KickClient();

    // Resize handling
    window.addEventListener('resize', () => {
        // wheel.resize(); // Implement if needed
    });

    // Slot Image Placeholder Logic
    function getSlotImage(slotName) {
        // Dynamic placeholder with the slot name
        const encodedName = encodeURIComponent(slotName);
        return `https://placehold.co/600x400/101010/53FC18?text=${encodedName}&font=montserrat`;
    }

    // --- UI Functions ---

    function addToQueue(user) {
        // user = { username, slot_name, color }
        // Case-insensitive check to be safe
        const existingIndex = queue.findIndex(u => u.username.toLowerCase() === user.username.toLowerCase());

        if (existingIndex !== -1) {
            // User already in queue: Ignore subsequent commands (Lock choice)
            console.log(`User ${user.username} already in queue. Ignoring.`);
            return;
        }

        queue.push(user);
        updateQueueUI();
        wheel.updateSegments(queue);
    }

    function updateQueueUI() {
        queueContainer.innerHTML = '';
        queueCount.innerText = queue.length;

        queue.forEach(user => {
            const item = document.createElement('div');
            item.className = 'queue-item';
            // Removed Image tag here
            item.innerHTML = `
                <div class="q-info">
                    <span class="q-name">${user.username}</span>
                    <span class="q-slot">${user.slot_name}</span>
                </div>
            `;
            queueContainer.appendChild(item);
        });
    }

    function showWinner(winner) {
        winnerName.innerText = winner.username;
        winnerSlot.innerText = winner.slot_name;
        // set slot cover removed
        winnerModal.classList.add('active');

        addToHistory(winner);
    }

    function addToHistory(winner) {
        const list = document.getElementById('recent-list');
        const item = document.createElement('div');
        item.className = 'recent-item';
        item.innerHTML = `<span>${winner.username}</span> ${winner.slot_name}`;

        // Prepend new winner
        list.prepend(item);

        // Limit to 5 items
        if (list.children.length > 5) {
            list.removeChild(list.lastChild);
        }
    }

    // --- Event Listeners ---

    // Connect to Kick
    connectBtn.addEventListener('click', async () => {
        const username = kickUsernameInput.value.trim();
        if (!username) return alert('Please enter a Kick username');

        connectBtn.disabled = true;
        connectBtn.innerText = 'Connecting...';

        try {
            await kickHandler.connect(username, handleKickMessage);
            connectBtn.innerText = 'Connected';
            connectBtn.classList.add('btn-primary'); // Keep green
        } catch (err) {
            console.error(err);
            alert('Failed to connect automatically. Try Manual ID.');
            document.getElementById('manual-connection').style.display = 'block';
            connectBtn.innerText = 'Connect Chat';
            connectBtn.disabled = false;
        }
    });

    // Manual Connect
    document.getElementById('manual-connect-btn').addEventListener('click', () => {
        const id = document.getElementById('channel-id').value;
        if (!id) return;
        kickHandler.connectById(id, handleKickMessage);
    });

    // --- Mode Toggle Logic ---
    let isGiveawayMode = false;
    const modeToggle = document.getElementById('mode-toggle');
    const modeLabel = document.getElementById('mode-label');
    const instructionBanner = document.querySelector('.instruction-banner');

    modeToggle.addEventListener('change', () => {
        isGiveawayMode = modeToggle.checked;
        if (isGiveawayMode) {
            modeLabel.innerText = "Giveaway Mode";
            instructionBanner.innerHTML = 'use <span>!giveaway</span> to enter giveaway!';
        } else {
            modeLabel.innerText = "Slot Call Mode";
            instructionBanner.innerHTML = 'use <span>!slotcall [name]</span> to call a slot!';
        }
    });

    // Unified Message Handler
    function handleKickMessage(msg) {
        if (!msg || !msg.content || typeof msg.content !== 'string') return;

        const content = msg.content.trim();
        const lowerContent = content.toLowerCase();

        if (isGiveawayMode) {
            // Giveaway Mode: !giveaway -> Adds username
            if (lowerContent.startsWith('!giveaway')) {
                addToQueue({
                    username: msg.sender.username,
                    slot_name: msg.sender.username, // In giveaway, slot name IS the username
                    color: getRandomColor()
                });
            }
        } else {
            // Slot Call Mode: !slotcall [name]
            if (lowerContent.startsWith('!slotcall')) {
                const parts = content.split(' ');
                if (parts.length < 2) return;
                const slotName = parts.slice(1).join(' ');

                addToQueue({
                    username: msg.sender.username,
                    slot_name: slotName,
                    color: getRandomColor()
                });
            }
        }
    }



    // Clear Queue
    clearQueueBtn.addEventListener('click', () => {
        queue.length = 0;
        updateQueueUI();
        wheel.clear();
    });

    // Spin
    spinBtn.addEventListener('click', () => {
        if (queue.length === 0) return alert('Queue is empty!');
        if (wheel.isSpinning) return;

        wheel.spin((winner) => {
            console.log('Winner:', winner);
            // Delay slightly for effect
            setTimeout(() => showWinner(winner), 500);
        });
    });

    // Animation Loop for Wheel
    function animate() {
        wheel.draw();
        requestAnimationFrame(animate);
    }
    animate();

    // Helper
    function getRandomColor() {
        const hue = Math.floor(Math.random() * 360);
        return `hsl(${hue}, 70%, 50%)`;
    }
});
