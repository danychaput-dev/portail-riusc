// utils/competenceSaveHandler.ts
// Logique complète d'intégration compétences → certificats lors du save profil
// S'intègre dans handleSave() de app/profil/page.tsx

import { supabase } from '@/utils/supabaseClient'; // ajuste le chemin selon ton projet
import { 
  COMPETENCE_CERTIFICAT_MAP, 
  diffCompetencesCertificats 
} from './competenceCertificatConfig';
import { 
  verifierRetraitCompetence, 
  CertificatAssocie, 
  ConfirmationRetrait 
} from './competenceConfirmation';

// ─── Types ──────────────────────────────────────────────────────────────────

/** Snapshot des champs de compétences (avant/après save) */
export type CompetenceSnapshot = Record<string, string[]>;

/** Résultat de la détection de changements */
export interface CompetenceChanges {
  hasChanges: boolean;
  confirmationsRequises: ConfirmationRetrait[];
  ajouts: Array<{
    champProfil: string;
    label: string;
    nomFormation: string;
    aExpiration: boolean;
  }>;
  retraits: Array<{
    champProfil: string;
    label: string;
  }>;
}

// ─── 1. Snapshot des compétences ────────────────────────────────────────────

/**
 * Prend un snapshot des champs de compétences actuels du formData.
 * À appeler AVANT et APRÈS la sauvegarde pour comparer.
 * 
 * Les compétences dans le formData sont stockées comme arrays d'IDs numériques.
 * On les convertit en labels via idsToLabels() pour la comparaison.
 * 
 * @param formData - Le state du formulaire profil
 * @param idsToLabels - La fonction de conversion existante dans le profil
 */
export function prendreSnapshotCompetences(
  formData: Record<string, any>,
  idsToLabels: (ids: number[], champ: string) => string[]
): CompetenceSnapshot {
  const snapshot: CompetenceSnapshot = {};
  
  for (const config of COMPETENCE_CERTIFICAT_MAP) {
    const ids = formData[config.champProfil];
    if (Array.isArray(ids)) {
      // Si c'est déjà des labels (strings), les garder tels quels
      if (ids.length > 0 && typeof ids[0] === 'string') {
        snapshot[config.champProfil] = [...ids];
      } else {
        // Sinon convertir les IDs numériques en labels
        snapshot[config.champProfil] = idsToLabels(ids, config.champProfil);
      }
    } else {
      snapshot[config.champProfil] = [];
    }
  }
  
  return snapshot;
}

// ─── 2. Détecter les changements ────────────────────────────────────────────

/**
 * Compare avant/après et vérifie si des confirmations sont nécessaires.
 * 
 * @param snapshotAvant - Compétences avant modification
 * @param snapshotApres - Compétences après modification (état actuel du form)
 * @param certificatsExistants - Certificats du bénévole (chargés au mount de la page)
 */
export function detecterChangementsCompetences(
  snapshotAvant: CompetenceSnapshot,
  snapshotApres: CompetenceSnapshot,
  certificatsExistants: CertificatAssocie[]
): CompetenceChanges {
  const { aCreer, aDesactiver } = diffCompetencesCertificats(snapshotAvant, snapshotApres);

  // Pour chaque retrait, vérifier s'il y a des certificats associés
  const confirmationsRequises: ConfirmationRetrait[] = [];

  // Grouper les retraits par champ
  const retraitsParChamp: Record<string, string[]> = {};
  for (const retrait of aDesactiver) {
    if (!retraitsParChamp[retrait.champProfil]) {
      retraitsParChamp[retrait.champProfil] = [];
    }
    retraitsParChamp[retrait.champProfil].push(retrait.label);
  }

  for (const [champ, labels] of Object.entries(retraitsParChamp)) {
    const confirmation = verifierRetraitCompetence(champ, labels, certificatsExistants);
    if (confirmation.requiresConfirmation) {
      confirmationsRequises.push(confirmation);
    }
  }

  return {
    hasChanges: aCreer.length > 0 || aDesactiver.length > 0,
    confirmationsRequises,
    ajouts: aCreer,
    retraits: aDesactiver,
  };
}

// ─── 3. Charger les certificats compétence existants ────────────────────────

/**
 * Charge les certificats de compétence du bénévole depuis Supabase.
 * À appeler au mount de la page profil (ou au load du réserviste).
 */
export async function chargerCertificatsCompetence(
  benevoleId: string
): Promise<CertificatAssocie[]> {
  try {
    const { data, error } = await supabase.rpc('get_certificats_competence', {
      p_benevole_id: benevoleId,
    });

    if (error) {
      console.error('Erreur chargement certificats compétence:', error);
      return [];
    }

    return (data || []) as CertificatAssocie[];
  } catch (err) {
    console.error('Erreur chargerCertificatsCompetence:', err);
    return [];
  }
}

// ─── 4. Appliquer les changements (après confirmation) ──────────────────────

/**
 * Crée les nouveaux certificats et désactive les retirés.
 * Appelé APRÈS la sauvegarde du profil ET après confirmation utilisateur.
 * 
 * @param benevoleId - ID du bénévole
 * @param nomComplet - "Prénom Nom" pour Monday
 * @param changes - Résultat de detecterChangementsCompetences()
 * @param retraitsConfirmes - Labels que l'utilisateur a confirmé vouloir retirer
 */
export async function appliquerChangementsCompetences(
  benevoleId: string,
  nomComplet: string,
  changes: CompetenceChanges,
  retraitsConfirmes?: Array<{ champProfil: string; label: string }>
): Promise<{
  certificatsCrees: number;
  certificatsDesactives: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let certificatsCrees = 0;
  let certificatsDesactives = 0;

  // ── A. Créer les nouveaux certificats ──
  for (const ajout of changes.ajouts) {
    try {
      // 1. Insert Supabase
      const { data: result, error } = await supabase.rpc('upsert_certificat_competence', {
        p_benevole_id: benevoleId,
        p_nom_formation: ajout.nomFormation,
        p_competence_champ: ajout.champProfil,
        p_competence_label: ajout.label,
        p_a_expiration: ajout.aExpiration,
      });

      if (error) {
        errors.push(`Erreur création certificat "${ajout.nomFormation}": ${error.message}`);
        continue;
      }

      const { id: formationId, is_new: isNew } = result as any;

      // 2. Si nouveau → créer dans Monday via n8n
      if (isNew) {
        try {
          const webhookResponse = await fetch(
            'https://n8n.aqbrs.ca/webhook/formation-competence',
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'create',
                benevole_id: benevoleId,
                nom_complet: nomComplet,
                nom_formation: ajout.nomFormation,
                supabase_formation_id: formationId,
              }),
            }
          );

          const webhookData = await webhookResponse.json();

          // 3. Mettre à jour monday_item_id dans Supabase
          if (webhookData?.success && webhookData?.monday_item_id) {
            await supabase.rpc('set_monday_item_id', {
              p_formation_id: formationId,
              p_monday_item_id: parseInt(webhookData.monday_item_id),
            });
          }
        } catch (webhookErr) {
          // Ne pas bloquer si Monday échoue — Supabase est la source de vérité
          console.error('Erreur sync Monday (create):', webhookErr);
          errors.push(`Certificat "${ajout.nomFormation}" créé dans Supabase, mais erreur sync Monday`);
        }
      }

      certificatsCrees++;
    } catch (err: any) {
      errors.push(`Erreur inattendue pour "${ajout.nomFormation}": ${err.message}`);
    }
  }

  // ── B. Désactiver les certificats retirés (seulement ceux confirmés) ──
  const retraitsAAppliquer = retraitsConfirmes || changes.retraits;

  for (const retrait of retraitsAAppliquer) {
    try {
      // 1. Désactiver dans Supabase
      const { data: result, error } = await supabase.rpc('desactiver_certificat_competence', {
        p_benevole_id: benevoleId,
        p_competence_champ: retrait.champProfil,
        p_competence_label: retrait.label,
      });

      if (error) {
        errors.push(`Erreur désactivation "${retrait.label}": ${error.message}`);
        continue;
      }

      const { action, monday_item_id } = result as any;

      // 2. Sync Monday si on a un monday_item_id
      if (monday_item_id) {
        try {
          const mondayAction = action === 'deleted' ? 'delete' : 'mark';
          await fetch('https://n8n.aqbrs.ca/webhook/formation-competence', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: mondayAction,
              monday_item_id: monday_item_id.toString(),
              benevole_id: benevoleId,
            }),
          });
        } catch (webhookErr) {
          console.error('Erreur sync Monday (désactivation):', webhookErr);
          errors.push(`Certificat désactivé dans Supabase, mais erreur sync Monday`);
        }
      }

      certificatsDesactives++;
    } catch (err: any) {
      errors.push(`Erreur inattendue désactivation "${retrait.label}": ${err.message}`);
    }
  }

  return { certificatsCrees, certificatsDesactives, errors };
}

// ─── 5. Restaurer les compétences (si l'utilisateur annule) ─────────────────

/**
 * Remet les valeurs d'avant pour les compétences dont le retrait a été annulé.
 * 
 * @param formData - Le state du formulaire (sera modifié)
 * @param snapshotAvant - Les valeurs d'avant
 * @param champsARestaurer - Les champs à remettre à l'état d'avant
 * @param labelsToIds - La fonction de conversion existante
 */
export function restaurerCompetences(
  snapshotAvant: CompetenceSnapshot,
  champsARestaurer: string[],
  labelsToIds: (labels: string[], champ: string) => number[]
): Record<string, number[]> {
  const updates: Record<string, number[]> = {};
  
  for (const champ of champsARestaurer) {
    const labels = snapshotAvant[champ] || [];
    updates[champ] = labelsToIds(labels, champ);
  }
  
  return updates;
}
