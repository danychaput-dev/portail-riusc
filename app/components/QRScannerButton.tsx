'use client'

// Bouton QR dans l'en-tête du portail.
// Clic → overlay plein écran avec caméra → scan du QR → redirect /punch/[token].
//
// Utilise html5-qrcode côté client (chargement dynamique pour éviter
// les erreurs SSR de Next.js).

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

const C = '#1e3a5f'
const GREEN = '#16a34a'
const RED = '#dc2626'
const MUTED = '#6b7280'

export default function QRScannerButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [scanning, setScanning] = useState(false)
  const scannerRef = useRef<any>(null)

  // Démarrer le scanner quand l'overlay s'ouvre
  useEffect(() => {
    if (!open) return

    let cancelled = false
    let htmlScanner: any = null

    ;(async () => {
      setError(null)
      setScanning(true)
      try {
        // 1. Forcer la demande de permission caméra explicitement AVANT d'utiliser
        // html5-qrcode. Sur certains navigateurs mobiles, getCameras() échoue
        // silencieusement sans déclencher la popup de permission.
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
          })
          // On libère immédiatement — html5-qrcode ouvrira son propre stream ensuite
          stream.getTracks().forEach(t => t.stop())
        } catch (permErr: any) {
          const m = (permErr?.name || '') + ' ' + (permErr?.message || '')
          if (cancelled) return
          if (/NotAllowed|Permission/i.test(m)) {
            setError("Accès caméra refusé. Va dans Chrome → 3 points → Paramètres → Paramètres du site → Appareil photo, et autorise portail.riusc.ca.")
          } else if (/NotFound|DevicesNotFound/i.test(m)) {
            setError('Aucune caméra disponible sur cet appareil.')
          } else if (/NotReadable/i.test(m)) {
            setError('La caméra est utilisée par une autre application. Ferme-la et réessaie.')
          } else {
            setError('Impossible d\'accéder à la caméra : ' + (permErr?.message || 'erreur inconnue'))
          }
          setScanning(false)
          return
        }

        // 2. Chargement dynamique de html5-qrcode (évite SSR)
        const mod = await import('html5-qrcode')
        if (cancelled) return

        const Html5Qrcode = mod.Html5Qrcode
        htmlScanner = new Html5Qrcode('qr-reader-region')
        scannerRef.current = htmlScanner

        const cameras = await Html5Qrcode.getCameras()
        if (cancelled) return

        if (!cameras || cameras.length === 0) {
          setError("Aucune caméra détectée. Autorise l'accès dans les paramètres du navigateur.")
          setScanning(false)
          return
        }

        // Priorité : caméra arrière (en mobile)
        const rear = cameras.find((c: any) => /back|rear|arrière/i.test(c.label)) || cameras[cameras.length - 1]

        await htmlScanner.start(
          rear.id,
          { fps: 10, qrbox: { width: 260, height: 260 } },
          (decodedText: string) => {
            // Succès — arrêter le scan et naviguer
            handleScanned(decodedText, htmlScanner)
          },
          () => { /* erreurs par frame ignorées */ }
        )
      } catch (e: any) {
        if (cancelled) return
        const msg = (e?.message || '').toString()
        if (msg.includes('Permission') || msg.includes('NotAllowed')) {
          setError("Accès caméra refusé. Autorise-le dans les paramètres du navigateur.")
        } else if (msg.includes('NotFound') || msg.includes('DevicesNotFound')) {
          setError('Aucune caméra disponible sur cet appareil.')
        } else {
          setError('Impossible de démarrer le scanner. ' + (msg || ''))
        }
        setScanning(false)
      }
    })()

    return () => {
      cancelled = true
      if (scannerRef.current) {
        try {
          scannerRef.current.stop().catch(() => {})
          scannerRef.current.clear()
        } catch {}
        scannerRef.current = null
      }
    }
  }, [open])

  const handleScanned = async (decodedText: string, scanner: any) => {
    // Stopper le scanner
    try { await scanner.stop() } catch {}
    try { scanner.clear() } catch {}
    scannerRef.current = null

    // Parser l'URL du QR — attendu : https://portail.riusc.ca/punch/TOKEN
    // On tolère tout host — on extrait juste le /punch/TOKEN
    let token: string | null = null
    try {
      const u = new URL(decodedText)
      const m = u.pathname.match(/\/punch\/([a-zA-Z0-9]+)/)
      if (m) token = m[1]
    } catch {
      // Peut-être juste le token brut sans URL
      if (/^[a-zA-Z0-9]{12,}$/.test(decodedText.trim())) {
        token = decodedText.trim()
      }
    }

    if (!token) {
      setError('Ce QR ne correspond pas à un pointage RIUSC.')
      setScanning(false)
      return
    }

    setOpen(false)
    router.push(`/punch/${token}`)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Scanner un QR de pointage"
        aria-label="Scanner un QR de pointage"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 36, height: 36, borderRadius: '50%',
          border: '1.5px solid #d1d5db', backgroundColor: 'white',
          cursor: 'pointer', color: C, marginRight: 8, transition: 'all 0.15s',
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'white'}
      >
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

      {open && (
        <div style={overlayStyle}>
          <div style={{ position: 'absolute', top: 16, right: 16, zIndex: 10 }}>
            <button
              onClick={() => setOpen(false)}
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
            Scanner un QR de pointage
          </div>

          <div id="qr-reader-region" style={{ width: '100%', maxWidth: 520, maxHeight: '80vh' }} />

          {error && (
            <div style={{ position: 'absolute', bottom: 24, left: 16, right: 16, padding: 14, borderRadius: 10, backgroundColor: 'white', color: RED, fontSize: 13, textAlign: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.3)' }}>
              {error}
            </div>
          )}

          {scanning && !error && (
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
