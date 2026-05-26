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
const REFRESH_MS = 8000;
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
    performanceMode: "high"
};

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

function render(display) {
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

    elements.statusLabel.textContent = display.statusLabel || defaultDisplay.statusLabel;
    elements.ticker.textContent = display.ticker || "";
    renderCurrentPlaylistItem();
    if (playlistChanged || !playerState.timer) {
        scheduleNextItem();
    }
}

function getPlayableItems(display) {
    const playlist = Array.isArray(display.playlist) ? display.playlist : [];
    const playable = playlist.flatMap((slide, slideIndex) => {
        if (Array.isArray(slide?.mediaItems)) {
            const mediaItems = slide.mediaItems.filter(media => media?.url);
            if (mediaItems.length === 0) {
                return [{
                    ...slide,
                    id: slide.id || `slide-${slideIndex}`,
                    mediaSequenceIndex: 0,
                    mediaSequenceTotal: 0,
                    title: slide.title || `Slide ${slideIndex + 1}`,
                    mediaType: "image",
                    url: ""
                }];
            }

            return mediaItems.map((media, mediaIndex) => ({
                ...slide,
                id: `${slide.id || `slide-${slideIndex}`}:${media.id || mediaIndex}`,
                slideId: slide.id || `slide-${slideIndex}`,
                mediaId: media.id || "",
                mediaSequenceIndex: mediaIndex,
                mediaSequenceTotal: mediaItems.length,
                title: media.title || slide.title || `Slide ${slideIndex + 1}`,
                mediaType: media.mediaType || "image",
                url: media.url || "",
                durationSeconds: slide.mediaDurationSeconds || slide.durationSeconds || 0
            }));
        }

        if (slide?.url) {
            return [slide];
        }

        return [];
    });
    if (playable.length > 0) {
        return playable;
    }

    if (display.mediaUrl) {
        return [{
            id: "legacy-media",
            title: display.mediaAlt || "Promotional media",
            mediaType: display.mediaType || "image",
            url: display.mediaUrl,
            durationSeconds: display.slideDurationSeconds || 12,
            layoutMode: "split",
            headline: display.headline || "",
            subheadline: display.subheadline || "",
            announcement: display.announcement || ""
        }];
    }

    return [];
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
            item.durationSeconds || 0,
            item.mediaDurationSeconds || 0,
            item.statusLabel || "",
            item.headline || "",
            item.subheadline || "",
            item.announcement || ""
        ].join("|"))
        .join("::");
}

function renderCurrentPlaylistItem() {
    const item = playerState.playlist[playerState.index] || null;
    const mediaUrl = item?.url || "";
    const isVideo = item?.mediaType === "video";
    const itemKey = item ? `${item.id || ""}:${item.url || ""}:${playerState.index}` : "";

    if (itemKey !== playerState.renderedItemKey) {
        playerState.renderedItemKey = itemKey;
        renderMediaWithTransition(item, mediaUrl, isVideo);
        return;
    }

    applyMedia(item, mediaUrl, isVideo);
}

function renderMediaWithTransition(item, mediaUrl, isVideo) {
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
        applyMedia(item, mediaUrl, isVideo);
        runSlideTransition(item);
    };
    image.onerror = () => {
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
    renderSlideText(item);

    elements.promoPlaceholder.classList.toggle("hidden", Boolean(mediaUrl));
    elements.promoImage.classList.toggle("hidden", !mediaUrl || isVideo);
    elements.promoVideo.classList.toggle("hidden", !mediaUrl || !isVideo);

    if (!mediaUrl) {
        elements.promoImage.removeAttribute("src");
        elements.promoVideo.removeAttribute("src");
        return;
    }

    if (isVideo) {
        if (elements.promoVideo.getAttribute("src") !== mediaUrl) {
            elements.promoVideo.src = mediaUrl;
            elements.promoVideo.load();
            elements.promoVideo.play().catch(() => undefined);
        }
        elements.promoImage.removeAttribute("src");
        return;
    }

    if (elements.promoImage.getAttribute("src") !== mediaUrl) {
        elements.promoImage.src = mediaUrl;
    }
    elements.promoImage.alt = item?.title || "Promotional media";
    elements.promoVideo.removeAttribute("src");
}

function renderSlideText(item) {
    elements.statusLabel.textContent = item?.statusLabel || "";
    elements.headline.textContent = item?.headline || "";
    elements.subheadline.textContent = item?.subheadline || "";
    elements.announcement.textContent = item?.announcement || "";
    elements.root.classList.toggle("has-slide-copy", Boolean(
        item?.statusLabel || item?.headline || item?.subheadline || item?.announcement
    ));
    updateMediaCutout();
}

function getLayoutMode(item) {
    const layoutMode = String(item?.layoutMode || "split").trim().toLowerCase();
    const hasSlideCopy = Boolean(item?.statusLabel || item?.headline || item?.subheadline || item?.announcement);
    if (layoutMode === "fullscreen" && hasSlideCopy) {
        return "fullscreen-text";
    }
    if (["fullscreen", "fullscreen-text", "split"].includes(layoutMode)) {
        return layoutMode;
    }
    return "split";
}

function updateMediaCutout() {
    window.requestAnimationFrame(() => {
        const isFullscreenText = elements.root.dataset.layout === "fullscreen-text";
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
    if (playerState.playlist.length <= 1) {
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

window.addEventListener("storage", event => {
    if (event.key === DISPLAY_KEY) {
        if (!(config.storageMode === "cloudflare" && config.apiBaseUrl)) {
            render(readLocalDisplay());
        }
    }
});

window.addEventListener("resize", updateMediaCutout);
document.fonts?.ready?.then(updateMediaCutout).catch(() => undefined);

if (config.storageMode === "cloudflare" && config.apiBaseUrl) {
    render(defaultDisplay);
} else {
    render(readLocalDisplay());
}
refresh();
runPerformanceProbe();
animateBackground();
window.setInterval(refresh, REFRESH_MS);
