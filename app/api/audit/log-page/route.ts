import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { user_id } = await req.json();
    if (!user_id) return NextResponse.json({ ok: true });

    const { data: reserviste } = await supabase
      .from('reservistes')
      .select('benevole_id')
      .eq('user_id', user_id)
      .single();

    await supabase.from('audit_connexions').insert({
      user_id,
      benevole_id: reserviste?.benevole_id || null,
      ip_address: req.headers.get('x-forwarded-for') || null,
      user_agent: req.headers.get('user-agent') || null
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true }); // Toujours silencieux
  }
}