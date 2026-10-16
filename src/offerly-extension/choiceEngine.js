
/*
 * Offerly Choice Engine
 *
 * Handles:
 * - Radio button groups
 * - Checkbox groups
 * - Yes/No button groups
 *
 * Never agrees to policies, marketing consent,
 * legal acknowledgments, or application submission.
 */

(() => {
  const norm = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const wait = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const BLOCKED =
    /consent|agree|acknowledg|certif|attest|privacy|terms|policy|receive text|sms|marketing|subscribe|electronic signature|truthful|accurate|background check authorization/i;

  function visible(element) {
    if (!element?.isConnected) return false;
    const style = getComputedStyle(element);

    return style.display !== "none" &&
      style.visibility !== "hidden" &&
      element.getClientRects().length > 0;
  }

  function optionText(element) {
    const aria = element.getAttribute("aria-label");
    if (aria) return aria.trim();

    if (element.id) {
      const linked = [...document.querySelectorAll("label[for]")]
        .find((label) => label.htmlFor === element.id);

      if (linked) return linked.textContent.trim();
    }

    const wrappingLabel = element.closest("label");
    if (wrappingLabel) {
      return wrappingLabel.textContent.trim();
    }

    return String(
      element.textContent ||
      element.value ||
      ""
    ).trim();
  }

  function commonAncestor(elements) {
    if (!elements.length) return null;

    let current = elements[0].parentElement;

    while (current && current !== document.body) {
      if (elements.every((item) => current.contains(item))) {
        return current;
      }

      current = current.parentElement;
    }

    return null;
  }

  function questionOf(container) {
    if (!container) return "";

    // Explicit accessible question labels are best.
    const ids = (
      container.getAttribute("aria-labelledby") || ""
    ).split(/\s+/);

    const described = ids
      .map((id) => document.getElementById(id)?.textContent)
      .filter(Boolean)
      .join(" ");

    if (described.trim()) return described.trim();

    const legend = container.querySelector(
      "legend, [data-testid='question-title']"
    );

    if (legend) return legend.textContent.trim();

    // Check for a nearby heading or question label.
    let current = container;

    for (let depth = 0; depth < 4 && current; depth++) {
      const sibling = current.previousElementSibling;

      if (sibling) {
        const text = sibling.textContent?.trim() || "";

        if (
          text.length >= 5 &&
          text.length <= 400 &&
          (
            /[?*]$/.test(text) ||
            /^(how|what|which|are|do|did|have|will|would|can|is|please)/i
              .test(text)
          )
        ) {
          return text.replace(/\s*\*$/, "").trim();
        }
      }

      const parent = current.parentElement;

      if (!parent || parent === document.body) break;

      const heading = [...parent.children].find(
        (child) =>
          child !== current &&
          (
            child.matches?.(
              "legend, h2, h3, h4, [role='heading']"
            ) ||
            child.matches?.("label")
          )
      );

      if (heading) {
        const text = heading.textContent.trim();

        if (text.length >= 5 && text.length <= 400) {
          return text;
        }
      }

      current = parent;
    }

    return "";
  }

  function meaning(question) {
    const text = norm(question);

    if (!text || BLOCKED.test(text)) return null;

    if (
      /authoriz|legally allowed|eligible to work/.test(text) &&
      /work|employment/.test(text)
    ) {
      return "workAuthorization";
    }

    if (/visa|sponsor|immigration/.test(text)) {
      return "sponsorship";
    }

    if (
      /at least 18|18 years of age|over 18/.test(text)
    ) {
      return "age18";
    }

    if (/willing to relocat/.test(text)) {
      return "relocation";
    }

    if (/willing to travel/.test(text)) {
      return "willingToTravel";
    }

    if (/pronouns?/.test(text)) {
      return "pronouns";
    }

    if (
      /how did you.*(hear|learn|find)/.test(text)
    ) {
      return "referralSource";
    }

    return null;
  }

  function getAnswer(key, profile, selfId) {
    const values = {
      workAuthorization: profile.workAuthorization,
      sponsorship: profile.sponsorship,
      age18: profile.age18,
      relocation: profile.relocation,
      willingToTravel: profile.willingToTravel,
      pronouns: selfId?.autoFillEnabled
        ? profile.pronouns
        : "",
      referralSource: profile.referralSource,
    };

    return String(values[key] || "").trim();
  }

  function selected(element) {
    if (element.matches("input[type='radio'], input[type='checkbox']")) {
      return element.checked;
    }

    return (
      element.getAttribute("aria-checked") === "true" ||
      element.getAttribute("aria-pressed") === "true" ||
      element.getAttribute("data-state") === "checked"
    );
  }

  function disabled(element) {
    return (
      element.disabled ||
      element.getAttribute("aria-disabled") === "true"
    );
  }

  function nativeGroups() {
    const inputs = [...document.querySelectorAll(
      "input[type='radio'], input[type='checkbox']"
    )].filter((input) => visible(input) && !disabled(input));

    const groups = new Map();

    for (const input of inputs) {
      const explicit = input.closest(
        "fieldset, [role='radiogroup'], [role='group']"
      );

      let key;

      if (explicit) {
        if (!explicit.dataset.offerlyChoiceId) {
          explicit.dataset.offerlyChoiceId =
            crypto.randomUUID();
        }
        key = `wrapper:${explicit.dataset.offerlyChoiceId}`;
      } else if (input.name) {
        key = `name:${input.form?.id || "page"}:${input.name}`;
      } else {
        // Do not guess grouping for unnamed inputs.
        continue;
      }

      if (!groups.has(key)) groups.set(key, []);

      groups.get(key).push(input);
    }

    return [...groups.values()]
      .filter((items) => items.length >= 2)
      .map((items) => {
        const container =
          items[0].closest(
            "fieldset, [role='radiogroup'], [role='group']"
          ) ||
          commonAncestor(items);

        return {
          type: items.some(
            (item) => item.type === "checkbox"
          )
            ? "checkbox"
            : "radio",
          question: questionOf(container),
          options: items.map((element) => ({
            element,
            label: optionText(element),
          })),
        };
      });
  }

  function buttonGroups() {
    const candidates = [
      ...document.querySelectorAll(
        "button, [role='radio'], [role='checkbox'], " +
        "[role='switch'], [role='button']"
      ),
    ].filter((element) => {
      if (!visible(element) || disabled(element)) {
        return false;
      }

      const label = norm(optionText(element));

      return [
        "yes",
        "no",
        "true",
        "false",
      ].includes(label);
    });

    const result = [];
    const seen = new Set();

    for (const element of candidates) {
      const parent = element.parentElement;
      if (!parent || seen.has(parent)) continue;

      const buttons = candidates.filter(
        (candidate) =>
          candidate.parentElement === parent
      );

      const labels = buttons.map(
        (button) => norm(optionText(button))
      );

      if (
        buttons.length !== 2 ||
        !labels.includes("yes") ||
        !labels.includes("no")
      ) {
        continue;
      }

      seen.add(parent);

      const question = questionOf(parent);

      if (!question) continue;

      result.push({
        type: "button",
        question,
        options: buttons.map((item) => ({
          element: item,
          label: optionText(item),
        })),
      });
    }

    return result;
  }

  function getGroups() {
    return [...nativeGroups(), ...buttonGroups()]
      .filter(
        (group) =>
          group.question &&
          group.options.every((option) => option.label)
      );
  }

  function matchingOption(group, answer) {
    const matches = group.options.filter(
      (option) =>
        norm(option.label) === norm(answer)
    );

    return matches.length === 1 ? matches[0] : null;
  }

  async function apply(profile = {}, selfId = {}) {
    const summary = {
      filled: 0,
      skipped: [],
      failed: [],
      needsAttention: [],
    };

    const groups = getGroups();

    for (const group of groups) {
      const question = group.question;
      const key = meaning(question);

      // Never alter controls that represent policies
      // or consent, even if a saved answer says Yes.
      if (BLOCKED.test(norm(question))) {
        summary.needsAttention.push(question);
        continue;
      }

      if (group.options.some(
        (option) => selected(option.element)
      )) {
        continue;
      }

      if (!key) {
        summary.needsAttention.push(question);
        continue;
      }

      const saved = getAnswer(key, profile, selfId);

      if (!saved) {
        summary.needsAttention.push(question);
        continue;
      }

      const match = matchingOption(group, saved);

      if (!match) {
        summary.needsAttention.push(question);
        summary.skipped.push(question);
        continue;
      }

      try {
        const target = match.element;

        target.scrollIntoView({
          block: "center",
          inline: "nearest",
          behavior: "instant",
        });

        await wait(100);

        target.click();
        await wait(180);

        // Don't claim success without confirmation.
        if (selected(target)) {
          summary.filled++;
        } else {
          summary.failed.push(question);
          summary.needsAttention.push(question);
        }
      } catch (error) {
        summary.failed.push(
          `${question}: ${error.message}`
        );
        summary.needsAttention.push(question);
      }
    }

    summary.needsAttention = [
      ...new Set(summary.needsAttention)
    ];

    return summary;
  }

  globalThis.offerlyChoiceEngine = {
    apply,
  };
})();
