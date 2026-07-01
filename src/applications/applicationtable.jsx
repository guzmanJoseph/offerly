import { FiEdit2 } from "react-icons/fi";
import StatusBadge from "./StatusBadge";

export default function ApplicationTable({
    applications,
    onEdit
}) {

    return (
        <div className="table-card">

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

                            <td>{app.company}</td>

                            <td>{app.role}</td>

                            <td>
                                <StatusBadge status={app.status} />
                            </td>

                            <td>{app.dateApplied}</td>

                            <td>{app.location}</td>

                            <td className="edit-column">
                                <button
                                    className="action-btn"
                                    onClick={() => onEdit(app)}
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