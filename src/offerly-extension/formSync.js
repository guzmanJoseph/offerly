
/*
 * Offerly Form State Synchronizer
 *
 * Runs after autofill to help frameworks recognize
 * values that were already entered.
 *
 * Does not submit forms, click buttons,
 * or check consent fields.
 */

window.offerlyFormSync = (() => {
  const wait = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  async function apply(tabId) {
    if (!Number.isInteger(tabId)) {
      throw new Error("Invalid application tab");
    }

    const results = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",

      func: async () => {
        const delay = (ms) =>
          new Promise((resolve) => setTimeout(resolve, ms));

        const unsafe =
          /password|hidden|file|checkbox|radio|submit|button|reset/i;

        const protectedField =
          /consent|privacy|agreement|signature|captcha|certif|attest/i;

        const candidates = [
          ...document.querySelectorAll(
            "input, textarea"
          )
        ].filter((el) => {
          const type =
            (el.type || "text").toLowerCase();

          if (
            unsafe.test(type) ||
            el.disabled ||
            el.readOnly ||
            !el.isConnected ||
            !String(el.value || "").trim()
          ) {
            return false;
          }

          const label =
            [
              el.getAttribute("aria-label"),
              el.name,
              el.id,
              [...(el.labels || [])]
                .map((label) => label.textContent)
                .join(" ")
            ].filter(Boolean).join(" ");

          return !protectedField.test(label);
        });

        const results = {
          checked: 0,
          synchronized: 0,
          stillInvalid: [],
          reverted: []
        };

        for (const el of candidates) {
          const originalValue = el.value;

          const label =
            [...(el.labels || [])]
              .map((item) => item.textContent?.trim())
              .find(Boolean) ||
            el.getAttribute("aria-label") ||
            el.name ||
            el.id ||
            "Unnamed field";

          results.checked++;

          try {
            const prototype =
              el.tagName === "TEXTAREA"
                ? HTMLTextAreaElement.prototype
                : HTMLInputElement.prototype;

            const setter =
              Object.getOwnPropertyDescriptor(
                prototype,
                "value"
              )?.set;

            if (!setter) continue;

            // Use the native value setter from the
            // webpage's own JavaScript environment.
            setter.call(el, originalValue);

            el.dispatchEvent(
              new Event("input", {
                bubbles: true
              })
            );

            el.dispatchEvent(
              new Event("change", {
                bubbles: true
              })
            );

            // Some validators run when focus leaves.
            el.dispatchEvent(
              new FocusEvent("focusout", {
                bubbles: true
              })
            );

            await delay(80);

            if (el.value !== originalValue) {
              results.reverted.push(label);
              continue;
            }

            results.synchronized++;

            const invalid =
              el.getAttribute("aria-invalid") === "true" ||
              !el.checkValidity();

            if (invalid) {
              results.stillInvalid.push(label);
            }
          } catch (error) {
            results.stillInvalid.push(label);
          }
        }

        await delay(250);

        return results;
      }
    });

    const result = results?.[0]?.result || {
      checked: 0,
      synchronized: 0,
      stillInvalid: [],
      reverted: []
    };

    console.info("Offerly form synchronization:", result);

    return result;
  }

  return { apply };
})();
