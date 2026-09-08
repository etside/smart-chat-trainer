/**
 * plan-ingest.ts
 * Ingests a business plan from multiple sources:
 *   - PDF (.pdf) via pdf-parse
 *   - DOCX (.docx) via mammoth
 *   - Markdown (.md), plain text (.txt)
 *   - JSON (.json) — structured plan objects
 *   - URL — fetch + strip HTML
 *
 * Returns IngestedPlan: { rawText, chunks, meta }
 *
 * Deck chunking splits content into logical sections (heading-based or
 * sentence-window fallback) capped at MAX_CHUNK_TOKENS each, so the
 * validator can process large plans without exceeding context limits.
 */

export interface PlanChunk {
  index: number;
  heading: string;
  text: string;
  tokenEstimate: number;
}

export interface IngestedPlan {
  rawText: string;
  chunks: PlanChunk[];
  meta: {
    source: "pdf" | "docx" | "txt" | "md" | "json" | "url";
    filename?: string;
    url?: string;
    charCount: number;
    chunkCount: number;
    estimatedTokens: number;
  };
}

// ~4 chars per token heuristic
const CHARS_PER_TOKEN = 4;
const MAX_CHUNK_TOKENS = 1500;
const MAX_TOTAL_CHARS = 120_000; // ~30k tokens total cap

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function truncateToLimit(text: string): string {
  if (text.length <= MAX_TOTAL_CHARS) return text;
  return text.slice(0, MAX_TOTAL_CHARS) + "\n\n[... content truncated for processing ...]";
}

// ─── Chunking ─────────────────────────────────────────────────────────────────

/**
 * Split text into heading-delimited chunks.
 * Falls back to sliding-window sentence chunks if no headings found.
 */
export function chunkText(text: string): PlanChunk[] {
  const headingRegex = /^#{1,4}\s+.+$|^[A-Z][^\n]{3,60}(?:\n[-=]{3,})/gm;
  const headingMatches = [...text.matchAll(headingRegex)];

  if (headingMatches.length >= 2) {
    return chunkByHeadings(text, headingMatches);
  }
  return chunkBySentenceWindow(text);
}

function chunkByHeadings(
  text: string,
  matches: RegExpMatchArray[],
): PlanChunk[] {
  const chunks: PlanChunk[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].index!;
    const end = i + 1 < matches.length ? matches[i + 1].index! : text.length;
    const raw = text.slice(start, end).trim();
    const heading = matches[i][0].replace(/^#+\s*/, "").slice(0, 80);

    // If the chunk is too large, sub-split by paragraph
    if (estimateTokens(raw) > MAX_CHUNK_TOKENS) {
      const subChunks = splitLargeChunk(raw, heading, chunks.length);
      chunks.push(...subChunks);
    } else {
      chunks.push({
        index: chunks.length,
        heading: heading || `Section ${chunks.length + 1}`,
        text: raw,
        tokenEstimate: estimateTokens(raw),
      });
    }
  }

  // Capture any leading content before first heading
  if (matches[0]?.index && matches[0].index > 100) {
    const preamble = text.slice(0, matches[0].index).trim();
    if (preamble.length > 50) {
      chunks.unshift({
        index: 0,
        heading: "Overview / Preamble",
        text: preamble,
        tokenEstimate: estimateTokens(preamble),
      });
      chunks.forEach((c, i) => (c.index = i));
    }
  }

  return chunks.length > 0 ? chunks : chunkBySentenceWindow(text);
}

function chunkBySentenceWindow(text: string): PlanChunk[] {
  const sentences = text.match(/[^.!?\n]+[.!?\n]+/g) ?? [text];
  const chunks: PlanChunk[] = [];
  let current = "";
  let chunkIdx = 0;

  for (const sentence of sentences) {
    if (estimateTokens(current + sentence) > MAX_CHUNK_TOKENS && current.length > 0) {
      chunks.push({
        index: chunkIdx++,
        heading: `Section ${chunkIdx}`,
        text: current.trim(),
        tokenEstimate: estimateTokens(current),
      });
      current = sentence;
    } else {
      current += " " + sentence;
    }
  }

  if (current.trim().length > 30) {
    chunks.push({
      index: chunkIdx,
      heading: `Section ${chunkIdx + 1}`,
      text: current.trim(),
      tokenEstimate: estimateTokens(current),
    });
  }

  return chunks;
}

function splitLargeChunk(text: string, heading: string, baseIndex: number): PlanChunk[] {
  const paragraphs = text.split(/\n\n+/);
  const subChunks: PlanChunk[] = [];
  let current = "";
  let subIdx = 0;

  for (const para of paragraphs) {
    if (estimateTokens(current + para) > MAX_CHUNK_TOKENS && current.length > 0) {
      subChunks.push({
        index: baseIndex + subIdx,
        heading: subIdx === 0 ? heading : `${heading} (cont.)`,
        text: current.trim(),
        tokenEstimate: estimateTokens(current),
      });
      subIdx++;
      current = para;
    } else {
      current += "\n\n" + para;
    }
  }
  if (current.trim().length > 30) {
    subChunks.push({
      index: baseIndex + subIdx,
      heading: subIdx === 0 ? heading : `${heading} (cont.)`,
      text: current.trim(),
      tokenEstimate: estimateTokens(current),
    });
  }
  return subChunks;
}

// ─── Source Parsers ────────────────────────────────────────────────────────────

async function parsePdf(buffer: Buffer): Promise<string> {
  const pdfParse = (await import("pdf-parse")).default;
  const result = await pdfParse(buffer);
  return result.text ?? "";
}

async function parseDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/\s{3,}/g, "\n\n")
    .trim();
}

function parseJsonPlan(text: string): string {
  try {
    const obj = JSON.parse(text);
    // Recursively extract string values
    const lines: string[] = [];
    function walk(val: unknown, path: string) {
      if (typeof val === "string") {
        lines.push(`${path}: ${val}`);
      } else if (Array.isArray(val)) {
        val.forEach((item, i) => walk(item, `${path}[${i}]`));
      } else if (val && typeof val === "object") {
        for (const [k, v] of Object.entries(val)) {
          walk(v, path ? `${path}.${k}` : k);
        }
      }
    }
    walk(obj, "");
    return lines.join("\n");
  } catch {
    return text; // Fall back to raw text if not valid JSON
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

export interface IngestFromFileOptions {
  buffer: Buffer;
  filename: string;
  mimeType?: string;
}

export async function ingestFromFile(opts: IngestFromFileOptions): Promise<IngestedPlan> {
  const { buffer, filename } = opts;
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  let rawText = "";
  let source: IngestedPlan["meta"]["source"] = "txt";

  if (ext === "pdf" || opts.mimeType === "application/pdf") {
    rawText = await parsePdf(buffer);
    source = "pdf";
  } else if (
    ext === "docx" ||
    opts.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    rawText = await parseDocx(buffer);
    source = "docx";
  } else if (ext === "md") {
    rawText = buffer.toString("utf-8");
    source = "md";
  } else if (ext === "json") {
    rawText = parseJsonPlan(buffer.toString("utf-8"));
    source = "json";
  } else {
    // txt and everything else
    rawText = buffer.toString("utf-8");
    source = "txt";
  }

  rawText = truncateToLimit(rawText.trim());
  const chunks = chunkText(rawText);

  return {
    rawText,
    chunks,
    meta: {
      source,
      filename,
      charCount: rawText.length,
      chunkCount: chunks.length,
      estimatedTokens: estimateTokens(rawText),
    },
  };
}

export async function ingestFromUrl(url: string): Promise<IngestedPlan> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "DaddyAI-PlanValidator/1.0",
        Accept: "text/html,text/plain,application/json",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);

    const contentType = res.headers.get("content-type") ?? "";
    let rawText = "";

    if (contentType.includes("application/json")) {
      rawText = parseJsonPlan(await res.text());
    } else if (contentType.includes("text/html")) {
      rawText = stripHtml(await res.text());
    } else {
      rawText = await res.text();
    }

    rawText = truncateToLimit(rawText.trim());
    const chunks = chunkText(rawText);

    return {
      rawText,
      chunks,
      meta: {
        source: "url",
        url,
        charCount: rawText.length,
        chunkCount: chunks.length,
        estimatedTokens: estimateTokens(rawText),
      },
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function ingestFromText(text: string): Promise<IngestedPlan> {
  const rawText = truncateToLimit(text.trim());
  const chunks = chunkText(rawText);
  return {
    rawText,
    chunks,
    meta: {
      source: "txt",
      charCount: rawText.length,
      chunkCount: chunks.length,
      estimatedTokens: estimateTokens(rawText),
    },
  };
}
