
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (message?.type !== "OFFERLY_TRUSTED_CLICK") return;

  (async () => {
    const { tabId, x, y } = message;

    if (
      sender.id !== chrome.runtime.id ||
      !sender.url?.startsWith(chrome.runtime.getURL("popup.html"))
    ) {
      throw new Error("Untrusted sender");
    }

    if (
      !Number.isInteger(tabId) ||
      !Number.isFinite(x) ||
      !Number.isFinite(y) ||
      x < 0 ||
      y < 0
    ) {
      throw new Error("Invalid click target");
    }

    const tab = await chrome.tabs.get(tabId);
    const [active] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (
      tabId !== active?.id ||
      !/^https:\/\//i.test(tab.url || "")
    ) {
      throw new Error("Choose an active HTTPS application tab");
    }

    const target = { tabId };
    let attached = false;

    try {
      await chrome.debugger.attach(target, "1.3");
      attached = true;

      await chrome.debugger.sendCommand(
        target,
        "Input.dispatchMouseEvent",
        { type: "mouseMoved", x, y }
      );

      await chrome.debugger.sendCommand(
        target,
        "Input.dispatchMouseEvent",
        {
          type: "mousePressed",
          x,
          y,
          button: "left",
          clickCount: 1,
        }
      );

      await chrome.debugger.sendCommand(
        target,
        "Input.dispatchMouseEvent",
        {
          type: "mouseReleased",
          x,
          y,
          button: "left",
          clickCount: 1,
        }
      );

      return { ok: true };
    } finally {
      if (attached) {
        await chrome.debugger.detach(target).catch(() => {});
      }
    }
  })()
    .then(reply)
    .catch((error) => {
      reply({ ok: false, error: error.message });
    });

  return true;
});
