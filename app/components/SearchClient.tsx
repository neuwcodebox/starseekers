"use client";

import { useState } from "react";
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

  const disabled = status === "loading" || !isAuthed;

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
    <div className="panel stack">
      <div className="stack">
        <div className="button-row">
          {!isAuthed && (
            <button onClick={() => signIn("github")}>
              GitHub 로그인 후 시작
            </button>
          )}
          {isAuthed && (
            <>
              <button onClick={triggerSync} disabled={syncing}>
                {syncing ? "동기화 중..." : "별표 목록 동기화"}
              </button>
              <button className="secondary" onClick={() => signOut()}>
                로그아웃
              </button>
            </>
          )}
        </div>
        <p className="meta">
          로그인하면 GitHub OAuth 토큰으로 별표한 저장소를 불러와 임베딩을 갱신하고,
          검색 시 사용자별 필터가 적용됩니다.
        </p>
      </div>

      {progress && (
        <div className="progress">
          <div className="progress-bar" style={{ width: `${progress.percent ?? 25}%` }} />
          <div className="progress-label">{progress.label}</div>
        </div>
      )}

      <div className="stack">
        <label className="stack">
          <span>의미 검색어</span>
          <input
            className="input"
            value={query}
            placeholder="예: 이미지 최적화, GraphQL 클라이언트"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                runSearch();
              }
            }}
            disabled={disabled}
          />
        </label>
        <div className="button-row">
          <button onClick={runSearch} disabled={disabled || loading}>
            {loading ? "검색 중..." : "검색"}
          </button>
          {session?.user?.name && (
            <span className="badge">{session.user.name} 님</span>
          )}
        </div>
      </div>

      {message && <div className="alert">{message}</div>}

      {results.length > 0 && (
        <div className="stack">
          <h3>검색 결과</h3>
          <div className="stack">
            {results.map((repo) => (
              <article key={repo.id} className="repo-card">
                <div className="title">
                  <a href={repo.htmlUrl} target="_blank" rel="noreferrer">
                    {repo.fullName}
                  </a>
                  <span className="badge">스코어 {repo.score.toFixed(3)}</span>
                </div>
                <p className="meta">{repo.description}</p>
                <div className="button-row">
                  {repo.language && <span className="badge">{repo.language}</span>}
                  {repo.topics?.slice(0, 4).map((topic) => (
                    <span key={topic} className="badge">
                      {topic}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
