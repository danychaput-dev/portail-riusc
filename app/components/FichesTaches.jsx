"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Aligné Programme SST RIUSC v7.x
 * - Cotation 4x4 : R = G x P
 * - Niveau dérivé de R : 1-4 Faible | 5-8 Modéré | 9-12 Élevé | 13-16 Critique
 * - Ajout Limites d’intervention + Hiérarchie des contrôles
 * - “Gestion des débris” = dégagement opérationnel (pas rétablissement/nettoyage)
 * - “Responsable terrain” = Chef d’équipe SOPFEU / Coordinateur Croix-Rouge
 */

const riskLevelFromR = (R) => {
  if (R >= 13) return "Critique";
  if (R >= 9) return "Élevé";
  if (R >= 5) return "Modéré";
  return "Faible";
};

const RISK_CONFIG = {
  Critique: { bg: "#fef2f2", color: "#dc2626", border: "#fca5a5" },
  "Élevé": { bg: "#fff7ed", color: "#ea580c", border: "#fdba74" },
  Modéré: { bg: "#fefce8", color: "#a16207", border: "#fde68a" },
  Faible: { bg: "#f0fdf4", color: "#16a34a", border: "#86efac" },
};

const TACHES = [
  {
    id: 1,
    name: "SP — Protection d’infrastructures (digues temporaires)",
    org: "SOPFEU",
    description:
      "Remplissage, transport et empilement de sacs de sable et matériaux temporaires pour renforcer une berge/digue en phase d’urgence, en zone froide confirmée.",
    analyseRisque:
      "Manutention répétée de charges (sacs, matériaux), travail sur terrain humide/instable, risques de glissade et fatigue. Contexte opérationnel exigeant (temps, météo).",
    cotationInitiale: { G: 3, P: 3, R: 9 },
    cotationResiduelle: { G: 3, P: 2, R: 6 },
    limites: [
      "Phase d’urgence uniquement (aucun rétablissement/nettoyage complet).",
      "Zone froide confirmée avant le début des travaux.",
      "Aucune machinerie lourde opérée par les réservistes (sauf coordination/exclusion).",
      "Arrêt immédiat si conditions deviennent dangereuses (montée des eaux, instabilité).",
    ],
    dangers: [
      "Troubles musculo-squelettiques (TMS) – levage répétitif, postures",
      "Glissades/chutes (boue, eau, obstacles)",
      "Fatigue thermique (chaleur/froid) et déshydratation/hypothermie",
      "Effondrement partiel d’empilement / instabilité de digue temporaire",
      "Stress et baisse de vigilance",
    ],
    controles: {
      elimination: [
        "Refuser toute intervention hors zone froide ou sans validation terrain.",
        "Interrompre l’activité si montée des eaux / instabilité / visibilité réduite.",
      ],
      ingenierie: [
        "Balisage des voies de circulation et zones de dépôt.",
        "Stabilisation de base et empilement selon méthode convenue.",
      ],
      administratif: [
        "Rotation des tâches et pauses planifiées (prévenir TMS/fatigue).",
        "Binômes obligatoires; supervision active par le Responsable terrain.",
        "Briefing SST au début de chaque quart (risques + critères d’arrêt).",
        "Hydratation/échauffement et surveillance météo.",
      ],
      epi: [
        "Bottes antidérapantes imperméables",
        "Gants adaptés à la manutention",
        "Protection oculaire si projections",
        "Haute visibilité",
      ],
    },
    epiRequis: [
      "Casque (selon contexte et directives terrain)",
      "Bottes antidérapantes imperméables",
      "Gants de manutention",
      "Haute visibilité (dossard/veste)",
      "Protection oculaire (si projections)",
    ],
    formations: ["Camp de qualification RIUSC", "Rappels SST manutention/levage (briefing)"],
  },

  {
    id: 2,
    name: "SP — Dégagement d’accès par ébranchage (au sol uniquement)",
    org: "SOPFEU",
    description:
      "Dégagement ponctuel d’arbres/branches AU SOL bloquant chemins/accès pour permettre le passage de personnes ou véhicules d’urgence (dégagement opérationnel).",
    analyseRisque:
      "Risques de coupure/projection/rebond (kickback) et instabilité du bois sous tension. Terrain irrégulier et fatigue augmentent le risque d’erreur.",
    cotationInitiale: { G: 4, P: 2, R: 8 },
    cotationResiduelle: { G: 4, P: 1, R: 4 },
    limites: [
      "AU SOL uniquement — aucun abattage d’arbre debout.",
      "Aucun travail en hauteur; deux pieds au sol (pas d’escalade, pas d’échelle).",
      "Activité réservée aux personnes habilitées (outil motorisé).",
      "Refus si tension complexe ou environnement non contrôlable.",
    ],
    dangers: [
      "Coupure/lacération (outil manuel ou motorisé)",
      "Rebond (kickback) – perte de contrôle",
      "Bois sous tension (relâchement brusque)",
      "Projection de débris (atteinte oculaire/face)",
      "Chutes/trébuchements (terrain accidenté)",
      "Bruit et vibrations (fatigue, TMS)",
    ],
    controles: {
      elimination: [
        "Refus abattage d’arbre debout et tout travail en hauteur.",
        "Refus si proximité de lignes électriques / conditions météo défavorables.",
      ],
      substitution: ["Privilégier outils manuels lorsque possible et sécuritaire."],
      ingenierie: [
        "Balisage périmètre de sécurité; éloignement des observateurs.",
        "Positionnement stable; dégagement de l’aire de coupe.",
      ],
      administratif: [
        "Binôme obligatoire (jamais seul).",
        "Validation des habilitations avant affectation; briefing spécifique (tension du bois).",
        "Inspection outil avant usage; rotation opérateur/assistant.",
        "Critères d’arrêt (fatigue, visibilité, météo).",
      ],
      epi: [
        "Casque avec protection oculaire (visière/lunettes) + protection auditive si requis",
        "Gants adaptés",
        "Bottes robustes",
        "Vêtements de protection selon outil utilisé",
      ],
    },
    epiRequis: [
      "Casque + protection oculaire (visière/lunettes)",
      "Protection auditive (si outil motorisé)",
      "Gants",
      "Bottes robustes",
      "Haute visibilité",
      "Pantalon anti-coupure (si scie mécanique, selon standard applicable)",
    ],
    formations: ["Camp de qualification RIUSC", "Habilitation outil motorisé (si applicable)"],
  },

  {
    id: 3,
    name: "SP — Gestion des débris (dégagement opérationnel)",
    org: "SOPFEU",
    description:
      "Retrait ponctuel de débris qui nuisent à l’opération d’urgence afin de dégager un accès ou une zone de travail. Ne constitue pas une activité de nettoyage/rétablissement.",
    analyseRisque:
      "Manutention d’objets irréguliers, tranchants ou contaminés; risques de coupure, TMS, instabilité d’amas de débris et interaction avec équipements externes.",
    cotationInitiale: { G: 3, P: 3, R: 9 },
    cotationResiduelle: { G: 3, P: 2, R: 6 },
    limites: [
      "Dégagement d’accès uniquement (pas de nettoyage complet / rétablissement).",
      "Aucune opération de déblaiement lourd; pas de machinerie lourde opérée par réservistes.",
      "Refus d’intervention sous structure instable ou en zone non confirmée.",
      "Arrêt si présence de matières dangereuses non gérées par les autorités compétentes.",
    ],
    dangers: [
      "Coupures/perforations (clous, verre, métal)",
      "TMS (levage, postures, traction)",
      "Instabilité/écrasement (amas, objets)",
      "Contamination (moisissures, eaux souillées)",
      "Chutes/trébuchements (terrain encombré)",
    ],
    controles: {
      elimination: [
        "Refuser opérations de nettoyage/rétablissement et déblaiement lourd.",
        "Isoler et signaler matières dangereuses; ne pas manipuler sans protocole.",
      ],
      ingenierie: [
        "Délimiter zone de travail; voies de circulation sécurisées.",
        "Interdiction de proximité avec machinerie externe en mouvement.",
      ],
      administratif: [
        "Travail en équipe (≥2) + rotation; inspection visuelle avant manipulation.",
        "Consigne : ne pas tirer/soulever à l’aveugle; utiliser outils d’appoint (crochets/pinces) si dispo.",
        "Briefing SST (risques coupures/contamination) et critères d’arrêt.",
      ],
      epi: [
        "Gants anti-coupure",
        "Bottes robustes",
        "Protection oculaire",
        "Protection respiratoire selon poussières/contamination (au besoin)",
        "Haute visibilité",
      ],
    },
    epiRequis: [
      "Gants anti-coupure",
      "Bottes robustes",
      "Protection oculaire",
      "Masque (au besoin selon poussières/contamination)",
      "Haute visibilité",
      "Casque (si environnement instable / chute d’objets possible)",
    ],
    formations: ["Camp de qualification RIUSC", "Sensibilisation dangers/MD (niveau de base)"],
  },

  {
    id: 4,
    name: "SP — Reconnaissance du territoire (inspection extérieure)",
    org: "MIXTE",
    description:
      "Observation et documentation extérieure (photos/notes) de secteurs, accès et dommages en zone froide. Aucune entrée dans structures; repérage et transmission d’information.",
    analyseRisque:
      "Déplacements en terrain variable avec risques de chute, exposition météo et proximité de structures fragilisées. Charge cognitive et isolement relatif.",
    cotationInitiale: { G: 3, P: 3, R: 9 },
    cotationResiduelle: { G: 3, P: 2, R: 6 },
    limites: [
      "EXTÉRIEUR uniquement — interdiction d’entrer dans structures.",
      "Binôme obligatoire; périmètre et itinéraire définis.",
      "Maintien d’une distance sécuritaire des structures endommagées.",
      "Arrêt si conditions météo/visibilité rendent la progression dangereuse.",
    ],
    dangers: [
      "Chutes/trébuchements (boue, débris, terrain inégal)",
      "Proximité structures fragilisées (chute d’objets)",
      "Exposition météo (froid/chaleur/pluie)",
      "Désorientation/isolement relatif",
      "Stress/charge émotionnelle",
      "Insectes/plantes irritantes",
    ],
    controles: {
      elimination: [
        "Interdiction d’entrée en structure; rester hors périmètre dangereux.",
        "Refus de progression si visibilité réduite / terrain instable.",
      ],
      ingenierie: ["Itinéraire sécurisé; points de repère (GPS/carte) et balisage au besoin."],
      administratif: [
        "Binôme obligatoire; communications et check-in périodique.",
        "Briefing mission (périmètre, objectifs, critères d’arrêt).",
      ],
      epi: [
        "Bottes antidérapantes adaptées",
        "Haute visibilité",
        "Protection oculaire au besoin",
        "Casque si risque de chute d’objets dans le secteur",
      ],
    },
    epiRequis: [
      "Bottes adaptées terrain",
      "Haute visibilité",
      "Gants (au besoin)",
      "Casque (si risque local de chute d’objets)",
      "Vêtements adaptés météo",
      "Répulsif insectes (au besoin)",
    ],
    formations: ["Camp de qualification RIUSC", "Radio/GPS (selon rôle)"],
  },

  {
    id: 5,
    name: "CR — Soutien aux évacuations (porte-à-porte / assistance)",
    org: "CROIX-ROUGE",
    description:
      "Assistance à l’évacuation et au soutien aux personnes (incluant porte-à-porte, aide aux personnes vulnérables et support au transport), selon directives Croix-Rouge et autorités.",
    analyseRisque:
      "Exposition à détresse humaine, conflits possibles, fatigue et risques de chute. Sécurité personnelle et communications sont critiques.",
    cotationInitiale: { G: 3, P: 2, R: 6 },
    cotationResiduelle: { G: 3, P: 1, R: 3 },
    limites: [
      "Travail en binôme minimal; pas d’intervention isolée en domicile.",
      "Ne pas forcer l’entrée; escalade/conflict = référer (police/autorités).",
      "Respect des consignes de sécurité du Responsable terrain.",
    ],
    dangers: [
      "Conflit / agitation (violence verbale, intimidation)",
      "Charge émotionnelle (stress aigu, stress vicariant)",
      "Fatigue (marche, escaliers, quarts longs)",
      "Chutes/trébuchements (urgence, obstacles)",
      "Morsures (animaux stressés)",
      "Risque infectieux (contact rapproché)",
    ],
    controles: {
      elimination: [
        "Refuser l’intervention isolée; retrait immédiat si menace.",
        "Ne pas entrer si environnement non sécuritaire.",
      ],
      ingenierie: ["Itinéraire planifié; point de ralliement; zones d’attente sécurisées."],
      administratif: [
        "Binômes; communications radio/téléphone; check-in planifié.",
        "Formation de désescalade; consignes de posture sécuritaire (issue, distance).",
        "Rotation des tâches et pauses; débriefing.",
      ],
      epi: ["Haute visibilité", "Bottes adaptées", "Gants au besoin", "Masque selon situation sanitaire"],
    },
    epiRequis: ["Haute visibilité RIUSC", "Bottes adaptées", "Gants (au besoin)", "Masque (si requis)"],
    formations: ["Camp de qualification RIUSC", "Premiers secours (selon rôle)", "Désescalade / PSS (recommandé)"],
  },

  {
    id: 6,
    name: "SP/CR — Coordination des opérations (poste de coordination)",
    org: "MIXTE",
    description:
      "Support à la coordination logistique (communications, suivi équipes, liaison inter-organisations) en zone sécurisée, sous l’autorité du Responsable terrain.",
    analyseRisque:
      "Risque principalement ergonomique et psychosocial (stress, fatigue mentale) lié à la coordination d’urgence, avec périodes prolongées et surcharge informationnelle.",
    cotationInitiale: { G: 2, P: 3, R: 6 },
    cotationResiduelle: { G: 2, P: 2, R: 4 },
    limites: [
      "Zone sécurisée; déplacements terrain seulement si requis et autorisés.",
      "Relève planifiée (quarts max selon directives opérationnelles).",
    ],
    dangers: [
      "Stress élevé / pression décisionnelle",
      "Fatigue mentale, surcharge informationnelle",
      "Postures statiques prolongées (TMS)",
      "Fatigue visuelle/auditive (radios/écrans)",
      "Déshydratation/nutrition inadéquate (oubli pauses)",
    ],
    controles: {
      substitution: ["Procédures/checklists pour réduire charge mentale et variabilité."],
      ingenierie: ["Poste ergonomique (chaise, hauteur écran, éclairage) lorsque possible."],
      administratif: [
        "Pauses obligatoires; rotation/relève.",
        "Hydratation et collations accessibles; débriefing post-quart.",
        "Répartition des responsabilités (éviter surcharge d’une seule personne).",
      ],
      epi: ["Haute visibilité si déplacements", "Bottes robustes si déplacements terrain"],
    },
    epiRequis: ["Haute visibilité (si déplacements)", "Bottes robustes (si déplacements terrain)"],
    formations: ["Camp de qualification RIUSC", "ICS de base (recommandé)"],
  },

  {
    id: 7,
    name: "CR — Préparation des centres d’hébergement (installation)",
    org: "CROIX-ROUGE",
    description:
      "Installation et organisation d’espaces (lits de camp, tables, chaises) dans un centre d’hébergement temporaire, selon procédures Croix-Rouge.",
    analyseRisque:
      "Manutention légère à modérée et environnement intérieur; risques surtout de pincements, chutes/trébuchements et TMS mineurs.",
    cotationInitiale: { G: 2, P: 3, R: 6 },
    cotationResiduelle: { G: 2, P: 2, R: 4 },
    limites: ["Aucune installation électrique permanente; respecter procédures du site.", "Travail en équipe pour charges volumineuses."],
    dangers: [
      "TMS mineurs (dos/épaules)",
      "Chutes/trébuchements (encombrement temporaire)",
      "Pincements (pliage/dépliage)",
      "Fatigue légère",
    ],
    controles: {
      ingenierie: ["Circulation dégagée; zones de dépôt; éclairage adéquat si possible."],
      administratif: ["Travail en binômes; techniques de levage; rotation; pauses."],
      epi: ["Chaussures fermées", "Gants au besoin", "Haute visibilité si requis"],
    },
    epiRequis: ["Chaussures fermées", "Gants (au besoin)", "Haute visibilité (si requis)"],
    formations: ["Camp de qualification RIUSC"],
  },

  {
    id: 8,
    name: "CR — Soutien aux besoins essentiels (distribution)",
    org: "CROIX-ROUGE",
    description:
      "Distribution d’eau, nourriture, vêtements et articles d’hygiène aux personnes sinistrées en centre d’hébergement ou point de distribution.",
    analyseRisque:
      "Manutention légère, station debout prolongée et contact humain; risques sanitaires possibles et stress relationnel modéré.",
    cotationInitiale: { G: 2, P: 3, R: 6 },
    cotationResiduelle: { G: 2, P: 2, R: 4 },
    limites: ["Respect des directives sanitaires et procédures Croix-Rouge.", "Référer conflits/violence au Responsable terrain."],
    dangers: [
      "TMS légers (caisses/sacs)",
      "Chutes/trébuchements",
      "Fatigue (station debout)",
      "Risque infectieux (contact rapproché)",
      "Conflits occasionnels (stress des usagers)",
    ],
    controles: {
      ingenierie: ["Aménagement du poste (flux, espace, zones dépôt)."],
      administratif: [
        "Rotation des postes; pauses.",
        "Hygiène des mains; règles de distribution claires.",
        "Support superviseur CR; débriefing si incidents.",
      ],
      epi: ["Masque selon situation", "Hygiène mains", "Haute visibilité si requis"],
    },
    epiRequis: ["Masque (si requis)", "Haute visibilité (si requis)"],
    formations: ["Camp de qualification RIUSC", "Hygiène/salubrité de base (recommandé)"],
  },

  {
    id: 9,
    name: "CR — Réconfort et soutien moral",
    org: "CROIX-ROUGE",
    description:
      "Présence rassurante, écoute active et soutien de base aux personnes sinistrées en centre d’hébergement, selon pratiques Croix-Rouge.",
    analyseRisque:
      "Risque faible physiquement mais charge émotionnelle significative (stress vicariant, fatigue compassionnelle).",
    cotationInitiale: { G: 3, P: 2, R: 6 },
    cotationResiduelle: { G: 3, P: 1, R: 3 },
    limites: ["Le réserviste n’est pas thérapeute; référer les cas complexes.", "Rotation pour limiter l’exposition émotionnelle."],
    dangers: [
      "Stress vicariant / fatigue compassionnelle",
      "Épuisement émotionnel",
      "Situations verbalement difficiles",
      "Fatigue (quarts longs)",
    ],
    controles: {
      administratif: [
        "Rotation tâches; pauses et limites d’exposition.",
        "Débriefing quotidien; mécanisme de soutien psychosocial.",
        "Encadrement par superviseur CR; référer situations complexes.",
      ],
      epi: ["Aucun spécifique; mesures organisationnelles prioritaires"],
    },
    epiRequis: ["Haute visibilité (si requis)"],
    formations: ["Camp de qualification RIUSC", "Premiers secours psychologiques (recommandé)"],
  },

  {
    id: 10,
    name: "CR — Suivi des clientèles vulnérables",
    org: "CROIX-ROUGE",
    description:
      "Vérifications régulières auprès des personnes vulnérables (aînés, mobilité réduite, besoins médicaux) pour assurer que les besoins essentiels sont couverts.",
    analyseRisque:
      "Risque surtout psychosocial (responsabilité, charge émotionnelle) et organisationnel; nécessité de référer rapidement aux professionnels.",
    cotationInitiale: { G: 3, P: 2, R: 6 },
    cotationResiduelle: { G: 3, P: 1, R: 3 },
    limites: [
      "Référer tout enjeu médical aux ressources compétentes (ne pas dépasser son champ).",
      "Check-list structurée; consigner alertes au Responsable terrain.",
    ],
    dangers: [
      "Stress (responsabilité élevée)",
      "Charge émotionnelle",
      "Situations médicales urgentes (réaction, coordination)",
      "Fatigue compassionnelle",
    ],
    controles: {
      administratif: [
        "Procédure de référence claire (santé/CR) + check-list.",
        "Travail en binômes; pauses et rotation.",
        "Débriefing; support psychosocial si requis.",
      ],
      epi: ["Masque selon contexte sanitaire", "Hygiène des mains"],
    },
    epiRequis: ["Masque (si requis)"],
    formations: ["Camp de qualification RIUSC", "PSS (recommandé)"],
  },

  {
    id: 11,
    name: "SP — Soutien logistique SOPFEU (terrain)",
    org: "SOPFEU",
    description:
      "Soutien logistique en zone froide : transport de matériel léger/modéré, installation d’équipements temporaires, ravitaillement et tâches connexes sous supervision SOPFEU.",
    analyseRisque:
      "Risques liés à la manutention, au déplacement sur terrain variable et à la coactivité avec véhicules/équipements. Principalement gérable par organisation du site et supervision.",
    cotationInitiale: { G: 3, P: 3, R: 9 },
    cotationResiduelle: { G: 3, P: 2, R: 6 },
    limites: [
      "Aucune machinerie lourde opérée par les réservistes.",
      "Respect des couloirs piétons / zones véhicules.",
      "Arrêt si zone non sécurisée ou coactivité non contrôlée.",
    ],
    dangers: [
      "TMS (transport/levage)",
      "Chutes/trébuchements",
      "Circulation véhicules (camions, VTT) – coactivité",
      "Chute d’objets / coincement",
      "Exposition météo",
    ],
    controles: {
      ingenierie: ["Délimiter zones piétons/véhicules; aire de dépôt stable; signalisation."],
      administratif: [
        "Travail en binômes; rotation; levage sécuritaire; ne pas soulever seul charge excessive.",
        "Briefing SST; supervision SOPFEU; communications radio.",
      ],
      epi: ["Haute visibilité", "Gants", "Bottes robustes", "Protection oculaire au besoin", "Casque si risque chute d’objets"],
    },
    epiRequis: ["Haute visibilité", "Gants", "Bottes robustes", "Protection oculaire (au besoin)", "Casque (au besoin)"],
    formations: ["Camp de qualification RIUSC", "Briefing radio/sécurité SOPFEU"],
  },
];

const ORG_CONFIG = {
  SOPFEU: { label: "SOPFEU", bg: "#fef3c7", color: "#92400e" },
  "CROIX-ROUGE": { label: "Croix-Rouge", bg: "#fef2f2", color: "#dc2626" },
  MIXTE: { label: "Mixte", bg: "#dbeafe", color: "#1e40af" },
};

const Section = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginTop: 16 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "8px 0",
          fontSize: 14,
          fontWeight: 600,
          color: "#1e3a5f",
          textAlign: "left",
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#6b7280"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{
            transition: "transform 0.2s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            flexShrink: 0,
          }}
        >
          <path d="M19 9l-7 7-7-7" />
        </svg>
        {title}
      </button>
      {open && <div style={{ paddingLeft: 4, paddingTop: 4 }}>{children}</div>}
    </div>
  );
};

const FicheTache = ({ tache, isOpen, onToggle, id }) => {
  const org = ORG_CONFIG[tache.org];
  const riskLevel = riskLevelFromR(tache.cotationInitiale?.R ?? 0);
  const risk = RISK_CONFIG[riskLevel];

  const renderDots = (items, dotColor) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {(items ?? []).map((x, i) => (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 10,
            fontSize: 14,
            color: "#374151",
            lineHeight: 1.5,
          }}
        >
          <span style={{ color: dotColor, fontSize: 8, marginTop: 6, flexShrink: 0 }}>●</span>
          {x}
        </div>
      ))}
    </div>
  );

  return (
    <div
      id={id}
      style={{
        backgroundColor: "white",
        borderRadius: 12,
        border: isOpen ? "2px solid #1e3a5f" : "1px solid #e5e7eb",
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
        transition: "all 0.2s",
        overflow: "hidden",
      }}
    >
      <button
        onClick={onToggle}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "18px 20px",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
        onMouseOver={(e) => {
          if (!isOpen) e.currentTarget.parentElement.style.borderColor = "#1e3a5f";
        }}
        onMouseOut={(e) => {
          if (!isOpen) e.currentTarget.parentElement.style.borderColor = "#e5e7eb";
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: "#1e3a5f",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {tache.name}
          </div>
          <div
            style={{
              fontSize: 13,
              color: "#6b7280",
              marginTop: 3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {tache.description}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span
            style={{
              padding: "4px 12px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 600,
              backgroundColor: org.bg,
              color: org.color,
            }}
          >
            {org.label}
          </span>
          <span
            style={{
              padding: "4px 12px",
              borderRadius: 20,
              fontSize: 12,
              fontWeight: 700,
              backgroundColor: risk.bg,
              color: risk.color,
              border: `1px solid ${risk.border}`,
            }}
            title="R = G × P (matrice 4×4)"
          >
            {riskLevel} (R={tache.cotationInitiale.R})
          </span>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#6b7280"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div style={{ padding: "0 20px 24px 20px", borderTop: "1px solid #e5e7eb" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20 }}>
            <div
              style={{
                backgroundColor: "#f0f4f8",
                borderLeft: "4px solid #2c5aa0",
                padding: "14px 16px",
                borderRadius: "0 8px 8px 0",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#1e3a5f",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: 6,
                }}
              >
                Description
              </div>
              <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>{tache.description}</div>
            </div>
            <div
              style={{
                backgroundColor: risk.bg,
                borderLeft: `4px solid ${risk.border}`,
                padding: "14px 16px",
                borderRadius: "0 8px 8px 0",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: risk.color,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  marginBottom: 6,
                }}
              >
                Analyse de risque — {riskLevel} (R={tache.cotationInitiale.R})
              </div>
              <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>{tache.analyseRisque}</div>
            </div>
          </div>

          {/* Cotation + limites */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
            <div style={{ backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1e3a5f", marginBottom: 8 }}>
                Cotation (Matrice 4×4) — Note : R = G × P
              </div>
              <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.7 }}>
                <div>
                  <b>Initiale</b> : G={tache.cotationInitiale.G}, P={tache.cotationInitiale.P}, R={tache.cotationInitiale.R}
                </div>
                {tache.cotationResiduelle && (
                  <div>
                    <b>Résiduelle</b> : G={tache.cotationResiduelle.G}, P={tache.cotationResiduelle.P}, R={tache.cotationResiduelle.R}
                  </div>
                )}
              </div>
            </div>

            <div style={{ backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1e3a5f", marginBottom: 8 }}>
                Limites d’intervention (RIUSC)
              </div>
              {renderDots(tache.limites, "#6b7280")}
            </div>
          </div>

          <Section title="Dangers identifiés" defaultOpen={true}>
            {renderDots(tache.dangers, risk.color)}
          </Section>

          <Section title="Mesures de prévention (hiérarchie des contrôles)" defaultOpen={true}>
            {["elimination", "substitution", "ingenierie", "administratif", "epi"].map((k) => {
              const label = {
                elimination: "Élimination",
                substitution: "Substitution",
                ingenierie: "Mesures techniques (ingénierie)",
                administratif: "Mesures administratives",
                epi: "ÉPI",
              }[k];

              const items = tache.controles?.[k] ?? [];
              if (!items.length) return null;

              return (
                <div key={k} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#1e3a5f", marginBottom: 6 }}>{label}</div>
                  {renderDots(items, "#16a34a")}
                </div>
              );
            })}
          </Section>

          <Section title="Équipement de protection individuelle (ÉPI)">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 4 }}>
              {tache.epiRequis.map((epi, i) => (
                <span
                  key={i}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 6,
                    fontSize: 13,
                    backgroundColor: "#f9fafb",
                    color: "#374151",
                    border: "1px solid #e5e7eb",
                    fontWeight: 500,
                  }}
                >
                  {epi}
                </span>
              ))}
            </div>
          </Section>

          <Section title="Formations requises">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 4 }}>
              {tache.formations.map((f, i) => (
                <span
                  key={i}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 6,
                    fontSize: 13,
                    backgroundColor: "#f0f4f8",
                    color: "#1e3a5f",
                    border: "1px solid #d1dce8",
                    fontWeight: 600,
                  }}
                >
                  {f}
                </span>
              ))}
            </div>
          </Section>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #e5e7eb", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16 }}>📋</span>
            <span style={{ fontSize: 14, color: "#9ca3af", fontStyle: "italic" }}>
              Référence : Programme SST RIUSC (v7.x) — Responsable terrain = Chef d’équipe SOPFEU / Coordinateur Croix-Rouge
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default function FichesTachesRIUSC() {
  const [openId, setOpenId] = useState(null);
  const [filterOrg, setFilterOrg] = useState("TOUS");
  const [filterRisk, setFilterRisk] = useState("TOUS");
  const searchParams = useSearchParams();

  useEffect(() => {
    const tacheParam = searchParams.get("tache");
    if (tacheParam) {
      const match = TACHES.find((t) =>
        t.name.toLowerCase().includes(tacheParam.toLowerCase()) ||
        tacheParam.toLowerCase().includes(t.name.split("—").pop().trim().toLowerCase())
      );
      if (match) {
        setOpenId(match.id);
        setTimeout(() => {
          const el = document.getElementById(`fiche-${match.id}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      }
    }
  }, [searchParams]);

  const filtered = TACHES.filter((t) => {
    if (filterOrg !== "TOUS" && t.org !== filterOrg) return false;
    if (filterRisk !== "TOUS") {
      const lvl = riskLevelFromR(t.cotationInitiale?.R ?? 0);
      if (lvl !== filterRisk) return false;
    }
    return true;
  });

  const FilterBtn = ({ label, active, onClick }) => (
    <button
      onClick={onClick}
      style={{
        padding: "8px 16px",
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 500,
        border: active ? "1px solid #1e3a5f" : "1px solid #d1d5db",
        backgroundColor: active ? "#1e3a5f" : "white",
        color: active ? "white" : "#374151",
        cursor: "pointer",
        transition: "all 0.2s",
      }}
    >
      {label}
    </button>
  );

  return (
    <div>
      {/* Bandeau préliminaire */}
      <div
        style={{
          backgroundColor: "#fffbeb",
          border: "1px solid #fcd34d",
          borderRadius: 8,
          padding: "20px",
          marginBottom: 24,
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 24 }}>⚠️</span>
        <div>
          <p style={{ margin: "0 0 8px 0", fontWeight: 600, color: "#92400e", fontSize: 15 }}>
            Document préliminaire — Ne pas utiliser en contexte opérationnel
          </p>
          <p style={{ margin: 0, color: "#78350f", fontSize: 14, lineHeight: 1.6 }}>
            Ces fiches de tâches sont en cours de rédaction et de validation. Le contenu, les analyses de risque et les mesures de prévention
            sont sujets à modification. Référence : Programme SST RIUSC (v7.x).
          </p>
        </div>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 8px 0", fontSize: 18, fontWeight: 600, color: "#1e3a5f" }}>Fiches de tâches RIUSC</h3>
        <p style={{ margin: 0, fontSize: 14, color: "#6b7280", lineHeight: 1.5 }}>
          {TACHES.length} tâches disponibles — Cliquez sur une tâche pour consulter la fiche complète.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 20, marginBottom: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Organisme
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <FilterBtn label="Tous" active={filterOrg === "TOUS"} onClick={() => setFilterOrg("TOUS")} />
            <FilterBtn label="SOPFEU" active={filterOrg === "SOPFEU"} onClick={() => setFilterOrg("SOPFEU")} />
            <FilterBtn label="Croix-Rouge" active={filterOrg === "CROIX-ROUGE"} onClick={() => setFilterOrg("CROIX-ROUGE")} />
            <FilterBtn label="Mixte" active={filterOrg === "MIXTE"} onClick={() => setFilterOrg("MIXTE")} />
          </div>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Niveau de risque (R=G×P)
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <FilterBtn label="Tous" active={filterRisk === "TOUS"} onClick={() => setFilterRisk("TOUS")} />
            <FilterBtn label="Critique" active={filterRisk === "Critique"} onClick={() => setFilterRisk("Critique")} />
            <FilterBtn label="Élevé" active={filterRisk === "Élevé"} onClick={() => setFilterRisk("Élevé")} />
            <FilterBtn label="Modéré" active={filterRisk === "Modéré"} onClick={() => setFilterRisk("Modéré")} />
            <FilterBtn label="Faible" active={filterRisk === "Faible"} onClick={() => setFilterRisk("Faible")} />
          </div>
        </div>
      </div>

      {/* Task cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map((tache) => (
          <FicheTache
            key={tache.id}
            id={`fiche-${tache.id}`}
            tache={tache}
            isOpen={openId === tache.id}
            onToggle={() => setOpenId(openId === tache.id ? null : tache.id)}
          />
        ))}
        {filtered.length === 0 && (
          <div
            style={{
              padding: "40px 20px",
              backgroundColor: "#f9fafb",
              borderRadius: 8,
              textAlign: "center",
              color: "#9ca3af",
              fontSize: 14,
            }}
          >
            Aucune tâche ne correspond aux filtres sélectionnés.
          </div>
        )}
      </div>
    </div>
  );
}
