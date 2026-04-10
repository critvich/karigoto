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
    const partsList = document.getElementById("parts-list");
    const addPartRowButton = document.getElementById("add-part-row");
    const xmlUploadInput = document.getElementById("xml-upload");
    const downloadQrPdfButton = document.getElementById("download-qr-pdf");
    let currentOrderNumber = "";

    async function fetchPart(partNumber) {
        const apiUrl = `${WORKER_BASE}/?part=${encodeURIComponent(partNumber)}`;
        const response = await fetch(apiUrl);

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        return await response.json();
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
            width: 900,
            height: 900,
            colorDark: "#000000",
            colorLight: "#ffffff",
            correctLevel: QRCodeLib.CorrectLevel.H
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

    function renderPart(resultEl, part) {
        resultEl.innerHTML = `
            ${part.imageUrl ? `<div class="cropboxwide"><img src="${part.imageUrl}" alt="${part.name || "Part image"}" class="part-image images imgfs"></div>` : ""}
            <h2 class="seconded">${part.name || "Unknown part"}</h2>
            <p class="medium"><strong>Part #:</strong> ${part.partNumber || "N/A"}</p>
            <p class="medium">
                <a href="${part.sourceUrl}" target="_blank" rel="noopener noreferrer">View source page</a>
            </p>
        `;

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
            const part = await fetchPart(partNumber);
            renderPart(resultEl, part);
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
