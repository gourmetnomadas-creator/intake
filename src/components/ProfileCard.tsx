'use client';

import { Profile, Meal } from '@/types';
import { calculateDailyCalorieTarget, ageFromBirthdate } from '@/lib/calculations';

interface ProfileCardProps {
  profile: Profile | null;
  currentWeight: number | null;
  weightTrend: number | null;
  meals: Meal[];
  onExport: () => void;
  onSignOut: () => void;
  onEditProfile: () => void;
  onEditPreferences: () => void;
}

export default function ProfileCard({
  profile,
  currentWeight,
  weightTrend,
  meals,
  onExport,
  onSignOut,
  onEditProfile,
  onEditPreferences,
}: ProfileCardProps) {
  if (!profile) return null;

  const targetKcal = calculateDailyCalorieTarget({
    weight_kg: profile.current_weight_kg,
    height_cm: profile.height_cm,
    age: ageFromBirthdate(profile.birthdate) ?? profile.age,
    sex: profile.sex,
    activity_level: profile.activity_level,
    goal_type: profile.goal_type,
    manual_calorie_target: profile.manual_calorie_target,
  });

  const proteinTarget = profile.current_weight_kg
    ? Math.round(profile.current_weight_kg * 1.6)
    : targetKcal
    ? Math.round((targetKcal * 0.3) / 4)
    : null;

  const goalWeight = profile.goal_weight_kg || 65;
  const weight = currentWeight || profile.current_weight_kg || 60;
  const diff = goalWeight - weight;
  const totalDiff = goalWeight - (profile.current_weight_kg || 60);
  const progress = totalDiff !== 0 ? Math.min(1, Math.max(0, (Math.abs(totalDiff - Math.abs(diff)) / Math.abs(totalDiff)))) : 1;
  const progressDegrees = progress * 360;

  const totals = {
    kcal: meals.reduce((sum, m) => sum + m.total_kcal, 0),
    protein: meals.reduce((sum, m) => sum + m.total_protein_g, 0),
  };

  return (
    <div style={{ padding: '14px 22px 28px' }}>
      <h1 style={{ font: '700 30px -apple-system,sans-serif', color: '#1c1c1a', margin: '0 0 16px' }}>
        Profile
      </h1>

      {/* Weight Ring */}
      <div style={{ background: '#ffffff', borderRadius: '26px', padding: '24px 20px', boxShadow: '0 1px 2px rgba(0,0,0,.04)', textAlign: 'center' }}>
        <div style={{
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: `conic-gradient(#1f6f57 0deg ${progressDegrees}deg, #eee9df ${progressDegrees}deg 360deg)`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 18px',
        }}>
          <div style={{
            width: '150px',
            height: '150px',
            borderRadius: '50%',
            background: '#fff',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <div style={{ font: '700 30px -apple-system,sans-serif', color: '#1c1c1a' }}>
              {weight.toFixed(1)} kg
            </div>
            <div style={{ font: '600 13px -apple-system,sans-serif', color: '#8a8578', marginTop: '2px' }}>
              {weightTrend ? (weightTrend > 0 ? '▲' : '▼') : '—'} {Math.abs(weightTrend ?? 0).toFixed(1)} kg
            </div>
            <div style={{ font: '500 12.5px -apple-system,sans-serif', color: '#8a8578', marginTop: '4px' }}>
              {Math.abs(diff).toFixed(1)} kg to {goalWeight} kg goal
            </div>
          </div>
        </div>
        <div
          onClick={onEditProfile}
          style={{
            background: '#1f6f57',
            color: '#fff',
            textAlign: 'center',
            padding: '17px',
            borderRadius: '999px',
            font: '700 17px -apple-system,sans-serif',
            marginBottom: '16px',
            cursor: 'pointer',
          }}
        >
          ＋ Log today's weight
        </div>
      </div>

      {/* Macros */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '14px' }}>
        <div style={{ flex: 1, background: '#dcece3', borderRadius: '18px', padding: '16px', textAlign: 'center' }}>
          <div style={{ font: '700 26px -apple-system,sans-serif', color: '#1c1c1a' }}>
            {Math.round(targetKcal ?? 0)}
          </div>
          <div style={{ font: '400 12px -apple-system,sans-serif', color: '#4c6a5c' }}>kcal / day</div>
        </div>
        <div style={{ flex: 1, background: '#f7dfdd', borderRadius: '18px', padding: '16px', textAlign: 'center' }}>
          <div style={{ font: '700 26px -apple-system,sans-serif', color: '#1c1c1a' }}>
            {proteinTarget}g
          </div>
          <div style={{ font: '400 12px -apple-system,sans-serif', color: '#8a5650' }}>protein / day</div>
        </div>
      </div>

      {/* Dietary Preferences */}
      <div
        onClick={onEditPreferences}
        style={{
          background: '#ffffff',
          borderRadius: '18px',
          padding: '16px 18px',
          marginTop: '14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
        }}
      >
        <div>
          <div style={{ font: '600 15px -apple-system,sans-serif', color: '#1c1c1a' }}>
            Dietary preferences
          </div>
          <div style={{ font: '400 13px -apple-system,sans-serif', color: '#6b6b60', marginTop: '3px' }}>
            {profile.diet_type ? profile.diet_type.charAt(0).toUpperCase() + profile.diet_type.slice(1) : 'Not set'} · {profile.dietary_restrictions ? 'Restrictions set' : 'no restrictions'}
          </div>
        </div>
        <span style={{ color: '#b0aa9c', fontSize: '15px' }}>›</span>
      </div>

      {/* Personal & Goal Details */}
      <div
        onClick={onEditProfile}
        style={{
          background: '#ffffff',
          borderRadius: '18px',
          padding: '16px 18px',
          marginTop: '10px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
        }}
      >
        <div>
          <div style={{ font: '600 15px -apple-system,sans-serif', color: '#1c1c1a' }}>
            Personal & goal details
          </div>
          <div style={{ font: '400 12px -apple-system,sans-serif', color: '#8a8578', marginTop: '2px' }}>
            Name, height, birthdate, sex, activity
          </div>
        </div>
        <span style={{ color: '#b0aa9c', fontSize: '15px' }}>›</span>
      </div>

      {/* Export Data */}
      <div style={{ background: '#ffffff', borderRadius: '18px', padding: '18px', marginTop: '14px' }}>
        <div style={{ font: '600 14px -apple-system,sans-serif', color: '#1c1c1a', marginBottom: '8px' }}>
          📄 Export data
        </div>
        <div style={{
          font: '400 13px -apple-system,sans-serif',
          color: '#6b6b60',
          lineHeight: '1.5',
          marginBottom: '14px',
        }}>
          Downloads a Markdown file with your whole history. Paste it into Claude or any AI to analyze your habits.
        </div>
        <div
          onClick={onExport}
          style={{
            background: '#1f6f57',
            color: '#fff',
            textAlign: 'center',
            padding: '13px',
            borderRadius: '999px',
            font: '700 13.5px -apple-system,sans-serif',
            cursor: 'pointer',
          }}
        >
          Export Markdown report
        </div>
      </div>

      {/* Sign Out */}
      <div
        onClick={onSignOut}
        style={{
          textAlign: 'center',
          color: '#c0463d',
          font: '600 15px -apple-system,sans-serif',
          border: '1px solid rgba(192,70,61,.35)',
          borderRadius: '999px',
          padding: '15px',
          marginTop: '14px',
          cursor: 'pointer',
        }}
      >
        Sign out
      </div>
    </div>
  );
}
