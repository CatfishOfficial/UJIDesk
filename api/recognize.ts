import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod/v4';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
// The .js endings are load-bearing: Vercel compiles each file on its own and runs
// it as an ES module, where Node won't guess extensions (TypeScript and Vite both
// map .js back to the .ts source).
import { TOOLS } from '../src/data/tools.js';
import { RECOGNIZABLE_TOOLS, checkGuess, locateUncertain, type RecognitionKind, type RecognizableTool } from '../src/data/recognitionSchema.js';

/**
 * Reads one math/science problem out of a photo and transcribes it as plain
 * text — never solves it, never explains it. Optionally names which existing
 * tool it goes in and fills that tool's fields. The response schema is built
 * from the tool registry, so the model can only name real tools, fields and
 * choices, and the guess is still re-checked (checkGuess) before it's
 * forwarded: a wrong tool or an impossible value is dropped, not passed on.
 */

// Created on first use, after the key check in the handler: the SDK throws when
// it's constructed without a key, which at module scope would crash every
// request instead of answering with the friendly "not set up yet" error.
let client: OpenAI | null = null;
const openai = () => (client ??= new OpenAI({ apiKey: process.env.OPENAI_API_KEY, timeout: 25_000, maxRetries: 1 }));

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

// Quoted rather than indexed: the model copies the unsure characters and
// locateUncertain finds them, since models can't count string positions.
const UncertainBit = z.object({
  snippet: z.string().describe('The exact characters from "text" you are unsure about, copied exactly as they appear there.'),
  note: z.string().describe('What else it could be, briefly (e.g. "could be 5 or S").'),
});

// One branch per tool, each field described and each choice spelled out, so
// strict structured output can't produce a tool, field or choice that doesn't
// exist. Single-value enums rather than literals keep the schema inside what
// strict mode supports.
function toolGuess(t: RecognizableTool) {
  const inputs = Object.fromEntries(
    t.fields.map((f) => {
      const { hint, options } = t.spec[f];
      return [f, (options ? z.enum(options as [string, ...string[]]) : z.string()).describe(hint)];
    }),
  );
  return z.object({ type: z.enum([t.type]), inputs: z.object(inputs) }).describe(TOOLS[t.type].title);
}

const RecognizeResult = z.object({
  text: z.string(),
  notMath: z.boolean(),
  uncertain: z.array(UncertainBit),
  structured: z.union([...RECOGNIZABLE_TOOLS.map(toolGuess), z.null()]),
});

function toolMenu(): string {
  return RECOGNIZABLE_TOOLS.map((t) => `- "${t.type}": ${TOOLS[t.type].description} e.g. "${t.example}"`).join('\n');
}

function systemPrompt(kind: RecognitionKind | undefined): string {
  const expected = RECOGNIZABLE_TOOLS.find((t) => t.kind === kind);
  return `You read one math or science problem from a photo (handwritten, printed or a screenshot) for UJI, a homework whiteboard for students. Your job is to transcribe the problem and, when you can, say which of UJI's tools it goes in. You never solve it, hint at the answer or comment on it: UJI's own tools do the math, and the student checks your reading before anything is solved.

How to fill in the response:
- "text": the problem on one line of plain text, the way a student would type it: ^ for powers, sqrt() for roots, / for fractions, - for minus. Keep numbers, variables and units exactly as shown, keep a word problem's wording, and don't correct the student's work. If the photo has several problems, read the one that's circled or marked, otherwise the first complete one.
- "notMath": true only when the photo shows no math or science problem at all; "text" is then empty.
- "uncertain": one entry per bit you can't read for sure, in reading order, with "snippet" copied exactly from "text". Empty when you're sure of everything.
- "structured": the tool this problem goes in, with its fields filled from the photo, only when you're sure which tool fits and sure of every value it needs. Otherwise null. Null is always safe (the student just checks the text); a wrong tool or value is not.

Filling a tool's fields: follow each field's description, write numbers plainly (4, -2.5, 3/4) without units unless the field is for a unit, and leave a field as an empty string when the problem doesn't give it (like the side it asks for). Read values off the photo; never work them out.

UJI's tools:
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
    let allowed = true;
    try {
      allowed = (await ratelimit.limit(clientIp(req))).success;
    } catch (err) {
      // Fails open here too: a Redis hiccup shouldn't take the reader down with it.
      console.error('rate limit check failed', err);
    }
    if (!allowed) {
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
    const completion = await openai().chat.completions.parse({
      model: 'gpt-5-nano',
      // gpt-5 models reason before answering, and that counts against
      // max_completion_tokens: at the default effort it can use up the whole
      // budget and leave no answer at all. Low effort is plenty for reading.
      reasoning_effort: 'low',
      max_completion_tokens: 4000,
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

    const text = parsed.notMath ? '' : parsed.text.trim();
    res.status(200).json({
      text,
      notMath: parsed.notMath,
      uncertain: locateUncertain(text, parsed.uncertain),
      structured: parsed.notMath || !parsed.structured ? null : checkGuess(parsed.structured.type, parsed.structured.inputs),
    });
  } catch (err) {
    console.error('recognize failed', err);
    res.status(502).json({ error: "Couldn't read that photo. Try typing it instead." });
  }
}
