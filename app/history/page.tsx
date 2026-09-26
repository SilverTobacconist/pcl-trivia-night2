"use client";

import { useEffect, useState } from "react";

export default function HistoryPage() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [error, setError] = useState("");

  async function loadHistory() {
    setError("");

    const response = await fetch("/api/history", { cache: "no-store" });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Could not load history.");
      return;
    }

    setSessions(data.sessions);
  }

  useEffect(() => {
    loadHistory();
  }, []);

  function formatDate(value: string | null) {
    if (!value) return "Unknown date";

    return new Date(value).toLocaleString("en-US", {
      timeZone: "America/Chicago",
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  return (
    <main style={{ padding: "2rem", fontFamily: "Arial, sans-serif" }}>
      <h1>PCL Trivia Night History</h1>
      <p><a href="/event">← Back to Bartender Console</a></p>
      <button type="button" onClick={loadHistory}>Refresh leaderboards</button>

      {error && <p style={{ color: "red" }}>Error: {error}</p>}

      {sessions.length === 0 ? (
        <p>No sessions found.</p>
      ) : (
        <table
          style={{
            borderCollapse: "collapse",
            width: "100%",
            marginTop: "1rem",
          }}
        >
          <thead>
            <tr>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: "0.5rem" }}>
                Date
              </th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: "0.5rem" }}>
                Code
              </th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: "0.5rem" }}>
                Location
              </th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: "0.5rem" }}>
                Host
              </th>
              <th style={{ borderBottom: "1px solid #ccc", textAlign: "left", padding: "0.5rem" }}>
                Status
              </th>
            </tr>
          </thead>

          <tbody>
            {sessions.map((session) => (
              <tr key={session.id}>
                <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>
                  {formatDate(session.created_at)}
                </td>
                <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>
                <a href={`/history/${session.id}`}>
  {session.session_code}
</a>
                </td>
                <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>
                  {session.location}
                </td>
                <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>
                  {session.host_name}
                </td>
                <td style={{ borderBottom: "1px solid #eee", padding: "0.5rem" }}>
                  {session.status === "active" ? "Active now" : session.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
