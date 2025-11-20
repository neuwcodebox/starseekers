import Link from "next/link";
import { getServerSession } from "next-auth";
import { SearchClient } from "./components/SearchClient";
import { authOptions } from "./api/auth/[...nextauth]/options";

export default async function Home() {
  const session = await getServerSession(authOptions);
  const isAuthed = Boolean(session);

  return (
    <div>
      <header className="topbar">
        <div className="brand">
          <span className="star">★</span>
          <span>starseekers</span>
        </div>
        <div className="nav-actions">
          {!isAuthed && (
            <Link href="/api/auth/signin">
              <button className="button">Sign in</button>
            </Link>
          )}
          {isAuthed && (
            <Link href="/api/auth/signout">
              <button className="button-ghost">Sign out</button>
            </Link>
          )}
        </div>
      </header>

      {!isAuthed && (
        <>
          <section className="hero">
            <div className="hero-copy">
              <h1>Search your GitHub stars by meaning</h1>
              <p>
                Forget exact repo names—describe the stack, use case, or what you remember and
                starseekers will surface the right repositories from your stars.
              </p>
              <div className="hero-actions">
                <Link href="/api/auth/signin">
                  <button className="button">Sign in with GitHub</button>
                </Link>
                <a className="button-ghost" href="#demo">
                  View demo
                </a>
              </div>
              <div className="hero-hint">We only read starred repository metadata—no write access.</div>
            </div>

            <div className="mock-panel" id="demo">
              <div className="mock-search">
                <div className="search-bar">
                  <div className="search-input-wrapper">
                    <span className="input-icon">🔍</span>
                    <input
                      className="input"
                      placeholder="e.g. fast API template with Redis cache"
                      disabled
                    />
                  </div>
                </div>
                <div className="glow-card">
                  <h4>
                    <span className="pill">owner / orbit-kit</span>
                    <span className="badge">⭐ 2,140</span>
                  </h4>
                  <p>TypeScript monorepo boilerplate with tRPC, Prisma, and Next.js</p>
                  <div className="chip-row">
                    <span className="chip">next.js</span>
                    <span className="chip">auth</span>
                    <span className="chip">template</span>
                  </div>
                </div>
                <div className="glow-card">
                  <h4>
                    <span className="pill">owner / nova-agent</span>
                    <span className="badge">⭐ 980</span>
                  </h4>
                  <p>LLM agent starter with LangChain, Redis cache, and FastAPI</p>
                  <div className="chip-row">
                    <span className="chip">python</span>
                    <span className="chip">langchain</span>
                    <span className="chip">llm</span>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="hero" id="how-it-works">
            <div className="hero-copy">
              <h2 className="section-title">A focused flow, nothing extra</h2>
              <p className="meta-text">
                Sign in with GitHub → sync starred repositories → semantic search. We skip README
                parsing and embed descriptions, topics, and language for a lightweight experience.
              </p>
              <div className="hero-actions">
                <span className="pill">OpenAI embeddings</span>
                <span className="pill">Pinecone vectors</span>
                <span className="pill">Per-user namespace</span>
              </div>
            </div>
            <div className="mock-panel">
              <div className="glow-card">
                <h4>🔄 Sync</h4>
                <p>Quickly fetch metadata for your starred repositories.</p>
              </div>
              <div className="glow-card">
                <h4>🧠 Embed</h4>
                <p>Vectorize descriptions and topics into your personal space.</p>
              </div>
              <div className="glow-card">
                <h4>🔍 Search</h4>
                <p>Search in natural language and jump straight to GitHub.</p>
              </div>
            </div>
          </section>
        </>
      )}

      {isAuthed && <SearchClient isAuthed={isAuthed} />}
    </div>
  );
}
