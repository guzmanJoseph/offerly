
/*
 * Offerly Autofill Controller
 *
 * Requires:
 * popup.js
 * dropdownDriver.js
 * smartAnswers.js
 *
 * Keeps:
 * - Existing account authentication
 * - Personal information autofill
 * - Default resume attachment
 * - Automatic dropdown answers
 * - Compact list of unanswered questions
 *
 * Never submits a job application.
 */

(() => {
  const BASE =
    "https://cezdzqaayzlalspukapl.supabase.co";

  const KEY =
    "sb_publishable_IT1rTAKqu7oUP9oILUIyaQ_fm_DOAir";

  const $ = (id) => document.getElementById(id);

  let activeTabId = null;

  const normalize = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  function status(message) {
    const element = $("status");
    if (element) element.textContent = message;
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

      // Fail closed: never autofill voluntary
      // disclosures if consent can't be loaded.
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
  }

  async function callPageEngine(method, ...args) {
    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTabId },

      func: async (methodName, parameters) => {
        const engine = globalThis.offerlyEngine;
        const fn = engine?.[methodName];

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
      (
        method === "getDropdownOptions" ||
        method === "fillAnswer"
      )
    ) {
      const fieldId = args[0];

      const fields = await callPageEngine("scan");

      const field = fields.find(
        (item) => item.id === fieldId
      );

      if (field?.type === "custom") {
        if (method === "getDropdownOptions") {
          return driver.openAndRead(
            activeTabId,
            fieldId
          );
        }

        return driver.fill(
          activeTabId,
          fieldId,
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
  // COMPACT MANUAL REVIEW
  // ------------------------------------

  function needsAttention(field) {
    if (
      !field ||
      field.type === "file" ||
      field.type === "choice" ||
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

  function showCompactNeedsAttention(fields) {
    $("offerlyQuestionReview")?.remove();

    const missing = fields.filter(needsAttention);

    const section = document.createElement("section");
    section.id = "offerlyQuestionReview";
    section.className = "offerly-review";

    const heading = document.createElement("h3");

    heading.textContent = missing.length
      ? `Needs your attention (${missing.length})`
      : "Autofill review";

    section.appendChild(heading);

    const message = document.createElement("p");

    message.textContent = missing.length
      ? "Complete these fields directly on the application:"
      : "No remaining recognized questions were detected. Review the entire application before submitting.";

    section.appendChild(message);

    if (missing.length) {
      const list = document.createElement("ul");
      list.className = "offerly-missing-list";

      const seen = new Set();

      for (const field of missing) {
        const key = normalize(field.label);

        if (seen.has(key)) continue;
        seen.add(key);

        const item = document.createElement("li");

        item.textContent = field.label;
        list.appendChild(item);
      }

      section.appendChild(list);
    }

    const button = $("autofillBtn");

    if (button) {
      button.insertAdjacentElement(
        "afterend",
        section
      );
    }

    return missing.length;
  }

  // ------------------------------------
  // DEFAULT RESUME
  // ------------------------------------

  async function getDefaultResume() {
    const preference = await getRow(
      "resume_preferences",
      "default_resume_name"
    );

    const stored = preference?.default_resume_name;

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

    const path = [session.user.id, stored]
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
      throw new Error("Unsupported resume format.");
    }

    return {
      filename,
      mime: lower.endsWith(".pdf")
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes: Array.from(
        new Uint8Array(await blob.arrayBuffer())
      ),
    };
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

      const [profile, selfId] = await Promise.all([
        getProfile(),
        getSelfIdentification(),
      ]);

      await prepareEngine();

      status("Filling personal information...");

      const textResult = await runEngine(
        "fillText",
        profile
      );

      status("Scanning application questions...");

      const fields = await scanFields();

      let smartResult = {
        filled: 0,
        skipped: [],
        failed: [],
      };

      if (window.offerlySmartAnswers?.apply) {
        status("Automatically filling saved answers...");

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
          "smartAnswers.js is not loaded"
        );
      }

      // Resume attachment runs independently.
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
                result?.reason || "Upload not confirmed"
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

      // Re-scan after ALL filling attempts.
      const finalFields = await scanFields();

      const missing =
        showCompactNeedsAttention(finalFields);

      const totalFilled =
        (textResult?.filled || 0) +
        (smartResult?.filled || 0);

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

  $("autofillBtn")?.addEventListener(
    "click",
    handleAutofill
  );
})();
