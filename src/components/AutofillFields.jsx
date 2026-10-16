
export function ProfileField({
  label,
  name,
  value,
  onChange,
  multiline = false,
  needsReview = false
}) {
  return (
    <label className="af-field">
      <span>
        {label}
        {needsReview && !String(value ?? "").trim() && (
          <small style={{ color: "#fbbf24", marginLeft: 8 }}>
            Needs review
          </small>
        )}
      </span>

      {multiline ? (
        <textarea
          rows={3}
          value={value ?? ""}
          onChange={e => onChange(name, e.target.value)}
        />
      ) : (
        <input
          value={value ?? ""}
          onChange={e => onChange(name, e.target.value)}
        />
      )}
    </label>
  );
}

export function ProfileDropdown({
  label,
  name,
  value,
  options,
  onChange
}) {
  return (
    <label className="af-field">
      <span>{label}</span>
      <select
        value={value ?? ""}
        onChange={e => onChange(name, e.target.value)}
      >
        <option value="">Select an answer</option>

        {options.map(option => {
          const item = typeof option === "string"
            ? { value: option, label: option }
            : option;

          return (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          );
        })}
      </select>
    </label>
  );
}

export function RepeatableSection({
  title,
  entries,
  fields,
  onAdd,
  onUpdate,
  onRemove,
  needsReview
}) {
  return (
    <section className="af-card">
      <div className="af-section-head">
        <h2>{title}</h2>

        <button
          type="button"
          className="af-secondary"
          onClick={onAdd}
        >
          + Add {title.toLowerCase()}
        </button>
      </div>

      {entries.length === 0 && (
        <p className="af-muted">
          No entries yet. Add one or upload your resume.
        </p>
      )}

      {entries.map((entry, index) => (
        <div className="af-entry" key={index}>
          <div className="af-grid">
            {fields.map(([label, name, multiline]) => (
              <ProfileField
                key={name}
                label={label}
                name={name}
                value={entry[name]}
                multiline={!!multiline}
                needsReview={needsReview && name !== "gpa"}
                onChange={(fieldName, value) =>
                  onUpdate(index, fieldName, value)
                }
              />
            ))}
          </div>

          <button
            type="button"
            className="af-danger"
            onClick={() => onRemove(index)}
          >
            Remove
          </button>
        </div>
      ))}
    </section>
  );
}
