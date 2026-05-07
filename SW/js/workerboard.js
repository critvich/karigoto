const baseConfig = {
    storageMode: "cloudflare",
    apiBaseUrl: "",
    defaultWorker: "BRBO",
    workers: {}
};

const appConfig = {
    ...baseConfig,
    ...(window.SW_WORKER_BOARD_CONFIG || {})
};

const elements = {
    workerCodeHeader: document.getElementById("worker-code-header"),
    workerNav: document.getElementById("worker-nav"),
    workerCodeFeed: document.getElementById("worker-code-feed"),
    accountToggle: document.getElementById("account-toggle"),
    accountPanel: document.getElementById("account-panel"),
    accountSummary: document.getElementById("account-summary"),
    accountForm: document.getElementById("account-form"),
    accountEmail: document.getElementById("account-email"),
    accountPassword: document.getElementById("account-password"),
    accountSubmit: document.getElementById("account-submit"),
    accountSignout: document.getElementById("account-signout"),
    accountStatus: document.getElementById("account-status"),
    activityUnpin: document.getElementById("activity-unpin"),
    activityComplete: document.getElementById("activity-complete"),
    activityRoutine: document.getElementById("activity-routine"),
    activityLunch: document.getElementById("activity-lunch"),
    activityTitle: document.getElementById("activity-title"),
    activityDetail: document.getElementById("activity-detail"),
    activityUpdated: document.getElementById("activity-updated"),
    boardNote: document.getElementById("board-note"),
    presetSelect: document.getElementById("preset-select"),
    extraFields: document.getElementById("extra-fields"),
    taskForm: document.getElementById("task-form"),
    taskAuthor: document.getElementById("task-author"),
    submitStatus: document.getElementById("submit-status"),
    taskList: document.getElementById("task-list"),
    doneDrawer: document.getElementById("done-drawer"),
    doneToggle: document.getElementById("done-toggle"),
    doneToggleMeta: document.getElementById("done-toggle-meta"),
    doneList: document.getElementById("done-list"),
    donePanel: document.getElementById("done-panel"),
    taskTemplate: document.getElementById("task-card-template"),
    fabShell: document.getElementById("fab-shell"),
    fabPanel: document.getElementById("fab-panel"),
    fabBack: document.getElementById("fab-back"),
    fabToggle: document.getElementById("fab-toggle"),
};

const state = {
    workerCode: "",
    workerConfig: null,
    providerMode: "demo",
    tasks: [],
    activity: null,
    user: null,
    showingDone: false
};

const AUTO_REFRESH_MS = 10000;

function getWorkerCodeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const requested = (params.get("worker") || appConfig.defaultWorker || "").toUpperCase();
    return appConfig.workers[requested] ? requested : appConfig.defaultWorker;
}

function escapeText(value) {
    return String(value || "").trim();
}

function renderLinkedText(element, value) {
    const text = String(value || "");
    const urlPattern = /\bhttps?:\/\/[^\s<>"']+|\bwww\.[^\s<>"']+/gi;
    let cursor = 0;
    element.replaceChildren();

    text.replace(urlPattern, (match, offset) => {
        if (offset > cursor) {
            element.appendChild(document.createTextNode(text.slice(cursor, offset)));
        }

        const trailing = match.match(/[),.;:!?]+$/)?.[0] || "";
        const urlText = trailing ? match.slice(0, -trailing.length) : match;
        const link = document.createElement("a");
        link.href = urlText.startsWith("www.") ? `https://${urlText}` : urlText;
        link.textContent = urlText;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        element.appendChild(link);

        if (trailing) {
            element.appendChild(document.createTextNode(trailing));
        }

        cursor = offset + match.length;
        return match;
    });

    if (cursor < text.length) {
        element.appendChild(document.createTextNode(text.slice(cursor)));
    }
}

function formatTimestamp(value) {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(date);
}

function getTaskDateParts(value) {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return null;

    return {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
        timestamp: date.getTime()
    };
}

function padTaskNumber(value) {
    return String(value).padStart(2, "0");
}

function buildTaskNumberMap(tasks) {
    const datedTasks = tasks
        .map((task, fallbackIndex) => ({
            task,
            fallbackIndex,
            parts: getTaskDateParts(task.createdAt)
        }))
        .filter(entry => entry.parts);
    const datesByDay = new Map();
    const tasksByDate = new Map();
    const numbers = new Map();

    datedTasks.forEach(entry => {
        const dayKey = padTaskNumber(entry.parts.day);
        const monthKey = `${entry.parts.year}-${padTaskNumber(entry.parts.month)}`;
        const dateKey = `${monthKey}-${dayKey}`;

        if (!datesByDay.has(dayKey)) {
            datesByDay.set(dayKey, new Set());
        }
        datesByDay.get(dayKey).add(monthKey);

        if (!tasksByDate.has(dateKey)) {
            tasksByDate.set(dateKey, []);
        }
        tasksByDate.get(dateKey).push(entry);
    });

    tasksByDate.forEach((entries, dateKey) => {
        const [, month, day] = dateKey.split("-");
        const shouldShowMonth = (datesByDay.get(day)?.size || 0) > 1;

        entries
            .sort((a, b) => a.parts.timestamp - b.parts.timestamp || a.fallbackIndex - b.fallbackIndex)
            .forEach((entry, index) => {
                const sequence = padTaskNumber(index + 1);
                const label = shouldShowMonth
                    ? `${month}/${day}-${sequence}`
                    : `${day}-${sequence}`;
                numbers.set(String(entry.task.id), label);
            });
    });

    return numbers;
}

function setStatusMessage(element, message, isError = false) {
    element.textContent = message;
    element.style.color = isError ? "var(--danger)" : "var(--muted)";
}

function createEmptyState(message) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = message;
    return empty;
}

function setAccountPanelOpen(isOpen) {
    elements.accountPanel.classList.toggle("hidden", !isOpen);
    elements.accountToggle.setAttribute("aria-expanded", String(isOpen));
}

function setFabOpen(isOpen) {
    if (isOpen) {
        elements.fabShell.classList.add("is-open");
    } else {
        elements.fabShell.classList.remove("is-open");
    }
    elements.fabToggle.setAttribute("aria-expanded", String(isOpen));
}

function setFabHover(isHovering) {
    if (isHovering && elements.fabShell.classList.contains("is-hover-locked")) {
        return;
    }
    elements.fabShell.classList.toggle("is-hover", isHovering);
}

function setDoneDrawerOpen(isOpen) {
    state.showingDone = isOpen;
    document.body.classList.toggle("is-showing-done", isOpen);
    elements.doneToggle.setAttribute("aria-expanded", String(isOpen));
}

function renderWorkerHeader() {
    const worker = state.workerConfig;
    elements.workerCodeHeader.textContent = worker.code;
    elements.workerCodeFeed.textContent = worker.code;

    elements.workerNav.innerHTML = "";
    Object.values(appConfig.workers).forEach(entry => {
        const link = document.createElement("a");
        link.className = "worker-code-link";
        if (entry.code === worker.code) {
            link.classList.add("active");
        }
        link.href = `workerboard.html?worker=${encodeURIComponent(entry.code)}`;
        link.textContent = entry.code;
        elements.workerNav.appendChild(link);
    });
}

function populatePresetOptions() {
    const options = state.workerConfig.presetOptions || [];
    elements.presetSelect.innerHTML = "";

    options.forEach(option => {
        const item = document.createElement("option");
        item.value = option.id;
        item.textContent = option.label;
        elements.presetSelect.appendChild(item);
    });

    const updateExtraFields = () => {
        const selected = options.find(option => option.id === elements.presetSelect.value);
        renderExtraFields(selected);
    };

    elements.presetSelect.onchange = updateExtraFields;
    updateExtraFields();
}

function getCurrentExtraFieldValues() {
    return Array.from(elements.extraFields.querySelectorAll("[data-extra-field-id]"))
        .reduce((accumulator, input) => {
            accumulator[input.dataset.extraFieldId] = input.value;
            return accumulator;
        }, {});
}

function getActiveExtraFields(selectedOption) {
    const sharedFields = state.workerConfig.sharedExtraFields || [];
    const taskFields = selectedOption?.extraFields || [];
    return [...sharedFields, ...taskFields];
}

function wireSelectField(wrapper, input) {
    if (!wrapper || !input || input.tagName !== "SELECT") {
        return;
    }

    wrapper.classList.add("field-select");
    wrapper.addEventListener("click", event => {
        if (event.target === input) {
            return;
        }

        input.focus();
        if (typeof input.showPicker === "function") {
            input.showPicker();
        } else {
            input.click();
        }
    });
}

function renderExtraFields(selectedOption, preservedValues = {}) {
    const fields = getActiveExtraFields(selectedOption);
    elements.extraFields.innerHTML = "";

    if (fields.length === 0) {
        return;
    }

    fields.forEach(field => {
        if (field.visibleIf) {
            const parentValue = preservedValues[field.visibleIf.fieldId];
            if (parentValue !== field.visibleIf.equals) {
                return;
            }
        }

        const wrapper = document.createElement("label");
        wrapper.className = "field";

        const caption = document.createElement("span");
        caption.textContent = field.label;
        wrapper.appendChild(caption);

        let input;

        if (field.type === "select" || field.type === "boolean") {
            input = document.createElement("select");
            const options = field.type === "boolean" ? ["Yes", "No"] : field.options;
            input.innerHTML = `<option value="">Choose ${field.label}</option>`;
            options.forEach(option => {
                const item = document.createElement("option");
                item.value = option;
                item.textContent = option;
                input.appendChild(item);
            });
        } else {
            input = document.createElement("input");
            input.type = "text";
            input.placeholder = field.placeholder || field.label;
        }

        input.dataset.extraFieldId = field.id;
        input.dataset.extraFieldLabel = field.label;
        input.dataset.extraFieldDefault = field.defaultValue || "";
        input.value = preservedValues[field.id] || field.defaultValue || "";
        input.addEventListener("change", () => {
            const nextValues = {
                ...getCurrentExtraFieldValues(),
                [field.id]: input.value
            };
            renderExtraFields(selectedOption, nextValues);
        });
        wrapper.appendChild(input);
        wireSelectField(wrapper, input);
        elements.extraFields.appendChild(wrapper);
    });
}

function collectExtraFieldLines() {
    return Array.from(elements.extraFields.querySelectorAll("[data-extra-field-id]"))
        .map(input => {
            const value = escapeText(input.value);
            if (!value) return "";
            return `${input.dataset.extraFieldLabel}: ${value}`;
        })
        .filter(Boolean);
}

function getTaskDetailLines() {
    return collectExtraFieldLines()
        .filter(line => !line.startsWith("Priority:"));
}

function hasMeaningfulTaskDetail() {
    return Array.from(elements.extraFields.querySelectorAll("[data-extra-field-id]"))
        .some(input => {
            const value = escapeText(input.value);
            const defaultValue = escapeText(input.dataset.extraFieldDefault);
            const label = input.dataset.extraFieldLabel || "";

            if (!value || label === "Priority") {
                return false;
            }

            return value !== defaultValue;
        });
}

function getExtraFieldValue(fieldId) {
    const input = elements.extraFields.querySelector(`[data-extra-field-id="${fieldId}"]`);
    return input ? escapeText(input.value) : "";
}

function buildTaskTitle() {
    const selected = state.workerConfig.presetOptions.find(option => option.id === elements.presetSelect.value);
    return selected?.label || "Task";
}

function renderActivity() {
    const activity = state.activity || {
        title: `No current ${state.workerCode} activity set`,
        detail: "There is no live activity note posted yet.",
        updatedAt: null
    };
    const currentTask = state.tasks.find(task => task.status === "doing");
    const isOnLunch = activity.title === "__LUNCH__";
    const isDailyRoutine = activity.title === "Daily routine";
    const canUnpinActivity = Boolean(state.user && (currentTask || isOnLunch || isDailyRoutine));
    const canCompleteActivity = Boolean(state.user && currentTask);

    elements.activityTitle.textContent = isOnLunch
        ? "On lunch"
        : (activity.title || `No current ${state.workerCode} activity set`);
    renderLinkedText(
        elements.activityDetail,
        isOnLunch
            ? (activity.detail || `${state.workerCode} is on lunch right now.`)
            : (activity.detail || "There is no live activity note posted yet.")
    );
    elements.activityUpdated.textContent = state.user
        ? ""
        : (activity.updatedAt ? `Updated ${formatTimestamp(activity.updatedAt)}` : "");
    elements.activityUnpin.classList.toggle("hidden", !canUnpinActivity);
    elements.activityComplete.classList.toggle("hidden", !canCompleteActivity);
    elements.activityRoutine.classList.toggle("hidden", !state.user);
    elements.activityLunch.classList.toggle("hidden", !state.user);
    elements.activityLunch.textContent = "I'm on lunch";
    elements.activityLunch.classList.remove("button-danger");
    elements.activityLunch.classList.add("button-secondary");
}

function renderAccountState() {
    const signedIn = Boolean(state.user);

    elements.accountToggle.textContent = signedIn ? "Account" : "Sign in";
    elements.accountSummary.textContent = signedIn
        ? `Signed in as ${state.user.user || "account"}`
        : "Sign in to manage tasks and activity.";

    elements.accountEmail.disabled = signedIn;
    elements.accountPassword.disabled = signedIn;
    elements.accountSubmit.disabled = signedIn;
    elements.accountSignout.classList.toggle("hidden", !signedIn);
}

function renderTasks(provider) {
    const activeTasks = state.tasks.filter(task => !["done", "archived"].includes(task.status));
    const doneTasks = state.tasks.filter(task => task.status === "done");
    const taskNumbers = buildTaskNumberMap(state.tasks);

    elements.boardNote.classList.toggle("hidden", activeTasks.length > 0);

    renderTaskGroup(elements.taskList, activeTasks, provider, taskNumbers, `The ${state.workerCode} board is empty right now. Hit the plus button and pin the first task.`);
    elements.doneToggleMeta.textContent = `${doneTasks.length} today`;

    if (doneTasks.length > 0) {
        renderTaskGroup(elements.doneList, doneTasks, provider, taskNumbers);
    } else {
        elements.doneList.innerHTML = "";
        elements.doneList.appendChild(createEmptyState("No finished posts yet today."));
        if (state.showingDone) {
            setDoneDrawerOpen(false);
        }
    }
}

function renderTaskGroup(target, tasks, provider, taskNumbers, emptyMessage = "") {
    target.innerHTML = "";
    if (tasks.length === 0) {
        if (emptyMessage) {
            target.appendChild(createEmptyState(emptyMessage));
        }
        return;
    }

    tasks.forEach(task => {
        target.appendChild(createTaskNode(task, provider, taskNumbers.get(String(task.id)) || ""));
    });
}

function createTaskNode(task, provider, taskNumber) {
    const node = elements.taskTemplate.content.firstElementChild.cloneNode(true);
    const options = state.workerConfig.presetOptions || [];
    const presetLabel = options.find(option => option.id === task.preset)?.label || "Task";
    const canManage = Boolean(state.user);
    const isArchived = task.status === "archived";
    const isDoing = task.status === "doing";
    const isDone = task.status === "done";

    node.dataset.priority = task.priority || "Medium";
    node.dataset.manageable = canManage ? "true" : "false";
    node.dataset.status = task.status || "open";
    node.querySelector(".task-type").textContent = presetLabel;
    node.querySelector(".task-number").textContent = taskNumber;
    node.querySelector(".task-title").textContent = task.title;
    renderLinkedText(node.querySelector(".task-detail"), task.detail || "");
    node.querySelector(".task-author").textContent = task.author ? `Posted by ${task.author}` : "Posted anonymously";
    node.querySelector(".task-time").textContent = formatTimestamp(task.createdAt);

    const indicatorWrap = node.querySelector(".task-indicator-wrap");
    const indicator = node.querySelector(".task-indicator");
    const menu = node.querySelector(".task-menu");
    const editForm = node.querySelector(".edit-form");
    const editTitle = node.querySelector(".edit-title");
    const editDetail = node.querySelector(".edit-detail");
    const editButton = node.querySelector(".task-edit");
    const archiveButton = node.querySelector(".task-archive");
    const deleteButton = node.querySelector(".task-delete");
    const setDoingButton = node.querySelector(".task-set-doing");
    const setDoneButton = node.querySelector(".task-set-done");
    const cancelButton = node.querySelector(".edit-cancel");

    editTitle.value = task.title;
    editDetail.value = task.detail || "";

    if (!canManage) {
        indicator.disabled = true;
        menu.remove();
        editForm.remove();
        return node;
    }

    setDoingButton.textContent = isDone ? "Repost" : (isDoing ? "Undo" : "Mark doing");
    setDoingButton.classList.toggle("button-danger", isDoing);
    setDoingButton.classList.toggle("button-secondary", !isDoing);

    setDoneButton.classList.toggle("hidden", isDone || isArchived);
    editButton.classList.toggle("hidden", isArchived);
    archiveButton.classList.toggle("hidden", isArchived);
    deleteButton.classList.toggle("hidden", !isArchived);

    const closeMenu = () => {
        indicatorWrap.classList.remove("is-open");
        menu.classList.add("hidden");
        indicator.setAttribute("aria-expanded", "false");
    };

    const openMenu = () => {
        closeOpenTaskMenus();
        indicatorWrap.classList.add("is-open");
        menu.classList.remove("hidden");
        indicator.setAttribute("aria-expanded", "true");
    };

    indicator.addEventListener("click", event => {
        event.stopPropagation();
        if (menu.classList.contains("hidden")) {
            openMenu();
        } else {
            closeMenu();
        }
    });

    editButton.addEventListener("click", () => {
        editForm.classList.remove("hidden");
        closeMenu();
    });

    cancelButton.addEventListener("click", () => {
        editTitle.value = task.title;
        editDetail.value = task.detail || "";
        editForm.classList.add("hidden");
    });

    editForm.addEventListener("submit", async event => {
        event.preventDefault();
        try {
            await provider.updateTask(task.id, {
                title: escapeText(editTitle.value) || task.title,
                detail: escapeText(editDetail.value)
            });
            editForm.classList.add("hidden");
        } catch (error) {
            window.alert(error.message);
        }
    });

    setDoingButton.addEventListener("click", async () => {
        try {
            const activityTitle = state.activity?.title || "";
            if (!isDone && !isDoing && (activityTitle === "__LUNCH__" || activityTitle === "Daily routine")) {
                await provider.updateActivity({
                    title: `${state.workerCode} is not marked busy yet`,
                    detail: "There is no live activity note posted yet."
                }, { suppressRefresh: true });
            }
            await provider.updateTask(task.id, { status: isDone ? "open" : (isDoing ? "open" : "doing") }, { suppressRefresh: true });
            await provider.refresh();
            closeMenu();
        } catch (error) {
            window.alert(error.message);
        }
    });

    setDoneButton.addEventListener("click", async () => {
        try {
            await provider.updateTask(task.id, { status: "done" });
            closeMenu();
        } catch (error) {
            window.alert(error.message);
        }
    });

    archiveButton.addEventListener("click", async () => {
        try {
            await provider.updateTask(task.id, { status: "archived" });
            closeMenu();
        } catch (error) {
            window.alert(error.message);
        }
    });

    deleteButton.addEventListener("click", async () => {
        try {
            await provider.removeTask(task.id);
            closeMenu();
        } catch (error) {
            window.alert(error.message);
        }
    });

    return node;
}

function closeOpenTaskMenus() {
    document.querySelectorAll(".task-indicator-wrap.is-open").forEach(wrapper => {
        wrapper.classList.remove("is-open");
    });
    document.querySelectorAll(".task-menu").forEach(menu => {
        menu.classList.add("hidden");
    });
    document.querySelectorAll(".task-indicator[aria-expanded=\"true\"]").forEach(button => {
        button.setAttribute("aria-expanded", "false");
    });
}

function wireHorizontalWheelScroll(container) {
    if (!container) {
        return;
    }

    container.addEventListener("wheel", event => {
        const hasHorizontalOverflow = container.scrollWidth > container.clientWidth + 1;
        if (!hasHorizontalOverflow) {
            return;
        }

        if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
            return;
        }

        event.preventDefault();
        container.scrollLeft += event.deltaY;
    }, { passive: false });
}

class DemoWorkerBoardProvider {
    constructor(workerCode) {
        this.workerCode = workerCode;
        this.storageKey = `sw-worker-board:${workerCode}:v1`;
        this.listeners = new Set();
        this.data = this.readState();
    }

    readState() {
        const stored = window.localStorage.getItem(this.storageKey);
        if (stored) {
            try {
                return JSON.parse(stored);
            } catch {
                return this.getDefaultState();
            }
        }
        return this.getDefaultState();
    }

    getDefaultState() {
        return {
            tasks: [],
            activity: {
                title: `${this.workerCode} is not marked busy yet`,
                detail: "This worker board is currently running in local demo mode.",
                updatedAt: new Date().toISOString()
            }
        };
    }

    writeState() {
        window.localStorage.setItem(this.storageKey, JSON.stringify(this.data));
    }

    emit() {
        const snapshot = {
            tasks: [...this.data.tasks].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
            activity: this.data.activity
        };
        this.listeners.forEach(listener => listener(snapshot));
    }

    subscribe(listener) {
        this.listeners.add(listener);
        listener({
            tasks: [...this.data.tasks].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
            activity: this.data.activity
        });
        return () => this.listeners.delete(listener);
    }

    onAuthChange(listener) {
        listener(null);
        return () => undefined;
    }

    async refresh() {
        this.data = this.readState();
        this.emit();
    }

    async addTask(task) {
        this.data.tasks.push({
            id: crypto.randomUUID(),
            ...task,
            status: "open",
            workerCode: this.workerCode,
            createdAt: new Date().toISOString()
        });
        this.writeState();
        this.emit();
    }

    async updateTask(_taskId, _patch, _options = {}) {
        throw new Error("Editing tasks is disabled in demo mode.");
    }

    async removeTask() {
        throw new Error("Deleting tasks is disabled in demo mode.");
    }

    async updateActivity(_activity, _options = {}) {
        throw new Error("Current activity editing is disabled in demo mode.");
    }

    async login() {
        throw new Error("Owner login requires live Cloudflare mode.");
    }

    async logout() {
        return undefined;
    }
}

class CloudflareWorkerBoardProvider {
    constructor(apiBaseUrl, workerCode) {
        this.apiBaseUrl = apiBaseUrl.replace(/\/+$/, "");
        this.workerCode = workerCode;
        this.listeners = new Set();
        this.snapshot = { tasks: [], activity: null };
        this.authListeners = new Set();
        this.tokenKey = `sw-worker-board:${workerCode}:token`;
        this.userKey = `sw-worker-board:${workerCode}:user`;
        this.token = window.localStorage.getItem(this.tokenKey) || "";
        this.user = this.readStoredUser();
    }

    readStoredUser() {
        const stored = window.localStorage.getItem(this.userKey);
        if (!stored) {
            return null;
        }
        try {
            return JSON.parse(stored);
        } catch {
            return null;
        }
    }

    setSession(token, user) {
        this.token = token || "";
        this.user = user || null;

        if (this.token) {
            window.localStorage.setItem(this.tokenKey, this.token);
        } else {
            window.localStorage.removeItem(this.tokenKey);
        }

        if (this.user) {
            window.localStorage.setItem(this.userKey, JSON.stringify(this.user));
        } else {
            window.localStorage.removeItem(this.userKey);
        }

        this.emitAuth();
    }

    emit() {
        const snapshot = {
            tasks: [...this.snapshot.tasks].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
            activity: this.snapshot.activity
        };
        this.listeners.forEach(listener => listener(snapshot));
    }

    emitAuth() {
        this.authListeners.forEach(listener => listener(this.user));
    }

    getHeaders(includeAuth = false) {
        const headers = {
            "Content-Type": "application/json"
        };
        if (includeAuth && this.token) {
            headers.Authorization = `Bearer ${this.token}`;
        }
        return headers;
    }

    async request(path, options = {}) {
        const response = await fetch(`${this.apiBaseUrl}${path}`, {
            ...options,
            headers: {
                ...this.getHeaders(Boolean(options.auth)),
                ...(options.headers || {})
            }
        });

        const payload = response.status === 204 ? null : await response.json().catch(() => null);
        if (!response.ok) {
            throw new Error(payload?.error || "Request failed.");
        }
        return payload;
    }

    async refresh() {
        const [tasksPayload, activityPayload] = await Promise.all([
            this.request(`/api/workers/${this.workerCode}/tasks`),
            this.request(`/api/workers/${this.workerCode}/activity`)
        ]);

        this.snapshot.tasks = tasksPayload?.tasks || [];
        this.snapshot.activity = activityPayload?.activity || null;
        this.emit();
    }

    async init() {
        if (!this.token) {
            return;
        }

        try {
            const session = await this.request("/api/session", { auth: true });
            if (session?.user) {
                this.setSession(this.token, session.user);
            } else {
                this.setSession("", null);
            }
        } catch {
            this.setSession("", null);
        }
    }

    subscribe(listener) {
        this.listeners.add(listener);
        listener({
            tasks: [...this.snapshot.tasks],
            activity: this.snapshot.activity
        });
        this.refresh().catch(error => {
            console.error(error);
        });
        return () => this.listeners.delete(listener);
    }

    onAuthChange(listener) {
        this.authListeners.add(listener);
        listener(this.user);
        return () => this.authListeners.delete(listener);
    }

    async addTask(task) {
        await this.request(`/api/workers/${this.workerCode}/tasks`, {
            method: "POST",
            body: JSON.stringify(task)
        });
        await this.refresh();
    }

    async updateTask(taskId, patch, options = {}) {
        await this.request(`/api/workers/${this.workerCode}/tasks/${taskId}`, {
            method: "PATCH",
            auth: true,
            body: JSON.stringify(patch)
        });
        if (!options.suppressRefresh) {
            await this.refresh();
        }
    }

    async removeTask(taskId) {
        await this.request(`/api/workers/${this.workerCode}/tasks/${taskId}`, {
            method: "DELETE",
            auth: true
        });
        await this.refresh();
    }

    async updateActivity(activity, options = {}) {
        await this.request(`/api/workers/${this.workerCode}/activity`, {
            method: "PATCH",
            auth: true,
            body: JSON.stringify(activity)
        });
        if (!options.suppressRefresh) {
            await this.refresh();
        }
    }

    async login(user, password) {
        const payload = await this.request("/api/login", {
            method: "POST",
            body: JSON.stringify({
                user,
                password,
                workerCode: this.workerCode
            })
        });
        this.setSession(payload?.token || "", payload?.user || null);
        return payload;
    }

    async logout() {
        try {
            await this.request("/api/logout", {
                method: "POST",
                auth: true
            });
        } finally {
            this.setSession("", null);
        }
    }
}

async function createProvider() {
    if (appConfig.storageMode === "cloudflare" && appConfig.apiBaseUrl) {
        const provider = new CloudflareWorkerBoardProvider(appConfig.apiBaseUrl, state.workerCode);
        await provider.init();
        state.providerMode = "cloudflare";
        return provider;
    }

    state.providerMode = "demo";
    return new DemoWorkerBoardProvider(state.workerCode);
}

async function init() {
    state.workerCode = getWorkerCodeFromUrl();
    state.workerConfig = appConfig.workers[state.workerCode];

    renderWorkerHeader();
    populatePresetOptions();
    wireSelectField(elements.presetSelect.closest(".field"), elements.presetSelect);
    wireHorizontalWheelScroll(elements.taskList);
    wireHorizontalWheelScroll(elements.doneList);

    const provider = await createProvider();
    provider.subscribe(snapshot => {
        state.tasks = snapshot.tasks || [];
        state.activity = snapshot.activity || null;
        renderActivity();
        renderTasks(provider);
    });

    const refreshBoard = () => {
        if (document.hidden || typeof provider.refresh !== "function") {
            return;
        }

        provider.refresh().catch(error => {
            console.error(error);
        });
    };

    window.setInterval(refreshBoard, AUTO_REFRESH_MS);
    document.addEventListener("visibilitychange", () => {
        if (!document.hidden) {
            refreshBoard();
        }
    });
    window.addEventListener("focus", refreshBoard);

    provider.onAuthChange(user => {
        state.user = user;
        renderAccountState();
        renderTasks(provider);
    });

    elements.taskForm.addEventListener("submit", async event => {
        event.preventDefault();
        setStatusMessage(elements.submitStatus, "Posting...");

        try {
            const title = buildTaskTitle();

            const detailLines = getTaskDetailLines();
            if (!hasMeaningfulTaskDetail()) {
                setStatusMessage(elements.submitStatus, "Add at least one ticket detail before posting.", true);
                return;
            }

            await provider.addTask({
                preset: elements.presetSelect.value,
                title,
                priority: getExtraFieldValue("priority") || "Medium",
                detail: detailLines.join("\n"),
                author: escapeText(elements.taskAuthor.value)
            });

            elements.taskForm.reset();
            populatePresetOptions();
            setStatusMessage(elements.submitStatus, `Task posted to ${state.workerCode}.`);
            elements.fabShell.classList.add("is-hover-locked");
            setFabOpen(false);
            setFabHover(false);
        } catch (error) {
            setStatusMessage(elements.submitStatus, error.message, true);
        }
    });

    elements.fabToggle.addEventListener("click", event => {
        event.stopPropagation();
        setFabOpen(!elements.fabShell.classList.contains("is-open"));
    });

    elements.fabBack.addEventListener("click", () => {
        elements.fabShell.classList.remove("is-hover-locked");
        setFabOpen(false);
        setFabHover(false);
    });

    elements.accountToggle.addEventListener("click", event => {
        event.stopPropagation();
        setAccountPanelOpen(elements.accountPanel.classList.contains("hidden"));
    });

    elements.doneToggle.addEventListener("click", () => {
        setDoneDrawerOpen(!state.showingDone);
    });

    elements.accountForm.addEventListener("submit", async event => {
        event.preventDefault();
        setStatusMessage(elements.accountStatus, "Signing in...");

        try {
            await provider.login(escapeText(elements.accountEmail.value), elements.accountPassword.value);
            elements.accountPassword.value = "";
            setStatusMessage(elements.accountStatus, "Signed in.");
        } catch (error) {
            setStatusMessage(elements.accountStatus, error.message, true);
        }
    });

    elements.accountSignout.addEventListener("click", async () => {
        setStatusMessage(elements.accountStatus, "Signing out...");

        try {
            await provider.logout();
            setStatusMessage(elements.accountStatus, "Signed out.");
        } catch (error) {
            setStatusMessage(elements.accountStatus, error.message, true);
        }
    });

    elements.activityUnpin.addEventListener("click", async () => {
        const currentTask = state.tasks.find(task => task.status === "doing");

        try {
            if (currentTask) {
                await provider.updateTask(currentTask.id, { status: "open" }, { suppressRefresh: true });
            } else {
                await provider.updateActivity({
                    title: `${state.workerCode} is not marked busy yet`,
                    detail: "There is no live activity note posted yet."
                }, { suppressRefresh: true });
            }
            await provider.refresh();
        } catch (error) {
            window.alert(error.message);
        }
    });

    elements.activityComplete.addEventListener("click", async () => {
        const currentTask = state.tasks.find(task => task.status === "doing");
        if (!currentTask) {
            return;
        }

        try {
            await provider.updateTask(currentTask.id, { status: "done" });
        } catch (error) {
            window.alert(error.message);
        }
    });

    elements.activityLunch.addEventListener("click", async () => {
        const currentTask = state.tasks.find(task => task.status === "doing");

        try {
            if (currentTask) {
                await provider.updateTask(currentTask.id, { status: "open" }, { suppressRefresh: true });
            }
            await provider.updateActivity({
                title: "__LUNCH__",
                detail: `${state.workerCode} is on lunch right now.`
            }, { suppressRefresh: true });
            await provider.refresh();
        } catch (error) {
            window.alert(error.message);
        }
    });

    elements.activityRoutine.addEventListener("click", async () => {
        const currentTask = state.tasks.find(task => task.status === "doing");

        try {
            if (currentTask) {
                await provider.updateTask(currentTask.id, { status: "open" }, { suppressRefresh: true });
            }
            await provider.updateActivity({
                title: "Daily routine",
                detail: `${state.workerCode} is doing their daily routine right now.`
            }, { suppressRefresh: true });
            await provider.refresh();
        } catch (error) {
            window.alert(error.message);
        }
    });

    elements.fabToggle.addEventListener("mouseenter", () => {
        setFabHover(true);
    });

    elements.fabToggle.addEventListener("mouseleave", event => {
        if (!elements.fabShell.classList.contains("is-open") && !elements.fabPanel.contains(event.relatedTarget)) {
            setFabHover(false);
        }
    });

    elements.fabPanel.addEventListener("mouseenter", () => {
        if (elements.fabShell.classList.contains("is-hover")) {
            setFabHover(true);
        }
    });

    elements.fabShell.addEventListener("mouseleave", () => {
        elements.fabShell.classList.remove("is-hover-locked");
        setFabHover(false);
    });

    elements.fabPanel.addEventListener("click", event => {
        event.stopPropagation();
    });

    document.addEventListener("click", event => {
        if (!elements.fabShell.contains(event.target)) {
            elements.fabShell.classList.remove("is-hover-locked");
            setFabOpen(false);
            setFabHover(false);
        }
        if (!elements.accountPanel.contains(event.target) && !elements.accountToggle.contains(event.target)) {
            setAccountPanelOpen(false);
        }
        if (!event.target.closest(".task-indicator-wrap")) {
            closeOpenTaskMenus();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            elements.fabShell.classList.remove("is-hover-locked");
            setFabOpen(false);
            setFabHover(false);
            closeOpenTaskMenus();
        }
    });

    setFabOpen(false);
    setFabHover(false);
    setAccountPanelOpen(false);
    setDoneDrawerOpen(false);
    renderAccountState();
}

init().catch(error => {
    console.error(error);
    elements.taskList.innerHTML = "";
    elements.taskList.appendChild(createEmptyState("The worker board hit an error while loading."));
});
