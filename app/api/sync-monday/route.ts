// DEPRECATED — Monday.com integration removed (2026-04-03)
// This file can be safely deleted: git rm -rf app/api/sync-monday
import { NextResponse } from 'next/server'
export async function POST() {
  return NextResponse.json({ error: 'Monday.com integration has been removed' }, { status: 410 })
}
