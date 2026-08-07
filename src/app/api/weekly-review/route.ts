import { NextRequest, NextResponse } from 'next/server';
import { getAIClient, getModel, supportsJsonMode, extractJson } from '@/lib/ai';

import { requireUser } from '@/lib/api-auth';

// Receives a compact, pre-computed summary of the user's last 7 days and asks
// the AI for a short, friendly, actionable review in English.
export async function POST(request: NextRequest) {
  try {
    const unauth = await requireUser();
    if (unauth) return unauth;

    const summary = await request.json();

    const ai = await getAIClient();
    const model = getModel();

    const completion = await ai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You are a warm, practical nutrition coach. You receive a summary of a user's last 7 days (average calories and macros vs their targets, and supplement adherence).
Return ONLY valid JSON: {"headline": "one motivating summary sentence in English", "insights": ["3 to 5 short, actionable observations in English"]}.
Rules: be specific and use the numbers from the summary. Mention protein, calories, macro balance and missed supplements where relevant. Friendly tone, no alarmism. Do not give medical advice. Write everything in English. One sentence per insight.`,
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
