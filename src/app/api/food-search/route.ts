import { NextRequest, NextResponse } from 'next/server';
import { searchFoods } from '@/lib/nutrition-sources';

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get('q');

  if (!query || query.trim().length === 0) {
    return NextResponse.json({ foods: [] });
  }

  return NextResponse.json({ foods: await searchFoods(query) });
}
