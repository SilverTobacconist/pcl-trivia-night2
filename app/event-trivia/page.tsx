"use client";

import { useState } from "react";

type EventQuestion = {
  question_id: string;
  category: string;
  subcategory: string;
  difficulty: string;
  question_text: string;
  answer: string;
  answer_aliases?: string;
};

export default function EventTriviaPage() {
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [questionNumber, setQuestionNumber] = useState(0);
  const [question, setQuestion] = useState<EventQuestion | null>(null);
  const [usedQuestionIds, setUsedQuestionIds] = useState<string[]>([]);
  const [usedKeywordPool, setUsedKeywordPool] = useState(false);
  const [keywordMatchesAvailable, setKeywordMatchesAvailable] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function loadQuestion(nextQuestionNumber: number, activeKeyword: string) {
    setLoading(true);
    setError("");

    try {
      const preferKeywordQuestion =
        activeKeyword.trim().length > 0 && nextQuestionNumber % 3 === 0;

      const response = await fetch("/api/event-trivia/question", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          keyword: activeKeyword,
          preferKeywordQuestion,
          usedQuestionIds,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Could not load a question.");
      }

      const returnedQuestion = data.question as EventQuestion;

      setQuestion(returnedQuestion);
      setQuestionNumber(nextQuestionNumber);
      setUsedKeywordPool(data.usedKeywordPool === true);
      setKeywordMatchesAvailable(data.keywordMatchesAvailable !== false);

      if (data.questionPoolReset === true) {
        setUsedQuestionIds([returnedQuestion.question_id]);
      } else {
        setUsedQuestionIds((current) => [
          ...current,
          returnedQuestion.question_id,
        ]);
      }
    } catch (caughtError: any) {
      setError(caughtError.message ?? "Could not load a question.");
    } finally {
      setLoading(false);
    }
  }

  async function startGame() {
    const cleanedKeyword = keywordInput.trim();

    setKeyword(cleanedKeyword);
    setQuestionNumber(0);
    setQuestion(null);
    setUsedQuestionIds([]);
    setUsedKeywordPool(false);
    setKeywordMatchesAvailable(true);

    await loadQuestion(1, cleanedKeyword);
  }

  async function nextQuestion() {
    await loadQuestion(questionNumber + 1, keyword);
  }

  function finishGame() {
    window.location.href = "/";
  }

  if (!question) {
    return (
      <main style={styles.page}>
        <section style={styles.setupCard}>
          <p style={styles.eyebrow}>PAUL&apos;S CIGAR LOUNGE</p>
          <h1 style={styles.title}>Event Trivia</h1>

          <p style={styles.intro}>
            Enter a brand, topic, or event keyword. Every third question will
            favor a matching category or subcategory whenever one is available.
            All other questions are selected randomly.
          </p>

          <label style={styles.label} htmlFor="event-keyword">
            Featured keyword
          </label>

          <input
            id="event-keyword"
            type="text"
            value={keywordInput}
            onChange={(event) => setKeywordInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !loading) {
                void startGame();
              }
            }}
            placeholder="Example: Perdomo"
            style={styles.input}
            autoFocus
          />

          <p style={styles.helper}>
            Leave it blank for completely random questions.
          </p>

          {error && <p style={styles.error}>{error}</p>}

          <button
            type="button"
            onClick={() => void startGame()}
            disabled={loading}
            style={{
              ...styles.primaryButton,
              opacity: loading ? 0.65 : 1,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Loading Questions..." : "Start Event Trivia"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main style={styles.page}>
      <section style={styles.questionCard}>
        <div style={styles.headerRow}>
          <div>
            <p style={styles.eyebrow}>EVENT TRIVIA</p>
            <h1 style={styles.questionNumber}>Question {questionNumber}</h1>
          </div>

          {keyword && (
            <div style={styles.keywordBadge}>
              Featured: {keyword}
            </div>
          )}
        </div>

        <div style={styles.metadataRow}>
          <span style={styles.metadataPill}>
            {question.category || "General"}
          </span>

          {question.subcategory && (
            <span style={styles.metadataPill}>{question.subcategory}</span>
          )}

          {question.difficulty && (
            <span style={styles.metadataPill}>{question.difficulty}</span>
          )}

          {usedKeywordPool && (
            <span style={styles.featuredPill}>Featured Question</span>
          )}
        </div>

        {!keywordMatchesAvailable && keyword && (
          <p style={styles.notice}>
            No category or subcategory currently matches “{keyword}.” Questions
            will remain fully random.
          </p>
        )}

        <div style={styles.questionBlock}>
          <p style={styles.blockLabel}>QUESTION</p>
          <p style={styles.questionText}>{question.question_text}</p>
        </div>

        <div style={styles.answerBlock}>
          <p style={styles.blockLabel}>ANSWER</p>
          <p style={styles.answerText}>{question.answer}</p>

          {question.answer_aliases?.trim() && (
            <p style={styles.aliases}>
              Also accept: {question.answer_aliases}
            </p>
          )}
        </div>

        {error && <p style={styles.error}>{error}</p>}

        <div style={styles.buttonRow}>
          <button
            type="button"
            onClick={() => void nextQuestion()}
            disabled={loading}
            style={{
              ...styles.primaryButton,
              flex: 1,
              opacity: loading ? 0.65 : 1,
              cursor: loading ? "wait" : "pointer",
            }}
          >
            {loading ? "Loading..." : "Next Question"}
          </button>

          <button
            type="button"
            onClick={finishGame}
            disabled={loading}
            style={{
              ...styles.secondaryButton,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            Done
          </button>
        </div>
      </section>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    padding: "clamp(1rem, 3vw, 3rem)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background:
      "radial-gradient(circle at top, #4c321f 0%, #25170f 42%, #100b08 100%)",
    color: "#f5ead6",
  },
  setupCard: {
    width: "min(720px, 100%)",
    padding: "clamp(1.5rem, 5vw, 3.5rem)",
    border: "1px solid rgba(211, 173, 104, 0.55)",
    borderRadius: "18px",
    background:
      "linear-gradient(145deg, rgba(70, 42, 25, 0.96), rgba(30, 19, 13, 0.98))",
    boxShadow: "0 24px 70px rgba(0, 0, 0, 0.45)",
  },
  questionCard: {
    width: "min(1100px, 100%)",
    padding: "clamp(1.25rem, 4vw, 3rem)",
    border: "1px solid rgba(211, 173, 104, 0.55)",
    borderRadius: "18px",
    background:
      "linear-gradient(145deg, rgba(70, 42, 25, 0.97), rgba(30, 19, 13, 0.99))",
    boxShadow: "0 24px 70px rgba(0, 0, 0, 0.5)",
  },
  eyebrow: {
    margin: "0 0 0.5rem",
    letterSpacing: "0.18em",
    fontSize: "0.78rem",
    fontWeight: 700,
    color: "#d3ad68",
  },
  title: {
    margin: 0,
    fontSize: "clamp(2.2rem, 7vw, 4.75rem)",
    lineHeight: 1,
    fontFamily: "Georgia, serif",
  },
  intro: {
    margin: "1.5rem 0 2rem",
    maxWidth: "60ch",
    color: "#d9c8ad",
    fontSize: "1.05rem",
    lineHeight: 1.65,
  },
  label: {
    display: "block",
    marginBottom: "0.55rem",
    fontSize: "0.9rem",
    fontWeight: 700,
    color: "#f5ead6",
  },
  input: {
    width: "100%",
    boxSizing: "border-box",
    padding: "1rem 1.1rem",
    border: "1px solid #a87c45",
    borderRadius: "8px",
    background: "#f7f0e4",
    color: "#21150e",
    fontSize: "1.1rem",
    outline: "none",
  },
  helper: {
    margin: "0.55rem 0 1.5rem",
    color: "#bba98d",
    fontSize: "0.9rem",
  },
  headerRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: "1rem",
    flexWrap: "wrap",
  },
  questionNumber: {
    margin: 0,
    fontFamily: "Georgia, serif",
    fontSize: "clamp(2rem, 5vw, 3.5rem)",
  },
  keywordBadge: {
    padding: "0.7rem 1rem",
    border: "1px solid #d3ad68",
    borderRadius: "999px",
    background: "rgba(211, 173, 104, 0.12)",
    color: "#f0d49a",
    fontWeight: 700,
    textTransform: "capitalize",
  },
  metadataRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.65rem",
    margin: "1.5rem 0",
  },
  metadataPill: {
    padding: "0.45rem 0.75rem",
    borderRadius: "999px",
    background: "rgba(255, 255, 255, 0.08)",
    color: "#decdb3",
    fontSize: "0.85rem",
  },
  featuredPill: {
    padding: "0.45rem 0.75rem",
    borderRadius: "999px",
    background: "#d3ad68",
    color: "#24160e",
    fontSize: "0.85rem",
    fontWeight: 800,
  },
  notice: {
    padding: "0.85rem 1rem",
    borderLeft: "4px solid #d3ad68",
    background: "rgba(211, 173, 104, 0.09)",
    color: "#e5d4b8",
    lineHeight: 1.5,
  },
  questionBlock: {
    marginTop: "1.5rem",
    padding: "clamp(1.25rem, 3vw, 2rem)",
    borderRadius: "12px",
    background: "rgba(255, 255, 255, 0.055)",
  },
  answerBlock: {
    marginTop: "1rem",
    padding: "clamp(1.25rem, 3vw, 2rem)",
    borderRadius: "12px",
    border: "1px solid rgba(211, 173, 104, 0.42)",
    background: "rgba(211, 173, 104, 0.08)",
  },
  blockLabel: {
    margin: "0 0 0.75rem",
    letterSpacing: "0.16em",
    fontSize: "0.72rem",
    fontWeight: 800,
    color: "#d3ad68",
  },
  questionText: {
    margin: 0,
    fontFamily: "Georgia, serif",
    fontSize: "clamp(1.5rem, 4vw, 2.75rem)",
    lineHeight: 1.3,
  },
  answerText: {
    margin: 0,
    fontFamily: "Georgia, serif",
    fontSize: "clamp(1.3rem, 3.5vw, 2.25rem)",
    lineHeight: 1.35,
    color: "#f3d79d",
  },
  aliases: {
    margin: "0.9rem 0 0",
    color: "#cbb99d",
    fontSize: "0.95rem",
  },
  buttonRow: {
    display: "flex",
    gap: "0.85rem",
    marginTop: "1.5rem",
    flexWrap: "wrap",
  },
  primaryButton: {
    minHeight: "52px",
    padding: "0.85rem 1.25rem",
    border: "1px solid #d3ad68",
    borderRadius: "8px",
    background: "#d3ad68",
    color: "#21150e",
    fontSize: "1rem",
    fontWeight: 800,
  },
  secondaryButton: {
    minHeight: "52px",
    padding: "0.85rem 1.25rem",
    border: "1px solid #9d8666",
    borderRadius: "8px",
    background: "transparent",
    color: "#f5ead6",
    fontSize: "1rem",
    fontWeight: 700,
  },
  error: {
    margin: "1rem 0",
    padding: "0.8rem 1rem",
    borderRadius: "8px",
    background: "rgba(160, 45, 45, 0.24)",
    border: "1px solid rgba(232, 105, 105, 0.55)",
    color: "#ffd4d4",
  },
};