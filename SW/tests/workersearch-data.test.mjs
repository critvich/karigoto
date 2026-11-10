import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseStockCsv, normalizePartNumber, stockBalance, buildPartsUrl } from "../js/workersearch-data.js";

test("stock parsing preserves quoted names, leading-zero locations and decimal balances", () => {
    const rows = parseStockCsv('\uFEFFPart number,Part name,Location,Balance\r\nabc123,"Pin, large",001204,3.50\r\n');
    assert.deepEqual(rows, [{ partNumber: "ABC123", partName: "Pin, large", location: "001204", balance: "3.50", serialNumber: "" }]);
});

test("current inventory can be read and combined without an account", () => {
    const rows = parseStockCsv(readFileSync(new URL("../data/stock-current.csv", import.meta.url), "utf8"));
    const part = rows.filter(row => row.partNumber === "100420");
    assert.ok(part.length > 1);
    assert.equal(stockBalance(part), part.reduce((sum, row) => sum + Number(row.balance), 0));
    assert.ok(part.some(row => row.location.startsWith("0")));
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


test("current export balances and serial identifiers retain leading zeroes and multiline fields", () => {
    const rows = parseStockCsv('Part number,Part name,Location,Curr. bal.,Serial number,Additional name\r\nabc,"Pin, large",001204,2.50,000123,"First line\r\nSecond line"\r\n');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].balance, "2.50");
    assert.equal(rows[0].serialNumber, "000123");
    assert.equal(rows[0].location, "001204");
});

test("part lookup retains all available serials with their own locations and balances", () => {
    const rows = parseStockCsv(readFileSync(new URL("../data/stock-current.csv", import.meta.url), "utf8"));
    const part = rows.filter(row => row.partNumber === "217851SP");
    assert.deepEqual(part.filter(row => row.serialNumber).map(row => [row.serialNumber, row.location, row.balance]), [
        ["123456", "040803", "2.00"], ["9003372", "040803", "1.00"], ["M409669", "040803", "1.00"]
    ]);
    assert.equal(stockBalance(part), 4);
    assert.equal(rows.filter(row => row.serialNumber).length, 373);
});
