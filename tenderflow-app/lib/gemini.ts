// Minimal Gemini adapter — plain fetch, no SDK dependency.
// Key comes ONLY from GEMINI_API_KEY and is never logged or returned.
// Model overridable via GEMINI_MODEL (default gemini-2.0-flash).

export function geminiConfig(): { key: string; model: string } {
  return {
    key: (process.env.GEMINI_API_KEY ?? "").trim(),
    model: (process.env.GEMINI_MODEL ?? "gemini-3.8-flash").trim(),
  };
}

export function isGeminiConfigured(): boolean {
  return geminiConfig().key.length >= 10;
}

interface GeminiPart {
  text?: string;
}

interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
  promptFeedback?: { blockReason?: string };
}

// Ask Gemini for STRICT JSON. Throws a safe error (never includes the key).
// Falls back across models on 404/503: free-tier demand spikes are common.
// Phase 1: optional responseSchema (Gemini structured output). When supplied
// it is sent as generationConfig.responseSchema; if the API rejects the
// schema (400), the call is retried once WITHOUT it (current behaviour),
// so existing callers are unaffected.
export async function geminiJson(
  systemPrompt: string,
  userPrompt: string,
  timeoutMs = 120000,
  options?: { responseSchema?: unknown }
): Promise<{ data: unknown; model: string }> {
  const { key, model } = geminiConfig();
  if (!isGeminiConfigured()) {
    throw new Error("Gemini API key is not configured. Add GEMINI_API_KEY to tenderflow-app\\.env (see .env.example).");
  }
  const candidates = [model, "gemini-2.5-flash", "gemini-flash-latest", "gemini-flash-lite-latest"].filter(
    (m, i, all) => m && all.indexOf(m) === i
  );
  const attempts: string[] = [];
  let lastError = "";
  for (const attempt of candidates) {
    // First try WITH the schema (when given), then fall back to plain JSON.
    const schemaRounds: (unknown | undefined)[] = options?.responseSchema ? [options.responseSchema, undefined] : [undefined];
    for (const schema of schemaRounds) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const generationConfig: Record<string, unknown> = {
          responseMimeType: "application/json",
          temperature: 0.1,
          maxOutputTokens: 8192,
        };
        if (schema !== undefined) generationConfig.responseSchema = schema;
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(attempt)}:generateContent`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", "x-goog-api-key": key },
            body: JSON.stringify({
              system_instruction: { parts: [{ text: systemPrompt }] },
              contents: [{ parts: [{ text: userPrompt }] }],
              generationConfig,
            }),
            signal: ctrl.signal,
          }
        );
        clearTimeout(timer);
        if (res.status === 404 || res.status === 503 || res.status === 429) {
          lastError = `model ${attempt}: ${res.status}`;
          attempts.push(`${attempt}:${res.status}`);
          break; // try next model, not the schema fallback for rate/availability errors
        }
        if (res.status === 400 && schema !== undefined) {
          // Schema rejected — fall through to the plain-JSON retry below.
          attempts.push(`${attempt}:schema-400`);
          continue;
        }
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 300)}`);
      }
      const data = (await res.json()) as GeminiResponse;
      if (data.promptFeedback?.blockReason) {
        throw new Error(`Gemini declined the prompt (${data.promptFeedback.blockReason}).`);
      }
      const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
      if (!text.trim()) throw new Error("Gemini returned an empty response.");
      // Models often wrap JSON in markdown fences despite instructions.
      const unfenced = text.replace(/```(?:json)?/gi, "");
      const forms: string[] = [unfenced];
      const start = unfenced.indexOf("{");
      const end = unfenced.lastIndexOf("}");
      if (start >= 0 && end > start) forms.push(unfenced.slice(start, end + 1));
      for (const candidate of forms) {
        try {
          return { data: JSON.parse(candidate), model: attempt };
        } catch { /* try next form */ }
      }
      throw new Error("Gemini did not return valid JSON.");
      } catch (e) {
        clearTimeout(timer);
        if (e instanceof Error && e.message.startsWith("Gemini")) throw e;
        lastError = `model ${attempt}: ${e instanceof Error ? e.message : "network error"}`;
      }
    }
  }
  void lastError;
  throw new Error(`Gemini unavailable (tried ${attempts.join(", ") || "none"}). Please retry shortly.`);
}
