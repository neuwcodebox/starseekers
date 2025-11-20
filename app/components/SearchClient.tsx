"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { signIn, signOut, useSession } from "next-auth/react";

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
          <div style={{ color: "var(--text-muted)", fontSize: 12 }}>GitHub 연동 완료</div>
        </div>
      </div>
    );
  }, [session?.user]);

  async function triggerSync() {
    setSyncing(true);
    setMessage(null);
    setProgress({ label: "별표 목록 불러오는 중..." });
    try {
      const response = await fetch("/api/sync", { method: "POST" });
      if (!response.body) {
        setMessage("동기화 스트림을 열 수 없습니다.");
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
              setProgress({ label: "동기화 준비 중..." });
              break;
            }
            case "fetch": {
              setProgress({
                label: `별표 ${event.totalFetched}개 수집 (페이지 ${event.page})`,
              });
              break;
            }
            case "embed": {
              const percent = event.total ? Math.round((event.completed / event.total) * 100) : undefined;
              setProgress({ label: "임베딩 생성 중...", percent });
              break;
            }
            case "upsert": {
              const percent = event.total ? Math.round((event.completed / event.total) * 100) : undefined;
              setProgress({ label: "벡터 저장 중...", percent });
              break;
            }
            case "complete": {
              setMessage(`임베딩 ${event.synced}개 갱신 (총 ${event.total}개 보관)`);
              setProgress({ label: "동기화 완료", percent: 100 });
              break;
            }
            case "error": {
              setMessage(event.message ?? "동기화 실패");
              setProgress(null);
              break;
            }
            default:
              break;
          }
        }
      }
    } catch (error) {
      setMessage(`동기화 중 오류 발생: ${String(error)}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setProgress(null), 1500);
    }
  }

  async function runSearch() {
    if (!query.trim()) {
      setMessage("검색어를 입력하세요.");
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
        setMessage(body.error ?? "검색 실패");
        setResults([]);
        return;
      }
      setResults(body.results ?? []);
    } catch (error) {
      setMessage(`검색 중 오류: ${String(error)}`);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-layout">
      <aside className="sidebar">
        <h3>Filters</h3>
        <div className="filter-group">
          <div className="filter-title">Language</div>
          <div className="filter-options">
            {"JavaScript,TypeScript,Python,Go".split(",").map((lang) => (
              <label className="filter-option" key={lang}>
                <input type="checkbox" disabled />
                <span>{lang}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <div className="filter-title">Stars</div>
          <div className="filter-options">
            {[
              { value: "100", label: "> 100" },
              { value: "50-100", label: "50-100" },
              { value: "<50", label: "< 50" },
            ].map((option) => (
              <label className="filter-option" key={option.value}>
                <input type="radio" name="stars" disabled />
                <span>{option.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <div className="filter-title">Last updated</div>
          <div className="filter-options">
            {["Past month", "Past 6 months", "Past year"].map((label) => (
              <label className="filter-option" key={label}>
                <input type="radio" name="updated" disabled />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="filter-group">
          <div className="filter-title">Tags</div>
          <div className="chip-row">
            <span className="chip">next.js</span>
            <span className="chip">template</span>
            <span className="chip">ai</span>
          </div>
        </div>
        <div className="filter-group" style={{ paddingBottom: 0 }}>
          <div className="filter-title">연동</div>
          <div className="filter-options">
            {!isAuthed && (
              <button className="button" onClick={() => signIn("github")}>GitHub 로그인</button>
            )}
            {isAuthed && (
              <div className="search-actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
                <button className="button" onClick={triggerSync} disabled={syncing}>
                  {syncing ? "동기화 중..." : "별표 목록 동기화"}
                </button>
                <button className="button-ghost" onClick={() => signOut()}>로그아웃</button>
              </div>
            )}
          </div>
        </div>
      </aside>

      <section className="main-area">
        <div className="search-header">
          <div>
            <h2>Search your stars</h2>
            <p>설명, 기술 스택, 용도로 별표 목록을 바로 찾으세요.</p>
          </div>
          <div className="search-actions">
            <span className="pill">Natural language</span>
            <span className="pill">By example repo</span>
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
          <div className="helper-text">
            예: “fast API template with Redis cache” 또는 “TypeScript monorepo boilerplate”
          </div>
        </div>

        <div className="search-actions" style={{ marginTop: 12 }}>
          <button className="button" onClick={runSearch} disabled={disabled || loading}>
            {loading ? "검색 중..." : "검색"}
          </button>
          <div className="badge">OpenAI 임베딩 + Pinecone</div>
          <div className="badge">사용자별 네임스페이스</div>
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
          <select className="select" disabled>
            <option>Sort: Relevance</option>
            <option>Stars</option>
            <option>Last updated</option>
          </select>
        </div>

        <div className="results-grid">
          {loading &&
            Array.from({ length: 4 }).map((_, index) => <div className="skeleton-card" key={index} />)}

          {!loading && results.length === 0 && hasSearched && (
            <div className="empty-state">
              <div style={{ fontSize: 18 }}>✨</div>
              <div>검색어에 맞는 저장소가 없습니다.</div>
              <div className="meta-text">키워드를 더 간단하게 입력해 보세요.</div>
            </div>
          )}

          {!loading && !hasSearched && (
            <div className="empty-state">
              <div style={{ fontSize: 18 }}>🌌</div>
              <div>Start typing a few words about the repo you remember.</div>
              <div className="meta-text">설명, 언어, 토픽 등 무엇이든 좋습니다.</div>
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
                    <span>⭐ {repo.score.toFixed(3)}</span>
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
