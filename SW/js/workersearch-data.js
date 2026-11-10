function parseCsvRecords(csvText) {
    const records = [];
    let record = [];
    let value = "";
    let quoted = false;
    const text = csvText.replace(/^\uFEFF/, "");
    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        if (character === '"' && quoted && text[index + 1] === '"') {
            value += '"';
            index += 1;
        } else if (character === '"') {
            quoted = !quoted;
        } else if (character === "," && !quoted) {
            record.push(value);
            value = "";
        } else if ((character === "\n" || character === "\r") && !quoted) {
            record.push(value);
            if (record.some(field => field.trim())) records.push(record);
            record = [];
            value = "";
            if (character === "\r" && text[index + 1] === "\n") index += 1;
        } else {
            value += character;
        }
    }
    record.push(value);
    if (record.some(field => field.trim())) records.push(record);
    return records;
}

export function parseStockCsv(csvText) {
    const [headers, ...records] = parseCsvRecords(csvText);
    if (!headers) return [];
    const columns = headers.map(header => header.trim());
    return records.map(values => {
        const row = Object.fromEntries(columns.map((header, index) => [header, values[index]?.trim() || ""]));
        return {
            partNumber: normalizePartNumber(row["Part number"]),
            partName: row["Part name"],
            location: row.Location,
            balance: row.Balance || row["Curr. bal."] || "",
            serialNumber: row["Serial number"] || ""
        };
    }).filter(row => row.partNumber);
}

// Serial identifiers remain strings: leading zeroes and letters are significant.
export function findStockRows(rows, value, type = "part") {
    const key = type === "serial" ? "serialNumber" : "partNumber";
    const query = normalizePartNumber(value);
    return query ? rows.filter(row => normalizePartNumber(row[key]) === query) : [];
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

export function parsePartsFromXml(xmlText) {
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

export function normalizePartNumber(value) {
    return String(value || "").trim().toUpperCase();
}

export function stockBalance(rows) {
    return rows.reduce((total, row) => {
        const value = Number(String(row.balance).replaceAll(",", ""));
        return total + (Number.isFinite(value) ? value : 0);
    }, 0);
}

export function buildPartsUrl(href, parts, orderNumber = "", serials = []) {
    const source = new URL(href);
    const url = new URL(source.pathname, source.origin);
    const values = parts.map(normalizePartNumber).filter(Boolean);
    if (values.length) url.searchParams.set("parts", values.join(","));
    const serialValues = serials.map(normalizePartNumber).filter(Boolean);
    if (serialValues.length) url.searchParams.set("serials", serialValues.join(","));
    if (orderNumber) url.searchParams.set("order", orderNumber);
    return url;
}
