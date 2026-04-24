// types/sopfeu-import.ts
// Types partagés entre le parseur XLSX (API), l'endpoint de création (API) et
// la page de preview (UI) pour l'import du gabarit SOPFEU de mobilisation.
// Sépare les types du route module pour éviter la friction Next.js 16 quand
// une route.ts expose autre chose que des handlers HTTP.

export interface EffectifParsed {
  role: string
  label: string
  nombre: number | null
  capacites: string[]
  autres_precisions: string
}

export interface ParsedSopfeu {
  // Identification
  numero_intervention: string
  lieu_intervention: string
  nature_demande: string

  // Contact CPO
  contact_cpo_prenom: string
  contact_cpo_nom: string
  contact_cpo_fonction: string
  contact_cpo_tel_1: string
  contact_cpo_tel_2: string
  contact_cpo_courriel: string

  // Mandat
  description_evenement: string
  evolution_attendue: string
  au_profit_de: string
  principales_taches: string
  mandat_autres_precisions: string

  // Conditions
  meteo: string
  amplitudes_horaires: string
  enjeux_sst: string
  charge_mentale: string
  conditions_autres: string

  // Effectifs
  effectifs: EffectifParsed[]
  effectifs_autres_precisions: string

  // RDV
  duree_min_dispo: string
  rdv_date: string    // ISO YYYY-MM-DD
  rdv_heure: string   // HH:MM
  rdv_lieu: string
  stationnement: string
  contact_site_prenom: string
  contact_site_nom: string
  contact_site_fonction: string
  contact_site_tel_1: string
  contact_site_tel_2: string
  contact_site_courriel: string
  rdv_autres_precisions: string

  // Services
  hebergement: string
  alimentation: string
  installations: string
  connectivite: string
  services_autres: string

  // Metadata parsing
  warnings: string[]
}
