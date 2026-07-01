"use client";

import { useState } from "react";

export default function JoinPage() {
  const [sessionCode, setSessionCode] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [player, setPlayer] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function joinSession() {
    setLoading(true);
    setError("");
    setPlayer(null);
    setSession(null);

    const response = await fetch("/api/join", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionCode, displayName }),
    });

    const data = await response.json();

    setLoading(false);

    if (!response.ok) {
      setError(data.error || "Something went wrong.");
      return;
    }

    localStorage.setItem("pcl_session_id", data.session.id);
localStorage.setItem("pcl_player_id", data.player.id);

window.location.href = `/play?sessionId=${data.session.id}&playerId=${data.player.id}`;
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>Join PCL Trivia Night</h1>

      <div style={{ marginBottom: "1rem" }}>
        <label>
          Session Code:{" "}
          <input
            value={sessionCode}
            onChange={(event) => setSessionCode(event.target.value)}
            style={{ padding: "0.5rem" }}
          />
        </label>
      </div>

      <div style={{ marginBottom: "1rem" }}>
        <label>
          Display Name:{" "}
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            style={{ padding: "0.5rem" }}
          />
        </label>
      </div>

      <button
        onClick={joinSession}
        disabled={loading}
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
        {loading ? "Joining..." : "Join Session"}
      </button>

      {error && (
        <div style={{ marginTop: "1rem", color: "red" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {player && session && (
        <div style={{ marginTop: "2rem" }}>
          <h2>Joined Session</h2>
          <p>
            <strong>Player:</strong> {player.display_name}
          </p>
          <p>
            <strong>Score:</strong> {player.score}
          </p>
          <p>
            <strong>Session Code:</strong> {session.session_code}
          </p>
          <p>
            <strong>Location:</strong> {session.location}
          </p>
        </div>
      )}
    </main>
  );
}