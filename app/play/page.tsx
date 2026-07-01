"use client";

import { useEffect, useRef, useState } from "react";

export default function PlayPage() {
  const [session, setSession] = useState<any>(null);
  const [player, setPlayer] = useState<any>(null);
  const [scoreboard, setScoreboard] = useState<any[]>([]);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const currentQuestionIdRef = useRef<string | null>(null);
  const autoSubmittedQuestionIdRef = useRef<string | null>(null);
  const answerTextRef = useRef("");

  async function loadScoreboard(sessionIdOverride?: string) {
    const activeSessionId = sessionIdOverride || session?.id;
    if (!activeSessionId) return;

    const response = await fetch(`/api/scoreboard?sessionId=${activeSessionId}`);
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Could not load scoreboard");
      return;
    }

    setScoreboard(data.players);
  }

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

  async function loadGame() {
    setError("");
    setMessage("");

    const params = new URLSearchParams(window.location.search);

    let sessionId = params.get("sessionId");
    let playerId = params.get("playerId");

    if (!sessionId || !playerId) {
      sessionId = localStorage.getItem("pcl_session_id");
      playerId = localStorage.getItem("pcl_player_id");
    }

    if (!sessionId || !playerId) {
      setError("Missing session or player information. Please join again.");
      return;
    }

    localStorage.setItem("pcl_session_id", sessionId);
    localStorage.setItem("pcl_player_id", playerId);

    const response = await fetch(
      `/api/player-game?sessionId=${sessionId}&playerId=${playerId}`
    );

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Could not load game.");
      return;
    }

    const newQuestionId = data.session.current_question_id;
    const previousQuestionId = currentQuestionIdRef.current;

    setSession(data.session);
    setPlayer(data.player);
    updateTimer(data.session);
    await loadScoreboard(data.session.id);

    if (newQuestionId !== previousQuestionId) {
      currentQuestionIdRef.current = newQuestionId;
      autoSubmittedQuestionIdRef.current = null;
      setSubmitted(false);
      setAnswerText("");
      answerTextRef.current = "";
    }
  }

  async function submitAnswer(answerToSubmit?: string) {
    if (!session?.id || !player?.id || !session?.current_question_id) {
      setError("Missing question or player information.");
      return;
    }

    const finalAnswer = String(answerTextRef.current ?? "");

    if (!finalAnswer.trim()) {
      setError("Please enter an answer before submitting.");
      return;
    }

    setError("");
    setMessage("");
    setSubmitting(true);

    try {
      const response = await fetch("/api/submit-answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: String(session.id),
          playerId: String(player.id),
          questionId: String(session.current_question_id),
          submittedAnswer: finalAnswer,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(
          data.details
            ? `${data.error} Details: ${data.details}`
            : data.error || "Could not submit answer."
        );
        return;
      }

      setSubmitted(true);
      setMessage("Answer submitted.");
    } catch (error: any) {
      setError(error.message || "Could not submit answer.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    loadGame();

    const interval = setInterval(() => {
      loadGame();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!session?.question_ends_at) return;

      updateTimer(session);
    }, 1000);

    return () => clearInterval(timer);
  }, [session?.question_ends_at]);

  useEffect(() => {
    if (secondsRemaining === null) return;
    if (secondsRemaining > 2) return;
    if (!session?.current_question_id) return;
    if (submitted || submitting) return;
    if (!answerTextRef.current.trim()) return;

    if (autoSubmittedQuestionIdRef.current === session.current_question_id) {
      return;
    }

    autoSubmittedQuestionIdRef.current = session.current_question_id;
    submitAnswer();
  }, [
    secondsRemaining,
    session?.current_question_id,
    submitted,
    submitting,
  ]);

  return (
    <main style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>PCL Trivia Night</h1>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {message && <p style={{ color: "green" }}>{message}</p>}

      {session && player && (
        <>
          <p>
            <strong>Player:</strong> {player.display_name}
          </p>

          <p>
            <strong>Score:</strong> {player.score}
          </p>

          <p>
            <strong>Session:</strong> {session.session_code}
          </p>

          {session.current_question_text ? (
            <>
              <p>
                <strong>Category:</strong> {session.current_category}
              </p>

              <p>
                <strong>Time:</strong>{" "}
                {secondsRemaining === null
                  ? "No timer"
                  : secondsRemaining > 0
                  ? `${secondsRemaining} seconds`
                  : "Time's up"}
              </p>

              <p>
                <strong>Question:</strong>
              </p>

              <div
                style={{
                  border: "1px solid #ccc",
                  padding: "1rem",
                  borderRadius: "8px",
                  marginBottom: "1rem",
                }}
              >
                {session.current_question_text}
              </div>

              <textarea
                value={answerText}
                onChange={(event) => {
                  setAnswerText(event.target.value);
                  answerTextRef.current = event.target.value;
                }}
                disabled={submitted || submitting || secondsRemaining === 0}
                placeholder="Type your answer..."
                style={{
                  width: "100%",
                  minHeight: "90px",
                  padding: "0.75rem",
                  fontSize: "1rem",
                  marginBottom: "1rem",
                }}
              />

              <button
                type="button"
                onClick={() => submitAnswer()}
                disabled={
                  submitting ||
                  submitted ||
                  !answerText.trim() ||
                  secondsRemaining === 0
                }
                style={{
                  background:
                    submitted || submitting || secondsRemaining === 0
                      ? "#777"
                      : "#111",
                  color: "white",
                  padding: "0.75rem 1.25rem",
                  border: "none",
                  borderRadius: "6px",
                  cursor:
                    submitted || submitting || secondsRemaining === 0
                      ? "not-allowed"
                      : "pointer",
                  marginRight: "0.5rem",
                  opacity:
                    submitted || submitting || secondsRemaining === 0 ? 0.7 : 1,
                }}
              >
                {submitting
                  ? "Submitting..."
                  : submitted
                  ? "Submitted"
                  : secondsRemaining === 0
                  ? "Time's Up"
                  : "Submit Answer"}
              </button>
            </>
          ) : (
            <p>Waiting for question...</p>
          )}

          <button
            type="button"
            onClick={loadGame}
            style={{
              marginTop: "1rem",
              background: "#333",
              color: "white",
              padding: "0.75rem 1.25rem",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
            }}
          >
            Refresh
          </button>

          <h3 style={{ marginTop: "2rem" }}>Scoreboard</h3>

          {scoreboard.length === 0 ? (
            <p>No scoreboard loaded yet.</p>
          ) : (
            <ol>
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