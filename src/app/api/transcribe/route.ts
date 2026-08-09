import { NextRequest, NextResponse } from 'next/server';
import { transcribeSchema } from '@/lib/validations';
import { getAIClient, getModel, supportsAudio } from '@/lib/ai';
import { requireUser } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const unauth = await requireUser();
    if (unauth) return unauth;

    const body = await request.json();
    const parsed = transcribeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { audioBase64, format } = parsed.data;
    const model = getModel('meal-analysis');

    if (!supportsAudio(model)) {
      return NextResponse.json(
        { error: 'Voice input needs an AI provider that can hear audio. Type the description instead.' },
        { status: 503 }
      );
    }

    const ai = await getAIClient();

    const completion = await ai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: `You transcribe short spoken descriptions of meals.

Rules:
- Write down what was said, in the language it was spoken. Do not translate.
- Return the transcription only: no quotes, no commentary, no preamble.
- Keep quantities and units as spoken ("two eggs", "200 grams of rice").
- If the audio has no intelligible speech, return an empty string.`,
        },
        {
          role: 'user',
          content: [
            { type: 'input_audio', input_audio: { data: audioBase64, format } },
            { type: 'text', text: 'Transcribe this meal description.' },
          ],
        },
      ],
      temperature: 0,
    });

    const text = (completion.choices[0]?.message?.content ?? '').trim();

    if (!text) {
      return NextResponse.json(
        { error: 'Could not make out any speech. Try recording again.' },
        { status: 422 }
      );
    }

    return NextResponse.json({ text });
  } catch (error) {
    // Log the provider's own words: without them a rejected audio format and
    // an exhausted quota look identical from the outside.
    const status = (error as { status?: number }).status;
    const detail = error instanceof Error ? error.message : String(error);
    console.error('Transcribe error:', status ?? '(no status)', detail);
    return NextResponse.json(
      { error: 'Could not transcribe the recording. Please try again or type the description.' },
      { status: 500 }
    );
  }
}
