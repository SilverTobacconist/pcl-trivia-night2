"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { anonymousAccessToken } from "@/lib/browserSupabase";

export default function EventJoinPage() {
  const game = useSearchParams().get("game") || ""; const router = useRouter();
  const [name, setName] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [needsController, setNeedsController] = useState(false); const [isPaused, setIsPaused] = useState(false); const [decline, setDecline] = useState(false); const [triviaTuesday,setTriviaTuesday]=useState<any>(null); const [now,setNow]=useState(Date.now());
  useEffect(() => { if (!game) return; fetch(`/api/session-by-code?sessionCode=${encodeURIComponent(game)}`).then((response) => response.json()).then((data) => { setNeedsController(Boolean(data.needsController)); setIsPaused(Boolean(data.isPaused)); setTriviaTuesday(data.triviaTuesday||null); }); }, [game]);
  useEffect(()=>{const id=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id);},[]);
  async function join(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const token = await anonymousAccessToken();
      const response = await fetch("/api/no-gm/join", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ sessionCode: game, displayName: name, declineController: needsController && decline }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      router.push(`/event/play?sessionId=${data.session.id}&playerId=${data.player.id}`);
    } catch (err: any) { setError(err.message || "Could not join game."); } finally { setBusy(false); }
  }
  const seconds=triviaTuesday?Math.max(0,Math.ceil((new Date(triviaTuesday.scheduled_start_at).getTime()-now)/1000)):0;
  const countdown=(total:number)=>{const days=Math.floor(total/86400),hours=Math.floor(total%86400/3600),minutes=Math.floor(total%3600/60),secs=total%60;return `${days}d ${hours}h ${minutes}m ${secs}s`;};
  const localTime=triviaTuesday?new Date(triviaTuesday.scheduled_start_at).toLocaleString("en-US",{timeZone:"America/Chicago",dateStyle:"medium",timeStyle:"short"}):"";
  return <main className="event-shell"><p>Paul&apos;s Cigar Lounge presents</p><h1>{triviaTuesday ? triviaTuesday.event_name : "Join PCL Trivia Night"}</h1>{triviaTuesday ? <p>will begin at {localTime}.<br/>It will begin in {countdown(seconds)}.</p> : <p>Game #{game || "—"}</p>}<form className="event-card" onSubmit={join}>{!triviaTuesday && (isPaused ? <><h2>Game paused</h2><p>Joining this paused game makes you the Decision Player.  After you join, tap Resume to continue exactly where it left off.</p></> : needsController && <><h2>You’re first in line</h2><p>You can be the Decision Player: start the game, skip a completed countdown, and pass control if needed.</p><label><input type="checkbox" checked={decline} onChange={(event) => setDecline(event.target.checked)} /> Let the next player be the controller instead</label></>)}<label>Your display name<input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} required autoFocus /></label><button disabled={busy}>{busy ? "Joining…" : "Join game"}</button></form>{error && <p className="event-error">{error}</p>}</main>;
}
