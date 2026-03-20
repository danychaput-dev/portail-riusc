import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { user_id, benevole_id, page } = await req.json();
    if (!page) return NextResponse.json({ ok: true });

    await supabase.from('audit_pages').insert({
      user_id: user_id || null,
      benevole_id: benevole_id || null,
      page
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
