import { NextRequest, NextResponse } from 'next/server';
import { analyzeMealSchema } from '@/lib/validations';
import { getAIClient, getModel, supportsJsonMode, supportsVision, extractJson } from '@/lib/ai';
import { requireUser } from '@/lib/api-auth';

// Reading a photo takes a vision model well past Vercel's default function
// timeout (10s), which kills the request mid-flight: the browser sees the
// connection drop rather than an error, so the button sits on "Analyzing…"
// until fetch finally rejects with "Load failed". Text-only meals answer fast
// enough to slip under the default, which is why only photos appeared broken.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const unauth = await requireUser();
    if (unauth) return unauth;

    const body = await request.json();
    const parsed = analyzeMealSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { description, totalWeightGrams, weightContext, imageBase64 } = parsed.data;
    const ai = await getAIClient();
    const model = getModel('meal-analysis');

    // Only attach the photo when the configured model can actually read it —
    // deepseek-chat cannot, and would fail the whole request.
    const analyzingPhoto = Boolean(imageBase64) && supportsVision(model);
    const described = description.trim().length > 0;

    const systemPrompt = `You are a cautious and helpful food analysis assistant.

Analyze the meal${analyzingPhoto ? (described ? ' photo and description' : ' photo') : ' description'} and return a JSON array of detected food items.

Rules:
- The description may be written in any language (Spanish and English are both common). Understand it either way; never ask the user to rewrite it.
- Be conservative with estimates.
${
  analyzingPhoto
    ? `- A photo of the meal is attached. Use it to identify foods and judge portion sizes, and prefer what you can see over what the description implies when they disagree.
- If the photo is too blurry or dark to read, say so in "warnings" and fall back to the description.
${
  described
    ? ''
    : `- Nothing was written about this meal, so identify every food you can see and estimate its portion from the photo alone. Include drinks. Judge sizes against familiar objects in frame — a plate, a mug, cutlery.
- Name what you see plainly ("omelette", "rye toast", "black coffee") rather than guessing at recipes you cannot verify.`
}`
    : ''
}
${
  totalWeightGrams
    ? `- If weight context is "whole_plate", the sum of ingredient grams must equal ${totalWeightGrams}g.
- If weight context is "one_ingredient", only the main ingredient gets ${totalWeightGrams}g; estimate others separately.
- If weight context is "separate_ingredients", distribute ${totalWeightGrams}g according to the description proportions.`
    : `- No total weight was given. Estimate each item's grams from the ${analyzingPhoto ? (described ? 'photo and description' : 'photo') : 'description'} using common serving sizes (e.g. "a glass of wine" ≈ 150 ml/150 g, "a coffee with milk" ≈ 200 g, "a slice of pizza" ≈ 120 g, "1 banana" ≈ 120 g). Keep confidence realistic since portions are estimated.`
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

    // A photo can arrive with nothing written alongside it, so the description
    // line is dropped rather than sent empty.
    const source = analyzingPhoto
      ? described
        ? 'photo and description'
        : 'photo'
      : 'description';

    const userText = [
      described ? `Description: "${description}"` : 'No description given — read the meal from the photo.',
      totalWeightGrams
        ? `Total weight: ${totalWeightGrams}g\nWeight context: ${(weightContext ?? 'whole_plate').replace('_', ' ')}`
        : `No total weight provided — estimate portions from the ${source}.`,
    ].join('\n');

    // Without a photo the content stays a plain string: DeepSeek's API rejects
    // the array-of-parts shape outright.
    // The client always re-encodes photos as JPEG, so the MIME type is known.
    const userContent = analyzingPhoto
      ? [
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          { type: 'text', text: userText },
        ]
      : userText;

    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
    ];

    // Timing is the only way to tell a slow model from a slow upload once this
    // is running on a phone, where neither is visible.
    const startedAt = Date.now();
    const completion = await ai.chat.completions.create({
      model,
      messages,
      temperature: 0.3,
      ...(supportsJsonMode(model) ? { response_format: { type: 'json_object' } } : {}),
    });
    console.log(
      `analyze-meal: ${model} answered in ${Date.now() - startedAt}ms ` +
        `(photo: ${analyzingPhoto ? `${Math.round((imageBase64?.length ?? 0) / 1024)}KB` : 'none'})`
    );

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
        // Analyzing the photo, or having none to analyze, is the expected case
        // and needs no announcement. Only speak up when a photo was attached
        // and silently ignored, which the user has no other way to notice.
        ...(imageBase64 && !analyzingPhoto
          ? ['Your photo was not analyzed (this AI model reads text only). Please review carefully.']
          : []),
        'This is an estimate. Please review the grams before saving.',
      ].filter(Boolean),
    });
  } catch (error) {
    console.error('Analyze meal error:', error);

    // The generic message hid every cause behind the same sentence, so a spent
    // daily quota, a retired model alias and a dropped connection all looked
    // identical from the phone. Name the cause the user can act on.
    const status = (error as { status?: number })?.status;
    const detail =
      status === 429
        ? " The AI provider's quota for today is used up — it resets tomorrow."
        : status === 404
          ? ' The configured AI model is no longer available.'
          : status === 401 || status === 403
            ? " The AI provider rejected the app's API key."
            // A 503 means the provider is refusing the model itself, not that
            // anything here is wrong. It read as the generic failure for days
            // while the model behind meal analysis was permanently overloaded.
            : status === 503
              ? ' The AI provider is overloaded right now.'
              : '';

    return NextResponse.json(
      {
        error: `Could not analyze meal.${detail} Please try again or add ingredients manually.`,
      },
      { status: 500 }
    );
  }
}
