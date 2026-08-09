import { vi, describe, it, expect, beforeEach } from 'vitest';

// Capture what the route hands to the AI client so we can assert on the exact
// message shape, which differs between text-only and vision models.
const createCompletion = vi.fn();
let currentModel = 'deepseek-chat';

vi.mock('@/lib/api-auth', () => ({
  requireUser: async () => null,
}));

vi.mock('@/lib/ai', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai')>('@/lib/ai');
  return {
    ...actual,
    getAIClient: async () => ({
      chat: { completions: { create: createCompletion } },
    }),
    getModel: () => currentModel,
  };
});

const { POST } = await import('@/app/api/analyze-meal/route');
const { supportsVision } = await import('@/lib/ai');
const { MEAL_TYPES } = await import('@/types');

const AI_RESULT = {
  items: [],
  totalKcal: 0,
  totalProtein: 0,
  totalCarbs: 0,
  totalFat: 0,
  confidence: 0.8,
  warnings: [],
};

// The route only ever calls request.json(), so a minimal stand-in is enough.
type RouteRequest = Parameters<typeof POST>[0];

const post = async (body: Record<string, unknown>) => {
  const request = { json: async () => body } as unknown as RouteRequest;
  const response = await POST(request);
  return { status: response.status, body: await response.json() };
};

interface ChatMessage {
  role: string;
  content: string | { type: string; text?: string; image_url?: { url: string } }[];
}

const lastUserContent = () => {
  const [{ messages }] = createCompletion.mock.calls.at(-1) as [{ messages: ChatMessage[] }];
  return messages.find((m) => m.role === 'user')!.content;
};

beforeEach(() => {
  createCompletion.mockReset();
  createCompletion.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(AI_RESULT) } }],
  });
});

describe('supportsVision', () => {
  it('accepts the vision-capable models and rejects deepseek-chat', () => {
    expect(supportsVision('gpt-4o-mini')).toBe(true);
    expect(supportsVision('gemini-flash-lite-latest')).toBe(true);
    expect(supportsVision('deepseek-chat')).toBe(false);
  });
});

describe('POST /api/analyze-meal message shape', () => {
  it('sends plain string content when there is no photo (DeepSeek rejects arrays)', async () => {
    currentModel = 'deepseek-chat';

    const { status } = await post({ description: 'oatmeal', mealType: 'breakfast' });

    expect(status).toBe(200);
    expect(typeof lastUserContent()).toBe('string');
    expect(lastUserContent()).toContain('oatmeal');
  });

  it('still sends plain string content when a text-only model gets a photo', async () => {
    currentModel = 'deepseek-chat';

    const { body } = await post({
      description: 'french fries',
      mealType: 'lunch',
      imageBase64: 'AAAA',
    });

    expect(typeof lastUserContent()).toBe('string');
    expect(JSON.stringify(lastUserContent())).not.toContain('AAAA');
    expect(body.warnings).toContain(
      'Your photo was not analyzed (this AI model reads text only). Please review carefully.'
    );
  });

  it('attaches the photo as an image part for a vision model', async () => {
    currentModel = 'gpt-4o-mini';

    const { body } = await post({
      description: 'french fries',
      mealType: 'lunch',
      imageBase64: 'AAAA',
    });

    const content = lastUserContent();
    expect(Array.isArray(content)).toBe(true);
    expect(content[0]).toEqual({
      type: 'image_url',
      image_url: { url: 'data:image/jpeg;base64,AAAA' },
    });
    expect(content[1].type).toBe('text');
    expect(body.warnings).toContain('Photo analyzed alongside your description.');
  });

  it('reports a text-only analysis when no photo was supplied', async () => {
    currentModel = 'gpt-4o-mini';

    const { body } = await post({ description: 'oatmeal', mealType: 'breakfast' });

    expect(typeof lastUserContent()).toBe('string');
    expect(body.warnings).toContain('Analysis is text-only (no photo). Please review carefully.');
  });

  it('accepts every meal type the form offers, dessert included', async () => {
    currentModel = 'gpt-4o-mini';

    for (const mealType of MEAL_TYPES) {
      const { status } = await post({ description: 'flan', mealType });
      expect(status, `meal type "${mealType}" should be accepted`).toBe(200);
    }
  });

  it('rejects a photo that skipped the client-side downscaling', async () => {
    currentModel = 'gpt-4o-mini';

    const { status } = await post({
      description: 'french fries',
      mealType: 'lunch',
      imageBase64: 'A'.repeat(2_000_001),
    });

    expect(status).toBe(400);
    expect(createCompletion).not.toHaveBeenCalled();
  });
});
