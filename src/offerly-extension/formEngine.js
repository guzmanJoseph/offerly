
/*
 * Offerly Universal Form Engine
 *
 * Supports:
 * - Personal information autofill
 * - Native HTML dropdowns
 * - React Select / accessible custom dropdowns
 * - Dropdown option discovery
 * - User-confirmed answers
 * - Automatic resume attachment
 *
 * Does NOT submit job applications.
 */

(() => {
  const normalize = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const wait = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  function visible(element) {
    if (!element?.isConnected) return false;

    const style = getComputedStyle(element);

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      element.getClientRects().length > 0
    );
  }

  function typeOf(element) {
    if (element.type === "file") return "file";

    if (element.tagName === "SELECT") {
      return "select";
    }

    if (
      element.getAttribute("role") === "combobox"
    ) {
      return "custom";
    }

    if (
      element.type === "radio" ||
      element.type === "checkbox"
    ) {
      return "choice";
    }

    return "text";
  }

  function allFields() {
    const candidates = document.querySelectorAll(
      "input, textarea, select, [role='combobox']"
    );

    return [...new Set(candidates)].filter((element) => {
      if (
        element.disabled ||
        element.closest("[aria-hidden='true']")
      ) {
        return false;
      }

      const type = (
        element.getAttribute("type") || ""
      ).toLowerCase();

      if (
        [
          "hidden",
          "password",
          "submit",
          "button",
          "reset",
        ].includes(type)
      ) {
        return false;
      }

      if (type === "file") return true;

      // Ignore internal search boxes belonging to
      // international phone widgets.
      if (
        element.matches(".iti__search-input") ||
        element.closest(".iti__dropdown-content")
      ) {
        return false;
      }

      return visible(element);
    });
  }

  // ---------------------------------------------
  // FIELD LABELS
  // ---------------------------------------------

  function labelOf(element) {
    const labels = [];

    for (const label of element.labels || []) {
      labels.push(label.textContent);
    }

    const labelledBy =
      element.getAttribute("aria-labelledby") || "";

    for (const id of labelledBy.split(/\s+/)) {
      if (!id) continue;

      const label = document.getElementById(id);

      if (label) {
        labels.push(label.textContent);
      }
    }

    if (element.id) {
      const linked = [...document.querySelectorAll(
        "label[for]"
      )].find(
        (label) =>
          label.getAttribute("for") === element.id
      );

      if (linked) {
        labels.push(linked.textContent);
      }
    }

    const wrapper = element.closest(
      ".select__container, " +
      ".input-wrapper, " +
      ".text-input-wrapper, " +
      ".field-wrapper, " +
      "[role='group']"
    );

    if (wrapper) {
      const localLabel = wrapper.querySelector(
        "label, legend, .select__label"
      );

      if (localLabel) {
        labels.push(localLabel.textContent);
      }
    }

    labels.push(
      element.getAttribute("aria-label"),
      element.getAttribute("placeholder"),
      element.name,
      element.id,
      element.getAttribute("autocomplete")
    );

    const unique = [...new Set(
      labels
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )];

    return unique[0] || "";
  }

  function sensitiveQuestion(label) {
    return /gender|race|ethnic|hispanic|latino|veteran|disabil|self.identif|pronoun/i
      .test(label);
  }

  function employmentQuestion(label) {
    return /sponsor|visa|citizen|immigration|work authorization|legally authorized|export.control|protected person|security clearance|relocat|on.site|onsite|previously employed/i
      .test(label);
  }

  // ---------------------------------------------
  // SCANNING
  // ---------------------------------------------

  function selectedCustomValue(element) {
    const wrapper = element.closest(
      ".select__container, [data-radix-select-trigger]"
    );

    const selected = wrapper?.querySelector(
      ".select__single-value, " +
      "[data-radix-select-value], " +
      "[data-state='checked']"
    );

    return selected?.textContent?.trim() || "";
  }

  function scan() {
    return allFields().map((element, index) => {
      if (!element.dataset.offerlyFieldId) {
        element.dataset.offerlyFieldId =
          `offerly-${crypto.randomUUID()}`;
      }

      const label = labelOf(element);
      const type = typeOf(element);

      let value = String(element.value || "");

      if (type === "custom") {
        value = selectedCustomValue(element);
      }

      if (type === "file") {
        value = element.files?.[0]?.name || "";
      }

      if (type === "choice") {
        value = element.checked ? element.value : "";
      }

      return {
        id: element.dataset.offerlyFieldId,
        label: label || `Field ${index + 1}`,
        type,
        value,
        required:
          Boolean(element.required) ||
          element.getAttribute("aria-required") === "true",
        sensitive: sensitiveQuestion(label),
        employmentQuestion: employmentQuestion(label),
        options:
          type === "select"
            ? [...element.options]
                .filter(
                  (option) =>
                    !option.disabled &&
                    option.value
                )
                .map((option) => ({
                  label: option.textContent.trim(),
                  value: option.value,
                }))
            : [],
      };
    });
  }

  function find(id) {
    return allFields().find(
      (element) =>
        element.dataset.offerlyFieldId === id
    );
  }

  // ---------------------------------------------
  // TEXT AUTOFILL
  // ---------------------------------------------

  function setText(element, value) {
    if (
      !element ||
      element.disabled ||
      element.readOnly ||
      !["INPUT", "TEXTAREA"].includes(
        element.tagName
      )
    ) {
      return false;
    }

    const prototype =
      element.tagName === "TEXTAREA"
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype;

    const setter =
      Object.getOwnPropertyDescriptor(
        prototype,
        "value"
      )?.set;

    if (!setter) return false;

    setter.call(element, String(value));

    element.dispatchEvent(
      new Event("input", { bubbles: true })
    );

    element.dispatchEvent(
      new Event("change", { bubbles: true })
    );

    return true;
  }

  function fillText(profile = {}) {
    const rules = [
      [
        "firstName",
        /first.?name|given.?name|\bfname\b/,
      ],
      [
        "lastName",
        /last.?name|family.?name|surname|\blname\b/,
      ],
      ["email", /\bemail\b|e.?mail/],
      ["phone", /\bphone\b|mobile|telephone/],
      ["linkedin", /linkedin/],
      ["github", /github/],
      [
        "website",
        /website|portfolio|personal.?site/,
      ],
      ["preferredName", /preferred.?name/],
    ];

    let filled = 0;

    for (const field of scan()) {
      if (
        field.type !== "text" ||
        field.value ||
        field.sensitive ||
        field.employmentQuestion
      ) {
        continue;
      }

      const element = find(field.id);

      if (!element) continue;

      if (
        [
          "date",
          "number",
          "search",
          "file",
          "checkbox",
          "radio",
        ].includes(element.type)
      ) {
        continue;
      }

      const matches = rules.filter(
        ([key, regex]) =>
          profile[key] &&
          regex.test(normalize(field.label))
      );

      if (matches.length !== 1) continue;

      if (
        setText(
          element,
          profile[matches[0][0]]
        )
      ) {
        filled++;
      }
    }

    return { filled };
  }

  // ---------------------------------------------
  // DROPDOWN HELPERS
  // ---------------------------------------------

  function getMenuRoots(combobox) {
    const controlledId =
      combobox.getAttribute("aria-controls") ||
      combobox.getAttribute("aria-owns");

    if (controlledId) {
      const controlled = document.getElementById(
        controlledId
      );

      if (controlled && visible(controlled)) {
        return [controlled];
      }
    }

    const roots = [
      ...document.querySelectorAll(
        "[role='listbox'], " +
        ".select__menu-list, " +
        "[class*='__menu-list'], " +
        "[data-radix-select-viewport]"
      ),
    ].filter(visible);

    // One unambiguously open menu is safe to inspect.
    return roots.length === 1 ? roots : [];
  }

  function availableOptions(combobox) {
    const roots = getMenuRoots(combobox);

    if (roots.length !== 1) {
      return [];
    }

    const root = roots[0];

    const candidates = [
      ...root.querySelectorAll(
        "[role='option'], " +
        ".select__option, " +
        "[class*='__option'], " +
        "[data-radix-select-item], " +
        "[cmdk-item]"
      ),
    ];

    const seen = new Set();
    const options = [];

    for (const node of candidates) {
      if (
        !visible(node) ||
        node.getAttribute("aria-disabled") === "true" ||
        node.getAttribute("data-disabled") === "true"
      ) {
        continue;
      }

      const label = (
        node.getAttribute("aria-label") ||
        node.textContent ||
        ""
      ).trim();

      const key = normalize(label);

      if (!key || seen.has(key)) continue;

      seen.add(key);
      options.push({ node, label });
    }

    return options;
  }

  async function openCustom(combobox) {
    if (!visible(combobox)) {
      return [];
    }

    // If the menu is already open, read it first.
    if (
      combobox.getAttribute("aria-expanded") === "true"
    ) {
      const existing = availableOptions(combobox);

      if (existing.length) return existing;
    }

    const control =
      combobox.closest(".select__control") ||
      combobox;

    // React Select may respond to clicking the control
    // rather than clicking only its internal input.
    control.click();

    await wait(250);

    let options = availableOptions(combobox);

    if (options.length) {
      return options;
    }

    // Second attempt: focus the combobox and request
    // the next option using the keyboard.
    combobox.focus();

    combobox.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "ArrowDown",
        code: "ArrowDown",
        bubbles: true,
        cancelable: true,
      })
    );

    await wait(300);

    // React may render the menu asynchronously.
    for (let attempt = 0; attempt < 5; attempt++) {
      options = availableOptions(combobox);

      if (options.length) {
        return options;
      }

      await wait(150);
    }

    return [];
  }

  // ---------------------------------------------
  // READ DROPDOWN OPTIONS
  // ---------------------------------------------

  async function getDropdownOptions(id) {
    const element = find(id);

    if (!element) {
      return {
        ok: false,
        options: [],
        reason: "Dropdown no longer exists",
      };
    }

    if (element.tagName === "SELECT") {
      return {
        ok: true,
        options: [...element.options]
          .filter(
            (option) =>
              !option.disabled && option.value
          )
          .map((option) => ({
            label: option.textContent.trim(),
            value: option.value,
          })),
      };
    }

    if (typeOf(element) !== "custom") {
      return {
        ok: false,
        options: [],
        reason: "This field is not a dropdown",
      };
    }

    const choices = await openCustom(element);

    return {
      ok: choices.length > 0,
      options: choices.map((choice) => ({
        label: choice.label,
        value: choice.label,
      })),
      reason: choices.length
        ? ""
        : "Dropdown options could not be read",
    };
  }

  // ---------------------------------------------
  // FILL ANSWERS
  // ---------------------------------------------

  async function fillAnswer(id, answer) {
    const element = find(id);

    if (!element) {
      return {
        ok: false,
        reason: "Field no longer exists",
      };
    }

    // Standard HTML dropdown
    if (element.tagName === "SELECT") {
      const matches = [...element.options].filter(
        (option) =>
          !option.disabled &&
          (
            option.value === answer ||
            normalize(option.textContent) ===
              normalize(answer)
          )
      );

      if (matches.length !== 1) {
        return {
          ok: false,
          reason: "No unique matching option",
        };
      }

      const setter =
        Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,
          "value"
        )?.set;

      if (setter) {
        setter.call(element, matches[0].value);
      } else {
        element.value = matches[0].value;
      }

      element.dispatchEvent(
        new Event("input", { bubbles: true })
      );

      element.dispatchEvent(
        new Event("change", { bubbles: true })
      );

      return {
        ok: element.value === matches[0].value,
      };
    }

    // React Select / custom dropdown
    if (typeOf(element) === "custom") {
      const options = await openCustom(element);

      const matches = options.filter(
        (choice) =>
          normalize(choice.label) ===
          normalize(answer)
      );

      if (matches.length !== 1) {
        return {
          ok: false,
          reason:
            "No unique matching dropdown option",
        };
      }

      const selectedOption = matches[0];

      // React Select commonly processes mousedown
      // to select an option.
      selectedOption.node.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          button: 0,
        })
      );

      await wait(100);

      // Avoid clicking again if mousedown already
      // selected the option and closed the menu.
      if (
        element.getAttribute("aria-expanded") ===
          "true" &&
        selectedOption.node.isConnected
      ) {
        selectedOption.node.click();
      }

      await wait(350);

      const selected = selectedCustomValue(element);

      const verified =
        normalize(selected) ===
        normalize(selectedOption.label);

      return {
        ok: verified,
        value: selected,
        reason: verified
          ? ""
          : "Option was clicked but could not be verified",
      };
    }

    // Ordinary text input
    if (typeOf(element) === "text") {
      return {
        ok: setText(element, answer),
      };
    }

    return {
      ok: false,
      reason: "Unsupported field type",
    };
  }

  // ---------------------------------------------
  // RESUME ATTACHMENT
  // ---------------------------------------------

  function resumeContext(input) {
    const values = [
      input.id,
      input.name,
      input.getAttribute("aria-label"),
      ...[...(input.labels || [])].map(
        (label) => label.textContent
      ),
    ];

    let parent = input.parentElement;

    for (
      let depth = 0;
      parent && depth < 6;
      depth++
    ) {
      if (
        parent.matches("form, main, body") ||
        parent.querySelectorAll(
          "input[type='file']"
        ).length > 1
      ) {
        break;
      }

      values.push(
        ...[...parent.querySelectorAll(
          "label, legend, h2, h3, h4"
        )]
          .slice(0, 5)
          .map((element) => element.textContent)
      );

      parent = parent.parentElement;
    }

    return normalize(
      values.filter(Boolean).join(" ")
    );
  }

  async function attachResume(bytes, name, mimeType) {
    const inputs = [
      ...document.querySelectorAll(
        "input[type='file']"
      ),
    ];

    const ranked = inputs.map((input) => {
      const context = resumeContext(input);
      const direct = normalize(
        `${input.id} ${input.name}`
      );

      const score =
        (
          /resume|curriculum vitae|\bcv\b/.test(
            context
          )
            ? 10
            : 0
        ) +
        (
          /resume|\bcv\b/.test(direct)
            ? 10
            : 0
        ) -
        (
          /cover.?letter/.test(context)
            ? 40
            : 0
        );

      return { input, score };
    }).sort(
      (a, b) => b.score - a.score
    );

    if (
      !ranked[0] ||
      ranked[0].score <= 0 ||
      ranked[1]?.score === ranked[0].score
    ) {
      return {
        ok: false,
        reason:
          "Could not uniquely identify the resume upload field",
      };
    }

    const input = ranked[0].input;

    if (input.disabled) {
      return {
        ok: false,
        reason: "Resume upload is disabled",
      };
    }

    const file = new File(
      [new Uint8Array(bytes)],
      name,
      { type: mimeType }
    );

    const transfer = new DataTransfer();
    transfer.items.add(file);

    try {
      input.files = transfer.files;

      input.dispatchEvent(
        new Event("input", { bubbles: true })
      );

      input.dispatchEvent(
        new Event("change", { bubbles: true })
      );

      await wait(850);

      const selected = input.files?.[0];

      if (
        selected?.name === name &&
        selected?.size === file.size
      ) {
        return {
          ok: true,
          filename: name,
          needsVerification: true,
        };
      }

      return {
        ok: false,
        reason:
          "The website did not retain the selected resume",
      };
    } catch (error) {
      return {
        ok: false,
        reason: error.message,
      };
    }
  }

  // ---------------------------------------------
  // EXPOSE ENGINE TO OFFERLY POPUP
  // ---------------------------------------------


function elementPoint(element) {
  if (!element || !visible(element)) return null;

  const rect = element.getBoundingClientRect();

  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;

  // Coordinates for Chrome browser input are relative
  // to the visible page viewport.
  if (
    x < 0 ||
    y < 0 ||
    x >= window.innerWidth ||
    y >= window.innerHeight
  ) {
    return null;
  }

  return { x, y };
}


async function dropdownTarget(id) {
  const element = find(id);

  if (!element) {
    return {
      ok: false,
      reason: "Dropdown not found",
    };
  }

  if (element.tagName === "SELECT") {
    return {
      ok: true,
      type: "select",
      options: [...element.options]
        .filter(
          (option) =>
            !option.disabled && option.value
        )
        .map((option) => ({
          label: option.textContent.trim(),
          value: option.value,
        })),
    };
  }

  if (typeOf(element) !== "custom") {
    return {
      ok: false,
      reason: "Not a custom dropdown",
    };
  }

  const control =
    element.closest(".select__control") ||
    element;

  control.scrollIntoView({
    behavior: "instant",
    block: "center",
    inline: "nearest",
  });

  await wait(250);

  const point = elementPoint(control);

  return point
    ? {
        ok: true,
        type: "custom",
        point,
      }
    : {
        ok: false,
        reason:
          "Dropdown couldn't be positioned onscreen",
      };
}


function dropdownMenuRoot(element) {
  const id =
    element.getAttribute("aria-controls") ||
    element.getAttribute("aria-owns");

  if (id) {
    const root = document.getElementById(id);
    if (root && visible(root)) return root;
  }

  const roots = [
    ...document.querySelectorAll(
      "[role='listbox'], " +
      ".select__menu-list, " +
      "[class*='__menu-list']"
    ),
  ].filter(visible);

  // Never select options from an ambiguous menu.
  return roots.length === 1 ? roots[0] : null;
}

function dropdownOptionNodes(id) {
  const element = find(id);

  if (!element || typeOf(element) !== "custom") {
    return [];
  }

  const root = dropdownMenuRoot(element);

  if (!root) return [];

  return [...root.querySelectorAll(
    "[role='option'], " +
    ".select__option, " +
    "[class*='__option']"
  )].filter(
    (option) =>
      visible(option) &&
      option.getAttribute("aria-disabled") !== "true" &&
      option.getAttribute("data-disabled") !== "true"
  );
}

function dropdownChoices(id) {
  const seen = new Set();

  return dropdownOptionNodes(id)
    .map((element) => {
      const label = (
        element.getAttribute("aria-label") ||
        element.textContent ||
        ""
      ).trim();

      return { label, value: label };
    })
    .filter((option) => {
      const key = normalize(option.label);

      if (!key || seen.has(key)) return false;

      seen.add(key);
      return true;
    });
}


async function dropdownOptionTarget(id, label) {
  const matches = dropdownOptionNodes(id).filter(
    (option) =>
      normalize(
        option.getAttribute("aria-label") ||
        option.textContent
      ) === normalize(label)
  );

  if (matches.length !== 1) {
    return {
      ok: false,
      reason:
        "Matching option is missing or ambiguous",
    };
  }

  const option = matches[0];

  option.scrollIntoView({
    behavior: "instant",
    block: "nearest",
    inline: "nearest",
  });

  await wait(150);

  const point = elementPoint(option);

  return point
    ? {
        ok: true,
        point,
      }
    : {
        ok: false,
        reason:
          "Option could not be positioned onscreen",
      };
}


function dropdownSelection(id) {
  const element = find(id);

  if (!element) return { value: "" };

  return {
    value: selectedCustomValue(element),
  };
}


  // Replace any previously injected implementation.
  globalThis.offerlyEngine = {
  scan,
  fillText,
  fillAnswer,
  getDropdownOptions,
  attachResume,
  dropdownTarget,
  dropdownChoices,
  dropdownOptionTarget,
  dropdownSelection,
};
})();
