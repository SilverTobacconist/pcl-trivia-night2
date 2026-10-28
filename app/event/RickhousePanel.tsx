"use client";

import { useEffect, useState } from "react";

export default function RickhousePanel({ rickhouse, playerId, isDecision, onAction }: { rickhouse: any; playerId: string; isDecision: boolean; onAction: (action: string, value?: any) => void }) {
  const [answer, setAnswer] = useState("");
  const [wager, setWager] = useState("");
  const [now, setNow] = useState(Date.now());
  const { game, pours = [], standings = [], activePour, myAnswer, myScore, myCaskEntry, caskEntries = [] } = rickhouse;
  const phase = game.game_phase;
  const isPicker = game.current_picker_player_id === playerId;
  const isAngel = game.angels_share_player_id === playerId;
  const seconds = activePour?.selected_at && ["question", "angels_question", "angels_wager"].includes(phase)
    ? Math.max(0, Math.ceil((new Date(activePour.selected_at).getTime() + 30000 - now) / 1000)) : null;
  const caskEndsAt = phase === "cask_strength_vote" ? game.cask_strength_vote_ends_at : game.cask_strength_ends_at;
  const caskSeconds = caskEndsAt && ["cask_strength_vote", "cask_strength_wager", "cask_strength_question"].includes(phase)
    ? Math.max(0, Math.ceil((new Date(caskEndsAt).getTime() - now) / 1000)) : null;
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(timer); }, []);
  const controllerCountdown = game.controller_idle_countdown_at ? Math.max(0,Math.ceil((new Date(game.controller_idle_countdown_at).getTime()+5000-now)/1000)) : null;
  useEffect(() => { setAnswer(""); setWager(""); }, [game.current_pour_id, phase]);
  const columns = Array.from({ length: 5 }, (_, column) => pours.filter((pour: any) => pour.column_index === column).sort((a: any, b: any) => a.row_index - b.row_index));
  const board = (
    <><p className="rickhouse-swipe">Swipe across the board to view every category →</p><div className="rickhouse-board">
      {columns.map((column, index) => (
        <div key={index} className="rickhouse-column">
          <strong>{column[0]?.category || "Category"}</strong>
          {column.map((pour: any) => (
            <button key={pour.id} disabled={!isPicker || pour.is_used || phase !== "board"} onClick={() => onAction("pick", pour.id)} className={pour.is_used ? "rickhouse-used" : ""}>
              {pour.is_used ? "✓" : `${pour.point_value}`}
            </button>
          ))}
        </div>
      ))}
    </div></>
  );
  const reveal = ["pour_reveal", "angels_reveal"].includes(phase);
  const questionPhase = ["question", "angels_question", "pour_reveal", "angels_reveal"].includes(phase);
  const cask = phase.startsWith("cask_strength") ? (
    <><h2>Cask Strength</h2><p className="event-kicker">Category · {game.cask_strength_subcategory}</p>{!myCaskEntry ? <p>Only positive-score players qualified for Cask Strength.</p> : <>
      {phase === "cask_strength_vote" && <><p className="event-timer">{caskSeconds ?? 0}s</p><h3>Vote for the final-question difficulty</h3><p>Keep the category in mind before you vote.</p>{["Easy","Medium","Hard","Extra Hard"].map((difficulty)=><button key={difficulty} onClick={()=>onAction("cask_vote",difficulty)}>{difficulty}</button>)}</>}
      {phase === "cask_strength_wager" && <><p className="event-kicker">Difficulty · {game.cask_strength_difficulty}</p><p className="event-timer">{caskSeconds ?? 0}s</p>{caskSeconds !== null && caskSeconds <= 5 && <p className="event-warning">Final seconds — lock your wager.</p>}{myCaskEntry.wager === null ? <form onSubmit={(e) => { e.preventDefault(); onAction("cask_wager", Number(wager)); }}><p>Your score: {myCaskEntry.starting_score}.  Wager any amount up to that score.</p><p className="event-warning">An incorrect or unanswered wager loses these points.</p><input aria-label="Your final wager" type="number" min="0" max={myCaskEntry.starting_score} value={wager} onChange={(e) => setWager(e.target.value)} required /><button>Lock final wager</button></form> : <p className="event-locked-answer">Your wager: {myCaskEntry.wager}</p>}</>}
      {phase === "cask_strength_question" && <><p className="event-timer">{caskSeconds ?? 0}s</p>{caskSeconds !== null && caskSeconds <= 5 && <p className="event-warning">Final seconds — lock your answer.</p>}<h3>{game.cask_strength_question_text}</h3>{myCaskEntry.submitted_answer === null ? <form onSubmit={(e) => { e.preventDefault(); onAction("cask_answer", answer); setAnswer(""); }}><input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your final answer" required /><button>Lock answer</button></form> : <p className="event-locked-answer">Your final answer: {myCaskEntry.submitted_answer}</p>}</>}
      {phase === "cask_strength_reveal" && <><p><strong>Your final answer:</strong> {myCaskEntry.submitted_answer || "No answer"}</p><p className={myCaskEntry.is_correct ? "event-result-correct" : "event-result-wrong"}>{myCaskEntry.is_correct ? "Correct" : "Incorrect"}</p>{!myCaskEntry.is_correct && myCaskEntry.submitted_answer && <button onClick={() => onAction("dispute")}>Dispute this answer</button>}<p>Final standings are being revealed.</p></>}
      {phase === "cask_strength_final_leaderboard" && <><h3>Final Rickhouse leaderboard</h3></>}
      {phase === "cask_strength_complete" && <div className="trivia-champion"><p>Trivia Tuesday Champion</p><h2>{caskEntries.slice().sort((a:any,b:any)=>Number(b.final_score||0)-Number(a.final_score||0))[0]?.player_name}</h2><strong>{caskEntries.slice().sort((a:any,b:any)=>Number(b.final_score||0)-Number(a.final_score||0))[0]?.final_score} points</strong><p>{caskEntries.slice().sort((a:any,b:any)=>Number(b.final_score||0)-Number(a.final_score||0)).slice(1,3).map((entry:any,index:number)=>`${index+2}. ${entry.player_name} · ${entry.final_score}`).join("  |  ")}</p><p>Thanks for playing Trivia Tuesday.</p></div>}
    </>}</>
  ) : null;
  return (
    <section className="event-card">
      <h2>Rickhouse Trivia · {String(game.round_name).replaceAll("_", " ")}</h2>
      {phase === "board" && <><p>{isPicker ? "Your pick · choose a pour." : "Another player is choosing the next pour."}</p>{controllerCountdown !== null && <p className="event-timer">No selection yet — control changes in {controllerCountdown}s.</p>}{board}</>}
      {phase === "angels_wager" && <><h3>Angel’s Share · {activePour?.category || "Rickhouse"}</h3>{isAngel ? <><p className="event-timer">{seconds ?? 0}s</p>{seconds !== null && seconds <= 10 && <p className="event-warning">Final seconds — an unentered wager becomes 0.</p>}<p>You found it.  Wager up to {Math.max(Number(myScore || 0), game.round_name === "double_cask" ? 2000 : 1000)} points.</p><p className="event-warning">An incorrect or unanswered wager loses these points.</p><form onSubmit={(e) => { e.preventDefault(); onAction("wager", Number(wager)); }}><input aria-label="Your wager" type="number" min="0" value={wager} onChange={(e) => setWager(e.target.value)} required /><button>Lock wager</button></form></> : <p>The finder is choosing a wager.</p>}</>}
      {questionPhase && activePour && <><h3>{activePour.is_angels_share ? "Angel’s Share" : `${activePour.category} · ${activePour.point_value}`}</h3><p className="event-timer">{reveal ? "Answer revealed" : `${seconds ?? 0}s`}</p><h2>{activePour.question_text}</h2>{activePour.is_angels_share && <p>Wager: {game.angels_share_wager} points</p>}{reveal ? <><p><strong>Answer:</strong> {activePour.correct_answer}</p>{myAnswer && <p className={myAnswer.is_correct ? "event-result-correct" : "event-result-wrong"}>{myAnswer.is_correct ? `Correct · +${myAnswer.points_awarded}` : activePour.is_angels_share ? `Incorrect · ${myAnswer.points_awarded}` : "Incorrect · 0"}</p>}{myAnswer && !myAnswer.is_correct && myAnswer.submitted_answer && <button onClick={() => onAction("dispute")}>Dispute this answer</button>}</> : myAnswer ? <p className="event-locked-answer">Answer locked: {myAnswer.submitted_answer}</p> : (!activePour.is_angels_share || isAngel) ? <form onSubmit={(e) => { e.preventDefault(); onAction("answer", answer); setAnswer(""); }}><input value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Your answer" required /><button>Lock answer</button></form> : <p>Only the Angel’s Share finder may answer.</p>}</>}
      {phase === "round_intermission" && <><h3>{game.round_name === "single_cask" ? "Single Cask complete" : "Double Cask complete"}</h3><p>{game.round_name === "single_cask" ? "Double Cask is being prepared." : "Positive-score players are advancing to Cask Strength."}</p></>}
      {cask}
      <h3>Rickhouse Scores</h3><ol>{standings.map((score: any) => <li key={score.player_id}>{score.player_name}: {score.score}</li>)}</ol>
    </section>
  );
}
