import { createClient } from './supabase/client';

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true' && process.env.NODE_ENV !== 'production';
const DEV_USER_ID = 'dev-user-id';

export async function getUserSession(): Promise<{ user: { id: string } } | null> {
  if (DEV_MODE) {
    return { user: { id: DEV_USER_ID } };
  }

  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}
