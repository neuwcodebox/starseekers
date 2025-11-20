import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/options";
import { fetchStarredRepositories } from "../../lib/github";
import { SyncProgressUpdate, upsertRepositories } from "../../lib/vector-store";

type SyncEvent =
  | { status: "start" }
  | { status: "fetch"; page: number; fetched: number; totalFetched: number }
  | { status: "embed"; completed: number; total: number }
  | { status: "upsert"; completed: number; total: number }
  | { status: "complete"; synced: number; total: number }
  | { status: "error"; message: string };

export async function POST() {
  const session = await getServerSession(authOptions);
  const user = session?.user;

  if (!user || !user.accessToken || !user.id) {
    return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  }

  const encoder = new TextEncoder();

  const { accessToken, id } = user;
  const userId = typeof id === "number" ? id : Number(id);

  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "Invalid GitHub user id." }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const push = (event: SyncEvent) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      };

      try {
        push({ status: "start" });
        const repos = await fetchStarredRepositories(
          accessToken,
          100,
          undefined,
          ({ page, fetched, totalFetched }) => push({ status: "fetch", page, fetched, totalFetched })
        );

        const onProgress = (update: SyncProgressUpdate) => {
          if (update.phase === "embedding") {
            push({ status: "embed", completed: update.completed, total: update.total });
          } else {
            push({ status: "upsert", completed: update.completed, total: update.total });
          }
        };

        const updated = await upsertRepositories(userId, repos, onProgress);

        push({ status: "complete", synced: updated, total: repos.length });
      } catch (error) {
        push({ status: "error", message: error instanceof Error ? error.message : String(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
    },
  });
}
