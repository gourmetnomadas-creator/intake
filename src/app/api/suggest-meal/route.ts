import { NextRequest, NextResponse } from 'next/server';
import { getAIClient, getModel, supportsJsonMode, extractJson } from '@/lib/ai';

// Suggests the user's next meal from time of day, remaining daily budget,
// dietary preferences, and the foods they actually cook.
export async function POST(request: NextRequest) {
  try {
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
      ? `Dieta: ${dietType} (estricto).`
      : 'Dieta: sin restricción (omnívoro).';
    const avoidLine = restrictions ? `Evitar SIEMPRE (alergias/rechazos): ${restrictions}.` : '';

    const completion = await ai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `Sos el asistente de nutrición de la app Intake. Sugerís la PRÓXIMA comida del usuario.
Devolvés SOLO JSON válido: {"suggestions":[{"title":"nombre corto","description":"descripción con ingredientes y gramos aproximados, lista para registrar","kcal":number,"protein_g":number,"carbs_g":number,"fat_g":number,"why":"una frase de por qué encaja hoy","repeat":boolean}]}.
Reglas: exactamente 3 sugerencias. Una debe ser algo que el usuario ya come (repeat:true) y las otras dos alternativas distintas (repeat:false).
RESPETÁ ESTRICTAMENTE la dieta y las alergias: nunca incluyas un ingrediente prohibido.
Priorizá cubrir la proteína que falta y balancear macros dentro de las calorías restantes. Ingredientes realistas para cocinar en casa. En español.`,
        },
        {
          role: 'user',
          content: `Momento: ${mealType}.
Restante para hoy: ${Math.max(0, Math.round(remainingKcal ?? 0))} kcal, ${Math.max(0, Math.round(remainingProtein ?? 0))} g proteína.
${dietLine}
${avoidLine}
Comidas que el usuario suele comer/cocinar: ${recentFoods || '(sin historial aún)'}.`,
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
    return NextResponse.json(
      {
        error: 'Could not get suggestions. Please try again.',
        _debug: {
          message: String(error?.message ?? error),
          provider: process.env.AI_PROVIDER ?? null,
          hasGemini: !!process.env.GEMINI_API_KEY,
          geminiLen: (process.env.GEMINI_API_KEY ?? '').length,
          model: getModel(),
        },
      },
      { status: 500 }
    );
  }
}
