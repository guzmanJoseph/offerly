import { clearResumeProfileData } from "../lib/autofillStorage";
import { useEffect, useState } from "react";

import {
  uploadResume,
  listResumes,
  downloadResume,
  deleteResume,
  getResumeBlob,
  getDefaultResume,
  setDefaultResume,
} from "../lib/resumeStorage";

export default function ResumeManager({ onProfileCleared }) {
  const [resumes, setResumes] = useState([]);
  const [defaultName, setDefaultName] = useState(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [activeFile, setActiveFile] = useState("");
  const [message, setMessage] = useState("");

  const [preview, setPreview] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  
async function refreshResumes() {
  const [files, selected] = await Promise.all([
    listResumes(),
    getDefaultResume(),
  ]);

  setResumes(files);

  const exists = files.some(
    file => file.name === selected
  );

  if (selected && !exists) {
    // Clean up stale default preferences.
    await setDefaultResume(null);
    setDefaultName(null);
  } else {
    setDefaultName(exists ? selected : null);
  }
}


  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [files, selected] = await Promise.all([
          listResumes(),
          getDefaultResume(),
        ]);

        if (!active) return;

        setResumes(files);
        setDefaultName(
          files.some((file) => file.name === selected)
            ? selected
            : null
        );
      } catch (error) {
        if (active) setMessage(error.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  // Release temporary file URLs when preview changes.
  useEffect(() => {
    return () => {
      if (preview?.url) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [preview]);

  async function handleUpload(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage("");

    try {
      const existingFiles = resumes.length;

      const result = await uploadResume(file);

      // First uploaded resume becomes the default.
      if (existingFiles === 0) {
        const storedName = result?.path?.split("/").pop();

        if (storedName) {
          await setDefaultResume(storedName);
        }
      }

      await refreshResumes();
      setMessage("Resume uploaded successfully!");
    } catch (error) {
      setMessage(`Upload failed: ${error.message}`);
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function handleDefault(file) {
    setActiveFile(file.name);
    setMessage("");

    try {
      await setDefaultResume(file.name);
      setDefaultName(file.name);
      setMessage(`${file.displayName} is now your default resume.`);
    } catch (error) {
      setMessage(`Could not set default: ${error.message}`);
    } finally {
      setActiveFile("");
    }
  }

  async function handleDownload(file) {
    setActiveFile(file.name);
    setMessage("");

    try {
      await downloadResume(file.name);
    } catch (error) {
      setMessage(`Download failed: ${error.message}`);
    } finally {
      setActiveFile("");
    }
  }

  
async function handleDelete(file) {
  const wasDefault = defaultName === file.name;

  const confirmed = window.confirm(
    `Permanently delete "${file.displayName}"?\n\n` +
    "This removes the saved resume file from Offerly."
  );

  if (!confirmed) return;

  // Confirm data clearing separately.
  // Cancel means keep the saved autofill information.
  let clearInformation = false;

  if (wasDefault) {
    clearInformation = window.confirm(
      "This is your default resume.\n\n" +
      "Do you also want to clear the information " +
      "imported into your Autofill Profile?\n\n" +
      "OK = Delete the resume AND clear profile information.\n" +
      "Cancel = Delete the resume but KEEP profile information.\n\n" +
      "Your application questions and preferences " +
      "will be preserved."
    );
  }

  setActiveFile(file.name);
  setMessage("");

  try {
    // 1. Delete the actual stored file.
    await deleteResume(file.name);

    if (preview?.name === file.name) {
      setPreview(null);
    }

    // 2. Clear the default selection in Supabase.
    if (wasDefault) {
      await setDefaultResume(null);
      setDefaultName(null);
    }

    // 3. If requested, clear saved resume information.
    if (wasDefault && clearInformation) {
      const result = await clearResumeProfileData();

      // Update parent React state so old information
      // disappears immediately, without a page refresh.
      onProfileCleared?.(result);
    }

    // 4. Reload file list and default preference.
    await refreshResumes();

    if (wasDefault && clearInformation) {
      setMessage(
        "Default resume deleted. Resume information " +
        "cleared and saved. Application answers preserved."
      );
    } else if (wasDefault) {
      setMessage(
        "Default resume deleted and selection cleared. " +
        "Your autofill information was kept."
      );
    } else {
      setMessage("Resume deleted successfully.");
    }
  } catch (error) {
    console.error("Resume deletion error:", error);

    // Refresh to reflect any steps that already succeeded,
    // even if a later database operation failed.
    try {
      await refreshResumes();
    } catch (refreshError) {
      console.error("Refresh failed:", refreshError);
    }

    setMessage(
      "One or more deletion steps failed: " +
      error.message +
      ". Check your resume list and saved profile before retrying."
    );
  } finally {
    setActiveFile("");
  }
}


  async function handleView(file) {
    setPreviewLoading(true);
    setActiveFile(file.name);
    setMessage("");

    try {
      const blob = await getResumeBlob(file.name);

      const extension = file.name
        .split(".")
        .pop()
        .toLowerCase();

      if (extension === "pdf") {
        const pdfBlob = new Blob([blob], {
          type: "application/pdf",
        });

        const url = URL.createObjectURL(pdfBlob);

        setPreview({
          name: file.name,
          displayName: file.displayName,
          type: "pdf",
          url,
        });
      } else if (extension === "docx") {
        const mammoth = await import(
          "mammoth/mammoth.browser"
        );

        const result = await mammoth.extractRawText({
          arrayBuffer: await blob.arrayBuffer(),
        });

        setPreview({
          name: file.name,
          displayName: file.displayName,
          type: "text",
          text: result.value || "No readable text found.",
        });
      } else {
        throw new Error("Unsupported preview format.");
      }
    } catch (error) {
      setMessage(`Preview failed: ${error.message}`);
    } finally {
      setPreviewLoading(false);
      setActiveFile("");
    }
  }

  function closePreview() {
    setPreview(null);
  }

  return (
    <>
      <section className="af-card">
        <div className="af-section-head">
          <div>
            <h2>My Resumes</h2>
            <p className="af-muted">
              Upload, preview, and manage your resume versions.
            </p>
          </div>
        </div>

        <label className="af-upload-label">
          {uploading ? "Uploading..." : "+ Upload Resume"}

          <input
            type="file"
            accept=".pdf,.docx"
            disabled={uploading}
            onChange={handleUpload}
          />
        </label>

        {message && (
          <p className="af-status" role="status">
            {message}
          </p>
        )}

        {loading ? (
          <p className="af-muted">Loading resumes...</p>
        ) : resumes.length === 0 ? (
          <p className="af-muted" style={{ marginTop: 16 }}>
            No saved resumes yet.
          </p>
        ) : (
          <div className="resume-manager-list">
            {resumes.map((file) => {
              const isDefault = defaultName === file.name;
              const busy = !!activeFile || uploading || previewLoading;

              return (
                <div
                  className="resume-manager-item"
                  key={file.id}
                >
                  <div className="resume-manager-info">
                    <div className="resume-manager-title">
                      <strong>{file.displayName}</strong>

                      {isDefault && (
                        <span className="resume-default-badge">
                          ★ Default
                        </span>
                      )}
                    </div>

                    <small>
                      {file.created_at
                        ? new Date(
                            file.created_at
                          ).toLocaleDateString()
                        : "Uploaded resume"}
                    </small>
                  </div>

                  <div className="resume-manager-actions">
                    <button
                      type="button"
                      className="af-secondary"
                      onClick={() => handleView(file)}
                      disabled={busy}
                    >
                      View
                    </button>

                    <button
                      type="button"
                      className="af-secondary"
                      onClick={() => handleDownload(file)}
                      disabled={busy}
                    >
                      Download
                    </button>

                    <button
                      type="button"
                      className="af-secondary"
                      onClick={() => handleDefault(file)}
                      disabled={busy || isDefault}
                    >
                      {isDefault ? "Default" : "Set Default"}
                    </button>

                    <button
                      type="button"
                      className="af-danger"
                      onClick={() => handleDelete(file)}
                      disabled={busy}
                    >
                      {activeFile === file.name
                        ? "Working..."
                        : "Delete"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="af-muted" style={{ marginTop: 16 }}>
          Your files stay private. The default resume
          will be used when we connect application autofill.
        </p>
      </section>

      {/* Resume preview modal */}

      {preview && (
        <div
          className="resume-preview-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              closePreview();
            }
          }}
        >
          <div
            className="resume-preview-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`Preview ${preview.displayName}`}
          >
            <div className="resume-preview-header">
              <div>
                <h2>Resume Preview</h2>
                <p className="af-muted">
                  {preview.displayName}
                </p>
              </div>

              <button
                type="button"
                className="af-secondary"
                onClick={closePreview}
              >
                Close
              </button>
            </div>

            <div className="resume-preview-content">
              {preview.type === "pdf" ? (
                <iframe
                  src={preview.url}
                  title={`Resume: ${preview.displayName}`}
                  className="resume-preview-frame"
                />
              ) : (
                <pre className="resume-preview-text">
                  {preview.text}
                </pre>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
