import { NextRequest, NextResponse } from 'next/server';
import { getAIClient, getModel, supportsJsonMode, extractJson } from '@/lib/ai';
import { requireUser } from '@/lib/api-auth';
import { describeMacroGaps } from '@/lib/calculations';

// Suggests the user's next meal from where the day actually stands (which
// meals are already logged, not just the clock), the room left in the calorie
// budget, the signed macro gaps, and dietary preferences.
export async function POST(request: NextRequest) {
  try {
    const unauth = await requireUser();
    if (unauth) return unauth;

    const {
      mealType = 'meal',
      isClosing = false,
      minutesSinceLastMeal = null,
      maxKcal = null,
      targetKcal = null,
      count = 3,
      remainingProtein,
      remainingCarbs,
      remainingFat,
      consumedToday = [],
      dietType,
      restrictions,
      recentFoods,
    } = await request.json();

    const wanted = Math.min(3, Math.max(1, Math.round(Number(count) || 3)));

    const ai = await getAIClient();
    const model = getModel();

    const dietLine = dietType && dietType !== 'omnivore'
      ? `Diet: ${dietType} (strict).`
      : 'Diet: no restrictions (omnivore).';
    const avoidLine = restrictions ? `ALWAYS avoid (allergies/dislikes): ${restrictions}.` : '';

    // Signed gaps: a macro past its target has to be visible as an overshoot,
    // not flattened into "nothing left to fill".
    const macros = describeMacroGaps({
      protein: remainingProtein ?? null,
      carbs: remainingCarbs ?? null,
      fat: remainingFat ?? null,
    });

    const macroPriority = macros.priority
      ? `Priority macro: ${macros.priority.toUpperCase()}.`
      : 'No macro is meaningfully short — keep it light and balanced.';
    const overLine = macros.over.length > 0
      ? `Already over target: ${macros.over.join(', ')}. A suggestion that adds more of these is wrong.`
      : '';

    const consumedLine = consumedToday.length > 0
      ? `Already eaten today: ${consumedToday.slice(0, 5).join(', ')}${consumedToday.length > 5 ? '...' : ''}.`
      : 'No meals logged yet.';

    const budgetLine = maxKcal !== null
      ? `Calorie room: aim for about ${Math.round(targetKcal ?? maxKcal)} kcal, HARD MAXIMUM ${Math.round(maxKcal)} kcal per suggestion. Never exceed the maximum; coming in under it is fine.`
      : 'No calorie goal set — keep portions ordinary.';

    const stageLine = isClosing
      ? `The main meals of the day are done (this slot is ${mealType}). Only a small close-out fits: a snack, a dessert or a piece of fruit — NOT another plate of food. Portions must be snack-sized.`
      : `Next slot: ${mealType}. More meals may still follow today, so do not spend the whole remaining budget here.`;

    const sinceLine = typeof minutesSinceLastMeal === 'number'
      ? `Last meal was logged ${minutesSinceLastMeal} minutes ago.${minutesSinceLastMeal < 90 ? ' They just ate, so suggest something light they can have soon.' : ''}`
      : '';

    const completion = await ai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are Intake's nutrition assistant. You suggest what the user should eat next, sized to where their day actually stands and prioritising the gaps they still have to close.

LANGUAGE: every title, description and "why" must be written in English. The meals the user logged may be written in another language — translate those dishes into English rather than echoing the words back. This holds no matter what language the context below is in.

JSON RESPONSE: {"suggestions":[{"title":"name","description":"ingredients and grams, ready to log","kcal":number,"protein_g":number,"carbs_g":number,"fat_g":number,"why":"WHY this today (e.g. 'You're 20g short on protein — this adds 22g')","repeat":boolean}]}

STRICT RULES:
1. Exactly ${wanted} suggestion${wanted === 1 ? '' : 's'}, all different from each other and from what they already ate today.
2. A repeat of something they habitually eat (repeat:true) is welcome as the first one, but ONLY if it genuinely fits the calorie room and the macro gaps at this point of the day. If nothing habitual fits, return only new options — never stretch or shrink a habitual meal into something the user would not recognise. Mark everything else repeat:false.
3. NEVER INCLUDE ingredients from the avoid list.
4. Strictly respect the stated diet.
5. The portions you write must genuinely add up to the kcal and macros you report, and must stay under the hard maximum. Do not pad a small portion up to the remaining calories.
6. Never suggest more of a macro that is already over target.
7. The "why" must explain which specific gap it addresses, and say so honestly when the point is simply that little is left to close.
8. Realistic ingredients for home cooking.`,
        },
        {
          role: 'user',
          content: `TODAY'S CONTEXT:
${stageLine}
${sinceLine}
${budgetLine}

MACRO GAPS (target minus eaten):
${macros.lines.length > 0 ? macros.lines.join('\n') : 'No macro targets set.'}
${macroPriority}
${overLine}

${dietLine}
${avoidLine}

${consumedLine}

Meals the user usually eats: ${recentFoods || '(no history yet)'}.

INSTRUCTIONS:
- Give ${wanted} option${wanted === 1 ? '' : 's'} for this slot, sized to the calorie room above.
- Lead with a habitual meal only if it fits as-is; otherwise give new options, one aimed at the priority macro and one at variety.
- Answer in English, including any dish above that is written in another language.`,
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
    const suggestions = Array.isArray(result.suggestions) ? result.suggestions.slice(0, wanted) : [];
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
