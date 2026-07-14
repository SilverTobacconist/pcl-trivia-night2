"use client";

import { useEffect, useRef, useState } from "react";

export default function PlayPage() {
  const [session, setSession] = useState<any>(null);
  const [player, setPlayer] = useState<any>(null);
  const [scoreboard, setScoreboard] = useState<any[]>([]);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [rickhouseGame, setRickhouseGame] = useState<any>(null);
  const [rickhousePours, setRickhousePours] = useState<any[]>([]);
  const [rickhousePicker, setRickhousePicker] = useState<any>(null);
  const [isRickhousePicker, setIsRickhousePicker] = useState(false);
  const [rickhouseScore, setRickhouseScore] = useState<number | null>(null);
  const [activeRickhousePour, setActiveRickhousePour] = useState<any>(null);
const [isAngelsSharePlayer, setIsAngelsSharePlayer] = useState(false);
const [maxAngelsShareWager, setMaxAngelsShareWager] = useState(0);
const [angelsShareWager, setAngelsShareWager] = useState("");
const [rickhouseStandings, setRickhouseStandings] = useState<any[]>([]);
const [proposedNextPicker, setProposedNextPicker] = useState<any>(null);
const [caskStrengthEntry, setCaskStrengthEntry] = useState<any>(null);
const [caskWager, setCaskWager] = useState("");
const [caskAnswer, setCaskAnswer] = useState("");
const [caskSecondsRemaining, setCaskSecondsRemaining] = useState<number | null>(null);
const caskWagerRef = useRef("");
const caskAnswerRef = useRef("");
const caskAutoSubmittedRef = useRef("");
  const currentQuestionIdRef = useRef<string | null>(null);
  const autoSubmittedQuestionIdRef = useRef<string | null>(null);
  const answerTextRef = useRef("");

  async function loadScoreboard(sessionIdOverride?: string) {
    const activeSessionId = sessionIdOverride || session?.id;
    if (!activeSessionId) return;

    const response = await fetch(`/api/scoreboard?sessionId=${activeSessionId}`);
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Could not load scoreboard");
      return;
    }

    setScoreboard(data.players);
  }

  async function loadRickhouseState(sessionId: string, playerId: string) {
    const response = await fetch(
      `/api/rickhouse/player-state?sessionId=${sessionId}&playerId=${playerId}`
    );
  
    const data = await response.json();
  
    if (!response.ok) {
      setRickhouseGame(null);
setRickhousePours([]);
setRickhousePicker(null);
setIsRickhousePicker(false);
setRickhouseScore(null);
setActiveRickhousePour(null);
setIsAngelsSharePlayer(false);
setMaxAngelsShareWager(0);
setRickhouseStandings([]);
setProposedNextPicker(null);
return;
    }
  
    setRickhouseGame(data.game);
    setRickhousePours(data.pours);
    setRickhousePicker(data.picker);
    setIsRickhousePicker(data.isCurrentPicker);
    setRickhouseScore(data.playerScore ?? 0);
    setActiveRickhousePour(data.activePour);
setIsAngelsSharePlayer(data.isAngelsSharePlayer);
setMaxAngelsShareWager(data.maxWager ?? 0);
setRickhouseStandings(data.standings || []);
setProposedNextPicker(data.proposedNextPicker || null);
setCaskStrengthEntry(data.caskStrengthEntry || null);
if (data.game?.cask_strength_ends_at) {
  setCaskSecondsRemaining(Math.max(0, Math.ceil((new Date(data.game.cask_strength_ends_at).getTime() - Date.now()) / 1000)));
} else setCaskSecondsRemaining(null);
  }

  function updateTimer(sessionData: any) {
    if (!sessionData?.question_ends_at) {
      setSecondsRemaining(null);
      return;
    }

    const endsAt = new Date(sessionData.question_ends_at).getTime();
    const now = Date.now();
    const remaining = Math.max(0, Math.ceil((endsAt - now) / 1000));

    setSecondsRemaining(remaining);
  }

  async function loadGame() {
    setError("");
    setMessage("");

    const params = new URLSearchParams(window.location.search);

    let sessionId = params.get("sessionId");
    let playerId = params.get("playerId");

    if (!sessionId || !playerId) {
      sessionId = localStorage.getItem("pcl_session_id");
      playerId = localStorage.getItem("pcl_player_id");
    }

    if (!sessionId || !playerId) {
      setError("Missing session or player information. Please join again.");
      return;
    }

    localStorage.setItem("pcl_session_id", sessionId);
    localStorage.setItem("pcl_player_id", playerId);

    const response = await fetch(
      `/api/player-game?sessionId=${sessionId}&playerId=${playerId}`
    );

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Could not load game.");
      return;
    }

    const newQuestionId = data.session.current_question_id;
    const previousQuestionId = currentQuestionIdRef.current;

    setSession(data.session);
    setPlayer(data.player);
    updateTimer(data.session);
    await loadScoreboard(data.session.id);
    await loadRickhouseState(data.session.id, data.player.id);

    if (newQuestionId !== previousQuestionId) {
      currentQuestionIdRef.current = newQuestionId;
      autoSubmittedQuestionIdRef.current = null;
      setSubmitted(false);
      setAnswerText("");
      answerTextRef.current = "";
    }
  }

  async function submitAnswer(answerToSubmit?: string) {
    if (!session?.id || !player?.id || !session?.current_question_id) {
      setError("Missing question or player information.");
      return;
    }

    const finalAnswer = String(answerTextRef.current ?? "");

    if (!finalAnswer.trim()) {
      setError("Please enter an answer before submitting.");
      return;
    }

    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const submitEndpoint =
  session.game_mode === "rickhouse"
    ? "/api/rickhouse/submit-answer"
    : "/api/submit-answer";

const response = await fetch(submitEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: String(session.id),
          playerId: String(player.id),
          questionId: String(session.current_question_id),
          submittedAnswer: finalAnswer,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.details
            ? `${data.error} Details: ${data.details}`
            : data.error || "Could not submit answer."
        );
        return;
      }

      setSubmitted(true);
      setMessage("Answer submitted.");
    } catch (error: any) {
      setError(error.message || "Could not submit answer.");
    } finally {
      setSubmitting(false);
    }
  }

  async function selectRickhousePour(pourId: string) {
    if (!rickhouseGame?.id || !player?.id) return;
  
    setError("");
  
    const response = await fetch("/api/rickhouse/select-pour", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gameId: rickhouseGame.id,
        pourId,
        playerId: player.id,
      }),
    });
  
    const data = await response.json();
  
    if (!response.ok) {
      setError(data.error || "Could not select pour.");
      return;
    }
  
    setRickhouseGame(data.game);
    await loadGame();
  }

  async function submitAngelsShareWager() {
    if (!rickhouseGame?.id || !player?.id) return;
  
    const wager = Number(angelsShareWager);
  
    if (Number.isNaN(wager) || wager < 0 || wager > maxAngelsShareWager) {
      setError(`Enter a wager between 0 and ${maxAngelsShareWager}.`);
      return;
    }
  
    setError("");
  
    const response = await fetch("/api/rickhouse/submit-wager", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gameId: rickhouseGame.id,
        playerId: player.id,
        wagerAmount: wager,
      }),
    });
  
    const data = await response.json();
  
    if (!response.ok) {
      setError(data.error || "Could not submit Angel's Share wager.");
      return;
    }
  
    setAngelsShareWager("");
    await loadGame();
  }

  useEffect(() => {
    loadGame();

    const interval = setInterval(() => {
      loadGame();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!session?.question_ends_at) return;

      updateTimer(session);
    }, 1000);

    return () => clearInterval(timer);
  }, [session?.question_ends_at]);

  useEffect(() => {
    if (secondsRemaining === null) return;
    if (secondsRemaining > 2) return;
    if (!session?.current_question_id) return;
    if (submitted || submitting) return;
    if (!answerTextRef.current.trim()) return;

    if (autoSubmittedQuestionIdRef.current === session.current_question_id) {
      return;
    }

    autoSubmittedQuestionIdRef.current = session.current_question_id;
    submitAnswer();
  }, [
    secondsRemaining,
    session?.current_question_id,
    submitted,
    submitting,
  ]);

  async function submitCaskWager(auto = false) {
    if (!rickhouseGame?.id || !player?.id || caskStrengthEntry?.wager !== null) return;
    const value = caskWagerRef.current.trim() === "" ? 0 : Number(caskWagerRef.current);
    const response = await fetch("/api/rickhouse/cask-strength/submit-wager", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({gameId:rickhouseGame.id, playerId:player.id, wager:value}) });
    const data=await response.json(); if(!response.ok){setError(data.error||"Could not submit wager.");return;} setMessage(auto?"Wager submitted when time expired.":"Wager submitted."); await loadRickhouseState(session.id,player.id);
  }

  async function submitCaskAnswer(auto = false) {
    if (!rickhouseGame?.id || !player?.id || caskStrengthEntry?.submitted_answer !== null) return;
    const response = await fetch("/api/rickhouse/cask-strength/submit-answer", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({gameId:rickhouseGame.id, playerId:player.id, answer:caskAnswerRef.current}) });
    const data=await response.json(); if(!response.ok){setError(data.error||"Could not submit answer.");return;} setMessage(auto?"Answer submitted when time expired.":"Answer submitted."); await loadRickhouseState(session.id,player.id);
  }

  useEffect(()=>{
    if (!rickhouseGame?.cask_strength_ends_at) return;
    const timer=setInterval(()=>setCaskSecondsRemaining(Math.max(0,Math.ceil((new Date(rickhouseGame.cask_strength_ends_at).getTime()-Date.now())/1000))),250);
    return ()=>clearInterval(timer);
  },[rickhouseGame?.cask_strength_ends_at]);

  useEffect(()=>{
    if (caskSecondsRemaining !== 0 || !caskStrengthEntry || !rickhouseGame) return;
    const key=`${rickhouseGame.id}:${rickhouseGame.game_phase}`;
    if(caskAutoSubmittedRef.current===key) return;
    caskAutoSubmittedRef.current=key;
    if(rickhouseGame.game_phase==="cask_strength_wager" && caskStrengthEntry.wager===null) submitCaskWager(true);
    if(rickhouseGame.game_phase==="cask_strength_question" && caskStrengthEntry.submitted_answer===null) submitCaskAnswer(true);
  },[caskSecondsRemaining, rickhouseGame?.game_phase, caskStrengthEntry?.id]);

  return (
    <main style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>PCL Trivia Night</h1>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {message && <p style={{ color: "green" }}>{message}</p>}

      {session && player && (
        <>
          <p>
            <strong>Player:</strong> {player.display_name}
          </p>

          <p>
  <strong>Session Score:</strong> {player.score} pts
</p>

{rickhouseGame && (
  <p>
    <strong>Rickhouse Score:</strong> {rickhouseScore ?? 0} pts
  </p>
)}

          <p>
            <strong>Session:</strong> {session.session_code}
          </p>

          {rickhouseGame?.game_phase?.startsWith("cask_strength") && (
            <section style={{marginTop:"2rem",padding:"1.25rem",border:"2px solid #5b3511",borderRadius:"10px",background:"#fff8dc"}}>
              <h2>Cask Strength</h2>
              {!caskStrengthEntry ? <><p>Only players with a positive Rickhouse score qualify.</p><p><strong>Your status:</strong> Eliminated</p><p>Watch the final round on the communal display.</p></> : <>
                <p><strong>Subcategory:</strong> {rickhouseGame.cask_strength_subcategory}</p>
                <h3>Current Rickhouse Scores</h3>
                <ol>{rickhouseStandings.map((score)=><li key={score.player_id}>{score.player_name} — {score.score} pts</li>)}</ol>
                {rickhouseGame.game_phase === "cask_strength_wager" && <>
                  <p><strong>Time:</strong> {caskSecondsRemaining ?? 30} seconds</p>
                  <p>Your maximum wager is {caskStrengthEntry.starting_score}.</p>
                  <input type="number" min="0" max={caskStrengthEntry.starting_score} value={caskWager} disabled={caskStrengthEntry.wager!==null} onChange={(e)=>{setCaskWager(e.target.value);caskWagerRef.current=e.target.value;}} style={{padding:"0.75rem",width:"100%",marginBottom:"0.75rem"}} />
                  <button type="button" disabled={caskStrengthEntry.wager!==null} onClick={()=>submitCaskWager(false)}>Submit Wager</button>
                  {caskStrengthEntry.wager!==null && <p>Wager submitted.</p>}
                </>}
                {rickhouseGame.game_phase === "cask_strength_question" && <>
                  <p><strong>Time:</strong> {caskSecondsRemaining ?? 30} seconds</p>
                  <div style={{padding:"1rem",border:"1px solid #aaa",borderRadius:"8px",fontWeight:"bold"}}>{rickhouseGame.cask_strength_question_text}</div>
                  <textarea value={caskAnswer} disabled={caskStrengthEntry.submitted_answer!==null} onChange={(e)=>{setCaskAnswer(e.target.value);caskAnswerRef.current=e.target.value;}} style={{width:"100%",minHeight:"90px",marginTop:"1rem",padding:"0.75rem"}} />
                  <button type="button" disabled={caskStrengthEntry.submitted_answer!==null} onClick={()=>submitCaskAnswer(false)}>Submit Answer</button>
                  {caskStrengthEntry.submitted_answer!==null && <p>Answer submitted.</p>}
                </>}
                {["cask_strength_grading","cask_strength_reveal"].includes(rickhouseGame.game_phase) && <p>Your answer is locked. Watch the communal display for the reveal.</p>}
                {rickhouseGame.game_phase === "cask_strength_complete" && <p><strong>Rickhouse Trivia is complete.</strong></p>}
              </>}
            </section>
          )}

          {rickhouseGame?.game_phase === "angels_wager" && (
  <section
    style={{
      marginTop: "2rem",
      padding: "1rem",
      border: "2px solid #8a5a00",
      borderRadius: "8px",
      background: "#fff8dc",
    }}
  >
    <h2>Angel’s Share</h2>

    {isAngelsSharePlayer ? (
      <>
        <p>
          You found the Angel’s Share.
        </p>

        <p>
          <strong>Category:</strong> {activeRickhousePour?.category}
        </p>

        <p>
          <strong>Rickhouse Score:</strong> {rickhouseScore ?? 0} pts
        </p>

        <p>
          <strong>Maximum Wager:</strong> {maxAngelsShareWager} pts
        </p>

        <input
          value={angelsShareWager}
          onChange={(event) => setAngelsShareWager(event.target.value)}
          placeholder="Enter wager"
          type="number"
          min="0"
          max={maxAngelsShareWager}
          style={{
            width: "100%",
            padding: "0.75rem",
            fontSize: "1rem",
            marginBottom: "1rem",
          }}
        />

        <button
          type="button"
          onClick={submitAngelsShareWager}
          style={{
            background: "#8a5a00",
            color: "white",
            padding: "0.75rem 1.25rem",
            border: "none",
            borderRadius: "6px",
            cursor: "pointer",
          }}
        >
          Submit Wager
        </button>
      </>
    ) : (
      <>
        <p>
          {rickhousePicker?.display_name ?? "The picker"} found the Angel’s Share.
        </p>
        <p>Waiting for their wager...</p>
      </>
    )}
  </section>
)}

{rickhouseGame?.game_phase === "round_intermission" && (
  <section
    style={{
      marginTop: "2rem",
      padding: "1.25rem",
      border: "2px solid #8a5a00",
      borderRadius: "8px",
      background: "#fff8dc",
    }}
  >
    {rickhouseGame.round_name === "single_cask" ? (
      <>
        <h2>Single Cask Complete</h2>
        <p>Double Cask is being prepared.</p>
        <p>
          <strong>Proposed first picker:</strong>{" "}
          {proposedNextPicker?.display_name || "Waiting for host"}
        </p>
      </>
    ) : (
      <>
        <h2>Double Cask Complete</h2>
        <p>Cask Strength is being prepared.</p>
        <p>
          Only players with a positive Rickhouse score qualify.
        </p>
        <p>
          <strong>Your status:</strong>{" "}
          {(rickhouseScore ?? 0) > 0 ? "Qualified" : "Eliminated"}
        </p>
      </>
    )}

    <ol>
      {rickhouseStandings.map((score) => (
        <li key={score.player_id || score.id}>
          {score.player_name} - {score.score} pts
          {rickhouseGame.round_name === "double_cask"
            ? score.score > 0
              ? " — Qualified"
              : " — Eliminated"
            : ""}
        </li>
      ))}
    </ol>
  </section>
)}

{rickhouseGame &&
  !session.current_question_text &&
  rickhouseGame.game_phase !== "angels_wager" &&
  rickhouseGame.game_phase !== "round_intermission" &&
  !rickhouseGame.game_phase?.startsWith("cask_strength") && (
  <section
    style={{
      marginTop: "2rem",
      padding: "1rem",
      border: "1px solid #ccc",
      borderRadius: "8px",
    }}
  >
    {isRickhousePicker ? (
      <h2>You are selecting the next pour.</h2>
    ) : (
      <h2>
        Waiting for {rickhousePicker?.display_name ?? "the picker"} to select.
      </h2>
    )}

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: "0.4rem",
        marginTop: "1rem",
        overflowX: "auto",
      }}
    >
      {[0, 1, 2, 3, 4].map((columnIndex) => {
        const columnPours = rickhousePours.filter(
          (pour) => pour.column_index === columnIndex
        );

        const categoryName =
          columnPours[0]?.category || `Category ${columnIndex + 1}`;

        return (
          <div key={columnIndex}>
            <div
              style={{
                background: "#222",
                color: "white",
                padding: "0.5rem",
                fontWeight: "bold",
                fontSize: "0.8rem",
                minHeight: "50px",
              }}
            >
              {categoryName}
            </div>

            {columnPours.map((pour) => (
              <button
                key={pour.id}
                type="button"
                onClick={() => selectRickhousePour(pour.id)}
                disabled={!isRickhousePicker || pour.is_used}
                style={{
                  width: "100%",
                  minHeight: "48px",
                  marginTop: "0.25rem",
                  border: "1px solid #ccc",
                  background: pour.is_used
                    ? "#ddd"
                    : isRickhousePicker
                    ? "#111"
                    : "#f3f3f3",
                  color: pour.is_used
                    ? "#888"
                    : isRickhousePicker
                    ? "white"
                    : "#333",
                  cursor:
                    !isRickhousePicker || pour.is_used
                      ? "not-allowed"
                      : "pointer",
                  fontWeight: "bold",
                }}
              >
                {pour.is_used ? "" : pour.point_value}
              </button>
            ))}
          </div>
        );
      })}
    </div>
  </section>
)}

          {!rickhouseGame?.game_phase?.startsWith("cask_strength") && session.current_question_text ? (
            <>
              <p>
                <strong>Category:</strong> {session.current_category}
              </p>

              <p>
                <strong>Time:</strong>{" "}
                {secondsRemaining === null
                  ? "No timer"
                  : secondsRemaining > 0
                  ? `${secondsRemaining} seconds`
                  : "Time's up"}
              </p>

              <p>
                <strong>Question:</strong>
              </p>

              <div
                style={{
                  border: "1px solid #ccc",
                  padding: "1rem",
                  borderRadius: "8px",
                  marginBottom: "1rem",
                }}
              >
                {session.current_question_text}
              </div>

              <textarea
                value={answerText}
                onChange={(event) => {
                  setAnswerText(event.target.value);
                  answerTextRef.current = event.target.value;
                }}
                disabled={submitted || submitting || secondsRemaining === 0}
                placeholder="Type your answer..."
                style={{
                  width: "100%",
                  minHeight: "90px",
                  padding: "0.75rem",
                  fontSize: "1rem",
                  marginBottom: "1rem",
                }}
              />

              <button
                type="button"
                onClick={() => submitAnswer()}
                disabled={
                  submitting ||
                  submitted ||
                  !answerText.trim() ||
                  secondsRemaining === 0
                }
                style={{
                  background:
                    submitted || submitting || secondsRemaining === 0
                      ? "#777"
                      : "#111",
                  color: "white",
                  padding: "0.75rem 1.25rem",
                  border: "none",
                  borderRadius: "6px",
                  cursor:
                    submitted || submitting || secondsRemaining === 0
                      ? "not-allowed"
                      : "pointer",
                  marginRight: "0.5rem",
                  opacity:
                    submitted || submitting || secondsRemaining === 0 ? 0.7 : 1,
                }}
              >
                {submitting
                  ? "Submitting..."
                  : submitted
                  ? "Submitted"
                  : secondsRemaining === 0
                  ? "Time's Up"
                  : "Submit Answer"}
              </button>
            </>
          ) : !rickhouseGame?.game_phase?.startsWith("cask_strength") ? (
            <p>Waiting for question...</p>
          ) : null}

          <button
            type="button"
            onClick={loadGame}
            style={{
              marginTop: "1rem",
              background: "#333",
              color: "white",
              padding: "0.75rem 1.25rem",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Refresh
          </button>

          <h3 style={{ marginTop: "2rem" }}>Scoreboard</h3>

          {scoreboard.length === 0 ? (
            <p>No scoreboard loaded yet.</p>
          ) : (
            <ol>
              {scoreboard.map((player) => (
                <li key={player.id}>
                  {player.display_name} - {player.score} pts
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </main>
  );
}