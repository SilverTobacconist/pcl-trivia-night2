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
        setError(data.error || "Could not load session.");
        return;
      }

      setSession(data.session);
setShowSessionSelector(false);
      setSessionCode(data.session.session_code);
      localStorage.setItem("pcl_winners_session_code", data.session.session_code);
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

  return (
    <main
      style={{
        padding: "3rem",
        fontFamily: "Arial, sans-serif",
        textAlign: "center",
      }}
    >
      {(!session || showSessionSelector) && (
        <>
          <h1>PCL Trivia Night Winners</h1>

          <p>Enter the active session code.</p>

          <input
            value={sessionCode}
            onChange={(event) => setSessionCode(event.target.value)}
            placeholder="Session code"
            style={{
              padding: "0.75rem",
              fontSize: "1.5rem",
              marginRight: "0.5rem",
            }}
          />

          <button
            type="button"
            onClick={() => loadSession()}
            disabled={loading}
            style={{
              background: "#111",
              color: "white",
              padding: "0.85rem 1.25rem",
              border: "none",
              borderRadius: "6px",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "1rem",
            }}
          >
            {loading ? "Loading..." : "Load Winners"}
          </button>
        </>
      )}

      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {session && !showSessionSelector && (
        <>
          <h1 style={{ fontSize: "4rem" }}>PCL Trivia Night</h1>
          <div style={{ marginBottom: "1rem" }}>
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
      background: "#444",
      color: "white",
      padding: "0.5rem 1rem",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
    }}
  >
    Change Session
  </button>
</div>
          <h2 style={{ fontSize: "3rem", marginBottom: "3rem" }}>
            Tonight's Winners
          </h2>

          {winners.length === 0 ? (
            <p style={{ fontSize: "2rem" }}>No scores yet.</p>
          ) : (
            <div style={{ maxWidth: "900px", margin: "0 auto" }}>
              {winners.map((player, index) => {
                const medals = ["🥇", "🥈", "🥉"];

                return (
                  <div
                    key={player.id}
                    style={{
                      fontSize: index === 0 ? "3rem" : "2.5rem",
                      fontWeight: "bold",
                      marginBottom: "2rem",
                      padding: "1.5rem",
                      border: "2px solid #111",
                      borderRadius: "12px",
                    }}
                  >
                    {medals[index]} {player.display_name} - {player.score} pts
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </main>
  );
}