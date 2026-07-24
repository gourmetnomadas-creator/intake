'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { getUserSession } from '@/lib/session';
import {
  ageFromBirthdate,
  calculateBMR,
  getActivityMultiplier,
  getGoalAdjustment,
} from '@/lib/calculations';
import Logo from '@/components/Logo';

const DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true';
const TOTAL_STEPS = 8;

const GOALS = [
  { k: 'mild_deficit', l: 'Lose weight', d: 'Trim body fat gradually' },
  { k: 'maintain', l: 'Maintain weight', d: 'Keep your energy balanced' },
  { k: 'mild_surplus', l: 'Gain weight', d: 'Build strength and mass' },
] as const;

const ACTIVITIES = [
  { k: 'sedentary', l: 'Sedentary', d: 'Little to no exercise' },
  { k: 'light', l: 'Lightly active', d: 'Exercise 1–3 days a week' },
  { k: 'moderate', l: 'Moderately active', d: 'Exercise 3–5 days a week' },
  { k: 'very_active', l: 'Very active', d: 'Exercise 6–7 days a week' },
] as const;

const DIET_CHIPS = ['None', 'Vegetarian', 'Vegan', 'Pescatarian', 'Gluten-free', 'Dairy-free', 'Keto'];
const DIET_TYPES = ['Vegetarian', 'Vegan', 'Pescatarian', 'Keto'];

export default function OnboardingPage() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [sex, setSex] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState('1998-01-01');
  const [units, setUnits] = useState<'metric' | 'imperial'>('metric');
  const [heightCm, setHeightCm] = useState(170);
  const [weightKg, setWeightKg] = useState(70);
  const [goal, setGoal] = useState<string | null>(null);
  const [activity, setActivity] = useState<string | null>(null);
  const [customTarget, setCustomTarget] = useState(false);
  const [calorieOverride, setCalorieOverride] = useState<number | null>(null);
  const [dietary, setDietary] = useState<string[]>([]);

  useEffect(() => {
    getUserSession().then((s) => {
      if (!s && !DEV_MODE) {
        router.push('/auth');
        return;
      }
      setSession(s);
    });
  }, []);

  const computedTarget = (() => {
    if (!goal || !activity) return null;
    const bmr = calculateBMR(weightKg, heightCm, ageFromBirthdate(birthDate) ?? 28, sex ?? 'female');
    return Math.round(bmr * getActivityMultiplier(activity) + getGoalAdjustment(goal));
  })();
  const targetCalories = customTarget && calorieOverride != null ? calorieOverride : computedTarget;
  const proteinG = Math.round(weightKg * 1.6);
  const fatG = targetCalories ? Math.round((targetCalories * 0.25) / 9) : 0;
  const carbsG =
    targetCalories ? Math.round(Math.max(0, targetCalories - proteinG * 4 - fatG * 9) / 4) : 0;

  const canContinue = () => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return !!sex;
    if (step === 3) return !!goal;
    if (step === 4) return !!activity;
    return true;
  };

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const finish = async () => {
    if (!session) return;
    setSaving(true);
    const supabase = createClient();
    const dietType = dietary.find((d) => DIET_TYPES.includes(d));
    const restrictions = dietary.filter((d) => d === 'Gluten-free' || d === 'Dairy-free').join(', ');

    const { error } = await supabase.from('profiles').upsert({
      id: session.user.id,
      name: name.trim(),
      sex: sex === 'na' ? null : sex,
      birthdate: birthDate,
      age: ageFromBirthdate(birthDate),
      height_cm: Math.round(heightCm),
      current_weight_kg: Math.round(weightKg * 2) / 2,
      goal_type: goal,
      activity_level: activity,
      manual_calorie_target: customTarget ? calorieOverride : null,
      calculated_calorie_target: computedTarget,
      diet_type: dietType ? dietType.toLowerCase() : null,
      dietary_restrictions: restrictions || null,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) {
      alert(`Could not save your profile: ${error.message}`);
      return;
    }
    router.push('/');
  };

  const heightDisplay =
    units === 'metric'
      ? `${Math.round(heightCm)} cm`
      : (() => {
          const totalIn = heightCm / 2.54;
          return `${Math.floor(totalIn / 12)}'${Math.round(totalIn % 12)}"`;
        })();
  const weightDisplay =
    units === 'metric' ? `${Math.round(weightKg * 2) / 2} kg` : `${Math.round(weightKg * 2.20462)} lb`;
  const primaryLabels = ['Continue', 'Continue', 'Continue', 'Continue', 'Continue', 'Looks good', 'Continue', 'Start tracking'];

  if (!session && !DEV_MODE) return null;

  const chip = (selected: boolean) =>
    `rounded-full px-4 py-2.5 text-sm font-semibold transition ${
      selected ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-800'
    }`;
  const optionCard = (selected: boolean) =>
    `flex items-center justify-between rounded-2xl border p-4 text-left transition ${
      selected ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 bg-white'
    }`;
  const dot = (selected: boolean) =>
    `h-5 w-5 flex-shrink-0 rounded-full ${selected ? 'bg-emerald-500' : 'border-[1.5px] border-slate-200'}`;
  const stepper =
    'flex items-center justify-center gap-7 rounded-2xl bg-slate-50 p-4';
  const stepBtn =
    'flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-900';

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col bg-white">
      {/* Header: back + progress */}
      <div className="flex-shrink-0 px-6 pt-14">
        <div className="flex h-8 items-center">
          {step > 0 && (
            <button onClick={back} className="text-2xl leading-none text-slate-900" aria-label="Back">
              ‹
            </button>
          )}
        </div>
        <div className="mt-2 flex gap-1.5">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= step ? 'bg-indigo-500' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
        <div className="mt-2 h-4 text-xs text-slate-400">
          {step < TOTAL_STEPS - 1 ? `Step ${step + 1} of ${TOTAL_STEPS}` : ''}
        </div>
      </div>

      {/* Step body */}
      <div key={step} className="flex-1 overflow-y-auto px-6 pb-6 pt-5">
        {step === 0 && (
          <div>
            <div className="flex items-center gap-2">
              <Logo size={24} />
              <h1 className="text-2xl font-bold text-slate-900">Welcome to Intake</h1>
            </div>
            <p className="mt-2 text-sm text-slate-400">Let&apos;s set up your profile — it takes about 2 minutes.</p>
            <div className="mt-8 flex justify-center">
              <div className="flex h-22 w-22 items-center justify-center rounded-full bg-slate-100 text-3xl font-bold text-slate-400" style={{ height: 88, width: 88 }}>
                {name.trim() ? name.trim()[0].toUpperCase() : '🙂'}
              </div>
            </div>
            <div className="mt-8">
              <label className="mb-2 block text-sm font-semibold text-slate-900">What should we call you?</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className="h-13 w-full rounded-2xl border-[1.5px] border-slate-200 px-4 text-base outline-none focus:border-indigo-400"
                style={{ height: 52 }}
              />
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tell us about you</h1>
            <p className="mt-2 text-sm text-slate-400">This helps us personalize your daily targets.</p>
            <p className="mb-2.5 mt-7 text-sm font-semibold text-slate-900">Sex</p>
            <div className="flex flex-wrap gap-2">
              {[{ v: 'female', l: 'Female' }, { v: 'male', l: 'Male' }, { v: 'na', l: 'Prefer not to say' }].map((o) => (
                <button key={o.v} onClick={() => setSex(o.v)} className={chip(sex === o.v)}>
                  {o.l}
                </button>
              ))}
            </div>
            <p className="mb-2.5 mt-7 text-sm font-semibold text-slate-900">Date of birth</p>
            <input
              type="date"
              value={birthDate}
              max={new Date().toISOString().split('T')[0]}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full rounded-2xl border-[1.5px] border-slate-200 px-4 text-base outline-none focus:border-indigo-400"
              style={{ height: 52 }}
            />
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Your body metrics</h1>
            <p className="mt-2 text-sm text-slate-400">Used only to calculate your daily calorie needs.</p>
            <div className="mt-6 flex gap-1 rounded-xl bg-slate-100 p-1">
              {(['metric', 'imperial'] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => setUnits(u)}
                  className={`flex-1 rounded-lg py-2 text-sm font-semibold capitalize transition ${
                    units === u ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500'
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
            <p className="mb-2.5 mt-6 text-sm font-semibold text-slate-900">Height</p>
            <div className={stepper}>
              <button onClick={() => setHeightCm((h) => Math.max(120, h - (units === 'metric' ? 1 : 2.54)))} className={stepBtn}>–</button>
              <span className="min-w-[88px] text-center text-2xl font-bold text-slate-900">{heightDisplay}</span>
              <button onClick={() => setHeightCm((h) => Math.min(220, h + (units === 'metric' ? 1 : 2.54)))} className={stepBtn}>+</button>
            </div>
            <p className="mb-2.5 mt-5 text-sm font-semibold text-slate-900">Weight</p>
            <div className={stepper}>
              <button onClick={() => setWeightKg((w) => Math.max(35, w - (units === 'metric' ? 0.5 : 0.4536)))} className={stepBtn}>–</button>
              <span className="min-w-[88px] text-center text-2xl font-bold text-slate-900">{weightDisplay}</span>
              <button onClick={() => setWeightKg((w) => Math.min(200, w + (units === 'metric' ? 0.5 : 0.4536)))} className={stepBtn}>+</button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="text-2xl font-bold text-slate-900">What&apos;s your goal?</h1>
            <p className="mt-2 text-sm text-slate-400">You can change this anytime.</p>
            <div className="mt-6 flex flex-col gap-2.5">
              {GOALS.map((g) => (
                <button key={g.k} onClick={() => setGoal(g.k)} className={optionCard(goal === g.k)}>
                  <span>
                    <span className="block text-[15px] font-semibold text-slate-900">{g.l}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">{g.d}</span>
                  </span>
                  <span className={dot(goal === g.k)} />
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h1 className="text-2xl font-bold text-slate-900">How active are you?</h1>
            <p className="mt-2 text-sm text-slate-400">Be honest — we&apos;ll adjust as you go.</p>
            <div className="mt-6 flex flex-col gap-2.5">
              {ACTIVITIES.map((a) => (
                <button key={a.k} onClick={() => setActivity(a.k)} className={optionCard(activity === a.k)}>
                  <span>
                    <span className="block text-[15px] font-semibold text-slate-900">{a.l}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">{a.d}</span>
                  </span>
                  <span className={dot(activity === a.k)} />
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Your daily target</h1>
            <p className="mt-2 text-sm text-slate-400">Calculated from your info — fine-tune it anytime.</p>
            <div className="mt-6 rounded-2xl bg-slate-50 p-6 text-center">
              <span className="text-4xl font-bold text-slate-900">{targetCalories ?? '—'}</span>
              <span className="text-sm text-slate-400"> kcal / day</span>
              <div className="mt-4 flex justify-center gap-5">
                <div><div className="text-base font-semibold text-emerald-600">{proteinG}g</div><div className="mt-0.5 text-[11px] text-slate-400">Protein</div></div>
                <div><div className="text-base font-semibold text-indigo-600">{carbsG}g</div><div className="mt-0.5 text-[11px] text-slate-400">Carbs</div></div>
                <div><div className="text-base font-semibold text-slate-400">{fatG}g</div><div className="mt-0.5 text-[11px] text-slate-400">Fat</div></div>
              </div>
            </div>
            <button
              onClick={() => {
                setCustomTarget((c) => !c);
                if (calorieOverride == null) setCalorieOverride(computedTarget);
              }}
              className="mt-4 w-full text-center text-sm font-semibold text-indigo-600"
            >
              {customTarget ? 'Use calculated target' : 'Adjust manually'}
            </button>
            {customTarget && (
              <div className="mt-3.5 flex items-center justify-center gap-6 rounded-2xl bg-slate-50 p-4">
                <button onClick={() => setCalorieOverride((c) => (c ?? computedTarget ?? 2000) - 50)} className={stepBtn}>–</button>
                <span className="text-sm text-slate-400">Adjust calories</span>
                <button onClick={() => setCalorieOverride((c) => (c ?? computedTarget ?? 2000) + 50)} className={stepBtn}>+</button>
              </div>
            )}
          </div>
        )}

        {step === 6 && (
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Any food preferences?</h1>
            <p className="mt-2 text-sm text-slate-400">Optional — helps us tailor suggestions.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              {DIET_CHIPS.map((d) => {
                const selected = dietary.includes(d);
                return (
                  <button
                    key={d}
                    onClick={() =>
                      setDietary((prev) => {
                        if (d === 'None') return selected ? [] : ['None'];
                        const withoutNone = prev.filter((x) => x !== 'None');
                        return selected ? withoutNone.filter((x) => x !== d) : [...withoutNone, d];
                      })
                    }
                    className={chip(selected)}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {step === 7 && (
          <div>
            <div className="mt-3 flex justify-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-500">
                <svg width="30" height="30" viewBox="0 0 100 100" fill="none">
                  <path d="M25 52 L42 68 L75 28" stroke="#FFFFFF" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
            </div>
            <h1 className="mt-4 text-center text-2xl font-bold text-slate-900">You&apos;re all set, {name.trim()}</h1>
            <p className="mt-2 text-center text-sm text-slate-400">Here&apos;s your profile at a glance.</p>
            <div className="mt-6 flex flex-col gap-px overflow-hidden rounded-2xl bg-slate-100">
              {[
                { label: 'Goal', value: GOALS.find((g) => g.k === goal)?.l ?? '—', go: 3 },
                { label: 'Activity', value: ACTIVITIES.find((a) => a.k === activity)?.l ?? '—', go: 4 },
                { label: 'Daily target', value: `${targetCalories ?? '—'} kcal`, go: 5 },
              ].map((row) => (
                <button
                  key={row.label}
                  onClick={() => setStep(row.go)}
                  className="flex items-center justify-between bg-white px-4.5 py-4"
                  style={{ paddingLeft: 18, paddingRight: 18 }}
                >
                  <span className="text-sm text-slate-400">{row.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-slate-900">{row.value}</span>
                    <span className="text-slate-300">›</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer button */}
      <div className="flex-shrink-0 border-t border-slate-100 px-6 pb-8 pt-3.5">
        <button
          onClick={step === TOTAL_STEPS - 1 ? finish : () => canContinue() && next()}
          disabled={!canContinue() || saving}
          className={`w-full rounded-2xl py-3.5 text-base font-semibold transition ${
            canContinue() && !saving ? 'bg-indigo-500 text-white' : 'bg-slate-200 text-slate-400'
          }`}
        >
          {saving ? 'Saving…' : primaryLabels[step]}
        </button>
        {step === 6 && (
          <button onClick={next} className="mt-3 w-full text-center text-sm text-slate-400">
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
