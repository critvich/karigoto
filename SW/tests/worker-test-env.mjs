import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";

const source = readFileSync(new URL("../cloudflare/board-worker.js", import.meta.url), "utf8");
const { default: worker } = await import(`data:text/javascript;base64,${Buffer.from(source).toString("base64")}`);

export function createTestEnv() {
    const db = new DatabaseSync(":memory:");
    db.exec(readFileSync(new URL("../cloudflare/board-schema.sql", import.meta.url), "utf8"));
    db.exec(readFileSync(new URL("../cloudflare/display-schema.sql", import.meta.url), "utf8"));
    function prepare(sql) {
        const statement = db.prepare(sql);
        let args = [];
        const query = {
            bind(...values) { args = values; return query; },
            async first() { return statement.get(...args) || null; },
            async all() { return { results: statement.all(...args) }; },
            runSync() {
                const result = statement.run(...args);
                return { success: true, meta: { changes: Number(result.changes) } };
            },
            async run() { return query.runSync(); }
        };
        return query;
    }
    const env = {
        ADMIN_USER: "admin", ADMIN_PASSWORD: "local-test-only", ALLOWED_WORKER_CODES: "BRBO",
        boardbinding: {
            prepare,
            async batch(statements) {
                db.exec("BEGIN");
                try {
                    const results = statements.map(statement => statement.runSync());
                    db.exec("COMMIT");
                    return results;
                } catch (error) {
                    db.exec("ROLLBACK");
                    throw error;
                }
            }
        }
    };
    async function request(path, method = "GET", body, token) {
        const response = await worker.fetch(new Request(`https://local-test.invalid${path}`, {
            method,
            headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            ...(body !== undefined ? { body: JSON.stringify(body) } : {})
        }), env);
        return { status: response.status, body: await response.json() };
    }
    return { db, env, request, worker };
}
