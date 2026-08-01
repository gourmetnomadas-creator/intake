import { NextRequest, NextResponse } from 'next/server';
import { getAIClient, getModel, supportsJsonMode, extractJson } from '@/lib/ai';

// Suggests the user's next meal from time of day, remaining daily budget,
// dietary preferences, consumed foods today, and macro prioritization.
export async function POST(request: NextRequest) {
  try {
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
      ? `Dieta: ${dietType} (estricto).`
      : 'Dieta: sin restricción (omnívoro).';
    const avoidLine = restrictions ? `Evitar SIEMPRE (alergias/rechazos): ${restrictions}.` : '';

    // Determine macro priorities: which is the biggest gap?
    const macroDeficits = [
      { name: 'protein', value: Math.max(0, remainingProtein ?? 0), priority: 1 },
      { name: 'carbs', value: Math.max(0, remainingCarbs ?? 0), priority: 2 },
      { name: 'fat', value: Math.max(0, remainingFat ?? 0), priority: 3 },
    ].sort((a, b) => b.value - a.value);

    const topDeficit = macroDeficits[0];
    const macroPriority = topDeficit.value > 0
      ? `Prioridad: ${topDeficit.name === 'protein' ? 'PROTEÍNA' : topDeficit.name === 'carbs' ? 'CARBOHIDRATOS' : 'GRASAS'} (falta ${topDeficit.value}g).`
      : 'Balanceá macros dentro de las calorías restantes.';

    const consumedLine = consumedToday.length > 0
      ? `Ya comió hoy: ${consumedToday.slice(0, 5).join(', ')}${consumedToday.length > 5 ? '...' : ''}.`
      : 'Sin comidas registradas aún.';

    const mealCountContext = mealCount === 0
      ? 'Primera comida del día — energía + nutrientes.'
      : mealCount === 1
      ? 'Segunda comida — varía de la anterior.'
      : mealCount >= 4
      ? 'Última comida del día — ligero y nutritivo.'
      : 'Comida intermedia — equilibrio.';

    const completion = await ai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `Sos el asistente de nutrición inteligente de Intake. Sugerís 3 comidas para la PRÓXIMA ingesta del usuario, priorizando cerrar sus déficits nutricionales del día.

RESPUESTA JSON: {"suggestions":[{"title":"nombre","description":"ingredientes y gramos, lista para registrar","kcal":number,"protein_g":number,"carbs_g":number,"fat_g":number,"why":"POR QUÉ esta comida hoy (ej: 'Te faltan 20g proteína — esto suma 22g')","repeat":boolean}]}

REGLAS ESTRICTAS:
1. Exactamente 3 sugerencias.
2. Una DEBE ser repetida (algo que ya come: repeat:true).
3. Las otras dos deben ser DISTINTAS entre sí Y distintas de lo que ya comió hoy (repeat:false).
4. NUNCA INCLUYAS ingredientes de la lista de evitar.
5. Respetá estrictamente la dieta declarada.
6. Cada comida debe caber en calorías restantes.
7. El "why" debe explicar qué macro específico aborda o qué variedad aporta.
8. Ingredientes realistas para cocina casera. En español.`,
        },
        {
          role: 'user',
          content: `CONTEXTO DEL DÍA:
Momento: ${mealType} (${mealCountContext}).
Calorías restantes: ${Math.max(0, Math.round(remainingKcal ?? 0))} kcal.
${macroPriority}
Carbohidratos restantes: ${Math.max(0, Math.round(remainingCarbs ?? 0))}g.
Grasas restantes: ${Math.max(0, Math.round(remainingFat ?? 0))}g.

${dietLine}
${avoidLine}

${consumedLine}

Comidas habituales del usuario: ${recentFoods || '(sin historial aún)'}.

INSTRUCCIONES:
- 1ª sugerencia: Comida favorita/habitual (repeat:true) que aborde déficits.
- 2ª y 3ª: Opciones nuevas que el usuario no comió hoy, una enfocada en macro-déficit, otra en variedad.`,
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
