"use client";

import { useState } from "react";
import QRCode from "qrcode";

export default function EventPage() {
  const [session, setSession] = useState<any>(null);
  const [qr, setQr] = useState("");
  const [error, setError] = useState("");
  const [location, setLocation] = useState("Hastings");
  const [joinCode, setJoinCode] = useState("");

  async function showQr(sessionToShow: any) {
    setSession(sessionToShow);
    setQr(await QRCode.toDataURL(`${window.location.origin}/event/join?game=${sessionToShow.session_code}`, { width: 360, margin: 2 }));
  }

  async function createEvent() {
    setError("");
    const response = await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location, hostName: "Bartender" }) });
    const data = await response.json();
    if (!response.ok) return setError(data.error || "Could not start game.");
    await showQr(data.session);
  }

  async function joinInProgress() {
    setError("");
    const response = await fetch(`/api/session-by-code?sessionCode=${encodeURIComponent(joinCode)}`);
    const data = await response.json();
    if (!response.ok || data.session?.status !== "active") return setError(data.error || "No active game found with that number.");
    await showQr(data.session);
  }

  async function resetQuestions() {
    if (!window.confirm(`Reset all ${location} used-question history?`)) return;
    const response = await fetch("/api/no-gm/bartender", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "reset_questions", location }) });
    const data = await response.json();
    if (!response.ok) setError(data.error || "Could not reset questions.");
    else alert(data.message);
  }

  return (
    <main className="event-shell">
      <h1>PCL Trivia Night</h1>
      <h2>Bartender Console</h2>
      {!session ? (
        <section className="event-card">
          <label>Location
            <select value={location} onChange={(event) => setLocation(event.target.value)}>
              <option>Hastings</option>
              <option>Norfolk</option>
            </select>
          </label>
          <button onClick={createEvent}>Start Trivia Night</button>
          <a className="event-secondary-link" href="/event-trivia">Start Event Trivia</a>
          <p>Trivia Night creates the QR-code game for players.  Event Trivia is the separate keyword-driven question display for special events.</p>
        </section>
      ) : (
        <section className="event-card">
          <h2>Game #{session.session_code}</h2>
          <p>Have the first player scan this QR code.  They choose the game path and the game runs itself.</p>
          {qr && <img src={qr} alt="QR code to join trivia" style={{ maxWidth: "100%" }} />}
          <p><a href={`/event/display?game=${session.session_code}`} target="_blank">Open display screen</a></p>
        </section>
      )}
      <section className="event-card">
        <h2>Game tools</h2>
        <label>Join game in progress
          <input value={joinCode} onChange={(event) => setJoinCode(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Game number" />
        </label>
        <button onClick={joinInProgress} disabled={!joinCode}>Show game QR code</button>
        <button onClick={resetQuestions}>Reset {location} questions</button>
      </section>
      <section className="event-card">
        <h2>Leaderboards</h2>
        <p>View every current and past game, newest first.</p>
        <a className="event-secondary-link" href="/history">View all leaderboards</a>
      </section>
      {error && <p className="event-error">{error}</p>}
    </main>
  );
}
