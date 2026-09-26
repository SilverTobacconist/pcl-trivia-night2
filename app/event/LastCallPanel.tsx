"use client";

import { useEffect, useState } from "react";

const choices = [[1, "Easy"], [2, "Medium"], [3, "Hard"], [4, "Extra Hard"]];

export default function LastCallPanel({ lastCall, submit }: { lastCall: any; submit: (action: string, value: any) => void }) {
  const [wager, setWager] = useState(""); const [answer, setAnswer] = useState("");
  const { game, entry, entries } = lastCall;
  const [now, setNow] = useState(Date.now()); useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  const duration = game.phase === "voting" || game.phase === "wagering" ? 45 : game.phase === "question" ? 60 : game.phase === "reveal" ? 3 : 10;
  const seconds = Math.max(0, Math.ceil((new Date(game.phase_started_at).getTime() + duration * 1000 - now) / 1000)); const timer = <p className="event-timer">{seconds}s</p>;
  if (game.phase === "voting") return <section className="event-card"><h2>Last Call: choose the difficulty</h2>{timer}<p>Majority vote decides the final question.</p>{entry?.difficulty_vote ? <p className="event-locked-answer">Your vote: {choices.find(([value]) => value === entry.difficulty_vote)?.[1]}</p> : <div className="event-button-row">{choices.map(([value, label]) => <button key={value} onClick={() => submit("vote", value)}>{label}</button>)}</div>}</section>;
  if (game.phase === "wagering") return <section className="event-card"><h2>Last Call: place your wager</h2>{timer}<p>Final difficulty: {game.selected_difficulty}.</p>{entry ? (entry.wager === null || entry.wager === undefined ? <form onSubmit={(event) => { event.preventDefault(); submit("wager", wager); }}><input value={wager} onChange={(event) => setWager(event.target.value)} inputMode="numeric" type="number" min="0" max={entry.starting_score || 0} placeholder={`0–${entry.starting_score || 0}`} required /><button>Lock wager</button></form> : <p className="event-locked-answer">Your wager: {entry.wager}</p>) : <p>Only players who voted are in this Last Call round.</p>}</section>;
  if (game.phase === "question") return <section className="event-card">{timer}<h2>{game.question_text}</h2>{entry ? (entry.submitted_answer !== null && entry.submitted_answer !== undefined ? <p className="event-locked-answer"><strong>Your locked answer:</strong> {entry.submitted_answer}</p> : <form onSubmit={(event) => { event.preventDefault(); submit("answer", answer); }}><input value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Your final answer" required /><button>Lock answer</button></form>) : <p>Only players who voted are in this Last Call round.</p>}</section>;
  if (game.phase === "reveal") return <section className="event-card"><h2>Last Call answer</h2>{timer}<p><strong>{game.correct_answer}</strong></p><p>Final scores are revealing now.</p><ol>{entries.map((item: any) => <li key={item.id}>{item.players?.display_name}: {item.is_revealed ? `${item.is_correct ? "Correct" : "Incorrect"} · ${item.final_score}` : "waiting…"}</li>)}</ol></section>;
  return <section className="event-card"><h2>Last Call complete</h2>{timer}<p>Saving the final leaderboard…</p></section>;
}
