import type { z } from 'zod';
import type { audioFormatSchema } from './validations';

export type AudioFormat = z.infer<typeof audioFormatSchema>;

// Ordered by preference. Safari only offers mp4/AAC, Chrome and Firefox only
// offer WebM or Ogg, so the recorder has to take whichever it can get.
export const AUDIO_MIME_PREFERENCE = [
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/webm;codecs=opus',
  'audio/webm',
];

/** Map a MediaRecorder mime type onto the format name the API expects. */
export function audioFormatFromMimeType(mimeType: string): AudioFormat {
  const container = mimeType.split(';')[0].trim().toLowerCase();

  switch (container) {
    case 'audio/mp4':
    case 'audio/aac':
    case 'audio/x-m4a':
      return 'aac';
    case 'audio/mpeg':
      return 'mp3';
    case 'audio/ogg':
      return 'ogg';
    case 'audio/wav':
    case 'audio/x-wav':
      return 'wav';
    case 'audio/flac':
      return 'flac';
    default:
      return 'webm';
  }
}

/** The best container this browser can record, or undefined to let it choose. */
export function pickRecordingMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return AUDIO_MIME_PREFERENCE.find((type) => MediaRecorder.isTypeSupported(type));
}

export function canRecordAudio(): boolean {
  return (
    typeof MediaRecorder !== 'undefined' &&
    typeof navigator !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia)
  );
}
