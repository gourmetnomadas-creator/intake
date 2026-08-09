'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Logo from '@/components/Logo';

export default function AuthPage() {
  return (
    <Suspense fallback={null}>
      <AuthPageInner />
    </Suspense>
  );
}

function AuthPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // The callback route reports a failed Google round-trip on the query string.
  const visibleError =
    error ||
    (searchParams.get('error') === 'oauth_failed'
      ? 'Google sign-in did not complete. Try again, or use your email below.'
      : '');

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    // On success the browser is already navigating to Google, so loading stays
    // on until the page goes away.
    if (oauthError) {
      setError(oauthError.message);
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin,
      },
    });

    if (authError) {
      setError(authError.message);
    } else {
      setSent(true);
    }
    setLoading(false);
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: 'email',
    });

    if (verifyError) {
      setError('Invalid or expired code. Check the email and try again.');
      setLoading(false);
    } else {
      router.push('/');
    }
  };

  if (sent) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-4">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-slate-800">Check your email</h1>
          <p className="mt-2 mb-6 text-sm text-slate-500">
            We sent a login code to {email}. Enter it below (or tap the link
            in the email if you are on this device).
          </p>
          <form onSubmit={handleVerify} className="space-y-4">
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="12345678"
              maxLength={10}
              required
              className="w-full rounded-xl border border-slate-200 px-4 py-3 text-center text-2xl tracking-[0.3em] outline-none focus:border-indigo-400"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading || code.trim().length < 6}
              className="w-full rounded-full bg-indigo-500 py-3 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify code'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSent(false);
                setCode('');
                setError('');
              }}
              className="w-full py-2 text-center text-sm text-slate-500 hover:text-slate-700"
            >
              Use a different email
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-1 flex items-center gap-2">
          <Logo size={32} />
          <h1 className="text-2xl font-bold text-slate-900">Intake</h1>
        </div>
        <p className="mb-6 text-sm text-slate-500">Sign in to keep track of your meals</p>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="flex w-full items-center justify-center gap-3 rounded-full border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
            />
            <path
              fill="#FBBC05"
              d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z"
            />
          </svg>
          Continue with Google
        </button>

        <div className="my-5 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200" />
          <span className="text-xs text-slate-400">or</span>
          <span className="h-px flex-1 bg-slate-200" />
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            required
            className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-indigo-400"
          />
          {visibleError && <p className="text-sm text-red-600">{visibleError}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-indigo-500 py-3 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send login code'}
          </button>
        </form>
        <p className="mt-6 text-xs leading-relaxed text-slate-400">
          Meal photos and descriptions are sent to Google&apos;s Gemini API to estimate
          nutrition. On its free tier, Google may use what it receives to improve
          its models. Your meals, weight and profile are stored privately and are
          not visible to other people using this app.
        </p>
      </div>
    </div>
  );
}
