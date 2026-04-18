'use client'

// Bouton QR dans l'en-tête du portail.
// Deux stratégies pour garantir un scan dans tous les cas :
//   1. Caméra live (html5-qrcode) — préférée, plus rapide. La permission est
//      demandée DANS LE onClick (user gesture) pour que le navigateur mobile
//      ne refuse pas silencieusement.
//   2. Prendre une photo (input file avec capture=environment) — fallback
//      toujours fonctionnel, contourne les blocages de permission.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const C = '#1e3a5f'
const GREEN = '#16a34a'
const LIGHT_GREEN = '#dcfce7'
const RED = '#dc2626'
const MUTED = '#6b7280'

export default function QRScannerButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const [usePhotoMode, setUsePhotoMode] = useState(false)
  const [onDuty, setOnDuty] = useState(false)
  const [supervisingCount, setSupervisingCount] = useState(0)
  const scannerRef = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Poll on-duty + supervising au montage + toutes les 60s
  useEffect(() => {
    let cancelled = false
    const check = async () => {
      try {
        const res = await fetch('/api/punch/on-duty', { cache: 'no-store' })
        if (!res.ok) return
        const json = await res.json()
        if (!cancelled) {
          setOnDuty(!!json.on_duty)
          setSupervisingCount(json.supervising_count || 0)
        }
      } catch {}
    }
    check()
    const interval = setInterval(check, 60_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  // Ouverture du scanner live — demande de permission dans le user gesture
  const handleOpenScanner = async () => {
    setError(null)
    setUsePhotoMode(false)

    // Diagnostic préalable : état actuel de la permission caméra
    let permState = 'unknown'
    try {
      if ('permissions' in navigator && navigator.permissions.query) {
        const p = await navigator.permissions.query({ name: 'camera' as PermissionName })
        permState = p.state  // 'granted' | 'denied' | 'prompt'
      }
    } catch {
      // Safari n'expose pas camera via Permissions API
    }

    // Test de permission dans le contexte du clic (avant tout setState asynchrone)
    try {
      const testStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
      })
      // On libère immédiatement — html5-qrcode ouvrira son propre stream
      // mais la permission est maintenant cachée pour la session, donc pas de re-prompt
      testStream.getTracks().forEach(t => t.stop())
      setOpen(true)
    } catch (err: any) {
      const name = err?.name || ''
      const msg = err?.message || ''

      // Message diagnostic explicite selon l'état de la permission
      let detail = ''
      if (permState === 'denied') {
        detail = ` [État permission : DENIED] Le navigateur a un refus enregistré. Ouvre l'icône cadenas à gauche de l'URL → Autorisations → réinitialise ou autorise « Appareil photo ». Vérifie aussi Paramètres Android → Apps → Chrome → Autorisations → Appareil photo.`
      } else if (permState === 'prompt') {
        detail = ` [État permission : PROMPT — devrait demander mais ne le fait pas] Chrome a probablement un bug ou une config empêchant la popup. Vide les données du site : cadenas → Autorisations → Réinitialiser.`
      } else if (permState === 'granted') {
        detail = ` [État permission : GRANTED mais getUserMedia refuse quand même — probablement caméra utilisée par une autre app ou problème pilote.]`
      } else {
        detail = ` [Permissions API non disponible — impossible de diagnostiquer.]`
      }

      if (/NotAllowed|Permission/i.test(name + msg)) {
        setError("Accès caméra refusé par le navigateur." + detail + " En attendant, le mode « Prendre une photo » fonctionne à 100%.")
      } else if (/NotFound|DevicesNotFound/i.test(name + msg)) {
        setError('Aucune caméra détectée.' + detail + ' Utilise « Prendre une photo ».')
      } else if (/NotReadable|TrackStartError/i.test(name + msg)) {
        setError('Caméra déjà utilisée par une autre app. Ferme-la et réessaie, ou prends une photo.' + detail)
      } else {
        setError('Impossible d\'ouvrir la caméra : ' + (msg || name || 'erreur inconnue') + detail)
      }
      // On laisse aussi l'option photo visible
      setOpen(true)
      setUsePhotoMode(true)
    }
  }

  // Mode fallback — utilisation de l'input file natif, qui ouvre l'appareil
  // photo sans passer par getUserMedia (toujours fonctionnel, pas de permission requise).
  const handleTakePhoto = () => {
    setError(null)
    fileInputRef.current?.click()
  }

  const handlePhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setScanning(true)
    setError(null)
    try {
      // Redimensionner la photo si trop grosse — sinon html5-qrcode peut échouer
      // sur les images 4000x3000 typiques des cellulaires modernes.
      const resized = await resizePhotoForQR(file)

      const mod = await import('html5-qrcode')
      const scanner = new mod.Html5Qrcode('qr-reader-region-photo', { verbose: false } as any)
      try {
        const decoded = await scanner.scanFile(resized, false)
        // Success : extraire le token et naviguer
        handleTokenFound(decoded)
      } catch (decodeErr: any) {
        // Si le premier essai échoue, tenter avec l'image originale (cas rares)
        try {
          const decoded2 = await scanner.scanFile(file, false)
          handleTokenFound(decoded2)
        } catch {
          setError("Aucun QR détecté dans la photo. Prends la photo en plein cadre, QR net, bien éclairé, sans angle trop incliné. Réessaie.")
        }
      } finally {
        try { scanner.clear() } catch {}
      }
    } catch (err: any) {
      setError('Erreur de traitement de la photo : ' + (err?.message || 'inconnu'))
    } finally {
      setScanning(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Redimensionne une photo pour optimiser le décodage QR.
  // Cible : 1600px max sur le côté long, PNG à qualité 0.85.
  const resizePhotoForQR = (file: File): Promise<File> => new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        const MAX = 1600
        let w = img.width, h = img.height
        if (Math.max(w, h) > MAX) {
          const ratio = MAX / Math.max(w, h)
          w = Math.round(w * ratio)
          h = Math.round(h * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('canvas non disponible')); return }
        ctx.drawImage(img, 0, 0, w, h)
        canvas.toBlob(
          (blob) => {
            if (!blob) { reject(new Error('toBlob a échoué')); return }
            resolve(new File([blob], 'qr.jpg', { type: 'image/jpeg' }))
          },
          'image/jpeg',
          0.85
        )
      }
      img.onerror = () => reject(new Error('image illisible'))
      img.src = reader.result as string
    }
    reader.onerror = () => reject(new Error('lecture fichier échouée'))
    reader.readAsDataURL(file)
  })

  // Mode live — html5-qrcode démarre quand l'overlay est ouvert et pas en mode photo
  useEffect(() => {
    if (!open || usePhotoMode) return

    let cancelled = false
    let htmlScanner: any = null

    ;(async () => {
      setScanning(true)
      try {
        const mod = await import('html5-qrcode')
        if (cancelled) return

        const Html5Qrcode = mod.Html5Qrcode
        htmlScanner = new Html5Qrcode('qr-reader-region')
        scannerRef.current = htmlScanner

        const cameras = await Html5Qrcode.getCameras()
        if (cancelled) return

        if (!cameras || cameras.length === 0) {
          setError("Aucune caméra détectée. Utilise « Prendre une photo ».")
          setUsePhotoMode(true)
          setScanning(false)
          return
        }

        const rear = cameras.find((c: any) => /back|rear|arrière/i.test(c.label)) || cameras[cameras.length - 1]

        await htmlScanner.start(
          rear.id,
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decodedText: string) => handleTokenFound(decodedText, htmlScanner),
          () => { /* erreurs par frame ignorées */ }
        )
      } catch (e: any) {
        if (cancelled) return
        setError('Impossible de démarrer le scanner live. Essaie « Prendre une photo ».')
        setUsePhotoMode(true)
        setScanning(false)
      }
    })()

    return () => {
      cancelled = true
      if (scannerRef.current) {
        try { scannerRef.current.stop().catch(() => {}) } catch {}
        try { scannerRef.current.clear() } catch {}
        scannerRef.current = null
      }
    }
  }, [open, usePhotoMode])

  // Extraction du token depuis le contenu scanné + redirection
  const handleTokenFound = async (decodedText: string, scanner?: any) => {
    if (scanner) {
      try { await scanner.stop() } catch {}
      try { scanner.clear() } catch {}
      scannerRef.current = null
    }

    let token: string | null = null
    try {
      const u = new URL(decodedText)
      const m = u.pathname.match(/\/punch\/([a-zA-Z0-9]+)/)
      if (m) token = m[1]
    } catch {
      if (/^[a-zA-Z0-9]{12,}$/.test(decodedText.trim())) {
        token = decodedText.trim()
      }
    }

    if (!token) {
      setError('Ce QR ne correspond pas à un QR de présence RIUSC.')
      return
    }

    setOpen(false)
    router.push(`/punch/${token}`)
  }

  const closeOverlay = () => {
    setOpen(false)
    setError(null)
    setUsePhotoMode(false)
  }

  return (
    <>
      <button
        onClick={handleOpenScanner}
        title={
          onDuty && supervisingCount > 0
            ? `Présence en cours · ${supervisingCount} personne(s) active(s) sur tes QR`
            : onDuty
              ? 'Présence en cours — scanner un QR'
              : supervisingCount > 0
                ? `${supervisingCount} personne(s) active(s) sur tes QR`
                : 'Scanner un QR de présence'
        }
        aria-label="Scanner un QR de présence"
        style={{
          position: 'relative',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: '50%',
          // Contour : bleu (supervisant) a priorité sur vert (on duty) pour rester visible
          border: supervisingCount > 0
            ? `2px solid #3b82f6`
            : onDuty
              ? `2px solid ${GREEN}`
              : '1.5px solid #d1d5db',
          // Fond : vert si on duty, blanc sinon
          backgroundColor: onDuty ? LIGHT_GREEN : 'white',
          cursor: 'pointer', color: onDuty ? GREEN : C, marginRight: 8, transition: 'all 0.15s',
          boxShadow: onDuty ? `0 0 0 2px ${LIGHT_GREEN}, 0 0 8px rgba(22,163,74,0.4)` : (supervisingCount > 0 ? '0 0 0 2px #dbeafe, 0 0 8px rgba(59,130,246,0.35)' : 'none'),
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = onDuty ? '#bbf7d0' : '#f3f4f6'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = onDuty ? LIGHT_GREEN : 'white'}
      >
        {/* Bulle chiffrée si supervision active */}
        {supervisingCount > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4,
            minWidth: 16, height: 16, padding: '0 4px',
            borderRadius: 8, backgroundColor: '#3b82f6', color: 'white',
            fontSize: 10, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid white', lineHeight: 1,
            pointerEvents: 'none',
          }}>
            {supervisingCount > 99 ? '99+' : supervisingCount}
          </span>
        )}
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="17" y="17" width="4" height="4" />
          <rect x="17" y="14" width="1" height="1" />
          <rect x="14" y="17" width="1" height="1" />
          <rect x="14" y="14" width="1" height="1" />
        </svg>
      </button>

      {/* Input caché pour capture photo (fallback) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handlePhotoSelected}
      />

      {open && (
        <div style={overlayStyle}>
          <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
            <button
              onClick={closeOverlay}
              aria-label="Fermer"
              style={{
                width: 40, height: 40, borderRadius: '50%',
                backgroundColor: 'rgba(255,255,255,0.9)', border: 'none',
                cursor: 'pointer', fontSize: 22, fontWeight: 700, color: '#111',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              ×
            </button>
          </div>

          <div style={{ position: 'absolute', top: 24, left: 0, right: 0, textAlign: 'center', color: 'white', fontSize: 16, fontWeight: 600, pointerEvents: 'none', textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
            Scanner un QR de présence
          </div>

          {!usePhotoMode && (
            <div id="qr-reader-region" style={{ width: '100%', maxWidth: 520, maxHeight: '70vh' }} />
          )}

          <div id="qr-reader-region-photo" style={{ display: 'none' }} />

          {usePhotoMode && (
            <div style={{ maxWidth: 420, padding: 30, textAlign: 'center', color: 'white' }}>
              <div style={{ fontSize: 54, marginBottom: 12 }}>📷</div>
              <div style={{ fontSize: 15, lineHeight: 1.5, marginBottom: 20 }}>
                Prends une photo du QR avec ton appareil. On décode automatiquement et on t'amène sur la page de présence.
              </div>
              <button
                onClick={handleTakePhoto}
                disabled={scanning}
                style={{
                  padding: '14px 28px', fontSize: 16, fontWeight: 700,
                  backgroundColor: 'white', color: C, border: 'none',
                  borderRadius: 10, cursor: scanning ? 'wait' : 'pointer',
                  opacity: scanning ? 0.6 : 1,
                }}
              >
                {scanning ? 'Décodage…' : '📸 Prendre une photo'}
              </button>
            </div>
          )}

          {error && (
            <div style={{ position: 'absolute', bottom: 24, left: 16, right: 16, padding: 14, borderRadius: 10, backgroundColor: 'white', color: RED, fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
              <div style={{ marginBottom: 10 }}>{error}</div>
              {!usePhotoMode && (
                <button
                  onClick={() => { setError(null); setUsePhotoMode(true) }}
                  style={{
                    padding: '8px 14px', fontSize: 13, fontWeight: 700,
                    backgroundColor: C, color: 'white', border: 'none',
                    borderRadius: 6, cursor: 'pointer',
                  }}
                >
                  📸 Prendre une photo à la place
                </button>
              )}
            </div>
          )}

          {scanning && !error && !usePhotoMode && (
            <div style={{ position: 'absolute', bottom: 30, left: 0, right: 0, textAlign: 'center', color: 'white', fontSize: 13, pointerEvents: 'none' }}>
              Pointe la caméra sur le QR code
            </div>
          )}
        </div>
      )}
    </>
  )
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.92)',
  zIndex: 10000,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}
