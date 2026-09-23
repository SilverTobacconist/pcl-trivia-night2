"use client";

import { useState } from "react";

export default function AgingRoomPanel({ aging, submit }: { aging: any; submit: (answer: string) => void }) {
  const [answer, setAnswer] = useState(""); const { game, entry, players } = aging;
  if (game.phase === "complete") return <section className="event-card"><h2>Aging Room complete</h2><ol>{players.map((player: any) => <li key={player.id}>#{player.final_place} {player.player_name}: +{player.session_points_awarded || 0}</li>)}</ol></section>;
  if (["question_result", "bale_result", "elimination"].includes(game.phase)) return <section className="event-card"><h2>{game.phase === "elimination" ? "A player has been eliminated" : "Answer revealed"}</h2>{game.phase !== "elimination" && <p><strong>Answer:</strong> {game.correct_answer}</p>}<p>Next round starts automatically.</p></section>;
  return <section className="event-card"><p className="event-timer">The Aging Room</p><h2>{game.question_text}</h2><p>{game.phase === "bale_question" ? "Bale Stack — first to 5 bales wins" : `${game.required_correct} correct answers to advance`}</p>{entry ? <p className="event-locked-answer">Your locked answer: {entry.submitted_answer}</p> : <form onSubmit={(event) => { event.preventDefault(); submit(answer); setAnswer(""); }}><input value={answer} onChange={(event) => setAnswer(event.target.value)} placeholder="Your answer" required /><button>Lock answer</button></form>}<ol>{players.filter((player: any) => player.status !== "excluded").map((player: any) => <li key={player.id}>{player.player_name}: {game.phase === "bale_question" ? `${player.bale_count || 0}/5 bales` : player.status === "passed" ? "Passed" : `${player.round_correct || 0}/${game.required_correct}`}</li>)}</ol></section>;
}
