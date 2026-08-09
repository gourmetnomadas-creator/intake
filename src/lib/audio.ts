// Ordered by preference. Safari only offers mp4/AAC, Chrome and Firefox only
// offer WebM or Ogg, so the recorder has to take whichever it can get. What is
// recorded is re-encoded to WAV before upload, so the choice only affects
// recording quality, not what the API receives.
export const AUDIO_MIME_PREFERENCE = [
  'audio/mp4',
  'audio/ogg;codecs=opus',
  'audio/webm;codecs=opus',
  'audio/webm',
];

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

// Speech carries fine at 16 kHz, and it keeps an uncompressed upload small.
export const TARGET_SAMPLE_RATE = 16000;

/**
 * Wrap mono PCM samples in a WAV container.
 *
 * Recordings are converted to WAV before upload because the OpenAI-compatible
 * endpoint accepts a much narrower set of containers than Gemini does natively
 * — Safari's MP4 is rejected there. WAV is understood everywhere.
 */
export function encodeWav(samples: Float32Array, sampleRate: number): Uint8Array {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM header length
  view.setUint16(20, 1, true); // uncompressed
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // bytes per second
  view.setUint16(32, 2, true); // bytes per frame
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, 'data');
  view.setUint32(40, samples.length * 2, true);

  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }

  return new Uint8Array(buffer);
}

export function base64FromBytes(bytes: Uint8Array): string {
  // Chunked: spreading a megabyte of samples into one call blows the stack.
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/** Decode whatever the browser recorded and re-encode it as 16 kHz mono WAV. */
export async function blobToWavBase64(blob: Blob): Promise<string> {
  const AudioContextClass =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) throw new Error('This browser cannot decode audio');

  const context = new AudioContextClass();
  let decoded: AudioBuffer;
  try {
    decoded = await context.decodeAudioData(await blob.arrayBuffer());
  } finally {
    void context.close();
  }

  // Rendering into a one-channel context downmixes and resamples in one pass.
  const frameCount = Math.max(1, Math.ceil(decoded.duration * TARGET_SAMPLE_RATE));
  const offline = new OfflineAudioContext(1, frameCount, TARGET_SAMPLE_RATE);
  const source = offline.createBufferSource();
  source.buffer = decoded;
  source.connect(offline.destination);
  source.start();

  const rendered = await offline.startRendering();
  return base64FromBytes(encodeWav(rendered.getChannelData(0), TARGET_SAMPLE_RATE));
}
