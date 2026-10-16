
/*
 * Offerly Greenhouse Submission Watcher
 *
 * Detects explicit submission confirmations.
 * Does not treat clicking Submit as success.
 * Does not submit or modify the application.
 */

(() => {
  if (globalThis.__offerlySubmissionWatcher) return;

  globalThis.__offerlySubmissionWatcher = true;

  let reported = false;
  let timer = null;

  
const SUCCESS_PATTERNS = [
  // Greenhouse confirmations
  /^thank you for applying[!.]?$/i,
  /^application submitted[!.]?$/i,
  /^your application (has been|was) submitted[!.]?$/i,
  /^your application (has been|was) received[!.]?$/i,
  /^we (have )?received your application[!.]?$/i,
  /^thanks for applying[!.]?$/i,
  /^thank you for your application[!.]?$/i,

  // Ashby confirmations
  /we have received your application/i,
  /we've received your application/i,
  /thank you for your interest in .+we have received your application/i,
];


  function normalize(text) {
    return String(text || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function hasConfirmation() {
    const candidates = document.querySelectorAll(
      "h1, h2, h3, [role='alert'], [role='status'], " +
      "[class*='confirmation'], [class*='success']"
    );

    for (const element of candidates) {
      if (
        element.closest(
          "script, style, template, nav, footer"
        )
      ) {
        continue;
      }

      const text = normalize(element.textContent);

      if (!text || text.length > 180) continue;

      if (
        SUCCESS_PATTERNS.some((pattern) =>
          pattern.test(text)
        )
      ) {
        return true;
      }
    }

    return false;
  }

  async function inspect() {
    if (reported || !hasConfirmation()) return;

    try {
      const response = await chrome.runtime.sendMessage({
        type: "OFFERLY_SUBMISSION_CONFIRMED",
        pageUrl: location.href,
      });

      if (response?.ok) {
        reported = true;
      }
    } catch (error) {
      console.warn(
        "Offerly submission watcher:",
        error
      );
    }
  }

  function scheduleInspection() {
    if (timer) clearTimeout(timer);

    timer = setTimeout(inspect, 300);
  }

  const observer = new MutationObserver(
    scheduleInspection
  );

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
  });

  scheduleInspection();
})();
