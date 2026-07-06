const SUPABASE_URL = "https://cezdzqaayzlalspukapl.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_IT1rTAKqu7oUP9oILUIyaQ_fm_DOAir";

const EXTRACT_JOB_URL =
  "https://cezdzqaayzlalspukapl.supabase.co/functions/v1/extract-job";

let scrapedData = null;

async function getCurrentTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function getStoredSession() {
  const data = await chrome.storage.local.get(["offerlySession"]);
  return data.offerlySession || null;
}

async function setStoredSession(session) {
  await chrome.storage.local.set({ offerlySession: session });
}

async function clearStoredSession() {
  await chrome.storage.local.remove(["offerlySession"]);
}

function showLoginView() {
  document.getElementById("loginView").classList.remove("hidden");
  document.getElementById("saveView").classList.add("hidden");
}

function showSaveView() {
  document.getElementById("loginView").classList.add("hidden");
  document.getElementById("saveView").classList.remove("hidden");
}

async function loginWithEmailPassword(email, password) {
  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      apikey: SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error_description || data.msg || "Login failed");
  }

  return data;
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

async function extractJobWithAI(data) {
  const response = await fetch(EXTRACT_JOB_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "extract", ...data }),
  });

  if (!response.ok) {
    console.error("Extract failed:", await response.text());
    return {};
  }

  return await response.json();
}

async function analyzeCurrentPage() {
  const status = document.getElementById("status");
  const tab = await getCurrentTab();

  status.textContent = "Analyzing job page...";

  scrapedData = await scrapeJobPage(tab.id);
  const extracted = await extractJobWithAI(scrapedData);

  document.getElementById("company").value = extracted.company || "";
  document.getElementById("role").value =
    extracted.role || scrapedData.h1 || scrapedData.title || "";
  document.getElementById("location").value = extracted.location || "";

  status.textContent = "Ready to save.";
}

async function saveJobToOfferly() {
  const status = document.getElementById("status");
  const saveBtn = document.getElementById("saveBtn");

  try {
    status.textContent = "Saving to Offerly...";
    saveBtn.disabled = true;

    const session = await getStoredSession();

    if (!session?.user?.id) {
      status.textContent = "Please log in first.";
      saveBtn.disabled = false;
      showLoginView();
      return;
    }

    const tab = await getCurrentTab();

    const payload = {
      action: "save",
      userId: session.user.id,
      url: tab.url,
      title: scrapedData?.title || "",
      h1: scrapedData?.h1 || "",
      pageText: scrapedData?.pageText || "",
      company: document.getElementById("company").value,
      role: document.getElementById("role").value,
      location: document.getElementById("location").value,
    };

    const response = await fetch(EXTRACT_JOB_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok || result.error) {
      console.error("Save failed:", result);
      status.textContent = "Save failed.";
      saveBtn.disabled = false;
      return;
    }

    status.textContent = "Saved to Offerly ✓";
    saveBtn.textContent = "Saved";
  } catch (error) {
    console.error(error);
    status.textContent = "Save failed.";
    saveBtn.disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const session = await getStoredSession();

  if (!session?.user?.id) {
    showLoginView();
    return;
  }

  showSaveView();

  try {
    await analyzeCurrentPage();
  } catch (error) {
    console.error(error);
    document.getElementById("status").textContent =
      "Could not analyze this page.";
  }
});

document.getElementById("loginBtn").addEventListener("click", async () => {
  const email = document.getElementById("emailInput").value.trim();
  const password = document.getElementById("passwordInput").value;
  const loginStatus = document.getElementById("loginStatus");

  if (!email || !password) {
    loginStatus.textContent = "Enter email and password.";
    return;
  }

  try {
    loginStatus.textContent = "Logging in...";

    const session = await loginWithEmailPassword(email, password);
    await setStoredSession(session);

    loginStatus.textContent = "";
    showSaveView();
    await analyzeCurrentPage();
  } catch (error) {
    console.error(error);
    loginStatus.textContent = error.message;
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await clearStoredSession();
  showLoginView();
});

document.getElementById("saveBtn").addEventListener("click", saveJobToOfferly);