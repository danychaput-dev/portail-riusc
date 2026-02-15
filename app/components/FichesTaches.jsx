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
    procedureUrl: "https://aqbrs.monday.com/protected_static/27459850/resources/2678227092/RIUSC_Tache6_Protection_Digues_SST.pdf"
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
    procedureUrl: "https://aqbrs.monday.com/protected_static/27459850/resources/2659851277/Procedure_Securite_Ebranchage.pdf"
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
    procedureUrl: "https://aqbrs.monday.com/protected_static/27459850/resources/2678332463/RIUSC_Tache7_Gestion_Debris_SST.pdf"
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
    procedureUrl: "https://aqbrs.monday.com/protected_static/27459850/resources/2678377297/RIUSC_Tache9_Reconnaissance_Territoire_SST.pdf"
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
    procedureUrl: "https://aqbrs.monday.com/protected_static/27459850/resources/2683786851/RIUSC_Tache3_Soutien_Evacuations_SST.pdf"
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
    procedureUrl: "https://aqbrs.monday.com/protected_static/27459850/resources/2683727732/RIUSC_Tache10_Coordination_Operations_SST.pdf"
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
    procedureUrl: "https://aqbrs.monday.com/protected_static/27459850/resources/2683734003/RIUSC_Tache1_Preparation_Centres_Hebergement_SST.pdf"
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
    procedureUrl: "https://aqbrs.monday.com/protected_static/27459850/resources/2683746186/RIUSC_Tache2_Soutien_Besoins_Essentiels_SST.pdf"
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
    procedureUrl: "https://aqbrs.monday.com/protected_static/27459850/resources/2683751941/RIUSC_Tache4_Reconfort_Soutien_Moral_SST.pdf"
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
    procedureUrl: "https://aqbrs.monday.com/protected_static/27459850/resources/2683760189/RIUSC_Tache5_Suivi_Clienteles_Vulnerables_SST.pdf"
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
    procedureUrl: "https://aqbrs.monday.com/protected_static/27459850/resources/2683767063/RIUSC_Tache7_Soutien_Logistique_SOPFEU_SST.pdf"
  }
];

const ORG_CONFIG = {
  SOPFEU: {
    label: "SOPFEU",
    color: "#D97706",
    bgLight: "#FEF3C7",
    bgMed: "#FDE68A",
    icon: "🔥",
    accent: "#92400E"
  },
  "CROIX-ROUGE": {
    label: "Croix-Rouge",
    color: "#DC2626",
    bgLight: "#FEE2E2",
    bgMed: "#FECACA",
    icon: "✚",
    accent: "#991B1B"
  },
  MIXTE: {
    label: "Mixte",
    color: "#2563EB",
    bgLight: "#DBEAFE",
    bgMed: "#BFDBFE",
    icon: "⬡",
    accent: "#1E40AF"
  }
};

const RISK_CONFIG = {
  "Très Élevé": { color: "#DC2626", bg: "#FEE2E2", border: "#F87171", icon: "▲▲", weight: 4 },
  "Élevé": { color: "#EA580C", bg: "#FFF7ED", border: "#FB923C", icon: "▲", weight: 3 },
  "Moyen": { color: "#CA8A04", bg: "#FEFCE8", border: "#FACC15", icon: "◆", weight: 2 },
  "Faible": { color: "#16A34A", bg: "#F0FDF4", border: "#4ADE80", icon: "●", weight: 1 }
};

const Section = ({ title, icon, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ borderTop: "1px solid #E5E7EB", paddingTop: 12, marginTop: 12 }}>
      <button
        onClick={() => setOpen(!open)}
        style={{
          display: "flex", alignItems: "center", gap: 8, width: "100%",
          background: "none", border: "none", cursor: "pointer", padding: "4px 0",
          fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
          color: "#374151", letterSpacing: "0.02em"
        }}
      >
        <span style={{ fontSize: 14, opacity: 0.6 }}>{icon}</span>
        <span>{title}</span>
        <span style={{
          marginLeft: "auto", fontSize: 11, transition: "transform 0.2s",
          transform: open ? "rotate(180deg)" : "rotate(0deg)", color: "#9CA3AF"
        }}>▼</span>
      </button>
      {open && <div style={{ paddingTop: 8, paddingLeft: 4 }}>{children}</div>}
    </div>
  );
};

const ItemList = ({ items, color = "#6B7280" }) => (
  <ul style={{ margin: 0, paddingLeft: 18, listStyle: "none" }}>
    {items.map((item, i) => (
      <li key={i} style={{
        fontSize: 13, lineHeight: 1.7, color: "#4B5563", position: "relative",
        fontFamily: "'DM Sans', sans-serif"
      }}>
        <span style={{
          position: "absolute", left: -14, top: 0, color, fontSize: 8,
          lineHeight: "23px"
        }}>●</span>
        {item}
      </li>
    ))}
  </ul>
);

const Badge = ({ children, bg, color, border }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "3px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
    background: bg, color, border: `1.5px solid ${border || bg}`,
    fontFamily: "'DM Sans', sans-serif", letterSpacing: "0.03em",
    textTransform: "uppercase"
  }}>{children}</span>
);

const FicheTache = ({ tache, isOpen, onToggle }) => {
  const org = ORG_CONFIG[tache.org];
  const risk = RISK_CONFIG[tache.risque];

  return (
    <div
      style={{
        background: "#FFFFFF",
        borderRadius: 14,
        border: `1px solid ${isOpen ? org.color + "40" : "#E5E7EB"}`,
        boxShadow: isOpen
          ? `0 8px 32px ${org.color}12, 0 2px 8px rgba(0,0,0,0.04)`
          : "0 1px 3px rgba(0,0,0,0.04)",
        transition: "all 0.25s ease",
        overflow: "hidden"
      }}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 14,
          padding: "16px 20px", background: "none", border: "none",
          cursor: "pointer", textAlign: "left"
        }}
      >
        {/* Org indicator */}
        <div style={{
          width: 40, height: 40, borderRadius: 10,
          background: org.bgLight, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 18, flexShrink: 0,
          border: `1.5px solid ${org.bgMed}`
        }}>
          {org.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700,
            color: "#111827", lineHeight: 1.3,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
          }}>
            {tache.name}
          </div>
          <div style={{
            fontFamily: "'DM Sans', sans-serif", fontSize: 12.5, color: "#6B7280",
            marginTop: 2, lineHeight: 1.4,
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap"
          }}>
            {tache.description}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
          <Badge bg={org.bgLight} color={org.accent} border={org.bgMed}>
            {org.label}
          </Badge>
          <Badge bg={risk.bg} color={risk.color} border={risk.border}>
            {risk.icon} {tache.risque}
          </Badge>
          <span style={{
            fontSize: 14, color: "#9CA3AF", transition: "transform 0.25s",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)"
          }}>▼</span>
        </div>
      </button>

      {/* Expanded content */}
      {isOpen && (
        <div style={{
          padding: "0 20px 20px 20px",
          borderTop: `1px solid #F3F4F6`,
          animation: "fadeIn 0.2s ease"
        }}>
          {/* Description & Risk summary */}
          <div style={{
            display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16,
            marginTop: 16
          }}>
            <div style={{
              background: "#F9FAFB", borderRadius: 10, padding: 14,
              border: "1px solid #F3F4F6"
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: "#9CA3AF",
                textTransform: "uppercase", letterSpacing: "0.06em",
                fontFamily: "'DM Sans', sans-serif", marginBottom: 6
              }}>Description</div>
              <div style={{
                fontSize: 13.5, color: "#374151", lineHeight: 1.65,
                fontFamily: "'DM Sans', sans-serif"
              }}>{tache.description}</div>
            </div>
            <div style={{
              background: risk.bg, borderRadius: 10, padding: 14,
              border: `1px solid ${risk.border}30`
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: risk.color,
                textTransform: "uppercase", letterSpacing: "0.06em",
                fontFamily: "'DM Sans', sans-serif", marginBottom: 6
              }}>Analyse de risque — {tache.risque}</div>
              <div style={{
                fontSize: 13.5, color: "#374151", lineHeight: 1.65,
                fontFamily: "'DM Sans', sans-serif"
              }}>{tache.analyseRisque}</div>
            </div>
          </div>

          {/* Collapsible sections */}
          <Section title="Dangers identifiés" icon="⚠️" defaultOpen={true}>
            <ItemList items={tache.dangers} color={risk.color} />
          </Section>

          <Section title="Mesures de prévention" icon="🛡️" defaultOpen={true}>
            <ItemList items={tache.prevention} color="#16A34A" />
          </Section>

          <Section title="Équipement de protection individuelle (EPI)" icon="🦺">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 4 }}>
              {tache.epiRequis.map((epi, i) => (
                <span key={i} style={{
                  display: "inline-block", padding: "5px 12px", borderRadius: 8,
                  background: "#F3F4F6", fontSize: 12.5, color: "#374151",
                  fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
                  border: "1px solid #E5E7EB"
                }}>{epi}</span>
              ))}
            </div>
          </Section>

          <Section title="Formations requises" icon="🎓">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 4 }}>
              {tache.formations.map((f, i) => (
                <span key={i} style={{
                  display: "inline-block", padding: "5px 12px", borderRadius: 8,
                  background: org.bgLight, fontSize: 12.5, color: org.accent,
                  fontFamily: "'DM Sans', sans-serif", fontWeight: 600,
                  border: `1px solid ${org.bgMed}`
                }}>{f}</span>
              ))}
            </div>
          </Section>

          {/* Procedure status */}
          <div style={{
            marginTop: 16, paddingTop: 12, borderTop: "1px solid #E5E7EB",
            display: "flex", alignItems: "center", gap: 8
          }}>
            <span style={{ fontSize: 14 }}>📋</span>
            <span style={{
              fontSize: 13, color: "#9CA3AF",
              fontFamily: "'DM Sans', sans-serif", fontWeight: 500,
              fontStyle: "italic"
            }}>
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

  const FilterButton = ({ value, label, active, onClick, color }) => (
    <button
      onClick={onClick}
      style={{
        padding: "6px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 600,
        fontFamily: "'DM Sans', sans-serif", cursor: "pointer",
        border: active ? `2px solid ${color || "#111827"}` : "1.5px solid #E5E7EB",
        background: active ? (color ? color + "12" : "#F9FAFB") : "#FFFFFF",
        color: active ? (color || "#111827") : "#6B7280",
        transition: "all 0.15s ease",
        letterSpacing: "0.01em"
      }}
    >{label}</button>
  );

  return (
    <div style={{
      maxWidth: 860, margin: "0 auto", padding: "32px 20px",
      fontFamily: "'DM Sans', sans-serif"
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;0,9..40,800&display=swap" rel="stylesheet" />

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 640px) {
          .grid-responsive { grid-template-columns: 1fr !important; }
          .header-badges { flex-direction: column; align-items: flex-start !important; gap: 6px !important; }
          .filter-row { flex-wrap: wrap; }
        }
      `}</style>

      {/* Bandeau préliminaire */}
      <div style={{
        background: "#FEF3C7", border: "1.5px solid #F59E0B", borderRadius: 10,
        padding: "14px 18px", marginBottom: 24, display: "flex",
        alignItems: "flex-start", gap: 12
      }}>
        <span style={{ fontSize: 20, lineHeight: 1, flexShrink: 0 }}>⚠️</span>
        <div>
          <div style={{
            fontSize: 13.5, fontWeight: 700, color: "#92400E",
            fontFamily: "'DM Sans', sans-serif", marginBottom: 3
          }}>Document préliminaire — Ne pas utiliser en contexte opérationnel</div>
          <div style={{
            fontSize: 12.5, color: "#A16207", lineHeight: 1.55,
            fontFamily: "'DM Sans', sans-serif"
          }}>
            Ces fiches de tâches sont en cours de rédaction et de validation. Le contenu, les analyses de risque et les mesures de prévention sont sujets à modification. Les procédures de sécurité SST sont présentement en processus de révision.
          </div>
        </div>
      </div>

      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: "#9CA3AF",
          textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 6
        }}>Catalogue des tâches</div>
        <h1 style={{
          fontSize: 26, fontWeight: 800, color: "#111827", margin: 0,
          lineHeight: 1.2, letterSpacing: "-0.02em"
        }}>Fiches de tâches RIUSC</h1>
        <p style={{
          fontSize: 14, color: "#6B7280", marginTop: 6, lineHeight: 1.5
        }}>
          {TACHES.length} tâches disponibles — Cliquez sur une tâche pour consulter la fiche complète incluant les dangers, mesures de prévention et équipements requis.
        </p>
      </div>

      {/* Filters */}
      <div style={{
        display: "flex", gap: 24, marginBottom: 20, flexWrap: "wrap",
        alignItems: "flex-start"
      }}>
        <div>
          <div style={{
            fontSize: 10.5, fontWeight: 700, color: "#9CA3AF",
            textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6
          }}>Organisme</div>
          <div style={{ display: "flex", gap: 5 }} className="filter-row">
            <FilterButton value="TOUS" label="Tous" active={filterOrg === "TOUS"} onClick={() => setFilterOrg("TOUS")} />
            <FilterButton value="SOPFEU" label="🔥 SOPFEU" active={filterOrg === "SOPFEU"} onClick={() => setFilterOrg("SOPFEU")} color="#D97706" />
            <FilterButton value="CROIX-ROUGE" label="✚ Croix-Rouge" active={filterOrg === "CROIX-ROUGE"} onClick={() => setFilterOrg("CROIX-ROUGE")} color="#DC2626" />
            <FilterButton value="MIXTE" label="⬡ Mixte" active={filterOrg === "MIXTE"} onClick={() => setFilterOrg("MIXTE")} color="#2563EB" />
          </div>
        </div>
        <div>
          <div style={{
            fontSize: 10.5, fontWeight: 700, color: "#9CA3AF",
            textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6
          }}>Niveau de risque</div>
          <div style={{ display: "flex", gap: 5 }} className="filter-row">
            <FilterButton value="TOUS" label="Tous" active={filterRisk === "TOUS"} onClick={() => setFilterRisk("TOUS")} />
            <FilterButton value="Très Élevé" label="▲▲ Très Élevé" active={filterRisk === "Très Élevé"} onClick={() => setFilterRisk("Très Élevé")} color="#DC2626" />
            <FilterButton value="Élevé" label="▲ Élevé" active={filterRisk === "Élevé"} onClick={() => setFilterRisk("Élevé")} color="#EA580C" />
            <FilterButton value="Moyen" label="◆ Moyen" active={filterRisk === "Moyen"} onClick={() => setFilterRisk("Moyen")} color="#CA8A04" />
            <FilterButton value="Faible" label="● Faible" active={filterRisk === "Faible"} onClick={() => setFilterRisk("Faible")} color="#16A34A" />
          </div>
        </div>
      </div>

      {/* Task list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
            textAlign: "center", padding: 40, color: "#9CA3AF",
            fontSize: 14, fontFamily: "'DM Sans', sans-serif"
          }}>
            Aucune tâche ne correspond aux filtres sélectionnés.
          </div>
        )}
      </div>
    </div>
  );
}
