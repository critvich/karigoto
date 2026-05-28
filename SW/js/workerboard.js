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
const configuredWorkerCodes = new Set(Object.keys(appConfig.workers));

const elements = {
    workerCodeHeader: document.getElementById("worker-code-header"),
    workerNav: document.getElementById("worker-nav"),
    workerCodeFeed: document.getElementById("worker-code-feed"),
    accountToggle: document.getElementById("account-toggle"),
    accountRequestToggle: document.getElementById("account-request-toggle"),
    accountAdminToggle: document.getElementById("account-admin-toggle"),
    accountPanel: document.getElementById("account-panel"),
    accountPanelClose: document.getElementById("account-panel-close"),
    accountSummary: document.getElementById("account-summary"),
    accountForm: document.getElementById("account-form"),
    accountEmail: document.getElementById("account-email"),
    accountPassword: document.getElementById("account-password"),
    accountSubmit: document.getElementById("account-submit"),
    accountSignout: document.getElementById("account-signout"),
    accountStatus: document.getElementById("account-status"),
    accountRequestForm: document.getElementById("account-request-form"),
    requestCode: document.getElementById("request-code"),
    requestPassword: document.getElementById("request-password"),
    requestStatus: document.getElementById("request-status"),
    accountAdminPanel: document.getElementById("account-admin-panel"),
    accountAdminRefresh: document.getElementById("account-admin-refresh"),
    accountAdminList: document.getElementById("account-admin-list"),
    accountAdminStatus: document.getElementById("account-admin-status"),
    activityUnpin: document.getElementById("activity-unpin"),
    activityComplete: document.getElementById("activity-complete"),
    quickActivityActions: document.getElementById("quick-activity-actions"),
    customActivityButtons: document.getElementById("custom-activity-buttons"),
    customActivityAdd: document.getElementById("custom-activity-add"),
    customActivityPanel: document.getElementById("custom-activity-panel"),
    customActivityForm: document.getElementById("custom-activity-form"),
    customActivityList: document.getElementById("custom-activity-list"),
    customButtonLabel: document.getElementById("custom-button-label"),
    customButtonTitle: document.getElementById("custom-button-title"),
    customButtonDetail: document.getElementById("custom-button-detail"),
    customButtonDefaultMorning: document.getElementById("custom-button-default-morning"),
    customActivityClose: document.getElementById("custom-activity-close"),
    customActivityNew: document.getElementById("custom-activity-new"),
    customActivitySetCurrent: document.getElementById("custom-activity-set-current"),
    customActivityDelete: document.getElementById("custom-activity-delete"),
    customActivityStatus: document.getElementById("custom-activity-status"),
    activityTitle: document.getElementById("activity-title"),
    activityDetail: document.getElementById("activity-detail"),
    activityUpdated: document.getElementById("activity-updated"),
    boardNote: document.getElementById("board-note"),
    boardSort: document.getElementById("board-sort"),
    boardFilter: document.getElementById("board-filter"),
    boardExpand: document.getElementById("board-expand"),
    presetSelect: document.getElementById("preset-select"),
    extraFields: document.getElementById("extra-fields"),
    taskForm: document.getElementById("task-form"),
    submitStatus: document.getElementById("submit-status"),
    taskList: document.getElementById("task-list"),
    doneDrawer: document.getElementById("done-drawer"),
    doneToggle: document.getElementById("done-toggle"),
    archiveToggle: document.getElementById("archive-toggle"),
    doneToggleMeta: document.getElementById("done-toggle-meta"),
    doneList: document.getElementById("done-list"),
    donePanel: document.getElementById("done-panel"),
    taskTemplate: document.getElementById("task-card-template"),
    fabShell: document.getElementById("fab-shell"),
    fabPanel: document.getElementById("fab-panel"),
    fabClear: document.getElementById("fab-clear"),
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
    accounts: [],
    accountPanelMode: "signin",
    showingDone: false,
    boardSort: "newest",
    boardFilter: "all",
    boardExpanded: false,
    archiveExpanded: false,
    customActivityButtons: [],
    editingCustomActivityId: "",
    pendingSignin: null,
    openTaskMenuId: "",
    editingTaskId: "",
    taskEditDrafts: {},
    morningDefaultApplying: false
};

const AUTO_REFRESH_MS = 10000;
const PENDING_SIGNIN_MS = 5000;
const FAB_COLLAPSE_GUARD_MS = 300;
let suppressFabToggleUntil = 0;

function getWorkerCodeFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const requested = (params.get("worker") || appConfig.defaultWorker || "").toUpperCase();
    return appConfig.workers[requested] ? requested : appConfig.defaultWorker;
}

function cloneWorkerConfig(source, code) {
    const cloned = JSON.parse(JSON.stringify(source || {}));
    return {
        ...cloned,
        code,
        title: `${code} Task Board`,
        description: `Task board for ${code}.`
    };
}

function ensureWorkerConfig(code) {
    const normalizedCode = String(code || "").trim().toUpperCase();
    if (!/^[A-Z0-9]{4}$/.test(normalizedCode)) {
        return;
    }

    const template = appConfig.workers[appConfig.defaultWorker] || Object.values(appConfig.workers)[0];
    if (!template || appConfig.workers[normalizedCode]) {
        return;
    }

    appConfig.workers[normalizedCode] = cloneWorkerConfig(template, normalizedCode);
}

async function hydrateWorkerConfigs() {
    if (appConfig.storageMode !== "cloudflare" || !appConfig.apiBaseUrl) {
        return;
    }

    const template = appConfig.workers[appConfig.defaultWorker] || Object.values(appConfig.workers)[0];
    if (!template) {
        return;
    }

    try {
        const response = await fetch(`${appConfig.apiBaseUrl.replace(/\/+$/, "")}/api/workers`, {
            cache: "no-store"
        });
        if (!response.ok) {
            throw new Error("Workers request failed.");
        }
        const payload = await response.json();
        const workerCodes = new Set();
        (payload?.workers || []).forEach(worker => {
            const code = String(worker.code || "").trim().toUpperCase();
            if (!/^[A-Z0-9]{4}$/.test(code)) {
                return;
            }
            workerCodes.add(code);
            appConfig.workers[code] = {
                ...cloneWorkerConfig(template, code),
                ...(appConfig.workers[code] || {}),
                code,
                title: worker.title || `${code} Task Board`
            };
        });
        Object.keys(appConfig.workers).forEach(code => {
            if (!configuredWorkerCodes.has(code) && !workerCodes.has(code)) {
                delete appConfig.workers[code];
            }
        });
    } catch (error) {
        console.error(error);
    }
}

async function refreshWorkerHeader() {
    await hydrateWorkerConfigs();
    renderWorkerHeader();
}

function removeWorkerConfig(code) {
    const normalizedCode = String(code || "").trim().toUpperCase();
    if (!configuredWorkerCodes.has(normalizedCode)) {
        delete appConfig.workers[normalizedCode];
    }
    if (state.workerCode === normalizedCode && appConfig.workers[appConfig.defaultWorker]) {
        window.location.href = `workerboard.html?worker=${encodeURIComponent(appConfig.defaultWorker)}`;
        return;
    }
    renderWorkerHeader();
}

function escapeText(value) {
    return String(value || "").trim();
}

function normalizeAccountCode(value) {
    return escapeText(value).toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
}

function renderLinkedText(element, value) {
    const text = formatTaskDisplayText(value);
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

function formatShortTimestamp(value) {
    if (!value) return "";
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
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

function isPendingApprovalError(error) {
    return /waiting for admin approval/i.test(error?.message || "");
}

function stopPendingSignin() {
    if (state.pendingSignin?.timer) {
        window.clearInterval(state.pendingSignin.timer);
    }
    state.pendingSignin = null;
}

function startPendingSignin(provider, code, password) {
    stopPendingSignin();
    ensureWorkerConfig(code);
    renderWorkerHeader();

    const attemptSignin = async () => {
        if (!state.pendingSignin || state.user) {
            stopPendingSignin();
            return;
        }

        try {
            await provider.login(code, password);
            elements.requestPassword.value = "";
            setStatusMessage(elements.requestStatus, "Approved. Signed in.");
            stopPendingSignin();
            if (state.workerCode !== code && appConfig.workers[code]) {
                window.location.href = `workerboard.html?worker=${encodeURIComponent(code)}`;
            }
        } catch (error) {
            if (isPendingApprovalError(error)) {
                setStatusMessage(elements.requestStatus, "Request sent. Waiting for approval...");
                return;
            }

            stopPendingSignin();
            await refreshWorkerHeader();
            renderAccountState();
            setStatusMessage(elements.requestStatus, error.message, true);
        }
    };

    state.pendingSignin = {
        code,
        timer: window.setInterval(attemptSignin, PENDING_SIGNIN_MS)
    };
    state.accountPanelMode = "request";
    renderAccountState();
    attemptSignin();
}

function createEmptyState(message) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = message;
    return empty;
}

function createInlineEmptyState(message) {
    const empty = document.createElement("div");
    empty.className = "empty-state account-empty-state";
    empty.textContent = message;
    return empty;
}

function setAccountPanelMode(mode) {
    const isPending = Boolean(state.pendingSignin && !state.user);
    state.accountPanelMode = mode;
    elements.accountForm.classList.toggle("hidden", isPending || mode !== "signin");
    elements.accountRequestForm.classList.toggle("hidden", isPending || mode !== "request");
    elements.accountAdminPanel.classList.toggle("hidden", mode !== "admin" || !state.user?.isAdmin);
    if (!state.user) {
        elements.accountSummary.textContent = isPending
            ? `${state.pendingSignin.code} account pending approval.`
            : mode === "request"
            ? "Request access with your 4 letter code."
            : "Sign in to manage tasks and activity.";
    }
}

function setAccountPanelOpen(isOpen, mode = state.accountPanelMode) {
    if (isOpen) {
        setAccountPanelMode(mode);
    }
    elements.accountPanel.classList.toggle("hidden", !isOpen);
    elements.accountToggle.setAttribute("aria-expanded", String(isOpen && (mode === "signin" || Boolean(state.pendingSignin && !state.user && mode === "request"))));
    elements.accountRequestToggle.setAttribute("aria-expanded", String(isOpen && mode === "request"));
    elements.accountAdminToggle.setAttribute("aria-expanded", String(isOpen && mode === "admin"));
}

function setFabOpen(isOpen) {
    if (isOpen && Date.now() < suppressFabToggleUntil) {
        return;
    }

    if (isOpen) {
        elements.fabShell.classList.remove("is-collapsing");
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

function hasTaskDraft() {
    return Array.from(elements.extraFields.querySelectorAll("[data-extra-field-id]"))
        .some(input => {
            const value = escapeText(input.value);
            const defaultValue = escapeText(input.dataset.extraFieldDefault);
            return value && value !== defaultValue;
        });
}

function updateFabDraftLock() {
    const hasDraft = hasTaskDraft();
    elements.fabShell.classList.toggle("is-hover-locked", hasDraft);
    if (hasDraft) {
        setFabOpen(true);
        elements.fabShell.classList.add("is-hover");
    }
    return hasDraft;
}

function closeFab(options = {}) {
    if (!options.force && updateFabDraftLock()) {
        return false;
    }

    elements.fabShell.classList.remove("is-hover-locked");
    suppressFabToggleUntil = Date.now() + FAB_COLLAPSE_GUARD_MS;
    elements.fabShell.classList.add("is-collapsing");
    setFabOpen(false);
    setFabHover(false);
    window.setTimeout(() => {
        if (!elements.fabShell.classList.contains("is-open")) {
            elements.fabShell.classList.remove("is-collapsing");
        }
    }, FAB_COLLAPSE_GUARD_MS);
    return true;
}

function isMeaningfullyEdited(task) {
    if (!task?.editedAt || !task?.createdAt) {
        return Boolean(task?.editedAt);
    }

    const editedTime = new Date(task.editedAt).getTime();
    const createdTime = new Date(task.createdAt).getTime();
    if (!Number.isFinite(editedTime) || !Number.isFinite(createdTime)) {
        return Boolean(task.editedAt);
    }

    return editedTime - createdTime > 1000;
}

function clearTaskDraft() {
    elements.taskForm.reset();
    populatePresetOptions();
    setStatusMessage(elements.submitStatus, "");
    elements.fabShell.classList.remove("is-hover-locked");
}

function setDoneDrawerOpen(isOpen) {
    state.showingDone = isOpen;
    document.body.classList.toggle("is-showing-done", isOpen);
    elements.doneToggle.setAttribute("aria-expanded", String(isOpen));
}

function renderWorkerHeader() {
    const worker = state.workerConfig;
    elements.workerCodeHeader.textContent = "board";
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

function setBoardExpanded(isExpanded) {
    state.boardExpanded = isExpanded;
    if (!isExpanded) {
        state.archiveExpanded = false;
    }
    document.body.classList.toggle("is-board-expanded", isExpanded);
    document.body.classList.toggle("is-archive-expanded", state.archiveExpanded);
    elements.boardExpand.textContent = isExpanded ? "Exit" : "Expand";
    elements.boardExpand.setAttribute("aria-expanded", String(isExpanded));
}

function setArchiveExpanded(isExpanded, provider) {
    state.archiveExpanded = isExpanded;
    setBoardExpanded(isExpanded);
    renderTasks(provider);
}

function formatTaskDisplayText(value) {
    return String(value || "")
        .replaceAll("Delivery report new shipment", "Arrival report new shipment")
        .replaceAll("Location (optional):", "Location:")
        .replaceAll("Order number (optional):", "Order number:")
        .replaceAll("Claim number (if there is one already):", "Claim number:");
}

function populateBoardFilterOptions() {
    const options = state.workerConfig.presetOptions || [];
    elements.boardFilter.innerHTML = "";

    const allOption = document.createElement("option");
    allOption.value = "all";
    allOption.textContent = "All";
    elements.boardFilter.appendChild(allOption);

    options.forEach(option => {
        const item = document.createElement("option");
        item.value = option.id;
        item.textContent = formatTaskDisplayText(option.label);
        elements.boardFilter.appendChild(item);
    });

    if (!options.some(option => option.id === state.boardFilter)) {
        state.boardFilter = "all";
    }
    elements.boardFilter.value = state.boardFilter;
}

function getCurrentExtraFieldValues(container = elements.extraFields) {
    return Array.from(container.querySelectorAll("[data-extra-field-id]"))
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

function renderFieldControls(container, fields, preservedValues = {}, onValuesChange = null) {
    container.innerHTML = "";
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
        } else if (field.type === "textarea") {
            input = document.createElement("textarea");
            input.rows = field.rows || 4;
            input.placeholder = field.placeholder || field.label;
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
                ...getCurrentExtraFieldValues(container),
                [field.id]: input.value
            };
            if (typeof onValuesChange === "function") {
                onValuesChange(nextValues, true);
            } else {
                renderFieldControls(container, fields, nextValues, onValuesChange);
            }
        });
        input.addEventListener("input", () => {
            if (typeof onValuesChange === "function") {
                onValuesChange(getCurrentExtraFieldValues(container), false);
            }
        });
        wrapper.appendChild(input);
        wireSelectField(wrapper, input);
        container.appendChild(wrapper);
    });
}

function renderExtraFields(selectedOption, preservedValues = {}) {
    const fields = getActiveExtraFields(selectedOption);

    if (fields.length === 0) {
        elements.extraFields.innerHTML = "";
        return;
    }

    renderFieldControls(elements.extraFields, fields, preservedValues);
}

function collectExtraFieldLines(container = elements.extraFields) {
    return Array.from(container.querySelectorAll("[data-extra-field-id]"))
        .map(input => {
            const value = escapeText(input.value);
            if (!value) return "";
            return `${input.dataset.extraFieldLabel}: ${value}`;
        })
        .filter(Boolean);
}

function getTaskDetailLines() {
    if (elements.presetSelect.value === "misc") {
        const body = getExtraFieldValue("misc-body");
        return body ? [body] : [];
    }

    return collectExtraFieldLines()
        .filter(line => !line.startsWith("Priority:"));
}

function hasMeaningfulTaskDetail() {
    if (elements.presetSelect.value === "misc") {
        return Boolean(getExtraFieldValue("misc-header") && getExtraFieldValue("misc-body"));
    }

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

function normalizeFieldLabel(value) {
    return formatTaskDisplayText(value)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function parseTaskDetailFieldValues(task, presetOption) {
    const values = {
        priority: task.priority || "Medium"
    };
    const fields = getActiveExtraFields(presetOption);
    const fieldsByLabel = new Map(fields.map(field => [normalizeFieldLabel(field.label), field]));

    String(task.detail || "")
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean)
        .forEach(line => {
            const separatorIndex = line.indexOf(":");
            if (separatorIndex < 0) {
                return;
            }
            const label = normalizeFieldLabel(line.slice(0, separatorIndex));
            const field = fieldsByLabel.get(label);
            if (!field) {
                return;
            }
            values[field.id] = line.slice(separatorIndex + 1).trim();
        });

    return values;
}

function buildTaskDetailFromFieldContainer(container) {
    return collectExtraFieldLines(container)
        .filter(line => !line.startsWith("Priority:"))
        .join("\n");
}

function buildTaskTitle() {
    if (elements.presetSelect.value === "misc") {
        return getExtraFieldValue("misc-header") || "Misc";
    }

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
    const quickActivityTitles = new Set(state.customActivityButtons.map(button => button.title));
    const isOnLunch = activity.title === "__LUNCH__";
    const isQuickActivity = quickActivityTitles.has(activity.title);
    const hasCurrentActivity = Boolean(activity.title && activity.title !== `No current ${state.workerCode} activity set`);
    const canManage = canManageCurrentBoard();
    const canUnpinActivity = Boolean(canManage && (currentTask || isOnLunch || isQuickActivity || hasCurrentActivity));
    const canCompleteActivity = Boolean(canManage && currentTask);

    elements.activityTitle.textContent = isOnLunch
        ? "On lunch"
        : (activity.title || `No current ${state.workerCode} activity set`);
    const defaultEmptyDetail = activity.title === `No current ${state.workerCode} activity set`
        ? "There is no live activity note posted yet."
        : "";
    renderLinkedText(elements.activityDetail, activity.detail ?? defaultEmptyDetail);
    elements.activityUpdated.textContent = state.user
        ? ""
        : (activity.updatedAt ? `Updated ${formatTimestamp(activity.updatedAt)}` : "");
    elements.activityUnpin.classList.toggle("hidden", !canUnpinActivity);
    elements.activityComplete.classList.toggle("hidden", !canCompleteActivity);
    elements.quickActivityActions.classList.toggle("hidden", !canManage);
    elements.customActivityAdd.classList.toggle("hidden", !canManage);
}

function canManageCurrentBoard() {
    return Boolean(state.user?.isAdmin || state.user?.workerCode === state.workerCode);
}

function getPostingAuthor() {
    if (!state.user) {
        return "";
    }
    return state.user.isAdmin ? state.workerCode : state.user.user;
}

function getCustomActivityStorageKey() {
    const user = state.user?.user || "signed-out";
    return `sw-worker-board:${state.workerCode}:${user}:custom-activity-buttons`;
}

function getCustomActivityMigrationKey() {
    return `${getCustomActivityStorageKey()}:defaults-added`;
}

function getMorningDefaultStorageKey() {
    const user = state.user?.user || "signed-out";
    return `sw-worker-board:${state.workerCode}:${user}:morning-default-day`;
}

function getDefaultCustomActivityButtons() {
    return [
        {
            id: "default-lunch",
            label: "I'm on lunch",
            title: "On lunch",
            detail: `${state.workerCode} is on lunch right now.`,
            defaultMorning: false
        },
        {
            id: "default-routine",
            label: "Daily routine",
            title: "Daily routine",
            detail: `${state.workerCode} is doing their daily routine right now.`,
            defaultMorning: true
        }
    ];
}

function normalizeCustomActivityButton(button) {
    if (!button?.label || !button?.title) {
        return null;
    }

    return {
        id: button.id || crypto.randomUUID(),
        label: String(button.label || "").slice(0, 18),
        title: String(button.title || "").slice(0, 80),
        detail: String(button.detail || "").slice(0, 180),
        defaultMorning: button.defaultMorning === undefined
            ? button.id === "default-routine"
            : Boolean(button.defaultMorning)
    };
}

function loadCustomActivityButtons() {
    if (!state.user) {
        state.customActivityButtons = [];
        renderCustomActivityButtons();
        return;
    }

    try {
        const stored = window.localStorage.getItem(getCustomActivityStorageKey());
        let parsed = stored ? JSON.parse(stored) : getDefaultCustomActivityButtons();
        if (stored && !window.localStorage.getItem(getCustomActivityMigrationKey())) {
            const defaults = getDefaultCustomActivityButtons();
            const existingIds = new Set(parsed.map(button => button.id));
            parsed = [
                ...defaults.filter(button => !existingIds.has(button.id)),
                ...parsed
            ];
            window.localStorage.setItem(getCustomActivityMigrationKey(), "true");
            window.localStorage.setItem(getCustomActivityStorageKey(), JSON.stringify(parsed));
        }
        state.customActivityButtons = Array.isArray(parsed)
            ? parsed.map(normalizeCustomActivityButton).filter(Boolean).slice(0, 8)
            : [];
    } catch {
        state.customActivityButtons = [];
    }
    renderCustomActivityButtons();
}

function saveCustomActivityButtons() {
    if (!state.user) {
        return;
    }
    window.localStorage.setItem(getCustomActivityStorageKey(), JSON.stringify(state.customActivityButtons));
}

function renderCustomActivityButtons() {
    elements.customActivityButtons.innerHTML = "";
    state.customActivityButtons.forEach(button => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "button button-secondary custom-activity-button";
        item.textContent = button.label;
        item.classList.toggle("is-morning-default", Boolean(button.defaultMorning));
        item.dataset.customActivityId = button.id;
        elements.customActivityButtons.appendChild(item);
    });
    renderCustomActivityEditorList();
}

async function applyQuickActivity(provider, title, detail) {
    const currentTask = state.tasks.find(task => task.status === "doing");
    if (currentTask) {
        await provider.updateTask(currentTask.id, { status: "open" }, { suppressRefresh: true });
    }
    await provider.updateActivity({ title, detail: detail || "" }, { suppressRefresh: true });
    await provider.refresh();
}

function getLocalDayKeyForBrowser(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function getActivityLocalDay(activity) {
    if (!activity?.updatedAt) {
        return "";
    }
    const date = new Date(activity.updatedAt);
    if (Number.isNaN(date.getTime())) {
        return "";
    }
    return getLocalDayKeyForBrowser(date);
}

async function applyMorningDefaultActivity(provider) {
    if (state.morningDefaultApplying || !state.user || !canManageCurrentBoard()) {
        return;
    }

    const defaultButton = state.customActivityButtons.find(button => button.defaultMorning);
    if (!defaultButton) {
        return;
    }

    const today = getLocalDayKeyForBrowser();
    if (window.localStorage.getItem(getMorningDefaultStorageKey()) === today) {
        return;
    }

    if (state.tasks.some(task => task.status === "doing")) {
        return;
    }

    if (getActivityLocalDay(state.activity) === today) {
        return;
    }

    state.morningDefaultApplying = true;
    window.localStorage.setItem(getMorningDefaultStorageKey(), today);
    try {
        await applyQuickActivity(provider, defaultButton.title, defaultButton.detail);
    } catch (error) {
        window.localStorage.removeItem(getMorningDefaultStorageKey());
        console.error(error);
    } finally {
        state.morningDefaultApplying = false;
    }
}

async function copyTextToClipboard(text) {
    const value = String(text || "").trim();
    if (!value) {
        return;
    }

    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
}

function renderTaskDetail(element, task) {
    element.replaceChildren();
    const lines = String(task.detail || "")
        .split(/\r?\n/)
        .map(line => formatTaskDisplayText(line).trim())
        .filter(Boolean);

    if (task.preset === "misc" || lines.length === 0) {
        renderLinkedText(element, task.detail || "");
        return;
    }

    const list = document.createElement("div");
    list.className = "task-detail-options";
    lines.forEach(line => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "task-detail-option";
        button.textContent = line;
        button.title = "Copy";
        const separatorIndex = line.indexOf(":");
        const copyValue = separatorIndex >= 0 ? line.slice(separatorIndex + 1).trim() || line : line;
        button.addEventListener("click", async event => {
            event.stopPropagation();
            try {
                await copyTextToClipboard(copyValue);
                button.classList.add("copied");
                window.setTimeout(() => button.classList.remove("copied"), 800);
            } catch (error) {
                console.error(error);
            }
        });
        list.appendChild(button);
    });
    element.appendChild(list);
}

function setCustomActivityPanelOpen(isOpen) {
    elements.customActivityPanel.classList.toggle("hidden", !isOpen);
    if (isOpen) {
        renderCustomActivityEditorList();
        if (!state.editingCustomActivityId) {
            startNewCustomActivity();
        }
        elements.customButtonLabel.focus();
    }
}

function startNewCustomActivity() {
    state.editingCustomActivityId = "";
    elements.customButtonLabel.value = "";
    elements.customButtonTitle.value = "";
    elements.customButtonDetail.value = "";
    elements.customButtonDefaultMorning.checked = false;
    elements.customActivityDelete.classList.add("hidden");
    setStatusMessage(elements.customActivityStatus, "");
    renderCustomActivityEditorList();
}

function editCustomActivityButton(id) {
    const button = state.customActivityButtons.find(item => item.id === id);
    if (!button) {
        startNewCustomActivity();
        return;
    }
    state.editingCustomActivityId = button.id;
    elements.customButtonLabel.value = button.label;
    elements.customButtonTitle.value = button.title;
    elements.customButtonDetail.value = button.detail || "";
    elements.customButtonDefaultMorning.checked = Boolean(button.defaultMorning);
    elements.customActivityDelete.classList.remove("hidden");
    setStatusMessage(elements.customActivityStatus, "");
    renderCustomActivityEditorList();
}

function renderCustomActivityEditorList() {
    if (!elements.customActivityList) {
        return;
    }
    elements.customActivityList.innerHTML = "";
    state.customActivityButtons.forEach(button => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "custom-activity-list-item";
        item.classList.toggle("active", button.id === state.editingCustomActivityId);
        item.classList.toggle("is-morning-default", Boolean(button.defaultMorning));
        item.setAttribute("aria-selected", String(button.id === state.editingCustomActivityId));
        item.dataset.customEditId = button.id;
        item.textContent = button.defaultMorning ? `${button.label} default` : button.label;
        elements.customActivityList.appendChild(item);
    });
}

function getTaskAuthorLabel(task) {
    const author = String(task.author || "").trim();
    if (!author) {
        return "account";
    }
    if (author.toLowerCase() === "brboherbo") {
        return task.workerCode || state.workerCode;
    }
    return author;
}

function getTaskEditedByLabel(task) {
    const editor = String(task.editedBy || "").trim();
    if (!editor) {
        return getTaskAuthorLabel(task);
    }
    if (editor.toLowerCase() === "brboherbo") {
        return task.workerCode || state.workerCode;
    }
    return editor;
}

function renderAccountState() {
    const signedIn = Boolean(state.user);
    const isAdmin = Boolean(state.user?.isAdmin);
    const isPending = Boolean(state.pendingSignin && !signedIn);

    elements.accountToggle.textContent = signedIn ? "Account" : (isPending ? "Account pending" : "Sign in");
    elements.accountRequestToggle.classList.toggle("hidden", signedIn || isPending);
    elements.accountAdminToggle.classList.toggle("hidden", !isAdmin);
    elements.accountSummary.textContent = signedIn
        ? `Signed in as ${state.user.user || "account"}`
        : isPending
        ? `${state.pendingSignin.code} account pending approval.`
        : (state.accountPanelMode === "request" ? "Request access with your 4 letter code." : "Sign in to manage tasks and activity.");

    elements.accountEmail.disabled = signedIn || isPending;
    elements.accountPassword.disabled = signedIn || isPending;
    elements.accountSubmit.disabled = signedIn || isPending;
    elements.accountSignout.classList.toggle("hidden", !signedIn);
    elements.fabShell.classList.toggle("hidden", !signedIn);
    if (!isAdmin && state.accountPanelMode === "admin") {
        state.accountPanelMode = signedIn ? "signin" : "request";
    }
    if (isPending) {
        state.accountPanelMode = "request";
    }
    if (signedIn && state.accountPanelMode === "request") {
        state.accountPanelMode = "signin";
    }
    setAccountPanelMode(state.accountPanelMode);
    renderAccountList();
}

function getAccountStatusText(account) {
    const requested = account.requestedAt ? `requested ${formatShortTimestamp(account.requestedAt)}` : "requested";
    if (account.status === "approved") {
        const approved = account.approvedAt ? `approved ${formatShortTimestamp(account.approvedAt)}` : "approved";
        return `${approved} by ${account.approvedBy || "admin"}`;
    }
    if (account.status === "rejected") {
        return `rejected, ${requested}`;
    }
    return `pending, ${requested}`;
}

function renderAccountList() {
    if (!elements.accountAdminList || !state.user?.isAdmin) {
        return;
    }

    elements.accountAdminList.innerHTML = "";
    if (state.accounts.length === 0) {
        elements.accountAdminList.appendChild(createInlineEmptyState("No account requests yet."));
        return;
    }

    state.accounts.forEach(account => {
        const row = document.createElement("article");
        row.className = "account-row";
        row.dataset.status = account.status || "pending";

        const copy = document.createElement("div");
        const code = document.createElement("p");
        code.className = "account-code";
        code.textContent = account.code;
        const meta = document.createElement("p");
        meta.className = "account-meta";
        meta.textContent = getAccountStatusText(account);
        copy.append(code, meta);

        const actions = document.createElement("div");
        actions.className = "account-actions";

        const approve = document.createElement("button");
        approve.type = "button";
        approve.className = "button button-primary";
        approve.textContent = "Approve";
        approve.dataset.accountCode = account.code;
        approve.dataset.accountStatus = "approved";
        approve.disabled = account.status === "approved";

        const reject = document.createElement("button");
        reject.type = "button";
        reject.className = "button button-danger";
        reject.textContent = account.status === "approved" ? "Remove" : "Reject";
        reject.dataset.accountCode = account.code;
        if (account.status === "approved") {
            reject.dataset.accountAction = "remove";
        } else {
            reject.dataset.accountStatus = "rejected";
        }
        reject.disabled = account.status === "rejected";

        actions.append(approve, reject);
        row.append(copy, actions);
        elements.accountAdminList.appendChild(row);
    });
}

async function refreshAccounts(provider, options = {}) {
    if (!state.user?.isAdmin || typeof provider.listAccounts !== "function") {
        return;
    }

    if (!options.silent) {
        setStatusMessage(elements.accountAdminStatus, "Loading accounts...");
    }
    try {
        state.accounts = await provider.listAccounts();
        renderAccountList();
        if (!options.silent) {
            setStatusMessage(elements.accountAdminStatus, "");
        }
    } catch (error) {
        setStatusMessage(elements.accountAdminStatus, error.message, true);
    }
}

function renderTasks(provider) {
    const activeTasks = state.tasks.filter(task => !["done", "archived"].includes(task.status));
    const doneTasks = state.tasks.filter(task => task.status === "done");
    const archivedTasks = state.tasks.filter(task => task.status === "archived");
    const visibleActiveTasks = sortBoardTasks(filterBoardTasks(activeTasks));
    const visibleArchivedTasks = sortBoardTasks(filterBoardTasks(archivedTasks));
    const taskNumbers = buildTaskNumberMap(state.tasks);

    elements.boardNote.classList.toggle("hidden", activeTasks.length > 0);

    if (state.archiveExpanded) {
        elements.boardNote.classList.add("hidden");
        renderTaskGroup(elements.taskList, visibleArchivedTasks, provider, taskNumbers, "No archived posts yet.");
    } else {
        renderTaskGroup(elements.taskList, visibleActiveTasks, provider, taskNumbers, getBoardEmptyMessage(activeTasks.length));
    }
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

function getBoardEmptyMessage(activeCount) {
    if (activeCount === 0) {
        return `The ${state.workerCode} board is empty right now. Hit the plus button and pin the first task.`;
    }

    return "No tasks match this filter.";
}

function getPriorityRank(priority) {
    const normalized = String(priority || "Medium").toLowerCase();
    if (normalized === "high") return 0;
    if (normalized === "medium") return 1;
    if (normalized === "low") return 2;
    return 3;
}

function getTaskTime(task) {
    const timestamp = new Date(task.createdAt).getTime();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function filterBoardTasks(tasks) {
    if (state.boardFilter === "all") {
        return tasks;
    }

    return tasks.filter(task => task.preset === state.boardFilter);
}

function sortBoardTasks(tasks) {
    return [...tasks].sort((a, b) => {
        if (state.boardSort === "oldest") {
            return getTaskTime(a) - getTaskTime(b);
        }

        if (state.boardSort === "priority") {
            return getPriorityRank(a.priority) - getPriorityRank(b.priority) || getTaskTime(b) - getTaskTime(a);
        }

        return getTaskTime(b) - getTaskTime(a);
    });
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
    const presetOption = options.find(option => option.id === task.preset);
    const presetLabel = formatTaskDisplayText(presetOption?.label || "Task");
    const canManage = canManageCurrentBoard();
    const isArchived = task.status === "archived";
    const isDoing = task.status === "doing";
    const isDone = task.status === "done";
    const taskId = String(task.id);
    const draft = state.taskEditDrafts[taskId] || {};
    const isEditing = state.editingTaskId === taskId;
    const isMenuOpen = !isEditing && state.openTaskMenuId === taskId;

    node.dataset.priority = task.priority || "Medium";
    node.dataset.manageable = canManage ? "true" : "false";
    node.dataset.status = task.status || "open";
    node.querySelector(".task-type").textContent = presetLabel;
    node.querySelector(".task-number").textContent = taskNumber;
    node.querySelector(".task-title").textContent = formatTaskDisplayText(task.title);
    renderTaskDetail(node.querySelector(".task-detail"), task);
    node.querySelector(".task-author").textContent = `Posted by ${getTaskAuthorLabel(task)}`;
    node.querySelector(".task-time").textContent = formatTimestamp(task.createdAt);
    const editedTime = node.querySelector(".task-edited-time");
    const editedAuthor = node.querySelector(".task-edited-author");
    if (isMeaningfullyEdited(task)) {
        editedAuthor.textContent = `Edited by ${getTaskEditedByLabel(task)}`;
        editedTime.textContent = formatTimestamp(task.editedAt);
        editedAuthor.classList.remove("hidden");
        editedTime.classList.remove("hidden");
    }

    const indicatorWrap = node.querySelector(".task-indicator-wrap");
    const indicator = node.querySelector(".task-indicator");
    const menu = node.querySelector(".task-menu");
    const taskView = node.querySelector(".task-view");
    const editForm = node.querySelector(".edit-form");
    const editTitle = node.querySelector(".edit-title");
    const editDetail = node.querySelector(".edit-detail");
    const editTitleField = node.querySelector(".edit-title-field");
    const editDetailField = node.querySelector(".edit-detail-field");
    const editPresetFields = node.querySelector(".edit-preset-fields");
    const editButton = node.querySelector(".task-edit");
    const archiveButton = node.querySelector(".task-archive");
    const deleteButton = node.querySelector(".task-delete");
    const setDoingButton = node.querySelector(".task-set-doing");
    const setDoneButton = node.querySelector(".task-set-done");
    const cancelButton = node.querySelector(".edit-cancel");

    const isMiscTask = task.preset === "misc";
    const initialPresetValues = parseTaskDetailFieldValues(task, presetOption);
    const editValues = draft.fieldValues || initialPresetValues;

    editTitle.value = draft.title ?? task.title;
    editDetail.value = draft.detail ?? task.detail ?? "";
    editTitleField.classList.toggle("hidden", !isMiscTask);
    editDetailField.classList.toggle("hidden", !isMiscTask);
    editPresetFields.classList.toggle("hidden", isMiscTask);

    if (!isMiscTask) {
        const presetFields = getActiveExtraFields(presetOption);
        const renderEditPresetFields = values => {
            renderFieldControls(editPresetFields, presetFields, values, (nextValues, shouldRerender) => {
                state.taskEditDrafts[taskId] = {
                    ...(state.taskEditDrafts[taskId] || {}),
                    fieldValues: nextValues
                };
                if (shouldRerender) {
                    renderEditPresetFields(nextValues);
                }
            });
        };
        renderEditPresetFields(editValues);
    }

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

    const setTaskPanelMode = mode => {
        const showingMenu = mode === "menu";
        const showingEdit = mode === "edit";
        taskView.classList.toggle("hidden", showingMenu || showingEdit);
        menu.classList.toggle("hidden", !showingMenu);
        editForm.classList.toggle("hidden", !showingEdit);
        indicatorWrap.classList.toggle("is-open", showingMenu || showingEdit);
        indicator.setAttribute("aria-expanded", String(showingMenu || showingEdit));
    };

    const closeMenu = () => {
        if (state.openTaskMenuId === taskId) {
            state.openTaskMenuId = "";
        }
        indicatorWrap.classList.remove("is-open");
        menu.classList.add("hidden");
        indicator.setAttribute("aria-expanded", "false");
        if (state.editingTaskId !== taskId) {
            taskView.classList.remove("hidden");
        }
    };

    const openMenu = () => {
        closeOpenTaskMenus();
        state.openTaskMenuId = taskId;
        state.editingTaskId = "";
        setTaskPanelMode("menu");
    };

    editTitle.addEventListener("input", () => {
        state.taskEditDrafts[taskId] = {
            ...(state.taskEditDrafts[taskId] || {}),
            title: editTitle.value
        };
    });

    editDetail.addEventListener("input", () => {
        state.taskEditDrafts[taskId] = {
            ...(state.taskEditDrafts[taskId] || {}),
            detail: editDetail.value
        };
    });

    indicator.addEventListener("click", event => {
        event.stopPropagation();
        if (state.editingTaskId === taskId) {
            return;
        }
        if (state.openTaskMenuId !== taskId) {
            openMenu();
        } else {
            closeMenu();
        }
    });

    editButton.addEventListener("click", () => {
        state.openTaskMenuId = "";
        state.editingTaskId = taskId;
        state.taskEditDrafts[taskId] = isMiscTask
            ? {
                title: editTitle.value,
                detail: editDetail.value
            }
            : {
                fieldValues: getCurrentExtraFieldValues(editPresetFields)
            };
        setTaskPanelMode("edit");
    });

    cancelButton.addEventListener("click", () => {
        state.editingTaskId = "";
        delete state.taskEditDrafts[taskId];
        editTitle.value = task.title;
        editDetail.value = task.detail || "";
        setTaskPanelMode("");
    });

    editForm.addEventListener("submit", async event => {
        event.preventDefault();
        try {
            const patch = isMiscTask
                ? {
                    title: escapeText(editTitle.value) || task.title,
                    detail: escapeText(editDetail.value)
                }
                : {
                    title: presetLabel,
                    detail: buildTaskDetailFromFieldContainer(editPresetFields),
                    priority: getCurrentExtraFieldValues(editPresetFields).priority || task.priority || "Medium"
                };

            if (!patch.detail) {
                throw new Error(isMiscTask ? "Add a body before saving." : "Add at least one ticket detail before saving.");
            }

            await provider.updateTask(task.id, patch);
            state.editingTaskId = "";
            delete state.taskEditDrafts[taskId];
            setTaskPanelMode("");
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
            if (state.editingTaskId === taskId) {
                state.editingTaskId = "";
            }
            delete state.taskEditDrafts[taskId];
            closeMenu();
        } catch (error) {
            window.alert(error.message);
        }
    });

    if (isEditing) {
        setTaskPanelMode("edit");
    } else if (isMenuOpen) {
        setTaskPanelMode("menu");
    } else {
        setTaskPanelMode("");
    }

    return node;
}

function closeOpenTaskMenus() {
    state.openTaskMenuId = "";
    document.querySelectorAll(".task-indicator-wrap.is-open").forEach(wrapper => {
        wrapper.classList.remove("is-open");
    });
    document.querySelectorAll(".task-menu").forEach(menu => {
        menu.classList.add("hidden");
    });
    document.querySelectorAll(".task-card").forEach(card => {
        if (!card.querySelector(".edit-form:not(.hidden)")) {
            card.querySelector(".task-view")?.classList.remove("hidden");
        }
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

    async requestAccount() {
        throw new Error("Account requests require live Cloudflare mode.");
    }

    async listAccounts() {
        return [];
    }

    async updateAccountStatus() {
        throw new Error("Account management requires live Cloudflare mode.");
    }

    async deleteAccount() {
        throw new Error("Account management requires live Cloudflare mode.");
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
        this.tokenKey = "sw-worker-board:token";
        this.userKey = "sw-worker-board:user";
        this.legacyTokenKey = `sw-worker-board:${workerCode}:token`;
        this.legacyUserKey = `sw-worker-board:${workerCode}:user`;
        this.token = window.localStorage.getItem(this.tokenKey) || window.localStorage.getItem(this.legacyTokenKey) || "";
        this.user = this.readStoredUser();
    }

    readStoredUser() {
        const stored = window.localStorage.getItem(this.userKey) || window.localStorage.getItem(this.legacyUserKey);
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
        const previousToken = this.token;
        const previousUser = this.user ? JSON.stringify(this.user) : "";
        const nextUser = user || null;
        const nextUserValue = nextUser ? JSON.stringify(nextUser) : "";

        this.token = token || "";
        this.user = nextUser;

        if (this.token) {
            window.localStorage.setItem(this.tokenKey, this.token);
        } else {
            window.localStorage.removeItem(this.tokenKey);
            window.localStorage.removeItem(this.legacyTokenKey);
        }

        if (this.user) {
            window.localStorage.setItem(this.userKey, JSON.stringify(this.user));
        } else {
            window.localStorage.removeItem(this.userKey);
            window.localStorage.removeItem(this.legacyUserKey);
        }

        if (this.token !== previousToken || nextUserValue !== previousUser) {
            this.emitAuth();
        }
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
            if (response.status === 401 && options.auth) {
                this.setSession("", null);
            }
            throw new Error(payload?.error || "Request failed.");
        }
        return payload;
    }

    async validateSession() {
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

    async refresh() {
        try {
            const [tasksPayload, activityPayload] = await Promise.all([
                this.request(`/api/workers/${this.workerCode}/tasks`),
                this.request(`/api/workers/${this.workerCode}/activity`)
            ]);

            this.snapshot.tasks = tasksPayload?.tasks || [];
            this.snapshot.activity = activityPayload?.activity || null;
            this.emit();
        } finally {
            await this.validateSession();
        }
    }

    async init() {
        await this.validateSession();
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
            auth: true,
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

    async requestAccount(code, password) {
        return this.request("/api/accounts", {
            method: "POST",
            body: JSON.stringify({ code, password })
        });
    }

    async listAccounts() {
        const payload = await this.request("/api/accounts", {
            auth: true
        });
        return payload?.accounts || [];
    }

    async updateAccountStatus(code, status) {
        await this.request(`/api/accounts/${encodeURIComponent(code)}`, {
            method: "PATCH",
            auth: true,
            body: JSON.stringify({ status })
        });
    }

    async deleteAccount(code) {
        await this.request(`/api/accounts/${encodeURIComponent(code)}`, {
            method: "DELETE",
            auth: true
        });
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
    await hydrateWorkerConfigs();
    state.workerCode = getWorkerCodeFromUrl();
    state.workerConfig = appConfig.workers[state.workerCode];

    renderWorkerHeader();
    populatePresetOptions();
    populateBoardFilterOptions();
    wireSelectField(elements.presetSelect.closest(".field"), elements.presetSelect);
    wireSelectField(elements.boardSort.closest(".board-control"), elements.boardSort);
    wireSelectField(elements.boardFilter.closest(".board-control"), elements.boardFilter);
    wireHorizontalWheelScroll(elements.taskList);
    wireHorizontalWheelScroll(elements.doneList);

    const provider = await createProvider();
    provider.subscribe(snapshot => {
        state.tasks = snapshot.tasks || [];
        state.activity = snapshot.activity || null;
        renderActivity();
        renderTasks(provider);
        applyMorningDefaultActivity(provider);
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
        if (user) {
            stopPendingSignin();
        }
        loadCustomActivityButtons();
        if (!user?.isAdmin) {
            state.accounts = [];
        }
        renderAccountState();
        renderTasks(provider);
        refreshAccounts(provider, { silent: true });
        applyMorningDefaultActivity(provider);
    });

    elements.taskForm.addEventListener("submit", async event => {
        event.preventDefault();
        setStatusMessage(elements.submitStatus, "Posting...");

        try {
            if (!state.user) {
                throw new Error("Sign in before posting.");
            }

            const title = buildTaskTitle();

            const detailLines = getTaskDetailLines();
            if (!hasMeaningfulTaskDetail()) {
                setStatusMessage(
                    elements.submitStatus,
                    elements.presetSelect.value === "misc"
                        ? "Add a header and body before posting."
                        : "Add at least one ticket detail before posting.",
                    true
                );
                return;
            }

            await provider.addTask({
                preset: elements.presetSelect.value,
                title,
                priority: getExtraFieldValue("priority") || "Medium",
                detail: detailLines.join("\n"),
                author: getPostingAuthor()
            });

            elements.taskForm.reset();
            populatePresetOptions();
            setStatusMessage(elements.submitStatus, `Task posted to ${state.workerCode}.`);
            closeFab({ force: true });
        } catch (error) {
            setStatusMessage(elements.submitStatus, error.message, true);
        }
    });

    elements.fabToggle.addEventListener("click", event => {
        event.stopPropagation();
        if (Date.now() < suppressFabToggleUntil) {
            return;
        }
        setFabOpen(!elements.fabShell.classList.contains("is-open"));
    });

    elements.fabBack.addEventListener("click", event => {
        event.preventDefault();
        event.stopPropagation();
        closeFab();
    });

    elements.fabClear.addEventListener("click", () => {
        clearTaskDraft();
        setFabOpen(true);
        setFabHover(true);
    });

    elements.taskForm.addEventListener("input", updateFabDraftLock);

    elements.taskForm.addEventListener("change", updateFabDraftLock);

    elements.accountToggle.addEventListener("click", event => {
        event.stopPropagation();
        const mode = state.pendingSignin && !state.user ? "request" : "signin";
        const isSameOpen = !elements.accountPanel.classList.contains("hidden") && state.accountPanelMode === mode;
        setAccountPanelOpen(!isSameOpen, mode);
    });

    elements.accountRequestToggle.addEventListener("click", event => {
        event.stopPropagation();
        const isSameOpen = !elements.accountPanel.classList.contains("hidden") && state.accountPanelMode === "request";
        setAccountPanelOpen(!isSameOpen, "request");
    });

    elements.accountAdminToggle.addEventListener("click", event => {
        event.stopPropagation();
        const isSameOpen = !elements.accountPanel.classList.contains("hidden") && state.accountPanelMode === "admin";
        setAccountPanelOpen(!isSameOpen, "admin");
        if (isSameOpen) {
            return;
        }
        refreshAccounts(provider);
    });

    elements.accountPanelClose.addEventListener("click", event => {
        event.stopPropagation();
        setAccountPanelOpen(false);
    });

    elements.doneToggle.addEventListener("click", () => {
        setDoneDrawerOpen(!state.showingDone);
    });

    elements.archiveToggle.addEventListener("click", () => {
        setDoneDrawerOpen(false);
        setArchiveExpanded(true, provider);
    });

    elements.boardSort.addEventListener("change", () => {
        state.boardSort = elements.boardSort.value;
        renderTasks(provider);
    });

    elements.boardFilter.addEventListener("change", () => {
        state.boardFilter = elements.boardFilter.value;
        renderTasks(provider);
    });

    elements.boardExpand.addEventListener("click", () => {
        setBoardExpanded(!state.boardExpanded);
        renderTasks(provider);
    });

    elements.accountForm.addEventListener("submit", async event => {
        event.preventDefault();
        setStatusMessage(elements.accountStatus, "Signing in...");

        try {
            await provider.login(escapeText(elements.accountEmail.value), elements.accountPassword.value);
            elements.accountPassword.value = "";
            setStatusMessage(elements.accountStatus, "Signed in.");
        } catch (error) {
            const message = /not allowed|No account request found/i.test(error.message)
                ? "No account request found. Use Create account first, then wait for admin approval."
                : error.message;
            setStatusMessage(elements.accountStatus, message, true);
        }
    });

    elements.requestCode.addEventListener("input", () => {
        elements.requestCode.value = normalizeAccountCode(elements.requestCode.value);
    });

    elements.accountRequestForm.addEventListener("submit", async event => {
        event.preventDefault();
        const code = normalizeAccountCode(elements.requestCode.value);
        const password = elements.requestPassword.value;
        elements.requestCode.value = code;
        setStatusMessage(elements.requestStatus, "Sending request...");

        try {
            if (code.length !== 4) {
                throw new Error("Account code must be four letters.");
            }
            await provider.requestAccount(code, password);
            ensureWorkerConfig(code);
            renderWorkerHeader();
            await refreshWorkerHeader();
            setStatusMessage(elements.requestStatus, "Request sent. Waiting for approval...");
            startPendingSignin(provider, code, password);
        } catch (error) {
            setStatusMessage(elements.requestStatus, error.message, true);
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

    elements.accountAdminRefresh.addEventListener("click", () => {
        refreshAccounts(provider);
    });

    elements.accountAdminList.addEventListener("click", async event => {
        const button = event.target.closest("[data-account-code]");
        if (!button) {
            return;
        }

        const code = button.dataset.accountCode;
        const status = button.dataset.accountStatus;
        const action = button.dataset.accountAction;
        button.disabled = true;
        const actionLabel = action === "remove" ? "Removing" : (status === "approved" ? "Approving" : "Updating");
        setStatusMessage(elements.accountAdminStatus, `${actionLabel} ${code}...`);

        try {
            if (action === "remove") {
                await provider.deleteAccount(code);
                removeWorkerConfig(code);
            } else {
                await provider.updateAccountStatus(code, status);
            }
            await refreshWorkerHeader();
            if (action === "remove" || status === "rejected") {
                removeWorkerConfig(code);
            }
            await refreshAccounts(provider, { silent: true });
            setStatusMessage(elements.accountAdminStatus, action === "remove" ? `${code} removed.` : `${code} ${status}.`);
        } catch (error) {
            setStatusMessage(elements.accountAdminStatus, error.message, true);
            button.disabled = false;
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

    elements.customActivityButtons.addEventListener("click", async event => {
        const button = event.target.closest("[data-custom-activity-id]");
        if (!button) {
            return;
        }

        const customButton = state.customActivityButtons.find(item => item.id === button.dataset.customActivityId);
        if (!customButton) {
            return;
        }

        try {
            await applyQuickActivity(provider, customButton.title, customButton.detail);
        } catch (error) {
            window.alert(error.message);
        }
    });

    elements.customActivityAdd.addEventListener("click", () => {
        setCustomActivityPanelOpen(true);
    });

    elements.customActivityClose.addEventListener("click", () => {
        setCustomActivityPanelOpen(false);
    });

    elements.customActivityNew.addEventListener("click", startNewCustomActivity);

    elements.customActivityList.addEventListener("click", event => {
        const item = event.target.closest("[data-custom-edit-id]");
        if (item) {
            editCustomActivityButton(item.dataset.customEditId);
        }
    });

    elements.customActivityForm.addEventListener("submit", event => {
        event.preventDefault();
        const label = escapeText(elements.customButtonLabel.value).slice(0, 18);
        const title = escapeText(elements.customButtonTitle.value).slice(0, 80);
        const detail = escapeText(elements.customButtonDetail.value).slice(0, 180);
        const defaultMorning = Boolean(elements.customButtonDefaultMorning.checked);

        if (!label || !title) {
            setStatusMessage(elements.customActivityStatus, "Label and header are required.", true);
            return;
        }

        const nextButton = {
            id: state.editingCustomActivityId || crypto.randomUUID(),
            label,
            title,
            detail,
            defaultMorning
        };
        if (defaultMorning) {
            state.customActivityButtons = state.customActivityButtons.map(button => ({
                ...button,
                defaultMorning: button.id === nextButton.id
            }));
        }
        const existingIndex = state.customActivityButtons.findIndex(button => button.id === nextButton.id);
        if (existingIndex >= 0) {
            state.customActivityButtons.splice(existingIndex, 1, nextButton);
        } else {
            state.customActivityButtons.push(nextButton);
        }
        state.customActivityButtons = state.customActivityButtons.slice(-8);
        state.editingCustomActivityId = nextButton.id;
        saveCustomActivityButtons();
        renderCustomActivityButtons();
        editCustomActivityButton(nextButton.id);
        setStatusMessage(elements.customActivityStatus, "Button saved.");
    });

    elements.customActivitySetCurrent.addEventListener("click", async () => {
        const title = escapeText(elements.customButtonTitle.value).slice(0, 80);
        const detail = escapeText(elements.customButtonDetail.value).slice(0, 180);

        if (!title) {
            setStatusMessage(elements.customActivityStatus, "Header is required to set current.", true);
            return;
        }

        elements.customActivitySetCurrent.disabled = true;
        setStatusMessage(elements.customActivityStatus, "Setting current...");
        try {
            await applyQuickActivity(provider, title, detail);
            setStatusMessage(elements.customActivityStatus, "Current activity set.");
        } catch (error) {
            setStatusMessage(elements.customActivityStatus, error.message, true);
        } finally {
            elements.customActivitySetCurrent.disabled = false;
        }
    });

    elements.customActivityDelete.addEventListener("click", () => {
        if (!state.editingCustomActivityId) {
            return;
        }
        state.customActivityButtons = state.customActivityButtons.filter(button => button.id !== state.editingCustomActivityId);
        saveCustomActivityButtons();
        renderCustomActivityButtons();
        startNewCustomActivity();
        setStatusMessage(elements.customActivityStatus, "Button deleted.");
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
        if (!updateFabDraftLock()) {
            setFabHover(false);
        }
    });

    elements.fabPanel.addEventListener("click", event => {
        event.stopPropagation();
    });

    document.addEventListener("click", event => {
        if (!elements.fabShell.contains(event.target)) {
            closeFab();
        }
        if (!elements.accountPanel.contains(event.target) && !event.target.closest(".account-toolbar")) {
            setAccountPanelOpen(false);
        }
        if (!event.target.closest(".task-indicator-wrap")) {
            closeOpenTaskMenus();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            if (state.boardExpanded) {
                setBoardExpanded(false);
                renderTasks(provider);
            }
            closeFab();
            setAccountPanelOpen(false);
            closeOpenTaskMenus();
        }
    });

    setFabOpen(false);
    setFabHover(false);
    setAccountPanelOpen(false);
    setDoneDrawerOpen(false);
    setBoardExpanded(false);
    renderAccountState();
}

init().catch(error => {
    console.error(error);
    elements.taskList.innerHTML = "";
    elements.taskList.appendChild(createEmptyState("The worker board hit an error while loading."));
});
