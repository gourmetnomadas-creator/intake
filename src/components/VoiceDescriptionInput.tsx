'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { blobToWavBase64, canRecordAudio, pickRecordingMimeType } from '@/lib/audio';

// Long enough to describe a plate, short enough to keep the upload small.
const MAX_SECONDS = 60;

interface VoiceDescriptionInputProps {
  onTranscribed: (text: string) => void;
  disabled?: boolean;
}

type Status = 'idle' | 'recording' | 'transcribing';

export default function VoiceDescriptionInput({
  onTranscribed,
  disabled = false,
}: VoiceDescriptionInputProps) {
  const [status, setStatus] = useState<Status>('idle');
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);

  // Recording support can only be answered in the browser — the server has no
  // MediaRecorder — and the answer never changes once known.
  const supported = useSyncExternalStore(
    () => () => {},
    canRecordAudio,
    () => false
  );

  useEffect(() => {
    if (status !== 'recording') return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [status]);

  // Cap the length rather than let a forgotten recording run on.
  useEffect(() => {
    if (status === 'recording' && seconds >= MAX_SECONDS) recorderRef.current?.stop();
  }, [status, seconds]);

  const transcribe = async (blob: Blob) => {
    setStatus('transcribing');
    try {
      // Always upload WAV. Safari records MP4 and Chrome WebM, and the
      // transcription endpoint accepts neither.
      const audioBase64 = await blobToWavBase64(blob);

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audioBase64, format: 'wav' }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not transcribe the recording.');

      onTranscribed(data.text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not transcribe the recording.');
    } finally {
      setStatus('idle');
    }
  };

  const startRecording = async () => {
    setError('');
    setSeconds(0);

    let stream: MediaStream;
    try {
      // A fresh stream per recording. Holding one open across recordings is
      // what stops working after an iOS home-screen app is reopened.
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError('Microphone access was blocked. Allow it in your settings, or type the description.');
      return;
    }

    const mimeType = pickRecordingMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    const chunks: BlobPart[] = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };

    recorder.onstop = () => {
      // Release the mic so the browser stops showing it as in use.
      stream.getTracks().forEach((track) => track.stop());
      recorderRef.current = null;

      const blob = new Blob(chunks, { type: recorder.mimeType });
      if (!blob.size) {
        setError('Nothing was recorded. Try again.');
        setStatus('idle');
        return;
      }
      void transcribe(blob);
    };

    recorderRef.current = recorder;
    recorder.start();
    setStatus('recording');
  };

  if (!supported) return null;

  const busy = disabled || status === 'transcribing';

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => (status === 'recording' ? recorderRef.current?.stop() : startRecording())}
        disabled={busy}
        aria-label={status === 'recording' ? 'Stop recording' : 'Describe the meal by voice'}
        className={`flex w-full items-center justify-center gap-2 rounded-xl border py-2.5 text-sm font-medium transition disabled:opacity-50 ${
          status === 'recording'
            ? 'border-red-200 bg-red-50 text-red-600'
            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
        }`}
      >
        {status === 'recording' ? (
          <>
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
            Stop · {seconds}s
          </>
        ) : status === 'transcribing' ? (
          'Transcribing…'
        ) : (
          <>
            <span aria-hidden="true">🎤</span>
            Describe it out loud
          </>
        )}
      </button>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
