// Shared AI chat client: OpenAI, Gemini (free tier, OpenAI-compatible
// endpoint) or DeepSeek, selected via AI_PROVIDER.
const AI_PROVIDER = process.env.AI_PROVIDER || 'gemini';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

let _ai: any = null;

// A call that hangs is worse than one that fails: the function gets killed by
// the platform mid-flight and the browser sees a dropped connection instead of
// a message it can show. The retry was the thing that broke that promise — two
// attempts of 25s plus the photo upload ran past the 60s the function has, so
// it died with nothing to say. One attempt always leaves room to answer.
const REQUEST_TIMEOUT_MS = 25_000;
const MAX_RETRIES = 0;

export async function getAIClient() {
  if (!_ai) {
    const { default: OpenAI } = await import('openai');
    if (AI_PROVIDER === 'openai' && OPENAI_API_KEY) {
      _ai = new OpenAI({ apiKey: OPENAI_API_KEY, timeout: REQUEST_TIMEOUT_MS, maxRetries: MAX_RETRIES });
    } else if (AI_PROVIDER === 'gemini' && GEMINI_API_KEY) {
      _ai = new OpenAI({
        apiKey: GEMINI_API_KEY,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        timeout: REQUEST_TIMEOUT_MS,
        maxRetries: MAX_RETRIES,
      });
    } else if (AI_PROVIDER === 'deepseek' && DEEPSEEK_API_KEY) {
      _ai = new OpenAI({
        apiKey: DEEPSEEK_API_KEY,
        baseURL: 'https://api.deepseek.com',
        timeout: REQUEST_TIMEOUT_MS,
        maxRetries: MAX_RETRIES,
      });
    } else {
      throw new Error(
        `AI configuration error: AI_PROVIDER="${AI_PROVIDER}" but no API key found. ` +
        `Configure ${AI_PROVIDER.toUpperCase()}_API_KEY in environment variables.`
      );
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
    // Both tasks run on flash-lite. Meal analysis and voice input used to get
    // full `gemini-flash-latest`, which reads photos better — but the free tier
    // stopped serving it, answering every request (text, image and audio alike)
    // with a 503 "currently experiencing high demand". Those 503s took up to
    // 45s to arrive, which is why the phone showed a timeout as often as an
    // error. flash-lite answers the same photo in about a second.
    //
    // Falling back from flash to flash-lite was considered and rejected: the
    // failing model burns the whole time budget before the fallback can start.
    // If flash becomes reachable again, `tests/ai-live.test.ts` is the check
    // that proves it before this line goes back to splitting by task.
    void task;
    return 'gemini-flash-lite-latest';
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

// Whether the model can listen to an audio clip. Narrower than vision: the
// gpt-4o-mini used here reads images but not audio, and OpenAI keeps audio
// input to its dedicated audio models.
export function supportsAudio(model: string): boolean {
  return model.startsWith('gemini-');
}

// Extract a JSON object from a completion that may wrap it in ```json fences
export function extractJson(text: string): string {
  const jsonMatch = text.match(/```json\n([\s\S]*?)```/) || text.match(/\{[\s\S]*\}/);
  return jsonMatch ? jsonMatch[1] || jsonMatch[0] : text;
}
