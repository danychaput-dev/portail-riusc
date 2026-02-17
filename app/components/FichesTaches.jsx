"use client";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

/* =============================
   RISQUE (R = G x P)
============================= */
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

const ORG_CONFIG = {
  SOPFEU: { label: "SP", full: "SOPFEU", bg: "#fef3c7", color: "#92400e" },
  "CROIX-ROUGE": { label: "CR", full: "Croix-Rouge", bg: "#fef2f2", color: "#dc2626" },
  MIXTE: { label: "Mixte", full: "Intervention conjointe SOPFEU / Croix-Rouge", bg: "#dbeafe", color: "#1e40af" },
};

/* =============================
   TOOLTIP (simple via title)
============================= */
const TT = ({ title, children }) => (
  <span title={title} style={{ cursor: "help" }}>
    {children}
  </span>
);

/* =============================
   DONNÉES — 11 TÂCHES (alignées)
============================= */
const TACHES = [
  {
    id: 1,
    name: "SP — Protection d’infrastructures (digues temporaires)",
    org: "SOPFEU",
    description:
      "Remplissage, transport et empilement de sacs et matériaux temporaires pour renforcer une berge/digue en phase d’urgence (zone froide confirmée).",
    analyseRisque:
      "Manutention répétée, terrain humide/instable, fatigue et pression opérationnelle augmentent le risque de TMS et de chute.",
    cotationInitiale: { G: 3, P: 3, R: 9 },
    cotationResiduelle: { G: 3, P: 2, R: 6 },
    limites: [
      "Phase d’urgence uniquement (aucun rétablissement/nettoyage complet).",
      "Zone froide confirmée avant le début des travaux.",
      "Aucune machinerie lourde opérée par les réservistes.",
      "Arrêt immédiat si instabilité/montée des eaux/visibilité insuffisante.",
    ],
    dangers: [
      "TMS (dos, épaules, genoux) – levage/postures",
      "Glissades/chutes (boue/eau/obstacles)",
      "Fatigue thermique (chaleur/froid), déshydratation/hypothermie",
      "Effondrement/instabilité d’un empilement temporaire",
      "Stress, baisse de vigilance",
    ],
    controles: {
      elimination: [
        "Refuser toute intervention hors zone froide ou sans validation terrain.",
        "Interrompre si montée des eaux / instabilité / visibilité réduite.",
      ],
      ingenierie: ["Balisage des voies de circulation et zones de dépôt.", "Organisation de l’aire de travail (accès, empilement)."],
      administratif: [
        "Rotation des tâches + pauses planifiées.",
        "Binômes obligatoires + supervision active.",
        "Briefing SST en début de quart (risques + critères d’arrêt).",
        "Hydratation et surveillance météo.",
      ],
      epi: ["Bottes antidérapantes imperméables", "Gants de manutention", "Haute visibilité", "Protection oculaire si projections"],
    },
    epiRequis: ["Bottes antidérapantes imperméables", "Gants", "Haute visibilité", "Protection oculaire (au besoin)", "Casque (selon contexte)"],
    formations: ["Camp de qualification RIUSC", "Briefing SST manutention (sur place)"],
  },

  {
    id: 2,
    name: "SP — Dégagement d’accès par ébranchage (au sol uniquement)",
    org: "SOPFEU",
    description:
      "Dégagement ponctuel d’arbres/branches AU SOL bloquant des accès afin de permettre le passage de personnes/véhicules d’urgence (dégagement opérationnel).",
    analyseRisque:
      "Risque de coupure/projection et d’instabilité du bois sous tension. La fatigue et le terrain irrégulier augmentent le risque d’erreur.",
    cotationInitiale: { G: 4, P: 2, R: 8 },
    cotationResiduelle: { G: 4, P: 1, R: 4 },
    limites: [
      "AU SOL uniquement — aucun abattage d’arbre debout.",
      "Deux pieds au sol — aucun travail en hauteur (pas d’échelle, pas d’escalade).",
      "Activité réservée aux personnes habilitées à l’outil requis.",
      "Refus si tension complexe ou environnement non contrôlable.",
    ],
    dangers: [
      "Coupures/lacérations (outil manuel/motorisé)",
      "Rebond (kickback) et perte de contrôle",
      "Bois sous tension (relâchement brusque)",
      "Projection de débris (atteinte oculaire)",
      "Chutes/trébuchements (terrain accidenté)",
      "Bruit/vibrations (fatigue, TMS)",
    ],
    controles: {
      elimination: ["Refus abattage et travail en hauteur.", "Refus près de lignes électriques / météo défavorable."],
      substitution: ["Privilégier outils manuels si possible et sécuritaire."],
      ingenierie: ["Balisage périmètre de sécurité.", "Aire de coupe dégagée et stable."],
      administratif: ["Binôme obligatoire.", "Inspection outil; rotation; critères d’arrêt (fatigue/visibilité/météo).", "Briefing tension du bois."],
      epi: ["Casque + protection oculaire", "Protection auditive (si requis)", "Gants", "Bottes robustes", "Haute visibilité"],
    },
    epiRequis: ["Casque + protection oculaire", "Protection auditive (si requis)", "Gants", "Bottes robustes", "Haute visibilité"],
    formations: ["Camp de qualification RIUSC", "Habilitation outil (si requis)"],
  },

  {
    id: 3,
    name: "SP — Gestion des débris (dégagement opérationnel)",
    org: "SOPFEU",
    description:
      "Retrait ponctuel de débris qui nuisent à l’opération d’urgence afin de dégager un accès/zone de travail. Pas une activité de nettoyage/rétablissement.",
    analyseRisque:
      "Objets tranchants/irréguliers, risque de coupure, TMS, instabilité d’amas de débris et contamination possible.",
    cotationInitiale: { G: 3, P: 3, R: 9 },
    cotationResiduelle: { G: 3, P: 2, R: 6 },
    limites: [
      "Dégagement d’accès uniquement (pas de nettoyage complet / rétablissement).",
      "Aucun déblaiement lourd; pas de machinerie lourde opérée par réservistes.",
      "Refus sous structures instables ou zone non confirmée.",
      "Isoler et signaler matières dangereuses; ne pas manipuler sans protocole.",
    ],
    dangers: [
      "Coupures/perforations (clous, verre, métal)",
      "TMS (levage, postures, traction)",
      "Écrasement/instabilité (amas, objets)",
      "Contamination (moisissures, eaux souillées)",
      "Chutes/trébuchements (terrain encombré)",
    ],
    controles: {
      elimination: ["Refuser nettoyage/rétablissement.", "Isoler matières dangereuses; référer autorités compétentes."],
      ingenierie: ["Délimiter zone; voies sécurisées; éloignement machinerie externe."],
      administratif: ["Équipe (≥2) + rotation.", "Inspection visuelle avant manipulation; outils d’appoint si dispo.", "Briefing SST + critères d’arrêt."],
      epi: ["Gants anti-coupure", "Bottes robustes", "Protection oculaire", "Masque (au besoin)", "Haute visibilité"],
    },
    epiRequis: ["Gants anti-coupure", "Bottes robustes", "Protection oculaire", "Masque (au besoin)", "Haute visibilité", "Casque (au besoin)"],
    formations: ["Camp de qualification RIUSC", "Sensibilisation dangers/MD (base)"],
  },

  {
    id: 4,
    name: "Mixte — Reconnaissance du territoire (inspection extérieure)",
    org: "MIXTE",
    description:
      "Observation/documentation extérieure (photos/notes) de secteurs, accès et dommages en zone froide. Interdiction d’entrée dans structures.",
    analyseRisque:
      "Déplacements terrain variable, météo, proximité de structures fragilisées. Charge cognitive/isolement relatif.",
    cotationInitiale: { G: 3, P: 3, R: 9 },
    cotationResiduelle: { G: 3, P: 2, R: 6 },
    limites: [
      "EXTÉRIEUR uniquement — interdiction d’entrer dans structures.",
      "Binôme obligatoire + itinéraire/périmètre définis.",
      "Distance sécuritaire des structures endommagées.",
    ],
    dangers: [
      "Chutes/trébuchements (boue, débris)",
      "Chute d’objets (proximité structure)",
      "Exposition météo (froid/chaleur/pluie)",
      "Désorientation/isolement",
      "Insectes/plantes irritantes",
      "Stress/charge émotionnelle",
    ],
    controles: {
      elimination: ["Interdiction d’entrée en structure.", "Refus si visibilité réduite/terrain instable."],
      ingenierie: ["GPS/carte; points de repère; balisage au besoin."],
      administratif: ["Binôme + communications + check-in périodique.", "Briefing mission (objectifs/critères d’arrêt)."],
      epi: ["Bottes antidérapantes", "Haute visibilité", "Casque si risque chute d’objets (au besoin)"],
    },
    epiRequis: ["Bottes adaptées", "Haute visibilité", "Vêtements météo", "Casque (au besoin)", "Répulsif (au besoin)"],
    formations: ["Camp de qualification RIUSC", "Radio/GPS (selon rôle)"],
  },

  {
    id: 5,
    name: "CR — Soutien aux évacuations (porte-à-porte / assistance)",
    org: "CROIX-ROUGE",
    description:
      "Assistance à l’évacuation et au soutien aux personnes, selon directives Croix-Rouge et autorités (binômes, sécurité personnelle).",
    analyseRisque:
      "Exposition à détresse humaine, conflits possibles, fatigue et risques de chute. Communications et encadrement sont critiques.",
    cotationInitiale: { G: 3, P: 2, R: 6 },
    cotationResiduelle: { G: 3, P: 1, R: 3 },
    limites: [
      "Binôme minimal; pas d’intervention isolée.",
      "Ne pas forcer l’entrée; conflit/violence = retrait et référer autorités.",
      "Respect des consignes du Responsable terrain.",
    ],
    dangers: [
      "Conflit/agressivité (verbale/intimidation)",
      "Charge émotionnelle (stress aigu/vicariant)",
      "Fatigue (marche, escaliers, quarts longs)",
      "Chutes/trébuchements (obstacles)",
      "Morsures (animaux stressés)",
      "Risque infectieux (contact rapproché)",
    ],
    controles: {
      elimination: ["Refuser intervention isolée; retrait si menace.", "Ne pas entrer si environnement non sécuritaire."],
      ingenierie: ["Itinéraire planifié; point ralliement; zones d’attente sécurisées."],
      administratif: ["Binômes + check-in.", "Désescalade (recommandée).", "Rotation + pauses + débriefing."],
      epi: ["Haute visibilité", "Bottes adaptées", "Masque selon contexte"],
    },
    epiRequis: ["Haute visibilité RIUSC", "Bottes adaptées", "Masque (si requis)", "Gants (au besoin)"],
    formations: ["Camp de qualification RIUSC", "PSS / désescalade (recommandé)", "Premiers secours (selon rôle)"],
  },

  {
    id: 6,
    name: "Mixte — Coordination des opérations (poste de coordination)",
    org: "MIXTE",
    description:
      "Support coordination logistique (communications, suivi équipes, liaison inter-organisations) en zone sécurisée, sous l’autorité du Responsable terrain.",
    analyseRisque:
      "Risque surtout ergonomique et psychosocial : stress, surcharge informationnelle, fatigue mentale, postures statiques.",
    cotationInitiale: { G: 2, P: 3, R: 6 },
    cotationResiduelle: { G: 2, P: 2, R: 4 },
    limites: ["Relève planifiée; quarts conformes aux directives opérationnelles.", "Déplacements terrain seulement si requis/autorisé."],
    dangers: [
      "Stress/pression décisionnelle",
      "Fatigue mentale/surcharge info",
      "TMS (posture statique)",
      "Fatigue visuelle/auditive (radios/écrans)",
      "Déshydratation/nutrition inadéquate",
    ],
    controles: {
      substitution: ["Checklists/procédures pour réduire variabilité."],
      ingenierie: ["Poste ergonomique (si possible)."],
      administratif: ["Pauses obligatoires; rotation/relève.", "Hydratation/collations accessibles.", "Débriefing post-quart."],
      epi: ["Haute visibilité si déplacements", "Bottes robustes si déplacements terrain"],
    },
    epiRequis: ["Haute visibilité (si déplacements)", "Bottes robustes (si déplacements)"],
    formations: ["Camp de qualification RIUSC", "ICS de base (recommandé)"],
  },

  {
    id: 7,
    name: "CR — Préparation des centres d’hébergement (installation)",
    org: "CROIX-ROUGE",
    description:
      "Installation et organisation d’espaces (lits de camp, tables, chaises) dans un centre d’hébergement temporaire, selon procédures Croix-Rouge.",
    analyseRisque:
      "Manutention légère/modérée; risques de pincements, chutes/trébuchements et TMS mineurs.",
    cotationInitiale: { G: 2, P: 3, R: 6 },
    cotationResiduelle: { G: 2, P: 2, R: 4 },
    limites: ["Travail en équipe pour charges volumineuses.", "Respect procédures du site et Croix-Rouge."],
    dangers: ["TMS mineurs", "Chutes/trébuchements", "Pincements (pliage/dépliage)", "Fatigue légère"],
    controles: {
      ingenierie: ["Circulation dégagée; zones de dépôt; éclairage adéquat si possible."],
      administratif: ["Binômes; techniques de levage; rotation; pauses."],
      epi: ["Chaussures fermées", "Gants (au besoin)"],
    },
    epiRequis: ["Chaussures fermées", "Gants (au besoin)", "Haute visibilité (si requis)"],
    formations: ["Camp de qualification RIUSC"],
  },

  {
    id: 8,
    name: "CR — Soutien aux besoins essentiels (distribution)",
    org: "CROIX-ROUGE",
    description:
      "Distribution d’eau, nourriture, vêtements et articles d’hygiène aux sinistrés en centre d’hébergement ou point de distribution.",
    analyseRisque:
      "Station debout + contact humain; risques sanitaires possibles et stress relationnel modéré.",
    cotationInitiale: { G: 2, P: 3, R: 6 },
    cotationResiduelle: { G: 2, P: 2, R: 4 },
    limites: ["Respect des directives sanitaires et procédures Croix-Rouge.", "Référer conflits/violence au Responsable terrain."],
    dangers: ["TMS légers", "Chutes/trébuchements", "Fatigue (station debout)", "Risque infectieux", "Conflits occasionnels"],
    controles: {
      ingenierie: ["Aménagement du poste (flux, espace, zones dépôt)."],
      administratif: ["Rotation; pauses.", "Hygiène des mains.", "Support superviseur; débriefing si incident."],
      epi: ["Masque selon contexte", "Hygiène des mains"],
    },
    epiRequis: ["Masque (si requis)", "Haute visibilité (si requis)"],
    formations: ["Camp de qualification RIUSC", "Hygiène/salubrité (recommandé)"],
  },

  {
    id: 9,
    name: "CR — Réconfort et soutien moral",
    org: "CROIX-ROUGE",
    description:
      "Écoute active et soutien de base aux personnes sinistrées en centre d’hébergement, selon pratiques Croix-Rouge.",
    analyseRisque:
      "Risque faible physiquement mais charge émotionnelle significative (stress vicariant, fatigue compassionnelle).",
    cotationInitiale: { G: 3, P: 2, R: 6 },
    cotationResiduelle: { G: 3, P: 1, R: 3 },
    limites: ["Le réserviste n’est pas thérapeute; référer les cas complexes.", "Rotation pour limiter l’exposition émotionnelle."],
    dangers: ["Stress vicariant", "Fatigue compassionnelle", "Épuisement émotionnel", "Situations difficiles verbalement"],
    controles: {
      administratif: ["Rotation + pauses.", "Débriefing quotidien.", "Soutien psychosocial disponible.", "Encadrement superviseur CR."],
      epi: [],
    },
    epiRequis: ["Haute visibilité (si requis)"],
    formations: ["Camp de qualification RIUSC", "Premiers secours psychologiques (recommandé)"],
  },

  {
    id: 10,
    name: "CR — Suivi des clientèles vulnérables",
    org: "CROIX-ROUGE",
    description:
      "Vérifications auprès des personnes vulnérables en centre d’hébergement pour assurer que les besoins essentiels sont couverts et référer rapidement au besoin.",
    analyseRisque:
      "Risque surtout psychosocial/organisationnel (responsabilité, charge émotionnelle) et nécessité de référer aux professionnels.",
    cotationInitiale: { G: 3, P: 2, R: 6 },
    cotationResiduelle: { G: 3, P: 1, R: 3 },
    limites: ["Référer toute situation médicale aux ressources compétentes.", "Utiliser une check-list et consigner alertes au Responsable terrain."],
    dangers: ["Stress (responsabilité)", "Charge émotionnelle", "Situations médicales urgentes", "Fatigue compassionnelle"],
    controles: {
      administratif: ["Procédure de référence claire + check-list.", "Binômes; pauses; rotation.", "Débriefing; soutien psychosocial si requis."],
      epi: ["Masque selon contexte", "Hygiène des mains"],
    },
    epiRequis: ["Masque (si requis)"],
    formations: ["Camp de qualification RIUSC", "PSS (recommandé)"],
  },

  {
    id: 11,
    name: "SP — Soutien logistique SOPFEU (terrain)",
    org: "SOPFEU",
    description:
      "Soutien logistique en zone froide : transport matériel léger/modéré, installation d’équipements temporaires, ravitaillement, sous supervision SOPFEU.",
    analyseRisque:
      "Manutention, déplacements sur terrain variable et coactivité avec véhicules/équipements. Risques gérables par organisation du site et supervision.",
    cotationInitiale: { G: 3, P: 3, R: 9 },
    cotationResiduelle: { G: 3, P: 2, R: 6 },
    limites: ["Aucune machinerie lourde opérée par les réservistes.", "Respect des couloirs piétons/zones véhicules.", "Arrêt si coactivité non contrôlée."],
    dangers: ["TMS", "Chutes/trébuchements", "Coactivité véhicules", "Chute d’objets/coincement", "Exposition météo"],
    controles: {
      ingenierie: ["Délimiter zones piétons/véhicules; signalisation; aire de dépôt stable."],
      administratif: ["Binômes; rotation; levage sécuritaire; briefing SST; supervision SOPFEU; communications radio."],
      epi: ["Haute visibilité", "Gants", "Bottes robustes", "Protection oculaire (au besoin)", "Casque (au besoin)"],
    },
    epiRequis: ["Haute visibilité", "Gants", "Bottes robustes", "Protection oculaire (au besoin)", "Casque (au besoin)"],
    formations: ["Camp de qualification RIUSC", "Briefing radio/sécurité SOPFEU"],
  },
];

/* =============================
   UI — Section accordéon
============================= */
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
        <span style={{ width: 16, color: "#6b7280" }}>{open ? "▼" : "▶"}</span>
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

  const dots = (items, dotColor) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {(items ?? []).map((x, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "#374151", lineHeight: 1.5 }}>
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
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#1e3a5f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {tache.name}
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {tache.description}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <TT title={`${org.label} = ${org.full}`}>
            <span style={{ padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, backgroundColor: org.bg, color: org.color }}>
              {org.label}
            </span>
          </TT>

          <TT title="R = Gravité × Probabilité (matrice 4×4)">
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
            >
              {riskLevel} (R={tache.cotationInitiale.R})
            </span>
          </TT>

          <span style={{ color: "#6b7280" }}>{isOpen ? "▲" : "▼"}</span>
        </div>
      </button>

      {isOpen && (
        <div style={{ padding: "0 20px 24px 20px", borderTop: "1px solid #e5e7eb" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20 }}>
            <div style={{ backgroundColor: "#f0f4f8", borderLeft: "4px solid #2c5aa0", padding: "14px 16px", borderRadius: "0 8px 8px 0" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1e3a5f", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                Description
              </div>
              <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>{tache.description}</div>
            </div>

            <div style={{ backgroundColor: risk.bg, borderLeft: `4px solid ${risk.border}`, padding: "14px 16px", borderRadius: "0 8px 8px 0" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: risk.color, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
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
                  <TT title="Gravité"><b>G</b></TT>={tache.cotationInitiale.G} &nbsp;|&nbsp;{" "}
                  <TT title="Probabilité"><b>P</b></TT>={tache.cotationInitiale.P} &nbsp;|&nbsp;{" "}
                  <TT title="Risque = G×P"><b>R</b></TT>={tache.cotationInitiale.R}
                </div>
                {tache.cotationResiduelle && (
                  <div style={{ marginTop: 4 }}>
                    <b>Résiduelle</b> : G={tache.cotationResiduelle.G}, P={tache.cotationResiduelle.P}, R={tache.cotationResiduelle.R}
                  </div>
                )}
              </div>
            </div>

            <div style={{ backgroundColor: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, padding: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1e3a5f", marginBottom: 8 }}>
                Limites d’intervention (RIUSC)
              </div>
              {dots(tache.limites, "#6b7280")}
            </div>
          </div>

          <Section title="Dangers identifiés" defaultOpen={true}>
            {dots(tache.dangers, risk.color)}
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
                  {dots(items, "#16a34a")}
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
                    fontWeight: 600,
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
                    fontWeight: 700,
                  }}
                >
                  {f}
                </span>
              ))}
            </div>
          </Section>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #e5e7eb" }}>
            <span style={{ fontSize: 13, color: "#6b7280", fontStyle: "italic" }}>
              Responsable terrain : Chef d’équipe (SOPFEU) / Coordinateur (Croix-Rouge), selon l’organisation.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

/* =============================
   TABLEAU SYNTHÈSE (top)
============================= */
const TableauSynthese = ({ tasks, onOpen }) => {
  return (
    <div
      style={{
        backgroundColor: "white",
        border: "1px solid #e5e7eb",
        borderRadius: 12,
        overflow: "hidden",
        marginBottom: 16,
        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: 700, color: "#1e3a5f" }}>
        Tableau des tâches (synthèse)
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f9fafb", textAlign: "left" }}>
              <th style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}>ID</th>
              <th style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}>Tâche</th>
              <th style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}>Org</th>
              <th style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}>
                <TT title="R = G×P (matrice 4×4)">Risque</TT>
              </th>
              <th style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => {
              const org = ORG_CONFIG[t.org];
              const lvl = riskLevelFromR(t.cotationInitiale.R);
              const rk = RISK_CONFIG[lvl];
              return (
                <tr key={t.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 12px", color: "#374151" }}>{t.id}</td>
                  <td style={{ padding: "10px 12px", color: "#1e3a5f", fontWeight: 600 }}>{t.name}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <TT title={`${org.label} = ${org.full}`}>
                      <span style={{ padding: "2px 10px", borderRadius: 999, background: org.bg, color: org.color, fontWeight: 700 }}>
                        {org.label}
                      </span>
                    </TT>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <TT title="R = G×P (matrice 4×4)">
                      <span style={{ padding: "2px 10px", borderRadius: 999, background: rk.bg, color: rk.color, border: `1px solid ${rk.border}`, fontWeight: 800 }}>
                        {lvl} (R={t.cotationInitiale.R})
                      </span>
                    </TT>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <button
                      onClick={() => onOpen(t.id)}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 8,
                        border: "1px solid #d1d5db",
                        background: "white",
                        cursor: "pointer",
                        fontWeight: 600,
                        color: "#1e3a5f",
                      }}
                    >
                      Ouvrir
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

/* =============================
   PAGE PRINCIPALE
============================= */
export default function FichesTachesRIUSC() {
  const [openId, setOpenId] = useState(null);
  const [filterOrg, setFilterOrg] = useState("TOUS");
  const [filterRisk, setFilterRisk] = useState("TOUS");
  const searchParams = useSearchParams();

  useEffect(() => {
    const tacheParam = searchParams.get("tache");
    if (tacheParam) {
      const match = TACHES.find((t) => t.name.toLowerCase().includes(tacheParam.toLowerCase()));
      if (match) {
        setOpenId(match.id);
        setTimeout(() => {
          const el = document.getElementById(`fiche-${match.id}`);
          if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 100);
      }
    }
  }, [searchParams]);

  const filtered = useMemo(() => {
    return TACHES.filter((t) => {
      if (filterOrg !== "TOUS" && t.org !== filterOrg) return false;
      if (filterRisk !== "TOUS") {
        const lvl = riskLevelFromR(t.cotationInitiale?.R ?? 0);
        if (lvl !== filterRisk) return false;
      }
      return true;
    });
  }, [filterOrg, filterRisk]);

  const FilterBtn = ({ label, active, onClick }) => (
    <button
      onClick={onClick}
      style={{
        padding: "8px 16px",
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 700,
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

  const openFromTable = (id) => {
    setOpenId(id);
    setTimeout(() => {
      const el = document.getElementById(`fiche-${id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 80);
  };

  return (
    <div>
      {/* Bandeau + légende acronymes */}
      <div
        style={{
          backgroundColor: "#fffbeb",
          border: "1px solid #fcd34d",
          borderRadius: 10,
          padding: "20px",
          marginBottom: 18,
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
        }}
      >
        <span style={{ fontSize: 24 }}>⚠️</span>
        <div style={{ width: "100%" }}>
          <p style={{ margin: "0 0 8px 0", fontWeight: 800, color: "#92400e", fontSize: 15 }}>
            Document préliminaire — Ne pas utiliser en contexte opérationnel
          </p>
          <p style={{ margin: 0, color: "#78350f", fontSize: 14, lineHeight: 1.6 }}>
            Ces fiches de tâches sont en cours de rédaction et de validation. Le contenu, les analyses de risque et les mesures de prévention
            sont sujets à modification. Référence : Programme SST RIUSC (v7.x).
          </p>

          <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #fcd34d" }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: "#92400e", marginBottom: 6 }}>Légende — acronymes</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, fontSize: 13, color: "#78350f", lineHeight: 1.6 }}>
              <span><b>SP</b> : SOPFEU</span>
              <span>•</span>
              <span><b>CR</b> : Croix-Rouge</span>
              <span>•</span>
              <span><b>SST</b> : Santé et sécurité du travail</span>
              <span>•</span>
              <span><b>EPI</b> : Équipement de protection individuelle</span>
              <span>•</span>
              <span><b>G</b> : Gravité</span>
              <span>•</span>
              <span><b>P</b> : Probabilité</span>
              <span>•</span>
              <span><b>R</b> : Risque (G×P)</span>
              <span>•</span>
              <span><b>RIUSC</b> : Réserve d’intervention d’urgence en sécurité civile</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: "#7c2d12" }}>
              <b>Responsable terrain</b> : Chef d’équipe (SOPFEU) / Coordinateur (Croix-Rouge), selon l’organisation.
            </div>
          </div>
        </div>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 14 }}>
        <h3 style={{ margin: "0 0 6px 0", fontSize: 18, fontWeight: 800, color: "#1e3a5f" }}>Fiches de tâches RIUSC</h3>
        <p style={{ margin: 0, fontSize: 14, color: "#6b7280", lineHeight: 1.5 }}>
          {TACHES.length} tâches — Utilisez le tableau pour une vue synthèse, ou cliquez sur une carte pour le détail.
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 20, marginBottom: 16, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 800, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
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
          <div style={{ fontSize: 12, fontWeight: 800, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Niveau de risque
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

      {/* ✅ Tableau synthèse (ce que tu dis “le tableau”) */}
      <TableauSynthese tasks={filtered} onOpen={openFromTable} />

      {/* Cartes */}
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
          <div style={{ padding: "40px 20px", backgroundColor: "#f9fafb", borderRadius: 8, textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
            Aucune tâche ne correspond aux filtres sélectionnés.
          </div>
        )}
      </div>
    </div>
  );
}
