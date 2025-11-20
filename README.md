# Starseekers

Starseekers is a Next.js application that embeds your starred GitHub repositories and lets you run semantic search across them. It uses OpenAI embeddings and a Pinecone vector index to stay lightweight and fast.

## Features
- Sign in with GitHub OAuth to obtain a user token
- Sync the starred repository list via the GitHub API and store embeddings in Pinecone
- Hash description/topic/language to regenerate only changed items
- Embed queries and search vectors within a per-user namespace
- Single-page UI powered by NextAuth and the App Router

## Environment variables
Set the following values in `.env.local` (or similar):

```
GITHUB_ID=<github oauth client id>
GITHUB_SECRET=<github oauth client secret>
NEXTAUTH_SECRET=<random string>
NEXTAUTH_URL=http://localhost:3000
OPENAI_API_KEY=<openai key>
PINECONE_API_KEY=<pinecone key>
PINECONE_INDEX=<pinecone index name>
```

## Local development
```bash
npm install
npm run dev
```

- Call `/api/sync` to refresh embeddings for starred repositories.
- Call `/api/search` to perform semantic search.
- If `PINECONE_INDEX` is not set, the default index name `starseekers` is used.
