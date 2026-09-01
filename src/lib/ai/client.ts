import { prisma } from "@/lib/prisma";

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type EffectiveAiConfig = { baseUrl: string | null; apiKey: string | null; model: string };

/**
 * Settings saved in the app's Settings page (stored in the DB) take
 * precedence over the .env defaults, so the UI actually takes effect
 * without a server restart — env vars are just the first-boot
 * fallback before anyone has visited Settings.
 */
async function getEffectiveAiConfig(): Promise<EffectiveAiConfig> {
  const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  return {
    baseUrl: settings?.aiBaseUrl?.trim() || process.env.AI_BASE_URL?.trim() || null,
    apiKey: settings?.aiApiKey?.trim() || process.env.AI_API_KEY?.trim() || null,
    model: settings?.aiModel?.trim() || process.env.AI_MODEL?.trim() || "default",
  };
}

/** True only when a base URL is configured (Settings page or
 * AI_BASE_URL) — every AI feature checks this and renders a "not
 * configured" state instead of a broken button when it's false. */
export async function isAiConfigured(): Promise<boolean> {
  const { baseUrl } = await getEffectiveAiConfig();
  return Boolean(baseUrl);
}

export class AiError extends Error {}

/**
 * Thin client for an OpenAI-compatible /chat/completions endpoint
 * (Omniroute, or anything else that speaks the same protocol). Throws
 * AiError for every expected failure mode (not configured, unreachable,
 * non-2xx, malformed response) — callers should catch this specific
 * type and show its message, not let it propagate (Next.js redacts
 * thrown Server Action error messages in production builds).
 */
export async function chatComplete(
  messages: ChatMessage[],
  opts?: { temperature?: number },
): Promise<string> {
  const config = await getEffectiveAiConfig();
  if (!config.baseUrl) {
    throw new AiError("AI is not configured — set it up on the Settings page.");
  }

  const baseUrl = config.baseUrl.replace(/\/+$/, "");

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.apiKey ? { Authorization: `Bearer ${config.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: opts?.temperature ?? 0.4,
      }),
      cache: "no-store",
    });
  } catch (err) {
    throw new AiError(
      `Couldn't reach the AI endpoint at ${baseUrl} — is it running? (${
        err instanceof Error ? err.message : String(err)
      })`,
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new AiError(`AI request failed (HTTP ${res.status}): ${text.slice(0, 300)}`);
  }

  const json = await res.json().catch(() => null);
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new AiError("AI response didn't include a message — check the model name in Settings.");
  }
  return content;
}
