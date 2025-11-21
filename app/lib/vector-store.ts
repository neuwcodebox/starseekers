import { Pinecone, type PineconeRecord } from '@pinecone-database/pinecone';
import { embedBatch, embedText } from './embeddings';
import { hashText, type StarredRepo } from './github';

const indexName = process.env.PINECONE_INDEX ?? 'starseekers';
// Pinecone upsert requests are limited to 2MB; batch uploads to stay below the limit.
const UPSERT_BATCH_SIZE = 40;
const EMBEDDING_BATCH_SIZE = 20;

function getClient() {
  if (!process.env.PINECONE_API_KEY) {
    throw new Error('PINECONE_API_KEY is not configured.');
  }
  return new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
}

type ExistingRecord = {
  hash?: string;
  starredBy?: string[];
};

type RepoMetadata = {
  fullName: string;
  description: string;
  htmlUrl: string;
  hash: string;
  starredBy: string[];
  topics: string[];
  language?: string;
};

export type SyncProgressUpdate = {
  phase: 'embedding' | 'upserting';
  completed: number;
  total: number;
};

async function fetchExistingRecords(repoIds: string[]): Promise<Record<string, ExistingRecord>> {
  const client = getClient();
  const index = client.index<RepoMetadata>(indexName);
  const known: Record<string, ExistingRecord> = {};

  for (let i = 0; i < repoIds.length; i += 100) {
    const slice = repoIds.slice(i, i + 100);
    const existing = await index.fetch(slice);
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
  const topicLine = repo.topics.length > 0 ? `\nTopics: ${repo.topics.join(', ')}` : '';
  const languageLine = repo.language ? `\nLanguage: ${repo.language}` : '';
  return `${repo.fullName}\n${repo.description}${languageLine}${topicLine}`;
}

export async function upsertRepositories(
  userId: string,
  repos: StarredRepo[],
  onProgress?: (update: SyncProgressUpdate) => void,
) {
  if (!repos.length) {
    return 0;
  }

  const client = getClient();
  const index = client.index<RepoMetadata>(indexName);
  const repoIds = repos.map((repo) => repo.id.toString());
  const known = await fetchExistingRecords(repoIds);
  const currentRepoIdSet = new Set(repoIds);

  const records: PineconeRecord<RepoMetadata>[] = [];
  const metadataUpdates: { id: string; starredBy: string[]; hash: string }[] = [];

  const toEmbed: {
    repo: StarredRepo;
    hash: string;
    starredBy: Set<string>;
  }[] = [];

  for (const repo of repos) {
    const text = buildEmbeddingText(repo);
    const hash = hashText(text);
    const existing = known[repo.id.toString()];
    const starredBy = new Set(existing?.starredBy ?? []);
    const hadUser = starredBy.has(userId);
    starredBy.add(userId);

    const hashUnchanged = existing?.hash === hash;

    if (hashUnchanged) {
      // If the content hash is unchanged, reuse the stored embedding and only refresh metadata.
      if (!hadUser) {
        metadataUpdates.push({
          id: repo.id.toString(),
          starredBy: Array.from(starredBy),
          hash,
        });
      }
      continue;
    }

    toEmbed.push({ repo, hash, starredBy });
  }

  let embeddedCount = 0;
  for (let i = 0; i < toEmbed.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = toEmbed.slice(i, i + EMBEDDING_BATCH_SIZE);
    const values = await embedBatch(batch.map((item) => buildEmbeddingText(item.repo)));

    values.forEach((embedding, index) => {
      const item = batch[index];
      const metadata: RepoMetadata = {
        fullName: item.repo.fullName,
        description: item.repo.description,
        htmlUrl: item.repo.htmlUrl,
        topics: item.repo.topics,
        hash: item.hash,
        starredBy: Array.from(item.starredBy),
      };

      if (item.repo.language) {
        metadata.language = item.repo.language;
      }

      records.push({
        id: item.repo.id.toString(),
        values: embedding,
        metadata,
      });
    });

    embeddedCount += batch.length;
    onProgress?.({ phase: 'embedding', completed: embeddedCount, total: toEmbed.length });
  }

  if (records.length > 0) {
    for (let i = 0; i < records.length; i += UPSERT_BATCH_SIZE) {
      const batch = records.slice(i, i + UPSERT_BATCH_SIZE);
      await index.upsert(batch);
      onProgress?.({
        phase: 'upserting',
        completed: Math.min(i + UPSERT_BATCH_SIZE, records.length),
        total: records.length,
      });
    }
  }

  if (metadataUpdates.length > 0) {
    await Promise.all(
      metadataUpdates.map((update) =>
        index.update({ id: update.id, metadata: { starredBy: update.starredBy, hash: update.hash } }),
      ),
    );
  }

  // Remove user association from repositories that are no longer starred
  const probeVector = records[0]?.values ?? (await embedText('probe vector'));

  while (true) {
    const existingUserAssociations = await index.query({
      vector: probeVector,
      topK: 10000,
      filter: { starredBy: { $in: [userId] } },
      includeMetadata: true,
    });

    const detaches = (existingUserAssociations.matches ?? []).filter((match) => !currentRepoIdSet.has(match.id));

    if (detaches.length === 0) {
      break;
    }

    await Promise.all(
      detaches.map((match) => {
        const starredBy = (match.metadata?.starredBy as string[] | undefined) ?? [];
        const updatedStarredBy = starredBy.filter((id) => id !== userId);
        const metadata: Pick<RepoMetadata, 'starredBy'> = {
          starredBy: updatedStarredBy,
        };

        return index.update({ id: match.id, metadata });
      }),
    );
  }

  return records.length;
}

export async function queryByEmbedding(userId: string, vector: number[], topK = 8): Promise<VectorSearchResult[]> {
  const client = getClient();
  const index = client.index<RepoMetadata>(indexName);
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
      fullName: (match.metadata?.fullName as string) ?? '',
      description: (match.metadata?.description as string) ?? '',
      htmlUrl: (match.metadata?.htmlUrl as string) ?? '',
      language: match.metadata?.language as string | null,
      topics: (match.metadata?.topics as string[]) ?? [],
    })) ?? []
  );
}
