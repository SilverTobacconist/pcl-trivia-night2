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
  const [lastCall, setLastCall] = useState<any>(null);
  const [lastCallEntries, setLastCallEntries] = useState<any[]>([]);
  const [selectedLastCallCorrect, setSelectedLastCallCorrect] = useState<string[]>([]);
  const [lastCallBusy, setLastCallBusy] = useState(false);
  const [lastCallActionName, setLastCallActionName] = useState("");
  const [lastCallMessage, setLastCallMessage] = useState("");
  const [endingLastCall, setEndingLastCall] = useState(false);
  const [agingRoom, setAgingRoom] = useState<any>(null);
  const [agingPlayers, setAgingPlayers] = useState<any[]>([]);
  const [agingAnswers, setAgingAnswers] = useState<any[]>([]);
  const [agingSelectedPlayers, setAgingSelectedPlayers] = useState<string[]>([]);
  const [agingCorrectAnswers, setAgingCorrectAnswers] = useState<string[]>([]);
  const [agingBusy, setAgingBusy] = useState("");
  const [agingMessage, setAgingMessage] = useState("");
  const [returningFromRickhouse, setReturningFromRickhouse] = useState(false);

  const lastCallButtonStyle = (disabled = false) => ({
    background: disabled ? "#777" : "#5b3511",
    color: "#fff",
    padding: ".75rem 1rem",
    border: "2px solid rgba(0,0,0,.18)",
    borderRadius: "7px",
    cursor: disabled ? "wait" : "pointer",
    fontWeight: 800,
    boxShadow: disabled ? "inset 0 2px 4px rgba(0,0,0,.2)" : "0 3px 0 #2f1a08",
    transform: disabled ? "translateY(2px)" : "none",
    margin: ".35rem .5rem .35rem 0",
  } as const);

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
    setRickhouseGame(null);
    setRickhousePours([]);
    setRickhouseAnswers([]);
    setSelectedRickhouseAnswers([]);
    setActiveRickhousePour(null);
    setRickhouseScores([]);
    setProposedNextPicker(null);
    setCaskStrengthEntries([]);

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
    await loadRickhouseGame(data.session.id);
  }

  async function loadSession() {
    setLoading(true);
    setError("");
    setSession(null);
    setPlayers([]);
    setAnswers([]);
    setSelectedAnswers([]);
    setRickhouseGame(null);
    setRickhousePours([]);
    setRickhouseAnswers([]);
    setSelectedRickhouseAnswers([]);
    setActiveRickhousePour(null);
    setRickhouseScores([]);
    setProposedNextPicker(null);
    setCaskStrengthEntries([]);

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
      await loadRickhouseGame(data.session.id);

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

  async function loadRickhouseGame(sessionIdOverride?: string) {
    const activeSessionId = sessionIdOverride || session?.id;
    if (!activeSessionId) return;
  
    const response = await fetch(
      `/api/rickhouse/current?sessionId=${activeSessionId}`
    );
  
    const data = await response.json();
  
    if (!response.ok) {
      setRickhouseGame(null);
      setRickhousePours([]);
      setRickhouseAnswers([]);
      setSelectedRickhouseAnswers([]);
      setActiveRickhousePour(null);
      setRickhouseScores([]);
      setProposedNextPicker(null);
      setRickhouseRoundSecondsRemaining(null);
      setCaskStrengthEntries([]);
      return;
    }
  
    setRickhouseGame(data.game);
    setRickhousePours(data.pours);
    setRickhouseScores(data.standings || []);
    setProposedNextPicker(data.proposedNextPicker || null);
    setRickhouseRoundSecondsRemaining(data.roundSecondsRemaining ?? null);
    setCaskStrengthEntries(data.caskStrength || []);
    setActiveRickhousePour(data.activePour || null);

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
await loadRickhouseGame();
await loadRickhouseScores(rickhouseGame.id);
await loadSession();
  }

  async function revealRickhouseAnswer() {
    if (!rickhouseGame?.id) return;
    setError("");
    const response = await fetch("/api/rickhouse/reveal-answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gameId: rickhouseGame.id }),
    });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Could not reveal Rickhouse answer."); return; }
    await loadRickhouseGame();
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
    if (!window.confirm("Begin Last Call? This closes regular trivia and any active Rickhouse game.")) return;
    setError("");
    await lastCallAction("start");
  }

  async function loadAgingRoom(sessionIdOverride?: string) {
    const id = sessionIdOverride || session?.id;
    if (!id) return;
    const response = await fetch(`/api/aging-room/current?sessionId=${id}&t=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();
    setAgingRoom(data.game);
    setAgingPlayers(data.players || []);
    setAgingAnswers(data.answers || []);
    if (data.game?.phase === "setup") setAgingSelectedPlayers((data.players || []).filter((p: any) => p.status === "selected").map((p: any) => p.player_id));
    if (["question", "bale_question"].includes(data.game?.phase)) {
      const exactIds = (data.answers || []).filter((answer: any) => answer.exact_match && answer.competitive).map((answer: any) => answer.id);
      setAgingCorrectAnswers((current) => Array.from(new Set([...current, ...exactIds])));
    }
  }

  async function agingAction(action: string, extras: any = {}) {
    if (!session?.id || agingBusy) return;
    setAgingBusy(action); setAgingMessage(""); setError("");
    try {
      const response = await fetch("/api/aging-room/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, sessionId: session.id, ...extras }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Aging Room action failed.");
      setAgingCorrectAnswers([]);
      await loadAgingRoom(session.id); await loadSession(); await loadPlayers(); await loadScoreboard();
      setAgingMessage(action === "grade" ? "Question graded." : action === "retry" ? "Second attempts are open." : "Aging Room updated.");
    } catch (error: any) { setError(error.message || "Aging Room action failed."); }
    finally { setAgingBusy(""); }
  }

  async function loadLastCall(sessionIdOverride?: string) {
    const id = sessionIdOverride || session?.id;
    if (!id) return;
    const response = await fetch(`/api/last-call/current?sessionId=${id}&t=${Date.now()}`, { cache: "no-store" });
    const data = await response.json();
    if (!response.ok) { setError(data.error || "Could not load Last Call."); return; }
    setLastCall(data.game);
    setLastCallEntries(data.entries || []);
    if (data.game?.phase === "grading") {
      setSelectedLastCallCorrect((current) => current.length ? current : (data.entries || []).filter((entry: any) => entry.exact_match).map((entry: any) => entry.id));
    }
  }

  async function lastCallAction(action: string, extras: any = {}) {
    if (!session?.id || lastCallBusy) return;
    setLastCallBusy(true); setLastCallActionName(action); setLastCallMessage(""); setError("");
    try {
      const response = await fetch("/api/last-call/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, sessionId: session.id, ...extras }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Last Call action failed.");
      await loadSession(); await loadLastCall(session.id); await loadScoreboard();
      const messages: Record<string,string> = { finalize_vote:"Difficulty vote finalized.",show_question:"Wagers locked.  Question displayed.",begin_grading:"Answers closed.  Grading ready.",grade:"Last Call graded.",reveal_next:"Next player revealed.",finalize:"Last Call finalized." };
      setLastCallMessage(messages[action] || "Last Call updated.");
    } catch (error: any) { setError(error.message || "Last Call action failed."); }
    finally { setLastCallBusy(false); setLastCallActionName(""); }
  }

  async function endAfterLastCall(exportFirst: boolean) {
    if (endingLastCall) return;
    setEndingLastCall(true); setError("");
    try {
      if (exportFirst) await exportResultsCsv();
      const response = await fetch("/api/end-session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: session.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not end session.");
      setSession(data.session);
    } catch (error:any) { setError(error.message || "Could not end session."); }
    finally { setEndingLastCall(false); }
  }

  async function returnFromRickhouse() {
    if (!rickhouseGame?.id || returningFromRickhouse) return;
    setReturningFromRickhouse(true); setError("");
    try {
      const response = await fetch("/api/rickhouse/close", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ gameId: rickhouseGame.id }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not return to main trivia.");
      setRickhouseGame(null); await loadSession(); await loadPlayers(); await loadScoreboard();
    } catch (error: any) { setError(error.message || "Could not return to main trivia."); }
    finally { setReturningFromRickhouse(false); }
  }

  async function exportResultsCsv() {
    if (!session?.id) return;

    const [scoreResponse, gameResponse] = await Promise.all([
      fetch(`/api/scoreboard?sessionId=${session.id}`),
      fetch(`/api/game-results?sessionId=${session.id}`),
    ]);
    const data = await scoreResponse.json();
    const gameData = await gameResponse.json();

    if (!scoreResponse.ok || !gameResponse.ok) {
      setError(data.error || gameData.error || "Could not export results.");
      return;
    }

    const endedAt = new Date();
    const sessionDate = endedAt.toLocaleDateString("en-US", { timeZone: "America/Chicago", year:"numeric", month:"long", day:"numeric" });
    const endTime = endedAt.toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour:"numeric", minute:"2-digit", timeZoneName:"short" });

    const games = gameData.games || [];
    const gameHeaders = games.map((game: any) => `${game.game_type === "rickhouse" ? "Rickhouse" : "Aging Room"} #${game.game_number}`);
    const ordinal = (place: number) => {
      const mod100 = place % 100;
      if (mod100 >= 11 && mod100 <= 13) return `${place}th`;
      return `${place}${place % 10 === 1 ? "st" : place % 10 === 2 ? "nd" : place % 10 === 3 ? "rd" : "th"}`;
    };
    const rows = [
      ["Date", sessionDate],
      ["End Time", endTime],
      ["Session Number", session.session_code ?? ""],
      ["Location", session.location ?? ""],
      ["Host", session.host_name ?? ""],
      [],
      ["Place", "Player", "Score", ...gameHeaders],
      ...data.players.map((player: any, index: number, all: any[]) => [
        index > 0 && Number(all[index - 1].score) === Number(player.score) ? all.slice(0, index).findIndex((item: any) => Number(item.score) === Number(player.score)) + 1 : index + 1,
        player.display_name,
        player.score,
        ...games.map((game: any) => {
          const placement = (game.placements || []).find((item: any) => item.player_id === player.id);
          return placement?.place ? ordinal(Number(placement.place)) : "";
        }),
      ]),
    ];

    const csv = "\uFEFF" + rows
      .map((row) =>
        row
          .map((value: unknown) =>
            `"${String(value ?? "").replace(/"/g, '""')}"`
          )
          .join(",")
      )
      .join("\n");

    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `pcl-trivia-results-${session.session_code}-${Date.now()}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    if (!agingMessage) return;
    const timer = window.setTimeout(() => setAgingMessage(""), 5000);
    return () => window.clearTimeout(timer);
  }, [agingMessage]);

  useEffect(() => {
    if (!lastCallMessage) return;
    const timer = window.setTimeout(() => setLastCallMessage(""), 5000);
    return () => window.clearTimeout(timer);
  }, [lastCallMessage]);

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
      loadLastCall();
      loadAgingRoom();

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

{!rickhouseGame && !agingRoom && !lastCall && session.status === "active" && (
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
)}

{!rickhouseGame && !lastCall && !agingRoom && session.status === "active" && (
<button onClick={() => agingAction("setup")} disabled={Boolean(agingBusy)} style={{ background: agingBusy ? "#777" : "#6b3f22", color: "white", padding: "0.6rem 1rem", border: "none", borderRadius: "6px", cursor: agingBusy ? "wait" : "pointer", marginRight: "0.5rem" }}>
  {agingBusy === "setup" ? "Opening Aging Room..." : "Start The Aging Room"}
</button>
)}

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
  disabled={Boolean(agingRoom)}
  style={{
    background: agingRoom ? "#777" : "#8a0000",
    color: "white",
    padding: "0.6rem 1rem",
    border: "none",
    borderRadius: "6px",
    cursor: agingRoom ? "not-allowed" : "pointer",
    marginRight: "0.5rem",
  }}
>
  {agingRoom ? "Finish Aging Room Before Last Call" : "Begin Last Call"}
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
    setRickhouseGame(null);
    setRickhousePours([]);
    setRickhouseAnswers([]);
    setSelectedRickhouseAnswers([]);
    setActiveRickhousePour(null);
    setRickhouseScores([]);
    setProposedNextPicker(null);
    setCaskStrengthEntries([]);
  }}
  style={{ background: "#777", color: "white", padding: "0.6rem 1rem", border: "none", borderRadius: "6px", cursor: "pointer" }}
>
  Back
</button>
          </div>

          {lastCall && (
            <section style={{ marginTop: "1.5rem", padding: "1rem", border: "2px solid #8a5a00", borderRadius: "10px", background: "#fff8dc", color: "#111" }}>
              <h2>Last Call</h2>
              <p><strong>Phase:</strong> {String(lastCall.phase).replaceAll("_", " ")}</p>
              {lastCallMessage && <p style={{color:"#176b2c",fontWeight:800}}>{lastCallMessage}</p>}
              {lastCall.selected_difficulty && <p><strong>Final question:</strong> {lastCall.category} / {lastCall.subcategory} / {lastCall.selected_difficulty}</p>}
              {lastCall.phase === "voting" && <><p>{lastCallEntries.length} player(s) have voted.  Only voters advance.</p><button style={lastCallButtonStyle(lastCallBusy)} disabled={lastCallBusy} onClick={() => lastCallAction("finalize_vote")}>{lastCallActionName==="finalize_vote"?"Finalizing Vote...":"Finalize Difficulty Vote"}</button></>}
              {lastCall.phase === "wagering" && <><p>{lastCallEntries.filter((entry) => entry.wager !== null).length} of {lastCallEntries.length} wagers submitted.</p><button style={lastCallButtonStyle(lastCallBusy)} disabled={lastCallBusy} onClick={() => lastCallAction("show_question")}>{lastCallActionName==="show_question"?"Locking Wagers...":"Lock Wagers & Show Question"}</button></>}
              {lastCall.phase === "question" && <><p><strong>Question:</strong> {lastCall.question_text}</p><p>{lastCallEntries.filter((entry) => entry.submitted_answer !== null).length} of {lastCallEntries.length} answers submitted.</p><button style={lastCallButtonStyle(lastCallBusy)} disabled={lastCallBusy} onClick={() => lastCallAction("begin_grading")}>{lastCallActionName==="begin_grading"?"Closing Answers...":"Close Answers & Begin Grading"}</button></>}
              {lastCall.phase === "grading" && <><p><strong>Question:</strong> {lastCall.question_text}</p><p><strong>Correct answer:</strong> {lastCall.correct_answer}</p>{lastCallEntries.map((entry) => <label key={entry.id} style={{ display: "block", padding: ".35rem" }}><input type="checkbox" checked={selectedLastCallCorrect.includes(entry.id)} onChange={() => setSelectedLastCallCorrect((current) => current.includes(entry.id) ? current.filter((id) => id !== entry.id) : [...current, entry.id])} /> {entry.player_name}: {entry.submitted_answer || "No answer"}</label>)}<button style={lastCallButtonStyle(lastCallBusy)} disabled={lastCallBusy} onClick={() => lastCallAction("grade", { correctEntryIds: selectedLastCallCorrect })}>{lastCallActionName==="grade"?"Grading...":"Grade Last Call"}</button></>}
              {lastCall.phase === "reveal" && <><p><strong>Correct answer:</strong> {lastCall.correct_answer}</p><ol>{lastCallEntries.map((entry) => <li key={entry.id}>{entry.player_name} — Points before wager: {entry.starting_score} — {entry.is_revealed ? `Answer: ${entry.submitted_answer || "No answer"}, ${entry.is_correct ? "Correct" : "Incorrect"}, wager ${entry.wager}, new total ${entry.final_score}` : "waiting"}</li>)}</ol><button style={lastCallButtonStyle(lastCallBusy || lastCallEntries.every((entry) => entry.is_revealed))} disabled={lastCallBusy || lastCallEntries.every((entry) => entry.is_revealed)} onClick={() => lastCallAction("reveal_next")}>{lastCallActionName==="reveal_next"?"Revealing...":"Reveal Next Player"}</button>{lastCallEntries.length > 0 && lastCallEntries.every((entry) => entry.is_revealed) && <button style={lastCallButtonStyle(lastCallBusy)} disabled={lastCallBusy} onClick={() => lastCallAction("finalize")}>{lastCallActionName==="finalize"?"Finalizing...":"Finalize Last Call"}</button>}</>}
              {lastCall.phase === "complete" && <><h3>Final session standings are ready.</h3><button style={lastCallButtonStyle(endingLastCall)} disabled={endingLastCall} onClick={() => endAfterLastCall(true)}>{endingLastCall?"Ending Session...":"Export Final Leaderboard & End Session"}</button><button style={lastCallButtonStyle(endingLastCall)} disabled={endingLastCall} onClick={() => endAfterLastCall(false)}>{endingLastCall?"Ending Session...":"End Without Export"}</button></>}
            </section>
          )}

          {agingRoom && (
            <section style={{ marginTop: "1.5rem", padding: "1rem", border: "2px solid #7b4a27", borderRadius: "10px", background: "#f3e3c5", color: "#111" }}>
              <h2>The Aging Room</h2>
              <p><strong>Phase:</strong> {String(agingRoom.phase).replaceAll("_", " ")}</p>
              {agingMessage && <p style={{ color: "#176b2c", fontWeight: 800 }}>{agingMessage}</p>}
              {agingRoom.phase === "setup" && <>
                <p>Uncheck anyone who will not play.  At least two players are required.</p>
                {agingPlayers.map((p) => <label key={p.id} style={{ display: "block", padding: ".35rem" }}><input type="checkbox" checked={agingSelectedPlayers.includes(p.player_id)} onChange={() => setAgingSelectedPlayers((current) => current.includes(p.player_id) ? current.filter((id) => id !== p.player_id) : [...current, p.player_id])} /> {p.player_name}</label>)}
                <button style={lastCallButtonStyle(Boolean(agingBusy) || agingSelectedPlayers.length < 2)} disabled={Boolean(agingBusy) || agingSelectedPlayers.length < 2} onClick={async () => { await agingAction("set_selected", { playerIds: agingSelectedPlayers }); await agingAction("start"); }}>{agingBusy ? "Starting..." : "Lock Players & Start"}</button>
              </>}
              {["question", "bale_question"].includes(agingRoom.phase) && <>
                <p><strong>{agingRoom.phase === "bale_question" ? "Bale Stack" : `Round ${agingRoom.round_number}`}</strong> • {agingRoom.phase === "bale_question" ? "First to five bales wins" : `${agingRoom.required_correct} Correct Answer${agingRoom.required_correct === 1 ? "" : "s"} to Move On`}</p>
                <p>{agingRoom.category} / {agingRoom.subcategory} / {agingRoom.difficulty}</p>
                <h3>{agingRoom.question_text}</h3><p><strong>Correct answer:</strong> {agingRoom.correct_answer}</p>{agingRoom.answer_aliases && <p><strong>Alternate answers:</strong> {agingRoom.answer_aliases}</p>}
                <p>{agingAnswers.length} answer(s) submitted for attempt {agingRoom.attempt_number}.</p>
                {agingAnswers.map((a) => <label key={a.id} style={{ display: "block", padding: ".35rem", opacity: a.competitive ? 1 : .55 }}><input type="checkbox" disabled={!a.competitive} checked={agingCorrectAnswers.includes(a.id)} onChange={() => setAgingCorrectAnswers((current) => current.includes(a.id) ? current.filter((id) => id !== a.id) : [...current, a.id])} /> {a.player_name}: {a.submitted_answer || "No answer"}{!a.competitive ? " (just for fun)" : ""}</label>)}
                <button style={lastCallButtonStyle(Boolean(agingBusy))} disabled={Boolean(agingBusy)} onClick={() => agingAction("grade", { correctAnswerIds: agingCorrectAnswers })}>{agingBusy === "grade" ? "Grading..." : "Grade & Resolve Question"}</button>
                <button style={lastCallButtonStyle(Boolean(agingBusy) || agingRoom.attempt_number > 1)} disabled={Boolean(agingBusy) || agingRoom.attempt_number > 1} onClick={() => agingAction("retry")}>{agingBusy === "retry" ? "Opening Attempts..." : "Allow Everyone One More Attempt"}</button>
              </>}
              {["question_result", "bale_result"].includes(agingRoom.phase) && <>
                <p><strong>Answer:</strong> {agingRoom.correct_answer}</p>
                <p>{agingAnswers.find((a) => a.is_correct && a.competitive)?.player_name ? `${agingAnswers.find((a) => a.is_correct && a.competitive)?.player_name} was fastest correct.` : "No eligible player answered correctly."}</p>
                {agingRoom.phase === "question_result" && agingPlayers.filter((p) => p.status === "active").length === 1 ? <button style={lastCallButtonStyle(Boolean(agingBusy))} disabled={Boolean(agingBusy)} onClick={() => agingAction("check_round")}>Confirm Elimination</button> : <button style={lastCallButtonStyle(Boolean(agingBusy))} disabled={Boolean(agingBusy)} onClick={() => agingAction("next_question")}>Next Question</button>}
              </>}
              {agingRoom.phase === "elimination" && <><h3>{agingPlayers.find((p) => p.player_id === agingRoom.eliminated_player_id)?.player_name} is eliminated.</h3><button style={lastCallButtonStyle(Boolean(agingBusy))} disabled={Boolean(agingBusy)} onClick={() => agingAction("next_round")}>Start Next Round</button></>}
              <h3>Players</h3><ol>{agingPlayers.filter((p) => p.status !== "excluded").map((p) => <li key={p.id}>{p.player_name} — {p.status}{["finalist", "winner"].includes(p.status) ? ` — ${p.bale_count}/5 bales` : !["eliminated"].includes(p.status) ? ` — ${p.round_correct}/${agingRoom.required_correct}` : p.final_place ? ` — ${p.final_place}${p.final_place === 1 ? "st" : p.final_place === 2 ? "nd" : p.final_place === 3 ? "rd" : "th"}` : ""}</li>)}</ol>
              {agingRoom.phase === "complete" && <><h3>{agingPlayers.find((p) => p.player_id === agingRoom.winner_player_id)?.player_name} wins The Aging Room!  Session points have been awarded.</h3><button style={lastCallButtonStyle(Boolean(agingBusy))} disabled={Boolean(agingBusy)} onClick={() => agingAction("close")}>{agingBusy === "close" ? "Returning..." : "Return to Main Trivia"}</button></>}
            </section>
          )}

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
{["question", "angels_question"].includes(rickhouseGame.game_phase) && (
  <>
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
  </>
)}

{["angels_graded", "pour_graded", "angels_reveal", "pour_reveal"].includes(
  rickhouseGame?.game_phase
) && (
  <>
    <button
      type="button"
      onClick={revealRickhouseAnswer}
      disabled={["angels_reveal", "pour_reveal"].includes(rickhouseGame?.game_phase)}
      style={{
        background: ["angels_reveal", "pour_reveal"].includes(rickhouseGame?.game_phase)
          ? "#666"
          : "#c28a2e",
        color: "#111",
        padding: "0.6rem 1rem",
        border: "none",
        borderRadius: "6px",
        cursor: ["angels_reveal", "pour_reveal"].includes(rickhouseGame?.game_phase)
          ? "not-allowed"
          : "pointer",
        marginLeft: "0.5rem",
        fontWeight: "bold",
      }}
    >
      {["angels_reveal", "pour_reveal"].includes(rickhouseGame?.game_phase)
        ? "Answer Revealed"
        : "Reveal Answer"}
    </button>

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
  </>
)}
<button
  type="button"
  onClick={() => void loadRickhouseScores()}
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
      <button type="button" onClick={loadCaskStrengthEntries} style={{
        background: "#5b3511",
        color: "#ffffff",
        padding: "0.7rem 1rem",
        border: "none",
        borderRadius: "6px",
        cursor: "pointer",
        fontWeight: "bold",
      }}>Load Cask Strength Answers</button>
      <div style={{marginTop:"1rem"}}>{caskStrengthEntries.map((entry)=><label key={entry.id} style={{display:"block",padding:"0.4rem"}}><input type="checkbox" checked={selectedCaskCorrectIds.includes(entry.id)} onChange={()=>setSelectedCaskCorrectIds(current=>current.includes(entry.id)?current.filter(id=>id!==entry.id):[...current,entry.id])}/> {entry.player_name}: {entry.submitted_answer || "No answer"} (Wager submitted)</label>)}</div>
      <button type="button" onClick={gradeCaskStrength} style={{marginTop:"0.75rem",background:"#5b3511",color:"#ffffff",padding:"0.7rem 1rem",border:"none",borderRadius:"6px",cursor:"pointer",fontWeight:"bold"}}>Grade Cask Strength</button>
    </>}
    {rickhouseGame.game_phase === "cask_strength_reveal" && <>
      <ol>{caskStrengthEntries.map((entry)=><li key={entry.id}>{entry.player_name} — {entry.is_revealed ? `${entry.is_correct ? "Correct" : "Incorrect"}, wager ${entry.wager}, score ${entry.final_score}` : `${entry.starting_score} pts — waiting`}</li>)}</ol>
      <button type="button" onClick={revealNextCaskStrength} style={{background:"#5b3511",color:"#ffffff",padding:"0.7rem 1rem",border:"none",borderRadius:"6px",cursor:"pointer",fontWeight:"bold"}}>Reveal Next Player</button>
      {caskStrengthEntries.length>0 && caskStrengthEntries.every((entry)=>entry.is_revealed) && <button type="button" onClick={finalizeCaskStrength} style={{marginLeft:"0.5rem",background:"#5b3511",color:"#ffffff",padding:"0.7rem 1rem",border:"none",borderRadius:"6px",cursor:"pointer",fontWeight:"bold"}}>Finalize Rickhouse & Award Session Points</button>}
    </>}
    {rickhouseGame.game_phase === "cask_strength_complete" && <><p><strong>Rickhouse complete. Session points have been awarded.</strong></p><button type="button" onClick={returnFromRickhouse} disabled={returningFromRickhouse} style={lastCallButtonStyle(returningFromRickhouse)}>{returningFromRickhouse ? "Returning..." : "Return to Main Trivia"}</button></>}
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
        gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
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
          <div key={columnIndex} style={{ display: "grid", gridTemplateRows: `78px repeat(${Math.max(columnPours.length, 1)}, 64px)`, gap: "0.5rem", minWidth: 0 }}>
            <div
              style={{
                background: "#222",
                color: "white",
                padding: "0.75rem",
                fontWeight: "bold",
                height: "78px",
                boxSizing: "border-box",
                overflow: "hidden",
                overflowWrap: "anywhere",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {categoryName}
            </div>

            {columnPours.map((pour) => (
              <div
                key={pour.id}
                style={{
                  border: "1px solid #ccc",
                  height: "64px",
                  boxSizing: "border-box",
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
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
