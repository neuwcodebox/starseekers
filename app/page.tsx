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
        <div className="nav-links">
          <a href="#how-it-works">How it works</a>
          <a href="https://github.com" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </div>
        <div className="nav-actions">
          {!isAuthed && (
            <Link href="/api/auth/signin">
              <button className="button">Sign in</button>
            </Link>
          )}
          {isAuthed && (
            <Link href="/api/auth/signout">
              <button className="button-ghost">로그아웃</button>
            </Link>
          )}
        </div>
      </header>

      {!isAuthed && (
        <>
          <section className="hero">
            <div className="hero-copy">
              <div className="badge">GitHub 개발자를 위한 의미 기반 검색</div>
              <h1>Search your GitHub stars by meaning</h1>
              <p>
                저장소 이름이 기억나지 않아도 걱정하지 마세요. 기억나는 설명, 기술 스택,
                용도를 적으면 starseekers가 별표한 저장소에서 가장 맞는 결과를 찾아줍니다.
              </p>
              <div className="hero-actions">
                <Link href="/api/auth/signin">
                  <button className="button">Sign in with GitHub</button>
                </Link>
                <a className="button-ghost" href="#demo">
                  View demo
                </a>
              </div>
              <div className="hero-hint">우리는 별표한 저장소 메타데이터만 읽으며, 쓰기 권한은 없습니다.</div>
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
                  <div className="helper-text">새로운 인터페이스로 달라진 검색 미리보기</div>
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
              <h2 className="section-title">딱 필요한 흐름만 단순하게</h2>
              <p className="meta-text">
                GitHub OAuth로 로그인 → 별표한 저장소 동기화 → 의미 기반 검색. README까지 파싱하지
                않고 설명/토픽/언어만 임베딩해 가볍게 동작합니다.
              </p>
              <div className="hero-actions">
                <span className="pill">OpenAI 임베딩</span>
                <span className="pill">Pinecone 벡터</span>
                <span className="pill">개인 네임스페이스</span>
              </div>
            </div>
            <div className="mock-panel">
              <div className="glow-card">
                <h4>🔄 Sync</h4>
                <p>별표한 저장소 메타데이터를 빠르게 불러옵니다.</p>
              </div>
              <div className="glow-card">
                <h4>🧠 Embed</h4>
                <p>설명/토픽을 벡터화하여 개인 공간에 저장합니다.</p>
              </div>
              <div className="glow-card">
                <h4>🔍 Search</h4>
                <p>자연어로 검색하고 바로 GitHub로 이동하세요.</p>
              </div>
            </div>
          </section>
        </>
      )}

      {isAuthed && <SearchClient isAuthed={isAuthed} />}
    </div>
  );
}
