import { test } from "node:test";
import assert from "node:assert/strict";
import { getPlayableItems, findPlaybackIndex } from "../js/tvdisplay-model.js";

const image = (id, extra = {}) => ({ id, url: `https://media.invalid/${id}.png`, mediaType: "image", ...extra });

test("preview and playback select the same item in a rotating multi-media slide", () => {
    const playlist = [
        { id: "one", layoutMode: "overlay", mediaLayout: "rotate", mediaItems: [image("a"), image("b")] },
        { id: "two", layoutMode: "fullscreen", mediaItems: [image("c")] }
    ];
    const items = getPlayableItems({ playlist });
    assert.deepEqual(items.map(item => item.mediaId), ["a", "b", "c"]);
    assert.equal(items[findPlaybackIndex(items, "one", 1)].mediaId, "b");
    assert.equal(items[findPlaybackIndex(items, "two", 0)].mediaId, "c");
    assert.equal(items[findPlaybackIndex(items, "one", 8)].mediaId, "a");
});

test("side-by-side media remains a single playback item with individual crops", () => {
    const [item] = getPlayableItems({ playlist: [{
        id: "group", mediaLayout: "side-by-side", mediaItems: [
            image("a", { cropX: 0, cropY: 100, size: 50, zoom: 135 }),
            image("b", { cropX: 100, cropY: 0, size: 150, zoom: 110 })
        ]
    }] });
    assert.equal(item.mediaType, "group");
    assert.deepEqual(item.mediaItems.map(media => [media.cropX, media.cropY, media.size, media.zoom]), [
        [0, 100, 50, 135], [100, 0, 150, 110]
    ]);
    assert.equal(findPlaybackIndex([item], "group", 1), 0);
});

test("legacy size-based grouping and explicit rotation retain playback behavior", () => {
    const slide = { id: "legacy", mediaItems: [image("a", { size: 50 }), image("b")] };
    assert.equal(getPlayableItems({ playlist: [slide] })[0].mediaType, "group");
    assert.equal(getPlayableItems({ playlist: [{ ...slide, mediaLayout: "rotate" }] }).length, 2);
});

test("text-only slides remain playable without displaying unrelated legacy media", () => {
    const items = getPlayableItems({
        mediaUrl: "https://media.invalid/old.png",
        playlist: [{ id: "text", mediaItems: [], headline: "A text-only slide" }]
    });
    assert.equal(items.length, 1);
    assert.equal(items[0].headline, "A text-only slide");
    assert.equal(items[0].url, "");
});

test("video and crop metadata are preserved by the shared playback model", () => {
    const items = getPlayableItems({ playlist: [{ id: "video", mediaItems: [{
        id: "clip", url: "https://media.invalid/video.mp4", mediaType: "video", cropX: 0, cropY: 90, zoom: 125
    }] }] });
    assert.equal(items[0].mediaType, "video");
    assert.equal(items[0].cropX, 0);
    assert.equal(items[0].cropY, 90);
    assert.equal(items[0].zoom, 125);
});
