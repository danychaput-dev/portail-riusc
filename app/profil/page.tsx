'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef, useCallback } from 'react'
import ImageCropper from '@/app/components/ImageCropper'
import PortailHeader from '@/app/components/PortailHeader'

const MAPBOX_TOKEN = 'pk.eyJ1IjoiYXFicnMiLCJhIjoiY21sN2g0YW5hMG84NDNlb2EwdmI5NWZ0ayJ9.jsxH3ei2CqtShV8MrJ47XA'

interface Reserviste {
  id: number;
  benevole_id: string;
  prenom: string;
  nom: string;
  email: string;
  telephone?: string;
  telephone_secondaire?: string;
  date_naissance?: string;
  adresse?: string;
  ville?: string;
  region?: string;
  latitude?: number | null;
  longitude?: number | null;
  contact_urgence_nom?: string;
  contact_urgence_telephone?: string;
  allergies_alimentaires?: string;
  allergies_autres?: string;
  conditions_medicales?: string;
  statut: string;
  photo_url?: string;
}

interface MapboxFeature {
  place_name: string;
  center: [number, number];
  context?: Array<{
    id: string;
    text: string;
  }>;
}

// Fonction pour formater les numéros de téléphone à l'affichage
function formatPhoneDisplay(phone: string | null | undefined): string {
  if (!phone) return ''
  const digits = phone.replace(/\\D/g, '')
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  return phone
}

// Fonction pour nettoyer le téléphone avant sauvegarde
function cleanPhoneForSave(phone: string): string {
  return phone.replace(/\\D/g, '')
}

export default function ProfilPage() {
  const [user, setUser] = useState<any>(null)
  const [reserviste, setReserviste] = useState<Reserviste | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  const [originalEmail, setOriginalEmail] = useState('')
  
  const [formData, setFormData] = useState({
    prenom: '',
    nom: '',
    email: '',
    telephone: '',
    telephone_secondaire: '',
    date_naissance: '',
    adresse: '',
    ville: '',
    region: '',
    latitude: null as number | null,
    longitude: null as number | null,
    contact_urgence_nom: '',
    contact_urgence_telephone: '',
    allergies_alimentaires: '',
    allergies_autres: '',
    conditions_medicales: ''
  })
  
  // États pour l'autocomplete adresse
  const [addressSuggestions, setAddressSuggestions] = useState<MapboxFeature[]>([])
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false)
  const [isLoadingAddress, setIsLoadingAddress] = useState(false)
  const addressInputRef = useRef<HTMLInputElement>(null)
  const addressDropdownRef = useRef<HTMLDivElement>(null)
  
  // États pour l'autocomplete ville
  const [villeSuggestions, setVilleSuggestions] = useState<Array<{ municipalite: string; region_administrative: string; mrc: string }>>([])
  const [showVilleSuggestions, setShowVilleSuggestions] = useState(false)
  const [isLoadingVille, setIsLoadingVille] = useState(false)
  const villeInputRef = useRef<HTMLInputElement>(null)
  const villeDropdownRef = useRef<HTMLDivElement>(null)
  const villeDebounceRef = useRef<NodeJS.Timeout | null>(null)
  
  // État pour la photo
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  
  const router = useRouter()
  const supabase = createClient()

  // Charger les données
  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      
      setUser(user)
      
      let reservisteData = null
      
      if (user.email) {
        const { data } = await supabase
          .from('reservistes')
          .select('*')
          .ilike('email', user.email)
          .single()
        reservisteData = data
      }
      
      if (!reservisteData && user.phone) {
        const phoneDigits = user.phone.replace(/\\D/g, '')
        const { data } = await supabase
          .from('reservistes')
          .select('*')
          .eq('telephone', phoneDigits)
          .single()
        
        if (!data) {
          const phoneWithout1 = phoneDigits.startsWith('1') ? phoneDigits.slice(1) : phoneDigits
          const { data: data2 } = await supabase
            .from('reservistes')
            .select('*')
            .eq('telephone', phoneWithout1)
            .single()
          reservisteData = data2
        } else {
          reservisteData = data
        }
      }
      
      if (reservisteData) {
        setReserviste(reservisteData)
        setOriginalEmail(reservisteData.email || '')
        setFormData({
          prenom: reservisteData.prenom || '',
          nom: reservisteData.nom || '',
          email: reservisteData.email || '',
          telephone: formatPhoneDisplay(reservisteData.telephone),
          telephone_secondaire: formatPhoneDisplay(reservisteData.telephone_secondaire),
          date_naissance: reservisteData.date_naissance || '',
          adresse: reservisteData.adresse || '',
          ville: reservisteData.ville || '',
          region: reservisteData.region || '',
          latitude: reservisteData.latitude || null,
          longitude: reservisteData.longitude || null,
          contact_urgence_nom: reservisteData.contact_urgence_nom || '',
          contact_urgence_telephone: formatPhoneDisplay(reservisteData.contact_urgence_telephone),
          allergies_alimentaires: reservisteData.allergies_alimentaires || '',
          allergies_autres: reservisteData.allergies_autres || '',
          conditions_medicales: reservisteData.conditions_medicales || ''
        })
      }
      
      setLoading(false)
    }
    loadData()
  }, [])

  // Fermer le dropdown adresse quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (addressDropdownRef.current && !addressDropdownRef.current.contains(event.target as Node) &&
          addressInputRef.current && !addressInputRef.current.contains(event.target as Node)) {
        setShowAddressSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Fermer le dropdown ville quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (villeDropdownRef.current && !villeDropdownRef.current.contains(event.target as Node) &&
          villeInputRef.current && !villeInputRef.current.contains(event.target as Node)) {
        setShowVilleSuggestions(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Rechercher des adresses avec Mapbox
  const searchAddress = useCallback(async (query: string) => {
    if (query.length < 3) {
      setAddressSuggestions([])
      return
    }
    
    setIsLoadingAddress(true)
    try {
      const response = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?` +
        `access_token=${MAPBOX_TOKEN}&country=ca&language=fr&types=address&limit=5`
      )
      const data = await response.json()
      setAddressSuggestions(data.features || [])
      setShowAddressSuggestions(true)
    } catch (error) {
      console.error('Erreur recherche adresse:', error)
    }
    setIsLoadingAddress(false)
  }, [])

  // Debounce pour la recherche d'adresse
  const debounceRef = useRef<NodeJS.Timeout | null>(null)
  const handleAddressChange = (value: string) => {
    setFormData(prev => ({ ...prev, adresse: value, latitude: null, longitude: null }))
    
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    
    debounceRef.current = setTimeout(() => {
      searchAddress(value)
    }, 300)
  }

  // Sélectionner une adresse
  const selectAddress = (feature: MapboxFeature) => {
    const [lng, lat] = feature.center
    
    let ville = ''
    if (feature.context) {
      const placeContext = feature.context.find(c => c.id.startsWith('place'))
      if (placeContext) {
        ville = placeContext.text
      }
    }
    
    setFormData(prev => ({
      ...prev,
      adresse: feature.place_name,
      latitude: lat,
      longitude: lng,
      ville: ville || prev.ville
    }))
    setShowAddressSuggestions(false)
    setAddressSuggestions([])

    // Auto-lookup région from ville
    if (ville) {
      lookupRegionFromVille(ville)
    }
  }

  // Rechercher des villes dans municipalites_qc
  const searchVille = async (query: string) => {
    if (query.length < 2) {
      setVilleSuggestions([])
      return
    }
    setIsLoadingVille(true)
    try {
      const { data, error } = await supabase
        .from('municipalites_qc')
        .select('municipalite, region_administrative, mrc')
        .ilike('municipalite', `${query}%`)
        .order('municipalite')
        .limit(8)
      if (!error && data) {
        setVilleSuggestions(data)
        setShowVilleSuggestions(true)
      }
    } catch (e) {
      console.error('Erreur recherche ville:', e)
    }
    setIsLoadingVille(false)
  }

  const handleVilleChange = (value: string) => {
    setFormData(prev => ({ ...prev, ville: value, region: '' }))
    if (villeDebounceRef.current) clearTimeout(villeDebounceRef.current)
    villeDebounceRef.current = setTimeout(() => {
      searchVille(value)
    }, 250)
  }

  const selectVille = (suggestion: { municipalite: string; region_administrative: string; mrc: string }) => {
    setFormData(prev => ({
      ...prev,
      ville: suggestion.municipalite,
      region: suggestion.region_administrative
    }))
    setShowVilleSuggestions(false)
    setVilleSuggestions([])
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
    }
  }

  const getInitials = () => {
    if (reserviste) {
      return `${reserviste.prenom.charAt(0)}${reserviste.nom.charAt(0)}`.toUpperCase()
    }
    return user?.email?.charAt(0).toUpperCase() || 'U'
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handlePhoneBlur = (field: 'telephone' | 'telephone_secondaire' | 'contact_urgence_telephone') => {
    setFormData(prev => ({
      ...prev,
      [field]: formatPhoneDisplay(prev[field])
    }))
  }

  // Upload photo croppée vers Supabase
  const handleCroppedPhoto = async (croppedBlob: Blob) => {
    if (!reserviste) return

    setUploadingPhoto(true)
    setMessage(null)

    try {
      const fileName = `${reserviste.benevole_id}-${Date.now()}.jpg`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, croppedBlob, {
          contentType: 'image/jpeg',
          upsert: true,
        })

      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      const { error: updateError } = await supabase
        .from('reservistes')
        .update({ photo_url: publicUrl })
        .eq('id', reserviste.id)

      if (updateError) throw updateError

      setReserviste(prev => prev ? { ...prev, photo_url: publicUrl } : null)
      setMessage({ type: 'success', text: 'Photo mise à jour avec succès' })
    } catch (error) {
      console.error('Erreur upload photo:', error)
      setMessage({ type: 'error', text: "Erreur lors de l'upload de la photo" })
      throw error // Re-throw pour que le cropper sache qu'il y a eu erreur
    } finally {
      setUploadingPhoto(false)
    }
  }

  // Synchroniser vers Monday.com via n8n
  const syncToMonday = async (data: {
    benevole_id: string;
    prenom: string;
    nom: string;
    email: string;
    telephone: string;
    telephone_secondaire: string;
    date_naissance: string;
    adresse: string;
    ville: string;
    region: string;
    latitude: number | null;
    longitude: number | null;
    contact_urgence_nom: string;
    contact_urgence_telephone: string;
    allergies_alimentaires: string;
    allergies_autres: string;
    conditions_medicales: string;
  }) => {
    try {
      const response = await fetch('https://n8n.aqbrs.ca/webhook/riusc-sync-profil', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      })
      
      if (!response.ok) {
        console.error('Erreur sync Monday:', await response.text())
      }
    } catch (error) {
      console.error('Erreur sync Monday:', error)
    }
  }

  // Sauvegarder le profil
  const handleSave = async () => {
    if (!reserviste) return

    setSaving(true)
    setMessage(null)

    try {
      const { error: reservisteError } = await supabase
        .from('reservistes')
        .update({
          prenom: formData.prenom,
          nom: formData.nom,
          email: formData.email,
          telephone: cleanPhoneForSave(formData.telephone) || null,
          telephone_secondaire: cleanPhoneForSave(formData.telephone_secondaire) || null,
          date_naissance: formData.date_naissance || null,
          adresse: formData.adresse || null,
          ville: formData.ville || null,
          region: formData.region || null,
          latitude: formData.latitude,
          longitude: formData.longitude,
          contact_urgence_nom: formData.contact_urgence_nom || null,
          contact_urgence_telephone: cleanPhoneForSave(formData.contact_urgence_telephone) || null,
          allergies_alimentaires: formData.allergies_alimentaires || null,
          allergies_autres: formData.allergies_autres || null,
          conditions_medicales: formData.conditions_medicales || null
        })
        .eq('id', reserviste.id)

      if (reservisteError) throw reservisteError

      if (formData.email !== originalEmail && formData.email) {
        const { error: authError } = await supabase.auth.updateUser({
          email: formData.email
        })
        
        if (authError) {
          await supabase
            .from('reservistes')
            .update({ email: originalEmail })
            .eq('id', reserviste.id)
          
          throw new Error(`Erreur mise à jour email: ${authError.message}. Un email de confirmation a peut-être été envoyé.`)
        }
        
        setOriginalEmail(formData.email)
      }

      syncToMonday({
        benevole_id: reserviste.benevole_id,
        prenom: formData.prenom,
        nom: formData.nom,
        email: formData.email,
        telephone: cleanPhoneForSave(formData.telephone),
        telephone_secondaire: cleanPhoneForSave(formData.telephone_secondaire),
        date_naissance: formData.date_naissance,
        adresse: formData.adresse,
        ville: formData.ville,
        region: formData.region,
        latitude: formData.latitude,
        longitude: formData.longitude,
        contact_urgence_nom: formData.contact_urgence_nom,
        contact_urgence_telephone: cleanPhoneForSave(formData.contact_urgence_telephone),
        allergies_alimentaires: formData.allergies_alimentaires,
        allergies_autres: formData.allergies_autres,
        conditions_medicales: formData.conditions_medicales
      })

      setMessage({ type: 'success', text: 'Profil mis à jour avec succès' })
      setReserviste(prev => prev ? { ...prev, ...formData } : null)
      
    } catch (error: any) {
      console.error('Erreur sauvegarde:', error)
      setMessage({ type: 'error', text: error.message || 'Erreur lors de la sauvegarde' })
    }

    setSaving(false)
  }

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        fontSize: '18px',
        color: '#1e3a5f'
      }}>
        Chargement...
      </div>
    )
  }

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    fontSize: '15px',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    boxSizing: 'border-box' as const,
    color: '#111827',
    backgroundColor: 'white'
  }

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontSize: '14px',
    fontWeight: '500' as const,
    color: '#374151'
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f5f7fa' }}>
      {/* Header */}
      <PortailHeader subtitle="Mon profil" />

      {/* Main Content */}
      <main style={{ maxWidth: '800px', margin: '0 auto', padding: '32px 24px' }}>
        {/* Breadcrumb */}
        <div style={{ marginBottom: '24px' }}>
          <a href="/" style={{ color: '#6b7280', textDecoration: 'none', fontSize: '14px' }}>
            ← Retour à l'accueil
          </a>
        </div>

        <h2 style={{ 
          color: '#1e3a5f', 
          margin: '0 0 32px 0', 
          fontSize: '28px',
          fontWeight: '700'
        }}>
          Mon profil
        </h2>

        {/* Message */}
        {message && (
          <div style={{
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '24px',
            backgroundColor: message.type === 'success' ? '#d1fae5' : '#fef2f2',
            color: message.type === 'success' ? '#065f46' : '#dc2626',
            fontSize: '14px'
          }}>
            {message.text}
          </div>
        )}

        {reserviste ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* Section Photo avec ImageCropper */}
            <div style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
                Photo de profil
              </h3>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                <ImageCropper
                  currentPhotoUrl={reserviste.photo_url}
                  initials={getInitials()}
                  size={120}
                  uploading={uploadingPhoto}
                  onCropComplete={handleCroppedPhoto}
                />
                
                <div>
                  <p style={{ 
                    margin: '0 0 8px 0', 
                    fontSize: '14px', 
                    fontWeight: '500',
                    color: '#374151'
                  }}>
                    Cliquez sur la photo pour la modifier
                  </p>
                  <p style={{ 
                    margin: 0, 
                    fontSize: '13px', 
                    color: '#6b7280',
                    maxWidth: '300px'
                  }}>
                    Vous pourrez recadrer et zoomer l'image. Format JPG ou PNG, max 10 Mo.
                  </p>
                </div>
              </div>
            </div>

            {/* Section Informations personnelles */}
            <div style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
                Informations personnelles
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                <div>
                  <label style={labelStyle}>Prénom</label>
                  <input
                    type="text"
                    value={formData.prenom}
                    onChange={(e) => handleInputChange('prenom', e.target.value)}
                    style={inputStyle}
                  />
                </div>
                
                <div>
                  <label style={labelStyle}>Nom de famille</label>
                  <input
                    type="text"
                    value={formData.nom}
                    onChange={(e) => handleInputChange('nom', e.target.value)}
                    style={inputStyle}
                  />
                </div>
                
                <div>
                  <label style={labelStyle}>Date de naissance</label>
                  <input
                    type="date"
                    value={formData.date_naissance}
                    onChange={(e) => handleInputChange('date_naissance', e.target.value)}
                    style={inputStyle}
                  />
                </div>
                
                <div>
                  <label style={labelStyle}>Courriel</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    style={inputStyle}
                  />
                  {formData.email !== originalEmail && (
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#f59e0b' }}>
                      ⚠️ Un email de confirmation sera envoyé à la nouvelle adresse
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Section Coordonnées */}
            <div style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
                Coordonnées
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                <div>
                  <label style={labelStyle}>Téléphone mobile</label>
                  <input
                    type="tel"
                    value={formData.telephone}
                    onChange={(e) => handleInputChange('telephone', e.target.value)}
                    onBlur={() => handlePhoneBlur('telephone')}
                    style={inputStyle}
                    placeholder="(514) 123-4567"
                  />
                </div>
                
                <div>
                  <label style={labelStyle}>Téléphone secondaire</label>
                  <input
                    type="tel"
                    value={formData.telephone_secondaire}
                    onChange={(e) => handleInputChange('telephone_secondaire', e.target.value)}
                    onBlur={() => handlePhoneBlur('telephone_secondaire')}
                    style={inputStyle}
                    placeholder="(514) 123-4567"
                  />
                </div>
                
                <div style={{ gridColumn: '1 / -1', position: 'relative' }}>
                  <label style={labelStyle}>Adresse</label>
                  <input
                    ref={addressInputRef}
                    type="text"
                    value={formData.adresse}
                    onChange={(e) => handleAddressChange(e.target.value)}
                    onFocus={() => formData.adresse.length >= 3 && setShowAddressSuggestions(true)}
                    style={inputStyle}
                    placeholder="Commencez à taper votre adresse..."
                    autoComplete="off"
                  />
                  {isLoadingAddress && (
                    <div style={{
                      position: 'absolute',
                      right: '12px',
                      top: '38px',
                      fontSize: '12px',
                      color: '#6b7280'
                    }}>
                      Recherche...
                    </div>
                  )}
                  {formData.latitude && formData.longitude && (
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#059669' }}>
                      ✓ Adresse validée
                    </p>
                  )}
                  {showAddressSuggestions && addressSuggestions.length > 0 && (
                    <div
                      ref={addressDropdownRef}
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                        zIndex: 1000,
                        marginTop: '4px',
                        maxHeight: '250px',
                        overflowY: 'auto'
                      }}
                    >
                      {addressSuggestions.map((suggestion, index) => (
                        <div
                          key={index}
                          onClick={() => selectAddress(suggestion)}
                          style={{
                            padding: '12px 16px',
                            cursor: 'pointer',
                            borderBottom: index < addressSuggestions.length - 1 ? '1px solid #f3f4f6' : 'none',
                            fontSize: '14px',
                            color: '#374151'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                        >
                          {suggestion.place_name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div style={{ position: 'relative' }}>
                  <label style={labelStyle}>Ville</label>
                  <input
                    ref={villeInputRef}
                    type="text"
                    value={formData.ville}
                    onChange={(e) => handleVilleChange(e.target.value)}
                    onFocus={() => formData.ville.length >= 2 && villeSuggestions.length > 0 && setShowVilleSuggestions(true)}
                    style={inputStyle}
                    placeholder="Tapez votre ville..."
                    autoComplete="off"
                  />
                  {isLoadingVille && (
                    <div style={{ position: 'absolute', right: '12px', top: '38px', fontSize: '12px', color: '#6b7280' }}>
                      Recherche...
                    </div>
                  )}
                  {showVilleSuggestions && villeSuggestions.length > 0 && (
                    <div
                      ref={villeDropdownRef}
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'white',
                        border: '1px solid #d1d5db',
                        borderRadius: '8px',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                        zIndex: 1000,
                        marginTop: '4px',
                        maxHeight: '250px',
                        overflowY: 'auto'
                      }}
                    >
                      {villeSuggestions.map((s, i) => (
                        <div
                          key={i}
                          onClick={() => selectVille(s)}
                          style={{
                            padding: '10px 16px',
                            cursor: 'pointer',
                            borderBottom: i < villeSuggestions.length - 1 ? '1px solid #f3f4f6' : 'none',
                            fontSize: '14px',
                            color: '#374151'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'white'}
                        >
                          <div style={{ fontWeight: '500' }}>{s.municipalite}</div>
                          <div style={{ fontSize: '12px', color: '#9ca3af' }}>{s.region_administrative}{s.mrc ? ` — ${s.mrc}` : ''}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                
                <div>
                  <label style={labelStyle}>Région administrative</label>
                  <input
                    type="text"
                    value={formData.region}
                    readOnly
                    style={{
                      ...inputStyle,
                      backgroundColor: formData.region ? '#f0fdf4' : '#f3f4f6',
                      cursor: 'not-allowed',
                      borderColor: formData.region ? '#86efac' : '#d1d5db'
                    }}
                    placeholder="Détectée automatiquement selon la ville"
                  />
                  {formData.region && (
                    <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#059669' }}>
                      ✓ Détectée automatiquement
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Section Contact d'urgence */}
            <div style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
                Contact d'urgence
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
                <div>
                  <label style={labelStyle}>Nom du contact</label>
                  <input
                    type="text"
                    value={formData.contact_urgence_nom}
                    onChange={(e) => handleInputChange('contact_urgence_nom', e.target.value)}
                    style={inputStyle}
                    placeholder="Nom de la personne à contacter"
                  />
                </div>
                
                <div>
                  <label style={labelStyle}>Téléphone du contact</label>
                  <input
                    type="tel"
                    value={formData.contact_urgence_telephone}
                    onChange={(e) => handleInputChange('contact_urgence_telephone', e.target.value)}
                    onBlur={() => handlePhoneBlur('contact_urgence_telephone')}
                    style={inputStyle}
                    placeholder="(514) 123-4567"
                  />
                </div>
              </div>
            </div>

            {/* Section Santé */}
            <div style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 8px 0', fontSize: '18px', fontWeight: '600' }}>
                Santé et allergies
              </h3>
              <p style={{ color: '#6b7280', fontSize: '13px', margin: '0 0 20px 0' }}>
                Ces informations sont confidentielles et servent uniquement en cas d&apos;urgence lors d&apos;un déploiement.
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div>
                  <label style={labelStyle}>Allergies alimentaires</label>
                  <textarea
                    value={formData.allergies_alimentaires}
                    onChange={(e) => handleInputChange('allergies_alimentaires', e.target.value)}
                    style={{
                      ...inputStyle,
                      minHeight: '60px',
                      resize: 'vertical' as const
                    }}
                    placeholder="Ex : arachides, fruits de mer, gluten... (laisser vide si aucune)"
                  />
                </div>
                
                <div>
                  <label style={labelStyle}>Autres allergies</label>
                  <textarea
                    value={formData.allergies_autres}
                    onChange={(e) => handleInputChange('allergies_autres', e.target.value)}
                    style={{
                      ...inputStyle,
                      minHeight: '60px',
                      resize: 'vertical' as const
                    }}
                    placeholder="Ex : pénicilline, piqûres d'abeilles, latex... (laisser vide si aucune)"
                  />
                </div>
                
                <div>
                  <label style={labelStyle}>Conditions médicales</label>
                  <textarea
                    value={formData.conditions_medicales}
                    onChange={(e) => handleInputChange('conditions_medicales', e.target.value)}
                    style={{
                      ...inputStyle,
                      minHeight: '60px',
                      resize: 'vertical' as const
                    }}
                    placeholder="Ex : asthme, diabète, épilepsie... (laisser vide si aucune)"
                  />
                </div>
              </div>
            </div>

            {/* Section Statut */}
            <div style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '12px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
            }}>
              <h3 style={{ color: '#1e3a5f', margin: '0 0 20px 0', fontSize: '18px', fontWeight: '600' }}>
                Statut
              </h3>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>ID Bénévole : </span>
                  <span style={{ fontSize: '14px', fontWeight: '600', color: '#111827' }}>
                    {reserviste.benevole_id}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '14px', color: '#6b7280' }}>Statut : </span>
                  <span style={{
                    padding: '4px 12px',
                    backgroundColor: reserviste.statut === 'Actif' ? '#d1fae5' : '#fef3c7',
                    color: reserviste.statut === 'Actif' ? '#065f46' : '#92400e',
                    borderRadius: '20px',
                    fontSize: '13px',
                    fontWeight: '600'
                  }}>
                    {reserviste.statut}
                  </span>
                </div>
              </div>
            </div>

            {/* Bouton Sauvegarder */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <a
                href="/"
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'white',
                  color: '#374151',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  textDecoration: 'none',
                  cursor: 'pointer'
                }}
              >
                Annuler
              </a>
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  padding: '12px 32px',
                  backgroundColor: '#1e3a5f',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1
                }}
              >
                {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{
            backgroundColor: '#fef3c7',
            padding: '24px',
            borderRadius: '12px',
            textAlign: 'center'
          }}>
            <p style={{ color: '#92400e', margin: 0 }}>
              Aucun profil trouvé. Contactez l'administrateur.
            </p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer style={{
        backgroundColor: '#1e3a5f',
        color: 'white',
        padding: '24px',
        textAlign: 'center',
        marginTop: '60px'
      }}>
        <p style={{ margin: 0, fontSize: '14px', opacity: 0.8 }}>
          © 2026 AQBRS - Association québécoise des bénévoles en recherche et sauvetage
        </p>
      </footer>
    </div>
  )
}
