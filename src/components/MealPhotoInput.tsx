'use client';

import { useRef, useState } from 'react';
import { downscaleImageToBase64 } from '@/lib/image';

interface MealPhotoInputProps {
  photoPreview: string | null;
  onPhotoCapture: (base64: string) => void;
  onClear: () => void;
}

export default function MealPhotoInput({
  photoPreview,
  onPhotoCapture,
  onClear,
}: MealPhotoInputProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const file = input.files?.[0];
    if (!file) return;

    // ponytail: Chrome can't decode iPhone HEIC files; on iOS the browser
    // hands us a JPEG automatically, so this only hits desktop file picks.
    if (/\.heic$|\.heif$/i.test(file.name)) {
      alert(
        'This photo is in iPhone HEIC format, which this browser cannot display. Use a JPG/PNG here, or add the photo from your phone.'
      );
      input.value = '';
      return;
    }

    setProcessing(true);
    try {
      // Downscale before anything else touches the photo — the full-res file
      // is far too big to send to the analyzer.
      onPhotoCapture(await downscaleImageToBase64(file));
    } catch {
      alert('Could not read this photo. Please try a different one.');
    } finally {
      setProcessing(false);
      // Let the same file be picked again after a removal.
      input.value = '';
    }
  };

  const handleCapture = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
      {photoPreview ? (
        <div className="relative">
          <img
            src={photoPreview}
            alt="Meal preview"
            className="h-48 w-full rounded-xl object-cover"
          />
          <button
            type="button"
            onClick={onClear}
            className="absolute right-2 top-2 rounded-full bg-white/80 px-2 py-1 text-xs text-slate-700 backdrop-blur"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleCapture}
          disabled={processing}
          className="flex h-48 w-full flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 transition hover:bg-slate-100 disabled:opacity-60"
        >
          <span className="text-3xl">📷</span>
          <span className="mt-2 text-sm text-slate-500">
            {processing ? 'Preparing photo…' : 'Take photo or choose from gallery'}
          </span>
        </button>
      )}
    </div>
  );
}
