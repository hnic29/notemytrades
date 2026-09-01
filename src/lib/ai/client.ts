export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

/** True only when AI_BASE_URL is set — every AI feature in the app
 * checks this and renders a "not configured" state instead of a
 * broken button when it's false, rather than assuming Omniroute (or
 * whatever's behind AI_BASE_URL) is always reachable. */
export function isAiConfigured(): boolean {
  return Boolean(process.env.AI_BASE_URL?.trim());
}

export class AiError extends Error {}

/**
 * Thin client for an OpenAI-compatible /chat/completions endpoint
 * (Omniroute, or anything else that speaks the same protocol). Never
 * throws for "not configured" silently — callers must check
 * isAiConfigured() first; this throws AiError for anything else
 * (unreachable, non-2xx, malformed response) so UI can show a specific
 * message instead of a generic crash.
 */
export async function chatComplete(
  messages: ChatMessage[],
  opts?: { temperature?: number },
): Promise<string> {
  if (!isAiConfigured()) {
    throw new AiError("AI is not configured — set AI_BASE_URL in .env.");
  }

  const baseUrl = process.env.AI_BASE_URL!.replace(/\/+$/, "");
  const apiKey = process.env.AI_API_KEY?.trim();

  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || "default",
        messages,
        temperature: opts?.temperature ?? 0.4,
      }),
      cache: "no-store",
    });
  } catch (err) {
    throw new AiError(
      `Couldn't reach the AI endpoint at ${baseUrl} — is Omniroute running? (${
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
    throw new AiError("AI response didn't include a message — check AI_MODEL is a valid model name.");
  }
  return content;
}
