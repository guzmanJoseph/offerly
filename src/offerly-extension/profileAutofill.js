/*
 * Offerly — Basic Information Autofill
 *
 * Replaces recognized basic text fields with saved profile values.
 * Never clears a field when the saved value is empty.
 * Attaches the default resume using the existing helper.
 */

(() => {
  const BASE = "https://cezdzqaayzlalspukapl.supabase.co";
  const KEY = "sb_publishable_IT1rTAKqu7oUP9oILUIyaQ_fm_DOAir";

  const button = document.getElementById("autofillBtn");
  const statusElement = document.getElementById("status");

  if (!button) return;

  button.textContent = "Fill basic info";

  function setStatus(message) {
    if (statusElement) statusElement.textContent = message;
  }

  async function loadProfile() {
    const session = await getValidSession();

    if (!session?.user?.id || !session.access_token) {
      throw new Error("Please log in to Offerly first.");
    }

    const query = new URLSearchParams({
      select: "profile_data",
      user_id: `eq.${session.user.id}`,
      limit: "1",
    });

    const response = await fetch(
      `${BASE}/rest/v1/autofill_profiles?${query}`,
      {
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${session.access_token}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Could not load your profile (${response.status}).`
      );
    }

    const rows = await response.json();
    const profile = rows[0]?.profile_data;

    if (
      !profile ||
      typeof profile !== "object" ||
      Array.isArray(profile)
    ) {
      throw new Error(
        "Add your information on Offerly’s profile page first."
      );
    }

    const educationEntries = Array.isArray(profile.education)
      ? profile.education.filter(entry =>
          entry &&
          typeof entry === "object" &&
          !Array.isArray(entry) &&
          String(entry.school || "").trim()
        )
      : [];

    // Multiple schools require explicit mapping to each entry.
    const education =
      educationEntries.length === 1 ? educationEntries[0] : {};

    return {
      firstName: profile.firstName,
      lastName: profile.lastName,
      preferredName: profile.preferredName,
      email: profile.email,
      phone: profile.phone,
      addressLine1: profile.addressLine1,
      addressLine2: profile.addressLine2,
      city: profile.city,
      state: profile.state,
      country: profile.country,
      postalCode: profile.postalCode,
      linkedin: profile.linkedin,
      github: profile.github,
      website: profile.website,
      school: education.school,
      degreeType: education.degreeType,
      major: education.degree,
      graduationDate: education.endDate,
    };
  }

  async function fillBasicFields(profile) {
    const pause = ms =>
      new Promise(resolve => setTimeout(resolve, ms));

    function normalize(value) {
      return String(value || "")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .toLowerCase()
        .replace(/\b(required|optional)\b/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
    }

    const values = {
      ...profile,
      fullName:
        profile.firstName && profile.lastName
          ? `${profile.firstName} ${profile.lastName}`
          : "",
    };

    const aliases = {
      firstName: [
        "first name", "legal first name", "given name",
        "firstname", "fname",
      ],
      lastName: [
        "last name", "legal last name", "family name",
        "surname", "lastname", "lname",
      ],
      fullName: [
        "full name", "legal name", "your name", "name",
      ],
      preferredName: ["preferred name"],
      email: [
        "email", "email address", "e mail",
        "e mail address", "your email",
      ],
      phone: [
        "phone", "phone number", "mobile", "mobile number",
        "telephone", "telephone number",
      ],
      addressLine1: [
        "street address", "address", "address line 1",
        "address line one", "address 1",
        "street address line 1",
      ],
      addressLine2: [
        "address line 2", "address line two", "address 2",
        "apartment", "apartment unit", "apartment suite",
        "apartment suite unit", "unit",
      ],
      city: ["city", "current city", "city of residence"],
      state: ["state", "province", "state province"],
      country: ["country", "country of residence"],
      postalCode: [
        "zip", "zip code", "postal code", "zip postal code",
      ],
      linkedin: [
        "linkedin", "linkedin url", "linkedin profile",
        "linkedin profile url",
      ],
      github: [
        "github", "github url", "github profile",
        "github profile url",
      ],
      website: [
        "website", "website url", "portfolio", "portfolio url",
        "personal website", "personal website url",
      ],
      school: [
        "school", "university", "college", "school name",
        "university name", "college university",
        "school university", "school or university",
      ],
      degreeType: ["degree type", "type of degree"],
      major: [
        "major", "field of study", "degree major", "area of study",
      ],
      graduationDate: [
        "graduation date", "expected graduation date",
        "graduation end date", "graduation date mm yyyy",
        "expected graduation date mm yyyy",
      ],
    };

    const names = {
      firstName: "First name",
      lastName: "Last name",
      fullName: "Full name",
      preferredName: "Preferred name",
      email: "Email",
      phone: "Phone",
      addressLine1: "Street address",
      addressLine2: "Apartment / unit",
      city: "City",
      state: "State",
      country: "Country",
      postalCode: "ZIP / postal code",
      linkedin: "LinkedIn",
      github: "GitHub",
      website: "Website",
      school: "School",
      degreeType: "Degree",
      major: "Major",
      graduationDate: "Graduation date",
    };

    const autocompleteKeys = {
      "given-name": "firstName",
      "family-name": "lastName",
      name: "fullName",
      email: "email",
      tel: "phone",
      "address-line1": "addressLine1",
      "address-line2": "addressLine2",
      "address-level2": "city",
      "address-level1": "state",
      "country-name": "country",
      "postal-code": "postalCode",
    };

    const educationKeys = new Set([
      "school", "degreeType", "major", "graduationDate",
    ]);

    function matchAlias(value) {
      const label = normalize(value);

      return Object.keys(aliases).find(key =>
        aliases[key].includes(label)
      ) || null;
    }

    function fieldKey(input) {
      const labels = Array.from(
        input.labels || [],
        label => label.textContent
      );

      for (
        const id of (
          input.getAttribute("aria-labelledby") || ""
        ).split(/\s+/)
      ) {
        if (id) {
          labels.push(document.getElementById(id)?.textContent);
        }
      }

      labels.push(input.getAttribute("aria-label"));

      const meaningfulLabels = labels.filter(value =>
        String(value || "").trim()
      );

      if (meaningfulLabels.length) {
        const matches = [
          ...new Set(meaningfulLabels.map(matchAlias).filter(Boolean)),
        ];

        // Conflicting labels are too ambiguous to overwrite.
        return matches.length === 1 ? matches[0] : null;
      }

      const autocomplete = (
        input.getAttribute("autocomplete") || ""
      )
        .trim()
        .toLowerCase()
        .split(/\s+/)
        .pop();

      if (autocompleteKeys[autocomplete]) {
        return autocompleteKeys[autocomplete];
      }

      for (const candidate of [
        input.name,
        input.id,
        input.getAttribute("placeholder"),
      ]) {
        const key = matchAlias(candidate);
        if (key) return key;
      }

      return null;
    }

    function editable(input) {
      const style = getComputedStyle(input);

      return (
        input.isConnected &&
        ["text", "email", "tel", "url"].includes(input.type) &&
        !input.disabled &&
        !input.readOnly &&
        !input.closest("[aria-hidden='true'], [inert]") &&
        !input.closest("[role='combobox']") &&
        input.getAttribute("role") !== "combobox" &&
        !input.getAttribute("aria-autocomplete") &&
        !input.getAttribute("aria-haspopup") &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        input.getClientRects().length > 0
      );
    }

    function collectCandidates() {
      const candidates = [];

      for (const input of document.querySelectorAll("input")) {
        if (!editable(input)) continue;

        const key = fieldKey(input);
        const rawValue = key ? values[key] : null;

        if (
          typeof rawValue !== "string" &&
          typeof rawValue !== "number"
        ) {
          continue;
        }

        const value = String(rawValue).trim();

        if (
          !value ||
          (input.maxLength >= 0 && value.length > input.maxLength)
        ) {
          continue;
        }

        if (key === "graduationDate") {
          if (!/^(0[1-9]|1[0-2])\/\d{4}$/.test(value)) {
            continue;
          }

          const hints = [
            input.placeholder,
            input.getAttribute("aria-label"),
            ...Array.from(
              input.labels || [],
              label => label.textContent
            ),
          ].filter(Boolean).join(" ");

          if (
            /yyyy[\s/-]*mm|mm[\s/-]*dd|dd[\s/-]*mm|month name/i
              .test(hints)
          ) {
            continue;
          }
        }

        candidates.push({ input, key, value });
      }

      return candidates.filter(candidate =>
        !educationKeys.has(candidate.key) ||
        candidates.filter(item => item.key === candidate.key)
          .length === 1
      );
    }

    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set;

    if (!setter) {
      return {
        filled: 0,
        filledFields: [],
        message: "Unable to update fields on this page.",
      };
    }

    const changed = [];

    // Re-scan after each change because frameworks may replace inputs.
    const initialCount = collectCandidates().length;

    for (let index = 0; index < initialCount; index++) {
      const candidate = collectCandidates().find(item =>
        !changed.some(previous =>
          previous.input === item.input ||
          (
            previous.key === item.key &&
            previous.id &&
            previous.id === item.input.id
          )
        ) &&
        item.input.value !== item.value
      );

      if (!candidate) break;

      const { input, key, value } = candidate;

      if (!editable(input)) continue;

      try {
        setter.call(input, value);

        input.dispatchEvent(
          new Event("input", { bubbles: true, composed: true })
        );

        input.dispatchEvent(
          new Event("change", { bubbles: true, composed: true })
        );

        changed.push({
          input,
          id: input.id,
          key,
          value,
        });

        await pause(80);
      } catch {
        // Continue with other supported fields.
      }
    }

    await pause(200);

    const finalCandidates = collectCandidates();
    const confirmed = changed.filter(item => {
      if (item.input.isConnected) {
        return item.input.value === item.value;
      }

      // A replaced input needs an exact ID match for verification.
      return item.id && finalCandidates.some(candidate =>
        candidate.input.id === item.id &&
        candidate.key === item.key &&
        candidate.input.value === item.value
      );
    });

    return {
      filled: confirmed.length,
      filledFields: [
        ...new Set(confirmed.map(item => names[item.key] || item.key)),
      ],
      message: confirmed.length
        ? `${confirmed.length} basic fields updated from your saved profile.`
        : "No matching text fields needed an update.",
    };
  }

  button.addEventListener("click", async () => {
    if (button.disabled) return;

    button.disabled = true;

    document.getElementById("offerlyQuestionReview")?.remove();

    const resultsPanel = document.getElementById("fillResults");
    const fieldsList = document.getElementById("filledFields");
    const countLabel = document.getElementById("fillCount");

    if (resultsPanel) resultsPanel.hidden = true;
    if (fieldsList) fieldsList.replaceChildren();

    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (
        !tab?.id ||
        !/^https?:\/\//i.test(tab.url || "")
      ) {
        throw new Error("Open a job application webpage first.");
      }

      setStatus("Loading your saved information...");
      const profile = await loadProfile();

      setStatus("Updating basic information...");

      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        world: "ISOLATED",
        func: fillBasicFields,
        args: [profile],
      });

      const result = results?.[0]?.result;

      if (!result) {
        throw new Error("Could not read the autofill result.");
      }

      if (resultsPanel && fieldsList && countLabel) {
        for (const label of result.filledFields || []) {
          const item = document.createElement("li");
          item.textContent = label;
          fieldsList.appendChild(item);
        }

        countLabel.textContent = String(result.filled || 0);
        resultsPanel.hidden = false;

        if (!result.filled) {
          const item = document.createElement("li");
          item.textContent = "No matching fields needed an update.";
          fieldsList.appendChild(item);
        }
      }

      let resumeMessage =
        "Résumé helper did not load. Reopen the side panel.";

      if (
        typeof window.offerlyAttachDefaultResume === "function"
      ) {
        try {
          resumeMessage =
            await window.offerlyAttachDefaultResume(tab.id);
        } catch (error) {
          resumeMessage =
            `Résumé could not be attached: ${error.message}`;
        }
      }

      setStatus([
        result.message,
        resumeMessage,
        "Review the application before submitting.",
      ].filter(Boolean).join(" "));
    } catch (error) {
      console.error("Offerly basic autofill:", error);

      setStatus(
        error.message || "Could not fill this application."
      );
    } finally {
      button.disabled = false;
    }
  });
})();