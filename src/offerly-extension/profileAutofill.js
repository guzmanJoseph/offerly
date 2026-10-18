
/*
 * Offerly Autofill Controller
 *
 * Original functionality:
 * - Supabase authentication
 * - Personal information autofill
 * - Saved dropdown answers
 * - Default resume attachment
 * - Needs Attention review
 *
 * Additional functionality:
 * - Universal form controls
 * - Optional calendar driver
 * - OpenAI-assisted answer matching
 *
 * Never submits job applications.
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

  // ---------------------------------------
  // SUPABASE
  // ---------------------------------------

  async function getRow(table, columns) {
    const session = await getValidSession();

    if (
      !session?.user?.id ||
      !session.access_token
    ) {
      throw new Error(
        "Please log in to Offerly first."
      );
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
        "Offerly self-identification preferences:",
        error
      );

      // Fail closed for sensitive answers.
      return {
        answers: {},
        allowSuggestions: false,
        autoFillEnabled: false,
      };
    }
  }

  // ---------------------------------------
  // APPLICATION ENGINE
  // ---------------------------------------

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
      world: "ISOLATED",
    });

    const results =
      await chrome.scripting.executeScript({
        target: { tabId: activeTabId },
        world: "ISOLATED",

        func: () => ({
          ready:
            typeof globalThis.offerlyEngine
              ?.scan === "function",
          methods: Object.keys(
            globalThis.offerlyEngine || {}
          ),
        }),
      });

    const check = results?.[0]?.result;

    console.info(
      "Offerly form engine:",
      check
    );

    if (!check?.ready) {
      throw new Error(
        "Offerly form engine did not initialize."
      );
    }
  }

  async function callPageEngine(method, ...args) {
    const results =
      await chrome.scripting.executeScript({
        target: { tabId: activeTabId },
        world: "ISOLATED",

        func: async (methodName, parameters) => {
          const engine =
            globalThis.offerlyEngine;

          const fn = engine?.[methodName];

          if (typeof fn !== "function") {
            return {
              __offerlyError:
                `Missing engine method: ${methodName}`,
            };
          }

          try {
            const result =
              await fn(...parameters);

            return result === undefined
              ? {
                  __offerlyError:
                    `${methodName} returned undefined`,
                }
              : result;
          } catch (error) {
            return {
              __offerlyError:
                error?.message || String(error),
            };
          }
        },

        args: [method, args],
      });

    const result = results?.[0]?.result;

    if (result?.__offerlyError) {
      throw new Error(result.__offerlyError);
    }

    if (result === null || result === undefined) {
      throw new Error(
        `${method} returned no result.`
      );
    }

    return result;
  }

  async function runEngine(method, ...args) {
    if (!activeTabId) {
      throw new Error(
        "No active application tab."
      );
    }

    const driver =
      window.offerlyDropdownDriver;

    if (
      driver &&
      (
        method === "getDropdownOptions" ||
        method === "fillAnswer"
      )
    ) {
      const fields =
        await callPageEngine("scan");

      const field = Array.isArray(fields)
        ? fields.find(
            (item) => item.id === args[0]
          )
        : null;

      if (field?.type === "custom") {
        return method === "getDropdownOptions"
          ? driver.openAndRead(
              activeTabId,
              args[0]
            )
          : driver.fill(
              activeTabId,
              args[0],
              args[1]
            );
      }
    }

    return callPageEngine(method, ...args);
  }

  async function safeScan() {
    try {
      const fields = await runEngine("scan");

      if (!Array.isArray(fields)) {
        throw new Error(
          "Form scanner returned an invalid result."
        );
      }

      return {
        ok: true,
        fields,
      };
    } catch (error) {
      console.warn(
        "Offerly question scan failed:",
        error
      );

      return {
        ok: false,
        fields: [],
      };
    }
  }

  // ---------------------------------------
  // OPTIONAL PAGE ENGINE
  // ---------------------------------------

  async function runAdditionalEngine(
    filename,
    globalName,
    profile,
    selfId
  ) {
    const fallback = {
      filled: 0,
      skipped: 0,
      failed: [],
    };

    try {
      await chrome.scripting.executeScript({
        target: { tabId: activeTabId },
        files: [filename],
        world: "ISOLATED",
      });

      const results =
        await chrome.scripting.executeScript({
          target: { tabId: activeTabId },
          world: "ISOLATED",

          func: async (
            engineName,
            savedProfile,
            savedPreferences
          ) => {
            const engine =
              globalThis[engineName];

            if (
              typeof engine?.apply !== "function"
            ) {
              throw new Error(
                `${engineName} not initialized.`
              );
            }

            return await engine.apply(
              savedProfile,
              savedPreferences
            );
          },

          args: [
            globalName,
            profile,
            selfId,
          ],
        });

      const result =
        results?.[0]?.result || fallback;

      console.info(
        `Offerly ${globalName}:`,
        result
      );

      return result;
    } catch (error) {
      console.warn(
        `${globalName} failed:`,
        error
      );

      return {
        ...fallback,
        failed: [error.message],
      };
    }
  }

  // ---------------------------------------
  // AI AGENT
  // ---------------------------------------

  async function runAIAgent(
    profile,
    selfId
  ) {
    const fallback = {
      filled: 0,
      skipped: [],
      failed: [],
    };

    if (
      typeof window.offerlyAIAgent?.apply !==
      "function"
    ) {
      console.warn(
        "aiAgent.js is not loaded."
      );

      return {
        ...fallback,
        failed: [
          "AI agent script is not loaded.",
        ],
      };
    }

    try {
      // Re-scan so the agent only sees
      // questions remaining after normal autofill.
      const scan = await safeScan();

      if (!scan.ok) {
        return {
          ...fallback,
          failed: [
            "AI could not scan the application.",
          ],
        };
      }

      status(
        "AI is matching remaining answers..."
      );

      const result =
        await window.offerlyAIAgent.apply({
          fields: scan.fields,
          profile,
          selfId,
          tabId: activeTabId,
          runEngine,
        });

      console.info(
        "Offerly AI agent result:",
        result
      );

      return result || fallback;
    } catch (error) {
      console.warn(
        "Offerly AI agent failed:",
        error
      );

      return {
        ...fallback,
        failed: [error.message],
      };
    }
  }

  // ---------------------------------------
  // DEFAULT RESUME
  // ---------------------------------------

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
      throw new Error(
        "Invalid resume filename."
      );
    }

    const session =
      await getValidSession();

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
      ? stored.split("__")
          .slice(1)
          .join("__")
      : stored;

    const lower =
      filename.toLowerCase();

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

  // ---------------------------------------
  // REVIEW PANEL
  // ---------------------------------------

  function needsAttention(field) {
    if (
      !field ||
      field.type === "file" ||
      field.type === "choice" ||
      String(field.value || "").trim()
    ) {
      return false;
    }

    const label =
      normalize(field.label);

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

  function showReview(
    fields,
    scanOK,
    extra = []
  ) {
    $("offerlyQuestionReview")?.remove();

    const labels = [
      ...fields
        .filter(needsAttention)
        .map((field) => field.label),
      ...extra,
    ];

    if (!scanOK) {
      labels.push(
        "Application scan incomplete. Review the form manually."
      );
    }

    const unique = [
      ...new Map(
        labels
          .filter(Boolean)
          .map((label) => [
            normalize(label),
            label,
          ])
      ).values(),
    ];

    const section =
      document.createElement("section");

    section.id =
      "offerlyQuestionReview";

    section.className =
      "offerly-review";

    const heading =
      document.createElement("h3");

    heading.textContent =
      unique.length
        ? `Needs your attention (${unique.length})`
        : "Autofill review";

    section.appendChild(heading);

    const message =
      document.createElement("p");

    message.textContent =
      unique.length
        ? "Review these items on the application:"
        : "Review the entire application before submitting.";

    section.appendChild(message);

    if (unique.length) {
      const list =
        document.createElement("ul");

      list.className =
        "offerly-missing-list";

      for (const label of unique) {
        const item =
          document.createElement("li");

        item.textContent = label;

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

  // ---------------------------------------
  // MAIN AUTOFILL
  // ---------------------------------------

  async function handleAutofill() {
    const button = $("autofillBtn");

    if (!button || button.disabled) {
      return;
    }

    button.disabled = true;

    $("offerlyQuestionReview")?.remove();

    try {
      status(
        "Loading your Offerly profile..."
      );

      const [profile, selfId] =
        await Promise.all([
          getProfile(),
          getSelfIdentification(),
        ]);

      await prepareEngine();

      // 1. Existing personal information.
      let textResult = {
        filled: 0,
      };

      try {
        status(
          "Filling personal information..."
        );

        textResult =
          await runEngine(
            "fillText",
            profile
          ) || textResult;
      } catch (error) {
        console.warn(
          "Personal information autofill:",
          error
        );
      }

      // 2. Existing smart dropdown answers.
      let smartResult = {
        filled: 0,
        skipped: [],
        failed: [],
      };

      const firstScan =
        await safeScan();

      if (
        firstScan.ok &&
        window.offerlySmartAnswers?.apply
      ) {
        try {
          status(
            "Filling saved dropdown answers..."
          );

          smartResult =
            await window.offerlySmartAnswers.apply({
              fields: firstScan.fields,
              profile,
              selfId,
              tabId: activeTabId,
              runEngine,
            }) || smartResult;
        } catch (error) {
          console.warn(
            "Smart dropdown answers:",
            error
          );
        }
      }

      // 3. Universal interaction engine.
      status(
        "Checking additional form controls..."
      );

      const controlsResult =
        await runAdditionalEngine(
          "universalControls.js",
          "offerlyUniversalControls",
          profile,
          selfId
        );

      // 4. Optional calendar driver.
      let calendarResult = {
        filled: 0,
        skipped: 0,
        failed: [],
      };

      try {
        status(
          "Checking calendar fields..."
        );

        calendarResult =
          await runAdditionalEngine(
            "calendarDriver.js",
            "offerlyCalendarDriver",
            profile,
            selfId
          );
      } catch (error) {
        console.warn(
          "Calendar driver:",
          error
        );
      }

      // 5. AI-assisted matching.
      // Only considers unfilled fields.
      const aiResult =
        await runAIAgent(
          profile,
          selfId
        );


// Synchronize populated fields with the
// website's own form-validation framework.
let syncResult = null;

try {
  status("Validating filled application fields...");

  if (window.offerlyFormSync?.apply) {
    syncResult = await window.offerlyFormSync.apply(
      activeTabId
    );

    console.info(
      "Offerly form sync result:",
      syncResult
    );
  }
} catch (error) {
  console.warn(
    "Offerly form synchronization failed:",
    error
  );
}


      // 6. Preserve existing resume upload.
      let resumeMessage =
        "No default resume selected.";

      try {
        status(
          "Attaching your default resume..."
        );

        const resume =
          await getDefaultResume();

        if (resume) {
          const result =
            await runEngine(
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

      // 7. Final review.
      const finalScan =
        await safeScan();

      const extra = [];

      if (
        controlsResult.failed?.length ||
        calendarResult.failed?.length ||
        aiResult.failed?.length
      ) {
        extra.push(
          "Some answers could not be completed. Review manually."
        );
      }

      const missing = showReview(
        finalScan.fields,
        finalScan.ok,
        extra
      );

      const totalFilled = [
        textResult,
        smartResult,
        controlsResult,
        calendarResult,
        aiResult,
      ].reduce(
        (sum, result) =>
          sum +
          (Number(result?.filled) || 0),
        0
      );

      status(
        `${totalFilled} fields filled. ` +
        `${missing} items need attention. ` +
        resumeMessage
      );

      console.info(
        "Offerly autofill summary:",
        {
          personalInfo: textResult,
          smartAnswers: smartResult,
          universalControls:
            controlsResult,
          calendar: calendarResult,
          aiAgent: aiResult,
          resume: resumeMessage,
        }
      );
    } catch (error) {
      console.error(
        "Offerly autofill failed:",
        error
      );

      status(
        error.message ||
        "Autofill failed."
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
