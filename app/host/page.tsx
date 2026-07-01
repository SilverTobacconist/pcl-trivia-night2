"use client";

import { useEffect, useState } from "react";

export default function HostPage() {
  const [location, setLocation] = useState("Hastings");
  const [hostName, setHostName] = useState("John");
  const [lookupCode, setLookupCode] = useState("");
  const [session, setSession] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [scoreboard, setScoreboard] = useState<any[]>([]);
  const [secondsRemaining, setSecondsRemaining] = useState<number | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [answers, setAnswers] = useState<any[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [loading, setLoading] = useState(false);

  function normalizeAnswer(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]/g, "").trim();
  }

  async function createSession() {
    setLoading(true);
    setError("");
    setSession(null);
    setPlayers([]);
    setAnswers([]);
    setSelectedAnswers([]);

    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ location, hostName }),
    });

    const data = await response.json();
    setLoading(false);

    if (!response.ok) {
      setError(data.error || "Something went wrong");
      return;
    }

    setSession(data.session);
    updateTimer(data.session);
    setLookupCode(data.session.session_code);
  }

  async function loadSession() {
    setLoading(true);
    setError("");
    setSession(null);
    setPlayers([]);
    setAnswers([]);
    setSelectedAnswers([]);

    try {
      const response = await fetch(
        `/api/session-by-code?sessionCode=${lookupCode}`
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not load session");
        return;
      }

      setSession(data.session);

      if (data.session.current_question_id) {
        setCurrentQuestion({
          question_id: data.session.current_question_id,
          category: data.session.current_category,
          subcategory: data.session.current_subcategory,
          difficulty: data.session.current_difficulty,
          question_text: data.session.current_question_text,
          answer: data.session.current_answer,
          answer_aliases: data.session.current_answer_aliases,
        });
      }
    } catch (error: any) {
      setError(error.message || "Could not load session.");
    } finally {
      setLoading(false);
    }
  }

  async function loadPlayers() {
    if (!session?.id) return;

    const response = await fetch(`/api/players?sessionId=${session.id}`);
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Could not load players");
      return;
    }

    setPlayers(data.players);
  }

  async function loadScoreboard() {
    if (!session?.id) return;
  
    const response = await fetch(`/api/scoreboard?sessionId=${session.id}`);
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

  async function loadAnswers() {
    if (!session?.id || !currentQuestion?.question_id) return;

    const response = await fetch(
      `/api/question-answers?sessionId=${session.id}&questionId=${currentQuestion.question_id}`
    );

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Could not load answers");
      return;
    }

    setAnswers(data.answers);

    const correctAnswers = [
      currentQuestion.answer,
      ...(currentQuestion.answer_aliases ?? "")
        .split(/[;,]/)
        .map((alias: string) => alias.trim())
        .filter(Boolean),
    ]
      .map((answer) => normalizeAnswer(answer ?? ""))
      .filter(Boolean);

    const autoSelected = data.answers
      .filter((answer: any) => {
        const submitted = normalizeAnswer(answer.submitted_answer ?? "");
        return correctAnswers.includes(submitted);
      })
      .map((answer: any) => answer.id);

    setSelectedAnswers(autoSelected);
  }

  function toggleAnswer(answerId: string) {
    setSelectedAnswers((current) => {
      if (current.includes(answerId)) {
        return current.filter((id) => id !== answerId);
      }

      return [...current, answerId];
    });
  }

  async function gradeAnswers() {
    if (!session?.id || !currentQuestion?.question_id) return;

    setError("");

    const response = await fetch("/api/grade-answers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.id,
        questionId: currentQuestion.question_id,
        answerIds: selectedAnswers,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Could not grade answers");
      return;
    }

    alert(`Graded ${data.graded} answers.`);
await loadAnswers();
await loadPlayers();
await loadScoreboard();
setSelectedAnswers([]);
  }

  async function revealAnswer() {
    if (!session?.id) return;
  
    setError("");
  
    const response = await fetch("/api/reveal-answer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: session.id,
      }),
    });
  
    const data = await response.json();
  
    if (!response.ok) {
      setError(data.error || "Could not reveal answer");
      return;
    }
  
    setSession(data.session);
setAnswerRevealed(true);
  }

  async function endSession() {
    if (!session?.id) return;
  
    const confirmed = window.confirm(
      "End this session? Players will no longer be able to join or submit answers."
    );
  
    if (!confirmed) return;
  
    setError("");
  
    const response = await fetch("/api/end-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: session.id,
      }),
    });
  
    const data = await response.json();
  
    if (!response.ok) {
      setError(data.error || "Could not end session.");
      return;
    }
  
    setSession(data.session);
  }

  async function exportResultsCsv() {
    if (!session?.id) return;
  
    const response = await fetch(`/api/scoreboard?sessionId=${session.id}`);
    const data = await response.json();
  
    if (!response.ok) {
      setError(data.error || "Could not export results.");
      return;
    }
  
    const rows = [
      ["Place", "Player", "Score"],
      ...data.players.map((player: any, index: number) => [
        index + 1,
        player.display_name,
        player.score,
      ]),
    ];
  
    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value).replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
  
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });
  
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
  
    link.href = url;
    link.download = `pcl-trivia-results-${session.session_code}.csv`;
    link.click();
  
    URL.revokeObjectURL(url);
  }

  async function loadNextQuestion() {
    if (!session?.id) return;

    setError("");
    setCurrentQuestion(null);
    setAnswers([]);
    setSelectedAnswers([]);

    const response = await fetch("/api/next-question", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: session.id,
        location: session.location,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(
        [
          data.error,
          data.details && `Details: ${data.details}`,
          data.code && `Code: ${data.code}`,
          data.hint && `Hint: ${data.hint}`,
        ]
          .filter(Boolean)
          .join(" ")
      );
      return;
    }

    setCurrentQuestion(data.question);
    setAnswerRevealed(false);
await loadSession();
  }

  useEffect(() => {
    if (!session?.id) return;

    const interval = setInterval(() => {
      loadPlayers();
      loadScoreboard();

      if (currentQuestion?.question_id && selectedAnswers.length === 0) {
        loadAnswers();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [session?.id, currentQuestion?.question_id, selectedAnswers.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!session?.question_ends_at) return;

      updateTimer(session);
    }, 1000);

    return () => clearInterval(timer);
  }, [session?.question_ends_at]);

  return (
    <main style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>PCL Trivia Night Host Dashboard</h1>

      {!session && (
        <>
          <h2>Create New Session</h2>

          <div style={{ marginBottom: "1rem" }}>
            <label>
              Location:{" "}
              <select
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                style={{ padding: "0.5rem" }}
              >
                <option value="Hastings">Hastings</option>
                <option value="Norfolk">Norfolk</option>
              </select>
            </label>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label>
              Host Name:{" "}
              <input
                value={hostName}
                onChange={(event) => setHostName(event.target.value)}
                style={{ padding: "0.5rem" }}
              />
            </label>
          </div>

          <button
            onClick={createSession}
            disabled={loading}
            style={{
              background: "#111",
              color: "white",
              padding: "0.75rem 1.25rem",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "1rem",
              marginBottom: "2rem",
            }}
          >
            {loading ? "Creating..." : "Create Session"}
          </button>

          <hr />

          <h2>Load Existing Session</h2>

          <div style={{ marginBottom: "1rem" }}>
            <label>
              Session Code:{" "}
              <input
                value={lookupCode}
                onChange={(event) => setLookupCode(event.target.value)}
                style={{ padding: "0.5rem" }}
              />
            </label>
          </div>

          <button
            onClick={loadSession}
            disabled={loading}
            style={{
              background: "#333",
              color: "white",
              padding: "0.75rem 1.25rem",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            {loading ? "Loading..." : "Load Session"}
          </button>
        </>
      )}

      {error && (
        <div style={{ marginTop: "1rem", color: "red" }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {session && (
        <section style={{ marginTop: "2rem" }}>
          <h2>Active Session</h2>

          <p>
            <strong>Code:</strong> {session.session_code}
          </p>
          <p>
            <strong>Location:</strong> {session.location}
          </p>
          <p>
            <strong>Status:</strong> {session.status}
          </p>

          <div style={{ marginTop: "1rem" }}>
          <button onClick={loadPlayers} style={{ background: "#333", color: "white", padding: "0.6rem 1rem", border: "none", borderRadius: "6px", cursor: "pointer", marginRight: "0.5rem" }}>
  Refresh Players
</button>

<button onClick={loadAnswers} style={{ background: "#444", color: "white", padding: "0.6rem 1rem", border: "none", borderRadius: "6px", cursor: "pointer", marginRight: "0.5rem" }}>
  Load Answers
</button>

<button
  onClick={revealAnswer}
  disabled={answerRevealed}
  style={{
    background: answerRevealed ? "#666" : "#8a5a00",
    color: "white",
    padding: "0.6rem 1rem",
    border: "none",
    borderRadius: "6px",
    cursor: answerRevealed ? "not-allowed" : "pointer",
    marginRight: "0.5rem",
    opacity: answerRevealed ? 0.7 : 1,
  }}
>
  {answerRevealed ? "Answer Revealed" : "Reveal Answer"}
</button>

<button onClick={loadNextQuestion} style={{ background: "#111", color: "white", padding: "0.6rem 1rem", border: "none", borderRadius: "6px", cursor: "pointer", marginRight: "0.5rem" }}>
  Next Question
</button>

<button
  onClick={endSession}
  style={{
    background: "#8a0000",
    color: "white",
    padding: "0.6rem 1rem",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    marginRight: "0.5rem",
  }}
>
  End Session
</button>

<button
  onClick={exportResultsCsv}
  style={{
    background: "#005f3c",
    color: "white",
    padding: "0.6rem 1rem",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    marginRight: "0.5rem",
  }}
>
  Export Results
</button>

<button onClick={loadScoreboard} style={{ background: "#555", color: "white", padding: "0.6rem 1rem", border: "none", borderRadius: "6px", cursor: "pointer", marginRight: "0.5rem" }}>
  Load Scoreboard
</button>

<button
  onClick={() => {
    setSession(null);
    setPlayers([]);
    setCurrentQuestion(null);
    setAnswers([]);
    setSelectedAnswers([]);
  }}
  style={{ background: "#777", color: "white", padding: "0.6rem 1rem", border: "none", borderRadius: "6px", cursor: "pointer" }}
>
  Back
</button>
          </div>

          <h3 style={{ marginTop: "2rem" }}>Players Joined</h3>

{players.length === 0 ? (
  <p>No players loaded yet.</p>
) : (
  <ul>
    {players.map((player) => (
      <li key={player.id}>
        {player.display_name} - {player.score} pts
      </li>
    ))}
  </ul>
)}

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

          {currentQuestion && (
            <section
              style={{
                marginTop: "2rem",
                padding: "1rem",
                border: "1px solid #ccc",
              }}
            >
              <h3>Current Question</h3>

              <p>
                <strong>ID:</strong> {currentQuestion.question_id}
              </p>
              <p>
                <strong>Category:</strong> {currentQuestion.category}
              </p>
              <p>
                <strong>Subcategory:</strong>{" "}
                {currentQuestion.subcategory}
              </p>
              <p>
                <strong>Difficulty:</strong>{" "}
                {currentQuestion.difficulty}
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
                <strong>Question:</strong>{" "}
                {currentQuestion.question_text}
              </p>
              <p>
                <strong>Answer:</strong> {currentQuestion.answer}
              </p>
              <p>
                <strong>Aliases:</strong>{" "}
                {currentQuestion.answer_aliases || "None"}
              </p>

              <h3 style={{ marginTop: "2rem" }}>Submitted Answers</h3>

              {answers.length === 0 ? (
                <p>No answers loaded yet.</p>
              ) : (
                <>
                  <ul>
                    {answers.map((answer) => (
                      <li key={answer.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={selectedAnswers.includes(answer.id)}
                            onChange={() => toggleAnswer(answer.id)}
                            style={{ marginRight: "0.5rem" }}
                          />

                          <strong>
                            {answer.player_name ?? "Unknown"}
                          </strong>

                          {" - "}

                          {answer.submitted_answer}
                        </label>
                      </li>
                    ))}
                  </ul>

                  <p style={{ marginTop: "1rem" }}>
                    Selected Correct: {selectedAnswers.length}
                  </p>

                  <button
                    onClick={gradeAnswers}
                    style={{
                      background: "#111",
                      color: "white",
                      padding: "0.6rem 1rem",
                      border: "none",
                      borderRadius: "6px",
                      cursor: "pointer",
                    }}
                  >
                    Grade Answers
                  </button>
                </>
              )}
            </section>
          )}
        </section>
      )}
    </main>
  );
}