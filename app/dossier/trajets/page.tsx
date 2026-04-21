// app/dossier/trajets/page.tsx
// Redirige vers /dossier?tab=trajets pour conserver les anciens liens.
import { redirect } from 'next/navigation'

export default function RedirectToTrajetsTab() {
  redirect('/dossier?tab=trajets')
}
