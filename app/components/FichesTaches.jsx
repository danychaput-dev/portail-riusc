"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

/* =============================
   ORG / ACRONYMES
============================= */
const ORG_CONFIG = {
  SOPFEU: { label: "SP", full: "SOPFEU", bg: "#fef3c7", color: "#92400e" },
  "CROIX-ROUGE": { label: "CR", full: "Croix-Rouge", bg: "#fef2f2", color: "#dc2626" },
  MIXTE: { label: "Mixte", full: "Intervention conjointe SOPFEU / Croix-Rouge", bg: "#dbeafe", color: "#1e40af" },
};

const TT = ({ title, children }) => (
  <span title={title} style={{ cursor: "help" }}>
    {children}
  </span>
);

/* =============================
   DONNÉES — 11 TÂCHES (PORTAIL)
============================= */
const TACHES = [
  {
    id: 1,
    name: "SP — Protection d’infrastructures (digues temporaires)",
    org: "SOPFEU",
    description:
      "Remplissage, transport et empilement de sacs et matériaux temporaires pour renforcer une berge/digue en phase d’urgence (zone froide confirmée).",
    messagePortail:
      "La construction d’une digue temporaire se fait en travail d’équipe et comprend plusieurs tâches. Certaines impliquent la manipulation de charges ou des mouvements répétitifs. L’application des techniques de levage et de transfert apprises en formation est essentielle afin de réduire le risque de blessure.",
    aSavoir: [
      "Travail en équipe (binômes) et supervision active sur le terrain.",
      "Rotations et pauses planifiées : suivez le rythme prévu et signalez la fatigue tôt.",
      "Intervention uniquement en zone froide sécurisée (confirmée avant le début).",
      "Briefing en début de quart : consignes, critères d’arrêt, communications.",
    ],
    limites: [
      "Phase d’urgence uniquement (aucun rétablissement/nettoyage complet).",
      "Arrêt immédiat si instabilité, montée des eaux ou visibilité insuffisante.",
      "Aucune opération de machinerie lourde par les réservistes.",
    ],
    epiRequis: ["Bottes antidérapantes imperméables", "Gants", "Haute visibilité", "Protection oculaire (au besoin)", "Casque (selon contexte)"],
    formations: ["Camp de qualification RIUSC", "Briefing SST manutention (sur place)"],
  },
  {
    id: 2,
    name: "SP — Dégagement d’accès par ébranchage (au sol uniquement)",
    org: "SOPFEU",
    description:
      "Dégagement ponctuel d’arbres/branches AU SOL bloquant des accès afin de permettre le passage de personnes/véhicules d’urgence (dégagement opérationnel).",
    messagePortail:
      "Le dégagement vise uniquement à rétablir un accès pour l’opération d’urgence (pas de nettoyage). Lorsque des outils de coupe sont utilisés, le respect strict des consignes apprises en formation et du périmètre de sécurité est essentiel.",
    aSavoir: [
      "AU SOL uniquement : aucun abattage d’arbre debout.",
      "Deux pieds au sol : aucun travail en hauteur (pas d’échelle, pas d’escalade).",
      "Périmètre de sécurité et coactivité : on s’organise avant de couper.",
      "Si une situation est instable (bois sous tension complexe), on s’arrête et on réfère.",
    ],
    limites: ["AU SOL uniquement — aucun abattage.", "Aucun travail en hauteur.", "Activité réservée aux personnes habilitées à l’outil requis."],
    epiRequis: ["Casque + protection oculaire", "Protection auditive (si requis)", "Gants", "Bottes robustes", "Haute visibilité"],
    formations: ["Camp de qualification RIUSC", "Habilitation outil (si requis)"],
  },
  {
    id: 3,
    name: "SP — Gestion des débris (dégagement opérationnel)",
    org: "SOPFEU",
    description:
      "Retrait ponctuel de débris qui nuisent à l’opération d’urgence afin de dégager un accès/zone de travail. Pas une activité de nettoyage/rétablissement.",
    messagePortail:
      "Le dégagement de débris sert à rendre un accès sécuritaire et fonctionnel pour l’intervention. Les objets peuvent être lourds, tranchants ou contaminés. Le respect des consignes de manipulation et l’utilisation des équipements requis réduisent le risque de blessure.",
    aSavoir: [
      "On dégage pour intervenir (accès/zone), pas pour nettoyer au complet.",
      "On identifie d’abord les dangers avant de manipuler (verre, clous, métal, contamination).",
      "Si un objet semble dangereux (bonbonne, batterie, produit), on isole et on signale.",
      "Travail en équipe et rotations : la fatigue augmente les erreurs.",
    ],
    limites: ["Dégagement d’accès uniquement (pas de rétablissement).", "Aucune machinerie lourde par les réservistes.", "Isoler et signaler les objets potentiellement dangereux."],
    epiRequis: ["Gants anti-coupure", "Bottes robustes", "Protection oculaire", "Masque (au besoin)", "Haute visibilité", "Casque (au besoin)"],
    formations: ["Camp de qualification RIUSC", "Sensibilisation dangers/MD (base)"],
  },
  {
    id: 4,
    name: "Mixte — Reconnaissance du territoire (inspection extérieure)",
    org: "MIXTE",
    description:
      "Observation/documentation extérieure (photos/notes) de secteurs, accès et dommages en zone froide. Interdiction d’entrée dans structures.",
    messagePortail:
      "La reconnaissance sert à documenter et orienter l’intervention. Elle se fait en binôme, avec communications, et uniquement à l’extérieur. La vigilance (terrain, météo, débris, structures fragilisées) est la principale mesure de sécurité.",
    aSavoir: [
      "EXTÉRIEUR uniquement : on n’entre pas dans les structures.",
      "Binômes + itinéraire/zone définis + check-in réguliers.",
      "Distance sécuritaire des structures endommagées.",
      "On priorise la sécurité : si c’est instable, on recule et on signale.",
    ],
    limites: ["EXTÉRIEUR uniquement — interdiction d’entrer.", "Binôme obligatoire + communications.", "Distance sécuritaire des structures endommagées."],
    epiRequis: ["Bottes adaptées", "Haute visibilité", "Vêtements météo", "Casque (au besoin)", "Répulsif (au besoin)"],
    formations: ["Camp de qualification RIUSC", "Radio/GPS (selon rôle)"],
  },
  {
    id: 5,
    name: "CR — Soutien aux évacuations (porte-à-porte / assistance)",
    org: "CROIX-ROUGE",
    description:
      "Assistance à l’évacuation et au soutien aux personnes, selon directives Croix-Rouge et autorités (binômes, sécurité personnelle).",
    messagePortail:
      "Certaines évacuations peuvent être émotionnellement exigeantes. Le travail en binôme, l’encadrement et les techniques de communication apprises (approche calme, respectueuse et sécuritaire) aident à réduire les tensions et à protéger les réservistes.",
    aSavoir: [
      "Binôme minimal : aucune intervention isolée.",
      "On ne force pas une entrée; en cas de menace, on se retire et on réfère aux autorités.",
      "On suit les consignes du Responsable terrain et les procédures Croix-Rouge.",
      "Rotation et débriefing : on ne garde pas tout pour soi.",
    ],
    limites: ["Binôme minimal; pas d’intervention isolée.", "Conflit/violence = retrait et référence aux autorités.", "Respect des consignes du Responsable terrain."],
    epiRequis: ["Haute visibilité RIUSC", "Bottes adaptées", "Masque (si requis)", "Gants (au besoin)"],
    formations: ["Camp de qualification RIUSC", "PSS / désescalade (recommandé)", "Premiers secours (selon rôle)"],
  },
  {
    id: 6,
    name: "Mixte — Coordination des opérations (poste de coordination)",
    org: "MIXTE",
    description:
      "Support coordination logistique (communications, suivi équipes, liaison inter-organisations) en zone sécurisée, sous l’autorité du Responsable terrain.",
    messagePortail:
      "La coordination est surtout exigeante sur le plan mental : radio, suivi, priorités, décisions. Les pauses, la relève et l’utilisation d’outils (check-lists, procédures) protègent la qualité des décisions et la santé des intervenants.",
    aSavoir: [
      "Pauses et hydratation : la fatigue cognitive arrive vite.",
      "Relève planifiée : on évite les quarts trop longs quand c’est possible.",
      "Outils simples (check-lists) pour réduire la charge mentale.",
      "Débriefing en fin de quart : suivi des enjeux et transfert clair.",
    ],
    limites: ["Relève planifiée; quarts selon directives opérationnelles.", "Déplacements terrain seulement si requis/autorisé."],
    epiRequis: ["Haute visibilité (si déplacements)", "Bottes robustes (si déplacements)"],
    formations: ["Camp de qualification RIUSC", "ICS de base (recommandé)"],
  },
  {
    id: 7,
    name: "CR — Préparation des centres d’hébergement (installation)",
    org: "CROIX-ROUGE",
    description:
      "Installation et organisation d’espaces (lits de camp, tables, chaises) dans un centre d’hébergement temporaire, selon procédures Croix-Rouge.",
    messagePortail:
      "La préparation d’un centre d’hébergement repose sur la collaboration et l’organisation. Certaines tâches impliquent de déplacer du matériel; appliquer les techniques de levage et travailler en équipe pour les charges volumineuses réduit le risque de blessure.",
    aSavoir: [
      "Circulation dégagée : on évite l’encombrement pendant l’installation.",
      "Travail en équipe pour charges volumineuses.",
      "Rotation des tâches si l’installation est prolongée.",
      "Respect des procédures du site et de la Croix-Rouge.",
    ],
    limites: ["Travail en équipe pour charges volumineuses.", "Respect procédures du site et Croix-Rouge."],
    epiRequis: ["Chaussures fermées", "Gants (au besoin)", "Haute visibilité (si requis)"],
    formations: ["Camp de qualification RIUSC"],
  },
  {
    id: 8,
    name: "CR — Soutien aux besoins essentiels (distribution)",
    org: "CROIX-ROUGE",
    description:
      "Distribution d’eau, nourriture, vêtements et articles d’hygiène aux sinistrés en centre d’hébergement ou point de distribution.",
    messagePortail:
      "La distribution demande un bon rythme, de l’écoute et une communication respectueuse. L’organisation de l’espace, la rotation des tâches et l’hygiène réduisent les inconforts et soutiennent un service sécuritaire.",
    aSavoir: [
      "Hygiène des mains et consignes sanitaires selon le contexte.",
      "Rotation : alterner station debout / tâches de préparation.",
      "En cas de tension avec un sinistré : on réfère au Responsable terrain.",
      "On garde un environnement fluide (file, zones, dépôts).",
    ],
    limites: ["Respect des directives sanitaires et procédures Croix-Rouge.", "Référer conflits/violence au Responsable terrain."],
    epiRequis: ["Masque (si requis)", "Haute visibilité (si requis)"],
    formations: ["Camp de qualification RIUSC", "Hygiène/salubrité (recommandé)"],
  },
  {
    id: 9,
    name: "CR — Réconfort et soutien moral",
    org: "CROIX-ROUGE",
    description:
      "Écoute active et soutien de base aux personnes sinistrées en centre d’hébergement, selon pratiques Croix-Rouge.",
    messagePortail:
      "Cette tâche est surtout humaine. Écouter la détresse peut être exigeant. La rotation, les pauses et les débriefings aident à préserver l’équilibre émotionnel. Le réserviste n’est pas thérapeute : on réfère les situations complexes aux ressources prévues.",
    aSavoir: [
      "On offre une présence et une écoute, sans se substituer aux professionnels.",
      "Rotation : éviter une exposition continue trop longue.",
      "Débriefing : parler des situations difficiles est normal et encouragé.",
      "Si tu sens que ça t’affecte, tu le dis tôt (au Responsable terrain).",
    ],
    limites: ["Le réserviste n’est pas thérapeute; référer les cas complexes.", "Rotation pour limiter l’exposition émotionnelle."],
    epiRequis: ["Haute visibilité (si requis)"],
    formations: ["Camp de qualification RIUSC", "Premiers secours psychologiques (recommandé)"],
  },
  {
    id: 10,
    name: "CR — Suivi des clientèles vulnérables",
    org: "CROIX-ROUGE",
    description:
      "Vérifications auprès des personnes vulnérables en centre d’hébergement pour assurer que les besoins essentiels sont couverts et référer rapidement au besoin.",
    messagePortail:
      "Le suivi des clientèles vulnérables demande attention, rigueur et communication. L’important est de repérer tôt un besoin et de référer rapidement vers les ressources compétentes selon les procédures du site.",
    aSavoir: [
      "Utiliser une approche structurée (check-list / routine de vérification).",
      "Référer toute situation médicale aux ressources prévues.",
      "Consigner les enjeux et les transmettre au Responsable terrain.",
      "Pauses et soutien : la charge émotionnelle peut être réelle.",
    ],
    limites: ["Référer toute situation médicale aux ressources compétentes.", "Consigner les alertes et les transmettre au Responsable terrain."],
    epiRequis: ["Masque (si requis)"],
    formations: ["Camp de qualification RIUSC", "PSS (recommandé)"],
  },
  {
    id: 11,
    name: "SP — Soutien logistique SOPFEU (terrain)",
    org: "SOPFEU",
    description:
      "Soutien logistique en zone froide : transport matériel léger/modéré, installation d’équipements temporaires, ravitaillement, sous supervision SOPFEU.",
    messagePortail:
      "Le soutien logistique est varié et se fait sous supervision. L’organisation du site (zones piétons/véhicules), les techniques de manutention et la communication sont les clés pour travailler efficacement et de façon sécuritaire.",
    aSavoir: [
      "Respect des couloirs piétons/zones véhicules (coactivité).",
      "Manutention : appliquer les techniques apprises, demander de l’aide tôt.",
      "Briefing sécurité et communications en début de quart.",
      "On s’arrête si la coactivité devient non contrôlable.",
    ],
    limites: ["Aucune machinerie lourde opérée par les réservistes.", "Respect des zones et consignes SOPFEU.", "Arrêt si coactivité non contrôlée."],
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
          fontWeight: 700,
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

const Dots = ({ items, dotColor = "#16a34a" }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
    {(items ?? []).map((x, i) => (
      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "#374151", lineHeight: 1.7 }}>
        <span style={{ color: dotColor, fontSize: 8, marginTop: 7, flexShrink: 0 }}>●</span>
        {x}
      </div>
    ))}
  </div>
);

const FicheTache = ({ tache, isOpen, onToggle, id }) => {
  const org = ORG_CONFIG[tache.org];

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
          <div style={{ fontSize: 15, fontWeight: 700, color: "#1e3a5f", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
          <span style={{ color: "#6b7280", fontWeight: 700 }}>{isOpen ? "▲" : "▼"}</span>
        </div>
      </button>

      {isOpen && (
        <div style={{ padding: "0 20px 24px 20px", borderTop: "1px solid #e5e7eb" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20 }}>
            <div style={{ backgroundColor: "#f0f4f8", borderLeft: "4px solid #1e3a5f", padding: "14px 16px", borderRadius: "0 8px 8px 0" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1e3a5f", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                Description
              </div>
              <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.7 }}>{tache.description}</div>
            </div>

            <div style={{ backgroundColor: "#fffbeb", borderLeft: "4px solid #f59e0b", padding: "14px 16px", borderRadius: "0 8px 8px 0" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                Information sécurité (portail)
              </div>
              <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.7 }}>{tache.messagePortail}</div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
            <div style={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1e3a5f", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                À savoir
              </div>
              <Dots items={tache.aSavoir} dotColor="#1e3a5f" />
            </div>

            <div style={{ backgroundColor: "#ffffff", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#1e3a5f", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Limites d’intervention (RIUSC)
              </div>
              <Dots items={tache.limites} dotColor="#6b7280" />
            </div>
          </div>

          <Section title="Équipement de protection individuelle (ÉPI)">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 4 }}>
              {tache.epiRequis.map((epi, i) => (
                <span
                  key={i}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
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

          <Section title="Formations / consignes associées">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 4 }}>
              {tache.formations.map((f, i) => (
                <span
                  key={i}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 8,
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
            <span style={{ fontSize: 13, color: "#6b7280", fontStyle: "italic", lineHeight: 1.7 }}>
              Responsable terrain : Chef d’équipe (SOPFEU) / Coordinateur (Croix-Rouge), selon l’organisation.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

/* =============================
   TABLEAU SYNTHÈSE (top) — SANS RISQUE
============================= */
const TableauSynthese = ({ tasks, onOpen }) => {
  return (
    <div style={{ backgroundColor: "white", border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
      <div style={{ padding: "14px 16px", borderBottom: "1px solid #e5e7eb", fontWeight: 700, color: "#1e3a5f" }}>Tableau des tâches (synthèse)</div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "#f9fafb", textAlign: "left" }}>
              <th style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}>ID</th>
              <th style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}>Tâche</th>
              <th style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}>Org</th>
              <th style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}>Aperçu</th>
              <th style={{ padding: "10px 12px", borderBottom: "1px solid #e5e7eb" }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t) => {
              const org = ORG_CONFIG[t.org];
              return (
                <tr key={t.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "10px 12px", color: "#374151" }}>{t.id}</td>
                  <td style={{ padding: "10px 12px", color: "#1e3a5f", fontWeight: 700 }}>{t.name}</td>
                  <td style={{ padding: "10px 12px" }}>
                    <TT title={`${org.label} = ${org.full}`}>
                      <span style={{ padding: "2px 10px", borderRadius: 999, background: org.bg, color: org.color, fontWeight: 700 }}>{org.label}</span>
                    </TT>
                  </td>
                  <td style={{ padding: "10px 12px", color: "#6b7280" }}>
                    <span style={{ display: "inline-block", maxWidth: 520, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.description}</span>
                  </td>
                  <td style={{ padding: "10px 12px" }}>
                    <button
                      onClick={() => onOpen(t.id)}
                      style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #d1d5db", background: "white", cursor: "pointer", fontWeight: 700, color: "#1e3a5f" }}
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
   PAGE PRINCIPALE (avec style Soumettre)
============================= */
export default function FichesTachesRIUSC() {
  const [openId, setOpenId] = useState(null);
  const [filterOrg, setFilterOrg] = useState("TOUS");
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
      return true;
    });
  }, [filterOrg]);

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
    <div style={{ minHeight: "100vh", backgroundColor: "#f5f7fa", display: "flex", flexDirection: "column" }}>
      {/* Header sticky (comme Soumettre) */}
      <header style={{ backgroundColor: "white", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: "900px", margin: "0 auto", padding: "0 24px", height: "72px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <img src="/logo.png" alt="Logo RIUSC" width={48} height={48} style={{ borderRadius: "8px" }} />
            <div>
              <h1 style={{ margin: 0, fontSize: "20px", fontWeight: 700, color: "#1e3a5f" }}>Portail RIUSC</h1>
              <p style={{ margin: 0, fontSize: "12px", color: "#6b7280" }}>Fiches de tâches</p>
            </div>
          </div>

          <a href="/" style={{ padding: "8px 16px", color: "#6b7280", textDecoration: "none", fontSize: "14px", border: "1px solid #d1d5db", borderRadius: "6px" }}>
            ← Retour
          </a>
        </div>
      </header>

      <main style={{ maxWidth: "900px", margin: "0 auto", padding: "32px 24px", width: "100%" }}>
        {/* Bandeau info (même style que Soumettre) */}
        <div style={{ backgroundColor: "#fef3c7", border: "2px solid #f59e0b", borderRadius: "12px", padding: "20px 24px", marginBottom: "24px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
            <span style={{ fontSize: "24px", flexShrink: 0 }}>ℹ️</span>
            <div>
              <p style={{ margin: "0 0 8px 0", fontWeight: 700, color: "#92400e", fontSize: "15px" }}>Information – Portail réserviste RIUSC</p>
              <p style={{ margin: 0, color: "#78350f", fontSize: "14px", lineHeight: "1.7" }}>
                Les réservistes RIUSC interviennent exclusivement en <strong>zone froide sécurisée</strong>, sous supervision des autorités responsables (SOPFEU ou Croix-Rouge).
                Les consignes sont précisées au <strong>briefing</strong> en début de quart et adaptées au contexte réel du terrain. Référence : Programme SST RIUSC (v7.x).
              </p>

              <div style={{ marginTop: "14px", paddingTop: "14px", borderTop: "1px dashed #f59e0b" }}>
                <p style={{ margin: "0 0 6px 0", fontWeight: 700, color: "#92400e", fontSize: "13px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Légende — acronymes
                </p>
                <p style={{ margin: 0, color: "#78350f", fontSize: "14px", lineHeight: "1.7" }}>
                  <strong>SP</strong> : SOPFEU &nbsp;•&nbsp; <strong>CR</strong> : Croix-Rouge &nbsp;•&nbsp; <strong>SST</strong> : Santé et sécurité du travail &nbsp;•&nbsp;{" "}
                  <strong>ÉPI</strong> : Équipement de protection individuelle &nbsp;•&nbsp; <strong>RIUSC</strong> : Réserve d’intervention d’urgence en sécurité civile
                </p>
                <p style={{ margin: "10px 0 0 0", color: "#7c2d12", fontSize: "13px" }}>
                  <strong>Responsable terrain</strong> : Chef d’équipe (SOPFEU) / Coordinateur (Croix-Rouge), selon l’organisation.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Header section */}
        <div style={{ marginBottom: 16 }}>
          <h3 style={{ margin: "0 0 6px 0", fontSize: 18, fontWeight: 700, color: "#1e3a5f" }}>Fiches de tâches RIUSC</h3>
          <p style={{ margin: 0, fontSize: 14, color: "#6b7280", lineHeight: 1.7 }}>
            {TACHES.length} tâches — Vue synthèse + fiches détaillées. (Contenu informatif; les consignes terrain prévalent.)
          </p>
        </div>

        {/* Filters (org seulement) */}
        <div style={{ display: "flex", gap: 20, marginBottom: 16, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#6b7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Organisme
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <FilterBtn label="Tous" active={filterOrg === "TOUS"} onClick={() => setFilterOrg("TOUS")} />
              <FilterBtn label="SOPFEU" active={filterOrg === "SOPFEU"} onClick={() => setFilterOrg("SOPFEU")} />
              <FilterBtn label="Croix-Rouge" active={filterOrg === "CROIX-ROUGE"} onClick={() => setFilterOrg("CROIX-ROUGE")} />
              <FilterBtn label="Mixte" active={filterOrg === "MIXTE"} onClick={() => setFilterOrg("MIXTE")} />
            </div>
          </div>
        </div>

        <TableauSynthese tasks={filtered} onOpen={openFromTable} />

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
            <div style={{ padding: "40px 20px", backgroundColor: "#ffffff", borderRadius: 12, textAlign: "center", color: "#9ca3af", fontSize: 14, border: "1px solid #e5e7eb" }}>
              Aucune tâche ne correspond aux filtres sélectionnés.
            </div>
          )}
        </div>

        <div style={{ marginTop: 18, background: "white", border: "1px solid #e5e7eb", borderRadius: 12, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.1)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: "#1e3a5f", marginBottom: 6 }}>Dimension humaine des interventions</div>
          <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.7 }}>
            Certaines tâches impliquent un contact direct avec des personnes sinistrées ou des situations émotionnellement chargées.
            Il est normal de ressentir du stress ou une charge émotionnelle. La RIUSC privilégie le travail en binôme, la rotation des tâches,
            les débriefings et l’encadrement afin de soutenir les réservistes. Si une situation t’affecte, tu en parles rapidement au Responsable terrain.
          </div>
        </div>
      </main>

      <footer style={{ backgroundColor: "#1e3a5f", color: "white", padding: "24px", textAlign: "center", marginTop: "60px" }}>
        <p style={{ margin: 0, fontSize: "14px", opacity: 0.8 }}>© 2026 AQBRS - Association québécoise des bénévoles en recherche et sauvetage</p>
      </footer>
    </div>
  );
}
