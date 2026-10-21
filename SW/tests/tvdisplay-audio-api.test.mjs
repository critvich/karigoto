import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestEnv } from "./worker-test-env.mjs";

async function fixture(t) {
    const f = createTestEnv();
    t.after(() => f.db.close());
    const login = await f.request("/api/display-login", "POST", { password: "local-test-only" });
    assert.equal(login.status, 200);
    return { ...f, token: login.body.token };
}

test("TV audio defaults to muted and its setting can be read without signing in", async t => {
    const f = await fixture(t);
    const result = await f.request("/api/display/audio");
    assert.equal(result.status, 200);
    assert.equal(result.body.audio.muted, true);
});

test("only an admin can change the TV audio setting", async t => {
    const f = await fixture(t);
    assert.equal((await f.request("/api/display/audio", "PATCH", { muted: false })).status, 401);
    assert.equal((await f.request("/api/display/audio")).body.audio.muted, true);
});

test("muting and unmuting persist independently of the published slides", async t => {
    const f = await fixture(t);
    const before = await f.request("/api/display");
    for (const muted of [false, true, false]) {
        const saved = await f.request("/api/display/audio", "PATCH", { muted }, f.token);
        assert.equal(saved.status, 200);
        assert.equal(saved.body.audio.muted, muted);
        assert.equal((await f.request("/api/display/audio")).body.audio.muted, muted);
    }
    const after = await f.request("/api/display");
    delete before.body.display.updatedAt;
    delete after.body.display.updatedAt;
    assert.deepEqual(after.body, before.body);
    assert.equal(f.db.prepare("SELECT COUNT(*) AS count FROM tv_display_state").get().count, 0);
});

test("invalid mute settings are rejected without changing the saved value", async t => {
    const f = await fixture(t);
    for (const muted of ["false", 0, null, undefined]) {
        assert.equal((await f.request("/api/display/audio", "PATCH", { muted }, f.token)).status, 400);
    }
    assert.equal((await f.request("/api/display/audio")).body.audio.muted, true);
});
