import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

// The bug this guards: `gemini-flash-latest` was the model meal analysis and
// voice input both ran on, and the free tier answers it with a permanent 503
// ("This model is currently experiencing high demand"). Nothing in the code
// was wrong — the alias simply stopped being served — so no offline test could
// ever have caught it. Only asking the provider can.
//
// Skipped without a key, so CI and offline runs stay green; run it with the
// real key before shipping a model change.

const envFile = path.join(process.cwd(), '.env.local');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].trim();
  }
}

const hasKey = Boolean(process.env.GEMINI_API_KEY || process.env.OPENAI_API_KEY);

// A 1x1 JPEG: enough to exercise the vision path without shipping a fixture.
const PIXEL_JPEG_BASE64 =
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0a' +
  'HBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA' +
  'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

describe.skipIf(!hasKey)('the configured AI models answer', () => {
  let ai: Awaited<ReturnType<typeof import('@/lib/ai').getAIClient>>;
  let models: string[];

  beforeAll(async () => {
    const lib = await import('@/lib/ai');
    ai = await lib.getAIClient();
    // Every model the app can pick, so a task routed to a dead alias fails here
    // rather than on someone's phone.
    models = [...new Set([lib.getModel('light'), lib.getModel('meal-analysis')])];
  });

  it('reads an image and replies', async () => {
    for (const model of models) {
      const completion = await ai.chat.completions.create({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${PIXEL_JPEG_BASE64}` } },
              { type: 'text', text: 'Reply with the single word: ok' },
            ],
          },
        ],
        temperature: 0,
      });

      expect(completion.choices[0]?.message?.content ?? '', `${model} returned nothing`).not.toBe('');
    }
  }, 60_000);
});
