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

function injectMobileStyles() {
    if (document.getElementById('chat-tracker-mobile-styles')) return;
    const style = document.createElement('style');
    style.id = 'chat-tracker-mobile-styles';
    style.innerHTML = `
.chat-tracker-panel {
            touch-action: none !important;
            user-select: none !important;
            -webkit-user-select: none !important;
            cursor: grab;
            position: fixed !important;
            z-index: 9999 !important;
            will-change: transform; /* Подготовка видеокарты для плавности */
            transition: none;
            background: rgba(0,0,0,0.8); /* Если стилей нет в CSS, это поможет увидеть иконку */
            border-radius: 8px;
            padding: 5px;
        }
        .chat-tracker-panel.snapping {
            transition: transform 0.2s ease-out; /* Плавный досыл */
        }
        .chat-tracker-panel:active {
            cursor: grabbing;
        }
        .chat-tracker-panel button { touch-action: auto !important; }
    `;
    document.head.appendChild(style);
}

const CHAT_TRACKER_DEBUG = true;

function debugLog(...args) {
    try {
        if (!CHAT_TRACKER_DEBUG) return;
        console.debug('[ChatTracker]', ...args);
    } catch (e) {}
}

const originalFetch = window.fetch;
const fetchInterceptQueue = [];
const FETCH_INTERCEPT_TIMEOUT = 2000;

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
                debugLog('fetch:response text parse failed');
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
                debugLog('fetch:response extracted', { 
                    url: urlString, 
                    tokens: lastInterceptedTokenCount 
                });
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

function createTrackerPanel() {
    injectMobileStyles();
    try {
        if (document.getElementById('chat-tracker-panel')) return;
        
        const panel = document.createElement('div');
        panel.id = 'chat-tracker-panel';
        panel.className = 'chat-tracker-panel';
        
        const svgIcon = `
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="11" r="1" fill="currentColor"/>
                <circle cx="16" cy="11" r="1" fill="currentColor"/>
                <circle cx="8" cy="11" r="1" fill="currentColor"/>
            </svg>
        `;
        
        panel.innerHTML = `
            <div class="tracker-header">
                <span class="tracker-icon" title="Chat Tracker">${svgIcon}</span>
                <button class="tracker-toggle" id="tracker-toggle" title="Toggle">
                    <span class="toggle-arrow">▼</span>
                </button>
            </div>
            <div class="tracker-content" id="tracker-content">
                <div class="tracker-stat">
                    <span class="stat-label">Messages:</span>
                    <span class="stat-value" id="stat-messages">0</span>
                </div>
                <div class="tracker-stat">
                    <span class="stat-label">Hidden:</span>
                    <span class="stat-value" id="stat-hidden">0</span>
                </div>
                <div class="tracker-stat">
                    <div class="context-info">
                        <span class="stat-label">Tokens:</span>
                        <span class="stat-value" id="stat-context">
                            <span class="context-text">0 / 0</span>
                            <span class="context-percent">(0%)</span>
                        </span>
                        <button class="edit-limit-btn" id="edit-limit-btn" title="Edit token limit">✎</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);

        const toggleButton = document.getElementById('tracker-toggle');
        if (toggleButton) toggleButton.addEventListener('click', togglePanel);

        const editLimitBtn = document.getElementById('edit-limit-btn');
        if (editLimitBtn) editLimitBtn.addEventListener('click', openLimitEditor);
        
        loadPosition(panel);
        makeDraggable(panel);
        
    } catch (error) {}
}

function togglePanel(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    const panel = document.getElementById('chat-tracker-panel');
    const content = document.getElementById('tracker-content');
    const arrow = document.querySelector('.toggle-arrow');
    
    isCollapsed = !isCollapsed;
    if (content) {
        content.style.display = isCollapsed ? 'none' : 'block';
        if (panel) {
            if (isCollapsed) panel.classList.add('collapsed');
            else panel.classList.remove('collapsed');
        }
    }    
    if (arrow) {
        arrow.textContent = isCollapsed ? '▲' : '▼';
        arrow.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    }  
    saveState();
}
    
    saveState();
}

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

function handlePanelClick(e) {
    const panel = document.getElementById('chat-tracker-panel');
    if (e.target.closest('button')) return;
    if (isCollapsed && panel.dataset.justDragged !== 'true') {
        togglePanel(e);
    }
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

            debugLog('event', eventName);

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
        if (types) {
            if (types.MESSAGE_SENT) eventSource.on(types.MESSAGE_SENT, () => handleRefreshEvent(types.MESSAGE_SENT));
            if (types.MESSAGE_RECEIVED) eventSource.on(types.MESSAGE_RECEIVED, () => handleRefreshEvent(types.MESSAGE_RECEIVED));
            if (types.CHAT_CHANGED) eventSource.on(types.CHAT_CHANGED, () => handleRefreshEvent(types.CHAT_CHANGED, { resetIntercepted: true }));
            if (types.GENERATION_ENDED) eventSource.on(types.GENERATION_ENDED, () => handleRefreshEvent(types.GENERATION_ENDED, { delayMs: 500 }));
        } else {
            eventSource.on('message_sent', () => handleRefreshEvent('message_sent'));
            eventSource.on('message_received', () => handleRefreshEvent('message_received'));
            eventSource.on('chat_changed', () => handleRefreshEvent('chat_changed', { resetIntercepted: true }));
            eventSource.on('generation_ended', () => handleRefreshEvent('generation_ended', { delayMs: 500 }));
            eventSource.on('generation_after_commands', () => handleRefreshEvent('generation_after_commands', { delayMs: 500 }));
            eventSource.on('message_deleted', () => handleRefreshEvent('message_deleted'));
            eventSource.on('message_edited', () => handleRefreshEvent('message_edited'));
        }

        const hiddenEvents = ['message_hidden', 'MESSAGE_HIDDEN', 'messageUpdated'];
        hiddenEvents.forEach(eventName => {
            eventSource.on(eventName, (data) => {
                debugLog('event', eventName);
                if (data && typeof data === 'object' && data.messageId) captureHiddenMessage(data.messageId);
                else if (typeof data === 'number') captureHiddenMessage(data);
                updateHiddenCount();
            });
        });
    } catch (error) {}
}

function updateMessageCount() {
    try {
        const context = SillyTavern.getContext();
        if (!context || !context.chat) return;
        const chat = context.chat || [];
        let visibleCount = 0;
        chat.forEach((msg) => {
            if (msg.is_system !== true && !isMessageHidden(msg)) visibleCount++;
        });
        const element = document.getElementById('stat-messages');
        if (element) element.textContent = visibleCount;
    } catch (error) {}
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
        debugLog('tokens', { trigger, method, tokens: current });
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
            debugLog('token ui updated');
            updateContextDisplay('ui-mutation');
        });

        tokenUiObserver.observe(target, { childList: true, subtree: true, characterData: true });
    } catch (e) {}
}

function openLimitEditor(event) {
    if (event) event.stopPropagation();

    const existingEditor = document.getElementById('limit-editor-overlay');
    if (existingEditor) existingEditor.remove();

    const overlay = document.createElement('div');
    overlay.id = 'limit-editor-overlay';
    overlay.className = 'limit-editor-overlay';

    const modal = document.createElement('div');
    modal.className = 'limit-editor-modal';

    modal.innerHTML = `
        <h3>Set Custom Token Limit</h3>
        <div class="limit-editor-input-group">
            <label for="limit-input">Token Limit (0 - 128,000):</label>
            <input type="number" id="limit-input" class="limit-editor-input" value="${maxTokens}" min="0" max="128000" placeholder="50000" required>
            <span class="input-hint">Default: 50,000 tokens</span>
        </div>
        <div class="limit-editor-buttons">
            <button class="limit-editor-btn limit-editor-cancel" id="limit-cancel">Cancel</button>
            <button class="limit-editor-btn limit-editor-save" id="limit-save">Save</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    overlay.classList.add('active');

    const input = document.getElementById('limit-input');
    const cancelBtn = document.getElementById('limit-cancel');
    const saveBtn = document.getElementById('limit-save');

    function closeModal() {
        overlay.remove();
    }

    function validateInput(value) {
        const num = parseInt(value);
        return !isNaN(num) && num >= 0 && num <= 128000;
    }

    function showError(message) {
        const existingError = modal.querySelector('.error-message');
        if (existingError) existingError.remove();

        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        modal.querySelector('.limit-editor-input-group').appendChild(errorDiv);

        input.classList.add('input-error');
        setTimeout(() => input.classList.remove('input-error'), 1000);
    }

    function clearError() {
        const existingError = modal.querySelector('.error-message');
        if (existingError) existingError.remove();
    }

    cancelBtn.addEventListener('click', () => closeModal());

    saveBtn.addEventListener('click', () => {
        const value = input.value.trim();

        if (!value) {
            showError('Please enter a value');
            return;
        }

        if (!validateInput(value)) {
            showError('Value must be between 0 and 128,000');
            return;
        }

        const numValue = parseInt(value);
        maxTokens = numValue;
        localStorage.setItem('chatTrackerMaxTokens', maxTokens.toString());
        updateContextDisplay();
        closeModal();
    });

    input.addEventListener('input', () => {
        clearError();
        input.classList.remove('input-error');
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveBtn.click();
        if (e.key === 'Escape') closeModal();
    });

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });

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
        localStorage.setItem('chatTracker_collapsed', isCollapsed.toString());
    } catch (error) {}
}

function loadState() {
    try {
        const savedState = localStorage.getItem('chatTracker_collapsed');
        if (savedState !== null) {
            isCollapsed = savedState === 'true';
            if (isCollapsed) {
                const panel = document.getElementById('chat-tracker-panel');
                const content = document.getElementById('tracker-content');
                const arrow = document.querySelector('.toggle-arrow');
                if (panel && content) {
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

function savePosition(left, top) {
    localStorage.setItem('chatTracker_pos', JSON.stringify({ left, top }));
}

function loadPosition(element) {
    try {
        const saved = localStorage.getItem('chatTracker_pos');
        if (saved) {
            const pos = JSON.parse(saved);
            element.style.left = pos.left;
            element.style.top = pos.top;
            element.style.right = 'auto';
            element.style.bottom = 'auto';
        }
    } catch (e) {}
}

function makeDraggable(element) {
    let isDragging = false;
    let startClickX, startClickY;
    let startX = 0, startY = 0;
    let currentX = 0, currentY = 0;
    let rafId = null;
    try {
        const saved = localStorage.getItem('chatTracker_pos_v2');
        if (saved) {
            const pos = JSON.parse(saved);
            currentX = pos.x;
            currentY = pos.y;
            element.style.transform = `translate(${currentX}px, ${currentY}px)`;
        }
    } catch (e) {}

    const onStart = (clientX, clientY) => {
        if (event.target.closest('button') || event.target.closest('input')) return;

        isDragging = true;
        element.classList.remove('snapping');
        
        startClickX = clientX;
        startClickY = clientY;
        
        startX = clientX - currentX;
        startY = clientY - currentY;
        
        if (rafId) cancelAnimationFrame(rafId);
    };

    const onMove = (clientX, clientY) => {
        if (!isDragging) return;
        
        const dist = Math.sqrt(Math.pow(clientX - startClickX, 2) + Math.pow(clientY - startClickY, 2));
    
        if (dist < 5) return; 

        element.dataset.justDragged = 'true'; 

        rafId = requestAnimationFrame(() => {
            currentX = clientX - startX;
            currentY = clientY - startY;
            element.style.transform = `translate(${currentX}px, ${currentY}px)`;
        });
    };

    const onEnd = () => {
        if (!isDragging) return;
        isDragging = false;
        element.style.cursor = 'grab';
        element.classList.add('snapping');

        localStorage.setItem('chatTracker_pos_v2', JSON.stringify({ x: currentX, y: currentY }));
        
        setTimeout(() => {
             element.dataset.justDragged = 'false';
        }, 100);
    };

    element.addEventListener('mousedown', (e) => {
        onStart(e.clientX, e.clientY);
    });
    window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onEnd);
    element.addEventListener('touchstart', (e) => {
        onStart(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: false });
    
    window.addEventListener('touchmove', (e) => {
        if (isDragging) {
            if (e.cancelable) e.preventDefault();
            onMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: false });
    window.addEventListener('touchend', onEnd);
}
