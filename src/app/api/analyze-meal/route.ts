import { NextRequest, NextResponse } from 'next/server';
import { analyzeMealSchema } from '@/lib/validations';
import { getAIClient, getModel, supportsJsonMode, extractJson } from '@/lib/ai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = analyzeMealSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { description, totalWeightGrams, weightContext } = parsed.data;
    const ai = await getAIClient();

    const systemPrompt = `You are a cautious and helpful food analysis assistant.

Analyze the meal description and return a JSON array of detected food items.

Rules:
- Be conservative with estimates.
${
  totalWeightGrams
    ? `- If weight context is "whole_plate", the sum of ingredient grams must equal ${totalWeightGrams}g.
- If weight context is "one_ingredient", only the main ingredient gets ${totalWeightGrams}g; estimate others separately.
- If weight context is "separate_ingredients", distribute ${totalWeightGrams}g according to the description proportions.`
    : `- No total weight was given. Estimate each item's grams from the description using common serving sizes (e.g. "a glass of wine" ≈ 150 ml/150 g, "a coffee with milk" ≈ 200 g, "a slice of pizza" ≈ 120 g, "1 banana" ≈ 120 g). Keep confidence realistic since portions are estimated.`
}
- Use standard nutrition data per 100g for each food.
- Mark confidence low (0.4-0.6) if unsure, medium (0.6-0.8) if reasonable, high (0.8-1.0) for obvious items.
- Source should always be "estimated".
- If a food cannot be identified, use "unknown ingredient" and allow editing.

Return ONLY valid JSON in this exact format:
{
  "items": [
    {
      "foodName": "string",
      "grams": number,
      "kcalPer100g": number,
      "proteinPer100g": number,
      "carbsPer100g": number,
      "fatPer100g": number,
      "source": "estimated",
      "confidence": number
    }
  ],
  "totalKcal": number,
  "totalProtein": number,
  "totalCarbs": number,
  "totalFat": number,
  "confidence": number,
  "warnings": ["string"]
}`;

    const userMessage = totalWeightGrams
      ? `Description: "${description}"
Total weight: ${totalWeightGrams}g
Weight context: ${(weightContext ?? 'whole_plate').replace('_', ' ')}`
      : `Description: "${description}"
No total weight provided — estimate portions from the description.`;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const model = getModel();

    const completion = await ai.chat.completions.create({
      model,
      messages,
      temperature: 0.3,
      ...(supportsJsonMode(model) ? { response_format: { type: 'json_object' } } : {}),
    });

    let text = completion.choices[0]?.message?.content;
    if (!text) {
      return NextResponse.json(
        { error: 'AI returned empty response' },
        { status: 500 }
      );
    }

    const result = JSON.parse(extractJson(text));

    return NextResponse.json({
      ...result,
      warnings: [
        ...(result.warnings || []),
        'Analysis is text-only (photo not analyzed). Please review carefully.',
        'This is an estimate. Please review the grams before saving.',
      ].filter(Boolean),
    });
  } catch (error) {
    console.error('Analyze meal error:', error);
    return NextResponse.json(
      {
        error: 'Could not analyze meal. Please try again or add ingredients manually.',
      },
      { status: 500 }
    );
  }
}
