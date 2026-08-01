"use client";

import { useEffect, useState } from "react";

const panel = {
  background: "rgba(255,255,255,0.09)",
  border: "1px solid rgba(255,255,255,0.22)",
  borderRadius: "16px",
  padding: "clamp(0.8rem,2vw,1.4rem)",
} as const;

export default function DisplayPage() {
  const [sessionCode, setSessionCode] = useState("");
  const [session, setSession] = useState<any>(null);
  const [rickhouse, setRickhouse] = useState<any>(null);
  const [scoreboard, setScoreboard] = useState<any[]>([]);
  const [secondsRemaining, setSecondsRemaining] =
    useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [selector, setSelector] = useState(false);

  function updateTimer(sessionData: any) {
    if (!sessionData?.question_ends_at) {
      setSecondsRemaining(null);
      return;
    }

    setSecondsRemaining(
      Math.max(
        0,
        Math.ceil(
          (new Date(sessionData.question_ends_at).getTime() - Date.now()) /
            1000
        )
      )
    );
  }

  async function loadSession(codeOverride?: string) {
    const code = (codeOverride || sessionCode).trim();

    if (!code) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/session-by-code?sessionCode=${encodeURIComponent(code)}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Could not load session.");
      }

      const activeSession = data.session;

      setSession(activeSession);
      setSessionCode(activeSession.session_code);
      setSelector(false);
      updateTimer(activeSession);

      localStorage.setItem(
        "pcl_display_session_code",
        activeSession.session_code
      );

      const scoreResponse = await fetch(
        `/api/scoreboard?sessionId=${activeSession.id}&t=${Date.now()}`,
        { cache: "no-store" }
      );

      const scoreData = await scoreResponse.json();

      if (scoreResponse.ok) {
        setScoreboard(scoreData.players || []);
      }

      const rickhouseResponse = await fetch(
        `/api/rickhouse/current?sessionId=${activeSession.id}&t=${Date.now()}`,
        { cache: "no-store" }
      );

      if (rickhouseResponse.ok) {
        const rickhouseData = await rickhouseResponse.json();
        setRickhouse(rickhouseData);
      } else {
        setRickhouse(null);

        if (activeSession.game_mode === "rickhouse") {
          const rickhouseError = await rickhouseResponse
            .json()
            .catch(() => ({}));

          setError(
            rickhouseError.error ||
              "Rickhouse is active, but the display could not load its game state."
          );
        }
      }
    } catch (loadError: any) {
      setError(loadError.message || "Could not load display.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const saved = localStorage.getItem("pcl_display_session_code");

    if (saved) {
      setSessionCode(saved);
      void loadSession(saved);
    } else {
      setSelector(true);
    }
  }, []);

  useEffect(() => {
    if (!session?.session_code || selector) return;

    const interval = setInterval(
      () => void loadSession(session.session_code),
      3000
    );

    return () => clearInterval(interval);
  }, [session?.session_code, selector]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (session?.question_ends_at) {
        updateTimer(session);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session?.question_ends_at]);

  const game = rickhouse?.game;
  const pours = rickhouse?.pours || [];
  const standings = rickhouse?.standings || [];
  const activePour = rickhouse?.activePour;
  const cask = rickhouse?.caskStrength || [];
  const phase = game?.game_phase || "";

  const boardVisible =
    game &&
    [
      "board",
      "question",
      "pour_graded",
      "pour_reveal",
      "angels_wager",
      "angels_question",
      "angels_graded",
      "angels_reveal",
    ].includes(phase);

  const parsedAngel = (() => {
    try {
      return game?.angels_share_result
        ? JSON.parse(game.angels_share_result)
        : null;
    } catch {
      return null;
    }
  })();

  function Board() {
    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5,minmax(0,1fr))",
          gap: "clamp(0.25rem,0.7vw,0.65rem)",
          width: "100%",
          minWidth: 0,
        }}
      >
        {[0, 1, 2, 3, 4].map((columnIndex) => {
          const columnPours = pours.filter(
            (pour: any) => pour.column_index === columnIndex
          );

          return (
            <div
              key={columnIndex}
              style={{
                display: "grid",
                gridTemplateRows: `clamp(64px,10vh,105px) repeat(${Math.max(
                  columnPours.length,
                  1
                )},clamp(52px,8vh,82px))`,
                gap: "clamp(0.25rem,0.7vw,0.65rem)",
                minWidth: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "0.4rem",
                  background: "#3b2412",
                  border: "2px solid #c28a2e",
                  fontWeight: 800,
                  fontSize: "clamp(0.7rem,1.45vw,1.35rem)",
                  overflow: "hidden",
                  overflowWrap: "anywhere",
                }}
              >
                {columnPours[0]?.category ||
                  `Category ${columnIndex + 1}`}
              </div>

              {columnPours.map((pour: any) => (
                <div
                  key={pour.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: pour.is_used
                      ? "rgba(255,255,255,0.08)"
                      : "#132c58",
                    border: "2px solid #c28a2e",
                    fontSize: "clamp(1.2rem,3vw,2.7rem)",
                    fontWeight: 900,
                    color: pour.is_used ? "transparent" : "#f3c75f",
                    overflow: "hidden",
                  }}
                >
                  {pour.is_used ? "" : pour.point_value}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    );
  }

  function Leaderboard({
    qualifiers = false,
  }: {
    qualifiers?: boolean;
  }) {
    return (
      <div style={panel}>
        <h2 style={{ marginTop: 0 }}>Rickhouse Scores</h2>

        <ol
          style={{
            margin: 0,
            paddingLeft: "1.7rem",
            textAlign: "left",
          }}
        >
          {standings.map((standing: any) => (
            <li
              key={standing.player_id || standing.id}
              style={{
                padding: "0.35rem",
                marginBottom: "0.25rem",
                border:
                  qualifiers && standing.score > 0
                    ? "2px solid #f3c75f"
                    : "2px solid transparent",
                borderRadius: "8px",
                fontWeight:
                  qualifiers && standing.score > 0 ? 800 : 500,
              }}
            >
              {standing.player_name} — {standing.score} pts
              {qualifiers && standing.score > 0
                ? " — Qualified"
                : ""}
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        width: "100vw",
        padding: "clamp(0.8rem,2vw,2rem)",
        boxSizing: "border-box",
        fontFamily: "Arial,sans-serif",
        textAlign: "center",
        background:
          "radial-gradient(circle at top left,#4b3516 0%,#1c1c1c 38%,#070707 100%)",
        color: "white",
        overflowX: "hidden",
      }}
    >
      {!session || selector ? (
        <section
          style={{
            ...panel,
            maxWidth: "820px",
            margin: "8vh auto",
          }}
        >
          <h1 style={{ fontSize: "clamp(2rem,6vw,4rem)" }}>
            PCL Trivia Night
          </h1>

          <p>Enter the active session code.</p>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <input
              value={sessionCode}
              onChange={(event) =>
                setSessionCode(event.target.value)
              }
              placeholder="Session code"
              style={{
                padding: "0.9rem",
                fontSize: "1.5rem",
                borderRadius: "10px",
                background: "#fff",
                color: "#111",
                border: "2px solid rgba(255,255,255,.4)",
                minWidth: "260px",
              }}
            />

            <button
              onClick={() => void loadSession()}
              disabled={loading}
              style={{
                background: "#c28a2e",
                color: "white",
                padding: "0.95rem 1.35rem",
                border: 0,
                borderRadius: "10px",
                fontWeight: 800,
              }}
            >
              {loading ? "Loading..." : "Load Display"}
            </button>
          </div>

          {error && (
            <p style={{ color: "#ff9a9a" }}>Error: {error}</p>
          )}
        </section>
      ) : (
        <>
          <button
            onClick={() => {
              localStorage.removeItem("pcl_display_session_code");
              setSelector(true);
              setSession(null);
            }}
            style={{
              position: "absolute",
              right: "1rem",
              top: "1rem",
              background: "rgba(255,255,255,.12)",
              color: "white",
              border: "1px solid #777",
              borderRadius: "8px",
              padding: "0.45rem 0.8rem",
            }}
          >
            Change Session
          </button>

          <header style={{ marginBottom: "1rem" }}>
            <h1
              style={{
                margin: "0",
                fontSize: "clamp(1.8rem,4vw,3.4rem)",
                letterSpacing: ".07em",
              }}
            >
              PCL TRIVIA NIGHT
            </h1>

            <div>
              Session {session.session_code} • {session.location}
            </div>
          </header>

          {game ? (
            <>
              <h2 style={{ margin: "0 0 .5rem" }}>
                Rickhouse Trivia •{" "}
                {String(game.round_name || "").replaceAll("_", " ")}
              </h2>

              {boardVisible && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "minmax(0,4fr) minmax(220px,1fr)",
                    gap: "1rem",
                    alignItems: "start",
                  }}
                >
                  <div>
                    <p
                      style={{
                        fontSize: "clamp(1rem,2vw,1.5rem)",
                        margin: "0 0 .6rem",
                      }}
                    >
                      {phase === "board"
                        ? `${
                            rickhouse?.picker?.display_name ||
                            "The picker"
                          } is selecting the next pour.`
                        : phase.startsWith("angels")
                        ? "Angel’s Share"
                        : activePour?.category ||
                          "Rickhouse Question"}
                    </p>

                    <Board />
                  </div>

                  <Leaderboard />
                </div>
              )}

              {activePour && phase !== "board" && (
                <section style={{ ...panel, marginTop: "1rem" }}>
                  <h2>
                    {activePour.is_angels_share
                      ? "Angel’s Share"
                      : activePour.category}
                  </h2>

                  {phase === "angels_wager" ? (
                    <>
                      <p
                        style={{
                          fontSize: "clamp(1.4rem,3vw,2.4rem)",
                        }}
                      >
                        Waiting on wager...
                      </p>

                      <p>
                        {rickhouse?.picker?.display_name || "Player"}{" "}
                        is choosing a wager.
                      </p>
                    </>
                  ) : (
                    <>
                      <p
                        style={{
                          fontSize: "clamp(1.4rem,3vw,2.5rem)",
                          fontWeight: 800,
                        }}
                      >
                        {activePour.question_text}
                      </p>

                      {session.show_answer ||
                      ["pour_reveal", "angels_reveal"].includes(
                        phase
                      ) ? (
                        <div
                          style={{
                            fontSize:
                              "clamp(1.5rem,3.5vw,3rem)",
                            color: "#f3c75f",
                            fontWeight: 900,
                          }}
                        >
                          Answer: {activePour.correct_answer}
                        </div>
                      ) : (
                        <p>
                          {secondsRemaining === null
                            ? "Answers are being graded."
                            : `${secondsRemaining} seconds`}
                        </p>
                      )}

                      {activePour.is_angels_share &&
                        game.angels_share_wager !== null && (
                          <p>
                            Wager: {game.angels_share_wager} pts
                          </p>
                        )}

                      {parsedAngel &&
                        phase === "angels_reveal" && (
                          <p>
                            {parsedAngel.isCorrect
                              ? "Correct"
                              : "Incorrect"}{" "}
                            •{" "}
                            {parsedAngel.pointsAwarded > 0
                              ? "+"
                              : ""}
                            {parsedAngel.pointsAwarded} pts
                          </p>
                        )}
                    </>
                  )}
                </section>
              )}

              {phase === "round_intermission" && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr",
                    gap: "1rem",
                  }}
                >
                  <section style={panel}>
                    <h2>
                      {game.round_name === "single_cask"
                        ? "Single Cask Complete"
                        : "Double Cask Complete"}
                    </h2>

                    <p
                      style={{
                        fontSize: "clamp(1.3rem,2.5vw,2rem)",
                      }}
                    >
                      {game.round_name === "single_cask"
                        ? "Waiting for Double Cask to start."
                        : "Waiting for the Cask Strength category."}
                    </p>

                    {game.round_name === "double_cask" && (
                      <p>
                        Players boxed in gold have qualified for
                        Cask Strength.
                      </p>
                    )}
                  </section>

                  <Leaderboard
                    qualifiers={game.round_name === "double_cask"}
                  />
                </div>
              )}

              {phase.startsWith("cask_strength") && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 1fr",
                    gap: "1rem",
                  }}
                >
                  <section style={panel}>
                    <h2>Cask Strength</h2>
                    <h3>{game.cask_strength_subcategory}</h3>

                    {phase !== "cask_strength_wager" && (
                      <p
                        style={{
                          fontSize: "clamp(1.2rem,2.6vw,2.1rem)",
                          fontWeight: 800,
                        }}
                      >
                        {game.cask_strength_question_text}
                      </p>
                    )}

                    {phase === "cask_strength_wager" && (
                      <p>
                        Qualified players are submitting wagers.
                      </p>
                    )}

                    {phase === "cask_strength_grading" && (
                      <p>Answers are being graded.</p>
                    )}

                    {phase === "cask_strength_reveal" && (
                      <div>
                        {cask
                          .filter((entry: any) => entry.is_revealed)
                          .map((entry: any) => (
                            <div
                              key={entry.id}
                              style={{
                                ...panel,
                                marginTop: ".7rem",
                                textAlign: "left",
                              }}
                            >
                              <h3>{entry.player_name}</h3>
                              <p>
                                Starting score:{" "}
                                {entry.starting_score}
                              </p>
                              <p>
                                Answer:{" "}
                                {entry.submitted_answer ||
                                  "No answer"}
                              </p>
                              <p>
                                {entry.is_correct
                                  ? "Correct"
                                  : "Incorrect"}{" "}
                                • Wager: {entry.wager}
                              </p>
                              <p
                                style={{
                                  fontSize: "1.5rem",
                                  fontWeight: 900,
                                }}
                              >
                                Adjusted score: {entry.final_score}
                              </p>
                            </div>
                          ))}
                      </div>
                    )}

                    {phase === "cask_strength_complete" && (
                      <h2>Rickhouse Trivia Complete</h2>
                    )}
                  </section>

                  <Leaderboard
                    qualifiers={
                      phase !== "cask_strength_complete"
                    }
                  />
                </div>
              )}
            </>
          ) : session.current_question_text ? (
            <section
              style={{
                ...panel,
                maxWidth: "1100px",
                margin: "0 auto",
              }}
            >
              <p
                style={{
                  fontSize: "clamp(1rem,2vw,1.5rem)",
                }}
              >
                {session.current_category}
              </p>

              <div
                style={{
                  fontSize: "clamp(1.8rem,4vw,3.8rem)",
                  fontWeight: 800,
                }}
              >
                {session.current_question_text}
              </div>

              {session.show_answer && (
                <div
                  style={{
                    marginTop: "1rem",
                    fontSize: "clamp(1.6rem,3.5vw,3rem)",
                    color: "#f3c75f",
                    fontWeight: 900,
                  }}
                >
                  Answer: {session.current_answer}
                </div>
              )}

              <p>
                {secondsRemaining === null
                  ? ""
                  : `${secondsRemaining} seconds`}
              </p>
            </section>
          ) : (
            <section style={panel}>
              <h2>Waiting for question...</h2>
            </section>
          )}
        </>
      )}
    </main>
  );
}