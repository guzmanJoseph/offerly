import { useEffect, useRef, useState } from "react";
import "../styles/dashboard.css";

import { supabase } from "../lib/supabaseClient";
import ApplicationModal from "../applications/ApplicationModal";
import ImportApplications from "../applications/ImportApplications";

const STAGES = [
  { name: "Applied", icon: "↗", color: "#5295ff" },
  { name: "Assessment", icon: "≡", color: "#a18aff" },
  { name: "Interview", icon: "◎", color: "#39d6ce" },
  { name: "Offer", icon: "★", color: "#68dfaa" },
  { name: "Rejected", icon: "×", color: "#ff9297" },
];

const POSITIONS = {
  Saved: [25, 150],
  Applied: [250, 150],
  Assessment: [490, 45],
  Interview: [490, 210],
  Offer: [800, 45],
  Rejected: [800, 260],
};

const EDGES = [
  {
    from: "Applied",
    to: "Assessment",
    path: "M430 174 C460 174 450 79 485 79",
    label: [450, 111],
    color: "blue",
  },
  {
    from: "Applied",
    to: "Interview",
    path: "M430 194 C465 194 453 244 485 244",
    label: [452, 228],
    color: "blue",
  },
  {
    from: "Assessment",
    to: "Interview",
    path: "M580 113 V205",
    label: [580, 161],
    color: "purple",
  },
  {
    from: "Interview",
    to: "Offer",
    path: "M670 234 C735 234 726 79 795 79",
    label: [739, 144],
    color: "green",
  },
  {
    from: "Applied",
    to: "Rejected",
    path: "M430 205 C455 345 700 350 795 312",
    label: [598, 326],
    color: "red",
  },
  {
    from: "Assessment",
    to: "Rejected",
    path: "M670 79 C725 79 705 280 795 280",
    label: [710, 166],
    color: "red",
  },
  {
    from: "Interview",
    to: "Rejected",
    path: "M670 256 C724 256 738 294 795 294",
    label: [724, 277],
    color: "red",
  },
];

function edgeKey(from, to) {
  return `${from}→${to}`;
}

function localToday() {
  const date = new Date();

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}

function formatDate(value) {
  if (!value) return "No application date";

  const date = /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "No application date";
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function Dashboard() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [journey, setJourney] = useState(null);
  const [journeyError, setJourneyError] = useState("");
  const [historyRefresh, setHistoryRefresh] = useState(0);

  const [filter, setFilter] = useState("");
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState("");
  const [pendingId, setPendingId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [importOpen, setImportOpen] = useState(false);

  const mutationLock = useRef(false);
  const mounted = useRef(false);
  const requestVersion = useRef(0);

  useEffect(() => {
    mounted.current = true;
    fetchApplications();

    return () => {
      mounted.current = false;
      requestVersion.current++;
    };
  }, []);

  // Refresh recorded transition counts whenever applications
  // are loaded or changed.
  useEffect(() => {
    if (loading) return;

    let active = true;

    async function loadJourney() {
      setJourney(null);
      setJourneyError("");

      try {
        const { data, error: historyError } = await supabase.rpc(
          "get_application_journey_counts"
        );

        if (historyError) throw historyError;

        if (active) setJourney(data || []);
      } catch (err) {
        if (active) {
          setJourneyError(
            err.message || "Could not load journey history."
          );
        }
      }
    }

    loadJourney();

    return () => {
      active = false;
    };
  }, [applications, loading, historyRefresh]);

  async function currentUser() {
    const { data, error: authError } =
      await supabase.auth.getUser();

    if (authError) throw authError;
    if (!data.user) throw new Error("Please sign in again.");

    return data.user;
  }

  async function fetchApplications() {
    const version = ++requestVersion.current;

    if (mounted.current) setError("");

    try {
      const user = await currentUser();
      const records = [];

      for (let offset = 0; ; offset += 500) {
        const { data, error: queryError } = await supabase
          .from("applications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(offset, offset + 499);

        if (queryError) throw queryError;

        records.push(...(data || []));

        if (!data || data.length < 500) break;
      }

      if (mounted.current && version === requestVersion.current) {
        setApplications(records);
      }
    } catch (err) {
      if (mounted.current && version === requestVersion.current) {
        setError(err.message || "Could not load applications.");
      }
    } finally {
      if (mounted.current && version === requestVersion.current) {
        setLoading(false);
      }
    }
  }

  const counts = Object.fromEntries(
    STAGES.map(stage => [
      stage.name,
      applications.filter(app => app.status === stage.name).length,
    ])
  );

  const transitionCounts = Object.fromEntries(
    (journey || []).map(item => [
      edgeKey(item.from_status, item.to_status),
      Number(item.application_count),
    ])
  );

  const knownEdges = new Set(
    EDGES.map(edge => edgeKey(edge.from, edge.to))
  );

  const otherTransitions = (journey || []).filter(
    item =>
      !knownEdges.has(edgeKey(item.from_status, item.to_status)) &&
      Number(item.application_count) > 0
  );

  const unknownCount = applications.filter(
  app =>
    app.status !== "Saved" &&
    !STAGES.some(stage => stage.name === app.status)
).length;
  const visibleApplications = applications.filter(app =>
    [app.company, app.role, app.location, app.status]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(search.trim().toLowerCase())
  );

  async function changeStatus(id, newStatus) {
    if (
      mutationLock.current ||
      !STAGES.some(stage => stage.name === newStatus)
    ) {
      return;
    }

    const app = applications.find(
      item => String(item.id) === String(id)
    );

    if (!app || app.status === newStatus) return;

    mutationLock.current = true;
    setPendingId(app.id);
    setError("");
    setNotice("");

    try {
      const user = await currentUser();

      const dateApplied = newStatus === "Saved"
        ? null
        : app.status === "Saved"
          ? app.date_applied || localToday()
          : app.date_applied || null;

      let query = supabase
        .from("applications")
        .update({
          status: newStatus,
          date_applied: dateApplied,
          updated_at: new Date().toISOString(),
        })
        .eq("id", app.id)
        .eq("user_id", user.id);

      query = app.status == null
        ? query.is("status", null)
        : query.eq("status", app.status);

      const { data, error: updateError } =
        await query.select("*").maybeSingle();

      if (updateError) throw updateError;

      if (!data) {
        await fetchApplications();

        throw new Error(
          "This application changed elsewhere. The board was refreshed."
        );
      }

      setApplications(previous =>
        previous.map(item => item.id === data.id ? data : item)
      );

      setNotice(`${app.company} moved to ${newStatus}.`);
    } catch (err) {
      setError(err.message || "Could not update the application.");
    } finally {
      mutationLock.current = false;
      setPendingId(null);
    }
  }

  function openApplication(app) {
    if (mutationLock.current) return;

    setError("");
    setEditing({
      ...app,
      date_applied: app.date_applied ?? "",
    });
  }

  function addApplication(status = "Saved") {
    if (mutationLock.current) return;

    setError("");
    setEditing({
      isNew: true,
      company: "",
      role: "",
      status,
      dateApplied: status === "Saved" ? "" : localToday(),
      priority: "Medium",
    });
  }

  async function saveApplication(form) {
    if (mutationLock.current || !editing) return;

    mutationLock.current = true;
    setPendingId(editing.id || "new");
    setError("");

    try {
      const user = await currentUser();

      const payload = {
        company: form.company.trim(),
        role: form.role.trim(),
        status: form.status,
        date_applied:
          form.status === "Saved" ? null : form.dateApplied || null,
        location: form.location,
        priority: form.priority,
        notes: form.notes,
        job_url: form.job_url,
        updated_at: new Date().toISOString(),
      };

      const query = editing.isNew
        ? supabase
            .from("applications")
            .insert({ ...payload, user_id: user.id })
        : supabase
            .from("applications")
            .update(payload)
            .eq("id", editing.id)
            .eq("user_id", user.id);

      const { data, error: saveError } =
        await query.select("*").single();

      if (saveError) throw saveError;

      setApplications(previous =>
        editing.isNew
          ? [data, ...previous]
          : previous.map(item => item.id === data.id ? data : item)
      );

      setEditing(null);
      setNotice("Application saved.");
    } catch (err) {
      const message = err.message || "Could not save the application.";
      setError(message);
      window.alert(message);
    } finally {
      mutationLock.current = false;
      setPendingId(null);
    }
  }

  function dropApplication(event, stage) {
    event.preventDefault();
    setDragOver("");

    const id = event.dataTransfer.getData("application/offerly-id");

    if (id) changeStatus(id, stage);
  }

  return (
    <div className="journey-dashboard">
      <header className="jd-header">
        <div>
          <span className="jd-eyebrow">YOUR WORKSPACE</span>
          <h1>Your job search, connected.</h1>
          <p>Every application. A clearer next step.</p>
        </div>

        <div className="jd-actions">
          <button
            type="button"
            disabled={loading || pendingId !== null}
            onClick={() => setImportOpen(true)}
          >
            ↑ Import CSV
          </button>

          <button
            type="button"
            className="jd-primary"
            disabled={loading || pendingId !== null}
            onClick={() => addApplication()}
          >
            + Add application
          </button>
        </div>
      </header>

      {error && (
        <div className="jd-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={fetchApplications}>
            Refresh
          </button>
        </div>
      )}

      <p className="jd-announcement" role="status" aria-live="polite">
        {notice}
      </p>

      {loading ? (
        <div className="jd-loading" role="status">
          Loading your applications…
        </div>
      ) : (
        <>
          <section className="jd-panel">
            <div className="jd-section-header">
              <div>
                <h2>Application journey</h2>
                <p>
                  {applications.length} applications ·
                  Boxes: current status · Arrows: recorded journeys
                </p>
              </div>

              <button
                type="button"
                onClick={() => setHistoryRefresh(value => value + 1)}
              >
                Refresh counts
              </button>
            </div>

            {journeyError && (
              <p className="jd-warning" role="alert">
                History unavailable: {journeyError}
                {" "}Make sure the journey-history SQL has been run.
              </p>
            )}

            <div className="jd-flow-scroll">
              <div className="jd-flow">
                <svg
                  className="jd-connections"
                  viewBox="220 0 780 380"
                  role="img"
                  aria-label="Application transitions and recorded application counts"
                >
                  <defs>
                    {[
                      ["blue", "#5295ff"],
                      ["purple", "#a18aff"],
                      ["green", "#68dfaa"],
                      ["red", "#ff9297"],
                    ].map(([id, color]) => (
                      <marker
                        key={id}
                        id={`jd-arrow-${id}`}
                        viewBox="0 0 10 10"
                        refX="9"
                        refY="5"
                        markerWidth="7"
                        markerHeight="7"
                        orient="auto"
                      >
                        <path
                          d="M 0 0 L 10 5 L 0 10 z"
                          fill={color}
                        />
                      </marker>
                    ))}
                  </defs>

                  {EDGES.map(edge => {
                    const colors = {
                      blue: "#5295ff",
                      purple: "#a18aff",
                      green: "#68dfaa",
                      red: "#ff9297",
                    };

                    return (
                      <path
                        key={edgeKey(edge.from, edge.to)}
                        className="jd-edge"
                        d={edge.path}
                        stroke={colors[edge.color]}
                        markerEnd={`url(#jd-arrow-${edge.color})`}
                      />
                    );
                  })}

                  {EDGES.map(edge => {
                    const available = journey !== null && !journeyError;
                    const count = available
                      ? transitionCounts[edgeKey(edge.from, edge.to)] || 0
                      : null;

                    const label = count === null
                      ? journeyError ? "!" : "…"
                      : String(count);

                    const width = Math.max(30, label.length * 9 + 16);
                    const [x, y] = edge.label;

                    return (
                      <g
                        key={`label-${edgeKey(edge.from, edge.to)}`}
                        className="jd-edge-label"
                        transform={`translate(${x}, ${y})`}
                      >
                        <title>
                          {edge.from} to {edge.to}:{" "}
                          {count === null
                            ? "history unavailable or loading"
                            : `${count} distinct applications recorded`}
                        </title>

                        <rect
                          x={-width / 2}
                          y="-12"
                          width={width}
                          height="24"
                          rx="7"
                        />

                        <text textAnchor="middle" dy="0.35em">
                          {label}
                        </text>
                      </g>
                    );
                  })}
                </svg>

                {STAGES.map(stage => {
                  const [x, y] = POSITIONS[stage.name];

                  return (
                    <button
                      type="button"
                      key={stage.name}
                      className="jd-node"
                      aria-pressed={filter === stage.name}
                      style={{
                        left: `${((x - 220) / 780) * 100}%`,
                        top: `${y / 3.8}%`,
                        "--stage": stage.color,
                      }}
                      onClick={() =>
                        setFilter(previous =>
                          previous === stage.name ? "" : stage.name
                        )
                      }
                    >
                      <span className="jd-node-icon" aria-hidden="true">
                        {stage.icon}
                      </span>

                      <span>
                        <span className="jd-node-label">
                          {stage.name}
                        </span>
                        <strong>{counts[stage.name]}</strong>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <p className="jd-flow-note">
              Each arrow counts distinct applications that made that direct
              move since tracking began. Earlier unrecorded steps are unknown.
              Repeated moves count once per arrow.
            </p>

            {otherTransitions.length > 0 && (
              <details className="jd-other-transitions">
                <summary>Other recorded transitions</summary>
                <ul>
                  {otherTransitions.map(item => (
                    <li
                      key={edgeKey(item.from_status, item.to_status)}
                    >
                      <span>
                        {item.from_status} → {item.to_status}
                      </span>
                      <strong>{Number(item.application_count)}</strong>
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <section className="jd-panel jd-board-panel">
            <div className="jd-section-header">
              <div>
                <h2>Your application board</h2>
                <p>Drag a card or use its status menu to move it.</p>
              </div>

              <div className="jd-board-tools">
                {filter && (
                  <button type="button" onClick={() => setFilter("")}>
                    Show all
                  </button>
                )}

                <input
                  className="jd-search"
                  type="search"
                  aria-label="Search applications"
                  placeholder="Search applications…"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                />
              </div>
            </div>

            {unknownCount > 0 && (
              <p className="jd-warning">
                {unknownCount} applications have unrecognized statuses.
                Update them on the Applications page to show them here.
              </p>
            )}

            <div className="jd-board">
              {STAGES.filter(stage => !filter || stage.name === filter)
                .map(stage => {
                  const cards = visibleApplications.filter(
                    app => app.status === stage.name
                  );

                  return (
                    <section
                      key={stage.name}
                      className={`jd-column ${
                        dragOver === stage.name ? "jd-drag-over" : ""
                      }`}
                      style={{ "--stage": stage.color }}
                      aria-label={`${stage.name} applications`}
                      onDragOver={event => {
                        if (
                          event.dataTransfer.types.includes(
                            "application/offerly-id"
                          )
                        ) {
                          event.preventDefault();
                          setDragOver(stage.name);
                        }
                      }}
                      onDrop={event =>
                        dropApplication(event, stage.name)
                      }
                    >
                      <div className="jd-column-header">
                        <h3>
                          <span className="jd-dot" />
                          {stage.name}
                          <span className="jd-column-count">
                            {cards.length}
                          </span>
                        </h3>

                        <button
                          type="button"
                          aria-label={`Add ${stage.name} application`}
                          disabled={pendingId !== null}
                          onClick={() => addApplication(stage.name)}
                        >
                          +
                        </button>
                      </div>

                      {!cards.length && (
                        <p className="jd-empty">
                          {search
                            ? "No matching applications."
                            : "No applications here yet."}
                        </p>
                      )}

                      {cards.map(app => (
                        <article
                          className="jd-job"
                          key={app.id}
                          draggable={pendingId === null && !editing}
                          aria-busy={pendingId === app.id}
                          onDragStart={event => {
                            event.dataTransfer.setData(
                              "application/offerly-id",
                              String(app.id)
                            );
                            event.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => setDragOver("")}
                        >
                          <button
                            type="button"
                            className="jd-job-open"
                            disabled={pendingId !== null}
                            onClick={() => openApplication(app)}
                          >
                            <span className="jd-company-row">
                              <span className="jd-avatar" aria-hidden="true">
                                {app.company?.charAt(0)?.toUpperCase() || "?"}
                              </span>

                              <span>{app.company || "Untitled company"}</span>
                              <span className="jd-edit-hint">↗</span>
                            </span>

                            <strong className="jd-role">
                              {app.role || "Untitled role"}
                            </strong>

                            <span className="jd-meta">
                              {app.location || "Location not added"}
                            </span>

                            <span className="jd-meta">
                              {formatDate(app.date_applied)}
                            </span>
                          </button>

                          <div className="jd-card-footer">
                            <span
                              className={`jd-priority jd-priority-${
                                String(app.priority || "Medium").toLowerCase()
                              }`}
                            >
                              {app.priority || "Medium"}
                            </span>
                          </div>

                          <label className="jd-status-label">
                            <span className="jd-sr-only">
                              Status for {app.role} at {app.company}
                            </span>

                            <select
                              value={app.status}
                              disabled={pendingId !== null}
                              onChange={event =>
                                changeStatus(app.id, event.target.value)
                              }
                            >
                              {STAGES.map(option => (
                                <option key={option.name}>
                                  {option.name}
                                </option>
                              ))}
                            </select>
                          </label>
                        </article>
                      ))}
                    </section>
                  );
                })}
            </div>
          </section>
        </>
      )}

      {editing && (
        <ApplicationModal
          application={editing}
          onClose={() => {
            if (!mutationLock.current) setEditing(null);
          }}
          onSave={saveApplication}
        />
      )}

      {importOpen && (
        <ImportApplications
          applications={applications}
          onClose={() => setImportOpen(false)}
          onImported={fetchApplications}
        />
      )}
    </div>
  );
}