"use client";

import { useEffect, useState } from "react";

export default function WinnersPage() {
  const [sessionCode, setSessionCode] = useState("");
  const [session, setSession] = useState<any>(null);
  const [scoreboard, setScoreboard] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSessionSelector, setShowSessionSelector] = useState(false);

  async function loadSession(codeOverride?: string) {
    setError("");
    setLoading(true);

    const code = codeOverride || sessionCode;

    if (!code.trim()) {
      setLoading(false);
      setError("sessionCode is required.");
      return;
    }

    try {
      const response = await fetch(
        `/api/session-by-code?sessionCode=${code}`
      );

      const data = await response.json();

      if (!response.ok) {
        localStorage.removeItem("pcl_winners_session_code");
        setShowSessionSelector(true);
        setError(data.error || "Could not load session.");
        return;
      }

      setSession(data.session);
      setShowSessionSelector(false);
      setSessionCode(data.session.session_code);
      localStorage.setItem(
        "pcl_winners_session_code",
        data.session.session_code
      );

      await loadScoreboard(data.session.id);
    } catch (error: any) {
      setError(error.message || "Could not load winners.");
    } finally {
      setLoading(false);
    }
  }

  async function loadScoreboard(sessionIdOverride?: string) {
    const activeSessionId = sessionIdOverride || session?.id;
    if (!activeSessionId) return;

    const response = await fetch(
      `/api/scoreboard?sessionId=${activeSessionId}`
    );

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Could not load scoreboard.");
      return;
    }

    setScoreboard(data.players);
  }

  useEffect(() => {
    const savedCode = localStorage.getItem("pcl_winners_session_code");

    if (savedCode) {
      setSessionCode(savedCode);
      loadSession(savedCode);
    } else {
      setShowSessionSelector(true);
    }
  }, []);

  useEffect(() => {
    if (!session?.id) return;
    if (showSessionSelector) return;

    const interval = setInterval(() => {
      loadScoreboard(session.id);
    }, 5000);

    return () => clearInterval(interval);
  }, [session?.id, showSessionSelector]);

  const winners = scoreboard.slice(0, 3);
  const champion = winners[0];
  const secondPlace = winners[1];
  const thirdPlace = winners[2];

  return (
    <main
      style={{
        minHeight: "100vh",
        width: "100vw",
        padding: "clamp(1rem, 3vw, 3rem)",
        boxSizing: "border-box",
        fontFamily: "Arial, sans-serif",
        textAlign: "center",
        background:
          "radial-gradient(circle at top left, #4b3516 0%, #1c1c1c 38%, #070707 100%)",
        color: "white",
        overflow: "auto",
      }}
    >
      {(!session || showSessionSelector) && (
        <section
          style={{
            maxWidth: "820px",
            margin: "8vh auto",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.22)",
            borderRadius: "18px",
            padding: "clamp(1.25rem, 4vw, 2.5rem)",
            boxShadow: "0 20px 70px rgba(0,0,0,0.45)",
          }}
        >
          <h1
            style={{
              fontSize: "clamp(2rem, 6vw, 4rem)",
              margin: "0 0 0.75rem",
              letterSpacing: "0.03em",
            }}
          >
            PCL Trivia Night Winners
          </h1>

          <p style={{ fontSize: "clamp(1rem, 2vw, 1.4rem)" }}>
            Enter the active session code.
          </p>

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
              onChange={(event) => {
                setError("");
                setSessionCode(event.target.value);
              }}
              placeholder="Session code"
              style={{
                padding: "0.9rem",
                fontSize: "1.5rem",
                borderRadius: "10px",
                border: "2px solid rgba(255,255,255,0.4)",
                minWidth: "260px",
                background: "white",
                color: "#111",
              }}
            />

            <button
              type="button"
              onClick={() => loadSession()}
              disabled={loading}
              style={{
                background: loading ? "#777" : "#c28a2e",
                color: "white",
                padding: "0.95rem 1.35rem",
                border: "none",
                borderRadius: "10px",
                cursor: loading ? "not-allowed" : "pointer",
                fontSize: "1rem",
                fontWeight: "bold",
              }}
            >
              {loading ? "Loading..." : "Load Winners"}
            </button>
          </div>

          {error && (
            <p style={{ color: "#ff9a9a", marginTop: "1rem" }}>
              Error: {error}
            </p>
          )}
        </section>
      )}

      {session && !showSessionSelector && (
        <>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem("pcl_winners_session_code");
              setShowSessionSelector(true);
              setSession(null);
              setSessionCode("");
              setScoreboard([]);
              setError("");
            }}
            style={{
              position: "absolute",
              top: "1rem",
              right: "1rem",
              background: "rgba(255,255,255,0.12)",
              color: "white",
              padding: "0.45rem 0.9rem",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "0.85rem",
            }}
          >
            Change Session
          </button>

          <header style={{ marginBottom: "clamp(1rem, 3vh, 2rem)" }}>
            <div
              style={{
                fontSize: "clamp(0.9rem, 1.5vw, 1.25rem)",
                opacity: 0.75,
                textTransform: "uppercase",
                letterSpacing: "0.14em",
              }}
            >
              Paul’s Cigar Lounge
            </div>

            <h1
              style={{
                fontSize: "clamp(2rem, 5vw, 4.5rem)",
                letterSpacing: "0.08em",
                margin: "0.25rem 0",
                textTransform: "uppercase",
              }}
            >
              Tonight’s Winners
            </h1>

            <div
              style={{
                fontSize: "clamp(0.9rem, 1.5vw, 1.15rem)",
                opacity: 0.75,
              }}
            >
              Session {session.session_code} • {session.location}
            </div>
          </header>

          {winners.length === 0 ? (
            <section
              style={{
                marginTop: "18vh",
                fontSize: "clamp(2rem, 5vw, 4rem)",
                opacity: 0.85,
              }}
            >
              No scores yet.
            </section>
          ) : (
            <>
              {champion && (
                <section
                  style={{
                    maxWidth: "1100px",
                    margin: "0 auto clamp(1rem, 3vh, 2rem)",
                    background:
                      "linear-gradient(135deg, rgba(194,138,46,0.98), rgba(255,210,119,0.92))",
                    color: "#111",
                    borderRadius: "24px",
                    padding: "clamp(1.5rem, 4vw, 3rem)",
                    boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
                    border: "3px solid #ffd277",
                  }}
                >
                  <div
                    style={{
                      fontSize: "clamp(3rem, 8vw, 7rem)",
                      lineHeight: 1,
                    }}
                  >
                    🏆
                  </div>

                  <div
                    style={{
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      fontWeight: "bold",
                      marginTop: "0.75rem",
                      fontSize: "clamp(1rem, 2vw, 1.4rem)",
                    }}
                  >
                    Session Champion
                  </div>

                  <div
                    style={{
                      fontSize: "clamp(3rem, 8vw, 7rem)",
                      fontWeight: "bold",
                      lineHeight: "1.05",
                      marginTop: "0.75rem",
                      wordBreak: "break-word",
                    }}
                  >
                    {champion.display_name}
                  </div>

                  <div
                    style={{
                      fontSize: "clamp(1.75rem, 4vw, 3.5rem)",
                      fontWeight: "bold",
                      marginTop: "0.75rem",
                    }}
                  >
                    {champion.score} pts
                  </div>
                </section>
              )}

              {(secondPlace || thirdPlace) && (
                <section
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      "repeat(auto-fit, minmax(260px, 1fr))",
                    gap: "clamp(0.75rem, 2vw, 1.5rem)",
                    maxWidth: "1000px",
                    margin: "0 auto",
                  }}
                >
                  {secondPlace && (
                    <div
                      style={{
                        background: "rgba(255,255,255,0.14)",
                        border: "1px solid rgba(255,255,255,0.28)",
                        borderRadius: "18px",
                        padding: "clamp(1rem, 3vw, 2rem)",
                        boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
                      }}
                    >
                      <div style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)" }}>
                        🥈
                      </div>
                      <h2 style={{ margin: "0.5rem 0" }}>2nd Place</h2>
                      <div
                        style={{
                          fontSize: "clamp(1.5rem, 4vw, 3rem)",
                          fontWeight: "bold",
                          wordBreak: "break-word",
                        }}
                      >
                        {secondPlace.display_name}
                      </div>
                      <div style={{ fontSize: "clamp(1.25rem, 3vw, 2rem)" }}>
                        {secondPlace.score} pts
                      </div>
                    </div>
                  )}

                  {thirdPlace && (
                    <div
                      style={{
                        background: "rgba(255,255,255,0.14)",
                        border: "1px solid rgba(255,255,255,0.28)",
                        borderRadius: "18px",
                        padding: "clamp(1rem, 3vw, 2rem)",
                        boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
                      }}
                    >
                      <div style={{ fontSize: "clamp(2.5rem, 5vw, 4rem)" }}>
                        🥉
                      </div>
                      <h2 style={{ margin: "0.5rem 0" }}>3rd Place</h2>
                      <div
                        style={{
                          fontSize: "clamp(1.5rem, 4vw, 3rem)",
                          fontWeight: "bold",
                          wordBreak: "break-word",
                        }}
                      >
                        {thirdPlace.display_name}
                      </div>
                      <div style={{ fontSize: "clamp(1.25rem, 3vw, 2rem)" }}>
                        {thirdPlace.score} pts
                      </div>
                    </div>
                  )}
                </section>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}