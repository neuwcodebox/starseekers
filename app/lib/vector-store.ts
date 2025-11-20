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

type ExistingRecord = {
  hash?: string;
  starredBy?: string[];
};

async function fetchExistingRecords(
  repoIds: string[]
): Promise<Record<string, ExistingRecord>> {
  const client = getClient();
  const index = client.Index(indexName);
  const known: Record<string, ExistingRecord> = {};

  for (let i = 0; i < repoIds.length; i += 100) {
    const slice = repoIds.slice(i, i + 100);
    const existing = await index.fetch({ ids: slice });
    Object.entries(existing.records ?? {}).forEach(([id, record]) => {
      const hash = record.metadata?.hash as string | undefined;
      const starredBy = record.metadata?.starredBy as string[] | undefined;
      known[id] = { hash, starredBy };
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
  const index = client.Index(indexName);
  const repoIds = repos.map((repo) => repo.id.toString());
  const known = await fetchExistingRecords(repoIds);
  const currentRepoIdSet = new Set(repoIds);

  const records = [] as {
    id: string;
    values: number[];
    metadata: Record<string, unknown>;
  }[];

  const metadataUpdates: { id: string; starredBy: string[] }[] = [];

  for (const repo of repos) {
    const text = buildEmbeddingText(repo);
    const hash = hashText(text);
    const existing = known[repo.id.toString()];
    const starredBy = new Set(existing?.starredBy ?? []);
    const hadUser = starredBy.has(userId);
    starredBy.add(userId);

    if (existing?.hash === hash) {
      if (!hadUser) {
        metadataUpdates.push({ id: repo.id.toString(), starredBy: [...starredBy] });
      }
      continue;
    }

    const values = await embedText(text);
    records.push({
      id: repo.id.toString(),
      values,
      metadata: {
        fullName: repo.fullName,
        description: repo.description,
        htmlUrl: repo.htmlUrl,
        language: repo.language,
        topics: repo.topics,
        hash,
        starredBy: [...starredBy],
      },
    });
  }

  if (records.length > 0) {
    await index.upsert(records);
  }

  if (metadataUpdates.length > 0) {
    await Promise.all(
      metadataUpdates.map((update) =>
        index.update({ id: update.id, setMetadata: { starredBy: update.starredBy } })
      )
    );
  }

  // Remove user association from repositories that are no longer starred
  const probeVector =
    records[0]?.values ??
    (await embedText("probe vector"));

  const existingUserAssociations = await index.query({
    vector: probeVector,
    topK: 10000,
    filter: { starredBy: { $in: [userId] } },
    includeMetadata: true,
  });

  const detaches = (existingUserAssociations.matches ?? []).filter(
    (match) => !currentRepoIdSet.has(match.id)
  );

  if (detaches.length > 0) {
    await Promise.all(
      detaches.map((match) => {
        const starredBy = (match.metadata?.starredBy as string[] | undefined) ?? [];
        const updatedStarredBy = starredBy.filter((id) => id !== userId);
        return index.update({ id: match.id, setMetadata: { starredBy: updatedStarredBy } });
      })
    );
  }

  return records.length;
}

export async function queryByEmbedding(
  userId: string,
  vector: number[],
  topK = 8
): Promise<VectorSearchResult[]> {
  const client = getClient();
  const index = client.Index(indexName);
  const response = await index.query({
    vector,
    topK,
    includeMetadata: true,
    filter: { starredBy: { $in: [userId] } },
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
