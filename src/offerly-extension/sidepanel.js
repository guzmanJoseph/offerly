
/*
 * Offerly Side Panel
 *
 * Chrome controls which tab-specific panel is visible.
 * Never disable autofill simply because tabs changed.
 *
 * profileAutofill.js manages autofill button state.
 * popup.js manages login and job detection.
 */

(() => {
  const $ = (id) => document.getElementById(id);

  function logPanelState() {
    const button = $("autofillBtn");

    console.info("Offerly side panel ready", {
      autofillButtonFound: Boolean(button),
      autofillButtonDisabled: button?.disabled,
      aiAgentLoaded:
        typeof window.offerlyAIAgent?.apply ===
        "function",
      smartAnswersLoaded:
        typeof window.offerlySmartAnswers?.apply ===
        "function"
    });
  }

  // Do not set autofillBtn.disabled here.
  // The autofill controller disables it only
  // while an autofill operation is running.

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      logPanelState,
      { once: true }
    );
  } else {
    logPanelState();
  }
})();
