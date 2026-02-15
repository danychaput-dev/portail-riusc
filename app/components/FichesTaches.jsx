"use client";
import { useState } from "react";

const TACHES = [
  {
    id: 1,
    name: "SP- Protection infrastructures (digues)",
    org: "SOPFEU",
    description: "Installation de sacs de sable pour renforcer des berges et digues en zone froide sécurisée lors d'inondations.",
    risque: "Très Élevé",
    analyseRisque: "Manipulation répétée de charges lourdes (20kg) sur terrain instable près de l'eau, combinée à des conditions météorologiques difficiles et à la pression temporelle d'une situation d'urgence.",
    dangers: [
      "Troubles musculo-squelettiques (dos, épaules, genoux)",
      "Glissades et chutes sur terrain boueux / instable",
      "Fatigue physique intense et épuisement",
      "Hypothermie (travail sous la pluie / froid)",
      "Déshydratation et coup de chaleur (travail intense)",
      "Stress élevé et pression psychologique",
      "Montée soudaine des eaux"
    ],
    prevention: [
      "Vérification zone froide par SOPFEU avant début",
      "Rotation équipes toutes les 2 heures maximum",
      "Techniques de levage sécuritaires (formation obligatoire)",
      "Système de jumelage (binômes obligatoires)",
      "Pauses 15 min par heure de travail",
      "Hydratation régulière forcée",
      "Surveillance météo continue",
      "Procédure d'évacuation immédiate si danger",
      "Communication radio constante avec coordonnateur"
    ],
    epiRequis: ["Casque", "Bottes imperméables", "Gants renforcés", "Veste réfléchissante", "Harnais (si requis)"],
    formations: ["Camp Qualification RIUSC"],
  },
  {
    id: 2,
    name: "SP - Dégagement d'Accès par Ébranchage",
    org: "SOPFEU",
    description: "Couper branches et arbres tombés AU SOL bloquant chemins / routes pour dégager accès véhicules d'urgence en zone froide sécurisée.",
    risque: "Élevé",
    analyseRisque: "Utilisation de scies à chaîne pour couper branches et arbres au sol avec risques de contact avec chaîne en mouvement, rebond (kickback), branches sous tension et efforts répétés, le tout en zone extérieure avec conditions variables.",
    dangers: [
      "Contact avec la chaîne en mouvement (lacérations graves)",
      "Rebond de la scie (kickback) - perte de contrôle",
      "Branches sous tension (coup de fouet)",
      "Projection de copeaux et débris",
      "Troubles musculo-squelettiques (vibrations, postures)",
      "Exposition aux carburants et gaz d'échappement",
      "Bruit excessif (>85 dB)",
      "Chutes et trébuchements sur terrain accidenté",
      "Fatigue et baisse de vigilance",
      "Insectes piqueurs et plantes irritantes"
    ],
    prevention: [
      "Formation obligatoire utilisation scie à chaîne",
      "Système de jumelage obligatoire (jamais seul)",
      "Périmètre de sécurité 2 mètres autour opérateur",
      "Inspection quotidienne des scies avant utilisation",
      "Rotation opérateur/assistant toutes les 30-45 minutes",
      "Pauses 10 min par heure de travail",
      "Limitation : arbres/branches AU SOL uniquement (pas d'abattage)",
      "Distance minimale 3 mètres des lignes électriques",
      "Arrêt travaux si vents >40 km/h ou visibilité réduite",
      "Communication constante avec coordonnateur SOPFEU"
    ],
    epiRequis: ["Casque forestier avec visière grillagée et protection auditive", "Pantalon anti-coupure (ISO 11393)", "Bottes forestières avec protection anti-coupure", "Veste haute visibilité", "Lunettes de sécurité", "Trousse premiers secours"],
    formations: ["Camp Qualification RIUSC", "Certification Utilisation Scie Mécanique"],
  },
  {
    id: 3,
    name: "SP - Gestion débris",
    org: "SOPFEU",
    description: "Tri, ramassage et chargement de débris en zone sécurisée suite à un sinistre (inondation, feu, tempête).",
    risque: "Moyen",
    analyseRisque: "Manipulation d'objets lourds, tranchants et contaminés sur le terrain instable avec risques de coupures, écrasements et exposition à contaminants biologiques / chimiques.",
    dangers: [
      "Coupures et perforations (débris tranchants, clous, verre)",
      "Écrasement pieds/mains (objets lourds)",
      "Troubles musculo-squelettiques (levage répété, postures)",
      "Exposition contaminants biologiques (moisissures, eaux usées)",
      "Chutes et trébuchements (terrain encombré, inégal)",
      "Poussières et particules irritantes",
      "Insectes, rongeurs, animaux dans débris",
      "Fatigue physique et stress thermique"
    ],
    prevention: [
      "Évaluation zone par SOPFEU avant début (zone froide confirmée)",
      "Système de jumelage obligatoire",
      "Techniques de levage sécuritaires (dos droit, genoux fléchis)",
      "Rotation tâches toutes les 2 heures",
      "Pauses 15 min par heure",
      "Tri sécuritaire (identifier dangers avant manipulation)",
      "Utilisation outils appropriés (pinces, crochets pour objets tranchants)",
      "Hydratation régulière",
      "Signalisation périmètre travail",
      "Procédure pour objets dangereux (batteries, bonbonnes gaz)"
    ],
    epiRequis: ["Casque", "Gants renforcés", "Bottes de sécurité", "Lunettes de protection", "Masque N95", "Vêtements longs et couvrants", "Protection auditive (si machinerie)"],
    formations: ["Camp Qualification RIUSC", "Formation identification matières dangereuses"],
  },
  {
    id: 4,
    name: "Reconnaissance territoire",
    org: "MIXTE",
    description: "Inspection visuelle EXTÉRIEURE de bâtiments et infrastructures en zone froide pour documenter dommages par photos / vidéos et observation.",
    risque: "Moyen",
    analyseRisque: "Déplacements sur terrain potentiellement accidenté avec risques de chutes, trébuchements et exposition aux éléments, tout en maintenant vigilance pour dangers résiduels dans zone sécurisée.",
    dangers: [
      "Chutes et trébuchements (terrain inégal, débris, boue)",
      "Chute d'objets depuis structures endommagées",
      "Exposition intempéries (chaleur, froid, pluie)",
      "Fatigue physique (marche prolongée)",
      "Désorientation (zones étendues, signalisation absente)",
      "Animaux sauvages ou errants",
      "Insectes piqueurs (tiques, moustiques)",
      "Plantes irritantes (herbe à puce)",
      "Stress et charge émotionnelle (voir destructions)",
      "Isolement relatif du binôme"
    ],
    prevention: [
      "Système de jumelage obligatoire (binômes)",
      "Communication radio constante avec coordonnateur",
      "Check-in aux 30 minutes minimum",
      "GPS et cartes de la zone",
      "Itinéraire planifié avant le départ",
      "Inspection visuelle EXTÉRIEURE uniquement (ne jamais entrer structures)",
      "Distance minimale 3 mètres des structures endommagées",
      "Pauses régulières (15 min par 2h)",
      "Hydratation et protection solaire / froide",
      "Limitation durée reconnaissance (max 4h consécutives)"
    ],
    epiRequis: ["Bottes de randonnée", "Gants de travail", "Veste haute visibilité", "Casque (si proximité structures)", "Lunettes de soleil", "Lampe frontale", "Vêtements adaptés", "Chasse-moustiques"],
    formations: ["Camp Qualification RIUSC", "Formation GPS et Radio"],
  },
  {
    id: 5,
    name: "CR - Soutien évacuations",
    org: "CROIX-ROUGE",
    description: "Assistance aux personnes évacuées lors de sinistres, incluant porte-à-porte, aide aux personnes vulnérables et support au transport.",
    risque: "Moyen",
    analyseRisque: "Contact direct avec population en détresse dans contexte d'urgence, avec risques de violence verbale / physique, charge émotionnelle élevée et dangers résiduels dans zones évacuées.",
    dangers: [
      "Violence verbale ou physique (personnes en détresse / panique)",
      "Charge émotionnelle et stress (situations traumatisantes)",
      "Fatigue physique (porte-à-porte prolongé, escaliers)",
      "Exposition intempéries (travail extérieur)",
      "Chutes et trébuchements (urgence, terrain encombré)",
      "Animaux de compagnie stressés (morsures)",
      "Travail isolé (entrée domiciles)",
      "Communication difficile (langues, handicap)",
      "Infection (contact rapproché, maladies contagieuses)",
      "Stress vicariant (absorption trauma d'autrui)"
    ],
    prevention: [
      "Système de jumelage obligatoire (binômes minimum)",
      "Formation gestion situations difficiles et désescalade",
      "Communication radio constante avec coordonnateur",
      "Identification claire (Veste RIUSC, Badge)",
      "Limites d'intervention définies (ne pas forcer entrée, police si violence)",
      "Protocole sécurité personnelle (distance, position sortie)",
      "Pauses régulières et débriefings",
      "Rotation tâches (limiter exposition émotionnelle)",
      "Support psychologique post-déploiement disponible",
      "Respect distanciation physique si maladies contagieuses"
    ],
    epiRequis: ["Veste / Dossard haute visibilité RIUSC", "Gants", "Bottes de sécurité", "Masque", "Casque", "Lampe frontale", "Vêtements adaptés"],
    formations: ["Camp Qualification RIUSC", "Premiers secours", "Premiers secours psychologiques"],
  },
  {
    id: 6,
    name: "Coordination opérations",
    org: "MIXTE",
    description: "Support à la coordination logistique des opérations RIUSC, incluant communications radio, suivi déploiement des équipes et liaison avec coordonnateur SOPFEU.",
    risque: "Faible",
    analyseRisque: "Travail principalement stationnaire dans zone sécurisée avec risques limités aux aspects ergonomiques, stress et fatigue liés à la coordination d'urgence.",
    dangers: [
      "Stress élevé (coordination multiple équipes, urgence)",
      "Fatigue mentale (attention soutenue, décisions rapides)",
      "Postures statiques prolongées (assis/debout poste commande)",
      "Troubles musculo-squelettiques (nuque, épaules, dos)",
      "Fatigue visuelle (écrans, cartes, documents)",
      "Fatigue auditive (radio constante, bruit ambiant)",
      "Surcharge informationnelle",
      "Pression psychologique (responsabilité sécurité équipes)",
      "Heures prolongées (quarts 10-12h)",
      "Déshydratation et nutrition inadéquate (oubli pauses)"
    ],
    prevention: [
      "Formation coordination opérations d'urgence",
      "Poste de travail ergonomique (chaise, écran, éclairage)",
      "Pauses obligatoires (15 min aux 2h)",
      "Rotation avec autres coordonnateurs si disponible",
      "Système de relève planifié (quarts maximum 12h)",
      "Hydratation et collations accessibles au poste",
      "Check-list et procédures écrites (réduire charge mentale)",
      "Support du coordonnateur SOPFEU principal",
      "Débriefing post-quart",
      "Accès support psychologique si nécessaire"
    ],
    epiRequis: ["Veste réfléchissante", "Casque (si déplacement zone avec activités)", "Bottes de sécurité (si déplacements terrain)", "Protection auditive (si environnement bruyant)"],
    formations: ["Camp Qualification RIUSC", "ICS-100", "ICS-200", "ICS-300"],
  },
  {
    id: 7,
    name: "CR - Aide préparation centres hébergement",
    org: "CROIX-ROUGE",
    description: "Installation de lits de camps, tables, chaises et organisation d'espaces dans centre d'hébergement temporaire pour personnes sinistrées.",
    risque: "Faible",
    analyseRisque: "Tâches logistiques légères avec risques minimes limités au levage léger et postures lors de l'installation de mobilier.",
    dangers: [
      "Troubles musculo-squelettiques mineurs (dos, épaules)",
      "Chutes et trébuchements (encombrement temporaire)",
      "Pincements de doigts (pliage/dépliage lits de camp)",
      "Fatigue physique légère",
      "Poussières (nettoyage espaces)",
      "Bruit modéré (activité collective)",
      "Stress organisationnel léger"
    ],
    prevention: [
      "Travail en binômes pour objets lourds",
      "Techniques de levage sécuritaires",
      "Circulation dégagée",
      "Pauses régulières (15 min / 2h)",
      "Rotation des tâches",
      "Hydratation accessible",
      "Supervision Croix-Rouge"
    ],
    epiRequis: ["Veste réfléchissante RIUSC", "Gants", "Chaussures fermées confortables", "Masque", "Vêtements confortables"],
    formations: ["Camp Qualification RIUSC"],
  },
  {
    id: 8,
    name: "CR - Soutien besoins essentiels",
    org: "CROIX-ROUGE",
    description: "Distribution d'eau, nourriture, vêtements, articles d'hygiène aux personnes sinistrées dans centres d'hébergement ou points de distribution.",
    risque: "Faible",
    analyseRisque: "Tâche logistique légère avec contact humain, risques minimes liés à la manipulation de charges légères et stress émotionnel modéré.",
    dangers: [
      "TMS légers (transport caisses, sacs)",
      "Chutes et trébuchements",
      "Fatigue physique (station debout prolongée)",
      "Stress émotionnel (contact avec détresse des sinistrés)",
      "Exposition maladies contagieuses (contact rapproché)",
      "Allergies alimentaires (manipulation denrées)",
      "Conflits occasionnels avec personnes stressées",
      "Charge émotionnelle"
    ],
    prevention: [
      "Travail en binômes",
      "Techniques levages sécuritaires",
      "Rotation des tâches",
      "Pauses 15 min/2h",
      "Hygiène stricte des mains (savon, gel hydroalcoolique)",
      "Formation communication empathique",
      "Support superviseur Croix-Rouge",
      "Débriefing si situations difficiles",
      "Hydratation"
    ],
    epiRequis: ["Veste réfléchissante", "Masque (si requis)"],
    formations: ["Camp Qualification RIUSC", "Hygiène et salubrité alimentaire (base)", "Sensibilisation allergies alimentaires", "Communication empathique et bienveillante"],
  },
  {
    id: 9,
    name: "CR - Réconfort et soutien moral",
    org: "CROIX-ROUGE",
    description: "Présence rassurante, écoute active et conversation avec personnes sinistrées en détresse dans centres d'hébergement.",
    risque: "Faible",
    analyseRisque: "Tâche relationnelle sans risque physique significatif mais charge émotionnelle élevée liée au contact prolongé avec personnes traumatisées.",
    dangers: [
      "Stress vicariant (absorption trauma d'autrui)",
      "Fatigue émotionnelle et compassion",
      "Épuisement psychologique",
      "Situations verbalement difficiles (colère, détresse intense)",
      "Exposition à récits traumatisants",
      "Sentiments d'impuissance",
      "Isolement émotionnel du réserviste",
      "Fatigue physique (station debout / assise prolongée)"
    ],
    prevention: [
      "Formation premiers secours psychologiques",
      "Travail en binômes (soutien mutuel)",
      "Rotation tâches (limiter exposition continue)",
      "Pauses obligatoires fréquentes",
      "Débriefing quotidien avec superviseur Croix-Rouge",
      "Limites claires (réserviste n'est pas thérapeute)",
      "Support psychologique post-déploiement disponible",
      "Auto-surveillance signes épuisement"
    ],
    epiRequis: ["Veste réfléchissante"],
    formations: ["Camp Qualification RIUSC", "Premiers secours psychologiques", "Communication empathique et bienveillante"],
  },
  {
    id: 10,
    name: "CR - Suivi clientèles vulnérables",
    org: "CROIX-ROUGE",
    description: "Vérification régulière auprès des personnes vulnérables (aînés, mobilité réduite, conditions médicales) dans centres hébergement pour s'assurer besoins satisfaits.",
    risque: "Faible",
    analyseRisque: "Tâche de surveillance bienveillante avec risques limités au stress émotionnel et responsabilité morale liée aux personnes fragiles.",
    dangers: [
      "Stress élevé (responsabilité personnes vulnérables)",
      "Charge émotionnelle (voir souffrance)",
      "Situations médicales urgentes (savoir réagir)",
      "Communication difficile (handicaps, langues, démence)",
      "Fatigue compassionnelle",
      "Sentiment inadéquation face besoins complexes",
      "Déplacements fréquents (fatigue physique légère)",
      "Pression temporelle (vérifications régulières)"
    ],
    prevention: [
      "Formation assistance personnes vulnérables",
      "Travail en binômes",
      "Check-list de vérification structurée",
      "Communication claire avec infirmières / Croix-Rouge",
      "Limites d'intervention définies (référer professionnels santé)",
      "Pauses régulières",
      "Débriefing quotidien",
      "Support psychologique disponible",
      "Rotation avec autres tâches"
    ],
    epiRequis: ["Veste réfléchissante", "Masque (si requis)"],
    formations: ["Camp Qualification RIUSC", "Premiers secours psychologiques"],
  },
  {
    id: 11,
    name: "SP - Soutien logistique SOPFEU",
    org: "SOPFEU",
    description: "Support aux opérations SOPFEU incluant transport de matériel, installation d'équipement, ravitaillement et tâches logistiques diverses en zone froide.",
    risque: "Faible",
    analyseRisque: "Tâches logistiques variées avec risques minimes liés à la manipulation de matériel léger et déplacements sur terrain sécurisé.",
    dangers: [
      "TMS légers (transport matériel, caisses)",
      "Chutes et trébuchements (terrain variable)",
      "Fatigue physique (activité soutenue)",
      "Conditions météo (travail extérieur)",
      "Manipulation équipements SOPFEU (suivre directives)",
      "Circulation véhicules lourds (camions, VTT)",
      "Bruit modéré (équipement, générateurs)",
      "Poussières et débris"
    ],
    prevention: [
      "Binômes de travail",
      "Techniques levage sécuritaires",
      "Supervision SOPFEU constante",
      "Formation sur équipements spécifiques avant utilisation",
      "Circulation piétonne délimitée (éloignée véhicules)",
      "Pauses 15min/2h",
      "Hydratation et protection solaire/froide",
      "Rotation tâches",
      "Communication radio"
    ],
    epiRequis: ["Veste réfléchissante", "Casque de construction", "Gants renforcés", "Bottes de sécurité", "Lunettes de protection", "Protection auditive"],
    formations: ["Camp Qualification RIUSC", "Utilisation radio VHF"],
  }
];

const ORG_CONFIG = {
  SOPFEU: { label: "SOPFEU", bg: "#fef3c7", color: "#92400e" },
  "CROIX-ROUGE": { label: "Croix-Rouge", bg: "#fef2f2", color: "#dc2626" },
  MIXTE: { label: "Mixte", bg: "#dbeafe", color: "#1e40af" }
};

const RISK_CONFIG = {
  "Très Élevé": { bg: "#fef2f2", color: "#dc2626", border: "#fca5a5" },
  "Élevé": { bg: "#fff7ed", color: "#ea580c", border: "#fdba74" },
  "Moyen": { bg: "#fefce8", color: "#a16207", border: "#fde68a" },
  "Faible": { bg: "#f0fdf4", color: "#16a34a", border: "#86efac" }
};

const Section = ({ title, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginTop: 16 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%",
          background: "none", border: "none", cursor: "pointer", padding: "8px 0",
          fontSize: 14, fontWeight: 600, color: "#1e3a5f", textAlign: "left"
        }}
      >
        <svg
          width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}
        >
          <path d="M19 9l-7 7-7-7" />
        </svg>
        {title}
      </button>
      {open && <div style={{ paddingLeft: 4, paddingTop: 4 }}>{children}</div>}
    </div>
  );
};

const FicheTache = ({ tache, isOpen, onToggle }) => {
  const org = ORG_CONFIG[tache.org];
  const risk = RISK_CONFIG[tache.risque];

  return (
    <div style={{
      backgroundColor: "white",
      borderRadius: 12,
      border: isOpen ? "2px solid #1e3a5f" : "1px solid #e5e7eb",
      boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      transition: "all 0.2s",
      overflow: "hidden"
    }}>
      <button
        onClick={onToggle}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 16,
          padding: "18px 20px", background: "none", border: "none",
          cursor: "pointer", textAlign: "left"
        }}
        onMouseOver={(e) => { if (!isOpen) e.currentTarget.parentElement.style.borderColor = "#1e3a5f" }}
        onMouseOut={(e) => { if (!isOpen) e.currentTarget.parentElement.style.borderColor = "#e5e7eb" }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 15, fontWeight: 600, color: "#1e3a5f",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
          }}>
            {tache.name}
          </div>
          <div style={{
            fontSize: 13, color: "#6b7280", marginTop: 3,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
          }}>
            {tache.description}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <span style={{
            padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
            backgroundColor: org.bg, color: org.color
          }}>{org.label}</span>
          <span style={{
            padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 600,
            backgroundColor: risk.bg, color: risk.color
          }}>{tache.risque}</span>
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <path d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div style={{ padding: "0 20px 24px 20px", borderTop: "1px solid #e5e7eb" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 20 }}>
            <div style={{
              backgroundColor: "#f0f4f8", borderLeft: "4px solid #2c5aa0",
              padding: "14px 16px", borderRadius: "0 8px 8px 0"
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: "#1e3a5f", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                Description
              </div>
              <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
                {tache.description}
              </div>
            </div>
            <div style={{
              backgroundColor: risk.bg, borderLeft: `4px solid ${risk.border}`,
              padding: "14px 16px", borderRadius: "0 8px 8px 0"
            }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: risk.color, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 6 }}>
                Analyse de risque — {tache.risque}
              </div>
              <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.6 }}>
                {tache.analyseRisque}
              </div>
            </div>
          </div>

          <Section title="Dangers identifiés" defaultOpen={true}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {tache.dangers.map((d, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "#374151", lineHeight: 1.5 }}>
                  <span style={{ color: risk.color, fontSize: 8, marginTop: 6, flexShrink: 0 }}>●</span>
                  {d}
                </div>
              ))}
            </div>
          </Section>

          <Section title="Mesures de prévention" defaultOpen={true}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {tache.prevention.map((p, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 14, color: "#374151", lineHeight: 1.5 }}>
                  <span style={{ color: "#16a34a", fontSize: 8, marginTop: 6, flexShrink: 0 }}>●</span>
                  {p}
                </div>
              ))}
            </div>
          </Section>

          <Section title="Équipement de protection individuelle (EPI)">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 4 }}>
              {tache.epiRequis.map((epi, i) => (
                <span key={i} style={{
                  padding: "6px 14px", borderRadius: 6, fontSize: 13,
                  backgroundColor: "#f9fafb", color: "#374151",
                  border: "1px solid #e5e7eb", fontWeight: 500
                }}>{epi}</span>
              ))}
            </div>
          </Section>

          <Section title="Formations requises">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingTop: 4 }}>
              {tache.formations.map((f, i) => (
                <span key={i} style={{
                  padding: "6px 14px", borderRadius: 6, fontSize: 13,
                  backgroundColor: "#f0f4f8", color: "#1e3a5f",
                  border: "1px solid #d1dce8", fontWeight: 600
                }}>{f}</span>
              ))}
            </div>
          </Section>

          <div style={{
            marginTop: 20, paddingTop: 16, borderTop: "1px solid #e5e7eb",
            display: "flex", alignItems: "center", gap: 10
          }}>
            <span style={{ fontSize: 16 }}>📋</span>
            <span style={{ fontSize: 14, color: "#9ca3af", fontStyle: "italic" }}>
              Procédure de sécurité SST — En processus de révision
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

  const filtered = TACHES.filter(t => {
    if (filterOrg !== "TOUS" && t.org !== filterOrg) return false;
    if (filterRisk !== "TOUS" && t.risque !== filterRisk) return false;
    return true;
  });

  const FilterBtn = ({ label, active, onClick }) => (
    <button
      onClick={onClick}
      style={{
        padding: "8px 16px", borderRadius: 6, fontSize: 13, fontWeight: 500,
        border: active ? "1px solid #1e3a5f" : "1px solid #d1d5db",
        backgroundColor: active ? "#1e3a5f" : "white",
        color: active ? "white" : "#374151",
        cursor: "pointer", transition: "all 0.2s"
      }}
    >{label}</button>
  );

  return (
    <div>
      {/* Bandeau préliminaire */}
      <div style={{
        backgroundColor: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8,
        padding: "20px", marginBottom: 24, display: "flex",
        alignItems: "flex-start", gap: 12
      }}>
        <span style={{ fontSize: 24 }}>⚠️</span>
        <div>
          <p style={{ margin: "0 0 8px 0", fontWeight: 600, color: "#92400e", fontSize: 15 }}>
            Document préliminaire — Ne pas utiliser en contexte opérationnel
          </p>
          <p style={{ margin: 0, color: "#78350f", fontSize: 14, lineHeight: 1.6 }}>
            Ces fiches de tâches sont en cours de rédaction et de validation. Le contenu, les analyses de risque
            et les mesures de prévention sont sujets à modification. Les procédures de sécurité SST sont
            présentement en processus de révision.
          </p>
        </div>
      </div>

      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 8px 0", fontSize: 18, fontWeight: 600, color: "#1e3a5f" }}>
          Fiches de tâches RIUSC
        </h3>
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
            Niveau de risque
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <FilterBtn label="Tous" active={filterRisk === "TOUS"} onClick={() => setFilterRisk("TOUS")} />
            <FilterBtn label="Très Élevé" active={filterRisk === "Très Élevé"} onClick={() => setFilterRisk("Très Élevé")} />
            <FilterBtn label="Élevé" active={filterRisk === "Élevé"} onClick={() => setFilterRisk("Élevé")} />
            <FilterBtn label="Moyen" active={filterRisk === "Moyen"} onClick={() => setFilterRisk("Moyen")} />
            <FilterBtn label="Faible" active={filterRisk === "Faible"} onClick={() => setFilterRisk("Faible")} />
          </div>
        </div>
      </div>

      {/* Task cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filtered.map(tache => (
          <FicheTache
            key={tache.id}
            tache={tache}
            isOpen={openId === tache.id}
            onToggle={() => setOpenId(openId === tache.id ? null : tache.id)}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{
            padding: "40px 20px", backgroundColor: "#f9fafb", borderRadius: 8,
            textAlign: "center", color: "#9ca3af", fontSize: 14
          }}>
            Aucune tâche ne correspond aux filtres sélectionnés.
          </div>
        )}
      </div>
    </div>
  );
}
