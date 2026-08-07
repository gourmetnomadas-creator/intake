import { NextRequest, NextResponse } from 'next/server';
import { getAIClient, getModel, supportsJsonMode, extractJson } from '@/lib/ai';
import { requireUser } from '@/lib/api-auth';

// Suggests the user's next meal from time of day, remaining daily budget,
// dietary preferences, and the foods they actually cook.
export async function POST(request: NextRequest) {
  try {
    const unauth = await requireUser();
    if (unauth) return unauth;

    const {
      mealType = 'meal',
      remainingKcal,
      remainingProtein,
      dietType,
      restrictions,
      recentFoods,
    } = await request.json();

    const ai = await getAIClient();
    const model = getModel();

    const dietLine = dietType && dietType !== 'omnivore'
      ? `Diet: ${dietType} (strict).`
      : 'Diet: no restrictions (omnivore).';
    const avoidLine = restrictions ? `ALWAYS avoid (allergies/dislikes): ${restrictions}.` : '';

    const completion = await ai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are the nutrition assistant for the Intake app. You suggest the user's NEXT meal.
Return ONLY valid JSON: {"suggestions":[{"title":"short name","description":"description with ingredients and approximate grams, ready to log","kcal":number,"protein_g":number,"carbs_g":number,"fat_g":number,"why":"one sentence on why it fits today","repeat":boolean}]}.
Rules: exactly 3 suggestions. One must be something the user already eats (repeat:true) and the other two distinct alternatives (repeat:false).
STRICTLY RESPECT the diet and allergies: never include a forbidden ingredient.
Prioritise covering the protein still missing and balancing macros within the remaining calories. Realistic ingredients for home cooking. Write everything in English.`,
        },
        {
          role: 'user',
          content: `Time of day: ${mealType}.
Remaining today: ${Math.max(0, Math.round(remainingKcal ?? 0))} kcal, ${Math.max(0, Math.round(remainingProtein ?? 0))} g protein.
${dietLine}
${avoidLine}
Foods the user usually eats/cooks: ${recentFoods || '(no history yet)'}.`,
        },
      ],
      temperature: 0.5,
      ...(supportsJsonMode(model) ? { response_format: { type: 'json_object' } } : {}),
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      return NextResponse.json({ error: 'AI returned empty response' }, { status: 500 });
    }

    const result = JSON.parse(extractJson(text));
    const suggestions = Array.isArray(result.suggestions) ? result.suggestions.slice(0, 3) : [];
    return NextResponse.json({ suggestions });
  } catch (error: any) {
    console.error('Suggest meal error:', error);
    const rateLimited = error?.status === 429 || String(error?.message ?? '').includes('429');
    return NextResponse.json(
      {
        error: rateLimited
          ? 'The AI is busy right now (rate limit). Please try again in a minute.'
          : 'Could not get suggestions. Please try again.',
      },
      { status: rateLimited ? 429 : 500 }
    );
  }
}
