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
  const [rickhouseGame, setRickhouseGame] = useState<any>(null);
const [rickhousePours, setRickhousePours] = useState<any[]>([]);
const [rickhouseAnswers, setRickhouseAnswers] = useState<any[]>([]);
const [selectedRickhouseAnswers, setSelectedRickhouseAnswers] = useState<string[]>([]);
const [activeRickhousePour, setActiveRickhousePour] = useState<any>(null);
const [rickhouseScores, setRickhouseScores] = useState<any[]>([]);
const [proposedNextPicker, setProposedNextPicker] = useState<any>(null);
const [selectedNextPickerId, setSelectedNextPickerId] = useState("");
const [startingDoubleCask, setStartingDoubleCask] = useState(false);
const [rickhouseRoundSecondsRemaining, setRickhouseRoundSecondsRemaining] = useState<number | null>(null);
const [caskStrengthEntries, setCaskStrengthEntries] = useState<any[]>([]);
const [selectedCaskCorrectIds, setSelectedCaskCorrectIds] = useState<string[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [loading, setLoading] = useState(false);

  function formatRoundTime(totalSeconds: number | null) {
    if (totalSeconds === null) return "Not started";

    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

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

  async function loadRickhouseAnswers() {
    if (!rickhouseGame?.id) return;
  
    const response = await fetch(
      `/api/rickhouse/answers?gameId=${rickhouseGame.id}`
    );
  
    const data = await response.json();
  
    if (!response.ok) {
      setError(data.error || "Could not load Rickhouse answers.");
      return;
    }
  
    setRickhouseAnswers(data.answers);
setActiveRickhousePour(data.pour);
setSelectedRickhouseAnswers(
  data.answers
    .filter((answer: any) => answer.auto_is_correct)
    .map((answer: any) => answer.id)
);
  }

  async function continueRickhouse() {
    if (!rickhouseGame?.id) return;
  
    setError("");
  
    const response = await fetch("/api/rickhouse/continue", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gameId: rickhouseGame.id,
      }),
    });
  
    const data = await response.json();
  
    if (!response.ok) {
      setError(data.error || "Could not continue Rickhouse.");
      return;
    }
  
    await loadRickhouseGame();
    setRickhouseAnswers([]);
    setSelectedRickhouseAnswers([]);
    setActiveRickhousePour(null);
    await loadRickhouseScores();
    await loadSession();
  }

  async function loadRickhouseScores(gameIdOverride?: string) {
    const activeGameId = gameIdOverride || rickhouseGame?.id;
  
    if (!activeGameId) return;
  
    const response = await fetch(
      `/api/rickhouse/scores?gameId=${activeGameId}`
    );
  
    const data = await response.json();
  
    if (!response.ok) {
      setError(data.error || "Could not load Rickhouse scores.");
      return;
    }
  
    setRickhouseScores(data.scores);
  }

  async function loadRickhouseGame() {
    if (!session?.id) return;
  
    const response = await fetch(
      `/api/rickhouse/current?sessionId=${session.id}`
    );
  
    const data = await response.json();
  
    if (!response.ok) {
      return;
    }
  
    setRickhouseGame(data.game);
    setRickhousePours(data.pours);
    setRickhouseScores(data.standings || []);
    setProposedNextPicker(data.proposedNextPicker || null);
    setRickhouseRoundSecondsRemaining(data.roundSecondsRemaining ?? null);
    setCaskStrengthEntries(data.caskStrength || []);

    if (
      data.game?.game_phase === "round_intermission" &&
      data.game?.round_name === "single_cask"
    ) {
      setSelectedNextPickerId(
        (current) =>
          current ||
          data.proposedNextPicker?.id ||
          data.standings?.[data.standings.length - 1]?.player_id ||
          ""
      );
    } else if (data.game?.round_name === "double_cask") {
      setSelectedNextPickerId("");
    }
  }

  function toggleAnswer(answerId: string) {
    setSelectedAnswers((current) => {
      if (current.includes(answerId)) {
        return current.filter((id) => id !== answerId);
      }

      return [...current, answerId];
    });
  }

  function toggleRickhouseAnswer(answerId: string) {
    setSelectedRickhouseAnswers((current) =>
      current.includes(answerId)
        ? current.filter((id) => id !== answerId)
        : [...current, answerId]
    );
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

  

  async function gradeRickhouseAnswers() {
    if (!rickhouseGame?.id) return;
  
    setError("");
  
    const response = await fetch("/api/rickhouse/grade", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        gameId: rickhouseGame.id,
        correctAnswerIds: selectedRickhouseAnswers,
      }),
    });
  
    const data = await response.json();
  
    if (!response.ok) {
      setError(data.error || "Could not grade Rickhouse answers.");
      return;
    }
  
    setRickhouseAnswers([]);
setSelectedRickhouseAnswers([]);
setActiveRickhousePour(null);

await loadRickhouseGame();
await loadRickhouseScores(rickhouseGame.id);
await loadSession();
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

  async function startDoubleCask() {
    if (!session?.id || !selectedNextPickerId) return;

    const confirmed = window.confirm(
      "Start Double Cask with the selected first picker?"
    );

    if (!confirmed) return;

    setStartingDoubleCask(true);
    setError("");

    try {
      const response = await fetch("/api/rickhouse/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          roundName: "double_cask",
          pickerPlayerId: selectedNextPickerId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Could not start Double Cask.");
        return;
      }

      setRickhouseGame(data.game);
      setRickhousePours(data.pours);
      setRickhouseScores(data.scores || []);
      setProposedNextPicker(null);
      setSelectedNextPickerId("");
      await loadSession();
    } finally {
      setStartingDoubleCask(false);
    }
  }

  async function startCaskStrength() {
    if (!rickhouseGame?.id) return;
    const response = await fetch("/api/rickhouse/cask-strength/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gameId: rickhouseGame.id }) });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Could not start Cask Strength."); return; }
    await loadRickhouseGame(); await loadSession();
  }

  async function loadCaskStrengthEntries() {
    if (!rickhouseGame?.id) return;
    const response = await fetch(`/api/rickhouse/cask-strength/entries?gameId=${rickhouseGame.id}`);
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Could not load Cask Strength answers."); return; }
    setCaskStrengthEntries(data.entries || []);
    setSelectedCaskCorrectIds((data.entries || []).filter((entry:any)=>entry.exact_match).map((entry:any)=>entry.id));
  }

  async function gradeCaskStrength() {
    if (!rickhouseGame?.id) return;
    const response = await fetch("/api/rickhouse/cask-strength/grade", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({gameId:rickhouseGame.id, correctEntryIds:selectedCaskCorrectIds}) });
    const data=await response.json(); if(!response.ok){setError(data.error||"Could not grade Cask Strength.");return;} await loadRickhouseGame(); await loadCaskStrengthEntries();
  }

  async function revealNextCaskStrength() {
    if (!rickhouseGame?.id) return;
    const response=await fetch("/api/rickhouse/cask-strength/reveal-next",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({gameId:rickhouseGame.id})});
    const data=await response.json(); if(!response.ok){setError(data.error||"Could not reveal next player.");return;} await loadRickhouseGame(); await loadCaskStrengthEntries(); await loadRickhouseScores(rickhouseGame.id);
  }

  async function finalizeCaskStrength() {
    if (!rickhouseGame?.id) return;
    const response=await fetch("/api/rickhouse/cask-strength/finalize",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({gameId:rickhouseGame.id})});
    const data=await response.json(); if(!response.ok){setError(data.error||"Could not finalize Rickhouse.");return;} await loadRickhouseGame(); await loadPlayers(); await loadScoreboard(); await loadSession();
  }

  async function startRickhouseTrivia() {
    if (!session?.id) return;
  
    const confirmed = window.confirm(
      "Start Rickhouse Trivia for this session?"
    );
  
    if (!confirmed) return;
  
    setError("");
  
    const response = await fetch("/api/rickhouse/start", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: session.id,
        roundName: "single_cask",
      }),
    });
  
    const data = await response.json();
  
    if (!response.ok) {
      setError(data.error || "Could not start Rickhouse Trivia.");
      return;
    }
  
    setRickhouseGame(data.game);
    setRickhousePours(data.pours);
  }

  useEffect(() => {
    if (!session?.id) return;

    const interval = setInterval(() => {
      loadPlayers();
      loadScoreboard();
      loadRickhouseGame();

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

<button
  onClick={startRickhouseTrivia}
  style={{
    background: "#5b3511",
    color: "white",
    padding: "0.6rem 1rem",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    marginRight: "0.5rem",
  }}
>
  Start Rickhouse Trivia
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

{rickhouseGame && (
  <section
    style={{
      marginTop: "2rem",
      padding: "1rem",
      border: "1px solid #ccc",
      borderRadius: "8px",
    }}
  >
    <h3>Rickhouse Trivia</h3>

    <p>
      <strong>Round:</strong> {rickhouseGame.round_name}
    </p>

    <p>
      <strong>Status:</strong> {rickhouseGame.status}
    </p>
    <button
  type="button"
  onClick={loadRickhouseAnswers}
  style={{
    background: "#333",
    color: "white",
    padding: "0.6rem 1rem",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    marginRight: "0.5rem",
  }}
>
  Load Rickhouse Answers
</button>

<button
  type="button"
  onClick={gradeRickhouseAnswers}
  style={{
    background: "#005f3c",
    color: "white",
    padding: "0.6rem 1rem",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
  }}
>
  Grade Rickhouse Pour
</button>

{(rickhouseGame?.game_phase === "angels_reveal" ||
  rickhouseGame?.game_phase === "pour_reveal") && (
  <button
    type="button"
    onClick={continueRickhouse}
    style={{
      background: "#8a5a00",
      color: "white",
      padding: "0.6rem 1rem",
      border: "none",
      borderRadius: "6px",
      cursor: "pointer",
      marginLeft: "0.5rem",
    }}
  >
    Continue Rickhouse
  </button>
)}

<button
  type="button"
  onClick={loadRickhouseScores}
  style={{
    background: "#444",
    color: "white",
    padding: "0.6rem 1rem",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    marginLeft: "0.5rem",
  }}
>
  Load Rickhouse Scores
</button>

{rickhouseGame?.game_phase !== "round_intermission" && (
  <p style={{ marginTop: "1rem", fontWeight: "bold" }}>
    Round time remaining: {formatRoundTime(rickhouseRoundSecondsRemaining)}
  </p>
)}

{rickhouseScores.length > 0 && (
  <section style={{ marginTop: "1rem" }}>
    <h4>Rickhouse Scores</h4>

    <ol>
      {rickhouseScores.map((score) => (
        <li key={score.id}>
          {score.player_name} - {score.score} pts
        </li>
      ))}
    </ol>
  </section>
)}

{rickhouseGame.game_phase === "round_intermission" && (
  <section
    style={{
      marginTop: "1.25rem",
      padding: "1.25rem",
      border: "2px solid #c28a2e",
      borderRadius: "10px",
      background: "#fff8dc",
    }}
  >
    {rickhouseGame.round_name === "single_cask" ? (
      <>
        <h4 style={{ marginTop: 0 }}>Single Cask Complete</h4>
        <p>
          Review the standings, confirm the first picker, and launch Double Cask.
        </p>

        <ol>
          {rickhouseScores.map((score) => (
            <li key={score.player_id || score.id}>
              {score.player_name} - {score.score} pts
            </li>
          ))}
        </ol>

        <p>
          <strong>Proposed first picker:</strong>{" "}
          {proposedNextPicker?.display_name || "Not available"}
        </p>

        <label>
          First Double Cask picker:{" "}
          <select
            value={selectedNextPickerId}
            onChange={(event) => setSelectedNextPickerId(event.target.value)}
            style={{ padding: "0.5rem", marginRight: "0.75rem" }}
          >
            <option value="">Choose player</option>
            {rickhouseScores.map((score) => (
              <option key={score.player_id || score.id} value={score.player_id}>
                {score.player_name} ({score.score} pts)
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={startDoubleCask}
          disabled={!selectedNextPickerId || startingDoubleCask}
          style={{
            background: "#5b3511",
            color: "white",
            padding: "0.6rem 1rem",
            border: "none",
            borderRadius: "6px",
            cursor:
              !selectedNextPickerId || startingDoubleCask
                ? "not-allowed"
                : "pointer",
          }}
        >
          {startingDoubleCask ? "Starting..." : "Start Double Cask"}
        </button>
      </>
    ) : (
      <>
        <h4 style={{ marginTop: 0 }}>Double Cask Complete</h4>
        <p>
          The Rickhouse standings are final for the two board rounds. Cask Strength is next.
        </p>
        <ol>
          {rickhouseScores.map((score) => (
            <li key={score.player_id || score.id}>
              {score.player_name} - {score.score} pts
              {score.score > 0 ? " — Qualified" : " — Eliminated"}
            </li>
          ))}
        </ol>
        <p>
          Only players with a positive Rickhouse score qualify for Cask Strength.
        </p>
        <button type="button" onClick={startCaskStrength} style={{ background:"#5b3511",color:"white",padding:"0.7rem 1rem",border:0,borderRadius:"6px",cursor:"pointer",fontWeight:"bold" }}>
          Start Cask Strength
        </button>
      </>
    )}
  </section>
)}

{rickhouseGame?.game_phase?.startsWith("cask_strength") && (
  <section style={{marginTop:"1rem",padding:"1rem",border:"2px solid #5b3511",borderRadius:"10px",background:"#f7ead6"}}>
    <h4>Cask Strength</h4>
    <p><strong>Phase:</strong> {rickhouseGame.game_phase}</p>
    <p><strong>Subcategory:</strong> {rickhouseGame.cask_strength_subcategory}</p>
    {rickhouseGame.game_phase !== "cask_strength_wager" && <p><strong>Question:</strong> {rickhouseGame.cask_strength_question_text}</p>}
    {rickhouseGame.game_phase === "cask_strength_grading" && <>
      <p><strong>Correct answer:</strong> {rickhouseGame.cask_strength_correct_answer}</p>
      <button type="button" onClick={loadCaskStrengthEntries}>Load Cask Strength Answers</button>
      <div style={{marginTop:"1rem"}}>{caskStrengthEntries.map((entry)=><label key={entry.id} style={{display:"block",padding:"0.4rem"}}><input type="checkbox" checked={selectedCaskCorrectIds.includes(entry.id)} onChange={()=>setSelectedCaskCorrectIds(current=>current.includes(entry.id)?current.filter(id=>id!==entry.id):[...current,entry.id])}/> {entry.player_name}: {entry.submitted_answer || "No answer"} (Wager submitted)</label>)}</div>
      <button type="button" onClick={gradeCaskStrength} style={{marginTop:"0.75rem"}}>Grade Cask Strength</button>
    </>}
    {rickhouseGame.game_phase === "cask_strength_reveal" && <>
      <ol>{caskStrengthEntries.map((entry)=><li key={entry.id}>{entry.player_name} — {entry.is_revealed ? `${entry.is_correct ? "Correct" : "Incorrect"}, wager ${entry.wager}, score ${entry.final_score}` : `${entry.starting_score} pts — waiting`}</li>)}</ol>
      <button type="button" onClick={revealNextCaskStrength}>Reveal Next Player</button>
      {caskStrengthEntries.length>0 && caskStrengthEntries.every((entry)=>entry.is_revealed) && <button type="button" onClick={finalizeCaskStrength} style={{marginLeft:"0.5rem"}}>Finalize Rickhouse & Award Session Points</button>}
    </>}
    {rickhouseGame.game_phase === "cask_strength_complete" && <p><strong>Rickhouse complete. Session points have been awarded.</strong></p>}
  </section>
)}

{activeRickhousePour && (
  <section
    style={{
      marginTop: "1rem",
      padding: "1rem",
      border: "1px solid #ccc",
      borderRadius: "6px",
      background: "#fafafa",
    }}
  >
    <h4>Active Rickhouse Pour</h4>
    <p>
      <strong>Question:</strong> {activeRickhousePour.question_text}
    </p>
    <p>
      <strong>Correct Answer:</strong> {activeRickhousePour.correct_answer}
    </p>
    <p>
      <strong>Value:</strong> {activeRickhousePour.point_value}
    </p>
    {activeRickhousePour.is_angels_share && (
      <p style={{ color: "#8a5a00", fontWeight: "bold" }}>
        Angel’s Share
      </p>
    )}
  </section>
)}

{rickhouseAnswers.length > 0 && (
  <section style={{ marginTop: "1rem" }}>
    <h4>Rickhouse Submitted Answers</h4>

    <ul style={{ listStyle: "none", paddingLeft: 0 }}>
      {rickhouseAnswers.map((answer) => (
        <li
          key={answer.id}
          style={{
            marginBottom: "0.5rem",
            padding: "0.5rem",
            border: "1px solid #ccc",
            borderRadius: "6px",
            background: selectedRickhouseAnswers.includes(answer.id)
              ? "#d9f7d9"
              : "#fff",
          }}
        >
          <label style={{ cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={selectedRickhouseAnswers.includes(answer.id)}
              onChange={() => toggleRickhouseAnswer(answer.id)}
              style={{ marginRight: "0.5rem" }}
            />
            <strong>{answer.player_name}</strong>
            {" - "}
            {answer.submitted_answer}
            {" "}
            <small>({answer.response_time_ms} ms)</small>
          </label>
        </li>
      ))}
    </ul>
  </section>
)}

    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(5, 1fr)",
        gap: "0.5rem",
        marginTop: "1rem",
      }}
    >
      {[0, 1, 2, 3, 4].map((columnIndex) => {
        const columnPours = rickhousePours.filter(
          (pour) => pour.column_index === columnIndex
        );

        const categoryName =
          columnPours[0]?.category || `Category ${columnIndex + 1}`;

        return (
          <div key={columnIndex}>
            <div
              style={{
                background: "#222",
                color: "white",
                padding: "0.75rem",
                fontWeight: "bold",
                minHeight: "60px",
              }}
            >
              {categoryName}
            </div>

            {columnPours.map((pour) => (
              <div
                key={pour.id}
                style={{
                  border: "1px solid #ccc",
                  padding: "0.75rem",
                  textAlign: "center",
                  background: pour.is_used ? "#ddd" : "#fafafa",
                }}
              >
                <strong>{pour.point_value}</strong>
                {pour.is_angels_share && (
                  <div style={{ fontSize: "0.8rem", color: "#8a5a00" }}>
                    Angel’s Share
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  </section>
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