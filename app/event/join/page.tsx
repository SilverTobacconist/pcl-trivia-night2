"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";
import { anonymousAccessToken } from "@/lib/browserSupabase";

export default function EventJoinPage() {
  const game = useSearchParams().get("game") || ""; const router = useRouter(); const [name, setName] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function join(event: React.FormEvent) { event.preventDefault(); setBusy(true); setError(""); try { const token = await anonymousAccessToken(); const lookup = await fetch(`/api/session-by-code?sessionCode=${encodeURIComponent(game)}`); const found = await lookup.json(); if (!lookup.ok) throw new Error(found.error || "Game not found."); const response = await fetch("/api/no-gm/join", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ sessionCode: game, displayName: name }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); router.push(`/event/play?sessionId=${data.session.id}&playerId=${data.player.id}`); } catch (err: any) { setError(err.message || "Could not join game."); } finally { setBusy(false); } }
  return <main className="event-shell"><h1>Join PCL Trivia</h1><p>Game #{game || "—"}</p><form className="event-card" onSubmit={join}><label>Your display name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} required autoFocus /></label><button disabled={busy}>{busy ? "Joining…" : "Join game"}</button></form>{error && <p className="event-error">{error}</p>}</main>;
}
