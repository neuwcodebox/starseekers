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

function trimText(text: string) {
  return text.trim().slice(0, 4000);
}

export async function embedText(text: string) {
  const openai = getClient();
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: trimText(text),
  });

  return response.data[0]?.embedding ?? [];
}

export async function embedBatch(texts: string[]) {
  if (texts.length === 0) {
    return [] as number[][];
  }

  const openai = getClient();
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: texts.map((text) => trimText(text)),
  });

  return response.data.map((item) => item.embedding ?? []);
}
