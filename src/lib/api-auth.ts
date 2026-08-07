import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from './supabase/server';

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true' && process.env.NODE_ENV !== 'production';

// Gate for the AI/cost endpoints: returns a 401 response if there is no logged-in
// user, or null if the request may proceed. Dev mode skips the check so local
// development without a real Supabase session still works.
export async function requireUser(): Promise<NextResponse | null> {
  if (DEV_MODE) return null;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
