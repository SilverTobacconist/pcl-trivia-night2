"use client";

import { useEffect, useState } from "react";

export default function RickhouseDisplayPage() {
  const [sessionCode, setSessionCode] = useState("");
  const [session, setSession] = useState<any>(null);
  const [game, setGame] = useState<any>(null);
  const [pours, setPours] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [picker, setPicker] = useState<any>(null);
  const [activePour, setActivePour] = useState<any>(null);
  const [proposedNextPicker, setProposedNextPicker] = useState<any>(null);
  const [caskStrength, setCaskStrength] = useState<any[]>([]);
  const [error, setError] = useState("");

  async function loadSession() {
    setError("");

    const response = await fetch(
      `/api/session-by-code?sessionCode=${sessionCode}`
    );

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Could not load session.");
      return;
    }

    setSession(data.session);
    await loadRickhouse(data.session.id);
  }

  async function loadRickhouse(sessionId: string) {
    const response = await fetch(
      `/api/rickhouse/current?sessionId=${sessionId}`
    );

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Could not load Rickhouse board.");
      return;
    }

    setGame(data.game);
    setPours(data.pours);
    setPicker(data.picker);
    setActivePour(data.activePour);
    setProposedNextPicker(data.proposedNextPicker || null);
    setScores(data.standings || []);
    setCaskStrength(data.caskStrength || []);
    await loadRickhouseScores(data.game.id);
  }

  async function loadRickhouseScores(gameId: string) {
    const response = await fetch(`/api/rickhouse/scores?gameId=${gameId}`);
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Could not load Rickhouse scores.");
      return;
    }

    setScores(data.scores);
  }

  useEffect(() => {
    if (!session?.id) return;

    const interval = setInterval(() => {
      loadRickhouse(session.id);
    }, 5000);

    return () => clearInterval(interval);
  }, [session?.id]);

  const showBoard = game
    ? game.game_phase === "board" || !game.game_phase
    : false;

  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "2rem",
        fontFamily: "Arial, sans-serif",
        background:
          "radial-gradient(circle at top left, #4b3516 0%, #1c1c1c 38%, #070707 100%)",
        color: "white",
        textAlign: "center",
      }}
    >
      {!session && (
        <>
          <h1>Rickhouse Trivia</h1>

          <input
            value={sessionCode}
            onChange={(event) => setSessionCode(event.target.value)}
            placeholder="Session code"
            style={{
              padding: "0.9rem",
              fontSize: "1.5rem",
              borderRadius: "10px",
              border: "none",
              background: "white",
              color: "#111",
              marginRight: "0.5rem",
            }}
          />

          <button
            type="button"
            onClick={loadSession}
            style={{
              background: "#c28a2e",
              color: "white",
              padding: "0.95rem 1.35rem",
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              fontWeight: "bold",
            }}
          >
            Load Rickhouse Board
          </button>
        </>
      )}

      {error && <p style={{ color: "#ff9a9a" }}>Error: {error}</p>}

      {session && game && (
        <>
          {game.game_phase === "question" && (
            <section
              style={{
                maxWidth: "1200px",
                margin: "5vh auto 0",
                background: "rgba(255,255,255,0.96)",
                color: "#111",
                borderRadius: "24px",
                padding: "clamp(2rem, 5vw, 4rem)",
                boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
                border: "3px solid #c28a2e",
              }}
            >
              <div
                style={{
                  fontSize: "clamp(2.5rem, 6vw, 5rem)",
                  fontWeight: "bold",
                  color: "#8a5a00",
                  textTransform: "uppercase",
                }}
              >
                {activePour?.category ?? "Rickhouse Pour"}
              </div>

              <p style={{ fontSize: "clamp(1.5rem, 3vw, 2.5rem)" }}>
                <strong>{activePour?.point_value}</strong> pts
              </p>

              <div
                style={{
                  marginTop: "2rem",
                  fontSize: "clamp(2rem, 5vw, 4rem)",
                  lineHeight: "1.15",
                  fontWeight: "bold",
                }}
              >
                {activePour?.question_text}
              </div>
            </section>
          )}

          {game.game_phase === "pour_reveal" &&
            (() => {
              const result = game.last_pour_result
                ? JSON.parse(game.last_pour_result)
                : null;

              return (
                <section
                  style={{
                    maxWidth: "1200px",
                    margin: "5vh auto 0",
                    background: "rgba(255,255,255,0.96)",
                    color: "#111",
                    borderRadius: "24px",
                    padding: "clamp(2rem, 5vw, 4rem)",
                    boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
                    border: "3px solid #c28a2e",
                  }}
                >
                  <div
                    style={{
                      fontSize: "clamp(2.5rem, 6vw, 5rem)",
                      fontWeight: "bold",
                      color: "#8a5a00",
                      textTransform: "uppercase",
                    }}
                  >
                    Correct Answer
                  </div>

                  <div
                    style={{
                      marginTop: "1rem",
                      fontSize: "clamp(2.5rem, 6vw, 5rem)",
                      fontWeight: "bold",
                    }}
                  >
                    {result?.correctAnswer ?? "Unknown"}
                  </div>

                  <p
                    style={{
                      fontSize: "clamp(1.25rem, 2.5vw, 2rem)",
                      marginTop: "2rem",
                    }}
                  >
                    Next picker:{" "}
                    <strong>{picker?.display_name ?? "Current picker"}</strong>
                  </p>

                  <p
                    style={{
                      fontSize: "clamp(1rem, 2vw, 1.5rem)",
                      marginTop: "2rem",
                    }}
                  >
                    Waiting for host to continue Rickhouse Trivia...
                  </p>
                </section>
              );
            })()}

          {game.game_phase === "angels_wager" && (
            <section
              style={{
                maxWidth: "1100px",
                margin: "6vh auto 0",
                background:
                  "linear-gradient(135deg, rgba(194,138,46,0.98), rgba(255,210,119,0.92))",
                color: "#111",
                borderRadius: "24px",
                padding: "clamp(2rem, 5vw, 4rem)",
                boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
                border: "3px solid #ffd277",
              }}
            >
              <div
                style={{
                  fontSize: "clamp(3rem, 8vw, 6rem)",
                  fontWeight: "bold",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                Angel’s Share
              </div>

              <p style={{ fontSize: "clamp(1.5rem, 3vw, 2.5rem)" }}>
                <strong>{picker?.display_name ?? "The picker"}</strong> found
                the Angel’s Share.
              </p>

              <p style={{ fontSize: "clamp(1.25rem, 2.5vw, 2rem)" }}>
                Category: <strong>{activePour?.category ?? "Unknown"}</strong>
              </p>

              <p
                style={{
                  fontSize: "clamp(1.25rem, 2.5vw, 2rem)",
                  marginTop: "2rem",
                }}
              >
                {picker?.display_name ?? "The player"} is having a drink while
                deciding on a wager...
              </p>

              <div
                style={{
                  marginTop: "2rem",
                  paddingTop: "1.5rem",
                  borderTop: "2px solid rgba(17,17,17,0.35)",
                }}
              >
                <div
                  style={{
                    fontSize: "clamp(1.4rem, 3vw, 2.4rem)",
                    fontWeight: "bold",
                    marginBottom: "1rem",
                  }}
                >
                  Current Rickhouse Standings
                </div>
                <ol
                  style={{
                    maxWidth: "650px",
                    margin: "0 auto",
                    textAlign: "left",
                    fontSize: "clamp(1.1rem, 2vw, 1.7rem)",
                  }}
                >
                  {scores.map((score) => (
                    <li
                      key={score.player_id || score.id}
                      style={{ marginBottom: "0.45rem" }}
                    >
                      <strong>{score.player_name}</strong> — {score.score} pts
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          )}

          {game.game_phase === "angels_question" && (
            <section
              style={{
                maxWidth: "1200px",
                margin: "5vh auto 0",
                background: "rgba(255,255,255,0.96)",
                color: "#111",
                borderRadius: "24px",
                padding: "clamp(2rem, 5vw, 4rem)",
                boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
                border: "3px solid #c28a2e",
              }}
            >
              <div
                style={{
                  fontSize: "clamp(2.5rem, 7vw, 5rem)",
                  fontWeight: "bold",
                  color: "#8a5a00",
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                }}
              >
                Angel’s Share
              </div>

              <p style={{ fontSize: "clamp(1.5rem, 3vw, 2.5rem)" }}>
                <strong>{picker?.display_name ?? "The player"}</strong> wagered{" "}
                <strong>{game.angels_share_wager}</strong> pts
              </p>

              <p style={{ fontSize: "clamp(1.25rem, 2.5vw, 2rem)" }}>
                Category: <strong>{activePour?.category ?? "Unknown"}</strong>
              </p>

              <div
                style={{
                  marginTop: "2rem",
                  fontSize: "clamp(2rem, 5vw, 4rem)",
                  lineHeight: "1.15",
                  fontWeight: "bold",
                }}
              >
                {activePour?.question_text}
              </div>
            </section>
          )}

          {game.game_phase === "angels_reveal" &&
            (() => {
              const result = game.angels_share_result
                ? JSON.parse(game.angels_share_result)
                : null;

              return (
                <section
                  style={{
                    maxWidth: "1200px",
                    margin: "5vh auto 0",
                    background: result?.isCorrect
                      ? "linear-gradient(135deg, #d9f7d9, #ffffff)"
                      : "linear-gradient(135deg, #ffd9d9, #ffffff)",
                    color: "#111",
                    borderRadius: "24px",
                    padding: "clamp(2rem, 5vw, 4rem)",
                    boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
                    border: "3px solid #c28a2e",
                  }}
                >
                  <div
                    style={{
                      fontSize: "clamp(2.5rem, 7vw, 5rem)",
                      fontWeight: "bold",
                      color: "#8a5a00",
                      textTransform: "uppercase",
                      letterSpacing: "0.1em",
                    }}
                  >
                    Angel’s Share
                  </div>

                  <p style={{ fontSize: "clamp(1.5rem, 3vw, 2.5rem)" }}>
                    <strong>{picker?.display_name ?? "The player"}</strong>{" "}
                    wagered <strong>{game.angels_share_wager}</strong> pts
                  </p>

                  <p style={{ fontSize: "clamp(1.5rem, 3vw, 2.5rem)" }}>
                    Answered: <strong>{result?.answer || "No answer"}</strong>
                  </p>

                  <div
                    style={{
                      fontSize: "clamp(3rem, 8vw, 6rem)",
                      fontWeight: "bold",
                      color: result?.isCorrect ? "#006b2e" : "#9b0000",
                      marginTop: "1rem",
                    }}
                  >
                    {result?.isCorrect ? "Correct" : "Incorrect"}
                  </div>

                  <div
                    style={{
                      fontSize: "clamp(2rem, 5vw, 4rem)",
                      fontWeight: "bold",
                      marginTop: "1rem",
                    }}
                  >
                    {result?.pointsAwarded > 0 ? "+" : ""}
                    {result?.pointsAwarded ?? 0} pts
                  </div>

                  <p
                    style={{
                      fontSize: "clamp(1rem, 2vw, 1.5rem)",
                      marginTop: "2rem",
                    }}
                  >
                    Waiting for host to continue Rickhouse Trivia...
                  </p>
                </section>
              );
            })()}

          {game.game_phase?.startsWith("cask_strength") && (
            <section style={{maxWidth:"1500px",margin:"4vh auto 0",background:"rgba(255,255,255,0.96)",color:"#111",borderRadius:"24px",padding:"clamp(2rem,4vw,3.5rem)",border:"3px solid #c28a2e"}}>
              <div style={{fontSize:"clamp(2.5rem,6vw,5rem)",fontWeight:"bold",color:"#8a5a00",textTransform:"uppercase"}}>Cask Strength</div>
              {game.game_phase === "cask_strength_wager" && <>
                <p style={{fontSize:"clamp(1.4rem,3vw,2.4rem)"}}>Subcategory: <strong>{game.cask_strength_subcategory}</strong></p>
                <p style={{fontSize:"clamp(1.1rem,2vw,1.6rem)"}}>{caskStrength.filter(e=>e.wager!==null).length} of {caskStrength.length} wagers submitted. Wager amounts remain hidden.</p>
              </>}
              {game.game_phase === "cask_strength_question" && <>
                <p style={{fontSize:"clamp(1.4rem,3vw,2.4rem)"}}>Subcategory: <strong>{game.cask_strength_subcategory}</strong></p>
                <div style={{fontSize:"clamp(2rem,5vw,4rem)",fontWeight:"bold",lineHeight:1.15,marginTop:"2rem"}}>{game.cask_strength_question_text}</div>
                <p style={{fontSize:"clamp(1.1rem,2vw,1.6rem)"}}>{caskStrength.filter(e=>e.submitted_answer!==null).length} of {caskStrength.length} answers submitted.</p>
              </>}
              {game.game_phase === "cask_strength_grading" && <><h2>Answers Locked</h2><p>The host is grading Cask Strength.</p></>}
              {game.game_phase === "cask_strength_reveal" && <>
                <h2>Final Reveal</h2>
                {caskStrength.filter(e=>e.is_revealed).slice(-1).map(entry=><div key={entry.id} style={{padding:"1.5rem",margin:"1rem auto",maxWidth:"850px",border:"2px solid #8a5a00",borderRadius:"14px"}}>
                  <div style={{fontSize:"clamp(2rem,5vw,4rem)",fontWeight:"bold"}}>{entry.player_name}</div>
                  <p style={{fontSize:"clamp(1.2rem,2.5vw,2rem)"}}>Wager: <strong>{entry.wager}</strong> • Answer: <strong>{entry.submitted_answer || "No answer"}</strong></p>
                  <div style={{fontSize:"clamp(2rem,5vw,4rem)",fontWeight:"bold",color:entry.is_correct?"#006b2e":"#9b0000"}}>{entry.is_correct?"Correct":"Incorrect"}</div>
                  <p style={{fontSize:"clamp(1.5rem,3vw,2.5rem)"}}>Updated score: <strong>{entry.final_score}</strong></p>
                </div>)}
              </>}
              {game.game_phase === "cask_strength_complete" && <><h2>Rickhouse Complete</h2><p>Final scores and session points have been awarded.</p></>}
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:"1rem",marginTop:"2rem",textAlign:"left"}}>
                {[...caskStrength].sort((a,b)=>Number((b.is_revealed?b.final_score:b.starting_score))-Number((a.is_revealed?a.final_score:a.starting_score))).map(entry=><div key={entry.id} style={{padding:"1rem",border:"1px solid #aaa",borderRadius:"10px",background:"white"}}><strong>{entry.player_name}</strong><br/>{entry.is_revealed ? entry.final_score : entry.starting_score} pts {entry.is_revealed ? "" : "(current)"}</div>)}
              </div>
            </section>
          )}

          {game.game_phase === "round_intermission" && (
            <section
              style={{
                maxWidth: "1100px",
                margin: "6vh auto 0",
                background: "rgba(255,255,255,0.96)",
                color: "#111",
                borderRadius: "24px",
                padding: "clamp(2rem, 5vw, 4rem)",
                boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
                border: "3px solid #c28a2e",
              }}
            >
              <div
                style={{
                  fontSize: "clamp(2.5rem, 6vw, 5rem)",
                  fontWeight: "bold",
                  color: "#8a5a00",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                }}
              >
                {game.round_name === "single_cask"
                  ? "Single Cask Complete"
                  : "Double Cask Complete"}
              </div>

              <p style={{ fontSize: "clamp(1.2rem, 2.5vw, 2rem)" }}>
                {game.round_name === "single_cask"
                  ? "Double Cask is being prepared."
                  : "Cask Strength is being prepared."}
              </p>

              <div
                style={{
                  maxWidth: "700px",
                  margin: "2rem auto",
                  textAlign: "left",
                  fontSize: "clamp(1.1rem, 2vw, 1.7rem)",
                }}
              >
                <ol>
                  {scores.map((score) => (
                    <li key={score.player_id || score.id} style={{ marginBottom: "0.75rem" }}>
                      <strong>{score.player_name}</strong> — {score.score} pts
                      {game.round_name === "double_cask"
                        ? score.score > 0
                          ? " — Qualified"
                          : " — Eliminated"
                        : ""}
                    </li>
                  ))}
                </ol>
              </div>

              {game.round_name === "single_cask" ? (
                <p style={{ fontSize: "clamp(1.2rem, 2.5vw, 2rem)" }}>
                  Proposed first picker:{" "}
                  <strong>
                    {proposedNextPicker?.display_name || "Waiting for host"}
                  </strong>
                </p>
              ) : (
                <p style={{ fontSize: "clamp(1.2rem, 2.5vw, 2rem)" }}>
                  Only players with a positive Rickhouse score advance to Cask Strength.
                </p>
              )}
            </section>
          )}

          {showBoard && (
            <>
              <h1
                style={{
                  fontSize: "clamp(2rem, 5vw, 4.5rem)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: "0.25rem",
                }}
              >
                Rickhouse Trivia
              </h1>

              <p style={{ opacity: 0.75 }}>
                {game.round_name === "double_cask"
                  ? "Double Cask"
                  : "Single Cask"}{" "}
                • Session {session.session_code}
              </p>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 280px",
                  gap: "1rem",
                  maxWidth: "1600px",
                  margin: "2rem auto 0",
                  alignItems: "start",
                }}
              >
                <section
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(5, 1fr)",
                    gap: "0.75rem",
                  }}
                >
                  {[0, 1, 2, 3, 4].map((columnIndex) => {
                    const columnPours = pours.filter(
                      (pour) => pour.column_index === columnIndex
                    );

                    const categoryName =
                      columnPours[0]?.category ||
                      `Category ${columnIndex + 1}`;

                    return (
                      <div key={columnIndex}>
                        <div
                          style={{
                            minHeight: "80px",
                            background: "#c28a2e",
                            color: "#111",
                            padding: "1rem",
                            borderRadius: "12px 12px 0 0",
                            fontSize: "clamp(1rem, 1.6vw, 1.5rem)",
                            fontWeight: "bold",
                            textTransform: "uppercase",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {categoryName}
                        </div>

                        {columnPours.map((pour) => (
                          <div
                            key={pour.id}
                            style={{
                              height: "90px",
                              marginTop: "0.5rem",
                              background: pour.is_used
                                ? "rgba(255,255,255,0.12)"
                                : "rgba(255,255,255,0.95)",
                              color: pour.is_used
                                ? "rgba(255,255,255,0.35)"
                                : "#111",
                              borderRadius: "10px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "clamp(1.5rem, 3vw, 3rem)",
                              fontWeight: "bold",
                              boxShadow: pour.is_used
                                ? "none"
                                : "0 12px 30px rgba(0,0,0,0.35)",
                            }}
                          >
                            {pour.is_used ? "" : pour.point_value}
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </section>

                <aside
                  style={{
                    background: "rgba(255,255,255,0.95)",
                    color: "#111",
                    borderRadius: "16px",
                    padding: "1rem",
                    boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
                    textAlign: "left",
                  }}
                >
                  <h2 style={{ marginTop: 0, textAlign: "center" }}>
                    Rickhouse Scores
                  </h2>

                  {scores.length === 0 ? (
                    <p style={{ textAlign: "center" }}>No scores yet.</p>
                  ) : (
                    <ol style={{ paddingLeft: "1.5rem", fontSize: "1.25rem" }}>
                      {scores.map((score) => (
                        <li
                          key={score.id}
                          style={{ marginBottom: "0.75rem" }}
                        >
                          <strong>{score.player_name}</strong>
                          <br />
                          {score.score} pts
                        </li>
                      ))}
                    </ol>
                  )}
                </aside>
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}