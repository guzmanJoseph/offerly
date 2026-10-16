
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";

const EMPTY = {
  hispanicLatino: "",
  gender: "",
  raceEthnicity: [],
  veteranStatus: "",
  disabilityStatus: "",
};

const RACE_OPTIONS = [
  "American Indian or Alaska Native",
  "Asian",
  "Black or African American",
  "Middle Eastern or North African",
  "Native Hawaiian or Other Pacific Islander",
  "White",
  "Another identity",
  "Prefer not to disclose",
];

function Question({ title, children }) {
  return (
    <div className="self-id-question">
      <label>{title}</label>
      {children}
    </div>
  );
}

function AnswerSelect({
  value,
  onChange,
  options,
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Leave unanswered</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}

export default function SelfIdentification() {
  const [answers, setAnswers] = useState(EMPTY);
  const [allowSuggestions, setAllowSuggestions] =
    useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function update(key, value) {
    setAnswers((previous) => ({
      ...previous,
      [key]: value,
    }));
  }

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const { data: auth, error: authError } =
          await supabase.auth.getUser();

        if (authError) throw authError;
        if (!auth.user) {
          throw new Error("Please sign in.");
        }

        const { data, error } = await supabase
          .from("autofill_self_identification")
          .select("answers, allow_suggestions")
          .eq("user_id", auth.user.id)
          .maybeSingle();

        if (error) throw error;
        if (!active) return;

        if (data) {
          setAnswers({
            ...EMPTY,
            ...data.answers,
            raceEthnicity: Array.isArray(
              data.answers?.raceEthnicity
            )
              ? data.answers.raceEthnicity
              : [],
          });

          setAllowSuggestions(
            Boolean(data.allow_suggestions)
          );
        }
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

  async function getUser() {
    const { data, error } =
      await supabase.auth.getUser();

    if (error) throw error;
    if (!data.user) {
      throw new Error("Please sign in.");
    }

    return data.user;
  }

  async function handleSave() {
    setSaving(true);
    setMessage("");

    try {
      const user = await getUser();

      const { error } = await supabase
        .from("autofill_self_identification")
        .upsert(
          {
            user_id: user.id,
            answers,
            allow_suggestions: allowSuggestions,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (error) throw error;

      setMessage("Your choices have been saved.");
    } catch (error) {
      setMessage(`Could not save: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (
      !window.confirm(
        "Permanently delete all your saved " +
        "self-identification answers?"
      )
    ) return;

    setSaving(true);
    setMessage("");

    try {
      const user = await getUser();

      const { error } = await supabase
        .from("autofill_self_identification")
        .delete()
        .eq("user_id", user.id);

      if (error) throw error;

      setAnswers({
        ...EMPTY,
        raceEthnicity: [],
      });
      setAllowSuggestions(false);
      setMessage("Saved answers deleted.");
    } catch (error) {
      setMessage(`Could not delete: ${error.message}`);
    } finally {
      setSaving(false);
    }
  }

  function toggleRace(option) {
    setAnswers((previous) => {
      const current = previous.raceEthnicity;

      if (option === "Prefer not to disclose") {
        return {
          ...previous,
          raceEthnicity: current.includes(option)
            ? []
            : [option],
        };
      }

      const withoutDecline = current.filter(
        (item) => item !== "Prefer not to disclose"
      );

      return {
        ...previous,
        raceEthnicity: withoutDecline.includes(option)
          ? withoutDecline.filter(
              (item) => item !== option
            )
          : [...withoutDecline, option],
      };
    });
  }

  return (
    <section className="af-card self-id-section">
      <div className="af-section-head">
        <div>
          <h2>Voluntary Self-Identification</h2>
          <p className="af-muted">
            All questions are optional. These answers
            are separate from your resume.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="af-muted">Loading preferences...</p>
      ) : (
        <>
          <Question title="Are you Hispanic or Latino?">
            <AnswerSelect
              value={answers.hispanicLatino}
              onChange={(value) =>
                update("hispanicLatino", value)
              }
              options={[
                "Yes",
                "No",
                "Prefer not to disclose",
              ]}
            />
          </Question>

          <Question title="Gender">
            <AnswerSelect
              value={answers.gender}
              onChange={(value) =>
                update("gender", value)
              }
              options={[
                "Female",
                "Male",
                "Non-binary",
                "Another identity",
                "Prefer not to disclose",
              ]}
            />
          </Question>

          <Question title="Race and Ethnicity">
            <p className="af-muted">
              Select any that apply, or leave unanswered.
              Employers may use different categories.
            </p>

            <div className="self-id-checkboxes">
              {RACE_OPTIONS.map((option) => (
                <label key={option}>
                  <input
                    type="checkbox"
                    checked={answers.raceEthnicity.includes(
                      option
                    )}
                    onChange={() => toggleRace(option)}
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </Question>

          <Question title="Veteran Status">
            <AnswerSelect
              value={answers.veteranStatus}
              onChange={(value) =>
                update("veteranStatus", value)
              }
              options={[
                "I identify as a protected veteran",
                "I am not a protected veteran",
                "Prefer not to disclose",
              ]}
            />
          </Question>

          <Question title="Disability Status">
            <AnswerSelect
              value={answers.disabilityStatus}
              onChange={(value) =>
                update("disabilityStatus", value)
              }
              options={[
                "Yes",
                "No",
                "I do not want to answer",
              ]}
            />
          </Question>

          <div className="self-id-consent">
            <label>
              <input
                type="checkbox"
                checked={allowSuggestions}
                onChange={(e) =>
                  setAllowSuggestions(e.target.checked)
                }
              />

              <span>
                Allow Offerly to suggest my saved answers
                when I encounter matching questions on
                future applications.
              </span>
            </label>

            <p className="af-muted">
              Suggestions will require your confirmation.
              Offerly will not automatically select or
              submit these responses.
            </p>
          </div>

          <div className="self-id-actions">
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
            >
              {saving ? "Saving..." : "Save Choices"}
            </button>

            <button
              type="button"
              className="self-id-delete"
              disabled={saving}
              onClick={handleDelete}
            >
              Delete Saved Answers
            </button>
          </div>

          {message && (
            <p className="af-status" role="status">
              {message}
            </p>
          )}
        </>
      )}
    </section>
  );
}
