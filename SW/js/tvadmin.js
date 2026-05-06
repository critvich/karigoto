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
    form: document.getElementById("display-form"),
    saveStatus: document.getElementById("save-status"),
    refresh: document.getElementById("refresh-display"),
    refreshMedia: document.getElementById("refresh-media"),
    mediaStatus: document.getElementById("media-status"),
    mediaLibrary: document.getElementById("media-library"),
    playlistList: document.getElementById("playlist-list"),
    clearPlaylist: document.getElementById("clear-playlist"),
    uploadForm: document.getElementById("upload-form"),
    uploadFile: document.getElementById("upload-file"),
    uploadTitle: document.getElementById("upload-title"),
    linkForm: document.getElementById("link-form"),
    linkTitle: document.getElementById("link-title"),
    linkUrl: document.getElementById("link-url"),
    linkMediaType: document.getElementById("link-media-type"),
    fields: {
        ticker: document.getElementById("ticker"),
        slideDurationSeconds: document.getElementById("slide-duration-seconds")
    }
};

let token = window.localStorage.getItem(TOKEN_KEY) || "";
let user = readStoredUser();
let mediaAssets = readLocalMedia();
let playlist = [];

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
        writeLocalDisplay(payload?.display || display);
        return payload?.display || display;
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
    playlist = playlist.filter(item => item.id !== assetId);
    writeLocalMedia(mediaAssets);
}

function fillForm(display) {
    Object.entries(elements.fields).forEach(([key, input]) => {
        input.value = display[key] ?? "";
    });
    playlist = Array.isArray(display.playlist)
        ? display.playlist.map(item => ({
            ...item,
            statusLabel: item.statusLabel ?? display.statusLabel ?? defaultDisplay.statusLabel
        }))
        : [];
    renderPlaylist();
}

function collectForm() {
    const display = Object.entries(elements.fields).reduce((current, [key, input]) => {
        current[key] = input.value.trim();
        return current;
    }, {});
    const firstItem = playlist[0] || {};
    display.playlist = playlist;
        display.mediaUrl = firstItem.url || "";
        display.mediaType = firstItem.mediaType || "image";
        display.mediaAlt = firstItem.title || "Promotional media";
    return display;
}

async function loadDisplay() {
    setStatus(elements.saveStatus, "Loading...");
    try {
        const display = await fetchDisplay();
        writeLocalDisplay(display);
        fillForm(display);
        setStatus(elements.saveStatus, "Loaded latest display.");
    } catch (error) {
        fillForm(readLocalDisplay());
        setStatus(elements.saveStatus, error.message, true);
    }
}

function createAssetPreview(asset) {
    if (asset.mediaType === "video") {
        const video = document.createElement("video");
        video.src = asset.url;
        video.muted = true;
        video.loop = true;
        video.playsInline = true;
        video.preload = "metadata";
        return video;
    }

    const image = document.createElement("img");
    image.src = asset.url;
    image.alt = asset.title || "Media";
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
        card.appendChild(createAssetPreview(asset));

        const body = document.createElement("div");
        body.className = "asset-card-body";
        body.innerHTML = `
            <strong>${escapeHtml(asset.title || "Untitled media")}</strong>
            <span>${escapeHtml(asset.mediaType || "image")} / ${escapeHtml(asset.sourceType || "link")}</span>
        `;

        const addButton = document.createElement("button");
        addButton.className = "button button-primary";
        addButton.type = "button";
        addButton.textContent = "Add";
        addButton.addEventListener("click", () => addAssetToPlaylist(asset));

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

function renderPlaylist() {
    elements.playlistList.innerHTML = "";
    if (playlist.length === 0) {
        const empty = document.createElement("p");
        empty.className = "empty-copy";
        empty.textContent = "Add media from the browser to build the loop.";
        elements.playlistList.appendChild(empty);
        return;
    }

    playlist.forEach((item, index) => {
        const row = document.createElement("article");
        row.className = "playlist-item";
        row.innerHTML = `
            <div>
                <strong>${index + 1}. ${escapeHtml(item.title || "Untitled media")}</strong>
                <span>${escapeHtml(item.mediaType || "image")}</span>
            </div>
        `;

        const seconds = document.createElement("input");
        seconds.type = "number";
        seconds.min = "0";
        seconds.max = "300";
        seconds.step = "1";
        seconds.value = item.durationSeconds || "";
        seconds.title = "Optional custom seconds";
        seconds.addEventListener("change", () => {
            item.durationSeconds = Number.parseInt(seconds.value, 10) || 0;
        });

        const layout = document.createElement("select");
        layout.title = "Display mode";
        layout.innerHTML = `
            <option value="split">Text beside</option>
            <option value="fullscreen">Full screen</option>
            <option value="fullscreen-text">Full screen + text</option>
        `;
        layout.value = item.layoutMode || "split";
        layout.addEventListener("change", () => {
            item.layoutMode = layout.value;
        });

        const copyFields = document.createElement("div");
        copyFields.className = "playlist-copy-fields";
        copyFields.innerHTML = `
            <label class="field">
                <span>Presentation label</span>
                <input type="text" maxlength="34" placeholder="Leave blank to hide" value="${escapeAttribute(item.statusLabel || "")}">
            </label>
            <label class="field">
                <span>Slide headline</span>
                <input type="text" maxlength="92" value="${escapeAttribute(item.headline || "")}">
            </label>
            <label class="field">
                <span>Slide subheadline</span>
                <input type="text" maxlength="180" value="${escapeAttribute(item.subheadline || "")}">
            </label>
            <label class="field">
                <span>Slide promo line</span>
                <textarea rows="2" maxlength="220">${escapeHtml(item.announcement || "")}</textarea>
            </label>
        `;
        const [statusLabelInput, headlineInput, subheadlineInput] = copyFields.querySelectorAll("input");
        const announcementInput = copyFields.querySelector("textarea");
        statusLabelInput.addEventListener("input", () => {
            item.statusLabel = statusLabelInput.value;
        });
        headlineInput.addEventListener("input", () => {
            item.headline = headlineInput.value;
        });
        subheadlineInput.addEventListener("input", () => {
            item.subheadline = subheadlineInput.value;
        });
        announcementInput.addEventListener("input", () => {
            item.announcement = announcementInput.value;
        });

        const upButton = makePlaylistButton("Up", () => movePlaylistItem(index, -1));
        const downButton = makePlaylistButton("Down", () => movePlaylistItem(index, 1));
        const removeButton = makePlaylistButton("Remove", () => {
            playlist.splice(index, 1);
            renderPlaylist();
        });

        const controls = document.createElement("div");
        controls.className = "playlist-controls";
        controls.append(seconds, layout, upButton, downButton, removeButton);

        row.append(copyFields, controls);
        elements.playlistList.appendChild(row);
    });
}

function makePlaylistButton(label, onClick) {
    const button = document.createElement("button");
    button.className = "button button-secondary";
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
}

function addAssetToPlaylist(asset) {
    playlist.push({
        id: asset.id,
        title: asset.title,
        mediaType: asset.mediaType,
        url: asset.url,
        durationSeconds: 0,
        layoutMode: "split",
        statusLabel: "Steelwrist Presents",
        headline: "",
        subheadline: "",
        announcement: ""
    });
    renderPlaylist();
}

function movePlaylistItem(index, direction) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= playlist.length) return;
    const [item] = playlist.splice(index, 1);
    playlist.splice(nextIndex, 0, item);
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
        await Promise.all([loadDisplay(), fetchMediaAssets()]);
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
        await Promise.all([loadDisplay(), fetchMediaAssets()]);
    } catch (error) {
        setStatus(elements.loginStatus, error.message, true);
    }
});

elements.uploadForm.addEventListener("submit", async event => {
    event.preventDefault();
    const file = elements.uploadFile.files?.[0];
    if (!file) {
        setStatus(elements.mediaStatus, "Choose a file to upload.", true);
        return;
    }

    setStatus(elements.mediaStatus, "Uploading...");
    try {
        const asset = await uploadAsset(file, elements.uploadTitle.value.trim());
        mediaAssets = [asset, ...mediaAssets];
        writeLocalMedia(mediaAssets);
        renderMediaLibrary();
        elements.uploadForm.reset();
        setStatus(elements.mediaStatus, "Uploaded media.");
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

elements.refresh.addEventListener("click", loadDisplay);
elements.refreshMedia.addEventListener("click", fetchMediaAssets);
elements.clearPlaylist.addEventListener("click", () => {
    playlist = [];
    renderPlaylist();
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
    await Promise.all([loadDisplay(), fetchMediaAssets()]);
}
