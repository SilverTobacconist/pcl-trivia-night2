"use client";

import { useEffect, useState } from "react";

export default function LeaderboardPage() {
  const [sessionCode, setSessionCode] = useState("");
  const [session, setSession] = useState<any>(null);
  const [scoreboard, setScoreboard] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [showSessionSelector, setShowSessionSelector] = useState(false);
  const [loading, setLoading] = useState(false);

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
        localStorage.removeItem("pcl_leaderboard_session_code");
        setShowSessionSelector(true);
        setError(data.error || "Could not load session.");
        return;
      }

      setSession(data.session);
      setShowSessionSelector(false);
      setSessionCode(data.session.session_code);
      localStorage.setItem(
        "pcl_leaderboard_session_code",
        data.session.session_code
      );

      await loadScoreboard(data.session.id);
    } catch (error: any) {
      setError(error.message || "Could not load leaderboard.");
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
    const savedCode = localStorage.getItem("pcl_leaderboard_session_code");

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

  const topThree = scoreboard.slice(0, 3);
  const rest = scoreboard.slice(3);

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
            PCL Trivia Night Leaderboard
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
              {loading ? "Loading..." : "Load Leaderboard"}
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
              localStorage.removeItem("pcl_leaderboard_session_code");
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
              Leaderboard
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

          {scoreboard.length === 0 ? (
            <section
              style={{
                marginTop: "18vh",
                fontSize: "clamp(2rem, 5vw, 4rem)",
                opacity: 0.85,
              }}
            >
              No players yet.
            </section>
          ) : (
            <>
              <section
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(180px, 1fr))",
                  gap: "clamp(0.75rem, 2vw, 1.5rem)",
                  maxWidth: "1200px",
                  margin: "0 auto clamp(1rem, 3vh, 2rem)",
                }}
              >
                {topThree.map((player, index) => {
                  const medals = ["🥇", "🥈", "🥉"];
                  const labels = ["1st Place", "2nd Place", "3rd Place"];

                  return (
                    <div
                      key={player.id}
                      style={{
                        background:
                          index === 0
                            ? "rgba(194,138,46,0.95)"
                            : "rgba(255,255,255,0.12)",
                        border:
                          index === 0
                            ? "2px solid #ffd277"
                            : "1px solid rgba(255,255,255,0.22)",
                        borderRadius: "18px",
                        padding: "clamp(1rem, 2vw, 1.75rem)",
                        boxShadow: "0 18px 50px rgba(0,0,0,0.35)",
                        transform: index === 0 ? "scale(1.03)" : "scale(1)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "clamp(2.5rem, 5vw, 4rem)",
                          marginBottom: "0.5rem",
                        }}
                      >
                        {medals[index]}
                      </div>

                      <div
                        style={{
                          textTransform: "uppercase",
                          letterSpacing: "0.1em",
                          opacity: 0.85,
                          fontSize: "clamp(0.8rem, 1.3vw, 1rem)",
                        }}
                      >
                        {labels[index]}
                      </div>

                      <div
                        style={{
                          fontSize: "clamp(1.5rem, 3.5vw, 3rem)",
                          fontWeight: "bold",
                          marginTop: "0.5rem",
                          wordBreak: "break-word",
                        }}
                      >
                        {player.display_name}
                      </div>

                      <div
                        style={{
                          fontSize: "clamp(1.25rem, 2.5vw, 2.2rem)",
                          marginTop: "0.5rem",
                        }}
                      >
                        {player.score} pts
                      </div>
                    </div>
                  );
                })}
              </section>

              {rest.length > 0 && (
                <section
                  style={{
                    maxWidth: "1100px",
                    margin: "0 auto",
                    background: "rgba(255,255,255,0.95)",
                    color: "#111",
                    borderRadius: "18px",
                    padding: "clamp(1rem, 2vw, 1.5rem)",
                    boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
                  }}
                >
                  {rest.map((player, index) => (
                    <div
                      key={player.id}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "80px 1fr auto",
                        alignItems: "center",
                        gap: "1rem",
                        padding: "0.75rem 0",
                        borderBottom:
                          index === rest.length - 1
                            ? "none"
                            : "1px solid #ddd",
                        fontSize: "clamp(1.1rem, 2vw, 1.75rem)",
                      }}
                    >
                      <strong>#{index + 4}</strong>
                      <span style={{ textAlign: "left", fontWeight: "bold" }}>
                        {player.display_name}
                      </span>
                      <span>{player.score} pts</span>
                    </div>
                  ))}
                </section>
              )}
            </>
          )}
        </>
      )}
    </main>
  );
}