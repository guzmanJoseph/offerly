/* Cursor spotlight.
   Any glass panel gets the .spot class automatically (including ones that
   mount later), and its --mx / --my CSS vars follow the pointer so the
   glow and gradient hairline track the cursor. One listener, no deps. */

const SELECTOR = [
    ".page-header",
    ".stat-card",
    ".chart-card",
    ".insight-card",
    ".table-card",
    ".dashboard-section",
    ".network-pipeline",
    ".calendar-card",
    ".auth-card"
].join(",");

function tag(root = document) {
    root.querySelectorAll(SELECTOR).forEach(el => el.classList.add("spot"));
}

export function initSpotlight() {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (window.matchMedia("(hover: none)").matches) return;

    tag();

    const observer = new MutationObserver(() => tag());
    observer.observe(document.body, { childList: true, subtree: true });

    window.addEventListener(
        "pointermove",
        e => {
            const el = e.target.closest?.(".spot");
            if (!el) return;
            const r = el.getBoundingClientRect();
            el.style.setProperty("--mx", `${e.clientX - r.left}px`);
            el.style.setProperty("--my", `${e.clientY - r.top}px`);
        },
        { passive: true }
    );
}
