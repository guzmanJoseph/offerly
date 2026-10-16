
/*
 * Offerly Side Panel
 *
 * Keeps Offerly open while switching tabs.
 * Refreshes detected job details when the active
 * browser tab changes.
 *
 * popup.js still handles:
 * - Login
 * - Supabase authentication
 * - Job detection
 * - Automatic job saving
 *
 * profileAutofill.js still handles autofill.
 */

(() => {
  let refreshTimer = null;
  let refreshing = false;
  let refreshAgain = false;

  function $(id) {
    return document.getElementById(id);
  }

  function resetJobDisplay() {
    for (const id of ["company", "role", "location"]) {
      const input = $(id);

      if (input) {
        input.value = "";
      }
    }

    const badge = $("saveBadge");

    if (badge) {
      badge.textContent = "Checking...";
    }

    const link = $("jobLink");

    if (link) {
      link.classList.add("hidden");
      link.removeAttribute("href");
    }

    // Previous application questions shouldn't appear
    // when the user switches to another job.
    $("offerlyQuestionReview")?.remove();
  }

  async function refreshActiveTab() {
    // Don't interfere while autofill is running.
    if ($("autofillBtn")?.disabled) {
      return;
    }

    // Avoid overlapping Supabase requests.
    if (refreshing) {
      refreshAgain = true;
      return;
    }

    refreshing = true;

    try {
      resetJobDisplay();

      const status = $("status");

      if (status) {
        status.textContent =
          "Checking the current tab...";
      }

      // Reuse the working logic from popup.js.
      // It detects job details and saves the job
      // to Offerly when appropriate.
      if (
        typeof analyzeAndSaveCurrentPage ===
        "function"
      ) {
        await analyzeAndSaveCurrentPage();
      }
    } catch (error) {
      console.error(
        "Offerly side panel refresh:",
        error
      );

      const status = $("status");

      if (status) {
        status.textContent =
          error.message ||
          "Could not detect the current job.";
      }
    } finally {
      refreshing = false;

      if (refreshAgain) {
        refreshAgain = false;
        scheduleRefresh();
      }
    }
  }

  function scheduleRefresh() {
    if (refreshTimer) {
      clearTimeout(refreshTimer);
    }

    refreshTimer = setTimeout(() => {
      refreshTimer = null;
      refreshActiveTab();
    }, 400);
  }

  // Update Offerly when switching tabs.
  chrome.tabs.onActivated.addListener(() => {
    scheduleRefresh();
  });

  // Update when the active page finishes loading.
  chrome.tabs.onUpdated.addListener(
    async (tabId, changeInfo) => {
      if (changeInfo.status !== "complete") {
        return;
      }

      try {
        const [activeTab] = await chrome.tabs.query({
          active: true,
          currentWindow: true,
        });

        if (activeTab?.id === tabId) {
          scheduleRefresh();
        }
      } catch (error) {
        console.warn(
          "Offerly tab update:",
          error
        );
      }
    }
  );

  // Update when the user returns to this
  // Chrome window.
  chrome.windows.onFocusChanged.addListener(
    (windowId) => {
      if (
        windowId !==
        chrome.windows.WINDOW_ID_NONE
      ) {
        scheduleRefresh();
      }
    }
  );
})();
