const GATEWAY = "https://ai.gateway.lovable.dev/v1";
async function getApiKey(override) {
    if (override)
        return override;
    const key = process.env["LOVABLE_API_KEY"];
    if (!key)
        throw new Error("AI is not configured (missing key).");
    return key;
}
export async function chatComplete(messages, model = "openai/gpt-5.6-sol", apiKeyOverride, stream = false) {
    const body = {
        model,
        messages,
        reasoning_effort: "none",
        stream
    };
    const res = await fetch(`${GATEWAY}/chat/completions`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Lovable-API-Key": await getApiKey(apiKeyOverride),
        },
        body: JSON.stringify(body),
    });
    if (res.status === 429)
        throw new Error("RATE_LIMIT");
    if (res.status === 402)
        throw new Error("NO_CREDITS");
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`AI request failed (${res.status}): ${text.slice(0, 300)}`);
    }
    if (stream && res.body) {
        return res.body;
    }
    const json = (await res.json());
    return json.choices?.[0]?.message?.content?.trim() ?? "";
}
export async function transcribeAudio(base64Audio, mimeType, apiKeyOverride) {
    const binary = Uint8Array.from(atob(base64Audio), (c) => c.charCodeAt(0));
    const ext = mimeType.includes("mp4") || mimeType.includes("m4a") ? "m4a" : "webm";
    const form = new FormData();
    form.append("file", new Blob([binary], { type: mimeType }), `audio.${ext}`);
    form.append("model", "openai/whisper-large-v3-turbo");
    form.append("prompt", "ট্রান্সক্রিপ্টটি দ্রুত ও নির্ভুলভাবে বাংলা বা বাংলিশে করুন। (Transcribe quickly and accurately in Bengali or Banglish.)");
    const res = await fetch(`${GATEWAY}/audio/transcriptions`, {
        method: "POST",
        headers: { "Lovable-API-Key": await getApiKey(apiKeyOverride) },
        body: form,
    });
    if (res.status === 429)
        throw new Error("RATE_LIMIT");
    if (res.status === 402)
        throw new Error("NO_CREDITS");
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Transcription failed (${res.status}): ${text.slice(0, 300)}`);
    }
    const json = (await res.json());
    return (json.text ?? "").trim();
}
