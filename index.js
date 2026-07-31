let isDragging = false;
let dragStartX, dragStartY;
let panelStartX, panelStartY;
let hasMoved = false;
let suppressPanelClickUntil = 0;
let responsiveHandlersReady = false;

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
let miniSunnyLibraryType = 'summary';
let miniSunnyRefreshTimers = [];
let miniSunnySyncInterval = null;
let miniSunnyBridgeBound = false;
let miniSunnyBridgeObserver = null;
let miniSunnyBridgeObserverRoot = null;
let miniSunnyQueuedRefreshTimer = null;
let miniSunnyActionWatchId = 0;
let miniSunnyFieldDirty = { summary: false, facts: false };
let miniSunnyLastBridgeSignature = '';
let miniSunnyLastLibraryRenderSignature = '';

const DEFAULT_TRACKER_CUSTOMIZATION = {
    opacity: 70,
    expandedScale: 100,
    collapsedSize: 32,
    showMessages: true,
    showHidden: true,
    showTokens: true,
};

let trackerCustomization = { ...DEFAULT_TRACKER_CUSTOMIZATION };
let savedPanelState = null;
let customizationPopupCleanup = null;

const TRACKER_I18N = {
    en: {
        settings: 'Settings',
        language: 'Language',
        transparency: 'Transparency',
        expandedInterfaceSize: 'Expanded interface size',
        iconSize: 'Icon size',
        display: 'Display',
        messageCount: 'Message count',
        hiddenMessages: 'Hidden messages',
        lastHidden: 'Last hidden',
        hiddenMessagesInChat: 'hidden messages in chat',
        noHiddenMessages: 'No hidden messages',
        tokens: 'Tokens',
        reset: 'Reset',
        done: 'Done',
        close: 'Close',
        settingsTooltip: 'Settings',
        toggleTooltip: 'Collapse / expand',
        messagesLabel: 'Messages:',
        hiddenLabel: 'Hidden:',
        tokensLabel: 'Tokens:',
        sunnyTools: 'SUNNY TOOLS',
        sunnyToggleTooltip: 'Sunny Memories tools',
        visibleChatHistory: 'Visible chat history',
        apiPromptTokens: 'API prompt tokens',
        editTokenLimit: 'Edit token limit',
        tokenLimitTitle: 'Token limit',
        tokenLimitLabel: 'Maximum tokens',
        tokenLimitHint: 'Allowed range: 0–128,000',
        cancel: 'Cancel',
        save: 'Save',
        invalidTokenLimit: 'Enter a value from 0 to 128,000.',
        sunnyRequired: 'Install or enable Sunny Memories to use this panel.',
        sunnyPanelName: 'Sunny Memories',
        summaryTitle: 'Summary',
        factsTitle: 'Facts',
        questsCalendarTitle: 'Timeline & Quests',
        libraryTitle: 'Library',
        summaryTab: 'SUMMARY',
        factsTab: 'FACTS',
        questsTab: 'QUESTS',
        libraryTab: 'LIBRARY',
        summaryPlaceholder: 'Summary…',
        factsPlaceholder: 'Facts…',
        generateSummary: 'Generate Summary',
        extractFacts: 'Extract Facts',
        restore: 'Restore',
        toLibrary: 'Move to Library (Single)',
        split: 'Smart Split & Save to Library',
        lastQuest: 'Last quest',
        lastEvent: 'Last event',
        none: 'None',
        extractQuests: 'Analyze Chat for Quests',
        extractEvents: 'Extract Events from Chat',
        libraryHint: 'No saved entries yet.',
        openFullSunny: 'Open Sunny Memories',
        librarySummaries: 'Summaries',
        libraryFacts: 'Facts',
        libraryShowing: 'Showing up to 20 entries',
        libraryEmptySummary: 'No saved summaries.',
        libraryEmptyFacts: 'No saved facts.',
        libraryUntitled: 'Untitled',
        libraryActive: 'Active',
        libraryPinned: 'Pinned',
        generateShort: 'Generate',
        extractShort: 'Extract',
        restoreShort: 'Restore',
        toLibraryShort: 'To library',
        splitShort: 'Split & save',
        sunnyControlMissing: 'Sunny Memories control was not found. Open its settings once and try again.',
        sunnyActionBusy: 'Sunny Memories is already processing another action.',
        summaryRestored: 'Summary restored locally.',
        factsRestored: 'Facts restored locally.',
        nothingToRestore: 'No previous data to restore.',
    },
    ru: {
        settings: 'Настройки',
        language: 'Язык',
        transparency: 'Прозрачность',
        expandedInterfaceSize: 'Размер развернутого интерфейса',
        iconSize: 'Размер иконки',
        display: 'Отображение',
        messageCount: 'Количество сообщений',
        hiddenMessages: 'Скрытые сообщения',
        lastHidden: 'Последнее скрытое',
        hiddenMessagesInChat: 'скрытых сообщений в чате',
        noHiddenMessages: 'Скрытых сообщений нет',
        tokens: 'Токены',
        reset: 'Сбросить',
        done: 'Готово',
        close: 'Закрыть',
        settingsTooltip: 'Настройки',
        toggleTooltip: 'Свернуть / развернуть',
        messagesLabel: 'Сообщения:',
        hiddenLabel: 'Скрытые:',
        tokensLabel: 'Токены:',
        sunnyTools: 'SUNNY TOOLS',
        sunnyToggleTooltip: 'Инструменты Sunny Memories',
        visibleChatHistory: 'Токены видимой истории чата',
        apiPromptTokens: 'Токены API-запроса',
        editTokenLimit: 'Изменить лимит токенов',
        tokenLimitTitle: 'Лимит токенов',
        tokenLimitLabel: 'Максимум токенов',
        tokenLimitHint: 'Допустимый диапазон: 0–128 000',
        cancel: 'Отмена',
        save: 'Сохранить',
        invalidTokenLimit: 'Введите значение от 0 до 128 000.',
        sunnyRequired: 'Установите или включите Sunny Memories, чтобы использовать эту панель.',
        sunnyPanelName: 'Sunny Memories',
        summaryTitle: 'Саммари',
        factsTitle: 'Факты',
        questsCalendarTitle: 'Таймлайн и Квесты',
        libraryTitle: 'Библиотека',
        summaryTab: 'САММАРИ',
        factsTab: 'ФАКТЫ',
        questsTab: 'КВЕСТЫ',
        libraryTab: 'БИБЛ.',
        summaryPlaceholder: 'Саммари…',
        factsPlaceholder: 'Факты…',
        generateSummary: 'Сгенерировать Саммари',
        extractFacts: 'Извлечь Факты',
        restore: 'Восстановить',
        toLibrary: 'Перенести в Библиотеку (Целиком)',
        split: 'Умное разделение в Библиотеку',
        lastQuest: 'Последний квест',
        lastEvent: 'Последнее событие',
        none: 'Нет',
        extractQuests: 'Анализировать чат на Квесты',
        extractEvents: 'Извлечь События из чата',
        libraryHint: 'Сохранённых записей пока нет.',
        openFullSunny: 'Открыть Sunny Memories',
        librarySummaries: 'Саммари',
        libraryFacts: 'Факты',
        libraryShowing: 'Показано до 20 записей',
        libraryEmptySummary: 'Сохранённых саммари нет.',
        libraryEmptyFacts: 'Сохранённых фактов нет.',
        libraryUntitled: 'Без названия',
        libraryActive: 'Активно',
        libraryPinned: 'Закреплено',
        generateShort: 'Создать',
        extractShort: 'Извлечь',
        restoreShort: 'Вернуть',
        toLibraryShort: 'В библиотеку',
        splitShort: 'Разделить',
        sunnyControlMissing: 'Не удалось найти элемент Sunny Memories. Один раз откройте настройки расширения и повторите действие.',
        sunnyActionBusy: 'Sunny Memories уже выполняет другое действие.',
        summaryRestored: 'Саммари восстановлено локально.',
        factsRestored: 'Факты восстановлены локально.',
        nothingToRestore: 'Предыдущих данных для восстановления нет.',
    },
};

let trackerLanguage = (() => {
    try {
        return localStorage.getItem('chatTrackerLanguage') === 'en' ? 'en' : 'ru';
    } catch (error) {
        return 'ru';
    }
})();

function getTrackerLanguage() {
    return trackerLanguage;
}

function trackerText(key) {
    return TRACKER_I18N[trackerLanguage]?.[key] ?? TRACKER_I18N.en[key] ?? key;
}

function getSunnyTabTitle(tab) {
    const titleKeys = {
        sum: 'summaryTitle',
        facts: 'factsTitle',
        qc: 'questsCalendarTitle',
        lib: 'libraryTitle',
    };
    return trackerText(titleKeys[tab] || 'summaryTitle');
}

function refreshTrackerLanguage() {
    const panel = document.getElementById('chat-tracker-panel');
    if (panel) {
        const messagesLabel = panel.querySelector('[data-tracker-stat="messages"] .stat-label');
        const hiddenLabel = panel.querySelector('[data-tracker-stat="hidden"] .stat-label');
        const tokensLabel = panel.querySelector('[data-tracker-stat="tokens"] .tokens-label-top');
        if (messagesLabel) messagesLabel.textContent = trackerText('messagesLabel');
        if (hiddenLabel) hiddenLabel.textContent = trackerText('hiddenLabel');
        if (tokensLabel) tokensLabel.textContent = trackerText('tokensLabel');

        const settingsButton = document.getElementById('tracker-settings-btn');
        if (settingsButton) {
            settingsButton.title = trackerText('settingsTooltip');
            settingsButton.setAttribute('aria-label', trackerText('settingsTooltip'));
        }
        const toggleButton = document.getElementById('tracker-toggle');
        if (toggleButton) toggleButton.title = trackerText('toggleTooltip');
        const sunnyTrigger = document.getElementById('trigger-sunny-panel');
        if (sunnyTrigger) sunnyTrigger.title = trackerText('sunnyToggleTooltip');
        const chatMode = panel.querySelector('.mode-btn[data-mode="chat"]');
        const apiMode = panel.querySelector('.mode-btn[data-mode="api"]');
        if (chatMode) chatMode.title = trackerText('visibleChatHistory');
        if (apiMode) apiMode.title = trackerText('apiPromptTokens');
        const editLimit = document.getElementById('edit-limit-btn');
        if (editLimit) editLimit.title = trackerText('editTokenLimit');
        const sunnyToolsLabel = document.getElementById('tracker-sunny-tools-label');
        if (sunnyToolsLabel) sunnyToolsLabel.textContent = trackerText('sunnyTools');
        const tabLabels = { sum: 'summaryTab', facts: 'factsTab', qc: 'questsTab', lib: 'libraryTab' };
        Object.entries(tabLabels).forEach(([tab, key]) => {
            const tabButton = panel.querySelector(`.sunny-panel-tab[data-tab="${tab}"]`);
            if (tabButton) tabButton.textContent = trackerText(key);
        });
    }

    document.getElementById('tracker-limit-popup')?.remove();

    const sunnyPopup = document.getElementById('tracker-sunny-popup');
    if (sunnyPopup) {
        const wasVisible = sunnyPopup.style.display === 'flex';
        const activeTab = document.querySelector('.sunny-panel-tab.active')?.getAttribute('data-tab') || 'sum';
        sunnyPopup.remove();
        createSunnyPopup();
        const recreated = document.getElementById('tracker-sunny-popup');
        if (recreated) {
            recreated.querySelectorAll('.sunny-tab-content').forEach(content => content.classList.remove('active'));
            recreated.querySelector(`#sunny-tab-${activeTab}`)?.classList.add('active');
            const title = recreated.querySelector('#sunny-popup-title-text');
            if (title) title.textContent = getSunnyTabTitle(activeTab);
            if (wasVisible) toggleSunnyPopup(true);
        }
    }
}

function setTrackerLanguage(language) {
    const nextLanguage = language === 'en' ? 'en' : 'ru';
    if (trackerLanguage === nextLanguage) return;
    trackerLanguage = nextLanguage;
    try {
        localStorage.setItem('chatTrackerLanguage', trackerLanguage);
    } catch (error) {}
    refreshTrackerLanguage();
}

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

function toTokenNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? Math.round(number) : 0;
}

function normalizeUsageRecord(value = {}) {
    let prompt = toTokenNumber(value.prompt);
    const completion = toTokenNumber(value.completion);
    let total = toTokenNumber(value.total);
    if (total === 0 && (prompt > 0 || completion > 0)) total = prompt + completion;
    if (total > 0 && prompt === 0) prompt = Math.max(0, total - completion);
    return {
        prompt,
        completion,
        total: Math.max(total, prompt + completion),
        source: typeof value.source === 'string' ? value.source : 'api',
        updatedAt: toTokenNumber(value.updatedAt) || Date.now(),
    };
}

function setLastUsage(usage, source = 'api', persist = true) {
    const normalized = normalizeUsageRecord({ ...usage, source, updatedAt: Date.now() });
    if (normalized.prompt <= 0 && normalized.completion <= 0 && normalized.total <= 0) return false;
    lastUsage = normalized;
    if (persist) saveApiUsage(lastUsage);
    updateContextDisplay(`usage:${source}`);
    return true;
}

function saveApiUsage(usage) {
    try {
        const chatId = getChatIdentifier();
        if (!chatId || chatId === 'default') return;
        const normalized = normalizeUsageRecord(usage);
        localStorage.setItem('chatTracker_apiUsage_' + chatId, JSON.stringify(normalized));
    } catch (e) {}
}

function loadApiUsage() {
    try {
        const chatId = getChatIdentifier();
        const saved = localStorage.getItem('chatTracker_apiUsage_' + chatId);
        lastUsage = saved
            ? normalizeUsageRecord(JSON.parse(saved))
            : { prompt: 0, completion: 0, total: 0, source: 'none', updatedAt: 0 };
    } catch (e) {
        lastUsage = { prompt: 0, completion: 0, total: 0, source: 'none', updatedAt: 0 };
    }
}

function firstTokenValue(object, keys) {
    if (!object || typeof object !== 'object') return 0;
    for (const key of keys) {
        if (Object.prototype.hasOwnProperty.call(object, key)) {
            const value = toTokenNumber(object[key]);
            if (value > 0) return value;
        }
    }
    return 0;
}

function parseUsageCandidate(object) {
    if (!object || typeof object !== 'object' || Array.isArray(object)) return null;

    const standardPrompt = firstTokenValue(object, [
        'prompt_tokens', 'promptTokens', 'prompt_token_count', 'promptTokenCount',
        'prompttokencount', 'inputTokenCount', 'input_token_count',
    ]);
    const anthropicInput = firstTokenValue(object, ['input_tokens', 'inputTokens']);
    const cacheCreation = firstTokenValue(object, ['cache_creation_input_tokens', 'cacheCreationInputTokens']);
    const cacheRead = firstTokenValue(object, ['cache_read_input_tokens', 'cacheReadInputTokens']);
    const timingsPrompt = firstTokenValue(object, ['prompt_n', 'tokens_evaluated', 'tokensEvaluated']);

    const prompt = standardPrompt || (anthropicInput + cacheCreation + cacheRead) || timingsPrompt;
    const completion = firstTokenValue(object, [
        'completion_tokens', 'completionTokens', 'completion_token_count', 'completionTokenCount',
        'output_tokens', 'outputTokens', 'candidatesTokenCount', 'predicted_n',
        'tokens_predicted', 'tokensPredicted',
    ]);
    let total = firstTokenValue(object, [
        'total_tokens', 'totalTokens', 'total_token_count', 'totalTokenCount',
        'totaltokens', 'token_count', 'tokenCount', 'tokencount',
    ]);

    if (prompt <= 0 && completion <= 0 && total <= 0) return null;
    if (total <= 0) total = prompt + completion;
    if (total > 0 && prompt <= 0 && completion > 0) total = Math.max(total, completion);

    const recognizedFields = Object.keys(object).filter(key => /token|prompt_n|predicted_n/i.test(key)).length;
    const score = (prompt > 0 ? 5 : 0) + (completion > 0 ? 3 : 0) + (total > 0 ? 4 : 0) + Math.min(3, recognizedFields);
    return { prompt, completion, total: Math.max(total, prompt + completion), score };
}

function collectUsageCandidates(value, depth = 0, seen = new Set(), output = []) {
    if (!value || typeof value !== 'object' || depth > 6 || seen.has(value)) return output;
    seen.add(value);

    const candidate = parseUsageCandidate(value);
    if (candidate) output.push(candidate);

    if (Array.isArray(value)) {
        for (const item of value.slice(0, 200)) collectUsageCandidates(item, depth + 1, seen, output);
        return output;
    }

    for (const [key, child] of Object.entries(value)) {
        if (!child || typeof child !== 'object') continue;
        if (/^(choices|candidates|data|response|result|message|delta|usage|usageMetadata|tokenUsage|token_usage|metadata|meta|metrics|timings|billed_units|tokens)$/i.test(key) || depth < 3) {
            collectUsageCandidates(child, depth + 1, seen, output);
        }
    }
    return output;
}

function extractUsage(data) {
    const candidates = collectUsageCandidates(data);
    if (!candidates.length) return null;
    candidates.sort((a, b) => b.score - a.score || b.total - a.total || b.prompt - a.prompt);
    const best = candidates[0];
    return { prompt: best.prompt, completion: best.completion, total: best.total };
}

function decodeResponsePayloads(text) {
    if (typeof text !== 'string' || !text.trim()) return [];
    const trimmed = text.trim();

    try {
        const parsed = JSON.parse(trimmed);
        return Array.isArray(parsed) ? parsed : [parsed];
    } catch (error) {}

    const payloads = [];
    const lines = trimmed.split(/\r?\n/);
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith(':') || /^event:/i.test(line) || /^id:/i.test(line) || /^retry:/i.test(line)) continue;
        const candidateText = line.replace(/^data:\s*/i, '').trim();
        if (!candidateText || candidateText === '[DONE]') continue;
        try {
            payloads.push(JSON.parse(candidateText));
        } catch (error) {}
    }
    return payloads;
}

function aggregateUsagePayloads(payloads) {
    let prompt = 0;
    let completion = 0;
    let total = 0;
    let found = false;

    for (const payload of payloads) {
        const usage = extractUsage(payload);
        if (!usage) continue;
        found = true;
        prompt = Math.max(prompt, toTokenNumber(usage.prompt));
        completion = Math.max(completion, toTokenNumber(usage.completion));
        total = Math.max(total, toTokenNumber(usage.total));
    }

    if (!found) return null;
    total = Math.max(total, prompt + completion);
    return { prompt, completion, total };
}

function getFetchUrl(input) {
    try {
        if (typeof input === 'string' || input instanceof URL) return String(input);
        if (input && typeof input.url === 'string') return input.url;
        return String(input || '');
    } catch (error) {
        return '';
    }
}

function isGenerationRequestUrl(url) {
    const value = String(url || '').toLowerCase();
    return [
        '/generate', '/chat/completions', '/completions', '/responses', '/v1/messages',
        'generatecontent', 'streamgeneratecontent', '/api/backends/',
    ].some(part => value.includes(part));
}

function getFetchCallerStack() {
    try {
        return String(new Error('Chat Tracker request origin').stack || '');
    } catch (error) {
        return '';
    }
}

function textIdentifiesExternalBlocks(value) {
    if (typeof value !== 'string') return false;
    const normalized = value.toLowerCase().replace(/\\/g, '/').replace(/%20/g, ' ');
    const compact = normalized.replace(/[\s._-]+/g, '');
    return compact.includes('extblocks') || compact.includes('externalblocks');
}

function requestBodyDeclaresExternalBlocks(body) {
    if (!body || typeof body !== 'object') return false;

    const candidates = [
        body.source,
        body.request_source,
        body.requestSource,
        body.extension,
        body.extension_name,
        body.extensionName,
        body.metadata?.source,
        body.metadata?.extension,
        body.meta?.source,
        body.meta?.extension,
    ];

    return candidates.some(textIdentifiesExternalBlocks)
        || body.chat_tracker_ignore === true
        || body.chatTrackerIgnore === true
        || body.metadata?.chat_tracker_ignore === true
        || body.metadata?.chatTrackerIgnore === true;
}

function isExternalBlocksRequestOrigin(stack, body = null) {
    const normalizedStack = String(stack || '').toLowerCase().replace(/\\/g, '/');

    // Covers ExtBlocks, External Blocks and common fork/folder spellings in Chromium and Safari stacks.
    const hasExternalBlocksPath = [
        '/extblocks/', '/ext-blocks/', '/ext_blocks/',
        '/externalblocks/', '/external-blocks/', '/external_blocks/',
        'ext-blocks-custom', 'extblocks-custom',
    ].some(marker => normalizedStack.includes(marker));

    // Source maps or bundled builds may omit the extension folder but keep these function names.
    const hasGenerateBlocksFunction = /(?:^|[\s.@])generateblocks(?:[\s(@]|$)/i.test(normalizedStack);
    const hasExternalBlocksCallChain = /generateblockcontent|generaterewrite|generatedplugin|rewriteplugin|blockservice|exttopic/i.test(normalizedStack);

    return hasExternalBlocksPath
        || (hasGenerateBlocksFunction && hasExternalBlocksCallChain)
        || requestBodyDeclaresExternalBlocks(body);
}

async function readRequestBody(input, options) {
    try {
        const directBody = options?.body;
        if (directBody !== undefined && directBody !== null) {
            if (typeof directBody === 'string') {
                try { return JSON.parse(directBody); } catch (error) { return directBody; }
            }
            if (typeof URLSearchParams !== 'undefined' && directBody instanceof URLSearchParams) {
                return Object.fromEntries(directBody.entries());
            }
            if (typeof directBody === 'object' && !(directBody instanceof ArrayBuffer)) return directBody;
        }

        if (input && typeof input.clone === 'function') {
            const clone = input.clone();
            const text = await clone.text();
            if (!text) return null;
            try { return JSON.parse(text); } catch (error) { return text; }
        }
    } catch (error) {}
    return null;
}

function collectTextFragments(value, depth = 0, output = []) {
    if (depth > 8 || value === null || value === undefined) return output;
    if (typeof value === 'string') {
        if (value.trim()) output.push(value);
        return output;
    }
    if (Array.isArray(value)) {
        for (const item of value) collectTextFragments(item, depth + 1, output);
        return output;
    }
    if (typeof value !== 'object') return output;

    const preferredKeys = ['content', 'text', 'input_text', 'output_text', 'prompt', 'parts', 'message', 'messages', 'contents', 'input', 'system', 'system_instruction'];
    let usedPreferredKey = false;
    for (const key of preferredKeys) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
            usedPreferredKey = true;
            collectTextFragments(value[key], depth + 1, output);
        }
    }
    if (!usedPreferredKey && typeof value.value === 'string') collectTextFragments(value.value, depth + 1, output);
    return output;
}

function estimatePromptUsage(body) {
    try {
        if (!body || typeof SillyTavern === 'undefined') return null;
        const context = SillyTavern.getContext();
        if (!context || typeof context.getTokenCount !== 'function') return null;

        const roots = typeof body === 'object'
            ? [body.messages, body.prompt, body.input, body.contents, body.system, body.system_instruction].filter(value => value !== undefined)
            : [body];
        const fragments = [];
        for (const root of roots) collectTextFragments(root, 0, fragments);
        const promptText = fragments.join('\n');
        if (!promptText.trim()) return null;
        const prompt = toTokenNumber(context.getTokenCount(promptText));
        return prompt > 0 ? { prompt, completion: 0, total: prompt } : null;
    } catch (error) {
        return null;
    }
}

async function handleFetchResponse(response, urlString) {
    try {
        const clone = response.clone();
        if (!clone) return;
        const text = await clone.text();
        const payloads = decodeResponsePayloads(text);
        const usage = aggregateUsagePayloads(payloads);
        if (usage) {
            debugLog('API usage', urlString, usage);
            setLastUsage(usage, 'api', true);
        } else {
            debugLog('No API usage fields in response', urlString);
        }
    } catch (e) {
        debugLog('fetch:response handler error', e.message);
    }
}

const CHAT_TRACKER_FETCH_FLAG = '__chatTrackerFetchWrappedV5';
const originalFetch = typeof window.fetch === 'function' ? window.fetch.bind(window) : null;

if (originalFetch && !window[CHAT_TRACKER_FETCH_FLAG]) {
    window[CHAT_TRACKER_FETCH_FLAG] = true;
    window.fetch = async (...args) => {
        const [input, options] = args;
        const urlString = getFetchUrl(input);
        const isGenerateRequest = isGenerationRequestUrl(urlString);
        const callerStack = isGenerateRequest ? getFetchCallerStack() : '';
        const requestBody = isGenerateRequest ? await readRequestBody(input, options) : null;
        const isExternalBlocksRequest = isGenerateRequest && isExternalBlocksRequestOrigin(callerStack, requestBody);

        if (isGenerateRequest && !isExternalBlocksRequest) {
            const estimate = estimatePromptUsage(requestBody);
            if (estimate) setLastUsage(estimate, 'estimate', true);
        } else if (isExternalBlocksRequest) {
            debugLog('Ignored External Blocks token request', urlString);
        }

        let response;
        try {
            response = await originalFetch(...args);
        } catch (error) {
            debugLog('fetch error', error.message);
            throw error;
        }

        if (isGenerateRequest && !isExternalBlocksRequest && response?.ok) {
            handleFetchResponse(response, urlString).catch(error =>
                debugLog('fetch:response async error', error.message)
            );
        }
        return response;
    };
}

jQuery(async function() {
    try {
        loadState();
        createTrackerPanel();
        applySavedPanelState();
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

function getViewportBounds() {
    const doc = document.documentElement;
    // Fixed-position elements are laid out against the layout viewport. Using
    // visualViewport here makes the saved position jump when the mobile URL bar,
    // keyboard, or pinch zoom changes the visual viewport only.
    const width = Math.max(1, Math.round(doc?.clientWidth || window.innerWidth || 1));
    const height = Math.max(1, Math.round(doc?.clientHeight || window.innerHeight || 1));
    return { width, height };
}

function isCompactMobileLayout() {
    try {
        return window.matchMedia('(max-width: 700px), (max-width: 1024px) and (pointer: coarse)').matches;
    } catch (error) {
        return getViewportBounds().width <= 700;
    }
}

function clampElementToViewport(el, preferredAnchor = null) {
    if (!el?.isConnected) return;
    const margin = isCompactMobileLayout() ? 8 : 4;
    const viewport = getViewportBounds();
    const rect = el.getBoundingClientRect();
    const maxTop = Math.max(margin, viewport.height - rect.height - margin);
    const top = clampNumber(parseFloat(el.style.top), margin, maxTop, clampNumber(rect.top, margin, maxTop, margin));
    el.style.top = `${top}px`;
    el.style.bottom = 'auto';

    const hasRightAnchor = preferredAnchor === 'right'
        || (preferredAnchor !== 'left' && el.style.right && el.style.right !== 'auto');

    if (hasRightAnchor) {
        const measuredRight = Math.max(margin, viewport.width - rect.right);
        const right = clampNumber(parseFloat(el.style.right), margin, Math.max(margin, viewport.width - Math.min(rect.width, viewport.width) - margin), measuredRight);
        el.style.right = `${right}px`;
        el.style.left = 'auto';
    } else {
        const maxLeft = Math.max(margin, viewport.width - rect.width - margin);
        const left = clampNumber(parseFloat(el.style.left), margin, maxLeft, clampNumber(rect.left, margin, maxLeft, margin));
        el.style.left = `${left}px`;
        el.style.right = 'auto';
    }
}

function anchorElementToNearestSide(el) {
    if (!el?.isConnected) return 'left';
    const viewport = getViewportBounds();
    const rect = el.getBoundingClientRect();
    const margin = isCompactMobileLayout() ? 8 : 4;
    const isRightSide = rect.left + rect.width / 2 > viewport.width / 2;

    if (isRightSide) {
        const right = Math.max(margin, viewport.width - rect.right);
        el.style.left = 'auto';
        el.style.right = `${right}px`;
        return 'right';
    }

    el.style.right = 'auto';
    el.style.left = `${Math.max(margin, rect.left)}px`;
    return 'left';
}

function setupDraggable(el, handle) {
    const dragHandle = handle || el;
    if (!dragHandle || dragHandle.dataset.trackerDraggableReady === 'true') return;
    dragHandle.dataset.trackerDraggableReady = 'true';

    const state = {
        active: false,
        moved: false,
        pointerId: null,
        startX: 0,
        startY: 0,
        startLeft: 0,
        startTop: 0,
        width: 0,
        height: 0,
    };

    const interactiveSelector = 'button, input, textarea, select, a, label, .tracker-popup-close, .edit-limit-btn, .sunny-panel-tab, .mode-btn';

    const getTargetElement = (event) => {
        const target = event?.target;
        return target && typeof target.closest === 'function' ? target : null;
    };

    const beginDrag = (clientX, clientY, pointerId, event) => {
        const target = getTargetElement(event);
        if (target?.closest(interactiveSelector)) return false;

        const rect = el.getBoundingClientRect();
        state.active = true;
        state.moved = false;
        state.pointerId = pointerId;
        state.startX = clientX;
        state.startY = clientY;
        state.startLeft = rect.left;
        state.startTop = rect.top;
        state.width = rect.width;
        state.height = rect.height;
        isDragging = true;
        hasMoved = false;
        return true;
    };

    const moveDrag = (clientX, clientY, event) => {
        if (!state.active) return;
        const dx = clientX - state.startX;
        const dy = clientY - state.startY;

        if (!state.moved && Math.hypot(dx, dy) < 7) return;
        if (!state.moved) {
            state.moved = true;
            hasMoved = true;
            el.classList.add('dragging');
        }

        if (event?.cancelable) event.preventDefault();
        const viewport = getViewportBounds();
        const margin = isCompactMobileLayout() ? 8 : 4;
        const maxLeft = Math.max(margin, viewport.width - state.width - margin);
        const maxTop = Math.max(margin, viewport.height - state.height - margin);
        const left = Math.max(margin, Math.min(maxLeft, state.startLeft + dx));
        const top = Math.max(margin, Math.min(maxTop, state.startTop + dy));

        el.style.left = `${left}px`;
        el.style.top = `${top}px`;
        el.style.right = 'auto';
        el.style.bottom = 'auto';
    };

    const finishDrag = (event) => {
        if (!state.active) return;
        state.active = false;
        isDragging = false;

        try {
            if (state.pointerId !== null && dragHandle.hasPointerCapture?.(state.pointerId)) {
                dragHandle.releasePointerCapture(state.pointerId);
            }
        } catch (error) {}

        el.classList.remove('dragging');

        // Mobile browsers may emit pointercancel when system UI interrupts a touch.
        // Keep the last visible position instead of throwing the drag away.
        if (state.moved) {
            const anchor = anchorElementToNearestSide(el);
            clampElementToViewport(el, anchor);

            if (el.id === 'chat-tracker-panel') {
                suppressPanelClickUntil = Date.now() + 350;
                saveState();
            } else {
                el.dataset.userPositioned = 'true';
            }
            if (event?.cancelable) event.preventDefault();
        }

        state.pointerId = null;
        state.moved = false;
        setTimeout(() => { hasMoved = false; }, 360);
    };

    if ('PointerEvent' in window) {
        const onPointerDown = (event) => {
            if (event.pointerType === 'mouse' && event.button !== 0) return;
            if (!beginDrag(event.clientX, event.clientY, event.pointerId, event)) return;
            try { dragHandle.setPointerCapture?.(event.pointerId); } catch (error) {}
        };

        const onPointerMove = (event) => {
            if (!state.active || event.pointerId !== state.pointerId) return;
            moveDrag(event.clientX, event.clientY, event);
        };

        dragHandle.addEventListener('pointerdown', onPointerDown);
        dragHandle.addEventListener('pointermove', onPointerMove, { passive: false });
        dragHandle.addEventListener('pointerup', finishDrag);
        dragHandle.addEventListener('pointercancel', finishDrag);
        dragHandle.addEventListener('lostpointercapture', finishDrag);
        return;
    }

    // Fallback for older iOS/WebViews without Pointer Events.
    let activeTouchId = null;

    const findTouch = (touchList) => {
        if (!touchList) return null;
        for (const touch of Array.from(touchList)) {
            if (activeTouchId === null || touch.identifier === activeTouchId) return touch;
        }
        return null;
    };

    const onTouchStart = (event) => {
        if (state.active || event.touches?.length !== 1) return;
        const touch = event.touches[0];
        activeTouchId = touch.identifier;
        if (!beginDrag(touch.clientX, touch.clientY, activeTouchId, event)) activeTouchId = null;
    };
    const onTouchMove = (event) => {
        const touch = findTouch(event.touches);
        if (!state.active || !touch) return;
        moveDrag(touch.clientX, touch.clientY, event);
    };
    const onTouchEnd = (event) => {
        if (!state.active) return;
        const remaining = findTouch(event.touches);
        if (remaining) return;
        finishDrag(event);
        activeTouchId = null;
    };

    let mouseActive = false;
    const onMouseMove = (event) => {
        if (!mouseActive || !state.active) return;
        moveDrag(event.clientX, event.clientY, event);
    };
    const onMouseUp = (event) => {
        if (!mouseActive) return;
        mouseActive = false;
        finishDrag(event);
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
    };
    const onMouseDown = (event) => {
        if (event.button !== 0) return;
        if (!beginDrag(event.clientX, event.clientY, 'mouse', event)) return;
        mouseActive = true;
        document.addEventListener('mousemove', onMouseMove, { passive: false });
        document.addEventListener('mouseup', onMouseUp);
    };

    dragHandle.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd, { passive: false });
    document.addEventListener('touchcancel', onTouchEnd, { passive: false });
    dragHandle.addEventListener('mousedown', onMouseDown);
}

function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.min(max, Math.max(min, number));
}

function normalizeTrackerCustomization(value = {}) {
    const rawExpandedScale = Number.isFinite(Number(value.expandedScale))
        ? Number(value.expandedScale)
        : (Number.isFinite(Number(value.expandedWidth))
            ? Math.round((Number(value.expandedWidth) / 180) * 100)
            : DEFAULT_TRACKER_CUSTOMIZATION.expandedScale);

    const rawCollapsedSize = Number.isFinite(Number(value.collapsedSize))
        ? Number(value.collapsedSize)
        : (Number.isFinite(Number(value.collapsedIconSize))
            ? Math.max(32, Math.round(Number(value.collapsedIconSize) + 12))
            : DEFAULT_TRACKER_CUSTOMIZATION.collapsedSize);

    return {
        opacity: clampNumber(value.opacity, 20, 100, DEFAULT_TRACKER_CUSTOMIZATION.opacity),
        expandedScale: clampNumber(rawExpandedScale, 80, 180, DEFAULT_TRACKER_CUSTOMIZATION.expandedScale),
        collapsedSize: clampNumber(rawCollapsedSize, 32, 72, DEFAULT_TRACKER_CUSTOMIZATION.collapsedSize),
        showMessages: value.showMessages !== false,
        showHidden: value.showHidden !== false,
        showTokens: value.showTokens !== false,
    };
}

function loadTrackerCustomization() {
    try {
        const saved = localStorage.getItem('chatTrackerCustomization');
        trackerCustomization = normalizeTrackerCustomization(saved ? JSON.parse(saved) : {});
    } catch (error) {
        trackerCustomization = { ...DEFAULT_TRACKER_CUSTOMIZATION };
    }
}

function saveTrackerCustomization() {
    try {
        localStorage.setItem('chatTrackerCustomization', JSON.stringify(trackerCustomization));
    } catch (error) {}
}

function getCollapsedBoxSize() {
    return Math.round(trackerCustomization.collapsedSize);
}

function getCollapsedIconSize() {
    return Math.max(18, Math.round(getCollapsedBoxSize() * 0.62));
}

function getExpandedScaleFactor() {
    return trackerCustomization.expandedScale / 100;
}

function ensureCustomizationStyles() {
    if (document.getElementById('chat-tracker-customization-styles')) return;

    const style = document.createElement('style');
    style.id = 'chat-tracker-customization-styles';
    style.textContent = `
        .chat-tracker-panel {
            --tracker-scale: 1;
            --tracker-expanded-width: 180px;
            --tracker-collapsed-box-size: 32px;
            --tracker-collapsed-icon-size: 20px;
            --tracker-panel-bg-dark: rgba(0, 0, 0, 0.32);
            --tracker-panel-bg-light: rgba(255, 255, 255, 0.28);
            --tracker-panel-border-dark: rgba(255, 255, 255, 0.12);
            --tracker-panel-border-light: rgba(0, 0, 0, 0.12);
            --tracker-panel-shadow: 0 4px 12px rgba(0, 0, 0, 0.45);
            --tracker-panel-blur: 10px;
            --tracker-stat-bg-dark: rgba(0, 0, 0, 0.28);
            --tracker-stat-bg-light: rgba(255, 255, 255, 0.24);
            --tracker-button-bg-dark: rgba(255, 255, 255, 0.05);
            --tracker-button-bg-light: rgba(0, 0, 0, 0.05);
            --tracker-button-hover-dark: rgba(255, 255, 255, 0.12);
            --tracker-button-hover-light: rgba(0, 0, 0, 0.10);
            background: var(--tracker-panel-bg-dark) !important;
            backdrop-filter: blur(var(--tracker-panel-blur)) !important;
            -webkit-backdrop-filter: blur(var(--tracker-panel-blur)) !important;
            border: 1px solid var(--tracker-panel-border-dark) !important;
            box-shadow: var(--tracker-panel-shadow) !important;
            border-radius: calc(8px * var(--tracker-scale)) !important;
            width: var(--tracker-expanded-width) !important;
            min-width: var(--tracker-expanded-width) !important;
            padding: calc(6px * var(--tracker-scale)) !important;
        }
        body.light-theme .chat-tracker-panel {
            background: var(--tracker-panel-bg-light) !important;
            border-color: var(--tracker-panel-border-light) !important;
        }
        .chat-tracker-panel:not(.collapsed) {
            width: var(--tracker-expanded-width) !important;
            min-width: var(--tracker-expanded-width) !important;
        }
        .chat-tracker-panel.collapsed {
            width: var(--tracker-collapsed-box-size) !important;
            height: var(--tracker-collapsed-box-size) !important;
            min-width: 0 !important;
            padding: 0 !important;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            opacity: 1 !important;
        }
        .chat-tracker-panel.collapsed:hover {
            transform: scale(1.03);
        }
        .chat-tracker-panel.dragging {
            opacity: 1 !important;
        }
        .chat-tracker-panel .tracker-header {
            margin-bottom: calc(4px * var(--tracker-scale)) !important;
            min-height: calc(28px * var(--tracker-scale));
        }
        .chat-tracker-panel.collapsed .tracker-header {
            margin-bottom: 0 !important;
        }
        .chat-tracker-panel .tracker-icon {
            width: calc(20px * var(--tracker-scale)) !important;
            height: calc(20px * var(--tracker-scale)) !important;
            flex: 0 0 auto;
        }
        .chat-tracker-panel.collapsed .tracker-icon {
            width: var(--tracker-collapsed-icon-size) !important;
            height: var(--tracker-collapsed-icon-size) !important;
        }
        .tracker-header-actions {
            display: flex;
            align-items: center;
            gap: calc(6px * var(--tracker-scale));
            flex: 0 0 auto;
        }
        .collapsed .tracker-header-actions {
            display: none;
        }
        .tracker-settings-btn,
        .tracker-toggle {
            background: var(--tracker-button-bg-dark);
            border: none;
            color: inherit;
            cursor: pointer;
            width: calc(28px * var(--tracker-scale));
            height: calc(28px * var(--tracker-scale));
            min-width: calc(28px * var(--tracker-scale));
            padding: calc(4px * var(--tracker-scale));
            border-radius: calc(6px * var(--tracker-scale));
            display: flex;
            align-items: center;
            justify-content: center;
            opacity: 0.92;
            transition: background-color 0.2s ease, opacity 0.2s ease, transform 0.2s ease;
        }
        body.light-theme .tracker-settings-btn,
        body.light-theme .tracker-toggle {
            background: var(--tracker-button-bg-light);
        }
        .tracker-settings-btn svg {
            width: 100%;
            height: 100%;
            display: block;
        }
        .tracker-settings-btn:hover,
        .tracker-settings-btn[aria-expanded="true"],
        .tracker-toggle:hover {
            opacity: 1;
            background-color: var(--tracker-button-hover-dark);
            transform: none;
        }
        body.light-theme .tracker-settings-btn:hover,
        body.light-theme .tracker-settings-btn[aria-expanded="true"],
        body.light-theme .tracker-toggle:hover {
            background-color: var(--tracker-button-hover-light);
        }
        .toggle-arrow {
            font-size: calc(11px * var(--tracker-scale));
        }
        .chat-tracker-panel .tracker-content {
            max-height: calc(280px * var(--tracker-scale));
        }
        .chat-tracker-panel .tracker-stat {
            margin-bottom: calc(4px * var(--tracker-scale));
            padding: calc(5px * var(--tracker-scale)) calc(8px * var(--tracker-scale));
            border-radius: calc(6px * var(--tracker-scale));
            min-height: calc(22px * var(--tracker-scale));
            background-color: var(--tracker-stat-bg-dark) !important;
        }
        body.light-theme .chat-tracker-panel .tracker-stat {
            background-color: var(--tracker-stat-bg-light) !important;
        }
        .chat-tracker-panel .tokens-vertical-block {
            min-height: calc(50px * var(--tracker-scale)) !important;
            padding: calc(4px * var(--tracker-scale)) calc(6px * var(--tracker-scale)) calc(6px * var(--tracker-scale)) !important;
            gap: calc(2px * var(--tracker-scale)) !important;
        }
        .chat-tracker-panel .stat-value,
        .chat-tracker-panel .tokens-numbers-mid {
            font-size: calc(11px * var(--tracker-scale)) !important;
        }
        .chat-tracker-panel .stat-label,
        .chat-tracker-panel .tokens-label-top {
            font-size: calc(10px * var(--tracker-scale)) !important;
        }
        .chat-tracker-panel .mode-buttons-container {
            gap: calc(4px * var(--tracker-scale));
            margin-top: calc(4px * var(--tracker-scale));
        }
        .chat-tracker-panel .mode-btn {
            font-size: calc(9px * var(--tracker-scale));
            border-radius: calc(4px * var(--tracker-scale));
            padding: calc(3px * var(--tracker-scale)) 0;
        }
        .chat-tracker-panel .edit-limit-btn {
            font-size: calc(14px * var(--tracker-scale)) !important;
            padding: calc(2px * var(--tracker-scale)) calc(6px * var(--tracker-scale)) !important;
        }
        .chat-tracker-panel .tracker-btn-create {
            margin-left: calc(6px * var(--tracker-scale));
            font-size: calc(13px * var(--tracker-scale));
        }
        .tracker-customization-popup {
            width: 290px;
        }
        .tracker-customization-body {
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        }
        .tracker-setting-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 58px;
            align-items: center;
            gap: 8px;
        }
        .tracker-setting-row label,
        .tracker-setting-title {
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.2px;
            color: var(--SmartThemeEmColor, #fff);
        }
        .tracker-setting-control {
            grid-column: 1 / -1;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .tracker-setting-control input[type="range"] {
            flex: 1;
            min-width: 0;
            accent-color: var(--SmartThemeQuoteColor, #ffaa00);
        }
        .tracker-setting-value {
            min-width: 50px;
            text-align: right;
            font-size: 10px;
            opacity: 0.8;
        }
        .tracker-display-options {
            display: grid;
            gap: 7px;
            padding: 9px;
            background: rgba(0, 0, 0, 0.2);
            border-radius: 7px;
            border: 1px solid rgba(255, 255, 255, 0.07);
        }
        body.light-theme .tracker-display-options {
            background: rgba(0, 0, 0, 0.05);
            border-color: rgba(0, 0, 0, 0.08);
        }
        .tracker-check-label {
            display: flex;
            align-items: center;
            gap: 8px;
            cursor: pointer;
            font-size: 11px;
        }
        .tracker-check-label input {
            accent-color: var(--SmartThemeQuoteColor, #ffaa00);
        }
        .tracker-settings-actions {
            display: flex;
            gap: 8px;
        }
        .tracker-settings-action {
            flex: 1;
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.06);
            color: inherit;
            cursor: pointer;
            padding: 7px 8px;
            font-size: 10px;
            font-weight: 700;
        }
        .tracker-settings-action:hover {
            background: rgba(255, 255, 255, 0.12);
        }
        body.light-theme .tracker-settings-action {
            border-color: rgba(0, 0, 0, 0.12);
            background: rgba(0, 0, 0, 0.04);
        }
        body.light-theme .tracker-settings-action:hover {
            background: rgba(0, 0, 0, 0.1);
        }
        @media (max-width: 700px), (max-width: 1024px) and (pointer: coarse) {
            .chat-tracker-panel {
                max-width: calc(100vw - 16px) !important;
                max-height: calc(100dvh - 16px);
                touch-action: auto !important;
            }
            .chat-tracker-panel .tracker-header,
            .chat-tracker-panel.collapsed {
                touch-action: none !important;
            }
            .chat-tracker-panel:not(.collapsed) .tracker-content {
                max-height: calc(100dvh - 76px) !important;
                overflow-y: auto;
                overscroll-behavior: contain;
                touch-action: pan-y !important;
                scrollbar-width: thin;
            }
            .tracker-settings-btn,
            .tracker-toggle {
                width: max(38px, calc(28px * var(--tracker-scale))) !important;
                height: max(38px, calc(28px * var(--tracker-scale))) !important;
                min-width: 38px !important;
                min-height: 38px !important;
                padding: max(7px, calc(4px * var(--tracker-scale))) !important;
                border-radius: 9px !important;
            }
            .tracker-header-actions {
                gap: 6px !important;
                position: relative;
                z-index: 4;
            }
            .tracker-settings-btn,
            .tracker-toggle,
            .edit-limit-btn {
                pointer-events: auto !important;
                touch-action: manipulation !important;
                -webkit-tap-highlight-color: transparent;
                position: relative;
                z-index: 5;
            }
            .tracker-popup {
                max-width: calc(100vw - 16px) !important;
                max-height: calc(100dvh - 16px) !important;
            }
            .tracker-customization-popup {
                position: fixed !important;
                z-index: 2147483000 !important;
                pointer-events: auto !important;
                touch-action: pan-y !important;
                left: max(8px, env(safe-area-inset-left)) !important;
                right: max(8px, env(safe-area-inset-right)) !important;
                top: auto !important;
                bottom: max(8px, env(safe-area-inset-bottom)) !important;
                width: auto !important;
                max-height: calc(100dvh - 16px - env(safe-area-inset-bottom)) !important;
                border-radius: 14px !important;
                overflow: hidden auto;
            }
            #tracker-limit-popup,
            .beautiful-popup {
                position: fixed !important;
                left: max(8px, env(safe-area-inset-left)) !important;
                right: max(8px, env(safe-area-inset-right)) !important;
                top: auto !important;
                bottom: max(8px, env(safe-area-inset-bottom)) !important;
                width: auto !important;
                max-height: calc(100dvh - 16px - env(safe-area-inset-bottom)) !important;
                border-radius: 14px !important;
            }
            .beautiful-popup .tracker-popup-body,
            #tracker-limit-popup .tracker-popup-body {
                overflow-y: auto;
                overscroll-behavior: contain;
            }
            .tracker-customization-popup .tracker-popup-header {
                min-height: 48px;
                padding: 10px 14px;
                touch-action: auto !important;
            }
            .tracker-customization-popup .tracker-popup-close {
                width: 38px;
                height: 38px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 26px;
                margin: -6px -8px -6px 0;
            }
            .tracker-customization-body {
                padding: 14px;
                gap: 14px;
            }
            .tracker-setting-row label,
            .tracker-setting-title,
            .tracker-check-label {
                font-size: 13px;
            }
            .tracker-setting-control input[type="range"] {
                min-height: 34px;
            }
            .tracker-setting-control input[type="range"]::-webkit-slider-thumb {
                width: 24px;
                height: 24px;
            }
            .tracker-setting-control input[type="range"]::-moz-range-thumb {
                width: 24px;
                height: 24px;
            }
            .tracker-check-label {
                min-height: 40px;
            }
            .tracker-check-label input {
                width: 20px;
                height: 20px;
            }
            .tracker-settings-action {
                min-height: 46px;
                font-size: 12px;
            }
        }

        /* Unified glass dialogs: settings, token limit and Sunny Memories. */
        .tracker-popup {
            --tracker-dialog-accent: var(--SmartThemeQuoteColor, #68b9ef);
            --tracker-dialog-text: var(--SmartThemeEmColor, #f4f6f8);
            --tracker-dialog-muted: rgba(235, 241, 247, 0.62);
            color: var(--tracker-dialog-text) !important;
            background:
                radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--tracker-dialog-accent) 13%, transparent), transparent 42%),
                linear-gradient(155deg, rgba(31, 34, 42, 0.96), rgba(19, 21, 27, 0.94)) !important;
            border: 1px solid rgba(255, 255, 255, 0.12) !important;
            border-radius: 16px !important;
            box-shadow: 0 18px 55px rgba(0, 0, 0, 0.52), inset 0 1px 0 rgba(255, 255, 255, 0.05) !important;
            backdrop-filter: blur(22px) saturate(1.12) !important;
            -webkit-backdrop-filter: blur(22px) saturate(1.12) !important;
            overflow: hidden;
        }
        body.light-theme .tracker-popup {
            --tracker-dialog-text: #20232a;
            --tracker-dialog-muted: rgba(32, 35, 42, 0.62);
            background:
                radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--tracker-dialog-accent) 12%, transparent), transparent 42%),
                linear-gradient(155deg, rgba(255, 255, 255, 0.97), rgba(239, 242, 247, 0.96)) !important;
            border-color: rgba(0, 0, 0, 0.10) !important;
            box-shadow: 0 18px 48px rgba(20, 28, 40, 0.20), inset 0 1px 0 rgba(255, 255, 255, 0.75) !important;
        }
        .tracker-popup-header {
            min-height: 50px;
            box-sizing: border-box;
            padding: 10px 12px 10px 16px !important;
            background: rgba(255, 255, 255, 0.035) !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.075) !important;
            color: var(--tracker-dialog-text) !important;
            font-size: 13px !important;
            letter-spacing: 0.2px !important;
            text-transform: none !important;
        }
        body.light-theme .tracker-popup-header {
            background: rgba(255, 255, 255, 0.48) !important;
            border-bottom-color: rgba(0, 0, 0, 0.075) !important;
        }
        .tracker-popup-heading,
        .beautiful-title {
            display: flex;
            align-items: center;
            gap: 9px;
            min-width: 0;
            color: var(--tracker-dialog-text) !important;
            font-size: 13px !important;
            font-weight: 750 !important;
            letter-spacing: 0.2px !important;
            text-shadow: none !important;
        }
        .tracker-popup-heading i,
        .beautiful-title i {
            color: var(--tracker-dialog-accent) !important;
            margin: 0 !important;
            filter: drop-shadow(0 0 7px color-mix(in srgb, var(--tracker-dialog-accent) 45%, transparent));
        }
        .tracker-popup-close {
            width: 32px;
            height: 32px;
            flex: 0 0 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 10px;
            color: var(--tracker-dialog-muted) !important;
            background: rgba(255, 255, 255, 0.045);
            font-size: 21px !important;
            font-weight: 400;
            opacity: 1 !important;
            transition: background-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
        }
        .tracker-popup-close:hover {
            color: #fff !important;
            background: rgba(255, 90, 90, 0.72);
            transform: scale(1.04);
        }
        body.light-theme .tracker-popup-close {
            background: rgba(0, 0, 0, 0.045);
        }
        .tracker-customization-popup {
            width: 320px;
        }
        .tracker-customization-body {
            padding: 14px !important;
            gap: 10px !important;
        }
        .tracker-setting-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 10px;
            padding: 12px;
            border: 1px solid rgba(255, 255, 255, 0.075);
            border-radius: 12px;
            background: rgba(0, 0, 0, 0.16);
        }
        body.light-theme .tracker-setting-row {
            border-color: rgba(0, 0, 0, 0.07);
            background: rgba(255, 255, 255, 0.52);
        }
        .tracker-setting-row label,
        .tracker-setting-title {
            color: var(--tracker-dialog-text) !important;
            font-size: 12px !important;
            font-weight: 680 !important;
            letter-spacing: 0 !important;
            text-transform: none !important;
        }
        .tracker-setting-value {
            min-width: 48px;
            padding: 3px 7px;
            border-radius: 7px;
            background: color-mix(in srgb, var(--tracker-dialog-accent) 14%, transparent);
            color: var(--tracker-dialog-text);
            font-size: 11px !important;
            font-variant-numeric: tabular-nums;
            opacity: 0.92 !important;
        }
        .tracker-setting-control {
            grid-column: 1 / -1;
        }
        .tracker-setting-control input[type="range"] {
            --range-progress: 50%;
            appearance: none;
            -webkit-appearance: none;
            width: 100%;
            height: 6px;
            min-height: 24px;
            padding: 9px 0;
            box-sizing: content-box;
            outline: none;
            background: linear-gradient(90deg,
                var(--tracker-dialog-accent) 0 var(--range-progress),
                rgba(255, 255, 255, 0.14) var(--range-progress) 100%) content-box;
            border-radius: 999px;
            cursor: pointer;
        }
        body.light-theme .tracker-setting-control input[type="range"] {
            background: linear-gradient(90deg,
                var(--tracker-dialog-accent) 0 var(--range-progress),
                rgba(0, 0, 0, 0.14) var(--range-progress) 100%) content-box;
        }
        .tracker-setting-control input[type="range"]::-webkit-slider-thumb {
            appearance: none;
            -webkit-appearance: none;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(22, 25, 31, 0.92);
            border-radius: 50%;
            background: var(--tracker-dialog-accent);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.42), 0 0 0 1px rgba(255, 255, 255, 0.22);
        }
        .tracker-setting-control input[type="range"]::-moz-range-thumb {
            width: 15px;
            height: 15px;
            border: 3px solid rgba(22, 25, 31, 0.92);
            border-radius: 50%;
            background: var(--tracker-dialog-accent);
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.42), 0 0 0 1px rgba(255, 255, 255, 0.22);
        }
        .tracker-display-section {
            margin-top: 2px;
        }
        .tracker-setting-title {
            margin: 0 0 8px 2px !important;
            color: var(--tracker-dialog-muted) !important;
            font-size: 10px !important;
            font-weight: 760 !important;
            letter-spacing: 0.7px !important;
            text-transform: uppercase !important;
        }
        .tracker-display-options {
            gap: 6px !important;
            padding: 6px !important;
            border-radius: 12px !important;
            background: rgba(0, 0, 0, 0.16) !important;
        }
        body.light-theme .tracker-display-options {
            background: rgba(255, 255, 255, 0.50) !important;
        }
        .tracker-check-label {
            min-height: 38px;
            box-sizing: border-box;
            padding: 8px 10px;
            border-radius: 9px;
            color: var(--tracker-dialog-text);
            font-size: 12px !important;
            transition: background-color 0.18s ease;
        }
        .tracker-check-label:hover {
            background: rgba(255, 255, 255, 0.06);
        }
        body.light-theme .tracker-check-label:hover {
            background: rgba(0, 0, 0, 0.045);
        }
        .tracker-check-label input {
            width: 18px;
            height: 18px;
            flex: 0 0 18px;
            accent-color: var(--tracker-dialog-accent) !important;
        }
        .tracker-settings-actions,
        .tracker-limit-actions {
            display: grid !important;
            grid-template-columns: 1fr 1fr;
            gap: 9px !important;
            margin-top: 2px;
        }
        .tracker-settings-action,
        .tracker-dialog-btn,
        .beautiful-btn {
            min-height: 40px;
            padding: 9px 12px !important;
            border: 1px solid rgba(255, 255, 255, 0.10) !important;
            border-radius: 10px !important;
            background: rgba(255, 255, 255, 0.055) !important;
            color: var(--tracker-dialog-text) !important;
            font-family: inherit;
            font-size: 11px !important;
            font-weight: 700 !important;
            letter-spacing: 0.1px !important;
            text-transform: none !important;
            cursor: pointer;
            transition: transform 0.16s ease, background-color 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
        }
        .tracker-settings-action:hover,
        .tracker-dialog-btn:hover,
        .beautiful-btn:hover {
            transform: translateY(-1px);
            background: rgba(255, 255, 255, 0.10) !important;
            border-color: rgba(255, 255, 255, 0.18) !important;
        }
        body.light-theme .tracker-settings-action,
        body.light-theme .tracker-dialog-btn,
        body.light-theme .beautiful-btn {
            background: rgba(255, 255, 255, 0.72) !important;
            border-color: rgba(0, 0, 0, 0.09) !important;
        }
        .tracker-settings-action-primary,
        .tracker-dialog-btn-primary,
        .beautiful-btn-primary {
            background: color-mix(in srgb, var(--tracker-dialog-accent) 25%, rgba(255, 255, 255, 0.04)) !important;
            border-color: color-mix(in srgb, var(--tracker-dialog-accent) 46%, transparent) !important;
            color: #fff !important;
            box-shadow: 0 6px 18px color-mix(in srgb, var(--tracker-dialog-accent) 15%, transparent);
        }
        body.light-theme .tracker-settings-action-primary,
        body.light-theme .tracker-dialog-btn-primary,
        body.light-theme .beautiful-btn-primary {
            color: #1e252d !important;
        }
        #tracker-limit-popup {
            width: 300px;
        }
        .tracker-limit-body {
            padding: 14px;
        }
        .tracker-limit-intro {
            display: grid;
            grid-template-columns: 42px minmax(0, 1fr);
            gap: 11px;
            align-items: center;
            margin-bottom: 13px;
        }
        .tracker-limit-icon {
            width: 42px;
            height: 42px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 12px;
            color: var(--tracker-dialog-accent);
            background: color-mix(in srgb, var(--tracker-dialog-accent) 14%, transparent);
            font-size: 18px;
        }
        .tracker-limit-description {
            color: var(--tracker-dialog-muted);
            font-size: 11px;
            line-height: 1.45;
        }
        .tracker-limit-label {
            display: block;
            margin-bottom: 7px;
            color: var(--tracker-dialog-text);
            font-size: 12px;
            font-weight: 680;
        }
        .limit-editor-input {
            width: 100% !important;
            height: 44px;
            box-sizing: border-box;
            padding: 0 12px !important;
            border: 1px solid rgba(255, 255, 255, 0.10) !important;
            border-radius: 11px !important;
            outline: none;
            background: rgba(0, 0, 0, 0.18) !important;
            color: var(--tracker-dialog-text) !important;
            font-family: inherit;
            font-size: 15px !important;
            font-variant-numeric: tabular-nums;
            transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }
        body.light-theme .limit-editor-input {
            border-color: rgba(0, 0, 0, 0.10) !important;
            background: rgba(255, 255, 255, 0.72) !important;
        }
        .limit-editor-input:focus {
            border-color: color-mix(in srgb, var(--tracker-dialog-accent) 70%, transparent) !important;
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--tracker-dialog-accent) 16%, transparent);
        }
        .tracker-limit-hint {
            margin: 6px 2px 13px;
            color: var(--tracker-dialog-muted);
            font-size: 10px;
        }
        .beautiful-popup {
            width: 360px !important;
            border-color: color-mix(in srgb, var(--tracker-dialog-accent) 24%, rgba(255, 255, 255, 0.08)) !important;
        }
        .beautiful-header {
            padding: 10px 12px 10px 16px !important;
            background: rgba(255, 255, 255, 0.035) !important;
            border-radius: 0 !important;
        }
        .beautiful-body {
            padding: 14px !important;
        }
        .sunny-tab-content {
            gap: 10px !important;
        }
        .beautiful-textarea {
            min-height: 150px !important;
            padding: 12px 13px !important;
            border: 1px solid rgba(255, 255, 255, 0.09) !important;
            border-radius: 12px !important;
            outline: none !important;
            background: rgba(0, 0, 0, 0.18) !important;
            color: var(--tracker-dialog-text) !important;
            font-family: inherit;
            font-size: 12px !important;
            line-height: 1.55 !important;
            box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.18) !important;
        }
        body.light-theme .beautiful-textarea {
            border-color: rgba(0, 0, 0, 0.09) !important;
            background: rgba(255, 255, 255, 0.68) !important;
        }
        .beautiful-textarea:focus {
            border-color: color-mix(in srgb, var(--tracker-dialog-accent) 70%, transparent) !important;
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--tracker-dialog-accent) 14%, transparent) !important;
        }
        .beautiful-actions {
            display: grid !important;
            grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
            gap: 8px !important;
            margin-top: 0 !important;
        }
        .beautiful-btn {
            display: flex !important;
            align-items: center;
            justify-content: center;
            gap: 7px;
        }
        .sunny-info-card {
            display: grid;
            gap: 8px;
            padding: 10px;
            border: 1px solid rgba(255, 255, 255, 0.075);
            border-radius: 12px;
            background: rgba(0, 0, 0, 0.16);
        }
        body.light-theme .sunny-info-card {
            border-color: rgba(0, 0, 0, 0.07);
            background: rgba(255, 255, 255, 0.52);
        }
        .sunny-info-item {
            padding: 10px;
            border-radius: 9px;
            background: rgba(255, 255, 255, 0.035);
            color: var(--tracker-dialog-text);
            font-size: 12px;
            line-height: 1.45;
        }
        body.light-theme .sunny-info-item {
            background: rgba(0, 0, 0, 0.035);
        }
        .sunny-info-label {
            display: block;
            margin-bottom: 4px;
            color: var(--tracker-dialog-accent);
            font-size: 10px;
            font-weight: 760;
            letter-spacing: 0.45px;
            text-transform: uppercase;
        }
        .sunny-empty-state {
            padding: 28px 16px;
            border: 1px dashed rgba(255, 255, 255, 0.11);
            border-radius: 12px;
            color: var(--tracker-dialog-muted);
            text-align: center;
            font-size: 12px;
            line-height: 1.55;
        }
        body.light-theme .sunny-empty-state {
            border-color: rgba(0, 0, 0, 0.12);
        }
        .sunny-empty-state i {
            display: block;
            margin-bottom: 10px;
            color: var(--tracker-dialog-accent);
            font-size: 24px;
            opacity: 0.75;
        }
        .sunny-open-full {
            width: 100%;
            margin-top: 0 !important;
        }
        .sunny-compact-actions {
            gap: 6px !important;
        }
        .sunny-summary-actions {
            grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        }
        .sunny-facts-actions {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
        }
        .sunny-compact-actions .beautiful-btn {
            min-height: 34px !important;
            padding: 6px 8px !important;
            border-radius: 8px !important;
            gap: 5px !important;
            font-size: 10px !important;
            line-height: 1.2 !important;
            white-space: normal;
        }
        .sunny-compact-actions .beautiful-btn i {
            flex: 0 0 auto;
            font-size: 11px;
        }
        .sunny-library-toolbar {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
        }
        .sunny-library-filter {
            min-height: 32px;
            padding: 6px 9px;
            border: 1px solid rgba(255, 255, 255, 0.09);
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.04);
            color: var(--tracker-dialog-muted);
            font: inherit;
            font-size: 10px;
            font-weight: 700;
            cursor: pointer;
            transition: background-color 0.16s ease, color 0.16s ease, border-color 0.16s ease;
        }
        .sunny-library-filter.active {
            color: var(--tracker-dialog-text);
            border-color: color-mix(in srgb, var(--tracker-dialog-accent) 46%, transparent);
            background: color-mix(in srgb, var(--tracker-dialog-accent) 18%, transparent);
        }
        body.light-theme .sunny-library-filter {
            border-color: rgba(0, 0, 0, 0.09);
            background: rgba(0, 0, 0, 0.035);
        }
        .sunny-library-meta {
            min-height: 16px;
            color: var(--tracker-dialog-muted);
            font-size: 9px;
            text-align: right;
        }
        .sunny-library-list {
            display: grid;
            gap: 6px;
            max-height: 330px;
            padding-right: 2px;
            overflow-y: auto;
            overscroll-behavior: contain;
            scrollbar-width: thin;
        }
        .sunny-library-entry {
            padding: 9px 10px;
            border: 1px solid rgba(255, 255, 255, 0.075);
            border-radius: 9px;
            background: rgba(0, 0, 0, 0.14);
        }
        body.light-theme .sunny-library-entry {
            border-color: rgba(0, 0, 0, 0.07);
            background: rgba(255, 255, 255, 0.52);
        }
        .sunny-library-entry-head {
            display: flex;
            align-items: center;
            gap: 7px;
            min-width: 0;
        }
        .sunny-library-entry-title {
            min-width: 0;
            flex: 1;
            overflow: hidden;
            color: var(--tracker-dialog-text);
            font-size: 10.5px;
            font-weight: 730;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .sunny-library-entry-badges {
            display: flex;
            gap: 4px;
            flex: 0 0 auto;
            color: var(--tracker-dialog-accent);
            font-size: 9px;
        }
        .sunny-library-entry-content {
            display: -webkit-box;
            margin-top: 5px;
            overflow: hidden;
            color: var(--tracker-dialog-muted);
            font-size: 9.5px;
            line-height: 1.4;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 2;
        }
        .sunny-library-empty {
            padding: 22px 12px;
            border: 1px dashed rgba(255, 255, 255, 0.10);
            border-radius: 10px;
            color: var(--tracker-dialog-muted);
            font-size: 11px;
            text-align: center;
        }
        body.light-theme .sunny-library-empty {
            border-color: rgba(0, 0, 0, 0.10);
        }

        @media (max-width: 700px), (max-width: 1024px) and (pointer: coarse) {
            .tracker-popup {
                border-radius: 18px !important;
            }
            .tracker-popup-header {
                min-height: 52px;
                padding: 8px 10px 8px 14px !important;
                cursor: default !important;
            }
            .tracker-popup-close {
                width: 38px !important;
                height: 38px !important;
                flex-basis: 38px !important;
                margin: 0 !important;
                font-size: 24px !important;
            }
            .tracker-customization-body,
            .tracker-limit-body,
            .beautiful-body {
                padding: 13px !important;
            }
            .tracker-setting-row {
                padding: 11px;
            }
            .tracker-setting-row label,
            .tracker-check-label,
            .tracker-limit-label {
                font-size: 13px !important;
            }
            .tracker-setting-control input[type="range"]::-webkit-slider-thumb {
                width: 24px;
                height: 24px;
            }
            .tracker-setting-control input[type="range"]::-moz-range-thumb {
                width: 19px;
                height: 19px;
            }
            .tracker-settings-action,
            .tracker-dialog-btn,
            .beautiful-btn {
                min-height: 46px;
                font-size: 12px !important;
            }
            .beautiful-actions {
                grid-template-columns: repeat(2, minmax(0, 1fr));
            }
            .sunny-summary-actions {
                grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
            }
            .sunny-compact-actions .beautiful-btn {
                min-height: 40px !important;
                padding: 7px 6px !important;
                font-size: 10px !important;
            }
            .sunny-library-list {
                max-height: min(42vh, 360px);
            }
            .beautiful-textarea {
                min-height: 132px !important;
            }
        }
    `;
    document.head.appendChild(style);
}

function ensureTrackerV7Styles() {
    if (document.getElementById('chat-tracker-v7-styles')) return;

    const style = document.createElement('style');
    style.id = 'chat-tracker-v7-styles';
    style.textContent = `
        /* The settings window intentionally keeps the original compact design. */
        #tracker-customization-popup {
            width: 290px !important;
            color: var(--SmartThemeEmColor, #fff) !important;
            background: rgba(25, 25, 35, 0.72) !important;
            border: 1px solid rgba(255, 255, 255, 0.15) !important;
            border-radius: 10px !important;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.60) !important;
            backdrop-filter: blur(16px) !important;
            -webkit-backdrop-filter: blur(16px) !important;
        }
        body.light-theme #tracker-customization-popup {
            color: #1f2328 !important;
            background: rgba(245, 247, 250, 0.88) !important;
            border-color: rgba(0, 0, 0, 0.12) !important;
            box-shadow: 0 10px 30px rgba(20, 28, 40, 0.22) !important;
        }
        #tracker-customization-popup .tracker-popup-header {
            min-height: 0 !important;
            padding: 10px 12px !important;
            background: rgba(255, 255, 255, 0.05) !important;
            border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
            color: var(--SmartThemeQuoteColor, #ffaa00) !important;
            font-size: 12px !important;
            font-weight: 700 !important;
            letter-spacing: 0.5px !important;
            text-transform: none !important;
        }
        body.light-theme #tracker-customization-popup .tracker-popup-header {
            background: rgba(0, 0, 0, 0.035) !important;
            border-bottom-color: rgba(0, 0, 0, 0.07) !important;
        }
        #tracker-customization-popup .tracker-popup-close {
            width: auto !important;
            height: auto !important;
            flex: 0 0 auto !important;
            margin: 0 !important;
            padding: 0 !important;
            border-radius: 0 !important;
            background: transparent !important;
            color: inherit !important;
            font-size: 18px !important;
            opacity: 0.6 !important;
        }
        #tracker-customization-popup .tracker-popup-close:hover {
            color: #ff4444 !important;
            opacity: 1 !important;
            background: transparent !important;
            transform: none !important;
        }
        #tracker-customization-popup .tracker-customization-body {
            padding: 12px !important;
            gap: 12px !important;
        }
        #tracker-customization-popup .tracker-setting-row {
            display: grid !important;
            grid-template-columns: minmax(0, 1fr) 58px !important;
            align-items: center !important;
            gap: 8px !important;
            padding: 0 !important;
            border: 0 !important;
            border-radius: 0 !important;
            background: transparent !important;
            box-shadow: none !important;
        }
        #tracker-customization-popup .tracker-setting-row label,
        #tracker-customization-popup .tracker-setting-title,
        #tracker-customization-popup .tracker-language-label {
            color: var(--SmartThemeEmColor, #fff) !important;
            font-size: 11px !important;
            font-weight: 700 !important;
            letter-spacing: 0.2px !important;
            text-transform: none !important;
        }
        body.light-theme #tracker-customization-popup .tracker-setting-row label,
        body.light-theme #tracker-customization-popup .tracker-setting-title,
        body.light-theme #tracker-customization-popup .tracker-language-label {
            color: #1f2328 !important;
        }
        #tracker-customization-popup .tracker-setting-value {
            min-width: 50px !important;
            padding: 0 !important;
            border-radius: 0 !important;
            background: transparent !important;
            color: inherit !important;
            text-align: right !important;
            font-size: 10px !important;
            opacity: 0.8 !important;
        }
        #tracker-customization-popup .tracker-setting-control {
            grid-column: 1 / -1 !important;
        }
        #tracker-customization-popup .tracker-setting-control input[type="range"] {
            appearance: none !important;
            -webkit-appearance: none !important;
            width: 100% !important;
            height: 4px !important;
            min-height: 4px !important;
            padding: 0 !important;
            border: 0 !important;
            border-radius: 999px !important;
            outline: none !important;
            background: #5bb5ee !important;
            cursor: pointer;
        }
        #tracker-customization-popup .tracker-setting-control input[type="range"]::-webkit-slider-thumb {
            appearance: none !important;
            -webkit-appearance: none !important;
            width: 18px !important;
            height: 18px !important;
            border: 3px solid #5bb5ee !important;
            border-radius: 50% !important;
            background: #17212b !important;
            box-shadow: 0 1px 5px rgba(0, 0, 0, 0.55) !important;
        }
        #tracker-customization-popup .tracker-setting-control input[type="range"]::-moz-range-thumb {
            width: 13px !important;
            height: 13px !important;
            border: 3px solid #5bb5ee !important;
            border-radius: 50% !important;
            background: #17212b !important;
            box-shadow: 0 1px 5px rgba(0, 0, 0, 0.55) !important;
        }
        #tracker-customization-popup .tracker-display-section {
            margin: 0 !important;
        }
        #tracker-customization-popup .tracker-setting-title {
            margin: 0 0 7px 0 !important;
            color: var(--SmartThemeEmColor, #fff) !important;
            font-size: 11px !important;
            letter-spacing: 0.2px !important;
            text-transform: uppercase !important;
        }
        #tracker-customization-popup .tracker-display-options {
            display: grid !important;
            gap: 7px !important;
            padding: 9px !important;
            border: 1px solid rgba(255, 255, 255, 0.07) !important;
            border-radius: 7px !important;
            background: rgba(0, 0, 0, 0.20) !important;
        }
        body.light-theme #tracker-customization-popup .tracker-display-options {
            border-color: rgba(0, 0, 0, 0.08) !important;
            background: rgba(0, 0, 0, 0.05) !important;
        }
        #tracker-customization-popup .tracker-check-label {
            min-height: 0 !important;
            padding: 0 !important;
            border-radius: 0 !important;
            color: inherit !important;
            font-size: 11px !important;
            background: transparent !important;
        }
        #tracker-customization-popup .tracker-check-label:hover {
            background: transparent !important;
        }
        #tracker-customization-popup .tracker-check-label input {
            width: auto !important;
            height: auto !important;
            flex: 0 0 auto !important;
            accent-color: var(--SmartThemeQuoteColor, #ffaa00) !important;
        }
        #tracker-customization-popup .tracker-language-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
        }
        #tracker-customization-popup .tracker-language-switch {
            display: flex;
            gap: 4px;
            padding: 3px;
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 7px;
            background: rgba(0, 0, 0, 0.20);
        }
        body.light-theme #tracker-customization-popup .tracker-language-switch {
            border-color: rgba(0, 0, 0, 0.09);
            background: rgba(0, 0, 0, 0.05);
        }
        #tracker-customization-popup .tracker-language-btn {
            min-width: 46px;
            height: 28px;
            padding: 0 10px;
            border: 1px solid transparent;
            border-radius: 5px;
            background: transparent;
            color: inherit;
            font-size: 10px;
            font-weight: 700;
            cursor: pointer;
        }
        #tracker-customization-popup .tracker-language-btn.active {
            border-color: rgba(91, 181, 238, 0.55);
            background: rgba(91, 181, 238, 0.18);
            color: #c9ecff;
        }
        body.light-theme #tracker-customization-popup .tracker-language-btn.active {
            color: #175b86;
        }
        #tracker-customization-popup .tracker-settings-actions {
            display: flex !important;
            gap: 8px !important;
            margin: 0 !important;
        }
        #tracker-customization-popup .tracker-settings-action {
            min-height: 0 !important;
            flex: 1 !important;
            padding: 7px 8px !important;
            border: 1px solid rgba(255, 255, 255, 0.12) !important;
            border-radius: 6px !important;
            background: rgba(255, 255, 255, 0.06) !important;
            color: inherit !important;
            font-size: 10px !important;
            font-weight: 700 !important;
            text-transform: uppercase !important;
            box-shadow: none !important;
        }
        #tracker-customization-popup .tracker-settings-action:hover {
            background: rgba(255, 255, 255, 0.12) !important;
            transform: none !important;
        }
        body.light-theme #tracker-customization-popup .tracker-settings-action {
            border-color: rgba(0, 0, 0, 0.12) !important;
            background: rgba(0, 0, 0, 0.04) !important;
        }
        body.light-theme #tracker-customization-popup .tracker-settings-action:hover {
            background: rgba(0, 0, 0, 0.10) !important;
        }

        /* The removed token-limit intro card must never leave empty spacing. */
        #tracker-limit-popup .tracker-limit-intro {
            display: none !important;
        }

        @media (max-width: 700px), (max-width: 1024px) and (pointer: coarse) {
            #tracker-customization-popup {
                left: max(8px, env(safe-area-inset-left)) !important;
                right: max(8px, env(safe-area-inset-right)) !important;
                top: auto !important;
                bottom: max(8px, env(safe-area-inset-bottom)) !important;
                width: auto !important;
                border-radius: 14px !important;
            }
            #tracker-customization-popup .tracker-popup-header {
                min-height: 48px !important;
                padding: 10px 14px !important;
            }
            #tracker-customization-popup .tracker-popup-close {
                width: 38px !important;
                height: 38px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                margin: -6px -8px -6px 0 !important;
                font-size: 26px !important;
            }
            #tracker-customization-popup .tracker-customization-body {
                padding: 14px !important;
                gap: 14px !important;
            }
            #tracker-customization-popup .tracker-setting-row label,
            #tracker-customization-popup .tracker-setting-title,
            #tracker-customization-popup .tracker-check-label,
            #tracker-customization-popup .tracker-language-label {
                font-size: 13px !important;
            }
            #tracker-customization-popup .tracker-setting-control input[type="range"] {
                min-height: 4px !important;
            }
            #tracker-customization-popup .tracker-setting-control input[type="range"]::-webkit-slider-thumb {
                width: 24px !important;
                height: 24px !important;
            }
            #tracker-customization-popup .tracker-setting-control input[type="range"]::-moz-range-thumb {
                width: 19px !important;
                height: 19px !important;
            }
            #tracker-customization-popup .tracker-check-label {
                min-height: 40px !important;
            }
            #tracker-customization-popup .tracker-check-label input {
                width: 20px !important;
                height: 20px !important;
            }
            #tracker-customization-popup .tracker-language-btn {
                min-width: 54px;
                height: 36px;
                font-size: 12px;
            }
            #tracker-customization-popup .tracker-settings-action {
                min-height: 46px !important;
                font-size: 12px !important;
            }
        }
    `;
    document.head.appendChild(style);
}

function applyTrackerCustomization() {
    const panel = document.getElementById('chat-tracker-panel');
    if (!panel) return;

    trackerCustomization = normalizeTrackerCustomization(trackerCustomization);

    const requestedScale = getExpandedScaleFactor();
    const viewport = getViewportBounds();
    const mobileScaleCap = Math.max(0.8, (viewport.width - 16) / 180);
    const scale = isCompactMobileLayout() ? Math.min(requestedScale, mobileScaleCap) : requestedScale;
    const collapsedBoxSize = Math.min(getCollapsedBoxSize(), Math.max(32, viewport.width - 16));
    const collapsedIconSize = getCollapsedIconSize();
    const opacityRatio = trackerCustomization.opacity / 100;
    const panelBgDark = (0.12 + opacityRatio * 0.48).toFixed(3);
    const panelBgLight = (0.10 + opacityRatio * 0.40).toFixed(3);
    const statBgDark = (0.10 + opacityRatio * 0.38).toFixed(3);
    const statBgLight = (0.08 + opacityRatio * 0.28).toFixed(3);
    const borderDark = (0.06 + opacityRatio * 0.12).toFixed(3);
    const borderLight = (0.05 + opacityRatio * 0.14).toFixed(3);
    const blurPx = Math.round(4 + opacityRatio * 18);
    const shadowOpacity = (0.28 + opacityRatio * 0.22).toFixed(3);

    panel.style.setProperty('--tracker-scale', String(scale));
    panel.style.setProperty('--tracker-expanded-width', `${Math.round(180 * scale)}px`);
    panel.style.setProperty('--tracker-collapsed-box-size', `${collapsedBoxSize}px`);
    panel.style.setProperty('--tracker-collapsed-icon-size', `${collapsedIconSize}px`);
    panel.style.setProperty('--tracker-panel-bg-dark', `rgba(0, 0, 0, ${panelBgDark})`);
    panel.style.setProperty('--tracker-panel-bg-light', `rgba(255, 255, 255, ${panelBgLight})`);
    panel.style.setProperty('--tracker-stat-bg-dark', `rgba(0, 0, 0, ${statBgDark})`);
    panel.style.setProperty('--tracker-stat-bg-light', `rgba(255, 255, 255, ${statBgLight})`);
    panel.style.setProperty('--tracker-panel-border-dark', `rgba(255, 255, 255, ${borderDark})`);
    panel.style.setProperty('--tracker-panel-border-light', `rgba(0, 0, 0, ${borderLight})`);
    panel.style.setProperty('--tracker-panel-shadow', `0 ${Math.round(4 * scale)}px ${Math.round(12 * scale)}px rgba(0, 0, 0, ${shadowOpacity})`);
    panel.style.setProperty('--tracker-panel-blur', `${blurPx}px`);

    const visibilityMap = {
        messages: trackerCustomization.showMessages,
        hidden: trackerCustomization.showHidden,
        tokens: trackerCustomization.showTokens,
    };

    Object.entries(visibilityMap).forEach(([name, visible]) => {
        const stat = panel.querySelector(`[data-tracker-stat="${name}"]`);
        if (stat) stat.style.display = visible ? '' : 'none';
    });

    const content = document.getElementById('tracker-content');
    if (content && !isCollapsed) content.style.maxHeight = '';
}

function positionPopupNearPanel(popup, width = 320) {
    const panel = document.getElementById('chat-tracker-panel');
    if (!panel || !popup) return;

    if (isCompactMobileLayout()) {
        popup.style.left = '8px';
        popup.style.right = '8px';
        popup.style.top = 'auto';
        popup.style.bottom = '8px';
        return;
    }

    const viewport = getViewportBounds();
    const rect = panel.getBoundingClientRect();
    const gap = 10;
    const top = Math.max(8, Math.min(viewport.height - 80, rect.top));
    const left = rect.left > viewport.width / 2
        ? Math.max(8, rect.left - width - gap)
        : Math.min(viewport.width - width - 8, rect.right + gap);
    popup.style.top = `${top}px`;
    popup.style.left = `${Math.max(8, left)}px`;
    popup.style.right = 'auto';
    popup.style.bottom = 'auto';
}


function showTrackerPopup(popup, width = 320) {
    if (!popup?.isConnected) return;

    // SillyTavern mobile themes and WebViews may override the generic popup
    // class. Keep extension dialogs in the top-level fixed layer explicitly.
    popup.style.setProperty('display', 'flex', 'important');
    popup.style.setProperty('position', 'fixed', 'important');
    popup.style.setProperty('z-index', '2147483000', 'important');
    popup.style.setProperty('pointer-events', 'auto', 'important');
    popup.style.setProperty('visibility', 'visible', 'important');
    popup.style.setProperty('opacity', '1', 'important');
    popup.style.flexDirection = 'column';
    positionPopupNearPanel(popup, width);
}

function closeCustomizationPopup() {
    if (typeof customizationPopupCleanup === 'function') {
        customizationPopupCleanup();
        customizationPopupCleanup = null;
    }
    document.getElementById('tracker-customization-popup')?.remove();
    const button = document.getElementById('tracker-settings-btn');
    if (button) button.setAttribute('aria-expanded', 'false');
}

function updateTrackerRangeVisual(input) {
    if (!input) return;
    const min = Number(input.min || 0);
    const max = Number(input.max || 100);
    const value = Number(input.value || min);
    const progress = max > min ? ((value - min) / (max - min)) * 100 : 0;
    input.style.setProperty('--range-progress', `${Math.max(0, Math.min(100, progress))}%`);
}

function openCustomizationPopup(event) {
    if (event) event.stopPropagation();

    const existing = document.getElementById('tracker-customization-popup');
    if (existing) {
        closeCustomizationPopup();
        return;
    }

    const popup = document.createElement('div');
    popup.id = 'tracker-customization-popup';
    popup.className = 'tracker-popup tracker-customization-popup';
    popup.innerHTML = `
        <div class="tracker-popup-header" id="tracker-customization-drag">
            <span>${trackerText('settings')}</span>
            <span class="tracker-popup-close" id="tracker-customization-close" title="${trackerText('close')}" aria-label="${trackerText('close')}">&times;</span>
        </div>
        <div class="tracker-customization-body">
            <div class="tracker-setting-row">
                <label for="tracker-opacity">${trackerText('transparency')}</label>
                <span class="tracker-setting-value" id="tracker-opacity-value">${trackerCustomization.opacity}%</span>
                <div class="tracker-setting-control">
                    <input type="range" id="tracker-opacity" min="20" max="100" step="1" value="${trackerCustomization.opacity}">
                </div>
            </div>
            <div class="tracker-setting-row">
                <label for="tracker-expanded-scale">${trackerText('expandedInterfaceSize')}</label>
                <span class="tracker-setting-value" id="tracker-expanded-scale-value">${trackerCustomization.expandedScale}%</span>
                <div class="tracker-setting-control">
                    <input type="range" id="tracker-expanded-scale" min="80" max="180" step="5" value="${trackerCustomization.expandedScale}">
                </div>
            </div>
            <div class="tracker-setting-row">
                <label for="tracker-collapsed-size">${trackerText('iconSize')}</label>
                <span class="tracker-setting-value" id="tracker-collapsed-size-value">${trackerCustomization.collapsedSize}px</span>
                <div class="tracker-setting-control">
                    <input type="range" id="tracker-collapsed-size" min="32" max="72" step="2" value="${trackerCustomization.collapsedSize}">
                </div>
            </div>
            <div class="tracker-language-row">
                <span class="tracker-language-label">${trackerText('language')}</span>
                <div class="tracker-language-switch" role="group" aria-label="${trackerText('language')}">
                    <button type="button" class="tracker-language-btn ${getTrackerLanguage() === 'ru' ? 'active' : ''}" data-language="ru" aria-pressed="${getTrackerLanguage() === 'ru'}">RU</button>
                    <button type="button" class="tracker-language-btn ${getTrackerLanguage() === 'en' ? 'active' : ''}" data-language="en" aria-pressed="${getTrackerLanguage() === 'en'}">EN</button>
                </div>
            </div>
            <div class="tracker-display-section">
                <div class="tracker-setting-title">${trackerText('display').toUpperCase()}</div>
                <div class="tracker-display-options">
                    <label class="tracker-check-label"><input type="checkbox" id="tracker-show-messages" ${trackerCustomization.showMessages ? 'checked' : ''}> <span>${trackerText('messageCount')}</span></label>
                    <label class="tracker-check-label"><input type="checkbox" id="tracker-show-hidden" ${trackerCustomization.showHidden ? 'checked' : ''}> <span>${trackerText('hiddenMessages')}</span></label>
                    <label class="tracker-check-label"><input type="checkbox" id="tracker-show-tokens" ${trackerCustomization.showTokens ? 'checked' : ''}> <span>${trackerText('tokens')}</span></label>
                </div>
            </div>
            <div class="tracker-settings-actions">
                <button class="tracker-settings-action" id="tracker-settings-reset">${trackerText('reset')}</button>
                <button class="tracker-settings-action" id="tracker-settings-done">${trackerText('done')}</button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);
    showTrackerPopup(popup, 290);
    if (!isCompactMobileLayout()) {
        setupDraggable(popup, document.getElementById('tracker-customization-drag'));
    }

    const button = document.getElementById('tracker-settings-btn');
    if (button) button.setAttribute('aria-expanded', 'true');

    popup.addEventListener('click', (e) => e.stopPropagation());

    const bindRange = (inputId, valueId, key, suffix) => {
        const input = document.getElementById(inputId);
        const value = document.getElementById(valueId);
        input?.addEventListener('input', () => {
            trackerCustomization[key] = Number(input.value);
            if (value) value.textContent = `${input.value}${suffix}`;
            applyTrackerCustomization();
            saveTrackerCustomization();
        });
    };

    bindRange('tracker-opacity', 'tracker-opacity-value', 'opacity', '%');
    bindRange('tracker-expanded-scale', 'tracker-expanded-scale-value', 'expandedScale', '%');
    bindRange('tracker-collapsed-size', 'tracker-collapsed-size-value', 'collapsedSize', 'px');

    const bindCheckbox = (inputId, key) => {
        document.getElementById(inputId)?.addEventListener('change', (e) => {
            trackerCustomization[key] = e.target.checked;
            applyTrackerCustomization();
            saveTrackerCustomization();
        });
    };

    bindCheckbox('tracker-show-messages', 'showMessages');
    bindCheckbox('tracker-show-hidden', 'showHidden');
    bindCheckbox('tracker-show-tokens', 'showTokens');

    popup.querySelectorAll('.tracker-language-btn').forEach(languageButton => {
        languageButton.addEventListener('click', () => {
            const language = languageButton.getAttribute('data-language');
            if (!language || language === getTrackerLanguage()) return;
            setTrackerLanguage(language);
            closeCustomizationPopup();
            openCustomizationPopup();
        });
    });

    const handleOutsideClose = (e) => {
        const target = e.target;
        if (popup.contains(target)) return;
        if (button && button.contains(target)) return;
        closeCustomizationPopup();
    };

    const handleEscapeClose = (e) => {
        if (e.key === 'Escape') closeCustomizationPopup();
    };

    const attachOutsideListeners = () => {
        if ('PointerEvent' in window) {
            document.addEventListener('pointerdown', handleOutsideClose, true);
        } else {
            document.addEventListener('mousedown', handleOutsideClose, true);
            document.addEventListener('touchstart', handleOutsideClose, true);
        }
        document.addEventListener('keydown', handleEscapeClose);
    };

    customizationPopupCleanup = () => {
        document.removeEventListener('pointerdown', handleOutsideClose, true);
        document.removeEventListener('mousedown', handleOutsideClose, true);
        document.removeEventListener('touchstart', handleOutsideClose, true);
        document.removeEventListener('keydown', handleEscapeClose);
    };

    setTimeout(attachOutsideListeners, 0);

    document.getElementById('tracker-customization-close').onclick = closeCustomizationPopup;
    document.getElementById('tracker-settings-done').onclick = closeCustomizationPopup;
    document.getElementById('tracker-settings-reset').onclick = () => {
        trackerCustomization = { ...DEFAULT_TRACKER_CUSTOMIZATION };
        saveTrackerCustomization();
        applyTrackerCustomization();
        closeCustomizationPopup();
        openCustomizationPopup();
    };
}

function setupResponsiveTrackerHandlers() {
    if (responsiveHandlersReady) return;
    responsiveHandlersReady = true;
    let resizeTimer = null;
    let lastViewportWidth = getViewportBounds().width;

    const handleViewportChange = (force = false) => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            const viewport = getViewportBounds();
            const widthChanged = Math.abs(viewport.width - lastViewportWidth) > 2;
            if (!force && !widthChanged) {
                const popup = document.getElementById('tracker-customization-popup');
                if (popup) positionPopupNearPanel(popup, 290);
                return;
            }
            lastViewportWidth = viewport.width;

            const panel = document.getElementById('chat-tracker-panel');
            if (!panel) return;
            const anchor = panel.style.right && panel.style.right !== 'auto' ? 'right' : 'left';
            applyTrackerCustomization();
            requestAnimationFrame(() => {
                clampElementToViewport(panel, anchor);
                const popup = document.getElementById('tracker-customization-popup');
                if (popup) positionPopupNearPanel(popup, 290);
                saveState();
            });
        }, 90);
    };

    const persistCurrentState = () => {
        if (document.getElementById('chat-tracker-panel')) saveState();
    };

    window.addEventListener('resize', () => handleViewportChange(false), { passive: true });
    window.addEventListener('orientationchange', () => handleViewportChange(true), { passive: true });
    window.addEventListener('pageshow', () => handleViewportChange(true), { passive: true });
    window.addEventListener('pagehide', persistCurrentState, { passive: true });
    window.visualViewport?.addEventListener('resize', () => handleViewportChange(false), { passive: true });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') persistCurrentState();
    });
}


function bindTrackerPressAction(element, handler) {
    if (!element || typeof handler !== 'function' || element.dataset.trackerPressReady === 'true') return;
    element.dataset.trackerPressReady = 'true';

    let lastActivation = 0;
    let startX = 0;
    let startY = 0;

    const getPoint = (event) => {
        const touch = event?.changedTouches?.[0] || event?.touches?.[0];
        return touch || event || { clientX: 0, clientY: 0 };
    };

    const rememberStart = (event) => {
        const point = getPoint(event);
        startX = Number(point.clientX) || 0;
        startY = Number(point.clientY) || 0;
        // Do not stop pointer/touch start propagation. The drag handler already
        // ignores buttons and controls, exactly as in the older working build.
    };

    const activate = (event, direct = false) => {
        const now = Date.now();
        if (now - lastActivation < 650) {
            if (event?.cancelable) event.preventDefault();
            event?.stopPropagation?.();
            return;
        }
        lastActivation = now;
        handler(event);
    };

    const finishDirectPress = (event) => {
        if (event?.type === 'pointerup' && event.pointerType === 'mouse') return;
        if (event?.isPrimary === false) return;
        const point = getPoint(event);
        const dx = (Number(point.clientX) || 0) - startX;
        const dy = (Number(point.clientY) || 0) - startY;
        if (Math.hypot(dx, dy) > 12) return;
        activate(event, true);
    };

    if ('PointerEvent' in window) {
        element.addEventListener('pointerdown', rememberStart, { passive: true });
        element.addEventListener('pointerup', finishDirectPress, { passive: false });
    } else {
        element.addEventListener('touchstart', rememberStart, { passive: true });
        element.addEventListener('touchend', finishDirectPress, { passive: false });
    }

    element.addEventListener('click', (event) => activate(event, false));
}

function bindDelegatedTrackerPressAction(selector, handler) {
    const lastActivationByElement = new WeakMap();
    const startPointByElement = new WeakMap();

    const findElement = (event) => {
        const target = event?.target;
        return target instanceof Element ? target.closest(selector) : null;
    };

    const getPoint = (event) => event?.changedTouches?.[0] || event?.touches?.[0] || event;

    const rememberStart = (event) => {
        const element = findElement(event);
        if (!element) return;
        const point = getPoint(event);
        startPointByElement.set(element, {
            x: Number(point?.clientX) || 0,
            y: Number(point?.clientY) || 0,
        });
    };

    const activate = (event, isDirect) => {
        const element = findElement(event);
        if (!element) return;
        if (event?.type === 'pointerup' && event.pointerType === 'mouse') return;
        if (event?.isPrimary === false) return;

        if (isDirect) {
            const start = startPointByElement.get(element);
            const point = getPoint(event);
            if (start && Math.hypot((Number(point?.clientX) || 0) - start.x, (Number(point?.clientY) || 0) - start.y) > 12) return;
        }

        const now = Date.now();
        const lastActivation = lastActivationByElement.get(element) || 0;
        if (now - lastActivation < 650) {
            if (event?.cancelable) event.preventDefault();
            event?.stopPropagation?.();
            return;
        }
        lastActivationByElement.set(element, now);
        handler.call(element, event);
    };

    if ('PointerEvent' in window) {
        document.addEventListener('pointerdown', rememberStart, { passive: true });
        document.addEventListener('pointerup', event => activate(event, true), { passive: false });
    } else {
        document.addEventListener('touchstart', rememberStart, { passive: true });
        document.addEventListener('touchend', event => activate(event, true), { passive: false });
    }
    document.addEventListener('click', event => activate(event, false));
}

function createTrackerPanel() {
    try {
        if (document.getElementById('chat-tracker-panel')) return;
        ensureCustomizationStyles();
        ensureTrackerV7Styles();

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
            <div class="tracker-header-actions">
                <button class="tracker-settings-btn" id="tracker-settings-btn" type="button" title="${trackerText('settingsTooltip')}" aria-label="${trackerText('settingsTooltip')}" aria-expanded="false">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="3.2"></circle>
                        <path d="M12 2.8v2.1M12 19.1v2.1M21.2 12h-2.1M4.9 12H2.8M18.5 5.5L17 7M7 17l-1.5 1.5M18.5 18.5L17 17M7 7 5.5 5.5"></path>
                        <circle cx="12" cy="12" r="6.8" opacity="0.55"></circle>
                    </svg>
                </button>
                <button class="tracker-toggle" id="tracker-toggle" type="button" title="${trackerText('toggleTooltip')}"><span class="toggle-arrow">▼</span></button>
            </div>
        `;

        const content = document.createElement('div');
        content.className = 'tracker-content';
        content.id = 'tracker-content';
        content.innerHTML = `
            <div class="tracker-stat" data-tracker-stat="messages">
                <span class="stat-label">${trackerText('messagesLabel')}</span>
                <span class="stat-value" id="stat-messages">0 <span id="trigger-sunny-panel" class="tracker-btn-create" title="${trackerText('sunnyToggleTooltip')}"><i class="fa-solid fa-sun"></i></span></span>
            </div>
            <div class="tracker-stat" data-tracker-stat="hidden">
                <span class="stat-label">${trackerText('hiddenLabel')}</span>
                <span class="stat-value" id="stat-hidden">0</span>
            </div>
            <div class="tracker-stat tokens-vertical-block" data-tracker-stat="tokens" style="position:relative; min-height: 50px;">
                <div id="stat-context-container" style="display:flex; flex-direction:column; width:100%; align-items:center;">
                    <div class="tokens-label-top">${trackerText('tokensLabel')}</div>
                    <div id="stat-context" class="tokens-numbers-mid">
                        <span class="context-text">0 / 0</span>
                        <span class="context-percent">(0%)</span>
                    </div>
                    <div class="mode-buttons-container">
                        <button class="mode-btn ${tokenMode === 'chat' ? 'active' : ''}" data-mode="chat" title="${trackerText('visibleChatHistory')}">CHAT</button>
                        <button class="mode-btn ${tokenMode === 'api' ? 'active' : ''}" data-mode="api" title="${trackerText('apiPromptTokens')}">API</button>
                        <button class="edit-limit-btn" id="edit-limit-btn" title="${trackerText('editTokenLimit')}">✎</button>
                    </div>
                </div>
                <div id="sunny-panel-tabs" style="display:none; width:100%; flex-direction:column; gap:4px; padding-top:2px;">
                    <div id="tracker-sunny-tools-label" style="font-size:9px; font-weight:bold; color:var(--SmartThemeQuoteColor, #ffaa00); text-align:center; letter-spacing:1px; margin-bottom:2px; opacity:0.8;">${trackerText('sunnyTools')}</div>
                    <div style="display:flex; gap:4px; width:100%;">
                        <button class="sunny-panel-tab active" data-tab="sum">${trackerText('summaryTab')}</button>
                        <button class="sunny-panel-tab" data-tab="facts">${trackerText('factsTab')}</button>
                    </div>
                    <div style="display:flex; gap:4px; width:100%;">
                        <button class="sunny-panel-tab" data-tab="qc">${trackerText('questsTab')}</button>
                        <button class="sunny-panel-tab" data-tab="lib">${trackerText('libraryTab')}</button>
                    </div>
                </div>
            </div>
        `;

        panel.appendChild(header);
        panel.appendChild(content);
        document.body.appendChild(panel);

        bindTrackerPressAction(document.getElementById('tracker-toggle'), togglePanel);
        bindTrackerPressAction(document.getElementById('tracker-settings-btn'), openCustomizationPopup);
        bindTrackerPressAction(document.getElementById('edit-limit-btn'), openLimitEditor);

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

        panel.addEventListener('click', handlePanelClick);
        applyTrackerCustomization();
        setupDraggable(panel, header);
        setupResponsiveTrackerHandlers();
    } catch (error) {}
}

function setPanelCollapsed(collapsed, options = {}) {
    const { animate = true, save = true } = options;
    const panel = document.getElementById('chat-tracker-panel');
    const content = document.getElementById('tracker-content');
    const arrow = panel?.querySelector('.toggle-arrow');
    if (!panel || !content) return;

    isCollapsed = Boolean(collapsed);
    panel.style.width = '';
    panel.style.height = '';
    panel.style.padding = '';

    if (isCollapsed) {
        panel.classList.add('collapsed');
        content.style.maxHeight = '0px';
        content.style.opacity = '0';
        if (arrow) arrow.style.transform = 'rotate(-90deg)';
    } else {
        panel.classList.remove('collapsed');
        content.style.opacity = '1';
        if (animate) {
            content.style.maxHeight = `${content.scrollHeight}px`;
            setTimeout(() => {
                if (!isCollapsed && content.isConnected) content.style.maxHeight = '';
            }, 330);
        } else {
            content.style.maxHeight = '';
        }
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    }

    applyTrackerCustomization();
    requestAnimationFrame(() => {
        const anchor = panel.style.right && panel.style.right !== 'auto' ? 'right' : 'left';
        clampElementToViewport(panel, anchor);
    });

    if (save) saveState();
}

function togglePanel(event) {
    if (hasMoved || Date.now() < suppressPanelClickUntil) return;
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    setPanelCollapsed(!isCollapsed, { animate: true, save: true });
}

function handlePanelClick(event) {
    if (event?.target?.closest('button, input, textarea, select, a, label')) return;
    if (isCollapsed && !hasMoved && Date.now() >= suppressPanelClickUntil) {
        togglePanel(event);
    }
}

function setupEventListeners() {
    try {
        const context = SillyTavern.getContext();
        const eventSource = context?.eventSource || window.eventSource;
        if (!eventSource) return;

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
        element.innerHTML = `${visibleCount} <span id="trigger-sunny-panel" class="tracker-btn-create" title="${trackerText('sunnyToggleTooltip')}"><i class="fa-solid fa-sun"></i></span>`;
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
            element.title = `${trackerText('lastHidden')} ${numberPart}${lastHiddenMessage.substring(0, 100)}${lastHiddenMessage.length > 100 ? '...' : ''}`;
        } else if (hiddenCount > 0) element.title = `${hiddenCount} ${trackerText('hiddenMessagesInChat')}`;
        else element.title = trackerText('noHiddenMessages');
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
    popup.className = 'tracker-popup tracker-limit-popup';
    popup.innerHTML = `
        <div class="tracker-popup-header" id="tracker-limit-drag">
            <div class="tracker-popup-heading"><i class="fa-solid fa-gauge-high"></i><span>${trackerText('tokenLimitTitle')}</span></div>
            <span class="tracker-popup-close" id="tracker-limit-close" title="${trackerText('close')}" aria-label="${trackerText('close')}">&times;</span>
        </div>
        <div class="tracker-popup-body tracker-limit-body">
            <label class="tracker-limit-label" for="limit-input">${trackerText('tokenLimitLabel')}</label>
            <input type="number" id="limit-input" class="limit-editor-input"
                   value="${maxTokens}" min="0" max="128000" inputmode="numeric" placeholder="50000">
            <div class="tracker-limit-hint">${trackerText('tokenLimitHint')}</div>
            <div class="tracker-limit-actions">
                <button class="tracker-dialog-btn" id="limit-cancel">${trackerText('cancel')}</button>
                <button class="tracker-dialog-btn tracker-dialog-btn-primary" id="limit-save">${trackerText('save')}</button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);
    showTrackerPopup(popup, 300);

    const input = document.getElementById('limit-input');
    if (!isCompactMobileLayout()) {
        setupDraggable(popup, document.getElementById('tracker-limit-drag'));
    }

    const closePopup = () => popup.remove();
    document.getElementById('tracker-limit-close').onclick = closePopup;
    document.getElementById('limit-cancel').onclick = closePopup;

    const saveLimit = () => {
        const val = parseInt(input.value.trim(), 10);
        if (!Number.isNaN(val) && val >= 0 && val <= 128000) {
            maxTokens = val;
            localStorage.setItem('chatTrackerMaxTokens', maxTokens.toString());
            updateContextDisplay('limit-save');
            closePopup();
        } else {
            toastr.error(trackerText('invalidTokenLimit'), 'Chat Tracker');
            input.focus();
            input.select();
        }
    };

    document.getElementById('limit-save').onclick = saveLimit;
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') saveLimit();
        if (e.key === 'Escape') closePopup();
    });
    setTimeout(() => {
        input.focus();
        input.select();
    }, 50);
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

function normalizePanelState(rawState) {
    if (!rawState || typeof rawState !== 'object') return null;
    const anchor = rawState.anchor === 'right' || rawState.isRight === true ? 'right' : 'left';
    const legacyOffset = anchor === 'right' ? rawState.right : rawState.left;
    return {
        version: 3,
        collapsed: rawState.collapsed === true || rawState.collapsed === 'true',
        anchor,
        offset: clampNumber(rawState.offset ?? parseFloat(legacyOffset), 4, 5000, 10),
        top: clampNumber(parseFloat(rawState.top), 4, 5000, 40),
    };
}

function saveState() {
    try {
        const panel = document.getElementById('chat-tracker-panel');
        if (!panel) return;
        const rect = panel.getBoundingClientRect();
        const viewport = getViewportBounds();
        const inlineRight = panel.style.right && panel.style.right !== 'auto';
        const inlineLeft = panel.style.left && panel.style.left !== 'auto';
        const anchor = inlineRight
            ? 'right'
            : (inlineLeft ? 'left' : (rect.left + rect.width / 2 > viewport.width / 2 ? 'right' : 'left'));
        const offset = anchor === 'right'
            ? Math.max(4, viewport.width - rect.right)
            : Math.max(4, rect.left);

        const state = {
            version: 3,
            collapsed: Boolean(isCollapsed),
            anchor,
            offset: Math.round(offset),
            top: Math.round(Math.max(4, rect.top)),
            viewportWidth: viewport.width,
            viewportHeight: viewport.height,
        };
        savedPanelState = state;
        localStorage.setItem('chatTracker_settings', JSON.stringify(state));
    } catch (error) {}
}

function loadState() {
    try {
        const saved = localStorage.getItem('chatTracker_settings');
        savedPanelState = normalizePanelState(saved ? JSON.parse(saved) : null);
    } catch (error) {
        savedPanelState = null;
    }

    // После каждой полной загрузки страницы трекер начинает работу свёрнутым.
    // Положение и сторона привязки при этом продолжают восстанавливаться.
    isCollapsed = true;

    loadMaxTokens();
    loadTrackerCustomization();
}

function applySavedPanelState() {
    try {
        const panel = document.getElementById('chat-tracker-panel');
        if (!panel) return;
        const state = savedPanelState || {
            version: 3,
            collapsed: true,
            anchor: 'left',
            offset: 10,
            top: 40,
        };

        panel.style.top = `${state.top}px`;
        panel.style.bottom = 'auto';
        if (state.anchor === 'right') {
            panel.style.right = `${state.offset}px`;
            panel.style.left = 'auto';
        } else {
            panel.style.left = `${state.offset}px`;
            panel.style.right = 'auto';
        }

        setPanelCollapsed(true, { animate: false, save: false });
        applyTrackerCustomization();

        requestAnimationFrame(() => {
            clampElementToViewport(panel, state.anchor);
            requestAnimationFrame(() => {
                clampElementToViewport(panel, state.anchor);
                saveState();
            });
        });
    } catch (error) {}
}

function setupSunnyEvents() {
    bindDelegatedTrackerPressAction('#trigger-sunny-panel', function(e) {
        e?.stopPropagation?.();
        if (!window.extension_settings?.SunnyMemories) {
            toastr.warning(trackerText('sunnyRequired'), trackerText('sunnyPanelName'));
            return;
        }
        isSunnyMode = !isSunnyMode;
        document.getElementById('stat-context-container').style.display = isSunnyMode ? 'none' : 'flex';
        document.getElementById('sunny-panel-tabs').style.display = isSunnyMode ? 'flex' : 'none';
        this.style.color = isSunnyMode ? '#ffcc00' : '';
        this.style.textShadow = isSunnyMode ? '0 0 8px rgba(255, 204, 0, 0.6)' : '';

        if (!isSunnyMode) toggleSunnyPopup(false);
    });

    bindDelegatedTrackerPressAction('.sunny-panel-tab', function(e) {
        e?.stopPropagation?.();
        $('.sunny-panel-tab').removeClass('active');
        $(this).addClass('active');

        const target = $(this).data('tab');
        $('#sunny-popup-title-text').text(getSunnyTabTitle(target));
        $('.sunny-tab-content').removeClass('active');
        $('#sunny-tab-' + target).addClass('active');

        toggleSunnyPopup(true);
    });

    createSunnyPopup();
    bindSunnyBridgeEvents();
}

function cloneSunnyBridgeValue(value) {
    if (!value || typeof value !== 'object') return {};
    try {
        return structuredClone(value);
    } catch (error) {
        try {
            return JSON.parse(JSON.stringify(value));
        } catch (jsonError) {
            return Array.isArray(value) ? [...value] : { ...value };
        }
    }
}

function getSunnySettingsSnapshot() {
    const settings = window.extension_settings?.SunnyMemories;
    return settings && typeof settings === 'object' ? settings : {};
}

function getSunnyActiveCharacter() {
    try {
        const context = SillyTavern.getContext();
        const characterId = Number(context?.characterId);
        if (!Number.isInteger(characterId) || characterId < 0) return null;
        const character = Array.isArray(context?.characters) ? context.characters[characterId] : null;
        return character || null;
    } catch (error) {
        return null;
    }
}

function getSunnyCharacterPayload(extensionKey) {
    const character = getSunnyActiveCharacter();
    return character?.data?.extensions?.[extensionKey];
}

function getSunnyMemorySnapshot() {
    try {
        const context = SillyTavern.getContext();
        const chatMemory = Array.isArray(context?.chat) && context.chat.length > 0
            ? context.chat[0]?.extra?.sunny_memories
            : null;
        // A shallow snapshot is enough: the tracker only reads Sunny data.
        // Avoid deep-cloning the full library on every synchronization pass.
        const memory = chatMemory && typeof chatMemory === 'object' ? { ...chatMemory } : {};
        const settings = getSunnySettingsSnapshot();
        const activeCharacter = getSunnyActiveCharacter();

        if (activeCharacter && String(settings.summaryStorageMode || '').toLowerCase() === 'character') {
            const payload = getSunnyCharacterPayload('sunny_memories_summary');
            const source = payload && typeof payload === 'object' ? payload : {};
            memory.summary = String(source.summary || '');
            memory.previousSummary = String(source.previousSummary || '');
            memory.summarySnapshots = Array.isArray(source.summarySnapshots) ? source.summarySnapshots : [];
            memory.staticSummaryEntries = Array.isArray(source.staticSummaryEntries) ? source.staticSummaryEntries : [];
            memory.summaryEntries = Array.isArray(source.summaryEntries) ? source.summaryEntries : [];
        }

        if (activeCharacter && String(settings.factsStorageMode || '').toLowerCase() === 'character') {
            const payload = getSunnyCharacterPayload('sunny_memories_facts');
            const source = payload && typeof payload === 'object' ? payload : {};
            memory.facts = String(source.facts || '');
            memory.previousFacts = String(source.previousFacts || '');
        }

        if (activeCharacter && String(settings.libraryStorageMode || '').toLowerCase() === 'character') {
            const payload = getSunnyCharacterPayload('sunny_memories_library');
            if (Array.isArray(payload)) {
                memory.library = payload;
            } else if (payload && typeof payload === 'object' && Array.isArray(payload.library)) {
                memory.library = payload.library;
            } else {
                memory.library = [];
            }
        }

        if (activeCharacter && String(settings.timelineStorageMode || '').toLowerCase() === 'character') {
            const payload = getSunnyCharacterPayload('sunny_memories_timeline');
            const source = payload && typeof payload === 'object' ? payload : {};
            memory.quests = Array.isArray(source.quests) ? source.quests : [];
            memory.calendar = source.calendar && typeof source.calendar === 'object'
                ? source.calendar
                : memory.calendar;
        }

        return memory;
    } catch (error) {
        return {};
    }
}

function isSunnyElementVisible(element) {
    if (!element || !element.isConnected) return false;
    try {
        const style = window.getComputedStyle(element);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    } catch (error) {
        return false;
    }
}

function scoreSunnyNativeElement(element, index = 0) {
    if (!element) return -Infinity;
    let score = index / 1000;
    if (isSunnyElementVisible(element)) score += 1000;
    const root = element.closest?.('#sunny_memories_settings');
    if (root && isSunnyElementVisible(root)) score += 400;
    if ('value' in element && String(element.value || '').trim()) score += 80;
    if (!element.disabled) score += 5;
    return score;
}

function getSunnyNativeElements(selector) {
    return Array.from(document.querySelectorAll(selector))
        .map((element, index) => ({ element, score: scoreSunnyNativeElement(element, index) }))
        .sort((a, b) => b.score - a.score)
        .map(item => item.element);
}

function getSunnyNativeElement(selector) {
    return getSunnyNativeElements(selector)[0] || null;
}

function getSunnyNativeField(type) {
    return getSunnyNativeElement(type === 'summary'
        ? '#sunny-memories-output-summary'
        : '#sunny-memories-output-facts');
}

function resolveSunnyText(type, memory = getSunnyMemorySnapshot()) {
    const fields = getSunnyNativeElements(type === 'summary'
        ? '#sunny-memories-output-summary'
        : '#sunny-memories-output-facts');
    const visibleField = fields.find(isSunnyElementVisible);
    if (visibleField) return String(visibleField.value || '');

    const memoryValue = String(type === 'summary' ? memory.summary || '' : memory.facts || '');
    if (memoryValue.trim()) return memoryValue;

    const nonEmptyField = fields.find(field => String(field?.value || '').trim());
    return nonEmptyField ? String(nonEmptyField.value || '') : memoryValue;
}

function setSunnyNativeFieldValue(field, value) {
    if (!field) return false;
    const nextValue = String(value || '');
    if (typeof window.jQuery === 'function') {
        window.jQuery(field).val(nextValue).trigger('input').trigger('change').trigger('blur');
    } else {
        field.value = nextValue;
        field.dispatchEvent(new Event('input', { bubbles: true }));
        field.dispatchEvent(new Event('change', { bubbles: true }));
        field.dispatchEvent(new Event('blur', { bubbles: true }));
    }
    return true;
}

function syncMiniSunnyField(type, options = {}) {
    const mini = document.getElementById(type === 'summary' ? 'mini-sum-area' : 'mini-facts-area');
    const nativeField = getSunnyNativeField(type);
    if (!mini || !nativeField) return false;

    const force = options.force === true;
    if (!force && !miniSunnyFieldDirty[type]) return true;

    const result = setSunnyNativeFieldValue(nativeField, mini.value);
    if (result) miniSunnyFieldDirty[type] = false;
    return result;
}

function isMiniSunnyPopupOpen() {
    const popup = document.getElementById('tracker-sunny-popup');
    return popup?.style.display === 'flex';
}

function clearMiniSunnyRefreshTimers() {
    miniSunnyRefreshTimers.forEach(timer => clearTimeout(timer));
    miniSunnyRefreshTimers = [];
    if (miniSunnyQueuedRefreshTimer) {
        clearTimeout(miniSunnyQueuedRefreshTimer);
        miniSunnyQueuedRefreshTimer = null;
    }
}

function stopMiniSunnySyncInterval() {
    if (miniSunnySyncInterval) {
        clearInterval(miniSunnySyncInterval);
        miniSunnySyncInterval = null;
    }
}

function startMiniSunnySyncInterval() {
    stopMiniSunnySyncInterval();
    // A slow fallback protects against Sunny updates that do not emit DOM events.
    // Event listeners and the targeted observer handle normal updates immediately.
    miniSunnySyncInterval = setInterval(() => {
        if (!isMiniSunnyPopupOpen() || document.hidden) return;
        refreshSunnyPopupIfChanged();
        if (!miniSunnyBridgeObserverRoot?.isConnected) startMiniSunnyBridgeObserver();
    }, 2000);
}

function queueMiniSunnyRefresh(options = {}) {
    const force = options.force === true;
    const delay = Math.max(0, Number(options.delay) || 0);
    if (!force && !isMiniSunnyPopupOpen()) return;

    if (miniSunnyQueuedRefreshTimer) clearTimeout(miniSunnyQueuedRefreshTimer);
    miniSunnyQueuedRefreshTimer = setTimeout(() => {
        miniSunnyQueuedRefreshTimer = null;
        refreshSunnyPopupIfChanged({ force });
    }, delay);
}

function scheduleMiniSunnyRefresh() {
    clearMiniSunnyRefreshTimers();
    // Coalesced checkpoints instead of six eager full redraws.
    [0, 300, 1000, 2400].forEach(delay => {
        miniSunnyRefreshTimers.push(setTimeout(() => {
            refreshSunnyPopupIfChanged();
        }, delay));
    });
}

function getSunnyBridgeSnapshot() {
    const memory = getSunnyMemorySnapshot();
    const summary = resolveSunnyText('summary', memory);
    const facts = resolveSunnyText('facts', memory);
    const library = Array.isArray(memory.library) ? memory.library : [];

    const summaryItems = [];
    const factsItems = [];
    for (const item of library) {
        const type = String(item?.type || '').toLowerCase();
        const target = type === 'summary' ? summaryItems : type === 'facts' ? factsItems : null;
        if (!target || target.length >= 20) continue;
        target.push([
            item?.id,
            item?.type,
            item?.title,
            item?.updatedAt,
            item?.createdAt,
            String(item?.content || '').length,
            String(item?.content || '').slice(0, 80),
            item?.enabled === true,
            item?.pinned === true,
        ]);
        if (summaryItems.length >= 20 && factsItems.length >= 20) break;
    }

    const lastQuest = Array.isArray(memory.quests) && memory.quests.length
        ? memory.quests[memory.quests.length - 1]
        : null;
    const calendarEvents = Array.isArray(memory.calendar?.events) ? memory.calendar.events : [];
    const lastEvent = calendarEvents.length ? calendarEvents[calendarEvents.length - 1] : null;

    const signature = JSON.stringify({
        summary,
        facts,
        previousSummary: memory.previousSummary || '',
        previousFacts: memory.previousFacts || '',
        libraryLength: library.length,
        summaries: summaryItems,
        factsEntries: factsItems,
        quest: [lastQuest?.id, lastQuest?.status, lastQuest?.title, lastQuest?.name, lastQuest?.updatedAt],
        event: [lastEvent?.id, lastEvent?.description, lastEvent?.title, lastEvent?.updatedAt],
    });

    return { memory, summary, facts, signature };
}

function getSunnyBridgeSignature() {
    return getSunnyBridgeSnapshot().signature;
}

function refreshSunnyPopupIfChanged(options = {}) {
    const force = options.force === true;
    if (!force && !isMiniSunnyPopupOpen()) return false;

    const snapshot = options.snapshot || getSunnyBridgeSnapshot();
    if (!force && snapshot.signature === miniSunnyLastBridgeSignature) return false;

    miniSunnyLastBridgeSignature = snapshot.signature;
    updateSunnyPopupData({ force, snapshot });
    return true;
}

function isSunnyNativeBusy(button = null) {
    if (button?.disabled) return true;
    const transientField = document.querySelector(
        '#sunny-memories-output-summary[data-sm-transient="generation"], #sunny-memories-output-facts[data-sm-transient="generation"]',
    );
    if (transientField) return true;
    return getSunnyNativeElements('.sm-generate-btn.sm-glow-active, .sm-save-lib-btn:disabled, .sm-split-lib-btn:disabled')
        .some(element => element.disabled || element.classList.contains('sm-glow-active'));
}

function watchSunnyNativeAction(button = null, beforeSignature = getSunnyBridgeSignature()) {
    const watchId = ++miniSunnyActionWatchId;
    const startedAt = Date.now();
    let changedAt = 0;
    let sawBusy = false;
    let idleAfterBusyAt = 0;

    const tick = () => {
        if (watchId !== miniSunnyActionWatchId || !isMiniSunnyPopupOpen()) return;

        const now = Date.now();
        const snapshot = getSunnyBridgeSnapshot();
        const changed = snapshot.signature !== beforeSignature;
        const busy = isSunnyNativeBusy(button);

        if (changed) {
            if (!changedAt) changedAt = now;
            refreshSunnyPopupIfChanged({ snapshot });
        }
        if (busy) {
            sawBusy = true;
            idleAfterBusyAt = 0;
        } else if (sawBusy && !idleAfterBusyAt) {
            idleAfterBusyAt = now;
        }

        const settledAfterChange = changedAt && !busy && now - changedAt >= 650;
        const settledWithoutChange = idleAfterBusyAt && !busy && now - idleAfterBusyAt >= 1000;
        const didNotStart = !sawBusy && !changed && now - startedAt >= 2500;
        const timedOut = now - startedAt >= 300000;
        if (settledAfterChange || settledWithoutChange || didNotStart || timedOut) {
            scheduleMiniSunnyRefresh();
            return;
        }

        const elapsed = now - startedAt;
        const nextDelay = elapsed < 2500 ? 300 : elapsed < 10000 ? 650 : elapsed < 30000 ? 1200 : 2000;
        setTimeout(tick, nextDelay);
    };

    setTimeout(tick, 100);
}

function inferSunnyActionType(element) {
    if (!element) return null;
    if (element.matches('.sm-generate-btn[data-type="summary"]')) return 'summary';
    if (element.matches('.sm-generate-btn[data-type="facts"]')) return 'facts';
    if (element.matches('.sm-save-lib-btn[data-type="summary"]')) return 'summary';
    if (element.matches('.sm-save-lib-btn[data-type="facts"], .sm-split-lib-btn')) return 'facts';
    return null;
}

function stopMiniSunnyBridgeObserver() {
    if (miniSunnyBridgeObserver) miniSunnyBridgeObserver.disconnect();
    miniSunnyBridgeObserver = null;
    miniSunnyBridgeObserverRoot = null;
}

function startMiniSunnyBridgeObserver() {
    stopMiniSunnyBridgeObserver();
    if (!isMiniSunnyPopupOpen() || typeof MutationObserver !== 'function') return;

    const roots = getSunnyNativeElements('#sunny_memories_settings');
    const root = roots.find(isSunnyElementVisible) || roots[0] || null;
    if (!root) return;

    miniSunnyBridgeObserverRoot = root;
    miniSunnyBridgeObserver = new MutationObserver(mutations => {
        if (!isMiniSunnyPopupOpen()) return;
        const relevant = mutations.some(mutation => {
            const target = mutation.target;
            if (!(target instanceof Element)) return mutation.type === 'characterData';
            return target.matches?.(
                '#sunny-memories-output-summary, #sunny-memories-output-facts, .sm-generate-btn, .sm-save-lib-btn, .sm-split-lib-btn, .sm-library-list, .sm-lib-item',
            ) || Boolean(target.closest?.(
                '#sunny-memories-output-summary, #sunny-memories-output-facts, .sm-library-list, .sm-lib-item',
            ));
        });
        if (relevant) queueMiniSunnyRefresh({ delay: 80 });
    });

    miniSunnyBridgeObserver.observe(root, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['class', 'disabled', 'data-sm-transient'],
    });
}

function bindSunnyBridgeEvents() {
    if (miniSunnyBridgeBound) return;
    miniSunnyBridgeBound = true;

    const nativeFieldSelector = '#sunny-memories-output-summary, #sunny-memories-output-facts';
    const nativeActionSelector = '.sm-generate-btn, .sm-save-lib-btn, .sm-split-lib-btn, .sm-restore-btn, #sm-restore-confirm';

    ['input', 'change', 'blur'].forEach(eventName => {
        document.addEventListener(eventName, event => {
            if (!isMiniSunnyPopupOpen()) return;
            const target = event.target;
            if (!(target instanceof Element) || !target.matches(nativeFieldSelector)) return;
            const type = target.id === 'sunny-memories-output-summary' ? 'summary' : 'facts';
            miniSunnyFieldDirty[type] = false;
            queueMiniSunnyRefresh({ delay: eventName === 'input' ? 90 : 0 });
        }, true);
    });

    document.addEventListener('click', event => {
        if (!isMiniSunnyPopupOpen()) return;
        const target = event.target instanceof Element ? event.target.closest(nativeActionSelector) : null;
        if (!target || target.closest('#tracker-sunny-popup')) return;
        const beforeSignature = getSunnyBridgeSignature();
        const type = inferSunnyActionType(target);
        if (type) miniSunnyFieldDirty[type] = false;
        setTimeout(() => watchSunnyNativeAction(target, beforeSignature), 0);
    }, true);

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && isMiniSunnyPopupOpen()) {
            queueMiniSunnyRefresh({ force: true });
            startMiniSunnyBridgeObserver();
        }
    });
}

function invokeSunnyNativeAction(action) {
    const actions = {
        summaryGenerate: { selector: '.sm-generate-btn[data-type="summary"]', type: 'summary', sync: 'dirty' },
        summaryLibrary: { selector: '.sm-save-lib-btn[data-type="summary"]', type: 'summary', sync: 'always' },
        factsGenerate: { selector: '.sm-generate-btn[data-type="facts"]', type: 'facts', sync: 'dirty' },
        factsLibrary: { selector: '.sm-save-lib-btn[data-type="facts"]', type: 'facts', sync: 'always' },
        factsSplit: { selector: '.sm-split-lib-btn', type: 'facts', sync: 'always' },
        questsGenerate: { selector: '#sm-btn-generate-quests' },
        eventsGenerate: { selector: '#sm-btn-generate-events' },
    };

    const config = actions[action];
    if (!config) return false;

    if (config.type) {
        const shouldSync = config.sync === 'always' || miniSunnyFieldDirty[config.type];
        if (shouldSync && !syncMiniSunnyField(config.type, { force: true })) {
            toastr.warning(trackerText('sunnyControlMissing'), trackerText('sunnyPanelName'));
            return false;
        }
    }

    const nativeButton = getSunnyNativeElement(config.selector);
    if (!nativeButton) {
        toastr.warning(trackerText('sunnyControlMissing'), trackerText('sunnyPanelName'));
        return false;
    }
    if (nativeButton.disabled) {
        toastr.info(trackerText('sunnyActionBusy'), trackerText('sunnyPanelName'));
        return false;
    }

    const beforeSignature = getSunnyBridgeSignature();
    nativeButton.click();
    watchSunnyNativeAction(nativeButton, beforeSignature);
    queueMiniSunnyRefresh({ delay: 0 });
    return true;
}

function openSunnyMemories(tab = null) {
    toggleSunnyPopup(false);

    const memoriesMainButton = getSunnyNativeElement('#sm-main-btn-memories');
    if (memoriesMainButton) memoriesMainButton.click();

    if (tab) {
        const tabButton = getSunnyNativeElement(`.sm-tab-btn[data-tab="${tab}"]`);
        if (tabButton) tabButton.click();
    }

    const smRoots = getSunnyNativeElements('#sunny_memories_settings');
    const activeRoot = smRoots.find(isSunnyElementVisible) || smRoots[0] || null;
    const drawer = activeRoot ? $(activeRoot).closest('.drawer-content') : $();
    if (drawer.length > 0 && activeRoot) {
        const root = $(activeRoot);
        drawer.animate({ scrollTop: root.offset().top - drawer.offset().top + drawer.scrollTop() }, 300);
    }
}

function renderSunnyLibraryPreview(memory = null, options = {}) {
    const list = document.getElementById('mini-library-list');
    const meta = document.getElementById('mini-library-meta');
    if (!list) return;

    const sourceMemory = memory || getSunnyMemorySnapshot();
    const library = Array.isArray(sourceMemory.library) ? sourceMemory.library : [];
    const type = miniSunnyLibraryType === 'facts' ? 'facts' : 'summary';
    const typedItems = library.filter(item => String(item?.type || '').toLowerCase() === type);
    const visibleItems = typedItems.slice(0, 20);
    const renderSignature = JSON.stringify({
        language: getTrackerLanguage(),
        type,
        total: typedItems.length,
        items: visibleItems.map(item => [
            item?.id,
            item?.title,
            item?.updatedAt,
            item?.createdAt,
            item?.content,
            item?.enabled === true,
            item?.pinned === true,
        ]),
    });

    if (!options.force && renderSignature === miniSunnyLastLibraryRenderSignature) return;
    miniSunnyLastLibraryRenderSignature = renderSignature;

    document.querySelectorAll('.sunny-library-filter').forEach(button => {
        button.classList.toggle('active', button.getAttribute('data-library-type') === type);
    });

    if (meta) {
        meta.textContent = typedItems.length > 20
            ? `${trackerText('libraryShowing')} · 20/${typedItems.length}`
            : `${trackerText('libraryShowing')} · ${typedItems.length}`;
    }

    list.replaceChildren();

    if (!visibleItems.length) {
        const empty = document.createElement('div');
        empty.className = 'sunny-library-empty';
        empty.textContent = trackerText(type === 'summary' ? 'libraryEmptySummary' : 'libraryEmptyFacts');
        list.appendChild(empty);
        return;
    }

    visibleItems.forEach(item => {
        const entry = document.createElement('div');
        entry.className = 'sunny-library-entry';

        const head = document.createElement('div');
        head.className = 'sunny-library-entry-head';

        const title = document.createElement('div');
        title.className = 'sunny-library-entry-title';
        title.textContent = String(item?.title || trackerText('libraryUntitled'));
        title.title = title.textContent;

        const badges = document.createElement('div');
        badges.className = 'sunny-library-entry-badges';
        if (item?.pinned) {
            const pin = document.createElement('i');
            pin.className = 'fa-solid fa-thumbtack';
            pin.title = trackerText('libraryPinned');
            badges.appendChild(pin);
        }
        if (item?.enabled) {
            const active = document.createElement('i');
            active.className = 'fa-solid fa-sun';
            active.title = trackerText('libraryActive');
            badges.appendChild(active);
        }

        const content = document.createElement('div');
        content.className = 'sunny-library-entry-content';
        content.textContent = String(item?.content || '').trim();

        head.append(title, badges);
        entry.append(head, content);
        list.appendChild(entry);
    });
}

function createSunnyPopup() {
    if (document.getElementById('tracker-sunny-popup')) return;

    const popup = document.createElement('div');
    popup.id = 'tracker-sunny-popup';
    popup.className = 'tracker-popup beautiful-popup';

    popup.innerHTML = `
        <div class="tracker-popup-header beautiful-header" id="tracker-sunny-drag">
            <div class="beautiful-title"><i class="fa-solid fa-sun"></i><span id="sunny-popup-title-text">${trackerText('summaryTitle')}</span></div>
            <span class="tracker-popup-close" id="tracker-sunny-close" title="${trackerText('close')}" aria-label="${trackerText('close')}">&times;</span>
        </div>
        <div class="tracker-popup-body beautiful-body">
            <div class="sunny-tab-content active" id="sunny-tab-sum">
                <textarea id="mini-sum-area" class="beautiful-textarea" placeholder="${trackerText('summaryPlaceholder')}"></textarea>
                <div class="beautiful-actions sunny-compact-actions sunny-summary-actions">
                    <button class="beautiful-btn beautiful-btn-primary" id="mini-sum-gen" title="${trackerText('generateSummary')}"><i class="fa-solid fa-wand-magic-sparkles"></i><span>${trackerText('generateShort')}</span></button>
                    <button class="beautiful-btn" id="mini-sum-restore" title="${trackerText('restore')}"><i class="fa-solid fa-rotate-left"></i><span>${trackerText('restoreShort')}</span></button>
                    <button class="beautiful-btn" id="mini-sum-lib" title="${trackerText('toLibrary')}"><i class="fa-solid fa-book"></i><span>${trackerText('toLibraryShort')}</span></button>
                </div>
            </div>

            <div class="sunny-tab-content" id="sunny-tab-facts">
                <textarea id="mini-facts-area" class="beautiful-textarea" placeholder="${trackerText('factsPlaceholder')}"></textarea>
                <div class="beautiful-actions sunny-compact-actions sunny-facts-actions">
                    <button class="beautiful-btn beautiful-btn-primary" id="mini-facts-gen" title="${trackerText('extractFacts')}"><i class="fa-solid fa-wand-magic-sparkles"></i><span>${trackerText('extractShort')}</span></button>
                    <button class="beautiful-btn" id="mini-facts-restore" title="${trackerText('restore')}"><i class="fa-solid fa-rotate-left"></i><span>${trackerText('restoreShort')}</span></button>
                    <button class="beautiful-btn" id="mini-facts-split" title="${trackerText('split')}"><i class="fa-solid fa-object-ungroup"></i><span>${trackerText('splitShort')}</span></button>
                    <button class="beautiful-btn" id="mini-facts-lib" title="${trackerText('toLibrary')}"><i class="fa-solid fa-book"></i><span>${trackerText('toLibraryShort')}</span></button>
                </div>
            </div>

            <div class="sunny-tab-content" id="sunny-tab-qc">
                <div id="mini-qc-display" class="sunny-info-card">
                    <div class="sunny-info-item"><span class="sunny-info-label">${trackerText('lastQuest')}</span><span id="mini-last-quest">${trackerText('none')}</span></div>
                    <div class="sunny-info-item"><span class="sunny-info-label">${trackerText('lastEvent')}</span><span id="mini-last-event">${trackerText('none')}</span></div>
                </div>
                <div class="beautiful-actions sunny-compact-actions">
                    <button class="beautiful-btn beautiful-btn-primary" id="mini-quest-gen"><i class="fa-solid fa-scroll"></i><span>${trackerText('extractQuests')}</span></button>
                    <button class="beautiful-btn beautiful-btn-primary" id="mini-event-gen"><i class="fa-solid fa-calendar-day"></i><span>${trackerText('extractEvents')}</span></button>
                </div>
            </div>

            <div class="sunny-tab-content" id="sunny-tab-lib">
                <div class="sunny-library-toolbar">
                    <button class="sunny-library-filter active" data-library-type="summary">${trackerText('librarySummaries')}</button>
                    <button class="sunny-library-filter" data-library-type="facts">${trackerText('libraryFacts')}</button>
                </div>
                <div class="sunny-library-meta" id="mini-library-meta"></div>
                <div class="sunny-library-list" id="mini-library-list"></div>
                <button class="beautiful-btn sunny-open-full" id="mini-open-main"><i class="fa-solid fa-arrow-up-right-from-square"></i><span>${trackerText('openFullSunny')}</span></button>
            </div>
        </div>
    `;

    document.body.appendChild(popup);
    if (!isCompactMobileLayout()) {
        setupDraggable(popup, document.getElementById('tracker-sunny-drag'));
    }

    $('#tracker-sunny-close').on('click', () => toggleSunnyPopup(false));

    let miniTypingTimer;
    $('#mini-sum-area, #mini-facts-area').on('input', function() {
        const type = $(this).attr('id') === 'mini-sum-area' ? 'summary' : 'facts';
        miniSunnyFieldDirty[type] = true;
        clearTimeout(miniTypingTimer);
        miniTypingTimer = setTimeout(() => syncMiniSunnyField(type), 700);
    });
    $('#mini-sum-area, #mini-facts-area').on('blur', function() {
        const type = $(this).attr('id') === 'mini-sum-area' ? 'summary' : 'facts';
        clearTimeout(miniTypingTimer);
        syncMiniSunnyField(type, { force: true });
        scheduleMiniSunnyRefresh();
    });

    $('#mini-sum-gen').on('click', () => invokeSunnyNativeAction('summaryGenerate'));
    $('#mini-sum-lib').on('click', () => invokeSunnyNativeAction('summaryLibrary'));
    $('#mini-facts-gen').on('click', () => invokeSunnyNativeAction('factsGenerate'));
    $('#mini-facts-split').on('click', () => invokeSunnyNativeAction('factsSplit'));
    $('#mini-facts-lib').on('click', () => invokeSunnyNativeAction('factsLibrary'));
    $('#mini-quest-gen').on('click', () => invokeSunnyNativeAction('questsGenerate'));
    $('#mini-event-gen').on('click', () => invokeSunnyNativeAction('eventsGenerate'));

    $('#mini-sum-restore').on('click', () => restoreMiniSunnyValue('summary'));
    $('#mini-facts-restore').on('click', () => restoreMiniSunnyValue('facts'));

    $('.sunny-library-filter').on('click', function() {
        miniSunnyLibraryType = $(this).data('library-type') === 'facts' ? 'facts' : 'summary';
        miniSunnyLastLibraryRenderSignature = '';
        renderSunnyLibraryPreview(null, { force: true });
    });

    $('#mini-open-main').on('click', () => openSunnyMemories('library'));
    renderSunnyLibraryPreview();
}

function restoreMiniSunnyValue(type) {
    const memory = getSunnyMemorySnapshot();
    const previous = type === 'summary' ? memory.previousSummary : memory.previousFacts;
    if (previous === undefined || previous === null || String(previous).trim() === '') {
        toastr.info(trackerText('nothingToRestore'), trackerText('sunnyPanelName'));
        return;
    }

    const mini = document.getElementById(type === 'summary' ? 'mini-sum-area' : 'mini-facts-area');
    if (mini) {
        mini.value = String(previous || '');
        miniSunnyFieldDirty[type] = true;
    }
    if (!syncMiniSunnyField(type, { force: true })) {
        toastr.warning(trackerText('sunnyControlMissing'), trackerText('sunnyPanelName'));
        return;
    }
    scheduleMiniSunnyRefresh();
    toastr.success(
        trackerText(type === 'summary' ? 'summaryRestored' : 'factsRestored'),
        trackerText('sunnyPanelName'),
    );
}

function updateSunnyPopupData(options = {}) {
    const snapshot = options.snapshot || getSunnyBridgeSnapshot();
    const memory = snapshot.memory;
    const force = options.force === true;

    const sumArea = document.getElementById('mini-sum-area');
    const factsArea = document.getElementById('mini-facts-area');

    if (sumArea && document.activeElement !== sumArea && (force || !miniSunnyFieldDirty.summary)) {
        const nextSummary = String(snapshot.summary || '');
        if (sumArea.value !== nextSummary) sumArea.value = nextSummary;
    }
    if (factsArea && document.activeElement !== factsArea && (force || !miniSunnyFieldDirty.facts)) {
        const nextFacts = String(snapshot.facts || '');
        if (factsArea.value !== nextFacts) factsArea.value = nextFacts;
    }

    const questEl = document.getElementById('mini-last-quest');
    const eventEl = document.getElementById('mini-last-event');
    if (questEl && eventEl) {
        let lastQuest = trackerText('none');
        if (Array.isArray(memory.quests) && memory.quests.length > 0) {
            const activeQuests = memory.quests.filter(quest => quest?.status === 'current');
            const selectedQuest = activeQuests.length > 0
                ? activeQuests[activeQuests.length - 1]
                : memory.quests[memory.quests.length - 1];
            lastQuest = selectedQuest?.title || selectedQuest?.name || trackerText('none');
        }

        let lastEvent = trackerText('none');
        const calendarEvents = memory.calendar?.events;
        if (Array.isArray(calendarEvents) && calendarEvents.length > 0) {
            const selectedEvent = calendarEvents[calendarEvents.length - 1];
            lastEvent = selectedEvent?.description || selectedEvent?.title || trackerText('none');
        }

        const questValue = String(lastQuest || trackerText('none'));
        const eventValue = String(lastEvent || trackerText('none'));
        const questText = questValue.length > 60 ? `${questValue.substring(0, 60)}…` : questValue;
        const eventText = eventValue.length > 60 ? `${eventValue.substring(0, 60)}…` : eventValue;
        if (questEl.textContent !== questText) questEl.textContent = questText;
        if (eventEl.textContent !== eventText) eventEl.textContent = eventText;
    }

    renderSunnyLibraryPreview(memory, { force });
}

function toggleSunnyPopup(show) {
    const popup = document.getElementById('tracker-sunny-popup');
    if (!popup) return;

    if (show) {
        showTrackerPopup(popup, 360);
        miniSunnyLastBridgeSignature = '';
        miniSunnyLastLibraryRenderSignature = '';
        refreshSunnyPopupIfChanged({ force: true });
        if (!popup.dataset.userPositioned || isCompactMobileLayout()) {
            positionPopupNearPanel(popup, 360);
        }
        startMiniSunnyBridgeObserver();
        startMiniSunnySyncInterval();
    } else {
        popup.style.display = 'none';
        miniSunnyActionWatchId += 1;
        clearMiniSunnyRefreshTimers();
        stopMiniSunnySyncInterval();
        stopMiniSunnyBridgeObserver();
    }
}
