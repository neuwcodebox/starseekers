import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/options";
import { fetchStarredRepositories } from "../../lib/github";
import { upsertRepositories } from "../../lib/vector-store";

export async function POST() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.accessToken || !session.user.id) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const repos = await fetchStarredRepositories(session.user.accessToken);
  const updated = await upsertRepositories(session.user.id, repos);

  return NextResponse.json({ synced: updated, total: repos.length });
}
