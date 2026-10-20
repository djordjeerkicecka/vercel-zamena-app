"use client";

import { useState } from "react";

interface TicketNoteRow {
  id: string;
  author_email: string;
  note: string;
  created_at: string;
}

export function NotesPanel({ ticketId, initialNotes }: { ticketId: string; initialNotes: TicketNoteRow[] }) {
  const [notes, setNotes] = useState(initialNotes);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdd() {
    if (!draft.trim()) return;
    setSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/tickets/${ticketId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: draft.trim() }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Greška prilikom čuvanja beleške.");
        return;
      }

      setNotes((prev) => [data.note, ...prev]);
      setDraft("");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <textarea
          className="form-input"
          rows={2}
          placeholder="Dodajte internu belešku..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button type="button" className="btn-secondary shrink-0" onClick={handleAdd} disabled={saving}>
          Dodaj
        </button>
      </div>
      {error && <p className="form-error">{error}</p>}

      <ul className="mt-3 space-y-2">
        {notes.map((note) => (
          <li key={note.id} className="rounded-lg bg-gray-50 p-2.5 text-sm">
            <p className="text-gray-700">{note.note}</p>
            <p className="mt-1 text-xs text-gray-400">
              {note.author_email} · {new Date(note.created_at).toLocaleString("sr-RS")}
            </p>
          </li>
        ))}
        {notes.length === 0 && <p className="text-sm text-gray-400">Nema beležaka.</p>}
      </ul>
    </div>
  );
}
