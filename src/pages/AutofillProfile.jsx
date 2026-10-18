
import { useEffect, useState } from "react";
import "../styles/autofill-profile.css";
import "../styles/autofill-accordion.css";

import {
  loadAutofillProfile,
  saveAutofillProfile
} from "../lib/autofillStorage";

import {
  readResume,
  parseAutofillResume
} from "../lib/autofillParser";

import {
  ProfileField,
  ProfileDropdown,
  RepeatableSection
} from "../components/AutofillFields";

import AccordionSection from "../components/AccordionSection";
import ResumeManager from "../components/ResumeManager";
import SelfIdentification from "../components/SelfIdentification";

import ApplicationQuestions, {
  DEFAULT_APPLICATION_ANSWERS
} from "../components/ApplicationQuestions";

const emptyProfile = () => ({
  firstName: "",
  middleName: "",
  lastName: "",
  preferredName: "",
  email: "",
  phone: "",
  phoneCountry: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  postalCode: "",
  country: "",
  location: "",
  citizenship: "",
  preferredContactMethod: "",
  linkedin: "",
  github: "",
  website: "",

  education: [],
  experience: [],
  projects: [],
  skills: "",
  certifications: [],
  languages: [],

  professionalSummary: "",
  careerMotivation: "",
  keyAchievements: "",
  projectExample: "",
  technicalExperience: "",

  preferredJobTitles: "",
  preferredIndustries: "",
  hourlyRateExpectation: "",
  salaryMinimumPrivate: "",
  otherWorkCountries: "",
  workPermitExpiration: "",
  activeClearance: "",

  ...DEFAULT_APPLICATION_ANSWERS
});

const PERSONAL_FIELDS = [
  ["Legal first name", "firstName"],
  ["Middle name", "middleName"],
  ["Legal last name", "lastName"],
  ["Preferred name", "preferredName"],
  ["Email address", "email"],
  ["Phone number", "phone"],
  ["Phone country / calling code", "phoneCountry"],
  ["Street address", "addressLine1"],
  ["Apartment / unit", "addressLine2"],
  ["City", "city"],
  ["State / province", "state"],
  ["ZIP / postal code", "postalCode"],
  ["Country of residence", "country"],
  ["LinkedIn", "linkedin"],
  ["GitHub", "github"],
  ["Portfolio / website", "website"],
  ["Country of citizenship (optional)", "citizenship"]
];

const EDUCATION_FIELDS = [
  ["School or university", "school"],
  ["School location (original)", "location"],
  ["School city", "city"],
  ["School state / province", "state"],
  ["School country", "country"],
  ["Education level", "educationLevel"],
  ["Degree type (BS, BA, MS)", "degreeType"],
  ["Degree / major", "degree"],
  ["Minor / concentration", "minor"],
  ["Start date (MM/YYYY)", "startDate"],
  ["Graduation / end date (MM/YYYY)", "endDate"],
  ["Expected or completed", "graduationStatus"],
  ["Currently enrolled (Yes / No)", "currentlyEnrolled"],
  ["Original resume dates", "date"],
  ["GPA", "gpa"],
  ["GPA scale", "gpaScale"],
  ["Relevant coursework", "coursework", true]
];

const EXPERIENCE_FIELDS = [
  ["Company", "company"],
  ["Company location (original)", "location"],
  ["Job title", "jobTitle"],
  ["Employment type", "employmentType"],
  ["City", "city"],
  ["State / province", "state"],
  ["Country", "country"],
  ["Work arrangement", "workArrangement"],
  ["Start date (MM/YYYY)", "startDate"],
  ["End date (MM/YYYY)", "endDate"],
  ["Currently employed (Yes / No)", "current"],
  ["Original resume dates", "date"],
  ["Reason for leaving (optional)", "reasonForLeaving"],
  ["Responsibilities and accomplishments", "description", true]
];

const PROJECT_FIELDS = [
  ["Project name", "name"],
  ["Date", "date"],
  ["Description", "description", true]
];

const CERTIFICATION_FIELDS = [
  ["Certification / license", "name"],
  ["Issuing organization", "issuer"],
  ["Issue date", "issued"],
  ["Expiration date", "expires"],
  ["Credential URL", "url"]
];

const LANGUAGE_FIELDS = [
  ["Language", "name"],
  ["Proficiency", "proficiency"]
];

const STORY_FIELDS = [
  ["Professional summary", "professionalSummary"],
  ["Why these roles interest you", "careerMotivation"],
  ["Key achievements with real metrics", "keyAchievements"],
  ["A challenging project you solved", "projectExample"],
  ["Technical experience", "technicalExperience"]
];

const PREFERENCE_FIELDS = [
  ["Preferred job titles", "preferredJobTitles"],
  ["Preferred industries", "preferredIndustries"],
  ["Expected hourly rate (USD)", "hourlyRateExpectation"],
  ["Private minimum salary (never auto-disclose)", "salaryMinimumPrivate"],
  ["Other countries where authorized to work", "otherWorkCountries"],
  ["Work permit expiration (if applicable)", "workPermitExpiration"]
];

const EDUCATION_EMPTY =
  Object.fromEntries(EDUCATION_FIELDS.map(([, key]) => [key, ""]));

const EXPERIENCE_EMPTY =
  Object.fromEntries(EXPERIENCE_FIELDS.map(([, key]) => [key, ""]));

const PROJECT_EMPTY = {
  name: "",
  date: "",
  description: ""
};

const CERTIFICATION_EMPTY =
  Object.fromEntries(CERTIFICATION_FIELDS.map(([, key]) => [key, ""]));

const LANGUAGE_EMPTY = {
  name: "",
  proficiency: ""
};

export default function AutofillProfile({
  onboarding = false,
  onProfileSaved
}) {
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

    async function load() {
      try {
        const saved = await loadAutofillProfile();

        if (!active) return;

        if (saved?.profile_data) {
          setProfile({
            ...emptyProfile(),
            ...saved.profile_data
          });

          setLastSaved(saved.updated_at);
          setSaveMessage("Your saved profile has been loaded.");
        }
      } catch (error) {
        if (active) {
          setSaveMessage(
            `Could not load your profile: ${error.message}`
          );
        }
      } finally {
        if (active) setLoadingSaved(false);
      }
    }

    load();

    return () => {
      active = false;
    };
  }, []);

  function update(name, value) {
    setProfile(previous => ({
      ...previous,
      [name]: value
    }));
  }

  function updateItem(bucket, index, name, value) {
    setProfile(previous => ({
      ...previous,
      [bucket]: (previous[bucket] || []).map((item, i) =>
        index === i ? { ...item, [name]: value } : item
      )
    }));
  }

  function addItem(bucket, shape) {
    setProfile(previous => ({
      ...previous,
      [bucket]: [...(previous[bucket] || []), { ...shape }]
    }));
  }

  function removeItem(bucket, index) {
    setProfile(previous => ({
      ...previous,
      [bucket]: (previous[bucket] || [])
        .filter((_, i) => i !== index)
    }));
  }

  async function handleSaveProfile() {
    if (loadingSaved || saving) return;

    // Require only basics for first-time setup.
    // Other details can always be completed later.
    if (onboarding && (
      !profile.firstName?.trim() ||
      !profile.lastName?.trim() ||
      !profile.email?.trim()
    )) {
      setSaveMessage(
        "To finish setup, enter your first name, last name, and email."
      );
      return;
    }

    setSaving(true);
    setSaveMessage("");

    try {
      const result = await saveAutofillProfile(profile);

      setLastSaved(result.updated_at);
      setSaveMessage("Profile saved successfully!");

      // Notify App.jsx so first-time users can
      // enter the dashboard immediately.
      if (typeof onProfileSaved === "function") {
        onProfileSaved();
      }
    } catch (error) {
      setSaveMessage(
        `Unable to save profile: ${error.message}`
      );
    } finally {
      setSaving(false);
    }
  }

  function handleResumeProfileCleared(result) {
    if (!result?.profile_data) return;

    setProfile({
      ...emptyProfile(),
      ...result.profile_data
    });

    setFileName("");
    setParsed(false);
    setLastSaved(result.updated_at);

    setStatus(
      "Resume information cleared. Changes saved."
    );
  }

  async function handleFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setStatus("Reading your resume...");

    try {
      const text = await readResume(file);

      if (!text.trim()) {
        throw new Error("No readable resume text found.");
      }

      const extracted = await parseAutofillResume(text);

      // Keep other saved profile values.
      // Only replace extracted resume fields.
      setProfile(previous => ({
        ...previous,
        ...Object.fromEntries(
          Object.entries(extracted).filter(([key, value]) => {
            if (["education", "experience", "projects"]
              .includes(key)) {
              return Array.isArray(value) && value.length > 0;
            }

            return value !== null &&
              value !== undefined &&
              value !== "";
          })
        ),

        website: previous.website,
        linkedin: extracted.linkedin || previous.linkedin,
        github: extracted.github || previous.github
      }));

      setFileName(file.name);
      setParsed(true);
      setStatus(
        "Resume imported. Review the fields and save."
      );
    } catch (error) {
      setStatus(error.message || "Resume import failed.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  const basicFields = [
    "firstName", "lastName", "email", "phone",
    "city", "state", "country", "postalCode",
    "linkedin", "github", "website", "skills"
  ];

  const completedBasics = basicFields.filter(
    key => String(profile[key] || "").trim()
  ).length;

  const progress = Math.round(
    completedBasics / basicFields.length * 100
  );

  function renderFields(fields, multiline = false) {
    return (
      <div className="af-grid">
        {fields.map(([label, name, isMultiline]) => (
          <ProfileField
            key={name}
            label={label}
            name={name}
            value={profile[name] ?? ""}
            onChange={update}
            multiline={multiline || Boolean(isMultiline)}
            needsReview={
              parsed &&
              ["firstName", "lastName", "email", "phone"]
                .includes(name)
            }
          />
        ))}
      </div>
    );
  }

  function renderRepeatable(
    title,
    bucket,
    fields,
    shape
  ) {
    return (
      <RepeatableSection
        title={title}
        entries={profile[bucket] || []}
        fields={fields}
        needsReview={parsed}
        onAdd={() => addItem(bucket, shape)}
        onUpdate={(index, key, value) =>
          updateItem(bucket, index, key, value)
        }
        onRemove={index => removeItem(bucket, index)}
      />
    );
  }

  return (
    <div className="page af-page">
      <header className="page-header">
        <h1>
          {onboarding
            ? "Set Up Your Autofill Profile"
            : "Autofill Profile"}
        </h1>
        <p>
          Complete your profile once so Offerly can
          help fill job applications faster.
        </p>
      </header>

      {onboarding && (
        <div className="af-onboarding-banner">
          <h2>Welcome to Offerly!</h2>
          <p>
            Start by importing your resume or entering
            your information. Open each section to edit it.
            Only your name and email are required to finish
            setup. You can return to fill in more later.
          </p>
        </div>
      )}

      <section className="af-card">
        <div className="af-section-head">
          <h2>Profile completeness</h2>
          <strong>{progress}%</strong>
        </div>

        <div
          className="af-profile-progress"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Basic profile completeness"
        >
          <div style={{ width: `${progress}%` }} />
        </div>

        <p className="af-muted">
          Based on 12 commonly used profile fields.
          Optional fields can be added anytime.
        </p>
      </section>

      {/* Keep resume import easy to find. */}

      <section className="af-card af-upload">
        <h2>Import Your Resume</h2>

        <p className="af-muted">
          Upload a PDF, DOCX, or TXT file, up to 5 MB.
          Review the extracted information before saving.
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

      <ResumeManager
        onProfileCleared={handleResumeProfileCleared}
      />

      <AccordionSection
        title="Personal Information"
        description="Name, contact details, complete address, links"
        icon="👤"
        defaultOpen
      >
        <p className="af-muted">
          Information used for contact fields and
          addresses on job applications.
        </p>

        {renderFields(PERSONAL_FIELDS)}

        <div className="af-grid" style={{ marginTop: 16 }}>
          <ProfileDropdown
            label="Preferred contact method"
            name="preferredContactMethod"
            value={profile.preferredContactMethod}
            options={["Email", "Phone", "Either"]}
            onChange={update}
          />
        </div>

        <div style={{ marginTop: 16 }}>
          <ProfileField
            label="Previous combined city / state (legacy)"
            name="location"
            value={profile.location}
            onChange={update}
          />
        </div>
      </AccordionSection>

      <AccordionSection
        title="Education"
        description="Schools, degree, graduation dates, GPA"
        icon="🎓"
      >
        {renderRepeatable(
          "Education",
          "education",
          EDUCATION_FIELDS,
          EDUCATION_EMPTY
        )}
      </AccordionSection>

      <AccordionSection
        title="Work Experience"
        description="Jobs, companies, locations, accomplishments"
        icon="💼"
      >
        {renderRepeatable(
          "Work Experience",
          "experience",
          EXPERIENCE_FIELDS,
          EXPERIENCE_EMPTY
        )}
      </AccordionSection>

      <AccordionSection
        title="Skills"
        description="Programming languages, software, technical skills"
        icon="🛠️"
      >
        {renderFields([["Skills", "skills", true]])}
      </AccordionSection>

      <AccordionSection
        title="Projects"
        description="Portfolio projects and work examples"
        icon="📁"
      >
        {renderRepeatable(
          "Projects",
          "projects",
          PROJECT_FIELDS,
          PROJECT_EMPTY
        )}
      </AccordionSection>

      <AccordionSection
        title="Certifications and Licenses"
        description="Credentials, organizations, expiration dates"
        icon="🏅"
      >
        {renderRepeatable(
          "Certifications and Licenses",
          "certifications",
          CERTIFICATION_FIELDS,
          CERTIFICATION_EMPTY
        )}
      </AccordionSection>

      <AccordionSection
        title="Languages"
        description="Languages and proficiency levels"
        icon="🌐"
      >
        {renderRepeatable(
          "Languages",
          "languages",
          LANGUAGE_FIELDS,
          LANGUAGE_EMPTY
        )}
      </AccordionSection>

      <AccordionSection
        title="Professional Background"
        description="Real accomplishments and stories for AI-generated drafts"
        icon="📝"
      >
        <p className="af-muted">
          These details help AI prepare answers to
          open-ended questions. Review each draft
          before sending it to an employer.
        </p>

        {renderFields(STORY_FIELDS, true)}
      </AccordionSection>

      <AccordionSection
        title="Additional Job Preferences"
        description="Roles, industries, pay, work authorization details"
        icon="⚙️"
      >
        {renderFields(PREFERENCE_FIELDS)}

        <div className="af-grid" style={{ marginTop: 16 }}>
          <ProfileDropdown
            label="Is your clearance currently active?"
            name="activeClearance"
            value={profile.activeClearance}
            options={["Yes", "No", "Not applicable"]}
            onChange={update}
          />
        </div>

        <p className="af-muted">
          Your private minimum salary should not be
          automatically disclosed to employers.
        </p>
      </AccordionSection>

      <AccordionSection
        title="Application Questions"
        description="Work eligibility, age 18+, sponsorship, relocation and more"
        icon="📋"
      >
        <ApplicationQuestions
          profile={profile}
          update={update}
        />
      </AccordionSection>

      <AccordionSection
        title="Voluntary Self-Identification"
        description="Optional demographics, veteran and disability preferences"
        icon="🔒"
      >
        <p className="af-muted">
          This information is optional and saved
          separately. You can leave it unanswered.
        </p>

        <SelfIdentification />
      </AccordionSection>

      {/* Save stays visible at the bottom. */}

      <section className="af-card">
        <h2>
          {onboarding
            ? "Finish Setting Up Offerly"
            : "Save Autofill Profile"}
        </h2>

        <p className="af-muted">
          Your information will be saved securely to
          your Offerly account. You can edit it anytime.
        </p>

        {lastSaved && (
          <p className="af-muted">
            Last saved:{" "}
            {new Date(lastSaved).toLocaleString()}
          </p>
        )}

        {saveMessage && (
          <p className="af-status" role="status">
            {saveMessage}
          </p>
        )}

        <div className="af-save-actions">
          <button
            type="button"
            className="af-secondary"
            onClick={handleSaveProfile}
            disabled={saving || loadingSaved || busy}
          >
            {loadingSaved
              ? "Loading..."
              : saving
                ? "Saving..."
                : onboarding
                  ? "Save and Continue to Dashboard"
                  : "Save Profile"}
          </button>

          <span className="af-save-hint">
            You can edit your profile later.
          </span>
        </div>
      </section>
    </div>
  );
}
