// Sound is opt-in for each display/preview window; it carries across its slides.
export function createDisplayAudio(button) {
    let enabled = false;
    let videos = [];
    let revision = 0;

    function updateButton() {
        button.hidden = videos.length === 0;
        button.textContent = enabled ? "Mute sound" : "Enable sound";
        button.setAttribute("aria-pressed", String(enabled));
    }

    function play(video, currentRevision) {
        video.muted = !enabled;
        video.play().catch(error => {
            // A removed slide or an earlier click must not change current sound.
            if (currentRevision !== revision || !videos.includes(video)) return;
            if (error.name !== "NotAllowedError" || !enabled) return;
            enabled = false;
            updateButton();
            // Keep the slideshow running if audible autoplay is blocked.
            videos.forEach(active => {
                active.muted = true;
                active.play().catch(() => undefined);
            });
        });
    }

    button.addEventListener("click", () => {
        enabled = !enabled;
        const currentRevision = ++revision;
        updateButton();
        // Call play synchronously within the gesture so audio can be unlocked.
        videos.forEach(video => play(video, currentRevision));
    });

    updateButton();
    return {
        setVideos(nextVideos) {
            const currentRevision = ++revision;
            videos.filter(video => !nextVideos.includes(video)).forEach(video => {
                video.muted = true;
                video.pause();
                video.removeAttribute("src");
                video.load();
            });
            videos = nextVideos;
            updateButton();
            videos.forEach(video => play(video, currentRevision));
        }
    };
}
