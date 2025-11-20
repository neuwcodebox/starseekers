import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "../auth/[...nextauth]/options";
import { embedText } from "../../lib/embeddings";
import { queryByEmbedding } from "../../lib/vector-store";

const schema = z.object({
  query: z.string().min(2),
  topK: z.number().min(1).max(20).optional(),
});

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Sign-in required." }, { status: 401 });
  }

  const userId =
    typeof session.user.id === "number" ? session.user.id : Number(session.user.id);

  if (!Number.isFinite(userId)) {
    return NextResponse.json({ error: "Invalid GitHub user id." }, { status: 400 });
  }

  const payload = await request.json();
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Query must be at least 2 characters." }, { status: 400 });
  }

  const { query, topK = 8 } = parsed.data;
  const embedding = await embedText(query);
  const results = await queryByEmbedding(userId, embedding, topK);

  return NextResponse.json({ results });
}
