import { FiEdit2 } from "react-icons/fi";
import "./networking.css";

export default function ContactTable({ contacts, onEdit }) {
  return (
    <div className="table-card">
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
              <td>{contact.name}</td>
              <td>{contact.company}</td>
              <td>{contact.role}</td>
              <td>{contact.relationship_type}</td>
              <td>
                <span className="contact-status">
                  {contact.status}
                </span>
              </td>
              <td>{contact.next_follow_up || "—"}</td>

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