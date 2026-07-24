import { NextRequest, NextResponse } from 'next/server';
import { getAIClient, getModel, supportsJsonMode, extractJson } from '@/lib/ai';

// Receives a compact, pre-computed summary of the user's last 7 days and asks
// the AI for a short, friendly, actionable review in Spanish.
export async function POST(request: NextRequest) {
  try {
    const summary = await request.json();

    const ai = await getAIClient();
    const model = getModel();

    const completion = await ai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `Eres un coach de nutrición cercano y práctico. Recibes un resumen de los últimos 7 días de un usuario (promedios de calorías y macros vs sus objetivos, y adherencia a suplementos).
Devuelve SOLO JSON válido: {"headline": "una frase resumen motivadora en español", "insights": ["3 a 5 observaciones cortas y accionables en español"]}.
Reglas: sé concreto y usa los números del resumen. Menciona proteína, calorías, balance de macros y suplementos olvidados cuando aplique. Tono amable, sin alarmismo. No des consejo médico. Cada insight, una sola oración.`,
        },
        { role: 'user', content: JSON.stringify(summary) },
      ],
      temperature: 0.4,
      ...(supportsJsonMode(model) ? { response_format: { type: 'json_object' } } : {}),
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      return NextResponse.json({ error: 'AI returned empty response' }, { status: 500 });
    }

    const result = JSON.parse(extractJson(text));
    return NextResponse.json({
      headline: typeof result.headline === 'string' ? result.headline.slice(0, 200) : '',
      insights: Array.isArray(result.insights)
        ? result.insights.filter((i: unknown) => typeof i === 'string').slice(0, 5)
        : [],
    });
  } catch (error) {
    console.error('Weekly review error:', error);
    return NextResponse.json(
      { error: 'Could not generate the review. Please try again.' },
      { status: 500 }
    );
  }
}
