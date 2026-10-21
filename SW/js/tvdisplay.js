import { getPlayableItems, shouldShowMediaGroup, clampCropValue, clampPercent, clampMediaSize, clampCropZoom, findPlaybackIndex } from "./tvdisplay-model.js?v=20261021-1";
import { createDisplayAudio } from "./tvdisplay-audio.js?v=20261021-3";

const baseConfig = {
    storageMode: "cloudflare",
    apiBaseUrl: "",
    adminUser: "admin",
    workerCode: "BRBO"
};

const config = {
    ...baseConfig,
    ...(window.SW_TV_DISPLAY_CONFIG || {})
};

const DISPLAY_KEY = "sw-tv-display:state";
const AUDIO_KEY = "sw-tv-display:audio";
const REFRESH_MS = 8000;
const isPreview = window.parent !== window && new URLSearchParams(window.location.search).get("preview") === "1";
let previewRevision = 0;
let previewCropDrag = null;
const BACKGROUND_FRAME_MS = {
    high: 100,
    medium: 180,
    low: 360
};
const PERFORMANCE_PROBE_FRAMES = 24;

const defaultDisplay = {
    headline: "",
    subheadline: "",
    statusLabel: "Steelwrist Presents",
    statusValue: "",
    metricOneLabel: "Open Tasks",
    metricOneValue: "0",
    metricTwoLabel: "Orders",
    metricTwoValue: "--",
    metricThreeLabel: "Priority",
    metricThreeValue: "Normal",
    announcement: "",
    ticker: "",
    mediaUrl: "",
    mediaType: "image",
    mediaAlt: "Promotional media",
    playlist: [],
    slideDurationSeconds: 12,
    updatedAt: new Date().toISOString()
};

const elements = {
    root: document.getElementById("display-root"),
    statusLabel: document.getElementById("display-status-label"),
    headline: document.getElementById("display-headline"),
    subheadline: document.getElementById("display-subheadline"),
    promoImage: document.getElementById("promo-image"),
    promoVideo: document.getElementById("promo-video"),
    promoMediaShell: document.getElementById("promo-media-shell"),
    promoMediaGrid: document.getElementById("promo-media-grid"),
    promoPlaceholder: document.getElementById("promo-placeholder"),
    promoCopy: document.querySelector(".promo-copy"),
    announcement: document.getElementById("display-announcement"),
    ticker: document.getElementById("display-ticker")
};

const playerState = {
    display: defaultDisplay,
    playlist: [],
    index: 0,
    timer: null,
    renderedItemKey: "",
    playlistKey: "",
    lastBackgroundFrame: 0,
    performanceMode: "high",
    renderGeneration: 0
};

const displayAudio = createDisplayAudio(status => {
    if (isPreview) window.parent.postMessage({ type: "sw-display-preview:audio-status", ...status }, window.location.origin);
});

// Some browsers require one gesture on the TV device before permitting sound.
window.addEventListener("pointerdown", () => displayAudio.resume());
window.addEventListener("keydown", () => displayAudio.resume());

async function refreshAudio() {
    try {
        let audio;
        if (config.storageMode === "cloudflare" && config.apiBaseUrl) {
            const response = await fetch(`${config.apiBaseUrl.replace(/\/+$/, "")}/api/display/audio`);
            if (!response.ok) throw new Error("TV sound setting could not be loaded.");
            audio = (await response.json()).audio;
        } else {
            audio = JSON.parse(window.localStorage.getItem(AUDIO_KEY) || "null");
        }
        displayAudio.setMuted(audio?.muted !== false);
    } catch (error) {
        console.error(error);
    }
}

function animateBackground() {
    if (playerState.performanceMode === "low") {
        return;
    }

    if (elements.root.classList.contains("is-transitioning")) {
        window.requestAnimationFrame(animateBackground);
        return;
    }

    const now = performance.now();
    if (now - playerState.lastBackgroundFrame < getBackgroundFrameMs()) {
        window.requestAnimationFrame(animateBackground);
        return;
    }
    playerState.lastBackgroundFrame = now;

    const time = now / 1000;
    const spotA = getRoamingPoint(time, 0.12, 0.17, 0);
    const spotB = getRoamingPoint(time, 0.15, 0.11, 1.7);
    const spotC = getRoamingPoint(time, 0.1, 0.19, 3.2);
    const spotD = getRoamingPoint(time, 0.18, 0.13, 4.5);
    const spotE = getRoamingPoint(time, 0.14, 0.16, 5.8);
    const xA = Math.sin(time * 0.28) * 4;
    const yA = Math.cos(time * 0.22) * 3;
    const xB = Math.cos(time * 0.24) * 4;
    const yB = Math.sin(time * 0.3) * 3;
    const scaleA = 1.08 + Math.sin(time * 0.28) * 0.035;
    const scaleB = 1.1 + Math.cos(time * 0.26) * 0.04;
    const rotateB = Math.sin(time * 0.18) * 6;

    elements.root.style.setProperty("--spot-a-x", `${spotA.x.toFixed(2)}%`);
    elements.root.style.setProperty("--spot-a-y", `${spotA.y.toFixed(2)}%`);
    elements.root.style.setProperty("--spot-b-x", `${spotB.x.toFixed(2)}%`);
    elements.root.style.setProperty("--spot-b-y", `${spotB.y.toFixed(2)}%`);
    elements.root.style.setProperty("--spot-c-x", `${spotC.x.toFixed(2)}%`);
    elements.root.style.setProperty("--spot-c-y", `${spotC.y.toFixed(2)}%`);
    elements.root.style.setProperty("--spot-d-x", `${spotD.x.toFixed(2)}%`);
    elements.root.style.setProperty("--spot-d-y", `${spotD.y.toFixed(2)}%`);
    elements.root.style.setProperty("--spot-e-x", `${spotE.x.toFixed(2)}%`);
    elements.root.style.setProperty("--spot-e-y", `${spotE.y.toFixed(2)}%`);
    elements.root.style.setProperty("--bg-x-a", `${xA.toFixed(2)}%`);
    elements.root.style.setProperty("--bg-y-a", `${yA.toFixed(2)}%`);
    elements.root.style.setProperty("--bg-x-b", `${xB.toFixed(2)}%`);
    elements.root.style.setProperty("--bg-y-b", `${yB.toFixed(2)}%`);
    elements.root.style.setProperty("--bg-scale-a", scaleA.toFixed(3));
    elements.root.style.setProperty("--bg-scale-b", scaleB.toFixed(3));
    elements.root.style.setProperty("--bg-rotate-b", `${rotateB.toFixed(2)}deg`);

    window.requestAnimationFrame(animateBackground);
}

function getBackgroundFrameMs() {
    return BACKGROUND_FRAME_MS[playerState.performanceMode] || BACKGROUND_FRAME_MS.high;
}

function runPerformanceProbe() {
    const samples = [];
    let previous = performance.now();

    function sample(now) {
        samples.push(now - previous);
        previous = now;

        if (samples.length < PERFORMANCE_PROBE_FRAMES) {
            window.requestAnimationFrame(sample);
            return;
        }

        const average = samples.reduce((total, value) => total + value, 0) / samples.length;
        const worst = Math.max(...samples);
        let mode = "high";
        if (average > 30 || worst > 85) {
            mode = "low";
        } else if (average > 21 || worst > 48) {
            mode = "medium";
        }

        playerState.performanceMode = mode;
        elements.root.dataset.performance = mode;
        if (mode === "low") {
            elements.root.classList.remove("is-transitioning");
        }
    }

    elements.root.dataset.performance = "testing";
    window.requestAnimationFrame(sample);
}

function getRoamingPoint(time, speedX, speedY, offset) {
    return {
        x: 50 + Math.sin(time * speedX + offset) * 38 + Math.sin(time * speedY * 0.7 + offset * 1.3) * 8,
        y: 50 + Math.cos(time * speedY + offset) * 34 + Math.sin(time * speedX * 0.9 + offset * 0.7) * 9
    };
}

function readLocalDisplay() {
    const stored = window.localStorage.getItem(DISPLAY_KEY);
    if (!stored) {
        return defaultDisplay;
    }

    try {
        return {
            ...defaultDisplay,
            ...JSON.parse(stored)
        };
    } catch {
        return defaultDisplay;
    }
}

async function fetchDisplay() {
    if (config.storageMode === "cloudflare" && config.apiBaseUrl) {
        const response = await fetch(`${config.apiBaseUrl.replace(/\/+$/, "")}/api/display`);
        const payload = await response.json().catch(() => null);
        if (!response.ok) {
            throw new Error(payload?.error || "Display request failed.");
        }
        return {
            ...defaultDisplay,
            ...(payload?.display || {})
        };
    }

    return readLocalDisplay();
}

function formatUpdated(value) {
    if (!value) {
        return "Waiting for first update.";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "Updated recently.";
    }

    return `Updated ${new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(date)}`;
}

function render(display, selection = null) {
    const nextPlaylist = getPlayableItems(display);
    const nextPlaylistKey = getPlaylistKey(nextPlaylist);
    const playlistChanged = nextPlaylistKey !== playerState.playlistKey;

    playerState.display = display;
    playerState.playlist = nextPlaylist;
    playerState.playlistKey = nextPlaylistKey;
    if (playlistChanged || playerState.index >= playerState.playlist.length) {
        playerState.index = 0;
        playerState.renderedItemKey = "";
    }

    if (selection) {
        playerState.index = findPlaybackIndex(nextPlaylist, selection.slideId, selection.mediaIndex);
    }
    renderBrandText(elements.statusLabel, display.statusLabel || defaultDisplay.statusLabel);
    renderBrandText(elements.ticker, display.ticker || "");
    renderCurrentPlaylistItem();
    scheduleTickerFit();
    if (playlistChanged || !playerState.timer) {
        scheduleNextItem();
    }
}

function renderBrandText(element, value) {
    const text = String(value || "");
    const parts = text.split(/(steelwrist)/gi);

    element.replaceChildren(...parts.filter(Boolean).map(part => {
        if (part.toLowerCase() !== "steelwrist") {
            return document.createTextNode(part);
        }

        const logo = document.createElement("img");
        logo.className = "steelwrist-wordmark";
        logo.src = "media/images/steelwrist_text_only.png";
        logo.alt = "Steelwrist";
        return logo;
    }));
}

function getPlaylistKey(playlist) {
    return playlist
        .map(item => [
            item.id || "",
            item.slideId || "",
            item.mediaId || "",
            item.url || "",
            item.mediaType || "",
            item.layoutMode || "",
            item.mediaLayout || "",
            item.mediaSide || "",
            item.mediaPercent || 68,
            item.backgroundColor || "",
            item.backgroundAccentColor || "",
            item.backgroundAccentStrength || 100,
            item.durationSeconds || 0,
            item.mediaDurationSeconds || 0,
            item.statusLabel || "",
            item.headline || "",
            item.subheadline || "",
            item.announcement || "",
            item.cropX || 50,
            item.cropY || 50,
            item.zoom || 120,
            Array.isArray(item.mediaItems)
                ? item.mediaItems.map(media => [
                    media.id || "",
                    media.url || "",
                    media.mediaType || "",
                    media.cropX || 50,
                    media.cropY || 50,
                    media.size || 100,
                    media.zoom || 120
                ].join("~")).join(",")
                : ""
        ].join("|"))
        .join("::");
}

function renderCurrentPlaylistItem() {
    const generation = ++playerState.renderGeneration;
    const item = playerState.playlist[playerState.index] || null;
    const mediaUrl = item?.url || "";
    const isVideo = item?.mediaType === "video";
    const itemKey = item ? `${item.id || ""}:${item.url || ""}:${playerState.index}` : "";

    if (itemKey !== playerState.renderedItemKey) {
        playerState.renderedItemKey = itemKey;
        renderMediaWithTransition(item, mediaUrl, isVideo, generation);
        return;
    }

    applyMedia(item, mediaUrl, isVideo);
}

function renderMediaWithTransition(item, mediaUrl, isVideo, generation) {
    if (isPreview) {
        applyMedia(item, mediaUrl, isVideo);
        return;
    }
    if (!mediaUrl || isVideo) {
        applyMedia(item, mediaUrl, isVideo);
        runSlideTransition(item);
        return;
    }

    const image = new Image();
    image.onload = async () => {
        try {
            if (typeof image.decode === "function") {
                await image.decode();
            }
        } catch {
            // The browser can still paint the loaded image if decode is unavailable or rejected.
        }
        if (generation !== playerState.renderGeneration) return;
        applyMedia(item, mediaUrl, isVideo);
        runSlideTransition(item);
    };
    image.onerror = () => {
        if (generation !== playerState.renderGeneration) return;
        applyMedia(item, mediaUrl, isVideo);
        runSlideTransition(item);
    };
    image.src = mediaUrl;
}

function runSlideTransition(item) {
    elements.root.dataset.layout = getLayoutMode(item);
    elements.root.classList.remove("is-transitioning");
    void elements.root.offsetWidth;
    elements.root.classList.add("is-transitioning");
    window.setTimeout(() => {
        elements.root.classList.remove("is-transitioning");
    }, 560);
}

function applyMedia(item, mediaUrl, isVideo) {
    elements.root.dataset.layout = getLayoutMode(item);
    elements.root.dataset.mediaSide = getMediaSide(item);
    elements.root.style.setProperty("--media-percent", `${clampPercent(item?.mediaPercent, 68)}%`);
    elements.root.style.setProperty("--text-percent", `${100 - clampPercent(item?.mediaPercent, 68)}%`);
    applySlideBackgroundStyles(elements.root, item);
    renderSlideText(item);
    scheduleTickerFit();

    const mediaItems = Array.isArray(item?.mediaItems) ? item.mediaItems.filter(media => media?.url) : [];
    const isMediaGroup = item?.mediaType === "group" || shouldShowMediaGroup(item, mediaItems);
    if (isMediaGroup) {
        renderDisplayMediaGrid(mediaItems);
        elements.promoPlaceholder.classList.add("hidden");
        elements.promoMediaGrid.classList.remove("hidden");
        elements.promoImage.classList.add("hidden");
        elements.promoVideo.classList.add("hidden");
        elements.promoImage.removeAttribute("src");
        elements.promoVideo.removeAttribute("src");
        return;
    }
    elements.promoMediaGrid.classList.add("hidden");
    elements.promoMediaGrid.replaceChildren();

    elements.promoPlaceholder.classList.toggle("hidden", Boolean(mediaUrl));
    elements.promoImage.classList.toggle("hidden", !mediaUrl || isVideo);
    elements.promoVideo.classList.toggle("hidden", !mediaUrl || !isVideo);

    if (!mediaUrl) {
        displayAudio.setVideos([]);
        elements.promoImage.removeAttribute("src");
        elements.promoVideo.removeAttribute("src");
        elements.promoImage.style.objectPosition = "";
        elements.promoVideo.style.objectPosition = "";
        elements.promoImage.style.transform = "";
        elements.promoVideo.style.transform = "";
        elements.promoImage.style.transformOrigin = "";
        elements.promoVideo.style.transformOrigin = "";
        return;
    }

    if (isVideo) {
        if (elements.promoVideo.getAttribute("src") !== mediaUrl) {
            elements.promoVideo.src = mediaUrl;
            elements.promoVideo.load();
        }
        displayAudio.setVideos([elements.promoVideo]);
        applyCropStyles(elements.promoVideo, item);
        elements.promoImage.removeAttribute("src");
        return;
    }

    displayAudio.setVideos([]);
    if (elements.promoImage.getAttribute("src") !== mediaUrl) {
        elements.promoImage.src = mediaUrl;
    }
    elements.promoImage.alt = item?.title || "Promotional media";
    applyCropStyles(elements.promoImage, item);
    elements.promoVideo.removeAttribute("src");
}

function renderDisplayMediaGrid(mediaItems) {
    elements.promoMediaGrid.replaceChildren();
    const videos = [];
    elements.promoMediaGrid.dataset.count = String(mediaItems.length);
    elements.promoMediaGrid.style.gridTemplateColumns = getMediaGridTemplate(mediaItems);
    mediaItems.forEach((media, index) => {
        const cell = document.createElement("div");
        cell.className = "promo-media-cell";
        const element = media.mediaType === "video" ? document.createElement("video") : document.createElement("img");
        if (media.mediaType === "video") {
            element.muted = true;
            element.loop = true;
            element.autoplay = true;
            element.playsInline = true;
            element.src = media.url;
            videos.push(element);
        } else {
            element.src = media.url;
            element.alt = media.title || "Promotional media";
        }
        element.dataset.mediaIndex = String(index);
        applyCropStyles(element, media);
        cell.appendChild(element);
        elements.promoMediaGrid.appendChild(cell);
    });
    displayAudio.setVideos(videos);
}

function normalizeColor(value, fallback = "#020403") {
    const color = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(color) ? color.toLowerCase() : fallback;
}

function clampAccentStrength(value) {
    const number = Number.parseInt(value, 10);
    if (Number.isNaN(number)) return 100;
    return Math.max(0, Math.min(200, number));
}

function hexToRgbTriplet(value, fallback = "#2fb764") {
    const color = normalizeColor(value, fallback).slice(1);
    const number = Number.parseInt(color, 16);
    return `${(number >> 16) & 255} ${(number >> 8) & 255} ${number & 255}`;
}

function applySlideBackgroundStyles(element, item) {
    if (!element) return;
    element.style.setProperty("--slide-bg", normalizeColor(item?.backgroundColor));
    element.style.setProperty("--slide-accent-rgb", hexToRgbTriplet(item?.backgroundAccentColor));
    element.style.setProperty("--slide-accent-strength", (clampAccentStrength(item?.backgroundAccentStrength) / 100).toFixed(2));
}

function getMediaGridTemplate(mediaItems) {
    return mediaItems.map(media => `${clampMediaSize(media?.size)}fr`).join(" ");
}

function getCropPosition(item) {
    return `${clampCropValue(item?.cropX).toFixed(2)}% ${clampCropValue(item?.cropY).toFixed(2)}%`;
}

function applyCropStyles(element, item) {
    if (!element) return;
    const cropPosition = getCropPosition(item);
    element.style.objectPosition = cropPosition;
    element.style.transformOrigin = cropPosition;
    element.style.transform = `scale(${(clampCropZoom(item?.zoom) / 100).toFixed(3)})`;
}

function renderSlideText(item) {
    renderBrandText(elements.statusLabel, item?.statusLabel || "");
    renderBrandText(elements.headline, item?.headline || "");
    renderBrandText(elements.subheadline, item?.subheadline || "");
    renderBrandText(elements.announcement, item?.announcement || "");
    elements.root.classList.toggle("has-slide-copy", Boolean(
        item?.statusLabel || item?.headline || item?.subheadline || item?.announcement
    ));
    updateMediaCutout();
}

function getLayoutMode(item) {
    const layoutMode = String(item?.layoutMode || "split").trim().toLowerCase();
    if (layoutMode === "fullscreen-text") return "overlay";
    if (["fullscreen", "overlay", "split"].includes(layoutMode)) return layoutMode;
    return "split";
}

function getMediaSide(item) {
    return String(item?.mediaSide || "left").trim().toLowerCase() === "right" ? "right" : "left";
}

function updateMediaCutout() {
    window.requestAnimationFrame(() => {
        const isFullscreenText = ["fullscreen-text", "overlay"].includes(elements.root.dataset.layout);
        const hasSlideCopy = elements.root.classList.contains("has-slide-copy");
        if (!isFullscreenText || !hasSlideCopy || !elements.promoCopy) {
            elements.root.style.setProperty("--copy-cutout-w", "0px");
            elements.root.style.setProperty("--copy-cutout-h", "0px");
            return;
        }

        const rect = elements.promoCopy.getBoundingClientRect();
        elements.root.style.setProperty("--copy-cutout-w", `${Math.ceil(rect.width)}px`);
        elements.root.style.setProperty("--copy-cutout-h", `${Math.ceil(rect.height)}px`);
    });
}

function scheduleNextItem() {
    window.clearTimeout(playerState.timer);
    playerState.timer = null;
    if (isPreview || playerState.playlist.length <= 1) {
        return;
    }

    const item = playerState.playlist[playerState.index] || {};
    const seconds = Number(item.durationSeconds || playerState.display.slideDurationSeconds || 12);
    preloadUpcomingImage();
    playerState.timer = window.setTimeout(() => {
        playerState.index = (playerState.index + 1) % playerState.playlist.length;
        renderCurrentPlaylistItem();
        scheduleNextItem();
    }, Math.max(3, seconds) * 1000);
}

function preloadUpcomingImage() {
    if (playerState.playlist.length <= 1) {
        return;
    }

    const nextIndex = (playerState.index + 1) % playerState.playlist.length;
    const item = playerState.playlist[nextIndex];
    if (!item?.url || item.mediaType === "video") {
        return;
    }

    const image = new Image();
    image.src = item.url;
}

async function refresh() {
    try {
        render(await fetchDisplay());
    } catch (error) {
        console.error(error);
        render(readLocalDisplay());
    }
}

let tickerFitFrame = null;

function scheduleTickerFit() {
    window.cancelAnimationFrame(tickerFitFrame);
    tickerFitFrame = window.requestAnimationFrame(fitTicker);
}

function fitTicker() {
    const ticker = elements.ticker;
    ticker.style.fontSize = "";
    if (!ticker.textContent.trim() || !ticker.clientWidth) return;
    const strip = ticker.parentElement;
    const stripStyle = getComputedStyle(strip);
    const availableHeight = strip.clientHeight - parseFloat(stripStyle.paddingTop) - parseFloat(stripStyle.paddingBottom);
    let high = parseFloat(getComputedStyle(ticker).fontSize);
    let low = 1;
    const fits = () => ticker.scrollWidth <= ticker.clientWidth && ticker.scrollHeight <= availableHeight;
    if (fits()) return;
    for (let step = 0; step < 14; step++) {
        const size = (low + high) / 2;
        ticker.style.fontSize = `${size}px`;
        if (fits()) low = size;
        else high = size;
    }
    ticker.style.fontSize = `${low}px`;
}

function sendPreviewCrop(phase) {
    const drag = previewCropDrag;
    if (!drag) return;
    window.parent.postMessage({
        type: "sw-display-preview:crop", revision: previewRevision, phase,
        slideId: drag.slideId, mediaId: drag.mediaId, mediaIndex: drag.mediaIndex,
        cropX: drag.media.cropX, cropY: drag.media.cropY
    }, window.location.origin);
}

function setupPreview() {
    document.body.dataset.preview = "true";
    window.addEventListener("message", event => {
        if (event.origin !== window.location.origin || event.source !== window.parent) return;
        const message = event.data;
        if (message?.type === "sw-display-preview:audio" && typeof message.muted === "boolean") {
            displayAudio.setMuted(message.muted);
            return;
        }
        if (message?.type !== "sw-display-preview:render" || !Array.isArray(message.display?.playlist)) return;
        displayAudio.setMuted(message.audioMuted !== false);
        previewRevision = message.revision;
        previewCropDrag = null;
        render({ ...defaultDisplay, ...message.display }, message.selection);
    });
    elements.promoMediaShell.addEventListener("pointerdown", event => {
        if (event.button !== 0) return;
        const target = event.target.closest("img");
        const item = playerState.playlist[playerState.index];
        if (!target || !item) return;
        const group = item.mediaType === "group";
        const mediaIndex = group ? Number(target.dataset.mediaIndex) : (item.mediaSequenceIndex || 0);
        const media = group ? item.mediaItems[mediaIndex] : item;
        if (!media?.url || media.mediaType === "video") return;
        event.preventDefault();
        const box = (target.closest(".promo-media-cell") || elements.promoMediaShell).getBoundingClientRect();
        previewCropDrag = {
            pointerId: event.pointerId, target, box, media,
            mediaIndex, mediaId: media.id && group ? media.id : item.mediaId,
            slideId: item.slideId || item.id,
            startX: event.clientX, startY: event.clientY,
            cropX: clampCropValue(media.cropX), cropY: clampCropValue(media.cropY)
        };
        target.setPointerCapture(event.pointerId);
        sendPreviewCrop("start");
    });
    elements.promoMediaShell.addEventListener("pointermove", event => {
        const drag = previewCropDrag;
        if (!drag || event.pointerId !== drag.pointerId) return;
        drag.media.cropX = clampCropValue(drag.cropX - (event.clientX - drag.startX) / Math.max(drag.box.width, 1) * 100);
        drag.media.cropY = clampCropValue(drag.cropY - (event.clientY - drag.startY) / Math.max(drag.box.height, 1) * 100);
        applyCropStyles(drag.target, drag.media);
        sendPreviewCrop("move");
    });
    const endDrag = event => {
        const drag = previewCropDrag;
        if (!drag || event.pointerId !== drag.pointerId) return;
        if (drag.target.hasPointerCapture(event.pointerId)) drag.target.releasePointerCapture(event.pointerId);
        sendPreviewCrop("end");
        previewCropDrag = null;
    };
    elements.promoMediaShell.addEventListener("pointerup", endDrag);
    elements.promoMediaShell.addEventListener("pointercancel", endDrag);
    window.parent.postMessage({ type: "sw-display-preview:ready" }, window.location.origin);
}

window.addEventListener("storage", event => {
    if (!isPreview && event.key === AUDIO_KEY && !(config.storageMode === "cloudflare" && config.apiBaseUrl)) {
        refreshAudio();
    }
    if (!isPreview && event.key === DISPLAY_KEY && !(config.storageMode === "cloudflare" && config.apiBaseUrl)) {
        render(readLocalDisplay());
    }
});
window.addEventListener("resize", () => { updateMediaCutout(); scheduleTickerFit(); });
elements.root.addEventListener("load", scheduleTickerFit, true);
document.fonts?.ready?.then(() => { updateMediaCutout(); scheduleTickerFit(); }).catch(() => undefined);

if (isPreview) {
    render(defaultDisplay);
    setupPreview();
} else {
    render(config.storageMode === "cloudflare" && config.apiBaseUrl ? defaultDisplay : readLocalDisplay());
    refresh();
    refreshAudio();
    window.setInterval(refresh, REFRESH_MS);
    window.setInterval(refreshAudio, REFRESH_MS);
}
runPerformanceProbe();
animateBackground();
