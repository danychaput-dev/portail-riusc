'use client'

import { createClient } from '@/utils/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef, useCallback } from 'react'
import Image from 'next/image'
import * as faceapi from 'face-api.js'

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
  latitude?: number;
  longitude?: number;
  contact_urgence_nom?: string;
  contact_urgence_telephone?: string;
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
  // Enlève tout sauf les chiffres
  const digits = phone.replace(/\D/g, '')
  // Format (XXX) XXX-XXXX pour 10 chiffres
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }
  // Format (XXX) XXX-XXXX pour 11 chiffres commençant par 1
  if (digits.length === 11 && digits[0] === '1') {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`
  }
  // Retourne tel quel si format inconnu
  return phone
}

// Fonction pour nettoyer le téléphone avant sauvegarde (garde seulement les chiffres)
function cleanPhoneForSave(phone: string): string {
  return phone.replace(/\D/g, '')
}

export default function ProfilPage() {
  const [user, setUser] = useState<any>(null)
  const [reserviste, setReserviste] = useState<Reserviste | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  // Garder l'email original pour détecter les changements
  const [originalEmail, setOriginalEmail] = useState('')
  
  // États pour le formulaire
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
    contact_urgence_telephone: ''
  })
  
  // États pour l'autocomplete adresse
  const [addressSuggestions, setAddressSuggestions] = useState<MapboxFeature[]>([])
  const [showAddressSuggestions, setShowAddressSuggestions] = useState(false)
  const [isLoadingAddress, setIsLoadingAddress] = useState(false)
  const addressInputRef = useRef<HTMLInputElement>(null)
  const addressDropdownRef = useRef<HTMLDivElement>(null)
  
  // États pour la photo
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [faceDetectionStatus, setFaceDetectionStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Menu utilisateur
  const [showUserMenu, setShowUserMenu] = useState(false)
  const userMenuRef = useRef<HTMLDivElement>(null)
  
  const router = useRouter()
  const supabase = createClient()

  // Charger les modèles face-api
  useEffect(() => {
    const loadModels = async () => {
      try {
        await faceapi.nets.tinyFaceDetector.loadFromUri('/models')
        setModelsLoaded(true)
      } catch (error) {
        console.error('Erreur chargement modèles face-api:', error)
      }
    }
    loadModels()
  }, [])

  // Fermer le menu utilisateur quand on clique ailleurs
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

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
      
      // Chercher par email si disponible
      if (user.email) {
        const { data } = await supabase
          .from('reservistes')
          .select('*')
          .ilike('email', user.email)
          .single()
        reservisteData = data
      }
      
      // Sinon chercher par téléphone
      if (!reservisteData && user.phone) {
        const phoneDigits = user.phone.replace(/\D/g, '')
        const { data } = await supabase
          .from('reservistes')
          .select('*')
          .eq('telephone', phoneDigits)
          .single()
        
        if (!data) {
          // Essayer sans le 1 au début
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
          contact_urgence_telephone: formatPhoneDisplay(reservisteData.contact_urgence_telephone)
        })
        if (reservisteData.photo_url) {
          setPhotoPreview(reservisteData.photo_url)
        }
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
    
    // Extraire la ville du contexte
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
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/login')
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

  // Formater le téléphone quand l'utilisateur quitte le champ
  const handlePhoneBlur = (field: 'telephone' | 'telephone_secondaire' | 'contact_urgence_telephone') => {
    setFormData(prev => ({
      ...prev,
      [field]: formatPhoneDisplay(prev[field])
    }))
  }

  // Gérer l'upload de photo avec détection de visage
  const handlePhotoSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Vérifier le type de fichier
    if (!file.type.startsWith('image/')) {
      setMessage({ type: 'error', text: 'Veuillez sélectionner une image' })
      return
    }

    // Vérifier la taille (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'L\'image ne doit pas dépasser 5 Mo' })
      return
    }

    setFaceDetectionStatus('loading')
    setMessage(null)

    // Créer une preview
    const reader = new FileReader()
    reader.onload = async (e) => {
      const imageDataUrl = e.target?.result as string
      
      // Détecter le visage
      if (modelsLoaded) {
        try {
          const img = document.createElement('img')
          img.src = imageDataUrl
          await new Promise((resolve) => { img.onload = resolve })
          
          const detections = await faceapi.detectAllFaces(img, new faceapi.TinyFaceDetectorOptions())
          
          if (detections.length === 0) {
            setFaceDetectionStatus('error')
            setMessage({ type: 'error', text: 'Aucun visage détecté. Veuillez choisir une photo avec votre visage visible.' })
            return
          }
          
          if (detections.length > 1) {
            setFaceDetectionStatus('error')
            setMessage({ type: 'error', text: 'Plusieurs visages détectés. Veuillez choisir une photo avec un seul visage.' })
            return
          }
          
          setFaceDetectionStatus('success')
          setPhotoPreview(imageDataUrl)
          
          // Upload vers Supabase
          await uploadPhoto(file)
          
        } catch (error) {
          console.error('Erreur détection visage:', error)
          setFaceDetectionStatus('error')
          setMessage({ type: 'error', text: 'Erreur lors de l\'analyse de la photo' })
        }
      } else {
        // Si les modèles ne sont pas chargés, uploader quand même
        setPhotoPreview(imageDataUrl)
        await uploadPhoto(file)
      }
    }
    reader.readAsDataURL(file)
  }

  const uploadPhoto = async (file: File) => {
    if (!reserviste) return

    setUploadingPhoto(true)
    
    try {
      // Nom unique pour le fichier
      const fileExt = file.name.split('.').pop()
      const fileName = `${reserviste.benevole_id}-${Date.now()}.${fileExt}`
      
      // Upload vers Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true })
      
      if (uploadError) {
        throw uploadError
      }
      
      // Obtenir l'URL publique
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)
      
      // Mettre à jour la table reservistes
      const { error: updateError } = await supabase
        .from('reservistes')
        .update({ photo_url: publicUrl })
        .eq('id', reserviste.id)
      
      if (updateError) {
        throw updateError
      }
      
      setReserviste(prev => prev ? { ...prev, photo_url: publicUrl } : null)
      setMessage({ type: 'success', text: 'Photo mise à jour avec succès' })
      
    } catch (error) {
      console.error('Erreur upload photo:', error)
      setMessage({ type: 'error', text: 'Erreur lors de l\'upload de la photo' })
    }
    
    setUploadingPhoto(false)
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
  }) => {
    try {
      const response = await fetch('https://n8n.aqbrs.ca/webhook/riusc-sync-profil', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      })
      
      if (!response.ok) {
        console.error('Erreur sync Monday:', await response.text())
      }
    } catch (error) {
      console.error('Erreur sync Monday:', error)
      // Ne pas bloquer la sauvegarde si Monday échoue
    }
  }

  // Sauvegarder le profil
  const handleSave = async () => {
    if (!reserviste) return

    setSaving(true)
    setMessage(null)

    try {
      // 1. Mettre à jour la table reservistes
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
          contact_urgence_telephone: cleanPhoneForSave(formData.contact_urgence_telephone) || null
        })
        .eq('id', reserviste.id)

      if (reservisteError) throw reservisteError

      // 2. Si l'email a changé, mettre à jour auth.users
      if (formData.email !== originalEmail && formData.email) {
        const { error: authError } = await supabase.auth.updateUser({
          email: formData.email
        })
        
        if (authError) {
          // Rollback le changement d'email dans reservistes si auth échoue
          await supabase
            .from('reservistes')
            .update({ email: originalEmail })
            .eq('id', reserviste.id)
          
          throw new Error(`Erreur mise à jour email: ${authError.message}. Un email de confirmation a peut-être été envoyé.`)
        }
        
        // Mettre à jour l'email original
        setOriginalEmail(formData.email)
      }

      // 3. Synchroniser vers Monday.com (en arrière-plan)
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
        contact_urgence_telephone: cleanPhoneForSave(formData.contact_urgence_telephone)
      })

      setMessage({ type: 'success', text: 'Profil mis à jour avec succès' })
      
      // Mettre à jour l'état local
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
      <header style={{
        backgroundColor: 'white',
        borderBottom: '1px solid #e5e7eb',
        position: 'sticky',
        top: 0,
        zIndex: 100
      }}>
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 24px',
          height: '72px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '16px', textDecoration: 'none' }}>
            <Image
              src="/logo.png"
              alt="Logo RIUSC"
              width={48}
              height={48}
              style={{ borderRadius: '8px' }}
            />
            <div>
              <h1 style={{ margin: 0, fontSize: '20px', fontWeight: '700', color: '#1e3a5f' }}>
                Portail RIUSC
              </h1>
              <p style={{ margin: 0, fontSize: '12px', color: '#6b7280' }}>
                Réserve d'Intervention d'Urgence
              </p>
            </div>
          </a>
          
          {/* Menu utilisateur */}
          <div ref={userMenuRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '8px 12px',
                backgroundColor: showUserMenu ? '#f3f4f6' : 'transparent',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer'
              }}
            >
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
                  {reserviste ? `${reserviste.prenom} ${reserviste.nom}` : user?.email}
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280' }}>Réserviste</div>
              </div>
              {photoPreview ? (
                <img
                  src={photoPreview}
                  alt="Photo de profil"
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '50%',
                    objectFit: 'cover'
                  }}
                />
              ) : (
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  backgroundColor: '#1e3a5f',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '600',
                  fontSize: '14px'
                }}>
                  {getInitials()}
                </div>
              )}
              <svg width="16" height="16" fill="none" stroke="#6b7280" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showUserMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '8px',
                backgroundColor: 'white',
                borderRadius: '8px',
                boxShadow: '0 10px 40px rgba(0,0,0,0.15)',
                border: '1px solid #e5e7eb',
                minWidth: '200px',
                overflow: 'hidden'
              }}>
                <a href="/" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  color: '#374151',
                  textDecoration: 'none',
                  fontSize: '14px',
                  borderBottom: '1px solid #f3f4f6'
                }}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Accueil
                </a>
                <a href="/disponibilites" style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px 16px',
                  color: '#374151',
                  textDecoration: 'none',
                  fontSize: '14px',
                  borderBottom: '1px solid #f3f4f6'
                }}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Mes disponibilités
                </a>
                <button
                  onClick={handleSignOut}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    color: '#dc2626',
                    backgroundColor: 'white',
                    border: 'none',
                    width: '100%',
                    textAlign: 'left',
                    fontSize: '14px',
                    cursor: 'pointer'
                  }}
                >
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Déconnexion
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

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
            {/* Section Photo */}
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
                {/* Aperçu photo */}
                <div style={{
                  width: '120px',
                  height: '120px',
                  borderRadius: '50%',
                  backgroundColor: '#f3f4f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  border: '3px solid #e5e7eb'
                }}>
                  {photoPreview ? (
                    <img
                      src={photoPreview}
                      alt="Photo de profil"
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover'
                      }}
                    />
                  ) : (
                    <div style={{
                      fontSize: '48px',
                      fontWeight: '600',
                      color: '#9ca3af'
                    }}>
                      {getInitials()}
                    </div>
                  )}
                </div>
                
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoSelect}
                    style={{ display: 'none' }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingPhoto}
                    style={{
                      padding: '10px 20px',
                      backgroundColor: '#1e3a5f',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '14px',
                      fontWeight: '500',
                      cursor: uploadingPhoto ? 'not-allowed' : 'pointer',
                      opacity: uploadingPhoto ? 0.7 : 1
                    }}
                  >
                    {uploadingPhoto ? 'Téléchargement...' : 'Changer la photo'}
                  </button>
                  <p style={{ 
                    margin: '12px 0 0 0', 
                    fontSize: '13px', 
                    color: '#6b7280',
                    maxWidth: '300px'
                  }}>
                    La photo doit montrer clairement votre visage. Format JPG ou PNG, max 5 Mo.
                  </p>
                  {faceDetectionStatus === 'loading' && (
                    <p style={{ margin: '8px 0 0 0', fontSize: '13px', color: '#2563eb' }}>
                      Analyse de la photo en cours...
                    </p>
                  )}
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
                
                <div>
                  <label style={labelStyle}>Ville</label>
                  <input
                    type="text"
                    value={formData.ville}
                    onChange={(e) => handleInputChange('ville', e.target.value)}
                    style={inputStyle}
                  />
                </div>
                
                <div>
                  <label style={labelStyle}>Région / District</label>
                  <input
                    type="text"
                    value={formData.region}
                    onChange={(e) => handleInputChange('region', e.target.value)}
                    style={inputStyle}
                  />
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

            {/* Section Statut (lecture seule) */}
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
