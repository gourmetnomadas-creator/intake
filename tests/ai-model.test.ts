import { vi, describe, it, expect, afterEach } from 'vitest';

// getModel reads AI_PROVIDER at module load, so each case needs a fresh import.
const loadAi = async (env: Record<string, string | undefined>) => {
  vi.resetModules();
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  return import('@/lib/ai');
};

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('getModel', () => {
  it('gives meal analysis a vision-capable model the free tier still serves', async () => {
    const { getModel, supportsVision, supportsAudio } = await loadAi({
      AI_PROVIDER: 'gemini',
      GEMINI_API_KEY: 'test-key',
    });

    // Not `gemini-flash-latest`: the free tier answers it with a permanent 503,
    // which broke photo analysis and voice input alike. See lib/ai.ts.
    expect(getModel('meal-analysis')).toBe('gemini-flash-lite-latest');
    expect(supportsVision(getModel('meal-analysis'))).toBe(true);
    expect(supportsAudio(getModel('meal-analysis'))).toBe(true);
  });

  it('uses the same flash-lite model for the lighter endpoints', async () => {
    const { getModel } = await loadAi({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'test-key' });

    expect(getModel()).toBe('gemini-flash-lite-latest');
    expect(getModel('light')).toBe('gemini-flash-lite-latest');
  });

  it('falls back to deepseek when the Gemini key is missing', async () => {
    const { getModel, supportsVision } = await loadAi({
      AI_PROVIDER: 'gemini',
      GEMINI_API_KEY: undefined,
    });

    expect(getModel('meal-analysis')).toBe('deepseek-chat');
    expect(supportsVision('deepseek-chat')).toBe(false);
  });

  it('uses a vision-capable model on OpenAI', async () => {
    const { getModel, supportsVision } = await loadAi({
      AI_PROVIDER: 'openai',
      OPENAI_API_KEY: 'test-key',
    });

    expect(getModel('meal-analysis')).toBe('gpt-4o-mini');
    expect(supportsVision(getModel('meal-analysis'))).toBe(true);
  });

  it('defaults to Gemini so photos are analyzed out of the box', async () => {
    const { getModel } = await loadAi({
      AI_PROVIDER: undefined,
      GEMINI_API_KEY: 'test-key',
    });

    expect(getModel('meal-analysis')).toBe('gemini-flash-lite-latest');
  });
});
