import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod/v4';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { RECOGNIZABLE_TOOLS, type RecognitionKind } from '../src/data/recognitionSchema';

/**
 * Reads one math/science problem out of a photo and transcribes it as plain
 * text — never solves it, never explains it. Optionally names which existing
 * tool and fields it matches, but that guess is re-checked against the real
 * tool registry below before it's trusted with anything: a wrong tool name or
 * an unknown field from the model is dropped, not forwarded.
 */

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Rate limiting needs a store that outlives any one function instance — plain
// in-memory counters don't work here since Vercel can route requests to any
// warm (or cold) instance. Optional by design: until a Redis integration is
// connected (see README), this fails open rather than blocking every request.
const hasRedis = !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL);
const ratelimit = hasRedis
  ? new Ratelimit({ redis: Redis.fromEnv(), limiter: Ratelimit.slidingWindow(20, '10 m'), prefix: 'recognize' })
  : null;

/** Optional: set ALLOWED_ORIGIN to this site's own deployed URL to stop other sites from calling this endpoint directly with your key. Unset = no check. */
function originAllowed(req: VercelRequest): boolean {
  const allowed = process.env.ALLOWED_ORIGIN;
  if (!allowed) return true;
  const origin = req.headers.origin;
  return typeof origin === 'string' && origin === allowed;
}

function clientIp(req: VercelRequest): string {
  const fwd = req.headers['x-forwarded-for'];
  const first = Array.isArray(fwd) ? fwd[0] : fwd?.split(',')[0];
  return first?.trim() || (req.headers['x-real-ip'] as string) || 'unknown';
}

const UncertainSpan = z.object({
  /** 0-based [start, end) character indices into "text". */
  start: z.number().int().min(0),
  end: z.number().int().min(0),
  note: z.string(),
});

// An array of {field, value} pairs rather than an open-ended map: OpenAI's
// strict structured-output mode doesn't support arbitrary additionalProperties,
// but fixed-shape objects in an array are fully compatible with it.
const StructuredGuess = z.object({
  type: z.string(),
  inputs: z.array(z.object({ field: z.string(), value: z.string() })),
});

const RecognizeResult = z.object({
  text: z.string(),
  notMath: z.boolean(),
  uncertain: z.array(UncertainSpan),
  structured: StructuredGuess.nullable(),
});

const VALID_TYPES = new Set(RECOGNIZABLE_TOOLS.map((t) => t.type as string));
const FIELDS_BY_TYPE = new Map(RECOGNIZABLE_TOOLS.map((t) => [t.type as string, new Set(t.fields)]));

function toolMenu(): string {
  return RECOGNIZABLE_TOOLS.map((t) => `- "${t.type}" (${t.kind}): fields [${t.fields.join(', ')}] — e.g. "${t.example}"`).join('\n');
}

function systemPrompt(kind: RecognitionKind | undefined): string {
  const expected = RECOGNIZABLE_TOOLS.find((t) => t.kind === kind);
  return `You read one math or science problem from a photo of a student's work (handwritten or printed) and transcribe it as plain text — the way a student would type it. You never solve it, never explain it, never add commentary beyond the transcription.

Rules:
- "text": the problem as a single line of plain text (use ^ for exponents, standard operators, sqrt() if needed).
- "notMath": true only if the photo doesn't show a recognizable math/science problem at all. If true, "text" can be empty.
- "uncertain": for each character span you're genuinely unsure about, give its 0-based [start, end) index into "text" (JavaScript string index, matching text.slice(start, end)) and a short note on the likely alternative reading. Empty array if you're confident throughout.
- "structured": ONLY when you're confident which specific tool below matches AND confident of every field value, name that exact tool and give its fields as {field, value} pairs. Otherwise null. A null is always safe here — a wrong guess is not, so don't guess unless you're sure.

Tools you may match in "structured" (type, fields, one example):
${toolMenu()}
${expected ? `\nThe student opened this from "${expected.type}" (expects: ${expected.label.toLowerCase()}), but match whatever the photo actually shows, even if it's a different tool — they may have photographed something else.` : ''}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST.' });
    return;
  }
  if (!originAllowed(req)) {
    res.status(403).json({ error: 'Not allowed from this origin.' });
    return;
  }
  if (!process.env.OPENAI_API_KEY) {
    res.status(500).json({ error: "The server isn't set up to read photos yet (missing API key)." });
    return;
  }
  if (ratelimit) {
    const { success } = await ratelimit.limit(clientIp(req));
    if (!success) {
      res.status(429).json({ error: "That's a lot of photos at once — give it a minute and try again." });
      return;
    }
  }

  const { image, kind } = (req.body ?? {}) as { image?: string; kind?: RecognitionKind };
  if (!image || typeof image !== 'string' || !image.startsWith('data:image/')) {
    res.status(400).json({ error: 'No image to read.' });
    return;
  }
  // A resized photo should land well under this; a huge payload here means the
  // client skipped its own downscale step, not that the photo is legitimately big.
  if (image.length > 6_000_000) {
    res.status(413).json({ error: 'That image is too large. Try again — it should resize automatically.' });
    return;
  }

  try {
    const completion = await client.chat.completions.parse({
      model: 'gpt-5-nano',
      max_completion_tokens: 600,
      messages: [
        { role: 'system', content: systemPrompt(kind) },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Read the problem in this photo.' },
            { type: 'image_url', image_url: { url: image } },
          ],
        },
      ],
      response_format: zodResponseFormat(RecognizeResult, 'recognition'),
    });

    const parsed = completion.choices[0]?.message.parsed;
    if (!parsed) {
      res.status(502).json({ error: "Couldn't read that photo. Try typing it instead." });
      return;
    }

    // Re-validate the model's tool/field guess against the real registry —
    // never forward a tool name or field it invented.
    let structured: { type: string; inputs: Record<string, string> } | null = null;
    if (parsed.structured && VALID_TYPES.has(parsed.structured.type)) {
      const known = FIELDS_BY_TYPE.get(parsed.structured.type)!;
      const inputs: Record<string, string> = {};
      for (const { field, value } of parsed.structured.inputs) if (known.has(field)) inputs[field] = value;
      if (Object.keys(inputs).length) structured = { type: parsed.structured.type, inputs };
    }

    res.status(200).json({
      text: parsed.notMath ? '' : parsed.text,
      notMath: parsed.notMath,
      uncertain: parsed.uncertain,
      structured,
    });
  } catch (err) {
    console.error('recognize failed', err);
    res.status(502).json({ error: "Couldn't read that photo. Try typing it instead." });
  }
}
