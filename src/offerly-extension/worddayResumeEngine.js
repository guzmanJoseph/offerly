
/*
 * Offerly Workday Resume Engine
 *
 * Handles Workday resume uploads separately
 * from the universal form engine.
 *
 * Does not submit job applications.
 */

(() => {
  const wait = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const normalize = (value) =>
    String(value || "").trim().toLowerCase();

  function uploadSection(input) {
    let parent = input;

    for (
      let depth = 0;
      parent && depth < 8;
      depth++, parent = parent.parentElement
    ) {
      if (
        parent.querySelector?.(
          '[data-automation-id="file-upload-drop-zone"]'
        )
      ) {
        return parent;
      }
    }

    return input.parentElement;
  }

  function attachmentShown(input, filename) {
    const section = uploadSection(input);

    return normalize(section?.innerText).includes(
      normalize(filename)
    );
  }

  async function attach(bytes, filename, mime) {
    if (
      !/(^|\.)myworkdayjobs\.com$/i.test(
        location.hostname
      )
    ) {
      return {
        ok: false,
        reason: "Not a Workday application",
      };
    }

    if (!Array.isArray(bytes) || !bytes.length) {
      return {
        ok: false,
        reason: "No resume bytes received",
      };
    }

    if (bytes.length > 5 * 1024 * 1024) {
      return {
        ok: false,
        reason: "Resume exceeds 5 MB",
      };
    }

    if (!/\.(pdf|docx)$/i.test(filename || "")) {
      return {
        ok: false,
        reason: "Resume must be PDF or DOCX",
      };
    }

    const inputs = [
      ...document.querySelectorAll(
        'input[type="file"]' +
        '[data-automation-id="file-upload-input-ref"]'
      ),
    ].filter((input) => !input.disabled);

    if (inputs.length !== 1) {
      return {
        ok: false,
        reason:
          `Expected one Workday resume input, ` +
          `found ${inputs.length}`,
      };
    }

    const input = inputs[0];

    if (attachmentShown(input, filename)) {
      return {
        ok: true,
        confirmed: true,
        filename,
        reason: "Attachment already displayed",
      };
    }

    const file = new File(
      [new Uint8Array(bytes)],
      filename,
      {
        type:
          mime ||
          (filename.toLowerCase().endsWith(".pdf")
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        lastModified: Date.now(),
      }
    );

    const transfer = new DataTransfer();
    transfer.items.add(file);

    try {
      input.files = transfer.files;

      input.dispatchEvent(
        new Event("input", {
          bubbles: true,
          composed: true,
        })
      );

      input.dispatchEvent(
        new Event("change", {
          bubbles: true,
          composed: true,
        })
      );

      // Wait for Workday's asynchronous upload.
      for (let attempt = 0; attempt < 12; attempt++) {
        await wait(300);

        if (attachmentShown(input, filename)) {
          return {
            ok: true,
            confirmed: true,
            filename,
            reason:
              "Filename displayed in Workday",
          };
        }

        const errors = [
          ...document.querySelectorAll(
            '[role="alert"]'
          ),
        ]
          .map((element) => element.textContent || "")
          .join(" ");

        if (
          /upload failed|file too large|unsupported file/i
            .test(errors)
        ) {
          return {
            ok: false,
            confirmed: false,
            reason: errors.slice(0, 250),
          };
        }
      }

      return {
        ok: false,
        confirmed: false,
        selectedInInput:
          input.files?.[0]?.name === filename,
        reason:
          "Workday did not display an uploaded attachment. " +
          "Select the file manually if necessary.",
      };
    } catch (error) {
      return {
        ok: false,
        confirmed: false,
        reason:
          error?.message || String(error),
      };
    }
  }

  globalThis.offerlyWorkdayResume = {
    attach,
  };
})();
