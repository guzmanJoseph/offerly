
/*
 * Offerly Universal Text Compatibility Layer
 *
 * Designed for Workday and other application sites.
 * Runs after the existing form engine.
 *
 * Does not submit applications or overwrite
 * fields that already contain a value.
 */

(() => {
  function normalize(value) {
    return String(value ?? "")
      .toLowerCase()
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function visible(element) {
    if (!element?.isConnected || element.disabled) {
      return false;
    }

    const style = getComputedStyle(element);

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      element.getClientRects().length > 0
    );
  }

  function labelText(element) {
    const labels = [];

    const add = (text) => {
      text = String(text || "").trim();
      if (text && !labels.includes(text)) {
        labels.push(text);
      }
    };

    // Native HTML labels
    for (const label of element.labels || []) {
      add(label.textContent);
    }

    // Accessible labels, often used by Workday
    const labelledBy = element.getAttribute(
      "aria-labelledby"
    );

    if (labelledBy) {
      for (const id of labelledBy.split(/\s+/)) {
        add(document.getElementById(id)?.textContent);
      }
    }

    add(element.getAttribute("aria-label"));
    add(element.getAttribute("placeholder"));

    // Labels inside Workday's component containers
    let parent = element.parentElement;

    for (
      let depth = 0;
      depth < 5 && parent;
      depth++, parent = parent.parentElement
    ) {
      if (
        parent.matches(
          "form, fieldset, main, body, [role='main']"
        )
      ) {
        break;
      }

      const inputs = parent.querySelectorAll(
        "input:not([type='hidden']), textarea"
      );

      // Only associate a nearby label when
      // the container has exactly one text field.
      if (inputs.length === 1) {
        const candidates = parent.querySelectorAll(
          "label, [data-automation-id='fieldLabel'], " +
          "[data-automation-id='formLabel'], " +
          "[id$='-label']"
        );

        for (const candidate of candidates) {
          add(candidate.textContent);
        }
      }
    }

    add(element.getAttribute("name"));
    add(element.id);
    add(element.getAttribute("data-automation-id"));

    return labels;
  }

  function determineKey(labels) {
    const rules = [
      ["firstName", /^(first|given)( name)?$/],
      ["lastName", /^(last|family|sur)( name)?$/],
      ["fullName", /^(full name|your full name|legal name|applicant name|name)$/],
      ["email", /^(email|e mail|email address|primary email|email id)$/],
      ["phone", /^(phone|phone number|mobile|mobile number|telephone|telephone number|primary phone)$/],
      ["addressLine1", /^(address|address line 1|address 1|street address|street address 1|address line one)$/],
      ["addressLine2", /^(address line 2|address 2|apartment|apartment suite|unit|street address 2)$/],
      ["city", /^(city|town|city town)$/],
      ["postalCode", /^(zip|zip code|postal code|postcode|zip postal code)$/],
      ["linkedin", /^(linkedin|linkedin url|linkedin profile|linkedin profile url)$/],
      ["github", /^(github|github url|github profile)$/],
      ["website", /^(website|personal website|portfolio|portfolio url|personal site)$/],
      ["preferredName", /^(preferred name|chosen name)$/],
    ];

    for (const label of labels) {
      const clean = normalize(label)
        .replace(/\b(required|optional)\b/g, "")
        .trim();

      const matches = rules.filter(([, regex]) =>
        regex.test(clean)
      );

      if (matches.length === 1) {
        return matches[0][0];
      }
    }

    return null;
  }

  function nativeSet(element, value) {
    const prototype =
      element.tagName === "TEXTAREA"
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;

    const setter = Object.getOwnPropertyDescriptor(
      prototype,
      "value"
    )?.set;

    if (!setter) return false;

    setter.call(element, value);

    element.dispatchEvent(
      new InputEvent("input", {
        bubbles: true,
        inputType: "insertText",
        data: value,
      })
    );

    element.dispatchEvent(
      new Event("change", { bubbles: true })
    );

    element.dispatchEvent(
      new FocusEvent("blur", { bubbles: true })
    );

    return element.value === value;
  }

  function getValues(profile) {
    const firstName = String(
      profile.firstName || ""
    ).trim();

    const lastName = String(
      profile.lastName || ""
    ).trim();

    return {
      firstName,
      lastName,
      fullName: firstName && lastName
        ? `${firstName} ${lastName}`
        : "",
      email: profile.email,
      phone: profile.phone,
      addressLine1:
        profile.addressLine1 ||
        profile.address1 ||
        profile.streetAddress ||
        profile.address ||
        "",
      addressLine2:
        profile.addressLine2 ||
        profile.address2 ||
        "",
      city: profile.city,
      postalCode:
        profile.postalCode || profile.zipCode || profile.zip,
      linkedin: profile.linkedin,
      github: profile.github,
      website: profile.website,
      preferredName: profile.preferredName,
    };
  }

  function fill(profile = {}) {
    const values = getValues(profile);

    const result = {
      filled: 0,
      filledTypes: [],
      skipped: 0,
    };

    const fields = document.querySelectorAll(
      "input, textarea"
    );

    for (const field of fields) {
      const type = String(
        field.getAttribute("type") || "text"
      ).toLowerCase();

      if (
        !["text", "email", "tel", "url"].includes(type) ||
        !visible(field) ||
        field.readOnly ||
        field.value.trim() ||
        field.closest("[aria-hidden='true']")
      ) {
        continue;
      }

      const labels = labelText(field);

      // Never fill consent, policy or identification
      // fields based on a generic label match.
      const context = normalize(labels.join(" "));

      if (
        /password|social security|ssn|tax id|signature|consent|agree|acknowledg|policy|certif|attest/.test(context)
      ) {
        continue;
      }

      const key = determineKey(labels);
      const value = key
        ? String(values[key] || "").trim()
        : "";

      if (!value) {
        result.skipped++;
        continue;
      }

      try {
        if (nativeSet(field, value)) {
          result.filled++;
          result.filledTypes.push(key);
        } else {
          result.skipped++;
        }
      } catch (error) {
        console.warn(
          "Offerly compatibility field error:",
          key,
          error
        );
        result.skipped++;
      }
    }

    return result;
  }

  globalThis.offerlyUniversalText = { fill };
})();
