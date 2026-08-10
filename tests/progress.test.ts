import { describe, it, expect } from 'vitest';
import {
  weightChangeRate,
  goalRateBand,
  assessRate,
  averageDailyProtein,
  loggingAdherence,
  MIN_RATE_ENTRIES,
} from '../src/lib/progress';

const TODAY = new Date('2026-08-10T12:00:00Z');

describe('weightChangeRate', () => {
  it('measures a steady loss', () => {
    // 80 kg dropping 0.5 kg a week over four weekly weigh-ins.
    const rate = weightChangeRate(
      [
        { date: '2026-07-20', weight_kg: 80 },
        { date: '2026-07-27', weight_kg: 79.5 },
        { date: '2026-08-03', weight_kg: 79 },
        { date: '2026-08-10', weight_kg: 78.5 },
      ],
      28,
      TODAY
    );

    expect(rate).not.toBeNull();
    expect(rate!.kgPerWeek).toBeCloseTo(-0.5, 2);
    expect(rate!.percentPerWeek).toBeCloseTo(-0.6, 1);
    expect(rate!.entries).toBe(4);
    expect(rate!.spanDays).toBe(21);
  });

  it('measures a steady gain as a positive rate', () => {
    const rate = weightChangeRate(
      [
        { date: '2026-07-20', weight_kg: 60 },
        { date: '2026-07-27', weight_kg: 60.3 },
        { date: '2026-08-03', weight_kg: 60.6 },
        { date: '2026-08-10', weight_kg: 60.9 },
      ],
      28,
      TODAY
    );

    expect(rate!.kgPerWeek).toBeCloseTo(0.3, 2);
    expect(rate!.percentPerWeek).toBeGreaterThan(0);
  });

  it('reports no change when weight is flat', () => {
    const rate = weightChangeRate(
      [
        { date: '2026-07-27', weight_kg: 70 },
        { date: '2026-08-03', weight_kg: 70 },
        { date: '2026-08-10', weight_kg: 70 },
      ],
      28,
      TODAY
    );

    expect(rate!.kgPerWeek).toBe(0);
    expect(rate!.percentPerWeek).toBe(0);
  });

  it('is not thrown off by one odd weigh-in', () => {
    // Same steady loss, but the middle reading is 1.5 kg of water weight high.
    const steady = weightChangeRate(
      [
        { date: '2026-07-20', weight_kg: 80 },
        { date: '2026-07-27', weight_kg: 79.5 },
        { date: '2026-08-03', weight_kg: 79 },
        { date: '2026-08-10', weight_kg: 78.5 },
      ],
      28,
      TODAY
    )!;
    const withSpike = weightChangeRate(
      [
        { date: '2026-07-20', weight_kg: 80 },
        { date: '2026-07-27', weight_kg: 81 },
        { date: '2026-08-03', weight_kg: 79 },
        { date: '2026-08-10', weight_kg: 78.5 },
      ],
      28,
      TODAY
    )!;

    // A first-minus-last reading would be unchanged; a fit moves, but not wildly.
    expect(Math.abs(withSpike.kgPerWeek - steady.kgPerWeek)).toBeLessThan(0.4);
  });

  it('says nothing without enough weigh-ins', () => {
    expect(
      weightChangeRate(
        [
          { date: '2026-08-03', weight_kg: 70 },
          { date: '2026-08-10', weight_kg: 69.5 },
        ],
        28,
        TODAY
      )
    ).toBeNull();
    expect(MIN_RATE_ENTRIES).toBe(3);
  });

  it('says nothing when the weigh-ins are all crowded into a few days', () => {
    expect(
      weightChangeRate(
        [
          { date: '2026-08-08', weight_kg: 70 },
          { date: '2026-08-09', weight_kg: 69.6 },
          { date: '2026-08-10', weight_kg: 69.2 },
        ],
        28,
        TODAY
      )
    ).toBeNull();
  });

  it('ignores weigh-ins older than the window', () => {
    const rate = weightChangeRate(
      [
        { date: '2026-01-01', weight_kg: 95 }, // long before the window
        { date: '2026-07-27', weight_kg: 80 },
        { date: '2026-08-03', weight_kg: 79.5 },
        { date: '2026-08-10', weight_kg: 79 },
      ],
      28,
      TODAY
    );

    expect(rate!.entries).toBe(3);
    expect(rate!.kgPerWeek).toBeCloseTo(-0.5, 2);
  });

  it('handles logs given out of order', () => {
    const shuffled = weightChangeRate(
      [
        { date: '2026-08-03', weight_kg: 79 },
        { date: '2026-08-10', weight_kg: 78.5 },
        { date: '2026-07-20', weight_kg: 80 },
        { date: '2026-07-27', weight_kg: 79.5 },
      ],
      28,
      TODAY
    );

    expect(shuffled!.kgPerWeek).toBeCloseTo(-0.5, 2);
  });
});

describe('goalRateBand', () => {
  it('points the band the right way for each goal', () => {
    expect(goalRateBand('lose')!.max).toBeLessThan(0);
    expect(goalRateBand('mild_deficit')!.max).toBeLessThan(0);
    expect(goalRateBand('gain')!.min).toBeGreaterThan(0);
    expect(goalRateBand('mild_surplus')!.min).toBeGreaterThan(0);

    const maintain = goalRateBand('maintain')!;
    expect(maintain.min).toBeLessThan(0);
    expect(maintain.max).toBeGreaterThan(0);
  });

  it('has no band for a self-set calorie target or a missing goal', () => {
    expect(goalRateBand('manual')).toBeNull();
    expect(goalRateBand(null)).toBeNull();
    expect(goalRateBand(undefined)).toBeNull();
    expect(goalRateBand('something-else')).toBeNull();
  });

  it('gives every band a description to show beside the number', () => {
    for (const goal of ['lose', 'mild_deficit', 'maintain', 'mild_surplus', 'gain']) {
      expect(goalRateBand(goal)!.label.length).toBeGreaterThan(0);
    }
  });
});

describe('assessRate', () => {
  const losing = goalRateBand('lose')!; // -1 .. -0.5
  const gaining = goalRateBand('gain')!; // 0.25 .. 0.5
  const maintaining = goalRateBand('maintain')!; // -0.25 .. 0.25

  it('recognises a rate inside the range, including its edges', () => {
    expect(assessRate(-0.7, losing)).toBe('within');
    expect(assessRate(-1, losing)).toBe('within');
    expect(assessRate(-0.5, losing)).toBe('within');
  });

  it('separates losing too fast from barely losing', () => {
    expect(assessRate(-1.6, losing)).toBe('above');
    expect(assessRate(-0.2, losing)).toBe('below');
  });

  it('calls out moving the other way entirely', () => {
    expect(assessRate(0.4, losing)).toBe('opposite');
    expect(assessRate(-0.4, gaining)).toBe('opposite');
  });

  it('reads a band that straddles zero as drift in either direction', () => {
    expect(assessRate(0.1, maintaining)).toBe('within');
    expect(assessRate(-0.1, maintaining)).toBe('within');
    expect(assessRate(0.9, maintaining)).toBe('above');
    expect(assessRate(-0.9, maintaining)).toBe('above');
  });
});

describe('averageDailyProtein', () => {
  const meals = [
    { date: '2026-08-10', total_protein_g: 40 },
    { date: '2026-08-10', total_protein_g: 35 },
    { date: '2026-08-09', total_protein_g: 90 },
  ];

  it('averages over days, not over meals', () => {
    // Two days totalling 165 g, not three meals averaging 55 g.
    const intake = averageDailyProtein(meals, 7, 70, TODAY)!;
    expect(intake.daysCounted).toBe(2);
    expect(intake.averageDailyG).toBe(83);
  });

  it('divides by days logged, not by the whole window', () => {
    // Skipped days are absent data, not zero-protein days.
    const intake = averageDailyProtein(meals, 30, 70, TODAY)!;
    expect(intake.daysCounted).toBe(2);
    expect(intake.averageDailyG).toBe(83);
  });

  it('expresses intake per kilogram when a weight is known', () => {
    expect(averageDailyProtein(meals, 7, 70, TODAY)!.perKg).toBeCloseTo(1.2, 1);
    expect(averageDailyProtein(meals, 7, null, TODAY)!.perKg).toBeNull();
  });

  it('returns nothing when no meals fall in the window', () => {
    expect(averageDailyProtein([], 7, 70, TODAY)).toBeNull();
    expect(
      averageDailyProtein([{ date: '2026-01-01', total_protein_g: 90 }], 7, 70, TODAY)
    ).toBeNull();
  });
});

describe('loggingAdherence', () => {
  it('counts distinct days, however many meals are on them', () => {
    const result = loggingAdherence(
      [
        { date: '2026-08-10' },
        { date: '2026-08-10' },
        { date: '2026-08-10' },
        { date: '2026-08-08' },
      ],
      7,
      TODAY
    );

    expect(result).toEqual({ daysLogged: 2, windowDays: 7 });
  });

  it('ignores days outside the window', () => {
    expect(
      loggingAdherence([{ date: '2026-08-10' }, { date: '2026-06-01' }], 7, TODAY).daysLogged
    ).toBe(1);
  });

  it('reports zero for an empty history', () => {
    expect(loggingAdherence([], 7, TODAY)).toEqual({ daysLogged: 0, windowDays: 7 });
  });
});
