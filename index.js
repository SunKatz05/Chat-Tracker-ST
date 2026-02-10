let isDragging = false;
let dragStartX, dragStartY;
let panelStartX, panelStartY;
let hasMoved = false;

let lastHiddenMessage = null;
let isCollapsed = false;
let contextReady = false;
let initializationRetries = 0;

let lastInterceptedTokenCount = 0;
let lastDisplayedTokenCount = -1;
let lastDisplayedTokenMethod = '';

let tokenUiObserver = null;
let tokenUiObserverRetries = 0;

let maxTokens = 50000;
let currentSumIdx = -1;

const CHAT_TRACKER_DEBUG = true;

function debugLog(...args) {
    try {
        if (!CHAT_TRACKER_DEBUG) return;
        console.debug('[ChatTracker]', ...args);
    } catch (e) {}
}

const originalFetch = window.fetch;

window.fetch = async (...args) => {
    const [url, options] = args;
    const urlString = String(url);
    const isGenerateRequest = urlString.includes('/generate') || urlString.includes('/chat/completions');

    if (isGenerateRequest && options?.body) {
        try {
            const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;

            if (body.messages && Array.isArray(body.messages)) {
                const context = typeof SillyTavern !== 'undefined' ? SillyTavern.getContext() : null;
                if (context && typeof context.getTokenCount === 'function') {
                    const promptText = body.messages.map(m => m.content || '').join('\n');
                    lastInterceptedTokenCount = context.getTokenCount(promptText);
                    updateContextDisplay('fetch:request');
                }
            }
        } catch (e) {}
    }

    let response;
    try {
        response = await originalFetch(...args);
    } catch (error) {
        debugLog('fetch error', error.message);
        throw error;
    }

    if (isGenerateRequest && response.ok) {
        handleFetchResponse(response, urlString).catch(e =>
            debugLog('fetch:response async error', e.message)
        );
    }

    return response;
};

async function handleFetchResponse(response, urlString) {
    try {
        const clone = response.clone();
        if (!clone) return;

        const contentType = clone.headers?.get?.('content-type') ?? '';

        let data;
        if (contentType.includes('application/json')) {
            data = await clone.json();
        } else if (contentType.includes('text')) {
            const text = await clone.text();
            try {
                data = JSON.parse(text);
            } catch (e) {
                return;
            }
        } else {
            return;
        }

        const extracted = extractTokenCountFromObject(data);
        if (typeof extracted === 'number' && extracted > 0) {
            const prevTokenCount = lastInterceptedTokenCount;
            lastInterceptedTokenCount = Math.round(extracted);

            if (lastInterceptedTokenCount !== prevTokenCount) {
                updateContextDisplay('fetch:response');
            }
        }
    } catch (e) {
        debugLog('fetch:response handler error', e.message);
    }
}

jQuery(async function() {
    try {
        createTrackerPanel();
        loadState();
        await waitForSillyTavernReady();
        debugLog('contextReady after wait:', contextReady);
        refreshAll('init');
        setupEventListeners();
        setupTokenObservers();
        setupSummaryEvents();
        setInterval(() => {
            refreshAll('timer');
        }, 2500);
    } catch (error) {}
});

function waitForSillyTavernReady() {
    return new Promise((resolve) => {
        initializationRetries = 0;
        const maxRetries = 100;
        const checkInterval = 100;

        const check = () => {
            initializationRetries++;

            if (typeof SillyTavern === 'undefined') {
                if (initializationRetries < maxRetries) setTimeout(check, checkInterval);
                else resolve();
                return;
            }

            try {
                const context = SillyTavern.getContext();
                if (!context) {
                    if (initializationRetries < maxRetries) setTimeout(check, checkInterval);
                    else resolve();
                    return;
                }

                if (context.chat === undefined || context.chat === null) {
                    if (initializationRetries < maxRetries) setTimeout(check, checkInterval);
                    else {
                        contextReady = true;
                        resolve();
                    }
                    return;
                }

                contextReady = true;
                resolve();
            } catch (error) {
                if (initializationRetries < maxRetries) setTimeout(check, checkInterval);
                else resolve();
            }
        };

        check();
    });
}

function setupDraggable(el, handle) {
    const dragHandle = handle || el;

    const onMove = (e) => {
        if (!isDragging) return;

        const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

        const dx = clientX - dragStartX;
        const dy = clientY - dragStartY;

        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
            hasMoved = true;
            el.classList.add('dragging');
        }

        let newLeft = panelStartX + dx;
        let newTop = panelStartY + dy;

        newLeft = Math.max(0, Math.min(window.innerWidth - el.offsetWidth, newLeft));
        newTop = Math.max(0, Math.min(window.innerHeight - el.offsetHeight, newTop));

        el.style.left = `${newLeft}px`;
        el.style.top = `${newTop}px`;
        el.style.bottom = 'auto';
        el.style.right = 'auto';
    };

    const onEnd = () => {
        if (isDragging) {
            isDragging = false;
            el.classList.remove('dragging');

            const rect = el.getBoundingClientRect();
            const windowWidth = window.innerWidth;

            if ((rect.left + rect.width / 2) > windowWidth / 2) {
                const rightDist = windowWidth - rect.right;
                el.style.left = 'auto';
                el.style.right = rightDist + 'px';
            } else {
                el.style.right = 'auto';
                el.style.left = rect.left + 'px';
            }

            if (el.id === 'chat-tracker-panel') {
                saveState();
            }
            setTimeout(() => { hasMoved = false; }, 50);
        }
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onEnd);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onEnd);
    };

    const onStart = (e) => {
        if (e.target.closest('button, input, textarea, .tracker-popup-close, .edit-limit-btn')) return;

        isDragging = true;
        hasMoved = false;

        const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
        const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

        dragStartX = clientX;
        dragStartY = clientY;

        const rect = el.getBoundingClientRect();
        panelStartX = rect.left;
        panelStartY = rect.top;

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onEnd);
    };

    dragHandle.addEventListener('mousedown', onStart);
    dragHandle.addEventListener('touchstart', onStart, { passive: true });
}

function createTrackerPanel() {
    try {
        if (document.getElementById('chat-tracker-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'chat-tracker-panel';
        panel.className = 'chat-tracker-panel';

        const header = document.createElement('div');
        header.className = 'tracker-header';

const svgIcon = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        <line x1="8" y1="9" x2="16" y2="9"/>
        <line x1="8" y1="13" x2="14" y2="13"/>
    </svg>
`;
        const icon = document.createElement('span');
        icon.className = 'tracker-icon';
        icon.title = 'Chat Tracker';
        icon.innerHTML = svgIcon;

        const toggleButton = document.createElement('button');
        toggleButton.className = 'tracker-toggle';
        toggleButton.id = 'tracker-toggle';
        toggleButton.title = 'Toggle';
        const arrow = document.createElement('span');
        arrow.className = 'toggle-arrow';
        arrow.textContent = '▼';
        toggleButton.appendChild(arrow);

        header.appendChild(icon);
        header.appendChild(toggleButton);

        const content = document.createElement('div');
        content.className = 'tracker-content';
        content.id = 'tracker-content';

        const messagesDiv = document.createElement('div');
        messagesDiv.className = 'tracker-stat';
        messagesDiv.innerHTML = `
    <span class="stat-label">Messages:</span>
    <span class="stat-value" id="stat-messages">0</span>
`;

        const hiddenDiv = document.createElement('div');
        hiddenDiv.className = 'tracker-stat';
        hiddenDiv.innerHTML = `
    <span class="stat-label">Hidden:</span>
    <span class="stat-value" id="stat-hidden">0</span>
`;

        const contextDiv = document.createElement('div');

        contextDiv.className = 'tracker-stat tokens-vertical-block';
        contextDiv.innerHTML = `
            <div class="tokens-label-top">Tokens:</div>
            <div id="stat-context" class="tokens-numbers-mid">
                <span class="context-text">0 / 0</span>
                <span class="context-percent">(0%)</span>
            </div>
            <button class="edit-limit-btn" id="edit-limit-btn" title="Edit token limit">✎</button>
        `;

        content.appendChild(messagesDiv);
        content.appendChild(hiddenDiv);
        content.appendChild(contextDiv);

        panel.appendChild(header);
        panel.appendChild(content);

        document.body.appendChild(panel);

        const toggleBtn = document.getElementById('tracker-toggle');
        if (toggleBtn) toggleBtn.addEventListener('click', togglePanel);

        const editLimitBtn = document.getElementById('edit-limit-btn');
        if (editLimitBtn) editLimitBtn.addEventListener('click', openLimitEditor);

        setupDraggable(panel);
    } catch (error) {}
}

function togglePanel(event) {
    if (hasMoved) return;
    if (event) event.stopPropagation();

    const panel = document.getElementById('chat-tracker-panel');
    const content = document.getElementById('tracker-content');
    const arrow = document.querySelector('.toggle-arrow');

    if (!panel || !content) return;

    isCollapsed = !isCollapsed;
    const animateDurationMs = 320;

    if (isCollapsed) {
        panel.classList.add('collapsed');
        content.style.maxHeight = `${content.scrollHeight}px`;
        content.style.opacity = '1';
        content.offsetHeight;

        requestAnimationFrame(() => {
            content.style.maxHeight = '0px';
            content.style.opacity = '0';
            panel.style.width = '32px';
            panel.style.height = '32px';
            panel.style.padding = '0px';
            if (arrow) arrow.style.transform = 'rotate(-90deg)';
        });

        setTimeout(() => {
            panel.style.width = '';
            panel.style.height = '';
            panel.style.padding = '';
            content.style.maxHeight = '0px';
        }, animateDurationMs);
    } else {
        panel.classList.remove('collapsed');
        content.style.maxHeight = `${content.scrollHeight}px`;
        content.style.opacity = '1';

        panel.style.width = '';
        panel.style.height = '';
        panel.style.padding = '';
        panel.offsetHeight;

        const targetWidth = panel.offsetWidth;
        const targetHeight = panel.offsetHeight;
        const targetPadding = window.getComputedStyle(panel).padding;

        panel.classList.add('collapsed');
        content.style.maxHeight = '0px';
        content.style.opacity = '0';
        panel.offsetHeight;

        requestAnimationFrame(() => {
            panel.classList.remove('collapsed');
            panel.style.width = `${targetWidth}px`;
            panel.style.height = `${targetHeight}px`;
            panel.style.padding = targetPadding;
            content.style.maxHeight = `${content.scrollHeight}px`;
            content.style.opacity = '1';
            if (arrow) arrow.style.transform = 'rotate(0deg)';
        });

        setTimeout(() => {
            panel.style.width = '';
            panel.style.height = '';
            panel.style.padding = '';
            content.style.maxHeight = '';
        }, animateDurationMs);
    }
    saveState();
}

function handlePanelClick() {
    if (isCollapsed && !hasMoved) togglePanel();
}

function setupEventListeners() {
    try {
        const context = SillyTavern.getContext();
        const eventSource = context?.eventSource || window.eventSource;
        if (!eventSource) return;

        const panel = document.getElementById('chat-tracker-panel');
        if (panel) panel.addEventListener('click', handlePanelClick);

        const handleRefreshEvent = (eventName, opts = {}) => {
            const { delayMs = 0, resetIntercepted = false } = opts;

            if (resetIntercepted) {
                lastInterceptedTokenCount = 0;
                setupTokenObservers();
            }

            if (delayMs > 0) {
                setTimeout(() => refreshAll(eventName), delayMs);
                return;
            }

            refreshAll(eventName);
            setTimeout(() => updateContextDisplay(`${eventName}:follow-up`), 75);
            setTimeout(() => updateContextDisplay(`${eventName}:follow-up2`), 350);
        };

        const types = window.event_types;
        const eventsToListen = types ? 
            [types.MESSAGE_SENT, types.MESSAGE_RECEIVED, types.CHAT_CHANGED, types.GENERATION_ENDED, types.MESSAGE_UPDATED] : 
            ['message_sent', 'message_received', 'chat_changed', 'generation_ended', 'message_updated', 'message_deleted', 'message_edited'];

        eventsToListen.forEach(evt => {
            if(!evt) return;
            const isGenEnd = evt === (types?.GENERATION_ENDED || 'generation_ended');
            const isChatChange = evt === (types?.CHAT_CHANGED || 'chat_changed');
            
            eventSource.on(evt, () => {
                handleRefreshEvent(evt, { 
                    delayMs: isGenEnd ? 500 : 0, 
                    resetIntercepted: isChatChange 
                });
                
                setTimeout(() => {
                    if (document.getElementById('tracker-sum-popup')?.style.display !== 'none') {
                        updatePopupContentFromContext();
                    }
                }, isGenEnd ? 200 : 50);
            });
        });

        const hiddenEvents = ['message_hidden', 'MESSAGE_HIDDEN', 'messageUpdated'];
        hiddenEvents.forEach(eventName => {
            eventSource.on(eventName, (data) => {
                if (data && typeof data === 'object' && data.messageId) captureHiddenMessage(data.messageId);
                else if (typeof data === 'number') captureHiddenMessage(data);
                updateHiddenCount();
            });
        });
    } catch (error) {}
}

function updateMessageCount() {
    const context = SillyTavern.getContext();
    if (!context || !context.chat) return;
    
    let visibleCount = 0;
    let lastSumIdx = -1;
    
    context.chat.forEach((msg, idx) => {
        if (msg.is_system !== true && !isMessageHidden(msg)) visibleCount++;
        if (msg.extra && msg.extra.memory) lastSumIdx = idx;
    });

    currentSumIdx = lastSumIdx;
    const element = document.getElementById('stat-messages');
    
    if (element) {
        let html = `${visibleCount}`; 
        if (lastSumIdx !== -1) {
            html += ` <span id="trigger-show-sum" class="has-summary-clickable">(Sum: #${lastSumIdx})</span>`;
        } else {
            html += ` <span id="trigger-create-sum" class="tracker-btn-create" title="Create Summary">+</span>`;
        }
        element.innerHTML = html;
    }
}

function isMessageHidden(msg) {
    if (!msg) return false;
    return msg.extra?.hidden === true || msg.mes_hidden === true || msg.hidden === true || msg.is_hidden === true || msg.is_system === true || msg.exclude_from_prompt === true || msg.extra?.exclude_from_prompt === true;
}

function countHiddenMessages() {
    try {
        const context = SillyTavern.getContext();
        if (!context || !context.chat) return { hiddenCount: 0, lastHiddenIndex: -1, lastHiddenText: '' };
        const chat = context.chat || [];
        let hiddenCount = 0;
        let lastHiddenIndex = -1;
        let lastHiddenText = '';
        chat.forEach((msg, index) => {
            if (isMessageHidden(msg)) {
                hiddenCount++;
                lastHiddenIndex = index;
                lastHiddenText = msg?.mes ?? msg?.content ?? msg?.message ?? '';
            }
        });
        return { hiddenCount, lastHiddenIndex, lastHiddenText };
    } catch (error) {
        return { hiddenCount: 0, lastHiddenIndex: -1, lastHiddenText: '' };
    }
}

function captureHiddenMessage(messageId) {
    try {
        const context = SillyTavern.getContext();
        if (!context || !context.chat) return;
        const chat = context.chat || [];
        let message = chat[messageId];
        if (!message || (message.id !== undefined && message.id !== messageId)) {
            message = chat.find(msg => msg.id === messageId);
        }
        if (message) lastHiddenMessage = message.mes || message.message || '';
    } catch (error) {}
}

function updateHiddenCount() {
    try {
        const element = document.getElementById('stat-hidden');
        if (!element) return;
        const { hiddenCount, lastHiddenIndex, lastHiddenText } = countHiddenMessages();
        if (lastHiddenText) lastHiddenMessage = lastHiddenText;
        let displayText = `${hiddenCount}`;
        if (lastHiddenIndex >= 0) displayText += ` (last: #${lastHiddenIndex + 1})`;
        element.textContent = displayText;
        if (lastHiddenMessage) {
            const numberPart = lastHiddenIndex >= 0 ? `#${lastHiddenIndex + 1} ` : '';
            element.title = `Last hidden ${numberPart}${lastHiddenMessage.substring(0, 100)}${lastHiddenMessage.length > 100 ? '...' : ''}`;
        } else if (hiddenCount > 0) element.title = `${hiddenCount} hidden messages in chat`;
        else element.title = 'No hidden messages';
    } catch (error) {}
}

function parseTokenCountFromText(text) {
    try {
        if (!text) return null;
        const normalized = String(text).replace(/\u00a0/g, ' ').trim();
        const match = normalized.match(/(\d[\d,\s]*)(?:\.(\d+))?\s*([KkMm])?/);
        if (!match) return null;

        const intPart = match[1].replace(/[\s,]/g, '');
        const fracPart = match[2] ? `.${match[2]}` : '';
        const suffix = match[3]?.toLowerCase() ?? '';

        let num = parseFloat(`${intPart}${fracPart}`);
        if (!Number.isFinite(num)) return null;

        if (suffix === 'k') num *= 1000;
        if (suffix === 'm') num *= 1000000;

        return Math.round(num);
    } catch (e) {
        return null;
    }
}

function readTokenCountFromWindow() {
    try {
        const raw = window.token_count;
        if (typeof raw === 'number' && Number.isFinite(raw)) return Math.round(raw);
        if (typeof raw === 'string') return parseTokenCountFromText(raw);
    } catch (e) {}
    return null;
}

function readTokenCountFromPromptTotalTokensElement() {
    try {
        const nodes = document.querySelectorAll('.prompt_total_tokens');
        for (const node of nodes) {
            const tokens = parseTokenCountFromText(node?.textContent);
            if (typeof tokens === 'number') return tokens;
        }
    } catch (e) {}
    return null;
}

function readTokenCountFromContextGetTokenCount() {
    try {
        const context = typeof SillyTavern !== 'undefined' ? SillyTavern.getContext() : null;
        if (!context || typeof context.getTokenCount !== 'function') return null;

        const result = context.getTokenCount();
        if (typeof result === 'number' && Number.isFinite(result)) return Math.round(result);
        if (typeof result === 'string') return parseTokenCountFromText(result);
    } catch (e) {}
    return null;
}

function readTokenCountFromFetchIntercept() {
    if (typeof lastInterceptedTokenCount === 'number' && Number.isFinite(lastInterceptedTokenCount)) return Math.round(lastInterceptedTokenCount);
    return null;
}

function getTokenCountWithMethod() {
    try {
        const context = typeof SillyTavern !== 'undefined' ? SillyTavern.getContext() : null;
        if (!context || !context.chat) {
            return { method: 'none', tokens: 0 };
        }

        const visibleMessages = context.chat
            .filter(msg => !isMessageHidden(msg))
            .map(msg => msg.mes || "")
            .join("\n");

        if (!visibleMessages || visibleMessages.trim().length === 0) {
            return { method: 'full-chat-calc', tokens: 0 };
        }

        const totalChatTokens = context.getTokenCount(visibleMessages);

        if (typeof totalChatTokens === 'number' && totalChatTokens > 0) {
            return { method: 'full-chat-calc', tokens: totalChatTokens };
        }

        return { method: 'full-chat-calc', tokens: 0 };
    } catch (e) {
        return { method: 'error', tokens: 0 };
    }
}

function extractTokenCountFromObject(input) {
    try {
        const keyRank = new Map([
            ['prompt_total_tokens', 0],
            ['prompt_tokens', 1],
            ['prompt_token_count', 1],
            ['prompttokencount', 1],
            ['token_count', 2],
            ['tokencount', 2],
            ['total_tokens', 3],
            ['totaltokens', 3],
        ]);

        const visited = new Set();
        const stack = [input];
        const candidates = [];

        while (stack.length > 0) {
            const value = stack.pop();
            if (!value || typeof value !== 'object') continue;
            if (visited.has(value)) continue;
            visited.add(value);

            if (Array.isArray(value)) {
                for (const item of value) stack.push(item);
                continue;
            }

            for (const [key, child] of Object.entries(value)) {
                const keyLower = String(key).toLowerCase();
                const keyNoUnderscore = keyLower.replace(/_/g, '');

                const directRank = keyRank.get(keyLower) ?? keyRank.get(keyNoUnderscore);
                if (directRank !== undefined) {
                    const tokens = typeof child === 'number' ? child : parseTokenCountFromText(child);
                    if (typeof tokens === 'number' && Number.isFinite(tokens) && tokens > 0) {
                        candidates.push({ tokens, rank: directRank });
                    }
                }

                if (keyLower.includes('token') && !keyLower.includes('max') && !keyLower.includes('limit')) {
                    const tokens = typeof child === 'number' ? child : parseTokenCountFromText(child);
                    if (typeof tokens === 'number' && Number.isFinite(tokens) && tokens > 0) {
                        candidates.push({ tokens, rank: 10 });
                    }
                }

                if (child && typeof child === 'object') stack.push(child);
            }
        }

        if (candidates.length === 0) return null;

        candidates.sort((a, b) => {
            if (a.rank !== b.rank) return a.rank - b.rank;
            return b.tokens - a.tokens;
        });

        return candidates[0].tokens;
    } catch (e) {
        return null;
    }
}

function updateContextDisplay(trigger = 'update') {
    const { tokens: current, method } = getTokenCountWithMethod();
    const percentage = maxTokens > 0 ? Math.round((current / maxTokens) * 100) : 0;

    const element = document.getElementById('stat-context');
    if (!element) return;

    if (current !== lastDisplayedTokenCount || method !== lastDisplayedTokenMethod) {
        lastDisplayedTokenCount = current;
        lastDisplayedTokenMethod = method;
    }

    const textDiv = element.querySelector('.context-text');
    const percentDiv = element.querySelector('.context-percent');

    if (textDiv) textDiv.textContent = `${current.toLocaleString()} / ${maxTokens.toLocaleString()}`;

    if (percentDiv) {
        percentDiv.textContent = `(${percentage}%)`;
        percentDiv.style.color = '';
        if (percentage >= 90) percentDiv.style.color = '#ff4444';
        else if (percentage >= 75) percentDiv.style.color = '#ffaa44';
        else if (percentage >= 50) percentDiv.style.color = '#ffcc44';
    }
}

function setupTokenObservers() {
    try {
        tokenUiObserver?.disconnect();

        const target = document.querySelector('.prompt_total_tokens');
        if (!target) {
            if (tokenUiObserverRetries < 10) {
                tokenUiObserverRetries++;
                setTimeout(setupTokenObservers, 1000);
            }
            return;
        }

        tokenUiObserverRetries = 0;

        tokenUiObserver = new MutationObserver(() => {
            updateContextDisplay('ui-mutation');
        });

        tokenUiObserver.observe(target, { childList: true, subtree: true, characterData: true });
    } catch (e) {}
}
function openLimitEditor(event) {
    if (event) event.stopPropagation();
    const existingPopup = document.getElementById('tracker-limit-popup');
    if (existingPopup) {
        existingPopup.remove();
        return;
    }
    const popup = document.createElement('div');
    popup.id = 'tracker-limit-popup';
    popup.className = 'tracker-popup';
    popup.innerHTML = `
        <div class="tracker-popup-header" id="tracker-limit-drag">
            <span>SET TOKEN LIMIT</span>
            <span class="tracker-popup-close" id="tracker-limit-close">&times;</span>
        </div>
        <div class="tracker-popup-body" style="padding: 10px;">
            <div style="margin-bottom: 5px; color: var(--SmartThemeBodyColor);">Limit (0-128k):</div>
            <input type="number" id="limit-input" class="limit-editor-input" 
                   value="${maxTokens}" min="0" max="128000" placeholder="50000" 
                   style="width: 100%; box-sizing: border-box; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; gap: 5px;">
                 <button class="limit-editor-btn" id="limit-cancel" style="flex: 1;">Cancel</button>
                 <button class="limit-editor-btn" id="limit-save" style="flex: 1;">Save</button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);
    const panel = document.getElementById('chat-tracker-panel');
    const rect = panel.getBoundingClientRect();
    popup.style.top = (rect.top + 80) + 'px';
    if (rect.left > window.innerWidth / 2) {
        popup.style.left = (rect.left - 200) + 'px';
    } else {
        popup.style.left = (rect.right + 10) + 'px';
    }
    popup.style.display = 'flex';
    popup.style.width = '200px';
    const input = document.getElementById('limit-input');
    const closeBtn = document.getElementById('tracker-limit-close');
    const cancelBtn = document.getElementById('limit-cancel');
    const saveBtn = document.getElementById('limit-save');
    const header = document.getElementById('tracker-limit-drag');
    setupDraggable(popup, header);

    function closePopup() {
        popup.remove();
    }

    closeBtn.onclick = closePopup;
    cancelBtn.onclick = closePopup;

    saveBtn.onclick = () => {
        const val = parseInt(input.value.trim());
        if (!isNaN(val) && val >= 0 && val <= 128000) {
            maxTokens = val;
            localStorage.setItem('chatTrackerMaxTokens', maxTokens.toString());
            updateContextDisplay();
            closePopup();
        } else {
            toastr.error("Invalid token limit", "Chat Tracker");
        }
    };
    setTimeout(() => input.focus(), 50);
}

function loadMaxTokens() {
    try {
        const saved = localStorage.getItem('chatTrackerMaxTokens');
        if (saved !== null) {
            const value = parseInt(saved);
            if (!isNaN(value) && value >= 0 && value <= 128000) {
                maxTokens = value;
            }
        }
    } catch (error) {}
}

function refreshAll(trigger = 'refresh') {
    try {
        if (contextReady) {
            updateMessageCount();
            updateHiddenCount();
        }
        updateContextDisplay(trigger);
    } catch (error) {}
}

function saveState() {
    try {
        const panel = document.getElementById('chat-tracker-panel');
        if (!panel) return;

        const rect = panel.getBoundingClientRect();
        const winWidth = window.innerWidth;
        const isRightSide = rect.left + (rect.width / 2) > winWidth / 2;

        const state = {
            collapsed: isCollapsed,
            top: panel.style.top,
            isRight: isRightSide
        };

        if (isRightSide) {
            state.right = (winWidth - rect.right) + 'px';
            state.left = 'auto';
        } else {
            state.left = panel.style.left;
            state.right = 'auto';
        }

        localStorage.setItem('chatTracker_settings', JSON.stringify(state));
    } catch (error) { console.error("Save error:", error); }
}

function loadState() {
    try {
        const saved = localStorage.getItem('chatTracker_settings');
        if (!saved) return;
        const state = JSON.parse(saved);
        
        const panel = document.getElementById('chat-tracker-panel');
        if (panel) {
            panel.style.top = state.top || '40px';
            if (state.isRight) {
                panel.style.right = state.right;
                panel.style.left = 'auto';
            } else {
                panel.style.left = state.left;
                panel.style.right = 'auto';
            }
            if (state.collapsed) {
                isCollapsed = true;
                const content = document.getElementById('tracker-content');
                const arrow = document.querySelector('.toggle-arrow');
                if (content) {
                    panel.classList.add('collapsed');
                    content.style.maxHeight = '0px';
                    content.style.opacity = '0';
                    if (arrow) {
                        arrow.textContent = '▼';
                        arrow.style.transform = 'rotate(-90deg)';
                    }
                }
            }
        }
        loadMaxTokens();
    } catch (error) {}
}

function setupSummaryEvents() {
    const statEl = document.getElementById('stat-messages');
    if (!statEl) return;

    statEl.onclick = async (e) => {
        const createBtn = e.target.closest('#trigger-create-sum');
        const showBtn = e.target.closest('#trigger-show-sum');

        if (showBtn) {
            toggleSumPopup(true);
        }

        if (createBtn) {
            toastr.info("Requesting summary...", "Chat Tracker");
            const forceSummarizeBtn = document.getElementById('memory_force_summarize');

            if (forceSummarizeBtn) {
                forceSummarizeBtn.click();
                console.log("[ChatTracker] Нажата кнопка memory_force_summarize");
            } else {
                try {
                    if (typeof SlashCommandParser !== 'undefined' && SlashCommandParser.commands['summarize']) {
                        SlashCommandParser.commands['summarize'].callback({}, '');
                        console.log("[ChatTracker] Summarize запущен через команду.");
                    } else {
                        console.error("Не найден элемент #memory_force_summarize и не удалось вызвать команду /summarize");
                        if (typeof toastr !== 'undefined') toastr.error("Ошибка: Расширение Summarize не найдено или отключено.");
                    }
                } catch (e) {
                    console.error(e);
                    if (typeof toastr !== 'undefined') toastr.error("Не удалось запустить Summarize.");
                }
            }

            setTimeout(() => {
                updateMessageCount();
            }, 1000);
        }
    };

    if (!document.getElementById('tracker-sum-popup')) {
        const popup = document.createElement('div');
        popup.id = 'tracker-sum-popup';
        popup.className = 'tracker-popup';
        popup.innerHTML = `
            <div class="tracker-popup-header" id="tracker-sum-drag">
                <span>CHAT SUMMARY</span>
                <span class="tracker-popup-close" id="tracker-sum-close">&times;</span>
            </div>
            <div class="tracker-popup-body">
                <textarea id="tracker-sum-area" placeholder="Summary will appear here..."></textarea>
            </div>
            <div class="tracker-popup-footer">
                <span class="btn-restore-sum" id="tracker-sum-restore" title="Restore Previous Summary">Restore Previous</span>
                <span>Auto-saves to Tavern</span>
            </div>
        `;
        document.body.appendChild(popup);

        document.getElementById('tracker-sum-close').onclick = () => toggleSumPopup(false);

        setupDraggable(popup, document.getElementById('tracker-sum-drag'));

        const area = document.getElementById('tracker-sum-area');
        
        area.oninput = () => {
            const context = SillyTavern.getContext();
            updateMessageCount();
            
            if (currentSumIdx !== -1 && context.chat[currentSumIdx]) {
                const newValue = area.value;
                context.chat[currentSumIdx].extra.memory = newValue;
                
                const originalTextarea = document.getElementById('memory_contents');
                if (originalTextarea) {
                    originalTextarea.value = newValue;
                    originalTextarea.dispatchEvent(new Event('input', { bubbles: true }));
                }

                context.saveChat();
            }
        };

        document.getElementById('tracker-sum-restore').onclick = () => {
            const originalRestoreBtn = document.getElementById('memory_restore');
            
            if (originalRestoreBtn) {
                originalRestoreBtn.click();
                toastr.info("Triggered extension restore", "Chat Tracker");
                setTimeout(() => {
                    updatePopupContentFromContext();
                }, 200);
            } else {
                updatePopupContentFromContext();
                toastr.warning("Original extension button not found. Reverted UI.", "Chat Tracker");
            }
        };
    }
}

function updatePopupContentFromContext() {
    const context = SillyTavern.getContext();
    const area = document.getElementById('tracker-sum-area');
    
    let lastSumIdx = -1;
    if(context && context.chat) {
        context.chat.forEach((msg, idx) => {
            if (msg.extra && msg.extra.memory) lastSumIdx = idx;
        });
    }
    currentSumIdx = lastSumIdx;

    if (area && currentSumIdx !== -1 && context.chat[currentSumIdx]) {
        const memoryText = context.chat[currentSumIdx].extra.memory || "";
        if (area.value !== memoryText && document.activeElement !== area) {
            area.value = memoryText;
        }
    }
}

function toggleSumPopup(show) {
    const popup = document.getElementById('tracker-sum-popup');
    if (!popup) return;

    if (show) {
        updatePopupContentFromContext();

        if (!popup.style.left && !popup.style.top) {
            const panel = document.getElementById('chat-tracker-panel');
            const rect = panel.getBoundingClientRect();
            popup.style.top = (rect.top + 50) + 'px'; 

            if (rect.left > window.innerWidth / 2) {
                popup.style.left = (rect.left - 310) + 'px'; 
            } else {
                popup.style.left = (rect.right + 10) + 'px';
            }
        }
        popup.style.display = 'flex';
    } else {
        popup.style.display = 'none';
    }
}
