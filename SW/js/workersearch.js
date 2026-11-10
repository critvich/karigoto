import { parseStockCsv, parsePartsFromXml, normalizePartNumber, findStockRows, stockBalance, buildPartsUrl } from "./workersearch-data.js?v=20261110-1";

const PART_API = "https://swpartfetch.bbourne1104.workers.dev";
const list = document.getElementById("parts-list");
const pageStatus = document.getElementById("page-status");
const fileInput = document.getElementById("xml-upload");
const pdfButton = document.getElementById("download-qr-pdf");
const dialog = document.getElementById("image-dialog");
let nextRowId = 0;
let orderNumber = new URL(location.href).searchParams.get("order") || "";
let stockPromise;
let importRevision = 0;
const formatQuantity = value => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(value);
const arrow = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M7 17 17 7M7 7h10v10"/></svg>';

function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function safeUrl(value) {
    try {
        const url = new URL(value);
        return ["https:", "http:"].includes(url.protocol) ? url.href : "";
    } catch { return ""; }
}

function setPageStatus(message, error = false) {
    pageStatus.textContent = message;
    pageStatus.classList.toggle("is-error", error);
}

function values(type) {
    return [...list.children].filter(row => !type || row.querySelector(".lookup-kind").value === type)
        .map(row => normalizePartNumber(row.querySelector(".part-input").value)).filter(Boolean);
}

function shareUrl() {
    return buildPartsUrl(location.href, values("part"), orderNumber, values("serial"));
}

function updateList() {
    const rows = [...list.children];
    rows.forEach((row, index) => {
        row.querySelector(".row-number").textContent = String(index + 1).padStart(2, "0");
        row.querySelector(".part-remove-btn").setAttribute("aria-label", `Remove lookup ${index + 1}`);
        row.querySelector(".lookup-kind").setAttribute("aria-label", `Search type ${index + 1}`);
        row.querySelector(".part-input").setAttribute("aria-label", `${row.querySelector(".lookup-kind").value === "serial" ? "Serial" : "Part"} number ${index + 1}`);
    });
    document.getElementById("parts-count").textContent = `${rows.length} ${rows.length === 1 ? "lookup" : "lookups"}`;
    document.getElementById("empty-list").hidden = rows.length > 0;
    const orderSummary = document.getElementById("order-summary");
    orderSummary.textContent = orderNumber ? `Order ${orderNumber}` : "";
    orderSummary.hidden = !orderNumber;
    pdfButton.disabled = values().length === 0;
    history.replaceState(null, "", shareUrl());
}

async function stockRows() {
    if (!stockPromise) {
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 10000);
        stockPromise = fetch("data/stock-current.csv?v=20261110-1", { signal: controller.signal }).then(response => {
            if (!response.ok) throw new Error("Stock file unavailable");
            return response.text();
        }).then(parseStockCsv).finally(() => window.clearTimeout(timeout)).catch(error => { stockPromise = null; throw error; });
    }
    return stockPromise;
}

function stockHtml(rows, unavailable) {
    if (unavailable) return '<p class="row-status">Stock data is temporarily unavailable. Search again to retry.</p>';
    if (!rows.length) return '<p class="row-status">No location found in the current stock file.</p>';
    const serialized = rows.some(row => row.serialNumber);
    return `<table class="stock-table"><caption class="visually-hidden">Stock locations, ${serialized ? "serial numbers, and " : ""}balances</caption>
        <thead><tr><th scope="col">Location</th>${serialized ? '<th scope="col">Serial number</th>' : ""}<th scope="col">Balance</th></tr></thead>
        <tbody>${rows.map(row => `<tr><td>${escapeHtml(row.location || "Not listed")}</td>${serialized ? `<td class="serial-number">${escapeHtml(row.serialNumber || "—")}</td>` : ""}<td>${escapeHtml(row.balance)}</td></tr>`).join("")}</tbody>
        <tfoot><tr><th scope="row"${serialized ? ' colspan="2"' : ""}>Total</th><td>${formatQuantity(stockBalance(rows))}</td></tr></tfoot></table>`;
}

function renderPart(result, part, number, rows, stockUnavailable) {
    const imageUrl = safeUrl(part.imageUrl);
    const sourceUrl = safeUrl(part.sourceUrl);
    const name = part.name || rows[0]?.partName;
    const imageAvailable = imageUrl && !imageUrl.includes("/image/getthumbnail/1017");
    const imageHtml = imageAvailable
        ? `<button class="part-image-button" type="button" aria-label="Enlarge image of ${escapeHtml(name || number)}"><img class="part-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(name || number)}" loading="lazy"></button>`
        : "";
    result.innerHTML = `<div class="part-search-layout${imageAvailable ? "" : " no-photo"}">${imageHtml}
        <div class="part-info"><h3>${escapeHtml(name || "Part not found")}</h3><p class="part-number">${escapeHtml(part.partNumber || number)}</p>
        ${!imageAvailable ? '<p class="image-note">No image available</p>' : ""}
        ${!name ? '<p class="row-status">Check the part number and search again.</p>' : ""}
        ${sourceUrl ? `<a class="portal-link" href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">View in portal ${arrow}</a>` : ""}</div>
        <div>${stockHtml(rows, stockUnavailable)}</div></div>`;
    const imageButton = result.querySelector(".part-image-button");
    if (imageButton) {
        imageButton.querySelector("img").addEventListener("error", () => {
            result.querySelector(".part-search-layout").classList.add("no-photo");
            const fallback = document.createElement("p");
            fallback.className = "image-note";
            fallback.textContent = "Image unavailable";
            result.querySelector(".part-info").append(fallback);
            imageButton.remove();
        }, { once: true });
        imageButton.addEventListener("click", () => {
            const expanded = document.getElementById("expanded-image");
            expanded.src = imageUrl;
            expanded.alt = name || number;
            dialog.showModal();
        });
    }
}

function createRow(initialValue = "", focus = false, initialType = "part") {
    const id = `part-${++nextRowId}`;
    const row = document.createElement("article");
    row.className = "part-row";
    row.innerHTML = `<form class="part-row-controls"><span class="row-number" aria-hidden="true"></span>
        <label for="${id}-kind" class="visually-hidden">Search by</label><select id="${id}-kind" class="lookup-kind"><option value="part">Part number</option><option value="serial">Serial number</option></select>
        <input id="${id}" class="part-input" type="text" placeholder="e.g. 100009" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="120" aria-describedby="${id}-result">
        <button class="button button-primary part-load-btn" type="submit" disabled>Search</button>
        <button class="part-remove-btn" type="button">Remove</button></form>
        <div id="${id}-result" class="part-result"><p class="row-status" role="status">Enter a part number to load its details.</p></div>`;
    const input = row.querySelector("input");
    const kind = row.querySelector(".lookup-kind");
    kind.value = initialType;
    input.placeholder = kind.value === "serial" ? "e.g. M409669" : "e.g. 100009";
    const button = row.querySelector(".part-load-btn");
    const result = row.querySelector(".part-result");
    input.value = normalizePartNumber(initialValue);
    let requestRevision = 0;
    let controller;
    let loadedNumber = "";
    const emptyMessage = () => `Enter a ${kind.value === "serial" ? "serial" : "part"} number to load its details.`;
    result.querySelector(".row-status").textContent = emptyMessage();

    function cancel() {
        ++requestRevision;
        controller?.abort();
        result.setAttribute("aria-busy", "false");
        button.textContent = "Search";
        button.disabled = !normalizePartNumber(input.value);
    }

    async function search() {
        cancel();
        if (!row.isConnected) return;
        const revision = requestRevision;
        const number = normalizePartNumber(input.value);
        const type = kind.value;
        if (!number) {
            input.setAttribute("aria-invalid", "true");
            input.focus();
            return;
        }
        input.value = number;
        input.removeAttribute("aria-invalid");
        updateList();
        controller = new AbortController();
        const requestController = controller;
        let timedOut = false;
        const timeout = window.setTimeout(() => { timedOut = true; requestController.abort(); }, 25000);
        button.disabled = true;
        button.textContent = "Searching...";
        result.setAttribute("aria-busy", "true");
        result.innerHTML = '<p class="row-status" role="status">Loading details...</p>';
        // Stock failure must not hide otherwise valid part details.
        const stockTask = stockRows().then(data => ({ rows: findStockRows(data, number, type), unavailable: false }), () => ({ rows: [], unavailable: true }));
        try {
            // Serial numbers map to inventory parts, never to the part-number API directly.
            const fetchPart = async partNumber => {
                try {
                    const response = await fetch(`${PART_API}/?part=${encodeURIComponent(partNumber)}`, { signal: requestController.signal });
                    if (!response.ok) throw new Error("Lookup failed");
                    return { part: await response.json(), portalUnavailable: false };
                } catch (error) {
                    return { part: { partNumber }, portalUnavailable: true };
                }
            };
            const partTask = type === "part" ? fetchPart(number) : null;
            const stock = await stockTask;
            if (revision !== requestRevision || !row.isConnected) return;
            if (type === "serial" && (stock.unavailable || !stock.rows.length)) {
                loadedNumber = number;
                result.innerHTML = stock.unavailable
                    ? '<p class="row-status is-error" role="status">Serial lookup needs the stock file, which is temporarily unavailable. Search again to retry.</p>'
                    : '<p class="row-status" role="status">Serial number not found in the current inventory. Check the serial number and search again.</p>';
                return;
            }
            const numbers = type === "serial" ? [...new Set(stock.rows.map(row => row.partNumber))] : [number];
            const details = await Promise.all(numbers.map(async partNumber => ({
                ...(await (partTask || fetchPart(partNumber))),
                number: partNumber,
                rows: stock.rows.filter(row => row.partNumber === partNumber)
            })));
            if (revision !== requestRevision || !row.isConnected) return;
            if (timedOut && !stock.rows.length) throw new DOMException("Lookup timed out", "AbortError");
            loadedNumber = number;
            result.replaceChildren();
            if (type === "serial") {
                const summary = document.createElement("p");
                summary.className = "serial-match";
                summary.textContent = `Serial ${number} · ${numbers.length} matching ${numbers.length === 1 ? "part" : "parts"}`;
                result.append(summary);
            }
            for (const detail of details) {
                const block = document.createElement("div");
                block.className = "lookup-match";
                renderPart(block, detail.part, detail.number, detail.rows, stock.unavailable);
                if (detail.portalUnavailable) {
                    const note = document.createElement("p");
                    note.className = "row-status is-error";
                    note.textContent = detail.rows.length ? "Portal details are unavailable. Showing inventory data; search again to retry." : "Could not load this part. Check your connection and search again.";
                    block.append(note);
                }
                result.append(block);
            }
        } catch (error) {
            if (revision !== requestRevision || !row.isConnected || (error.name === "AbortError" && !timedOut)) return;
            result.innerHTML = timedOut
                ? '<p class="row-status is-error" role="status">This lookup took too long. Search again to retry.</p>'
                : '<p class="row-status is-error" role="status">Could not load this part. Check your connection and search again.</p>';
        } finally {
            window.clearTimeout(timeout);
            if (revision === requestRevision) {
                result.setAttribute("aria-busy", "false");
                button.disabled = !normalizePartNumber(input.value);
                button.textContent = "Search";
            }
        }
    }

    input.addEventListener("input", () => {
        cancel();
        input.removeAttribute("aria-invalid");
        if (normalizePartNumber(input.value) !== loadedNumber) result.innerHTML = `<p class="row-status" role="status">${emptyMessage()}</p>`;
        updateList();
    });
    kind.addEventListener("change", () => {
        cancel();
        loadedNumber = "";
        input.placeholder = kind.value === "serial" ? "e.g. M409669" : "e.g. 100009";
        input.removeAttribute("aria-invalid");
        result.innerHTML = `<p class="row-status" role="status">${emptyMessage()}</p>`;
        updateList();
        input.focus();
    });
    input.addEventListener("change", () => { input.value = normalizePartNumber(input.value); updateList(); });
    row.querySelector("form").addEventListener("submit", event => { event.preventDefault(); search(); });
    row.querySelector(".part-remove-btn").addEventListener("click", () => {
        cancel();
        const next = row.nextElementSibling || row.previousElementSibling;
        row.remove();
        updateList();
        (next?.querySelector(".part-input") || document.getElementById("add-part-row")).focus();
    });
    row.cancel = cancel;
    list.append(row);
    button.disabled = !input.value;
    updateList();
    if (focus) input.focus();
    return { row, search };
}

async function importXml(file) {
    const revision = ++importRevision;
    const parsed = parsePartsFromXml(await file.text());
    if (revision !== importRevision) return;
    if (!parsed.parts.length) throw new Error("No valid part rows were found in this XML file.");
    [...list.children].forEach(row => { row.cancel(); row.remove(); });
    orderNumber = parsed.orderNumber;
    const queue = parsed.parts.map(part => createRow(part.partNumber));
    updateList();
    setPageStatus(`Imported ${queue.length} ${queue.length === 1 ? "part" : "parts"}${orderNumber ? ` from order ${orderNumber}` : ""}. Loading details...`);
    // Bound import traffic while allowing long orders to load progressively.
    await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => {
        while (queue.length && revision === importRevision) await queue.shift().search();
    }));
    if (revision === importRevision) setPageStatus(`Imported ${parsed.parts.length} ${parsed.parts.length === 1 ? "part" : "parts"}${orderNumber ? ` from order ${orderNumber}` : ""}.`);
}

async function downloadPdf() {
    const QR = window.QRCode;
    const PDF = window.jspdf?.jsPDF;
    if (!QR || !PDF) throw new Error("The QR PDF tools could not load. Refresh the page and try again.");
    const url = shareUrl().href;
    const container = document.createElement("div");
    container.className = "visually-hidden";
    document.body.append(container);
    try {
        try {
            new QR(container, { text: url, width: 900, height: 900, correctLevel: QR.CorrectLevel.L });
        } catch {
            throw new Error("This list is too long for a QR code. Remove some parts and try again.");
        }
        const canvas = container.querySelector("canvas");
        if (!canvas) throw new Error("Could not create the QR code. Try sharing fewer parts.");
        const pdf = new PDF({ orientation: "portrait", unit: "pt", format: "letter" });
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(22);
        pdf.text("Steelwrist parts", 306, 70, { align: "center" });
        pdf.addImage(canvas.toDataURL("image/png"), "PNG", 126, 104, 360, 360);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(12);
        pdf.text(`${values().length} ${values().length === 1 ? "lookup" : "lookups"}${orderNumber ? ` | Order ${orderNumber}` : ""}`, 306, 500, { align: "center" });
        pdf.setFontSize(9);
        const lines = pdf.splitTextToSize(url, 480);
        pdf.text(lines, 66, 535);
        pdf.save("steelwrist-parts.pdf");
    } finally { container.remove(); }
}

document.getElementById("add-part-row").addEventListener("click", () => createRow("", true));
document.getElementById("empty-add-part").addEventListener("click", () => createRow("", true));
document.getElementById("import-xml").addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try { await importXml(file); }
    catch (error) { setPageStatus(error.message || "Could not read this XML file.", true); }
    finally { fileInput.value = ""; }
});
pdfButton.addEventListener("click", async () => {
    pdfButton.disabled = true;
    setPageStatus("Creating QR PDF...");
    try { await downloadPdf(); setPageStatus("QR PDF downloaded."); }
    catch (error) { setPageStatus(error.message || "Could not create a QR PDF. Try sharing fewer parts.", true); }
    finally { pdfButton.disabled = values().length === 0; }
});
document.getElementById("close-image").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });

const initialParts = (new URL(location.href).searchParams.get("parts") || "").split(",").map(normalizePartNumber).filter(Boolean);
const initialSerials = (new URL(location.href).searchParams.get("serials") || "").split(",").map(normalizePartNumber).filter(Boolean);
if (initialParts.length || initialSerials.length) {
    initialParts.forEach(number => createRow(number).search());
    initialSerials.forEach(number => createRow(number, false, "serial").search());
} else createRow();
