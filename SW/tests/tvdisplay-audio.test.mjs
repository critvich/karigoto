import { test } from "node:test";
import assert from "node:assert/strict";
import { createDisplayAudio } from "../js/tvdisplay-audio.js";

function fixture() {
    const button = {
        attributes: {},
        setAttribute(name, value) { this.attributes[name] = value; },
        addEventListener(name, callback) { this[name] = callback; }
    };
    return { button, audio: createDisplayAudio(button) };
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

test("videos autoplay muted until the viewer enables sound, including grouped videos", () => {
    const { button, audio } = fixture();
    assert.equal(button.hidden, true);
    const clips = [video(), video()];
    audio.setVideos(clips);
    assert.equal(button.hidden, false);
    assert.ok(clips.every(clip => clip.muted && !clip.paused));
    button.click();
    assert.equal(button.attributes["aria-pressed"], "true");
    assert.ok(clips.every(clip => !clip.muted && !clip.paused));
    button.click();
    assert.ok(clips.every(clip => clip.muted && !clip.paused));
});

test("leaving a slide stops and releases its videos while sound follows the slideshow", () => {
    const { button, audio } = fixture();
    const old = video();
    audio.setVideos([old]);
    button.click();
    audio.setVideos([]);
    assert.ok(old.paused && old.muted);
    assert.equal(old.src, undefined);
    assert.equal(old.loads, 1);
    assert.equal(button.hidden, true);
    const next = video();
    audio.setVideos([next]);
    assert.equal(next.muted, false);
    audio.setVideos([next]);
    assert.equal(next.loads, 0, "refreshing the same video must not reset playback");
});

test("blocked audible playback falls back to muted playback and offers another click", async () => {
    const { button, audio } = fixture();
    const clip = video(current => current.muted
        ? Promise.resolve()
        : Promise.reject({ name: "NotAllowedError" }));
    audio.setVideos([clip]);
    button.click();
    await Promise.resolve();
    assert.ok(clip.muted && !clip.paused);
    assert.equal(button.textContent, "Enable sound");
    assert.equal(button.attributes["aria-pressed"], "false");
});

test("a stale playback rejection from an old slide cannot mute the current slide", async () => {
    const { button, audio } = fixture();
    let rejectOld;
    const old = video(current => current.muted ? Promise.resolve() : new Promise((resolve, reject) => { rejectOld = reject; }));
    audio.setVideos([old]);
    button.click();
    const next = video();
    audio.setVideos([next]);
    rejectOld({ name: "NotAllowedError" });
    await Promise.resolve();
    assert.equal(next.muted, false);
    assert.equal(button.attributes["aria-pressed"], "true");
});

test("a display and its editor preview have independent sound controls", () => {
    const live = fixture();
    const preview = fixture();
    const liveVideo = video();
    const previewVideo = video();
    live.audio.setVideos([liveVideo]);
    preview.audio.setVideos([previewVideo]);
    preview.button.click();
    assert.equal(previewVideo.muted, false);
    assert.equal(liveVideo.muted, true);
});
