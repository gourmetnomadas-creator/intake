// Shared AI chat client: OpenAI, Gemini (free tier, OpenAI-compatible
// endpoint) or DeepSeek, selected via AI_PROVIDER.
const AI_PROVIDER = process.env.AI_PROVIDER || 'gemini';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

let _ai: any = null;

export async function getAIClient() {
  if (!_ai) {
    const { default: OpenAI } = await import('openai');
    if (AI_PROVIDER === 'openai' && OPENAI_API_KEY) {
      _ai = new OpenAI({ apiKey: OPENAI_API_KEY });
    } else if (AI_PROVIDER === 'gemini' && GEMINI_API_KEY) {
      _ai = new OpenAI({
        apiKey: GEMINI_API_KEY,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
      });
    } else {
      _ai = new OpenAI({
        apiKey: DEEPSEEK_API_KEY || '',
        baseURL: 'https://api.deepseek.com',
      });
    }
  }
  return _ai;
}

// Meal analysis reads the photo and is the one call worth spending quota on;
// everything else is short text work.
export type AITask = 'meal-analysis' | 'light';

export function getModel(task: AITask = 'light'): string {
  if (AI_PROVIDER === 'openai' && OPENAI_API_KEY) return 'gpt-4o-mini';
  if (AI_PROVIDER === 'gemini' && GEMINI_API_KEY) {
    // flash-lite has roughly double the free-tier RPM, so the lighter tasks
    // (suggestions, supplement tips, weekly review) use it. Meal analysis gets
    // full flash, which reads photos noticeably better.
    return task === 'meal-analysis' ? 'gemini-flash-latest' : 'gemini-flash-lite-latest';
  }
  return 'deepseek-chat';
}

// deepseek-chat lacks response_format json_object support in our usage
export function supportsJsonMode(model: string): boolean {
  return model !== 'deepseek-chat';
}

// Whether the model can read images. deepseek-chat is text-only and its API
// also rejects the array-of-parts message shape, so callers must fall back to
// a plain text prompt rather than attaching the photo.
export function supportsVision(model: string): boolean {
  return model.startsWith('gpt-4') || model.startsWith('gemini-');
}

// Extract a JSON object from a completion that may wrap it in ```json fences
export function extractJson(text: string): string {
  const jsonMatch = text.match(/```json\n([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[1] || jsonMatch[0] : text;
}
