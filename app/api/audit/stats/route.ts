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

  // Pages de la période sélectionnée (max 5000)
  const pagesRes = await supabase
    .from('audit_pages')
    .select('*')
    .gte('visite_a', from!)
    .lte('visite_a', to!)
    .order('visite_a', { ascending: false })
    .range(0, 4999);

  // Tous les user_id distincts ayant visité le portail (toutes périodes)
  // On pagine pour dépasser la limite de 1000 lignes par défaut
  const allUserIds = new Set<string>();
  let offset = 0;
  const PAGE_SIZE = 1000;
  let hasMore = true;
  while (hasMore) {
    const { data } = await supabase
      .from('audit_pages')
      .select('user_id')
      .not('user_id', 'is', null)
      .range(offset, offset + PAGE_SIZE - 1);

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      data.forEach((row: { user_id: string | null }) => {
        if (row.user_id) allUserIds.add(row.user_id);
      });
      if (data.length < PAGE_SIZE) hasMore = false;
      else offset += PAGE_SIZE;
    }
  }

  return NextResponse.json({
    pages: pagesRes.data || [],
    allUserIds: Array.from(allUserIds),
  });
}
