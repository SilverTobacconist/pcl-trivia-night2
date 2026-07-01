"use client";

import { useEffect, useState } from "react";

export default function HistoryDetailPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const [session, setSession] = useState<any>(null);
  const [players, setPlayers] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [answers, setAnswers] = useState<any[]>([]);
  const [error, setError] = useState("");

  async function loadDetail() {
    setError("");

    const response = await fetch(
      `/api/history-detail?sessionId=${params.sessionId}`
    );

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Could not load session detail.");
      return;
    }

    setSession(data.session);
    setPlayers(data.players);
    setHistory(data.history);
    setAnswers(data.answers);
  }

  useEffect(() => {
    loadDetail();
  }, []);

  function exportSessionCsv() {
    if (!session) return;
  
    const rows = [
      ["Session Code", session.session_code],
      ["Location", session.location],
      ["Host", session.host_name],
      ["Status", session.status],
      [],
      ["Final Standings"],
      ["Place", "Player", "Score"],
      ...players.map((player, index) => [
        index + 1,
        player.display_name,
        player.score,
      ]),
      [],
      ["Player Performance"],
      ["Player", "Score", "Accuracy", "Correct Answers", "Total Answers"],
      ...playerStats.map((player) => [
        player.display_name,
        player.score,
        `${player.accuracy}%`,
        player.correctAnswers,
        player.totalAnswers,
      ]),
      [],
      ["Questions Used"],
      ["Time", "Question ID", "Question", "Category", "Difficulty", "Answer"],
      ...history.map((item) => [
        formatDate(item.date_used),
        item.question_id,
        item.question_text,
        `${item.category || ""}${
          item.subcategory ? ` > ${item.subcategory}` : ""
        }`,
        item.difficulty,
        item.correct_answer,
      ]),
      [],
      ["Answers Submitted"],
      ["Time", "Question ID", "Player", "Answer", "Correct", "Points"],
      ...answers.map((answer) => [
        formatDate(answer.submitted_at),
        answer.question_id,
        answer.player_name,
        answer.submitted_answer,
        String(answer.is_correct),
        answer.points_awarded,
      ]),
    ];
  
    const csv = rows
      .map((row) =>
        row
          .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
  
    const blob = new Blob([csv], {
      type: "text/csv;charset=utf-8;",
    });
  
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
  
    link.href = url;
    link.download = `pcl-trivia-session-${session.session_code}-recap.csv`;
    link.click();
  
    URL.revokeObjectURL(url);
  }

  function formatDate(value: string | null) {
    if (!value) return "Unknown date";

    return new Date(value).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  const winner = players[0];
const totalAnswers = answers.length;
const correctAnswers = answers.filter(
  (answer) => answer.is_correct
).length;

const winnerAnswers = winner
  ? answers.filter((answer) => answer.player_id === winner.id)
  : [];

const winnerCorrect = winnerAnswers.filter(
  (answer) => answer.is_correct
).length;

const winnerAccuracy =
  winnerAnswers.length === 0
    ? 0
    : ((winnerCorrect / winnerAnswers.length) * 100).toFixed(1);
    const secondPlace = players[1];
    const thirdPlace = players[2];
    const playerStats = players.map((player) => {
      const playerAnswers = answers.filter(
        (answer) => answer.player_id === player.id
      );
    
      const playerCorrect = playerAnswers.filter(
        (answer) => answer.is_correct
      ).length;
    
      const playerAccuracy =
        playerAnswers.length === 0
          ? 0
          : ((playerCorrect / playerAnswers.length) * 100).toFixed(1);
    
      return {
        ...player,
        totalAnswers: playerAnswers.length,
        correctAnswers: playerCorrect,
        accuracy: playerAccuracy,
      };
    });
const accuracy =
  totalAnswers === 0
    ? 0
    : ((correctAnswers / totalAnswers) * 100).toFixed(1);

  return (
    <main style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>Session Recap</h1>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {session && (
        <>
          <p>
            <strong>Code:</strong> {session.session_code}
          </p>
          <p>
            <strong>Location:</strong> {session.location}
          </p>
          <p>
            <strong>Host:</strong> {session.host_name}
          </p>
          <p>
            <strong>Status:</strong> {session.status}
          </p>
          <p>
            <strong>Date:</strong> {formatDate(session.created_at)}
          </p>
          <button
  type="button"
  onClick={exportSessionCsv}
  style={{
    background: "#005f3c",
    color: "white",
    padding: "0.6rem 1rem",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    marginTop: "1rem",
  }}
>
  Export Session Recap
</button>
          {winner && (
  <div
    style={{
      border: "3px solid #d4af37",
      borderRadius: "12px",
      padding: "1.5rem",
      marginTop: "2rem",
      marginBottom: "2rem",
      background: "#fff8dc",
    }}
  >
    <h2 style={{ margin: 0 }}>
      🏆 Session Champion
    </h2>

    <p style={{ fontSize: "1.5rem", marginTop: "1rem" }}>
      <strong>{winner.display_name}</strong>
    </p>

    <p>
      <strong>Score:</strong> {winner.score} pts
    </p>

    <p>
      <strong>Accuracy:</strong> {winnerAccuracy}%
    </p>

    <p>
      <strong>Correct Answers:</strong> {winnerCorrect} /
      {winnerAnswers.length}
    </p>

    <p>
      <strong>Session:</strong> {session.session_code}
    </p>

    <p>
      <strong>Location:</strong> {session.location}
    </p>
  </div>
)}

{(secondPlace || thirdPlace) && (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
      gap: "1rem",
      marginBottom: "2rem",
    }}
  >
    {secondPlace && (
      <div
        style={{
          border: "2px solid #aaa",
          borderRadius: "12px",
          padding: "1rem",
          background: "#f5f5f5",
        }}
      >
        <h3 style={{ marginTop: 0 }}>🥈 2nd Place</h3>
        <p>
          <strong>{secondPlace.display_name}</strong>
        </p>
        <p>
          <strong>Score:</strong> {secondPlace.score} pts
        </p>
      </div>
    )}

    {thirdPlace && (
      <div
        style={{
          border: "2px solid #b87333",
          borderRadius: "12px",
          padding: "1rem",
          background: "#fff3e6",
        }}
      >
        <h3 style={{ marginTop: 0 }}>🥉 3rd Place</h3>
        <p>
          <strong>{thirdPlace.display_name}</strong>
        </p>
        <p>
          <strong>Score:</strong> {thirdPlace.score} pts
        </p>
      </div>
    )}
  </div>
)}

          <h2 style={{ marginTop: "2rem" }}>Summary</h2>

          <p>
            <strong>Winner:</strong>{" "}
            {winner ? `${winner.display_name} - ${winner.score} pts` : "No winner yet"}
          </p>
          <p>
            <strong>Total Players:</strong> {players.length}
          </p>
          <p>
            <strong>Questions Asked:</strong> {history.length}
          </p>
          <p>
            <strong>Answers Submitted:</strong> {totalAnswers}
          </p>
          <p>
            <strong>Correct Answers:</strong> {correctAnswers}
          </p>
          <p>
  <strong>Accuracy:</strong> {accuracy}%
</p>

<h2 style={{ marginTop: "2rem" }}>Player Performance</h2>

{playerStats.length === 0 ? (
  <p>No player stats found.</p>
) : (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
      gap: "1rem",
    }}
  >
    {playerStats.map((player) => (
      <div
        key={player.id}
        style={{
          border: "1px solid #ccc",
          borderRadius: "10px",
          padding: "1rem",
          background: "#fafafa",
        }}
      >
        <h3 style={{ marginTop: 0 }}>{player.display_name}</h3>

        <p>
          <strong>Score:</strong> {player.score} pts
        </p>

        <p>
          <strong>Accuracy:</strong> {player.accuracy}%
        </p>

        <p>
          <strong>Correct:</strong> {player.correctAnswers} /{" "}
          {player.totalAnswers}
        </p>
      </div>
    ))}
  </div>
)}

          <h2 style={{ marginTop: "2rem" }}>Final Standings</h2>

          {players.length === 0 ? (
            <p>No players found.</p>
          ) : (
            <ol>
              {players.map((player) => (
                <li key={player.id}>
                  {player.display_name} - {player.score} pts
                </li>
              ))}
            </ol>
          )}

          <h2 style={{ marginTop: "2rem" }}>Questions Used</h2>

          {history.length === 0 ? (
  <p>No questions found.</p>
) : (
  <table style={{ borderCollapse: "collapse", width: "100%" }}>
    <thead>
      <tr>
        <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "0.5rem" }}>
          Time
        </th>
        <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "0.5rem" }}>
          Question
        </th>
        <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "0.5rem" }}>
          Category
        </th>
        <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "0.5rem" }}>
          Difficulty
        </th>
        <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "0.5rem" }}>
          Answer
        </th>
      </tr>
    </thead>

    <tbody>
      {history.map((item) => (
        <tr key={item.id}>
          <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>
            {formatDate(item.date_used)}
          </td>
          <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>
            {item.question_text || "Unknown question"}
            <br />
            <small>{item.question_id}</small>
          </td>
          <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>
            {item.category || "Unknown"}
            {item.subcategory ? ` → ${item.subcategory}` : ""}
          </td>
          <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>
            {item.difficulty || "Unknown"}
          </td>
          <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>
            {item.correct_answer || "Unknown"}
          </td>
        </tr>
      ))}
    </tbody>
  </table>
)}

          <h2 style={{ marginTop: "2rem" }}>Answers Submitted</h2>

          {answers.length === 0 ? (
            <p>No answers found.</p>
          ) : (
            <table style={{ borderCollapse: "collapse", width: "100%" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "0.5rem" }}>
                    Time
                  </th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "0.5rem" }}>
                    Question
                  </th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "0.5rem" }}>
  Player
</th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "0.5rem" }}>
                    Answer
                  </th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "0.5rem" }}>
                    Correct
                  </th>
                  <th style={{ textAlign: "left", borderBottom: "1px solid #ccc", padding: "0.5rem" }}>
                    Points
                  </th>
                </tr>
              </thead>
              <tbody>
                {answers.map((answer) => (
                  <tr key={answer.id}>
                    <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>
                      {formatDate(answer.submitted_at)}
                    </td>
                    <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>
                      {answer.question_id}
                    </td>
                    <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>
  {answer.player_name}
</td>
                    <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>
                      {answer.submitted_answer}
                    </td>
                    <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>
                      {String(answer.is_correct)}
                    </td>
                    <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>
                      {answer.points_awarded}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </main>
  );
}