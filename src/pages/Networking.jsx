import { useEffect, useState } from "react";
import { FiPlus, FiSearch, FiUsers } from "react-icons/fi";

import { supabase } from "../lib/supabaseClient";
import ContactTable from "../networking/ContactTable";
import ContactModal from "../networking/ContactModal";
import "../styles/networking.css";

const STATUS_OPTIONS = [
  "Want to Reach Out",
  "Reached Out",
  "Awaiting Response",
  "Connected",
  "Follow Up",
  "Referred",
  "Archived",
];

function getToday() {
  const now = new Date();
  const localDate = new Date(
    now.getTime() - now.getTimezoneOffset() * 60_000
  );

  return localDate.toISOString().slice(0, 10);
}

export default function Networking() {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  async function fetchContacts() {
    setLoading(true);
    setLoadError("");

    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error.message);
      setLoadError("We couldn’t load your contacts. Please try again.");
      setLoading(false);
      return;
    }

    setContacts(data || []);
    setLoading(false);
  }

  useEffect(() => {
    fetchContacts();
  }, []);

  async function handleSaveContact(contact) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    if (editingContact) {
      const { error } = await supabase
        .from("contacts")
        .update({
          name: contact.name,
          company: contact.company,
          role: contact.role,
          email: contact.email,
          linkedin_url: contact.linkedin_url,
          relationship_type: contact.relationship_type,
          status: contact.status,
          last_contacted: contact.last_contacted || null,
          next_follow_up: contact.next_follow_up || null,
          notes: contact.notes,
          updated_at: new Date(),
        })
        .eq("id", editingContact.id);

      if (error) {
        console.error(error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("contacts").insert({
        user_id: user.id,
        name: contact.name,
        company: contact.company,
        role: contact.role,
        email: contact.email,
        linkedin_url: contact.linkedin_url,
        relationship_type: contact.relationship_type,
        status: contact.status,
        last_contacted: contact.last_contacted || null,
        next_follow_up: contact.next_follow_up || null,
        notes: contact.notes,
      });

      if (error) {
        console.error(error.message);
        return;
      }
    }

    setEditingContact(null);
    setIsModalOpen(false);
    await fetchContacts();
  }

  const normalizedSearch = search.trim().toLowerCase();
  const filteredContacts = contacts.filter((contact) => {
    const matchesSearch = [
      contact.name,
      contact.company,
      contact.role,
      contact.email,
      contact.status,
      contact.relationship_type,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearch);

    const matchesStatus =
      statusFilter === "all" || contact.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const today = getToday();
  const followUpsDue = contacts.filter(
    (contact) =>
      contact.status !== "Archived" &&
      contact.next_follow_up &&
      contact.next_follow_up <= today
  ).length;
  const connectedContacts = contacts.filter(
    (contact) =>
      contact.status === "Connected" || contact.status === "Referred"
  ).length;

  function openNewContact() {
    setEditingContact(null);
    setIsModalOpen(true);
  }

  return (
    <section className="networking-page">
      <header className="networking-header">
        <div>
          <span className="networking-eyebrow">Career relationships</span>
          <h1>Networking</h1>
          <p>Keep every professional connection and follow-up in one place.</p>
        </div>

        <button
          className="networking-add-button"
          onClick={openNewContact}
          type="button"
        >
          <FiPlus aria-hidden="true" />
          <span>Add contact</span>
        </button>
      </header>

      <div className="networking-stats" aria-label="Networking summary">
        <article className="networking-stat-card">
          <span className="networking-stat-icon">
            <FiUsers aria-hidden="true" />
          </span>
          <div>
            <p>Total contacts</p>
            <strong>{contacts.length}</strong>
          </div>
        </article>

        <article className="networking-stat-card networking-stat-card-accent">
          <span className="networking-stat-dot" aria-hidden="true" />
          <div>
            <p>Follow-ups due</p>
            <strong>{followUpsDue}</strong>
          </div>
        </article>

        <article className="networking-stat-card">
          <span className="networking-stat-check" aria-hidden="true">✓</span>
          <div>
            <p>Connected or referred</p>
            <strong>{connectedContacts}</strong>
          </div>
        </article>
      </div>

      <div className="networking-list-header">
        <div>
          <h2>Your contacts</h2>
          <p>Manage the people who can help move your search forward.</p>
        </div>
        <span className="networking-result-count">
          {filteredContacts.length} {filteredContacts.length === 1 ? "contact" : "contacts"}
        </span>
      </div>

      <div className="networking-toolbar">
        <label className="networking-search">
          <FiSearch aria-hidden="true" />
          <input
            aria-label="Search contacts"
            placeholder="Search name, company, role, or email"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>

        <label className="networking-filter">
          <span className="sr-only">Filter by status</span>
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loadError ? (
        <div className="networking-feedback networking-error" role="alert">
          <p>{loadError}</p>
          <button type="button" onClick={fetchContacts}>Try again</button>
        </div>
      ) : loading ? (
        <div className="networking-feedback" role="status">
          Loading your contacts…
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="networking-empty">
          <span className="networking-empty-icon"><FiUsers aria-hidden="true" /></span>
          <h3>{contacts.length === 0 ? "Start building your network" : "No contacts found"}</h3>
          <p>
            {contacts.length === 0
              ? "Save recruiters, alumni, and referrals so your next follow-up is easy to find."
              : "Try a different search or status filter."}
          </p>
          {contacts.length === 0 && (
            <button
              className="networking-add-button"
              onClick={openNewContact}
              type="button"
            >
              <FiPlus aria-hidden="true" />
              <span>Add your first contact</span>
            </button>
          )}
        </div>
      ) : (
        <ContactTable
          contacts={filteredContacts}
          onEdit={(contact) => {
            setEditingContact(contact);
            setIsModalOpen(true);
          }}
        />
      )}

      {isModalOpen && (
        <ContactModal
          contact={editingContact}
          onClose={() => {
            setEditingContact(null);
            setIsModalOpen(false);
          }}
          onSave={handleSaveContact}
        />
      )}
    </section>
  );
}
