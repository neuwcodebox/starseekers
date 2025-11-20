import crypto from "crypto";

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

export function hashText(text: string) {
  return crypto.createHash("sha256").update(text).digest("hex");
}

export async function fetchStarredRepositories(
  accessToken: string,
  perPage = 100,
  maxPages = 5
): Promise<StarredRepo[]> {
  const repos: StarredRepo[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const response = await fetch(
      `https://api.github.com/user/starred?per_page=${perPage}&page=${page}`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${accessToken}`,
          "X-GitHub-Api-Version": "2022-11-28",
        },
        cache: "no-store",
      }
    );

    if (response.status === 401) {
      throw new Error("GitHub 토큰이 만료되었거나 권한이 없습니다.");
    }

    if (!response.ok) {
      throw new Error(`GitHub API 요청 실패: ${response.statusText}`);
    }

    const payload = (await response.json()) as GitHubRepoResponse[];

    repos.push(
      ...payload.map((repo) => ({
        id: repo.id,
        fullName: repo.full_name,
        description: repo.description ?? "(설명 없음)",
        htmlUrl: repo.html_url,
        language: repo.language,
        topics: repo.topics ?? [],
        updatedAt: repo.updated_at,
      }))
    );

    if (payload.length < perPage) {
      break;
    }
  }

  return repos;
}
