import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { supabase } from "../lib/supabaseClient";
import "../styles/application-import.css";

const STATUSES = [
  "Saved",
  "Applied",
  "Assessment",
  "Interview",
  "Offer",
  "Rejected",
];

const PRIORITIES = ["Low", "Medium", "High"];

const FIELDS = [
  ["company", "Company *"],
  ["role", "Role *"],
  ["status", "Status"],
  ["date_applied", "Date applied"],
  ["location", "Location"],
  ["job_url", "Job URL"],
  ["priority", "Priority"],
  ["notes", "Notes"],
];

const ALIASES = {
  company: ["company", "company name", "employer"],
  role: ["role", "position", "job title", "title"],
  status: ["status", "application status", "stage"],
  date_applied: [
    "date applied",
    "application date",
    "applied date",
    "date",
  ],
  location: ["location", "job location", "city"],
  job_url: ["job url", "job link", "url", "link"],
  priority: ["priority"],
  notes: ["notes", "comments", "description"],
};

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function duplicateKey(row) {
  return JSON.stringify([
    normalize(row.company),
    normalize(row.role),
    normalize(row.location),
  ]);
}

function parseDate(value, format) {
  if (!value) return null;

  let year;
  let month;
  let day;
  let match;

  if ((match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) {
    [, year, month, day] = match;
  } else if (
    (match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/))
  ) {
    year = match[3];
    month = format === "MDY" ? match[1] : match[2];
    day = format === "MDY" ? match[2] : match[1];
  } else {
    throw new Error("Use YYYY-MM-DD or slash dates with a four-digit year.");
  }

  year = Number(year);
  month = Number(month);
  day = Number(day);

  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(0, 0, 0, 0);

  if (
    year < 1900 ||
    year > 2200 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new Error("Invalid date.");
  }

  return [
    year,
    String(month).padStart(2, "0"),
    String(day).padStart(2, "0"),
  ].join("-");
}

async function loadExisting(userId) {
  const records = [];

  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase
      .from("applications")
      .select("id,company,role,location")
      .eq("user_id", userId)
      .order("id")
      .range(offset, offset + 499);

    if (error) throw error;

    records.push(...(data || []));

    if (!data || data.length < 500) break;
  }

  return records;
}

export default function ImportApplications({
  applications = [],
  onClose,
  onImported,
}) {
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [statusMapping, setStatusMapping] = useState({});
  const [defaultStatus, setDefaultStatus] = useState("Applied");
  const [dateFormat, setDateFormat] = useState("MDY");
  const [filename, setFilename] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");
  const importing = useRef(false);
  const reading = useRef(false);

  async function handleFile(event) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file || reading.current) return;

    setError("");
    setSummary("");
    setRows([]);
    setHeaders([]);
    setPreviewing(false);

    if (!/\.csv$/i.test(file.name) || file.size > 2 * 1024 * 1024) {
      setError("Choose a CSV file up to 2 MB.");
      return;
    }

    reading.current = true;
    setBusy(true);

    try {
      const contents = await file.text();

      const result = Papa.parse(contents.replace(/^\uFEFF/, ""), {
        header: true,
        skipEmptyLines: "greedy",
        dynamicTyping: false,
        transformHeader: header => header.trim(),
      });

      if (result.errors.length) {
        throw new Error(
          `Could not read the CSV: ${result.errors[0].message}`
        );
      }

      const columns = result.meta.fields || [];

      if (
        !columns.length ||
        columns.some(header => !header) ||
        Object.keys(result.meta.renamedHeaders || {}).length
      ) {
        throw new Error("Use a unique, nonempty heading for every column.");
      }

      if (!result.data.length || result.data.length > 500) {
        throw new Error("Import between 1 and 500 applications at a time.");
      }

      const guessed = {};
      const used = new Set();

      for (const [key] of FIELDS) {
        const column = columns.find(
          header =>
            !used.has(header) &&
            ALIASES[key].includes(normalize(header))
        );

        guessed[key] = column || "";
        if (column) used.add(column);
      }

      setFilename(file.name);
      setHeaders(columns);
      setRows(result.data);
      setMapping(guessed);
      setStatusMapping({});
    } catch (err) {
      setError(err.message || "Could not open the file.");
    } finally {
      reading.current = false;
      setBusy(false);
    }
  }

  const sourceStatuses = useMemo(() => {
    if (!mapping.status) return [];

    return [
      ...new Set(
        rows
          .map(row => String(row[mapping.status] || "").trim())
          .filter(Boolean)
      ),
    ];
  }, [rows, mapping.status]);

  function resolvedStatus(value) {
    if (Object.prototype.hasOwnProperty.call(statusMapping, value)) {
      return statusMapping[value];
    }

    return STATUSES.find(
      status => normalize(status) === normalize(value)
    ) || "";
  }

  const preview = useMemo(() => {
    const seen = new Set(applications.map(duplicateKey));

    return rows.map((source, index) => {
      const get = key =>
        String(source[mapping[key]] ?? "").trim();

      const row = {
        company: get("company"),
        role: get("role"),
        status: get("status")
          ? resolvedStatus(get("status"))
          : defaultStatus,
        date_applied: null,
        location: get("location"),
        job_url: get("job_url"),
        priority: "Medium",
        notes: get("notes"),
      };

      const issues = [];

      if (!row.company) issues.push("Missing company");
      if (!row.role) issues.push("Missing role");
      if (!row.status) issues.push("Map this status");

      const rawPriority = get("priority");

      if (rawPriority) {
        const priority = PRIORITIES.find(
          item => normalize(item) === normalize(rawPriority)
        );

        if (priority) row.priority = priority;
        else issues.push("Priority must be Low, Medium, or High");
      }

      try {
        row.date_applied = parseDate(get("date_applied"), dateFormat);
      } catch (err) {
        issues.push(err.message);
      }

      // Saved jobs have not been applied to.
      if (row.status === "Saved") {
        row.date_applied = null;
      }

      if (row.job_url) {
        try {
          const url = new URL(row.job_url);

          if (!["https:", "http:"].includes(url.protocol)) {
            throw new Error();
          }
        } catch {
          issues.push("Job URL must start with http:// or https://");
        }
      }

      const key = duplicateKey(row);
      const duplicate = seen.has(key);

      if (!issues.length) seen.add(key);

      return {
        number: index + 1,
        row,
        issues,
        duplicate,
        ready: !issues.length && !duplicate,
      };
    });
  }, [
    rows,
    mapping,
    statusMapping,
    defaultStatus,
    dateFormat,
    applications,
  ]);

  const ready = preview.filter(item => item.ready);
  const invalidCount = preview.filter(item => item.issues.length).length;
  const duplicateCount = preview.filter(
    item => !item.issues.length && item.duplicate
  ).length;

  const mappedColumns = Object.values(mapping).filter(Boolean);
  const repeatedMapping =
    new Set(mappedColumns).size !== mappedColumns.length;

  const canPreview =
    mapping.company && mapping.role && !repeatedMapping;

  async function importRows() {
    if (importing.current || !ready.length || !canPreview) return;

    importing.current = true;
    setBusy(true);
    setError("");

    let saved = false;

    try {
      const { data, error: authError } =
        await supabase.auth.getUser();

      if (authError) throw authError;
      if (!data.user) throw new Error("Please sign in again.");

      // Recheck against the database immediately before inserting.
      const existing = await loadExisting(data.user.id);
      const seen = new Set(existing.map(duplicateKey));

      const records = [];

      for (const item of ready) {
        const key = duplicateKey(item.row);

        if (seen.has(key)) continue;

        seen.add(key);
        records.push({
          ...item.row,
          user_id: data.user.id,
        });
      }

      if (records.length) {
        const { error: insertError } = await supabase
          .from("applications")
          .insert(records);

        if (insertError) throw insertError;
      }

      saved = true;

      const skipped =
        duplicateCount + ready.length - records.length;

      setSummary(
        `${records.length} applications imported. ` +
        `${skipped} possible duplicates skipped. ` +
        `${invalidCount} invalid rows skipped.`
      );

      setRows([]);
      setHeaders([]);
      setPreviewing(false);
    } catch (err) {
      setError(
        `${err.message || "Import failed."} ` +
        "If the connection was interrupted, refresh Applications before trying again."
      );
    } finally {
      importing.current = false;
      setBusy(false);
    }

    if (saved) {
      try {
        await onImported();
      } catch {
        setError("Import finished. Refresh the page to see your applications.");
      }
    }
  }

  return (
    <div className="csv-backdrop">
      <section
        className="csv-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="csv-title"
        onKeyDown={event => {
          if (event.key === "Escape" && !busy) onClose();
        }}
      >
        <header className="csv-header">
          <div>
            <h2 id="csv-title">Bring your tracker to Offerly</h2>
            <p>Upload, match your columns, then review before importing.</p>
          </div>

          <button type="button" disabled={busy} onClick={onClose}>
            Close
          </button>
        </header>

        <fieldset disabled={busy} className="csv-fields">
          {!previewing && (
            <>
              <label htmlFor="csv-file">
                CSV file · Up to 500 applications
              </label>
              <input
                autoFocus
                id="csv-file"
                type="file"
                accept=".csv,text/csv"
                onChange={handleFile}
              />
              <p className="csv-muted">
                Export your Excel or Google Sheets tracker as CSV.
                The first row must contain column headings.
              </p>
            </>
          )}

          {rows.length > 0 && !previewing && (
            <>
              <h3>Match your columns</h3>
              <p className="csv-muted">{filename} · {rows.length} rows</p>

              <div className="csv-grid">
                {FIELDS.map(([key, label]) => (
                  <label key={key}>
                    {label}
                    <select
                      value={mapping[key] || ""}
                      onChange={event =>
                        setMapping(previous => ({
                          ...previous,
                          [key]: event.target.value,
                        }))
                      }
                    >
                      <option value="">Do not import</option>
                      {headers.map(header => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}

                <label>
                  Status when blank
                  <select
                    value={defaultStatus}
                    onChange={event => setDefaultStatus(event.target.value)}
                  >
                    {STATUSES.map(status => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>
                </label>

                <label>
                  Slash-date format
                  <select
                    value={dateFormat}
                    onChange={event => setDateFormat(event.target.value)}
                  >
                    <option value="MDY">MM/DD/YYYY</option>
                    <option value="DMY">DD/MM/YYYY</option>
                  </select>
                </label>
              </div>

              {sourceStatuses.length > 0 && (
                <>
                  <h3>Match your statuses</h3>
                  <div className="csv-grid">
                    {sourceStatuses.map(value => (
                      <label key={value}>
                        {value}
                        <select
                          value={resolvedStatus(value)}
                          onChange={event =>
                            setStatusMapping(previous => ({
                              ...previous,
                              [value]: event.target.value,
                            }))
                          }
                        >
                          <option value="">Choose a status</option>
                          {STATUSES.map(status => (
                            <option key={status}>{status}</option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                </>
              )}

              <p className="csv-muted">
                Blank dates stay blank. Blank priorities become Medium.
                Saved jobs have no application date.
              </p>

              {repeatedMapping && (
                <p role="alert">Choose each spreadsheet column only once.</p>
              )}

              <button
                className="csv-primary"
                type="button"
                disabled={!canPreview}
                onClick={() => setPreviewing(true)}
              >
                Preview import
              </button>
            </>
          )}

          {previewing && (
            <>
              <h3>Review your import</h3>
              <p>
                {ready.length} ready · {duplicateCount} possible duplicates ·{" "}
                {invalidCount} invalid
              </p>
              <p className="csv-muted">
                Possible duplicates match company, role, and location.
                They and invalid rows will be skipped.
                Repeated applications to the same role may need manual entry.
              </p>

              <div className="csv-table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Company / role</th>
                      <th>Status / date</th>
                      <th>Result</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map(item => (
                      <tr key={item.number}>
                        <td>{item.number}</td>
                        <td>
                          <strong>{item.row.company || "—"}</strong>
                          <br />
                          {item.row.role || "—"}
                          <br />
                          <small>{item.row.location}</small>
                        </td>
                        <td>
                          {item.row.status || "—"}
                          <br />
                          {item.row.date_applied || "No date"}
                        </td>
                        <td>
                          {item.issues.length
                            ? item.issues.join("; ")
                            : item.duplicate
                              ? "Skip: possible duplicate"
                              : "Ready"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="csv-actions">
                <button type="button" onClick={() => setPreviewing(false)}>
                  Back
                </button>

                <button
                  type="button"
                  className="csv-primary"
                  disabled={!ready.length}
                  onClick={importRows}
                >
                  Import {ready.length} applications
                </button>
              </div>
            </>
          )}
        </fieldset>

        {busy && <p role="status">Processing…</p>}
        {summary && <p className="csv-success" role="status">{summary}</p>}
        {error && <p className="csv-error" role="alert">{error}</p>}
      </section>
    </div>
  );
}