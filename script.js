/**
 * Main Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // --- OBS Query Check ---
    const isOBS = new URLSearchParams(window.location.search).has('obs');
    if (isOBS) {
        document.body.classList.add('obs-mode');
    }

    // DOM Elements
    const kickUsernameInput = document.getElementById('kick-username');
    const connectBtn = document.getElementById('connect-btn');
    const spinBtn = document.getElementById('spin-btn');
    const queueContainer = document.getElementById('queue-container');
    const queueCount = document.getElementById('queue-count');
    const clearQueueBtn = document.getElementById('clear-queue-btn');
    const copyObsBtn = document.getElementById('copy-obs-btn');
    const copyStatus = document.getElementById('copy-status');

    // Modal Elements
    const winnerModal = document.getElementById('winner-modal');
    const winnerName = document.getElementById('winner-name');
    const winnerSlot = document.getElementById('winner-slot');

    // Initialize Modules
    const wheel = new Wheel('wheel-canvas');
    const kickHandler = new KickClient();

    // Curated Neon Color Palette
    const GLOWING_COLORS = [
        '#53FC18', // Kick Green
        '#FF3E6C', // Neon Pink
        '#00F0FF', // Electric Cyan
        '#9D00FF', // Vivid Purple
        '#FF9F00', // Neon Orange
        '#FF003C', // Neon Red
        '#00FF85', // Mint Green
        '#FF00D6', // Hot Magenta
        '#3A86FF', // Royal Blue
        '#FFBE0B', // Yellow Gold
    ];
    let colorIndex = 0;
    function getNextColor() {
        const color = GLOWING_COLORS[colorIndex];
        colorIndex = (colorIndex + 1) % GLOWING_COLORS.length;
        return color;
    }

    // State
    const queue = []; // Array of { username, slot_name, color }
    const history = []; // Array of { username, slot_name }
    let isConnected = false;
    let isGiveawayMode = false;

    // --- Mode Toggle DOM Elements ---
    const modeToggle = document.getElementById('mode-toggle');
    const modeLabel = document.getElementById('mode-label');
    const instructionBanner = document.querySelector('.instruction-banner');

    // --- Load Saved Settings & Queue from LocalStorage ---
    
    // 1. Load Queue
    const savedQueue = localStorage.getItem('kick_wheel_queue');
    if (savedQueue) {
        try {
            const parsed = JSON.parse(savedQueue);
            if (Array.isArray(parsed)) {
                queue.push(...parsed);
            }
        } catch (e) {
            console.error('Failed to parse saved queue', e);
        }
    }

    // 2. Load History
    const savedHistory = localStorage.getItem('kick_wheel_history');
    if (savedHistory) {
        try {
            const parsed = JSON.parse(savedHistory);
            if (Array.isArray(parsed)) {
                history.push(...parsed);
            }
        } catch (e) {
            console.error('Failed to parse saved history', e);
        }
    }

    // 3. Load Mode
    const savedMode = localStorage.getItem('kick_wheel_mode');
    if (savedMode === 'giveaway') {
        isGiveawayMode = true;
        modeToggle.checked = true;
        modeLabel.innerText = "Giveaway Mode";
        instructionBanner.innerHTML = 'use <span>!giveaway</span> to enter giveaway!';
    } else {
        isGiveawayMode = false;
        modeToggle.checked = false;
        modeLabel.innerText = "Slot Call Mode";
        instructionBanner.innerHTML = 'use <span>!slotcall [name]</span> to call a slot!';
    }

    // 4. Update UI with Loaded Data
    updateQueueUI();
    updateHistoryUI();
    wheel.updateSegments(queue);

    // 5. Auto-connect if active previously (Host window only)
    if (!isOBS) {
        const autoConnect = localStorage.getItem('kick_wheel_auto_connect') === 'true';
        const connectionType = localStorage.getItem('kick_wheel_connection_type');
        const savedUsername = localStorage.getItem('kick_wheel_username');
        const savedId = localStorage.getItem('kick_wheel_channel_id');

        if (savedUsername) kickUsernameInput.value = savedUsername;
        if (savedId) document.getElementById('channel-id').value = savedId;

        if (autoConnect) {
            if (connectionType === 'manual' && savedId) {
                document.getElementById('manual-connection').style.display = 'block';
                connectWithId(savedId);
            } else if (savedUsername) {
                connectToKick(savedUsername);
            }
        }
    }

    // --- UI Functions ---

    function addToQueue(user) {
        // Case-insensitive check to be safe
        const existingIndex = queue.findIndex(u => u.username.toLowerCase() === user.username.toLowerCase());

        if (existingIndex !== -1) {
            console.log(`User ${user.username} already in queue. Ignoring.`);
            return;
        }

        queue.push(user);
        updateQueueUI();
        localStorage.setItem('kick_wheel_queue', JSON.stringify(queue));
        
        // Defer updating segment colors/sizes if wheel is spinning to avoid mid-spin glitching
        if (!wheel.isSpinning) {
            wheel.updateSegments(queue);
        }
    }

    function removeFromQueue(index) {
        if (wheel.isSpinning) return;
        queue.splice(index, 1);
        updateQueueUI();
        localStorage.setItem('kick_wheel_queue', JSON.stringify(queue));
        wheel.updateSegments(queue);
    }

    function updateQueueUI() {
        if (isOBS) return; // No sidebar UI in OBS overlay
        
        queueContainer.innerHTML = '';
        queueCount.innerText = queue.length;

        queue.forEach((user, index) => {
            const item = document.createElement('div');
            item.className = 'queue-item';
            item.innerHTML = `
                <div class="q-info">
                    <span class="q-name">${user.username}</span>
                    <span class="q-slot">${user.slot_name}</span>
                </div>
                <button class="q-delete-btn" title="Remove from queue">✕</button>
            `;
            
            // Add click handler for delete button
            const deleteBtn = item.querySelector('.q-delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeFromQueue(index);
            });
            
            queueContainer.appendChild(item);
        });
    }

    function showWinner(winner) {
        winnerName.innerText = winner.username;
        winnerSlot.innerText = winner.slot_name;
        winnerModal.classList.add('active');

        // Only host tab should modify history/persistence
        if (!isOBS) {
            addToHistory(winner);
            localStorage.setItem('kick_wheel_modal_active', 'true');
        }
    }

    function addToHistory(winner) {
        history.unshift(winner);
        if (history.length > 5) {
            history.pop();
        }
        localStorage.setItem('kick_wheel_history', JSON.stringify(history));
        updateHistoryUI();
    }

    function updateHistoryUI() {
        // Stacked slots for overlay only displays 4 most recent called slots
        const maxDisplay = isOBS ? 4 : 5;
        const list = document.getElementById('recent-list');
        list.innerHTML = '';
        
        // Take up to maxDisplay elements
        const itemsToDisplay = history.slice(0, maxDisplay);
        itemsToDisplay.forEach(winner => {
            const item = document.createElement('div');
            item.className = 'recent-item';
            item.innerHTML = `<span>${winner.username}</span> ${winner.slot_name}`;
            list.appendChild(item);
        });
    }

    // --- Connection Helpers ---

    async function connectToKick(username) {
        if (isOBS) return;
        connectBtn.disabled = true;
        connectBtn.innerText = 'Connecting...';

        try {
            await kickHandler.connect(username, handleKickMessage);
            setConnected(true);
            localStorage.setItem('kick_wheel_username', username);
            localStorage.setItem('kick_wheel_connection_type', 'auto');
            localStorage.setItem('kick_wheel_auto_connect', 'true');
        } catch (err) {
            console.error(err);
            alert('Failed to connect automatically. Try Manual ID.');
            document.getElementById('manual-connection').style.display = 'block';
            setConnected(false);
            localStorage.removeItem('kick_wheel_auto_connect');
        }
    }

    function connectWithId(id) {
        if (isOBS) return;
        const manualConnectBtn = document.getElementById('manual-connect-btn');
        manualConnectBtn.disabled = true;
        manualConnectBtn.innerText = 'Connecting...';

        try {
            kickHandler.connectById(id, handleKickMessage);
            setConnected(true);
            localStorage.setItem('kick_wheel_channel_id', id);
            localStorage.setItem('kick_wheel_connection_type', 'manual');
            localStorage.setItem('kick_wheel_auto_connect', 'true');
        } catch (err) {
            console.error(err);
            alert('Failed to connect via Manual ID.');
            setConnected(false);
            localStorage.removeItem('kick_wheel_auto_connect');
        }
    }

    function disconnectFromKick() {
        if (isOBS) return;
        kickHandler.disconnect();
        setConnected(false);
        localStorage.removeItem('kick_wheel_auto_connect');
    }

    function setConnected(connected) {
        isConnected = connected;
        const manualConnectBtn = document.getElementById('manual-connect-btn');

        if (connected) {
            // Style Main Connect Button as Disconnect
            connectBtn.disabled = false;
            connectBtn.innerText = 'Disconnect';
            connectBtn.classList.remove('btn-primary');
            connectBtn.classList.add('btn-secondary');
            connectBtn.style.background = 'rgba(255, 100, 100, 0.2)';
            connectBtn.style.color = '#ff6b6b';
            connectBtn.style.border = '1px solid rgba(255, 100, 100, 0.4)';

            // Style Manual Connect Button as Disconnect
            manualConnectBtn.disabled = false;
            manualConnectBtn.innerText = 'Disconnect';
            manualConnectBtn.classList.remove('btn-primary');
            manualConnectBtn.classList.add('btn-secondary');
            manualConnectBtn.style.background = 'rgba(255, 100, 100, 0.2)';
            manualConnectBtn.style.color = '#ff6b6b';
            manualConnectBtn.style.border = '1px solid rgba(255, 100, 100, 0.4)';
        } else {
            // Revert Main Connect Button
            connectBtn.disabled = false;
            connectBtn.innerText = 'Connect Chat';
            connectBtn.classList.add('btn-primary');
            connectBtn.classList.remove('btn-secondary');
            connectBtn.style.background = '';
            connectBtn.style.color = '';
            connectBtn.style.border = '';

            // Revert Manual Connect Button
            manualConnectBtn.disabled = false;
            manualConnectBtn.innerText = 'Connect';
            manualConnectBtn.classList.add('btn-primary');
            manualConnectBtn.classList.remove('btn-secondary');
            manualConnectBtn.style.background = '';
            manualConnectBtn.style.color = '';
            manualConnectBtn.style.border = '';
        }
    }

    // --- Event Listeners ---

    if (!isOBS) {
        // Connect to Kick
        connectBtn.addEventListener('click', async () => {
            if (isConnected) {
                disconnectFromKick();
                return;
            }

            const username = kickUsernameInput.value.trim();
            if (!username) return alert('Please enter a Kick username');
            await connectToKick(username);
        });

        // Manual Connect
        document.getElementById('manual-connect-btn').addEventListener('click', () => {
            if (isConnected) {
                disconnectFromKick();
                return;
            }

            const id = document.getElementById('channel-id').value.trim();
            if (!id) return alert('Please enter a Channel ID');
            connectWithId(id);
        });

        // Mode Toggle Logic
        modeToggle.addEventListener('change', () => {
            isGiveawayMode = modeToggle.checked;
            if (isGiveawayMode) {
                modeLabel.innerText = "Giveaway Mode";
                instructionBanner.innerHTML = 'use <span>!giveaway</span> to enter giveaway!';
                localStorage.setItem('kick_wheel_mode', 'giveaway');
            } else {
                modeLabel.innerText = "Slot Call Mode";
                instructionBanner.innerHTML = 'use <span>!slotcall [name]</span> to call a slot!';
                localStorage.setItem('kick_wheel_mode', 'slotcall');
            }
        });
        
        // Clear Queue
        clearQueueBtn.addEventListener('click', () => {
            if (wheel.isSpinning) return;
            queue.length = 0;
            updateQueueUI();
            localStorage.setItem('kick_wheel_queue', JSON.stringify(queue));
            wheel.clear();
        });

        // Spin Button Click Handler (Dashboard host tab only)
        spinBtn.addEventListener('click', () => {
            if (queue.length === 0) return alert('Queue is empty!');
            if (wheel.isSpinning) return;

            const spinResult = wheel.spin((winner) => {
                console.log('Winner selected:', winner);
                setTimeout(() => {
                    showWinner(winner);
                    wheel.updateSegments(queue);
                }, 600);
            });

            // Broadcast the spin event details to the OBS overlay window
            localStorage.setItem('kick_wheel_spin_event', JSON.stringify({
                timestamp: Date.now(),
                winnerIndex: spinResult.winnerIndex,
                duration: spinResult.duration
            }));
        });

        // Copy OBS Link Logic
        if (copyObsBtn) {
            copyObsBtn.addEventListener('click', () => {
                const url = new URL(window.location.href);
                url.searchParams.set('obs', 'true');
                const obsUrl = url.toString();

                navigator.clipboard.writeText(obsUrl).then(() => {
                    copyStatus.style.opacity = '1';
                    setTimeout(() => {
                        copyStatus.style.opacity = '0';
                    }, 2500);
                }).catch(err => {
                    console.error('Failed to copy', err);
                    alert('Could not copy automatically. URL is:\n' + obsUrl);
                });
            });
        }
    }

    // Unified Message Handler (Dashboard only)
    function handleKickMessage(msg) {
        if (isOBS) return;
        if (!msg || !msg.content || typeof msg.content !== 'string') return;

        const content = msg.content.trim();
        const lowerContent = content.toLowerCase();

        if (isGiveawayMode) {
            if (lowerContent.startsWith('!giveaway')) {
                addToQueue({
                    username: msg.sender.username,
                    slot_name: msg.sender.username,
                    color: getNextColor()
                });
            }
        } else {
            if (lowerContent.startsWith('!slotcall')) {
                const parts = content.split(' ');
                if (parts.length < 2) return;
                const slotName = parts.slice(1).join(' ');

                addToQueue({
                    username: msg.sender.username,
                    slot_name: slotName,
                    color: getNextColor()
                });
            }
        }
    }

    // Close Modal Handler (Broadcasts modal dismissal to OBS overlay)
    function dismissWinnerModal() {
        winnerModal.classList.remove('active');
        if (!isOBS) {
            localStorage.setItem('kick_wheel_modal_active', 'false');
        }
    }

    // Close buttons inside Winner Modal
    const modalCloseBtn = winnerModal.querySelector('.btn-primary');
    if (modalCloseBtn) {
        modalCloseBtn.removeAttribute('onclick'); // remove inline handler
        modalCloseBtn.addEventListener('click', dismissWinnerModal);
    }
    
    // Background Overlay Click Dismissal
    winnerModal.addEventListener('click', (e) => {
        if (e.target === winnerModal) {
            dismissWinnerModal();
        }
    });

    // --- Real-time LocalStorage Synchronization ---
    window.addEventListener('storage', (e) => {
        if (e.key === 'kick_wheel_queue' && e.newValue) {
            try {
                const newQueue = JSON.parse(e.newValue);
                queue.length = 0;
                queue.push(...newQueue);
                updateQueueUI();
                wheel.updateSegments(queue);
            } catch (err) {
                console.error(err);
            }
        }
        
        if (e.key === 'kick_wheel_history' && e.newValue) {
            try {
                const newHistory = JSON.parse(e.newValue);
                history.length = 0;
                history.push(...newHistory);
                updateHistoryUI();
            } catch (err) {
                console.error(err);
            }
        }

        if (e.key === 'kick_wheel_mode' && e.newValue) {
            isGiveawayMode = e.newValue === 'giveaway';
            if (modeToggle) modeToggle.checked = isGiveawayMode;
            if (isGiveawayMode) {
                if (modeLabel) modeLabel.innerText = "Giveaway Mode";
                instructionBanner.innerHTML = 'use <span>!giveaway</span> to enter giveaway!';
            } else {
                if (modeLabel) modeLabel.innerText = "Slot Call Mode";
                instructionBanner.innerHTML = 'use <span>!slotcall [name]</span> to call a slot!';
            }
        }

        // Handle spin trigger sync for OBS view
        if (e.key === 'kick_wheel_spin_event' && e.newValue) {
            try {
                const eventData = JSON.parse(e.newValue);
                // Trigger exact same spin math parameters
                wheel.spin((winner) => {
                    setTimeout(() => {
                        showWinner(winner);
                        wheel.updateSegments(queue);
                    }, 600);
                }, eventData.winnerIndex, eventData.duration);
            } catch (err) {
                console.error(err);
            }
        }

        // Handle modal dismissal sync for OBS view
        if (e.key === 'kick_wheel_modal_active' && e.newValue) {
            if (e.newValue === 'false') {
                winnerModal.classList.remove('active');
            }
        }
    });

    // Animation Loop for Wheel
    function animate() {
        wheel.draw();
        requestAnimationFrame(animate);
    }
    animate();
});
