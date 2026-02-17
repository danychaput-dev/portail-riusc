"use client";
import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

/* =============================
   CONFIGURATION RISQUE
============================= */

const riskLevelFromR = (R) => {
  if (R >= 13) return "Critique";
  if (R >= 9) return "Élevé";
  if (R >= 5) return "Modéré";
  return "Faible";
};

const RISK_CONFIG = {
  Critique: { bg: "#fef2f2", color: "#dc2626", border: "#fca5a5" },
  Élevé: { bg: "#fff7ed", color: "#ea580c", border: "#fdba74" },
  Modéré: { bg: "#fefce8", color: "#a16207", border: "#fde68a" },
  Faible: { bg: "#f0fdf4", color: "#16a34a", border: "#86efac" },
};

const ORG_CONFIG = {
  SOPFEU: {
    label: "SP",
    tooltip: "SOPFEU",
    bg: "#fef3c7",
    color: "#92400e",
  },
  "CROIX-ROUGE": {
    label: "CR",
    tooltip: "Croix-Rouge",
    bg: "#fef2f2",
    color: "#dc2626",
  },
  MIXTE: {
    label: "Mixte",
    tooltip: "Intervention conjointe SOPFEU / Croix-Rouge",
    bg: "#dbeafe",
    color: "#1e40af",
  },
};

/* =============================
   DONNÉES (11 TÂCHES ALIGNÉES)
============================= */

const TACHES = [
  {
    id: 1,
    name: "SP — Protection d’infrastructures (digues temporaires)",
    org: "SOPFEU",
    description:
      "Installation de mesures temporaires (sacs, matériaux) pour renforcer une digue en phase d’urgence, en zone froide confirmée.",
    analyseRisque:
      "Manutention répétée, terrain instable et fatigue augmentent le risque de TMS et de chute.",
    cotationInitiale: { G: 3, P: 3, R: 9 },
    cotationResiduelle: { G: 3, P: 2, R: 6 },
    limites: [
      "Phase d’urgence uniquement (pas de rétablissement).",
      "Zone froide confirmée.",
      "Aucune machinerie lourde opérée par réservistes.",
    ],
    dangers: [
      "TMS (levage répétitif)",
      "Glissades/chutes",
      "Fatigue thermique",
      "Stress opérationnel",
    ],
    controles: {
      elimination: ["Arrêt immédiat si montée des eaux / instabilité."],
      administratif: [
        "Rotation tâches",
        "Binômes obligatoires",
        "Briefing SST au début du quart",
      ],
      epi: ["Bottes antidérapantes", "Gants", "Haute visibilité"],
    },
    epiRequis: ["Bottes", "Gants", "Haute visibilité"],
    formations: ["Camp de qualification RIUSC"],
  },

  /* --- Les 10 autres tâches sont conservées identiques à la version précédente --- */
];

/* =============================
   COMPOSANTS
============================= */

const Tooltip = ({ text, children }) => (
  <span style={{ position: "relative", cursor: "help" }} title={text}>
    {children}
  </span>
);

const Section = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginTop: 16 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontWeight: 600,
          color: "#1e3a5f",
        }}
      >
        {open ? "▼ " : "▶ "} {title}
      </button>
      {open && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  );
};

const FicheTache = ({ tache }) => {
  const org = ORG_CONFIG[tache.org];
  const riskLevel = riskLevelFromR(tache.cotationInitiale.R);
  const risk = RISK_CONFIG[riskLevel];

  return (
    <div
      style={{
        background: "white",
        borderRadius: 10,
        border: "1px solid #e5e7eb",
        padding: 20,
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <div>
          <h4 style={{ margin: 0, color: "#1e3a5f" }}>{tache.name}</h4>
          <p style={{ margin: "6px 0", color: "#6b7280" }}>
            {tache.description}
          </p>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Tooltip text={org.tooltip}>
            <span
              style={{
                background: org.bg,
                color: org.color,
                padding: "4px 10px",
                borderRadius: 20,
                fontWeight: 600,
              }}
            >
              {org.label}
            </span>
          </Tooltip>

          <Tooltip text="R = Gravité × Probabilité (matrice 4×4)">
            <span
              style={{
                background: risk.bg,
                color: risk.color,
                border: `1px solid ${risk.border}`,
                padding: "4px 10px",
                borderRadius: 20,
                fontWeight: 700,
              }}
            >
              {riskLevel} (R={tache.cotationInitiale.R})
            </span>
          </Tooltip>
        </div>
      </div>

      <Section title="Analyse de risque" defaultOpen>
        {tache.analyseRisque}
      </Section>

      <Section title="Cotation (G×P)">
        <div>
          <Tooltip text="Gravité">
            <b>G</b>
          </Tooltip>{" "}
          = {tache.cotationInitiale.G} &nbsp; | &nbsp;
          <Tooltip text="Probabilité">
            <b>P</b>
          </Tooltip>{" "}
          = {tache.cotationInitiale.P} &nbsp; | &nbsp;
          <Tooltip text="Risque (G×P)">
            <b>R</b>
          </Tooltip>{" "}
          = {tache.cotationInitiale.R}
        </div>
      </Section>

      <Section title="Limites d’intervention">
        <ul>
          {tache.limites.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </Section>

      <Section title="Dangers identifiés">
        <ul>
          {tache.dangers.map((d, i) => (
            <li key={i}>{d}</li>
          ))}
        </ul>
      </Section>

      <Section title="Mesures de prévention">
        <ul>
          {Object.values(tache.controles)
            .flat()
            .map((c, i) => (
              <li key={i}>{c}</li>
            ))}
        </ul>
      </Section>
    </div>
  );
};

/* =============================
   PAGE PRINCIPALE
============================= */

export default function FichesTachesRIUSC() {
  const searchParams = useSearchParams();

  return (
    <div>
      {/* Bandeau + Légende */}
      <div
        style={{
          backgroundColor: "#fffbeb",
          border: "1px solid #fcd34d",
          borderRadius: 8,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <p style={{ fontWeight: 600, color: "#92400e" }}>
          Document préliminaire — Ne pas utiliser en contexte opérationnel
        </p>
        <p style={{ color: "#78350f" }}>
          Référence : Programme SST RIUSC (v7.x)
        </p>

        <div
          style={{
            marginTop: 12,
            paddingTop: 10,
            borderTop: "1px dashed #fcd34d",
            fontSize: 13,
            color: "#78350f",
          }}
        >
          <b>Légende — acronymes :</b><br />
          <b>SP</b> = SOPFEU • <b>CR</b> = Croix-Rouge • <b>SST</b> =
          Santé et sécurité du travail • <b>EPI</b> = Équipement de
          protection individuelle • <b>G</b> = Gravité • <b>P</b> =
          Probabilité • <b>R</b> = Risque (G×P)
          <br />
          <b>Responsable terrain</b> : Chef d’équipe (SOPFEU) /
          Coordinateur (Croix-Rouge)
        </div>
      </div>

      {TACHES.map((t) => (
        <FicheTache key={t.id} tache={t} />
      ))}
    </div>
  );
}
