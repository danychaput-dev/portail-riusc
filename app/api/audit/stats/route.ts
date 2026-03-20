import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const [pagesRes, allRes] = await Promise.all([
    supabase.from('audit_pages').select('*').gte('visite_a', from!).lte('visite_a', to!).order('visite_a', { ascending: false }),
    supabase.from('audit_pages').select('benevole_id').not('benevole_id', 'is', null),
  ]);

  return NextResponse.json({
    pages: pagesRes.data || [],
    all: allRes.data || [],
  });
}