
/*
 * Offerly Autofill Controller
 *
 * Works with:
 * - popup.js
 * - dropdownDriver.js
 * - smartAnswers.js
 * - formEngine.js
 * - choiceEngine.js
 * - universalTextEngine.js
 * - workdayExperienceEngine.js
 *
 * Never submits applications.
 */

(() => {
  const BASE =
    "https://cezdzqaayzlalspukapl.supabase.co";

  const KEY =
    "sb_publishable_IT1rTAKqu7oUP9oILUIyaQ_fm_DOAir";

  const $ = (id) => document.getElementById(id);

  const normalize = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  let activeTabId = null;

  function status(message) {
    const element = $("status");

    if (element) {
      element.textContent = message;
    }
  }

  // ------------------------------------
  // SUPABASE
  // ------------------------------------

  async function getRow(table, columns) {
    const session = await getValidSession();

    if (!session?.user?.id) {
      throw new Error("Please log in first.");
    }

    const params = new URLSearchParams({
      select: columns,
      user_id: `eq.${session.user.id}`,
      limit: "1",
    });

    const response = await fetch(
      `${BASE}/rest/v1/${table}?${params}`,
      {
        headers: {
          apikey: KEY,
          Authorization:
            `Bearer ${session.access_token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Could not load ${table} (${response.status})`
      );
    }

    const rows = await response.json();

    return rows[0] || null;
  }

  async function getProfile() {
    const row = await getRow(
      "autofill_profiles",
      "profile_data"
    );

    if (!row?.profile_data) {
      throw new Error(
        "Save your Autofill Profile on Offerly first."
      );
    }

    return row.profile_data;
  }

  async function getSelfIdentification() {
    try {
      const row = await getRow(
        "autofill_self_identification",
        "answers,allow_suggestions,auto_fill_enabled"
      );

      return {
        answers: row?.answers || {},
        allowSuggestions:
          Boolean(row?.allow_suggestions),
        autoFillEnabled:
          Boolean(row?.auto_fill_enabled),
      };
    } catch (error) {
      console.warn(
        "Could not load voluntary answer preferences:",
        error
      );

      // Do not autofill voluntary disclosures
      // if permission settings cannot be loaded.
      return {
        answers: {},
        allowSuggestions: false,
        autoFillEnabled: false,
      };
    }
  }

  // ------------------------------------
  // APPLICATION ENGINE
  // ------------------------------------

  async function prepareEngine() {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (
      !tab?.id ||
      !/^https?:\/\//i.test(tab.url || "")
    ) {
      throw new Error(
        "Open a job application webpage first."
      );
    }

    activeTabId = tab.id;

    await chrome.scripting.executeScript({
      target: { tabId: activeTabId },
      files: ["formEngine.js"],
    });

    return tab;
  }

  async function callPageEngine(method, ...args) {
    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTabId },

      func: async (methodName, parameters) => {
        const fn =
          globalThis.offerlyEngine?.[methodName];

        if (typeof fn !== "function") {
          throw new Error(
            `Form engine method missing: ${methodName}`
          );
        }

        return await fn(...parameters);
      },

      args: [method, args],
    });

    return results?.[0]?.result;
  }

  async function runEngine(method, ...args) {
    if (!activeTabId) {
      throw new Error("No active application tab.");
    }

    const driver = window.offerlyDropdownDriver;

    if (
      driver &&
      ["getDropdownOptions", "fillAnswer"].includes(
        method
      )
    ) {
      const fields = await callPageEngine("scan");

      const field = fields.find(
        (item) => item.id === args[0]
      );

      if (field?.type === "custom") {
        if (method === "getDropdownOptions") {
          return driver.openAndRead(
            activeTabId,
            args[0]
          );
        }

        return driver.fill(
          activeTabId,
          args[0],
          args[1]
        );
      }
    }

    return callPageEngine(method, ...args);
  }

  async function scanFields() {
    const fields = await runEngine("scan");

    if (!Array.isArray(fields)) {
      throw new Error(
        "Application scan failed. Reload Offerly."
      );
    }

    return fields;
  }

  // ------------------------------------
  // NEEDS ATTENTION PANEL
  // ------------------------------------

  function needsAttention(field) {
    if (
      !field ||
      ["file", "choice"].includes(field.type) ||
      String(field.value || "").trim()
    ) {
      return false;
    }

    const label = normalize(field.label);

    if (
      !label ||
      label === "search" ||
      label === "off" ||
      label.startsWith("search off") ||
      label.startsWith("field ") ||
      label.startsWith("react select")
    ) {
      return false;
    }

    return Boolean(
      field.required ||
      field.sensitive ||
      field.employmentQuestion ||
      field.type === "select" ||
      field.type === "custom"
    );
  }

  function showCompactNeedsAttention(
    fields,
    extra = []
  ) {
    $("offerlyQuestionReview")?.remove();

    const questions = [
      ...fields
        .filter(needsAttention)
        .map((field) => field.label),
      ...extra,
    ];

    const unique = [
      ...new Map(
        questions
          .filter(Boolean)
          .map((question) => [
            normalize(question),
            question,
          ])
      ).values(),
    ];

    const section = document.createElement(
      "section"
    );

    section.id = "offerlyQuestionReview";
    section.className = "offerly-review";

    const heading = document.createElement("h3");

    heading.textContent = unique.length
      ? `Needs your attention (${unique.length})`
      : "Autofill review";

    section.appendChild(heading);

    const message = document.createElement("p");

    message.textContent = unique.length
      ? "Complete these fields directly on the application:"
      : "No remaining recognized questions were detected. Review the entire application before submitting.";

    section.appendChild(message);

    if (unique.length) {
      const list = document.createElement("ul");

      list.className = "offerly-missing-list";

      for (const question of unique) {
        const item = document.createElement("li");

        item.textContent = question;

        list.appendChild(item);
      }

      section.appendChild(list);
    }

    $("autofillBtn")?.insertAdjacentElement(
      "afterend",
      section
    );

    return unique.length;
  }

  // ------------------------------------
  // DEFAULT RESUME
  // ------------------------------------

  async function getDefaultResume() {
    const preference = await getRow(
      "resume_preferences",
      "default_resume_name"
    );

    const stored =
      preference?.default_resume_name;

    if (!stored) return null;

    if (
      stored.includes("/") ||
      stored.includes("\\") ||
      stored === "." ||
      stored === ".."
    ) {
      throw new Error("Invalid resume filename.");
    }

    const session = await getValidSession();

    const path = [
      session.user.id,
      stored,
    ]
      .map(encodeURIComponent)
      .join("/");

    const response = await fetch(
      `${BASE}/storage/v1/object/authenticated/resumes/${path}`,
      {
        headers: {
          apikey: KEY,
          Authorization:
            `Bearer ${session.access_token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Resume download failed (${response.status})`
      );
    }

    const blob = await response.blob();

    if (
      !blob.size ||
      blob.size > 5 * 1024 * 1024
    ) {
      throw new Error(
        "Default resume must be between 1 byte and 5 MB."
      );
    }

    const filename = stored.includes("__")
      ? stored.split("__").slice(1).join("__")
      : stored;

    const lower = filename.toLowerCase();

    if (
      !lower.endsWith(".pdf") &&
      !lower.endsWith(".docx")
    ) {
      throw new Error(
        "Unsupported resume format."
      );
    }

    return {
      filename,

      mime: lower.endsWith(".pdf")
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

      bytes: Array.from(
        new Uint8Array(
          await blob.arrayBuffer()
        )
      ),
    };
  }

  // ------------------------------------
  // WORKDAY EXPERIENCE AND EDUCATION
  // ------------------------------------

  async function runWorkday(profile, tab) {
    const fallback = {
      filled: 0,
      needsAttention: [],
    };

    if (
      !/(^|\.)myworkdayjobs\.com$/i.test(
        new URL(tab.url).hostname
      )
    ) {
      return fallback;
    }

    try {
      status(
        "Filling Workday experience and education..."
      );

      await chrome.scripting.executeScript({
        target: { tabId: activeTabId },
        files: ["workdayExperienceEngine.js"],
      });

      const results =
        await chrome.scripting.executeScript({
          target: { tabId: activeTabId },

          func: async (savedProfile) => {
            const engine =
              globalThis.offerlyWorkdayExperience;

            if (
              typeof engine?.fill !== "function"
            ) {
              throw new Error(
                "Workday adapter not loaded."
              );
            }

            return await engine.fill(
              savedProfile
            );
          },

          args: [profile],
        });

      const result =
        results?.[0]?.result || fallback;

      console.info(
        "Offerly Workday experience:",
        result
      );

      return result;
    } catch (error) {
      console.warn(
        "Offerly Workday adapter:",
        error
      );

      return fallback;
    }
  }

  // ------------------------------------
  // UNIVERSAL TEXT AUTOFILL
  // ------------------------------------

  async function runUniversal(profile) {
    const fallback = {
      filled: 0,
      skipped: 0,
    };

    try {
      status(
        "Checking additional application fields..."
      );

      await chrome.scripting.executeScript({
        target: { tabId: activeTabId },
        files: ["universalTextEngine.js"],
      });

      const results =
        await chrome.scripting.executeScript({
          target: { tabId: activeTabId },

          func: (savedProfile) => {
            return (
              globalThis.offerlyUniversalText
                ?.fill(savedProfile) || {
                  filled: 0,
                  skipped: 0,
                }
            );
          },

          args: [profile],
        });

      const result =
        results?.[0]?.result || fallback;

      console.info(
        "Offerly universal autofill:",
        result
      );

      return result;
    } catch (error) {
      console.warn(
        "Universal autofill fallback:",
        error
      );

      return fallback;
    }
  }

  // ------------------------------------
  // CHECKBOX AND BUTTON AUTOFILL
  // ------------------------------------

  async function runChoices(profile, selfId) {
    const fallback = {
      filled: 0,
      skipped: [],
      failed: [],
      needsAttention: [],
    };

    try {
      status(
        "Filling saved button and checkbox answers..."
      );

      await chrome.scripting.executeScript({
        target: { tabId: activeTabId },
        files: ["choiceEngine.js"],
      });

      const results =
        await chrome.scripting.executeScript({
          target: { tabId: activeTabId },

          func: async (
            savedProfile,
            selfIdentification
          ) => {
            return await globalThis
              .offerlyChoiceEngine.apply(
                savedProfile,
                selfIdentification
              );
          },

          args: [profile, selfId],
        });

      const result =
        results?.[0]?.result || fallback;

      console.info(
        "Offerly button autofill:",
        result
      );

      return result;
    } catch (error) {
      console.warn(
        "Offerly choice autofill failed:",
        error
      );

      return fallback;
    }
  }

  // ------------------------------------
  // MAIN AUTOFILL
  // ------------------------------------

  async function handleAutofill() {
    const button = $("autofillBtn");

    if (!button || button.disabled) return;

    button.disabled = true;

    $("offerlyQuestionReview")?.remove();

    try {
      status("Loading your Offerly profile...");

      const [profile, selfId] =
        await Promise.all([
          getProfile(),
          getSelfIdentification(),
        ]);

      const tab = await prepareEngine();

      // Workday fills saved experience and
      // education before generic autofill.
      const workdayResult =
        await runWorkday(profile, tab);

      status("Filling personal information...");

      const textResult = await runEngine(
        "fillText",
        profile
      );

      const universalResult =
        await runUniversal(profile);

      
status("Scanning application questions...");

let fields = [];

try {
  fields = await scanFields();
} catch (error) {
  console.warn(
    "Offerly question scan failed. Continuing with resume upload:",
    error
  );
}


      let smartResult = {
        filled: 0,
        skipped: [],
        failed: [],
      };

      if (
  fields.length > 0 &&
  window.offerlySmartAnswers?.apply
) {
        status(
          "Automatically filling saved answers..."
        );

        smartResult =
          await window.offerlySmartAnswers.apply({
            fields,
            profile,
            selfId,
            tabId: activeTabId,
            runEngine,
          });
      } else {
        console.warn(
          "smartAnswers.js is not loaded."
        );
      }

      const choiceResult =
        await runChoices(profile, selfId);

      // ------------------------------------
      // RESUME UPLOAD
      // ------------------------------------

      let resumeMessage =
        "No default resume selected.";

      try {
        status("Attaching your default resume...");

        const resume = await getDefaultResume();

        if (resume) {
          const result = await runEngine(
            "attachResume",
            resume.bytes,
            resume.filename,
            resume.mime
          );

          resumeMessage = result?.ok
            ? `${resume.filename} selected. Verify the website accepted it.`
            : `Resume needs review: ${
                result?.reason ||
                "Upload not confirmed"
              }`;
        }
      } catch (error) {
        console.error(
          "Resume attachment:",
          error
        );

        resumeMessage =
          `Resume issue: ${error.message}`;
      }

      // ------------------------------------
      // FINAL REVIEW
      // ------------------------------------

      
// Re-scan without allowing a failed question
// scanner to interrupt the autofill process.
let finalFields = [];

try {
  finalFields = await scanFields();
} catch (error) {
  console.warn(
    "Offerly final question scan failed:",
    error
  );
}

const missing = finalFields.length
  ? showCompactNeedsAttention(finalFields)
  : 0;

if (!finalFields.length) {
  status(
    "Question scanning unavailable. Review application fields manually."
  );
}


      const totalFilled =
        (textResult?.filled || 0) +
        (universalResult?.filled || 0) +
        (smartResult?.filled || 0) +
        (choiceResult?.filled || 0) +
        (workdayResult?.filled || 0);

      status(
        `${totalFilled} fields filled. ` +
        `${missing} fields need attention. ` +
        resumeMessage
      );

      if (
        smartResult.failed?.length ||
        smartResult.skipped?.length
      ) {
        console.info(
          "Offerly unresolved saved answers:",
          smartResult
        );
      }
    } catch (error) {
      console.error(
        "Offerly autofill failed:",
        error
      );

      status(
        error.message || "Autofill failed."
      );
    } finally {
      button.disabled = false;
    }
  }

  // ------------------------------------
  // CONNECT AUTOFILL BUTTON
  // ------------------------------------

  $("autofillBtn")?.addEventListener(
    "click",
    handleAutofill
  );
})();
