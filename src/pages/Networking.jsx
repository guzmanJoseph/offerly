import { useEffect, useState } from "react";

import { supabase } from "../lib/supabaseClient";
import ContactTable from "../networking/ContactTable";
import ContactModal from "../networking/ContactModal";

export default function Networking() {
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState(null);

  useEffect(() => {
    fetchContacts();
  }, []);

  async function fetchContacts() {
    const { data, error } = await supabase
      .from("contacts")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(error.message);
      return;
    }

    setContacts(data);
  }

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
          last_contacted: contact.last_contacted,
          next_follow_up: contact.next_follow_up,
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
        last_contacted: contact.last_contacted,
        next_follow_up: contact.next_follow_up,
        notes: contact.notes,
      });

      if (error) {
        console.error(error.message);
        return;
      }
    }

    setEditingContact(null);
    setIsModalOpen(false);
    fetchContacts();
  }

  const filtered = contacts.filter(contact =>
    `${contact.name} ${contact.company} ${contact.role} ${contact.status}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <>
      <div className="page-header">
        <h1>Networking</h1>
        <p>Track recruiters, alumni, referrals, and follow-ups.</p>
      </div>

      <div className="toolbar">
        <input
          placeholder="Search contacts..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        <button
          onClick={() => {
            setEditingContact(null);
            setIsModalOpen(true);
          }}
        >
          Add Contact
        </button>
      </div>

      <ContactTable
        contacts={filtered}
        onEdit={contact => {
          setEditingContact(contact);
          setIsModalOpen(true);
        }}
      />

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
    </>
  );
}