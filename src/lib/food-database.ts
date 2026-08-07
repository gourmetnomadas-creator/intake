export interface FoodEntry {
  name: string;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
}

export const commonFoods: FoodEntry[] = [
  { name: 'cooked oatmeal', kcalPer100g: 71, proteinPer100g: 2.5, carbsPer100g: 12, fatPer100g: 1.5 },
  { name: 'rolled oats dry', kcalPer100g: 389, proteinPer100g: 16.9, carbsPer100g: 66.3, fatPer100g: 6.9 },
  { name: 'banana', kcalPer100g: 89, proteinPer100g: 1.1, carbsPer100g: 23, fatPer100g: 0.3 },
  { name: 'apple', kcalPer100g: 52, proteinPer100g: 0.3, carbsPer100g: 14, fatPer100g: 0.2 },
  { name: 'cooked white rice', kcalPer100g: 130, proteinPer100g: 2.7, carbsPer100g: 28, fatPer100g: 0.3 },
  { name: 'cooked brown rice', kcalPer100g: 123, proteinPer100g: 2.7, carbsPer100g: 26, fatPer100g: 1.0 },
  { name: 'cooked lentils', kcalPer100g: 116, proteinPer100g: 9.0, carbsPer100g: 20, fatPer100g: 0.4 },
  { name: 'cooked chickpeas', kcalPer100g: 139, proteinPer100g: 7.6, carbsPer100g: 23, fatPer100g: 2.6 },
  { name: 'tofu firm', kcalPer100g: 144, proteinPer100g: 15.8, carbsPer100g: 2.8, fatPer100g: 8.7 },
  { name: 'tempeh', kcalPer100g: 193, proteinPer100g: 18.5, carbsPer100g: 9.4, fatPer100g: 10.8 },
  { name: 'potato boiled', kcalPer100g: 87, proteinPer100g: 1.9, carbsPer100g: 20, fatPer100g: 0.1 },
  { name: 'sweet potato cooked', kcalPer100g: 90, proteinPer100g: 2.0, carbsPer100g: 21, fatPer100g: 0.1 },
  { name: 'peanut butter', kcalPer100g: 588, proteinPer100g: 25, carbsPer100g: 20, fatPer100g: 50 },
  { name: 'almond butter', kcalPer100g: 614, proteinPer100g: 21, carbsPer100g: 19, fatPer100g: 56 },
  { name: 'soy milk unsweetened', kcalPer100g: 33, proteinPer100g: 2.9, carbsPer100g: 1.2, fatPer100g: 1.8 },
  { name: 'oat milk unsweetened', kcalPer100g: 45, proteinPer100g: 1.0, carbsPer100g: 7, fatPer100g: 1.5 },
  { name: 'olive oil', kcalPer100g: 884, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 100 },
  { name: 'avocado', kcalPer100g: 160, proteinPer100g: 2.0, carbsPer100g: 8.5, fatPer100g: 14.7 },
  { name: 'whole wheat bread', kcalPer100g: 247, proteinPer100g: 13, carbsPer100g: 41, fatPer100g: 3.4 },
  { name: 'homemade bread', kcalPer100g: 266, proteinPer100g: 8, carbsPer100g: 49, fatPer100g: 4 },
  { name: 'cooked pasta', kcalPer100g: 131, proteinPer100g: 5, carbsPer100g: 25, fatPer100g: 1.1 },
  { name: 'tomato', kcalPer100g: 18, proteinPer100g: 0.9, carbsPer100g: 3.9, fatPer100g: 0.2 },
  { name: 'cucumber', kcalPer100g: 15, proteinPer100g: 0.7, carbsPer100g: 3.6, fatPer100g: 0.1 },
  { name: 'carrot', kcalPer100g: 41, proteinPer100g: 0.9, carbsPer100g: 10, fatPer100g: 0.2 },
  { name: 'spinach', kcalPer100g: 23, proteinPer100g: 2.9, carbsPer100g: 3.6, fatPer100g: 0.4 },
  { name: 'broccoli', kcalPer100g: 34, proteinPer100g: 2.8, carbsPer100g: 7, fatPer100g: 0.4 },
  { name: 'beans cooked', kcalPer100g: 132, proteinPer100g: 8.7, carbsPer100g: 24, fatPer100g: 0.5 },
];

export function searchLocalFoods(query: string): FoodEntry[] {
  const lower = query.toLowerCase();
  return commonFoods.filter((food) => food.name.includes(lower));
}
