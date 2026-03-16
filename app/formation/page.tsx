'use client';

import { useEffect, useState, useRef, Suspense } from 'react';
import { createClient } from '@/utils/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import PortailHeader from '@/app/components/PortailHeader';
import ImpersonateBanner from '@/app/components/ImpersonateBanner';
import { isDemoActive, getDemoGroupe, DEMO_RESERVISTE, DEMO_USER, DEMO_FORMATIONS } from '@/utils/demoMode';

interface Reserviste {
  benevole_id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
  photo_url?: string;
  groupe?: string;
  date_naissance?: string;
  adresse?: string;
  ville?: string;
  region?: string;
  contact_urgence_nom?: string;
  contact_urgence_telephone?: string;
  allergies_alimentaires?: string;
  allergies_autres?: string;
  conditions_medicales?: string;
  consent_photo?: boolean;
  antecedents_statut?: string;
  antecedents_date_verification?: string;
  antecedents_date_expiration?: string;
  monday_created_at?: string;
}

interface CampInfo {
  nom: string;
  dates: string;
  site: string;
  location: string;
}

interface CampStatus {
  is_certified: boolean;
  has_inscription: boolean;
  session_id: string | null;
  camp: CampInfo | null;
  lien_inscription: string | null;
}

interface SessionCamp {
  session_id: string;
  nom: string;
  dates: string;
  site: string;
  location: string;
}

interface CertificatFile {
  id: string;
  name: string;
  url?: string;
}

interface DocumentOfficiel {
  id: number;
  benevole_id: string;
  type_document: string;
  titre: string;
  nom_fichier: string;
  chemin_storage: string;
}

interface Formation {
  id: string;
  nom: string;
  catalogue: string;
  session: string;
  role: string;
  resultat: string;
  etat_validite: string;
  date_reussite: string | null;
  date_expiration: string | null;
  commentaire: string;
  has_fichier?: boolean;
  fichiers?: { name: string; url: string | null }[];
  source?: string;
  certificat_requis?: boolean;
}

function FormationContent() {
  const supabase = createClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const campParam = searchParams.get('camp') || '';

  const [user, setUser] = useState<any>(null);
  const [reserviste, setReserviste] = useState<Reserviste | null>(null);
  const [loading, setLoading] = useState(true);

  const [certificats, setCertificats] = useState<CertificatFile[]>([]);
  const [loadingCertificats, setLoadingCertificats] = useState(true);
  const [uploadingCertificat, setUploadingCertificat] = useState(false);
  const [certificatMessage, setCertificatMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const [campStatus, setCampStatus] = useState<CampStatus | null>(null);
  const [loadingCamp, setLoadingCamp] = useState(true);

  const [showCampModal, setShowCampModal] = useState(false);
  const [sessionsDisponibles, setSessionsDisponibles] = useState<SessionCamp[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [inscriptionLoading, setInscriptionLoading] = useState(false);
  const [inscriptionError, setInscriptionError] = useState<string | null>(null);
  const [inscriptionSuccess, setInscriptionSuccess] = useState(false);
  const [cancellingInscription, setCancellingInscription] = useState(false);

  const [modalAllergiesAlim, setModalAllergiesAlim] = useState('');
  const [modalAllergiesAutres, setModalAllergiesAutres] = useState('');
  const [modalConditions, setModalConditions] = useState('');
  const [modalConsentPhoto, setModalConsentPhoto] = useState(false);

  const [formations, setFormations] = useState<Formation[]>([]);
  const [loadingFormations, setLoadingFormations] = useState(true);
  const [lmsPortailProgression, setLmsPortailProgression] = useState<{ statut: string; date_completion: string | null } | null>(null);

  // Helper: mapper les formations avec signed URLs pour les certificats Supabase Storage
  const mapFormationsWithSignedUrls = async (rawFormations: any[]) => {
    return Promise.all(rawFormations.map(async (f: any) => {
      let certUrl = f.certificat_url;
      if (certUrl && certUrl.startsWith('storage:')) {
        const path = certUrl.replace('storage:', '');
        const { data: signed } = await supabase.storage.from('certificats').createSignedUrl(path, 3600);
        certUrl = signed?.signedUrl || null;
      }
      return {
        id: f.id?.toString() || f.monday_item_id?.toString() || '',
        nom: f.nom_formation || '',
        catalogue: f.nom_formation || '',
        session: f.nom_formation || '',
        role: f.role || 'Participant',
        resultat: f.resultat || '',
        etat_validite: f.etat_validite || '',
        date_reussite: f.date_reussite || null,
        date_expiration: f.date_expiration || null,
        commentaire: f.commentaire || '',
        has_fichier: !!certUrl,
        fichiers: certUrl ? [{ name: 'Certificat', url: certUrl }] : [],
        source: f.source || null,
        certificat_requis: f.certificat_requis || false
      };
    }));
  };

  const [documentsOfficiels, setDocumentsOfficiels] = useState<DocumentOfficiel[]>([]);
  const [documentUrls, setDocumentUrls] = useState<Record<number, string>>({});

  const isApproved = reserviste?.groupe === 'Approuvé';

  const selectFields = 'benevole_id, prenom, nom, email, telephone, photo_url, groupe, date_naissance, adresse, ville, region, contact_urgence_nom, contact_urgence_telephone, allergies_alimentaires, allergies_autres, conditions_medicales, consent_photo, antecedents_statut, antecedents_date_verification, antecedents_date_expiration, monday_created_at';

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!loading && !loadingCamp && campParam && reserviste && !campStatus?.is_certified) {
      openCampModal();
    }
  }, [loading, loadingCamp, campParam]);

  async function loadData() {
    // 🔧 SUPPORT MODE DEBUG
    if (typeof window !== 'undefined') {
      const debugMode = localStorage.getItem('debug_mode');
      if (debugMode === 'true') {
        const debugUser = localStorage.getItem('debug_user');
        if (debugUser) {
          const userData = JSON.parse(debugUser);
          console.log('🔧 Mode debug formation:', userData.email);
          setUser({ id: `debug_${userData.benevole_id}`, email: userData.email });
          
          // Charger le profil complet depuis Supabase (RPC = SECURITY DEFINER, pas besoin de session)
          const { data: rpcData } = await supabase.rpc('get_reserviste_by_benevole_id', { target_benevole_id: userData.benevole_id });
          const fullReserviste = rpcData?.[0] || userData;
          setReserviste(fullReserviste);

          if (userData.benevole_id) {
            // Charger tout en parallèle
            const bid = userData.benevole_id;
            const [certResult, campResult, formResult, docsResult, lmsResult] = await Promise.allSettled([
              fetch(`https://n8n.aqbrs.ca/webhook/riusc-get-certificats?benevole_id=${bid}`).then(r => r.ok ? r.json() : null),
              fetch(`https://n8n.aqbrs.ca/webhook/camp-status?benevole_id=${bid}`).then(r => r.ok ? r.json() : null),
              supabase.rpc('get_formations_by_benevole_id', { target_benevole_id: bid }),
              supabase.rpc('get_documents_by_benevole_id', { target_benevole_id: bid }),
              supabase.from('lms_progression').select('statut, date_completion').eq('benevole_id', bid).eq('module_id', '148e3363-b889-41ce-85f2-72c9d5a36b3c').maybeSingle()
            ]);

            // Certificats
            if (certResult.status === 'fulfilled' && certResult.value?.success && certResult.value.files) {
              setCertificats(certResult.value.files);
            }
            setLoadingCertificats(false);

            // Camp status
            if (campResult.status === 'fulfilled' && campResult.value) {
              setCampStatus(campResult.value);
            }
            setLoadingCamp(false);

            // Formations (from Supabase RPC)
            if (formResult.status === 'fulfilled' && formResult.value?.data) {
              setFormations(await mapFormationsWithSignedUrls(formResult.value.data));
            }
            setLoadingFormations(false);

            // Documents officiels + signed URLs
            if (docsResult.status === 'fulfilled') {
              const docs = docsResult.value?.data;
              if (docs && docs.length > 0) {
                setDocumentsOfficiels(docs);
                const urls: Record<number, string> = {};
                const urlPromises = docs.map(async (doc: any) => {
                  const { data: signedData } = await supabase.storage
                    .from('documents-officiels')
                    .createSignedUrl(doc.chemin_storage, 3600);
                  if (signedData?.signedUrl) urls[doc.id] = signedData.signedUrl;
                });
                await Promise.allSettled(urlPromises);
                setDocumentUrls(urls);
              }
            }

            // LMS progression portail
            if (lmsResult.status === 'fulfilled' && lmsResult.value?.data) {
              setLmsPortailProgression(lmsResult.value.data);
            }
          } else {
            setLoadingCertificats(false); setLoadingCamp(false); setLoadingFormations(false);
          }
          setLoading(false);
          return;
        }
      }

      // 🎯 MODE DÉMO
      const demoActive = isDemoActive();
      if (demoActive) {
        const groupe = getDemoGroupe();
        const demoAntecedents = groupe === 'Approuvé'
          ? { antecedents_statut: 'verifie', antecedents_date_verification: '2025-06-15', antecedents_date_expiration: '2028-06-15' }
          : { antecedents_statut: 'en_attente', antecedents_date_verification: null, antecedents_date_expiration: null };
        const demoRes = { ...DEMO_RESERVISTE, groupe, ...demoAntecedents, monday_created_at: '2025-03-12' };
        setUser(DEMO_USER);
        setReserviste(demoRes as any);
        
        if (groupe === 'Approuvé') {
          setCertificats([{ id: 'demo-cert-1', name: 'Certificat_Sinitier_Tremblay.pdf', url: '#' }]);
          setFormations(DEMO_FORMATIONS as any);
          setCampStatus({ is_certified: true, has_inscription: false, session_id: null, camp: null, lien_inscription: null });
        } else {
          setCertificats([]);
          setFormations([]);
          setCampStatus({ is_certified: false, has_inscription: false, session_id: null, camp: null, lien_inscription: null });
        }
        setLoadingCertificats(false);
        setLoadingCamp(false);
        setLoadingFormations(false);
        setLoading(false);
        return;
      }
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/login'); return; }
    setUser(user);

    // Vérifier emprunt d'identité
    let targetBenevoleId: string | null = null;
    try {
      const impRes = await fetch('/api/check-impersonate', { credentials: 'include' });
      if (impRes.ok) {
        const impData = await impRes.json();
        if (impData.isImpersonating && impData.benevole_id) {
          targetBenevoleId = impData.benevole_id;
        }
      }
    } catch (e) { console.error('Erreur check impersonate:', e); }

    let reservisteData = null;

    if (targetBenevoleId) {
      const { data: rpcData } = await supabase.rpc('get_reserviste_by_benevole_id', { target_benevole_id: targetBenevoleId });
      if (rpcData?.[0]) reservisteData = rpcData[0];
    } else {
      if (user.email) {
        const { data } = await supabase.from('reservistes').select(selectFields).ilike('email', user.email).single();
        reservisteData = data;
      }
      if (!reservisteData && user.phone) {
        const phoneDigits = user.phone.replace(/\D/g, '');
        const { data } = await supabase.from('reservistes').select(selectFields).eq('telephone', phoneDigits).single();
        if (!data) {
          const phoneWithout1 = phoneDigits.startsWith('1') ? phoneDigits.slice(1) : phoneDigits;
          const { data: data2 } = await supabase.from('reservistes').select(selectFields).eq('telephone', phoneWithout1).single();
          reservisteData = data2;
        } else { reservisteData = data; }
      }
    }

    if (reservisteData) {
      setReserviste(reservisteData);

      if (reservisteData.benevole_id) {
        // Charger tout en parallèle
        const bid = reservisteData.benevole_id;
        const [certResult, campResult, formResult, docsResult, lmsResult] = await Promise.allSettled([
          fetch(`https://n8n.aqbrs.ca/webhook/riusc-get-certificats?benevole_id=${bid}`).then(r => r.ok ? r.json() : null),
          fetch(`https://n8n.aqbrs.ca/webhook/camp-status?benevole_id=${bid}`).then(r => r.ok ? r.json() : null),
          supabase.rpc('get_formations_by_benevole_id', { target_benevole_id: bid }),
          supabase.rpc('get_documents_by_benevole_id', { target_benevole_id: bid }),
          supabase.from('lms_progression').select('statut, date_completion').eq('benevole_id', bid).eq('module_id', '148e3363-b889-41ce-85f2-72c9d5a36b3c').maybeSingle()
        ]);

        // Certificats
        if (certResult.status === 'fulfilled' && certResult.value?.success && certResult.value.files) {
          setCertificats(certResult.value.files);
        }
        setLoadingCertificats(false);

        // Camp status
        if (campResult.status === 'fulfilled' && campResult.value) {
          setCampStatus(campResult.value);
        }
        setLoadingCamp(false);

        // Formations (from Supabase RPC)
        if (formResult.status === 'fulfilled' && formResult.value?.data) {
          setFormations(await mapFormationsWithSignedUrls(formResult.value.data));
        }
        setLoadingFormations(false);

        // Documents officiels + signed URLs
        if (docsResult.status === 'fulfilled') {
          const docs = docsResult.value?.data;
          if (docs && docs.length > 0) {
            setDocumentsOfficiels(docs);
            const urls: Record<number, string> = {};
            const urlPromises = docs.map(async (doc: any) => {
              const { data: signedData } = await supabase.storage
                .from('documents-officiels')
                .createSignedUrl(doc.chemin_storage, 3600);
              if (signedData?.signedUrl) urls[doc.id] = signedData.signedUrl;
            });
            await Promise.allSettled(urlPromises);
            setDocumentUrls(urls);
          }
        }

        // LMS progression portail
        if (lmsResult.status === 'fulfilled' && lmsResult.value?.data) {
          setLmsPortailProgression(lmsResult.value.data);
        }
      } else {
        setLoadingCertificats(false);
        setLoadingCamp(false);
        setLoadingFormations(false);
      }
    } else {
      setLoadingCertificats(false);
      setLoadingCamp(false);
      setLoadingFormations(false);
    }

    setLoading(false);
  }

  const openCampModal = async () => {
    setShowCampModal(true); setLoadingSessions(true); setInscriptionError(null); setInscriptionSuccess(false); setSelectedSessionId('');
    setModalAllergiesAlim(reserviste?.allergies_alimentaires || '');
    setModalAllergiesAutres(reserviste?.allergies_autres || '');
    setModalConditions(reserviste?.conditions_medicales || '');
    setModalConsentPhoto(reserviste?.consent_photo || false);
    // 🎯 MODE DÉMO
    if (isDemoActive()) {
      setSessionsDisponibles([
        { session_id: 'demo-s1', nom: 'Cohorte 8 - Camp de qualification', dates: '12-13 avril 2026', site: 'Centre de formation de Nicolet', location: 'Nicolet, Québec' },
        { session_id: 'demo-s2', nom: 'Cohorte 9 - Camp de qualification', dates: '24-25 mai 2026', site: 'Base de plein air de Val-Cartier', location: 'Shannon, Québec' },
      ]);
      setLoadingSessions(false);
      return;
    }
    try {
      const response = await fetch('https://n8n.aqbrs.ca/webhook/sessions-camps');
      if (response.ok) { const data = await response.json(); if (data.success && data.sessions) setSessionsDisponibles(data.sessions); }
    } catch (e) { setInscriptionError('Impossible de charger les camps disponibles'); }
    setLoadingSessions(false);
  };
  const closeCampModal = () => { setShowCampModal(false); setSelectedSessionId(''); setInscriptionError(null); setInscriptionSuccess(false); };

  const handleSubmitInscription = async () => {
    if (!reserviste || !selectedSessionId) { setInscriptionError('Veuillez sélectionner un camp'); return; }
    if (!reserviste.consent_photo && !modalConsentPhoto) { setInscriptionError('Veuillez accepter le consentement photo/vidéo pour continuer.'); return; }
    // 🎯 MODE DÉMO
    if (isDemoActive()) {
      setInscriptionLoading(true);
      setTimeout(() => { setInscriptionSuccess(true); setInscriptionLoading(false); setTimeout(() => closeCampModal(), 2000); }, 1000);
      return;
    }
    setInscriptionLoading(true); setInscriptionError(null);
    try {
      const { error: updateError } = await supabase
        .from('reservistes')
        .update({
          allergies_alimentaires: modalAllergiesAlim || null,
          allergies_autres: modalAllergiesAutres || null,
          conditions_medicales: modalConditions || null,
          consent_photo: modalConsentPhoto
        })
        .eq('benevole_id', reserviste.benevole_id);

      if (updateError) console.error('Erreur sauvegarde allergies:', updateError);

      const response = await fetch('https://n8n.aqbrs.ca/webhook/inscription-camp', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          benevole_id: reserviste.benevole_id,
          session_id: selectedSessionId,
          presence: 'confirme',
          courriel: reserviste.email,
          telephone: reserviste.telephone || null,
          prenom_nom: `${reserviste.prenom} ${reserviste.nom}`,
          allergies_alimentaires: modalAllergiesAlim || null,
          allergies_autres: modalAllergiesAutres || null,
          conditions_medicales: modalConditions || null,
          consent_photo: modalConsentPhoto
        })
      });
      const data = await response.json();
      if (response.ok && data.success) { setInscriptionSuccess(true); setTimeout(() => { closeCampModal(); window.location.reload(); }, 2000); }
      else { setInscriptionError(data.error || "Erreur lors de l'inscription"); }
    } catch (e) { setInscriptionError('Erreur de connexion. Veuillez réessayer.'); }
    setInscriptionLoading(false);
  };

  const handleCancelInscription = async () => {
    if (!reserviste || !confirm('Êtes-vous sûr de vouloir annuler votre inscription au camp ?')) return;
    if (isDemoActive()) { setCampStatus({ is_certified: false, has_inscription: false, session_id: null, camp: null, lien_inscription: null }); return; }
    setCancellingInscription(true);
    try {
      const response = await fetch(`https://n8n.aqbrs.ca/webhook/camp-status?benevole_id=${reserviste.benevole_id}&action=cancel`, { method: 'POST' });
      if (response.ok) window.location.reload();
      else alert("Erreur lors de l'annulation. Veuillez réessayer.");
    } catch (e) { alert("Erreur lors de l'annulation. Veuillez réessayer."); }
    setCancellingInscription(false);
  };

  const isProfilComplet = !!(
    reserviste &&
    reserviste.prenom && reserviste.nom && reserviste.email && reserviste.telephone &&
    reserviste.date_naissance && reserviste.adresse && reserviste.ville && reserviste.region &&
    reserviste.contact_urgence_nom && reserviste.contact_urgence_telephone
  );

  // Statut antécédents judiciaires
  const antecedentsVerifie = reserviste?.antecedents_statut === 'verifie';
  const antecedentsExpire = reserviste?.antecedents_statut === 'expire' || (
    reserviste?.antecedents_date_expiration && new Date(reserviste.antecedents_date_expiration) < new Date()
  );
  const antecedentsDone = antecedentsVerifie && !antecedentsExpire;

  const antecedentsDescription = antecedentsDone
    ? `Vérifié${reserviste?.antecedents_date_expiration ? ` — expire le ${new Date(reserviste.antecedents_date_expiration + 'T12:00:00').toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' })}` : ''}`
    : antecedentsExpire
      ? 'Expiré — renouvellement requis'
      : 'En attente de vérification';

  // Statut S'initier à la sécurité civile
  const hasSinitier = formations.some(f => {
    const cat = (f.catalogue || f.nom || '').toLowerCase();
    return cat.includes('initier') || cat.includes("s'initier");
  });

  // Statut Découvrir et utiliser le portail RIUSC
  const hasDecouvrirPortail = lmsPortailProgression?.statut === 'complété' || formations.some(f => {
    const cat = (f.catalogue || f.nom || '').toLowerCase();
    return cat.includes('découvrir') && cat.includes('portail');
  });

  // Description camp selon statut
  const campDescription = campStatus?.is_certified
    ? 'Complété'
    : campStatus?.has_inscription
      ? 'Inscrit — en attente du camp'
      : "S'inscrire à un camp pratique de 2 jours";

  const steps = [
    { id: 'profil', label: 'Compléter mon profil', done: isProfilComplet, href: '/profil', onClick: null as (() => void) | null, emoji: '👤', description: isProfilComplet ? 'Profil complété' : 'Vérifiez et complétez vos informations personnelles' },
    { id: 'sinitier', label: "S'initier à la sécurité civile", done: hasSinitier, href: null, onClick: null as (() => void) | null, emoji: '🎓', description: hasSinitier ? 'Formation complétée' : 'Formation en ligne obligatoire (environ 1 h 45)' },
    { id: 'decouvrir_portail', label: 'Découvrir et utiliser le portail RIUSC', done: hasDecouvrirPortail, href: '/formation', onClick: null as (() => void) | null, emoji: '💻', description: hasDecouvrirPortail ? 'Formation complétée' : 'Formation en ligne sur le portail RIUSC' },
    { id: 'camp', label: 'Camp de qualification', done: campStatus?.is_certified || false, href: null, onClick: (!campStatus?.is_certified ? openCampModal : null) as (() => void) | null, emoji: '🏕️', description: campDescription },
    { id: 'antecedents', label: 'Antécédents judiciaires', done: antecedentsDone, href: null, onClick: null as (() => void) | null, emoji: '🔍', description: antecedentsDescription },
  ];
  const completedCount = steps.filter(s => s.done).length;
  const progressPercent = Math.round((completedCount / steps.length) * 100);
  const [checklistCollapsed, setChecklistCollapsed] = useState(false);
  useEffect(() => { if (completedCount === steps.length && steps.length > 0 && !loading) setChecklistCollapsed(true); }, [completedCount, loading]);

  // Upload certificat pour une formation spécifique
  const [uploadingForFormationId, setUploadingForFormationId] = useState<string | null>(null);
  const [editingDatesForId, setEditingDatesForId] = useState<string | null>(null);
  const dateReussiteRef = useRef<HTMLInputElement>(null);
  const dateExpirationRef = useRef<HTMLInputElement>(null);
  const [uploadingForFormationNom, setUploadingForFormationNom] = useState<string | null>(null);
  const [uploadedFormationIds, setUploadedFormationIds] = useState<Set<string>>(new Set());
  const formationCertInputRef = useRef<HTMLInputElement>(null);
  const [confirmSupprimerCertId, setConfirmSupprimerCertId] = useState<string | null>(null);
  const [suppressionEnCours, setSuppressionEnCours] = useState(false);

  const supprimerCertificat = async (formationId: string) => {
    if (!reserviste) return;
    setSuppressionEnCours(true);
    try {
      const formation = formations.find(f => f.id === formationId);
      if (formation?.fichiers?.[0]) {
        // Supprimer du storage si c'est un fichier portail
        const storageKey = `${reserviste.benevole_id}/${formationId}`;
        const { data: files } = await supabase.storage.from('certificats').list(reserviste.benevole_id);
        const toDelete = files?.find(f => f.name.startsWith(formationId));
        if (toDelete) {
          await supabase.storage.from('certificats').remove([`${reserviste.benevole_id}/${toDelete.name}`]);
        }
      }
      // Mettre à jour la DB
      await supabase.from('formations_benevoles').update({ certificat_url: null }).eq('id', formationId);
      // Synchroniser suppression avec Monday
      await fetch('https://n8n.aqbrs.ca/webhook/riusc-supprimer-certificat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formation_id: formationId, benevole_id: reserviste.benevole_id })
      }).catch(e => console.error('Erreur sync Monday suppression:', e));
      // Mettre à jour l'état local
      setFormations(prev => prev.map(f => f.id === formationId ? { ...f, has_fichier: false, fichiers: [] } : f));
      setUploadedFormationIds(prev => { const s = new Set(prev); s.delete(formationId); return s; });
      setCertificats([]);
    } catch (e) {
      console.error('Erreur suppression certificat:', e);
    }
    setSuppressionEnCours(false);
    setConfirmSupprimerCertId(null);
  };

  const handleFormationCertUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !reserviste || !reserviste.benevole_id) return;
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (!allowedTypes.includes(file.type)) { setCertificatMessage({ type: 'error', text: 'Format accepté : PDF, JPG ou PNG' }); return; }
    if (file.size > 10 * 1024 * 1024) { setCertificatMessage({ type: 'error', text: 'Le fichier ne doit pas dépasser 10 Mo' }); return; }

    setUploadingCertificat(true);
    setCertificatMessage(null);
    // 🎯 MODE DÉMO
    if (isDemoActive()) {
      setTimeout(() => {
        setCertificatMessage({ type: 'success', text: '✅ Mode démo — Certificat simulé avec succès !' });
        setUploadingCertificat(false);
      }, 1000);
      return;
    }
    try {
      // Trouver si c'est une formation portail (sans monday_item_id)
      const currentFormation = formations.find(f => f.id === uploadingForFormationId);
      const isPortailFormation = currentFormation && currentFormation.source === 'portail';

      if (isPortailFormation && uploadingForFormationId) {
        // Upload direct vers Supabase Storage pour formations portail
        const ext = file.name.split('.').pop() || 'pdf';
        const filePath = `${reserviste.benevole_id}/${uploadingForFormationId}.${ext}`;
        const { error: uploadError } = await supabase.storage.from('certificats').upload(filePath, file, { upsert: true });
        if (uploadError) { setCertificatMessage({ type: 'error', text: "Erreur lors de l'envoi : " + uploadError.message }); }
        else {
          // Stocker le path (pas l'URL publique) — on génère un signed URL à l'affichage
          const certPath = 'storage:' + filePath;
          await supabase.from('formations_benevoles').update({ certificat_url: certPath }).eq('id', uploadingForFormationId);
          const { data: signedData } = await supabase.storage.from('certificats').createSignedUrl(filePath, 3600);
          const signedUrl = signedData?.signedUrl || '#';
          setUploadedFormationIds(prev => new Set(prev).add(uploadingForFormationId));
          setFormations(prev => prev.map(f => f.id === uploadingForFormationId ? { ...f, has_fichier: true, fichiers: [{ name: file.name, url: signedUrl }] } : f));
          setCertificatMessage({ type: 'success', text: 'Certificat ajouté avec succès !' });
        }
      } else {
        // Upload via webhook n8n pour formations Monday
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const response = await fetch('https://n8n.aqbrs.ca/webhook/riusc-upload-certificat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            benevole_id: reserviste.benevole_id,
            file_name: file.name,
            file_base64: base64,
            formation_id: uploadingForFormationId || null,
            formation_nom: uploadingForFormationNom || null
          })
        });
        let data: any = null;
        try { data = await response.json(); } catch { data = null; }
        if (response.ok || data?.success || data === 1 || data === '1') {
          setCertificatMessage({ type: 'success', text: 'Certificat ajouté avec succès !' });
          if (uploadingForFormationId) {
            setUploadedFormationIds(prev => new Set(prev).add(uploadingForFormationId));
            await supabase.from('formations_benevoles').update({ certificat_url: data.url || file.name }).eq('id', uploadingForFormationId);
          } else {
            const res2 = await fetch(`https://n8n.aqbrs.ca/webhook/riusc-get-certificats?benevole_id=${reserviste.benevole_id}`);
            if (res2.ok) { const d2 = await res2.json(); if (d2.success && d2.files) setCertificats(d2.files); }
          }
        } else { setCertificatMessage({ type: 'error', text: data.error || "Erreur lors de l'envoi" }); }
      }
    } catch (e) { setCertificatMessage({ type: 'error', text: "Erreur lors de l'envoi" }); }
    setUploadingCertificat(false);
    setUploadingForFormationId(null);
    setUploadingForFormationNom(null);
    if (formationCertInputRef.current) formationCertInputRef.current.value = '';
  };

  if (loading) {
    const shimmer = `@keyframes shimmer { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }`;
    const skeletonBase: React.CSSProperties = { background: 'linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)', backgroundSize: '800px 100%', animation: 'shimmer 1.5s infinite ease-in-out', borderRadius: '6px' };
    const Bone = ({ w, h, r, mb, style }: { w?: string; h?: string; r?: string; mb?: string; style?: React.CSSProperties }) => (
      <div style={{ ...skeletonBase, width: w || '100%', height: h || '16px', borderRadius: r || '6px', marginBottom: mb || '0', ...style }} />
    );

    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
        <style>{shimmer}</style>

        {/* Skeleton Header */}
        <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', padding: '0 24px', height: '72px', display: 'flex', alignItems: 'center' }}>
          <div style={{ maxWidth: '1100px', margin: '0 auto', width: '100%', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Bone w="48px" h="48px" r="10px" />
            <div>
              <Bone w="160px" h="20px" mb="6px" />
              <Bone w="220px" h="14px" />
            </div>
          </div>
        </header>

        <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>
          {/* Breadcrumb */}
          <Bone w="130px" h="14px" mb="20px" />

          {/* Title + subtitle */}
          <Bone w="280px" h="28px" mb="10px" />
          <Bone w="380px" h="15px" mb="28px" />

          {/* Progress bar card */}
          <div style={{ backgroundColor: 'white', padding: '20px 24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '28px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
              <Bone w="220px" h="14px" />
              <Bone w="32px" h="14px" />
            </div>
            <Bone w="100%" h="8px" r="4px" mb="8px" />
            <Bone w="180px" h="12px" />
          </div>

          {/* Steps cards */}
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={{ backgroundColor: 'white', padding: '20px 24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '12px', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Bone w="44px" h="44px" r="50%" />
              <div style={{ flex: 1 }}>
                <Bone w={i === 1 ? '180px' : i === 2 ? '200px' : '220px'} h="15px" mb="8px" />
                <Bone w={i === 1 ? '260px' : i === 2 ? '300px' : '240px'} h="13px" />
              </div>
              <Bone w="28px" h="28px" r="50%" />
            </div>
          ))}

          {/* Separator MES FORMATIONS */}
          <div style={{ margin: '32px 0 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bone w="140px" h="12px" />
          </div>

          {/* Formations card */}
          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: '16px' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6' }}>
              <Bone w="200px" h="16px" mb="6px" />
              <Bone w="140px" h="13px" />
            </div>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ padding: '16px 24px', borderBottom: i < 3 ? '1px solid #f3f4f6' : 'none', display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <Bone w="40px" h="40px" r="50%" />
                <div style={{ flex: 1 }}>
                  <Bone w={`${180 + i * 30}px`} h="14px" mb="8px" />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <Bone w="90px" h="12px" />
                    <Bone w="60px" h="20px" r="12px" />
                    <Bone w="50px" h="20px" r="12px" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Separator RESSOURCES */}
          <div style={{ margin: '32px 0 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Bone w="110px" h="12px" />
          </div>

          {/* Resource cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ backgroundColor: 'white', padding: '20px 24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '16px' }}>
                <Bone w="36px" h="36px" r="8px" />
                <div style={{ flex: 1 }}>
                  <Bone w="140px" h="15px" mb="6px" />
                  <Bone w="190px" h="13px" />
                </div>
              </div>
            ))}
          </div>
        </main>

        {/* Footer */}
        <footer style={{ backgroundColor: '#1e3a5f', padding: '24px', textAlign: 'center', marginTop: '60px' }}>
          <Bone w="360px" h="14px" style={{ margin: '0 auto', background: 'linear-gradient(90deg, rgba(255,255,255,0.1) 25%, rgba(255,255,255,0.2) 50%, rgba(255,255,255,0.1) 75%)', backgroundSize: '800px 100%', animation: 'shimmer 1.5s infinite ease-in-out' }} />
        </footer>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      {/* Camp Modal */}
      {showCampModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '12px', padding: '32px', maxWidth: '550px', width: '100%', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            {inscriptionSuccess ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div style={{ width: '64px', height: '64px', backgroundColor: '#d1fae5', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="32" height="32" fill="none" stroke="#059669" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 style={{ color: '#065f46', margin: '0 0 10px 0', fontSize: '20px' }}>{campStatus?.has_inscription ? 'Modification confirmée' : 'Inscription confirmée'}</h3>
                <p style={{ color: '#4b5563', margin: 0 }}>Vous recevrez une confirmation par {reserviste?.telephone ? 'SMS' : 'courriel'}.</p>
              </div>
            ) : (
              <>
                <h3 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '22px', fontWeight: '600' }}>{campStatus?.has_inscription ? 'Modifier mon inscription' : 'Inscription au camp de qualification'}</h3>
                <p style={{ color: '#6b7280', margin: '0 0 24px 0', fontSize: '14px' }}>{campStatus?.has_inscription ? 'Sélectionnez un autre camp si vous souhaitez modifier votre inscription.' : 'Sélectionnez le camp auquel vous souhaitez participer.'}</p>
                <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', marginBottom: '20px', borderLeft: '4px solid #1e3a5f' }}>
                  <p style={{ margin: '0 0 8px 0', fontWeight: '600', color: '#1e3a5f', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vos informations</p>
                  <p style={{ margin: '4px 0', color: '#374151', fontSize: '14px' }}>{reserviste?.prenom} {reserviste?.nom}</p>
                  <p style={{ margin: '4px 0', color: '#6b7280', fontSize: '14px' }}>{reserviste?.email}</p>
                  {reserviste?.telephone && <p style={{ margin: '4px 0', color: '#6b7280', fontSize: '14px' }}>{reserviste.telephone}</p>}
                </div>
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', color: '#1e3a5f', fontSize: '14px' }}>Sélectionnez un camp de qualification</label>
                  {loadingSessions ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#6b7280', backgroundColor: '#f9fafb', borderRadius: '8px' }}>Chargement des camps disponibles...</div>
                  ) : sessionsDisponibles.filter(s => s.session_id !== campStatus?.session_id).length === 0 ? (
                    <div style={{ padding: '24px', textAlign: 'center', color: '#92400e', backgroundColor: '#fef3c7', borderRadius: '8px' }}>Aucun autre camp disponible pour le moment.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {sessionsDisponibles.filter(s => s.session_id !== campStatus?.session_id).sort((a, b) => a.nom.localeCompare(b.nom, 'fr-CA', { numeric: true })).map((session) => (
                        <label key={session.session_id} style={{ display: 'block', padding: '16px', border: selectedSessionId === session.session_id ? '2px solid #1e3a5f' : '1px solid #e5e7eb', borderRadius: '8px', cursor: 'pointer', backgroundColor: selectedSessionId === session.session_id ? '#f0f4f8' : 'white', transition: 'all 0.2s' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <input type="radio" name="session" value={session.session_id} checked={selectedSessionId === session.session_id} onChange={(e) => setSelectedSessionId(e.target.value)} style={{ marginTop: '4px' }} />
                            <div>
                              <div style={{ fontWeight: '600', color: '#111827', marginBottom: '6px' }}>{session.nom}</div>
                              <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>
                                {session.dates && <div>{session.dates}</div>}
                                {session.site && <div>{session.site}</div>}
                                {session.location && <div style={{ color: '#9ca3af' }}>{session.location}</div>}
                              </div>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#1e3a5f', fontSize: '14px' }}>Santé et allergies</label>
                  <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 12px 0', lineHeight: '1.5' }}>Ces informations nous aident à planifier les repas et assurer votre sécurité pendant le camp.</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#374151', fontWeight: '500' }}>Allergies alimentaires</label>
                      <input type="text" value={modalAllergiesAlim} onChange={(e) => setModalAllergiesAlim(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' as const }} placeholder="Ex : arachides, fruits de mer, gluten..." />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#374151', fontWeight: '500' }}>Autres allergies (médicaments, environnement)</label>
                      <input type="text" value={modalAllergiesAutres} onChange={(e) => setModalAllergiesAutres(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' as const }} placeholder="Ex : pénicilline, piqûres d'abeilles..." />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px', fontSize: '13px', color: '#374151', fontWeight: '500' }}>Conditions médicales</label>
                      <input type="text" value={modalConditions} onChange={(e) => setModalConditions(e.target.value)} style={{ width: '100%', padding: '10px 12px', fontSize: '14px', border: '1px solid #d1d5db', borderRadius: '6px', boxSizing: 'border-box' as const }} placeholder="Ex : asthme, diabète, épilepsie..." />
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#f0f9ff', padding: '12px 16px', borderRadius: '8px', marginTop: '12px', borderLeft: '4px solid #3b82f6' }}>
                    <p style={{ margin: 0, fontSize: '13px', color: '#1e40af', lineHeight: '1.5' }}>Nous faisons notre possible pour accommoder les préférences et restrictions alimentaires, mais ne pouvons garantir un menu adapté à chaque situation. Les allergies sévères (anaphylaxie) seront toutefois prises en charge — assurez-vous de bien les indiquer ci-dessus et d&apos;apporter vos médicaments (EpiPen, etc.).</p>
                  </div>
                </div>

                {!reserviste?.consent_photo && (
                  <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', padding: '16px', backgroundColor: modalConsentPhoto ? '#f0fdf4' : '#f9fafb', border: modalConsentPhoto ? '1px solid #86efac' : '1px solid #e5e7eb', borderRadius: '8px' }}>
                      <input type="checkbox" checked={modalConsentPhoto} onChange={(e) => setModalConsentPhoto(e.target.checked)} style={{ marginTop: '2px', width: '18px', height: '18px', flexShrink: 0 }} />
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827', marginBottom: '4px' }}>Consentement photo et vidéo</div>
                        <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: '1.5' }}>J&apos;autorise l&apos;AQBRS et la RIUSC à utiliser des photos et vidéos prises lors des camps et déploiements à des fins de communication, de promotion et de formation.</div>
                      </div>
                    </label>
                  </div>
                )}

                {inscriptionError && <div style={{ backgroundColor: '#fef2f2', color: '#dc2626', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '14px' }}>{inscriptionError}</div>}
                <p style={{ color: '#92400e', fontSize: '13px', margin: '0 0 24px 0', backgroundColor: '#fffbeb', padding: '12px 16px', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>En confirmant, vous vous engagez à être présent aux deux journées complètes du camp.</p>
                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                  <button onClick={closeCampModal} disabled={inscriptionLoading} style={{ padding: '12px 24px', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '14px', cursor: inscriptionLoading ? 'not-allowed' : 'pointer', fontWeight: '500' }}>Annuler</button>
                  <button onClick={handleSubmitInscription} disabled={inscriptionLoading || !selectedSessionId || loadingSessions || (!reserviste?.consent_photo && !modalConsentPhoto)}
                    style={{ padding: '12px 24px', backgroundColor: (inscriptionLoading || !selectedSessionId || (!reserviste?.consent_photo && !modalConsentPhoto)) ? '#9ca3af' : '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: (inscriptionLoading || !selectedSessionId || (!reserviste?.consent_photo && !modalConsentPhoto)) ? 'not-allowed' : 'pointer' }}>
                    {inscriptionLoading ? 'Traitement...' : campStatus?.has_inscription ? 'Confirmer la modification' : 'Confirmer mon inscription'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <PortailHeader subtitle="Formation et parcours du réserviste" />

      <ImpersonateBanner />
      <main style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 24px' }}>
        <a href="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>{'← Retour à l\'accueil'}</a>

        <h2 style={{ color: '#1e3a5f', margin: '20px 0 8px 0', fontSize: '26px', fontWeight: '700' }}>Parcours du réserviste</h2>
        <p style={{ color: '#6b7280', margin: '0 0 28px 0', fontSize: '15px' }}>
          Suivez ces étapes pour compléter votre intégration à la RIUSC.
          {reserviste?.monday_created_at && (
            <span style={{ marginLeft: '8px', color: '#9ca3af' }}>
              — Membre depuis {new Date(reserviste.monday_created_at).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long' })}
            </span>
          )}
        </p>

        {/* Barre de progression */}
        <div style={{ backgroundColor: 'white', padding: '20px 24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '28px', border: '1px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span onClick={() => setChecklistCollapsed(!checklistCollapsed)} style={{ fontSize: '14px', fontWeight: '600', color: '#1e3a5f', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>Progression des étapes obligatoires <svg width="14" height="14" fill="none" stroke="#6b7280" strokeWidth="2" viewBox="0 0 24 24" style={{ transform: checklistCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg></span>
            <span style={{ fontSize: '14px', fontWeight: '700', color: progressPercent === 100 ? '#059669' : '#1e3a5f' }}>{progressPercent}%</span>
          </div>
          <div style={{ height: '8px', backgroundColor: '#e5e7eb', borderRadius: '4px', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progressPercent}%`, backgroundColor: progressPercent === 100 ? '#059669' : '#1e3a5f', borderRadius: '4px', transition: 'width 0.5s ease' }} />
          </div>
          <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#9ca3af' }}>{completedCount}/{steps.length} étapes obligatoires complétées</p>
        </div>

        {/* Cartes des étapes */}
        {!checklistCollapsed && (<>
        {steps.map((step) => {
          const isLink = !!step.href && !step.done;
          const isClickable = isLink || (!!step.onClick && !step.done);
          const handleClick = () => { if (step.onClick && !step.done) step.onClick(); };
          return (
            <div key={step.id} onClick={!isLink ? handleClick : undefined}>
              {isLink ? (
                <a href={step.href!} style={{ textDecoration: 'none' }}>
                  <div style={{
                    backgroundColor: 'white',
                    padding: '16px 20px',
                    borderRadius: '12px',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    marginBottom: '12px',
                    border: step.done ? '1px solid #bbf7d0' : step.id === 'antecedents' && antecedentsExpire ? '1px solid #fca5a5' : '1px solid #e5e7eb',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.borderColor = '#1e3a5f'; }}
                  onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = step.done ? '#bbf7d0' : '#e5e7eb'; }}
                  >
                    <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: step.done ? '#d1fae5' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                      {step.done ? '✅' : step.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '15px', fontWeight: '600', color: step.done ? '#065f46' : '#1e3a5f' }}>{step.label}</div>
                      <div style={{ fontSize: '13px', color: step.done ? '#059669' : '#6b7280', marginTop: '2px' }}>{step.description}</div>
                    </div>
                    <svg width="20" height="20" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  </div>
                </a>
              ) : (
                <div style={{
                  backgroundColor: 'white',
                  padding: '16px 20px',
                  borderRadius: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  marginBottom: '12px',
                  border: step.done ? '1px solid #bbf7d0' : step.id === 'antecedents' && antecedentsExpire ? '1px solid #fca5a5' : '1px solid #e5e7eb',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  cursor: isClickable ? 'pointer' : 'default',
                  transition: 'all 0.2s',
                }}
                onMouseOver={(e) => { if (isClickable) { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.borderColor = '#1e3a5f'; } }}
                onMouseOut={(e) => { if (isClickable) { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = step.done ? '#bbf7d0' : step.id === 'antecedents' && antecedentsExpire ? '#fca5a5' : '#e5e7eb'; } }}
                >
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', backgroundColor: step.done ? '#d1fae5' : step.id === 'antecedents' && antecedentsExpire ? '#fef2f2' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                    {step.done ? '✅' : step.emoji}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '15px', fontWeight: '600', color: step.done ? '#065f46' : '#1e3a5f' }}>{step.label}</div>
                    <div style={{ fontSize: '13px', color: step.done ? '#059669' : '#6b7280', marginTop: '2px' }}>{step.description}</div>
                  </div>
                  {step.done ? (
                    <svg width="24" height="24" fill="none" stroke="#059669" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  ) : isClickable ? (
                    <svg width="20" height="20" fill="none" stroke="#9ca3af" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                  ) : step.id === 'antecedents' && antecedentsExpire ? (
                    <span style={{ padding: '4px 10px', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>Expiré</span>
                  ) : (
                    <span style={{ padding: '4px 10px', backgroundColor: '#f3f4f6', color: '#6b7280', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>En attente</span>
                  )}
                </div>
              )}
            </div>
          );
        })}
        </>)}

        {/* Hidden input pour upload certificat formation */}
        <input ref={formationCertInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFormationCertUpload} style={{ display: 'none' }} />

        {certificatMessage && (
          <div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', backgroundColor: certificatMessage.type === 'success' ? '#d1fae5' : '#fef2f2', color: certificatMessage.type === 'success' ? '#065f46' : '#dc2626', fontSize: '14px' }}>
            {certificatMessage.text}
          </div>
        )}

        {/* SECTION : Mes formations complétées */}
        {!loadingFormations && (formations.length > 0 || lmsPortailProgression?.statut === 'complété') && (
          <>
            <div style={{ margin: '32px 0 24px 0', borderTop: '1px solid #e5e7eb', position: 'relative' }}>
              <span style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#f5f7fa', padding: '0 16px', fontSize: '13px', color: '#9ca3af', fontWeight: '600' }}>MES FORMATIONS</span>
            </div>

            <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: '16px' }}>
              <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6' }}>
                <div style={{ fontSize: '16px', fontWeight: '600', color: '#1e3a5f' }}>Formations complétées</div>
                <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>{formations.length + (lmsPortailProgression?.statut === 'complété' ? 1 : 0)} formation{(formations.length + (lmsPortailProgression?.statut === 'complété' ? 1 : 0)) > 1 ? 's' : ''} au dossier</div>
              </div>

              <div style={{ padding: '0' }}>
                {formations
                  .sort((a, b) => (b.date_reussite || '').localeCompare(a.date_reussite || ''))
                  .map((f, index) => {
                    const cat = f.catalogue?.toLowerCase() || '';
                    // Matching certificats selon le type de formation
                    const isInitier = cat.includes('initier') || cat.includes('s\'initier');
                    const isCamp = cat.includes('camp') || cat.includes('qualification');
                    const isCohorte = cat.includes('cohorte');
                    const certDoc = isCohorte ? documentsOfficiels.find(d => d.type_document === 'certificat') : null;
                    const lettreDoc = isCohorte ? documentsOfficiels.find(d => d.type_document === 'lettre') : null;
                    const hasCert = uploadedFormationIds.has(f.id) || f.has_fichier || (isInitier ? (certificats.length > 0 || uploadedFormationIds.has(f.id)) : isCohorte ? !!certDoc : false);

                    return (
                  <div key={f.id} style={{ padding: '16px 24px', borderBottom: index < formations.length - 1 ? '1px solid #f3f4f6' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                        🎓
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Ligne titre + badges — tout sur une ligne en desktop */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>{f.catalogue}</div>
                          {f.date_reussite && (
                            <span style={{ fontSize: '12px', color: '#6b7280' }}>
                              {new Date(f.date_reussite + 'T12:00:00').toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                          )}
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {f.role && (
                              <span style={{ display: 'inline-block', padding: '2px 10px', backgroundColor: f.role === 'Instructeur' ? '#fef3c7' : '#f3f4f6', color: f.role === 'Instructeur' ? '#92400e' : '#374151', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>
                                {f.role}
                              </span>
                            )}
                            {f.resultat && f.resultat === 'En attente' && f.certificat_requis && !hasCert ? (
                              <button onClick={() => { if (editingDatesForId === f.id) { setEditingDatesForId(null); } else { setEditingDatesForId(f.id); } }} style={{ display: 'inline-block', padding: '2px 10px', backgroundColor: '#fef2f2', color: '#dc2626', borderRadius: '20px', fontSize: '11px', fontWeight: '600', border: '1px solid #fca5a5', cursor: 'pointer' }}>⚠️ Certificat manquant</button>
                            ) : f.resultat ? (
                              <span style={{ display: 'inline-block', padding: '2px 10px', backgroundColor: f.resultat === 'Réussi' ? '#ecfdf5' : '#fef3c7', color: f.resultat === 'Réussi' ? '#065f46' : '#92400e', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>
                                {f.resultat}
                              </span>
                            ) : null}
                            {f.etat_validite && (
                              <span style={{ display: 'inline-block', padding: '2px 10px', backgroundColor: f.etat_validite === 'À jour' ? '#eff6ff' : '#fef2f2', color: f.etat_validite === 'À jour' ? '#1e40af' : '#dc2626', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>
                                {f.etat_validite}
                              </span>
                            )}
                          </div>
                        </div>
                        {f.date_expiration && (
                          <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>Expire le {new Date(f.date_expiration + 'T12:00:00').toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                        )}

                        {/* Documents liés — S'initier : certificats du webhook */}
                        {isInitier && certificats.length > 0 && (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                            {certificats.map((cert) => (
                              <div key={cert.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <a href={cert.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', fontSize: '12px', color: '#166534', textDecoration: 'none', fontWeight: '500' }}>
                                  📄 {cert.name}
                                </a>
                                {confirmSupprimerCertId === f.id ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                                    <span style={{ color: '#6b7280' }}>Retirer ?</span>
                                    <button onClick={() => supprimerCertificat(f.id)} disabled={suppressionEnCours}
                                      style={{ padding: '2px 8px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}>
                                      {suppressionEnCours ? '...' : 'Oui'}
                                    </button>
                                    <button onClick={() => setConfirmSupprimerCertId(null)}
                                      style={{ padding: '2px 8px', backgroundColor: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                                      Non
                                    </button>
                                  </span>
                                ) : (
                                  <button onClick={() => setConfirmSupprimerCertId(f.id)}
                                    title="Retirer le certificat"
                                    style={{ padding: '4px 6px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', opacity: 0.5, lineHeight: 1 }}
                                    onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                                    onMouseOut={(e) => e.currentTarget.style.opacity = '0.5'}>
                                    🗑️
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Bouton upload S'initier si pas de certificat */}
                        {isInitier && certificats.length === 0 && !uploadedFormationIds.has(f.id) && !f.has_fichier && (
                          <div style={{ marginTop: '8px' }}>
                            <button
                              onClick={() => { setUploadingForFormationId(f.id); setUploadingForFormationNom(f.catalogue || f.nom); formationCertInputRef.current?.click(); }}
                              disabled={uploadingCertificat}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '12px', color: '#dc2626', fontWeight: '500', cursor: uploadingCertificat ? 'not-allowed' : 'pointer' }}
                            >
                              {uploadingCertificat && uploadingForFormationId === f.id ? '⏳ Envoi...' : '📤 Ajouter un certificat'}
                            </button>
                          </div>
                        )}

                        {/* Documents liés — Camp : certificat + lettre */}
                        {isCohorte && (certDoc || lettreDoc) && (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                            {certDoc && documentUrls[certDoc.id] && (
                              <a href={documentUrls[certDoc.id]} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', fontSize: '12px', color: '#166534', textDecoration: 'none', fontWeight: '500' }}>
                                📄 Certificat
                              </a>
                            )}
                            {certDoc && !documentUrls[certDoc.id] && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', fontSize: '12px', color: '#166534', fontWeight: '500' }}>
                                ✅ Certificat au dossier
                              </span>
                            )}
                            {lettreDoc && documentUrls[lettreDoc.id] && (
                              <a href={documentUrls[lettreDoc.id]} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '12px', color: '#1e40af', textDecoration: 'none', fontWeight: '500' }}>
                                📄 Lettre d&apos;attestation
                              </a>
                            )}
                            {lettreDoc && !documentUrls[lettreDoc.id] && (
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '6px', fontSize: '12px', color: '#1e40af', fontWeight: '500' }}>
                                ✅ Lettre au dossier
                              </span>
                            )}
                          </div>
                        )}

                        {/* Badge certificat au dossier (fichier Monday) — pour toute formation avec fichier */}
                        {(uploadedFormationIds.has(f.id) || f.has_fichier) && !(isInitier && certificats.length > 0) && !(isCohorte && (certDoc || lettreDoc)) && (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', flexWrap: 'wrap' }}>
                            {f.fichiers && f.fichiers.length > 0 ? (
                              f.fichiers.map((fichier, fi) => (
                                <div key={fi} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  {fichier.url ? (
                                    <a href={fichier.url} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', fontSize: '12px', color: '#166534', textDecoration: 'none', fontWeight: '500', cursor: 'pointer' }}>
                                      📄 {fichier.name}
                                    </a>
                                  ) : (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', fontSize: '12px', color: '#166534', fontWeight: '500' }}>
                                      ✅ {fichier.name}
                                    </span>
                                  )}
                                  {confirmSupprimerCertId === f.id ? (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                                      <span style={{ color: '#6b7280' }}>Retirer ?</span>
                                      <button onClick={() => supprimerCertificat(f.id)} disabled={suppressionEnCours}
                                        style={{ padding: '2px 8px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}>
                                        {suppressionEnCours ? '...' : 'Oui'}
                                      </button>
                                      <button onClick={() => setConfirmSupprimerCertId(null)}
                                        style={{ padding: '2px 8px', backgroundColor: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                                        Non
                                      </button>
                                    </span>
                                  ) : (
                                    <button onClick={() => setConfirmSupprimerCertId(f.id)}
                                      title="Retirer le certificat"
                                      style={{ padding: '4px 6px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', opacity: 0.5, lineHeight: 1 }}
                                      onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                                      onMouseOut={(e) => e.currentTarget.style.opacity = '0.5'}>
                                      🗑️
                                    </button>
                                  )}
                                </div>
                              ))
                            ) : (
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px', fontSize: '12px', color: '#166534', fontWeight: '500' }}>
                                  ✅ Certificat au dossier
                                </span>
                                {confirmSupprimerCertId === f.id ? (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '12px' }}>
                                    <span style={{ color: '#6b7280' }}>Retirer ?</span>
                                    <button onClick={() => supprimerCertificat(f.id)} disabled={suppressionEnCours}
                                      style={{ padding: '2px 8px', backgroundColor: '#dc2626', color: 'white', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer', fontWeight: '600' }}>
                                      {suppressionEnCours ? '...' : 'Oui'}
                                    </button>
                                    <button onClick={() => setConfirmSupprimerCertId(null)}
                                      style={{ padding: '2px 8px', backgroundColor: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '4px', fontSize: '11px', cursor: 'pointer' }}>
                                      Non
                                    </button>
                                  </span>
                                ) : (
                                  <button onClick={() => setConfirmSupprimerCertId(f.id)}
                                    title="Retirer le certificat"
                                    style={{ padding: '4px 6px', backgroundColor: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px', opacity: 0.5, lineHeight: 1 }}
                                    onMouseOver={(e) => e.currentTarget.style.opacity = '1'}
                                    onMouseOut={(e) => e.currentTarget.style.opacity = '0.5'}>
                                    🗑️
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Bouton upload si pas de certificat */}
                        {!hasCert && f.certificat_requis && (
                          <div style={{ marginTop: '8px' }}>
                            <button
                              onClick={() => { setUploadingForFormationId(f.id); setUploadingForFormationNom(f.catalogue || f.nom); formationCertInputRef.current?.click(); }}
                              disabled={uploadingCertificat}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 12px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '6px', fontSize: '12px', color: '#dc2626', fontWeight: '500', cursor: uploadingCertificat ? 'not-allowed' : 'pointer', opacity: uploadingCertificat && uploadingForFormationId === f.id ? 0.7 : 1 }}
                            >
                              {uploadingCertificat && uploadingForFormationId === f.id ? '⏳ Envoi...' : '📤 Ajouter un certificat'}
                            </button>
                          </div>
                        )}

                        {/* Champs date pour formations portail En attente */}
                        {f.certificat_requis && editingDatesForId === f.id && (
                          <div style={{ marginTop: '12px', padding: '12px 16px', backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px' }}>
                            <div style={{ fontSize: '12px', fontWeight: '600', color: '#92400e', marginBottom: '8px' }}>Complétez votre formation</div>
                            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
                              <div>
                                <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Date de réussite</label>
                                <input type="date" ref={dateReussiteRef} defaultValue={f.date_reussite || ""} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }} />
                              </div>
                              <div>
                                <label style={{ fontSize: '11px', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Date d&apos;expiration (optionnel)</label>
                                <input type="date" ref={dateExpirationRef} defaultValue={f.date_expiration || ""} style={{ padding: '6px 10px', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '13px' }} />
                              </div>
                              <button onClick={async () => { const dr = dateReussiteRef.current?.value || ''; const de = dateExpirationRef.current?.value || ''; if (!dr) return; await supabase.from('formations_benevoles').update({ date_reussite: dr, date_expiration: de || null, a_expiration: !!de, resultat: 'Réussi', etat_validite: 'À jour' }).eq('id', f.id); setFormations(prev => prev.map(fm => fm.id === f.id ? { ...fm, date_reussite: dr, date_expiration: de || null, resultat: 'Réussi', etat_validite: 'À jour' } : fm)); setEditingDatesForId(null); }} style={{ padding: '6px 16px', borderRadius: '6px', border: 'none', backgroundColor: '#1e3a5f', color: 'white', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>Confirmer</button>
                              <button onClick={() => setEditingDatesForId(null)} style={{ padding: '6px 16px', borderRadius: '6px', border: '1px solid #d1d5db', backgroundColor: 'white', color: '#374151', fontSize: '13px', cursor: 'pointer' }}>Annuler</button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                    );
                  })}

                {/* Entrée LMS — Découvrir et utiliser le portail RIUSC */}
                {lmsPortailProgression?.statut === 'complété' && (
                  <div style={{ padding: '16px 24px', borderTop: formations.length > 0 ? '1px solid #f3f4f6' : 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                        💻
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                          <div style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>Découvrir et utiliser le portail RIUSC</div>
                          {lmsPortailProgression.date_completion && (
                            <span style={{ fontSize: '12px', color: '#6b7280' }}>
                              {new Date(lmsPortailProgression.date_completion).toLocaleDateString('fr-CA', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </span>
                          )}
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            <span style={{ display: 'inline-block', padding: '2px 10px', backgroundColor: '#ecfdf5', color: '#065f46', borderRadius: '20px', fontSize: '11px', fontWeight: '600' }}>Réussi</span>
                            <span style={{ display: 'inline-block', padding: '2px 10px', backgroundColor: '#eff6ff', color: '#1e40af', borderRadius: '12px', fontSize: '11px', fontWeight: '600' }}>Formation en ligne</span>
                          </div>
                        </div>
                        <div style={{ fontSize: '12px', color: '#9ca3af' }}>Portail RIUSC — Premiers pas pour les nouveaux réservistes</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {/* État vide — aucune formation au dossier */}
        {!loadingFormations && formations.length === 0 && !lmsPortailProgression && (
          <>
            <div style={{ margin: '32px 0 24px 0', borderTop: '1px solid #e5e7eb', position: 'relative' }}>
              <span style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#f5f7fa', padding: '0 16px', fontSize: '13px', color: '#9ca3af', fontWeight: '600' }}>MES FORMATIONS</span>
            </div>

            <div style={{ backgroundColor: 'white', border: '2px solid #f59e0b', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
                Formation et certificats
              </h3>

              <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '8px', padding: '20px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  <span style={{ fontSize: '24px' }}>⚠️</span>
                  <div>
                    <p style={{ margin: '0 0 12px 0', fontWeight: '600', color: '#92400e', fontSize: '15px' }}>
                      Formation obligatoire requise
                    </p>
                    <p style={{ margin: '0 0 16px 0', color: '#78350f', fontSize: '14px', lineHeight: '1.6' }}>
                      Pour compléter votre inscription à la RIUSC, vous devez suivre la formation
                      <strong> « S&apos;initier à la sécurité civile »</strong> sur la plateforme du Centre RISC,
                      puis nous soumettre votre certificat de réussite.
                    </p>
                    <div style={{ backgroundColor: 'white', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                      <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#6b7280' }}><strong>Durée :</strong> environ 1 h 45</p>
                      <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#6b7280' }}><strong>Contenu :</strong> 5 modules à suivre à votre rythme</p>
                      <p style={{ margin: 0, fontSize: '13px', color: '#6b7280' }}><strong>Délai :</strong> 30 jours après votre inscription</p>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                      <a href="https://campusnotredamedefoy.centrerisc.com/Web/MyCatalog/ViewP?pid=94b7f%2bJXTOIEwqbEfBzzBw%3d%3d&id=fkpM7dqJ0YA0hLjtTwfqvg%3d%3d" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
                        🎓 Accéder à la formation
                      </a>
                      <a href="https://rsestrie-my.sharepoint.com/:v:/g/personal/dany_chaput_rsestrie_org/EcWyUX-i-DNPnQI7RmYgdiIBkORhzpF_1NimfhVb5kQyHw" target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', backgroundColor: 'white', color: '#374151', border: '1px solid #d1d5db', borderRadius: '6px', textDecoration: 'none', fontSize: '14px', fontWeight: '500' }}>
                        📺 Tutoriel vidéo
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '0' }}>
                <input ref={formationCertInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={handleFormationCertUpload} style={{ display: 'none' }} />
                <button onClick={() => { setUploadingForFormationId(null); setUploadingForFormationNom('S\'initier à la sécurité civile'); formationCertInputRef.current?.click(); }} disabled={uploadingCertificat} style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: '#059669', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '500', cursor: uploadingCertificat ? 'not-allowed' : 'pointer', opacity: uploadingCertificat ? 0.7 : 1 }}>
                  {uploadingCertificat ? '⏳ Envoi en cours...' : '📤 Soumettre mon certificat'}
                </button>
                <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: '#9ca3af' }}>Formats acceptés : PDF, JPG, PNG (max 10 Mo)</p>
              </div>
            </div>

            {/* Camp de qualification — si pas encore certifié */}
            {!campStatus?.is_certified && (
              <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '24px', border: '1px solid #e5e7eb' }}>
                <h3 style={{ color: '#1e3a5f', margin: '0 0 12px 0', fontSize: '18px', fontWeight: '600' }}>
                  🏕️ Camp de qualification
                </h3>
                {campStatus?.has_inscription && campStatus.camp ? (
                  <div>
                    <div style={{ display: 'inline-block', padding: '4px 12px', backgroundColor: '#fef3c7', color: '#92400e', borderRadius: '12px', fontSize: '13px', fontWeight: '600', marginBottom: '12px' }}>⏳ Inscrit — en attente du camp</div>
                    <div style={{ backgroundColor: '#f9fafb', padding: '16px', borderRadius: '8px', marginBottom: '16px' }}>
                      <div style={{ fontWeight: '600', color: '#111827', marginBottom: '8px' }}>{campStatus.camp.nom}</div>
                      <div style={{ fontSize: '14px', color: '#4b5563', lineHeight: '1.6' }}>
                        {campStatus.camp.dates && <div>{campStatus.camp.dates}</div>}
                        {campStatus.camp.site && <div>{campStatus.camp.site}</div>}
                        {campStatus.camp.location && <div style={{ color: '#6b7280' }}>{campStatus.camp.location}</div>}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p style={{ color: '#6b7280', marginBottom: '16px', fontSize: '14px' }}>Pour devenir réserviste certifié, vous devez compléter un camp de qualification pratique de 2 jours.</p>
                    <button onClick={openCampModal} style={{ padding: '12px 24px', backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'background-color 0.2s' }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2d4a6f'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#1e3a5f'}>
                      S&apos;inscrire à un camp de qualification
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {loadingFormations && (
          <div style={{ backgroundColor: 'white', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', overflow: 'hidden', marginBottom: '16px' }}>
            <style>{`@keyframes shimmerInline { 0% { background-position: -400px 0; } 100% { background-position: 400px 0; } }`}</style>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ width: '200px', height: '16px', marginBottom: '6px', background: 'linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)', backgroundSize: '800px 100%', animation: 'shimmerInline 1.5s infinite ease-in-out', borderRadius: '6px' }} />
              <div style={{ width: '140px', height: '13px', background: 'linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)', backgroundSize: '800px 100%', animation: 'shimmerInline 1.5s infinite ease-in-out', borderRadius: '6px' }} />
            </div>
            {[1, 2].map(i => (
              <div key={i} style={{ padding: '16px 24px', borderBottom: i < 2 ? '1px solid #f3f4f6' : 'none', display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)', backgroundSize: '800px 100%', animation: 'shimmerInline 1.5s infinite ease-in-out', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ width: `${170 + i * 40}px`, height: '14px', marginBottom: '8px', background: 'linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)', backgroundSize: '800px 100%', animation: 'shimmerInline 1.5s infinite ease-in-out', borderRadius: '6px' }} />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ width: '90px', height: '12px', background: 'linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)', backgroundSize: '800px 100%', animation: 'shimmerInline 1.5s infinite ease-in-out', borderRadius: '6px' }} />
                    <div style={{ width: '60px', height: '20px', background: 'linear-gradient(90deg, #e5e7eb 25%, #f3f4f6 50%, #e5e7eb 75%)', backgroundSize: '800px 100%', animation: 'shimmerInline 1.5s infinite ease-in-out', borderRadius: '12px' }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Séparateur RESSOURCES */}
        <div style={{ margin: '32px 0 24px 0', borderTop: '1px solid #e5e7eb', position: 'relative' }}>
          <span style={{ position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)', backgroundColor: '#f5f7fa', padding: '0 16px', fontSize: '13px', color: '#9ca3af', fontWeight: '600' }}>RESSOURCES</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          {isApproved && (
            <a href="/dossier" style={{ textDecoration: 'none' }}>
              <div style={{ backgroundColor: 'white', padding: '20px 24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '16px', transition: 'all 0.2s', cursor: 'pointer' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = '#1e3a5f'; }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '#e5e7eb'; }}>
                <span style={{ fontSize: '28px' }}>📋</span>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e3a5f' }}>Mon dossier réserviste</div>
                  <div style={{ fontSize: '13px', color: '#6b7280' }}>Compétences et certifications</div>
                </div>
              </div>
            </a>
          )}
          <a href="/informations" style={{ textDecoration: 'none' }}>
            <div style={{ backgroundColor: 'white', padding: '20px 24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '16px', transition: 'all 0.2s', cursor: 'pointer' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = '#1e3a5f'; }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '#e5e7eb'; }}>
              <span style={{ fontSize: '28px' }}>📚</span>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e3a5f' }}>Informations pratiques</div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>Documents, ressources et références</div>
              </div>
            </div>
          </a>
          <a href="/communaute" style={{ textDecoration: 'none' }}>
            <div style={{ backgroundColor: 'white', padding: '20px 24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: '16px', transition: 'all 0.2s', cursor: 'pointer' }} onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.borderColor = '#1e3a5f'; }} onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = '#e5e7eb'; }}>
              <span style={{ fontSize: '28px' }}>💬</span>
              <div>
                <div style={{ fontSize: '15px', fontWeight: '600', color: '#1e3a5f' }}>Communauté</div>
                <div style={{ fontSize: '13px', color: '#6b7280' }}>Échangez avec les réservistes</div>
              </div>
            </div>
          </a>
        </div>
      </main>

      <ImpersonateBanner position="bottom" />

      <footer style={{ backgroundColor: '#1e3a5f', color: 'white', padding: '24px', textAlign: 'center', marginTop: '60px' }}>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>© 2026 AQBRS - Association québécoise des bénévoles en recherche et sauvetage</p>
      </footer>
    </div>
  );
}

export default function FormationPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px' }}>
        <div style={{ width: '48px', height: '48px', border: '4px solid #e5e7eb', borderTopColor: '#1e3a5f', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <FormationContent />
    </Suspense>
  );
}