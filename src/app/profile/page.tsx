'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getUserSession } from '@/lib/session';
import { Profile } from '@/types';
import AppShell from '@/components/AppShell';
import ProfileForm from '@/components/ProfileForm';
import LoadingState from '@/components/LoadingState';
import { buildMarkdownReport } from '@/lib/export-report';

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    const supabase = createClient();
    const s = await getUserSession();
    if (!s) {
      setExporting(false);
      return;
    }
    const userId = s.user.id;

    const [prof, meals, weights, supps, logs] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).single(),
      supabase
        .from('meals')
        .select('*, items:meal_items(*)')
        .eq('user_id', userId)
        .eq('status', 'saved')
        .order('date', { ascending: false }),
      supabase.from('body_weight_logs').select('*').eq('user_id', userId),
      supabase.from('supplements').select('*').eq('user_id', userId).order('created_at'),
      supabase.from('supplement_logs').select('supplement_id, date').eq('user_id', userId),
    ]);

    const md = buildMarkdownReport({
      profile: prof.data ?? null,
      meals: meals.data ?? [],
      weights: weights.data ?? [],
      supplements: supps.data ?? [],
      supplementLogs: logs.data ?? [],
    });

    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plate-log-${new Date().toISOString().split('T')[0]}.md`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setExporting(false);
  };

  useEffect(() => {
    const supabase = createClient();
    getUserSession().then((s) => {
      if (!s && !DEV_MODE) {
        router.push('/auth');
        return;
      }
      if (s) {
        supabase
          .from('profiles')
          .select('*')
          .eq('id', s.user.id)
          .single()
          .then(({ data }) => {
            if (data) setProfile(data);
            setLoading(false);
          });
      } else {
        setLoading(false);
      }
    });
  }, []);

  const handleSave = async (data: Partial<Profile>) => {
    setSaving(true);
    const supabase = createClient();
    const s = await getUserSession();
    if (!s) return;

    const { error } = await supabase.from('profiles').upsert({
      id: s.user.id,
      ...data,
      updated_at: new Date().toISOString(),
    });

    if (!error) {
      setProfile((prev) => prev ? { ...prev, ...data } : null);
    }
    setSaving(false);
  };

  if (loading) return <AppShell><LoadingState /></AppShell>;

  return (
    <AppShell>
      <h2 className="mb-4 text-lg font-semibold text-slate-800">Profile</h2>
      <ProfileForm profile={profile} onSave={handleSave} saving={saving} />
      <div className="mt-6">
        <button
          onClick={() => router.push('/weight')}
          className="w-full rounded-xl border border-slate-200 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          Log body weight
        </button>
      </div>

      <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
        <p className="text-sm font-semibold text-slate-700">📄 Export data</p>
        <p className="mt-1 text-xs text-slate-400">
          Downloads a Markdown file with your whole history (profile, meals, weight,
          supplements). Paste it into Claude or any AI to analyze your habits.
        </p>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="mt-3 w-full rounded-full bg-indigo-500 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-50"
        >
          {exporting ? 'Preparing…' : 'Export Markdown report'}
        </button>
      </div>
      {!DEV_MODE && (
        <div className="mt-4">
          <button
            onClick={async () => {
              const supabase = createClient();
              await supabase.auth.signOut();
              router.push('/auth');
            }}
            className="w-full rounded-xl border border-red-200 py-3 text-sm font-medium text-red-500 transition hover:bg-red-50"
          >
            Sign out
          </button>
        </div>
      )}
      {DEV_MODE && (
        <div className="mt-4 rounded-xl bg-indigo-50 p-3 text-center text-xs text-indigo-600">
          Dev mode — auth bypassed
        </div>
      )}
    </AppShell>
  );
}
