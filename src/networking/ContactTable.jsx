import { FiEdit2, FiLinkedin, FiMail } from "react-icons/fi";

function formatDate(value) {
  if (!value) return "Not scheduled";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function getSafeProfileUrl(value) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function statusClass(status) {
  return (status || "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function ContactActions({ contact, onEdit }) {
  const profileUrl = getSafeProfileUrl(contact.linkedin_url);

  return (
    <div className="networking-contact-actions">
      {contact.email && (
        <a className="networking-icon-button" href={`mailto:${contact.email}`} aria-label={`Email ${contact.name}`}>
          <FiMail aria-hidden="true" />
        </a>
      )}
      {profileUrl && (
        <a className="networking-icon-button" href={profileUrl} target="_blank" rel="noreferrer" aria-label={`Open ${contact.name}'s LinkedIn profile`}>
          <FiLinkedin aria-hidden="true" />
        </a>
      )}
      <button className="networking-icon-button" type="button" onClick={() => onEdit(contact)} aria-label={`Edit ${contact.name}`}>
        <FiEdit2 aria-hidden="true" />
      </button>
    </div>
  );
}

export default function ContactTable({ contacts, onEdit }) {
  return (
    <div className="networking-table-card">
      <div className="networking-desktop-table">
        <table className="networking-table">
          <thead>
            <tr>
              <th scope="col">Contact</th>
              <th scope="col">Company and role</th>
              <th scope="col">Relationship</th>
              <th scope="col">Status</th>
              <th scope="col">Next follow-up</th>
              <th scope="col"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {contacts.map((contact) => (
              <tr key={contact.id}>
                <td>
                  <div className="networking-person">
                    <span className="networking-avatar" aria-hidden="true">
                      {(contact.name || "?").trim().charAt(0).toUpperCase()}
                    </span>
                    <div className="networking-person-copy">
                      <strong>{contact.name || "Unnamed contact"}</strong>
                      {contact.email && <span>{contact.email}</span>}
                    </div>
                  </div>
                </td>
                <td>
                  <div className="networking-company-copy">
                    <strong>{contact.company || "—"}</strong>
                    {contact.role && <span>{contact.role}</span>}
                  </div>
                </td>
                <td>{contact.relationship_type || "—"}</td>
                <td>
                  <span className={`contact-status status-${statusClass(contact.status)}`}>
                    <span className="contact-status-dot" aria-hidden="true" />
                    {contact.status || "No status"}
                  </span>
                </td>
                <td>
                  <span className="networking-follow-up-date">
                    {formatDate(contact.next_follow_up)}
                  </span>
                </td>
                <td><ContactActions contact={contact} onEdit={onEdit} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="networking-mobile-list">
        {contacts.map((contact) => (
          <article className="networking-contact-card" key={contact.id}>
            <div className="networking-contact-card-top">
              <div className="networking-person">
                <span className="networking-avatar" aria-hidden="true">
                  {(contact.name || "?").trim().charAt(0).toUpperCase()}
                </span>
                <div className="networking-person-copy">
                  <strong>{contact.name || "Unnamed contact"}</strong>
                  {contact.company && <span>{contact.company}</span>}
                </div>
              </div>
              <ContactActions contact={contact} onEdit={onEdit} />
            </div>
            <div className="networking-contact-card-details">
              {contact.role && <span>{contact.role}</span>}
              {contact.relationship_type && <span>{contact.relationship_type}</span>}
              <span className={`contact-status status-${statusClass(contact.status)}`}>
                <span className="contact-status-dot" aria-hidden="true" />
                {contact.status || "No status"}
              </span>
            </div>
            {contact.email && <a className="networking-card-email" href={`mailto:${contact.email}`}>{contact.email}</a>}
            <div className="networking-card-follow-up">
              <span>Next follow-up</span>
              <strong>{formatDate(contact.next_follow_up)}</strong>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}