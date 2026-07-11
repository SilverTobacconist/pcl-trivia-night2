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

  const isAnswerShown = Boolean(session?.show_answer);

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
        overflow: "hidden",
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
            PCL Trivia Night
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
              {loading ? "Loading..." : "Load Display"}
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

          <header
            style={{
              display: "grid",
              gridTemplateColumns: "1fr auto 1fr",
              alignItems: "center",
              gap: "1rem",
              marginBottom: "clamp(0.75rem, 2vh, 1.5rem)",
            }}
          >
            <div style={{ textAlign: "left" }}>
              <div
                style={{
                  fontSize: "clamp(0.9rem, 1.5vw, 1.25rem)",
                  opacity: 0.75,
                  textTransform: "uppercase",
                  letterSpacing: "0.14em",
                }}
              >
                Refined Relaxation
              </div>
            </div>

            <div>
              <h1
                style={{
                  fontSize: "clamp(1.8rem, 4vw, 3.6rem)",
                  letterSpacing: "0.09em",
                  margin: 0,
                  textTransform: "uppercase",
                }}
              >
                PCL Trivia Night
              </h1>
              <div
                style={{
                  fontSize: "clamp(0.8rem, 1.3vw, 1.1rem)",
                  opacity: 0.75,
                  marginTop: "0.25rem",
                }}
              >
                Session {session.session_code}
              </div>
            </div>

            <div style={{ textAlign: "right" }}>
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
            </div>
          </header>

          {session.current_question_text ? (
            <section
              style={{
                height: "calc(100vh - 150px)",
                minHeight: "420px",
                display: "grid",
                gridTemplateRows: isAnswerShown ? "auto 1fr" : "auto auto 1fr",
                gap: "clamp(0.75rem, 2vh, 1.5rem)",
                alignItems: "center",
              }}
            >
              {!isAnswerShown ? (
                <>
                  <section
                    style={{
                      maxWidth: "1200px",
                      width: "90%",
                      margin: "0 auto",
                      borderTop: "4px solid #c28a2e",
                      borderBottom: "4px solid #c28a2e",
                      padding: "clamp(0.5rem, 1.5vh, 1rem)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "clamp(2rem, 5vw, 4.2rem)",
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
                          fontSize: "clamp(1rem, 2.2vw, 1.8rem)",
                          marginTop: "0.25rem",
                          opacity: 0.82,
                        }}
                      >
                        {session.current_subcategory}
                      </div>
                    )}
                  </section>

                  <div
                    style={{
                      width: "clamp(110px, 13vw, 170px)",
                      height: "clamp(110px, 13vw, 170px)",
                      margin: "0 auto",
                      borderRadius: "50%",
                      border: "6px solid #c28a2e",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "clamp(3rem, 7vw, 5rem)",
                      fontWeight: "bold",
                      background: "rgba(0,0,0,0.42)",
                      boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
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
                      maxWidth: "1280px",
                      width: "92%",
                      margin: "0 auto",
                      background: "rgba(255,255,255,0.96)",
                      color: "#111",
                      borderRadius: "20px",
                      padding: "clamp(1.5rem, 4vw, 3.5rem)",
                      boxShadow: "0 22px 70px rgba(0,0,0,0.45)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "clamp(2rem, 5vw, 4.5rem)",
                        lineHeight: "1.16",
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
                      width: "85%",
                      margin: "0 auto",
                      borderTop: "4px solid #c28a2e",
                      borderBottom: "4px solid #c28a2e",
                      padding: "clamp(0.75rem, 2vh, 1.25rem)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "clamp(3rem, 8vw, 6rem)",
                        fontWeight: "bold",
                        letterSpacing: "0.12em",
                        textTransform: "uppercase",
                        color: "#c28a2e",
                      }}
                    >
                      Answer
                    </div>
                  </section>

                  <section
                    style={{
                      maxWidth: "1280px",
                      width: "92%",
                      margin: "0 auto",
                      background: "rgba(255,255,255,0.96)",
                      color: "#111",
                      borderRadius: "20px",
                      padding: "clamp(1.5rem, 4vw, 3.5rem)",
                      boxShadow: "0 22px 70px rgba(0,0,0,0.45)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "clamp(1.25rem, 2.6vw, 2.2rem)",
                        lineHeight: "1.25",
                        marginBottom: "clamp(1rem, 3vh, 2rem)",
                        opacity: 0.7,
                      }}
                    >
                      {session.current_question_text}
                    </div>

                    <div
                      style={{
                        fontSize: "clamp(3rem, 8vw, 6.5rem)",
                        lineHeight: "1.05",
                        fontWeight: "bold",
                        color: "#8a5a00",
                      }}
                    >
                      {session.current_answer}
                    </div>
                  </section>
                </>
              )}
            </section>
          ) : (
            <section
              style={{
                marginTop: "20vh",
                fontSize: "clamp(2rem, 5vw, 4rem)",
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