import {
    FiSend,
    FiClipboard,
    FiMessageCircle,
    FiAward,
    FiXCircle,
    FiClock,
    FiRepeat,
    FiLink,
    FiArchive,
    FiUserPlus,
    FiHelpCircle
} from "react-icons/fi";

/* Every status gets a tone (color family) + an icon.
   Tones are styled in src/styles/glass.css */

const STATUS_MAP = {
    "applied":            { tone: "cyan",   Icon: FiSend },
    "assessment":         { tone: "amber",  Icon: FiClipboard },
    "interview":          { tone: "violet", Icon: FiMessageCircle },
    "offer":              { tone: "green",  Icon: FiAward },
    "rejected":           { tone: "rose",   Icon: FiXCircle },

    "want to reach out":  { tone: "indigo", Icon: FiUserPlus },
    "reached out":        { tone: "cyan",   Icon: FiSend },
    "awaiting response":  { tone: "amber",  Icon: FiClock },
    "connected":          { tone: "green",  Icon: FiLink },
    "follow up":          { tone: "violet", Icon: FiRepeat },
    "referred":           { tone: "pink",   Icon: FiAward },
    "archived":           { tone: "slate",  Icon: FiArchive }
};

export default function StatusBadge({ status = "" }) {

    const key = String(status).toLowerCase().trim();

    const { tone, Icon } = STATUS_MAP[key] || {
        tone: "slate",
        Icon: FiHelpCircle
    };

    return (
        <span
            className={`status-badge glow-pill tone-${tone} ${key.replace(/\s+/g, "-")}`}
            data-status={key}
        >
            <Icon className="pill-icon" />
            {status}
        </span>
    );
}
