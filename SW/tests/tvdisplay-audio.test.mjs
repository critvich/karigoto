import { test } from "node:test";
import assert from "node:assert/strict";
import { createDisplayAudio } from "../js/tvdisplay-audio.js";

function fixture() {
    const statuses = [];
    return { statuses, audio: createDisplayAudio(status => statuses.push(status)) };
}

function video(play = () => Promise.resolve()) {
    return {
        muted: false, paused: true, src: "clip.mp4", loads: 0,
        play() { this.paused = false; return play(this); },
        pause() { this.paused = true; },
        removeAttribute(name) { delete this[name]; },
        load() { this.loads++; }
    };
}

test("videos obey the admin mute setting, including grouped videos", () => {
    const { audio, statuses } = fixture();
    const clips = [video(), video()];
    audio.setVideos(clips);
    assert.ok(clips.every(clip => clip.muted && !clip.paused));
    audio.setMuted(false);
    assert.equal(statuses.at(-1).muted, false);
    assert.ok(clips.every(clip => !clip.muted && !clip.paused));
    audio.setMuted(true);
    assert.ok(clips.every(clip => clip.muted && !clip.paused));
});

test("leaving a slide stops and releases its videos while sound follows the slideshow", () => {
    const { audio, statuses } = fixture();
    const old = video();
    audio.setVideos([old]);
    audio.setMuted(false);
    audio.setVideos([]);
    assert.ok(old.paused && old.muted);
    assert.equal(old.src, undefined);
    assert.equal(old.loads, 1);
    const next = video();
    audio.setVideos([next]);
    assert.equal(next.muted, false);
    audio.setVideos([next]);
    assert.equal(next.loads, 0, "refreshing the same video must not reset playback");
});

test("blocked audible playback falls back to muted playback and reports browser blocking", async () => {
    const { audio, statuses } = fixture();
    const clip = video(current => current.muted
        ? Promise.resolve()
        : Promise.reject({ name: "NotAllowedError" }));
    audio.setVideos([clip]);
    audio.setMuted(false);
    await Promise.resolve();
    assert.ok(clip.muted && !clip.paused);
    assert.equal(statuses.at(-1).blocked, true);
});

test("a stale playback rejection from an old slide cannot mute the current slide", async () => {
    const { audio, statuses } = fixture();
    let rejectOld;
    const old = video(current => current.muted ? Promise.resolve() : new Promise((resolve, reject) => { rejectOld = reject; }));
    audio.setVideos([old]);
    audio.setMuted(false);
    const next = video();
    audio.setVideos([next]);
    rejectOld({ name: "NotAllowedError" });
    await Promise.resolve();
    assert.equal(next.muted, false);
    assert.equal(statuses.at(-1).muted, false);
});

test("a display and its editor preview have independent sound controls", () => {
    const live = fixture();
    const preview = fixture();
    const liveVideo = video();
    const previewVideo = video();
    live.audio.setVideos([liveVideo]);
    preview.audio.setVideos([previewVideo]);
    preview.audio.setMuted(false);
    assert.equal(previewVideo.muted, false);
    assert.equal(liveVideo.muted, true);
});

test("a gesture can retry blocked audio without changing the admin setting", async () => {
    const { audio, statuses } = fixture();
    let allowed = false;
    const clip = video(current => current.muted || allowed ? Promise.resolve() : Promise.reject({ name: "NotAllowedError" }));
    audio.setVideos([clip]);
    audio.setMuted(false);
    await Promise.resolve();
    assert.equal(clip.muted, true);
    audio.setMuted(false);
    assert.equal(clip.muted, true, "polling should not repeatedly interrupt blocked playback");
    allowed = true;
    audio.resume();
    await Promise.resolve();
    assert.equal(clip.muted, false);
    assert.deepEqual(statuses.at(-1), { muted: false, blocked: false });
});
