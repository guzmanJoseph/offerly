(() => {
  if (globalThis.offerlyQuestionDrafts) {
    globalThis.offerlyQuestionDrafts.scan();
    return;
  }

  const mounted = new Map();
  let savedDescription = "";
  let requestInProgress = false;
  let timer;

  const blocked =
    /\b(salary|compensation|sponsorship|visa|citizenship|gender|ethnicity|disability|veteran|consent|signature|password|social security|work authorization)\b/i;

  const writtenPrompt =
    /cover[\s_-]*letter|\b(why|describe|explain|tell us|tell me|what interests|share an example|please provide|please share|additional information|anything else)\b/i;

  function clean(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 2000);
  }

  function visible(field) {
    if (!field?.isConnected) return false;

    const style = getComputedStyle(field);

    return (
      !field.disabled &&
      !field.readOnly &&
      !field.closest("[aria-hidden='true'], [inert]") &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      field.getClientRects().length > 0
    );
  }

  function textWithoutControls(element) {
    if (!element) return "";

    const copy = element.cloneNode(true);

    copy.querySelectorAll(
      "input, textarea, select, button, script, style, " +
      "[data-offerly-draft-ui]"
    ).forEach(node => node.remove());

    return clean(copy.textContent);
  }

  function questionFor(field) {
    const labels = [
      ...Array.from(
        field.labels || [],
        label => label.textContent
      ),
      ...String(field.getAttribute("aria-labelledby") || "")
        .split(/\s+/)
        .filter(Boolean)
        .map(id => document.getElementById(id)?.textContent),
      field.getAttribute("aria-label"),
    ];

    const direct = labels.map(clean).find(Boolean);
    if (direct) return direct;

    // Some forms show a label without connecting it to the input.
    let container = field.parentElement;

    for (let depth = 0; container && depth < 4; depth++) {
      if (container.matches("form, main, body, html")) break;

      const controls = container.querySelectorAll(
        'textarea, input:not([type="hidden"]), select'
      );

      // Avoid borrowing a question from a neighboring field.
      if (controls.length > 1) break;

      const label = Array.from(
        container.querySelectorAll(
          "label, legend, [class*='question'], " +
          "[class*='label'], [data-testid*='label']"
        )
      ).find(element =>
        !element.closest("[data-offerly-draft-ui]") &&
        clean(element.textContent)
      );

      if (label) return clean(label.textContent);

      const nearby = textWithoutControls(container);

      if (
        nearby &&
        nearby.length <= 1000 &&
        writtenPrompt.test(nearby)
      ) {
        return nearby;
      }

      container = container.parentElement;
    }

    const previous = field.previousElementSibling;

    if (
      previous &&
      !previous.matches("input, textarea, select, button") &&
      !previous.querySelector("input, textarea, select")
    ) {
      const text = textWithoutControls(previous);
      if (text && text.length <= 1000) return text;
    }

    return clean(field.getAttribute("placeholder"));
  }

  function applicationContext() {
    if (
      /greenhouse|ashbyhq|myworkdayjobs|myworkdaysite|jobs\.lever\.co/i
        .test(location.hostname)
    ) {
      return true;
    }

    if (/careers?|jobs?|apply|application/i.test(location.pathname)) {
      return true;
    }

    return Boolean(
      document.querySelector(
        'input[type="file"][accept*=".pdf"], ' +
        'input[autocomplete="given-name"], ' +
        '[data-automation-id="jobPostingDescription"], ' +
        '[itemtype*="JobPosting"]'
      ) &&
      /\b(apply|application|resume|résumé)\b/i.test(
        document.body?.innerText || ""
      )
    );
  }

  function detectDescription() {
    const selectors = [
      '[itemprop="description"]',
      "#job-description",
      "#job_description",
      "#content .content",
      ".job-description",
      ".job__description",
      ".ashby-job-posting-description",
      '[data-testid="job-description"]',
      '[data-automation-id="jobPostingDescription"]',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);

      // Do not treat the application form as a job description.
      if (
        !element ||
        element.querySelector("textarea, input, select")
      ) {
        continue;
      }

      const value = element.textContent?.trim();

      if (value && value.length >= 80) {
        return value.slice(0, 14000);
      }
    }

    return savedDescription;
  }

  function eligible(field, question) {
    if (!visible(field) || !question || blocked.test(question)) {
      return false;
    }

    if (
      field.closest("[data-offerly-draft-ui]") ||
      field.getAttribute("role") === "combobox" ||
      field.getAttribute("aria-autocomplete")
    ) {
      return false;
    }

    // Exclude basic profile fields and unrelated comment boxes.
    if (
      /^(first name|last name|full name|email|phone|address|city|state|zip|linkedin|github|website|search|comment|message)\s*[:*]?$/i
        .test(question)
    ) {
      return false;
    }

    return writtenPrompt.test(question) ||
      (
        field.tagName === "TEXTAREA" &&
        applicationContext()
      );
  }

  function mount(field) {
    const host = document.createElement("div");
    host.dataset.offerlyDraftUi = "true";
    field.insertAdjacentElement("afterend", host);

    const shadow = host.attachShadow({ mode: "closed" });

    shadow.innerHTML = `
      <style>
        :host {
          display: block;
          margin: 7px 0 14px;
          font: 13px/1.4 system-ui, sans-serif;
          text-align: left;
        }

        button {
          font: inherit;
          padding: 7px 11px;
          border: 1px solid #7055ed;
          border-radius: 8px;
          background: #7055ed;
          color: #fff;
          cursor: pointer;
        }

        button:disabled {
          opacity: .65;
          cursor: wait;
        }

        button:focus-visible {
          outline: 3px solid #b8aaff;
          outline-offset: 2px;
        }

        p {
          margin: 6px 0 0;
          padding: 4px 6px;
          color: #8a1c13;
          background: #fff2f0;
          border-radius: 4px;
        }

        p:empty {
          display: none;
        }
      </style>

      <button type="button" id="generate">
        ✦ Draft with Offerly
      </button>

      <p id="status" role="status" aria-live="polite"></p>
    `;

    const button = shadow.getElementById("generate");
    const status = shadow.getElementById("status");

    function updateLabel() {
      const coverLetter = /cover[\s_-]*letter/i.test(
        `${questionFor(field)} ${field.name} ${field.id}`
      );

      button.textContent = field.value.trim()
        ? "✦ Rewrite with Offerly"
        : coverLetter
          ? "✦ Write cover letter"
          : "✦ Draft with Offerly";
    }

    updateLabel();

    button.onclick = async () => {
      if (requestInProgress) {
        status.textContent = "Wait for the current draft to finish.";
        return;
      }

      status.textContent = "";

      const question = questionFor(field);

      if (!eligible(field, question)) {
        status.textContent =
          "This field changed or is not a supported written question.";
        return;
      }

      const coverLetter = /cover[\s_-]*letter/i.test(
        `${question} ${field.name} ${field.id}`
      );

      const originalValue = field.value;

      if (
        originalValue.trim() &&
        !window.confirm("Replace the existing answer with a new draft?")
      ) {
        return;
      }

      let jobDescription = detectDescription();

      if (!jobDescription || jobDescription.length < 40) {
        const pasted = window.prompt(
          "Paste the job description so Offerly can tailor your answer."
        );

        if (pasted === null) return;

        jobDescription = pasted.trim().slice(0, 14000);

        if (jobDescription.length < 40) {
          status.textContent =
            "Add the full job description and try again.";
          return;
        }

        savedDescription = jobDescription;
      }

      requestInProgress = true;
      button.disabled = true;
      button.textContent = "✦ Writing…";

      try {
        const result = await chrome.runtime.sendMessage({
          type: "OFFERLY_DRAFT_REQUEST",
          payload: {
            mode: coverLetter ? "draftCoverLetter" : "draftAnswer",
            question,
            company: "",
            role: "",
            jobDescription,
            existingDraft: originalValue.slice(0, 5000),
            tone: "natural",
            maxWords: coverLetter ? 300 : 150,
          },
        });

        if (!result || result.error) {
          throw new Error(
            result?.error || "No response from Offerly."
          );
        }

        if (result.action === "needsDetails") {
          throw new Error(
            (result.missingDetails || []).join(" ") ||
            "Add more background to your Offerly profile."
          );
        }

        if (
          result.action !== "draft" ||
          typeof result.draft !== "string" ||
          !result.draft.trim()
        ) {
          throw new Error("No draft was generated.");
        }

        if (!visible(field)) {
          throw new Error(
            "The application field changed. Please try again."
          );
        }

        if (field.value !== originalValue) {
          throw new Error(
            "You edited this answer while the draft was generating. Your changes were kept."
          );
        }

        const draft = result.draft.trim();

        if (
          field.maxLength >= 0 &&
          draft.length > field.maxLength
        ) {
          throw new Error(
            `The draft exceeds this field’s ${field.maxLength}-character limit.`
          );
        }

        const prototype = field.tagName === "TEXTAREA"
          ? HTMLTextAreaElement.prototype
          : HTMLInputElement.prototype;

        const setter = Object.getOwnPropertyDescriptor(
          prototype,
          "value"
        )?.set;

        if (!setter) {
          throw new Error("This text box is not supported yet.");
        }

        setter.call(field, draft);

        field.dispatchEvent(
          new Event("input", { bubbles: true, composed: true })
        );

        field.dispatchEvent(
          new Event("change", { bubbles: true, composed: true })
        );

        await new Promise(resolve => setTimeout(resolve, 150));

        if (!field.isConnected || field.value !== draft) {
          throw new Error(
            "The page changed the answer field. Check whether your draft was retained."
          );
        }

        field.focus();
      } catch (error) {
        status.textContent =
          error.message || "Could not generate an answer.";
      } finally {
        requestInProgress = false;
        button.disabled = false;
        updateLabel();
      }
    };

    return host;
  }

  function scan() {
    for (const [field, host] of mounted) {
      if (
        !field.isConnected ||
        !host.isConnected ||
        !eligible(field, questionFor(field))
      ) {
        host.remove();
        mounted.delete(field);
      }
    }

    // The manifest loads this script broadly. Only add UI on
    // pages with application context.
    if (!applicationContext()) return;

    for (const field of document.querySelectorAll(
      'textarea, input[type="text"], input:not([type])'
    )) {
      if (mounted.has(field)) continue;

      const question = questionFor(field);
      if (!eligible(field, question)) continue;

      mounted.set(field, mount(field));
    }
  }

  function scheduleScan() {
    clearTimeout(timer);
    timer = setTimeout(scan, 250);
  }

  const observer = new MutationObserver(records => {
    const relevant = records.some(record => {
      const element = record.target.nodeType === Node.ELEMENT_NODE
        ? record.target
        : record.target.parentElement;

      if (element?.closest("[data-offerly-draft-ui]")) {
        return false;
      }

      if (record.type !== "childList") return true;

      const nodes = [
        ...record.addedNodes,
        ...record.removedNodes,
      ];

      return nodes.some(node =>
        node.nodeType !== Node.ELEMENT_NODE ||
        !node.matches("[data-offerly-draft-ui]")
      );
    });

    if (relevant) scheduleScan();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: [
      "hidden", "disabled", "readonly",
      "aria-hidden", "aria-label", "aria-labelledby",
      "class", "style",
    ],
  });

  globalThis.offerlyQuestionDrafts = { scan };
  scan();
})();