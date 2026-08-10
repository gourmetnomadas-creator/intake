import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';

// The app is English-only, but its prompts are plain strings and the meal
// history fed into them is often written in another language. Both are easy
// ways for a reply to come back in the wrong one, so guard the prompts here.

const API_DIR = path.join(process.cwd(), 'src/app/api');

const routes = readdirSync(API_DIR)
  .map((name) => ({ name, file: path.join(API_DIR, name, 'route.ts') }))
  .filter(({ file }) => existsSync(file));

// Endpoints whose output is prose the user reads.
const PROSE_ROUTES = ['suggest-meal', 'suggest-supplement', 'weekly-review'];

describe('AI prompt language', () => {
  it('finds the API routes to check', () => {
    expect(routes.length).toBeGreaterThan(4);
    for (const name of PROSE_ROUTES) {
      expect(routes.map((r) => r.name)).toContain(name);
    }
  });

  it('never asks the model to reply in Spanish', () => {
    for (const { name, file } of routes) {
      // Understanding Spanish input is fine; answering in it is not.
      expect(readFileSync(file, 'utf8'), `${name} asks for a Spanish reply`).not.toMatch(
        /\bin Spanish\b/i
      );
    }
  });

  it('asks for English wherever the model writes prose the user reads', () => {
    for (const name of PROSE_ROUTES) {
      const source = readFileSync(path.join(API_DIR, name, 'route.ts'), 'utf8');
      expect(source, `${name} never asks for English`).toMatch(/\bin English\b/i);
    }
  });

  it('warns the meal suggester that the history it is given may not be English', () => {
    // Rule 8 of 8 lost to a wall of Spanish meal names in the context.
    const source = readFileSync(path.join(API_DIR, 'suggest-meal', 'route.ts'), 'utf8');
    expect(source).toMatch(/may be written in another language/i);
    expect(source).toMatch(/translate/i);
  });
});
