import { useEffect, useState } from "react";
import DockTabs from "./DockTabs.jsx";
import { getBugReportContext } from "../api/settings.js";
import { listScreenshots } from "../api/screenshots.js";
import { getFeatures, voteFeature, getSuggestions, submitSuggestion, submitBugReport, SUGGESTION_CATEGORIES } from "../api/feedback.js";

function BugIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <ellipse cx="12" cy="13" rx="5" ry="6" />
      <path d="M7 10 3.5 8M17 10l3.5-2M7 16l-3.5 2M17 16l3.5 2M12 7V4M9 7l-1.5-2M15 7l1.5-2" />
    </svg>
  );
}

function ThumbsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M7 11v9H4v-9h3Zm0 0 3.5-7a2 2 0 0 1 2 2v3h4.5a1.6 1.6 0 0 1 1.5 2.2l-2 6.3a2 2 0 0 1-1.9 1.5H7" />
    </svg>
  );
}

function SuggestionIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.5 10.9c.5.4.8 1 .8 1.6V16h5.4v-.5c0-.6.3-1.2.8-1.6A6 6 0 0 0 12 3Z" />
    </svg>
  );
}

/** "Bug melden"-Tab: sammelt echte Diagnose-Daten (Log-Auszug, Launcher-/
 * OS-Version, wahlweise ein Screenshot), das eigentliche Absenden ist noch
 * ein Mock (kein Ticket-System angebunden, siehe api/feedback.js). */
function BugReportTab() {
  const [context, setContext] = useState(null);
  const [screenshots, setScreenshots] = useState([]);
  const [selectedScreenshot, setSelectedScreenshot] = useState(null);
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getBugReportContext()
      .then(setContext)
      .catch(() => setContext({ error: true }));
    listScreenshots(6)
      .then(setScreenshots)
      .catch(() => setScreenshots([]));
  }, []);

  async function handleSubmit() {
    setSending(true);
    setStatus(null);
    try {
      await submitBugReport({
        description,
        screenshot: selectedScreenshot,
        context,
      });
      setStatus("Danke! Der Bericht wurde erfasst (noch ohne echtes Ticket-System - siehe Hinweis unten).");
      setDescription("");
      setSelectedScreenshot(null);
    } catch (err) {
      setStatus(err?.message ?? String(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="erzmark-feedback-panel">
      <label className="erzmark-feedback-field">
        <span>Was ist passiert?</span>
        <textarea
          rows={4}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Kurz beschreiben, was du erwartet hast und was stattdessen passiert ist…"
        />
      </label>

      {screenshots.length > 0 && (
        <div className="erzmark-feedback-field">
          <span>Screenshot anhängen (optional)</span>
          <div className="erzmark-feedback-screenshot-row">
            {screenshots.map((s) => (
              <button
                type="button"
                key={s.filename}
                className={`erzmark-feedback-screenshot-thumb${selectedScreenshot === s.filename ? " is-selected" : ""}`}
                onClick={() => setSelectedScreenshot(selectedScreenshot === s.filename ? null : s.filename)}
                title={s.filename}
              >
                <img src={s.thumbnail_data_url} alt="" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="erzmark-feedback-context">
        <span className="erzmark-feedback-context-title">Wird automatisch mitgeschickt:</span>
        {context ? (
          <ul>
            <li>Launcher v{context.launcher_version} · {context.os}/{context.arch}</li>
            <li>{context.log_tail ? `Letzte ${context.log_tail.split("\n").length} Log-Zeilen` : "Keine Log-Datei vorhanden"}</li>
          </ul>
        ) : (
          <p className="erzmark-hint">Sammle Diagnose-Daten…</p>
        )}
      </div>

      <button className="erzmark-btn-primary-small" onClick={handleSubmit} disabled={sending || !description.trim()}>
        {sending ? "Wird gesendet…" : "Bericht senden"}
      </button>
      {status && <p className="erzmark-hint">{status}</p>}
      <p className="erzmark-hint">
        Log-Auszug/Version/Screenshot sind echt von diesem Rechner – das Absenden an ein Support-System ist noch
        nicht angebunden (siehe Launcher-Update-TODO, Abschnitt 6 „Support &amp; Transparenz").
      </p>
    </div>
  );
}

function VotingTab() {
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getFeatures()
      .then(setFeatures)
      .finally(() => setLoading(false));
  }, []);

  async function handleVote(id, direction) {
    const updated = await voteFeature(id, direction);
    if (updated) setFeatures((prev) => prev.map((f) => (f.id === id ? updated : f)));
  }

  if (loading) return <p className="erzmark-hint">Lädt…</p>;

  return (
    <div className="erzmark-feedback-vote-list">
      {features.map((f) => (
        <div key={f.id} className="erzmark-feedback-vote-row">
          <div className="erzmark-feedback-vote-body">
            <span className="erzmark-feedback-vote-title">{f.title}</span>
            <span className="erzmark-feedback-vote-desc">{f.description}</span>
          </div>
          <div className="erzmark-feedback-vote-actions">
            <button
              type="button"
              className={`erzmark-feedback-vote-btn${f.myVote === 1 ? " is-active" : ""}`}
              onClick={() => handleVote(f.id, 1)}
              aria-label="Dafür stimmen"
            >
              👍 {f.upvotes}
            </button>
            <button
              type="button"
              className={`erzmark-feedback-vote-btn${f.myVote === -1 ? " is-active" : ""}`}
              onClick={() => handleVote(f.id, -1)}
              aria-label="Dagegen stimmen"
            >
              👎 {f.downvotes}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SuggestionBoxTab() {
  const [category, setCategory] = useState(SUGGESTION_CATEGORIES[0].key);
  const [text, setText] = useState("");
  const [mine, setMine] = useState([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getSuggestions().then(setMine);
  }, []);

  async function handleSubmit() {
    if (!text.trim()) return;
    setSending(true);
    try {
      const entry = await submitSuggestion({ category, text });
      setMine((prev) => [entry, ...prev]);
      setText("");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="erzmark-feedback-panel">
      <label className="erzmark-feedback-field">
        <span>Kategorie</span>
        <select value={category} onChange={(e) => setCategory(e.target.value)}>
          {SUGGESTION_CATEGORIES.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label className="erzmark-feedback-field">
        <span>Dein Vorschlag</span>
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Was sollte sich ändern oder ergänzt werden?" />
      </label>
      <button className="erzmark-btn-primary-small" onClick={handleSubmit} disabled={sending || !text.trim()}>
        {sending ? "Wird gesendet…" : "Einreichen"}
      </button>

      {mine.length > 0 && (
        <div className="erzmark-feedback-mine">
          <span className="erzmark-feedback-context-title">Deine Vorschläge dieser Session</span>
          {mine.map((s) => (
            <div key={s.id} className="erzmark-feedback-mine-row">
              <span className={`erzmark-feedback-tag erzmark-feedback-tag-${s.category}`}>
                {SUGGESTION_CATEGORIES.find((c) => c.key === s.category)?.label}
              </span>
              <span>{s.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Feedback-Fenster (Launcher-Update-TODO, Abschnitt 6) mit drei Tabs (gleiche
 * DockTabs-Komponente wie SocialDock/SidebarDock, nur außerhalb der
 * Sidebar in einem Modal). Nur "Bug melden" sammelt echte lokale Daten
 * (Log/OS/Version, siehe bugreport.rs) - Voting/Vorschlagsbox/Versand sind
 * bewusst noch Mock-APIs (siehe api/feedback.js), analog zum
 * Freundessystem Teil 1 und den Achievements.
 */
export default function FeedbackScreen({ onClose }) {
  const tabs = [
    { id: "bug", label: "Bug melden", Icon: BugIcon, color: "gold", content: <BugReportTab /> },
    { id: "voting", label: "Voting", Icon: ThumbsIcon, color: "blue", content: <VotingTab /> },
    { id: "suggestions", label: "Vorschläge", Icon: SuggestionIcon, color: "green", content: <SuggestionBoxTab /> },
  ];

  return (
    <div className="erzmark-modal-backdrop" onClick={onClose}>
      <div className="erzmark-modal-panel erzmark-feedback-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="erzmark-modal-header">
          <h2>Feedback</h2>
          <button className="erzmark-modal-close" onClick={onClose} aria-label="Schließen">
            ✕
          </button>
        </div>
        <div className="erzmark-modal-body">
          <DockTabs tabs={tabs} />
        </div>
      </div>
    </div>
  );
}
