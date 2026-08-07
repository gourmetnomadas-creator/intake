import { NextRequest, NextResponse } from 'next/server';
import { getAIClient, getModel, supportsJsonMode, extractJson } from '@/lib/ai';
import { requireUser } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const unauth = await requireUser();
    if (unauth) return unauth;

    const { name } = await request.json();
    if (!name || typeof name !== 'string' || name.length > 100) {
      return NextResponse.json({ error: 'Invalid supplement name' }, { status: 400 });
    }

    const ai = await getAIClient();
    const model = getModel();

    const completion = await ai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You advise on the best time of day to take a dietary supplement.
Return ONLY valid JSON: {"timeOfDay": "morning"|"midday"|"evening"|"night", "withFood": boolean, "tip": "one short sentence in Spanish explaining when/how to take it and why"}.
Be practical and conventional; if evidence is mixed, pick the most common recommendation.`,
        },
        { role: 'user', content: `Supplement: ${name}` },
      ],
      temperature: 0.2,
      ...(supportsJsonMode(model) ? { response_format: { type: 'json_object' } } : {}),
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) {
      return NextResponse.json({ error: 'AI returned empty response' }, { status: 500 });
    }

    const result = JSON.parse(extractJson(text));
    const validTimes = ['morning', 'midday', 'evening', 'night'];

    return NextResponse.json({
      timeOfDay: validTimes.includes(result.timeOfDay) ? result.timeOfDay : 'morning',
      withFood: Boolean(result.withFood),
      tip: typeof result.tip === 'string' ? result.tip.slice(0, 200) : '',
    });
  } catch (error) {
    console.error('Suggest supplement error:', error);
    return NextResponse.json(
      { error: 'Could not get a suggestion. You can set the time manually.' },
      { status: 500 }
    );
  }
}
