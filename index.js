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
let lastVisibleMessageCount = -1;

let maxTokens = 50000;
let tokenMode = 'api';
let lastUsage = { prompt: 0, completion: 0, total: 0 };

let isSunnyMode = false;

const CHAT_TRACKER_DEBUG = false;

function debugLog(...args) {
    try {
        if (!CHAT_TRACKER_DEBUG) return;
        console.debug('[ChatTracker]', ...args);
    } catch (e) {}
}

function getChatIdentifier() {
    try {
        const context = typeof SillyTavern !== 'undefined' ? SillyTavern.getContext() : null;
        return context?.chatId || 'default';
    } catch (e) {
        return 'default';
    }
}

function saveApiUsage(usage) {
    try {
        const chatId = getChatIdentifier();
        if (!chatId || chatId === 'default') return;
        localStorage.setItem('chatTracker_apiUsage_' + chatId, JSON.stringify(usage));
    } catch (e) {}
}

function loadApiUsage() {
    try {
        const chatId = getChatIdentifier();
        const saved = localStorage.getItem('chatTracker_apiUsage_' + chatId);
        if (saved) {
            lastUsage = JSON.parse(saved);
        } else {
            lastUsage = { prompt: 0, completion: 0, total: 0 };
        }
    } catch (e) {
        lastUsage = { prompt: 0, completion: 0, total: 0 };
    }
}

const originalFetch = window.fetch;

window.fetch = async (...args) => {
    const[url, options] = args;
    const urlString = String(url);
    const isGenerateRequest = urlString.includes('/generate') || urlString.includes('/chat/completions');

    if (isGenerateRequest && options?.body) {
        try {
            const body = typeof options.body === 'string' ? JSON.parse(options.body) : options.body;

            if (body.messages && Array.isArray(body.messages)) {
                const context = typeof SillyTavern !== 'undefined' ? SillyTavern.getContext() : null;
                if (context && typeof context.getTokenCount === 'function') {
                    const promptText = body.messages.map(m => m.content || '').join('\n');
                    const estimatedPrompt = context.getTokenCount(promptText);
                    lastUsage.prompt = estimatedPrompt;
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

function extractUsage(data) {
    if (!data || typeof data !== 'object') return null;

    let prompt = 0, completion = 0, total = 0;

    if (data.usage) {
        prompt = data.usage.prompt_tokens || 0;
        completion = data.usage.completion_tokens || 0;
        total = data.usage.total_tokens || 0;
    } else if (data.usageMetadata) {
        prompt = data.usageMetadata.promptTokenCount || 0;
        completion = data.usageMetadata.candidatesTokenCount || 0;
        total = data.usageMetadata.totalTokenCount || (prompt + completion);
    } else {
        prompt = data.prompt_tokens || data.prompt_token_count || data.prompttokencount || 0;
        completion = data.completion_tokens || data.completion_token_count || 0;
        total = data.total_tokens || data.totaltokens || data.token_count || data.tokencount || 0;
    }

    if (prompt > 0 || total > 0) {
        if (total === 0) total = prompt + completion;
        if (prompt === 0 && total > 0) prompt = total - completion;
        return { prompt, completion, total };
    }

    return null;
}

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

        const usage = extractUsage(data);
        if (usage) {
            console.log('[ChatTracker] API usage:', usage, data);
            lastUsage.prompt = usage.prompt || 0;
            lastUsage.completion = usage.completion || 0;
            lastUsage.total = usage.total || (usage.prompt + usage.completion);
            saveApiUsage(lastUsage);
            updateContextDisplay('fetch:usage');
        } else {
            console.log("No usage found in response", data);
        }
    } catch (e) {
        debugLog('fetch:response handler error', e.message);
    }
}

jQuery(async function() {
    try {
        loadState();
        createTrackerPanel();
        await waitForSillyTavernReady();
        loadApiUsage();
        refreshAll('init');
        setupEventListeners();
        setupTokenObservers();
        setupSunnyEvents(); 
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
                if (!context || context.chat === undefined || context.chat === null) {
                    if (initializationRetries < maxRetries) setTimeout(check, checkInterval);
                    else { contextReady = true; resolve(); }
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
            if (el.id === 'chat-tracker-panel') saveState();
            setTimeout(() => { hasMoved = false; }, 50);
        }
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onEnd);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onEnd);
    };

    const onStart = (e) => {
        if (e.target.closest('button, input, textarea, .tracker-popup-close, .edit-limit-btn, .sunny-panel-tab, .mode-btn')) return;
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
        header.innerHTML = `
            <span class="tracker-icon" title="Chat Tracker">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    <line x1="8" y1="9" x2="16" y2="9"/>
                    <line x1="8" y1="13" x2="14" y2="13"/>
                </svg>
            </span>
            <button class="tracker-toggle" id="tracker-toggle" title="Toggle"><span class="toggle-arrow">▼</span></button>
        `;

        const content = document.createElement('div');
        content.className = 'tracker-content';
        content.id = 'tracker-content';
        content.innerHTML = `
            <div class="tracker-stat">
                <span class="stat-label">Messages:</span>
                <span class="stat-value" id="stat-messages">0 <span id="trigger-sunny-panel" class="tracker-btn-create" title="Toggle Sunny Tools"><i class="fa-solid fa-sun"></i></span></span>
            </div>
            <div class="tracker-stat">
                <span class="stat-label">Hidden:</span>
                <span class="stat-value" id="stat-hidden">0</span>
            </div>
            <div class="tracker-stat tokens-vertical-block" style="position:relative; min-height: 50px;">
                <div id="stat-context-container" style="display:flex; flex-direction:column; width:100%; align-items:center;">
                    <div class="tokens-label-top">Tokens:</div>
                    <div id="stat-context" class="tokens-numbers-mid">
                        <span class="context-text">0 / 0</span>
                        <span class="context-percent">(0%)</span>
                    </div>
                    <div class="mode-buttons-container">
                        <button class="mode-btn ${tokenMode === 'chat' ? 'active' : ''}" data-mode="chat" title="Visible chat history">CHAT</button>
                        <button class="mode-btn ${tokenMode === 'api' ? 'active' : ''}" data-mode="api" title="API Prompt tokens">API</button>
                        <button class="edit-limit-btn" id="edit-limit-btn" title="Edit token limit">✎</button>
                    </div>
                </div>
                <div id="sunny-panel-tabs" style="display:none; width:100%; flex-direction:column; gap:4px; padding-top:2px;">
                    <div style="font-size:9px; font-weight:bold; color:var(--SmartThemeQuoteColor, #ffaa00); text-align:center; letter-spacing:1px; margin-bottom:2px; opacity:0.8;">SUNNY TOOLS</div>
                    <div style="display:flex; gap:4px; width:100%;">
                        <button class="sunny-panel-tab active" data-tab="sum">SUM</button>
                        <button class="sunny-panel-tab" data-tab="facts">FACTS</button>
                    </div>
                    <div style="display:flex; gap:4px; width:100%;">
                        <button class="sunny-panel-tab" data-tab="qc">Q&C</button>
                        <button class="sunny-panel-tab" data-tab="lib">LIB</button>
                    </div>
                </div>
            </div>
        `;

        panel.appendChild(header);
        panel.appendChild(content);
        document.body.appendChild(panel);

        document.getElementById('tracker-toggle')?.addEventListener('click', togglePanel);
        document.getElementById('edit-limit-btn')?.addEventListener('click', openLimitEditor);

        const modeBtns = document.querySelectorAll('.mode-btn');
        modeBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const newMode = btn.getAttribute('data-mode');
                if (newMode) {
                    tokenMode = newMode;
                    localStorage.setItem('chatTrackerTokenMode', tokenMode);
                    modeBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    updateContextDisplay('mode-switch');
                }
            });
        });

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
                loadApiUsage();
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
        const eventsToListen = types ?[types.MESSAGE_SENT, types.MESSAGE_RECEIVED, types.CHAT_CHANGED, types.GENERATION_ENDED, types.MESSAGE_UPDATED] :['message_sent', 'message_received', 'chat_changed', 'generation_ended', 'message_updated', 'message_deleted', 'message_edited'];

        eventsToListen.forEach(evt => {
            if(!evt) return;
            const isGenEnd = evt === (types?.GENERATION_ENDED || 'generation_ended');
            const isChatChange = evt === (types?.CHAT_CHANGED || 'chat_changed');
            eventSource.on(evt, () => {
                handleRefreshEvent(evt, { delayMs: isGenEnd ? 500 : 0, resetIntercepted: isChatChange });
                setTimeout(() => {
                    if (document.getElementById('tracker-sunny-popup')?.style.display !== 'none') {
                        updateSunnyPopupData();
                    }
                }, isGenEnd ? 200 : 50);
            });
        });

        const hiddenEvents =['message_hidden', 'MESSAGE_HIDDEN', 'messageUpdated'];
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
    context.chat.forEach((msg) => {
        if (msg.is_system !== true && !isMessageHidden(msg)) visibleCount++;
    });

    if (visibleCount === lastVisibleMessageCount) return;
    const element = document.getElementById('stat-messages');
    if (element) {
        lastVisibleMessageCount = visibleCount; 
        element.innerHTML = `${visibleCount} <span id="trigger-sunny-panel" class="tracker-btn-create" title="Toggle Sunny Tools"><i class="fa-solid fa-sun"></i></span>`;
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
        const chat = context.chat ||[];
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
        const chat = context.chat ||[];
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

function getTokenCountWithMethod() {
    if (tokenMode === 'api') {
        return { method: 'api', tokens: lastUsage.prompt || 0 };
    }
    try {
        const context = typeof SillyTavern !== 'undefined' ? SillyTavern.getContext() : null;
        if (!context || !context.chat) return { method: 'chat', tokens: 0 };
        const visibleMessages = context.chat.filter(msg => !isMessageHidden(msg)).map(msg => msg.mes || "").join("\n");
        if (!visibleMessages || visibleMessages.trim().length === 0) return { method: 'chat', tokens: 0 };
        const estimate = context.getTokenCount(visibleMessages);
        return { method: 'chat', tokens: typeof estimate === 'number' ? estimate : 0 };
    } catch (e) {
        return { method: 'error', tokens: 0 };
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
        tokenUiObserver = new MutationObserver(() => updateContextDisplay('ui-mutation'));
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
                 <button class="limit-editor-btn limit-editor-cancel" id="limit-cancel" style="flex: 1;">Cancel</button>
                 <button class="limit-editor-btn limit-editor-save" id="limit-save" style="flex: 1;">Save</button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);
    const panel = document.getElementById('chat-tracker-panel');
    const rect = panel.getBoundingClientRect();
    popup.style.top = (rect.top + 80) + 'px';
    if (rect.left > window.innerWidth / 2) popup.style.left = (rect.left - 200) + 'px';
    else popup.style.left = (rect.right + 10) + 'px';
    popup.style.display = 'flex';
    popup.style.width = '200px';
    
    const input = document.getElementById('limit-input');
    setupDraggable(popup, document.getElementById('tracker-limit-drag'));

    const closePopup = () => popup.remove();
    document.getElementById('tracker-limit-close').onclick = closePopup;
    document.getElementById('limit-cancel').onclick = closePopup;

    document.getElementById('limit-save').onclick = () => {
        const val = parseInt(input.value.trim());
        if (!isNaN(val) && val >= 0 && val <= 128000) {
            maxTokens = val;
            localStorage.setItem('chatTrackerMaxTokens', maxTokens.toString());
            updateContextDisplay();
            closePopup();
        } else toastr.error("Invalid token limit", "Chat Tracker");
    };
    setTimeout(() => input.focus(), 50);
}

function loadMaxTokens() {
    try {
        const saved = localStorage.getItem('chatTrackerMaxTokens');
        if (saved !== null) {
            const value = parseInt(saved);
            if (!isNaN(value) && value >= 0 && value <= 128000) maxTokens = value;
        }
        const savedMode = localStorage.getItem('chatTrackerTokenMode');
        if (savedMode === 'api' || savedMode === 'chat') tokenMode = savedMode;
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

        const state = { collapsed: isCollapsed, top: panel.style.top, isRight: isRightSide };
        if (isRightSide) {
            state.right = (winWidth - rect.right) + 'px';
            state.left = 'auto';
        } else {
            state.left = panel.style.left;
            state.right = 'auto';
        }
        localStorage.setItem('chatTracker_settings', JSON.stringify(state));
    } catch (error) {}
}

function loadState() {
    try {
        const saved = localStorage.getItem('chatTracker_settings');
        if (!saved) return;
        const state = JSON.parse(saved);
        const panel = document.getElementById('chat-tracker-panel');
        if (panel) {
            panel.style.top = state.top || '40px';
            if (state.isRight) { panel.style.right = state.right; panel.style.left = 'auto'; } 
            else { panel.style.left = state.left; panel.style.right = 'auto'; }
            if (state.collapsed) {
                isCollapsed = true;
                const content = document.getElementById('tracker-content');
                const arrow = document.querySelector('.toggle-arrow');
                if (content) {
                    panel.classList.add('collapsed');
                    content.style.maxHeight = '0px';
                    content.style.opacity = '0';
                    if (arrow) { arrow.textContent = '▼'; arrow.style.transform = 'rotate(-90deg)'; }
                }
            }
        }
    } catch (error) {}
    loadMaxTokens();
}

function setupSunnyEvents() {
    $(document).on('click', '#trigger-sunny-panel', function(e) {
        e.stopPropagation();
        if (!window.extension_settings?.SunnyMemories) {
            toastr.warning("Please install/enable SunnyMemories extension.", "Sunny QuickPanel");
            return;
        }
        isSunnyMode = !isSunnyMode;
        document.getElementById('stat-context-container').style.display = isSunnyMode ? 'none' : 'flex';
        document.getElementById('sunny-panel-tabs').style.display = isSunnyMode ? 'flex' : 'none';
        this.style.color = isSunnyMode ? '#ffcc00' : '';
        this.style.textShadow = isSunnyMode ? '0 0 8px rgba(255, 204, 0, 0.6)' : '';
        
        if (!isSunnyMode) toggleSunnyPopup(false);
    });

    $(document).on('click', '.sunny-panel-tab', function(e) {
        e.stopPropagation();
        $('.sunny-panel-tab').removeClass('active');
        $(this).addClass('active');
        
        const target = $(this).data('tab');
        const titles = { sum: 'STORY SUMMARY', facts: 'ESTABLISHED FACTS', qc: 'QUESTS & CALENDAR', lib: 'LIBRARY' };
        
        $('#sunny-popup-title-text').text(titles[target]);
        $('.sunny-tab-content').removeClass('active');
        $('#sunny-tab-' + target).addClass('active');
        
        toggleSunnyPopup(true);
    });

    createSunnyPopup();
}

function createSunnyPopup() {
    if (document.getElementById('tracker-sunny-popup')) return;

    const popup = document.createElement('div');
    popup.id = 'tracker-sunny-popup';
    popup.className = 'tracker-popup beautiful-popup';
    popup.style.width = '320px'; 
    
    popup.innerHTML = `
        <div class="tracker-popup-header beautiful-header" id="tracker-sunny-drag">
            <div class="beautiful-title"><i class="fa-solid fa-sun" style="color:var(--SmartThemeQuoteColor, #ffaa00); margin-right:6px;"></i><span id="sunny-popup-title-text">STORY SUMMARY</span></div>
            <span class="tracker-popup-close" id="tracker-sunny-close">&times;</span>
        </div>
        <div class="tracker-popup-body beautiful-body">
            
            <div class="sunny-tab-content active" id="sunny-tab-sum">
                <textarea id="mini-sum-area" class="beautiful-textarea" placeholder="Story Summary..."></textarea>
                <div class="beautiful-actions">
                    <button class="beautiful-btn beautiful-btn-primary" id="mini-sum-gen"><i class="fa-solid fa-wand-magic-sparkles"></i> Generate</button>
                    <button class="beautiful-btn" id="mini-sum-restore"><i class="fa-solid fa-rotate-left"></i> Restore</button>
                    <button class="beautiful-btn" id="mini-sum-lib"><i class="fa-solid fa-book"></i> To Lib</button>
                </div>
            </div>

            <div class="sunny-tab-content" id="sunny-tab-facts">
                <textarea id="mini-facts-area" class="beautiful-textarea" placeholder="Established Facts..."></textarea>
                <div class="beautiful-actions">
                    <button class="beautiful-btn beautiful-btn-primary" id="mini-facts-gen"><i class="fa-solid fa-wand-magic-sparkles"></i> Generate</button>
                    <button class="beautiful-btn" id="mini-facts-restore"><i class="fa-solid fa-rotate-left"></i></button>
                    <button class="beautiful-btn" id="mini-facts-split"><i class="fa-solid fa-object-ungroup"></i> Split</button>
                    <button class="beautiful-btn" id="mini-facts-lib"><i class="fa-solid fa-book"></i> To Lib</button>
                </div>
            </div>

            <div class="sunny-tab-content" id="sunny-tab-qc">
                <div id="mini-qc-display" style="font-size: 12px; padding: 12px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; margin-bottom: 5px; color: #ddd; line-height: 1.5;">
                    <div style="margin-bottom: 8px;"><strong style="color:var(--SmartThemeQuoteColor, #ffaa00);">Last Quest:</strong><br> <span id="mini-last-quest" style="opacity:0.9;">None</span></div>
                    <div><strong style="color:var(--SmartThemeQuoteColor, #ffaa00);">Last Event:</strong><br> <span id="mini-last-event" style="opacity:0.9;">None</span></div>
                </div>
                <div class="beautiful-actions" style="flex-direction: column; gap: 8px; margin-top: 12px;">
                    <button class="beautiful-btn beautiful-btn-primary" id="mini-quest-gen" style="width:100%;"><i class="fa-solid fa-scroll"></i> Extract Quests</button>
                    <button class="beautiful-btn beautiful-btn-primary" id="mini-event-gen" style="width:100%;"><i class="fa-solid fa-calendar-day"></i> Extract Events</button>
                </div>
            </div>

            <div class="sunny-tab-content" id="sunny-tab-lib">
                <div style="font-size: 12px; text-align:center; padding: 25px 10px; color: rgba(255,255,255,0.5); line-height:1.5;">
                    <i class="fa-solid fa-boxes-stacked" style="font-size:24px; margin-bottom:10px; opacity:0.5;"></i><br>
                    Fragment management requires full interface.
                </div>
                <button class="beautiful-btn" id="mini-open-main" style="width:100%; padding: 12px; margin-top:10px;"><i class="fa-solid fa-arrow-up-right-from-square"></i> Open Full SunnyMemories</button>
            </div>

        </div>
    `;
    
    document.body.appendChild(popup);
    setupDraggable(popup, document.getElementById('tracker-sunny-drag'));

    $('#tracker-sunny-close').on('click', () => toggleSunnyPopup(false));

    let miniTypingTimer;
    $('#mini-sum-area, #mini-facts-area').on('input', function() {
        const isSum = $(this).attr('id') === 'mini-sum-area';
        const target = isSum ? $('#sunny-memories-output-summary') : $('#sunny-memories-output-facts');
        if (target.length) target.val($(this).val()); 
        clearTimeout(miniTypingTimer);
        miniTypingTimer = setTimeout(() => { if (target.length) target.trigger('blur'); }, 1000);
    });

    $('#mini-facts-area').on('input blur', function() {
        const smInput = $('#sunny-memories-output-facts');
        if (smInput.length) smInput.val($(this).val()).trigger('input').trigger('blur');
    });

    $('#mini-sum-gen').on('click', () => { $('.sm-generate-btn[data-type="summary"]').click(); });
    $('#mini-sum-lib').on('click', () => { $('.sm-save-lib-btn[data-type="summary"]').click(); });
    $('#mini-facts-gen').on('click', () => { $('.sm-generate-btn[data-type="facts"]').click(); });
    $('#mini-facts-split').on('click', () => { $('.sm-split-lib-btn').click(); });
    $('#mini-facts-lib').on('click', () => { $('.sm-save-lib-btn[data-type="facts"]').click(); });
    $('#mini-quest-gen').on('click', () => { $('#sm-btn-generate-quests').click(); });
    $('#mini-event-gen').on('click', () => { $('#sm-btn-generate-events').click(); });

    $('#mini-sum-restore').on('click', () => restoreManual('summary'));
    $('#mini-facts-restore').on('click', () => restoreManual('facts'));

    const restoreManual = (type) => {
        const context = SillyTavern.getContext();
        if (!context || !context.chat || context.chat.length === 0) return;
        const mem = context.chat[0].extra?.sunny_memories;
        if (type === 'summary' && mem && mem.previousSummary !== undefined) {
            $('#mini-sum-area').val(mem.previousSummary);
            $('#sunny-memories-output-summary').val(mem.previousSummary).trigger('input').trigger('blur');
            toastr.success("Summary restored locally.", "Sunny QuickPanel");
        } else if (type === 'facts' && mem && mem.previousFacts !== undefined) {
            $('#mini-facts-area').val(mem.previousFacts);
            $('#sunny-memories-output-facts').val(mem.previousFacts).trigger('input').trigger('blur');
            toastr.success("Facts restored locally.", "Sunny QuickPanel");
        } else toastr.info("No previous data to restore.", "Sunny QuickPanel");
    };

    $('#mini-open-main').on('click', () => {
        toggleSunnyPopup(false);
        $('#sm-main-btn-memories').click(); 
        const drawer = $('#extensions_settings').closest('.drawer-content');
        const smSettings = $('#sunny_memories_settings');
        if (drawer.length > 0 && smSettings.length > 0) {
            drawer.animate({ scrollTop: smSettings.offset().top - drawer.offset().top + drawer.scrollTop() }, 300);
        }
    });
}

function updateSunnyPopupData() {
    const context = SillyTavern.getContext();
    if (!context || !context.chat || context.chat.length === 0) return;
    const mes = context.chat[0];
    const sm = mes.extra?.sunny_memories || {};
    
    const sumArea = document.getElementById('mini-sum-area');
    const factsArea = document.getElementById('mini-facts-area');
    if (sumArea && document.activeElement !== sumArea) sumArea.value = sm.summary || "";
    if (factsArea && document.activeElement !== factsArea) factsArea.value = sm.facts || "";

    const questEl = document.getElementById('mini-last-quest');
    const eventEl = document.getElementById('mini-last-event');
    if (questEl && eventEl) {
        let lastQuest = "None";
        if (sm.quests && sm.quests.length > 0) {
            const activeQuests = sm.quests.filter(q => q.status === 'current');
            if (activeQuests.length > 0) lastQuest = activeQuests[activeQuests.length - 1].title;
            else lastQuest = sm.quests[sm.quests.length - 1].title;
        }
        let lastEvent = "None";
        if (sm.calendar && sm.calendar.events && sm.calendar.events.length > 0) lastEvent = sm.calendar.events[sm.calendar.events.length - 1].description;
        
        questEl.textContent = lastQuest.length > 40 ? lastQuest.substring(0, 40) + '...' : lastQuest;
        eventEl.textContent = lastEvent.length > 40 ? lastEvent.substring(0, 40) + '...' : lastEvent;
    }
}

function toggleSunnyPopup(show) {
    const popup = document.getElementById('tracker-sunny-popup');
    if (!popup) return;

    if (show) {
        updateSunnyPopupData();
        if (!popup.style.left && !popup.style.top) {
            const panel = document.getElementById('chat-tracker-panel');
            const rect = panel.getBoundingClientRect();
            popup.style.top = (rect.top) + 'px'; 
            if (rect.left > window.innerWidth / 2) popup.style.left = (rect.left - 330) + 'px'; 
            else popup.style.left = (rect.right + 10) + 'px';
        }
        popup.style.display = 'flex';
    } else {
        popup.style.display = 'none';
    }
}
