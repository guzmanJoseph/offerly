
/*
 * Offerly Universal Form Engine
 *
 * Supports:
 * - Personal information autofill
 * - Native HTML dropdowns
 * - React Select / accessible custom dropdowns
 * - Workday button-based dropdowns
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

  function isWorkdayDropdown(element) {
    return element.matches(
      "button[aria-haspopup='listbox']"
    );
  }

  function typeOf(element) {
    if (element.type === "file") return "file";

    if (element.tagName === "SELECT") {
      return "select";
    }

    if (
      element.getAttribute("role") === "combobox" ||
      isWorkdayDropdown(element)
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
      "input, textarea, select, [role='combobox'], " +
      "button[aria-haspopup='listbox']"
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
          "reset",
        ].includes(type)
      ) {
        return false;
      }

      if (
        type === "button" &&
        !isWorkdayDropdown(element)
      ) {
        return false;
      }

      if (type === "file") return true;

      if (
        element.matches(".iti__search-input") ||
        element.closest(".iti__dropdown-content")
      ) {
        return false;
      }

      if (isWorkdayDropdown(element)) {
        if (
          element.closest(
            "[data-automation-id='utilityButtonBar']"
          )
        ) {
          return false;
        }

        if (
          !element.closest(
            "form, [data-automation-id='formField'], " +
            "[data-automation-id='questionnaireQuestion'], " +
            "[data-automation-id='formFieldContainer']"
          ) &&
          !/^(primaryQuestionnaire--|education-)/.test(
            element.id || ""
          )
        ) {
          return false;
        }
      }

      return visible(element);
    });
  }

  // ---------------------------------------------
  // FIELD LABELS
  // ---------------------------------------------

  function workdayQuestionLabel(element) {
    if (!isWorkdayDropdown(element)) {
      return "";
    }

    const candidates = [];

    let parent = element.parentElement;

    for (
      let depth = 0;
      parent && depth < 7;
      depth++
    ) {
      const labels = [
        ...parent.querySelectorAll(
          "label, legend, " +
          "[data-automation-id='questionLabel'], " +
          "[data-automation-id='promptOption']"
        ),
      ];

      const matches = labels
        .map((node) => node.textContent?.trim())
        .filter((text) =>
          text &&
          text.length > 10 &&
          !/^(yes|no|select one|required)$/i.test(text)
        );

      const unique = [...new Set(matches)];

      if (unique.length === 1) {
        return unique[0];
      }

      if (unique.length > 1) {
        candidates.push(...unique);
      }

      if (
        parent.matches("form, main, body")
      ) {
        break;
      }

      parent = parent.parentElement;
    }

    return candidates.length === 1
      ? candidates[0]
      : "";
  }

  function labelOf(element) {
    if (isWorkdayDropdown(element)) {
      const question = workdayQuestionLabel(element);

      if (question) {
        return question;
      }
    }

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
      const linked = [
        ...document.querySelectorAll("label[for]"),
      ].find(
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
    if (isWorkdayDropdown(element)) {
      const text =
        element.textContent?.trim() || "";

      return /^(select one|select|choose)$/i.test(text)
        ? ""
        : text;
    }

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
    const fullName = [
      profile.firstName,
      profile.lastName,
    ]
      .filter((part) => String(part || "").trim())
      .join(" ")
      .trim();

    const rules = [
      [
        "fullName",
        /full.?name|your.?name|applicant.?name/,
      ],
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

      const values = {
        ...profile,
        fullName:
          profile.firstName?.trim() &&
          profile.lastName?.trim()
            ? fullName
            : "",
      };

      const matches = rules.filter(
        ([key, regex]) =>
          values[key] &&
          regex.test(normalize(field.label))
      );

      if (matches.length !== 1) continue;

      if (
        setText(
          element,
          values[matches[0][0]]
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

    if (
      combobox.getAttribute("aria-expanded") === "true"
    ) {
      const existing = availableOptions(combobox);

      if (existing.length) return existing;
    }

    const control =
      combobox.closest(".select__control") ||
      combobox;

    control.click();

    await wait(250);

    let options = availableOptions(combobox);

    if (options.length) {
      return options;
    }

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

      selectedOption.node.dispatchEvent(
        new MouseEvent("mousedown", {
          bubbles: true,
          cancelable: true,
          button: 0,
        })
      );

      await wait(100);

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
  const isWorkday =
    /(^|\.)myworkdayjobs\.com$/i.test(
      window.location.hostname
    );

  const waitFor = (ms) =>
    new Promise(resolve => setTimeout(resolve, ms));

  const allInputs = [
    ...document.querySelectorAll("input[type='file']")
  ].filter(input => !input.disabled);


const workdayInput = isWorkday
  ? document.querySelector(
      'input[type="file"][data-automation-id="file-upload-input-ref"]'
    )
  : null;

if (workdayInput && !workdayInput.disabled) {
  const file = new File(
    [new Uint8Array(bytes)],
    name,
    { type: mimeType }
  );

  const transfer = new DataTransfer();
  transfer.items.add(file);

  workdayInput.files = transfer.files;

  workdayInput.dispatchEvent(
    new Event("input", {
      bubbles: true,
      composed: true
    })
  );

  workdayInput.dispatchEvent(
    new Event("change", {
      bubbles: true,
      composed: true
    })
  );

  await new Promise(resolve => setTimeout(resolve, 1500));

  const selected = workdayInput.files?.[0];

  return {
    ok: Boolean(
      selected?.name === name &&
      selected?.size === file.size
    ),
    filename: selected?.name || "",
    needsVerification: true,
    reason: selected
      ? "File selected. Confirm Workday finished uploading."
      : "Workday did not retain the file."
  };
}


  if (!allInputs.length) {
    return {
      ok: false,
      reason: "No file upload input found on this page."
    };
  }

  function uploadContext(input) {
    const parts = [
      input.id,
      input.name,
      input.getAttribute("aria-label"),
      input.getAttribute("data-automation-id"),
    ];

    let parent = input.parentElement;

    for (let i = 0; parent && i < 7; i++) {
      const text = (
        parent.innerText || ""
      ).slice(0, 500);

      parts.push(text);

      if (
        /resume|curriculum vitae|upload a file/i.test(text)
      ) {
        break;
      }

      parent = parent.parentElement;
    }

    return parts
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }

  const ranked = allInputs.map(input => {
    const context = uploadContext(input);

    let score = 0;

    if (/resume|curriculum vitae/.test(context)) {
      score += 20;
    }

    if (/upload a file|drop files here/.test(context)) {
      score += 10;
    }

    if (/cover letter/.test(context)) {
      score -= 50;
    }

    // Workday often places a hidden native file input
    // inside its Resume/CV upload component.
    if (
      isWorkday &&
      input.closest("[data-automation-id]")
    ) {
      score += 1;
    }

    return { input, score };
  }).sort((a, b) => b.score - a.score);

  const best = ranked[0];

  if (
    !best ||
    best.score <= 0 ||
    ranked[1]?.score === best.score
  ) {
    return {
      ok: false,
      reason: "Could not uniquely identify the resume field."
    };
  }

  const input = best.input;

  let rawBytes;

  try {
    rawBytes = new Uint8Array(bytes);
  } catch {
    return {
      ok: false,
      reason: "Resume bytes could not be read."
    };
  }

  if (
    !rawBytes.length ||
    rawBytes.length > 5 * 1024 * 1024
  ) {
    return {
      ok: false,
      reason: "Resume must be between 1 byte and 5 MB."
    };
  }

  const filename = String(name || "").split(/[\\/]/).pop();

  if (!/\.(pdf|docx)$/i.test(filename)) {
    return {
      ok: false,
      reason: "Only PDF and DOCX resumes are supported."
    };
  }

  const file = new File(
    [rawBytes],
    filename,
    {
      type: mimeType ||
        (filename.toLowerCase().endsWith(".pdf")
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
      lastModified: Date.now()
    }
  );

  // Do not replace an already attached matching file.
  const existing = input.files?.[0];

  if (
    existing?.name === file.name &&
    existing?.size === file.size
  ) {
    return {
      ok: true,
      filename: file.name,
      needsVerification: true,
      reason: "Matching file is selected; confirm upload."
    };
  }

  const transfer = new DataTransfer();
  transfer.items.add(file);

  try {
    input.files = transfer.files;

    // Notify the site's normal upload handlers.
    input.dispatchEvent(
      new Event("input", {
        bubbles: true,
        composed: true
      })
    );

    input.dispatchEvent(
      new Event("change", {
        bubbles: true,
        composed: true
      })
    );

    // Workday may upload asynchronously.
    // Give the component time to process its change event.
    await waitFor(1200);

    const selected = input.files?.[0];

    if (
      selected?.name !== filename ||
      selected?.size !== file.size
    ) {
      return {
        ok: false,
        reason: "Workday did not retain the selected file."
      };
    }

    if (isWorkday) {
      await waitFor(1000);

      const errors = [
        ...document.querySelectorAll(
          "[role='alert'], [aria-invalid='true']"
        )
      ].map(el => el.textContent || "")
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      if (
        /file type not supported|file too large|upload failed/.test(
          errors
        )
      ) {
        return {
          ok: false,
          reason: "Workday reported an upload error."
        };
      }
    }

    return {
      ok: true,
      filename,
      needsVerification: true
    };
  } catch (error) {
    return {
      ok: false,
      reason: error.message || "Resume attachment failed."
    };
  }
}


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
  // TRUSTED DROPDOWN DRIVER SUPPORT
  // ---------------------------------------------

  function elementPoint(element) {
    if (!element || !visible(element)) return null;

    const rect = element.getBoundingClientRect();

    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;

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
      "[class*='__option'], " +
      "[data-radix-select-item], " +
      "[cmdk-item]"
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
