// utils/competenceCertificatConfig.ts
// Mapping: compétences du profil → certificats requis
// Utilisé lors de la sauvegarde du profil pour auto-créer des formations_benevoles

export interface CompetenceCertConfig {
  /** Nom de la colonne dans la table reservistes (ex: 'satp_drone') */
  champProfil: string;

  /** Nom de la formation créée. Utiliser {label} pour insérer le label sélectionné */
  nomFormationTemplate: string;

  /** Si true, on demande une date d'expiration */
  aExpiration: boolean;

  /** Durée de validité en mois (pour info/relance). Null si pas d'expiration */
  validiteMois: number | null;

  /** 
   * Si true: chaque label sélectionné crée 1 certificat distinct (ex: ICS-100, ICS-200)
   * Si false: 1 seul certificat pour le champ, peu importe les labels cochés
   */
  unCertificatParLabel: boolean;

  /** 
   * Labels à exclure (ne déclenchent pas de certificat).
   * Ex: pour permis_conduire on pourrait exclure 'Classe 5'
   */
  labelsExclus?: string[];
}

export const COMPETENCE_CERTIFICAT_MAP: CompetenceCertConfig[] = [
  {
    champProfil: 'satp_drone',
    nomFormationTemplate: 'Certificat pilote drone (SATP)',
    aExpiration: true,
    validiteMois: 24,
    unCertificatParLabel: false,
  },
  {
    champProfil: 'certification_csi',
    nomFormationTemplate: 'Certification SCI — {label}',
    aExpiration: false,
    validiteMois: null,
    unCertificatParLabel: true, // ICS-100, ICS-200, ICS-300, ICS-400 = certificats distincts
  },
  {
    champProfil: 'certificat_premiers_soins',
    nomFormationTemplate: 'Certificat premiers soins',
    aExpiration: true,
    validiteMois: 36,
    unCertificatParLabel: false,
  },
  {
    champProfil: 'navire_marin',
    nomFormationTemplate: 'Permis navigation / embarcation',
    aExpiration: true,
    validiteMois: 60,
    unCertificatParLabel: false,
  },
];

/**
 * Résout le template de nom de formation avec le label sélectionné.
 * Ex: "Certification SCI — {label}" + "ICS-200" → "Certification SCI — ICS-200"
 */
export function resolveNomFormation(template: string, label: string): string {
  return template.replace('{label}', label);
}

/**
 * Compare les compétences avant/après sauvegarde et retourne les certificats à créer/désactiver.
 * 
 * @param avant - Valeurs des champs de compétences AVANT sauvegarde
 * @param apres - Valeurs des champs de compétences APRÈS sauvegarde
 * @returns { aCreer, aDesactiver } - Listes d'actions à effectuer
 */
export function diffCompetencesCertificats(
  avant: Record<string, string[]>,
  apres: Record<string, string[]>
): {
  aCreer: Array<{
    champProfil: string;
    label: string;
    nomFormation: string;
    aExpiration: boolean;
  }>;
  aDesactiver: Array<{
    champProfil: string;
    label: string;
  }>;
} {
  const aCreer: Array<{
    champProfil: string;
    label: string;
    nomFormation: string;
    aExpiration: boolean;
  }> = [];

  const aDesactiver: Array<{
    champProfil: string;
    label: string;
  }> = [];

  for (const config of COMPETENCE_CERTIFICAT_MAP) {
    const labelsAvant = new Set(avant[config.champProfil] || []);
    const labelsApres = new Set(apres[config.champProfil] || []);

    // Labels exclus
    const exclus = new Set(config.labelsExclus || []);

    if (config.unCertificatParLabel) {
      // Mode "1 certificat par label" (ex: SCI)
      // Labels ajoutés
      for (const label of labelsApres) {
        if (!labelsAvant.has(label) && !exclus.has(label)) {
          aCreer.push({
            champProfil: config.champProfil,
            label,
            nomFormation: resolveNomFormation(config.nomFormationTemplate, label),
            aExpiration: config.aExpiration,
          });
        }
      }
      // Labels retirés
      for (const label of labelsAvant) {
        if (!labelsApres.has(label) && !exclus.has(label)) {
          aDesactiver.push({
            champProfil: config.champProfil,
            label,
          });
        }
      }
    } else {
      // Mode "1 certificat pour tout le champ" (ex: Drone)
      const avaitCompetence = labelsAvant.size > 0;
      const aCompetence = labelsApres.size > 0;

      // Le label stocké est le premier label non-exclu, ou 'Général'
      const labelRepresentatif = 
        [...labelsApres].find(l => !exclus.has(l)) || 'Général';

      if (!avaitCompetence && aCompetence) {
        // Compétence ajoutée
        aCreer.push({
          champProfil: config.champProfil,
          label: labelRepresentatif,
          nomFormation: resolveNomFormation(config.nomFormationTemplate, labelRepresentatif),
          aExpiration: config.aExpiration,
        });
      } else if (avaitCompetence && !aCompetence) {
        // Compétence retirée — désactiver avec le label qu'on avait avant
        const ancienLabel = 
          [...labelsAvant].find(l => !exclus.has(l)) || 'Général';
        aDesactiver.push({
          champProfil: config.champProfil,
          label: ancienLabel,
        });
      }
    }
  }

  return { aCreer, aDesactiver };
}
