import { searchLocalFoods } from './food-database';

export type NutritionSource = 'local' | 'usda' | 'openfoodfacts';

export interface FoodMatch {
  name: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  source: NutritionSource;
}

interface OffProduct {
  product_name?: string;
  brands?: string;
  nutriments?: Record<string, unknown>;
}

interface UsdaFood {
  description?: string;
  foodNutrients?: { nutrientId?: number; value?: number }[];
}

const TIMEOUT_MS = 4000;
// Open Food Facts asks every client to identify itself.
const USER_AGENT = 'Intake/0.1 (personal nutrition tracker)';

/**
 * Rejects the junk both public databases are full of: entries with no energy
 * value, placeholder rows, and per-serving numbers mislabelled as per-100 g
 * (a food cannot hold more than 100 g of one macro in 100 g of itself, and
 * nothing edible beats pure fat's 900 kcal).
 */
export function isPlausible(m: Omit<FoodMatch, 'source' | 'name'>): boolean {
  const macros = [m.proteinPer100g, m.carbsPer100g, m.fatPer100g];
  return (
    Number.isFinite(m.kcalPer100g) &&
    m.kcalPer100g > 0 &&
    m.kcalPer100g <= 900 &&
    macros.every((v) => Number.isFinite(v) && v >= 0 && v <= 100)
  );
}

/** Maps one Open Food Facts product to a FoodMatch, or null if unusable. */
export function normalizeOffProduct(product: OffProduct | null | undefined): FoodMatch | null {
  const n = product?.nutriments ?? {};
  const num = (v: unknown) => (typeof v === 'number' ? v : Number(v));
  const values = {
    kcalPer100g: num(n['energy-kcal_100g']),
    proteinPer100g: num(n['proteins_100g']),
    carbsPer100g: num(n['carbohydrates_100g']),
    fatPer100g: num(n['fat_100g']),
  };
  if (!isPlausible(values)) return null;

  const label = [product?.brands?.split(',')[0]?.trim(), product?.product_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  if (!label) return null;

  return { name: label, ...values, source: 'openfoodfacts' };
}

/** Branded, packaged and supermarket foods — no API key needed. */
export async function searchOpenFoodFacts(query: string, limit = 5): Promise<FoodMatch[]> {
  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
  url.searchParams.set('search_terms', query);
  url.searchParams.set('search_simple', '1');
  url.searchParams.set('action', 'process');
  url.searchParams.set('json', '1');
  url.searchParams.set('page_size', String(limit));
  url.searchParams.set('fields', 'product_name,brands,nutriments');

  try {
    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { products?: OffProduct[] };
    return (data.products ?? [])
      .map(normalizeOffProduct)
      .filter((m: FoodMatch | null): m is FoodMatch => m !== null)
      .slice(0, limit);
  } catch (e) {
    console.error('Open Food Facts search error:', e);
    return [];
  }
}

/** Generic whole foods, when a USDA key is configured. */
export async function searchUsda(query: string, limit = 5): Promise<FoodMatch[]> {
  if (!process.env.USDA_API_KEY) return [];

  const url = new URL('https://api.nal.usda.gov/fdc/v1/foods/search');
  url.searchParams.set('api_key', process.env.USDA_API_KEY);
  url.searchParams.set('query', query);
  url.searchParams.set('pageSize', String(limit));

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return [];
    const data = (await res.json()) as { foods?: UsdaFood[] };
    const nutrient = (food: UsdaFood, id: number) =>
      food.foodNutrients?.find((n) => n.nutrientId === id)?.value ?? 0;

    return (data.foods ?? [])
      .map((food) => ({
        name: food.description ?? '',
        kcalPer100g: nutrient(food, 1008),
        proteinPer100g: nutrient(food, 1003),
        carbsPer100g: nutrient(food, 1005),
        fatPer100g: nutrient(food, 1004),
        source: 'usda' as const,
      }))
      .filter(isPlausible);
  } catch (e) {
    console.error('USDA search error:', e);
    return [];
  }
}

/**
 * Best single match for a food name, cheapest source first: the curated local
 * table, then USDA for generic foods, then Open Food Facts for anything with a
 * barcode. Null when no database knows it — the caller falls back to the AI.
 */
export async function lookupFood(query: string): Promise<FoodMatch | null> {
  const local = searchLocalFoods(query)[0];
  if (local) return { ...local, source: 'local' };

  const [usda, off] = await Promise.all([searchUsda(query, 1), searchOpenFoodFacts(query, 1)]);
  return usda[0] ?? off[0] ?? null;
}

/** All matches across every source, database hits first. */
export async function searchFoods(query: string, limit = 5): Promise<FoodMatch[]> {
  const [usda, off] = await Promise.all([
    searchUsda(query, limit),
    searchOpenFoodFacts(query, limit),
  ]);
  const local: FoodMatch[] = searchLocalFoods(query).map((f) => ({ ...f, source: 'local' as const }));
  return [...usda, ...off, ...local];
}
