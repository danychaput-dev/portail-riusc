// utils/competenceConfirmation.ts
// Gère la confirmation avant retrait d'une compétence liée à un certificat

import { COMPETENCE_CERTIFICAT_MAP } from './competenceCertificatConfig';

export interface CertificatAssocie {
  id: string;                    // UUID Supabase
  nom_formation: string;
  certificat_url: string | null;
  date_reussite: string | null;
  date_expiration: string | null;
  competence_profil_champ: string;
  competence_profil_label: string;
}

export interface ConfirmationRetrait {
  /** La compétence nécessite-t-elle une confirmation ? */
  requiresConfirmation: boolean;
  /** Message à afficher dans la modal */
  message: string;
  /** Titre de la modal */
  titre: string;
  /** Les certificats qui seront affectés */
  certificatsAffectes: CertificatAssocie[];
  /** Le champ profil concerné */
  champProfil: string;
  /** Les labels retirés */
  labelsRetires: string[];
}

/**
 * Vérifie si le retrait d'une compétence nécessite une confirmation.
 * Appelé AVANT la sauvegarde quand on détecte qu'un label a été décoché.
 * 
 * @param champProfil - Le champ modifié (ex: 'satp_drone')
 * @param labelsRetires - Les labels qui vont être retirés
 * @param certificatsExistants - Les certificats du bénévole (depuis get_certificats_competence)
 */
export function verifierRetraitCompetence(
  champProfil: string,
  labelsRetires: string[],
  certificatsExistants: CertificatAssocie[]
): ConfirmationRetrait {
  // Vérifier si ce champ fait partie des compétences à certificat
  const config = COMPETENCE_CERTIFICAT_MAP.find(c => c.champProfil === champProfil);
  
  if (!config) {
    return {
      requiresConfirmation: false,
      message: '',
      titre: '',
      certificatsAffectes: [],
      champProfil,
      labelsRetires,
    };
  }

  // Trouver les certificats associés à ces labels
  const certificatsAffectes = certificatsExistants.filter(cert => {
    if (config.unCertificatParLabel) {
      // Mode par label: matcher le label exact
      return cert.competence_profil_champ === champProfil 
        && labelsRetires.includes(cert.competence_profil_label);
    } else {
      // Mode global: tout le champ
      return cert.competence_profil_champ === champProfil;
    }
  });

  if (certificatsAffectes.length === 0) {
    return {
      requiresConfirmation: false,
      message: '',
      titre: '',
      certificatsAffectes: [],
      champProfil,
      labelsRetires,
    };
  }

  // Construire le message selon le statut des certificats
  const avecCertificat = certificatsAffectes.filter(c => c.certificat_url);
  const sansCertificat = certificatsAffectes.filter(c => !c.certificat_url);

  let message = '';

  if (avecCertificat.length > 0 && sansCertificat.length > 0) {
    // Mix des deux
    message = `Cette compétence est liée à ${certificatsAffectes.length} entrée(s) dans votre parcours Formation:\n\n`;
    
    for (const cert of avecCertificat) {
      message += `• ${cert.nom_formation} — certificat validé`;
      if (cert.date_reussite) {
        message += ` (réussi le ${formatDate(cert.date_reussite)})`;
      }
      message += '\n';
    }
    for (const cert of sansCertificat) {
      message += `• ${cert.nom_formation} — certificat en attente\n`;
    }
    
    message += '\nEn retirant cette compétence, ces entrées seront désactivées dans votre parcours.';

  } else if (avecCertificat.length > 0) {
    // Tous avec certificat
    if (avecCertificat.length === 1) {
      const cert = avecCertificat[0];
      message = `Attention — Vous avez un certificat validé pour cette compétence:\n\n`;
      message += `${cert.nom_formation}`;
      if (cert.date_reussite) {
        message += `, réussi le ${formatDate(cert.date_reussite)}`;
      }
      if (cert.date_expiration) {
        message += ` (expire le ${formatDate(cert.date_expiration)})`;
      }
      message += `.\n\nEn retirant cette compétence, le certificat sera marqué comme inactif dans votre parcours Formation.`;
    } else {
      message = `Attention — Vous avez ${avecCertificat.length} certificats validés pour cette compétence:\n\n`;
      for (const cert of avecCertificat) {
        message += `• ${cert.nom_formation}`;
        if (cert.date_reussite) message += ` (réussi le ${formatDate(cert.date_reussite)})`;
        message += '\n';
      }
      message += `\nEn retirant cette compétence, ces certificats seront marqués comme inactifs.`;
    }

  } else {
    // Tous sans certificat
    if (sansCertificat.length === 1) {
      message = `Cette compétence a un certificat en attente dans votre parcours Formation:\n\n`;
      message += `${sansCertificat[0].nom_formation}\n\n`;
      message += `En retirant cette compétence, cette entrée sera supprimée de votre parcours.`;
    } else {
      message = `Cette compétence a ${sansCertificat.length} certificats en attente dans votre parcours Formation.\n\n`;
      message += `En retirant cette compétence, ces entrées seront supprimées de votre parcours.`;
    }
  }

  return {
    requiresConfirmation: true,
    message,
    titre: avecCertificat.length > 0 
      ? 'Certificat validé associé' 
      : 'Certificat en attente associé',
    certificatsAffectes,
    champProfil,
    labelsRetires,
  };
}

/**
 * Formate une date ISO en format lisible (ex: "15 mars 2025")
 */
function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-CA', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
  } catch {
    return dateStr;
  }
}
