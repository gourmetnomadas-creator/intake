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
const { audioFormatFromMimeType } = await import('@/lib/audio');

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

describe('audioFormatFromMimeType', () => {
  it('maps what Safari records', () => {
    expect(audioFormatFromMimeType('audio/mp4')).toBe('aac');
    expect(audioFormatFromMimeType('audio/mp4;codecs=mp4a.40.2')).toBe('aac');
  });

  it('maps what Chrome and Firefox record', () => {
    expect(audioFormatFromMimeType('audio/webm;codecs=opus')).toBe('webm');
    expect(audioFormatFromMimeType('audio/ogg;codecs=opus')).toBe('ogg');
  });

  it('falls back to webm for anything unrecognised', () => {
    expect(audioFormatFromMimeType('audio/some-future-thing')).toBe('webm');
    expect(audioFormatFromMimeType('')).toBe('webm');
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
