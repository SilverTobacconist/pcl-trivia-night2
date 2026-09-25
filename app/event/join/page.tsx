"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { anonymousAccessToken } from "@/lib/browserSupabase";

export default function EventJoinPage() {
  const game = useSearchParams().get("game") || ""; const router = useRouter();
  const [name, setName] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [needsController, setNeedsController] = useState(false); const [decline, setDecline] = useState(false);
  useEffect(() => { if (!game) return; fetch(`/api/session-by-code?sessionCode=${encodeURIComponent(game)}`).then((response) => response.json()).then((data) => setNeedsController(Boolean(data.needsController))); }, [game]);
  async function join(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const token = await anonymousAccessToken();
      const response = await fetch("/api/no-gm/join", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ sessionCode: game, displayName: name, declineController: needsController && decline }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      router.push(`/event/play?sessionId=${data.session.id}&playerId=${data.player.id}`);
    } catch (err: any) { setError(err.message || "Could not join game."); } finally { setBusy(false); }
  }
  return <main className="event-shell roper-trivia"><p className="roper-trivia-kicker">Paul&apos;s Cigar Lounge presents</p><h1>Join Roper Trivia</h1><p>Game #{game || "—"}</p><form className="event-card" onSubmit={join}>{needsController && <><h2>You’re first in line</h2><p>You can be the Decision Player: start the game, skip a completed countdown, and pass control if needed.</p><label><input type="checkbox" checked={decline} onChange={(event) => setDecline(event.target.checked)} /> Let the next player be the controller instead</label></>}<label>Your display name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} required autoFocus /></label><button disabled={busy}>{busy ? "Joining…" : "Join game"}</button></form>{error && <p className="event-error">{error}</p>}</main>;
}
