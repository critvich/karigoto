document.addEventListener("DOMContentLoaded", async function() {
    const pages = document.querySelectorAll('.slider');
    let currentPage = 0;

    function updateTransforms() {
        pages.forEach((page, index) => {
            const offset = index - currentPage;
            page.style.transform = `translateX(${offset * 100}%)`;
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    document.querySelectorAll('.sidebarl').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetIndex = parseInt(link.getAttribute('data-target'), 10);
            if (!isNaN(targetIndex)) {
                currentPage = targetIndex;
                updateTransforms();
            }
        });
    });

    updateTransforms();

    window.addEventListener('load', () => {
        if (window.location.hash) {
            history.replaceState(null, null, ' ');
        }
    });

    requestAnimationFrame(() => {
        const base = document.querySelector('.base');
        if (base) {
            base.classList.add('ready');
        }
    });

    const copyElements = document.querySelectorAll(".copytext");
    copyElements.forEach(function(element) {
        element.addEventListener("click", function(event) {
            event.preventDefault();
            const textToCopy = this.getAttribute("data-target");
            if (!textToCopy) return;

            const textarea = document.createElement("textarea");
            textarea.value = textToCopy;
            document.body.appendChild(textarea);
            textarea.select();

            try {
                document.execCommand("copy");
                this.style.backgroundColor = "#131A23";
                setTimeout(() => {
                    this.style.backgroundColor = "";
                }, 200);
            } catch (err) {
                console.error("Failed to copy text: ", err);
            } finally {
                document.body.removeChild(textarea);
            }
        });
    });

    const fullscreenimage = document.querySelectorAll('.imgfs');
    const imhead = document.getElementById('imghead');

    fullscreenimage.forEach(image => {
        image.addEventListener('click', () => {
            const duplicate = image.cloneNode(true);
            const underlay = document.getElementById('imgund');

            duplicate.classList.add('fs');
            duplicate.classList.remove('images');

            document.body.appendChild(duplicate);

            if (underlay) {
                underlay.style.display = 'block';
            }

            duplicate.addEventListener('click', () => {
                document.body.removeChild(duplicate);
                if (underlay) underlay.style.display = 'none';
                if (imhead) imhead.style.display = 'none';
            });

            if (underlay) {
                underlay.addEventListener('click', () => {
                    if (document.body.contains(duplicate)) {
                        document.body.removeChild(duplicate);
                    }
                    underlay.style.display = 'none';
                    if (imhead) imhead.style.display = 'none';
                }, { once: true });
            }
        });
    });

    // =========================
    // Parts area
    // =========================

    const WORKER_BASE = "https://swpartfetch.bbourne1104.workers.dev";
    const FALLBACK_IMAGE_PATTERNS = [
        "/image/getthumbnail/1017"
    ];
    const partsList = document.getElementById("parts-list");
    const addPartRowButton = document.getElementById("add-part-row");
    const xmlUploadInput = document.getElementById("xml-upload");
    const downloadQrPdfButton = document.getElementById("download-qr-pdf");
    const signedOutNote = document.getElementById("signed-out-note");
    const authOnlyElements = Array.from(document.querySelectorAll(".auth-only"));
    const isWorkerSearchPage = window.location.pathname.toLowerCase().includes("workersearch");
    const STOCK_DATA_URL = "data/stock-current.csv";
    const boardConfig = window.SW_WORKER_BOARD_CONFIG || {};
    const workerCode = boardConfig.defaultWorker || "BRBO";
    const apiBaseUrl = (boardConfig.apiBaseUrl || "").replace(/\/+$/, "");
    const authState = {
        tokenKey: `sw-worker-board:${workerCode}:token`,
        userKey: `sw-worker-board:${workerCode}:user`,
        token: "",
        user: null,
        panelMode: "signin"
    };
    let stockRowsPromise = null;
    let currentOrderNumber = "";

    const accountElements = {
        toggle: document.getElementById("account-toggle"),
        requestToggle: document.getElementById("account-request-toggle"),
        panel: document.getElementById("account-panel"),
        summary: document.getElementById("account-summary"),
        form: document.getElementById("account-form"),
        email: document.getElementById("account-email"),
        password: document.getElementById("account-password"),
        submit: document.getElementById("account-submit"),
        signout: document.getElementById("account-signout"),
        status: document.getElementById("account-status"),
        requestForm: document.getElementById("account-request-form"),
        requestCode: document.getElementById("request-code"),
        requestPassword: document.getElementById("request-password"),
        requestSubmit: document.getElementById("request-submit"),
        requestStatus: document.getElementById("request-status")
    };

    function setStatusMessage(element, message, isError = false) {
        if (!element) return;
        element.textContent = message;
        element.style.color = isError ? "var(--danger)" : "var(--muted)";
    }

    function normalizeAccountCode(value) {
        return String(value || "").trim().toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
    }

    function readStoredUser() {
        try {
            return JSON.parse(localStorage.getItem(authState.userKey) || "null");
        } catch {
            return null;
        }
    }

    function setSession(token, user) {
        authState.token = token || "";
        authState.user = user || null;

        if (authState.token) {
            localStorage.setItem(authState.tokenKey, authState.token);
        } else {
            localStorage.removeItem(authState.tokenKey);
        }

        if (authState.user) {
            localStorage.setItem(authState.userKey, JSON.stringify(authState.user));
        } else {
            localStorage.removeItem(authState.userKey);
        }

        renderAccountState();
        reloadLoadedPartRows();
    }

    async function boardRequest(path, options = {}) {
        if (!apiBaseUrl) {
            throw new Error("Account sign in requires live board API config.");
        }

        const headers = {
            "Content-Type": "application/json",
            ...(options.headers || {})
        };

        if (options.auth && authState.token) {
            headers.Authorization = `Bearer ${authState.token}`;
        }

        const response = await fetch(`${apiBaseUrl}${path}`, {
            ...options,
            headers
        });

        const payload = response.status === 204 ? null : await response.json().catch(() => null);
        if (!response.ok) {
            throw new Error(payload?.error || "Request failed.");
        }

        return payload;
    }

    async function initAccountSession() {
        authState.token = localStorage.getItem(authState.tokenKey) || "";
        authState.user = readStoredUser();
        renderAccountState();

        if (!authState.token) {
            return;
        }

        try {
            const session = await boardRequest("/api/session", { auth: true });
            if (session?.user) {
                setSession(authState.token, session.user);
            } else {
                setSession("", null);
            }
        } catch {
            setSession("", null);
        }
    }

    function setAccountPanelMode(mode) {
        authState.panelMode = mode;
        accountElements.form?.classList.toggle("hidden", mode !== "signin");
        accountElements.requestForm?.classList.toggle("hidden", mode !== "request");
        if (!authState.user && accountElements.summary) {
            accountElements.summary.textContent = mode === "request"
                ? "Request access with your 4 letter code."
                : "Not signed in";
        }
    }

    function setAccountPanelOpen(isOpen, mode = authState.panelMode) {
        if (isOpen) {
            setAccountPanelMode(mode);
        }
        accountElements.panel?.classList.toggle("hidden", !isOpen);
        accountElements.toggle?.setAttribute("aria-expanded", String(isOpen && mode === "signin"));
        accountElements.requestToggle?.setAttribute("aria-expanded", String(isOpen && mode === "request"));
    }

    function renderAccountState() {
        if (!accountElements.toggle) return;

        const signedIn = Boolean(authState.user);
        authOnlyElements.forEach(element => {
            element.classList.toggle("hidden", !signedIn);
        });
        if (signedOutNote) {
            signedOutNote.textContent = signedIn
                ? "Each row can load a part image, portal link, and current stock locations."
                : "Each row can load a part image and portal link.";
        }
        accountElements.toggle.textContent = signedIn ? "Account" : "Sign in";
        accountElements.requestToggle?.classList.toggle("hidden", signedIn);
        if (accountElements.summary) {
            accountElements.summary.textContent = signedIn
                ? `Signed in as ${authState.user.user || "account"}`
                : (authState.panelMode === "request" ? "Request access with your 4 letter code." : "Not signed in");
        }
        if (accountElements.email) accountElements.email.disabled = signedIn;
        if (accountElements.password) accountElements.password.disabled = signedIn;
        if (accountElements.submit) accountElements.submit.disabled = signedIn;
        accountElements.signout?.classList.toggle("hidden", !signedIn);
        if (signedIn && authState.panelMode === "request") {
            authState.panelMode = "signin";
        }
        setAccountPanelMode(authState.panelMode);
    }

    async function fetchPart(partNumber) {
        const apiUrl = `${WORKER_BASE}/?part=${encodeURIComponent(partNumber)}`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
    }

    function isFallbackImageUrl(imageUrl = "") {
        return FALLBACK_IMAGE_PATTERNS.some(pattern => imageUrl.includes(pattern));
    }

    function escapeHtml(value = "") {
        const decodedValue = String(value)
            .replace(/&quot;|&#34;/g, '"')
            .replace(/&#039;|&#39;|&apos;/g, "'")
            .replace(/&amp;/g, "&");

        return decodedValue
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&#34;")
            .replaceAll("'", "&#039;");
    }

    function parseCsvLine(line) {
        const values = [];
        let currentValue = "";
        let isInsideQuotes = false;

        for (let index = 0; index < line.length; index += 1) {
            const character = line[index];
            const nextCharacter = line[index + 1];

            if (character === '"' && isInsideQuotes && nextCharacter === '"') {
                currentValue += '"';
                index += 1;
            } else if (character === '"') {
                isInsideQuotes = !isInsideQuotes;
            } else if (character === "," && !isInsideQuotes) {
                values.push(currentValue);
                currentValue = "";
            } else {
                currentValue += character;
            }
        }

        values.push(currentValue);
        return values;
    }

    function parseStockCsv(csvText) {
        const lines = csvText
            .replace(/^\uFEFF/, "")
            .split(/\r?\n/)
            .filter(line => line.trim());

        if (lines.length < 2) return [];

        const headers = parseCsvLine(lines[0]).map(header => header.trim());

        return lines.slice(1).map(line => {
            const values = parseCsvLine(line);
            const row = headers.reduce((record, header, index) => {
                record[header] = values[index]?.trim() || "";
                return record;
            }, {});

            return {
                partNumber: row["Part number"].toUpperCase(),
                partName: row["Part name"],
                location: row.Location,
                balance: row.Balance
            };
        }).filter(row => row.partNumber);
    }

    async function fetchStockRows() {
        if (!stockRowsPromise) {
            stockRowsPromise = fetch(STOCK_DATA_URL)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`Stock data error: ${response.status}`);
                    }

                    return response.text();
                })
                .then(parseStockCsv);
        }

        return stockRowsPromise;
    }

    async function fetchStockRowsForPart(partNumber) {
        if (!isWorkerSearchPage || !authState.user) return [];

        const normalizedPartNumber = partNumber.trim().toUpperCase();
        let rows = [];

        try {
            rows = await fetchStockRows();
        } catch (error) {
            console.error(error);
            return [];
        }

        return rows.filter(row => row.partNumber === normalizedPartNumber);
    }

    async function openQrPdfForCurrentLink() {
        const currentUrl = window.location.href;
        const QRCodeLib = window.QRCode;
        const jsPDFLib = window.jspdf?.jsPDF;

        if (!QRCodeLib || !jsPDFLib) {
            alert("QR/PDF tools failed to load.");
            return;
        }

        const qrContainer = document.createElement("div");
        qrContainer.style.position = "fixed";
        qrContainer.style.left = "-9999px";
        qrContainer.style.top = "0";
        document.body.appendChild(qrContainer);

        const qrCode = new QRCodeLib(qrContainer, {
            text: currentUrl,
            typeNumber: 0,
            width: 900,
            height: 900,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCodeLib.CorrectLevel.L
        });

        await new Promise(resolve => requestAnimationFrame(resolve));

        const qrCanvas = qrContainer.querySelector("canvas");
        const qrImage = qrContainer.querySelector("img");
        const qrDataUrl = qrCanvas
            ? qrCanvas.toDataURL("image/png")
            : qrImage?.src;

        document.body.removeChild(qrContainer);

        if (!qrDataUrl) {
            throw new Error("QR code image could not be created.");
        }

        const pdf = new jsPDFLib({
            orientation: "portrait",
            unit: "pt",
            format: "letter"
        });

        pdf.addImage(qrDataUrl, "PNG", 126, 90, 360, 360);

        if (currentOrderNumber) {
            pdf.setFont("helvetica", "normal");
            pdf.setFontSize(14);
            pdf.text(`Order number: ${currentOrderNumber}`, 306, 485, { align: "center" });
        }

        const pdfBlob = pdf.output("blob");
        const pdfUrl = URL.createObjectURL(pdfBlob);
        window.open(pdfUrl, "_blank", "noopener,noreferrer");

        setTimeout(() => {
            URL.revokeObjectURL(pdfUrl);
        }, 60000);
    }

    function renderStockDetails(stockRows) {
        if (!isWorkerSearchPage) return "";

        if (!authState.user) {
            return "";
        }

        if (stockRows.length === 0) {
            return `<p class="medium"><strong>Stock:</strong> No location/balance found.</p>`;
        }

        const totalBalance = stockRows.reduce((sum, row) => {
            const balance = Number(row.balance);
            return Number.isFinite(balance) ? sum + balance : sum;
        }, 0);

        const stockRowsHtml = stockRows
            .map(row => `
                <tr>
                    <td>${escapeHtml(row.location || "N/A")}</td>
                    <td>${escapeHtml(row.balance ?? "N/A")}</td>
                </tr>
            `)
            .join("");

        return `
            <div class="stock-details">
                <h3 class="seconded">Stock Locations</h3>
                <p class="medium"><strong>Total Balance:</strong> ${escapeHtml(totalBalance)}</p>
                <table class="stock-table">
                    <thead>
                        <tr>
                            <th>Location</th>
                            <th>Balance</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${stockRowsHtml}
                    </tbody>
                </table>
            </div>
        `;
    }

    function renderPart(resultEl, part, stockRows = []) {
        const hasRealImage = part.imageUrl && !isFallbackImageUrl(part.imageUrl);
        const imageHtml = hasRealImage
            ? `<div class="cropboxwide"><img src="${escapeHtml(part.imageUrl)}" alt="${escapeHtml(part.name || "Part image")}" class="part-image images imgfs"></div>`
            : `<p class="medium">No image available</p>`;
        const infoHtml = `
            <div class="part-info">
                <h2 class="seconded">${escapeHtml(part.name || "Unknown part")}</h2>
                <p class="medium"><strong>Part #:</strong> ${escapeHtml(part.partNumber || "N/A")}</p>
                ${renderStockDetails(stockRows)}
                <p class="medium">
                    <a href="${escapeHtml(part.sourceUrl)}" target="_blank" rel="noopener noreferrer" class="linkl">View portal page</a>
                </p>
            </div>
        `;

        resultEl.innerHTML = `<div class="part-search-layout">${imageHtml}${infoHtml}</div>`;

        const image = resultEl.querySelector('.imgfs');
        if (!image) return;

        image.addEventListener('click', () => {
            const duplicate = image.cloneNode(true);
            const underlay = document.getElementById('imgund');

            duplicate.classList.add('fs');
            duplicate.classList.remove('images');

            document.body.appendChild(duplicate);

            if (underlay) {
                underlay.style.display = 'block';
            }

            duplicate.addEventListener('click', () => {
                document.body.removeChild(duplicate);
                if (underlay) underlay.style.display = 'none';
                if (imhead) imhead.style.display = 'none';
            });

            if (underlay) {
                underlay.addEventListener('click', () => {
                    if (document.body.contains(duplicate)) {
                        document.body.removeChild(duplicate);
                    }
                    underlay.style.display = 'none';
                    if (imhead) imhead.style.display = 'none';
                }, { once: true });
            }
        });
    }

    function getAllPartValues() {
        return Array.from(document.querySelectorAll(".part-input"))
            .map(input => input.value.trim())
            .filter(Boolean);
    }

    function updatePartsInUrl() {
        const values = getAllPartValues();
        const url = new URL(window.location.href);

        if (values.length > 0) {
            url.searchParams.set("parts", values.join(","));
        } else {
            url.searchParams.delete("parts");
        }

        history.replaceState({}, "", url.toString());
    }

    async function loadPartIntoRow(partNumber, resultEl) {
        resultEl.innerHTML = `<p class="medium">Loading part...</p>`;

        try {
            const [part, stockRows] = await Promise.all([
                fetchPart(partNumber),
                fetchStockRowsForPart(partNumber)
            ]);
            renderPart(resultEl, part, stockRows);
        } catch (error) {
            console.error(error);
            resultEl.innerHTML = `<p class="medium">Failed to load part data.</p>`;
        }
    }

    function createPartRow(initialValue = "") {
        if (!partsList) return null;

        const row = document.createElement("div");
        row.className = "content part-row";

        row.innerHTML = `
            <div class="part-row-controls">
                <input
                    type="text"
                    class="part-input"
                    placeholder="Enter Steelwrist part number"
                    value="${initialValue}"
                >
                <button type="button" class="part-load-btn">Load</button>
                <button type="button" class="part-remove-btn">Remove</button>
            </div>
            <div class="smallspacer"></div>
            <div class="part-result">
                <p class="medium">Enter a part number and click Load.</p>
            </div>
        `;

        const input = row.querySelector(".part-input");
        const loadBtn = row.querySelector(".part-load-btn");
        const removeBtn = row.querySelector(".part-remove-btn");
        const resultEl = row.querySelector(".part-result");

        async function loadCurrentRow() {
            const value = input.value.trim().toUpperCase();

            if (!value) {
                resultEl.innerHTML = `<p class="medium">Please enter a part number.</p>`;
                updatePartsInUrl();
                return;
            }

            input.value = value;
            await loadPartIntoRow(value, resultEl);
            updatePartsInUrl();
        }

        loadBtn.addEventListener("click", loadCurrentRow);

        input.addEventListener("keydown", function(event) {
            if (event.key === "Enter") {
                event.preventDefault();
                loadCurrentRow();
            }
        });

        input.addEventListener("change", function() {
            input.value = input.value.trim().toUpperCase();
            updatePartsInUrl();
        });

        removeBtn.addEventListener("click", function() {
            row.remove();
            updatePartsInUrl();
        });

        partsList.appendChild(row);
        return { row, input, loadCurrentRow, resultEl };
    }

    function reloadLoadedPartRows() {
        if (!partsList) return;

        Array.from(partsList.querySelectorAll(".part-row")).forEach(row => {
            const input = row.querySelector(".part-input");
            const resultEl = row.querySelector(".part-result");
            const value = input?.value.trim().toUpperCase();

            if (value && resultEl && !resultEl.textContent.includes("Enter a part number")) {
                loadPartIntoRow(value, resultEl);
            }
        });
    }

    function clearAllRows() {
        if (partsList) {
            partsList.innerHTML = "";
        }
        updatePartsInUrl();
    }

    function storeOrderNumber(orderNumber = "") {
        currentOrderNumber = orderNumber;

        if (partsList) {
            if (orderNumber) {
                partsList.dataset.orderNumber = orderNumber;
            } else {
                delete partsList.dataset.orderNumber;
            }
        }
    }

    function getFirstTextContent(xmlDoc, selectors) {
        for (const selector of selectors) {
            const node = xmlDoc.querySelector(selector);
            const value = node?.textContent?.trim();

            if (value) {
                return value;
            }
        }

        return "";
    }

    function getFirstAttributeValue(xmlDoc, selectors, attributeName) {
        for (const selector of selectors) {
            const node = xmlDoc.querySelector(selector);
            const value = node?.getAttribute(attributeName)?.trim();

            if (value) {
                return value;
            }
        }

        return "";
    }

    function extractOrderNumberFromXml(xmlDoc) {
        const textSelectors = [
            "SupplierOrderNumber",
            "OrderNumber",
            "OrderNo",
            "Order_No",
            "DocumentNumber",
            "DocumentNo",
            "SalesOrder",
            "SalesOrderNumber",
            "CustomerOrderNumber",
            "CustomerOrderNo",
            "Header > OrderNumber",
            "Header > DocumentNumber",
            "Order > Number",
            "Document > Number"
        ];

        const directValue = getFirstTextContent(xmlDoc, textSelectors);
        if (directValue) {
            return directValue;
        }

        const attributeSelectors = [
            "OrderResponse",
            "Order",
            "Header",
            "Document",
            "OrderHeader",
            "Rows"
        ];

        const attributeNames = [
            "OrderNumber",
            "OrderNo",
            "DocumentNumber",
            "DocumentNo",
            "SalesOrder",
            "CustomerOrderNumber"
        ];

        for (const attributeName of attributeNames) {
            const attributeValue = getFirstAttributeValue(xmlDoc, attributeSelectors, attributeName);
            if (attributeValue) {
                return attributeValue;
            }
        }

        return "";
    }

    function parsePartsFromXml(xmlText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlText, "application/xml");

        const parserError = xmlDoc.querySelector("parsererror");
        if (parserError) {
            throw new Error("Invalid XML file.");
        }

        const orderNumber = extractOrderNumberFromXml(xmlDoc);
        const rows = Array.from(xmlDoc.querySelectorAll("Rows > Row"));
        const parts = [];

        for (const row of rows) {
            const rowType = row.getAttribute("RowType") || "";
            const partType = row.querySelector("PartType")?.textContent?.trim() || "";
            const partNode = row.querySelector("Part");
            const partNumber = partNode?.getAttribute("PartNumber")?.trim() || "";
            const text = row.querySelector("Text")?.textContent?.trim() || "";
            const quantity = row.querySelector("Quantity")?.textContent?.trim() || "";

            if (rowType !== "1") continue;
            if (partType === "5") continue;
            if (!partNumber) continue;
            if (partNumber === "S") continue;
            if (text.toLowerCase().includes("fedex")) continue;

            parts.push({
                partNumber: partNumber.toUpperCase(),
                text,
                quantity
            });
        }

        return {
            orderNumber,
            parts
        };
    }

    async function loadPartsFromXmlFile(file) {
        if (!file) return;

        const xmlText = await file.text();
        const { orderNumber, parts } = parsePartsFromXml(xmlText);

        if (parts.length === 0) {
            alert("No valid part rows were found in the XML.");
            return;
        }

        storeOrderNumber(orderNumber);
        clearAllRows();

        for (const part of parts) {
            const rowObj = createPartRow(part.partNumber);
            if (rowObj) {
                await rowObj.loadCurrentRow();
            }
        }

        updatePartsInUrl();
    }

    function loadRowsFromUrl() {
        storeOrderNumber("");

        const url = new URL(window.location.href);
        const partsParam = url.searchParams.get("parts");

        if (!partsParam) {
            createPartRow();
            return;
        }

        const partValues = partsParam
            .split(",")
            .map(value => value.trim().toUpperCase())
            .filter(Boolean);

        if (partValues.length === 0) {
            createPartRow();
            return;
        }

        partValues.forEach(value => {
            const rowObj = createPartRow(value);
            if (rowObj) {
                rowObj.loadCurrentRow();
            }
        });
    }

    await initAccountSession();

    if (accountElements.toggle) {
        accountElements.toggle.addEventListener("click", event => {
            event.stopPropagation();
            const isSameOpen = !accountElements.panel.classList.contains("hidden") && authState.panelMode === "signin";
            setAccountPanelOpen(!isSameOpen, "signin");
        });
    }

    if (accountElements.requestToggle) {
        accountElements.requestToggle.addEventListener("click", event => {
            event.stopPropagation();
            const isSameOpen = !accountElements.panel.classList.contains("hidden") && authState.panelMode === "request";
            setAccountPanelOpen(!isSameOpen, "request");
        });
    }

    if (accountElements.form) {
        accountElements.form.addEventListener("submit", async event => {
            event.preventDefault();
            setStatusMessage(accountElements.status, "Signing in...");

            try {
                const payload = await boardRequest("/api/login", {
                    method: "POST",
                    body: JSON.stringify({
                        user: String(accountElements.email.value || "").trim(),
                        password: accountElements.password.value,
                        workerCode
                    })
                });
                accountElements.password.value = "";
                setSession(payload?.token || "", payload?.user || null);
                setStatusMessage(accountElements.status, "Signed in.");
            } catch (error) {
                setStatusMessage(accountElements.status, error.message, true);
            }
        });
    }

    if (accountElements.requestCode) {
        accountElements.requestCode.addEventListener("input", () => {
            accountElements.requestCode.value = normalizeAccountCode(accountElements.requestCode.value);
        });
    }

    if (accountElements.requestForm) {
        accountElements.requestForm.addEventListener("submit", async event => {
            event.preventDefault();
            const code = normalizeAccountCode(accountElements.requestCode.value);
            accountElements.requestCode.value = code;
            setStatusMessage(accountElements.requestStatus, "Sending request...");

            try {
                if (code.length !== 4) {
                    throw new Error("Account code must be four letters.");
                }
                await boardRequest("/api/accounts", {
                    method: "POST",
                    body: JSON.stringify({
                        code,
                        password: accountElements.requestPassword.value
                    })
                });
                accountElements.requestPassword.value = "";
                setStatusMessage(accountElements.requestStatus, "Request sent. It will stay pending until admin approval.");
            } catch (error) {
                setStatusMessage(accountElements.requestStatus, error.message, true);
            }
        });
    }

    if (accountElements.signout) {
        accountElements.signout.addEventListener("click", async () => {
            setStatusMessage(accountElements.status, "Signing out...");
            setSession("", null);
            setStatusMessage(accountElements.status, "Signed out.");
        });
    }

    document.addEventListener("click", event => {
        if (accountElements.panel && !accountElements.panel.contains(event.target) && !event.target.closest(".account-toolbar")) {
            setAccountPanelOpen(false);
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            setAccountPanelOpen(false);
        }
    });

    if (addPartRowButton) {
        addPartRowButton.addEventListener("click", function() {
            createPartRow();
        });
    }

    if (xmlUploadInput) {
        xmlUploadInput.addEventListener("change", async function(event) {
            const file = event.target.files?.[0];
            if (!file) return;

            try {
                await loadPartsFromXmlFile(file);
            } catch (error) {
                console.error(error);
                alert("Failed to read XML file.");
            }

            event.target.value = "";
        });
    }

    if (downloadQrPdfButton) {
        downloadQrPdfButton.addEventListener("click", async function() {
            try {
                await openQrPdfForCurrentLink();
            } catch (error) {
                console.error(error);
                alert("Failed to create QR PDF.");
            }
        });
    }

    if (partsList) {
        loadRowsFromUrl();
    }
});
