
/*
 * Offerly popup autofill controller
 * Requires popup.js to load first.
 */
(() => {
  const BASE =
    "https://cezdzqaayzlalspukapl.supabase.co";

  const KEY =
    "sb_publishable_IT1rTAKqu7oUP9oILUIyaQ_fm_DOAir";

  const $ = (id) => document.getElementById(id);

  let activeTabId = null;

  const normalize = (s) =>
    String(s ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  function status(message) {
    const el = $("status");
    if (el) el.textContent = message;
  }

  async function getRow(table, columns) {
    const session = await getValidSession();

    if (!session?.user?.id) {
      throw new Error("Please log in first.");
    }

    const params = new URLSearchParams({
      select: columns,
      user_id: `eq.${session.user.id}`,
      limit: "1"
    });

    const response = await fetch(
      `${BASE}/rest/v1/${table}?${params}`,
      {
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${session.access_token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Could not load ${table}: ${response.status}`
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
        "answers,allow_suggestions"
      );

      if (!row?.allow_suggestions) return null;
      return row.answers || null;
    } catch (error) {
      // Optional data should not block basic autofill.
      console.warn("Self-ID suggestions unavailable:", error);
      return null;
    }
  }

  async function prepareEngine() {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true
    });

    if (
      !tab?.id ||
      !/^https?:\/\//.test(tab.url || "")
    ) {
      throw new Error(
        "Open a job application webpage first."
      );
    }

    activeTabId = tab.id;

    await chrome.scripting.executeScript({
      target: { tabId: activeTabId },
      files: ["formEngine.js"]
    });
  }

  async function runEngine(method, ...args) {
    const results = await chrome.scripting.executeScript({
      target: { tabId: activeTabId },
      func: async (methodName, parameters) => {
        const fn = globalThis.offerlyEngine?.[methodName];

        if (typeof fn !== "function") {
          throw new Error(
            `Form engine method missing: ${methodName}`
          );
        }

        return await fn(...parameters);
      },
      args: [method, args]
    });

    return results?.[0]?.result;
  }

  async function scanFields() {
    const result = await runEngine("scan");

    if (!Array.isArray(result)) {
      throw new Error(
        "Application scan failed. Reload the extension."
      );
    }

    return result;
  }

  function questionNeeded(field) {
    if (
      !field ||
      field.type === "file" ||
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
      label.startsWith("off ") ||
      label.startsWith("field ")
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

  function suggestedAnswer(field, profile, selfId) {
    if (!selfId || !field.sensitive) return "";

    const label = normalize(field.label);

    if (/hispanic|latino/.test(label)) {
      return selfId.hispanicLatino || "";
    }

    if (/veteran/.test(label)) {
      return selfId.veteranStatus || "";
    }

    if (/gender/.test(label)) {
      return selfId.gender || "";
    }

    if (/disabil/.test(label)) {
      return selfId.disabilityStatus || "";
    }

    // Race/ethnicity can be multi-select.
    // Do not reduce multiple saved identities
    // to one option without user review.
    return "";
  }

  function createText(tag, content, className = "") {
    const element = document.createElement(tag);
    element.textContent = content;
    if (className) element.className = className;
    return element;
  }

  async function fillKnownDropdowns(fields, profile) {
    let count = 0;

    for (const field of fields) {
      if (
        !["select", "custom"].includes(field.type) ||
        field.value ||
        field.sensitive ||
        field.employmentQuestion
      ) continue;

      const label = normalize(field.label);

      // Do not assume a phone dialing country is
      // identical to country of residence.
      const isResidence =
        label === "country of residence" ||
        label === "residence country";

      if (!isResidence || !profile.country) continue;

      try {
        const result = await runEngine(
          "fillAnswer",
          field.id,
          profile.country
        );

        if (result?.ok) count++;
      } catch (error) {
        console.warn("Country dropdown:", error);
      }
    }

    return count;
  }

  async function showQuestions(fields, profile, selfId) {
    $("offerlyQuestionReview")?.remove();

    const questions = fields.filter(questionNeeded);

    if (!questions.length) return 0;

    const section = document.createElement("section");
    section.id = "offerlyQuestionReview";
    section.className = "offerly-review";

    section.append(
      createText(
        "h3",
        `Questions to review (${questions.length})`
      ),
      createText(
        "p",
        "Select answers below. Offerly won't submit the application."
      )
    );

    const entries = [];

    for (const field of questions) {
      const wrapper = document.createElement("div");
      wrapper.className = "offerly-question";

      const label = createText(
        "label",
        field.label.replace(/\s*\|\s*/g, " · ")
      );

      wrapper.append(label);

      const dropdown =
        field.type === "custom" ||
        field.type === "select";

      const input = document.createElement(
        dropdown ? "select" : "input"
      );

      if (!dropdown) {
        input.type = "text";
        input.placeholder = "Enter your answer";
      }

      function setOptions(options) {
        input.replaceChildren(
          new Option("Choose an answer", "")
        );

        for (const option of options || []) {
          if (!option?.label) continue;

          input.add(
            new Option(option.label, option.value)
          );
        }
      }

      let suggestion = suggestedAnswer(
        field, profile, selfId
      );

      function offerSuggestion() {
        if (!suggestion || !dropdown) return;

        const matching = [...input.options].find(
          (option) =>
            normalize(option.textContent) ===
            normalize(suggestion)
        );

        if (!matching) return;

        // Preselect only in the Offerly review UI,
        // never in the employer's application.
        input.value = matching.value;

        wrapper.append(
          createText(
            "p",
            "Suggested from your saved preferences. " +
            "Please confirm before applying.",
            "af-muted"
          )
        );
      }

      if (dropdown) {
        setOptions(field.options);

        if (field.type === "custom") {
          const load = createText(
            "button",
            "Show dropdown options",
            "secondary-btn"
          );

          load.type = "button";

          load.addEventListener("click", async () => {
            load.disabled = true;
            load.textContent = "Loading options...";

            try {
              const result = await runEngine(
                "getDropdownOptions",
                field.id
              );

              if (result?.ok && result.options?.length) {
                setOptions(result.options);
                offerSuggestion();
                load.textContent = "Refresh options";
              } else {
                load.textContent =
                  result?.reason || "Options unavailable";
              }
            } catch (error) {
              console.error("Dropdown loading:", error);
              load.textContent = "Could not load options";
            } finally {
              load.disabled = false;
            }
          });

          wrapper.append(load);
        } else {
          offerSuggestion();
        }
      }

      wrapper.append(input);

      if (field.sensitive) {
        wrapper.append(
          createText(
            "p",
            "Voluntary information. You decide whether to disclose it.",
            "af-muted"
          )
        );
      }

      if (field.employmentQuestion) {
        wrapper.append(
          createText(
            "p",
            "Check this employer's exact eligibility requirements.",
            "af-muted"
          )
        );
      }

      entries.push({ field, input });
      section.append(wrapper);
    }

    const applyButton = createText(
      "button",
      "Apply Selected Answers"
    );

    applyButton.type = "button";

    applyButton.addEventListener("click", async () => {
      applyButton.disabled = true;

      let applied = 0;
      const failures = [];

      try {
        for (const { field, input } of entries) {
          if (!String(input.value || "").trim()) {
            continue;
          }

          try {
            const result = await runEngine(
              "fillAnswer",
              field.id,
              input.value
            );

            if (result?.ok) {
              applied++;
            } else {
              failures.push(
                `${field.label}: ${result?.reason || "not filled"}`
              );
            }
          } catch (error) {
            failures.push(
              `${field.label}: ${error.message}`
            );
          }
        }

        status(
          `${applied} answers applied. ` +
          (failures.length
            ? `${failures.length} need manual review.`
            : "Review the application before submitting.")
        );

        if (failures.length) {
          console.warn(
            "Offerly fields requiring review:",
            failures
          );
        }
      } finally {
        applyButton.disabled = false;
      }
    });

    section.append(applyButton);

    $("autofillBtn")?.insertAdjacentElement(
      "afterend",
      section
    );

    return questions.length;
  }

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
          Authorization: `Bearer ${session.access_token}`
        }
      }
    );

    if (!response.ok) {
      throw new Error(
        `Resume download failed (${response.status})`
      );
    }

    const blob = await response.blob();

    if (!blob.size || blob.size > 5 * 1024 * 1024) {
      throw new Error(
        "Default resume must be between 1 byte and 5 MB."
      );
    }

    const filename = stored.includes("__")
      ? stored.split("__").slice(1).join("__")
      : stored;

    const lower = filename.toLowerCase();

    if (!lower.endsWith(".pdf") && !lower.endsWith(".docx")) {
      throw new Error("Unsupported resume format.");
    }

    return {
      filename,
      mime: lower.endsWith(".pdf")
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes: Array.from(
        new Uint8Array(await blob.arrayBuffer())
      )
    };
  }

  async function handleAutofill() {
    const button = $("autofillBtn");
    if (!button || button.disabled) return;

    button.disabled = true;

    try {
      status("Loading your Offerly profile...");

      const [profile, selfId] = await Promise.all([
        getProfile(),
        getSelfIdentification()
      ]);

      await prepareEngine();

      status("Filling personal information...");

      const textResult = await runEngine(
        "fillText",
        profile
      );

      status("Checking application dropdowns...");

      const before = await scanFields();

      const dropdownsFilled =
        await fillKnownDropdowns(before, profile);

      const after = await scanFields();

      const questions = await showQuestions(
        after, profile, selfId
      );

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
            : `Resume attachment needs review: ${
                result?.reason || "unsupported input"
              }`;
        }
      } catch (error) {
        console.error("Resume attachment:", error);
        resumeMessage = `Resume issue: ${error.message}`;
      }

      status(
        `${(textResult?.filled || 0) + dropdownsFilled} fields filled. ` +
        `${questions} questions to review. ` +
        resumeMessage
      );
    } catch (error) {
      console.error("Offerly autofill:", error);
      status(error.message || "Autofill failed.");
    } finally {
      button.disabled = false;
    }
  }

  $("autofillBtn")?.addEventListener(
    "click",
    handleAutofill
  );
})();
