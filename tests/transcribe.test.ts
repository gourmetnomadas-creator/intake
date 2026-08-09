import { vi, describe, it, expect, beforeEach } from 'vitest';

const createCompletion = vi.fn();
let currentModel = 'gemini-flash-latest';

vi.mock('@/lib/api-auth', () => ({ requireUser: async () => null }));

vi.mock('@/lib/ai', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai')>('@/lib/ai');
  return {
    ...actual,
    getAIClient: async () => ({ chat: { completions: { create: createCompletion } } }),
    getModel: () => currentModel,
  };
});

const { POST } = await import('@/app/api/transcribe/route');
const { supportsAudio, supportsVision } = await import('@/lib/ai');
const { encodeWav, TARGET_SAMPLE_RATE } = await import('@/lib/audio');

const post = async (body: Record<string, unknown>) => {
  const request = { json: async () => body } as unknown as Parameters<typeof POST>[0];
  const response = await POST(request);
  return { status: response.status, body: await response.json() };
};

const lastAudioPart = () => {
  const [{ messages }] = createCompletion.mock.calls.at(-1) as [
    { messages: { role: string; content: string | { type: string; input_audio?: unknown }[] }[] },
  ];
  const user = messages.find((m) => m.role === 'user')!;
  return (user.content as { type: string; input_audio?: unknown }[]).find(
    (part) => part.type === 'input_audio'
  );
};

beforeEach(() => {
  currentModel = 'gemini-flash-latest';
  createCompletion.mockReset();
  createCompletion.mockResolvedValue({
    choices: [{ message: { content: '  two eggs and toast  ' } }],
  });
});

describe('encodeWav', () => {
  const read = (bytes: Uint8Array) => new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const ascii = (bytes: Uint8Array, at: number, length: number) =>
    String.fromCharCode(...bytes.subarray(at, at + length));

  it('writes a header a decoder will accept', () => {
    const samples = new Float32Array(8);
    const wav = encodeWav(samples, TARGET_SAMPLE_RATE);
    const view = read(wav);

    expect(ascii(wav, 0, 4)).toBe('RIFF');
    expect(ascii(wav, 8, 4)).toBe('WAVE');
    expect(ascii(wav, 12, 4)).toBe('fmt ');
    expect(ascii(wav, 36, 4)).toBe('data');
    expect(view.getUint16(20, true)).toBe(1); // uncompressed PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(TARGET_SAMPLE_RATE);
    expect(view.getUint16(34, true)).toBe(16); // bits per sample
  });

  it('sizes the file and its declared lengths consistently', () => {
    const samples = new Float32Array(1000);
    const wav = encodeWav(samples, TARGET_SAMPLE_RATE);
    const view = read(wav);

    expect(wav.length).toBe(44 + 1000 * 2);
    expect(view.getUint32(4, true)).toBe(wav.length - 8); // RIFF size
    expect(view.getUint32(40, true)).toBe(1000 * 2); // data size
  });

  it('converts float samples to 16-bit and clips out-of-range input', () => {
    const wav = encodeWav(new Float32Array([0, 1, -1, 0.5, 2, -2]), TARGET_SAMPLE_RATE);
    const view = read(wav);
    const at = (i: number) => view.getInt16(44 + i * 2, true);

    expect(at(0)).toBe(0);
    expect(at(1)).toBe(32767);
    expect(at(2)).toBe(-32768);
    expect(at(3)).toBe(16383);
    expect(at(4)).toBe(32767); // clipped, not wrapped
    expect(at(5)).toBe(-32768);
  });

  it('keeps a minute of speech within the upload limit', () => {
    const oneMinute = encodeWav(new Float32Array(TARGET_SAMPLE_RATE * 60), TARGET_SAMPLE_RATE);
    // base64 inflates by 4/3, and the endpoint caps at 4,000,000 characters.
    expect(Math.ceil(oneMinute.length / 3) * 4).toBeLessThan(4_000_000);
  });
});

describe('supportsAudio', () => {
  it('is narrower than vision — gpt-4o-mini reads images but not audio', () => {
    expect(supportsVision('gpt-4o-mini')).toBe(true);
    expect(supportsAudio('gpt-4o-mini')).toBe(false);
    expect(supportsAudio('gemini-flash-latest')).toBe(true);
    expect(supportsAudio('deepseek-chat')).toBe(false);
  });
});

describe('POST /api/transcribe', () => {
  it('sends the clip as an audio part and returns the trimmed transcript', async () => {
    const { status, body } = await post({ audioBase64: 'AAAA', format: 'aac' });

    expect(status).toBe(200);
    expect(lastAudioPart()).toEqual({
      type: 'input_audio',
      input_audio: { data: 'AAAA', format: 'aac' },
    });
    expect(body.text).toBe('two eggs and toast');
  });

  it('refuses when the configured model cannot hear', async () => {
    currentModel = 'gpt-4o-mini';

    const { status, body } = await post({ audioBase64: 'AAAA', format: 'aac' });

    expect(status).toBe(503);
    expect(body.error).toMatch(/hear audio/i);
    expect(createCompletion).not.toHaveBeenCalled();
  });

  it('reports silence rather than writing an empty description', async () => {
    createCompletion.mockResolvedValue({ choices: [{ message: { content: '   ' } }] });

    const { status, body } = await post({ audioBase64: 'AAAA', format: 'aac' });

    expect(status).toBe(422);
    expect(body.error).toMatch(/could not make out/i);
  });

  it('rejects a clip that is too long to be a meal description', async () => {
    const { status } = await post({ audioBase64: 'A'.repeat(4_000_001), format: 'aac' });

    expect(status).toBe(400);
    expect(createCompletion).not.toHaveBeenCalled();
  });

  it('rejects an empty recording and an unknown format', async () => {
    expect((await post({ audioBase64: '', format: 'aac' })).status).toBe(400);
    expect((await post({ audioBase64: 'AAAA', format: 'midi' })).status).toBe(400);
    expect(createCompletion).not.toHaveBeenCalled();
  });

  it('surfaces a provider failure as a readable error', async () => {
    createCompletion.mockRejectedValue(new Error('upstream exploded'));

    const { status, body } = await post({ audioBase64: 'AAAA', format: 'aac' });

    expect(status).toBe(500);
    expect(body.error).toMatch(/could not transcribe/i);
  });
});
