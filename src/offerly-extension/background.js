/*
 * Offerly Background Service Worker
 *
 * Features:
 * - Chrome tab-specific side panel
 * - Trusted browser dropdown clicks
 * - Application submission tracking
 * - Automatic Saved -> Applied updates
 *
 * Does not automatically submit applications.
 */

// =========================================
// 1. TAB-SPECIFIC SIDE PANEL
// =========================================

// Let Chrome handle toolbar clicks.
// The manifest must NOT declare default_popup.

chrome.sidePanel
  .setPanelBehavior({
    openPanelOnActionClick: true,
  })
  .catch((error) => {
    console.error(
      "Offerly side panel behavior:",
      error
    );
  });

// Configure a tab-specific panel, without
// configuring a window-wide default panel.

async function configurePanel(tabId) {
  if (!Number.isInteger(tabId)) {
    return;
  }

  try {
    await chrome.sidePanel.setOptions({
      tabId,
      path: "sidepanel.html",
      enabled: true,
    });
  } catch (error) {
    console.warn(
      "Offerly panel configuration:",
      error
    );
  }
}

// Prepare newly opened tabs so the toolbar
// button can open a tab-scoped side panel.

chrome.tabs.onCreated.addListener((tab) => {
  if (tab.id) {
    configurePanel(tab.id);
  }
});

// Prepare the active tab when switching tabs.

chrome.tabs.onActivated.addListener(
  ({ tabId }) => {
    configurePanel(tabId);
  }
);

// Configure tabs that existed before the
// extension was installed or reloaded.

async function initializeSidePanels() {
  try {
    const tabs = await chrome.tabs.query({});

    await Promise.all(
      tabs
        .filter((tab) =>
          Number.isInteger(tab.id)
        )
        .map((tab) =>
          configurePanel(tab.id)
        )
    );
  } catch (error) {
    console.error(
      "Offerly panel initialization:",
      error
    );
  }
}

chrome.runtime.onInstalled.addListener(
  initializeSidePanels
);

chrome.runtime.onStartup.addListener(
  initializeSidePanels
);

// Service workers may restart independently.
initializeSidePanels();


// =========================================
// 2. TRUSTED DROPDOWN CLICKS
// =========================================

function isOfferlyInterface(sender) {
  if (sender.id !== chrome.runtime.id) {
    return false;
  }

  const allowed = [
    chrome.runtime.getURL("popup.html"),
    chrome.runtime.getURL("sidepanel.html"),
  ];

  return allowed.includes(sender.url);
}

async function trustedClick(message, sender) {
  if (!isOfferlyInterface(sender)) {
    throw new Error(
      "Untrusted Offerly request."
    );
  }

  const { tabId, x, y } = message;

  if (
    !Number.isInteger(tabId) ||
    !Number.isFinite(x) ||
    !Number.isFinite(y) ||
    x < 0 ||
    y < 0
  ) {
    throw new Error(
      "Invalid dropdown click coordinates."
    );
  }

  const tab = await chrome.tabs.get(tabId);

  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });

  if (
    tabId !== activeTab?.id ||
    !/^https:\/\//i.test(tab.url || "")
  ) {
    throw new Error(
      "Select an active HTTPS application tab."
    );
  }

  const target = { tabId };

  let attached = false;

  try {
    await chrome.debugger.attach(
      target,
      "1.3"
    );

    attached = true;

    await chrome.debugger.sendCommand(
      target,
      "Input.dispatchMouseEvent",
      {
        type: "mouseMoved",
        x,
        y,
      }
    );

    await chrome.debugger.sendCommand(
      target,
      "Input.dispatchMouseEvent",
      {
        type: "mousePressed",
        x,
        y,
        button: "left",
        clickCount: 1,
      }
    );

    await chrome.debugger.sendCommand(
      target,
      "Input.dispatchMouseEvent",
      {
        type: "mouseReleased",
        x,
        y,
        button: "left",
        clickCount: 1,
      }
    );

    return { ok: true };
  } finally {
    if (attached) {
      await chrome.debugger
        .detach(target)
        .catch(() => {});
    }
  }
}

chrome.runtime.onMessage.addListener(
  (message, sender, sendResponse) => {
    if (
      message?.type !==
      "OFFERLY_TRUSTED_CLICK"
    ) {
      return false;
    }

    trustedClick(message, sender)
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          ok: false,
          error: error.message,
        });
      });

    return true;
  }
);


// =========================================
// 3. SUPABASE CONFIGURATION
// =========================================

const OFFERLY_BASE =
  "https://cezdzqaayzlalspukapl.supabase.co";

const OFFERLY_KEY =
  "sb_publishable_IT1rTAKqu7oUP9oILUIyaQ_fm_DOAir";

const submissionUpdatesInProgress =
  new Set();

function submissionKey(tabId) {
  return `offerlySubmissionTab_${tabId}`;
}


// =========================================
// 4. SUPPORTED APPLICATION URLS
// =========================================

function isSupportedApplicationUrl(url) {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "https:") {
      return false;
    }

    const hostname =
      parsed.hostname.toLowerCase();

    return (
      hostname === "greenhouse.io" ||
      hostname.endsWith(".greenhouse.io") ||
      hostname === "ashbyhq.com" ||
      hostname.endsWith(".ashbyhq.com")
    );
  } catch {
    return false;
  }
}


// =========================================
// 5. AUTHENTICATED SUPABASE SESSION
// =========================================

async function getSubmissionSession() {
  let { offerlySession: session } =
    await chrome.storage.local.get(
      "offerlySession"
    );

  if (!session?.user?.id) {
    throw new Error(
      "Offerly is not signed in."
    );
  }

  const now =
    Math.floor(Date.now() / 1000);

  if (
    session.access_token &&
    session.expires_at > now + 60
  ) {
    return session;
  }

  if (!session.refresh_token) {
    throw new Error(
      "Offerly session expired."
    );
  }

  const response = await fetch(
    `${OFFERLY_BASE}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        apikey: OFFERLY_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refresh_token:
          session.refresh_token,
      }),
    }
  );

  const refreshed =
    await response.json();

  if (
    !response.ok ||
    !refreshed.access_token
  ) {
    throw new Error(
      "Could not refresh Offerly session."
    );
  }

  session = refreshed;

  await chrome.storage.local.set({
    offerlySession: session,
  });

  return session;
}


// =========================================
// 6. SUPABASE REQUEST HELPER
// =========================================

async function submissionRequest(
  path,
  options = {}
) {
  const session =
    await getSubmissionSession();

  const response = await fetch(
    `${OFFERLY_BASE}/rest/v1/${path}`,
    {
      ...options,
      headers: {
        apikey: OFFERLY_KEY,
        Authorization:
          `Bearer ${session.access_token}`,
        "Content-Type":
          "application/json",
        ...options.headers,
      },
    }
  );

  if (!response.ok) {
    const details =
      await response.text();

    throw new Error(
      `Offerly update failed (${response.status}): ${details}`
    );
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}


// =========================================
// 7. SUBMISSION WATCHER
// =========================================

async function installSubmissionWatcher(
  tabId
) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["submissionWatch.js"],
    });
  } catch (error) {
    console.warn(
      "Could not install submission watcher:",
      error.message
    );
  }
}


// =========================================
// 8. VERIFY SUBMISSION CONFIRMATION
// =========================================

async function checkSubmissionPage(
  tabId
) {
  const results =
    await chrome.scripting.executeScript({
      target: { tabId },

      func: () => {
        const patterns = [
          /^thank you for applying[!.]?$/i,
          /^application submitted[!.]?$/i,
          /^your application (has been|was) submitted[!.]?$/i,
          /^your application (has been|was) received[!.]?$/i,
          /^we (have )?received your application[!.]?$/i,
          /^thanks for applying[!.]?$/i,
          /^thank you for your application[!.]?$/i,
          /we have received your application/i,
          /we've received your application/i,
        ];

        const nodes =
          document.querySelectorAll(
            "h1, h2, h3, [role='alert'], " +
            "[role='status'], " +
            "[class*='confirmation'], " +
            "[class*='success']"
          );

        return [...nodes].some(
          (node) => {
            const text = String(
              node.textContent || ""
            )
              .replace(/\s+/g, " ")
              .trim();

            return (
              text.length > 0 &&
              text.length <= 180 &&
              patterns.some(
                (pattern) =>
                  pattern.test(text)
              )
            );
          }
        );
      },
    });

  return (
    results?.[0]?.result === true
  );
}


// =========================================
// 9. REGISTER A SAVED APPLICATION
// =========================================

async function registerSubmissionTab(
  tabId,
  jobId
) {
  const tab =
    await chrome.tabs.get(tabId);

  if (
    !isSupportedApplicationUrl(tab.url)
  ) {
    return {
      ok: false,
      reason:
        "Automatic submission tracking is supported on Greenhouse and Ashby.",
    };
  }

  const session =
    await getSubmissionSession();

  const query = new URLSearchParams({
    select: "id,status",
    id: `eq.${jobId}`,
    user_id:
      `eq.${session.user.id}`,
    limit: "1",
  });

  const rows =
    await submissionRequest(
      `applications?${query}`
    );

  if (!rows?.length) {
    throw new Error(
      "Saved application could not be verified."
    );
  }

  const record = {
    jobId,
    userId: session.user.id,
    applied:
      rows[0].status === "Applied",
  };

  await chrome.storage.session.set({
    [submissionKey(tabId)]: record,
  });

  if (!record.applied) {
    await installSubmissionWatcher(
      tabId
    );
  }

  return { ok: true };
}


// =========================================
// 10. MARK CONFIRMED SUBMISSION
// =========================================

async function markConfirmedSubmission(
  tabId
) {
  const key = submissionKey(tabId);

  if (
    submissionUpdatesInProgress.has(
      tabId
    )
  ) {
    return {
      ok: false,
      reason: "Already checking",
    };
  }

  submissionUpdatesInProgress.add(
    tabId
  );

  try {
    const stored =
      await chrome.storage.session.get(
        key
      );

    const record = stored[key];

    if (
      !record ||
      record.applied
    ) {
      return {
        ok: false,
        reason: "No pending job",
      };
    }

    const tab =
      await chrome.tabs.get(tabId);

    if (
      !isSupportedApplicationUrl(tab.url)
    ) {
      return {
        ok: false,
        reason:
          "Not on a supported confirmation page",
      };
    }

    const confirmed =
      await checkSubmissionPage(
        tabId
      );

    if (!confirmed) {
      return {
        ok: false,
        reason:
          "Submission is not confirmed",
      };
    }

    const session =
      await getSubmissionSession();

    if (
      session.user.id !==
      record.userId
    ) {
      throw new Error(
        "Offerly account changed."
      );
    }

    const query = new URLSearchParams({
      select: "id,status",
      id: `eq.${record.jobId}`,
      user_id:
        `eq.${session.user.id}`,
      limit: "1",
    });

    const rows =
      await submissionRequest(
        `applications?${query}`
      );

    if (!rows?.length) {
      throw new Error(
        "Application record not found."
      );
    }

    if (
      rows[0].status !== "Applied"
    ) {
      const updateQuery =
        new URLSearchParams({
          id: `eq.${record.jobId}`,
          user_id:
            `eq.${session.user.id}`,
          status: "eq.Saved",
        });

      const updated =
        await submissionRequest(
          `applications?${updateQuery}`,
          {
            method: "PATCH",
            headers: {
              Prefer:
                "return=representation",
            },
            body: JSON.stringify({
              status: "Applied",
              date_applied:
                new Date()
                  .toISOString()
                  .slice(0, 10),
            }),
          }
        );

      if (!updated?.length) {
        return {
          ok: false,
          reason:
            "Application status changed elsewhere",
        };
      }
    }

    await chrome.storage.session.set({
      [key]: {
        ...record,
        applied: true,
      },
    });

    console.info(
      "Offerly automatically marked application Applied:",
      record.jobId
    );

    return { ok: true };
  } finally {
    submissionUpdatesInProgress.delete(
      tabId
    );
  }
}


// =========================================
// 11. REGISTER APPLICATION MESSAGE
// =========================================

chrome.runtime.onMessage.addListener(
  (message, sender, reply) => {
    if (
      message?.type !==
      "OFFERLY_TRACK_APPLICATION"
    ) {
      return false;
    }

    if (!isOfferlyInterface(sender)) {
      reply({
        ok: false,
        reason: "Untrusted sender",
      });

      return false;
    }

    registerSubmissionTab(
      message.tabId,
      message.jobId
    )
      .then(reply)
      .catch((error) => {
        reply({
          ok: false,
          reason: error.message,
        });
      });

    return true;
  }
);


// =========================================
// 12. SUBMISSION CONFIRMATION MESSAGE
// =========================================

chrome.runtime.onMessage.addListener(
  (message, sender, reply) => {
    if (
      message?.type !==
      "OFFERLY_SUBMISSION_CONFIRMED"
    ) {
      return false;
    }

    if (!sender.tab?.id) {
      reply({ ok: false });
      return false;
    }

    markConfirmedSubmission(
      sender.tab.id
    )
      .then(reply)
      .catch((error) => {
        console.error(
          "Offerly submission update:",
          error
        );

        reply({
          ok: false,
          reason: error.message,
        });
      });

    return true;
  }
);


// =========================================
// 13. REINSTALL SUBMISSION WATCHER
// =========================================

chrome.tabs.onUpdated.addListener(
  async (
    tabId,
    changeInfo,
    tab
  ) => {
    if (
      changeInfo.status !==
      "complete"
    ) {
      return;
    }

    const key =
      submissionKey(tabId);

    try {
      const stored =
        await chrome.storage.session.get(
          key
        );

      const record = stored[key];

      if (
        record &&
        !record.applied &&
        isSupportedApplicationUrl(
          tab.url
        )
      ) {
        await installSubmissionWatcher(
          tabId
        );
      }
    } catch (error) {
      console.warn(
        "Offerly submission watcher:",
        error
      );
    }
  }
);


// =========================================
// 14. CLEAN UP CLOSED TABS
// =========================================

chrome.tabs.onRemoved.addListener(
  async (tabId) => {
    try {
      await chrome.storage.session.remove(
        submissionKey(tabId)
      );
    } catch (error) {
      console.warn(
        "Offerly tab cleanup:",
        error
      );
    }
  }
);

// Written-answer requests from Offerly's injected editor.
chrome.runtime.onMessage.addListener(
  (message, sender, reply) => {
    if (message?.type !== "OFFERLY_DRAFT_REQUEST") {
      return false;
    }

    if (
      sender.id !== chrome.runtime.id ||
      !sender.tab?.id ||
      sender.frameId !== 0 ||
      !/^https:\/\//i.test(sender.url || "")
    ) {
      reply({ error: "Open an HTTPS job application page." });
      return false;
    }

    (async () => {
      const payload = message.payload;

      if (
        !payload ||
        !["draftAnswer", "draftCoverLetter"].includes(payload.mode)
      ) {
        throw new Error("Invalid draft request.");
      }

      const session = await getSubmissionSession();

      const response = await fetch(
        `${OFFERLY_BASE}/functions/v1/offerly-ai-agent`,
        {
          method: "POST",
          signal: AbortSignal.timeout(60_000),
          headers: {
            apikey: OFFERLY_KEY,
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            mode: payload.mode,
            question: payload.question,
            jobDescription: payload.jobDescription,
            company: payload.company,
            role: payload.role,
            existingDraft: payload.existingDraft,
            tone: payload.tone,
            maxWords: payload.maxWords,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Could not generate a draft.");
      }

      return result;
    })()
      .then(reply)
      .catch(error => {
        reply({
          error: error.message || "Could not generate a draft.",
        });
      });

    return true;
  }
);