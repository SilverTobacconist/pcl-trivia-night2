"use client";

import { useEffect, useState } from "react";

export default function LeaderboardPage() {
  const [sessionCode, setSessionCode] = useState("");
  const [session, setSession] = useState<any>(null);
  const [scoreboard, setScoreboard] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [showSessionSelector, setShowSessionSelector] = useState(false);

  async function loadSession(codeOverride?: string) {
    setError("");
  
    const code = codeOverride || sessionCode;
  
    if (!code.trim()) {
      setError("sessionCode is required.");
      return;
    }
  
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
localStorage.setItem("pcl_leaderboard_session_code", data.session.session_code);
await loadScoreboard(data.session.id);
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

  return (
    <main style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>PCL Trivia Night Leaderboard</h1>

      {(!session || showSessionSelector) && (
        <>
          <p>Enter the active session code.</p>

          <input
            value={sessionCode}
            onChange={(event) => setSessionCode(event.target.value)}
            placeholder="Session code"
            style={{
              padding: "0.75rem",
              fontSize: "1.25rem",
              marginRight: "0.5rem",
            }}
          />

          <button
            type="button"
            onClick={() => loadSession()}
            style={{
              background: "#111",
              color: "white",
              padding: "0.75rem 1.25rem",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            Load Leaderboard
          </button>
        </>
      )}

      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {session && !showSessionSelector && (
        <>
          <h2>Session {session.session_code}</h2>
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
    background: "#444",
    color: "white",
    padding: "0.5rem 1rem",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    marginBottom: "1rem",
  }}
>
  Change Session
</button>

          {scoreboard.length === 0 ? (
            <p>No players yet.</p>
          ) : (
            <ol style={{ fontSize: "2rem", lineHeight: "1.6" }}>
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