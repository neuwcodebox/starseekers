"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { signOut, useSession } from "next-auth/react";

type SyncProgress = {
  label: string;
  percent?: number;
};

export type SearchResult = {
  id: string;
  score: number;
  fullName: string;
  description: string;
  htmlUrl: string;
  language?: string | null;
  topics?: string[];
};

export function SearchClient({ isAuthed }: { isAuthed: boolean }) {
  const { data: session, status } = useSession();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const disabled = status === "loading" || !isAuthed;

  const userTag = useMemo(() => {
    if (!session?.user) return null;
    const avatar = session.user.image ? (
      <Image src={session.user.image} alt="avatar" className="small-avatar" width={32} height={32} />
    ) : (
      <div className="small-avatar" style={{ background: "rgba(255,255,255,0.08)" }} />
    );
    return (
      <div className="user-tag">
        {avatar}
        <div>
          <div>{session.user.name ?? session.user.email}</div>
          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>Connected to GitHub</div>
        </div>
      </div>
    );
  }, [session?.user]);

  async function triggerSync() {
    setSyncing(true);
    setMessage(null);
    setProgress({ label: "Fetching starred repositories..." });
    try {
      const response = await fetch("/api/sync", { method: "POST" });
      if (!response.body) {
        setMessage("Unable to open sync stream.");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line);
          switch (event.status) {
            case "start": {
              setProgress({ label: "Preparing sync..." });
              break;
            }
            case "fetch": {
              setProgress({
                label: `Fetched ${event.totalFetched} starred repos (page ${event.page})`,
              });
              break;
            }
            case "embed": {
              const percent = event.total ? Math.round((event.completed / event.total) * 100) : undefined;
              setProgress({ label: "Creating embeddings...", percent });
              break;
            }
            case "upsert": {
              const percent = event.total ? Math.round((event.completed / event.total) * 100) : undefined;
              setProgress({ label: "Saving vectors...", percent });
              break;
            }
            case "complete": {
              setMessage(`Updated ${event.synced} embeddings (total stored: ${event.total})`);
              setProgress({ label: "Sync complete", percent: 100 });
              break;
            }
            case "error": {
              setMessage(event.message ?? "Sync failed");
              setProgress(null);
              break;
            }
            default:
              break;
          }
        }
      }
    } catch (error) {
      setMessage(`Sync error: ${String(error)}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setProgress(null), 1500);
    }
  }

  async function runSearch() {
    if (!query.trim()) {
      setMessage("Enter a search query.");
      return;
    }
    setLoading(true);
    setHasSearched(true);
    setMessage(null);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
      });
      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error ?? "Search failed");
        setResults([]);
        return;
      }
      setResults(body.results ?? []);
    } catch (error) {
      setMessage(`Search error: ${String(error)}`);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <h3>Repository sync</h3>
        <p className="meta-text" style={{ margin: 0 }}>
          Keep your starred repository metadata up to date.
        </p>
        <div className="sidebar-actions">
          <button className="button" onClick={triggerSync} disabled={syncing}>
            {syncing ? "Syncing..." : "Sync starred repositories"}
          </button>
          <button className="button-ghost" onClick={() => signOut()}>
            Sign out
          </button>
        </div>
      </aside>

      <section className="main-area">
        <div className="search-header">
          <div>
            <h2>Search your stars</h2>
            <p>Use plain language to find starred repositories by description, stack, or use case.</p>
          </div>
          <div className="search-actions">
            {userTag}
          </div>
        </div>

        <div className="search-bar">
          <div className="search-input-wrapper">
            <span className="input-icon">🔍</span>
            <input
              className="input"
              value={query}
              placeholder="Search by description, tech stack, or use case..."
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  runSearch();
                }
              }}
              disabled={disabled}
            />
          </div>
        </div>

        <div className="search-actions" style={{ marginTop: 12 }}>
          <button className="button" onClick={runSearch} disabled={disabled || loading}>
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        {progress && (
          <div className="progress">
            <div className="progress-bar" style={{ width: `${progress.percent ?? 25}%` }} />
            <div className="progress-label">{progress.label}</div>
          </div>
        )}

        {message && <div className="info-banner">{message}</div>}

        <div className="result-meta">
          <span>
            Results · {results.length} repositories
            {hasSearched && results.length === 0 && " (no matches)"}
          </span>
          <span className="pill">Sorted by relevance</span>
        </div>

        <div className="results-grid">
          {loading &&
            Array.from({ length: 4 }).map((_, index) => <div className="skeleton-card" key={index} />)}

          {!loading && results.length === 0 && hasSearched && (
            <div className="empty-state">
              <div style={{ fontSize: 18 }}>✨</div>
              <div>No repositories match this query.</div>
              <div className="meta-text">Try fewer keywords or a broader description.</div>
            </div>
          )}

          {!loading && !hasSearched && (
            <div className="empty-state">
              <div style={{ fontSize: 18 }}>🌌</div>
              <div>Start typing a few words about the repo you remember.</div>
              <div className="meta-text">Description, language, topics—anything helps.</div>
            </div>
          )}

          {!loading &&
            results.map((repo) => {
              const [owner, name] = repo.fullName.split("/");
              return (
                <article key={repo.id} className="repo-card">
                  <div className="title-row">
                    <div>
                      <div className="owner">{owner}</div>
                      <div className="name">{name}</div>
                    </div>
                    <a className="button-ghost" href={repo.htmlUrl} target="_blank" rel="noreferrer">
                      Open on GitHub
                    </a>
                  </div>

                  {repo.description && <p className="description">{repo.description}</p>}

                  <div className="repo-meta">
                    {repo.language && <span className="chip">{repo.language}</span>}
                    <span className="score-badge">Score {repo.score.toFixed(3)}</span>
                    {repo.topics?.length ? <span>{repo.topics.slice(0, 4).join(" · ")}</span> : null}
                  </div>

                  {repo.topics?.length ? (
                    <div className="chip-row">
                      {repo.topics.slice(0, 6).map((topic) => (
                        <span key={topic} className="chip">
                          {topic}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </article>
              );
            })}
        </div>
      </section>
    </div>
  );
}
