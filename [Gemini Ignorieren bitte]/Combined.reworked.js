// ==UserScript==
// @name         Combined r34 Scripts++ (Reworked Smooth Loading)
// @namespace    http://tampermonkey.net/
// @version      5.0.0-reworked
// @description  Combined rule34 helpers with smoother infinite scroll, safer config handling, and reduced image-loading stutter.
// @author       Codex
// @match        https://rule34.xxx/*
// @icon         data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEABAMAAACuXLVVAAAAElBMVEX///8AAAAAGVQALYondf////+67aQPAAAAAXRSTlMBN+Ho8AAAAShJREFUeNrt3c0RgyAQBlBbsIW0kBbSgv23kotcNsPwM0xck/fdkAUfNwdG3bYzzy9niwEAAAAAAAC4DBA7jkr2kN4btcYDAAAAAAAA5AHUCktGIb0LAAAAAAAAAMgD2BvpBcQ6AAAAAAAAgPsCRjcaav0AAAAAAAAA9wHMHljM9pcAAAAAAAAA5AOMblAckwEAAAAAAAD4HcDsQQcAAAAAAABAPkAsHD2wqC0EAAAAAAAA4D6A1oZDbYJlLzwCAAAAAAAApAH0pvcDCK1xAAAAAAAAAHkAvZBS92gkzlcbBwAAAAAAAJAHUC68zpSBsb26DgAAAAAAACAfoDXh6joAAAAAAACAfABPRAAAAAAAAP8HKIkPELX2qrqPPzwCAAAAAAAAXAV4A8N+Sq06PvkiAAAAAElFTkSuQmCC
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM.xmlHttpRequest
// @grant        unsafeWindow
// @connect      api.rule34.xxx
// @connect      rule34.xxx
// @connect      wimg.rule34.xxx
// @connect      api-cdn.rule34.xxx
// ==/UserScript==

(function() {
    'use strict';

    const API_KEY_NAME = 'r34_api_key';
    const USER_ID_NAME = 'r34_user_id';
    const REMINDER_KEY = 'r34_api_reminder';
    const FEATURE_FLAGS_KEY = 'r34_feature_flags';
    const HEADER_FIXED_KEY = 'r34_header_fixed';
    const BUTTON_POS_KEY = 'r34_button_pos';
    const BUTTON_VISIBLE_KEY = 'r34_button_visible';

    const CONSTANTS = {
        PER_PAGE_FAVORITES: 50,
        PER_PAGE_DEFAULT: 42,
        HEADER_COLLAPSED_HEIGHT: '40px',
        HEADER_EXPAND_DELAY_MS: 250,
        HEADER_COLLAPSE_DELAY_MS: 100,
        DEBOUNCE_MUTATION_MS: 120,
        DEBOUNCE_URL_MS: 150,
        BANNER_DISPLAY_MS: 3000,
        API_TIMEOUT_MS: 10000,
        API_RETRY_ATTEMPTS: 3,
        IMAGE_ROOT_MARGIN: '900px 0px',
        IMAGE_NEAR_VIEWPORT: 1.1,
        IMAGE_CONCURRENT_LIMIT: 2,
        IMAGE_REVEAL_BATCH_SIZE: 10,
        IMAGE_REVEAL_PAUSE_MS: 20,
        CHUNK_APPEND_SIZE: 10,
        CHUNK_APPEND_PAUSE_MS: 18,
        INFINITE_SCROLL_THRESHOLD: '1400px 0px',
        PAGETUAL_DETECT_SELECTORS: ['.pagetual_page', '.pg-page', '#autopagerize_page_separator']
    };

    const DEFAULT_CONFIG = {
        favoriteOnMouse: true,
        hideBlacklisted: true,
        removeDuplicates: true,
        removeAnnoyances: true,
        collapsibleHeader: true,
        fixPaginatorLinks: true,
        removePidParameter: true,
        nativeLazyLoading: true,
        restoreDeletedPost: true,
        hideEmptyThumbSpans: true,
        faviconChanger: true,
        pageIndicator: true,
        removeThumbTitles: true,
        apiInfiniteScroll: false,
        advancedImageLoading: true
    };

    const ICON_MAP = [
        { match: 'page=post&s=view&id=', icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEABAMAAACuXLVVAAAAElBMVEX///8AAAAAGVQALYondf////+67aQPAAAAAXRSTlMBN+Ho8AAAAShJREFUeNrt3c0RgyAQBlBbsIW0kBbSgv23kotcNsPwM0xck/fdkAUfNwdG3bYzzy9niwEAAAAAAAC4DBA7jkr2kN4btcYDAAAAAAAA5AHUCktGIb0LAAAAAAAAAMgD2BvpBcQ6AAAAAAAAgPsCRjcaav0AAAAAAAAA9wHMHljM9pcAAAAAAAAA5AOMblAckwEAAAAAAAD4HcDsQQcAAAAAAABAPkAsHD2wqC0EAAAAAAAA4D6A1oZDbYJlLzwCAAAAAAAApAH0pvcDCK1xAAAAAAAAAHkAvZBS92gkzlcbBwAAAAAAAJAHUC68zpSBsb26DgAAAAAAACAfoDXh6joAAAAAAACAfABPRAAAAAAAAP8HKIkPELX2qrqPPzwCAAAAAAAAXAV4A8N+Sq06PvkiAAAAAElFTkSuQmCC' },
        { match: 'user:', icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEABAMAAACuXLVVAAAAElBMVEX///8AAABVAHmNAMrNnf////9vNKohAAAAAXRSTlMBN+Ho8AAAAShJREFUeNrt3c0RgyAQBlBbsIW0kBbSgv23kotcNsPwM0xck/fdkAUfNwdG3bYzzy9niwEAAAAAAAC4DBA7jkr2kN4btcYDAAAAAAAA5AHUCktGIb0LAAAAAAAAAMgD2BvpBcQ6AAAAAAAAgPsCRjcaav0AAAAAAAAA9wHMHljM9pcAAAAAAAAA5AOMblAckwEAAAAAAAD4HcDsQQcAAAAAAABAPkAsHD2wqC0EAAAAAAAA4D6A1oZDbYJlLzwCAAAAAAAApAH0pvcDCK1xAAAAAAAAAHkAvZBS92gkzlcbBwAAAAAAAJAHUC68zpSBsb26DgAAAAAAACAfoDXh6joAAAAAAACAfABPRAAAAAAAAP8HKIkPELX2qrqPPzwCAAAAAAAAXAV4A8N+Sq06PvkiAAAAAElFTkSuQmCC' },
        { match: 'page=account&s=profile&uname=', icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEABAMAAACuXLVVAAAAElBMVEX///8AAAATExMgICBISEj///+FO3OXAAAAAXRSTlMBN+Ho8AAAAShJREFUeNrt3c0RgyAQBlBbsIW0kBbSgv23kotcNsPwM0xck/fdkAUfNwdG3bYzzy9niwEAAAAAAAC4DBA7jkr2kN4btcYDAAAAAAAA5AHUCktGIb0LAAAAAAAAAMgD2BvpBcQ6AAAAAAAAgPsCRjcaav0AAAAAAAAA9wHMHljM9pcAAAAAAAAA5AOMblAckwEAAAAAAAD4HcDsQQcAAAAAAABAPkAsHD2wqC0EAAAAAAAA4D6A1oZDbYJlLzwCAAAAAAAApAH0pvcDCK1xAAAAAAAAAHkAvZBS92gkzlcbBwAAAAAAAJAHUC68zpSBsb26DgAAAAAAACAfoDXh6joAAAAAAACAfABPRAAAAAAAAP8HKIkPELX2qrqPPzwCAAAAAAAAXAV4A8N+Sq06PvkiAAAAAElFTkSuQmCC' },
        { match: 'page=favorites&s=view&id=', icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAQAAAAEABAMAAACuXLVVAAAAElBMVEX///8AAABOAACBEBD/UVH///9FPR7/AAAAAXRSTlMBN+Ho8AAAAShJREFUeNrt3c0RgyAQBlBbsIW0kBbSgv23kotcNsPwM0xck/fdkAUfNwdG3bYzzy9niwEAAAAAAAC4DBA7jkr2kN4btcYDAAAAAAAA5AHUCktGIb0LAAAAAAAAAMgD2BvpBcQ6AAAAAAAAgPsCRjcaav0AAAAAAAAA9wHMHljM9pcAAAAAAAAA5AOMblAckwEAAAAAAAD4HcDsQQcAAAAAAABAPkAsHD2wqC0EAAAAAAAA4D6A1oZDbYJlLzwCAAAAAAAApAH0pvcDCK1xAAAAAAAAAHkAvZBS92gkzlcbBwAAAAAAAJAHUC68zpSBsb26DgAAAAAAACAfoDXh6joAAAAAAACAfABPRAAAAAAAAP8HKIkPELX2qrqPPzwCAAAAAAAAXAV4A8N+Sq06PvkiAAAAAElFTkSuQmCC' }
    ];

    const state = {
        observers: [],
        cleanups: [],
        historyWrapped: false,
        initializedFeatures: new Set(),
        controllers: new Map()
    };

    function getPerPage() {
        return location.href.includes('page=favorites')
            ? CONSTANTS.PER_PAGE_FAVORITES
            : CONSTANTS.PER_PAGE_DEFAULT;
    }

    function safeJsonParse(value, fallback) {
        if (!value) return fallback;
        try {
            return JSON.parse(value);
        } catch (error) {
            console.warn('[Userscript] Invalid JSON in storage, using fallback.', error);
            return fallback;
        }
    }

    function loadConfig() {
        const stored = safeJsonParse(localStorage.getItem(FEATURE_FLAGS_KEY), {});
        return { ...DEFAULT_CONFIG, ...stored };
    }

    let CONFIG = loadConfig();
    window.CONFIG = CONFIG;

    const performanceMonitor = {
        enabled: false,
        timings: new Map(),
        start(label) {
            if (!this.enabled) return;
            this.timings.set(label, performance.now());
        },
        end(label) {
            if (!this.enabled) return;
            const start = this.timings.get(label);
            if (!start) return;
            const duration = performance.now() - start;
            console.debug(`[Performance] ${label}: ${duration.toFixed(2)}ms`);
            this.timings.delete(label);
        }
    };

    function debounce(fn, ms) {
        let timeoutId;
        return (...args) => {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => fn(...args), ms);
        };
    }

    function wait(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    function on(target, type, handler, options) {
        target.addEventListener(type, handler, options);
        state.cleanups.push(() => target.removeEventListener(type, handler, options));
    }

    function trackObserver(observer) {
        state.observers.push(observer);
        return observer;
    }

    function isTextInput(element) {
        return element?.tagName === 'INPUT' || element?.tagName === 'TEXTAREA';
    }

    function isPagetualPresent() {
        if (typeof unsafeWindow.Pagetual !== 'undefined') return true;
        return CONSTANTS.PAGETUAL_DETECT_SELECTORS.some((selector) => document.querySelector(selector));
    }

    function chunkArray(items, size) {
        const chunks = [];
        for (let i = 0; i < items.length; i += size) {
            chunks.push(items.slice(i, i + size));
        }
        return chunks;
    }

    function htmlRequest(options) {
        return Promise.resolve(GM.xmlHttpRequest(options));
    }

    function buildApiUrl(params) {
        const url = new URL('https://api.rule34.xxx/index.php');
        Object.entries(params).forEach(([key, value]) => {
            if (value !== '' && value !== null && value !== undefined) {
                url.searchParams.set(key, String(value));
            }
        });
        return url.toString();
    }

    GM_addStyle(`
        #header { transition: height 0.3s ease; overflow: hidden; }
        .header-fix-btn { position: absolute; top: 5px; right: 10px; z-index: 1000; padding: 2px 6px; font-size: 12px; cursor: pointer; background: #222; color: #fff; border: 1px solid #444; border-radius: 4px; }
        .r34-panel-btn { position:absolute; z-index:10000; padding:4px 8px; font-size:12px; background:#222; color:#eee; border:1px solid #444; border-radius:0; cursor:move; user-select:none; }
        .r34-panel { position:absolute; background:#1a1a1a; color:#eee; padding:15px; border-radius:8px; font-size:12px; z-index:9999; display:none; font-family:sans-serif; border:1px solid #555; min-width:280px; }
        .r34-panel form label { display:block; margin-bottom:5px; cursor:pointer; }
        .r34-panel form input { margin-right:8px; }
        .r34-panel form strong { color:#0af; margin-top:10px; display:block; border-bottom:1px solid #444; padding-bottom:3px; margin-bottom:8px; }
        .r34-panel button { margin-top:15px; padding:5px 10px; color:#fff; border:none; border-radius:4px; cursor:pointer; margin-right:4px; }
        .r34-panel .save-btn { background:#0af; }
        .r34-panel .cancel-btn { background:#444; }
        .r34-panel .minimize-btn { position:absolute; right:5px; top:5px; padding:0 5px; margin:0; background:#333; font-size:14px; }
        #page-indicator { position:fixed; bottom:10px; right:10px; background:rgba(30,30,30,0.9); color:#fff; padding:6px 12px; border-radius:20px; font-size:13px; font-family:monospace; z-index:9999; pointer-events:none; backdrop-filter:blur(5px); border:1px solid #444; box-shadow:0 2px 8px rgba(0,0,0,0.3); display:none; }
        .blacklisted-image.thumb, span.blacklisted-image, div.a_list#lmid, div[style*="display: inline-flex"], div.horizontalFlexWithMargins[style*="justify-content: center"], .exo-native-widget-outer-container, span[data-nosnippet] { display:none !important; }
        #r34-modal-overlay { position:fixed; top:0; left:0; width:100%; height:100%; background-color:rgba(0,0,0,0.7); display:flex; justify-content:center; align-items:center; z-index:99999; font-family:sans-serif; }
        #r34-modal-content { background-color:#1e1e1e; color:#eee; padding:20px 30px; border-radius:8px; text-align:center; max-width:400px; border:1px solid #555; }
        #r34-modal-content p { margin:0 0 20px 0; line-height:1.5; }
        #r34-modal-buttons button, #r34-manual-input button { background-color:#333; color:#fff; border:1px solid #555; padding:10px 15px; border-radius:5px; cursor:pointer; margin:0 10px; }
        #r34-manual-input { margin-top:20px; }
        #r34-manual-input input { display:block; width:calc(100% - 20px); margin:10px auto; padding:8px; background-color:#333; border:1px solid #555; color:#fff; border-radius:4px; }
        .tooltip-info { cursor:help; margin-left:4px; opacity:0.7; }
        .tooltip-info:hover { opacity:1; }
        #api-scroll-indicator { text-align:center; padding:10px; color:#888; font-size:12px; display:none; }
        .thumb { position:relative; overflow:hidden; }
        .thumb img { display:block; width:100%; height:auto; }
        .r34-thumb-shell { position:relative; width:100%; aspect-ratio:150 / 112; background:#222; overflow:hidden; }
        .r34-thumb-shell img { width:100%; height:100%; object-fit:cover; opacity:0; transition:opacity 0.18s ease; }
        .r34-thumb-shell img.r34-loaded { opacity:1; }
        .r34-thumb-shell::before { content:''; position:absolute; inset:0; background:linear-gradient(90deg, rgba(40,40,40,0.9) 0%, rgba(58,58,58,0.95) 50%, rgba(40,40,40,0.9) 100%); background-size:200% 100%; animation:r34Shimmer 1.2s linear infinite; }
        .r34-thumb-shell:has(img.r34-loaded)::before { display:none; }
        .r34-video-indicator { position:absolute; bottom:5px; right:5px; background:rgba(0,0,0,0.7); color:#fff; padding:2px 5px; border-radius:3px; font-size:11px; z-index:1; }
        @keyframes r34Shimmer {
            0% { background-position:200% 0; }
            100% { background-position:-200% 0; }
        }
    `);

    const SmoothImageLoader = (() => {
        let observer = null;
        let revealQueue = [];
        let activeLoads = 0;
        let flushScheduled = false;

        function isNearViewport(element) {
            const rect = element.getBoundingClientRect();
            const viewportHeight = window.innerHeight;
            return rect.top < viewportHeight * CONSTANTS.IMAGE_NEAR_VIEWPORT && rect.bottom > -viewportHeight * 0.25;
        }

        function ensureLoadedClass(img) {
            img.classList.add('r34-loaded');
            const shell = img.closest('.r34-thumb-shell');
            if (shell) shell.dataset.ready = 'true';
        }

        function attachLoadListeners(img) {
            if (img.dataset.r34LoadListener === '1') return;
            img.dataset.r34LoadListener = '1';
            const mark = () => ensureLoadedClass(img);
            img.addEventListener('load', mark, { once: true });
            img.addEventListener('error', mark, { once: true });
        }

        async function revealImage(img) {
            if (!img?.isConnected) return;
            if (!img.dataset.originalSrc || img.dataset.r34RevealState === 'done' || img.dataset.r34RevealState === 'loading') return;

            img.dataset.r34RevealState = 'loading';
            activeLoads++;
            attachLoadListeners(img);
            img.loading = 'lazy';
            img.decoding = 'async';
            img.referrerPolicy = 'no-referrer';

            const src = img.dataset.originalSrc;
            img.src = src;

            if (isNearViewport(img) && typeof img.decode === 'function') {
                try {
                    await img.decode();
                } catch (error) {
                    void error;
                }
            }

            delete img.dataset.originalSrc;
            img.dataset.r34RevealState = 'done';
            ensureLoadedClass(img);
            activeLoads = Math.max(0, activeLoads - 1);
            scheduleFlush();
        }

        async function flushQueue() {
            flushScheduled = false;
            if (revealQueue.length === 0) return;

            const nextBatch = [];
            while (revealQueue.length > 0 && nextBatch.length < CONSTANTS.IMAGE_REVEAL_BATCH_SIZE && activeLoads < CONSTANTS.IMAGE_CONCURRENT_LIMIT) {
                const img = revealQueue.shift();
                if (!img?.isConnected || !img.dataset.originalSrc) continue;
                nextBatch.push(img);
                activeLoads++;
                activeLoads--;
            }

            for (const img of nextBatch) {
                await revealImage(img);
                await wait(CONSTANTS.IMAGE_REVEAL_PAUSE_MS);
            }

            if (revealQueue.length > 0) {
                scheduleFlush();
            }
        }

        function scheduleFlush() {
            if (flushScheduled) return;
            flushScheduled = true;
            requestAnimationFrame(() => {
                flushQueue().catch((error) => console.debug('[SmoothImageLoader] flush error:', error));
            });
        }

        function queueImage(img) {
            if (!img || !img.dataset.originalSrc || img.dataset.r34Queued === '1') return;
            img.dataset.r34Queued = '1';
            revealQueue.push(img);
            scheduleFlush();
        }

        function ensureObserver() {
            if (observer) return observer;
            observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        const img = entry.target;
                        observer.unobserve(img);
                        queueImage(img);
                    }
                });
            }, { rootMargin: CONSTANTS.IMAGE_ROOT_MARGIN, threshold: 0.01 });
            trackObserver(observer);
            return observer;
        }

        function prepare(img, src) {
            if (!img || !src) return;
            img.dataset.originalSrc = src;
            img.alt = img.alt || '';
            img.loading = 'lazy';
            img.decoding = 'async';
            img.referrerPolicy = 'no-referrer';
            attachLoadListeners(img);
            ensureObserver().observe(img);
        }

        function prepareBatch(images) {
            images.forEach((img) => {
                if (img?.dataset.originalSrc) {
                    ensureObserver().observe(img);
                }
            });
        }

        function hydrateExisting(context = document) {
            context.querySelectorAll?.('img[data-original-src]').forEach((img) => {
                attachLoadListeners(img);
                ensureObserver().observe(img);
            });
        }

        function clear() {
            if (observer) {
                observer.disconnect();
                observer = null;
            }
            revealQueue = [];
            activeLoads = 0;
            flushScheduled = false;
        }

        return { prepare, prepareBatch, hydrateExisting, clear };
    })();

    async function validateCredentials(apiKey, userId) {
        try {
            const testUrl = buildApiUrl({
                page: 'dapi',
                s: 'post',
                q: 'index',
                limit: 1,
                json: 1,
                api_key: apiKey,
                user_id: userId
            });
            const response = await htmlRequest({
                method: 'GET',
                url: testUrl,
                timeout: CONSTANTS.API_TIMEOUT_MS
            });
            return response.status === 200;
        } catch {
            return false;
        }
    }

    function showBanner(text, color = '#4CAF50') {
        const banner = document.createElement('div');
        banner.textContent = text;
        Object.assign(banner.style, {
            backgroundColor: color,
            color: 'white',
            padding: '15px',
            textAlign: 'center',
            position: 'fixed',
            top: '0',
            left: '0',
            width: '100%',
            zIndex: '10000',
            fontSize: '16px'
        });
        document.body.prepend(banner);
        setTimeout(() => banner.remove(), CONSTANTS.BANNER_DISPLAY_MS);
    }

    async function handleOptionsPage() {
        if (!location.href.includes('page=account&s=options')) return;
        const credTextarea = Array.from(document.querySelectorAll('textarea')).find((ta) => ta.value.includes('&api_key=') && ta.value.includes('&user_id='));
        if (!credTextarea) return;

        try {
            const params = new URLSearchParams(credTextarea.value.replace(/&amp;/g, '&'));
            const apiKey = params.get('api_key');
            const userId = params.get('user_id');
            if (!apiKey || !userId) return;

            if (await validateCredentials(apiKey, userId)) {
                await GM_setValue(API_KEY_NAME, apiKey);
                await GM_setValue(USER_ID_NAME, userId);
                showBanner('Combined r34 Scripts++: API Key and User ID validated and saved!');
            } else {
                alert('Invalid API credentials. Please check and try again.');
            }
        } catch (error) {
            console.error('[Userscript] Could not parse API credentials.', error);
        }
    }

    function showApiKeyPrompt() {
        if (document.getElementById('r34-modal-overlay')) return;
        const lastReminder = Number.parseInt(localStorage.getItem(REMINDER_KEY) || '0', 10);
        if (lastReminder && Date.now() - lastReminder < 24 * 60 * 60 * 1000) return;

        const overlay = document.createElement('div');
        overlay.id = 'r34-modal-overlay';
        overlay.innerHTML = `
            <div id="r34-modal-content">
                <p>For the "Restore Deleted Post" feature, this script now needs an API key. Please generate one or enter it manually.</p>
                <div id="r34-modal-buttons">
                    <button id="r34-manual-btn">Enter Manually</button>
                    <button id="r34-generate-btn">Go to Options Page</button>
                    <button id="r34-later-btn">Remind Later</button>
                </div>
                <div id="r34-manual-input" style="display: none;">
                    <p style="font-size: 0.9em;">Copy the full text from the "API Access Credentials" box and paste it here.</p>
                    <input type="text" id="r34-credential-input" placeholder="&api_key=...&user_id=...">
                    <button id="r34-save-manual-btn">Save & Reload</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.querySelector('#r34-generate-btn')?.addEventListener('click', () => {
            window.location.href = 'https://rule34.xxx/index.php?page=account&s=options';
        });
        overlay.querySelector('#r34-manual-btn')?.addEventListener('click', () => {
            const buttons = overlay.querySelector('#r34-modal-buttons');
            const manual = overlay.querySelector('#r34-manual-input');
            if (buttons) buttons.style.display = 'none';
            if (manual) manual.style.display = 'block';
        });
        overlay.querySelector('#r34-later-btn')?.addEventListener('click', () => {
            localStorage.setItem(REMINDER_KEY, Date.now().toString());
            overlay.remove();
        });
        overlay.querySelector('#r34-save-manual-btn')?.addEventListener('click', async () => {
            const input = overlay.querySelector('#r34-credential-input');
            const value = input?.value.trim();
            if (!value) return;

            try {
                const params = new URLSearchParams(value.startsWith('?') ? value : `?${value}`);
                const apiKey = params.get('api_key');
                const userId = params.get('user_id');
                if (!apiKey || !userId) {
                    alert('Invalid format. Please paste the full string.');
                    return;
                }

                if (await validateCredentials(apiKey, userId)) {
                    await GM_setValue(API_KEY_NAME, apiKey);
                    await GM_setValue(USER_ID_NAME, userId);
                    alert('API Key and User ID validated and saved! The page will now reload.');
                    location.reload();
                } else {
                    alert('Invalid credentials. Please check and try again.');
                }
            } catch {
                alert('Could not parse the provided string.');
            }
        });
    }

    async function checkApiKey() {
        if (location.href.includes('page=account&s=options')) return true;
        const apiKey = await GM_getValue(API_KEY_NAME);
        const userId = await GM_getValue(USER_ID_NAME);
        if (!apiKey || !userId) {
            console.log('Combined r34 Scripts++: API key or User ID not found. Displaying prompt.');
            showApiKeyPrompt();
            return false;
        }
        return true;
    }

    async function restoreDeletedPost() {
        const notice = document.querySelector('.status-notice');
        if (!notice || !notice.innerText.includes('This post was deleted.')) return;

        const postId = new URLSearchParams(location.search).get('id');
        if (!postId) return;

        const apiKey = await GM_getValue(API_KEY_NAME, '');
        const userId = await GM_getValue(USER_ID_NAME, '');
        const apiUrl = buildApiUrl({
            page: 'dapi',
            s: 'post',
            q: 'index',
            id: postId,
            json: 1,
            api_key: apiKey,
            user_id: userId
        });

        let attempts = 0;
        let response = null;
        while (attempts < CONSTANTS.API_RETRY_ATTEMPTS) {
            try {
                response = await htmlRequest({
                    method: 'GET',
                    url: apiUrl,
                    responseType: 'json',
                    timeout: CONSTANTS.API_TIMEOUT_MS
                });
                if (response.status === 200) break;
                if (response.status === 429) {
                    await wait(1000 * Math.pow(2, attempts));
                }
            } catch (error) {
                console.debug(`[Userscript] Restore attempt ${attempts + 1} failed:`, error);
            }
            attempts++;
        }

        if (!response || response.status !== 200) {
            const errorMsg = document.createElement('div');
            errorMsg.style.cssText = 'color:#ff6b6b;margin-top:10px;';
            errorMsg.textContent = 'Media could not be restored.';
            notice.appendChild(errorMsg);
            return;
        }

        const post = Array.isArray(response.response) ? response.response[0] : response.response;
        if (!post?.file_url) return;

        const isVideo = ['webm', 'mp4'].includes(post.file_url.split('.').pop().toLowerCase());
        const mediaElement = document.createElement(isVideo ? 'video' : 'img');
        mediaElement.src = post.file_url;
        Object.assign(mediaElement.style, {
            maxWidth: '95vw',
            maxHeight: '90vh',
            objectFit: 'contain',
            display: 'block'
        });

        if (isVideo) {
            Object.assign(mediaElement, { controls: true, autoplay: true, loop: true, muted: true });
        }

        const container = document.getElementById('fit-to-screen');
        if (container) {
            container.innerHTML = '';
            container.appendChild(mediaElement);
            notice.innerText += '\n[Userscript] Restored deleted media.';
        }
    }

    function createThumbShell(img) {
        const shell = document.createElement('div');
        shell.className = 'r34-thumb-shell';
        shell.appendChild(img);
        return shell;
    }

    function createMediaIndicator(post, parent) {
        const extension = post.file_url?.split('.').pop()?.toLowerCase();
        if (!['webm', 'mp4'].includes(extension)) return;
        const indicator = document.createElement('div');
        indicator.className = 'r34-video-indicator';
        indicator.textContent = '▶';
        parent.appendChild(indicator);
    }

    function prepareImageNode(img, src, alt) {
        img.alt = alt || '';
        img.removeAttribute('title');
        if (CONFIG.advancedImageLoading) {
            SmoothImageLoader.prepare(img, src);
        } else {
            img.src = src;
            img.loading = 'lazy';
            img.decoding = 'async';
            img.referrerPolicy = 'no-referrer';
            img.classList.add('r34-loaded');
        }
    }

    function createThumbFromApiData(post) {
        const span = document.createElement('span');
        span.className = 'thumb';
        span.id = `s${post.id}`;

        const link = document.createElement('a');
        link.href = `index.php?page=post&s=view&id=${post.id}`;
        link.id = `p${post.id}`;

        const img = document.createElement('img');
        const thumbUrl = post.preview_url || post.sample_url || post.file_url;
        prepareImageNode(img, thumbUrl, post.tags || '');

        link.appendChild(createThumbShell(img));
        span.appendChild(link);
        createMediaIndicator(post, span);
        return span;
    }

    async function appendNodesChunked(container, nodes) {
        const chunks = chunkArray(nodes, CONSTANTS.CHUNK_APPEND_SIZE);
        for (const chunk of chunks) {
            const fragment = document.createDocumentFragment();
            chunk.forEach((node) => fragment.appendChild(node));
            container.appendChild(fragment);
            await wait(CONSTANTS.CHUNK_APPEND_PAUSE_MS);
        }
    }

    function hideBlacklisted(context) {
        context.querySelectorAll?.('.blacklisted').forEach((element) => element.remove());
    }

    function removeAnnoyances(context) {
        context.querySelectorAll?.('div.a_list#lmid, div[style*="display: inline-flex"], div.horizontalFlexWithMargins[style*="justify-content: center"], .exo-native-widget-outer-container, span[data-nosnippet]').forEach((element) => element.remove());
    }

    function fixPaginatorLinks(context) {
        context.querySelectorAll?.('#paginator a[onclick]').forEach((link) => {
            const match = (link.getAttribute('onclick') || '').match(/document\.location='([^']+)'/);
            if (match && link.getAttribute('href') === '#') {
                link.setAttribute('href', match[1]);
            }
        });
    }

    function removePidParameter(context) {
        context.querySelectorAll?.('a[onclick*="return_pid="]').forEach((link) => {
            link.setAttribute('onclick', (link.getAttribute('onclick') || '').replace(/[?&]return_pid=\d+/, ''));
        });
    }

    function setNativeLazyLoading(context) {
        const images = context.nodeType === 1 && context.matches?.('img:not([loading])')
            ? [context]
            : Array.from(context.querySelectorAll?.('img:not([loading])') || []);

        if (images.length === 0) return;

        const apply = () => {
            images.forEach((img) => {
                img.loading = 'lazy';
                img.decoding = 'async';
                if (!img.hasAttribute('referrerPolicy')) {
                    img.referrerPolicy = 'no-referrer';
                }
            });
        };

        if ('requestIdleCallback' in window) {
            requestIdleCallback(apply, { timeout: 50 });
        } else {
            setTimeout(apply, 0);
        }
    }

    function hideEmptyThumbSpans(context) {
        context.querySelectorAll?.('#content > div.image-list > span').forEach((span) => {
            if (span.children.length === 0 || !Array.from(span.querySelectorAll('a')).some((link) => link.style.display !== 'none')) {
                span.remove();
            }
        });
    }

    function removeThumbTitle(context) {
        context.querySelectorAll?.('.thumb img[title]').forEach((img) => img.removeAttribute('title'));
    }

    const removeDuplicateThumbnails = (() => {
        function run(context) {
            const thumbs = context.matches?.('span.thumb')
                ? [context]
                : Array.from(context.querySelectorAll?.('span.thumb') || []);

            if (thumbs.length === 0) return;

            const seen = new Set();
            const toRemove = [];
            thumbs.forEach((thumb) => {
                const id = thumb.id?.slice(1);
                if (!id) return;
                if (seen.has(id)) {
                    toRemove.push(thumb);
                    return;
                }
                seen.add(id);
            });

            if (context === document) {
                const globalSeen = new Set();
                document.querySelectorAll('span.thumb[id^="s"]').forEach((thumb) => {
                    const id = thumb.id.slice(1);
                    if (globalSeen.has(id)) {
                        thumb.remove();
                    } else {
                        globalSeen.add(id);
                    }
                });
                return;
            }

            toRemove.forEach((thumb) => thumb.remove());
        }

        run.reset = () => {};
        return run;
    })();

    function updateFavicon() {
        try {
            const url = location.href;
            const newIcon = ICON_MAP.find((entry) => url.includes(entry.match) || url.includes(entry.match.replace(':', '%3a')))?.icon;
            if (!newIcon) return;

            let link = document.querySelector('link[rel="shortcut icon"]') || document.querySelector('link[rel="icon"]');
            if (!link) {
                link = document.createElement('link');
                link.setAttribute('rel', 'shortcut icon');
                document.head.appendChild(link);
            }
            link.setAttribute('href', newIcon);
        } catch (error) {
            console.debug('[Favicon] update failed:', error);
        }
    }

    const updatePageIndicator = (() => {
        let indicator = null;
        let totalPages = null;

        function getCurrentPage() {
            if (InfiniteScrollAPI.isActive()) {
                return InfiniteScrollAPI.getState().currentPage;
            }

            const urlParams = new URLSearchParams(location.search);
            const pid = Number.parseInt(urlParams.get('pid') || '', 10);
            if (!Number.isNaN(pid)) {
                return Math.floor(pid / getPerPage()) + 1;
            }

            const current = document.querySelector('#paginator b');
            return Number.parseInt(current?.textContent || '1', 10) || 1;
        }

        function getTotalPagesFromPaginator() {
            const paginator = document.querySelector('#paginator');
            if (!paginator) return null;
            const perPage = getPerPage();
            const links = paginator.querySelectorAll('a[href*="pid"]');
            if (links.length === 0) return null;

            let maxPage = 1;
            links.forEach((link) => {
                const url = new URL(link.href, location.href);
                const pid = Number.parseInt(url.searchParams.get('pid') || '', 10);
                if (!Number.isNaN(pid)) {
                    maxPage = Math.max(maxPage, Math.floor(pid / perPage) + 1);
                }
            });
            return maxPage;
        }

        function render() {
            if (!indicator) return;
            if (location.href.includes('page=post&s=view&id=') || location.href.includes('page=post&s=list&tags=all')) {
                indicator.style.display = 'none';
                return;
            }

            const current = getCurrentPage();
            if (totalPages === null) {
                totalPages = InfiniteScrollAPI.getTotalPages() || getTotalPagesFromPaginator();
            }

            let text = `Page ${current}`;
            if (totalPages) text += ` / ${totalPages}`;
            if (InfiniteScrollAPI.isActive()) {
                const apiState = InfiniteScrollAPI.getState();
                if (apiState.postsLoaded) text += ` (${apiState.postsLoaded} posts)`;
            }

            indicator.textContent = text;
            indicator.style.display = 'block';
        }

        function init() {
            if (!indicator) {
                indicator = document.createElement('div');
                indicator.id = 'page-indicator';
                document.body.appendChild(indicator);
            }
            totalPages = null;
            render();
        }

        init.update = render;
        init.hide = () => { if (indicator) indicator.style.display = 'none'; };
        init.setTotalPages = (value) => {
            totalPages = value;
            render();
        };
        return init;
    })();

    function initFeatureOnce(name, factory) {
        if (state.initializedFeatures.has(name)) return;
        state.initializedFeatures.add(name);
        factory();
    }

    function setupFavoriteOnHover() {
        initFeatureOnce('favoriteOnHover', () => {
            let hoveredElement = null;
            on(document, 'mouseenter', (event) => {
                hoveredElement = event.target;
            }, { passive: true, capture: true });
            on(document, 'mouseleave', (event) => {
                if (event.target === hoveredElement) hoveredElement = null;
            }, { capture: true });
            on(window, 'pointerdown', (event) => {
                if (event.button !== 3) return;
                if (isTextInput(document.activeElement)) return;

                const link = hoveredElement?.closest('a[href*="id="], a[id^="p"]');
                const postId = link
                    ? (new URL(link.href, location.href).searchParams.get('id') || link.id.slice(1))
                    : new URLSearchParams(location.search).get('id');

                if (postId && typeof unsafeWindow.addFav === 'function') {
                    unsafeWindow.addFav(postId);
                }
            }, true);
        });
    }

    function setupCollapsibleHeader() {
        initFeatureOnce('collapsibleHeader', () => {
            const header = document.querySelector('#header');
            if (!header || location.href.includes('page=favorites&s=view&id=')) return;

            let expandTimeout = null;
            let collapseTimeout = null;
            let isFixed = localStorage.getItem(HEADER_FIXED_KEY) === 'true';

            let fixButton = header.querySelector('.header-fix-btn');
            if (!fixButton) {
                fixButton = document.createElement('button');
                fixButton.className = 'header-fix-btn';
                header.appendChild(fixButton);
            }

            const updateState = () => {
                header.style.height = isFixed ? 'auto' : CONSTANTS.HEADER_COLLAPSED_HEIGHT;
                fixButton.textContent = isFixed ? 'Unpin' : 'Pin';
            };

            const toggleFixed = () => {
                isFixed = !isFixed;
                localStorage.setItem(HEADER_FIXED_KEY, String(isFixed));
                updateState();
            };

            on(fixButton, 'click', toggleFixed);
            on(header, 'mouseenter', () => {
                if (isFixed) return;
                clearTimeout(collapseTimeout);
                expandTimeout = setTimeout(() => {
                    header.style.height = 'auto';
                }, CONSTANTS.HEADER_EXPAND_DELAY_MS);
            });
            on(header, 'mouseleave', () => {
                if (isFixed) return;
                clearTimeout(expandTimeout);
                collapseTimeout = setTimeout(() => {
                    header.style.height = CONSTANTS.HEADER_COLLAPSED_HEIGHT;
                }, CONSTANTS.HEADER_COLLAPSE_DELAY_MS);
            });
            on(document, 'keydown', (event) => {
                if (event.altKey && event.key.toLowerCase() === 'h') {
                    toggleFixed();
                }
            });

            updateState();
        });
    }

    function setupControlPanel() {
        initFeatureOnce('controlPanel', () => {
            const savedPos = safeJsonParse(localStorage.getItem(BUTTON_POS_KEY), { top: -1, left: 162 });
            let isVisible = localStorage.getItem(BUTTON_VISIBLE_KEY) !== 'false';

            const toggleBtn = document.createElement('button');
            toggleBtn.textContent = 'r34 Panel';
            toggleBtn.className = 'r34-panel-btn';
            Object.assign(toggleBtn.style, { top: `${savedPos.top}px`, left: `${savedPos.left}px` });

            const panel = document.createElement('div');
            panel.className = 'r34-panel';

            const form = document.createElement('form');
            const groupedFeatures = {
                Core: ['favoriteOnMouse', 'removeDuplicates', 'removeAnnoyances', 'fixPaginatorLinks', 'removePidParameter', 'restoreDeletedPost'],
                Performance: ['nativeLazyLoading', 'apiInfiniteScroll', 'advancedImageLoading'],
                Visual: ['collapsibleHeader', 'hideBlacklisted', 'hideEmptyThumbSpans', 'faviconChanger', 'pageIndicator', 'removeThumbTitles']
            };
            const descriptions = {
                favoriteOnMouse: 'Aktiviert Favorisieren mit Mausrad-Klick',
                removeDuplicates: 'Entfernt doppelte Thumbnails auf der Seite',
                removeAnnoyances: 'Entfernt Werbung und stoerende Elemente',
                fixPaginatorLinks: 'Repariert defekte Paginierungs-Links',
                removePidParameter: 'Entfernt unnoetige PID-Parameter aus URLs',
                restoreDeletedPost: 'Stellt geloeschte Posts ueber die API wieder her',
                nativeLazyLoading: 'Aktiviert natives Lazy Loading fuer Bilder',
                apiInfiniteScroll: 'API-basiertes Scrollen mit sanfterem Rendering',
                advancedImageLoading: 'Viewport-nahes Bildladen mit Platzhaltern',
                collapsibleHeader: 'Header klappt automatisch ein/aus',
                hideBlacklisted: 'Versteckt geblacklistete Inhalte',
                hideEmptyThumbSpans: 'Entfernt leere Thumbnail-Container',
                faviconChanger: 'Aendert das Favicon je nach Seite',
                pageIndicator: 'Zeigt aktuelle Seitennummer an',
                removeThumbTitles: 'Entfernt Tooltips von Thumbnails'
            };

            Object.entries(groupedFeatures).forEach(([group, keys]) => {
                let sectionHtml = `<strong>${group}</strong>`;
                keys.forEach((key) => {
                    sectionHtml += `<label><input type="checkbox" name="${key}" ${CONFIG[key] ? 'checked' : ''}> ${key.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase())}`;
                    if (descriptions[key]) {
                        sectionHtml += `<span class="tooltip-info" title="${descriptions[key]}"> i</span>`;
                    }
                    sectionHtml += '</label>';
                });
                form.insertAdjacentHTML('beforeend', sectionHtml);
            });

            form.insertAdjacentHTML('beforeend', '<div><button type="submit" class="save-btn">Save & Reload</button><button type="button" class="cancel-btn">Cancel</button><button type="button" class="reset-btn">Reset Defaults</button><button type="button" class="export-btn">Export</button><button type="button" class="import-btn">Import</button></div>');
            panel.appendChild(form);

            let isMinimized = false;
            const minimizeBtn = document.createElement('button');
            minimizeBtn.textContent = '-';
            minimizeBtn.className = 'minimize-btn';
            panel.insertBefore(minimizeBtn, form);

            on(minimizeBtn, 'click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                isMinimized = !isMinimized;
                form.style.display = isMinimized ? 'none' : 'block';
                minimizeBtn.textContent = isMinimized ? '+' : '-';
                panel.style.height = isMinimized ? 'auto' : '';
            });

            on(form, 'submit', (event) => {
                event.preventDefault();
                const formData = new FormData(form);
                const nextConfig = {};
                Object.keys(DEFAULT_CONFIG).forEach((key) => {
                    nextConfig[key] = formData.has(key);
                });
                localStorage.setItem(FEATURE_FLAGS_KEY, JSON.stringify(nextConfig));
                location.reload();
            });

            on(form.querySelector('.cancel-btn'), 'click', () => {
                panel.style.display = 'none';
            });
            on(form.querySelector('.reset-btn'), 'click', () => {
                localStorage.setItem(FEATURE_FLAGS_KEY, JSON.stringify(DEFAULT_CONFIG));
                location.reload();
            });
            on(form.querySelector('.export-btn'), 'click', async () => {
                try {
                    await navigator.clipboard.writeText(localStorage.getItem(FEATURE_FLAGS_KEY) || JSON.stringify(DEFAULT_CONFIG));
                    alert('Config copied to clipboard.');
                } catch {
                    alert('Unable to copy config.');
                }
            });
            on(form.querySelector('.import-btn'), 'click', () => {
                try {
                    const text = prompt('Paste config JSON here:');
                    if (!text) return;
                    JSON.parse(text);
                    localStorage.setItem(FEATURE_FLAGS_KEY, text);
                    alert('Imported. Reloading.');
                    location.reload();
                } catch {
                    alert('Invalid JSON.');
                }
            });

            on(toggleBtn, 'click', () => {
                const rect = toggleBtn.getBoundingClientRect();
                panel.style.left = `${rect.left}px`;
                panel.style.top = `${rect.bottom + window.scrollY + 5}px`;
                panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
            });

            on(toggleBtn, 'mousedown', (event) => {
                if (event.button !== 0) return;
                const shiftX = event.clientX - toggleBtn.getBoundingClientRect().left;
                const shiftY = event.clientY - toggleBtn.getBoundingClientRect().top;

                const onMouseMove = (moveEvent) => {
                    toggleBtn.style.left = `${moveEvent.pageX - shiftX}px`;
                    toggleBtn.style.top = `${moveEvent.pageY - shiftY}px`;
                };

                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    localStorage.setItem(BUTTON_POS_KEY, JSON.stringify({
                        top: Number.parseInt(toggleBtn.style.top, 10) || 0,
                        left: Number.parseInt(toggleBtn.style.left, 10) || 0
                    }));
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });
            toggleBtn.ondragstart = () => false;

            on(document, 'keydown', (event) => {
                if (event.altKey && event.key.toLowerCase() === 'p') {
                    event.preventDefault();
                    const visibleNow = document.body.contains(toggleBtn);
                    if (visibleNow) {
                        toggleBtn.remove();
                        panel.remove();
                        localStorage.setItem(BUTTON_VISIBLE_KEY, 'false');
                    } else {
                        document.body.appendChild(toggleBtn);
                        document.body.appendChild(panel);
                        localStorage.setItem(BUTTON_VISIBLE_KEY, 'true');
                    }
                }
            });

            if (isVisible) {
                document.body.appendChild(toggleBtn);
                document.body.appendChild(panel);
            }
        });
    }

    const InfiniteScrollAPI = (() => {
        const config = {
            enabled: true,
            perPage: 42,
            threshold: CONSTANTS.INFINITE_SCROLL_THRESHOLD,
            delayBetweenPages: 1800,
            jitterFactor: 0.25,
            maxPagesPerSession: 500,
            cooldownAfterPages: 50,
            cooldownDuration: 12000,
            maxEmptyPagesInRow: 3,
            useAlternateApiMethod: true
        };

        let isLoading = false;
        let currentPid = 0;
        let pagesLoaded = 0;
        let lastApiCall = 0;
        let sessionPostIds = new Set();
        let observer = null;
        let sentinel = null;
        let totalPostCount = 0;
        let currentPage = 1;
        let postsLoadedCount = 0;
        let reachedEnd = false;
        let consecutiveEmptyPages = 0;
        let enabledThisPage = false;

        function getContainer() {
            return document.querySelector('#content .image-list') || document.querySelector('#content');
        }

        function isApplicablePage() {
            const url = location.href;
            return !url.includes('page=post&s=view')
                && !url.includes('page=favorites')
                && !url.includes('page=account')
                && getContainer() !== null
                && !isPagetualPresent();
        }

        function getCurrentPid() {
            const urlParams = new URLSearchParams(location.search);
            const pid = Number.parseInt(urlParams.get('pid') || '', 10);
            return Number.isNaN(pid) ? 0 : pid;
        }

        function getState() {
            return {
                currentPage,
                totalPostCount,
                perPage: config.perPage,
                postsLoaded: postsLoadedCount,
                pagesLoaded,
                isLoading,
                reachedEnd
            };
        }

        function getTotalPages() {
            return totalPostCount > 0 ? Math.ceil(totalPostCount / config.perPage) : null;
        }

        async function calculateDelay() {
            const now = Date.now();
            const elapsed = now - lastApiCall;
            let baseDelay = config.delayBetweenPages;
            if (pagesLoaded > config.cooldownAfterPages) baseDelay = config.cooldownDuration;
            else if (pagesLoaded > 30) baseDelay = 4000;
            else if (pagesLoaded > 15) baseDelay = 2800;
            if (consecutiveEmptyPages > 0) baseDelay += consecutiveEmptyPages * 750;

            const jitter = baseDelay * (Math.random() * config.jitterFactor * 2 - config.jitterFactor);
            const waitTime = Math.max(700, Math.min(15000, baseDelay + jitter - elapsed));
            if (waitTime > 0) await wait(waitTime);
        }

        function createSentinel() {
            const node = document.createElement('div');
            node.id = 'api-scroll-sentinel';
            node.style.cssText = 'height:10px;width:100%;margin:20px 0;';

            const indicator = document.createElement('div');
            indicator.id = 'api-scroll-indicator';
            indicator.textContent = 'Loading more images...';
            node.appendChild(indicator);
            return node;
        }

        function repositionSentinel() {
            if (!sentinel?.isConnected) return;
            const container = getContainer();
            if (container) {
                sentinel.remove();
                container.appendChild(sentinel);
            }
        }

        async function estimateTotalPages() {
            const paginator = document.querySelector('#paginator');
            if (!paginator) return null;
            const lastLink = paginator.querySelector('a[href*="pid"]:last-of-type');
            if (!lastLink) return null;

            const url = new URL(lastLink.href, location.href);
            const maxPid = Number.parseInt(url.searchParams.get('pid') || '', 10);
            if (Number.isNaN(maxPid) || maxPid <= 0) return null;

            totalPostCount = maxPid + config.perPage;
            return Math.ceil(totalPostCount / config.perPage);
        }

        function collectExistingPostIds() {
            sessionPostIds.clear();
            document.querySelectorAll('span.thumb[id^="s"]').forEach((element) => {
                const id = element.id.slice(1);
                if (id) sessionPostIds.add(String(id));
            });
            postsLoadedCount = sessionPostIds.size;
        }

        async function loadNextPageViaHtml() {
            const nextLink = Array.from(document.querySelectorAll('.pagination a')).find((link) => {
                return link.getAttribute('alt') === 'next'
                    || link.textContent.trim() === '»'
                    || link.textContent.toLowerCase().includes('next');
            });

            if (!nextLink) {
                reachedEnd = true;
                return false;
            }

            const response = await htmlRequest({
                method: 'GET',
                url: nextLink.href,
                timeout: 15000
            });
            if (response.status !== 200) return false;

            const parser = new DOMParser();
            const doc = parser.parseFromString(response.responseText, 'text/html');
            const thumbs = Array.from(doc.querySelectorAll('span.thumb'));
            const container = getContainer();
            if (!container) return false;

            const newNodes = [];
            const imagesToPrepare = [];
            for (const thumb of thumbs) {
                const id = thumb.id?.slice(1);
                if (!id || sessionPostIds.has(id)) continue;

                const link = thumb.querySelector('a');
                const originalImg = thumb.querySelector('img');
                if (!link || !originalImg) continue;

                sessionPostIds.add(id);

                const newThumb = document.createElement('span');
                newThumb.className = 'thumb';
                newThumb.id = thumb.id;

                const newLink = document.createElement('a');
                newLink.href = link.href;
                newLink.id = link.id;

                const img = document.createElement('img');
                prepareImageNode(img, originalImg.src, originalImg.alt || '');
                if (CONFIG.advancedImageLoading) imagesToPrepare.push(img);

                newLink.appendChild(createThumbShell(img));
                newThumb.appendChild(newLink);
                newNodes.push(newThumb);
            }

            if (newNodes.length === 0) return false;

            await appendNodesChunked(container, newNodes);
            if (CONFIG.advancedImageLoading) {
                SmoothImageLoader.prepareBatch(imagesToPrepare);
            }

            const nextPid = Number.parseInt(new URL(nextLink.href).searchParams.get('pid') || '', 10);
            if (!Number.isNaN(nextPid)) currentPid = nextPid;
            pagesLoaded++;
            currentPage = Math.floor(currentPid / config.perPage) + 1;
            postsLoadedCount = sessionPostIds.size;
            repositionSentinel();
            updatePageIndicator.update();
            return true;
        }

        async function loadNextPage() {
            if (isLoading || reachedEnd) return false;
            if (pagesLoaded >= config.maxPagesPerSession) {
                reachedEnd = true;
                return false;
            }

            isLoading = true;
            try {
                await calculateDelay();

                if (consecutiveEmptyPages >= config.maxEmptyPagesInRow && config.useAlternateApiMethod) {
                    return await loadNextPageViaHtml();
                }

                const nextPid = currentPid + config.perPage;
                const apiKey = await GM_getValue(API_KEY_NAME, '');
                const userId = await GM_getValue(USER_ID_NAME, '');
                const tags = new URLSearchParams(location.search).get('tags') || '';
                const apiUrl = buildApiUrl({
                    page: 'dapi',
                    s: 'post',
                    q: 'index',
                    pid: nextPid,
                    limit: config.perPage,
                    json: 1,
                    tags: tags && consecutiveEmptyPages < 2 ? tags : null,
                    api_key: apiKey || null,
                    user_id: userId || null
                });

                const response = await htmlRequest({
                    method: 'GET',
                    url: apiUrl,
                    timeout: 15000,
                    responseType: 'json'
                });

                lastApiCall = Date.now();
                if (response.status !== 200 || !response.response) {
                    throw new Error(`API error: ${response.status}`);
                }

                const posts = Array.isArray(response.response) ? response.response : [response.response];
                if (posts.length === 0 || (posts.length === 1 && !posts[0].id)) {
                    consecutiveEmptyPages++;
                    currentPid = nextPid;
                    repositionSentinel();
                    return false;
                }

                consecutiveEmptyPages = 0;
                const container = getContainer();
                if (!container) throw new Error('Container not found');

                const newNodes = [];
                for (const post of posts) {
                    if (!post.id || post.blacklisted || post.pending || sessionPostIds.has(String(post.id))) continue;
                    sessionPostIds.add(String(post.id));
                    newNodes.push(createThumbFromApiData(post));
                }

                if (newNodes.length === 0) {
                    currentPid = nextPid;
                    repositionSentinel();
                    return false;
                }

                await appendNodesChunked(container, newNodes);
                currentPid = nextPid;
                pagesLoaded++;
                currentPage = Math.floor(currentPid / config.perPage) + 1;
                postsLoadedCount = sessionPostIds.size;
                repositionSentinel();
                updatePageIndicator.update();
                return true;
            } catch (error) {
                console.error('[API-Scroll] error:', error);
                consecutiveEmptyPages++;
                return false;
            } finally {
                isLoading = false;
                const indicator = document.getElementById('api-scroll-indicator');
                if (indicator) {
                    if (reachedEnd) {
                        indicator.textContent = `End (${postsLoadedCount} posts)`;
                        indicator.style.display = 'block';
                    } else {
                        indicator.style.display = 'none';
                    }
                }
            }
        }

        function initObserver() {
            if (observer) observer.disconnect();
            const container = getContainer();
            if (!container) return false;

            sentinel = createSentinel();
            container.appendChild(sentinel);
            observer = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting || isLoading || reachedEnd) return;
                    const indicator = document.getElementById('api-scroll-indicator');
                    if (indicator) indicator.style.display = 'block';
                    loadNextPage().then((loaded) => {
                        if (!loaded && consecutiveEmptyPages >= config.maxEmptyPagesInRow) {
                            loadNextPageViaHtml().catch((error) => console.debug('[API-Scroll] HTML fallback failed:', error));
                        }
                    });
                });
            }, { rootMargin: config.threshold, threshold: 0.01 });

            trackObserver(observer);
            observer.observe(sentinel);
            return true;
        }

        async function init() {
            if (!config.enabled || !isApplicablePage()) {
                enabledThisPage = false;
                return false;
            }

            config.perPage = getPerPage();
            currentPid = getCurrentPid();
            pagesLoaded = 0;
            currentPage = Math.floor(currentPid / config.perPage) + 1;
            totalPostCount = 0;
            reachedEnd = false;
            consecutiveEmptyPages = 0;
            collectExistingPostIds();
            await estimateTotalPages();
            enabledThisPage = initObserver();
            return enabledThisPage;
        }

        function destroy() {
            if (observer) {
                observer.disconnect();
                observer = null;
            }
            if (sentinel) {
                sentinel.remove();
                sentinel = null;
            }
            reachedEnd = true;
            isLoading = false;
            enabledThisPage = false;
        }

        return {
            init,
            destroy,
            isActive: () => enabledThisPage,
            getState,
            getTotalPages
        };
    })();

    function applyEnhancements(contexts = [document]) {
        contexts.forEach((context) => {
            if (CONFIG.hideBlacklisted) hideBlacklisted(context);
            if (CONFIG.removeDuplicates) removeDuplicateThumbnails(context);
            if (CONFIG.removeAnnoyances) removeAnnoyances(context);
            if (CONFIG.fixPaginatorLinks) fixPaginatorLinks(context);
            if (CONFIG.removePidParameter) removePidParameter(context);
            if (CONFIG.nativeLazyLoading) setNativeLazyLoading(context);
            if (CONFIG.hideEmptyThumbSpans) hideEmptyThumbSpans(context);
            if (CONFIG.removeThumbTitles) removeThumbTitle(context);
            if (CONFIG.advancedImageLoading) SmoothImageLoader.hydrateExisting(context);
        });
    }

    function getObservedContentRoot() {
        return document.querySelector('#content .image-list') || document.querySelector('#content') || document.body;
    }

    function cleanup() {
        state.observers.forEach((observer) => {
            try {
                observer.disconnect();
            } catch (error) {
                console.debug('Observer disconnect failed:', error);
            }
        });
        state.observers = [];

        state.cleanups.forEach((dispose) => {
            try {
                dispose();
            } catch (error) {
                console.debug('Cleanup failed:', error);
            }
        });
        state.cleanups = [];

        InfiniteScrollAPI.destroy();
        SmoothImageLoader.clear();
        state.controllers.clear();
    }

    function wrapHistory() {
        if (state.historyWrapped) return;
        state.historyWrapped = true;

        const wrap = (methodName) => {
            const original = history[methodName];
            history[methodName] = function() {
                const result = original.apply(this, arguments);
                window.dispatchEvent(new Event(methodName.toLowerCase()));
                return result;
            };
        };

        wrap('pushState');
        wrap('replaceState');
    }

    async function init() {
        performanceMonitor.start('totalInit');
        CONFIG = loadConfig();
        window.CONFIG = CONFIG;

        await handleOptionsPage();

        let canRestore = false;
        if (CONFIG.restoreDeletedPost) {
            canRestore = await checkApiKey();
        }

        if (CONFIG.favoriteOnMouse) setupFavoriteOnHover();
        if (CONFIG.collapsibleHeader) setupCollapsibleHeader();
        setupControlPanel();

        if (CONFIG.restoreDeletedPost && canRestore && location.href.includes('page=post&s=view')) {
            setTimeout(() => {
                restoreDeletedPost().catch((error) => console.debug('[Userscript] restore failed:', error));
            }, 500);
        }

        if (CONFIG.apiInfiniteScroll) {
            const activated = await InfiniteScrollAPI.init();
            if (activated) {
                console.log('[Userscript] API-based infinite scrolling enabled.');
                const nextLink = document.querySelector('.pagination a[alt="next"]');
                if (nextLink) nextLink.style.display = 'none';
            }
        }

        applyEnhancements();
        if (CONFIG.pageIndicator) updatePageIndicator();
        if (CONFIG.faviconChanger) updateFavicon();

        const contentRoot = getObservedContentRoot();
        const addedNodesBuffer = new Set();
        const processAddedNodes = debounce(() => {
            if (addedNodesBuffer.size === 0) return;
            const contexts = Array.from(addedNodesBuffer);
            addedNodesBuffer.clear();
            applyEnhancements(contexts);
            if (CONFIG.pageIndicator) updatePageIndicator.update();
        }, CONSTANTS.DEBOUNCE_MUTATION_MS);

        const contentObserver = new MutationObserver((mutations) => {
            let needsUpdate = false;
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.nodeType !== 1) continue;
                    if (node.matches?.('.thumb, .image-list') || node.querySelector?.('.thumb') || node.querySelector?.('img[data-original-src]')) {
                        addedNodesBuffer.add(node);
                        needsUpdate = true;
                    }
                }
            }
            if (needsUpdate) processAddedNodes();
        });
        trackObserver(contentObserver);
        contentObserver.observe(contentRoot, { childList: true, subtree: true });

        let lastHref = location.href;
        const handleUrlChange = debounce(() => {
            const newUrl = location.href;
            if (newUrl === lastHref) return;
            lastHref = newUrl;
            if (CONFIG.removeDuplicates && typeof removeDuplicateThumbnails.reset === 'function') {
                removeDuplicateThumbnails.reset();
            }
            if (CONFIG.faviconChanger) updateFavicon();
            if (CONFIG.pageIndicator) updatePageIndicator();
            if (CONFIG.restoreDeletedPost && canRestore && newUrl.includes('page=post&s=view')) {
                restoreDeletedPost().catch((error) => console.debug('[Userscript] restore failed:', error));
            }
            applyEnhancements();
        }, CONSTANTS.DEBOUNCE_URL_MS);

        wrapHistory();
        on(window, 'popstate', handleUrlChange);
        on(window, 'pushstate', handleUrlChange);
        on(window, 'replacestate', handleUrlChange);
        on(window, 'beforeunload', cleanup);

        performanceMonitor.end('totalInit');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            init().catch((error) => console.error('[Userscript] init failed:', error));
        }, { once: true });
    } else {
        init().catch((error) => console.error('[Userscript] init failed:', error));
    }
})();
