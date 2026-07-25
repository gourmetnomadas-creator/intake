# Intake

A personal, AI-assisted nutrition-tracking PWA (formerly "Plate Log").

The app helps you track daily calories and macros by photographing meals, entering the weight in grams, describing the food, and reviewing AI-suggested ingredient breakdowns before saving.

## Tech stack

- Next.js App Router (TypeScript)
- Tailwind CSS v4
- Supabase (database, auth, image storage)
- OpenAI API (meal interpretation)
- USDA FoodData Central API (optional nutrition lookup)
- PWA (iPhone home screen installable)
- Vercel deployment

## Setup

### 1. Clone and install

```bash
git clone <your-repo-url>
cd plate-log
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Go to **SQL Editor** and run the migration file:

```bash
# Copy the contents of supabase/migrations/00001_initial_schema.sql
# and run it in Supabase SQL Editor
```

3. Go to **Authentication** > **Providers** and enable **Email** auth with Magic Link.
4. Go to **Storage** > **Buckets** and create a new bucket called `meal-photos` (public or private depending on your preference).
5. Go to **Project Settings** > **API** and copy your project URL and anon key.

### 3. Set up environment variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in your values:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase service role key (for server-side operations) |
| `OPENAI_API_KEY` | Your OpenAI API key |
| `USDA_API_KEY` | (Optional) USDA FoodData Central API key |

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 5. Run tests

```bash
npm test
```

## Deployment to Vercel

1. Push the repo to GitHub.
2. Go to [vercel.com](https://vercel.com) and import the repository.
3. Add all environment variables in Vercel project settings.
4. Deploy.

The app should work immediately. Make sure your Supabase project allows requests from your Vercel domain.

## PWA installation on iPhone

1. Open the app in Safari.
2. Tap the **Share** button (square with arrow).
3. Scroll down and tap **Add to Home Screen**.
4. Tap **Add**.
5. The app will appear as an icon on your home screen.

## MVP limitations

- The app estimates calories and macros. It is not a medical device and does not provide medical advice.
- The user must review and correct AI results before saving.
- Bluetooth kitchen scale support is not included yet.
- Photo recognition is assistive, not definitive.
- USDA lookup depends on API key availability (falls back to local database).

## Roadmap

### v1 (current)
- Manual profile with BMR calculation
- Body weight logging
- Meal photo capture/upload
- Natural language meal description
- AI food estimation with confidence scoring
- Editable ingredient review
- Daily calorie and macro dashboard
- Meal history with search and filter
- Repeat meal from history
- Favorites management
- PWA installable on iPhone

### v2
- Barcode scanner
- Open Food Facts integration
- Improved saved meals and recipe mode
- Weekly summaries
- CSV export
- Custom personal foods database

### v3
- Apple Health export
- Smart kitchen scale integration
- Voice meal logging
- Multi-photo meal analysis
- Personal food learning (your foods, your portions)
- Offline-first mode

## Product philosophy

Plate Log is a semi-manual intelligent tracker. The core loop is:

1. Take a photo
2. Enter food description
3. Enter real weight in grams
4. Let AI suggest ingredients
5. Manually review and correct
6. Save
7. See daily total

The app does not claim to be perfectly accurate. It is a practical tool for personal tracking, designed for repeated daily use.
