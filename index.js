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
            z-index: 20000 !important; /* Увеличил Z-index, чтобы было поверх всего */
            will-change: transform;
            transition: none;
            background: rgba(0, 0, 0, 0.85);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 8px;
            padding: 5px;
            color: #fff;
            font-size: 14px;
            font-family: sans-serif;
            box-shadow: 0 4px 6px rgba(0,0,0,0.3);
            min-width: 120px;
        }
        .chat-tracker-panel.snapping {
            transition: transform 0.2s ease-out;
        }
        .chat-tracker-panel:active {
            cursor: grabbing;
        }
        .tracker-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 2px 4px;
            cursor: grab;
        }
        .tracker-content {
            padding: 4px;
            display: block;
        }
        .tracker-icon svg {
            width: 20px;
            height: 20px;
            display: block;
        }
        .tracker-toggle {
            background: none;
            border: none;
            color: inherit;
            cursor: pointer;
            padding: 0 4px;
            font-size: 12px;
        }
        .tracker-stat {
            margin-bottom: 2px;
        }
        .stat-label {
            opacity: 0.7;
            margin-right: 4px;
        }
        .edit-limit-btn {
            background: none;
            border: none;
            color: #aaa;
            cursor: pointer;
            font-size: 12px;
            margin-left: 5px;
        }
        .edit-limit-btn:hover { color: #fff; }
        
        /* Модальное окно */
        .limit-editor-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); z-index: 21000;
            display: flex; align-items: center; justify-content: center;
        }
        .limit-editor-modal {
            background: #222; padding: 20px; border-radius: 8px;
            border: 1px solid #444; color: #fff;
        }
        .limit-editor-input {
            background: #333; border: 1px solid #555; color: #fff;
            padding: 5px; margin-top: 5px; width: 100%;
        }
        .limit-editor-buttons {
            margin-top: 15px; display: flex; justify-content: flex-end; gap: 10px;
        }
        .limit-editor-btn {
            padding: 5px 10px; cursor: pointer; border-radius: 4px; border: none;
        }
        .limit-editor-save { background: #4caf50; color: white; }
        .limit-editor-cancel { background: #f44336; color: white; }
        .chat-tracker-panel.collapsed .tracker-content { display: none; }
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

if (typeof jQuery !== 'undefined') {
    jQuery(async function() {
        console.log('[ChatTracker] Script started');
        try {
            injectMobileStyles(); 
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
        } catch (error) {
            console.error('[ChatTracker] Init Error:', error);
        }
    });
} else {
    console.error('[ChatTracker] jQuery not found! Script won\'t run.');
}

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
    try {
        if (document.getElementById('chat-tracker-panel')) return;
        
        const panel = document.createElement('div');
        panel.id = 'chat-tracker-panel';
        panel.className = 'chat-tracker-panel';
        panel.style.top = '50px';
        panel.style.left = '50px';
        
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
                    <span class="stat-label">Msgs:</span>
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
                        <button class="edit-limit-btn" id="edit-limit-btn" title="Edit limit">✎</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        console.log('[ChatTracker] Panel added to DOM');

        const toggleButton = document.getElementById('tracker-toggle');
        if (toggleButton) toggleButton.addEventListener('click', togglePanel);

        const editLimitBtn = document.getElementById('edit-limit-btn');
        if (editLimitBtn) editLimitBtn.addEventListener('click', openLimitEditor);
        
        loadPosition(panel);
        makeDraggable(panel);
        
    } catch (error) {
        console.error('[ChatTracker] Error creating panel:', error);
    }
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
    }
    if (panel) {
        if(isCollapsed) panel.classList.add('collapsed');
        else panel.classList.remove('collapsed');
    }
    if (arrow) {
        arrow.textContent = isCollapsed ? '▲' : '▼';
        arrow.style.transform = isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)';
    }
    
    saveState();
}

function handlePanelClick(e) {
    const panel = document.getElementById('chat-tracker-panel');
    if (e.target.closest('button') || e.target.closest('.edit-limit-btn')) return;

    if (panel.dataset.justDragged === 'true') return;

    if (e.target.closest('.tracker-header')) {
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
            if (resetIntercepted) {
                lastInterceptedTokenCount = 0;
                setupTokenObservers();
            }
            if (delayMs > 0) {
                setTimeout(() => refreshAll(eventName), delayMs);
                return;
            }
            refreshAll(eventName);
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
        }
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
    return msg.extra?.hidden === true || msg.mes_hidden === true || msg.hidden === true || msg.is_hidden === true || msg.is_system === true;
}

function countHiddenMessages() {
    try {
        const context = SillyTavern.getContext();
        if (!context || !context.chat) return { hiddenCount: 0 };
        const chat = context.chat || [];
        let hiddenCount = 0;
        chat.forEach((msg) => {
            if (isMessageHidden(msg)) hiddenCount++;
        });
        return { hiddenCount };
    } catch (error) {
        return { hiddenCount: 0 };
    }
}

function updateHiddenCount() {
    try {
        const element = document.getElementById('stat-hidden');
        if (!element) return;
        const { hiddenCount } = countHiddenMessages();
        element.textContent = hiddenCount;
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
    } catch (e) { return null; }
}

function getTokenCountWithMethod() {
    try {
        const context = typeof SillyTavern !== 'undefined' ? SillyTavern.getContext() : null;
        if (!context || !context.chat) return { method: 'none', tokens: 0 };
        if (lastInterceptedTokenCount > 0) return { method: 'fetch', tokens: lastInterceptedTokenCount };

        const visibleMessages = context.chat
            .filter(msg => !isMessageHidden(msg)) 
            .map(msg => msg.mes || "")
            .join("\n");
        if (visibleMessages.trim().length === 0) return { method: 'empty', tokens: 0 };

        const totalChatTokens = context.getTokenCount(visibleMessages);
        if (typeof totalChatTokens === 'number' && totalChatTokens > 0) {
            return { method: 'calc', tokens: totalChatTokens };
        }
        return { method: 'unknown', tokens: 0 };
    } catch (e) {
        return { method: 'error', tokens: 0 };
    }
}

function extractTokenCountFromObject(input) {
    if (!input || typeof input !== 'object') return null;
    if (input.token_count) return input.token_count;
    if (input.total_tokens) return input.total_tokens;
    if (input.usage?.total_tokens) return input.usage.total_tokens;
    return null;
}

function updateContextDisplay(trigger = 'update') {
    const { tokens: current, method } = getTokenCountWithMethod();
    const percentage = maxTokens > 0 ? Math.round((current / maxTokens) * 100) : 0;

    const element = document.getElementById('stat-context');
    if (!element) return;

    const textDiv = element.querySelector('.context-text');
    const percentDiv = element.querySelector('.context-percent');

    if (textDiv) textDiv.textContent = `${current.toLocaleString()} / ${maxTokens.toLocaleString()}`;

    if (percentDiv) {
        percentDiv.textContent = `(${percentage}%)`;
        percentDiv.style.color = percentage >= 90 ? '#ff4444' : (percentage >= 75 ? '#ffaa44' : '#ccc');
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
        tokenUiObserver = new MutationObserver(() => updateContextDisplay('ui-mutation'));
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
    overlay.innerHTML = `
        <div class="limit-editor-modal">
            <h3>Set Token Limit</h3>
            <input type="number" id="limit-input" class="limit-editor-input" value="${maxTokens}">
            <div class="limit-editor-buttons">
                <button class="limit-editor-btn limit-editor-cancel" id="limit-cancel">Cancel</button>
                <button class="limit-editor-btn limit-editor-save" id="limit-save">Save</button>
            </div>
        </div>
    `;
    document.body.appendChild(overlay);

    const input = document.getElementById('limit-input');
    const cancelBtn = document.getElementById('limit-cancel');
    const saveBtn = document.getElementById('limit-save');
    const closeModal = () => overlay.remove();

    cancelBtn.onclick = closeModal;
    saveBtn.onclick = () => {
        const val = parseInt(input.value);
        if (!isNaN(val) && val > 0) {
            maxTokens = val;
            localStorage.setItem('chatTrackerMaxTokens', maxTokens);
            updateContextDisplay();
        }
        closeModal();
    };
}

function loadMaxTokens() {
    const saved = localStorage.getItem('chatTrackerMaxTokens');
    if (saved) maxTokens = parseInt(saved) || 50000;
}

function refreshAll(trigger = 'refresh') {
    if (contextReady) {
        updateMessageCount();
        updateHiddenCount();
    }
    updateContextDisplay(trigger);
}

function saveState() {
    localStorage.setItem('chatTracker_collapsed', isCollapsed.toString());
}

function loadState() {
    const savedState = localStorage.getItem('chatTracker_collapsed');
    isCollapsed = savedState === 'true';
    if (isCollapsed) {
        const panel = document.getElementById('chat-tracker-panel');
        const content = document.getElementById('tracker-content');
        const arrow = document.querySelector('.toggle-arrow');
        if (content) content.style.display = 'none';
        if (panel) panel.classList.add('collapsed');
        if (arrow) {
            arrow.textContent = '▲';
            arrow.style.transform = 'rotate(-90deg)';
        }
    }
    loadMaxTokens();
}

function loadPosition(element) {
    try {
        const saved = localStorage.getItem('chatTracker_pos_v2');
        if (saved) {
            const pos = JSON.parse(saved);
            const x = Math.max(0, Math.min(window.innerWidth - 100, pos.x));
            const y = Math.max(0, Math.min(window.innerHeight - 50, pos.y));
            element.style.transform = `translate(${x}px, ${y}px)`;
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
        }
    } catch(e) {}

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
        if (dist < 3) return; 

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
        setTimeout(() => { element.dataset.justDragged = 'false'; }, 100);
    };

    element.addEventListener('mousedown', (e) => onStart(e.clientX, e.clientY));
    window.addEventListener('mousemove', (e) => onMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onEnd);

    element.addEventListener('touchstart', (e) => onStart(e.touches[0].clientX, e.touches[0].clientY), { passive: false });
    window.addEventListener('touchmove', (e) => {
        if (isDragging) {
            if (e.cancelable) e.preventDefault();
            onMove(e.touches[0].clientX, e.touches[0].clientY);
        }
    }, { passive: false });
    window.addEventListener('touchend', onEnd);
}
