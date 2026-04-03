'use client'

interface CampInfoBlocsProps {
  /** true = lien vers /profil, false = texte générique pour page inscription (pas encore de compte) */
  showProfilLink?: boolean
}

export default function CampInfoBlocs({ showProfilLink = true }: CampInfoBlocsProps) {
  return (
    <>
      <div style={{ backgroundColor: '#eff6ff', padding: '16px', borderRadius: '8px', marginBottom: '16px', borderLeft: '4px solid #1e3a5f' }}>
        <div style={{ fontSize: '14px', fontWeight: '600', color: '#1e3a5f', marginBottom: '8px' }}>Informations importantes</div>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#374151', lineHeight: '1.8' }}>
          <li>Horaire : <strong>8h30 à 16h30</strong> les deux jours (samedi et dimanche)</li>
          <li>Les repas du midi et les collations sont fournis</li>
          <li>Le stationnement est disponible sur place</li>
          <li>Le dimanche, une activité extérieure d&apos;environ 75 minutes implique la manipulation de sacs de sable — prévoir des vêtements adaptés à la météo et qui peuvent se salir</li>
          <li>Un <strong>5 à 7</strong> suivra la journée du samedi — vous êtes invités à venir partager et discuter (à vos frais)</li>
        </ul>
      </div>

      <div style={{ backgroundColor: '#f0fdf4', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', borderLeft: '4px solid #16a34a', fontSize: '13px', color: '#065f46', lineHeight: '1.6' }}>
        {showProfilLink ? (
          <>📱 <strong>Rappel par SMS :</strong> Vous recevrez un texto de rappel avant le camp. Veuillez y répondre pour confirmer votre présence. Assurez-vous que votre numéro de cellulaire est à jour dans votre <a href="/profil" style={{ color: '#1e3a5f', fontWeight: '600' }}>profil</a>.</>
        ) : (
          <>📱 <strong>Rappel par SMS :</strong> Vous recevrez un texto de rappel avant le camp. Assurez-vous que votre numéro de cellulaire ci-dessus est valide.</>
        )}
      </div>
    </>
  )
}
