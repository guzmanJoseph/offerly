
import { useState } from "react";

export default function AccordionSection({
  title,
  description,
  icon = "▸",
  children,
  defaultOpen = false
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="af-accordion">
      <button
        type="button"
        className="af-accordion-trigger"
        aria-expanded={open}
        onClick={() => setOpen(value => !value)}
      >
        <span
          className="af-accordion-icon"
          aria-hidden="true"
        >
          {icon}
        </span>

        <span className="af-accordion-heading">
          <strong>{title}</strong>
          {description && <small>{description}</small>}
        </span>

        <span className="af-accordion-chevron" aria-hidden="true">
          {open ? "⌃" : "⌄"}
        </span>
      </button>

      {open && (
        <div className="af-accordion-content">
          {children}
        </div>
      )}
    </section>
  );
}
