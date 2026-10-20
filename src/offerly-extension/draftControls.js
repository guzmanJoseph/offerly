(() => {
  const BASE =
    "https://cezdzqaayzlalspukapl.supabase.co";

  const KEY =
    "sb_publishable_IT1rTAKqu7oUP9oILUIyaQ_fm_DOAir";

  let attaching = false;

  function status(message) {
    const element = document.getElementById("status");
    if (element) element.textContent = message;
  }

  window.offerlyAttachDefaultResume = async function (tabId) {
    if (attaching) return "Résumé attachment already running.";

    attaching = true;

    try {
      const session = await getValidSession();

      if (!session?.user?.id || !session.access_token) {
        throw new Error("Please log in to Offerly.");
      }

      const headers = {
        apikey: KEY,
        Authorization: `Bearer ${session.access_token}`,
      };

      const query = new URLSearchParams({
        select: "default_resume_name",
        user_id: `eq.${session.user.id}`,
        limit: "1",
      });

      const preferenceResponse = await fetch(
        `${BASE}/rest/v1/resume_preferences?${query}`,
        { headers }
      );

      if (!preferenceResponse.ok) {
        throw new Error("Could not load your default résumé.");
      }

      const rows = await preferenceResponse.json();
      const stored = rows[0]?.default_resume_name;

      if (!stored) {
        return "Choose a default résumé on Offerly to attach it automatically.";
      }

      if (
        typeof stored !== "string" ||
        /[\\/]/.test(stored) ||
        stored === "." ||
        stored === ".."
      ) {
        throw new Error("Invalid résumé filename.");
      }

      // Skip downloading if a file is already selected.
      const checks = await chrome.scripting.executeScript({
        target: { tabId },
        func: () =>
          Array.from(
            document.querySelectorAll('input[type="file"]')
          ).some(input => input.files?.length),
      });

      if (checks?.[0]?.result) {
        return "Existing file selection kept.";
      }

      status("Basic information filled. Attaching your résumé…");

      const path = [session.user.id, stored]
        .map(encodeURIComponent)
        .join("/");

      const response = await fetch(
        `${BASE}/storage/v1/object/authenticated/resumes/${path}`,
        { headers }
      );

      if (!response.ok) {
        throw new Error("Could not download your résumé.");
      }

      const blob = await response.blob();

      if (!blob.size || blob.size > 5 * 1024 * 1024) {
        throw new Error("Your résumé must be between 1 byte and 5 MB.");
      }

      const filename = stored.includes("__")
        ? stored.split("__").slice(1).join("__")
        : stored;

      if (!/\.(pdf|docx)$/i.test(filename)) {
        throw new Error("Select a PDF or DOCX résumé.");
      }

      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["formEngine.js"],
        world: "ISOLATED",
      });

      const results = await chrome.scripting.executeScript({
        target: { tabId },
        world: "ISOLATED",

        func: async (bytes, name, mime) => {
          // Check again in case the user selected a file
          // while the résumé was downloading.
          const existingFile = Array.from(
            document.querySelectorAll('input[type="file"]')
          ).some(input => input.files?.length);

          if (existingFile) {
            return {
              ok: false,
              reason: "Existing file selection kept.",
            };
          }

          if (!globalThis.offerlyEngine?.attachResume) {
            return {
              ok: false,
              reason: "Résumé attachment helper could not load.",
            };
          }

          return globalThis.offerlyEngine.attachResume(
            bytes,
            name,
            mime
          );
        },

        args: [
          Array.from(new Uint8Array(await blob.arrayBuffer())),
          filename,
          /\.pdf$/i.test(filename)
            ? "application/pdf"
            : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ],
      });

      const result = results?.[0]?.result;

      return result?.ok
        ? `${filename} selected. Verify the website accepted it.`
        : result?.reason || "Upload your résumé manually on this page.";
    } catch (error) {
      return `Résumé: ${error.message || "Could not attach the file."}`;
    } finally {
      attaching = false;
    }
  };
})();