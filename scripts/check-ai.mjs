#!/usr/bin/env node
// Verifies the configured AI provider before you deploy: which model each task
// resolves to, whether the key works, and — the point of all this — whether the
// model can actually read an image.
//
//   npm run check:ai
//
// Reads .env.local (falling back to the real environment), so it checks the
// same configuration the dev server would use.

import { readFileSync, existsSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import OpenAI from 'openai';

// --- env -------------------------------------------------------------------

for (const file of ['.env.local', '.env']) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!match) continue;
    const value = match[2].trim().replace(/^["']|["']$/g, '');
    if (value && process.env[match[1]] === undefined) process.env[match[1]] = value;
  }
}

const PROVIDER = process.env.AI_PROVIDER || 'gemini';
const KEYS = {
  gemini: process.env.GEMINI_API_KEY,
  openai: process.env.OPENAI_API_KEY,
  deepseek: process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY,
};

// Mirrors src/lib/ai.ts. Keep in sync if the model choices change there.
const resolve = () => {
  if (PROVIDER === 'openai' && KEYS.openai) {
    return { provider: 'openai', analysis: 'gpt-4o-mini', light: 'gpt-4o-mini', vision: true };
  }
  if (PROVIDER === 'gemini' && KEYS.gemini) {
    return {
      provider: 'gemini',
      analysis: 'gemini-flash-latest',
      light: 'gemini-flash-lite-latest',
      vision: true,
      baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
    };
  }
  return { provider: 'deepseek', analysis: 'deepseek-chat', light: 'deepseek-chat', vision: false };
};

// --- a tiny PNG with three colour bands, so "can it see?" has a real answer --

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

const chunk = (type, data) => {
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData));
  return Buffer.concat([length, typeAndData, crc]);
};

const bandedPng = (size = 240) => {
  const bands = [
    [220, 30, 30],
    [30, 170, 60],
    [40, 80, 220],
  ];
  const raw = Buffer.alloc(size * (1 + size * 3));
  for (let y = 0; y < size; y++) {
    const rowStart = y * (1 + size * 3);
    raw[rowStart] = 0; // no filter
    const [r, g, b] = bands[Math.min(bands.length - 1, Math.floor((y / size) * bands.length))];
    for (let x = 0; x < size; x++) {
      const p = rowStart + 1 + x * 3;
      raw[p] = r;
      raw[p + 1] = g;
      raw[p + 2] = b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolour

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]).toString('base64');
};

// --- checks ----------------------------------------------------------------

const ok = (msg) => console.log(`  \x1b[32mPASS\x1b[0m  ${msg}`);
const bad = (msg) => console.log(`  \x1b[31mFAIL\x1b[0m  ${msg}`);
const info = (msg) => console.log(`        ${msg}`);

const run = async () => {
  const config = resolve();

  console.log(`\nAI_PROVIDER   ${process.env.AI_PROVIDER || '(unset — defaults to gemini)'}`);
  console.log(`Resolved to   ${config.provider}`);
  console.log(`  meal analysis  ${config.analysis}`);
  console.log(`  other calls    ${config.light}\n`);

  if (config.provider !== PROVIDER) {
    bad(`AI_PROVIDER is "${PROVIDER}" but fell back to ${config.provider} — its API key is missing.`);
    info(`Set ${PROVIDER.toUpperCase()}_API_KEY in .env.local (and in your hosting provider).`);
    return 1;
  }

  if (!config.vision) {
    bad(`${config.analysis} cannot read images. Meals will be analyzed from the text only.`);
    info('Switch to AI_PROVIDER=gemini (free tier includes image input) or openai.');
    return 1;
  }

  const client = new OpenAI({
    apiKey: KEYS[config.provider],
    ...(config.baseURL ? { baseURL: config.baseURL } : {}),
  });

  console.log('Checking the key and text analysis...');
  try {
    const res = await client.chat.completions.create({
      model: config.light,
      messages: [{ role: 'user', content: 'Reply with the single word: ready' }],
      temperature: 0,
    });
    const reply = res.choices[0]?.message?.content?.trim() || '';
    if (!reply) throw new Error('empty response');
    ok(`${config.light} responded ("${reply.slice(0, 40)}")`);
  } catch (err) {
    bad(`${config.light} rejected the request: ${err.message}`);
    if (String(err.message).match(/api key|401|invalid/i)) {
      info('The key looks wrong. Generate a new one and update .env.local.');
    }
    return 1;
  }

  console.log('\nChecking that the model can actually see an image...');
  try {
    const res = await client.chat.completions.create({
      model: config.analysis,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:image/png;base64,${bandedPng()}` } },
            {
              type: 'text',
              text: 'This image has three horizontal colour bands. Name them top to bottom, lowercase, comma separated. Answer with only the three words.',
            },
          ],
        },
      ],
      temperature: 0,
    });

    const answer = (res.choices[0]?.message?.content || '').toLowerCase();
    const seen = ['red', 'green', 'blue'].every((c) => answer.includes(c));
    const ordered = answer.indexOf('red') < answer.indexOf('green') && answer.indexOf('green') < answer.indexOf('blue');

    if (seen && ordered) {
      ok(`${config.analysis} read the image correctly ("${answer.trim().slice(0, 40)}")`);
      console.log('\n\x1b[32mPhoto analysis is working.\x1b[0m Meals logged with a photo will use it.\n');
      return 0;
    }

    bad(`${config.analysis} answered "${answer.trim().slice(0, 60)}" instead of "red, green, blue".`);
    info('The call succeeded but the image was not read as expected.');
    return 1;
  } catch (err) {
    bad(`${config.analysis} rejected the image: ${err.message}`);
    info('The text call worked, so the key is fine — this model may not accept images.');
    return 1;
  }
};

run().then(
  (code) => process.exit(code),
  (err) => {
    console.error(`\nUnexpected error: ${err.message}\n`);
    process.exit(1);
  }
);
