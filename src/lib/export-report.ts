import { ageFromBirthdate } from './calculations';

// Minimal shapes we read from Supabase for the report.
interface ReportProfile {
  name?: string | null;
  sex?: string | null;
  birthdate?: string | null;
  age?: number | null;
  height_cm?: number | null;
  current_weight_kg?: number | null;
  activity_level?: string | null;
  goal_type?: string | null;
  manual_calorie_target?: number | null;
  calculated_calorie_target?: number | null;
}
interface ReportMealItem {
  food_name: string;
  grams: number;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}
interface ReportMeal {
  date: string;
  meal_time: string;
  meal_type: string;
  description?: string | null;
  total_kcal: number;
  total_protein_g: number;
  total_carbs_g: number;
  total_fat_g: number;
  items?: ReportMealItem[];
}
interface ReportWeight {
  date: string;
  weight_kg: number;
  notes?: string | null;
}
interface ReportSupplement {
  id: string;
  name: string;
  dose?: string | null;
  time_of_day: string;
  with_food: boolean;
  tip?: string | null;
}
interface ReportLog {
  supplement_id: string;
  date: string;
}

export interface ReportData {
  profile: ReportProfile | null;
  meals: ReportMeal[];
  weights: ReportWeight[];
  supplements: ReportSupplement[];
  supplementLogs: ReportLog[];
}

const r = (n: number) => Math.round(n);

export function buildMarkdownReport(data: ReportData): string {
  const { profile, meals, weights, supplements, supplementLogs } = data;
  const now = new Date();
  const lines: string[] = [];

  lines.push('# Intake — Data report');
  lines.push('');
  lines.push(`Generated: ${now.toISOString().split('T')[0]}`);
  lines.push('');
  lines.push(
    'This file contains the nutrition history logged by the user. ' +
      'Analyse eating patterns, adherence to targets and supplementation, ' +
      'and suggest concrete habit improvements.'
  );
  lines.push('');

  // Profile
  lines.push('## Profile and targets');
  if (profile) {
    const age = ageFromBirthdate(profile.birthdate) ?? profile.age ?? null;
    const proteinTarget = profile.current_weight_kg ? r(profile.current_weight_kg * 1.6) : null;
    lines.push(`- Name: ${profile.name || '—'}`);
    lines.push(`- Sex: ${profile.sex || '—'}`);
    lines.push(`- Age: ${age ?? '—'}`);
    lines.push(`- Height: ${profile.height_cm ?? '—'} cm`);
    lines.push(`- Current weight: ${profile.current_weight_kg ?? '—'} kg`);
    lines.push(`- Activity level: ${profile.activity_level || '—'}`);
    lines.push(`- Goal: ${profile.goal_type || '—'}`);
    lines.push(
      `- Calorie target: ${profile.manual_calorie_target || profile.calculated_calorie_target || '—'} kcal/day`
    );
    lines.push(`- Protein target (1.6 g/kg): ${proteinTarget ?? '—'} g/day`);
  } else {
    lines.push('- (No profile saved)');
  }
  lines.push('');

  // Weight history
  lines.push('## Weight history');
  if (weights.length) {
    lines.push('| Date | Weight (kg) | Notes |');
    lines.push('|---|---|---|');
    for (const w of [...weights].sort((a, b) => b.date.localeCompare(a.date))) {
      lines.push(`| ${w.date} | ${w.weight_kg} | ${w.notes || ''} |`);
    }
  } else {
    lines.push('- (No weight entries)');
  }
  lines.push('');

  // Meals grouped by day, newest first
  lines.push('## Meals by day');
  const byDay = new Map<string, ReportMeal[]>();
  for (const m of meals) {
    if (!byDay.has(m.date)) byDay.set(m.date, []);
    byDay.get(m.date)!.push(m);
  }
  const days = [...byDay.keys()].sort((a, b) => b.localeCompare(a));
  if (!days.length) lines.push('- (No meals logged)');
  for (const day of days) {
    const dayMeals = byDay.get(day)!.sort((a, b) => a.meal_time.localeCompare(b.meal_time));
    const t = dayMeals.reduce(
      (a, m) => ({
        kcal: a.kcal + m.total_kcal,
        p: a.p + m.total_protein_g,
        c: a.c + m.total_carbs_g,
        f: a.f + m.total_fat_g,
      }),
      { kcal: 0, p: 0, c: 0, f: 0 }
    );
    lines.push('');
    lines.push(`### ${day} — ${r(t.kcal)} kcal · P ${r(t.p)}g · C ${r(t.c)}g · F ${r(t.f)}g`);
    for (const m of dayMeals) {
      const time = new Date(m.meal_time).toISOString().slice(11, 16);
      lines.push(
        `- **${time} [${m.meal_type}]** ${m.description || ''} — ${r(m.total_kcal)} kcal, P ${r(
          m.total_protein_g
        )}g, C ${r(m.total_carbs_g)}g, F ${r(m.total_fat_g)}g`
      );
      for (const it of m.items || []) {
        lines.push(`    - ${it.food_name}: ${r(it.grams)} g (${r(it.kcal)} kcal, P ${r(it.protein_g)}g)`);
      }
    }
  }
  lines.push('');

  // Supplements + adherence over the exported window
  lines.push('## Supplements');
  if (supplements.length) {
    for (const s of supplements) {
      const taken = supplementLogs.filter((l) => l.supplement_id === s.id).length;
      lines.push(
        `- **${s.name}**${s.dose ? ` (${s.dose})` : ''} — ${s.time_of_day}${
          s.with_food ? ', with food' : ''
        } · checked off on ${taken} day(s) in this history${s.tip ? `\n    - Tip: ${s.tip}` : ''}`
      );
    }
  } else {
    lines.push('- (No supplements saved)');
  }
  lines.push('');

  return lines.join('\n');
}
