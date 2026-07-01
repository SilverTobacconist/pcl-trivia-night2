"use client";

import { useEffect, useState } from "react";

export default function DisplayPage() {
  const [sessionCode, setSessionCode] = useState("");
  const [session, setSession] = useState<any>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showSessionSelector, setShowSessionSelector] = useState(false);

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

  async function loadSession(codeOverride?: string) {
    const code = codeOverride || sessionCode;

    if (!code.trim()) return;

    setError("");
setLoading(true);

    const response = await fetch(
      `/api/session-by-code?sessionCode=${code}`
    );

    const data = await response.json();

    if (!response.ok) {
      setLoading(false);
      setError(data.error || "Could not load session.");
      return;
    }

    setSession(data.session);
    setShowSessionSelector(false);
setSessionCode(data.session.session_code);
localStorage.setItem("pcl_display_session_code", data.session.session_code);
updateTimer(data.session);
setLoading(false);
  }

  useEffect(() => {
    const savedCode = localStorage.getItem("pcl_display_session_code");
  
    if (savedCode) {
      setSessionCode(savedCode);
      loadSession(savedCode);
    }
  }, []);

  useEffect(() => {
    if (!session?.session_code) return;
    if (showSessionSelector) return;
  
    const interval = setInterval(() => {
      loadSession(session.session_code);
    }, 5000);
  
    return () => clearInterval(interval);
  }, [session?.session_code, showSessionSelector]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!session?.question_ends_at) return;
      updateTimer(session);
    }, 1000);

    return () => clearInterval(timer);
  }, [session?.question_ends_at]);

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
          <h1>PCL Trivia Night Display</h1>

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
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            {loading ? "Loading..." : "Load Display"}
          </button>
        </>
      )}

      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {session && !showSessionSelector && (
        <>
          <h1 style={{ fontSize: "3rem" }}>PCL Trivia Night</h1>
          <div style={{ marginBottom: "1rem" }}>
  <button
    type="button"
    onClick={() => {
      localStorage.removeItem("pcl_display_session_code");
      setShowSessionSelector(true);
      setSession(null);
      setSessionCode("");
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

          <p style={{ fontSize: "1.5rem" }}>
            Session {session.session_code}
          </p>

          {session.current_question_text ? (
            <>
              <h2 style={{ fontSize: "2.5rem", marginTop: "2rem" }}>
                {session.current_category}
              </h2>

              {!session.show_answer && (
  <p style={{ fontSize: "2rem" }}>
    Time:{" "}
    {secondsRemaining === null
      ? "No timer"
      : secondsRemaining > 0
      ? `${secondsRemaining} seconds`
      : "Time's up"}
  </p>
)}

<div
  style={{
    margin: "3rem auto",
    maxWidth: "1100px",
    border: "2px solid #111",
    borderRadius: "12px",
    padding: "2rem",
  }}
>
  <div
    style={{
      fontSize: "3rem",
      lineHeight: "1.3",
      marginBottom: session.show_answer ? "2rem" : 0,
    }}
  >
    {session.current_question_text}
  </div>

  {session.show_answer && (
    <>
      <div
        style={{
          fontSize: "2rem",
          fontWeight: "bold",
          marginBottom: "1rem",
          color: "#8a5a00",
        }}
      >
        ANSWER
      </div>

      <div
        style={{
          fontSize: "4rem",
          fontWeight: "bold",
        }}
      >
        {session.current_answer}
      </div>
    </>
  )}
</div>
            </>
          ) : (
            <h2 style={{ marginTop: "3rem" }}>Waiting for question...</h2>
          )}
        </>
      )}
    </main>
  );
}