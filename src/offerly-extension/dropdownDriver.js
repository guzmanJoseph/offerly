
window.offerlyDropdownDriver = (() => {
  const delay = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  const norm = (value) =>
    String(value ?? "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  async function callEngine(tabId, method, ...args) {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: (name, values) =>
        globalThis.offerlyEngine[name](...values),
      args: [method, args],
    });

    return results?.[0]?.result;
  }

  async function trustedClick(tabId, location) {
    if (
      !location ||
      !Number.isFinite(location.x) ||
      !Number.isFinite(location.y)
    ) {
      return {
        ok: false,
        reason: "Control is off screen",
      };
    }

    const result = await chrome.runtime.sendMessage({
      type: "OFFERLY_TRUSTED_CLICK",
      tabId,
      x: location.x,
      y: location.y,
    });

    return result?.ok
      ? { ok: true }
      : {
          ok: false,
          reason: result?.error || "Click failed",
        };
  }

  async function openAndRead(tabId, fieldId) {
    const target = await callEngine(
      tabId,
      "dropdownTarget",
      fieldId
    );

    if (!target?.ok) {
      return {
        ok: false,
        options: [],
        reason: target?.reason || "No dropdown found",
      };
    }

    if (target.type === "select") {
      return { ok: true, options: target.options };
    }

    // Avoid toggling a menu that's already open.
    const alreadyOpen = await callEngine(
      tabId,
      "dropdownChoices",
      fieldId
    );

    if (alreadyOpen?.length) {
      return { ok: true, options: alreadyOpen };
    }

    const clicked = await trustedClick(
      tabId,
      target.point
    );

    if (!clicked.ok) {
      return {
        ok: false,
        options: [],
        reason: clicked.reason,
      };
    }

    for (let attempt = 0; attempt < 8; attempt++) {
      await delay(150);

      const options = await callEngine(
        tabId,
        "dropdownChoices",
        fieldId
      );

      if (options?.length) {
        return { ok: true, options };
      }
    }

    return {
      ok: false,
      options: [],
      reason: "No matching open option menu detected",
    };
  }

  async function fill(tabId, fieldId, answer) {
    const target = await callEngine(
      tabId,
      "dropdownTarget",
      fieldId
    );

    if (!target?.ok) {
      return {
        ok: false,
        reason: target?.reason || "Field not found",
      };
    }

    if (target.type === "select") {
      return callEngine(
        tabId,
        "fillAnswer",
        fieldId,
        answer
      );
    }

    const opened = await openAndRead(tabId, fieldId);

    if (!opened.ok) return opened;

    const matches = opened.options.filter(
      (option) =>
        norm(option.label) === norm(answer) ||
        option.value === answer
    );

    if (matches.length !== 1) {
      return {
        ok: false,
        reason: "No unique matching option",
      };
    }

    const option = await callEngine(
      tabId,
      "dropdownOptionTarget",
      fieldId,
      matches[0].label
    );

    if (!option?.ok) {
      return {
        ok: false,
        reason: option?.reason || "Option no longer visible",
      };
    }

    const clicked = await trustedClick(
      tabId,
      option.point
    );

    if (!clicked.ok) return clicked;

    await delay(300);

    const verification = await callEngine(
      tabId,
      "dropdownSelection",
      fieldId
    );

    return norm(verification?.value) === norm(matches[0].label)
      ? {
          ok: true,
          value: verification.value,
        }
      : {
          ok: false,
          reason:
            "Click sent; could not verify selection on form",
        };
  }

  return { openAndRead, fill };
})();
