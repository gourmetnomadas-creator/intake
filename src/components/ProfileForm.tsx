'use client';

import { useState, useEffect } from 'react';
import { Profile, ActivityLevel, GoalType } from '@/types';
import { ageFromBirthdate, calculateBMR, getActivityMultiplier, getGoalAdjustment } from '@/lib/calculations';

interface ProfileFormProps {
  profile: Profile | null;
  onSave: (data: Partial<Profile>) => void;
  saving: boolean;
}

export default function ProfileForm({ profile, onSave, saving }: ProfileFormProps) {
  const [name, setName] = useState(profile?.name || '');
  const [heightCm, setHeightCm] = useState(profile?.height_cm?.toString() || '');
  const [weightKg, setWeightKg] = useState(profile?.current_weight_kg?.toString() || '');
  const [goalWeightKg, setGoalWeightKg] = useState(profile?.goal_weight_kg?.toString() || '');
  const [birthdate, setBirthdate] = useState(profile?.birthdate || '');
  const [sex, setSex] = useState(profile?.sex || '');
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>(
    (profile?.activity_level as ActivityLevel) || 'sedentary'
  );
  const [goalType, setGoalType] = useState<GoalType>(
    (profile?.goal_type as GoalType) || 'maintain'
  );
  const [manualTarget, setManualTarget] = useState(
    profile?.manual_calorie_target?.toString() || ''
  );
  const [dietType, setDietType] = useState(profile?.diet_type || '');
  const [dietaryRestrictions, setDietaryRestrictions] = useState(profile?.dietary_restrictions || '');

  const derivedAge = ageFromBirthdate(birthdate) ?? profile?.age ?? null;

  const calculatedTarget = (() => {
    const w = parseFloat(weightKg);
    const h = parseFloat(heightCm);
    const a = derivedAge;
    if (!w || !h || !a || !sex) return null;
    const bmr = calculateBMR(w, h, a, sex);
    const mult = getActivityMultiplier(activityLevel);
    const adj = getGoalAdjustment(goalType);
    return Math.round(bmr * mult + adj);
  })();

  const weightNum = parseFloat(weightKg);
  const proteinTarget = weightNum ? Math.round(weightNum * 1.6) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: name || null,
      height_cm: parseFloat(heightCm) || null,
      current_weight_kg: parseFloat(weightKg) || null,
      goal_weight_kg: parseFloat(goalWeightKg) || null,
      birthdate: birthdate || null,
      age: derivedAge,
      sex: sex || null,
      activity_level: activityLevel,
      goal_type: goalType,
      manual_calorie_target: goalType === 'manual' ? parseInt(manualTarget) || null : null,
      calculated_calorie_target: calculatedTarget,
      diet_type: dietType || null,
      dietary_restrictions: dietaryRestrictions.trim() || null,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          placeholder="Your name"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Height (cm)</label>
          <input
            type="number"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Weight (kg)</label>
          <input
            type="number"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Birthdate{derivedAge ? ` (${derivedAge} years)` : ''}
          </label>
          <input
            type="date"
            value={birthdate}
            onChange={(e) => setBirthdate(e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Sex</label>
          <select
            value={sex}
            onChange={(e) => setSex(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          >
            <option value="">Select</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Activity level</label>
        <select
          value={activityLevel}
          onChange={(e) => setActivityLevel(e.target.value as ActivityLevel)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
        >
          <option value="sedentary">Sedentary</option>
          <option value="light">Light exercise</option>
          <option value="moderate">Moderate exercise</option>
          <option value="active">Active</option>
          <option value="very_active">Very active</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Goal</label>
        <select
          value={goalType}
          onChange={(e) => setGoalType(e.target.value as GoalType)}
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
        >
          <option value="maintain">Maintain weight</option>
          <option value="mild_deficit">Mild deficit</option>
          <option value="mild_surplus">Mild surplus</option>
          <option value="manual">Manual target</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Goal weight (kg)
        </label>
        <input
          type="number"
          value={goalWeightKg}
          onChange={(e) => setGoalWeightKg(e.target.value)}
          placeholder="e.g. 65"
          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
        />
        {parseFloat(goalWeightKg) > 0 && weightNum > 0 && parseFloat(goalWeightKg) !== weightNum && (
          <p className="mt-1 text-xs text-slate-400">
            {parseFloat(goalWeightKg) > weightNum
              ? `${(parseFloat(goalWeightKg) - weightNum).toFixed(1)} kg to gain from ${weightNum} kg.`
              : `${(weightNum - parseFloat(goalWeightKg)).toFixed(1)} kg to lose from ${weightNum} kg.`}
          </p>
        )}
      </div>

      {goalType === 'manual' && (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Daily calorie target
          </label>
          <input
            type="number"
            value={manualTarget}
            onChange={(e) => setManualTarget(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
        </div>
      )}

      <div className="rounded-2xl bg-white p-4 shadow-sm">
        <p className="mb-3 text-sm font-semibold text-slate-700">Dietary preferences</p>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Diet</label>
          <select
            value={dietType}
            onChange={(e) => setDietType(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          >
            <option value="">No preference (omnivore)</option>
            <option value="vegetarian">Vegetarian</option>
            <option value="vegan">Vegan</option>
            <option value="pescatarian">Pescatarian</option>
            <option value="keto">Keto</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div className="mt-3">
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Avoid / allergies
          </label>
          <textarea
            value={dietaryRestrictions}
            onChange={(e) => setDietaryRestrictions(e.target.value)}
            placeholder="e.g. lactose, peanuts, no pork"
            rows={2}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
          <p className="mt-1 text-xs text-slate-400">
            Used so meal suggestions always respect what you don&apos;t eat.
          </p>
        </div>
      </div>

      {(calculatedTarget || proteinTarget) && (
        <div className="grid grid-cols-2 gap-3">
          {calculatedTarget && goalType !== 'manual' && (
            <div className="rounded-xl bg-indigo-50 p-4 text-center">
              <p className="text-xs text-slate-500">Daily calories</p>
              <p className="text-2xl font-bold text-slate-800">{calculatedTarget}</p>
              <p className="text-[10px] text-slate-400">kcal / day</p>
            </div>
          )}
          {proteinTarget && (
            <div className="rounded-xl bg-emerald-50 p-4 text-center">
              <p className="text-xs text-slate-500">Daily protein</p>
              <p className="text-2xl font-bold text-slate-800">{proteinTarget}</p>
              <p className="text-[10px] text-slate-400">g / day</p>
            </div>
          )}
        </div>
      )}

      <details className="rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-500">
        <summary className="cursor-pointer font-medium text-slate-600">
          How are these numbers calculated?
        </summary>
        <div className="mt-2 space-y-2 leading-relaxed">
          <p>
            <strong>Calories:</strong> Mifflin-St Jeor equation for your resting
            metabolism (from weight, height, age and sex), multiplied by an activity
            factor (1.2 sedentary → 1.9 very active), then ±250 kcal for a mild
            deficit/surplus. It&apos;s the most widely used clinical estimate.
          </p>
          <p>
            <strong>Protein:</strong> 1.6 g per kg of body weight — the general
            target for maintaining and building muscle in active people.
          </p>
          <p>
            <strong>Per-meal calories &amp; macros:</strong> estimated by AI from your
            text description and weight, using standard nutrition values per 100 g.
            You review and correct them before saving.
          </p>
          <p className="text-[10px] text-slate-400">
            These are estimates for personal tracking, not medical advice. Consult a
            professional for a plan tailored to you.
          </p>
        </div>
      </details>

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-full bg-indigo-500 py-3 text-sm font-semibold text-white transition hover:bg-indigo-600 disabled:opacity-50"
      >
        {saving ? 'Saving...' : 'Save profile'}
      </button>
    </form>
  );
}
