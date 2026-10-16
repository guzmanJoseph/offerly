
const SUPABASE_URL =
  "https://cezdzqaayzlalspukapl.supabase.co";

const SUPABASE_ANON_KEY =
  "sb_publishable_IT1rTAKqu7oUP9oILUIyaQ_fm_DOAir";

const EXTRACT_JOB_URL =
  `${SUPABASE_URL}/functions/v1/extract-job`;

let scrapedData = null;
let savedJobId = null;
let savedJobTabId = null;

function updateAppliedButton(status = "Saved") {
  const button = document.getElementById("markAppliedBtn");
  const hint = document.getElementById("appliedHint");

  if (!button) return;

  const isApplied = status === "Applied";

  button.disabled = !savedJobId || isApplied;
  button.classList.toggle("applied", isApplied);

  button.textContent = isApplied
    ? "✓ Application Tracked"
    : "✓ Mark as Applied";

  if (hint) {
    hint.textContent = isApplied
      ? "This application is marked Applied in Offerly."
      : "Submit your application on the job website first. Then click here to track it.";
  }
}

const el = (id) => document.getElementById(id);

function setStatus(message) {
  el("status").textContent = message;
}

function setBadge(message) {
  el("saveBadge").textContent = message;
}

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({
    active: true,
    currentWindow: true,
  });
  return tab;
}

async function getStoredSession() {
  const data = await chrome.storage.local.get(
    "offerlySession"
  );
  return data.offerlySession || null;
}

async function setStoredSession(session) {
  await chrome.storage.local.set({
    offerlySession: session,
  });
}

async function clearStoredSession() {
  await chrome.storage.local.remove("offerlySession");
}

function showLoginView() {
  el("loginView").classList.remove("hidden");
  el("saveView").classList.add("hidden");
}

function showSaveView() {
  el("loginView").classList.add("hidden");
  el("saveView").classList.remove("hidden");
}

async function loginWithEmailPassword(email, password) {
  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.error_description ||
      data.msg ||
      "Login failed."
    );
  }

  return data;
}

async function getValidSession() {
  let session = await getStoredSession();

  if (!session?.access_token) {
    throw new Error("Please log in first.");
  }

  const now = Math.floor(Date.now() / 1000);

  if (session.expires_at && session.expires_at > now + 60) {
    return session;
  }

  if (!session.refresh_token) {
    throw new Error("Session expired. Please log in again.");
  }

  const response = await fetch(
    `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        refresh_token: session.refresh_token,
      }),
    }
  );

  const refreshed = await response.json();

  if (!response.ok || !refreshed.access_token) {
    throw new Error("Session expired. Please log in again.");
  }

  session = refreshed;
  await setStoredSession(session);

  return session;
}

async function authenticatedRequest(path, options = {}) {
  const session = await getValidSession();

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${path}`,
    {
      ...options,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    }
  );

  if (!response.ok) {
    const details = await response.text();
    throw new Error(
      `Supabase request failed (${response.status}): ${details}`
    );
  }

  if (response.status === 204) return null;

  const content = await response.text();
  return content ? JSON.parse(content) : null;
}

async function scrapeJobPage(tabId) {
  const [{ result }] = await chrome.scripting.executeScript({
    target: { tabId },
    func: () => ({
      url: window.location.href,
      title: document.title,
      h1: document.querySelector("h1")?.innerText || "",
      pageText: document.body.innerText.slice(0, 12000),
    }),
  });

  return result;
}

async function extractJobWithAI(page) {
  const session = await getValidSession();

  const response = await fetch(EXTRACT_JOB_URL, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      action: "extract",
      ...page,
    }),
  });

  if (!response.ok) {
    throw new Error("Could not extract job details.");
  }

  return response.json();
}

function validJobUrl(url) {
  try {
    const parsed = new URL(url);

    return (
      ["https:", "http:"].includes(parsed.protocol) &&
      !["localhost", "127.0.0.1"].includes(parsed.hostname) &&
      !parsed.hostname.endsWith("offerlyjob.com")
    );
  } catch {
    return false;
  }
}

function normalizeJobUrl(url) {
  const parsed = new URL(url);
  parsed.hash = "";

  // Remove common tracking parameters but keep
  // other parameters that may identify the job.
  for (const key of [...parsed.searchParams.keys()]) {
    if (
      key.toLowerCase().startsWith("utm_") ||
      ["fbclid", "gclid"].includes(key.toLowerCase())
    ) {
      parsed.searchParams.delete(key);
    }
  }

  return parsed.toString();
}

function displayJob(page, extracted) {
  el("company").value = extracted.company || "";
  el("role").value =
    extracted.role || page.h1 || page.title || "";
  el("location").value = extracted.location || "";

  if (validJobUrl(page.url)) {
    el("jobLink").href = page.url;
    el("jobLink").classList.remove("hidden");
  }
}

async function findExistingJob(url) {
  const session = await getValidSession();

  const query = new URLSearchParams({
    select: "id,status",
    user_id: `eq.${session.user.id}`,
    job_url: `eq.${url}`,
    limit: "1",
  });

  const rows = await authenticatedRequest(
    `applications?${query.toString()}`
  );

  return rows?.[0] || null;
}

async function saveDetectedJob(page) {
  const session = await getValidSession();
  const url = normalizeJobUrl(page.url);

  const existing = await findExistingJob(url);

  
if (existing) {
  savedJobId = existing.id;
  savedJobTabId = (await getCurrentTab())?.id ?? null;

  setBadge(existing.status || "Already saved");

  setStatus(
    existing.status === "Applied"
      ? "This application is already tracked as Applied."
      : "This job is already in your Offerly dashboard."
  );

  updateAppliedButton(existing.status);

  return;
}


  const company = el("company").value.trim();
  const role = el("role").value.trim();
  const location = el("location").value.trim();

  // Avoid saving pages that lack basic job details.
  if (!company || !role) {
    setBadge("Review needed");
    setStatus(
      "Couldn't identify the company and role. This job wasn't saved."
    );
    return;
  }

  setBadge("Saving...");

  const rows = await authenticatedRequest("applications", {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      user_id: session.user.id,
      company,
      role,
      location,
      job_url: url,
      status: "Saved",
      date_applied: null,
      priority: "Medium",
      notes: "",
    }),
  });

  
savedJobTabId = (await getCurrentTab())?.id ?? null;
updateAppliedButton("Saved");
setBadge("✓ Saved");
setStatus("Job saved to Offerly. Ready to autofill?");

await trackApplicationSubmission(savedJobId);

}

async function analyzeAndSaveCurrentPage() {
  savedJobId = null;
savedJobTabId = null;
updateAppliedButton();
  const tab = await getCurrentTab();

  if (!tab?.id || !validJobUrl(tab.url)) {
    setBadge("No job detected");
    setStatus("Open a job application webpage first.");
    return;
  }

  setBadge("Analyzing...");
  setStatus("Detecting job details...");

  scrapedData = await scrapeJobPage(tab.id);

  if (!validJobUrl(scrapedData.url)) {
    throw new Error("This isn't a supported job page.");
  }

  // Prevent saving a job again if the same normalized
  // URL already exists. The AI call is still used to
  // populate the details card.
  const extracted = await extractJobWithAI(scrapedData);

  displayJob(scrapedData, extracted);

const looksLikeJob =
  /\/(jobs?|careers?|positions?|apply|applications?)\b/i.test(
    new URL(scrapedData.url).pathname
  ) ||
  /greenhouse\.io|lever\.co|myworkdayjobs\.com|ashbyhq\.com/i.test(
    new URL(scrapedData.url).hostname
  );

if (!looksLikeJob) {
  setBadge("Review needed");
  setStatus(
    "Job details detected, but this page wasn't auto-saved. " +
    "Open the specific job posting to save it."
  );
  return;
}


async function trackApplicationSubmission(jobId) {
  if (!jobId) return;

  const tab = await getCurrentTab();

  if (!tab?.id) return;

  const result = await chrome.runtime.sendMessage({
    type: "OFFERLY_TRACK_APPLICATION",
    tabId: tab.id,
    jobId,
  });

  if (!result?.ok) {
    console.info(
      "Offerly submission tracking not enabled:",
      result?.reason
    );
  }
}

await saveDetectedJob(scrapedData);
}

async function initializePopup() {
  try {
    const session = await getStoredSession();

    if (!session?.access_token) {
      showLoginView();
      return;
    }

    await getValidSession();
    showSaveView();
    await analyzeAndSaveCurrentPage();
  } catch (error) {
    console.error("Offerly initialization:", error);

    if (error.message.includes("Session expired")) {
      await clearStoredSession();
      showLoginView();
      el("loginStatus").textContent = error.message;
      return;
    }

    showSaveView();
    setBadge("Error");
    setStatus(error.message);
  }
}

document.addEventListener(
  "DOMContentLoaded",
  initializePopup
);

el("loginBtn").addEventListener("click", async () => {
  const email = el("emailInput").value.trim();
  const password = el("passwordInput").value;
  const button = el("loginBtn");

  if (!email || !password) {
    el("loginStatus").textContent =
      "Enter your email and password.";
    return;
  }

  button.disabled = true;
  el("loginStatus").textContent = "Logging in...";

  try {
    const session = await loginWithEmailPassword(
      email,
      password
    );

    await setStoredSession(session);
    el("loginStatus").textContent = "";

    showSaveView();
    await analyzeAndSaveCurrentPage();
  } catch (error) {
    console.error(error);
    el("loginStatus").textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

el("logoutBtn").addEventListener("click", async () => {
  await clearStoredSession();
  showLoginView();
});

el("notNowBtn").addEventListener("click", () => {
  setStatus(
    "No problem. Your job is saved if the badge says Saved."
  );
});


// -----------------------------------------
// MANUAL MARK AS APPLIED
// -----------------------------------------

document
  .getElementById("markAppliedBtn")
  ?.addEventListener("click", async () => {
    const button = document.getElementById("markAppliedBtn");

    if (!savedJobId || !savedJobTabId) {
      setStatus("Wait for Offerly to save this job first.");
      return;
    }

    const activeTab = await getCurrentTab();

    if (activeTab?.id !== savedJobTabId) {
      setStatus(
        "Switch back to the application tab and try again."
      );
      return;
    }

    const company =
      document.getElementById("company")?.value || "this company";

    const role =
      document.getElementById("role")?.value || "this position";

    const confirmed = window.confirm(
      `Have you successfully submitted your application for ${role} at ${company}?\n\n` +
      "Only continue if the employer's website confirmed your submission."
    );

    if (!confirmed) return;

    // Capture the correct application before the request.
    const jobId = savedJobId;

    button.disabled = true;
    button.textContent = "Updating application...";

    try {
      const session = await getValidSession();

      const filters = new URLSearchParams({
        id: `eq.${jobId}`,
        user_id: `eq.${session.user.id}`,
        status: "eq.Saved",
      });

      const updated = await authenticatedRequest(
        `applications?${filters.toString()}`,
        {
          method: "PATCH",
          headers: {
            Prefer: "return=representation",
          },
          body: JSON.stringify({
            status: "Applied",
            date_applied: [
  new Date().getFullYear(),
  String(new Date().getMonth() + 1).padStart(2, "0"),
  String(new Date().getDate()).padStart(2, "0"),
].join("-"),
          }),
        }
      );

      // Guard against changing a job that was
      // updated elsewhere or no longer exists.
      if (!updated?.length) {
        const query = new URLSearchParams({
          select: "id,status",
          id: `eq.${jobId}`,
          user_id: `eq.${session.user.id}`,
          limit: "1",
        });

        const current = await authenticatedRequest(
          `applications?${query.toString()}`
        );

        if (current?.[0]?.status !== "Applied") {
          throw new Error(
            "The job was not updated. Refresh Offerly and try again."
          );
        }
      }

      if (savedJobId === jobId) {
        setBadge("✓ Applied");

        setStatus(
          "Application successfully marked Applied!"
        );

        updateAppliedButton("Applied");

        // Hide outdated autofill questions.
        document
          .getElementById("offerlyQuestionReview")
          ?.remove();

        // Hide the autofill prompt after tracking.
        const autofill =
          document.getElementById("autofillBtn");

        if (autofill) {
          autofill.disabled = true;
          autofill.textContent = "✓ Application Tracked";
        }
      }
    } catch (error) {
      console.error("Offerly mark applied:", error);

      setStatus(
        error.message || "Could not update application."
      );

      if (savedJobId === jobId) {
        updateAppliedButton("Saved");
      }
    }
  });

// Autofill button is handled by profileAutofill.js.
