"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import QRCode from "qrcode";

export default function EventDisplayPage() {
  const code = useSearchParams().get("game") || ""; const [state, setState] = useState<any>(null); const [qr, setQr] = useState("");
  useEffect(() => { let id: any; async function load() { const found = await (await fetch(`/api/session-by-code?sessionCode=${encodeURIComponent(code)}`)).json(); if (!found.session) return; const data = await (await fetch(`/api/no-gm/state?sessionId=${found.session.id}`)).json(); setState(data); } load(); id = setInterval(load, 2500); return () => clearInterval(id); }, [code]);
  useEffect(() => { if (!state?.session?.session_code) return; QRCode.toDataURL(`${window.location.origin}/event/join?game=${state.session.session_code}`, { width: 180, margin: 1 }).then(setQr); }, [state?.session?.session_code]);
  if (!state?.session) return <main className="event-display roper-trivia-display"><h1>Roper Trivia</h1><p>Loading game…</p></main>;
  const { session, control, players, leaderboardExport, lastCall } = state; return <main className="event-display roper-trivia-display"><div className="event-display-qr">{qr && <img src={qr} alt={`Join game ${session.session_code}`} />}<strong>Scan to join · Game #{session.session_code}</strong></div><p className="roper-trivia-kicker">Paul&apos;s Cigar Lounge presents</p><h1>Roper Trivia · Game #{session.session_code}</h1>{control?.state === "timeout" ? <h2>Game timed out — scan the QR code to resume.</h2> : control?.state === "ended" ? <h2>Game complete</h2> : session.game_mode === "last_call" && lastCall ? <><h2>{lastCall.game.phase === "question" ? lastCall.game.question_text : `Last Call: ${lastCall.game.phase}`}</h2>{["reveal", "complete"].includes(lastCall.game.phase) && <p className="event-answer">Answer: {lastCall.game.correct_answer}</p>}</> : <><h2>{session.current_question_text || "Players are joining…"}</h2>{session.question_status === "revealed" && <p className="event-answer">Answer: {session.current_answer}</p>}</>}<ol>{(leaderboardExport?.leaderboard || players || []).map((player: any) => <li key={player.id}>{player.display_name} <strong>{player.score}</strong></li>)}</ol></main>;
}
