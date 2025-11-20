import { Pinecone } from "@pinecone-database/pinecone";
import { embedText } from "./embeddings";
import { StarredRepo, hashText } from "./github";

const indexName = process.env.PINECONE_INDEX ?? "starseekers";

function getClient() {
  if (!process.env.PINECONE_API_KEY) {
    throw new Error("PINECONE_API_KEY가 설정되어 있지 않습니다.");
  }
  return new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
}

async function fetchExistingHashes(
  userId: string,
  repoIds: string[]
): Promise<Record<string, string>> {
  const client = getClient();
  const index = client.Index(indexName).namespace(userId);
  const known: Record<string, string> = {};

  for (let i = 0; i < repoIds.length; i += 100) {
    const slice = repoIds.slice(i, i + 100);
    const existing = await index.fetch({ ids: slice });
    Object.entries(existing.records ?? {}).forEach(([id, record]) => {
      const hash = record.metadata?.hash as string | undefined;
      if (hash) {
        known[id] = hash;
      }
    });
  }

  return known;
}

export type VectorSearchResult = {
  id: string;
  score: number;
  fullName: string;
  description: string;
  htmlUrl: string;
  language?: string | null;
  topics?: string[];
};

function buildEmbeddingText(repo: StarredRepo) {
  const topicLine = repo.topics.length > 0 ? `\n토픽: ${repo.topics.join(", ")}` : "";
  const languageLine = repo.language ? `\n언어: ${repo.language}` : "";
  return `${repo.fullName}\n${repo.description}${languageLine}${topicLine}`;
}

export async function upsertRepositories(userId: string, repos: StarredRepo[]) {
  if (!repos.length) {
    return 0;
  }

  const client = getClient();
  const index = client.Index(indexName).namespace(userId);
  const repoIds = repos.map((repo) => repo.id.toString());
  const known = await fetchExistingHashes(userId, repoIds);

  const records = [] as {
    id: string;
    values: number[];
    metadata: Record<string, unknown>;
  }[];

  for (const repo of repos) {
    const text = buildEmbeddingText(repo);
    const hash = hashText(text);
    if (known[repo.id.toString()] === hash) {
      continue;
    }

    const values = await embedText(text);
    records.push({
      id: repo.id.toString(),
      values,
      metadata: {
        userId,
        fullName: repo.fullName,
        description: repo.description,
        htmlUrl: repo.htmlUrl,
        language: repo.language,
        topics: repo.topics,
        hash,
      },
    });
  }

  if (records.length > 0) {
    await index.upsert(records);
  }

  return records.length;
}

export async function queryByEmbedding(
  userId: string,
  vector: number[],
  topK = 8
): Promise<VectorSearchResult[]> {
  const client = getClient();
  const index = client.Index(indexName).namespace(userId);
  const response = await index.query({
    vector,
    topK,
    includeMetadata: true,
    filter: { userId },
  });

  return (
    response.matches?.map((match) => ({
      id: match.id,
      score: match.score ?? 0,
      fullName: (match.metadata?.fullName as string) ?? "",
      description: (match.metadata?.description as string) ?? "",
      htmlUrl: (match.metadata?.htmlUrl as string) ?? "",
      language: match.metadata?.language as string | null,
      topics: (match.metadata?.topics as string[]) ?? [],
    })) ?? []
  );
}
