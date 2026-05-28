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

const apiBaseUrl = config.apiBaseUrl.replace(/\/+$/, "");
const DISPLAY_KEY = "sw-tv-display:state";
const TOKEN_KEY = "sw-tv-display:token";
const USER_KEY = "sw-tv-display:user";
const MEDIA_KEY = "sw-tv-display:media";
const SLIDESHOWS_KEY = "sw-tv-display:slideshows";

const defaultDisplay = {
    statusLabel: "Steelwrist Presents",
    statusValue: "",
    headline: "",
    subheadline: "",
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
    loginPanel: document.getElementById("login-panel"),
    editorPanel: document.getElementById("editor-panel"),
    loginForm: document.getElementById("login-form"),
    password: document.getElementById("admin-password"),
    loginStatus: document.getElementById("login-status"),
    signOut: document.getElementById("sign-out"),
    loopView: document.getElementById("loop-view"),
    mediaView: document.getElementById("media-view"),
    openMediaBrowser: document.getElementById("open-media-browser"),
    slideRailAdd: document.getElementById("slide-rail-add"),
    backToLoop: document.getElementById("back-to-loop"),
    form: document.getElementById("display-form"),
    saveStatus: document.getElementById("save-status"),
    refresh: document.getElementById("refresh-display"),
    refreshMedia: document.getElementById("refresh-media"),
    mediaStatus: document.getElementById("media-status"),
    mediaLibrary: document.getElementById("media-library"),
    mediaLightbox: document.getElementById("media-lightbox"),
    mediaLightboxContent: document.getElementById("media-lightbox-content"),
    playlistList: document.getElementById("playlist-list"),
    slideSettings: document.getElementById("slide-settings"),
    slideshowSaveForm: document.getElementById("slideshow-save-form"),
    slideshowName: document.getElementById("slideshow-name"),
    saveSlideshow: document.getElementById("save-slideshow"),
    updateSlideshow: document.getElementById("update-slideshow"),
    refreshSlideshows: document.getElementById("refresh-slideshows"),
    slideshowList: document.getElementById("slideshow-list"),
    slideshowStatus: document.getElementById("slideshow-status"),
    clearPlaylist: document.getElementById("clear-playlist"),
    uploadForm: document.getElementById("upload-form"),
    uploadFile: document.getElementById("upload-file"),
    uploadTitle: document.getElementById("upload-title"),
    linkForm: document.getElementById("link-form"),
    linkTitle: document.getElementById("link-title"),
    linkUrl: document.getElementById("link-url"),
    linkMediaType: document.getElementById("link-media-type"),
    preview: {
        root: document.getElementById("preview-root"),
        mediaShell: document.getElementById("preview-media-shell"),
        image: document.getElementById("preview-image"),
        video: document.getElementById("preview-video"),
        mediaGrid: document.getElementById("preview-media-grid"),
        placeholder: document.getElementById("preview-placeholder"),
        statusLabel: document.getElementById("preview-status-label"),
        headline: document.getElementById("preview-headline"),
        subheadline: document.getElementById("preview-subheadline"),
        announcement: document.getElementById("preview-announcement"),
        ticker: document.getElementById("preview-ticker"),
        prev: document.getElementById("preview-prev"),
        next: document.getElementById("preview-next"),
        counter: document.getElementById("preview-counter")
    },
    fields: {
        ticker: document.getElementById("ticker"),
        slideDurationSeconds: document.getElementById("slide-duration-seconds")
    }
};

let token = window.localStorage.getItem(TOKEN_KEY) || "";
let user = readStoredUser();
let mediaAssets = readLocalMedia();
let savedSlideshows = readLocalSlideshows();
let playlist = [];
let previewIndex = 0;
let previewMediaIndex = 0;
let selectedSlideshowId = "";
let cropDrag = null;

function readStoredUser() {
    const stored = window.localStorage.getItem(USER_KEY);
    if (!stored) return null;
    try {
        return JSON.parse(stored);
    } catch {
        return null;
    }
}

function setStatus(element, message, isError = false) {
    element.textContent = message;
    element.style.color = isError ? "var(--danger)" : "var(--muted)";
}

function setSession(nextToken, nextUser) {
    token = nextToken || "";
    user = nextUser || null;
    token ? window.localStorage.setItem(TOKEN_KEY, token) : window.localStorage.removeItem(TOKEN_KEY);
    user ? window.localStorage.setItem(USER_KEY, JSON.stringify(user)) : window.localStorage.removeItem(USER_KEY);
    renderAuth();
}

function renderAuth() {
    const signedIn = Boolean(token && user);
    elements.loginPanel.classList.toggle("hidden", signedIn);
    elements.editorPanel.classList.toggle("hidden", !signedIn);
    if (signedIn) {
        showAdminView("loop");
    } else {
        elements.mediaView.classList.add("hidden");
        elements.loopView.classList.remove("is-dimmed");
    }
}

function showAdminView(view) {
    const isMedia = view === "media";
    document.body.classList.toggle("is-media-view", isMedia);
    elements.loopView.classList.toggle("is-dimmed", isMedia);
    elements.mediaView.classList.toggle("hidden", !isMedia);
    if (isMedia) {
        renderMediaLibrary();
    }
}

function readLocalDisplay() {
    const stored = window.localStorage.getItem(DISPLAY_KEY);
    if (!stored) return defaultDisplay;
    try {
        return {
            ...defaultDisplay,
            ...JSON.parse(stored)
        };
    } catch {
        return defaultDisplay;
    }
}

function writeLocalDisplay(display) {
    window.localStorage.setItem(DISPLAY_KEY, JSON.stringify(display));
}

function readLocalMedia() {
    const stored = window.localStorage.getItem(MEDIA_KEY);
    if (!stored) return [];
    try {
        return JSON.parse(stored);
    } catch {
        return [];
    }
}

function writeLocalMedia(assets) {
    window.localStorage.setItem(MEDIA_KEY, JSON.stringify(assets));
}

function readLocalSlideshows() {
    const stored = window.localStorage.getItem(SLIDESHOWS_KEY);
    if (!stored) return [];
    try {
        return JSON.parse(stored);
    } catch {
        return [];
    }
}

function writeLocalSlideshows(slideshows) {
    window.localStorage.setItem(SLIDESHOWS_KEY, JSON.stringify(slideshows));
}

function normalizeSlide(item, display = defaultDisplay, index = 0) {
    const mediaItems = Array.isArray(item.mediaItems)
        ? item.mediaItems.map(normalizeSlideMediaItem)
        : item.url
            ? [normalizeSlideMediaItem({
                id: item.id || crypto.randomUUID(),
                title: item.title || item.mediaAlt || `Media ${index + 1}`,
                mediaType: item.mediaType || "image",
                url: item.url,
                cropX: item.cropX,
                cropY: item.cropY,
                size: item.size,
                zoom: item.zoom
            })]
            : [];

    return {
        id: item.slideId || item.id || crypto.randomUUID(),
        title: item.slideTitle || item.title || `Slide ${index + 1}`,
        mediaItems,
        mediaDurationSeconds: item.mediaDurationSeconds || item.durationSeconds || 0,
        durationSeconds: item.durationSeconds || 0,
        layoutMode: normalizeLayoutMode(item.layoutMode),
        mediaLayout: item.mediaLayout === "side-by-side" ? "side-by-side" : "rotate",
        mediaSide: normalizeMediaSide(item.mediaSide),
        mediaPercent: clampPercent(item.mediaPercent, 68),
        backgroundColor: normalizeColor(item.backgroundColor),
        backgroundAccentColor: normalizeColor(item.backgroundAccentColor, "#2fb764"),
        backgroundAccentStrength: clampAccentStrength(item.backgroundAccentStrength),
        statusLabel: item.statusLabel ?? display.statusLabel ?? defaultDisplay.statusLabel,
        headline: item.headline || "",
        subheadline: item.subheadline || "",
        announcement: item.announcement || ""
    };
}

function createBlankSlide() {
    return normalizeSlide({
        id: crypto.randomUUID(),
        title: `Slide ${playlist.length + 1}`,
        mediaItems: [],
        statusLabel: "Steelwrist Presents"
    }, defaultDisplay, playlist.length);
}

function getSlideMediaItems(slide) {
    return Array.isArray(slide?.mediaItems) ? slide.mediaItems : [];
}

function getSelectedSlide() {
    return playlist[previewIndex] || null;
}

function getSelectedMedia(slide = getSelectedSlide()) {
    const mediaItems = getSlideMediaItems(slide);
    if (mediaItems.length === 0) return null;
    previewMediaIndex = Math.min(previewMediaIndex, mediaItems.length - 1);
    return mediaItems[previewMediaIndex] || null;
}

function normalizeSlideMediaItem(item) {
    return {
        id: item.id || crypto.randomUUID(),
        title: item.title || "Untitled media",
        mediaType: item.mediaType || "image",
        url: item.url || "",
        cropX: clampCropValue(item.cropX),
        cropY: clampCropValue(item.cropY),
        size: clampMediaSize(item.size),
        zoom: clampCropZoom(item.zoom)
    };
}

function clampCropValue(value) {
    const number = Number.parseFloat(value);
    if (Number.isNaN(number)) return 50;
    return Math.max(0, Math.min(100, number));
}

function clampPercent(value, fallback = 50) {
    const number = Number.parseInt(value, 10);
    if (Number.isNaN(number)) return fallback;
    return Math.max(25, Math.min(80, number));
}

function clampMediaSize(value) {
    const number = Number.parseInt(value, 10);
    if (Number.isNaN(number)) return 100;
    return Math.max(25, Math.min(300, number));
}

function clampCropZoom(value) {
    const number = Number.parseInt(value, 10);
    if (Number.isNaN(number)) return 120;
    return Math.max(100, Math.min(250, number));
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

function applySlideBackgroundStyles(element, slide) {
    if (!element) return;
    element.style.setProperty("--slide-bg", normalizeColor(slide?.backgroundColor));
    element.style.setProperty("--slide-accent-rgb", hexToRgbTriplet(slide?.backgroundAccentColor));
    element.style.setProperty("--slide-accent-strength", (clampAccentStrength(slide?.backgroundAccentStrength) / 100).toFixed(2));
}

function normalizeLayoutMode(value) {
    const layoutMode = String(value || "split").trim().toLowerCase();
    if (layoutMode === "fullscreen-text") return "overlay";
    if (["split", "fullscreen", "overlay"].includes(layoutMode)) return layoutMode;
    return "split";
}

function normalizeMediaSide(value) {
    return String(value || "left").trim().toLowerCase() === "right" ? "right" : "left";
}

function getCropPosition(media) {
    return `${clampCropValue(media?.cropX).toFixed(2)}% ${clampCropValue(media?.cropY).toFixed(2)}%`;
}

function applyCropStyles(element, media) {
    if (!element) return;
    const cropPosition = getCropPosition(media);
    element.style.objectPosition = cropPosition;
    element.style.transformOrigin = cropPosition;
    element.style.transform = `scale(${(clampCropZoom(media?.zoom) / 100).toFixed(3)})`;
}

function getMediaGridTemplate(mediaItems) {
    return mediaItems.map(media => `${clampMediaSize(media?.size)}fr`).join(" ");
}

async function request(path, options = {}) {
    const response = await fetch(`${apiBaseUrl}${path}`, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...(options.auth && token ? { Authorization: `Bearer ${token}` } : {}),
            ...(options.headers || {})
        }
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(payload?.error || "Request failed.");
    }
    return payload;
}

async function fetchDisplay() {
    if (config.storageMode === "cloudflare" && apiBaseUrl) {
        const payload = await request("/api/display");
        return {
            ...defaultDisplay,
            ...(payload?.display || {})
        };
    }
    return readLocalDisplay();
}

async function saveDisplay(display) {
    if (config.storageMode === "cloudflare" && apiBaseUrl) {
        const payload = await request("/api/display", {
            method: "PATCH",
            auth: true,
            body: JSON.stringify(display)
        });
        const savedDisplay = keepNonEmptyPlaylist(display, payload?.display || display);
        writeLocalDisplay(savedDisplay);
        return savedDisplay;
    }

    const localDisplay = {
        ...display,
        updatedBy: "local admin",
        updatedAt: new Date().toISOString()
    };
    writeLocalDisplay(localDisplay);
    return localDisplay;
}

async function fetchMediaAssets() {
    if (config.storageMode === "cloudflare" && apiBaseUrl) {
        const payload = await request("/api/display/media");
        mediaAssets = payload?.assets || [];
    } else {
        mediaAssets = readLocalMedia();
    }
    writeLocalMedia(mediaAssets);
    renderMediaLibrary();
}

async function fetchSlideshows() {
    try {
        if (config.storageMode === "cloudflare" && apiBaseUrl) {
            const payload = await request("/api/display/slideshows", { auth: true });
            savedSlideshows = payload?.slideshows || [];
        } else {
            savedSlideshows = readLocalSlideshows();
        }
        writeLocalSlideshows(savedSlideshows);
        renderSlideshows();
    } catch (error) {
        renderSlideshows();
        setStatus(elements.slideshowStatus, error.message, true);
    }
}

async function createSlideshow(slideshow) {
    if (config.storageMode === "cloudflare" && apiBaseUrl) {
        const payload = await request("/api/display/slideshows", {
            method: "POST",
            auth: true,
            body: JSON.stringify(slideshow)
        });
        return payload.slideshow;
    }

    return {
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: user?.user || "local admin",
        ...slideshow
    };
}

async function updateSavedSlideshow(slideshowId, slideshow) {
    const existing = savedSlideshows.find(item => item.id === slideshowId) || {};
    if (config.storageMode === "cloudflare" && apiBaseUrl) {
        const payload = await request(`/api/display/slideshows/${slideshowId}`, {
            method: "PATCH",
            auth: true,
            body: JSON.stringify(slideshow)
        });
        return payload.slideshow;
    }

    return {
        ...existing,
        ...slideshow,
        id: slideshowId,
        createdAt: existing.createdAt || new Date().toISOString(),
        createdBy: existing.createdBy || user?.user || "local admin",
        updatedAt: new Date().toISOString()
    };
}

async function deleteSavedSlideshow(slideshowId) {
    if (config.storageMode === "cloudflare" && apiBaseUrl) {
        await request(`/api/display/slideshows/${slideshowId}`, {
            method: "DELETE",
            auth: true
        });
    }
    savedSlideshows = savedSlideshows.filter(slideshow => slideshow.id !== slideshowId);
    writeLocalSlideshows(savedSlideshows);
}

async function createLinkedAsset(asset) {
    if (config.storageMode === "cloudflare" && apiBaseUrl) {
        const payload = await request("/api/display/media/link", {
            method: "POST",
            auth: true,
            body: JSON.stringify(asset)
        });
        return payload.asset;
    }

    return {
        id: crypto.randomUUID(),
        sourceType: "link",
        createdAt: new Date().toISOString(),
        ...asset
    };
}

async function uploadAsset(file, title) {
    if (!(config.storageMode === "cloudflare" && apiBaseUrl)) {
        throw new Error("Local demo mode can link media but cannot upload shared files.");
    }

    const form = new FormData();
    form.append("file", file);
    form.append("title", title || file.name || "Uploaded media");
    form.append("mediaType", file.type.startsWith("video/") ? "video" : "image");

    const response = await fetch(`${apiBaseUrl}/api/display/media/upload`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        throw new Error(payload?.error || "Upload failed.");
    }
    return payload.asset;
}

async function deleteAsset(assetId) {
    if (config.storageMode === "cloudflare" && apiBaseUrl) {
        await request(`/api/display/media/${assetId}`, {
            method: "DELETE",
            auth: true
        });
    }

    mediaAssets = mediaAssets.filter(asset => asset.id !== assetId);
    playlist = playlist.map(slide => ({
        ...slide,
        mediaItems: getSlideMediaItems(slide).filter(media => media.id !== assetId)
    }));
    writeLocalMedia(mediaAssets);
}

async function renameAsset(assetId, title) {
    const normalizedTitle = title.trim();
    if (!normalizedTitle) {
        throw new Error("Media name cannot be empty.");
    }

    if (config.storageMode === "cloudflare" && apiBaseUrl) {
        const payload = await request(`/api/display/media/${assetId}`, {
            method: "PATCH",
            auth: true,
            body: JSON.stringify({ title: normalizedTitle })
        });
        return payload.asset;
    }

    const asset = mediaAssets.find(item => item.id === assetId);
    if (!asset) {
        throw new Error("Media not found.");
    }
    asset.title = normalizedTitle;
    writeLocalMedia(mediaAssets);
    return asset;
}

function fillForm(display) {
    Object.entries(elements.fields).forEach(([key, input]) => {
        input.value = display[key] ?? "";
    });
    playlist = Array.isArray(display.playlist)
        ? display.playlist.map((item, index) => normalizeSlide(item, display, index))
        : [];
    previewIndex = Math.min(previewIndex, Math.max(playlist.length - 1, 0));
    previewMediaIndex = 0;
    renderPlaylist();
}

function collectForm() {
    const display = Object.entries(elements.fields).reduce((current, [key, input]) => {
        current[key] = input.value.trim();
        return current;
    }, {});
    const firstMedia = getSlideMediaItems(playlist[0] || {})[0] || {};
    display.playlist = playlist;
    display.mediaUrl = firstMedia.url || "";
    display.mediaType = firstMedia.mediaType || "image";
    display.mediaAlt = firstMedia.title || "Promotional media";
    return display;
}

function collectSlideshowPayload() {
    return {
        title: elements.slideshowName.value.trim(),
        playlist: playlist.map(slide => ({
            ...slide,
            mediaItems: getSlideMediaItems(slide)
        })),
        ticker: elements.fields.ticker.value.trim(),
        slideDurationSeconds: Number.parseInt(elements.fields.slideDurationSeconds.value, 10) || 12
    };
}

function loadSlideshow(slideshow) {
    selectedSlideshowId = slideshow.id || "";
    elements.slideshowName.value = slideshow.title || "";
    elements.fields.ticker.value = slideshow.ticker || "";
    elements.fields.slideDurationSeconds.value = slideshow.slideDurationSeconds || defaultDisplay.slideDurationSeconds;
    playlist = Array.isArray(slideshow.playlist)
        ? slideshow.playlist.map((item, index) => normalizeSlide(item, defaultDisplay, index))
        : [];
    previewIndex = 0;
    previewMediaIndex = 0;
    renderPlaylist();
    renderSlideshows();
    setStatus(elements.slideshowStatus, `Loaded ${slideshow.title || "slideshow"}.`);
}

async function loadDisplay() {
    setStatus(elements.saveStatus, "Loading...");
    try {
        const display = keepNonEmptyPlaylist(readLocalDisplay(), await fetchDisplay());
        writeLocalDisplay(display);
        fillForm(display);
        setStatus(elements.saveStatus, "Loaded latest display.");
    } catch (error) {
        fillForm(readLocalDisplay());
        setStatus(elements.saveStatus, error.message, true);
    }
}

function keepNonEmptyPlaylist(localDisplay, remoteDisplay) {
    const localPlaylist = Array.isArray(localDisplay?.playlist) ? localDisplay.playlist : [];
    const remotePlaylist = Array.isArray(remoteDisplay?.playlist) ? remoteDisplay.playlist : [];
    if (localPlaylist.length > 0 && remotePlaylist.length === 0) {
        return {
            ...remoteDisplay,
            playlist: localPlaylist
        };
    }
    return remoteDisplay;
}

function createAssetPreview(asset, options = {}) {
    const shouldCrop = Boolean(options.crop);
    if (asset.mediaType === "video") {
        const video = document.createElement("video");
        video.src = asset.url;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = "metadata";
        if (shouldCrop) {
            applyCropStyles(video, asset);
        }
        return video;
    }

    const image = document.createElement("img");
    image.src = asset.url;
    image.alt = asset.title || "Media";
    if (shouldCrop) {
        applyCropStyles(image, asset);
    }
    return image;
}

function renderMediaLibrary() {
    elements.mediaLibrary.innerHTML = "";
    if (mediaAssets.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-copy";
        empty.textContent = "No media yet. Upload a file or link an existing image or video.";
        elements.mediaLibrary.appendChild(empty);
        return;
    }

    mediaAssets.forEach(asset => {
        const card = document.createElement("article");
        card.className = "asset-card";
        const preview = createAssetPreview(asset);
        preview.classList.add("asset-preview-media");
        preview.title = "Click to view";
        preview.addEventListener("click", () => openMediaLightbox(asset));
        card.appendChild(preview);

        const body = document.createElement("div");
        body.className = "asset-card-body";
        body.innerHTML = `
            <strong class="asset-title" title="Double click to rename">${escapeHtml(asset.title || "Untitled media")}</strong>
            <span>${escapeHtml(asset.mediaType || "image")} / ${escapeHtml(asset.sourceType || "link")}</span>
        `;
        const titleElement = body.querySelector(".asset-title");
        titleElement.addEventListener("dblclick", () => startAssetRename(titleElement, asset));

        const addButton = document.createElement("button");
        addButton.className = "button button-primary";
        addButton.type = "button";
        addButton.textContent = playlist.length ? "Add to slide" : "Create slide first";
        addButton.disabled = playlist.length === 0;
        addButton.addEventListener("click", () => addAssetToSelectedSlide(asset));

        const deleteButton = document.createElement("button");
        deleteButton.className = "button button-secondary";
        deleteButton.type = "button";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", async () => {
            setStatus(elements.mediaStatus, "Deleting media...");
            try {
                await deleteAsset(asset.id);
                renderMediaLibrary();
                renderPlaylist();
                setStatus(elements.mediaStatus, "Deleted media.");
            } catch (error) {
                setStatus(elements.mediaStatus, error.message, true);
            }
        });

        const actions = document.createElement("div");
        actions.className = "asset-actions";
        actions.append(addButton, deleteButton);
        body.appendChild(actions);
        card.appendChild(body);
        elements.mediaLibrary.appendChild(card);
    });
}

function renderSlideshows() {
    elements.slideshowList.innerHTML = "";
    elements.updateSlideshow.disabled = !selectedSlideshowId;
    elements.updateSlideshow.textContent = "Overwrite selected";

    if (savedSlideshows.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-copy";
        empty.textContent = "No saved slideshows yet.";
        elements.slideshowList.appendChild(empty);
        return;
    }

    savedSlideshows.forEach(slideshow => {
        const row = document.createElement("article");
        row.className = "slideshow-row";
        row.dataset.selected = String(slideshow.id === selectedSlideshowId);
        row.innerHTML = `
            <div class="slideshow-row-copy">
                <strong>${escapeHtml(slideshow.title || "Untitled slideshow")}</strong>
                <span>${Array.isArray(slideshow.playlist) ? slideshow.playlist.length : 0} slides</span>
            </div>
        `;

        const loadButton = makePlaylistButton("Load", () => loadSlideshow(slideshow));
        const overwriteButton = makePlaylistButton("Overwrite", () => overwriteSlideshow(slideshow.id, slideshow.title));
        const deleteButton = makePlaylistButton("Delete", async () => {
            setStatus(elements.slideshowStatus, "Deleting slideshow...");
            try {
                await deleteSavedSlideshow(slideshow.id);
                if (selectedSlideshowId === slideshow.id) {
                    selectedSlideshowId = "";
                    elements.slideshowName.value = "";
                }
                renderSlideshows();
                setStatus(elements.slideshowStatus, "Deleted slideshow.");
            } catch (error) {
                setStatus(elements.slideshowStatus, error.message, true);
            }
        });
        const actions = document.createElement("div");
        actions.className = "slideshow-row-actions";
        actions.append(loadButton, overwriteButton, deleteButton);
        row.appendChild(actions);
        elements.slideshowList.appendChild(row);
    });
}

async function overwriteSlideshow(slideshowId, fallbackTitle = "") {
    const slideshow = {
        ...collectSlideshowPayload(),
        title: elements.slideshowName.value.trim() || fallbackTitle || "Untitled slideshow"
    };
    if (!slideshowId) return;

    setStatus(elements.slideshowStatus, "Overwriting saved slideshow...");
    try {
        const saved = await updateSavedSlideshow(slideshowId, slideshow);
        savedSlideshows = [saved, ...savedSlideshows.filter(item => item.id !== saved.id)];
        selectedSlideshowId = saved.id;
        elements.slideshowName.value = saved.title;
        writeLocalSlideshows(savedSlideshows);
        renderSlideshows();
        setStatus(elements.slideshowStatus, "Overwrote saved slideshow.");
    } catch (error) {
        setStatus(elements.slideshowStatus, error.message, true);
    }
}

function openMediaLightbox(asset) {
    elements.mediaLightboxContent.replaceChildren();
    const preview = createAssetPreview(asset);
    preview.classList.add("media-lightbox-media");
    preview.style.maxWidth = "100%";
    preview.style.maxHeight = "100%";
    preview.style.width = "auto";
    preview.style.height = "auto";
    preview.style.objectFit = "contain";
    preview.removeAttribute("title");
    elements.mediaLightboxContent.appendChild(preview);
    elements.mediaLightbox.classList.remove("hidden");
    elements.mediaLightbox.setAttribute("aria-hidden", "false");
}

function closeMediaLightbox() {
    elements.mediaLightbox.classList.add("hidden");
    elements.mediaLightbox.setAttribute("aria-hidden", "true");
    elements.mediaLightboxContent.replaceChildren();
}

function startAssetRename(titleElement, asset) {
    const input = document.createElement("input");
    input.className = "asset-title-input";
    input.type = "text";
    input.maxLength = 120;
    input.value = asset.title || "";
    titleElement.replaceWith(input);
    input.focus();
    input.select();

    async function commit() {
        const nextTitle = input.value.trim();
        if (!nextTitle || nextTitle === asset.title) {
            renderMediaLibrary();
            return;
        }

        setStatus(elements.mediaStatus, "Renaming media...");
        try {
            const updated = await renameAsset(asset.id, nextTitle);
            mediaAssets = mediaAssets.map(item => item.id === asset.id ? { ...item, title: updated.title } : item);
            playlist = playlist.map(slide => ({
                ...slide,
                mediaItems: getSlideMediaItems(slide).map(media => media.id === asset.id ? { ...media, title: updated.title } : media)
            }));
            writeLocalMedia(mediaAssets);
            renderMediaLibrary();
            renderPlaylist();
            setStatus(elements.mediaStatus, "Renamed media.");
        } catch (error) {
            renderMediaLibrary();
            setStatus(elements.mediaStatus, error.message, true);
        }
    }

    input.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            input.blur();
        }
        if (event.key === "Escape") {
            renderMediaLibrary();
        }
    });
    input.addEventListener("blur", commit, { once: true });
}

function renderPlaylist() {
    elements.playlistList.innerHTML = "";
    if (playlist.length === 0) {
        const empty = document.createElement("button");
        empty.className = "slide-empty-state";
        empty.type = "button";
        empty.textContent = "Create the first slide";
        empty.addEventListener("click", addBlankSlide);
        elements.playlistList.appendChild(empty);
        renderSlideSettings();
        renderPreview();
        return;
    }

    previewIndex = Math.min(previewIndex, playlist.length - 1);
    playlist.forEach((item, index) => {
        const slideButton = document.createElement("button");
        slideButton.className = "slide-thumb";
        slideButton.type = "button";
        slideButton.setAttribute("aria-pressed", String(index === previewIndex));
        slideButton.innerHTML = `
            <span class="slide-thumb-number">${index + 1}</span>
            <span class="slide-thumb-frame"></span>
            <span class="slide-thumb-title">${escapeHtml(item.title || `Slide ${index + 1}`)}</span>
            <span class="slide-thumb-meta">${getSlideMediaItems(item).length} media</span>
        `;

        const frame = slideButton.querySelector(".slide-thumb-frame");
        frame.appendChild(createSlideThumbMedia(item));
        slideButton.addEventListener("click", () => {
            previewIndex = index;
            previewMediaIndex = 0;
            renderPlaylist();
        });
        elements.playlistList.appendChild(slideButton);
    });
    renderSlideSettings();
    renderPreview();
}

function renderSlideSettings() {
    elements.slideSettings.innerHTML = "";
    const item = playlist[previewIndex] || null;
    if (!item) {
        const empty = document.createElement("p");
        empty.className = "empty-copy";
        empty.textContent = "Select or add a slide to edit its copy, timing, and layout.";
        elements.slideSettings.appendChild(empty);
        return;
    }

    const settings = document.createElement("div");
    settings.className = "slide-settings-form";
    settings.innerHTML = `
        <label class="field">
            <span>Slide name</span>
            <input data-field="title" type="text" maxlength="80" value="${escapeAttribute(item.title || "")}">
        </label>
        <label class="field">
            <span>Slide headline</span>
            <input data-field="headline" type="text" maxlength="92" value="${escapeAttribute(item.headline || "")}">
        </label>
        <label class="field">
            <span>Slide subheadline</span>
            <input data-field="subheadline" type="text" maxlength="180" value="${escapeAttribute(item.subheadline || "")}">
        </label>
        <label class="field">
            <span>Presentation label</span>
            <input data-field="statusLabel" type="text" maxlength="34" placeholder="Leave blank to hide" value="${escapeAttribute(item.statusLabel || "")}">
        </label>
            <label class="field">
                <span>Slide promo line</span>
                <textarea data-field="announcement" rows="3" maxlength="220">${escapeHtml(item.announcement || "")}</textarea>
            </label>
            <div class="slide-setting-row">
            <label class="field">
                <span>Seconds</span>
                <input data-field="durationSeconds" type="number" min="0" max="300" step="1" value="${item.durationSeconds || ""}">
            </label>
            <label class="field">
                <span>Media seconds</span>
                <input data-field="mediaDurationSeconds" type="number" min="0" max="300" step="1" value="${item.mediaDurationSeconds || ""}">
            </label>
                <label class="field">
                    <span>Layout</span>
                    <select data-field="layoutMode">
                    <option value="split">Image and text</option>
                    <option value="overlay">Image with text overlay</option>
                    <option value="fullscreen">Image only</option>
                </select>
                </label>
                <label class="field">
                    <span>Media display</span>
                    <select data-field="mediaLayout">
                        <option value="rotate">Rotate media</option>
                        <option value="side-by-side">Show side by side</option>
                    </select>
                </label>
                <label class="field">
                    <span>Image width</span>
                    <input data-field="mediaPercent" type="range" min="25" max="80" step="1" value="${item.mediaPercent || 68}">
                </label>
                <label class="field">
                    <span>Image side</span>
                    <select data-field="mediaSide">
                        <option value="left">Left</option>
                        <option value="right">Right</option>
                    </select>
                </label>
                <label class="field color-field">
                    <span>Background</span>
                    <input data-field="backgroundColor" type="color" value="${normalizeColor(item.backgroundColor)}">
                </label>
                <label class="field color-field">
                    <span>Glow color</span>
                    <input data-field="backgroundAccentColor" type="color" value="${normalizeColor(item.backgroundAccentColor, "#2fb764")}">
                </label>
                <label class="field">
                    <span>Glow brightness</span>
                    <input data-field="backgroundAccentStrength" type="range" min="0" max="200" step="5" value="${clampAccentStrength(item.backgroundAccentStrength)}">
                </label>
                <button class="button button-secondary slide-apply-button" data-action="apply-background" type="button">Apply background...</button>
            </div>
        <div class="slide-media-heading">
            <span>Slide media</span>
            <button class="button button-secondary" data-action="add-media" type="button">Choose media</button>
        </div>
        <div class="slide-media-list"></div>
        <div class="slide-actions">
            <button class="button button-secondary" data-action="up" type="button">Move up</button>
            <button class="button button-secondary" data-action="down" type="button">Move down</button>
            <button class="button button-secondary" data-action="remove" type="button">Remove</button>
        </div>
    `;

    const layout = settings.querySelector("[data-field='layoutMode']");
    layout.value = item.layoutMode || "split";
    settings.querySelector("[data-field='mediaLayout']").value = item.mediaLayout || "rotate";
    settings.querySelector("[data-field='mediaSide']").value = normalizeMediaSide(item.mediaSide);
    settings.querySelector("[data-field='backgroundColor']").value = normalizeColor(item.backgroundColor);
    settings.querySelector("[data-field='backgroundAccentColor']").value = normalizeColor(item.backgroundAccentColor, "#2fb764");
    settings.querySelector("[data-field='backgroundAccentStrength']").value = clampAccentStrength(item.backgroundAccentStrength);

    settings.querySelectorAll("[data-field]").forEach(input => {
        const updateItem = () => {
            const field = input.dataset.field;
            item[field] = ["durationSeconds", "mediaDurationSeconds", "mediaPercent", "backgroundAccentStrength"].includes(field)
                ? Number.parseInt(input.value, 10) || 0
                : input.value;
            if (field === "layoutMode") {
                item.layoutMode = normalizeLayoutMode(item.layoutMode);
                input.value = item.layoutMode;
            }
            if (field === "mediaPercent") {
                item.mediaPercent = clampPercent(item.mediaPercent, 68);
            }
            if (field === "mediaSide") {
                item.mediaSide = normalizeMediaSide(item.mediaSide);
                input.value = item.mediaSide;
            }
            if (field === "backgroundColor") {
                item.backgroundColor = normalizeColor(item.backgroundColor);
                input.value = item.backgroundColor;
            }
            if (field === "backgroundAccentColor") {
                item.backgroundAccentColor = normalizeColor(item.backgroundAccentColor, "#2fb764");
                input.value = item.backgroundAccentColor;
            }
            if (field === "backgroundAccentStrength") {
                item.backgroundAccentStrength = clampAccentStrength(item.backgroundAccentStrength);
                input.value = item.backgroundAccentStrength;
            }
            renderPreview();
            renderSlideRailSelection();
        };
        input.addEventListener("input", updateItem);
        input.addEventListener("change", updateItem);
    });

    renderSlideMediaList(settings.querySelector(".slide-media-list"), item);
    settings.querySelector("[data-action='add-media']").addEventListener("click", () => showAdminView("media"));
    settings.querySelector("[data-action='apply-background']").addEventListener("click", () => openBackgroundApplyDialog(item));
    settings.querySelector("[data-action='up']").addEventListener("click", () => movePlaylistItem(previewIndex, -1));
    settings.querySelector("[data-action='down']").addEventListener("click", () => movePlaylistItem(previewIndex, 1));
    settings.querySelector("[data-action='remove']").addEventListener("click", () => {
        playlist.splice(previewIndex, 1);
        previewIndex = Math.min(previewIndex, Math.max(playlist.length - 1, 0));
        renderPlaylist();
    });

    elements.slideSettings.appendChild(settings);
}

function createSlideThumbMedia(item) {
    const media = getSlideMediaItems(item)[0];
    if (!media?.url) {
        const placeholder = document.createElement("span");
        placeholder.className = "slide-thumb-placeholder";
        return placeholder;
    }

    if (media.mediaType === "video") {
        const video = document.createElement("video");
        video.src = media.url;
        video.muted = true;
        video.playsInline = true;
        video.preload = "metadata";
        return video;
    }

    const image = document.createElement("img");
    image.src = media.url;
    image.alt = "";
    return image;
}

function renderSlideMediaList(container, slide) {
    container.innerHTML = "";
    const mediaItems = getSlideMediaItems(slide);
    if (mediaItems.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-copy";
        empty.textContent = "No media chosen for this slide yet.";
        container.appendChild(empty);
        return;
    }

    mediaItems.forEach((media, index) => {
        const row = document.createElement("article");
        row.className = "slide-media-row";
        row.dataset.selected = String(index === previewMediaIndex);
        row.innerHTML = `
            <span class="slide-media-index">${index + 1}</span>
            <span class="slide-media-thumb"></span>
            <span class="slide-media-copy">
                <strong>${escapeHtml(media.title || "Untitled media")}</strong>
                <small>${escapeHtml(media.mediaType || "image")}</small>
            </span>
            <label class="slide-media-size">
                <span>Width</span>
                <input data-action="media-size" type="range" min="25" max="300" step="5" value="${clampMediaSize(media.size)}">
            </label>
            <label class="slide-media-size">
                <span>Zoom</span>
                <input data-action="media-zoom" type="range" min="100" max="250" step="5" value="${clampCropZoom(media.zoom)}">
            </label>
        `;
        row.querySelector(".slide-media-thumb").appendChild(createAssetPreview(media, { crop: true }));
        row.querySelector("[data-action='media-size']").addEventListener("input", event => {
            media.size = clampMediaSize(event.target.value);
            renderPreview();
        });
        row.querySelector("[data-action='media-zoom']").addEventListener("input", event => {
            media.zoom = clampCropZoom(event.target.value);
            renderPreview();
        });

        const selectButton = makePlaylistButton("View", () => {
            previewMediaIndex = index;
            renderPreview();
            renderSlideSettings();
        });
        const centerButton = makePlaylistButton("Center", () => {
            media.cropX = 50;
            media.cropY = 50;
            previewMediaIndex = index;
            renderPreview();
            renderSlideSettings();
        });
        const removeButton = makePlaylistButton("Remove", () => {
            slide.mediaItems.splice(index, 1);
            previewMediaIndex = Math.min(previewMediaIndex, Math.max(slide.mediaItems.length - 1, 0));
            renderPlaylist();
        });
        const actions = document.createElement("div");
        actions.className = "slide-media-actions";
        actions.append(selectButton, centerButton, removeButton);
        row.appendChild(actions);
        container.appendChild(row);
    });
}

function renderSlideRailSelection() {
    elements.playlistList.querySelectorAll(".slide-thumb").forEach((button, index) => {
        button.setAttribute("aria-pressed", String(index === previewIndex));
    });
}

function openBackgroundApplyDialog(sourceSlide) {
    const color = normalizeColor(sourceSlide?.backgroundColor);
    const dialog = document.createElement("div");
    dialog.className = "slide-apply-dialog";
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    dialog.innerHTML = `
        <div class="slide-apply-panel">
            <div class="slide-apply-heading">
                <div>
                    <p class="display-kicker">Background</p>
                    <h3>Apply to slides</h3>
                </div>
                <button class="icon-button" data-action="close-dialog" type="button" aria-label="Close">&times;</button>
            </div>
            <div class="slide-apply-actions">
                <button class="button button-secondary" data-action="select-all" type="button">Select all</button>
                <button class="button button-secondary" data-action="select-current" type="button">Current only</button>
            </div>
            <div class="slide-apply-list"></div>
            <div class="slide-apply-footer">
                <button class="button button-secondary" data-action="cancel" type="button">Cancel</button>
                <button class="button button-primary" data-action="apply" type="button">Apply color</button>
            </div>
        </div>
    `;

    const list = dialog.querySelector(".slide-apply-list");
    playlist.forEach((slide, index) => {
        const label = document.createElement("label");
        label.className = "slide-apply-option";
        label.innerHTML = `
            <input type="checkbox" value="${index}" ${index === previewIndex ? "checked" : ""}>
            <span>${escapeHtml(slide.title || `Slide ${index + 1}`)}</span>
        `;
        list.appendChild(label);
    });

    const closeDialog = () => dialog.remove();
    dialog.addEventListener("click", event => {
        if (event.target === dialog) {
            closeDialog();
        }
    });
    dialog.querySelector("[data-action='close-dialog']").addEventListener("click", closeDialog);
    dialog.querySelector("[data-action='cancel']").addEventListener("click", closeDialog);
    dialog.querySelector("[data-action='select-all']").addEventListener("click", () => {
        dialog.querySelectorAll("input[type='checkbox']").forEach(input => {
            input.checked = true;
        });
    });
    dialog.querySelector("[data-action='select-current']").addEventListener("click", () => {
        dialog.querySelectorAll("input[type='checkbox']").forEach(input => {
            input.checked = Number.parseInt(input.value, 10) === previewIndex;
        });
    });
    dialog.querySelector("[data-action='apply']").addEventListener("click", () => {
        dialog.querySelectorAll("input[type='checkbox']:checked").forEach(input => {
            const index = Number.parseInt(input.value, 10);
            if (playlist[index]) {
                playlist[index].backgroundColor = color;
                playlist[index].backgroundAccentColor = normalizeColor(sourceSlide?.backgroundAccentColor, "#2fb764");
                playlist[index].backgroundAccentStrength = clampAccentStrength(sourceSlide?.backgroundAccentStrength);
            }
        });
        renderPlaylist();
        closeDialog();
    });
    document.body.appendChild(dialog);
}

function makePlaylistButton(label, onClick) {
    const button = document.createElement("button");
    button.className = "button button-secondary";
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
}

function addBlankSlide() {
    playlist.push(createBlankSlide());
    previewIndex = playlist.length - 1;
    previewMediaIndex = 0;
    renderPlaylist();
    setStatus(elements.saveStatus, "Created a new slide.");
}

function addAssetToSelectedSlide(asset) {
    const slide = getSelectedSlide();
    if (!slide) {
        setStatus(elements.mediaStatus, "Create a slide before choosing media.", true);
        return;
    }

    slide.mediaItems = getSlideMediaItems(slide);
    slide.mediaItems.push({
        id: asset.id,
        title: asset.title,
        mediaType: asset.mediaType,
        url: asset.url,
        cropX: 50,
        cropY: 50,
        size: 100,
        zoom: 120
    });
    previewMediaIndex = slide.mediaItems.length - 1;
    renderPlaylist();
    showAdminView("loop");
    setStatus(elements.saveStatus, "Added media to the selected slide.");
}

function movePlaylistItem(index, direction) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= playlist.length) return;
    const [item] = playlist.splice(index, 1);
    playlist.splice(nextIndex, 0, item);
    if (previewIndex === index) {
        previewIndex = nextIndex;
    } else if (direction < 0 && previewIndex === nextIndex) {
        previewIndex = index;
    } else if (direction > 0 && previewIndex === nextIndex) {
        previewIndex = index;
    }
    renderPlaylist();
}

function renderPreview() {
    const item = playlist[previewIndex] || null;
    const media = getSelectedMedia(item);
    const mediaItems = getSlideMediaItems(item).filter(mediaItem => mediaItem?.url);
    const isSideBySide = item?.mediaLayout === "side-by-side" && mediaItems.length > 1;
    const hasMedia = isSideBySide || Boolean(media?.url);
    const isVideo = media?.mediaType === "video";
    const hasCopy = Boolean(item?.statusLabel || item?.headline || item?.subheadline || item?.announcement);

    const mediaCount = getSlideMediaItems(item).length;
    elements.preview.counter.textContent = playlist.length
        ? `Slide ${previewIndex + 1} / ${playlist.length}${mediaCount ? ` - Media ${previewMediaIndex + 1} / ${mediaCount}` : ""}`
        : "0 / 0";
    elements.preview.prev.disabled = playlist.length <= 1;
    elements.preview.next.disabled = playlist.length <= 1;
    elements.preview.root.dataset.layout = getPreviewLayoutMode(item);
    elements.preview.root.dataset.mediaSide = normalizeMediaSide(item?.mediaSide);
    elements.preview.root.classList.toggle("has-slide-copy", hasCopy);
    elements.preview.root.style.setProperty("--media-percent", `${clampPercent(item?.mediaPercent, 68)}%`);
    elements.preview.root.style.setProperty("--text-percent", `${100 - clampPercent(item?.mediaPercent, 68)}%`);
    applySlideBackgroundStyles(elements.preview.root, item);

    elements.preview.statusLabel.textContent = item?.statusLabel || "";
    elements.preview.headline.textContent = item?.headline || "";
    elements.preview.subheadline.textContent = item?.subheadline || "";
    elements.preview.announcement.textContent = item?.announcement || "";
    elements.preview.ticker.textContent = elements.fields.ticker.value.trim();

    elements.preview.placeholder.classList.toggle("hidden", hasMedia);
    elements.preview.mediaGrid.classList.toggle("hidden", !isSideBySide);
    elements.preview.image.classList.toggle("hidden", !hasMedia || isVideo || isSideBySide);
    elements.preview.video.classList.toggle("hidden", !hasMedia || !isVideo || isSideBySide);
    elements.preview.mediaShell.classList.toggle("is-croppable", hasMedia && !isVideo && !isSideBySide);

    if (isSideBySide) {
        renderPreviewMediaGrid(mediaItems);
        elements.preview.image.removeAttribute("src");
        elements.preview.video.removeAttribute("src");
        return;
    }
    elements.preview.mediaGrid.replaceChildren();

    if (!hasMedia) {
        elements.preview.image.removeAttribute("src");
        elements.preview.video.removeAttribute("src");
        elements.preview.image.style.objectPosition = "";
        elements.preview.video.style.objectPosition = "";
        elements.preview.image.style.transform = "";
        elements.preview.video.style.transform = "";
        elements.preview.image.style.transformOrigin = "";
        elements.preview.video.style.transformOrigin = "";
        return;
    }

    if (isVideo) {
        if (elements.preview.video.getAttribute("src") !== media.url) {
            elements.preview.video.src = media.url;
            elements.preview.video.load();
        }
        applyCropStyles(elements.preview.video, media);
        elements.preview.image.removeAttribute("src");
        return;
    }

    if (elements.preview.image.getAttribute("src") !== media.url) {
        elements.preview.image.src = media.url;
    }
    elements.preview.image.alt = media.title || item?.title || "Display preview media";
    applyCropStyles(elements.preview.image, media);
    elements.preview.video.removeAttribute("src");
}

function renderPreviewMediaGrid(mediaItems) {
    elements.preview.mediaGrid.replaceChildren();
    elements.preview.mediaGrid.dataset.count = String(mediaItems.length);
    elements.preview.mediaGrid.style.gridTemplateColumns = getMediaGridTemplate(mediaItems);
    mediaItems.forEach((media, index) => {
        const cell = document.createElement("div");
        cell.className = "loop-preview-media-cell";
        const preview = createAssetPreview(media, { crop: true });
        preview.classList.add("loop-preview-grid-media");
        preview.dataset.mediaIndex = String(index);
        preview.addEventListener("pointerdown", event => {
            event.stopPropagation();
            const slideMediaIndex = getSlideMediaItems(getSelectedSlide()).indexOf(media);
            if (slideMediaIndex >= 0) {
                previewMediaIndex = slideMediaIndex;
            }
            startCropDrag(event, media, preview);
        });
        cell.appendChild(preview);
        elements.preview.mediaGrid.appendChild(cell);
    });
}

function startCropDrag(event, dragMedia = getSelectedMedia(), dragElement = elements.preview.mediaShell) {
    if (dragElement === elements.preview.mediaShell && event.target.closest(".loop-preview-media-grid")) {
        return;
    }
    const media = dragMedia;
    if (!media?.url || media.mediaType === "video") return;
    event.preventDefault();
    cropDrag = {
        pointerId: event.pointerId,
        media,
        element: dragElement,
        startX: event.clientX,
        startY: event.clientY,
        cropX: clampCropValue(media.cropX),
        cropY: clampCropValue(media.cropY)
    };
    dragElement.setPointerCapture(event.pointerId);
    dragElement.classList.add("is-dragging");
}

function updateCropDrag(event) {
    if (!cropDrag || event.pointerId !== cropDrag.pointerId) return;
    const media = cropDrag.media;
    if (!media) return;
    const rect = cropDrag.element.getBoundingClientRect();
    const deltaX = ((event.clientX - cropDrag.startX) / Math.max(rect.width, 1)) * 100;
    const deltaY = ((event.clientY - cropDrag.startY) / Math.max(rect.height, 1)) * 100;
    media.cropX = clampCropValue(cropDrag.cropX - deltaX);
    media.cropY = clampCropValue(cropDrag.cropY - deltaY);
    if (cropDrag.element === elements.preview.mediaShell) {
        applyCropStyles(elements.preview.image, media);
        applyCropStyles(elements.preview.video, media);
    } else {
        applyCropStyles(cropDrag.element, media);
    }
}

function endCropDrag(event) {
    if (!cropDrag || event.pointerId !== cropDrag.pointerId) return;
    cropDrag.element.classList.remove("is-dragging");
    cropDrag.element.releasePointerCapture(event.pointerId);
    cropDrag = null;
    renderPreview();
    renderSlideSettings();
}

function getPreviewLayoutMode(item) {
    return normalizeLayoutMode(item?.layoutMode);
}

function movePreview(direction) {
    if (playlist.length === 0) return;
    const currentMediaCount = getSlideMediaItems(playlist[previewIndex]).length;
    if (currentMediaCount > 1) {
        const nextMediaIndex = previewMediaIndex + direction;
        if (nextMediaIndex >= 0 && nextMediaIndex < currentMediaCount) {
            previewMediaIndex = nextMediaIndex;
            renderPreview();
            return;
        }
    }

    previewIndex = (previewIndex + direction + playlist.length) % playlist.length;
    previewMediaIndex = direction > 0
        ? 0
        : Math.max(getSlideMediaItems(playlist[previewIndex]).length - 1, 0);
    renderPlaylist();
}

function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#39;"
    }[character]));
}

function escapeAttribute(value) {
    return escapeHtml(value).replace(/`/g, "&#96;");
}

async function initSession() {
    if (!(config.storageMode === "cloudflare" && apiBaseUrl) || !token) {
        renderAuth();
        return;
    }

    try {
        const payload = await request("/api/session", { auth: true });
        if (payload?.user) {
            setSession(token, payload.user);
            return;
        }
    } catch {
        setSession("", null);
        return;
    }

    setSession("", null);
}

elements.loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    setStatus(elements.loginStatus, "Signing in...");

    if (!(config.storageMode === "cloudflare" && apiBaseUrl)) {
        setSession("local-demo", { user: "local admin", workerCode: config.workerCode });
        elements.password.value = "";
        await Promise.all([loadDisplay(), fetchMediaAssets(), fetchSlideshows()]);
        setStatus(elements.loginStatus, "Signed in locally.");
        return;
    }

    try {
        const payload = await request("/api/display-login", {
            method: "POST",
            body: JSON.stringify({
                password: elements.password.value,
                workerCode: config.workerCode
            })
        });
        setSession(payload?.token || "", payload?.user || null);
        elements.password.value = "";
        setStatus(elements.loginStatus, "Signed in.");
        await Promise.all([loadDisplay(), fetchMediaAssets(), fetchSlideshows()]);
    } catch (error) {
        setStatus(elements.loginStatus, error.message, true);
    }
});

elements.uploadForm.addEventListener("submit", async event => {
    event.preventDefault();
    const files = Array.from(elements.uploadFile.files || []);
    if (files.length === 0) {
        setStatus(elements.mediaStatus, "Choose one or more files to upload.", true);
        return;
    }

    setStatus(elements.mediaStatus, files.length === 1 ? "Uploading..." : `Uploading 1 of ${files.length}...`);
    try {
        const title = elements.uploadTitle.value.trim();
        const uploadedAssets = [];
        for (const [index, file] of files.entries()) {
            if (files.length > 1) {
                setStatus(elements.mediaStatus, `Uploading ${index + 1} of ${files.length}...`);
            }
            uploadedAssets.push(await uploadAsset(file, files.length === 1 ? title : ""));
        }
        mediaAssets = [...uploadedAssets, ...mediaAssets];
        writeLocalMedia(mediaAssets);
        renderMediaLibrary();
        elements.uploadForm.reset();
        setStatus(elements.mediaStatus, files.length === 1 ? "Uploaded media." : `Uploaded ${files.length} media files.`);
    } catch (error) {
        setStatus(elements.mediaStatus, error.message, true);
    }
});

elements.linkForm.addEventListener("submit", async event => {
    event.preventDefault();
    setStatus(elements.mediaStatus, "Adding link...");

    try {
        const asset = await createLinkedAsset({
            title: elements.linkTitle.value.trim(),
            url: elements.linkUrl.value.trim(),
            mediaType: elements.linkMediaType.value
        });
        mediaAssets = [asset, ...mediaAssets];
        writeLocalMedia(mediaAssets);
        renderMediaLibrary();
        elements.linkForm.reset();
        setStatus(elements.mediaStatus, "Added linked media.");
    } catch (error) {
        setStatus(elements.mediaStatus, error.message, true);
    }
});

elements.form.addEventListener("submit", async event => {
    event.preventDefault();
    setStatus(elements.saveStatus, "Publishing...");

    try {
        const display = await saveDisplay(collectForm());
        fillForm(display);
        setStatus(elements.saveStatus, "Published to TV display.");
    } catch (error) {
        setStatus(elements.saveStatus, error.message, true);
    }
});

elements.slideshowSaveForm.addEventListener("submit", async event => {
    event.preventDefault();
    const slideshow = collectSlideshowPayload();
    if (!slideshow.title) {
        setStatus(elements.slideshowStatus, "Name the slideshow before saving.", true);
        return;
    }

    setStatus(elements.slideshowStatus, "Saving slideshow...");
    try {
        const saved = await createSlideshow(slideshow);
        savedSlideshows = [saved, ...savedSlideshows.filter(item => item.id !== saved.id)];
        selectedSlideshowId = saved.id;
        elements.slideshowName.value = saved.title;
        writeLocalSlideshows(savedSlideshows);
        renderSlideshows();
        setStatus(elements.slideshowStatus, "Saved slideshow.");
    } catch (error) {
        setStatus(elements.slideshowStatus, error.message, true);
    }
});

elements.updateSlideshow.addEventListener("click", async () => {
    if (!selectedSlideshowId) return;
    const existing = savedSlideshows.find(item => item.id === selectedSlideshowId);
    await overwriteSlideshow(selectedSlideshowId, existing?.title || "");
});

elements.refresh.addEventListener("click", loadDisplay);
elements.refreshMedia.addEventListener("click", fetchMediaAssets);
elements.refreshSlideshows.addEventListener("click", fetchSlideshows);
elements.clearPlaylist.addEventListener("click", () => {
    playlist = [];
    previewIndex = 0;
    previewMediaIndex = 0;
    renderPlaylist();
});
elements.openMediaBrowser.addEventListener("click", () => showAdminView("media"));
elements.slideRailAdd.addEventListener("click", addBlankSlide);
elements.backToLoop.addEventListener("click", () => showAdminView("loop"));
elements.preview.prev.addEventListener("click", () => movePreview(-1));
elements.preview.next.addEventListener("click", () => movePreview(1));
elements.preview.mediaShell.addEventListener("pointerdown", startCropDrag);
elements.preview.mediaShell.addEventListener("pointermove", updateCropDrag);
elements.preview.mediaShell.addEventListener("pointerup", endCropDrag);
elements.preview.mediaShell.addEventListener("pointercancel", endCropDrag);
elements.mediaLightbox.addEventListener("click", closeMediaLightbox);
Object.values(elements.fields).forEach(input => {
    input.addEventListener("input", renderPreview);
});

elements.signOut.addEventListener("click", async () => {
    if (config.storageMode === "cloudflare" && apiBaseUrl && token) {
        try {
            await request("/api/logout", {
                method: "POST",
                auth: true
            });
        } catch {
            // Clear local session even if the server token is already gone.
        }
    }

    setSession("", null);
    setStatus(elements.loginStatus, "Signed out.");
});

await initSession();
renderAuth();
if (token && user) {
    await Promise.all([loadDisplay(), fetchMediaAssets(), fetchSlideshows()]);
} else {
    renderSlideshows();
}
