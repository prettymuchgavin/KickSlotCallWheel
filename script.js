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
    const queueContainer = document.getElementById('queue-container');
    const queueCount = document.getElementById('queue-count');
    const clearQueueBtn = document.getElementById('clear-queue-btn');
    const wheelCountSelect = document.getElementById('wheel-count-select');
    const wheelsWrapper = document.getElementById('wheels-wrapper');
    const spinBtn = document.getElementById('spin-btn');
    const giveawaySettingsContainer = document.getElementById('giveaway-settings-container');
    const giveawayKeywordInput = document.getElementById('giveaway-keyword-input');
    const hideKeywordToggle = document.getElementById('hide-keyword-toggle');
    const acceptEntriesToggle = document.getElementById('accept-entries-toggle');
    const entriesLabel = document.getElementById('entries-label');
    const entriesReminderPopup = document.getElementById('entries-reminder-popup');
    const minWatchtimeInput = document.getElementById('min-watchtime-input');
    const soundToggle = document.getElementById('sound-toggle');
    const goldSpinToggle = document.getElementById('gold-spin-toggle');
    const subWeightSelect = document.getElementById('sub-weight-select');
    const hubLogoInput = document.getElementById('hub-logo-input');
    const uploadLogoBtn = document.getElementById('upload-logo-btn');
    const hubLogoFile = document.getElementById('hub-logo-file');

    // Modal Elements
    const winnerModal = document.getElementById('winner-modal');

    // Initialize Kick Client
    const kickHandler = new KickClient();

    // Multi-Wheel State
    let wheelCount = 1;
    const wheels = [];
    let entriesClosedTimer = null;
    let hubLogoUrl = '';
    let subMultiplier = 2;
    let isGoldSpinEnabled = false;

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
    const queue = []; // Array of { username, slot_name, color, weight, profile_pic }
    const history = []; // Array of { username, slot_name }
    const chatLogs = []; // Array of { username, content, timestamp }
    const userMeta = {}; // Object mapping username -> { createdAt, badges, profilePic }
    const userWatchTime = {}; // Object mapping username -> { minutes, lastActive, firstSeen }
    let isConnected = false;
    let isGiveawayMode = false;
    let connectedUsername = '';
    let giveawayKeyword = '!giveaway';
    let hideGiveawayKeyword = false;
    let acceptEntries = true;
    let minWatchTimeHours = 0;

    // --- Active Segment Generator ---
    function getWheelActiveSegments() {
        if (queue.length === 0) return [];
        const segs = [...queue];
        if (isGoldSpinEnabled) {
            segs.push({
                isGoldSpin: true,
                username: '🌟 GOLD SPIN',
                slot_name: 'RE-SPIN FOR UNDERDOGS',
                color: '#FFD700',
                weight: 1
            });
        }
        return segs;
    }

    function refreshAllWheelSegments() {
        const activeSegs = getWheelActiveSegments();
        wheels.forEach(w => {
            if (!w.isSpinning) {
                w.updateSegments(activeSegs);
            }
        });
    }

    // --- Center Hub Logo Helper ---
    function updateCenterHubsLogo(url) {
        hubLogoUrl = url || '';
        document.querySelectorAll('.wheel-center-hub').forEach(hub => {
            if (url) {
                hub.innerHTML = `<img src="${url}" alt="Logo" style="width: 100%; height: 100%; object-fit: cover;">`;
            } else {
                hub.innerHTML = '';
            }
        });
        wheels.forEach(w => w.setHubLogo(url));
    }

    // --- Watch Time Tracking Helpers ---
    function recordUserActivity(username) {
        if (!username) return;
        const key = username.toLowerCase();
        const now = Date.now();
        if (!userWatchTime[key]) {
            userWatchTime[key] = { minutes: 1, lastActive: now, firstSeen: now };
        } else {
            const record = userWatchTime[key];
            const elapsedMins = (now - record.lastActive) / (1000 * 60);
            if (elapsedMins > 0) {
                record.minutes += Math.min(elapsedMins, 15);
            }
            record.lastActive = now;
        }
        try {
            localStorage.setItem('kick_wheel_watch_time', JSON.stringify(userWatchTime));
        } catch (e) {}
    }

    function getUserWatchTimeHours(username) {
        if (!username) return 0;
        const record = userWatchTime[username.toLowerCase()];
        if (!record) return 0;
        return record.minutes / 60;
    }

    // --- Time Format Helpers ---
    function formatTimeAgo(timestamp) {
        const diff = Math.floor((Date.now() - timestamp) / 1000);
        if (diff < 60) return `${diff}s ago`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        return `${Math.floor(diff / 86400)}d ago`;
    }

    function formatDuration(dateString) {
        if (!dateString) return 'Unknown';
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return 'Unknown';
        const diffMs = Date.now() - date.getTime();
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (days < 1) return 'less than a day';
        if (days < 30) return `${days} day${days > 1 ? 's' : ''}`;
        const months = Math.floor(days / 30);
        if (months < 12) return `${months} month${months > 1 ? 's' : ''} (${days}d)`;
        const years = (days / 365).toFixed(1);
        return `${years} year${years !== '1.0' ? 's' : ''} (${days}d)`;
    }

    // --- Mode & Entries Toggle DOM Elements ---
    const modeToggle = document.getElementById('mode-toggle');
    const modeLabel = document.getElementById('mode-label');
    const instructionBanner = document.querySelector('.instruction-banner');

    function checkEntriesReminderTimer() {
        if (entriesClosedTimer) {
            clearTimeout(entriesClosedTimer);
            entriesClosedTimer = null;
        }

        if (!acceptEntries) {
            entriesClosedTimer = setTimeout(() => {
                if (!acceptEntries && entriesReminderPopup) {
                    entriesReminderPopup.style.display = 'block';
                }
            }, 15000);
        } else {
            if (entriesReminderPopup) {
                entriesReminderPopup.style.display = 'none';
            }
        }
    }

    function updateEntriesUI() {
        if (entriesLabel) {
            if (acceptEntries) {
                entriesLabel.innerText = 'Entries Open';
                entriesLabel.style.color = 'var(--kick-green)';
            } else {
                entriesLabel.innerText = 'Entries Closed';
                entriesLabel.style.color = '#ff6b6b';
            }
        }
        checkEntriesReminderTimer();
    }

    function updateInstructionBanner() {
        if (giveawayKeywordInput) {
            giveawayKeywordInput.type = hideGiveawayKeyword ? 'password' : 'text';
        }
        if (!instructionBanner) return;

        if (!acceptEntries) {
            instructionBanner.style.display = 'block';
            instructionBanner.innerHTML = '<span>Entries Closed</span>';
            if (giveawaySettingsContainer) giveawaySettingsContainer.style.display = isGiveawayMode ? 'block' : 'none';
            return;
        }

        if (isGiveawayMode) {
            if (giveawaySettingsContainer) giveawaySettingsContainer.style.display = 'block';
            if (hideGiveawayKeyword) {
                instructionBanner.style.display = 'none';
            } else {
                instructionBanner.style.display = 'block';
                const kw = giveawayKeyword || '!giveaway';
                instructionBanner.innerHTML = `use <span>${kw}</span> to enter giveaway!`;
            }
        } else {
            if (giveawaySettingsContainer) giveawaySettingsContainer.style.display = 'none';
            instructionBanner.style.display = 'block';
            instructionBanner.innerHTML = 'use <span>!slotcall [name]</span> to call a slot!';
        }
    }

    // --- Dynamic Wheel Setup ---
    function setupWheels(count) {
        wheelCount = parseInt(count, 10) || 1;
        if (wheelsWrapper) {
            wheelsWrapper.className = `wheels-grid wheels-${wheelCount}`;
            wheelsWrapper.innerHTML = '';
        }
        wheels.length = 0;

        let firstContainer = null;
        for (let i = 0; i < wheelCount; i++) {
            const container = document.createElement('div');
            container.className = 'wheel-container';
            
            const pointer = document.createElement('div');
            pointer.className = 'wheel-pointer';

            const canvas = document.createElement('canvas');
            canvas.className = 'wheel-canvas';
            canvas.width = 800;
            canvas.height = 800;
            
            const centerHub = document.createElement('div');
            centerHub.className = 'wheel-center-hub';
            if (hubLogoUrl) {
                centerHub.innerHTML = `<img src="${hubLogoUrl}" alt="Logo" style="width: 100%; height: 100%; object-fit: cover;">`;
            }

            container.appendChild(pointer);
            container.appendChild(canvas);
            container.appendChild(centerHub);
            if (wheelsWrapper) wheelsWrapper.appendChild(container);

            if (i === 0) firstContainer = container;

            const wheelInstance = new Wheel(canvas);
            if (hubLogoUrl) wheelInstance.setHubLogo(hubLogoUrl);
            wheels.push(wheelInstance);
        }

        refreshAllWheelSegments();

        if (spinBtn) {
            if (wheelsWrapper && wheelsWrapper.parentNode) {
                wheelsWrapper.parentNode.insertBefore(spinBtn, wheelsWrapper.nextSibling);
            }
            spinBtn.classList.remove('single-wheel-spin');
            spinBtn.innerText = wheelCount === 1 ? 'SPIN' : `SPIN ALL (${wheelCount})`;
        }
    }

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

    // 3. Load Chat Logs, User Meta & Watch Time
    const savedChatLogs = localStorage.getItem('kick_wheel_chat_logs');
    if (savedChatLogs) {
        try {
            const parsed = JSON.parse(savedChatLogs);
            if (Array.isArray(parsed)) {
                const twoDaysAgo = Date.now() - (48 * 60 * 60 * 1000);
                chatLogs.push(...parsed.filter(m => m.timestamp >= twoDaysAgo));
            }
        } catch (e) {
            console.error('Failed to parse saved chat logs', e);
        }
    }

    const savedUserMeta = localStorage.getItem('kick_wheel_user_meta');
    if (savedUserMeta) {
        try {
            const parsed = JSON.parse(savedUserMeta);
            Object.assign(userMeta, parsed);
        } catch (e) {
            console.error('Failed to parse saved user meta', e);
        }
    }

    const savedWatchTime = localStorage.getItem('kick_wheel_watch_time');
    if (savedWatchTime) {
        try {
            const parsed = JSON.parse(savedWatchTime);
            Object.assign(userWatchTime, parsed);
        } catch (e) {
            console.error('Failed to parse saved watch time', e);
        }
    }

    // 4. Load Sound, Gold Spin, Multiplier & Hub Logo Settings
    const savedSound = localStorage.getItem('kick_wheel_sound_enabled');
    if (savedSound !== null) {
        const soundOn = savedSound === 'true';
        if (soundToggle) soundToggle.checked = soundOn;
        if (typeof soundManager !== 'undefined') soundManager.enabled = soundOn;
    }

    const savedGoldSpin = localStorage.getItem('kick_wheel_gold_spin_enabled');
    if (savedGoldSpin !== null) {
        isGoldSpinEnabled = savedGoldSpin === 'true';
        if (goldSpinToggle) goldSpinToggle.checked = isGoldSpinEnabled;
    }

    const savedSubMult = localStorage.getItem('kick_wheel_sub_multiplier');
    if (savedSubMult) {
        subMultiplier = parseInt(savedSubMult, 10) || 2;
        if (subWeightSelect) subWeightSelect.value = subMultiplier.toString();
    }

    const savedLogo = localStorage.getItem('kick_wheel_hub_logo');
    if (savedLogo) {
        hubLogoUrl = savedLogo;
        if (hubLogoInput) hubLogoInput.value = hubLogoUrl;
    }

    // 5. Load Mode, Giveaway & Entry Settings
    const savedMode = localStorage.getItem('kick_wheel_mode');
    isGiveawayMode = savedMode === 'giveaway';
    if (modeToggle) modeToggle.checked = isGiveawayMode;
    if (modeLabel) modeLabel.innerText = isGiveawayMode ? "Giveaway Mode" : "Slot Call Mode";

    const savedKeyword = localStorage.getItem('kick_wheel_giveaway_keyword');
    if (savedKeyword) {
        giveawayKeyword = savedKeyword;
        if (giveawayKeywordInput) giveawayKeywordInput.value = giveawayKeyword;
    }

    const savedHideKeyword = localStorage.getItem('kick_wheel_hide_keyword') === 'true';
    hideGiveawayKeyword = savedHideKeyword;
    if (hideKeywordToggle) hideKeywordToggle.checked = hideGiveawayKeyword;

    const savedAcceptEntries = localStorage.getItem('kick_wheel_accept_entries');
    if (savedAcceptEntries !== null) {
        acceptEntries = savedAcceptEntries === 'true';
        if (acceptEntriesToggle) acceptEntriesToggle.checked = acceptEntries;
    }

    const savedMinWatch = localStorage.getItem('kick_wheel_min_watchtime');
    if (savedMinWatch) {
        minWatchTimeHours = parseFloat(savedMinWatch) || 0;
        if (minWatchtimeInput) minWatchtimeInput.value = minWatchTimeHours;
    }

    updateEntriesUI();
    updateInstructionBanner();

    // 6. Load Wheel Count
    const urlParams = new URLSearchParams(window.location.search);
    const queryWheelCount = urlParams.get('wheels') || urlParams.get('count');
    const savedWheelCount = queryWheelCount || localStorage.getItem('kick_wheel_count') || '1';
    if (wheelCountSelect) wheelCountSelect.value = savedWheelCount;
    setupWheels(savedWheelCount);
    updateCenterHubsLogo(hubLogoUrl);

    // 7. Update UI with Loaded Data
    updateQueueUI();
    updateHistoryUI();

    // 8. OBS URL Parameters Check (Highest priority for OBS connection)
    const queryUsername = urlParams.get('username') || urlParams.get('user');
    const queryChannelId = urlParams.get('channel_id') || urlParams.get('channelId') || urlParams.get('id');

    if (isOBS && (queryUsername || queryChannelId)) {
        console.log('OBS auto-connecting via URL query parameters...');
        if (queryChannelId) {
            connectWithId(queryChannelId);
        } else if (queryUsername) {
            connectToKick(queryUsername);
        }
    } else {
        // Fallback to LocalStorage auto-connect settings
        const autoConnect = localStorage.getItem('kick_wheel_auto_connect') === 'true';
        const connectionType = localStorage.getItem('kick_wheel_connection_type');
        const savedUsername = localStorage.getItem('kick_wheel_username');
        const savedId = localStorage.getItem('kick_wheel_channel_id');

        if (savedUsername && kickUsernameInput) kickUsernameInput.value = savedUsername;
        if (savedId && document.getElementById('channel-id')) {
            document.getElementById('channel-id').value = savedId;
        }

        if (autoConnect) {
            if (connectionType === 'manual' && savedId) {
                if (document.getElementById('manual-connection')) {
                    document.getElementById('manual-connection').style.display = 'block';
                }
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
        
        // Defer updating segment colors/sizes if any wheel is spinning
        if (!wheels.some(w => w.isSpinning)) {
            refreshAllWheelSegments();
        }
    }

    function removeFromQueue(index) {
        if (wheels.some(w => w.isSpinning)) return;
        queue.splice(index, 1);
        updateQueueUI();
        localStorage.setItem('kick_wheel_queue', JSON.stringify(queue));
        refreshAllWheelSegments();
    }

    function updateQueueUI() {
        if (isOBS) return; // No sidebar UI in OBS overlay
        if (!queueContainer) return;
        
        queueContainer.innerHTML = '';
        if (queueCount) queueCount.innerText = queue.length;

        queue.forEach((user, index) => {
            const item = document.createElement('div');
            item.className = 'queue-item';
            const weightBadge = (user.weight && user.weight > 1) 
                ? `<span style="background: rgba(83,252,24,0.2); color: var(--kick-green); padding: 1px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; margin-left: 6px;">${user.weight}x</span>` 
                : '';
            item.innerHTML = `
                <div class="q-info">
                    <span class="q-name">${user.username}${weightBadge}</span>
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

    function triggerMultiSpin(forcedWinners = null, forcedDuration = null) {
        if (queue.length === 0) return alert('Queue is empty!');
        if (wheels.some(w => w.isSpinning)) return;

        // Automatically close entries when spin starts
        acceptEntries = false;
        if (acceptEntriesToggle) acceptEntriesToggle.checked = false;
        localStorage.setItem('kick_wheel_accept_entries', 'false');
        updateEntriesUI();
        updateInstructionBanner();

        const activeSegs = getWheelActiveSegments();
        const winnerIndices = [];
        const winners = [];
        const usedUsernames = new Set();
        const duration = forcedDuration !== null ? forcedDuration : (4200 + Math.random() * 800);

        for (let i = 0; i < wheels.length; i++) {
            let winnerIdx;
            if (forcedWinners && forcedWinners[i] !== undefined) {
                winnerIdx = forcedWinners[i];
            } else {
                if (usedUsernames.size < queue.length) {
                    do {
                        winnerIdx = Math.floor(Math.random() * activeSegs.length);
                    } while (
                        activeSegs[winnerIdx] && 
                        !activeSegs[winnerIdx].isGoldSpin && 
                        usedUsernames.has(activeSegs[winnerIdx].username.toLowerCase())
                    );
                } else {
                    winnerIdx = Math.floor(Math.random() * activeSegs.length);
                }
            }

            if (activeSegs[winnerIdx] && !activeSegs[winnerIdx].isGoldSpin) {
                usedUsernames.add(activeSegs[winnerIdx].username.toLowerCase());
            }
            winnerIndices.push(winnerIdx);
        }

        let finishedCount = 0;

        function finalizeMultiSpin() {
            setTimeout(() => {
                showWinners(winners);
                // Remove non-gold winners from queue
                if (!isOBS) {
                    winners.forEach(winnerObj => {
                        if (winnerObj && winnerObj.username && !winnerObj.isGoldSpin) {
                            const idx = queue.findIndex(u => u.username.toLowerCase() === winnerObj.username.toLowerCase());
                            if (idx !== -1) queue.splice(idx, 1);
                        }
                    });
                    updateQueueUI();
                    localStorage.setItem('kick_wheel_queue', JSON.stringify(queue));
                }
                refreshAllWheelSegments();
            }, 600);
        }

        wheels.forEach((w, i) => {
            const winIdx = winnerIndices[i];
            
            // Ensure wheel is initialized with activeSegs
            w.updateSegments(activeSegs);

            w.spin((initialWinner) => {
                // Check if this wheel landed on Gold Spin
                if (initialWinner && initialWinner.isGoldSpin) {
                    // GOLD SPIN ROUTINE
                    if (w.canvas.parentElement) {
                        w.canvas.parentElement.classList.add('gold-mode');
                    }

                    // Filter queue for Underdogs (contestants with lower weights)
                    const maxWeight = Math.max(...queue.map(u => u.weight || 1));
                    let underdogs = queue.filter(u => (u.weight || 1) < maxWeight);
                    if (underdogs.length === 0) {
                        underdogs = [...queue]; // Fallback to all if equal
                    }

                    const goldColors = ['#FFD700', '#FFA500', '#DAA520', '#FF8C00', '#FFEE55'];
                    const goldSegments = underdogs.map((u, idx) => ({
                        ...u,
                        color: goldColors[idx % goldColors.length]
                    }));

                    // Underdog re-spin
                    w.updateSegments(goldSegments);

                    if (typeof confetti !== 'undefined') {
                        confetti({
                            particleCount: 90,
                            spread: 80,
                            origin: { y: 0.5 },
                            colors: ['#FFD700', '#FFA500', '#FFFFFF', '#FFEE55']
                        });
                    }

                    setTimeout(() => {
                        const underdogWinIdx = Math.floor(Math.random() * goldSegments.length);
                        w.spin((underdogWinner) => {
                            const totalUnderdogWeight = goldSegments.reduce((sum, s) => sum + (s.weight || 1), 0);
                            const userWeight = underdogWinner.weight || 1;
                            const oddsPercent = ((userWeight / totalUnderdogWeight) * 100).toFixed(1);

                            const goldWinner = {
                                ...underdogWinner,
                                isGoldWinner: true,
                                winOddsPercent: oddsPercent,
                                userWeight: userWeight,
                                totalWheelWeight: totalUnderdogWeight,
                                totalContestants: underdogs.length,
                                winMethod: '🌟 Gold Spin Underdog Re-Spin'
                            };
                            winners[i] = goldWinner;

                            if (w.canvas.parentElement) {
                                w.canvas.parentElement.classList.remove('gold-mode');
                            }

                            if (typeof confetti !== 'undefined') {
                                confetti({
                                    particleCount: 120,
                                    spread: 100,
                                    origin: { y: 0.6 },
                                    colors: ['#FFD700', '#FFA500', '#FFFFFF']
                                });
                            }

                            finishedCount++;
                            if (finishedCount === wheels.length) {
                                finalizeMultiSpin();
                            }
                        }, underdogWinIdx, 4500);
                    }, 800);

                } else {
                    // Regular Winner
                    const totalWheelWeight = activeSegs.reduce((sum, s) => sum + (s.weight || 1), 0);
                    const userWeight = initialWinner.weight || 1;
                    const oddsPercent = ((userWeight / totalWheelWeight) * 100).toFixed(1);

                    winners[i] = {
                        ...initialWinner,
                        winOddsPercent: oddsPercent,
                        userWeight: userWeight,
                        totalWheelWeight: totalWheelWeight,
                        totalContestants: queue.length,
                        winMethod: 'Standard Wheel Spin'
                    };

                    finishedCount++;
                    if (finishedCount === wheels.length) {
                        finalizeMultiSpin();
                    }
                }
            }, winIdx, duration);
        });

        // Broadcast to OBS window if triggered on Host window
        if (!isOBS && !forcedWinners) {
            localStorage.setItem('kick_wheel_spin_event', JSON.stringify({
                timestamp: Date.now(),
                winnerIndices: winnerIndices,
                duration: duration
            }));
        }
    }

    function showWinners(winnersArray) {
        const modalTitle = document.getElementById('winner-modal-title');
        const container = document.getElementById('winners-container');
        if (!container) return;

        if (modalTitle) {
            modalTitle.innerText = winnersArray.length > 1 ? `Winners (${winnersArray.length})!` : 'Winner!';
        }

        container.innerHTML = '';
        winnersArray.forEach(winner => {
            if (!winner || !winner.username) return;

            const card = document.createElement('div');
            card.className = 'winner-card-item';
            card.style.textAlign = 'center';
            card.style.background = 'rgba(255, 255, 255, 0.05)';
            card.style.padding = '1.2rem 1.5rem';
            card.style.borderRadius = '14px';
            card.style.border = '1px solid rgba(83, 252, 24, 0.3)';
            card.style.minWidth = '260px';
            card.style.maxWidth = '340px';

            const activeChannel = (connectedUsername || queryUsername || localStorage.getItem('kick_wheel_username') || '').toLowerCase();
            const twoDaysAgo = Date.now() - (48 * 60 * 60 * 1000);
            const userMsgs = chatLogs.filter(m => 
                m.username.toLowerCase() === winner.username.toLowerCase() && 
                m.timestamp >= twoDaysAgo &&
                (!m.channel || !activeChannel || m.channel.toLowerCase() === activeChannel)
            );

            let userMessagesHtml = '';
            if (userMsgs.length === 0) {
                userMessagesHtml = '<div style="color: var(--text-secondary); font-style: italic; font-size: 0.8rem;">No recent chat messages logged</div>';
            } else {
                userMessagesHtml = userMsgs.slice(-5).reverse().map(m => `
                    <div style="display: flex; justify-content: space-between; gap: 8px; font-size: 0.8rem; padding: 2px 0;">
                        <span style="color: #eee; word-break: break-word; text-align: left;">"${m.content}"</span>
                        <span style="color: var(--text-secondary); white-space: nowrap; font-size: 0.75rem;">${formatTimeAgo(m.timestamp)}</span>
                    </div>
                `).join('');
            }

            const watchTimeHrs = getUserWatchTimeHours(winner.username);
            const userMetaObj = userMeta[winner.username.toLowerCase()] || {};
            const picUrl = winner.profile_pic || userMetaObj.profilePic;
            const winnerColor = winner.isGoldWinner ? '#FFD700' : (winner.color || '#53FC18');
            const initial = (winner.username || 'W').charAt(0).toUpperCase();

            let avatarContentHtml = '';
            if (picUrl) {
                avatarContentHtml = `
                    <img src="${picUrl}" class="winner-avatar-img" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" alt="${winner.username}">
                    <div class="winner-avatar-initial" style="background-color: ${winnerColor}; display: none;">${initial}</div>
                `;
            } else {
                avatarContentHtml = `
                    <div class="winner-avatar-initial" style="background-color: ${winnerColor};">${initial}</div>
                `;
            }

            const goldBadgeHtml = winner.isGoldWinner 
                ? `<div class="gold-winner-badge">🌟 Gold Spin Underdog Winner!</div>` 
                : '';

            card.innerHTML = `
                <div class="winner-avatar-circle" style="border-color: ${winnerColor};">
                    ${avatarContentHtml}
                </div>
                ${goldBadgeHtml}
                <div class="winner-name" style="font-size: 1.6rem; font-weight: 800; color: ${winner.isGoldWinner ? '#FFD700' : 'var(--kick-green)'}; margin-bottom: 0.3rem;">${winner.username}</div>
                <div class="winner-slot" style="font-size: 0.95rem; color: #fff; background: rgba(255, 255, 255, 0.1); padding: 0.3rem 0.8rem; border-radius: 50px; display: inline-block;">${winner.slot_name}</div>
                
                <div class="winner-details-box" style="margin-top: 1.2rem; text-align: left; background: rgba(0,0,0,0.5); padding: 0.9rem; border-radius: 10px; border: var(--glass-border);">
                    <div style="font-size: 0.85rem; font-weight: 700; color: #FFBE0B; margin-bottom: 0.2rem; display: flex; align-items: center; gap: 6px;">
                        <span>🎯</span> <span>Win Odds: ${winner.winOddsPercent || '100.0'}% (${winner.userWeight || 1} / ${winner.totalWheelWeight || 1} tickets)</span>
                    </div>
                    <div style="font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 0.6rem; padding-left: 22px;">
                        <span>Method: ${winner.winMethod || 'Standard Spin'} (${winner.totalContestants || 1} contestants)</span>
                    </div>
                    <div style="font-size: 0.85rem; font-weight: 700; color: #00F0FF; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 6px;">
                        <span>⏱️</span> <span>Watch Time: ${watchTimeHrs.toFixed(1)} hrs</span>
                    </div>
                    <div style="font-size: 0.85rem; font-weight: 700; color: var(--kick-green); margin-bottom: 0.6rem; display: flex; align-items: center; gap: 6px;">
                        <span>📅</span> <span class="follow-status-text">Checking follower info...</span>
                    </div>
                    <div style="font-size: 0.8rem; font-weight: 700; color: #fff; margin-bottom: 0.4rem; border-bottom: var(--glass-border); padding-bottom: 0.3rem;">
                        💬 Messages (Past 2 Days):
                    </div>
                    <div class="winner-chat-history" style="display: flex; flex-direction: column; gap: 3px;">
                        ${userMessagesHtml}
                    </div>
                </div>
            `;
            container.appendChild(card);

            // Async fetch follow info
            const followStatusEl = card.querySelector('.follow-status-text');
            const channelSlug = connectedUsername || queryUsername || localStorage.getItem('kick_wheel_username') || '';

            if (channelSlug) {
                kickHandler.getUserFollowInfo(channelSlug, winner.username).then(info => {
                    if (info) {
                        const fetchedPic = info.profile_pic || info.profilepic || info.profile_picture || (info.user && (info.user.profile_pic || info.user.profilepic || info.user.profile_picture));
                        if (fetchedPic) {
                            userMetaObj.profilePic = fetchedPic;
                            const avatarCircle = card.querySelector('.winner-avatar-circle');
                            if (avatarCircle && !avatarCircle.querySelector('img')) {
                                avatarCircle.innerHTML = `
                                    <img src="${fetchedPic}" class="winner-avatar-img" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" alt="${winner.username}">
                                    <div class="winner-avatar-initial" style="background-color: ${winnerColor}; display: none;">${initial}</div>
                                `;
                            }
                        }
                    }
                    if (!followStatusEl) return;
                    if (info && (info.following_since || info.followed_at || info.created_at)) {
                        const dateStr = info.following_since || info.followed_at || info.created_at;
                        const prefix = info.following_since ? 'Following for' : 'Member for';
                        followStatusEl.innerText = `${prefix} ${formatDuration(dateStr)}`;
                    } else {
                        const meta = userMeta[winner.username.toLowerCase()];
                        if (meta && meta.createdAt) {
                            followStatusEl.innerText = `Kick user for ${formatDuration(meta.createdAt)}`;
                        } else {
                            followStatusEl.innerText = `Active channel follower`;
                        }
                    }
                }).catch(() => {
                    if (followStatusEl) followStatusEl.innerText = `Active channel follower`;
                });
            } else {
                if (followStatusEl) followStatusEl.innerText = `Active channel follower`;
            }
        });

        // Trigger confetti celebration!
        if (typeof confetti !== 'undefined') {
            confetti({
                particleCount: 80,
                spread: 70,
                origin: { y: 0.6 }
            });
        }

        winnerModal.classList.add('active');

        // Only host tab should modify history/persistence
        if (!isOBS) {
            winnersArray.forEach(winner => addToHistory(winner));
            localStorage.setItem('kick_wheel_modal_active', 'true');
        }
    }

    function addToHistory(winner) {
        if (!winner || !winner.username || winner.isGoldSpin) return;
        history.unshift(winner);
        if (history.length > 8) {
            history.pop();
        }
        localStorage.setItem('kick_wheel_history', JSON.stringify(history));
        updateHistoryUI();
    }

    function updateHistoryUI() {
        const maxDisplay = isOBS ? 4 : 5;
        const list = document.getElementById('recent-list');
        if (!list) return;
        list.innerHTML = '';
        
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
        if (connectBtn) {
            connectBtn.disabled = true;
            connectBtn.innerText = 'Connecting...';
        }

        try {
            await kickHandler.connect(username, handleKickMessage);
            connectedUsername = username;
            setConnected(true);
            localStorage.setItem('kick_wheel_username', username);
            localStorage.setItem('kick_wheel_connection_type', 'auto');
            localStorage.setItem('kick_wheel_auto_connect', 'true');
        } catch (err) {
            console.error('Failed to connect automatically:', err);
            if (!isOBS) {
                alert('Failed to connect automatically. Try Manual ID.');
                if (document.getElementById('manual-connection')) {
                    document.getElementById('manual-connection').style.display = 'block';
                }
            }
            setConnected(false);
            localStorage.removeItem('kick_wheel_auto_connect');
        }
    }

    function connectWithId(id) {
        const manualConnectBtn = document.getElementById('manual-connect-btn');
        if (manualConnectBtn) {
            manualConnectBtn.disabled = true;
            manualConnectBtn.innerText = 'Connecting...';
        }

        try {
            kickHandler.connectById(id, handleKickMessage);
            setConnected(true);
            localStorage.setItem('kick_wheel_channel_id', id);
            localStorage.setItem('kick_wheel_connection_type', 'manual');
            localStorage.setItem('kick_wheel_auto_connect', 'true');
        } catch (err) {
            console.error('Failed to connect via Manual ID:', err);
            if (!isOBS) {
                alert('Failed to connect via Manual ID.');
            }
            setConnected(false);
            localStorage.removeItem('kick_wheel_auto_connect');
        }
    }

    function disconnectFromKick() {
        kickHandler.disconnect();
        connectedUsername = '';
        setConnected(false);
        localStorage.removeItem('kick_wheel_auto_connect');
    }

    function setConnected(connected) {
        isConnected = connected;
        const manualConnectBtn = document.getElementById('manual-connect-btn');

        if (connected) {
            if (connectBtn) {
                connectBtn.disabled = false;
                connectBtn.innerText = 'Disconnect';
                connectBtn.classList.remove('btn-primary');
                connectBtn.classList.add('btn-secondary');
                connectBtn.style.background = 'rgba(255, 100, 100, 0.2)';
                connectBtn.style.color = '#ff6b6b';
                connectBtn.style.border = '1px solid rgba(255, 100, 100, 0.4)';
            }

            if (manualConnectBtn) {
                manualConnectBtn.disabled = false;
                manualConnectBtn.innerText = 'Disconnect';
                manualConnectBtn.classList.remove('btn-primary');
                manualConnectBtn.classList.add('btn-secondary');
                manualConnectBtn.style.background = 'rgba(255, 100, 100, 0.2)';
                manualConnectBtn.style.color = '#ff6b6b';
                manualConnectBtn.style.border = '1px solid rgba(255, 100, 100, 0.4)';
            }
        } else {
            if (connectBtn) {
                connectBtn.disabled = false;
                connectBtn.innerText = 'Connect Chat';
                connectBtn.classList.add('btn-primary');
                connectBtn.classList.remove('btn-secondary');
                connectBtn.style.background = '';
                connectBtn.style.color = '';
                connectBtn.style.border = '';
            }

            if (manualConnectBtn) {
                manualConnectBtn.disabled = false;
                manualConnectBtn.innerText = 'Connect';
                manualConnectBtn.classList.add('btn-primary');
                manualConnectBtn.classList.remove('btn-secondary');
                manualConnectBtn.style.background = '';
                manualConnectBtn.style.color = '';
                manualConnectBtn.style.border = '';
            }
        }
    }

    // --- Event Listeners ---

    if (!isOBS) {
        // Single Master Spin Button Click
        if (spinBtn) {
            spinBtn.addEventListener('click', () => {
                triggerMultiSpin();
            });
        }

        // Connect to Kick
        if (connectBtn) {
            connectBtn.addEventListener('click', async () => {
                if (isConnected) {
                    disconnectFromKick();
                    return;
                }

                const username = kickUsernameInput.value.trim();
                if (!username) return alert('Please enter a Kick username');
                await connectToKick(username);
            });
        }

        // Manual Connect
        const manualConnectBtn = document.getElementById('manual-connect-btn');
        if (manualConnectBtn) {
            manualConnectBtn.addEventListener('click', () => {
                if (isConnected) {
                    disconnectFromKick();
                    return;
                }

                const id = document.getElementById('channel-id').value.trim();
                if (!id) return alert('Please enter a Channel ID');
                connectWithId(id);
            });
        }

        // Sound Effects Toggle
        if (soundToggle) {
            soundToggle.addEventListener('change', () => {
                const enabled = soundToggle.checked;
                if (typeof soundManager !== 'undefined') soundManager.enabled = enabled;
                localStorage.setItem('kick_wheel_sound_enabled', enabled ? 'true' : 'false');
            });
        }

        // Gold Spin Toggle & First-Time Confirmation Modal
        const goldSpinModal = document.getElementById('gold-spin-modal');
        const confirmGoldSpinBtn = document.getElementById('confirm-gold-spin-btn');
        const cancelGoldSpinBtn = document.getElementById('cancel-gold-spin-btn');

        if (goldSpinToggle) {
            goldSpinToggle.addEventListener('change', () => {
                if (goldSpinToggle.checked) {
                    const hasConfirmed = localStorage.getItem('kick_wheel_gold_spin_confirmed') === 'true';
                    if (!hasConfirmed) {
                        goldSpinToggle.checked = false;
                        if (goldSpinModal) goldSpinModal.style.display = 'flex';
                        return;
                    }
                }
                isGoldSpinEnabled = goldSpinToggle.checked;
                localStorage.setItem('kick_wheel_gold_spin_enabled', isGoldSpinEnabled ? 'true' : 'false');
                refreshAllWheelSegments();
            });
        }

        if (confirmGoldSpinBtn) {
            confirmGoldSpinBtn.addEventListener('click', () => {
                localStorage.setItem('kick_wheel_gold_spin_confirmed', 'true');
                if (goldSpinModal) goldSpinModal.style.display = 'none';
                if (goldSpinToggle) goldSpinToggle.checked = true;
                isGoldSpinEnabled = true;
                localStorage.setItem('kick_wheel_gold_spin_enabled', 'true');
                refreshAllWheelSegments();
            });
        }

        if (cancelGoldSpinBtn) {
            cancelGoldSpinBtn.addEventListener('click', () => {
                if (goldSpinModal) goldSpinModal.style.display = 'none';
                if (goldSpinToggle) goldSpinToggle.checked = false;
                isGoldSpinEnabled = false;
                localStorage.setItem('kick_wheel_gold_spin_enabled', 'false');
                refreshAllWheelSegments();
            });
        }

        // Sub / VIP Multiplier Select
        if (subWeightSelect) {
            subWeightSelect.addEventListener('change', () => {
                subMultiplier = parseInt(subWeightSelect.value, 10) || 2;
                localStorage.setItem('kick_wheel_sub_multiplier', subMultiplier.toString());
            });
        }

        // Custom Center Hub Logo Input & File Upload
        if (hubLogoInput) {
            hubLogoInput.addEventListener('input', () => {
                const url = hubLogoInput.value.trim();
                updateCenterHubsLogo(url);
                localStorage.setItem('kick_wheel_hub_logo', url);
            });
        }

        if (uploadLogoBtn && hubLogoFile) {
            uploadLogoBtn.addEventListener('click', () => hubLogoFile.click());
            hubLogoFile.addEventListener('change', () => {
                const file = hubLogoFile.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (e) => {
                    const dataUrl = e.target.result;
                    if (hubLogoInput) hubLogoInput.value = dataUrl;
                    updateCenterHubsLogo(dataUrl);
                    localStorage.setItem('kick_wheel_hub_logo', dataUrl);
                };
                reader.readAsDataURL(file);
            });
        }

        // Mode Toggle Logic
        if (modeToggle) {
            modeToggle.addEventListener('change', () => {
                isGiveawayMode = modeToggle.checked;
                if (modeLabel) modeLabel.innerText = isGiveawayMode ? "Giveaway Mode" : "Slot Call Mode";
                localStorage.setItem('kick_wheel_mode', isGiveawayMode ? 'giveaway' : 'slotcall');
                updateInstructionBanner();
            });
        }

        // Accept / Close Entries Toggle
        if (acceptEntriesToggle) {
            acceptEntriesToggle.addEventListener('change', () => {
                acceptEntries = acceptEntriesToggle.checked;
                localStorage.setItem('kick_wheel_accept_entries', acceptEntries ? 'true' : 'false');
                updateEntriesUI();
                updateInstructionBanner();
            });
        }

        if (entriesReminderPopup) {
            entriesReminderPopup.addEventListener('click', () => {
                entriesReminderPopup.style.display = 'none';
            });
        }

        // Giveaway Custom Keyword Input
        if (giveawayKeywordInput) {
            giveawayKeywordInput.addEventListener('input', () => {
                giveawayKeyword = giveawayKeywordInput.value.trim() || '!giveaway';
                localStorage.setItem('kick_wheel_giveaway_keyword', giveawayKeyword);
                updateInstructionBanner();
            });
        }

        // Giveaway Hide Keyword Toggle
        if (hideKeywordToggle) {
            hideKeywordToggle.addEventListener('change', () => {
                hideGiveawayKeyword = hideKeywordToggle.checked;
                localStorage.setItem('kick_wheel_hide_keyword', hideGiveawayKeyword ? 'true' : 'false');
                updateInstructionBanner();
            });
        }

        // Min Watch Time Input
        if (minWatchtimeInput) {
            minWatchtimeInput.addEventListener('input', () => {
                minWatchTimeHours = parseFloat(minWatchtimeInput.value) || 0;
                localStorage.setItem('kick_wheel_min_watchtime', minWatchTimeHours.toString());
            });
        }

        // Wheel Count Selector
        if (wheelCountSelect) {
            wheelCountSelect.addEventListener('change', () => {
                const count = wheelCountSelect.value;
                setupWheels(count);
                localStorage.setItem('kick_wheel_count', count);
            });
        }
        
        // Clear Queue
        if (clearQueueBtn) {
            clearQueueBtn.addEventListener('click', () => {
                if (wheels.some(w => w.isSpinning)) return;
                queue.length = 0;
                updateQueueUI();
                localStorage.setItem('kick_wheel_queue', JSON.stringify(queue));
                refreshAllWheelSegments();
            });
        }

        // Clear History
        const clearHistoryBtn = document.getElementById('clear-history-btn');
        if (clearHistoryBtn) {
            clearHistoryBtn.addEventListener('click', () => {
                history.length = 0;
                localStorage.removeItem('kick_wheel_history');
                updateHistoryUI();
            });
        }

        // Info Button & Banner Popup
        const infoBtn = document.getElementById('info-btn');
        const infoBanner = document.getElementById('info-banner');
        const closeInfoBanner = document.getElementById('close-info-banner');

        if (infoBtn && infoBanner) {
            infoBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isHidden = infoBanner.style.display === 'none';
                infoBanner.style.display = isHidden ? 'block' : 'none';
            });
        }

        if (closeInfoBanner && infoBanner) {
            closeInfoBanner.addEventListener('click', (e) => {
                e.stopPropagation();
                infoBanner.style.display = 'none';
            });
        }
    }

    // Unified Message Handler (Both Dashboard and OBS Overlay)
    function handleKickMessage(msg) {
        if (!msg || !msg.content || typeof msg.content !== 'string') return;

        const content = msg.content.trim();
        const lowerContent = content.toLowerCase();

        const activeChan = (connectedUsername || queryUsername || localStorage.getItem('kick_wheel_username') || '').toLowerCase();

        // Track user messages, metadata & watch time activity
        if (msg.sender && msg.sender.username) {
            const u = msg.sender.username;
            recordUserActivity(u);

            const avatarUrl = msg.sender.profile_pic || msg.sender.profilepic || msg.sender.profile_picture || msg.sender.avatar || (msg.sender.identity && msg.sender.identity.profile_pic) || null;

            chatLogs.push({
                username: u,
                channel: activeChan,
                content: content,
                timestamp: Date.now()
            });

            const meta = userMeta[u.toLowerCase()] || {};
            if (msg.sender.created_at) meta.createdAt = msg.sender.created_at;
            if (avatarUrl) meta.profilePic = avatarUrl;
            if (msg.sender.identity && msg.sender.identity.badges) meta.badges = msg.sender.identity.badges;
            userMeta[u.toLowerCase()] = meta;

            // Prune older than 48 hours
            const twoDaysAgo = Date.now() - (48 * 60 * 60 * 1000);
            while (chatLogs.length > 0 && chatLogs[0].timestamp < twoDaysAgo) {
                chatLogs.shift();
            }

            try {
                localStorage.setItem('kick_wheel_chat_logs', JSON.stringify(chatLogs.slice(-300)));
                localStorage.setItem('kick_wheel_user_meta', JSON.stringify(userMeta));
            } catch(e) {}
        }

        // Broadcaster chat command overrides (Sync across tabs)
        const currentChannelName = connectedUsername || queryUsername || localStorage.getItem('kick_wheel_username') || '';
        const isStreamer = currentChannelName && msg.sender.username.toLowerCase() === currentChannelName.toLowerCase();
        
        if (isStreamer) {
            if (lowerContent === '!spin') {
                if (queue.length > 0 && !wheels.some(w => w.isSpinning)) {
                    triggerMultiSpin();
                }
                return;
            }
            if (lowerContent === '!clear') {
                if (!wheels.some(w => w.isSpinning)) {
                    queue.length = 0;
                    updateQueueUI();
                    localStorage.setItem('kick_wheel_queue', JSON.stringify(queue));
                    refreshAllWheelSegments();
                }
                return;
            }
        }

        // Standard caller commands - Check if entries are open
        if (!acceptEntries) {
            return;
        }

        // Detect Subscriber / VIP / Mod weight multiplier
        let entryWeight = 1;
        if (msg.sender) {
            const badges = (msg.sender.identity && msg.sender.identity.badges) || msg.sender.badges || [];
            const isSubOrVip = badges.some(b => {
                const typeStr = (b.type || b.badge_id || b.name || '').toLowerCase();
                return typeStr.includes('sub') || typeStr.includes('vip') || typeStr.includes('subscriber') || typeStr.includes('mod') || typeStr.includes('broadcaster');
            });
            if (isSubOrVip) {
                entryWeight = subMultiplier;
            }
        }

        if (isGiveawayMode) {
            const kw = (giveawayKeyword || '!giveaway').toLowerCase();
            if (lowerContent.startsWith(kw)) {
                // Min Watch Time Verification
                if (minWatchTimeHours > 0) {
                    const userHours = getUserWatchTimeHours(msg.sender.username);
                    if (userHours < minWatchTimeHours) {
                        console.log(`User ${msg.sender.username} declined. Watch time: ${userHours.toFixed(1)}h / Req: ${minWatchTimeHours}h`);
                        return;
                    }
                }
                const avatar = msg.sender.profile_pic || msg.sender.profilepic || msg.sender.profile_picture || msg.sender.avatar || null;
                addToQueue({
                    username: msg.sender.username,
                    slot_name: msg.sender.username,
                    color: getNextColor(),
                    profile_pic: avatar,
                    weight: entryWeight
                });
            }
        } else {
            if (lowerContent.startsWith('!slotcall')) {
                const parts = content.split(' ');
                if (parts.length < 2) return;
                const slotName = parts.slice(1).join(' ');

                const avatar = msg.sender.profile_pic || msg.sender.profilepic || msg.sender.profile_picture || msg.sender.avatar || null;
                addToQueue({
                    username: msg.sender.username,
                    slot_name: slotName,
                    color: getNextColor(),
                    profile_pic: avatar,
                    weight: entryWeight
                });
            }
        }
    }

    // Close Modal Handler (Broadcasts modal dismissal to OBS overlay)
    function dismissWinnerModal() {
        winnerModal.classList.remove('active');
        localStorage.setItem('kick_wheel_modal_active', 'false');
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
                refreshAllWheelSegments();
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

        if (e.key === 'kick_wheel_sound_enabled' && e.newValue) {
            const soundOn = e.newValue === 'true';
            if (soundToggle) soundToggle.checked = soundOn;
            if (typeof soundManager !== 'undefined') soundManager.enabled = soundOn;
        }

        if (e.key === 'kick_wheel_gold_spin_enabled' && e.newValue) {
            isGoldSpinEnabled = e.newValue === 'true';
            if (goldSpinToggle) goldSpinToggle.checked = isGoldSpinEnabled;
            refreshAllWheelSegments();
        }

        if (e.key === 'kick_wheel_sub_multiplier' && e.newValue) {
            subMultiplier = parseInt(e.newValue, 10) || 2;
            if (subWeightSelect) subWeightSelect.value = subMultiplier.toString();
        }

        if (e.key === 'kick_wheel_hub_logo' && e.newValue) {
            updateCenterHubsLogo(e.newValue);
            if (hubLogoInput) hubLogoInput.value = e.newValue;
        }

        if (e.key === 'kick_wheel_mode' && e.newValue) {
            isGiveawayMode = e.newValue === 'giveaway';
            if (modeToggle) modeToggle.checked = isGiveawayMode;
            if (modeLabel) modeLabel.innerText = isGiveawayMode ? "Giveaway Mode" : "Slot Call Mode";
            updateInstructionBanner();
        }

        if (e.key === 'kick_wheel_accept_entries' && e.newValue) {
            acceptEntries = e.newValue === 'true';
            if (acceptEntriesToggle) acceptEntriesToggle.checked = acceptEntries;
            updateEntriesUI();
            updateInstructionBanner();
        }

        if (e.key === 'kick_wheel_giveaway_keyword' && e.newValue) {
            giveawayKeyword = e.newValue;
            if (giveawayKeywordInput) giveawayKeywordInput.value = giveawayKeyword;
            updateInstructionBanner();
        }

        if (e.key === 'kick_wheel_hide_keyword' && e.newValue) {
            hideGiveawayKeyword = e.newValue === 'true';
            if (hideKeywordToggle) hideKeywordToggle.checked = hideGiveawayKeyword;
            updateInstructionBanner();
        }

        if (e.key === 'kick_wheel_min_watchtime' && e.newValue) {
            minWatchTimeHours = parseFloat(e.newValue) || 0;
            if (minWatchtimeInput) minWatchtimeInput.value = minWatchTimeHours;
        }

        if (e.key === 'kick_wheel_count' && e.newValue) {
            const count = e.newValue;
            if (wheelCountSelect) wheelCountSelect.value = count;
            setupWheels(count);
            updateCenterHubsLogo(hubLogoUrl);
        }

        // Handle spin trigger sync for OBS view
        if (e.key === 'kick_wheel_spin_event' && e.newValue) {
            try {
                const eventData = JSON.parse(e.newValue);
                if (wheels.some(w => w.isSpinning)) return;
                
                triggerMultiSpin(eventData.winnerIndices || [eventData.winnerIndex], eventData.duration);
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

    // Animation Loop for Wheels
    function animate() {
        wheels.forEach(w => w.draw());
        requestAnimationFrame(animate);
    }
    animate();
});
