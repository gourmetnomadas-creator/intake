export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function getMealTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    snack: 'Snack',
  };
  return labels[type] ?? type;
}

// Pick an emoji for a meal from keywords in its description (Spanish + English),
// falling back to a per-meal-type icon so cards look distinct without photos.
const FOOD_ICONS: [RegExp, string][] = [
  [/huevo|omelet|tortilla|egg/i, '🥚'],
  [/prote[ií]na|protein|whey|scoop|batido|shake|licuado/i, '🥤'],
  [/avena|oat|oatmeal|granola|cereal/i, '🥣'],
  [/pollo|chicken/i, '🍗'],
  [/carne|beef|bife|res|steak|hambur/i, '🥩'],
  [/cerdo|pork|pancet|bacon/i, '🥓'],
  [/pescado|salm[oó]n|at[uú]n|fish|tuna/i, '🐟'],
  [/camar|marisc|shrimp|prawn/i, '🦐'],
  [/ensalada|salad|lechuga|rúcula|rucula/i, '🥗'],
  [/arroz|rice/i, '🍚'],
  [/pasta|fideo|spaghetti|noodle|tallar/i, '🍝'],
  [/pan|bread|tostada|toast|masa madre/i, '🍞'],
  [/yogur|yogurt/i, '🥛'],
  [/queso|cheese/i, '🧀'],
  [/br[oó]coli|verdura|vegetable|espinaca|arveja|zanahoria|palta|aguacate/i, '🥦'],
  [/banana|pl[aá]tano|fruta|manzana|apple|frutilla|arándano|arandano|berries?/i, '🍌'],
  [/sopa|soup|caldo|guiso/i, '🍲'],
  [/pizza/i, '🍕'],
  [/caf[eé]|coffee|mate|t[eé]\b/i, '☕'],
  [/nuez|nueces|man[ií]|almendra|nut|seed|semilla/i, '🥜'],
];

const MEAL_TYPE_ICONS: Record<string, string> = {
  breakfast: '🌅',
  lunch: '🍽️',
  dinner: '🌙',
  snack: '🍎',
};

export function mealEmoji(meal: { description?: string | null; meal_type: string }): string {
  const desc = meal.description || '';
  for (const [re, icon] of FOOD_ICONS) {
    if (re.test(desc)) return icon;
  }
  return MEAL_TYPE_ICONS[meal.meal_type] ?? '🍽️';
}

export function getWeightContextLabel(context: string): string {
  const labels: Record<string, string> = {
    whole_plate: 'Whole plate',
    one_ingredient: 'One ingredient only',
    separate_ingredients: 'Ingredients weighed separately',
  };
  return labels[context] ?? context;
}

export function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

export function formatShortDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export function todayISO(): string {
  const d = new Date();
  return d.toISOString().split('T')[0];
}

export function generateId(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).substring(2, 15);
}

export const timeOfDayLabels: Record<import('@/types').TimeOfDay, string> = {
  morning: '☀️ Morning',
  midday: '🌤 Midday',
  evening: '🌇 Evening',
  night: '🌙 Night',
};
