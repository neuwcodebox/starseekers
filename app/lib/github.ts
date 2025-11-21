import crypto from 'node:crypto';

type GitHubRepoResponse = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  topics?: string[];
  updated_at?: string;
};

export type StarredRepo = {
  id: number;
  fullName: string;
  description: string;
  htmlUrl: string;
  language: string | null;
  topics: string[];
  updatedAt?: string;
};

type FetchProgress = {
  page: number;
  fetched: number;
  totalFetched: number;
};

export function hashText(text: string) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export async function fetchStarredRepositories(
  accessToken: string,
  perPage = 100,
  maxPages?: number,
  onProgress?: (progress: FetchProgress) => void,
): Promise<StarredRepo[]> {
  const repos: StarredRepo[] = [];

  for (let page = 1; !maxPages || page <= maxPages; page += 1) {
    const response = await fetch(`https://api.github.com/user/starred?per_page=${perPage}&page=${page}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${accessToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      cache: 'no-store',
    });

    if (response.status === 401) {
      throw new Error('GitHub token expired or lacks permissions.');
    }

    if (!response.ok) {
      throw new Error(`GitHub API request failed: ${response.statusText}`);
    }

    const payload = (await response.json()) as GitHubRepoResponse[];

    repos.push(
      ...payload.map((repo) => ({
        id: repo.id,
        fullName: repo.full_name,
        description: repo.description ?? '(no description)',
        htmlUrl: repo.html_url,
        language: repo.language,
        topics: repo.topics ?? [],
        updatedAt: repo.updated_at,
      })),
    );

    onProgress?.({ page, fetched: payload.length, totalFetched: repos.length });

    if (payload.length < perPage) {
      break;
    }
  }

  return repos;
}
