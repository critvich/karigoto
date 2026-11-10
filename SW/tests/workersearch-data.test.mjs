import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseStockCsv, normalizePartNumber, findStockRows, stockBalance, buildPartsUrl } from "../js/workersearch-data.js";

test("stock parsing preserves quoted names, leading-zero locations and decimal balances", () => {
    const rows = parseStockCsv('\uFEFFPart number,Part name,Location,Balance\r\nabc123,"Pin, large",001204,3.50\r\n');
    assert.deepEqual(rows, [{ partNumber: "ABC123", partName: "Pin, large", location: "001204", balance: "3.50", serialNumber: "" }]);
});

test("Monitor exports support current balances, quoted multiline fields and serial strings", () => {
    const csv = '\uFEFFPart number,Part name,Location,Curr. bal.,Serial number,Additional name\r\nabc,"Pin, \"\"large\"\"",001204,2.50,000123,"First line\r\nSecond line"\r\ndef,Gripper,0020,1.00,m409669,\r\n';
    const rows = parseStockCsv(csv);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].partName, 'Pin, "large"');
    assert.equal(rows[0].serialNumber, "000123");
    assert.equal(rows[0].location, "001204");
    assert.equal(stockBalance(rows), 3.5);
    assert.equal(findStockRows(rows, " M409669 ", "serial")[0].partNumber, "DEF");
    assert.deepEqual(findStockRows(rows, "123", "serial"), []);
    assert.deepEqual(findStockRows(rows, ""), []);
});

test("current inventory can be read and combined without an account", () => {
    const rows = parseStockCsv(readFileSync(new URL("../data/stock-current.csv", import.meta.url), "utf8"));
    const part = rows.filter(row => row.partNumber === "100420");
    assert.ok(part.length > 1);
    assert.equal(stockBalance(part), part.reduce((sum, row) => sum + Number(row.balance), 0));
    assert.ok(part.some(row => row.location.startsWith("0")));
    assert.equal(stockBalance(part), 6);
    assert.equal(rows.length, 52812);
    assert.equal(rows.filter(row => row.serialNumber).length, 373);
});

test("serial lookup retains duplicate serial matches and only their own stock balances", () => {
    const rows = parseStockCsv(readFileSync(new URL("../data/stock-current.csv", import.meta.url), "utf8"));
    const matches = findStockRows(rows, "123456", "serial");
    assert.deepEqual(matches.map(row => row.partNumber), ["211494SP", "217851SP"]);
    assert.equal(stockBalance(matches), 3);
    assert.equal(stockBalance(findStockRows(rows, "217851sp")), 4);
    assert.deepEqual(findStockRows(rows, "M409669", "serial").map(row => row.partNumber), ["217851SP"]);
    assert.deepEqual(findStockRows(rows, "M409669", "part"), []);
    assert.deepEqual(findStockRows(rows, "NOT-A-SERIAL", "serial"), []);
});

test("part and serial identifiers never get confused when their values collide", () => {
    const rows = [{ partNumber: "000123", serialNumber: "OTHER" }, { partNumber: "ABC", serialNumber: "000123" }];
    assert.equal(findStockRows(rows, "000123", "part")[0].partNumber, "000123");
    assert.equal(findStockRows(rows, "000123", "serial")[0].partNumber, "ABC");
    assert.deepEqual(findStockRows(rows, "123", "serial"), []);
});

test("mixed part and serial links preserve exact lookup types for QR PDFs", () => {
    const url = buildPartsUrl("https://karigo.to/SW/workersearch.html?token=private#old", ["217851sp"], "QA-1042", ["000123", " m409669 "]);
    assert.equal(url.searchParams.get("parts"), "217851SP");
    assert.equal(url.searchParams.get("serials"), "000123,M409669");
    assert.equal(url.searchParams.get("order"), "QA-1042");
    assert.equal(url.searchParams.has("token"), false);
    assert.equal(url.hash, "");
    assert.equal(buildPartsUrl(url, [], "", ["M409669"]).searchParams.has("parts"), false);
    assert.equal(buildPartsUrl(url, []).searchParams.has("serials"), false);
});

test("stock totals support thousands separators and ignore unavailable balances", () => {
    assert.equal(stockBalance([{ balance: "1,200.25" }, { balance: "-2.5" }, { balance: "N/A" }]), 1197.75);
});

test("shared links preserve parts and order without copying unrelated query values", () => {
    const url = buildPartsUrl("https://karigo.to/SW/workersearch.html?token=private#old", [" ab123 ", "", "100202"], "Order & 5");
    assert.equal(url.searchParams.get("parts"), "AB123,100202");
    assert.equal(url.searchParams.get("order"), "Order & 5");
    assert.equal(url.searchParams.has("token"), false);
    assert.equal(url.hash, "");
});

test("removing every part produces a clean URL and normalization is consistent", () => {
    assert.equal(buildPartsUrl("https://karigo.to/SW/workersearch.html?parts=A", []).href, "https://karigo.to/SW/workersearch.html");
    assert.equal(normalizePartNumber("  ab-123  "), "AB-123");
    assert.equal(normalizePartNumber(null), "");
});
