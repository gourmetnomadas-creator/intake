import { isPlausible, normalizeOffProduct } from '../src/lib/nutrition-sources';

describe('isPlausible', () => {
  it('accepts a normal food', () => {
    expect(
      isPlausible({ kcalPer100g: 250, proteinPer100g: 8, carbsPer100g: 30, fatPer100g: 10 })
    ).toBe(true);
  });

  it('rejects entries with no energy, or per-serving numbers passed off as per-100 g', () => {
    expect(
      isPlausible({ kcalPer100g: 0, proteinPer100g: 0, carbsPer100g: 0, fatPer100g: 0 })
    ).toBe(false);
    expect(
      isPlausible({ kcalPer100g: 2300, proteinPer100g: 8, carbsPer100g: 30, fatPer100g: 10 })
    ).toBe(false);
    expect(
      isPlausible({ kcalPer100g: 400, proteinPer100g: 8, carbsPer100g: 180, fatPer100g: 10 })
    ).toBe(false);
    expect(
      isPlausible({ kcalPer100g: 400, proteinPer100g: -1, carbsPer100g: 30, fatPer100g: 10 })
    ).toBe(false);
  });
});

describe('normalizeOffProduct', () => {
  const product = {
    product_name: 'Nutella',
    brands: 'Ferrero, Nutella',
    nutriments: {
      'energy-kcal_100g': 539,
      proteins_100g: 6.3,
      carbohydrates_100g: 57.5,
      fat_100g: 30.9,
    },
  };

  it('labels a product with its first brand and reads per-100 g nutriments', () => {
    expect(normalizeOffProduct(product)).toEqual({
      name: 'Ferrero Nutella',
      kcalPer100g: 539,
      proteinPer100g: 6.3,
      carbsPer100g: 57.5,
      fatPer100g: 30.9,
      source: 'openfoodfacts',
    });
  });

  it('coerces the string numbers Open Food Facts sometimes returns', () => {
    const asStrings = {
      ...product,
      nutriments: { ...product.nutriments, 'energy-kcal_100g': '539' },
    };
    expect(normalizeOffProduct(asStrings)?.kcalPer100g).toBe(539);
  });

  it('drops products with no usable data', () => {
    expect(normalizeOffProduct({ product_name: 'Mystery', nutriments: {} })).toBeNull();
    expect(normalizeOffProduct({ nutriments: product.nutriments })).toBeNull();
    expect(normalizeOffProduct(null)).toBeNull();
  });
});
