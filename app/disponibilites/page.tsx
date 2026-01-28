'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter } from 'next/navigation';

// Interfaces TypeScript
interface Disponibilite { ... }
interface DeploiementActif { ... }
interface Reserviste { ... }

export default function DisponibilitesPage() {
  // States
  const [deploiementsActifs, setDeploiementsActifs] = useState([]);
  // ... autres states
  
  // Fonction pour récupérer déploiements actifs
  async function fetchDeploiementsActifs() {
    const { data } = await supabase
      .from('deploiements_actifs')  // ← Nouvelle table
      .select('*')
      .gte('date_fin', today)
      .order('date_debut', { ascending: true });
    
    if (data) setDeploiementsActifs(data);
  }
  
  // Fonction pour générer lien Jotform
  function genererLienJotform(deploiementId: string) {
    return `https://form.jotform.com/253475614808262?BenevoleID=${benevoleId}&DeploiementID=${deploiementId}`;
  }
  
  // Affichage JSX
  return (
    <div>
      {/* Section 1 : Déploiements actifs (NOUVEAU) */}
      <h2>📋 Déploiements en recherche de réservistes</h2>
      {deploiementsActifs.map(dep => (
        <div>
          {/* Hiérarchie : Sinistre → Demande → Déploiement */}
          {/* Bouton : Soumettre ma disponibilité */}
        </div>
      ))}
      
      {/* Section 2 : Mes disponibilités soumises (EXISTANT) */}
      <h2>✅ Mes disponibilités soumises</h2>
      {disponibilites.map(dispo => (...))}
    </div>
  );
}