document.addEventListener("DOMContentLoaded", function() {
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
    const isWorkerSearchPage = window.location.pathname.toLowerCase().includes("workersearch");
    const WORKER_SEARCH_PASSWORD = "swparts";
    const STOCK_DATA_URL = "data/stock-current.csv";
    let stockRowsPromise = null;
    let currentOrderNumber = "";

    function unlockWorkerSearch() {
        if (!isWorkerSearchPage) return true;
        if (sessionStorage.getItem("workerSearchUnlocked") === "true") return true;

        const enteredPassword = prompt("Enter worker search password:");

        if (enteredPassword === WORKER_SEARCH_PASSWORD) {
            sessionStorage.setItem("workerSearchUnlocked", "true");
            return true;
        }

        document.body.innerHTML = `
            <main class="password-denied">
                <h1 class="headed">Access denied</h1>
                <p class="medium">Refresh the page to try again.</p>
            </main>
        `;

        return false;
    }

    if (!unlockWorkerSearch()) {
        return;
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
        if (!isWorkerSearchPage) return [];

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
