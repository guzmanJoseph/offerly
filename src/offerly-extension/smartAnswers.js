
/*
 * Offerly Smart Answers
 *
 * Automatically fills saved, unambiguous
 * dropdown answers.
 *
 * Never submits an application.
 */

window.offerlySmartAnswers = (() => {
  const normalize = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  function getMeaning(label) {
    const text = normalize(label);

    if (/hispanic|latino/.test(text)) {
      return "hispanicLatino";
    }

    if (/veteran/.test(text)) {
      return "veteranStatus";
    }

    if (
      /^gender\b/.test(text) ||
      text === "sex"
    ) {
      return "gender";
    }

    if (/disabil/.test(text)) {
      return "disabilityStatus";
    }

    if (/pronouns?/.test(text)) {
      return "pronouns";
    }

    if (
      /country/.test(text) &&
      /phone|dial|calling|code/.test(text)
    ) {
      return "phoneCountry";
    }

    if (
      text === "country" ||
      /country of residence|residence country/.test(text)
    ) {
      return "country";
    }

    if (
      /^state$|^province$|state or province|state of residence|province of residence/.test(text)
    ) {
      return "state";
    }

    if (
      /how did you.*(hear|learn|find)/.test(text)
    ) {
      return "referralSource";
    }

    return null;
  }

  const SENSITIVE = new Set([
    "hispanicLatino",
    "veteranStatus",
    "gender",
    "disabilityStatus",
    "pronouns",
  ]);

  function savedAnswer(key, profile, selfId) {
    const answers = selfId?.answers || {};

    const values = {
      hispanicLatino: answers.hispanicLatino,
      veteranStatus: answers.veteranStatus,
      gender: answers.gender,
      disabilityStatus: answers.disabilityStatus,
      pronouns: profile.pronouns,
      phoneCountry:
        profile.phoneCountry || profile.countryCode,
      country: profile.country,
      state: profile.state || profile.region,
      referralSource: profile.referralSource,
    };

    return String(values[key] || "").trim();
  }

  function matchOption(options, saved) {
    if (!saved || !Array.isArray(options)) {
      return null;
    }

    const desired = normalize(saved);

    const matches = options.filter((option) =>
      (
        normalize(option.label) === desired ||
        normalize(option.value) === desired
      )
    );

    return matches.length === 1
      ? matches[0]
      : null;
  }

  async function apply({
    fields,
    profile,
    selfId,
    tabId,
    runEngine,
  }) {
    if (!Array.isArray(fields)) {
      throw new Error("Invalid application fields.");
    }

    const result = {
      filled: 0,
      skipped: [],
      failed: [],
    };

    const driver =
      window.offerlyDropdownDriver;

    for (const field of fields) {
      if (
        !["select", "custom"].includes(field.type) ||
        String(field.value || "").trim()
      ) {
        continue;
      }

      const key = getMeaning(field.label);

      if (!key) continue;

      const saved = savedAnswer(
        key,
        profile,
        selfId
      );

      if (!saved) continue;

      if (
        SENSITIVE.has(key) &&
        !selfId?.autoFillEnabled
      ) {
        result.skipped.push(field.label);
        continue;
      }

      // Eligibility questions are deliberately
      // not inferred from unrelated profile fields.
      if (field.employmentQuestion) {
        result.skipped.push(field.label);
        continue;
      }

      try {
        let options = field.options || [];

        if (field.type === "custom") {
          if (!driver) {
            result.failed.push(
              `${field.label}: driver unavailable`
            );
            continue;
          }

          const opened = await driver.openAndRead(
            tabId,
            field.id
          );

          if (!opened?.ok) {
            result.failed.push(
              `${field.label}: ${
                opened?.reason || "Could not open"
              }`
            );
            continue;
          }

          options = opened.options || [];
        }

        const option = matchOption(
          options,
          saved
        );

        if (!option) {
          result.skipped.push(
            `${field.label}: no exact match`
          );
          continue;
        }

        const applied =
          field.type === "custom"
            ? await driver.fill(
                tabId,
                field.id,
                option.value
              )
            : await runEngine(
                "fillAnswer",
                field.id,
                option.value
              );

        if (applied?.ok) {
          result.filled++;
        } else {
          result.failed.push(
            `${field.label}: ${
              applied?.reason || "Selection failed"
            }`
          );
        }
      } catch (error) {
        console.warn(
          "Offerly smart answer error:",
          field.label,
          error
        );

        result.failed.push(
          `${field.label}: ${error.message}`
        );
      }
    }

    return result;
  }

  return { apply };
})();
