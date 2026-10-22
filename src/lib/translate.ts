import "server-only";
import { LANGS, type Lang } from "@/lib/types";

type Provider = "openai" | "gemini" | "mock";

function pickProvider(): Provider {
  const forced = process.env.TRANSLATE_PROVIDER as Provider | undefined;
  if (forced) return forced;
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.GEMINI_API_KEY) return "gemini";
  return "mock";
}

function systemPrompt(lang: Lang) {
  const target = LANGS.find((l) => l.code === lang)!.name;
  return [
    `You are a professional translator for a school. Translate the teacher's note about a student into ${target}.`,
    "Keep the meaning, tone and any names exactly. Use natural, respectful school language.",
    "If the text is already in the target language, return it lightly corrected.",
    "Return ONLY the translated text, no quotes, no explanations.",
  ].join(" ");
}

async function viaOpenAI(text: string, lang: Lang) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt(lang) },
        { role: "user", content: text },
      ],
    }),
  });
  if (!res.ok) throw new Error(`OpenAI hatası (${res.status})`);
  const data = await res.json();
  return String(data.choices?.[0]?.message?.content ?? "").trim();
}

async function viaGemini(text: string, lang: Lang) {
  const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": process.env.GEMINI_API_KEY!,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt(lang) }] },
        contents: [{ role: "user", parts: [{ text }] }],
        generationConfig: { temperature: 0.2 },
      }),
    },
  );
  if (!res.ok) throw new Error(`Gemini hatası (${res.status})`);
  const data = await res.json();
  return String(data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
}

/** API anahtarı yokken arayüzü test etmek için sahte çeviri. */
async function viaMock(text: string, lang: Lang) {
  return `[${lang.toUpperCase()} · demo çeviri] ${text}`;
}

export async function translateText(text: string, lang: Lang): Promise<{ text: string; provider: Provider }> {
  const provider = pickProvider();
  const fn = provider === "openai" ? viaOpenAI : provider === "gemini" ? viaGemini : viaMock;
  const out = await fn(text, lang);
  if (!out) throw new Error("Boş çeviri döndü");
  return { text: out, provider };
}
