"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

export default function EventDisplayPage() {
  const code = useSearchParams().get("game") || ""; const [state, setState] = useState<any>(null);
  useEffect(() => { let id: any; async function load() { const found = await (await fetch(`/api/session-by-code?sessionCode=${encodeURIComponent(code)}`)).json(); if (!found.session) return; const data = await (await fetch(`/api/no-gm/state?sessionId=${found.session.id}`)).json(); setState(data); } load(); id = setInterval(load, 2500); return () => clearInterval(id); }, [code]);
  if (!state?.session) return <main className="event-display"><h1>PCL Trivia</h1><p>Loading game…</p></main>;
  const { session, control, players, leaderboardExport } = state; return <main className="event-display"><h1>PCL Trivia · Game #{session.session_code}</h1>{control?.state === "timeout" ? <h2>Game timed out — scan the player QR code to resume.</h2> : control?.state === "ended" ? <h2>Game complete</h2> : <><h2>{session.current_question_text || "Players are joining…"}</h2>{session.question_status === "revealed" && <p className="event-answer">Answer: {session.current_answer}</p>}</>}<ol>{(leaderboardExport?.leaderboard || players || []).map((player: any) => <li key={player.id}>{player.display_name} <strong>{player.score}</strong></li>)}</ol></main>;
}
