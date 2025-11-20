import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function embedText(text: string) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY가 설정되어 있지 않습니다.");
  }

  const embeddingText = text.trim().slice(0, 4000);
  const response = await client.embeddings.create({
    model: "text-embedding-3-small",
    input: embeddingText,
  });

  return response.data[0]?.embedding ?? [];
}
