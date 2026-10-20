
  /*
  * Offerly AI Agent 2.0
  *
  * - Existing AI dropdown matching
  * - AI mapping of expanded profile data
  * - Controlled text autofill
  * - Post-action verification
  * - Never submits applications
  */

  window.offerlyAIAgent = (() => {
    const BASE =
      "https://cezdzqaayzlalspukapl.supabase.co";

    const KEY =
      "sb_publishable_IT1rTAKqu7oUP9oILUIyaQ_fm_DOAir";

    const norm = (value) =>
      String(value ?? "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .trim();

    const BLOCKED =
      /password|passcode|social security|ssn|passport|tax id|bank|routing|credit card|captcha|consent|privacy policy|terms of service|certif|signature|submit|agree to|acknowledge|date of birth|birthdate/i;

    const SENSITIVE =
      /gender|ethnic|hispanic|latino|racial|race|disabil|veteran|pronouns?/i;

    const LEGAL =
      /legally authorized|work authoriz|sponsorship|visa|citizenship|security clearance|eligible to work|background check/i;

    const COMPANY_HISTORY =
      /previously worked|previously applied|referred by.*employee|prior employment with/i;

    function blocked(label) {
      return (
        BLOCKED.test(label) ||
        SENSITIVE.test(label) ||
        LEGAL.test(label) ||
        COMPANY_HISTORY.test(label)
      );
    }

    // ---------------------------------------
    // EXISTING DROPDOWN ANSWERS
    // ---------------------------------------

    function meaningOf(label) {
      const text = norm(label);

      if (/veteran/.test(text)) return "veteranStatus";
      if (/disabil/.test(text)) return "disabilityStatus";
      if (/hispanic|latino/.test(text)) return "hispanicLatino";
      if (/ethnic/.test(text)) return "ethnicity";
      if (/\brace\b|racial/.test(text)) return "race";
      if (/gender|^sex$/.test(text)) return "gender";
      if (/pronouns?/.test(text)) return "pronouns";
      if (/country of residence|^country$/.test(text))
        return "country";
      if (/^state$|^province$|state or province/.test(text))
        return "state";
      if (/how did you.*(hear|find|learn)/.test(text))
        return "referralSource";

      return null;
    }

    const SELF_ID_KEYS = new Set([
      "gender",
      "ethnicity",
      "race",
      "hispanicLatino",
      "veteranStatus",
      "disabilityStatus",
      "pronouns",
    ]);

    function getAnswer(key, profile, selfId) {
      const answers = selfId?.answers || {};

      if (
        SELF_ID_KEYS.has(key) &&
        !selfId?.autoFillEnabled
      ) {
        return null;
      }

      // Respect the user's chosen preference
      // for combined ethnicity questions.
      if (
        key === "ethnicity" &&
        norm(answers.hispanicLatino) === "yes"
      ) {
        return "Hispanic or Latino";
      }

      const raceValues = Array.isArray(
        answers.raceEthnicity
      )
        ? answers.raceEthnicity
        : [];

      const values = {
        gender: answers.gender,
        ethnicity: answers.ethnicity,
        race:
          raceValues.length === 1
            ? raceValues[0]
            : answers.race,
        hispanicLatino:
          norm(answers.hispanicLatino) === "yes"
            ? "Hispanic or Latino"
            : answers.hispanicLatino,
        veteranStatus: answers.veteranStatus,
        disabilityStatus: answers.disabilityStatus,
        pronouns: answers.pronouns || profile.pronouns,
        country: profile.country,
        state: profile.state,
        referralSource: profile.referralSource,
      };

      const value = values[key];

      if (
        typeof value !== "string" &&
        typeof value !== "number"
      ) {
        return null;
      }

      return String(value).trim() || null;
    }

    // ---------------------------------------
    // SECURE BACKEND CALL
    // ---------------------------------------

    async function askAI(payload) {
      const session = await getValidSession();

      if (!session?.access_token) {
        throw new Error("Please sign in to Offerly.");
      }

      const response = await fetch(
        `${BASE}/functions/v1/offerly-ai-agent`,
        {
          method: "POST",
          headers: {
            apikey: KEY,
            Authorization:
              `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "AI request failed"
        );
      }

      return result;
    }

    // ---------------------------------------
    // EXPANDED SAVED PROFILE
    // ---------------------------------------

    function flattenProfile(profile) {
      const values = {};

      const put = (key, value) => {
        if (
          typeof value !== "string" &&
          typeof value !== "number"
        ) {
          return;
        }

        const text = String(value).trim();

        if (
          text &&
          text.length <= 1000 &&
          Object.keys(values).length < 120
        ) {
          values[key] = text;
        }
      };

      const profileFields = [
        "firstName",
        "middleName",
        "lastName",
        "preferredName",
        "email",
        "phone",
        "phoneCountry",
        "addressLine1",
        "addressLine2",
        "city",
        "state",
        "postalCode",
        "country",
        "location",
        "linkedin",
        "github",
        "website",
        "professionalSummary",
        "careerMotivation",
        "keyAchievements",
        "projectExample",
        "technicalExperience",
        "preferredJobTitles",
        "preferredIndustries",
        "skills",
        "preferredLocations",
        "earliestStartDate",
        "noticePeriod",
      ];

      for (const key of profileFields) {
        put(key, profile[key]);
      }

      // Avoid sending private minimum salary,
      // citizenship, or self-ID information
      // to the generic AI mapping request.

      // The first school and job are useful for
      // single-entry fields. We do not assume that
      // later entries are safe to place in the
      // first matching field.
      const collections = [
        ["education", profile.education],
        ["experience", profile.experience],
        ["projects", profile.projects],
        ["certifications", profile.certifications],
        ["languages", profile.languages],
      ];

      for (const [collection, entries] of collections) {
        if (!Array.isArray(entries)) continue;

        // Include the first entry only in this phase.
        const entry = entries[0];

        if (!entry || typeof entry !== "object") {
          continue;
        }

        for (const [key, value] of Object.entries(entry)) {
          put(`${collection}.0.${key}`, value);
        }
      }

      return values;
    }

    // ---------------------------------------
    // TEXT FIELD EXECUTION
    // ---------------------------------------

    async function fillTextField(
      tabId,
      fieldId,
      value
    ) {
      const result = await chrome.scripting.executeScript({
        target: { tabId },
        world: "ISOLATED",

        func: (id, newValue) => {
          const element = [
            ...document.querySelectorAll(
              "input, textarea"
            ),
          ].find(
            (el) =>
              el.dataset.offerlyFieldId === id
          );

          if (!element) {
            return {
              ok: false,
              reason: "Field not found",
            };
          }

          const type = (
            element.getAttribute("type") || "text"
          ).toLowerCase();

          const allowedTypes = [
            "text",
            "email",
            "tel",
            "url",
            "number",
            "date",
            "month",
          ];

          if (
            !allowedTypes.includes(type) ||
            element.disabled ||
            element.readOnly ||
            element.value?.trim()
          ) {
            return {
              ok: false,
              reason: "Field is not safe to fill",
            };
          }

          if (typeof newValue !== "string") {
            return {
              ok: false,
              reason: "Invalid saved value",
            };
          }

          // Do not guess date formats.
          if (
            type === "date" &&
            !/^\d{4}-\d{2}-\d{2}$/.test(newValue)
          ) {
            return {
              ok: false,
              reason: "Date format requires review",
            };
          }

          if (
            type === "month" &&
            !/^\d{4}-\d{2}$/.test(newValue)
          ) {
            return {
              ok: false,
              reason: "Month format requires review",
            };
          }

          if (
            type === "number" &&
            !Number.isFinite(Number(newValue))
          ) {
            return {
              ok: false,
              reason: "Invalid number",
            };
          }

          const setter =
            Object.getOwnPropertyDescriptor(
              HTMLInputElement.prototype,
              "value"
            )?.set;

          const textareaSetter =
            Object.getOwnPropertyDescriptor(
              HTMLTextAreaElement.prototype,
              "value"
            )?.set;

          const set =
            element.tagName === "TEXTAREA"
              ? textareaSetter
              : setter;

          if (typeof set !== "function") {
            return {
              ok: false,
              reason: "Native setter unavailable",
            };
          }

          set.call(element, newValue);

          element.dispatchEvent(
            new Event("input", {
              bubbles: true,
            })
          );

          element.dispatchEvent(
            new Event("change", {
              bubbles: true,
            })
          );

          return {
            ok: element.value === newValue,
            value: element.value,
          };
        },

        args: [fieldId, value],
      });

      return result?.[0]?.result || {
        ok: false,
        reason: "Browser did not return a result",
      };
    }

    // ---------------------------------------
    // EXISTING DROPDOWN MATCHING
    // ---------------------------------------

    async function fillDropdowns({
      fields,
      profile,
      selfId,
      tabId,
      runEngine,
    }) {
      const result = {
        filled: 0,
        skipped: [],
        failed: [],
      };

      const driver = window.offerlyDropdownDriver;

      let requests = 0;

      for (const field of fields) {
        if (requests >= 8) break;

        if (
          !["select", "custom"].includes(field.type) ||
          String(field.value || "").trim()
        ) {
          continue;
        }

        if (
          BLOCKED.test(field.label) ||
          LEGAL.test(field.label) ||
          COMPANY_HISTORY.test(field.label)
        ) {
          continue;
        }

        const key = meaningOf(field.label);

        if (!key) continue;

        const answer = getAnswer(
          key,
          profile,
          selfId
        );

        if (!answer) continue;

        try {
          let options = field.options || [];

          if (field.type === "custom") {
            if (!driver) continue;

            const opened = await driver.openAndRead(
              tabId,
              field.id
            );

            if (!opened?.ok) {
              result.failed.push(
                `${field.label}: could not open`
              );
              continue;
            }

            options = opened.options || [];
          }

          if (!options.length) {
            result.skipped.push(field.label);
            continue;
          }

          requests++;

          const optionLabels = options.map(
            (option) =>
              String(option.label || "")
          );

          const decision = await askAI({
            mode: "matchOption",
            question: field.label,
            savedAnswer: answer,
            options: optionLabels,
          });

          if (decision.action !== "select") {
            result.skipped.push(field.label);
            continue;
          }

          const index = decision.optionIndex;

          if (
            !Number.isInteger(index) ||
            index < 0 ||
            index >= options.length ||
            options[index].label !== decision.option
          ) {
            result.failed.push(
              `${field.label}: invalid AI decision`
            );
            continue;
          }

          const chosen = options[index];

          const applied =
            field.type === "custom"
              ? await driver.fill(
                  tabId,
                  field.id,
                  chosen.label
                )
              : await runEngine(
                  "fillAnswer",
                  field.id,
                  chosen.value
                );

          if (applied?.ok) {
            result.filled++;
          } else {
            result.failed.push(
              `${field.label}: could not verify`
            );
          }
        } catch (error) {
          result.failed.push(
            `${field.label}: ${error.message}`
          );
        }
      }

      return result;
    }

    // ---------------------------------------
    // NEW: AI PROFILE MAPPING
    // ---------------------------------------

    async function fillProfileFields({
      fields,
      profile,
      tabId,
    }) {
      const result = {
        filled: 0,
        skipped: [],
        failed: [],
      };

      const values = flattenProfile(profile);

      if (!Object.keys(values).length) {
        return result;
      }

      // Only non-sensitive, empty text fields.
      const candidates = fields
        .filter((field) =>
          field.type === "text" &&
          !String(field.value || "").trim() &&
          !field.sensitive &&
          !field.employmentQuestion &&
          !blocked(field.label) &&
          !/^field \d+$/i.test(field.label)
        )
        .slice(0, 35)
        .map((field) => ({
          id: field.id,
          label: field.label,
          type: "text",
        }));

      if (!candidates.length) {
        return result;
      }

      const mapped = await askAI({
        mode: "mapProfile",
        fields: candidates,
        values,
      });

      if (mapped.action !== "mapProfile") {
        return result;
      }

      const candidateIds = new Set(
        candidates.map((field) => field.id)
      );

      for (const match of mapped.matches || []) {
        if (
          !candidateIds.has(match.fieldId) ||
          !Object.prototype.hasOwnProperty.call(
            values,
            match.valueKey
          )
        ) {
          continue;
        }

        try {
          const applied = await fillTextField(
            tabId,
            match.fieldId,
            values[match.valueKey]
          );

          if (applied.ok) {
            result.filled++;
          } else {
            result.failed.push(
              `${match.valueKey}: ${
                applied.reason || "not verified"
              }`
            );
          }
        } catch (error) {
          result.failed.push(
            `${match.valueKey}: ${error.message}`
          );
        }
      }

      return result;
    }

    // ---------------------------------------
    // MAIN AGENT
    // ---------------------------------------

    async function apply({
      fields,
      profile,
      selfId,
      tabId,
      runEngine,
    }) {
      const result = {
        filled: 0,
        skipped: [],
        failed: [],
        dropdowns: null,
        profileFields: null,
      };

      // Preserve the existing dropdown system.
      try {
        result.dropdowns = await fillDropdowns({
          fields,
          profile,
          selfId,
          tabId,
          runEngine,
        });

        result.filled += result.dropdowns.filled;
        result.skipped.push(
          ...result.dropdowns.skipped
        );
        result.failed.push(
          ...result.dropdowns.failed
        );
      } catch (error) {
        result.failed.push(
          `AI dropdowns: ${error.message}`
        );
      }

      // New AI mapping runs independently.
      try {
        // Re-scan because dropdowns may have
        // changed the application page.
        const updatedFields =
          await runEngine("scan");

        result.profileFields =
          await fillProfileFields({
            fields: updatedFields,
            profile,
            tabId,
          });

        result.filled +=
          result.profileFields.filled;

        result.skipped.push(
          ...result.profileFields.skipped
        );

        result.failed.push(
          ...result.profileFields.failed
        );
      } catch (error) {
        result.failed.push(
          `AI profile mapping: ${error.message}`
        );
      }

      return result;
    }

    return {
      apply,
      flattenProfile,
    };
  })();
