import { useEffect, useState } from "react";
import "../styles/autofill-profile.css";
import {
  loadAutofillProfile,
  saveAutofillProfile
} from "../lib/autofillStorage";
import ResumeManager from "../components/ResumeManager";
import SelfIdentification from "../components/SelfIdentification";
import {
  readResume,
  parseAutofillResume
} from "../lib/autofillParser";

import {
  ProfileField,
  RepeatableSection
} from "../components/AutofillFields";

import ApplicationQuestions, {
  DEFAULT_APPLICATION_ANSWERS
} from "../components/ApplicationQuestions";

const emptyProfile = () => ({
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  location: "",
  linkedin: "",
  github: "",
  website: "",

  education: [],
  experience: [],
  skills: "",
  projects: [],

  ...DEFAULT_APPLICATION_ANSWERS
});

const EDUCATION_FIELDS = [
  ["School", "school"],
  ["Degree / major", "degree"],
  ["Dates / graduation", "date"],
  ["GPA (optional)", "gpa"]
];

const EXPERIENCE_FIELDS = [
  ["Company", "company"],
  ["Job title", "jobTitle"],
  ["Dates", "date"],
  ["Description", "description", true]
];

const PROJECT_FIELDS = [
  ["Project name", "name"],
  ["Date", "date"],
  ["Description", "description", true]
];

export default function AutofillProfile() {
  const [profile, setProfile] = useState(emptyProfile);
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [parsed, setParsed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingSaved, setLoadingSaved] = useState(true);
  const [saveMessage, setSaveMessage] = useState("");
  const [lastSaved, setLastSaved] = useState(null);


useEffect(() => {
  let active = true;

  async function loadSavedProfile() {
    try {
      setLoadingSaved(true);

      const saved = await loadAutofillProfile();

      if (!active) return;

      if (saved?.profile_data) {
        setProfile({
          ...emptyProfile(),
          ...saved.profile_data,
        });

        setLastSaved(saved.updated_at);
        setSaveMessage("Your saved profile has been loaded.");
      }
    } catch (error) {
      console.error("Could not load autofill profile:", error);

      if (active) {
        setSaveMessage(
          "Could not load your saved profile: " + error.message
        );
      }
    } finally {
      if (active) {
        setLoadingSaved(false);
      }
    }
  }

  loadSavedProfile();

  return () => {
    active = false;
  };
}, []);

  async function handleSaveProfile() {
    if (loadingSaved) return;

    setSaving(true);
    setSaveMessage("");

    try {
      const result = await saveAutofillProfile(profile);

      setLastSaved(result.updated_at);
      setSaveMessage("Your autofill profile was saved successfully!");
    } catch (error) {
      console.error("Could not save autofill profile:", error);

      setSaveMessage(
        "Unable to save profile: " + error.message
      );
    } finally {
      setSaving(false);
    }
  }


  // Update a normal profile field.
  function update(name, value) {
    setProfile(previous => ({
      ...previous,
      [name]: value
    }));
  }

  // Update one item in a repeatable section.
  function updateItem(bucket, index, name, value) {
    setProfile(previous => ({
      ...previous,
      [bucket]: previous[bucket].map((item, i) =>
        i === index
          ? { ...item, [name]: value }
          : item
      )
    }));
  }

  // Add another education, job, or project.
  function addItem(bucket, shape) {
    setProfile(previous => ({
      ...previous,
      [bucket]: [
        ...previous[bucket],
        { ...shape }
      ]
    }));
  }

  // Remove one education, job, or project.
  function removeItem(bucket, index) {
    setProfile(previous => ({
      ...previous,
      [bucket]: previous[bucket].filter(
        (_, i) => i !== index
      )
    }));
  }


function handleResumeProfileCleared(result) {
  if (!result?.profile_data) return;

  setProfile({
    ...emptyProfile(),
    ...result.profile_data,
  });

  setFileName("");
  setParsed(false);

  if (typeof setLastSaved === "function") {
    setLastSaved(result.updated_at);
  }

  setStatus(
    "Resume information cleared. " +
    "Your application answers were preserved. " +
    "Changes saved to Supabase."
  );
}


  // Handle the uploaded resume.
  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setStatus("Reading your resume...");

    try {
      const text = await readResume(file);

      if (!text.trim()) {
        throw new Error(
          "No readable resume text found. Try another file."
        );
      }

      const extracted = await parseAutofillResume(text);

      // Keep manually entered preferences.
      // Replace only the information derived from the resume.
      setProfile(previous => ({
        ...previous,
        ...extracted,

        website: previous.website,

        linkedin:
          extracted.linkedin || previous.linkedin,

        github:
          extracted.github || previous.github
      }));

      setFileName(file.name);
      setParsed(true);

      setStatus(
        `Resume extracted. Found ${extracted.experience.length} ` +
        `work experience entries and ${extracted.projects.length} ` +
        `projects. Review and correct your information. ` +
        `Nothing has been saved yet.`
      );
    } catch (error) {
      console.error("Resume parsing error:", error);
      setStatus(
        error.message || "Could not process this resume."
      );
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  return (
    <div className="page af-page">
      {/* Page heading */}

      <header className="page-header">
        <h1>Autofill Profile</h1>
        <p>
          Import your resume, review your information,
          and prepare for one-click application autofill.
        </p>
      </header>

      {/* Resume upload */}

      <section className="af-card af-upload">
        <h2>Import your resume</h2>

        <p className="af-muted">
          Upload a PDF, DOCX, or TXT file (up to 5 MB).
          Your resume will be parsed locally in the browser.
        </p>

        <label className="af-upload-label">
          {busy ? "Processing..." : "Choose resume"}

          <input
            type="file"
            accept=".pdf,.docx,.txt"
            disabled={busy}
            onChange={handleFile}
          />
        </label>

        {fileName && (
          <p className="af-muted">
            Selected: {fileName}
          </p>
        )}

        {status && (
          <p className="af-status" role="status">
            {status}
          </p>
        )}
      </section>


        {/* Saved resume documents */}

<ResumeManager
  onProfileCleared={handleResumeProfileCleared}
/>
      {/* Personal information */}

      <section className="af-card">
        <h2>Personal Information</h2>

        <div className="af-grid">
          {[
            ["First name", "firstName"],
            ["Last name", "lastName"],
            ["Email", "email"],
            ["Phone", "phone"],
            ["City / state", "location"],
            ["LinkedIn", "linkedin"],
            ["GitHub", "github"],
            ["Portfolio / website", "website"]
          ].map(([label, name]) => (
            <ProfileField
              key={name}
              label={label}
              name={name}
              value={profile[name]}
              onChange={update}
              needsReview={
                parsed &&
                ["firstName", "lastName", "email", "phone", "location"]
                  .includes(name)
              }
            />
          ))}
        </div>
      </section>

      {/* Education */}

      <RepeatableSection
        title="Education"
        entries={profile.education}
        fields={EDUCATION_FIELDS}
        needsReview={parsed}
        onAdd={() =>
          addItem("education", {
            school: "",
            degree: "",
            date: "",
            gpa: ""
          })
        }
        onUpdate={(index, name, value) =>
          updateItem("education", index, name, value)
        }
        onRemove={index =>
          removeItem("education", index)
        }
      />

      {/* Experience */}

      <RepeatableSection
        title="Work Experience"
        entries={profile.experience}
        fields={EXPERIENCE_FIELDS}
        needsReview={parsed}
        onAdd={() =>
          addItem("experience", {
            company: "",
            jobTitle: "",
            date: "",
            description: ""
          })
        }
        onUpdate={(index, name, value) =>
          updateItem("experience", index, name, value)
        }
        onRemove={index =>
          removeItem("experience", index)
        }
      />

      {/* Skills */}

      <section className="af-card">
        <h2>Skills</h2>

        <ProfileField
          label="Skills"
          name="skills"
          value={profile.skills}
          onChange={update}
          multiline
        />
      </section>

      {/* Projects */}

      <RepeatableSection
        title="Projects"
        entries={profile.projects}
        fields={PROJECT_FIELDS}
        needsReview={parsed}
        onAdd={() =>
          addItem("projects", {
            name: "",
            date: "",
            description: ""
          })
        }
        onUpdate={(index, name, value) =>
          updateItem("projects", index, name, value)
        }
        onRemove={index =>
          removeItem("projects", index)
        }
      />

      {/* Application questions and dropdowns */}

      <ApplicationQuestions
        profile={profile}
        update={update}
        
      />
      <SelfIdentification />

      {/* Storage status */}

      
{/* Save autofill profile */}

<section className="af-card">
  <div className="af-section-head">
    <div>
      <h2>Save Autofill Profile</h2>

      <p className="af-muted">
        Review your personal information, education,
        experience, projects, and application answers
        before saving.
      </p>
    </div>
  </div>

  {lastSaved && (
    <p className="af-muted">
      Last saved: {new Date(lastSaved).toLocaleString()}
    </p>
  )}

  {saveMessage && (
    <p className="af-status" role="status">
      {saveMessage}
    </p>
  )}

  <button
    type="button"
    className="af-secondary"
    onClick={handleSaveProfile}
    disabled={saving || loadingSaved || busy}
  >
    {loadingSaved
      ? "Loading saved profile..."
      : saving
        ? "Saving..."
        : "Save Profile"}
  </button>

  <p className="af-muted" style={{ marginTop: 16 }}>
    Your profile fields will be saved to your
    Offerly account. Your original resume file
    is not yet stored.
  </p>
</section>

    </div>
  );
}
