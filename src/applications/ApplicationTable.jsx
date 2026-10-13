import { FiEdit2, FiTrash2 } from "react-icons/fi";
import StatusBadge from "./StatusBadge";

export default function ApplicationTable({
    applications,
    onEdit,
    onDelete
}) {

    return (
        <div className="table-card table-responsive">

            <table>

                <thead>

                    <tr>
                        <th>Company</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Applied</th>
                        <th>Location</th>
                        <th className="edit-column">Edit</th>
                    </tr>

                </thead>

                <tbody>

                    {applications.map(app => (

                        <tr key={app.id}>

                            <td data-label="Company">
                                <span className="cell-primary">{app.company}</span>
                            </td>

                            <td data-label="Role">{app.role}</td>

                            <td data-label="Status">
                                <StatusBadge status={app.status} />
                            </td>

                            <td data-label="Applied">{app.date_applied}</td>

                            <td data-label="Location">{app.location}</td>

                            <td className="edit-column">
                                <div className="action-buttons">
                                    <button
                                        className="action-btn"
                                        onClick={() => onEdit(app)}
                                    >
                                        <FiEdit2 />
                                    </button>

                                    <button
                                        className="delete-btn"
                                        onClick={() => onDelete(app.id)}
                                    >
                                        <FiTrash2 />
                                    </button>
                                </div>
                            </td>
                        </tr>

                    ))}

                </tbody>

            </table>

        </div>
    );
}
