function getPlayableItems(display) {
    const playlist = Array.isArray(display.playlist) ? display.playlist : [];
    const playable = playlist.flatMap((slide, slideIndex) => {
        if (Array.isArray(slide?.mediaItems)) {
            const mediaItems = slide.mediaItems.filter(media => media?.url);
            if (mediaItems.length === 0) {
                return [{
                    ...slide,
                    id: slide.id || `slide-${slideIndex}`,
                    mediaSequenceIndex: 0,
                    mediaSequenceTotal: 0,
                    title: slide.title || `Slide ${slideIndex + 1}`,
                    mediaType: "image",
                    url: ""
                }];
            }

            if (shouldShowMediaGroup(slide, mediaItems)) {
                return [{
                    ...slide,
                    id: slide.id || `slide-${slideIndex}`,
                    slideId: slide.id || `slide-${slideIndex}`,
                    mediaItems: mediaItems.map(media => ({
                        ...media,
                        cropX: clampCropValue(media.cropX),
                        cropY: clampCropValue(media.cropY),
                        size: clampMediaSize(media.size),
                        zoom: clampCropZoom(media.zoom)
                    })),
                    mediaType: "group",
                    url: "",
                    durationSeconds: slide.durationSeconds || 0
                }];
            }

            return mediaItems.map((media, mediaIndex) => ({
                ...slide,
                id: `${slide.id || `slide-${slideIndex}`}:${media.id || mediaIndex}`,
                slideId: slide.id || `slide-${slideIndex}`,
                mediaId: media.id || "",
                mediaSequenceIndex: mediaIndex,
                mediaSequenceTotal: mediaItems.length,
                title: media.title || slide.title || `Slide ${slideIndex + 1}`,
                mediaType: media.mediaType || "image",
                url: media.url || "",
                cropX: clampCropValue(media.cropX),
                cropY: clampCropValue(media.cropY),
                size: clampMediaSize(media.size),
                zoom: clampCropZoom(media.zoom),
                durationSeconds: slide.mediaDurationSeconds || slide.durationSeconds || 0
            }));
        }

        if (slide?.url) {
            return [slide];
        }

        return [];
    });
    if (playable.length > 0) {
        return playable;
    }

    if (display.mediaUrl) {
        return [{
            id: "legacy-media",
            title: display.mediaAlt || "Promotional media",
            mediaType: display.mediaType || "image",
            url: display.mediaUrl,
            durationSeconds: display.slideDurationSeconds || 12,
            layoutMode: "split",
            headline: display.headline || "",
            subheadline: display.subheadline || "",
            announcement: display.announcement || ""
        }];
    }

    return [];
}

function shouldShowMediaGroup(slide, mediaItems) {
    if (!Array.isArray(mediaItems) || mediaItems.length <= 1) return false;
    if (slide?.mediaLayout === "side-by-side") return true;
    if (slide?.mediaLayout === "rotate") return false;
    return mediaItems.some(media => Number.isFinite(Number(media?.size)) && Number(media.size) !== 100);
}

function clampCropValue(value) {
    const number = Number.parseFloat(value);
    if (Number.isNaN(number)) return 50;
    return Math.max(0, Math.min(100, number));
}

function clampPercent(value, fallback = 50) {
    const number = Number.parseInt(value, 10);
    if (Number.isNaN(number)) return fallback;
    return Math.max(25, Math.min(80, number));
}

function clampMediaSize(value) {
    const number = Number.parseInt(value, 10);
    if (Number.isNaN(number)) return 100;
    return Math.max(25, Math.min(300, number));
}

function clampCropZoom(value) {
    const number = Number.parseInt(value, 10);
    if (Number.isNaN(number)) return 120;
    return Math.max(100, Math.min(250, number));
}

function findPlaybackIndex(items, slideId, mediaIndex = 0) {
    const belongsToSlide = item => (item.slideId || item.id) === slideId;
    const exact = items.findIndex(item => belongsToSlide(item) && (item.mediaSequenceIndex || 0) === mediaIndex);
    return exact >= 0 ? exact : Math.max(0, items.findIndex(belongsToSlide));
}

export { getPlayableItems, shouldShowMediaGroup, clampCropValue, clampPercent, clampMediaSize, clampCropZoom, findPlaybackIndex };
