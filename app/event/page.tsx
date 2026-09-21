"use client";

import { useState } from "react";
import QRCode from "qrcode";

export default function EventPage() {
  const [session, setSession] = useState<any>(null); const [qr, setQr] = useState(""); const [error, setError] = useState("");
  async function createEvent() {
    setError(""); const response = await fetch("/api/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "Paul's Cigar Lounge", hostName: "Bartender" }) });
    const data = await response.json(); if (!response.ok) return setError(data.error || "Could not start event.");
    setSession(data.session); setQr(await QRCode.toDataURL(`${window.location.origin}/event/join?game=${data.session.session_code}`, { width: 360, margin: 2 }));
  }
  return <main className="event-shell"><h1>PCL Trivia Night</h1><h2>Bartender Console</h2>{!session ? <section className="event-card"><button onClick={createEvent}>Start Trivia Night</button><a className="event-secondary-link" href="/event-trivia">Start Event Trivia</a><p>Trivia Night creates the QR-code game for players.  Event Trivia is the separate keyword-driven question display for special events.</p></section> : <section className="event-card"><h2>Game #{session.session_code}</h2><p>Have the first player scan this QR code. They choose the game path and the game runs itself.</p>{qr && <img src={qr} alt="QR code to join trivia" style={{ maxWidth: "100%" }} />}<p><a href={`/event/display?game=${session.session_code}`} target="_blank">Open display screen</a></p></section>}{error && <p className="event-error">{error}</p>}</main>;
}
