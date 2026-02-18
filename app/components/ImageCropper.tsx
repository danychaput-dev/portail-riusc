'use client'

import { useState, useRef, useEffect } from 'react'

interface ImageCropperProps {
  currentPhotoUrl?: string | null
  initials?: string
  size?: number
  onCropComplete: (croppedBlob: Blob) => Promise<void>
  uploading?: boolean
}

export default function ImageCropper({
  currentPhotoUrl,
  initials = '?',
  size = 120,
  onCropComplete,
  uploading = false,
}: ImageCropperProps) {
  const [showModal, setShowModal] = useState(false)
  const [imageSrc, setImageSrc] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [imgNatural, setImgNatural] = useState({ w: 0, h: 0 })
  const [baseScale, setBaseScale] = useState(1)
  const [processing, setProcessing] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const CROP_SIZE = 280

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image (JPG, PNG, etc.)')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      alert('Image trop volumineuse (max 10 Mo)')
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      const src = ev.target?.result as string
      setImageSrc(src)
      setZoom(1)
      setPan({ x: 0, y: 0 })
      setShowModal(true)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Calculate base scale so image covers the crop area
  useEffect(() => {
    if (!imageSrc) return
    const img = new window.Image()
    img.onload = () => {
      const w = img.naturalWidth
      const h = img.naturalHeight
      setImgNatural({ w, h })
      // Cover: scale the smaller dimension to fill CROP_SIZE
      const scale = Math.max(CROP_SIZE / w, CROP_SIZE / h)
      setBaseScale(scale)
    }
    img.src = imageSrc
  }, [imageSrc])

  // Drag handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    setDragging(true)
    setDragStart({ x: e.clientX, y: e.clientY })
    setPanStart({ x: pan.x, y: pan.y })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return
    e.preventDefault()
    setPan({
      x: panStart.x + (e.clientX - dragStart.x),
      y: panStart.y + (e.clientY - dragStart.y),
    })
  }

  const handlePointerUp = () => {
    setDragging(false)
  }

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.05 : 0.05
    setZoom(prev => Math.min(3, Math.max(1, prev + delta)))
  }

  // Rendered image dimensions and position in preview
  const renderW = imgNatural.w * baseScale * zoom
  const renderH = imgNatural.h * baseScale * zoom
  const imgLeft = (CROP_SIZE - renderW) / 2 + pan.x
  const imgTop = (CROP_SIZE - renderH) / 2 + pan.y

  // Crop and output
  const handleCrop = async () => {
    if (!imageSrc || !canvasRef.current || !imgNatural.w) return

    setProcessing(true)

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    const OUTPUT = 400
    canvas.width = OUTPUT
    canvas.height = OUTPUT

    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.src = imageSrc

    await new Promise<void>((resolve) => {
      img.onload = () => resolve()
      if (img.complete) resolve()
    })

    // Circle clip
    ctx.clearRect(0, 0, OUTPUT, OUTPUT)
    ctx.beginPath()
    ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()

    // Scale preview coords → output coords
    const s = OUTPUT / CROP_SIZE

    ctx.drawImage(
      img,
      imgLeft * s,
      imgTop * s,
      renderW * s,
      renderH * s
    )

    canvas.toBlob(
      async (blob) => {
        if (blob) {
          try {
            await onCropComplete(blob)
            setShowModal(false)
            setImageSrc(null)
          } catch (err) {
            console.error('Erreur upload:', err)
          }
        }
        setProcessing(false)
      },
      'image/jpeg',
      0.9
    )
  }

  const isLoading = processing || uploading

  return (
    <>
      {/* Clickable avatar */}
      <div
        onClick={() => fileInputRef.current?.click()}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          overflow: 'hidden',
          cursor: 'pointer',
          position: 'relative',
          flexShrink: 0,
        }}
      >
        {currentPhotoUrl ? (
          <img
            src={currentPhotoUrl}
            alt="Photo de profil"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: '100%',
            backgroundColor: '#1e3a5f',
            color: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: size * 0.35,
          }}>
            {initials}
          </div>
        )}

        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.4)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0,
            transition: 'opacity 0.2s',
            borderRadius: '50%',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0')}
        >
          <svg width="24" height="24" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
            <circle cx="12" cy="13" r="4" />
          </svg>
          <span style={{ color: 'white', fontSize: '11px', marginTop: '4px', fontWeight: 600 }}>Modifier</span>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Modal */}
      {showModal && imageSrc && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '16px',
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !isLoading) {
              setShowModal(false)
              setImageSrc(null)
            }
          }}
        >
          <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            padding: '24px',
            maxWidth: '380px',
            width: '100%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700, color: '#1e3a5f', textAlign: 'center' }}>
              Recadrer la photo
            </h3>

            {/* Crop circle */}
            <div
              style={{
                width: CROP_SIZE,
                height: CROP_SIZE,
                margin: '0 auto',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '50%',
                backgroundColor: '#1a1a1a',
                cursor: dragging ? 'grabbing' : 'grab',
                touchAction: 'none',
                border: '3px solid #1e3a5f',
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onWheel={handleWheel}
            >
              {imgNatural.w > 0 && (
                <img
                  src={imageSrc}
                  alt="Preview"
                  draggable={false}
                  style={{
                    position: 'absolute',
                    left: `${imgLeft}px`,
                    top: `${imgTop}px`,
                    width: `${renderW}px`,
                    height: `${renderH}px`,
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                />
              )}
            </div>

            {/* Zoom */}
            <div style={{ margin: '20px auto 0', maxWidth: CROP_SIZE, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ fontSize: '20px', color: '#6b7280', lineHeight: 1, userSelect: 'none' }}>−</span>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: '#1e3a5f' }}
              />
              <span style={{ fontSize: '20px', color: '#6b7280', lineHeight: 1, userSelect: 'none' }}>+</span>
            </div>

            <p style={{ textAlign: 'center', fontSize: '12px', color: '#9ca3af', margin: '8px 0 0' }}>
              Glissez pour repositionner · Zoomez avec le curseur
            </p>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button
                onClick={() => { setShowModal(false); setImageSrc(null) }}
                disabled={isLoading}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px',
                  border: '1px solid #d1d5db', backgroundColor: 'white',
                  color: '#374151', fontSize: '14px', fontWeight: 600,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.5 : 1,
                }}
              >
                Annuler
              </button>
              <button
                onClick={handleCrop}
                disabled={isLoading}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px',
                  border: 'none', backgroundColor: '#1e3a5f', color: 'white',
                  fontSize: '14px', fontWeight: 600,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.7 : 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
              >
                {isLoading ? (
                  <>
                    <span style={{
                      width: '16px', height: '16px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: 'white', borderRadius: '50%',
                      display: 'inline-block',
                      animation: 'cropspin 0.8s linear infinite',
                    }} />
                    Envoi...
                  </>
                ) : 'Valider'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes cropspin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
