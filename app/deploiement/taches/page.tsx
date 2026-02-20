'use client';

import { useEffect, useMemo, useState, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import Image from 'next/image';

/* =============================
   INTERFACES
============================= */
interface Reserviste {
  benevole_id: string;
  prenom: string;
  nom: string;
  email: string;
  photo_url?: string;
}

interface TacheData {
  id: number;
  name: string;
  org: string;
  description: string;
  messagePortail: string;
  aSavoir: string[];
  limites: string[];
  epiRequis: string[];
  formations: string[];
}

/* =============================
   ORG / ACRONYMES
============================= */
const ORG_CONFIG: Record<string, { label: string; full: string; bg: string; color: string }> = {
  SOPFEU: { label: 'SP', full: 'SOPFEU', bg: '#fef3c7', color: '#92400e' },
  'CROIX-ROUGE': { label: 'CR', full: 'Croix-Rouge', bg: '#fef2f2', color: '#dc2626' },
};

/* =============================
   DONNÉES - 11 TÂCHES
============================= */
const TACHES: TacheData[] = [
  {
    id: 1,
    name: 'SP - Protection d\u2019infrastructures (digues temporaires)',
    org: 'SOPFEU',
    description: 'Tu participes au remplissage, transport et empilement de sacs et matériaux temporaires afin de protéger une infrastructure ou une zone vulnérable (phase d\u2019urgence).',
    messagePortail: 'Le travail se fait en équipe et peut être physique et répétitif. Applique les techniques de levage et de transfert vues en formation. Respecte les rotations prévues, hydrate-toi régulièrement et signale la fatigue tôt.',
    aSavoir: ['Travail en équipe et supervision active sur le terrain.', 'Respecte les rotations prévues, hydrate-toi régulièrement et signale la fatigue tôt.', 'Intervention uniquement en zone froide (confirmée avant le début).', 'Briefing en début de quart : consignes, critères d\u2019arrêt, communications.'],
    limites: ['Phase d\u2019urgence uniquement (aucun rétablissement/nettoyage complet).', 'Arrêt immédiat si instabilité, montée des eaux ou visibilité insuffisante.', 'Aucune opération de machinerie lourde par les réservistes.'],
    epiRequis: ['ÉPI de base : Bottes de travail conformes, gants de travail, dossard haute visibilité', 'Selon contexte / briefing : lunettes de protection, casque'],
    formations: ['Camp de qualification RIUSC', 'Briefing SST manutention (sur place)'],
  },
  {
    id: 2,
    name: 'SP - Dégagement d\u2019accès par ébranchage (au sol uniquement)',
    org: 'SOPFEU',
    description: 'Dégagement manuel de branches et débris AU SOL afin de rétablir un accès opérationnel (passage des équipes et véhicules d\u2019urgence).',
    messagePortail: 'Le dégagement vise uniquement à rétablir un accès pour l\u2019opération d\u2019urgence (pas de nettoyage). Respecte le périmètre de sécurité et les consignes transmises au briefing. Si une situation est instable, tu t\u2019arrêtes et tu réfères.',
    aSavoir: ['AU SOL uniquement : aucun abattage d\u2019arbre debout.', 'Deux pieds au sol : aucun travail en hauteur (pas d\u2019échelle, pas d\u2019escalade).', 'Périmètre de sécurité et coactivité : tu respectes la zone sécurisée et tu attends la consigne avant d\u2019agir.', 'Si une situation est instable (bois sous tension complexe), tu t\u2019arrêtes et tu réfères.'],
    limites: ['AU SOL uniquement - aucun abattage.', 'Aucun travail en hauteur.', 'Activité réservée aux personnes habilitées à l\u2019outil requis.'],
    epiRequis: ['ÉPI de base : Bottes de travail conformes, gants de travail, dossard haute visibilité', 'Selon contexte / briefing : casque, lunettes de protection, protection auditive (si proximité d\u2019outils motorisés)'],
    formations: ['Camp de qualification RIUSC', 'Habilitation outil (si requis)'],
  },
  {
    id: 3,
    name: 'SP - Gestion des débris (dégagement opérationnel)',
    org: 'SOPFEU',
    description: 'Retrait ponctuel de débris qui nuisent à l\u2019opération d\u2019urgence afin de dégager un accès/zone de travail. Pas une activité de nettoyage/rétablissement.',
    messagePortail: 'Le dégagement de débris sert à rendre un accès sécuritaire et fonctionnel pour l\u2019intervention. Les objets peuvent être lourds, tranchants ou contaminés. Le respect des consignes de manipulation et l\u2019utilisation des équipements requis réduisent le risque de blessure.',
    aSavoir: ['Tu dégages pour permettre l\u2019intervention (accès/zone), pas pour nettoyer au complet.', 'Avant de manipuler, tu identifies les dangers (verre, clous, métal, contamination).', 'Si un objet semble dangereux (bonbonne, batterie, produit), tu isoles et tu signales.', 'Respecte les rotations prévues, hydrate-toi régulièrement et signale la fatigue tôt.'],
    limites: ['Dégagement d\u2019accès uniquement (pas de rétablissement).', 'Aucune machinerie lourde par les réservistes.', 'Isoler et signaler les objets potentiellement dangereux.'],
    epiRequis: ['ÉPI de base : Bottes de travail conformes, gants de travail (idéalement anti-coupure), dossard haute visibilité', 'Selon contexte / briefing : lunettes de protection, protection respiratoire, casque'],
    formations: ['Camp de qualification RIUSC', 'Sensibilisation dangers/MD (base)'],
  },
  {
    id: 4,
    name: 'SP - Reconnaissance du territoire (inspection extérieure)',
    org: 'SOPFEU',
    description: 'Observation/documentation extérieure (photos/notes) de secteurs, accès et dommages en zone froide. Interdiction d\u2019entrée dans structures.',
    messagePortail: 'La reconnaissance sert à documenter et orienter l\u2019intervention. Elle se fait en binôme, avec communications, et uniquement à l\u2019extérieur. La vigilance (terrain, météo, débris, structures fragilisées) est la principale mesure de sécurité.',
    aSavoir: ['EXTÉRIEUR uniquement : tu n\u2019entres pas dans les structures.', 'Binôme + itinéraire/zone définis + check-in réguliers.', 'Garde une distance sécuritaire des structures endommagées.', 'Si c\u2019est instable, tu recules et tu signales.'],
    limites: ['EXTÉRIEUR uniquement - interdiction d\u2019entrer.', 'Binôme obligatoire + communications.', 'Distance sécuritaire des structures endommagées.'],
    epiRequis: ['ÉPI de base : Bottes de travail conformes, dossard haute visibilité, vêtements adaptés aux conditions météorologiques', 'Selon contexte / briefing : casque'],
    formations: ['Camp de qualification RIUSC', 'Radio/GPS (selon rôle)'],
  },
  {
    id: 5,
    name: 'CR - Soutien aux évacuations (porte-à-porte / assistance)',
    org: 'CROIX-ROUGE',
    description: 'Assistance à l\u2019évacuation et au soutien aux personnes, selon directives Croix-Rouge et autorités (binômes, sécurité personnelle).',
    messagePortail: 'Certaines évacuations peuvent être émotionnellement exigeantes. Le travail en binôme, l\u2019encadrement et les techniques de communication apprises (approche calme, respectueuse et sécuritaire) aident à réduire les tensions et à protéger les réservistes.',
    aSavoir: ['Binôme minimal : aucune intervention isolée.', 'On ne force pas une entrée; en cas de menace, on se retire et on réfère aux autorités.', 'On suit les consignes du Responsable terrain et les procédures Croix-Rouge.', 'Rotation et débriefing : on ne garde pas tout pour soi.'],
    limites: ['Binôme minimal; pas d\u2019intervention isolée.', 'Conflit/violence = retrait et référence aux autorités.', 'Respect des consignes du Responsable terrain.'],
    epiRequis: ['ÉPI de base : Chaussures fermées appropriées', 'Selon contexte / briefing : dossard haute visibilité, masque, gants'],
    formations: ['Camp de qualification RIUSC', 'PSS / désescalade (recommandé)', 'Premiers secours (selon rôle)'],
  },
  {
    id: 6,
    name: 'SP - Coordination des opérations (poste de coordination)',
    org: 'SOPFEU',
    description: 'Support coordination logistique (communications, suivi équipes, liaison inter-organisations) en zone sécurisée, sous l\u2019autorité du Responsable terrain.',
    messagePortail: 'La coordination est surtout exigeante sur le plan mental : radio, suivi, priorités, décisions. Les pauses, la relève et l\u2019utilisation d\u2019outils (check-lists, procédures) protègent la qualité des décisions et la santé des intervenants.',
    aSavoir: ['Fais des pauses et hydrate-toi : la fatigue cognitive arrive vite.', 'Relève planifiée : on évite les quarts trop longs quand c\u2019est possible.', 'Utilise des outils simples (check-lists) pour réduire la charge mentale.', 'Débriefing en fin de quart : suivi des enjeux et transfert clair.'],
    limites: ['Relève planifiée; quarts selon directives opérationnelles.', 'Déplacements terrain seulement si requis/autorisé.'],
    epiRequis: ['ÉPI de base : Dossard haute visibilité (si déplacements terrain)', 'Selon contexte / briefing : bottes conformes si déplacement en zone terrain'],
    formations: ['Camp de qualification RIUSC', 'ICS de base (recommandé)'],
  },
  {
    id: 7,
    name: 'CR - Préparation des centres d\u2019hébergement (installation)',
    org: 'CROIX-ROUGE',
    description: 'Installation et organisation d\u2019espaces (lits de camp, tables, chaises) dans un centre d\u2019hébergement temporaire, selon procédures Croix-Rouge.',
    messagePortail: 'La préparation d\u2019un centre d\u2019hébergement repose sur la collaboration et l\u2019organisation. Certaines tâches impliquent de déplacer du matériel; appliquer les techniques de levage et travailler en équipe pour les charges volumineuses réduit le risque de blessure.',
    aSavoir: ['Garde les passages dégagés pendant l\u2019installation.', 'Travaille en équipe pour les charges volumineuses.', 'Rotation des tâches si l\u2019installation est prolongée.', 'Respecte les procédures du site et celles de la Croix-Rouge.'],
    limites: ['Travail en équipe pour charges volumineuses.', 'Respect procédures du site et Croix-Rouge.'],
    epiRequis: ['ÉPI de base : Chaussures fermées appropriées', 'Selon contexte / briefing : gants, dossard haute visibilité'],
    formations: ['Camp de qualification RIUSC'],
  },
  {
    id: 8,
    name: 'CR - Soutien aux besoins essentiels (distribution)',
    org: 'CROIX-ROUGE',
    description: 'Distribution d\u2019eau, nourriture, vêtements et articles d\u2019hygiène aux sinistrés en centre d\u2019hébergement ou point de distribution.',
    messagePortail: 'La distribution demande un bon rythme, de l\u2019écoute et une communication respectueuse. L\u2019organisation de l\u2019espace, la rotation des tâches et l\u2019hygiène réduisent les inconforts et soutiennent un service sécuritaire.',
    aSavoir: ['Hygiène des mains et consignes sanitaires selon le contexte.', 'Rotation : alterner station debout / tâches de préparation.', 'En cas de tension avec un sinistré : on réfère au Responsable terrain.', 'On garde un environnement fluide (file, zones, dépôts).'],
    limites: ['Respect des directives sanitaires et procédures Croix-Rouge.', 'Référer conflits/violence au Responsable terrain.'],
    epiRequis: ['ÉPI de base : Chaussures fermées appropriées', 'Selon contexte / briefing : masque, gants, dossard haute visibilité'],
    formations: ['Camp de qualification RIUSC', 'Hygiène/salubrité (recommandé)'],
  },
  {
    id: 9,
    name: 'CR - Réconfort et soutien moral',
    org: 'CROIX-ROUGE',
    description: 'Écoute active et soutien de base aux personnes sinistrées en centre d\u2019hébergement, selon pratiques Croix-Rouge.',
    messagePortail: 'Cette tâche est surtout humaine. Écouter la détresse peut être exigeant. La rotation, les pauses et les débriefings aident à préserver l\u2019équilibre émotionnel. Le réserviste n\u2019est pas thérapeute : on réfère les situations complexes aux ressources prévues.',
    aSavoir: ['On offre une présence et une écoute, sans se substituer aux professionnels.', 'Rotation : éviter une exposition continue trop longue.', 'Débriefing : parler des situations difficiles est normal et encouragé.', 'Si tu sens que ça t\u2019affecte, tu le dis tôt (au Responsable terrain).'],
    limites: ['Le réserviste n\u2019est pas thérapeute; référer les cas complexes.', 'Rotation pour limiter l\u2019exposition émotionnelle.'],
    epiRequis: ['ÉPI de base : Chaussures fermées appropriées', 'Selon contexte / briefing : masque'],
    formations: ['Camp de qualification RIUSC', 'Premiers secours psychologiques (recommandé)'],
  },
  {
    id: 10,
    name: 'CR - Suivi des clientèles vulnérables',
    org: 'CROIX-ROUGE',
    description: 'Vérifications auprès des personnes vulnérables en centre d\u2019hébergement pour assurer que les besoins essentiels sont couverts et référer rapidement au besoin.',
    messagePortail: 'Le suivi des clientèles vulnérables demande attention, rigueur et communication. L\u2019important est de repérer tôt un besoin et de référer rapidement vers les ressources compétentes selon les procédures du site.',
    aSavoir: ['Utiliser une approche structurée (check-list / routine de vérification).', 'Référer toute situation médicale aux ressources prévues.', 'Consigner les enjeux et les transmettre au Responsable terrain.', 'Pauses et soutien : la charge émotionnelle peut être réelle.'],
    limites: ['Référer toute situation médicale aux ressources compétentes.', 'Consigner les alertes et les transmettre au Responsable terrain.'],
    epiRequis: ['ÉPI de base : Chaussures fermées appropriées', 'Selon contexte / briefing : masque, gants'],
    formations: ['Camp de qualification RIUSC', 'PSS (recommandé)'],
  },
  {
    id: 11,
    name: 'SP - Soutien logistique SOPFEU (terrain)',
    org: 'SOPFEU',
    description: 'Soutien logistique en zone froide : transport matériel léger/modéré, installation d\u2019équipements temporaires, ravitaillement, sous supervision SOPFEU.',
    messagePortail: 'Le soutien logistique est varié et se fait sous supervision. L\u2019organisation du site (zones piétons/véhicules), les techniques de manutention et la communication sont les clés pour travailler efficacement et de façon sécuritaire.',
    aSavoir: ['Respect des couloirs piétons/zones véhicules (coactivité).', 'Manutention : applique les techniques apprises, demande de l\u2019aide tôt et respecte les rotations.', 'Briefing sécurité et communications en début de quart.', 'Si la coactivité devient non contrôlable, tu t\u2019arrêtes et tu signales.'],
    limites: ['Aucune machinerie lourde opérée par les réservistes.', 'Respect des zones et consignes SOPFEU.', 'Arrêt si coactivité non contrôlée.'],
    epiRequis: ['ÉPI de base : Bottes de travail conformes, gants de travail, dossard haute visibilité', 'Selon contexte / briefing : lunettes de protection, casque'],
    formations: ['Camp de qualification RIUSC', 'Briefing radio/sécurité SOPFEU'],
  },
];

/* =============================
   COMPOSANTS UI
============================= */
function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginTop: 16 }}>
      <button onClick={() => setOpen(!open)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', fontSize: 14, fontWeight: 700, color: '#1e3a5f', textAlign: 'left' }}>
        <span style={{ width: 16, color: '#6b7280' }}>{open ? '▼' : '▶'}</span>
        {title}
      </button>
      {open && <div style={{ paddingLeft: 4, paddingTop: 4 }}>{children}</div>}
    </div>
  );
}

function Dots({ items, dotColor = '#16a34a' }: { items: string[]; dotColor?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {(items ?? []).map((x, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 14, color: '#374151', lineHeight: 1.7 }}>
          <span style={{ color: dotColor, fontSize: 8, marginTop: 7, flexShrink: 0 }}>●</span>
          {x}
        </div>
      ))}
    </div>
  );
}

function FicheTache({ tache, isOpen, onToggle, id }: { tache: TacheData; isOpen: boolean; onToggle: () => void; id: string }) {
  const org = ORG_CONFIG[tache.org];
  return (
    <div id={id} style={{ backgroundColor: 'white', borderRadius: 12, border: isOpen ? '2px solid #1e3a5f' : '1px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', transition: 'all 0.2s', overflow: 'hidden' }}>
      <button onClick={onToggle} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 16, padding: '18px 20px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1e3a5f', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tache.name}</div>
          <div style={{ fontSize: 13, color: '#6b7280', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tache.description}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span title={`${org.label} = ${org.full}`} style={{ padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700, backgroundColor: org.bg, color: org.color, cursor: 'help' }}>{org.label}</span>
          <span style={{ color: '#6b7280', fontWeight: 700 }}>{isOpen ? '▲' : '▼'}</span>
        </div>
      </button>

      {isOpen && (
        <div style={{ padding: '0 20px 24px 20px', borderTop: '1px solid #e5e7eb' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
            <div style={{ backgroundColor: '#f0f4f8', borderLeft: '4px solid #1e3a5f', padding: '14px 16px', borderRadius: '0 8px 8px 0' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a5f', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Description</div>
              <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7 }}>{tache.description}</div>
            </div>
            <div style={{ backgroundColor: '#fffbeb', borderLeft: '4px solid #f59e0b', padding: '14px 16px', borderRadius: '0 8px 8px 0' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>Information sécurité (portail)</div>
              <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7 }}>{tache.messagePortail}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a5f', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>À savoir</div>
              <Dots items={tache.aSavoir} dotColor="#1e3a5f" />
            </div>
            <div style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#1e3a5f', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Limites d&apos;intervention (RIUSC)</div>
              <Dots items={tache.limites} dotColor="#6b7280" />
            </div>
          </div>

          <Section title="Équipement de protection individuelle (ÉPI)">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
              {tache.epiRequis.map((epi, i) => (
                <span key={i} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, backgroundColor: '#f9fafb', color: '#374151', border: '1px solid #e5e7eb', fontWeight: 600 }}>{epi}</span>
              ))}
            </div>
          </Section>

          <Section title="Formations / consignes associées">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 4 }}>
              {tache.formations.map((f, i) => (
                <span key={i} style={{ padding: '6px 14px', borderRadius: 8, fontSize: 13, backgroundColor: '#f0f4f8', color: '#1e3a5f', border: '1px solid #d1dce8', fontWeight: 700 }}>{f}</span>
              ))}
            </div>
          </Section>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #e5e7eb' }}>
            <span style={{ fontSize: 13, color: '#6b7280', fontStyle: 'italic', lineHeight: 1.7 }}>
              Responsable terrain : Chef d&apos;équipe (SOPFEU) / Coordonnateur (Croix-Rouge), selon l&apos;organisation.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/* =============================
   PAGE PRINCIPALE
============================= */
function FichesTachesContent() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [user, setUser] = useState<any>(null);
  const [reserviste, setReserviste] = useState<Reserviste | null>(null);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);
  const [filterOrg, setFilterOrg] = useState('TOUS');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    checkUser();
  }, []);

  useEffect(() => {
    const tacheParam = searchParams.get('tache');
    if (tacheParam) {
      const match = TACHES.find((t) => t.name.toLowerCase().includes(tacheParam.toLowerCase()));
      if (match) {
        setOpenId(match.id);
        setTimeout(() => {
          const el = document.getElementById(`fiche-${match.id}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
      }
    }
  }, [searchParams]);

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUser(user);

    let reservisteData = null;
    if (user.email) {
      const { data } = await supabase.from('reservistes').select('benevole_id, prenom, nom, email, photo_url').ilike('email', user.email).single();
      reservisteData = data;
    }
    if (!reservisteData && user.phone) {
      const phoneDigits = user.phone.replace(/\D/g, '');
      const { data } = await supabase.from('reservistes').select('benevole_id, prenom, nom, email, photo_url').eq('telephone', phoneDigits).single();
      if (!data) {
        const phoneWithout1 = phoneDigits.startsWith('1') ? phoneDigits.slice(1) : phoneDigits;
        const { data: data2 } = await supabase.from('reservistes').select('benevole_id, prenom, nom, email, photo_url').eq('telephone', phoneWithout1).single();
        reservisteData = data2;
      } else { reservisteData = data; }
    }
    if (reservisteData) setReserviste(reservisteData);
    setLoading(false);
  }

  const handleSignOut = async () => { await supabase.auth.signOut(); router.push('/login'); };

  const getInitials = () => {
    if (reserviste) return `${reserviste.prenom.charAt(0)}${reserviste.nom.charAt(0)}`.toUpperCase();
    return user?.email?.charAt(0).toUpperCase() || 'U';
  };

  const filtered = useMemo(() => {
    return TACHES.filter((t) => filterOrg === 'TOUS' || t.org === filterOrg);
  }, [filterOrg]);

   if (loading) {
    return (<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px', color: '#1e3a5f' }}>Chargement...</div>);
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      {/* Header */}
      <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '16px', textDecoration: 'none' }}>
            <Image src="/logo.png" alt="Logo RIUSC" width={48} height={48} style={{ borderRadius: '8px' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e3a5f' }}>Portail RIUSC</h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Réserve d&apos;Intervention d&apos;Urgence</p>
            </div>
          </a>
          {reserviste ? (
            <div ref={userMenuRef} style={{ position: 'relative' }}>
              <button onClick={() => setShowUserMenu(!showUserMenu)} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px', backgroundColor: showUserMenu ? '#f3f4f6' : 'transparent', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>{reserviste.prenom} {reserviste.nom}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280' }}>Réserviste</div>
                </div>
                {reserviste.photo_url ? (
                  <img src={reserviste.photo_url} alt="Photo de profil" style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#1e3a5f', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '14px' }}>{getInitials()}</div>
                )}
                <svg width="16" height="16" fill="none" stroke="#6b7280" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {showUserMenu && (
                <div style={{ position: 'absolute', top: '100%', right: 0, marginTop: '8px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', border: '1px solid #e5e7eb', minWidth: '200px', overflow: 'hidden' }}>
                  <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#374151', textDecoration: 'none', fontSize: '14px', borderBottom: '1px solid #f3f4f6' }}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                    Accueil
                  </a>
                  <a href="/profil" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#374151', textDecoration: 'none', fontSize: '14px', borderBottom: '1px solid #f3f4f6' }}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    Mon profil
                  </a>
                  <a href="/disponibilites" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#374151', textDecoration: 'none', fontSize: '14px', borderBottom: '1px solid #f3f4f6' }}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    Mes disponibilités
                  </a>
                  <button onClick={handleSignOut} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', color: '#dc2626', backgroundColor: 'white', border: 'none', width: '100%', textAlign: 'left', fontSize: '14px', cursor: 'pointer' }}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    Déconnexion
                  </button>
                </div>
              )}
            </div>
          ) : (
            <a href="/" style={{ padding: '8px 16px', color: '#6b7280', textDecoration: 'none', fontSize: '14px', border: '1px solid #d1d5db', borderRadius: '6px' }}>← Retour</a>
          )}
        </div>
      </header>

      <main style={{ maxWidth: '1200px', margin: '0 auto', padding: '32px 24px' }}>
        <div style={{ marginBottom: '24px' }}>
          <a href="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>← Retour à l&apos;accueil</a>
        </div>
        <div style={{ marginTop: '14px', padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px' }}>
          <p style={{ margin: 0, color: '#991b1b', fontSize: '14px', fontWeight: 700 }}>⚠️ Document en cours d&apos;élaboration - Ne pas utiliser comme référence opérationnelle. Les consignes officielles sont transmises au briefing terrain.</p>
        </div>
        {/* Bandeau info */}
        <div style={{ backgroundColor: '#fef3c7', border: '2px solid #f59e0b', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
            <span style={{ fontSize: '24px', flexShrink: 0 }}>ℹ️</span>
            <div>
              <p style={{ margin: '0 0 8px 0', fontWeight: 700, color: '#92400e', fontSize: '15px' }}>Information – Portail réserviste RIUSC</p>
              <p style={{ margin: 0, color: '#78350f', fontSize: '14px', lineHeight: '1.7' }}>
                Les réservistes RIUSC interviennent exclusivement en <strong>zone froide </strong>, sous supervision des autorités responsables (SOPFEU ou Croix-Rouge).
                Les consignes sont précisées au <strong>briefing</strong> en début de quart et adaptées au contexte réel du terrain. Référence : Programme SST RIUSC (v7.x).
              </p>
              
              <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px dashed #f59e0b' }}>
                
                <p style={{ margin: '0 0 6px 0', fontWeight: 700, color: '#92400e', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Légende - acronymes</p>
                <p style={{ margin: 0, color: '#78350f', fontSize: '14px', lineHeight: '1.7' }}>
                  <strong>SP</strong> : SOPFEU &nbsp;•&nbsp; <strong>CR</strong> : Croix-Rouge &nbsp;•&nbsp; <strong>SST</strong> : Santé et sécurité du travail &nbsp;•&nbsp; <strong>ÉPI</strong> : Équipement de protection individuelle &nbsp;•&nbsp; <strong>RIUSC</strong> : Réserve d&apos;intervention d&apos;urgence en sécurité civile
                </p>
                <p style={{ margin: '10px 0 0 0', color: '#7c2d12', fontSize: '13px' }}>
                  <strong>Responsable terrain</strong> : Chef d&apos;équipe (SOPFEU) / Coordinateur (Croix-Rouge), selon l&apos;organisation.
                </p>
              </div>
            </div>
          </div>
        </div>

 {/* Dimension humaine */}
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px' }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#1e3a5f', marginBottom: 6 }}><strong>Dimension humaine des interventions</strong></div>
          <div style={{ fontSize: 14, color: '#374151', lineHeight: 1.7 }}>
            Certaines tâches impliquent un contact direct avec des personnes sinistrées ou des situations émotionnellement chargées.
            Il est normal de ressentir du stress ou une charge émotionnelle. La RIUSC privilégie le travail en binôme, la rotation des tâches,
            les débriefings et l&apos;encadrement afin de soutenir les réservistes. Si une situation t&apos;affecte, tu en parles rapidement au Responsable terrain.
          </div>
        </div>

        <h2 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '28px', fontWeight: '700' }}>Fiches de tâches RIUSC</h2>
        <p style={{ margin: '0 0 24px 0', fontSize: 14, color: '#6b7280', lineHeight: 1.7 }}>
          {TACHES.length} tâches - Vue synthèse + fiches détaillées. (Contenu informatif; les consignes terrain prévalent.)
        </p>

        {/* Filtres */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Organisme</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { label: 'Tous', value: 'TOUS' },
                { label: 'SOPFEU', value: 'SOPFEU' },
                { label: 'Croix-Rouge', value: 'CROIX-ROUGE' },
               ].map((btn) => (
                <button key={btn.value} onClick={() => setFilterOrg(btn.value)} style={{
                  padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                  border: filterOrg === btn.value ? '1px solid #1e3a5f' : '1px solid #d1d5db',
                  backgroundColor: filterOrg === btn.value ? '#1e3a5f' : 'white',
                  color: filterOrg === btn.value ? 'white' : '#374151',
                  cursor: 'pointer', transition: 'all 0.2s',
                }}>
                  {btn.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((tache) => (
            <FicheTache key={tache.id} id={`fiche-${tache.id}`} tache={tache} isOpen={openId === tache.id} onToggle={() => setOpenId(openId === tache.id ? null : tache.id)} />
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: '40px 20px', backgroundColor: '#ffffff', borderRadius: 12, textAlign: 'center', color: '#9ca3af', fontSize: 14, border: '1px solid #e5e7eb' }}>
              Aucune tâche ne correspond aux filtres sélectionnés.
            </div>
          )}
        </div>    
      </main>

      <footer style={{ backgroundColor: '#1e3a5f', color: 'white', padding: '24px', textAlign: 'center', marginTop: '60px' }}>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>© 2026 AQBRS - Association québécoise des bénévoles en recherche et sauvetage</p>
      </footer>
    </div>
  );
}
export default function FichesTachesRIUSC() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', fontSize: '18px', color: '#1e3a5f' }}>Chargement...</div>}>
      <FichesTachesContent />
    </Suspense>
  );
}