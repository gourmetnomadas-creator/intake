'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getUserSession } from '@/lib/session';
import { Supplement, TimeOfDay } from '@/types';
import AddTabs from '@/components/AddTabs';
import AppShell from '@/components/AppShell';
import LoadingState from '@/components/LoadingState';
import ConfirmDeleteDialog from '@/components/ConfirmDeleteDialog';
import { timeOfDayLabels } from '@/lib/utils';

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

export default function SupplementsPage() {
  const router = useRouter();
  const [supplements, setSupplements] = useState<Supplement[]>([]);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<Supplement | null>(null);

  // inline edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<{
    name: string;
    dose: string;
    timeOfDay: TimeOfDay;
    withFood: boolean;
    tip: string;
  }>({ name: '', dose: '', timeOfDay: 'morning', withFood: false, tip: '' });

  // add form state
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [suggesting, setSuggesting] = useState(false);
  const [saving, setSaving] = useState(false);
  // editable AI suggestion, shown after "Suggest & review"
  const [draft, setDraft] = useState<{
    timeOfDay: TimeOfDay;
    withFood: boolean;
    tip: string;
  } | null>(null);

  useEffect(() => {
    const supabase = createClient();
    getUserSession().then((s) => {
      if (!s && !DEV_MODE) {
        router.push('/auth');
        return;
      }
      setSession(s);
      if (s) loadSupplements(supabase, s.user.id);
      else setLoading(false);
    });
  }, []);

  const loadSupplements = async (supabase: any, userId: string) => {
    const { data } = await supabase
      .from('supplements')
      .select('*')
      .eq('user_id', userId)
      .order('created_at');
    if (data) setSupplements(data);
    setLoading(false);
  };

  const handleSuggest = async () => {
    if (!name.trim()) return;
    setSuggesting(true);
    try {
      const res = await fetch('/api/suggest-supplement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });
      if (res.ok) {
        const s = await res.json();
        setDraft({ timeOfDay: s.timeOfDay, withFood: s.withFood, tip: s.tip });
      } else {
        setDraft({ timeOfDay: 'morning', withFood: false, tip: '' });
      }
    } catch {
      setDraft({ timeOfDay: 'morning', withFood: false, tip: '' });
    }
    setSuggesting(false);
  };

  const handleSave = async () => {
    if (!session || !name.trim() || !draft) return;
    setSaving(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('supplements')
      .insert({
        user_id: session.user.id,
        name: name.trim(),
        dose: dose.trim() || null,
        time_of_day: draft.timeOfDay,
        with_food: draft.withFood,
        tip: draft.tip || null,
      })
      .select()
      .single();

    if (data) setSupplements((prev) => [...prev, data]);
    setName('');
    setDose('');
    setDraft(null);
    setSaving(false);
  };

  const startEdit = (s: Supplement) => {
    setEditId(s.id);
    setEditDraft({
      name: s.name,
      dose: s.dose || '',
      timeOfDay: s.time_of_day,
      withFood: s.with_food,
      tip: s.tip || '',
    });
  };

  const handleEditSave = async () => {
    if (!editId || !editDraft.name.trim()) return;
    const supabase = createClient();
    const patch = {
      name: editDraft.name.trim(),
      dose: editDraft.dose.trim() || null,
      time_of_day: editDraft.timeOfDay,
      with_food: editDraft.withFood,
      tip: editDraft.tip.trim() || null,
    };
    const { error } = await supabase.from('supplements').update(patch).eq('id', editId);
    if (error) {
      alert('Could not save changes. Please try again.');
      return;
    }
    setSupplements((prev) => prev.map((s) => (s.id === editId ? { ...s, ...patch } : s)));
    setEditId(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const supabase = createClient();
    await supabase.from('supplements').delete().eq('id', deleteTarget.id);
    setSupplements((prev) => prev.filter((s) => s.id !== deleteTarget.id));
    setDeleteTarget(null);
  };

  if (loading) return <AppShell><LoadingState /></AppShell>;
  if (!session) return null;

  return (
    <AppShell>
      <h2 className="mb-4 text-lg font-semibold text-slate-800">Supplements</h2>

      {/* Add form */}
      <div className="mb-6 space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. Magnesium)"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
          <input
            type="text"
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            placeholder="Dose (e.g. 400 mg)"
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </div>

        {!draft ? (
          <button
            onClick={handleSuggest}
            disabled={suggesting || !name.trim()}
            className="w-full rounded-full bg-indigo-500 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-50"
          >
            {suggesting ? 'Asking AI...' : 'Add — AI suggests the best time'}
          </button>
        ) : (
          <div className="space-y-3 rounded-xl bg-indigo-50 p-3">
            {draft.tip && <p className="text-xs text-slate-600">💡 {draft.tip}</p>}
            <div className="flex items-center gap-3">
              <select
                value={draft.timeOfDay}
                onChange={(e) => setDraft({ ...draft, timeOfDay: e.target.value as TimeOfDay })}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
              >
                {Object.entries(timeOfDayLabels).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={draft.withFood}
                  onChange={(e) => setDraft({ ...draft, withFood: e.target.checked })}
                  className="h-4 w-4 accent-indigo-500"
                />
                With food
              </label>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setDraft(null)}
                className="flex-1 rounded-full border border-slate-300 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 rounded-full bg-indigo-500 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* List */}
      {supplements.length === 0 ? (
        <p className="text-center text-sm text-slate-400">
          No supplements yet. Add your first one above.
        </p>
      ) : (
        <div className="space-y-2">
          {supplements.map((s) =>
            editId === s.id ? (
              <div key={s.id} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="text"
                    value={editDraft.name}
                    onChange={(e) => setEditDraft({ ...editDraft, name: e.target.value })}
                    placeholder="Name"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  />
                  <input
                    type="text"
                    value={editDraft.dose}
                    onChange={(e) => setEditDraft({ ...editDraft, dose: e.target.value })}
                    placeholder="Dose"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={editDraft.timeOfDay}
                    onChange={(e) => setEditDraft({ ...editDraft, timeOfDay: e.target.value as TimeOfDay })}
                    className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400"
                  >
                    {Object.entries(timeOfDayLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1.5 text-sm text-slate-600">
                    <input
                      type="checkbox"
                      checked={editDraft.withFood}
                      onChange={(e) => setEditDraft({ ...editDraft, withFood: e.target.checked })}
                      className="h-4 w-4 accent-indigo-500"
                    />
                    With food
                  </label>
                </div>
                <textarea
                  value={editDraft.tip}
                  onChange={(e) => setEditDraft({ ...editDraft, tip: e.target.value })}
                  placeholder="Tip (optional)"
                  rows={2}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => setEditId(null)}
                    className="flex-1 rounded-full border border-slate-300 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleEditSave}
                    className="flex-1 rounded-full bg-indigo-500 py-2 text-sm font-semibold text-white transition hover:bg-indigo-600"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-2xl bg-white p-3 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800">
                    {s.name}
                    {s.dose && <span className="ml-1.5 text-xs font-normal text-slate-400">{s.dose}</span>}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {timeOfDayLabels[s.time_of_day]}
                    {s.with_food && ' · with food'}
                  </p>
                  {s.tip && <p className="mt-0.5 text-[11px] text-slate-400">💡 {s.tip}</p>}
                </div>
                <div className="ml-2 flex flex-shrink-0 gap-1">
                  <button
                    onClick={() => startEdit(s)}
                    className="rounded-lg px-2 py-1 text-xs text-slate-400 hover:text-slate-600"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => setDeleteTarget(s)}
                    className="rounded-lg px-2 py-1 text-xs text-red-400 hover:text-red-600"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )
          )}
        </div>
      )}

      <ConfirmDeleteDialog
        open={!!deleteTarget}
        title="Delete supplement?"
        message="Its daily check history will also be deleted."
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </AppShell>
  );
}
