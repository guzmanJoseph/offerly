
/*
 * Offerly Background Service Worker
 *
 * Features:
 * - Tab-specific Chrome side panel
 * - Browser-level dropdown clicking
 * - Preserves existing autofill functionality
 */

// -----------------------------------------
// TAB-SPECIFIC SIDE PANEL
// -----------------------------------------


// -----------------------------------------
// TAB-SPECIFIC SIDE PANEL
// -----------------------------------------

async function preparePanel(tabId) {
  if (!Number.isInteger(tabId)) return;

  try {
    await chrome.sidePanel.setOptions({
      tabId,
      path: "sidepanel.html",
      enabled: true,
    });
  } catch (error) {
    console.error("Offerly panel setup:", error);
  }
}

// Configure tabs ahead of time.
chrome.runtime.onInstalled.addListener(async () => {
  const tabs = await chrome.tabs.query({});

  for (const tab of tabs) {
    await preparePanel(tab.id);
  }
});

chrome.tabs.onCreated.addListener((tab) => {
  preparePanel(tab.id);
});

chrome.tabs.onActivated.addListener(({ tabId }) => {
  preparePanel(tabId);
});

// Do not automatically open a global panel.
chrome.sidePanel.setPanelBehavior({
  openPanelOnActionClick: false,
}).catch(console.error);

// This MUST run directly from the toolbar click.
chrome.action.onClicked.addListener((tab) => {
  if (!tab?.id) return;

  chrome.sidePanel.open({
    tabId: tab.id,
  }).catch((error) => {
    console.error("Offerly side panel:", error);
  });
});


// -----------------------------------------
// BROWSER-LEVEL DROPDOWN CLICKS
// -----------------------------------------

chrome.runtime.onMessage.addListener(
  (message, sender, reply) => {
    if (
      message?.type !== "OFFERLY_TRUSTED_CLICK"
    ) {
      return;
    }

    (async () => {
      const { tabId, x, y } = message;

      // Accept requests only from Offerly's own UI.
      const trustedPages = [
        chrome.runtime.getURL("popup.html"),
        chrome.runtime.getURL("sidepanel.html"),
      ];

      if (
        sender.id !== chrome.runtime.id ||
        !trustedPages.includes(sender.url)
      ) {
        throw new Error("Untrusted sender");
      }

      if (
        !Number.isInteger(tabId) ||
        !Number.isFinite(x) ||
        !Number.isFinite(y) ||
        x < 0 ||
        y < 0
      ) {
        throw new Error(
          "Invalid dropdown click coordinates"
        );
      }

      const tab = await chrome.tabs.get(tabId);

      const [active] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (
        tabId !== active?.id ||
        !/^https:\/\//i.test(tab.url || "")
      ) {
        throw new Error(
          "Choose an active HTTPS application tab"
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
    })()
      .then(reply)
      .catch((error) => {
        reply({
          ok: false,
          error: error.message,
        });
      });

    return true;
  }
);


/*
 * Offerly Application Submission Tracking
 *
 * Remembers the application ID associated with
 * a tab and changes Saved -> Applied only after
 * a verified submission confirmation.
 */

const OFFERLY_BASE =
  "https://cezdzqaayzlalspukapl.supabase.co";

const OFFERLY_KEY =
  "sb_publishable_IT1rTAKqu7oUP9oILUIyaQ_fm_DOAir";

const submissionUpdatesInProgress = new Set();

function submissionKey(tabId) {
  return `offerlySubmissionTab_${tabId}`;
}


function isSupportedApplicationUrl(url) {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    if (parsed.protocol !== "https:") {
      return false;
    }

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


async function getSubmissionSession() {
  let { offerlySession: session } =
    await chrome.storage.local.get("offerlySession");

  if (!session?.user?.id) {
    throw new Error("Offerly is not signed in");
  }

  const now = Math.floor(Date.now() / 1000);

  if (
    session.access_token &&
    session.expires_at > now + 60
  ) {
    return session;
  }

  if (!session.refresh_token) {
    throw new Error("Offerly session expired");
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
        refresh_token: session.refresh_token,
      }),
    }
  );

  const refreshed = await response.json();

  if (!response.ok || !refreshed.access_token) {
    throw new Error("Could not refresh Offerly session");
  }

  session = refreshed;

  await chrome.storage.local.set({
    offerlySession: session,
  });

  return session;
}

async function submissionRequest(path, options = {}) {
  const session = await getSubmissionSession();

  const response = await fetch(
    `${OFFERLY_BASE}/rest/v1/${path}`,
    {
      ...options,
      headers: {
        apikey: OFFERLY_KEY,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    }
  );

  if (!response.ok) {
    const details = await response.text();

    throw new Error(
      `Offerly update failed (${response.status}): ${details}`
    );
  }

  if (response.status === 204) return null;

  return response.json();
}

async function installSubmissionWatcher(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ["submissionWatch.js"],
    });
  } catch (error) {
    // A tab might be navigating or closing.
    console.warn(
      "Offerly couldn't install submission watcher:",
      error.message
    );
  }
}

async function checkSubmissionPage(tabId) {
  const results = await chrome.scripting.executeScript({
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

  // Ashby
  /we have received your application/i,
  /we've received your application/i,
  /thank you for your interest in .+we have received your application/i,
];


      const nodes = document.querySelectorAll(
        "h1, h2, h3, [role='alert'], [role='status'], " +
        "[class*='confirmation'], [class*='success']"
      );

      return [...nodes].some((node) => {
        const text = String(node.textContent || "")
          .replace(/\s+/g, " ")
          .trim();

        return (
          text.length > 0 &&
          text.length <= 180 &&
          patterns.some((pattern) =>
            pattern.test(text)
          )
        );
      });
    },
  });

  return results?.[0]?.result === true;
}

async function registerSubmissionTab(tabId, jobId) {
  const tab = await chrome.tabs.get(tabId);

  if (!isGreenhouseUrl(tab.url)) {
    return {
      ok: false,
      reason: "Not a Greenhouse application tab",
    };
  }

  const session = await getSubmissionSession();

  // Verify that the application belongs to the
  // authenticated Offerly account.
  const query = new URLSearchParams({
    select: "id,status",
    id: `eq.${jobId}`,
    user_id: `eq.${session.user.id}`,
    limit: "1",
  });

  const rows = await submissionRequest(
    `applications?${query}`
  );

  if (!rows?.length) {
    throw new Error(
      "Saved application could not be verified"
    );
  }

  const record = {
    jobId,
    userId: session.user.id,
    applied: rows[0].status === "Applied",
  };

  await chrome.storage.session.set({
    [submissionKey(tabId)]: record,
  });

  if (!record.applied) {
    await installSubmissionWatcher(tabId);
  }

  return { ok: true };
}

async function markConfirmedSubmission(tabId) {
  const key = submissionKey(tabId);

  if (submissionUpdatesInProgress.has(tabId)) {
    return { ok: false, reason: "Already checking" };
  }

  submissionUpdatesInProgress.add(tabId);

  try {
    const stored = await chrome.storage.session.get(key);
    const record = stored[key];

    if (!record || record.applied) {
      return { ok: false, reason: "No pending job" };
    }

    const tab = await chrome.tabs.get(tabId);

    // Only accept a Greenhouse confirmation.
    if (!isGreenhouseUrl(tab.url)) {
      return {
        ok: false,
        reason: "Not on a Greenhouse confirmation page",
      };
    }

    // Independently verify the page contents.
    const confirmed = await checkSubmissionPage(tabId);

    if (!confirmed) {
      return {
        ok: false,
        reason: "Submission is not confirmed",
      };
    }

    const session = await getSubmissionSession();

    if (session.user.id !== record.userId) {
      throw new Error("Offerly account changed");
    }

    // Recheck the record before updating.
    const query = new URLSearchParams({
      select: "id,status",
      id: `eq.${record.jobId}`,
      user_id: `eq.${session.user.id}`,
      limit: "1",
    });

    const rows = await submissionRequest(
      `applications?${query}`
    );

    if (!rows?.length) {
      throw new Error("Application record not found");
    }

    if (rows[0].status !== "Applied") {
      const updateQuery = new URLSearchParams({
        id: `eq.${record.jobId}`,
        user_id: `eq.${session.user.id}`,
        status: "eq.Saved",
      });

      const updated = await submissionRequest(
        `applications?${updateQuery}`,
        {
          method: "PATCH",
          headers: {
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            status: "Applied",
            date_applied:
              new Date().toISOString().slice(0, 10),
          }),
        }
      );

      if (!updated?.length) {
        return {
          ok: false,
          reason: "Application status changed elsewhere",
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
    submissionUpdatesInProgress.delete(tabId);
  }
}

// The Offerly popup/side panel registers the job.
chrome.runtime.onMessage.addListener(
  (message, sender, reply) => {
    if (
      message?.type !== "OFFERLY_TRACK_APPLICATION"
    ) {
      return;
    }

    const allowedSenders = [
      chrome.runtime.getURL("popup.html"),
      chrome.runtime.getURL("sidepanel.html"),
    ];

    if (
      sender.id !== chrome.runtime.id ||
      !allowedSenders.includes(sender.url)
    ) {
      reply({ ok: false, reason: "Untrusted sender" });
      return;
    }

    registerSubmissionTab(
      message.tabId,
      message.jobId
    )
      .then(reply)
      .catch((error) => {
        reply({ ok: false, reason: error.message });
      });

    return true;
  }
);

// A confirmation is reported from the job webpage.
chrome.runtime.onMessage.addListener(
  (message, sender, reply) => {
    if (
      message?.type !== "OFFERLY_SUBMISSION_CONFIRMED"
    ) {
      return;
    }

    if (!sender.tab?.id) {
      reply({ ok: false });
      return;
    }

    markConfirmedSubmission(sender.tab.id)
      .then(reply)
      .catch((error) => {
        console.error(
          "Offerly submission update:",
          error
        );

        reply({ ok: false, reason: error.message });
      });

    return true;
  }
);

// Reinstall the watcher when Greenhouse navigates
// to a new page in the same browser tab.
chrome.tabs.onUpdated.addListener(
  async (tabId, changeInfo, tab) => {
    if (changeInfo.status !== "complete") return;

    const key = submissionKey(tabId);
    const stored = await chrome.storage.session.get(key);
    const record = stored[key];

    if (
      record &&
      !record.applied &&
      isGreenhouseUrl(tab.url)
    ) {
      await installSubmissionWatcher(tabId);
    }
  }
);

// Clean up when the application tab is closed.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await chrome.storage.session.remove(
    submissionKey(tabId)
  );
});
