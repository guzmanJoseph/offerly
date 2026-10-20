import { useEffect, useState } from "react";
import "../styles/autofill-profile.css";

import {
  loadAutofillProfile,
  saveAutofillProfile,
} from "../lib/autofillStorage";

import {
  readResume,
  parseAutofillResume,
} from "../lib/autofillParser";

import ResumeManager from "../components/ResumeManager";

const EMPTY = {
  firstName: "",
  lastName: "",
  preferredName: "",
  email: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  linkedin: "",
  github: "",
  website: "",
  education: [],
  experience: [],
  projects: [],
  skills: "",
  professionalSummary: "",
};

const CONTACT_FIELDS = [
  ["First name", "firstName"],
  ["Last name", "lastName"],
  ["Email", "email", "email"],
  ["Phone", "phone", "tel"],
];

const ADDRESS_FIELDS = [
  ["Street address", "addressLine1"],
  ["Apartment / unit", "addressLine2"],
  ["City", "city"],
  ["State / province", "state"],
  ["ZIP / postal code", "postalCode"],
  ["Country", "country"],
];

const LINK_FIELDS = [
  ["LinkedIn", "linkedin"],
  ["GitHub", "github"],
  ["Portfolio / website", "website"],
];

const SECTIONS = [
  {
    key: "education",
    title: "Education",
    item: "school",
    fields: [
      ["School", "school"],
      ["Degree type, e.g. BS", "degreeType"],
      ["Major / field of study", "degree"],
      ["Start date · MM/YYYY", "startDate"],
      ["Graduation date · MM/YYYY", "endDate"],
    ],
  },
  {
    key: "experience",
    title: "Experience",
    item: "experience",
    fields: [
      ["Company", "company"],
      ["Job title", "jobTitle"],
      ["Start date · MM/YYYY", "startDate"],
      ["End date · MM/YYYY or Present", "endDate"],
      ["What you did and achieved", "description", "textarea"],
    ],
  },
  {
    key: "projects",
    title: "Projects",
    item: "project",
    fields: [
      ["Project name", "name"],
      ["What you built and your contribution", "description", "textarea"],
    ],
  },
];

function normalizeProfile(value) {
  const source =
    value && typeof value === "object" && !Array.isArray(value)
      ? value
      : {};

  // Preserve existing saved fields even when they
  // are no longer displayed on this page.
  const result = { ...EMPTY, ...source };

  for (const key of ["education", "experience", "projects"]) {
    result[key] = Array.isArray(source[key])
      ? source[key].filter(
          entry =>
            entry &&
            typeof entry === "object" &&
            !Array.isArray(entry)
        )
      : [];
  }

  return result;
}

export default function AutofillProfile() {
  const [profile, setProfile] = useState(() => normalizeProfile(null));
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [lastSaved, setLastSaved] = useState(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const record = await loadAutofillProfile();

        if (!active) return;

        setProfile(normalizeProfile(record?.profile_data));
        setLastSaved(record?.updated_at || null);
      } catch (err) {
        if (active) {
          setLoadError(
            err.message || "Could not load your profile."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!dirty) return;

    function warnBeforeLeaving(event) {
      event.preventDefault();
      event.returnValue = "";
    }

    window.addEventListener("beforeunload", warnBeforeLeaving);

    return () => {
      window.removeEventListener(
        "beforeunload",
        warnBeforeLeaving
      );
    };
  }, [dirty]);

  function markChanged() {
    setDirty(true);
    setMessage("");
    setError("");
  }

  function update(key, value) {
    setProfile(previous => ({
      ...previous,
      [key]: value,
    }));

    markChanged();
  }

  function updateEntry(bucket, index, key, value) {
    setProfile(previous => ({
      ...previous,
      [bucket]: previous[bucket].map((entry, i) =>
        i === index ? { ...entry, [key]: value } : entry
      ),
    }));

    markChanged();
  }

  function addEntry(section) {
    const entry = Object.fromEntries(
      section.fields.map(([, key]) => [key, ""])
    );

    setProfile(previous => ({
      ...previous,
      [section.key]: [...previous[section.key], entry],
    }));

    markChanged();
  }

  function removeEntry(bucket, index) {
    setProfile(previous => ({
      ...previous,
      [bucket]: previous[bucket].filter((_, i) => i !== index),
    }));

    markChanged();
  }

  async function importResume(event) {
    const input = event.target;
    const file = input.files?.[0];

    input.value = "";

    if (!file || importing || saving) return;

    setMessage("");
    setError("");

    if (
      !/\.(pdf|docx|txt)$/i.test(file.name) ||
      file.size === 0 ||
      file.size > 5 * 1024 * 1024
    ) {
      setError("Choose a PDF, DOCX, or TXT file up to 5 MB.");
      return;
    }

    if (
      !window.confirm(
        "Importing may replace profile fields with information from this résumé. Continue?"
      )
    ) {
      return;
    }

    setImporting(true);

    try {
      const resumeText = await readResume(file);

      if (!resumeText?.trim()) {
        throw new Error("No readable résumé text was found.");
      }

      const extracted = await parseAutofillResume(resumeText);

      if (
        !extracted ||
        typeof extracted !== "object" ||
        Array.isArray(extracted)
      ) {
        throw new Error("The résumé parser returned an invalid result.");
      }

      // Only import fields used by the simplified profile.
      const imported = {};

      for (const key of Object.keys(EMPTY)) {
        const value = extracted[key];

        if (Array.isArray(EMPTY[key])) {
          if (Array.isArray(value) && value.length) {
            imported[key] = value.filter(
              entry =>
                entry &&
                typeof entry === "object" &&
                !Array.isArray(entry)
            );
          }
        } else if (typeof value === "string" && value.trim()) {
          imported[key] = value.trim();
        }
      }

      if (!Object.keys(imported).length) {
        throw new Error(
          "No profile details were found. You can enter them below."
        );
      }

      setProfile(previous =>
        normalizeProfile({ ...previous, ...imported })
      );

      setDirty(true);
      setMessage(
        `Imported ${file.name}. Review your details below, then save.`
      );
    } catch (err) {
      setError(err.message || "Could not import your résumé.");
    } finally {
      setImporting(false);
    }
  }

  async function saveProfile() {
    if (loading || loadError || saving || importing) return;

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const result = await saveAutofillProfile(profile);

      setLastSaved(result.updated_at);
      setDirty(false);
      setMessage("Your profile is saved.");
    } catch (err) {
      setError(err.message || "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  function handleProfileCleared(record) {
    if (!record?.profile_data) return;

    // The manager saves its own changes. Preserve local
    // edits to fields that the clearing operation did not change.
    setProfile(previous => {
      const next = { ...previous };

      const clearedKeys = [
        "firstName", "lastName", "email", "phone",
        "location", "linkedin", "github", "website",
        "education", "experience", "skills", "projects",
      ];

      for (const key of clearedKeys) {
        if (key in record.profile_data) {
          next[key] = record.profile_data[key];
        }
      }

      return normalizeProfile(next);
    });

    setLastSaved(record.updated_at);
    setMessage(
      "Résumé information cleared. Save any other edits when ready."
    );
    setError("");
  }

  function renderFields(fields, values, onChange, prefix) {
    return (
      <div className="op-grid">
        {fields.map(([label, key, type]) => {
          const id = `${prefix}-${key}`;

          return (
            <div
              className={type === "textarea" ? "op-field op-wide" : "op-field"}
              key={key}
            >
              <label htmlFor={id}>{label}</label>

              {type === "textarea" ? (
                <textarea
                  id={id}
                  rows={4}
                  value={values[key] ?? ""}
                  onChange={event => onChange(key, event.target.value)}
                />
              ) : (
                <input
                  id={id}
                  type={type || "text"}
                  value={values[key] ?? ""}
                  onChange={event => onChange(key, event.target.value)}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="op-page" role="status">
        Loading your profile…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="op-page">
        <h1>Your profile</h1>
        <p role="alert">{loadError}</p>
        <button
          type="button"
          className="op-button"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  const locked = saving || importing;

  return (
    <div className="op-page">
      <header className="op-header">
        <div>
          <span className="op-eyebrow">YOUR OFFERLY PROFILE</span>
          <h1>Less setup. Less typing.</h1>
          <p>
            Import your résumé, check your details, and save.
            Everything can be updated later.
          </p>
        </div>
      </header>

      <fieldset className="op-form" disabled={locked}>
        <section className="op-card">
          <div className="op-heading">
            <span className="op-number">1</span>
            <div>
              <h2>Start with your résumé</h2>
              <p>Optional · Populate your profile without typing it all.</p>
            </div>
          </div>

          <div className="op-import">
            <div>
              <strong>Import your information</strong>
              <p>PDF, DOCX, or TXT · Up to 5 MB</p>
            </div>

            <label className="op-upload">
              Choose résumé
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                onChange={importResume}
              />
            </label>
          </div>

          <details className="op-details">
            <summary>Manage files and choose a default résumé</summary>
            <p className="op-note">
              Importing fills your profile. Use the file manager
              below to store the résumé your extension attaches.
              Attachment supports PDF and DOCX.
            </p>

            <div className="op-resume-manager">
  <ResumeManager
    onProfileCleared={handleProfileCleared}
  />
</div>
          </details>
        </section>

        <section className="op-card">
          <div className="op-heading">
            <span className="op-number">2</span>
            <div>
              <h2>Your basic information</h2>
              <p>Used for contact fields on applications.</p>
            </div>
          </div>

          {renderFields(
            CONTACT_FIELDS,
            profile,
            update,
            "contact"
          )}

          <details className="op-details">
            <summary>Address · optional</summary>
            {renderFields(
              ADDRESS_FIELDS,
              profile,
              update,
              "address"
            )}
          </details>

          <details className="op-details">
            <summary>Profile links · optional</summary>
            {renderFields(
              LINK_FIELDS,
              profile,
              update,
              "links"
            )}
          </details>
        </section>

        <section className="op-card">
          <div className="op-heading">
            <span className="op-number">3</span>
            <div>
              <h2>Background for better answers</h2>
              <p>
                Add real experience so Offerly can tailor drafts to you.
                Complete whichever sections apply.
              </p>
            </div>
          </div>

          <div className="op-field">
            <label htmlFor="profile-skills">Skills</label>
            <textarea
              id="profile-skills"
              rows={2}
              placeholder="For example: React, Excel, project management"
              value={profile.skills ?? ""}
              onChange={event => update("skills", event.target.value)}
            />
          </div>

          {SECTIONS.map(section => (
            <details
              className="op-details"
              key={section.key}
            >
              <summary>
                {section.title}
                <span className="op-count">
                  {profile[section.key].length}
                </span>
              </summary>

              {section.key === "education" &&
                profile.education.length > 1 && (
                  <p className="op-note">
                    AI drafts can use all these schools. Basic
                    autofill skips education when multiple
                    schools are saved.
                  </p>
                )}

              {profile[section.key].map((entry, index) => (
                <div className="op-entry" key={index}>
                  <div className="op-entry-head">
                    <strong>
                      {entry.school ||
                        entry.company ||
                        entry.name ||
                        `${section.title} ${index + 1}`}
                    </strong>

                    <button
                      type="button"
                      className="op-remove"
                      aria-label={`Remove ${section.item} ${index + 1}`}
                      onClick={() => removeEntry(section.key, index)}
                    >
                      Remove
                    </button>
                  </div>

                  {renderFields(
                    section.fields,
                    entry,
                    (key, value) =>
                      updateEntry(section.key, index, key, value),
                    `${section.key}-${index}`
                  )}
                </div>
              ))}

              <button
                type="button"
                className="op-add"
                onClick={() => addEntry(section)}
              >
                + Add {section.item}
              </button>
            </details>
          ))}

          <details className="op-details">
            <summary>Anything else? · optional</summary>
            <div className="op-field">
              <label htmlFor="profile-summary">
                Achievements, career interests, or useful background
              </label>
              <textarea
                id="profile-summary"
                rows={4}
                placeholder="Share details you’d like Offerly to draw on."
                value={profile.professionalSummary ?? ""}
                onChange={event =>
                  update("professionalSummary", event.target.value)
                }
              />
            </div>
          </details>
        </section>
      </fieldset>

      <footer className="op-savebar">
        <div>
          <strong>
            {importing
              ? "Reading your résumé…"
              : dirty
                ? "You have unsaved changes"
                : "Your profile"}
          </strong>
          <p>
            {lastSaved
              ? `Last saved ${new Date(lastSaved).toLocaleString()}`
              : "Save once to use this information in the extension."}
          </p>
        </div>

        <button
          type="button"
          className="op-button"
          onClick={saveProfile}
          disabled={locked}
        >
          {saving ? "Saving…" : "Save profile"}
        </button>
      </footer>

      {message && (
        <p className="op-message" role="status">{message}</p>
      )}

      {error && (
        <p className="op-error" role="alert">{error}</p>
      )}
    </div>
  );
}