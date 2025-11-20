import OpenAI from "openai";

let client: OpenAI | null = null;

function getClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY가 설정되어 있지 않습니다.");
  }

  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  return client;
}

export async function embedText(text: string) {
  const openai = getClient();

  const embeddingText = text.trim().slice(0, 4000);
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: embeddingText,
  });

  return response.data[0]?.embedding ?? [];
}
