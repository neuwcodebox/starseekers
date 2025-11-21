'use client';

import { useSession } from 'next-auth/react';
import { useState } from 'react';

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
  const { status } = useSession();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [progress, setProgress] = useState<SyncProgress | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const disabled = status === 'loading' || !isAuthed;

  async function triggerSync() {
    setSyncing(true);
    setSyncMessage(null);
    setProgress({ label: 'Fetching starred repositories...' });
    try {
      const response = await fetch('/api/sync', { method: 'POST' });
      if (response.status === 429) {
        setSyncMessage('Sync request limit exceeded. Please try again soon.');
        setProgress(null);
        return;
      }

      if (!response.ok) {
        setSyncMessage('Sync failed. Please try again.');
        setProgress(null);
        return;
      }

      if (!response.body) {
        setSyncMessage('Unable to open sync stream.');
        setProgress(null);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }
          const event = JSON.parse(line);
          switch (event.status) {
            case 'start': {
              setProgress({ label: 'Preparing sync...' });
              break;
            }
            case 'fetch': {
              setProgress({
                label: `Fetched ${event.totalFetched} starred repos (page ${event.page})`,
              });
              break;
            }
            case 'embed': {
              const percent = event.total ? Math.round((event.completed / event.total) * 100) : undefined;
              setProgress({ label: 'Creating embeddings...', percent });
              break;
            }
            case 'upsert': {
              const percent = event.total ? Math.round((event.completed / event.total) * 100) : undefined;
              setProgress({ label: 'Saving vectors...', percent });
              break;
            }
            case 'complete': {
              setSyncMessage(`Updated ${event.synced} embeddings (total stored: ${event.total})`);
              setProgress({ label: 'Sync complete', percent: 100 });
              break;
            }
            case 'error': {
              setSyncMessage(event.message ?? 'Sync failed');
              setProgress(null);
              break;
            }
            default:
              break;
          }
        }
      }
    } catch (error) {
      setSyncMessage(`Sync error: ${String(error)}`);
    } finally {
      setSyncing(false);
      setTimeout(() => setProgress(null), 1500);
    }
  }

  async function runSearch() {
    if (!query.trim()) {
      setSearchMessage('Enter a search query.');
      return;
    }
    setLoading(true);
    setHasSearched(true);
    setSearchMessage(null);
    try {
      const response = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });
      const body = await response.json().catch(() => null);

      if (response.status === 429) {
        setSearchMessage('Search request limit exceeded. Please try again soon.');
        setResults([]);
        return;
      }

      if (!response.ok) {
        setSearchMessage(body?.error ?? 'Search failed');
        setResults([]);
        return;
      }
      setResults(body.results ?? []);
    } catch (error) {
      setSearchMessage(`Search error: ${String(error)}`);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-layout">
      <section className="sync-panel">
        <div className="sidebar-section">
          <h3>Repository sync</h3>
          <p className="meta-text" style={{ margin: 0 }}>
            Keep your starred repository metadata up to date.
          </p>

          {progress && (
            <div className="progress">
              <div className="progress-bar" style={{ width: `${progress.percent ?? 25}%` }} />
              <div className="progress-label">{progress.label}</div>
            </div>
          )}

          {syncMessage && <div className="info-banner">{syncMessage}</div>}

          <div className="sidebar-actions">
            <button className="button" type="button" onClick={triggerSync} disabled={syncing}>
              {syncing ? 'Syncing...' : 'Sync starred repositories'}
            </button>
          </div>
        </div>
      </section>

      <section className="main-area">
        <div className="search-header">
          <div>
            <h2>Search your stars</h2>
            <p>Use plain language to find starred repositories by description, stack, or use case.</p>
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
                if (event.key === 'Enter') {
                  runSearch();
                }
              }}
              disabled={disabled}
            />
          </div>

          <button className="button search-button" type="button" onClick={runSearch} disabled={disabled || loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        {searchMessage && <div className="info-banner">{searchMessage}</div>}

        <div className="result-meta">
          <span>
            Results · {results.length} repositories
            {hasSearched && results.length === 0 && ' (no matches)'}
          </span>
          <span className="pill">Sorted by relevance</span>
        </div>

        <div className="results-grid">
          {loading && ['a', 'b', 'c', 'd'].map((key) => <div className="skeleton-card" key={key} />)}

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
              const [owner, name] = repo.fullName.split('/');
              const language = repo.language?.trim();
              const topics = repo.topics?.filter(Boolean) ?? [];
              const hasTopics = topics.length > 0;
              return (
                <article key={repo.id} className="repo-card">
                  <div className="title-row">
                    <a className="repo-title" href={repo.htmlUrl} target="_blank" rel="noreferrer">
                      <div className="owner">{owner}</div>
                      <div className="name">{name}</div>
                    </a>

                    <span className="score-badge">Score {repo.score.toFixed(3)}</span>
                  </div>

                  {repo.description && <p className="description">{repo.description}</p>}

                  {language || hasTopics ? (
                    <div className="repo-meta">
                      {language && <span className="chip">{language}</span>}
                      {hasTopics && (
                        <span className="topics-text">
                          <span className="topics-list">{topics.join(' • ')}</span>
                        </span>
                      )}
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
