"use client";

import { useState, useEffect } from "react";
import {
  generateDefaultSeedData,
  generateEdgeCaseSeedData,
  generateLargeSeedData,
} from "@/lib/seed-data";
import { seedDatabase, clearAndSeed, getDatabaseStats, type SeedResult } from "@/lib/seed-database";

type Status = "idle" | "loading" | "success" | "error";

export default function SeedPage() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [stats, setStats] = useState<{ projects: number; conversations: number; messages: number } | null>(null);

  // Only allow in development
  const isDev = process.env.NODE_ENV === "development";

  useEffect(() => {
    if (isDev) {
      refreshStats();
    }
  }, [isDev]);

  const refreshStats = async () => {
    try {
      const currentStats = await getDatabaseStats();
      setStats(currentStats);
    } catch (err) {
      console.error("Failed to get stats:", err);
    }
  };

  const handleSeed = async (
    seedFn: () => Promise<SeedResult>,
    label: string
  ) => {
    setStatus("loading");
    setMessage(`${label}...`);

    try {
      const result = await seedFn();

      if (result.success) {
        setStatus("success");
        setMessage(
          `${label} complete! Created ${result.projectsCreated} projects, ${result.conversationsCreated} conversations, ${result.messagesCreated} messages.`
        );
      } else {
        setStatus("error");
        setMessage(`Failed: ${result.error || "Unknown error"}`);
      }

      await refreshStats();
    } catch (err) {
      setStatus("error");
      setMessage(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  if (!isDev) {
    return (
      <div style={styles.container}>
        <h1 style={styles.title}>Not Available</h1>
        <p style={styles.text}>This page is only available in development mode.</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Database Seed Tool</h1>
      <p style={styles.subtitle}>Populate the database with test data for development</p>

      {stats && (
        <div style={styles.statsBox}>
          <h3 style={styles.statsTitle}>Current Database</h3>
          <p style={styles.statItem}>Projects: {stats.projects}</p>
          <p style={styles.statItem}>Conversations: {stats.conversations}</p>
          <p style={styles.statItem}>Messages: {stats.messages}</p>
        </div>
      )}

      <div style={styles.buttonGroup}>
        <button
          style={styles.button}
          onClick={() =>
            handleSeed(
              () => seedDatabase(generateDefaultSeedData()),
              "Seeding default data"
            )
          }
          disabled={status === "loading"}
        >
          Seed Default Data
        </button>

        <button
          style={{ ...styles.button, ...styles.buttonWarning }}
          onClick={() =>
            handleSeed(
              () => clearAndSeed(generateDefaultSeedData()),
              "Resetting and seeding"
            )
          }
          disabled={status === "loading"}
        >
          Reset & Seed
        </button>

        <button
          style={styles.button}
          onClick={() =>
            handleSeed(
              () => seedDatabase(generateEdgeCaseSeedData()),
              "Seeding edge cases"
            )
          }
          disabled={status === "loading"}
        >
          Seed Edge Cases
        </button>

        <button
          style={styles.button}
          onClick={() =>
            handleSeed(
              () => seedDatabase(generateLargeSeedData(100)),
              "Seeding 100 conversations"
            )
          }
          disabled={status === "loading"}
        >
          Seed Large (100)
        </button>

        <button
          style={styles.button}
          onClick={() =>
            handleSeed(
              () => seedDatabase(generateLargeSeedData(500)),
              "Seeding 500 conversations"
            )
          }
          disabled={status === "loading"}
        >
          Seed Large (500)
        </button>
      </div>

      {message && (
        <div
          style={{
            ...styles.messageBox,
            ...(status === "success" ? styles.successBox : {}),
            ...(status === "error" ? styles.errorBox : {}),
            ...(status === "loading" ? styles.loadingBox : {}),
          }}
        >
          {message}
        </div>
      )}

      <div style={styles.instructions}>
        <h3 style={styles.instructionsTitle}>Instructions</h3>
        <ol style={styles.instructionsList}>
          <li>Click a seed button to add test data</li>
          <li>Use "Reset & Seed" to clear all data first</li>
          <li>Navigate to the home page to see the results</li>
          <li>Edge cases include: long messages, unicode, many files</li>
        </ol>
      </div>

      <a href="/" style={styles.link}>
        Go to Home Page
      </a>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: "600px",
    margin: "40px auto",
    padding: "20px",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  title: {
    fontSize: "24px",
    fontWeight: "bold",
    marginBottom: "8px",
    color: "#1a1a1a",
  },
  subtitle: {
    fontSize: "14px",
    color: "#666",
    marginBottom: "24px",
  },
  statsBox: {
    backgroundColor: "#f5f5f5",
    padding: "16px",
    borderRadius: "8px",
    marginBottom: "24px",
  },
  statsTitle: {
    fontSize: "14px",
    fontWeight: "600",
    marginBottom: "8px",
    color: "#333",
  },
  statItem: {
    fontSize: "13px",
    color: "#666",
    margin: "4px 0",
  },
  buttonGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    marginBottom: "24px",
  },
  button: {
    padding: "12px 16px",
    fontSize: "14px",
    fontWeight: "500",
    color: "#fff",
    backgroundColor: "#0066cc",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  buttonWarning: {
    backgroundColor: "#cc6600",
  },
  messageBox: {
    padding: "12px 16px",
    borderRadius: "8px",
    fontSize: "14px",
    marginBottom: "24px",
  },
  successBox: {
    backgroundColor: "#d4edda",
    color: "#155724",
  },
  errorBox: {
    backgroundColor: "#f8d7da",
    color: "#721c24",
  },
  loadingBox: {
    backgroundColor: "#e2e3e5",
    color: "#383d41",
  },
  instructions: {
    backgroundColor: "#f8f9fa",
    padding: "16px",
    borderRadius: "8px",
    marginBottom: "24px",
  },
  instructionsTitle: {
    fontSize: "14px",
    fontWeight: "600",
    marginBottom: "12px",
    color: "#333",
  },
  instructionsList: {
    fontSize: "13px",
    color: "#666",
    paddingLeft: "20px",
    margin: 0,
  },
  link: {
    color: "#0066cc",
    textDecoration: "none",
    fontSize: "14px",
  },
  text: {
    fontSize: "14px",
    color: "#666",
  },
};
