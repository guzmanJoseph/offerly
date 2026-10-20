(() => {
  if (globalThis.offerlyQuestionDrafts) {
    globalThis.offerlyQuestionDrafts.scan();
    return;
  }

  const mounted = new Map();
  let savedDescription = "";
  let requestInProgress = false;

  const blocked =
    /\b(salary|compensation|sponsorship|visa|citizenship|gender|ethnicity|disability|veteran|consent|signature|password|social security)\b/i;

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

  function questionFor(field) {
    const labels = [
      ...Array.from(
        field.labels || [],
        label => label.textContent
      ),
      ...String(
        field.getAttribute("aria-labelledby") || ""
      )
        .split(/\s+/)
        .filter(Boolean)
        .map(id => document.getElementById(id)?.textContent),
      field.getAttribute("aria-label"),
      field.getAttribute("placeholder"),
    ];

    return String(
      labels.find(value => String(value || "").trim()) || ""
    ).trim().slice(0, 2000);
  }

  function detectDescription() {
    const selectors = [
      '[itemprop="description"]',
      "#job-description",
      "#job_description",
      ".job-description",
      ".job__description",
      ".ashby-job-posting-description",
      '[data-testid="job-description"]',
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      const value = element?.textContent?.trim();

      if (value && value.length >= 80) {
        return value.slice(0, 14000);
      }
    }

    return savedDescription;
  }

  function mount(field, question) {
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
          border: 1px solid #285de5;
          border-radius: 8px;
          background: #285de5;
          color: #fff;
          cursor: pointer;
        }

        button:disabled {
          opacity: .65;
          cursor: wait;
        }

        button:focus-visible {
          outline: 3px solid #91b1ff;
          outline-offset: 2px;
        }

        p {
          margin: 6px 0 0;
          color: #b42318;
          background: #fff;
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

    const coverLetter = /cover[\s_-]*letter/i.test(
      `${question} ${field.name || ""} ${field.id || ""}`
    );

    const defaultLabel = coverLetter
      ? "✦ Write cover letter"
      : "✦ Draft with Offerly";

    button.textContent = defaultLabel;

    button.onclick = async () => {
      if (requestInProgress) {
        status.textContent =
          "Wait for the current draft to finish.";
        return;
      }

      status.textContent = "";

      if (!visible(field)) {
        status.textContent =
          "The application field changed. Refresh the page.";
        return;
      }

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
          "Paste the job description so Offerly can tailor your answers."
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
            mode: coverLetter
              ? "draftCoverLetter"
              : "draftAnswer",
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

        // Do not overwrite anything typed while AI was working.
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
          new Event("input", { bubbles: true })
        );

        field.dispatchEvent(
          new Event("change", { bubbles: true })
        );

        if (field.value !== draft) {
          throw new Error(
            "The website did not retain the answer."
          );
        }

        field.focus();
      } catch (error) {
        status.textContent =
          error.message || "Could not generate an answer.";
      } finally {
        requestInProgress = false;
        button.disabled = false;
        button.textContent = field.value.trim()
          ? "✦ Rewrite with Offerly"
          : defaultLabel;
      }
    };

    return host;
  }

  function scan() {
    for (const [field, host] of mounted) {
      if (!field.isConnected) {
        host.remove();
        mounted.delete(field);
      } else if (!host.isConnected) {
        mounted.delete(field);
      }
    }

    for (const field of document.querySelectorAll(
      'textarea, input[type="text"]'
    )) {
      if (mounted.has(field) || !visible(field)) continue;

      const question = questionFor(field);

      if (!question || blocked.test(question)) continue;

      const writtenQuestion =
        field.tagName === "TEXTAREA" ||
        /cover[\s_-]*letter|\b(why|describe|explain|tell us|tell me|what interests|share an example)\b/i
          .test(question);

      if (!writtenQuestion) continue;

      mounted.set(field, mount(field, question));
    }
  }

  let timer;

  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(scan, 250);
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  globalThis.offerlyQuestionDrafts = { scan };
  scan();
})();