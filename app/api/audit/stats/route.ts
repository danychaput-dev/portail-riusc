import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { requireRole, isAuthError } from '@/utils/auth-api';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const auth = await requireRole('superadmin', 'admin');
  if (isAuthError(auth)) return auth;
  const { searchParams } = req.nextUrl;
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const [pagesRes, allRes] = await Promise.all([
    supabase.from('audit_pages').select('*').gte('visite_a', from!).lte('visite_a', to!).order('visite_a', { ascending: false }).range(0, 4999),
    supabase.from('audit_pages').select('benevole_id, user_id').or('benevole_id.not.is.null,user_id.not.is.null').range(0, 4999),
  ]);

  return NextResponse.json({
    pages: pagesRes.data || [],
    all: allRes.data || [],
  });
}