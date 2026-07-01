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

    try {
      const response = await fetch(
        `/api/session-by-code?sessionCode=${code}`
      );

      const data = await response.json();

      if (!response.ok) {
        localStorage.removeItem("pcl_display_session_code");
        setShowSessionSelector(true);
        setError(data.error || "Could not load session.");
        return;
      }

      setSession(data.session);
      setShowSessionSelector(false);
      setSessionCode(data.session.session_code);
      localStorage.setItem(
        "pcl_display_session_code",
        data.session.session_code
      );
      updateTimer(data.session);
    } catch (error: any) {
      setError(error.message || "Could not load display.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const savedCode = localStorage.getItem("pcl_display_session_code");
  
    if (savedCode) {
      setSessionCode(savedCode);
      loadSession(savedCode);
    } else {
      setShowSessionSelector(true);
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
        minHeight: "100vh",
        padding: "3rem",
        fontFamily: "Arial, sans-serif",
        textAlign: "center",
        background:
          "linear-gradient(135deg, #111 0%, #222 45%, #3a2a12 100%)",
        color: "white",
      }}
    >
      {(!session || showSessionSelector) && (
        <section
          style={{
            maxWidth: "700px",
            margin: "5rem auto",
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "16px",
            padding: "2rem",
          }}
        >
          <h1 style={{ fontSize: "3rem" }}>PCL Trivia Night Display</h1>

          <p style={{ fontSize: "1.25rem" }}>
            Enter the active session code.
          </p>

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
              marginRight: "0.5rem",
              borderRadius: "8px",
              border: "none",
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
              borderRadius: "8px",
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: "1rem",
              fontWeight: "bold",
            }}
          >
            {loading ? "Loading..." : "Load Display"}
          </button>

          {error && <p style={{ color: "#ff8080" }}>Error: {error}</p>}
        </section>
      )}

      {session && !showSessionSelector && (
        <>
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
              position: "absolute",
              top: "1rem",
              right: "1rem",
              background: "rgba(255,255,255,0.15)",
              color: "white",
              padding: "0.5rem 1rem",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            Change Session
          </button>

          <header style={{ marginBottom: "2rem" }}>
            <h1
              style={{
                fontSize: "3.5rem",
                letterSpacing: "0.08em",
                marginBottom: "0.25rem",
              }}
            >
              PCL TRIVIA NIGHT
            </h1>

            <p
              style={{
                fontSize: "1.25rem",
                opacity: 0.8,
                marginTop: 0,
              }}
            >
              Session {session.session_code}
            </p>
          </header>

          {session.current_question_text ? (
            <>
              {!session.show_answer ? (
                <>
                  <section
                    style={{
                      maxWidth: "1200px",
                      margin: "0 auto 2rem",
                      borderTop: "4px solid #c28a2e",
                      borderBottom: "4px solid #c28a2e",
                      padding: "1rem",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "3rem",
                        fontWeight: "bold",
                        letterSpacing: "0.08em",
                        textTransform: "uppercase",
                      }}
                    >
                      {session.current_category}
                    </div>

                    {session.current_subcategory && (
                      <div
                        style={{
                          fontSize: "1.5rem",
                          marginTop: "0.5rem",
                          opacity: 0.85,
                        }}
                      >
                        {session.current_subcategory}
                      </div>
                    )}
                  </section>

                  <div
                    style={{
                      width: "160px",
                      height: "160px",
                      margin: "0 auto 2rem",
                      borderRadius: "50%",
                      border: "6px solid #c28a2e",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "4rem",
                      fontWeight: "bold",
                      background: "rgba(0,0,0,0.35)",
                    }}
                  >
                    {secondsRemaining === null
                      ? "--"
                      : secondsRemaining > 0
                      ? secondsRemaining
                      : "0"}
                  </div>

                  <section
                    style={{
                      maxWidth: "1200px",
                      margin: "0 auto",
                      background: "rgba(255,255,255,0.95)",
                      color: "#111",
                      borderRadius: "18px",
                      padding: "3rem",
                      boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "3.25rem",
                        lineHeight: "1.25",
                        fontWeight: "bold",
                      }}
                    >
                      {session.current_question_text}
                    </div>
                  </section>
                </>
              ) : (
                <>
                  <section
                    style={{
                      maxWidth: "1000px",
                      margin: "0 auto 2rem",
                      borderTop: "4px solid #c28a2e",
                      borderBottom: "4px solid #c28a2e",
                      padding: "1rem",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "4rem",
                        fontWeight: "bold",
                        letterSpacing: "0.1em",
                        textTransform: "uppercase",
                        color: "#c28a2e",
                      }}
                    >
                      ANSWER
                    </div>
                  </section>

                  <section
                    style={{
                      maxWidth: "1200px",
                      margin: "0 auto 2rem",
                      background: "rgba(255,255,255,0.95)",
                      color: "#111",
                      borderRadius: "18px",
                      padding: "2rem",
                      boxShadow: "0 20px 60px rgba(0,0,0,0.35)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "2rem",
                        lineHeight: "1.25",
                        marginBottom: "2rem",
                        opacity: 0.75,
                      }}
                    >
                      {session.current_question_text}
                    </div>

                    <div
                      style={{
                        fontSize: "4.5rem",
                        lineHeight: "1.1",
                        fontWeight: "bold",
                        color: "#8a5a00",
                      }}
                    >
                      {session.current_answer}
                    </div>
                  </section>
                </>
              )}
            </>
          ) : (
            <section
              style={{
                marginTop: "5rem",
                fontSize: "3rem",
                opacity: 0.85,
              }}
            >
              Waiting for question...
            </section>
          )}
        </>
      )}
    </main>
  );
}