import { NextRequest, NextResponse } from 'next/server';
import { getAIClient, getModel, supportsJsonMode, extractJson } from '@/lib/ai';
import { requireUser } from '@/lib/api-auth';

// Suggests the user's next meal from time of day, remaining daily budget,
// dietary preferences, consumed foods today, and macro prioritization.
export async function POST(request: NextRequest) {
  try {
    const unauth = await requireUser();
    if (unauth) return unauth;

    const {
      mealType = 'meal',
      remainingKcal,
      remainingProtein,
      remainingCarbs,
      remainingFat,
      mealCount,
      consumedToday = [],
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

    // Determine macro priorities: which is the biggest gap?
    const macroDeficits = [
      { name: 'protein', value: Math.max(0, remainingProtein ?? 0), priority: 1 },
      { name: 'carbs', value: Math.max(0, remainingCarbs ?? 0), priority: 2 },
      { name: 'fat', value: Math.max(0, remainingFat ?? 0), priority: 3 },
    ].sort((a, b) => b.value - a.value);

    const topDeficit = macroDeficits[0];
    const macroPriority = topDeficit.value > 0
      ? `Priority: ${topDeficit.name.toUpperCase()} (${topDeficit.value}g short).`
      : 'Balance macros within the remaining calories.';

    const consumedLine = consumedToday.length > 0
      ? `Already eaten today: ${consumedToday.slice(0, 5).join(', ')}${consumedToday.length > 5 ? '...' : ''}.`
      : 'No meals logged yet.';

    const mealCountContext = mealCount === 0
      ? 'First meal of the day — energy + nutrients.'
      : mealCount === 1
      ? 'Second meal — vary it from the previous one.'
      : mealCount >= 4
      ? 'Last meal of the day — light and nutritious.'
      : 'Mid-day meal — balance.';

    const completion = await ai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are Intake's nutrition assistant. You suggest 3 meals for the user's NEXT meal, prioritising closing their nutritional gaps for the day.

JSON RESPONSE: {"suggestions":[{"title":"name","description":"ingredients and grams, ready to log","kcal":number,"protein_g":number,"carbs_g":number,"fat_g":number,"why":"WHY this meal today (e.g. 'You're 20g short on protein — this adds 22g')","repeat":boolean}]}

STRICT RULES:
1. Exactly 3 suggestions.
2. One MUST be a repeat (something they already eat: repeat:true).
3. The other two must be DIFFERENT from each other AND from what they already ate today (repeat:false).
4. NEVER INCLUDE ingredients from the avoid list.
5. Strictly respect the stated diet.
6. Each meal must fit within the remaining calories.
7. The "why" must explain which specific macro it addresses or what variety it adds.
8. Realistic ingredients for home cooking. Write everything in English.`,
        },
        {
          role: 'user',
          content: `TODAY'S CONTEXT:
Time of day: ${mealType} (${mealCountContext}).
Remaining calories: ${Math.max(0, Math.round(remainingKcal ?? 0))} kcal.
${macroPriority}
Remaining carbs: ${Math.max(0, Math.round(remainingCarbs ?? 0))}g.
Remaining fat: ${Math.max(0, Math.round(remainingFat ?? 0))}g.

${dietLine}
${avoidLine}

${consumedLine}

Meals the user usually eats: ${recentFoods || '(no history yet)'}.

INSTRUCTIONS:
- 1st suggestion: a favourite/habitual meal (repeat:true) that addresses the gaps.
- 2nd and 3rd: new options the user has not eaten today, one focused on the macro gap, one on variety.`,
        },
      ],
      temperature: 0.6,
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
