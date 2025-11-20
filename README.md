# Starseekers

GitHub OAuth로 로그인하면 본인이 별표해 둔 저장소를 임베딩하여 의미 기반으로 검색할 수 있는 Next.js 애플리케이션입니다. OpenAI 임베딩과 Pinecone 벡터 인덱스를 이용해 간단한 토이 프로젝트 느낌으로 구성했습니다.

## 주요 기능
- GitHub OAuth로 로그인하여 개인 토큰 획득
- 별표한 저장소 목록을 GitHub API로 동기화 후 Pinecone에 임베딩 저장
- 설명/토픽/언어를 해시로 비교해 변경된 항목만 재생성
- 검색어를 임베딩해 사용자 네임스페이스에서만 벡터 검색 수행
- NextAuth + App Router 기반의 단일 페이지 UI

## 환경 변수
`.env.local` 등에 다음 값을 설정하세요.

```
GITHUB_ID=<github oauth client id>
GITHUB_SECRET=<github oauth client secret>
NEXTAUTH_SECRET=<random string>
NEXTAUTH_URL=http://localhost:3000
OPENAI_API_KEY=<openai key>
PINECONE_API_KEY=<pinecone key>
PINECONE_INDEX=<pinecone index name>
```

## 로컬 실행
```bash
npm install
npm run dev
```

- `/api/sync`를 호출하면 별표 저장소 임베딩을 갱신합니다.
- `/api/search`로 의미 검색을 수행합니다.
- 기본 인덱스 이름은 `PINECONE_INDEX`가 없으면 `starseekers`를 사용합니다.
