"use client";

import { useEffect, useState } from "react";

export default function RickhousePanel({ rickhouse, playerId, onAction }: { rickhouse: any; playerId: string; onAction: (action: string, value?: any) => void }) {
  const [answer, setAnswer] = useState("");
  const [wager, setWager] = useState("");
  const { game, pours = [], standings = [], activePour, myAnswer, myScore } = rickhouse;
  const phase = game.game_phase;
  const isPicker = game.current_picker_player_id === playerId;
  const isAngel = game.angels_share_player_id === playerId;
  const seconds = activePour?.selected_at && ["question", "angels_question"].includes(phase)
    ? Math.max(0, Math.ceil((new Date(activePour.selected_at).getTime() + 30000 - Date.now()) / 1000)) : null;
  useEffect(() => { setAnswer(""); setWager(""); }, [game.current_pour_id, phase]);
  const columns = Array.from({ length: 5 }, (_, column) => pours.filter((pour: any) => pour.column_index === column).sort((a: any, b: any) => a.row_index - b.row_index));
  const board = (
    <div className="rickhouse-board">
      {columns.map((column, index) => (
        <div key={index} className="rickhouse-column">
          <strong>{column[0]?.category || "Category"}</strong>
          {column.map((pour: any) => (
            <button key={pour.id} disabled={!isPicker || pour.is_used || phase !== "board"} onClick={() => onAction("pick", pour.id)} className={pour.is_used ? "rickhouse-used" : ""}>
              {pour.is_used ? (pour.is_angels_share ? "Angel’s Share" : "Used") : `${pour.point_value}`}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
  const reveal = ["pour_reveal", "angels_reveal"].includes(phase);
  const questionPhase = ["question", "angels_question", "pour_reveal", "angels_reveal"].includes(phase);
  return (
    <section className="event-card">
      <h2>Rickhouse Trivia · {String(game.round_name).replaceAll("_", " ")}</h2>
      {phase === "board" && <><p>{isPicker ? "Your pick.  Choose a pour." : "Waiting for the next picker."}</p>{board}</>}
      {phase === "angels_wager" && <><h3>Angel’s Share</h3><p>{isAngel ? `You found it.  Wager up to ${Math.max(Number(myScore || 0), game.round_name === "double_cask" ? 2000 : 1000)} points.` : "The finder is choosing a wager."}</p>{isAngel && <form onSubmit={(e) => { e.preventDefault(); onAction("wager", Number(wager)); }}><input type="number" min="0" value={wager} onChange={(e) => setWager(e.target.value)} required /><button>Lock wager</button></form>}</>}
      {questionPhase && activePour && <><h3>{activePour.is_angels_share ? "Angel’s Share" : activePour.category}</h3><p className="event-timer">{reveal ? "Answer revealed" : `${seconds ?? 0}s`}</p><h2>{activePour.question_text}</h2>{activePour.is_angels_share && <p>Wager: {game.angels_share_wager} points</p>}{reveal ? <p><strong>Answer:</strong> {activePour.correct_answer}</p> : myAnswer ? <p className="event-locked-answer">Your locked answer: {myAnswer.submitted_answer}</p> : (!activePour.is_angels_share || isAngel) ? <form onSubmit={(e) => { e.preventDefault(); onAction("answer", answer); setAnswer(""); }}><input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your answer" required /><button>Lock answer</button></form> : <p>Only the Angel’s Share finder may answer.</p>}</>}
      {phase === "round_intermission" && <><h3>{game.round_name === "single_cask" ? "Single Cask complete" : "Double Cask complete"}</h3><p>{game.round_name === "single_cask" ? "Double Cask is being prepared." : "Positive-score players are advancing to Cask Strength."}</p></>}
      {phase.startsWith("cask_strength") && <><h2>Cask Strength</h2><p>{game.cask_strength_subcategory}</p>{phase === "cask_strength_wager" && <p>Qualified players are locking their final wagers.</p>}{phase === "cask_strength_question" && <h3>{game.cask_strength_question_text}</h3>}{phase === "cask_strength_reveal" && <p>Final scores are being revealed.</p>}{phase === "cask_strength_complete" && <p>Rickhouse complete.  Session points have been awarded.</p>}</>}
      <h3>Rickhouse Scores</h3><ol>{standings.map((score: any) => <li key={score.player_id}>{score.player_name}: {score.score}</li>)}</ol>
    </section>
  );
}
