import Link from "next/link";
import { getServerSession } from "next-auth";
import { SearchClient } from "./components/SearchClient";
import { authOptions } from "./api/auth/[...nextauth]/options";

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <div className="stack">
      <section className="panel stack">
        <div className="stack">
          <h2>GitHub 별표 저장소 의미 검색</h2>
          <p className="meta">
            로그인 후 별표한 저장소를 동기화하면 벡터 검색으로 원하는 라이브러리를 더 쉽게
            찾을 수 있습니다. README까지 인덱싱하지 않고 설명/토픽/언어를 이용한 임베딩만
            사용해 가벼운 토이 프로젝트 형태로 구성했습니다.
          </p>
        </div>
        <div className="button-row">
          {!session && (
            <Link href="/api/auth/signin">
              <button>GitHub OAuth 로그인</button>
            </Link>
          )}
          {session && (
            <Link href="/api/auth/signout">
              <button className="secondary">로그아웃</button>
            </Link>
          )}
          <span className="badge">OpenAI 임베딩 + Pinecone</span>
          <span className="badge">사용자별 네임스페이스</span>
        </div>
      </section>

      <SearchClient isAuthed={Boolean(session)} />

      <section className="panel stack">
        <h3>환경 변수</h3>
        <ul>
          <li>GITHUB_ID / GITHUB_SECRET: OAuth 앱에서 발급</li>
          <li>OPENAI_API_KEY: text-embedding-3-small 사용</li>
          <li>PINECONE_API_KEY, PINECONE_INDEX: 벡터 인덱스 설정</li>
          <li>NEXTAUTH_SECRET, NEXTAUTH_URL: NextAuth 세션을 위해 필요</li>
        </ul>
        <p className="meta">
          최초 동기화 시 모든 별표 저장소에 대한 임베딩을 생성하고, 이후 설명/토픽이
          변경된 것만 해시 비교로 갱신합니다. 검색은 사용자 네임스페이스에서만 수행해
          개인별 결과가 섞이지 않습니다.
        </p>
      </section>
    </div>
  );
}
