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

export function parseStockCsv(csvText) {
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
            partNumber: String(row["Part number"] || "").toUpperCase(),
            partName: row["Part name"],
            location: row.Location,
            balance: row.Balance
        };
    }).filter(row => row.partNumber);
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

export function buildPartsUrl(href, parts, orderNumber = "") {
    const source = new URL(href);
    const url = new URL(source.pathname, source.origin);
    const values = parts.map(normalizePartNumber).filter(Boolean);
    if (values.length) url.searchParams.set("parts", values.join(","));
    if (orderNumber) url.searchParams.set("order", orderNumber);
    return url;
}
