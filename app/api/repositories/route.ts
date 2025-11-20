import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "../auth/[...nextauth]/options";
import { fetchStarredRepositories } from "../../lib/github";

export async function GET() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.accessToken) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const repos = await fetchStarredRepositories(session.user.accessToken);
  return NextResponse.json({ repos });
}
