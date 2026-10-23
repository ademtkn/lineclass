import "server-only";
import { LANGS, type Lang } from "@/lib/types";

type Provider = "gemini" | "deepseek" | "openai" | "mock";

const KEYS: Record<Exclude<Provider, "mock">, string> = {
  gemini: "GEMINI_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
  openai: "OPENAI_API_KEY",
};

/** Sıra: önce ücretsiz katmanı olan Gemini, sonra ucuz DeepSeek, sonra OpenAI. TRANSLATE_PROVIDER ile zorlanabilir. */
function providers(): Provider[] {
  const forced = process.env.TRANSLATE_PROVIDER as Provider | undefined;
  if (forced) return [forced];
  const configured = (Object.keys(KEYS) as (keyof typeof KEYS)[]).filter((p) => process.env[KEYS[p]]);
  return configured.length ? configured : ["mock"];
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

/** OpenAI uyumlu sohbet API'si (OpenAI ve DeepSeek aynı biçimi kullanır). */
async function viaChatApi(name: string, url: string, key: string, model: string, text: string, lang: Lang) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt(lang) },
        { role: "user", content: text },
      ],
    }),
  });
  if (!res.ok) throw new Error(`${name} hatası (${res.status})`);
  const data = await res.json();
  return String(data.choices?.[0]?.message?.content ?? "").trim();
}

/** Ücretsiz katmanda modeller sık "yoğun talep" (503) verir: sırayla denenir. Lite modeller daha az yoğun. */
const GEMINI_MODELS = ["gemini-3.1-flash-lite", "gemini-flash-lite-latest", "gemini-flash-latest", "gemini-3.5-flash"];

async function geminiOnce(model: string, text: string, lang: Lang) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt(lang) }] },
      contents: [{ role: "user", parts: [{ text }] }],
      generationConfig: { temperature: 0.2 },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`Gemini ${model} hatası (${res.status})`);
  const data = await res.json();
  return String(data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
}

async function viaGemini(text: string, lang: Lang) {
  const models = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL, ...GEMINI_MODELS] : GEMINI_MODELS;
  let lastError: unknown;
  for (const model of models) {
    try {
      const out = await geminiOnce(model, text, lang);
      if (out) return out;
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error("Gemini boş çeviri döndü");
}

/** API anahtarı yokken arayüzü test etmek için sahte çeviri. */
async function viaMock(text: string, lang: Lang) {
  return `[${lang.toUpperCase()} · demo çeviri] ${text}`;
}

const run: Record<Provider, (text: string, lang: Lang) => Promise<string>> = {
  gemini: viaGemini,
  deepseek: (t, l) =>
    viaChatApi("DeepSeek", "https://api.deepseek.com/chat/completions", process.env.DEEPSEEK_API_KEY!, process.env.DEEPSEEK_MODEL || "deepseek-chat", t, l),
  openai: (t, l) =>
    viaChatApi("OpenAI", "https://api.openai.com/v1/chat/completions", process.env.OPENAI_API_KEY!, process.env.OPENAI_MODEL || "gpt-4o-mini", t, l),
  mock: viaMock,
};

/** Sağlayıcıları sırayla dener: biri hata verirse (ör. ücretsiz kota doldu) sıradakine geçer. */
export async function translateText(text: string, lang: Lang): Promise<{ text: string; provider: Provider }> {
  let lastError: unknown;
  for (const provider of providers()) {
    try {
      const out = await run[provider](text, lang);
      if (out) return { text: out, provider };
      lastError = new Error(`${provider}: boş çeviri döndü`);
    } catch (e) {
      lastError = e;
      console.error(`translate via ${provider} failed`, e);
    }
  }
  throw lastError ?? new Error("Çeviri sağlayıcısı yok");
}
