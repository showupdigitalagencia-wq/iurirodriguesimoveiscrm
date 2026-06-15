import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const InputSchema = z.object({
  // base64 (no data: prefix)
  audioBase64: z.string().min(20).max(15_000_000),
  // webm | mp4 | m4a | wav | mp3 | ogg
  format: z.enum(["webm", "mp4", "m4a", "wav", "mp3", "ogg"]),
});

export const sophiaTranscribe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => InputSchema.parse(d))
  .handler(async ({ data }) => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY não configurada");

    // m4a is the typical browser-recorded container on Safari; gateway accepts "m4a"
    const fmt = data.format === "mp4" ? "m4a" : data.format;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Transcreva fielmente este áudio em português brasileiro. Retorne APENAS o texto transcrito, sem comentários, sem aspas, sem prefixos.",
              },
              {
                type: "input_audio",
                input_audio: { data: data.audioBase64, format: fmt },
              },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Falha na transcrição (${res.status}): ${txt.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const text = json.choices?.[0]?.message?.content?.trim() ?? "";
    return { text };
  });
