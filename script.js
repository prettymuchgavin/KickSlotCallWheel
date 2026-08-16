/**
 * Main Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
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
    const simpleGraphicsToggle = document.getElementById('simple-graphics-toggle');
    const goldSpinToggle = document.getElementById('gold-spin-toggle');
    const weightedEntriesToggle = document.getElementById('weighted-entries-toggle');
    const weightMultiplierBox = document.getElementById('weight-multiplier-box');
    const subWeightSelect = document.getElementById('sub-weight-select');
    const hubLogoInput = document.getElementById('hub-logo-input');
    const uploadLogoBtn = document.getElementById('upload-logo-btn');
    const hubLogoFile = document.getElementById('hub-logo-file');
    const wheelSkinSelect = document.getElementById('wheel-skin-select');
    const hunterDetectorToggle = document.getElementById('hunter-detector-toggle');
    const hunterDetectorOptions = document.getElementById('hunter-detector-options');
    const hunterAiToggle = document.getElementById('hunter-ai-toggle');
    const hunterAiSettingsContainer = document.getElementById('hunter-ai-settings-container');
    const aiProviderSelect = document.getElementById('ai-provider-select');
    const aiApiKeyInput = document.getElementById('ai-api-key-input');
    const toggleApiKeyVis = document.getElementById('toggle-api-key-vis');
    const aiModelInput = document.getElementById('ai-model-input');
    const customEndpointBox = document.getElementById('custom-endpoint-box');
    const aiEndpointInput = document.getElementById('ai-endpoint-input');
    const testAiKeyBtn = document.getElementById('test-ai-key-btn');
    const aiTestResult = document.getElementById('ai-test-result');

    const hunterModal = document.getElementById('hunter-modal');
    const hunterTargetUsername = document.getElementById('hunter-target-username');
    const hunterReasonsList = document.getElementById('hunter-reasons-list');
    const hunterChatSample = document.getElementById('hunter-chat-sample');
    const approveHunterBtn = document.getElementById('approve-hunter-btn');
    const removeHunterQueueBtn = document.getElementById('remove-hunter-queue-btn');
    const closeHunterModalBtn = document.getElementById('close-hunter-modal-btn');
    const aiHunterAnalysisBox = document.getElementById('ai-hunter-analysis-box');
    const aiHunterStatusBadge = document.getElementById('ai-hunter-status-badge');
    const aiHunterExplanation = document.getElementById('ai-hunter-explanation');
    const runAiAnalysisBtn = document.getElementById('run-ai-analysis-btn');

    // Modal Elements
    const winnerModal = document.getElementById('winner-modal');

    // Initialize Kick Client
    const kickHandler = new KickClient();

    // Multi-Wheel State
    let wheelCount = 1;
    const wheels = [];
    let entriesClosedTimer = null;
    let hubLogoUrl = '';
    let activeWheelSkin = 'classic';
    let subMultiplier = 2;
    let isGoldSpinEnabled = false;
    let isSimpleGraphics = false;

    function applyWheelSkin(skinName) {
        activeWheelSkin = skinName || 'classic';
        const containers = document.querySelectorAll('.wheel-container');
        containers.forEach(c => {
            c.classList.remove('skin-classic', 'skin-csgo', 'skin-slot', 'skin-arcade', 'skin-gold');
            c.classList.add(`skin-${activeWheelSkin}`);
        });
        wheels.forEach(w => {
            if (w.setSkin) w.setSkin(activeWheelSkin);
        });
    }
    let isWeightedEntriesEnabled = true;
    let isHunterDetectorEnabled = false;
    let isAiHunterEnabled = false;
    let aiProvider = 'openrouter';
    let aiApiKey = '';
    let aiModel = 'openai/gpt-4o-mini';
    let aiEndpoint = '';
    const approvedHunters = new Set();
    const aiCache = new Map();

    // Winner Live Chat Feed State
    const currentWinnerUsernames = new Set();

    function appendLiveWinnerChatMessage(lowerUser, rawUsername, content) {
        const feeds = document.querySelectorAll(`.winner-live-chat-feed[data-username="${lowerUser}"]`);
        const badges = document.querySelectorAll(`.winner-live-status-badge[data-username="${lowerUser}"]`);

        badges.forEach(b => {
            b.innerText = '🟢 Active in Chat';
            b.style.background = 'rgba(83, 252, 24, 0.25)';
            b.style.color = 'var(--kick-green)';
            b.style.border = '1px solid rgba(83, 252, 24, 0.5)';
            b.style.fontWeight = '800';
        });

        feeds.forEach(feed => {
            const noMsgEl = feed.querySelector('.no-winner-msg-text');
            if (noMsgEl) noMsgEl.remove();

            const msgDiv = document.createElement('div');
            msgDiv.style.display = 'flex';
            msgDiv.style.justify = 'space-between';
            msgDiv.style.gap = '8px';
            msgDiv.style.padding = '4px 7px';
            msgDiv.style.borderRadius = '6px';
            msgDiv.style.background = 'rgba(83, 252, 24, 0.15)';
            msgDiv.style.border = '1px solid rgba(83, 252, 24, 0.35)';

            msgDiv.innerHTML = `
                <span style="color: #fff; font-weight: 600; text-align: left; word-break: break-word;">"${content}"</span>
                <span style="color: var(--kick-green); white-space: nowrap; font-size: 0.72rem; font-weight: 700;">Just now</span>
            `;

            feed.appendChild(msgDiv);
            feed.scrollTop = feed.scrollHeight;
        });

        if (typeof soundManager !== 'undefined' && soundManager.enabled) {
            try { soundManager.playTick(); } catch(e) {}
        }
    }

    // Global Scammer Ban List State
    const globalBanList = new Set();
    const banlistCountBadge = document.getElementById('banlist-count-badge');
    const scammerBlockedBanner = document.getElementById('scammer-blocked-banner');
    const scammerBlockedName = document.getElementById('scammer-blocked-name');
    const dismissScammerBannerBtn = document.getElementById('dismiss-scammer-banner-btn');

    async function loadGlobalBanList() {
        try {
            const response = await fetch(`banned_users.txt?t=${Date.now()}`);
            if (!response.ok) return;
            const text = await response.text();
            const lines = text.split('\n');
            globalBanList.clear();
            lines.forEach(line => {
                const trimmed = line.trim().toLowerCase();
                if (trimmed && !trimmed.startsWith('#')) {
                    globalBanList.add(trimmed);
                }
            });
            console.log(`Global Scammer Ban List loaded: ${globalBanList.size} accounts blocked.`);
            if (banlistCountBadge) {
                banlistCountBadge.innerText = `${globalBanList.size} Accounts Blocked`;
            }
        } catch (err) {
            console.warn('Failed to load global ban list:', err);
            if (banlistCountBadge) {
                banlistCountBadge.innerText = 'Active (Offline)';
            }
        }
    }
    loadGlobalBanList();

    function showBannedUserNotification(username) {
        if (scammerBlockedBanner && scammerBlockedName) {
            scammerBlockedName.innerText = username;
            scammerBlockedBanner.style.display = 'flex';
            setTimeout(() => {
                if (scammerBlockedBanner) scammerBlockedBanner.style.display = 'none';
            }, 6000);
        }
    }

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

    // --- Hunter Detector Analyzer ---
    async function fetchAiAnalysis(username, userMessages) {
        if (!aiApiKey) {
            throw new Error("Missing AI API Key. Configure it in Settings -> Rules -> Hunter Detector.");
        }

        const lowerUser = username.toLowerCase();
        if (aiCache.has(lowerUser)) {
            return aiCache.get(lowerUser);
        }

        let endpointUrl = '';
        const headers = { 'Content-Type': 'application/json' };
        let selectedModel = (aiModel || '').trim() || 'openai/gpt-4o-mini';

        if (aiProvider === 'openrouter') {
            endpointUrl = 'https://openrouter.ai/api/v1/chat/completions';
            headers['Authorization'] = `Bearer ${aiApiKey.trim()}`;
            headers['HTTP-Referer'] = 'https://kickslotwheel.app';
            headers['X-Title'] = 'DatKickWheel Hunter Detector';
        } else if (aiProvider === 'openai') {
            endpointUrl = 'https://api.openai.com/v1/chat/completions';
            headers['Authorization'] = `Bearer ${aiApiKey.trim()}`;
            if (!selectedModel || selectedModel.includes('/')) selectedModel = 'gpt-4o-mini';
        } else if (aiProvider === 'anthropic') {
            endpointUrl = 'https://api.anthropic.com/v1/messages';
            headers['x-api-key'] = aiApiKey.trim();
            headers['anthropic-version'] = '2023-06-01';
            headers['dangerously-allow-browser'] = 'true';
            if (!selectedModel || selectedModel.includes('/')) selectedModel = 'claude-3-5-haiku-20241022';
        } else {
            endpointUrl = (aiEndpoint || '').trim() || 'http://localhost:11434/v1/chat/completions';
            if (aiApiKey.trim()) headers['Authorization'] = `Bearer ${aiApiKey.trim()}`;
        }

        const formattedLogs = (userMessages || []).slice(-15).map(m => {
            const chan = m.channel ? `[Channel: ${m.channel}] ` : '';
            return `${chan}"${m.content || ''}" (${formatTimeAgo(m.timestamp)})`;
        }).join('\n');

        const systemPrompt = `You are a Kick stream moderation AI analyzer. Evaluate the viewer's 48-hour chat logs.
Determine if they are a "giveaway hunter/farmer/bot" (chats ONLY to enter giveaways, beg for tips, or spam commands like !slotcall/!giveaway/win/pls tip, with zero organic chat interaction).

Respond ONLY with valid JSON:
{"isHunter": boolean, "confidence": number, "reason": "Short 1-2 sentence explanation"}`;

        const userPrompt = `Viewer Username: "${username}"
Chat Logs:
${formattedLogs || 'No chat history logged.'}`;

        let requestBody = {};
        if (aiProvider === 'anthropic') {
            requestBody = {
                model: selectedModel,
                max_tokens: 300,
                system: systemPrompt,
                messages: [{ role: 'user', content: userPrompt }]
            };
        } else {
            requestBody = {
                model: selectedModel,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.1,
                max_tokens: 250
            };
        }

        const response = await fetch(endpointUrl, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API Error (${response.status}): ${errText.slice(0, 120)}`);
        }

        const data = await response.json();
        let rawContent = '';
        if (aiProvider === 'anthropic' && data.content && data.content[0]) {
            rawContent = data.content[0].text;
        } else if (data.choices && data.choices[0] && data.choices[0].message) {
            rawContent = data.choices[0].message.content;
        }

        let parsed = null;
        try {
            const cleanJson = rawContent.replace(/```json|```/g, '').trim();
            parsed = JSON.parse(cleanJson);
        } catch (e) {
            parsed = {
                isHunter: /"isHunter"\s*:\s*true/i.test(rawContent) || /hunter/i.test(rawContent),
                confidence: 75,
                reason: rawContent.slice(0, 150)
            };
        }

        const result = {
            isHunter: Boolean(parsed.isHunter),
            confidence: parsed.confidence || 80,
            reason: parsed.reason || 'AI analyzed chat patterns and evaluated hunter behavior.'
        };

        aiCache.set(lowerUser, result);
        return result;
    }

    function analyzeUserForHunter(username) {
        if (!username) return { isHunter: false, score: 0, reasons: [], userMessages: [] };

        const lowerUser = username.toLowerCase();
        const userMsgs = chatLogs.filter(m => m && m.username && m.username.toLowerCase() === lowerUser);

        // Check if AI analysis cache has a result for this user
        if (isAiHunterEnabled && aiCache.has(lowerUser)) {
            const aiRes = aiCache.get(lowerUser);
            return {
                isHunter: aiRes.isHunter,
                score: aiRes.isHunter ? 90 : 10,
                reasons: [`[AI ${aiProvider.toUpperCase()}] ${aiRes.reason}`],
                userMessages: userMsgs
            };
        }

        const reasons = [];
        let score = 0;

        if (userMsgs.length === 0) {
            return { isHunter: false, score: 0, reasons: [], userMessages: [] };
        }

        let singleOrTwoWordCount = 0;
        let totalWords = 0;
        let keywordMsgCount = 0;
        let beggingMsgCount = 0;

        const giveawayKeywords = [
            'giveaway', 'slotcall', 'slot', 'spin', 'win', 'pls', 'please', 'tip', 'tips', 
            'vault', 'stake', 'code', 'free', 'money', 'claim', 'bonus', 'enter', 'rain', 'beg'
        ];
        const channelsSeen = new Set();

        userMsgs.forEach(m => {
            if (m.channel) channelsSeen.add(m.channel.toLowerCase());
            const content = (m.content || '').trim();
            const lowerContent = content.toLowerCase();
            const words = content.split(/\s+/).filter(Boolean);
            totalWords += words.length;

            if (words.length <= 2) {
                singleOrTwoWordCount++;
            }

            const containsKeyword = giveawayKeywords.some(kw => lowerContent.includes(kw)) || /^!([a-zA-Z0-9_-]+)/.test(content);
            if (containsKeyword) {
                keywordMsgCount++;
            }

            if (
                lowerContent.includes('tip me') || 
                lowerContent.includes('pls tip') || 
                lowerContent.includes('please tip') || 
                lowerContent.includes('send tip') || 
                lowerContent.includes('vault code') ||
                lowerContent.includes('need money') ||
                lowerContent.includes('fill vault') ||
                lowerContent.includes('tip pls')
            ) {
                beggingMsgCount++;
            }
        });

        const shortMsgRatio = singleOrTwoWordCount / userMsgs.length;
        const keywordMsgRatio = keywordMsgCount / userMsgs.length;

        if (userMsgs.length >= 2 && shortMsgRatio >= 0.6) {
            score += 35;
            reasons.push(`High ratio of short 1-2 word messages (${Math.round(shortMsgRatio * 100)}% of chat history)`);
        }

        if (userMsgs.length >= 2 && keywordMsgRatio >= 0.5) {
            score += 40;
            reasons.push(`Over ${Math.round(keywordMsgRatio * 100)}% of messages consist of giveaway keywords or bot commands`);
        }

        if (beggingMsgCount > 0) {
            score += 45;
            reasons.push(`Contains tip request / begging phrases (${beggingMsgCount} message${beggingMsgCount > 1 ? 's' : ''})`);
        }

        if (channelsSeen.size > 1 && keywordMsgRatio >= 0.4) {
            score += 30;
            reasons.push(`Active across ${channelsSeen.size} different channel chats mainly entering giveaways`);
        }

        const isHunter = score >= 50;

        return {
            isHunter: isHunter,
            score: score,
            reasons: reasons,
            userMessages: userMsgs
        };
    }

    function showHunterModal(username, hunterInfo) {
        currentInspectedHunter = username;
        if (hunterTargetUsername) hunterTargetUsername.innerText = username;

        if (hunterReasonsList) {
            hunterReasonsList.innerHTML = '';
            if (!hunterInfo.reasons || hunterInfo.reasons.length === 0) {
                hunterReasonsList.innerHTML = '<li>High giveaway entry activity detected across streams.</li>';
            } else {
                hunterInfo.reasons.forEach(r => {
                    const li = document.createElement('li');
                    li.innerText = r;
                    hunterReasonsList.appendChild(li);
                });
            }
        }

        if (hunterChatSample) {
            if (!hunterInfo.userMessages || hunterInfo.userMessages.length === 0) {
                hunterChatSample.innerHTML = '<div style="color: var(--text-secondary); font-style: italic; font-size: 0.8rem;">No recent chat messages logged for this user.</div>';
            } else {
                hunterChatSample.innerHTML = hunterInfo.userMessages.slice().reverse().map(m => `
                    <div style="display: flex; justify-content: space-between; gap: 8px; font-size: 0.8rem; padding: 3px 0; border-bottom: 1px solid rgba(255,255,255,0.04);">
                        <span style="color: #eee; word-break: break-word; text-align: left;">"${m.content || ''}"</span>
                        <span style="color: var(--text-secondary); white-space: nowrap; font-size: 0.75rem;">${m.channel ? `[${m.channel}] ` : ''}${formatTimeAgo(m.timestamp)}</span>
                    </div>
                `).join('');
            }
        }

        if (aiHunterAnalysisBox) {
            if (isAiHunterEnabled) {
                aiHunterAnalysisBox.style.display = 'block';
                const lowerUser = username.toLowerCase();
                if (aiCache.has(lowerUser)) {
                    const cached = aiCache.get(lowerUser);
                    if (aiHunterStatusBadge) {
                        aiHunterStatusBadge.innerText = cached.isHunter ? `⚠️ Flagged (${cached.confidence}% Conf)` : `✅ Clear (${cached.confidence}% Conf)`;
                        aiHunterStatusBadge.style.background = cached.isHunter ? 'rgba(255, 159, 0, 0.2)' : 'rgba(83, 252, 24, 0.2)';
                        aiHunterStatusBadge.style.color = cached.isHunter ? '#FF9F00' : 'var(--kick-green)';
                    }
                    if (aiHunterExplanation) {
                        aiHunterExplanation.innerHTML = `<strong>AI Analysis (${aiProvider.toUpperCase()}):</strong> ${cached.reason}`;
                    }
                } else {
                    if (aiHunterStatusBadge) {
                        aiHunterStatusBadge.innerText = 'Ready';
                        aiHunterStatusBadge.style.background = 'rgba(0, 240, 255, 0.2)';
                        aiHunterStatusBadge.style.color = '#00F0FF';
                    }
                    if (aiHunterExplanation) {
                        aiHunterExplanation.innerText = 'Click below to run AI analysis on this user\'s recent chat logs.';
                    }
                    if (aiApiKey) {
                        triggerAiModalAnalysis(username, hunterInfo.userMessages);
                    }
                }
            } else {
                aiHunterAnalysisBox.style.display = 'none';
            }
        }

        if (hunterModal) {
            hunterModal.style.display = 'flex';
        }
    }

    async function triggerAiModalAnalysis(username, userMessages) {
        if (!aiHunterStatusBadge || !aiHunterExplanation) return;
        aiHunterStatusBadge.innerText = 'Analyzing...';
        aiHunterStatusBadge.style.background = 'rgba(0, 240, 255, 0.2)';
        aiHunterStatusBadge.style.color = '#00F0FF';
        aiHunterExplanation.innerText = '⏳ AI is reading and analyzing chat history...';

        try {
            const result = await fetchAiAnalysis(username, userMessages);
            aiHunterStatusBadge.innerText = result.isHunter ? `⚠️ Flagged (${result.confidence}% Conf)` : `✅ Clear (${result.confidence}% Conf)`;
            aiHunterStatusBadge.style.background = result.isHunter ? 'rgba(255, 159, 0, 0.2)' : 'rgba(83, 252, 24, 0.2)';
            aiHunterStatusBadge.style.color = result.isHunter ? '#FF9F00' : 'var(--kick-green)';
            aiHunterExplanation.innerHTML = `<strong>AI Analysis (${aiProvider.toUpperCase()}):</strong> ${result.reason}`;

            updateQueueUI();
        } catch (err) {
            aiHunterStatusBadge.innerText = 'Error';
            aiHunterStatusBadge.style.background = 'rgba(255, 59, 48, 0.2)';
            aiHunterStatusBadge.style.color = '#ff4d4d';
            aiHunterExplanation.innerHTML = `<span style="color: #ff4d4d;">❌ ${err.message}</span>`;
        }
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

        applyWheelSkin(activeWheelSkin);
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

    const savedGraphics = localStorage.getItem('kick_wheel_simple_graphics');
    if (savedGraphics !== null) {
        isSimpleGraphics = savedGraphics === 'true';
        if (simpleGraphicsToggle) simpleGraphicsToggle.checked = isSimpleGraphics;
        if (isSimpleGraphics) document.body.classList.add('simple-graphics-mode');
    }

    const savedGoldSpin = localStorage.getItem('kick_wheel_gold_spin_enabled');
    if (savedGoldSpin !== null) {
        isGoldSpinEnabled = savedGoldSpin === 'true';
        if (goldSpinToggle) goldSpinToggle.checked = isGoldSpinEnabled;
    }

    const savedWeighted = localStorage.getItem('kick_wheel_weighted_entries_enabled');
    if (savedWeighted !== null) {
        isWeightedEntriesEnabled = savedWeighted === 'true';
        if (weightedEntriesToggle) weightedEntriesToggle.checked = isWeightedEntriesEnabled;
        if (weightMultiplierBox) weightMultiplierBox.style.display = isWeightedEntriesEnabled ? 'flex' : 'none';
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

    const savedSkin = localStorage.getItem('kick_wheel_skin');
    if (savedSkin) {
        activeWheelSkin = savedSkin;
        if (wheelSkinSelect) wheelSkinSelect.value = activeWheelSkin;
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

    const savedHunterDetector = localStorage.getItem('kick_wheel_hunter_detector_enabled');
    if (savedHunterDetector !== null) {
        isHunterDetectorEnabled = savedHunterDetector === 'true';
        if (hunterDetectorToggle) hunterDetectorToggle.checked = isHunterDetectorEnabled;
        if (hunterDetectorOptions) hunterDetectorOptions.style.display = isHunterDetectorEnabled ? 'block' : 'none';
    }

    const savedAiHunter = localStorage.getItem('kick_wheel_hunter_ai_enabled');
    if (savedAiHunter !== null) {
        isAiHunterEnabled = savedAiHunter === 'true';
        if (hunterAiToggle) hunterAiToggle.checked = isAiHunterEnabled;
        if (hunterAiSettingsContainer) hunterAiSettingsContainer.style.display = isAiHunterEnabled ? 'block' : 'none';
    }

    const savedAiProvider = localStorage.getItem('kick_wheel_ai_provider');
    if (savedAiProvider) {
        aiProvider = savedAiProvider;
        if (aiProviderSelect) aiProviderSelect.value = aiProvider;
        if (customEndpointBox) customEndpointBox.style.display = aiProvider === 'custom' ? 'block' : 'none';
    }

    const savedAiApiKey = localStorage.getItem('kick_wheel_ai_api_key');
    if (savedAiApiKey) {
        aiApiKey = savedAiApiKey;
        if (aiApiKeyInput) aiApiKeyInput.value = aiApiKey;
    }

    const savedAiModel = localStorage.getItem('kick_wheel_ai_model');
    if (savedAiModel) {
        aiModel = savedAiModel;
        if (aiModelInput) aiModelInput.value = aiModel;
    }

    const savedAiEndpoint = localStorage.getItem('kick_wheel_ai_endpoint');
    if (savedAiEndpoint) {
        aiEndpoint = savedAiEndpoint;
        if (aiEndpointInput) aiEndpointInput.value = aiEndpoint;
    }

    const savedApprovedHunters = localStorage.getItem('kick_wheel_approved_hunters');
    if (savedApprovedHunters) {
        try {
            const parsed = JSON.parse(savedApprovedHunters);
            if (Array.isArray(parsed)) {
                parsed.forEach(u => approvedHunters.add(u.toLowerCase()));
            }
        } catch (e) {}
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

    // LocalStorage auto-connect settings
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

    // --- UI Functions ---

    function addToQueue(user) {
        if (!user || !user.username) return;

        const lowerUsername = user.username.toLowerCase();

        // 🛑 GLOBAL SCAMMER BAN LIST VERIFICATION
        if (globalBanList.has(lowerUsername)) {
            console.warn(`User ${user.username} is listed on the Global Scammer Ban List. Entry blocked.`);
            showBannedUserNotification(user.username);
            return;
        }

        // Case-insensitive check to be safe
        const existingIndex = queue.findIndex(u => u.username.toLowerCase() === lowerUsername);

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
        if (!queueContainer) return;
        
        queueContainer.innerHTML = '';
        if (queueCount) queueCount.innerText = queue.length;

        queue.forEach((user, index) => {
            const item = document.createElement('div');
            item.className = 'queue-item';

            const lowerUser = (user.username || '').toLowerCase();
            const isApproved = approvedHunters.has(lowerUser);
            const isScammer = globalBanList.has(lowerUser);

            let scammerBtnHtml = '';
            if (isScammer) {
                scammerBtnHtml = `<button class="q-scammer-warn-btn" title="⛔ REPORTED SCAMMER - Blocked from entering giveaways">⛔ SCAMMER</button>`;
            }

            let hunterBtnHtml = '';
            if (isHunterDetectorEnabled && !isApproved) {
                const hInfo = analyzeUserForHunter(user.username);
                if (hInfo.isHunter) {
                    hunterBtnHtml = `<button class="q-hunter-warn-btn" title="Click to inspect hunter analysis">⚠️ Hunter (${hInfo.score}%)</button>`;
                }
            }

            const weightBadge = (user.weight && user.weight > 1) 
                ? `<span style="background: rgba(83,252,24,0.2); color: var(--kick-green); padding: 1px 6px; border-radius: 4px; font-size: 0.75rem; font-weight: 700; margin-left: 6px;">${user.weight}x</span>` 
                : '';

            item.innerHTML = `
                <div class="q-info">
                    <span class="q-name">${user.username}${weightBadge}${scammerBtnHtml}${hunterBtnHtml}</span>
                    <span class="q-slot">${user.slot_name}</span>
                </div>
                <button class="q-delete-btn" title="Remove from queue">✕</button>
            `;
            
            const hunterBtn = item.querySelector('.q-hunter-warn-btn');
            if (hunterBtn) {
                hunterBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const hInfo = analyzeUserForHunter(user.username);
                    showHunterModal(user.username, hInfo);
                });
            }

            const deleteBtn = item.querySelector('.q-delete-btn');
            if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    removeFromQueue(index);
                });
            }
            
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
                winners.forEach(winnerObj => {
                    if (winnerObj && winnerObj.username && !winnerObj.isGoldSpin) {
                        const idx = queue.findIndex(u => u.username.toLowerCase() === winnerObj.username.toLowerCase());
                        if (idx !== -1) queue.splice(idx, 1);
                    }
                });
                updateQueueUI();
                localStorage.setItem('kick_wheel_queue', JSON.stringify(queue));

                // Automatically re-open entries when spin completes
                acceptEntries = true;
                if (acceptEntriesToggle) acceptEntriesToggle.checked = true;
                localStorage.setItem('kick_wheel_accept_entries', 'true');
                updateEntriesUI();
                updateInstructionBanner();

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
    }

    function showWinners(winnersArray) {
        if (!winnersArray || winnersArray.length === 0) return;

        currentWinnerUsernames.clear();
        winnersArray.forEach(w => {
            if (w && w.username) currentWinnerUsernames.add(w.username.toLowerCase());
        });

        const modalTitle = document.getElementById('winner-modal-title');
        const container = document.getElementById('winners-container');
        if (!container) return;

        if (winnerModal) {
            winnerModal.style.display = 'flex';
        }

        const winnerCardEl = document.querySelector('.winner-card');
        if (winnerCardEl) {
            if (winnersArray.length > 1) {
                winnerCardEl.classList.add('multi-winner-card');
            } else {
                winnerCardEl.classList.remove('multi-winner-card');
            }
        }

        if (modalTitle) {
            modalTitle.innerText = winnersArray.length > 1 ? `Winners (${winnersArray.length})!` : 'Winner!';
        }

        const isMulti = winnersArray.length > 1;

        container.innerHTML = '';
        winnersArray.forEach(winner => {
            if (!winner || !winner.username) return;

            try {
                const lowerUser = (winner.username || '').toLowerCase();
                const isApproved = approvedHunters.has(lowerUser);

                const card = document.createElement('div');
                card.className = 'winner-card-item';
                card.style.textAlign = 'center';
                card.style.background = 'rgba(255, 255, 255, 0.05)';
                card.style.padding = isMulti ? '0.9rem 1.1rem' : '1.2rem 1.5rem';
                card.style.borderRadius = '14px';
                card.style.border = '1px solid rgba(83, 252, 24, 0.3)';
                card.style.minWidth = isMulti ? (winnersArray.length > 3 ? '210px' : '235px') : '260px';
                card.style.maxWidth = isMulti ? (winnersArray.length > 3 ? '270px' : '310px') : '340px';

                const activeChannel = (connectedUsername || localStorage.getItem('kick_wheel_username') || '').toLowerCase();
                const twoDaysAgo = Date.now() - (48 * 60 * 60 * 1000);
                const userMsgs = chatLogs.filter(m => 
                    m && m.username &&
                    m.username.toLowerCase() === winner.username.toLowerCase() && 
                    m.timestamp >= twoDaysAgo &&
                    (!m.channel || !activeChannel || m.channel.toLowerCase() === activeChannel)
                );

                let userMessagesHtml = '';
                if (userMsgs.length === 0) {
                    userMessagesHtml = '<div style="color: var(--text-secondary); font-style: italic; font-size: 0.8rem;">No recent chat messages logged</div>';
                } else {
                    userMessagesHtml = userMsgs.slice().reverse().map(m => `
                        <div style="display: flex; justify-content: space-between; gap: 8px; font-size: 0.8rem; padding: 2px 0; border-bottom: 1px solid rgba(255,255,255,0.04);">
                            <span style="color: #eee; word-break: break-word; text-align: left;">"${m.content || ''}"</span>
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

                const isScammer = globalBanList.has(lowerUser);
                let scammerBadgeHtml = '';
                if (isScammer) {
                    scammerBadgeHtml = `
                        <div class="scammer-winner-badge" title="Listed on Global Scammer Ban List">
                            <span>⛔</span> REPORTED SCAMMER - BLOCKED
                        </div>
                    `;
                }

                let hunterBadgeHtml = '';
                if (isHunterDetectorEnabled && !isApproved) {
                    const hInfo = analyzeUserForHunter(winner.username);
                    if (hInfo.isHunter) {
                        hunterBadgeHtml = `
                            <div class="hunter-winner-badge" title="Click to inspect hunter analysis">
                                <span>⚠️</span> Hunter / Farmer Detected (Click to Inspect)
                            </div>
                        `;
                    }
                }

                card.innerHTML = `
                    <div class="winner-avatar-circle" style="border-color: ${winnerColor};">
                        ${avatarContentHtml}
                    </div>
                    ${scammerBadgeHtml}
                    ${goldBadgeHtml}
                    ${hunterBadgeHtml}
                    <div class="winner-name" style="font-size: 1.6rem; font-weight: 800; color: ${winner.isGoldWinner ? '#FFD700' : 'var(--kick-green)'}; margin-bottom: 0.3rem;">${winner.username}</div>
                    <div class="winner-slot" style="font-size: 0.95rem; color: #fff; background: rgba(255, 255, 255, 0.1); padding: 0.3rem 0.8rem; border-radius: 50px; display: inline-block;">${winner.slot_name || winner.username}</div>
                    
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

                        <div class="winner-live-chat-box" style="margin-bottom: 0.8rem; background: rgba(83, 252, 24, 0.08); border: 1px solid rgba(83, 252, 24, 0.3); border-radius: 8px; padding: 0.7rem;">
                            <div style="font-size: 0.8rem; font-weight: 700; color: var(--kick-green); display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.4rem;">
                                <span>⚡ Live Winner Chat (Post-Win)</span>
                                <span class="winner-live-status-badge" data-username="${lowerUser}" style="font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; background: rgba(255,255,255,0.1); color: #ccc;">Waiting for chat...</span>
                            </div>
                            <div class="winner-live-chat-feed" data-username="${lowerUser}" style="max-height: 90px; overflow-y: auto; display: flex; flex-direction: column; gap: 4px; font-size: 0.78rem;">
                                <div class="no-winner-msg-text" style="color: var(--text-secondary); font-style: italic; font-size: 0.75rem;">Winner hasn't typed in chat since winning yet...</div>
                            </div>
                        </div>

                        <div style="font-size: 0.8rem; font-weight: 700; color: #fff; margin-bottom: 0.4rem; border-bottom: var(--glass-border); padding-bottom: 0.3rem;">
                            💬 History Messages (Past 2 Days):
                        </div>
                        <div class="winner-chat-history" style="display: flex; flex-direction: column; gap: 3px;">
                            ${userMessagesHtml}
                        </div>
                    </div>
                `;

                const hunterBadge = card.querySelector('.hunter-winner-badge');
                if (hunterBadge) {
                    hunterBadge.addEventListener('click', () => {
                        const hInfo = analyzeUserForHunter(winner.username);
                        showHunterModal(winner.username, hInfo);
                    });
                }

                container.appendChild(card);

                // Async fetch follow info
                const followStatusEl = card.querySelector('.follow-status-text');
                const channelSlug = connectedUsername || localStorage.getItem('kick_wheel_username') || '';

                if (channelSlug) {
                    kickHandler.getUserFollowInfo(channelSlug, winner.username).then(info => {
                        if (info) {
                            const fetchedPic = info.profile_pic || info.profilepic || info.profile_picture || (info.user && (info.user.profile_pic || info.user.profilepic || info.user.profile_picture));
                            if (fetchedPic) {
                                const avatarCircle = card.querySelector('.winner-avatar-circle');
                                if (avatarCircle && !avatarCircle.querySelector('img')) {
                                    avatarCircle.innerHTML = `
                                        <img src="${fetchedPic}" class="winner-avatar-img" onerror="this.style.display='none'; if(this.nextElementSibling) this.nextElementSibling.style.display='flex';" alt="${winner.username}">
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
                }
            } catch (err) {
                console.error("Error rendering winner card:", err);
            }
        });

        if (typeof soundManager !== 'undefined') soundManager.playWin();

        if (typeof confetti !== 'undefined') {
            confetti({
                particleCount: 80,
                spread: 70,
                origin: { y: 0.6 }
            });
        }

        winnersArray.forEach(winner => addToHistory(winner));
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
        const maxDisplay = 5;
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
            alert('Failed to connect automatically. Try Manual ID.');
            if (document.getElementById('manual-connection')) {
                document.getElementById('manual-connection').style.display = 'block';
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
            alert('Failed to connect via Manual ID.');
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
        const statusBadge = document.getElementById('connection-status-badge');
        const statusText = document.getElementById('status-text');

        if (connected) {
            if (statusBadge) statusBadge.className = 'status-badge connected';
            if (statusText) statusText.innerText = `Live: ${connectedUsername || 'Connected'}`;

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
            if (statusBadge) statusBadge.className = 'status-badge disconnected';
            if (statusText) statusText.innerText = 'Disconnected';

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

        // Simple Graphics Mode Toggle
        if (simpleGraphicsToggle) {
            simpleGraphicsToggle.addEventListener('change', () => {
                isSimpleGraphics = simpleGraphicsToggle.checked;
                document.body.classList.toggle('simple-graphics-mode', isSimpleGraphics);
                localStorage.setItem('kick_wheel_simple_graphics', isSimpleGraphics ? 'true' : 'false');
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

        // Weighted Entries Toggle
        if (weightedEntriesToggle) {
            weightedEntriesToggle.addEventListener('change', () => {
                isWeightedEntriesEnabled = weightedEntriesToggle.checked;
                localStorage.setItem('kick_wheel_weighted_entries_enabled', isWeightedEntriesEnabled ? 'true' : 'false');
                if (weightMultiplierBox) weightMultiplierBox.style.display = isWeightedEntriesEnabled ? 'flex' : 'none';
                if (!isWeightedEntriesEnabled) {
                    queue.forEach(u => u.weight = 1);
                    updateQueueUI();
                    localStorage.setItem('kick_wheel_queue', JSON.stringify(queue));
                    refreshAllWheelSegments();
                }
            });
        }

        // Sub / VIP Multiplier Select
        if (subWeightSelect) {
            subWeightSelect.addEventListener('change', () => {
                subMultiplier = parseInt(subWeightSelect.value, 10) || 2;
                localStorage.setItem('kick_wheel_sub_multiplier', subMultiplier.toString());
            });
        }

        // Wheel Skin Theme Selector
        if (wheelSkinSelect) {
            wheelSkinSelect.addEventListener('change', () => {
                const skin = wheelSkinSelect.value;
                localStorage.setItem('kick_wheel_skin', skin);
                applyWheelSkin(skin);
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

        // Hunter Detector Toggle & Modal Controls
        if (hunterDetectorToggle) {
            hunterDetectorToggle.addEventListener('change', () => {
                isHunterDetectorEnabled = hunterDetectorToggle.checked;
                localStorage.setItem('kick_wheel_hunter_detector_enabled', isHunterDetectorEnabled ? 'true' : 'false');
                if (hunterDetectorOptions) hunterDetectorOptions.style.display = isHunterDetectorEnabled ? 'block' : 'none';
                updateQueueUI();
            });
        }

        if (hunterAiToggle) {
            hunterAiToggle.addEventListener('change', () => {
                isAiHunterEnabled = hunterAiToggle.checked;
                localStorage.setItem('kick_wheel_hunter_ai_enabled', isAiHunterEnabled ? 'true' : 'false');
                if (hunterAiSettingsContainer) hunterAiSettingsContainer.style.display = isAiHunterEnabled ? 'block' : 'none';
                updateQueueUI();
            });
        }

        if (aiProviderSelect) {
            aiProviderSelect.addEventListener('change', () => {
                aiProvider = aiProviderSelect.value;
                localStorage.setItem('kick_wheel_ai_provider', aiProvider);
                if (customEndpointBox) customEndpointBox.style.display = aiProvider === 'custom' ? 'block' : 'none';

                if (aiModelInput) {
                    if (aiProvider === 'openai') aiModelInput.value = 'gpt-4o-mini';
                    else if (aiProvider === 'anthropic') aiModelInput.value = 'claude-3-5-haiku-20241022';
                    else if (aiProvider === 'openrouter') aiModelInput.value = 'openai/gpt-4o-mini';
                    else if (aiProvider === 'custom') aiModelInput.value = 'llama3';
                    aiModel = aiModelInput.value;
                    localStorage.setItem('kick_wheel_ai_model', aiModel);
                }
            });
        }

        if (aiApiKeyInput) {
            aiApiKeyInput.addEventListener('input', () => {
                aiApiKey = aiApiKeyInput.value.trim();
                localStorage.setItem('kick_wheel_ai_api_key', aiApiKey);
            });
        }

        if (toggleApiKeyVis && aiApiKeyInput) {
            toggleApiKeyVis.addEventListener('click', () => {
                const isPass = aiApiKeyInput.type === 'password';
                aiApiKeyInput.type = isPass ? 'text' : 'password';
                toggleApiKeyVis.innerText = isPass ? '🔒' : '👁️';
            });
        }

        if (aiModelInput) {
            aiModelInput.addEventListener('input', () => {
                aiModel = aiModelInput.value.trim();
                localStorage.setItem('kick_wheel_ai_model', aiModel);
            });
        }

        if (aiEndpointInput) {
            aiEndpointInput.addEventListener('input', () => {
                aiEndpoint = aiEndpointInput.value.trim();
                localStorage.setItem('kick_wheel_ai_endpoint', aiEndpoint);
            });
        }

        if (testAiKeyBtn) {
            testAiKeyBtn.addEventListener('click', async () => {
                if (!aiTestResult) return;
                aiTestResult.style.display = 'block';
                aiTestResult.style.color = '#00F0FF';
                aiTestResult.innerText = '⏳ Testing AI API connection...';

                const dummyLogs = [
                    { content: '!giveaway', timestamp: Date.now() - 30000, channel: 'testchannel' },
                    { content: 'pls tip me vault code', timestamp: Date.now() - 10000, channel: 'testchannel' }
                ];

                try {
                    const res = await fetchAiAnalysis('TestUser123', dummyLogs);
                    aiTestResult.style.color = 'var(--kick-green)';
                    aiTestResult.innerHTML = `✅ AI Connection Successful! Result: ${res.isHunter ? 'Flagged' : 'Clear'} (${res.confidence}% Conf)`;
                } catch (e) {
                    aiTestResult.style.color = '#ff4d4d';
                    aiTestResult.innerHTML = `❌ Connection Failed: ${e.message}`;
                }
            });
        }

        if (runAiAnalysisBtn) {
            runAiAnalysisBtn.addEventListener('click', () => {
                if (currentInspectedHunter) {
                    const userMsgs = chatLogs.filter(m => m && m.username && m.username.toLowerCase() === currentInspectedHunter.toLowerCase());
                    triggerAiModalAnalysis(currentInspectedHunter, userMsgs);
                }
            });
        }

        if (approveHunterBtn) {
            approveHunterBtn.addEventListener('click', () => {
                if (currentInspectedHunter) {
                    approvedHunters.add(currentInspectedHunter.toLowerCase());
                    localStorage.setItem('kick_wheel_approved_hunters', JSON.stringify([...approvedHunters]));
                    if (hunterModal) hunterModal.style.display = 'none';
                    updateQueueUI();

                    // Remove warning badge live from active winner card without re-rendering
                    const activeBadges = document.querySelectorAll('.hunter-winner-badge');
                    activeBadges.forEach(b => {
                        const cardParent = b.closest('.winner-card-item');
                        if (cardParent) {
                            const nameEl = cardParent.querySelector('.winner-name');
                            if (nameEl && nameEl.innerText.toLowerCase() === currentInspectedHunter.toLowerCase()) {
                                b.remove();
                            }
                        }
                    });
                }
            });
        }

        if (removeHunterQueueBtn) {
            removeHunterQueueBtn.addEventListener('click', () => {
                if (currentInspectedHunter) {
                    const idx = queue.findIndex(u => u.username.toLowerCase() === currentInspectedHunter.toLowerCase());
                    if (idx !== -1) {
                        removeFromQueue(idx);
                    }
                    if (hunterModal) hunterModal.style.display = 'none';
                }
            });
        }

        if (closeHunterModalBtn && hunterModal) {
            closeHunterModalBtn.addEventListener('click', () => {
                hunterModal.style.display = 'none';
            });
        }

        if (hunterModal) {
            hunterModal.addEventListener('click', (e) => {
                if (e.target === hunterModal) {
                    hunterModal.style.display = 'none';
                }
            });
        }

        if (dismissScammerBannerBtn && scammerBlockedBanner) {
            dismissScammerBannerBtn.addEventListener('click', () => {
                scammerBlockedBanner.style.display = 'none';
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

        // Fairness Modal Handlers
        const fairnessBtn = document.getElementById('fairness-btn');
        const fairnessModal = document.getElementById('fairness-modal');
        const closeFairnessModal = document.getElementById('close-fairness-modal');

        if (fairnessBtn && fairnessModal) {
            fairnessBtn.addEventListener('click', () => {
                fairnessModal.style.display = 'flex';
            });
        }

        if (closeFairnessModal && fairnessModal) {
            closeFairnessModal.addEventListener('click', () => {
                fairnessModal.style.display = 'none';
            });
        }

        if (fairnessModal) {
            fairnessModal.addEventListener('click', (e) => {
                if (e.target === fairnessModal) {
                    fairnessModal.style.display = 'none';
                }
            });
        }

        // Sidebar Tab Navigation Logic
        const tabBtns = document.querySelectorAll('.tab-btn');
        const tabContents = document.querySelectorAll('.tab-content');

        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTab = btn.getAttribute('data-tab');
                tabBtns.forEach(b => b.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));

                btn.classList.add('active');
                const targetEl = document.getElementById(targetTab);
                if (targetEl) targetEl.classList.add('active');
            });
        });

        // Onboarding Landing Welcome Modal Logic
        const welcomeModal = document.getElementById('welcome-modal');
        const openGuideBtn = document.getElementById('open-guide-btn');
        const dismissWelcomeBtn = document.getElementById('dismiss-welcome-btn');

        const hasSeenWelcome = localStorage.getItem('kick_wheel_landing_seen') === 'true';
        if (!hasSeenWelcome && welcomeModal) {
            welcomeModal.style.display = 'flex';
        }

        if (openGuideBtn && welcomeModal) {
            openGuideBtn.addEventListener('click', () => {
                welcomeModal.style.display = 'flex';
            });
        }

        if (dismissWelcomeBtn && welcomeModal) {
            dismissWelcomeBtn.addEventListener('click', () => {
                welcomeModal.style.display = 'none';
                localStorage.setItem('kick_wheel_landing_seen', 'true');
            });
        }

        // Version Checker Logic
        const CURRENT_VERSION = '1.8.0';
        const GITHUB_VERSION_URL = 'https://raw.githubusercontent.com/prettymuchgavin/KickSlotCallWheel/main/version.txt';

        async function checkForUpdates() {
            try {
                const response = await fetch(`${GITHUB_VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
                if (!response.ok) return;
                const remoteVersion = (await response.text()).trim();

                if (remoteVersion && remoteVersion !== CURRENT_VERSION) {
                    console.log(`Update detected! Local: ${CURRENT_VERSION}, Remote: ${remoteVersion}`);
                    const banner = document.getElementById('update-notification-banner');
                    const tag = document.getElementById('latest-version-tag');
                    if (tag) tag.innerText = `v${remoteVersion}`;
                    if (banner) banner.style.display = 'flex';
                }
            } catch (err) {
                console.warn('Could not check remote version from GitHub:', err);
            }
        }

        checkForUpdates();
        setInterval(checkForUpdates, 15 * 60 * 1000);

        const dismissUpdateBtn = document.getElementById('dismiss-update-btn');

        if (dismissUpdateBtn) {
            dismissUpdateBtn.addEventListener('click', () => {
                const banner = document.getElementById('update-notification-banner');
                if (banner) banner.style.display = 'none';
            });
        }

    // Unified Message Handler (Both Dashboard and OBS Overlay)
    function handleKickMessage(msg) {
        if (!msg || !msg.content || typeof msg.content !== 'string') return;

        const content = msg.content.trim();
        const lowerContent = content.toLowerCase();

        const activeChan = (connectedUsername || localStorage.getItem('kick_wheel_username') || '').toLowerCase();

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

            // Live Winner Chat Feed Trigger
            const senderLower = u.toLowerCase();
            if (currentWinnerUsernames.has(senderLower)) {
                appendLiveWinnerChatMessage(senderLower, u, content);
            }

            try {
                localStorage.setItem('kick_wheel_chat_logs', JSON.stringify(chatLogs.slice(-300)));
                localStorage.setItem('kick_wheel_user_meta', JSON.stringify(userMeta));
            } catch(e) {}
        }

        // Broadcaster chat command overrides (Sync across tabs)
        const currentChannelName = connectedUsername || localStorage.getItem('kick_wheel_username') || '';
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
        if (isWeightedEntriesEnabled && msg.sender) {
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

    // Close Modal Handler
    function dismissWinnerModal() {
        if (winnerModal) {
            console.log('[DEBUG] Dismissing winner modal');
            winnerModal.style.display = 'none';
        }
        localStorage.setItem('kick_wheel_modal_active', 'false');
    }

    // Close buttons inside Winner Modal
    const modalCloseBtn = document.getElementById('close-winner-btn');
    if (modalCloseBtn) {
        modalCloseBtn.addEventListener('click', dismissWinnerModal);
    }
    
    // Background Overlay Click Dismissal
    if (winnerModal) {
        winnerModal.addEventListener('click', (e) => {
            if (e.target === winnerModal) {
                dismissWinnerModal();
            }
        });
    }

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

        if (e.key === 'kick_wheel_simple_graphics' && e.newValue) {
            isSimpleGraphics = e.newValue === 'true';
            if (simpleGraphicsToggle) simpleGraphicsToggle.checked = isSimpleGraphics;
            document.body.classList.toggle('simple-graphics-mode', isSimpleGraphics);
        }

        if (e.key === 'kick_wheel_gold_spin_enabled' && e.newValue) {
            isGoldSpinEnabled = e.newValue === 'true';
            if (goldSpinToggle) goldSpinToggle.checked = isGoldSpinEnabled;
            refreshAllWheelSegments();
        }

        if (e.key === 'kick_wheel_weighted_entries_enabled' && e.newValue) {
            isWeightedEntriesEnabled = e.newValue === 'true';
            if (weightedEntriesToggle) weightedEntriesToggle.checked = isWeightedEntriesEnabled;
            if (weightMultiplierBox) weightMultiplierBox.style.display = isWeightedEntriesEnabled ? 'flex' : 'none';
            if (!isWeightedEntriesEnabled) {
                queue.forEach(u => u.weight = 1);
                updateQueueUI();
                refreshAllWheelSegments();
            }
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

    });

    // Animation Loop for Wheels
    function animate() {
        wheels.forEach(w => w.draw());
        requestAnimationFrame(animate);
    }
    animate();
});
