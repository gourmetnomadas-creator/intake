// Shared AI chat client: OpenAI, Gemini (free tier, OpenAI-compatible
// endpoint) or DeepSeek, selected via AI_PROVIDER.
const AI_PROVIDER = process.env.AI_PROVIDER || 'deepseek';
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

export function getModel(): string {
  if (AI_PROVIDER === 'openai' && OPENAI_API_KEY) return 'gpt-4o-mini';
  // flash-lite has a much higher free-tier quota; used for the lighter tasks
  // (suggestions, supplement tips, weekly review). Meal analysis keeps flash.
  if (AI_PROVIDER === 'gemini' && GEMINI_API_KEY) return 'gemini-flash-lite-latest';
  return 'deepseek-chat';
}

// deepseek-chat lacks response_format json_object support in our usage
export function supportsJsonMode(model: string): boolean {
  return model !== 'deepseek-chat';
}

// Extract a JSON object from a completion that may wrap it in ```json fences
export function extractJson(text: string): string {
  const jsonMatch = text.match(/```json\n([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[1] || jsonMatch[0] : text;
}
