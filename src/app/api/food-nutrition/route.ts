import { NextRequest, NextResponse } from 'next/server';
import { getAIClient, getModel, supportsJsonMode, extractJson } from '@/lib/ai';
import { searchLocalFoods } from '@/lib/food-database';
import { requireUser } from '@/lib/api-auth';

// Nutrition per 100 g for a single food name — local database first, then AI.
export async function POST(request: NextRequest) {
  try {
    const unauth = await requireUser();
    if (unauth) return unauth;

    const { name } = await request.json();
    if (!name || typeof name !== 'string' || name.length > 100) {
      return NextResponse.json({ error: 'Invalid food name' }, { status: 400 });
    }

    const local = searchLocalFoods(name)[0];
    if (local) {
      return NextResponse.json({
        kcalPer100g: local.kcalPer100g,
        proteinPer100g: local.proteinPer100g,
        carbsPer100g: local.carbsPer100g,
        fatPer100g: local.fatPer100g,
        source: 'local',
      });
    }

    const ai = await getAIClient();
    const model = getModel();
    const completion = await ai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You provide nutrition facts per 100 g for a food.
Return ONLY valid JSON: {"kcalPer100g":number,"proteinPer100g":number,"carbsPer100g":number,"fatPer100g":number}.
Use standard reference values for the food as commonly prepared. Numbers only, no ranges.`,
        },
        { role: 'user', content: `Food: ${name}` },
      ],
      temperature: 0.2,
      ...(supportsJsonMode(model) ? { response_format: { type: 'json_object' } } : {}),
    });

    const text = completion.choices[0]?.message?.content;
    if (!text) return NextResponse.json({ error: 'AI returned empty response' }, { status: 500 });

    const r = JSON.parse(extractJson(text));
    const num = (v: unknown) => (typeof v === 'number' && isFinite(v) && v >= 0 ? v : 0);
    return NextResponse.json({
      kcalPer100g: num(r.kcalPer100g),
      proteinPer100g: num(r.proteinPer100g),
      carbsPer100g: num(r.carbsPer100g),
      fatPer100g: num(r.fatPer100g),
      source: 'ai',
    });
  } catch (error: any) {
    console.error('Food nutrition error:', error);
    const rateLimited = error?.status === 429 || String(error?.message ?? '').includes('429');
    return NextResponse.json(
      { error: rateLimited ? 'The AI is busy right now. Try again in a minute.' : 'Could not look up nutrition.' },
      { status: rateLimited ? 429 : 500 }
    );
  }
}
