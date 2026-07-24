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

  lines.push('# Plate Log — Informe de datos');
  lines.push('');
  lines.push(`Generado: ${now.toISOString().split('T')[0]}`);
  lines.push('');
  lines.push(
    'Este archivo contiene el historial de nutrición registrado por el usuario. ' +
      'Analiza patrones de alimentación, adherencia a objetivos y suplementación, ' +
      'y sugiere mejoras concretas de hábitos.'
  );
  lines.push('');

  // Profile
  lines.push('## Perfil y objetivos');
  if (profile) {
    const age = ageFromBirthdate(profile.birthdate) ?? profile.age ?? null;
    const proteinTarget = profile.current_weight_kg ? r(profile.current_weight_kg * 1.6) : null;
    lines.push(`- Nombre: ${profile.name || '—'}`);
    lines.push(`- Sexo: ${profile.sex || '—'}`);
    lines.push(`- Edad: ${age ?? '—'}`);
    lines.push(`- Altura: ${profile.height_cm ?? '—'} cm`);
    lines.push(`- Peso actual: ${profile.current_weight_kg ?? '—'} kg`);
    lines.push(`- Nivel de actividad: ${profile.activity_level || '—'}`);
    lines.push(`- Objetivo: ${profile.goal_type || '—'}`);
    lines.push(
      `- Objetivo calórico: ${profile.manual_calorie_target || profile.calculated_calorie_target || '—'} kcal/día`
    );
    lines.push(`- Objetivo de proteína (1.6 g/kg): ${proteinTarget ?? '—'} g/día`);
  } else {
    lines.push('- (Sin perfil cargado)');
  }
  lines.push('');

  // Weight history
  lines.push('## Historial de peso');
  if (weights.length) {
    lines.push('| Fecha | Peso (kg) | Notas |');
    lines.push('|---|---|---|');
    for (const w of [...weights].sort((a, b) => b.date.localeCompare(a.date))) {
      lines.push(`| ${w.date} | ${w.weight_kg} | ${w.notes || ''} |`);
    }
  } else {
    lines.push('- (Sin registros de peso)');
  }
  lines.push('');

  // Meals grouped by day, newest first
  lines.push('## Comidas por día');
  const byDay = new Map<string, ReportMeal[]>();
  for (const m of meals) {
    if (!byDay.has(m.date)) byDay.set(m.date, []);
    byDay.get(m.date)!.push(m);
  }
  const days = [...byDay.keys()].sort((a, b) => b.localeCompare(a));
  if (!days.length) lines.push('- (Sin comidas registradas)');
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
    lines.push(`### ${day} — ${r(t.kcal)} kcal · P ${r(t.p)}g · C ${r(t.c)}g · G ${r(t.f)}g`);
    for (const m of dayMeals) {
      const time = new Date(m.meal_time).toISOString().slice(11, 16);
      lines.push(
        `- **${time} [${m.meal_type}]** ${m.description || ''} — ${r(m.total_kcal)} kcal, P ${r(
          m.total_protein_g
        )}g, C ${r(m.total_carbs_g)}g, G ${r(m.total_fat_g)}g`
      );
      for (const it of m.items || []) {
        lines.push(`    - ${it.food_name}: ${r(it.grams)} g (${r(it.kcal)} kcal, P ${r(it.protein_g)}g)`);
      }
    }
  }
  lines.push('');

  // Supplements + adherence over the exported window
  lines.push('## Suplementos');
  if (supplements.length) {
    for (const s of supplements) {
      const taken = supplementLogs.filter((l) => l.supplement_id === s.id).length;
      lines.push(
        `- **${s.name}**${s.dose ? ` (${s.dose})` : ''} — ${s.time_of_day}${
          s.with_food ? ', con comida' : ''
        } · tildado ${taken} día(s) en el historial${s.tip ? `\n    - Tip: ${s.tip}` : ''}`
      );
    }
  } else {
    lines.push('- (Sin suplementos cargados)');
  }
  lines.push('');

  return lines.join('\n');
}
