import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

// Where Google sends the user back after they approve. Supabase hands us a
// one-time code here, which is exchanged for a session cookie.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  // Behind Vercel the request origin is the internal host, so redirects have
  // to be built from the forwarded one or they leave the site.
  const forwardedHost = request.headers.get('x-forwarded-host');
  const base =
    process.env.NODE_ENV === 'development' || !forwardedHost
      ? origin
      : `https://${forwardedHost}`;

  // Google reports a refusal (or a misconfigured client) on the query string.
  const oauthError = searchParams.get('error');
  if (oauthError) {
    return NextResponse.redirect(`${base}/auth?error=oauth_failed`);
  }

  if (!code) {
    return NextResponse.redirect(`${base}/auth?error=oauth_failed`);
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error('OAuth callback error:', error.message);
    return NextResponse.redirect(`${base}/auth?error=oauth_failed`);
  }

  return NextResponse.redirect(base);
}
