import { FiEdit2 } from "react-icons/fi";
import StatusBadge from "../applications/StatusBadge";
import "../styles/networking.css";

export default function ContactTable({ contacts, onEdit }) {
  return (
    <div className="table-card table-responsive">
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Company</th>
            <th>Role</th>
            <th>Relationship</th>
            <th>Status</th>
            <th>Next Follow-Up</th>
            <th className="edit-column"></th>
          </tr>
        </thead>

        <tbody>
          {contacts.map(contact => (
            <tr key={contact.id}>
              <td data-label="Name"><span className="cell-primary">{contact.name}</span></td>
              <td data-label="Company">{contact.company}</td>
              <td data-label="Role">{contact.role}</td>
              <td data-label="Relationship">{contact.relationship_type}</td>
              <td data-label="Status">
                <StatusBadge status={contact.status} />
              </td>
              <td data-label="Next Follow-Up">{contact.next_follow_up || "—"}</td>

              <td className="edit-column">
                <button
                  className="action-btn"
                  onClick={() => onEdit(contact)}
                >
                  <FiEdit2 />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}