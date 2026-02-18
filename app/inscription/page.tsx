'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useState, useRef, useCallback, useEffect } from 'react'
import Image from 'next/image'

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''

interface MapboxFeature {
  place_name: string;
  center: [number, number];
  context?: Array<{
    id: string;
    text: string;
  }>;
}

function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return phone
}

function cleanPhoneForSave(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length === 10) {
    return '1' + digits
  }
  return digits
}

const GROUPES_RS = [
  'District 1: Équipe de RS La Grande-Ourse',
  'District 1: EBRES du KRTB',
  'District 2: Sauvetage Région 02',
  'District 3: Recherche et Sauvetage Québec-Métro (RSQM)',
  'District 3: Recherche Sauvetage Tourville',
  'District 4: Eurêka Recherche et sauvetage',
  'District 4: SIUCQ Drummondville',
  'District 4: SIUCQ MRC Arthabaska',
  'District 4: SIUSQ Division Mauricie',
  'District 4: Sauvetage Mauricie K9',
  'District 5: Recherche Sauvetage Estrie',
  "District 6: Sauvetage Baie-D'Urfé",
  'District 6: Ambulance St-Jean - Div. 971 Laval',
  'District 6: Québec Secours',
  'District 6: Pointe-Claire Rescue',
  'District 6: Recherche Sauvetage Laurentides Lanaudière',
  'District 6: S&R Balise Beacon R&S',
  'District 7: Sauvetage Bénévole Outaouais',
  'District 7: SAR 360',
  'District 8: Recherche et sauvetage du Témiscamingue R.E.S.Tem',
  'District 9: Groupe de recherche Manicouagan'
]

interface Organisation {
  id: string
  nom: string
}

export default function InscriptionPage() {
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'form' | 'success'>('form')
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  
  const [formData, setFormData] = useState({
    prenom: '',
    nom: '',
    email: '',
    telephone: '',
    adresse: '',
    ville: '',
    region: '',
    latitude: null as number | null,
    longitude: null as number | null,
    groupe_rs: '',
    commentaire: '',
    confirm_18: false,
    consent_photos: false,
    consent_confidentialite: false
  })

  // ─── Organisations ──────────────────────────────────────────────────────────
  const [allOrgs, setAllOrgs] = useState<Organisation[]>([])
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>([])
  const [newOrgName, setNewOrgName] = useState('')
  const [showNewOrgInput, setShowNewOrgInput] = useState(false)
  const [loadingOrgs, setLoadingOrgs] = useState(true)
  // ────────────────────────────────────────────────────────────────────────────
  
  const [addressSuggestions, setAddressSuggestions] = useState<MapboxFeature[]>([])
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false)
  const [isLoadingAddress, setIsLoadingAddress] = useState(false)
  const addressInputRef = useRef<HTMLInputElement>(null)
  const addressDropdownRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const [villeSuggestions, setVilleSuggestions] = useState<Array<{ municipalite: string; region_administrative: string; mrc: string }>>([])
  const [showVilleSuggestions, setShowVilleSuggestions] = useState(false)
  const [isLoadingVille, setIsLoadingVille] = useState(false)
  const villeInputRef = useRef<HTMLInputElement>(null)
  const villeDropdownRef = useRef<HTMLDivElement>(null)
  const villeDebounceRef = useRef<NodeJS.Timeout | null>(null)
  
  const router = useRouter()
  const supabase = createClient()

  const [campId, setCampId] = useState('')
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    setCampId(params.get('camp') || '')
    const emailParam = params.get('email')
    if (emailParam) {
      setFormData(prev => ({ ...prev, email: emailParam }))
    }
  }, [])

  // Charger les organisations au démarrage
  useEffect(() => {
    const fetchOrgs = async () => {
      const { data } = await supabase
        .from('organisations')
        .select('id, nom')
        .order('nom')
      setAllOrgs(data || [])
      setLoadingOrgs(false)
    }
    fetchOrgs()
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addressDropdownRef.current && !addressDropdownRef.current.contains(event.target as Node) &&
          addressInputRef.current && !addressInputRef.current.contains(event.target as Node)) {
        setShowAddressSuggestions(false)
      }
      if (villeDropdownRef.current && !villeDropdownRef.current.contains(event.target as Node) &&
          villeInputRef.current && !villeInputRef.current.contains(event.target as Node)) {
        setShowVilleSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (fieldErrors[field]) {
      setFieldErrors(prev => ({ ...prev, [field]: '' }))
    }
  }

  const handlePhoneBlur = () => {
    setFormData(prev => ({ ...prev, telephone: formatPhoneDisplay(prev.telephone) }))
  }

  const toggleOrg = (id: string) => {
    setSelectedOrgIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
    if (fieldErrors.organisations) {
      setFieldErrors(prev => ({ ...prev, organisations: '' }))
    }
  }

  const searchAddress = useCallback(async (query: string) => {
    if (query.length < 3) { setAddressSuggestions([]); return }
    setIsLoadingAddress(true)
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${MAPBOX_TOKEN}&country=ca&language=fr&types=address&limit=5`
      )
      const data = await response.json()
      setAddressSuggestions(data.features || [])
      setShowAddressSuggestions(true)
    } catch (error) { console.error('Erreur recherche adresse:', error) }
    setIsLoadingAddress(false)
  }, [])

  const handleAddressChange = (value: string) => {
    setFormData(prev => ({ ...prev, adresse: value, latitude: null, longitude: null }))
    if (fieldErrors.adresse) setFieldErrors(prev => ({ ...prev, adresse: '' }))
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => searchAddress(value), 300)
  }

  const lookupRegionFromVille = async (ville: string) => {
    if (!ville) return
    const { data } = await supabase
      .from('municipalites_qc')
      .select('region_administrative')
      .ilike('municipalite', ville)
      .limit(1)
      .single()
    if (data) {
      setFormData(prev => ({ ...prev, region: data.region_administrative }))
      if (fieldErrors.region) setFieldErrors(prev => ({ ...prev, region: '' }))
    }
  }

  const selectAddress = (feature: MapboxFeature) => {
    const [lng, lat] = feature.center
    let ville = ''
    if (feature.context) {
      const placeContext = feature.context.find(c => c.id.startsWith('place'))
      if (placeContext) ville = placeContext.text
    }
    setFormData(prev => ({ ...prev, adresse: feature.place_name, latitude: lat, longitude: lng, ville: ville || prev.ville }))
    setShowAddressSuggestions(false)
    setAddressSuggestions([])
    if (ville) lookupRegionFromVille(ville)
  }

  const searchVille = async (query: string) => {
    if (query.length < 2) { setVilleSuggestions([]); return }
    setIsLoadingVille(true)
    try {
      const { data, error } = await supabase
        .from('municipalites_qc')
        .select('municipalite, region_administrative, mrc')
        .ilike('municipalite', `${query}%`)
        .order('municipalite')
        .limit(8)
      if (!error && data) { setVilleSuggestions(data); setShowVilleSuggestions(true) }
    } catch (e) { console.error('Erreur recherche ville:', e) }
    setIsLoadingVille(false)
  }

  const handleVilleChange = (value: string) => {
    setFormData(prev => ({ ...prev, ville: value, region: '' }))
    if (fieldErrors.region) setFieldErrors(prev => ({ ...prev, region: '' }))
    if (villeDebounceRef.current) clearTimeout(villeDebounceRef.current)
    villeDebounceRef.current = setTimeout(() => searchVille(value), 250)
  }

  const selectVille = (suggestion: { municipalite: string; region_administrative: string; mrc: string }) => {
    setFormData(prev => ({ ...prev, ville: suggestion.municipalite, region: suggestion.region_administrative }))
    setShowVilleSuggestions(false)
    setVilleSuggestions([])
    if (fieldErrors.region) setFieldErrors(prev => ({ ...prev, region: '' }))
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}
    if (!formData.prenom.trim()) errors.prenom = 'Le prénom est requis'
    if (!formData.nom.trim()) errors.nom = 'Le nom est requis'
    if (!formData.email.trim() || !formData.email.includes('@')) errors.email = 'Courriel invalide'
    const phoneDigits = cleanPhoneForSave(formData.telephone)
    if (!phoneDigits || phoneDigits.length !== 11) errors.telephone = 'Numéro de téléphone invalide'
    if (!formData.adresse.trim()) errors.adresse = "L'adresse est requise"
    if (!formData.region) errors.region = 'La région est requise — sélectionnez votre ville'
    if (selectedOrgIds.length === 0 && !newOrgName.trim()) errors.organisations = 'Veuillez sélectionner ou ajouter au moins une organisation'
    if (!formData.confirm_18) errors.confirm_18 = 'Vous devez confirmer avoir 18 ans ou plus'
    if (!formData.consent_photos) errors.consent_photos = 'Ce consentement est requis'
    if (!formData.consent_confidentialite) errors.consent_confidentialite = 'Ce consentement est requis'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) { setMessage({ type: 'error', text: 'Veuillez corriger les erreurs ci-dessous.' }); return }
    setLoading(true); setMessage(null)
    const emailClean = formData.email.toLowerCase().trim()
    const phoneClean = cleanPhoneForSave(formData.telephone)
    try {
      const { data: emailExists } = await supabase.from('reservistes').select('benevole_id').ilike('email', emailClean).maybeSingle()
      if (emailExists) { setFieldErrors(prev => ({ ...prev, email: 'Ce courriel est déjà enregistré' })); setMessage({ type: 'error', text: 'Ce courriel est déjà associé à un compte existant.' }); setLoading(false); return }

      const isTestPhone = phoneClean === '19999999999' || phoneClean === '9999999999'
      if (!isTestPhone) {
        const { data: phoneExists } = await supabase.from('reservistes').select('benevole_id').eq('telephone', phoneClean).maybeSingle()
        if (!phoneExists && phoneClean.startsWith('1')) {
          const { data: phoneExists2 } = await supabase.from('reservistes').select('benevole_id').eq('telephone', phoneClean.slice(1)).maybeSingle()
          if (phoneExists2) { setFieldErrors(prev => ({ ...prev, telephone: 'Ce numéro de téléphone est déjà enregistré' })); setMessage({ type: 'error', text: 'Ce numéro de téléphone est déjà associé à un compte existant.' }); setLoading(false); return }
        } else if (phoneExists) { setFieldErrors(prev => ({ ...prev, telephone: 'Ce numéro de téléphone est déjà enregistré' })); setMessage({ type: 'error', text: 'Ce numéro de téléphone est déjà associé à un compte existant.' }); setLoading(false); return }
      }

      // Appel webhook inscription
      const response = await fetch('https://n8n.aqbrs.ca/webhook/riusc-inscription', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prenom: formData.prenom.trim(), nom: formData.nom.trim(), email: emailClean, telephone: isTestPhone ? null : phoneClean, adresse: formData.adresse, ville: formData.ville, region: formData.region, latitude: formData.latitude, longitude: formData.longitude, groupe_rs: formData.groupe_rs, groupe: 'Nouveaux', commentaire: formData.commentaire, camp_id: campId || null })
      })
      if (!response.ok) throw new Error("Erreur lors de l'inscription. Veuillez réessayer.")

      // Lier les organisations via Supabase
      // On attend un court délai pour que le webhook ait le temps de créer le réserviste
      await new Promise(resolve => setTimeout(resolve, 1500))

      const { data: newReserviste } = await supabase
        .from('reservistes')
        .select('benevole_id')
        .ilike('email', emailClean)
        .maybeSingle()

      if (newReserviste?.benevole_id) {
        let orgIdsToLink = [...selectedOrgIds]

        // Créer la nouvelle organisation si renseignée
        if (newOrgName.trim()) {
          const { data: createdOrg, error: createError } = await supabase
            .from('organisations')
            .insert({ nom: newOrgName.trim(), created_by: newReserviste.benevole_id })
            .select('id')
            .single()

          if (createError) {
            // Doublon — retrouver l'existante
            const { data: existingOrg } = await supabase
              .from('organisations')
              .select('id')
              .ilike('nom', newOrgName.trim())
              .single()
            if (existingOrg) orgIdsToLink.push(existingOrg.id)
          } else if (createdOrg) {
            orgIdsToLink.push(createdOrg.id)
          }
        }

        if (orgIdsToLink.length > 0) {
          await supabase.from('reserviste_organisations').insert(
            orgIdsToLink.map(organisation_id => ({
              benevole_id: newReserviste.benevole_id,
              organisation_id
            }))
          )
        }
      }

      setStep('success')
    } catch (error: any) { console.error('Erreur inscription:', error); setMessage({ type: 'error', text: error.message || "Erreur lors de l'inscription. Veuillez réessayer." }) }
    setLoading(false)
  }

  const inputStyle = { width: '100%', padding: '12px 14px', fontSize: '15px', border: '1px solid #d1d5db', borderRadius: '8px', boxSizing: 'border-box' as const, color: '#111827', backgroundColor: 'white' }
  const inputErrorStyle = { ...inputStyle, border: '2px solid #dc2626' }
  const labelStyle = { display: 'block', marginBottom: '6px', fontSize: '14px', fontWeight: '500' as const, color: '#374151' }
  const requiredStar = <span style={{ color: '#dc2626', marginLeft: '2px' }}>*</span>

  if (step === 'success') {
    return (
      <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        <div style={{ backgroundColor: 'white', padding: '48px', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', maxWidth: '500px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>✅</div>
          <h2 style={{ color: '#1e3a5f', margin: '0 0 16px 0', fontSize: '24px' }}>Inscription réussie !</h2>
          <p style={{ color: '#6b7280', fontSize: '15px', lineHeight: '1.6', margin: '0 0 24px 0' }}>Bienvenue dans la RIUSC, <strong>{formData.prenom}</strong> ! Votre compte est en cours de création. Vous recevrez un accès au portail sous peu.</p>
          <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.6', margin: '0 0 32px 0' }}>Votre demande sera traitée par notre équipe. Un courriel de confirmation vous sera envoyé à <strong>{formData.email}</strong>.</p>
          <a href={campId ? `/login?camp=${campId}` : '/login'} style={{ display: 'inline-block', padding: '14px 32px', backgroundColor: '#1e3a5f', color: 'white', borderRadius: '8px', textDecoration: 'none', fontSize: '16px', fontWeight: '600' }}>Aller à la page de connexion</a>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', padding: '0 24px', height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Image src="/logo.png" alt="Logo RIUSC" width={48} height={48} style={{ borderRadius: '8px' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e3a5f' }}>Portail RIUSC</h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>Inscription — Réserve d&apos;Intervention d&apos;Urgence</p>
            </div>
          </div>
          <a href={campId ? `/login?camp=${campId}` : '/login'} style={{ padding: '8px 16px', color: '#1e3a5f', fontSize: '14px', fontWeight: '500', textDecoration: 'none', border: '1px solid #1e3a5f', borderRadius: '6px' }}>Déjà inscrit ? Se connecter</a>
        </div>
      </header>

      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px 80px' }}>
        <h2 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '28px', fontWeight: '700' }}>Inscription à la RIUSC</h2>
        <p style={{ color: '#6b7280', fontSize: '15px', margin: '0 0 32px 0' }}>Remplissez le formulaire ci-dessous pour vous inscrire comme réserviste bénévole.</p>

        {message && (<div style={{ padding: '12px 16px', borderRadius: '8px', marginBottom: '24px', backgroundColor: message.type === 'success' ? '#d1fae5' : '#fef2f2', color: message.type === 'success' ? '#065f46' : '#dc2626', fontSize: '14px' }}>{message.text}</div>)}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Section Informations personnelles */}
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ color: '#1e3a5f', margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>Informations personnelles</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
              <div>
                <label style={labelStyle}>Prénom {requiredStar}</label>
                <input type="text" value={formData.prenom} onChange={(e) => handleInputChange('prenom', e.target.value)} style={fieldErrors.prenom ? inputErrorStyle : inputStyle} placeholder="Votre prénom" />
                {fieldErrors.prenom && <p style={{ color: '#dc2626', fontSize: '12px', margin: '4px 0 0 0' }}>{fieldErrors.prenom}</p>}
              </div>
              <div>
                <label style={labelStyle}>Nom de famille {requiredStar}</label>
                <input type="text" value={formData.nom} onChange={(e) => handleInputChange('nom', e.target.value)} style={fieldErrors.nom ? inputErrorStyle : inputStyle} placeholder="Votre nom de famille" />
                {fieldErrors.nom && <p style={{ color: '#dc2626', fontSize: '12px', margin: '4px 0 0 0' }}>{fieldErrors.nom}</p>}
              </div>
              <div>
                <label style={labelStyle}>Courriel {requiredStar}</label>
                <input type="email" value={formData.email} onChange={(e) => handleInputChange('email', e.target.value)} style={fieldErrors.email ? inputErrorStyle : inputStyle} placeholder="votre.nom@example.com" />
                {fieldErrors.email && <p style={{ color: '#dc2626', fontSize: '12px', margin: '4px 0 0 0' }}>{fieldErrors.email}</p>}
              </div>
              <div>
                <label style={labelStyle}>Téléphone mobile {requiredStar}</label>
                <input type="tel" value={formData.telephone} onChange={(e) => handleInputChange('telephone', e.target.value)} onBlur={handlePhoneBlur} style={fieldErrors.telephone ? inputErrorStyle : inputStyle} placeholder="(514) 123-4567" />
                {fieldErrors.telephone && <p style={{ color: '#dc2626', fontSize: '12px', margin: '4px 0 0 0' }}>{fieldErrors.telephone}</p>}
              </div>
            </div>
          </div>

          {/* Section Localisation */}
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ color: '#1e3a5f', margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>Localisation</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
              <div style={{ gridColumn: '1 / -1', position: 'relative' }}>
                <label style={labelStyle}>Adresse {requiredStar}</label>
                <input ref={addressInputRef} type="text" value={formData.adresse} onChange={(e) => handleAddressChange(e.target.value)} onFocus={() => formData.adresse.length >= 3 && setShowAddressSuggestions(true)} style={fieldErrors.adresse ? inputErrorStyle : inputStyle} placeholder="Commencez à taper votre adresse..." autoComplete="off" />
                {isLoadingAddress && <div style={{ position: 'absolute', right: '12px', top: '38px', fontSize: '12px', color: '#6b7280' }}>Recherche...</div>}
                {formData.latitude && formData.longitude && <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#059669' }}>✓ Adresse validée</p>}
                {fieldErrors.adresse && <p style={{ color: '#dc2626', fontSize: '12px', margin: '4px 0 0 0' }}>{fieldErrors.adresse}</p>}
                {showAddressSuggestions && addressSuggestions.length > 0 && (
                  <div ref={addressDropdownRef} style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', zIndex: 1000, marginTop: '4px', maxHeight: '250px', overflowY: 'auto' }}>
                    {addressSuggestions.map((suggestion, index) => (
                      <div key={index} onClick={() => selectAddress(suggestion)} style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: index < addressSuggestions.length - 1 ? '1px solid #f3f4f6' : 'none', fontSize: '14px', color: '#374151' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>{suggestion.place_name}</div>
                    ))}
                  </div>
                )}
              </div>
              
              <div style={{ position: 'relative' }}>
                <label style={labelStyle}>Ville</label>
                <input ref={villeInputRef} type="text" value={formData.ville} onChange={(e) => handleVilleChange(e.target.value)} onFocus={() => formData.ville.length >= 2 && villeSuggestions.length > 0 && setShowVilleSuggestions(true)} style={inputStyle} placeholder="Tapez votre ville..." autoComplete="off" />
                {isLoadingVille && <div style={{ position: 'absolute', right: '12px', top: '38px', fontSize: '12px', color: '#6b7280' }}>Recherche...</div>}
                {showVilleSuggestions && villeSuggestions.length > 0 && (
                  <div ref={villeDropdownRef} style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: 'white', border: '1px solid #d1d5db', borderRadius: '8px', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', zIndex: 1000, marginTop: '4px', maxHeight: '250px', overflowY: 'auto' }}>
                    {villeSuggestions.map((s, i) => (
                      <div key={i} onClick={() => selectVille(s)} style={{ padding: '10px 16px', cursor: 'pointer', borderBottom: i < villeSuggestions.length - 1 ? '1px solid #f3f4f6' : 'none', fontSize: '14px', color: '#374151' }} onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'} onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}>
                        <div style={{ fontWeight: '500' }}>{s.municipalite}</div>
                        <div style={{ fontSize: '12px', color: '#9ca3af' }}>{s.region_administrative}{s.mrc ? ` — ${s.mrc}` : ''}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div>
                <label style={labelStyle}>Région administrative {requiredStar}</label>
                <input type="text" value={formData.region} readOnly style={{ ...inputStyle, backgroundColor: formData.region ? '#f0fdf4' : '#f3f4f6', cursor: 'not-allowed', borderColor: formData.region ? '#86efac' : (fieldErrors.region ? '#dc2626' : '#d1d5db'), borderWidth: fieldErrors.region ? '2px' : '1px' }} placeholder="Détectée automatiquement selon la ville" />
                {formData.region && <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#059669' }}>✓ Détectée automatiquement</p>}
                {fieldErrors.region && <p style={{ color: '#dc2626', fontSize: '12px', margin: '4px 0 0 0' }}>{fieldErrors.region}</p>}
              </div>
            </div>
          </div>

          {/* Section Organisations */}
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: fieldErrors.organisations ? '2px solid #dc2626' : 'none' }}>
            <h3 style={{ color: '#1e3a5f', margin: '0 0 6px 0', fontSize: '18px', fontWeight: '600' }}>
              Organisation d&apos;appartenance {requiredStar}
            </h3>
            <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 20px 0' }}>
              Sélectionnez toutes les organisations dont vous faites partie.
            </p>

            {fieldErrors.organisations && (
              <div style={{ padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '8px', fontSize: '13px', color: '#dc2626', marginBottom: '16px' }}>
                {fieldErrors.organisations}
              </div>
            )}

            {loadingOrgs ? (
              <p style={{ fontSize: '14px', color: '#9ca3af' }}>Chargement des organisations...</p>
            ) : (
              <>
                {allOrgs.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '16px', maxHeight: '260px', overflowY: 'auto', padding: '2px 0' }}>
                    {allOrgs.map(org => (
                      <label
                        key={org.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          backgroundColor: selectedOrgIds.includes(org.id) ? '#eff6ff' : '#f9fafb',
                          border: selectedOrgIds.includes(org.id) ? '1px solid #bfdbfe' : '1px solid transparent',
                          transition: 'background-color 0.15s',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selectedOrgIds.includes(org.id)}
                          onChange={() => toggleOrg(org.id)}
                          style={{ accentColor: '#1e3a5f', width: '17px', height: '17px', flexShrink: 0 }}
                        />
                        <span style={{ fontSize: '14px', color: '#374151' }}>{org.nom}</span>
                      </label>
                    ))}
                  </div>
                )}

                {/* Ajouter une org qui n'existe pas */}
                {!showNewOrgInput ? (
                  <button
                    onClick={() => setShowNewOrgInput(true)}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '9px 16px',
                      backgroundColor: 'transparent',
                      border: '1px dashed #9ca3af',
                      borderRadius: '8px',
                      fontSize: '13px',
                      color: '#6b7280',
                      cursor: 'pointer',
                    }}
                  >
                    + Mon organisation n&apos;est pas dans la liste
                  </button>
                ) : (
                  <div style={{ marginTop: '4px' }}>
                    <label style={{ ...labelStyle, marginBottom: '8px' }}>Nom de votre organisation</label>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input
                        type="text"
                        value={newOrgName}
                        onChange={e => setNewOrgName(e.target.value)}
                        placeholder="Ex: Croix-Rouge canadienne"
                        style={{ ...inputStyle, flex: 1 }}
                      />
                      <button
                        onClick={() => { setShowNewOrgInput(false); setNewOrgName('') }}
                        style={{ padding: '12px 14px', backgroundColor: 'transparent', border: '1px solid #d1d5db', borderRadius: '8px', fontSize: '13px', color: '#6b7280', cursor: 'pointer', whiteSpace: 'nowrap' }}
                      >
                        Annuler
                      </button>
                    </div>
                    <p style={{ fontSize: '12px', color: '#9ca3af', marginTop: '6px', marginBottom: 0 }}>
                      Cette organisation sera ajoutée à la liste globale pour tous les réservistes.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Section Informations supplémentaires */}
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ color: '#1e3a5f', margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>Informations supplémentaires</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={labelStyle}>Membre d&apos;un groupe de R.S. de l&apos;AQBRS</label>
                <select value={formData.groupe_rs} onChange={(e) => handleInputChange('groupe_rs', e.target.value)} style={inputStyle}>
                  <option value="">Aucun / Je ne fais pas partie d&apos;un groupe</option>
                  {GROUPES_RS.map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Commentaire</label>
                <textarea value={formData.commentaire} onChange={(e) => handleInputChange('commentaire', e.target.value)} style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }} placeholder="Optionnel" />
              </div>
            </div>
          </div>

          {/* Section Confirmations */}
          <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <h3 style={{ color: '#1e3a5f', margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>Confirmations requises</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', padding: '12px', borderRadius: '8px', backgroundColor: fieldErrors.confirm_18 ? '#fef2f2' : '#f9fafb', border: fieldErrors.confirm_18 ? '1px solid #fca5a5' : '1px solid transparent' }}>
                <input type="checkbox" checked={formData.confirm_18} onChange={(e) => handleInputChange('confirm_18', e.target.checked)} style={{ marginTop: '2px', width: '18px', height: '18px', accentColor: '#1e3a5f', flexShrink: 0 }} />
                <span style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5' }}>Je confirme être âgé(e) de 18 ans ou plus au moment de mon inscription. {requiredStar}</span>
              </label>
              {fieldErrors.confirm_18 && <p style={{ color: '#dc2626', fontSize: '12px', margin: '-8px 0 0 0' }}>{fieldErrors.confirm_18}</p>}

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', padding: '12px', borderRadius: '8px', backgroundColor: fieldErrors.consent_photos ? '#fef2f2' : '#f9fafb', border: fieldErrors.consent_photos ? '1px solid #fca5a5' : '1px solid transparent' }}>
                <input type="checkbox" checked={formData.consent_photos} onChange={(e) => handleInputChange('consent_photos', e.target.checked)} style={{ marginTop: '2px', width: '18px', height: '18px', accentColor: '#1e3a5f', flexShrink: 0 }} />
                <span style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5' }}>Je comprends que des photos ou vidéos peuvent être prises lors des activités de formation, d&apos;entraînement ou de déploiement et j&apos;autorise l&apos;AQBRS / RIUSC à utiliser les images captées par leurs représentants à des fins de communication. {requiredStar}</span>
              </label>
              {fieldErrors.consent_photos && <p style={{ color: '#dc2626', fontSize: '12px', margin: '-8px 0 0 0' }}>{fieldErrors.consent_photos}</p>}

              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', padding: '12px', borderRadius: '8px', backgroundColor: fieldErrors.consent_confidentialite ? '#fef2f2' : '#f9fafb', border: fieldErrors.consent_confidentialite ? '1px solid #fca5a5' : '1px solid transparent' }}>
                <input type="checkbox" checked={formData.consent_confidentialite} onChange={(e) => handleInputChange('consent_confidentialite', e.target.checked)} style={{ marginTop: '2px', width: '18px', height: '18px', accentColor: '#1e3a5f', flexShrink: 0 }} />
                <span style={{ fontSize: '14px', color: '#374151', lineHeight: '1.5' }}>Je comprends et j&apos;accepte que mes informations soient utilisées conformément à la{' '}<a href="https://aqbrs.ca/wp-content/uploads/2026/02/Loi-25-Politique-AQBRS-fr.pdf" target="_blank" rel="noopener noreferrer" style={{ color: '#2563eb' }}>politique de confidentialité</a>. {requiredStar}</span>
              </label>
              {fieldErrors.consent_confidentialite && <p style={{ color: '#dc2626', fontSize: '12px', margin: '-8px 0 0 0' }}>{fieldErrors.consent_confidentialite}</p>}
            </div>
          </div>

          {/* Boutons */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <a href={campId ? `/login?camp=${campId}` : '/login'} style={{ padding: '12px 24px', color: '#6b7280', fontSize: '14px', textDecoration: 'none' }}>← Retour à la connexion</a>
            <button onClick={handleSubmit} disabled={loading} style={{ padding: '14px 40px', backgroundColor: '#1e3a5f', color: 'white', border: 'none', borderRadius: '8px', fontSize: '16px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'all 0.2s' }}>
              {loading ? 'Inscription en cours...' : "S'inscrire"}
            </button>
          </div>
        </div>
      </main>

      <footer style={{ backgroundColor: '#1e3a5f', color: 'white', padding: '24px', textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>© 2026 AQBRS - Association québécoise des bénévoles en recherche et sauvetage</p>
      </footer>
    </div>
  )
}
