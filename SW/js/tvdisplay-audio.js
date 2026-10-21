// The admin panel owns the setting. The TV canvas has no playback controls.
export function createDisplayAudio(onStatus = () => undefined) {
    let muted = true;
    let blocked = false;
    let videos = [];
    let revision = 0;

    function play(video, currentRevision) {
        video.muted = muted || blocked;
        video.play().catch(error => {
            if (currentRevision !== revision || !videos.includes(video)) return;
            if (error?.name !== "NotAllowedError" || muted || blocked) return;
            blocked = true;
            onStatus({ muted, blocked });
            // Keep video playing while waiting for browser permission.
            videos.forEach(active => {
                active.muted = true;
                active.play().catch(() => undefined);
            });
        });
    }

    function apply() {
        const currentRevision = ++revision;
        videos.forEach(video => play(video, currentRevision));
    }

    return {
        setMuted(nextMuted) {
            if (muted === nextMuted) return;
            muted = nextMuted;
            blocked = false;
            onStatus({ muted, blocked });
            apply();
        },
        resume() {
            if (muted || !blocked) return;
            blocked = false;
            onStatus({ muted, blocked });
            apply();
        },
        setVideos(nextVideos) {
            videos.filter(video => !nextVideos.includes(video)).forEach(video => {
                video.muted = true;
                video.pause();
                video.removeAttribute("src");
                video.load();
            });
            videos = nextVideos;
            apply();
        }
    };
}
