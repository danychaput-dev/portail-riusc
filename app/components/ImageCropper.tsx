'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

interface ImageCropperProps {
  /** Current photo URL (or null if no photo) */
  currentPhotoUrl?: string | null
  /** Initials to show when no photo */
  initials?: string
  /** Size of the avatar circle in px */
  size?: number
  /** Called with the cropped Blob when user confirms */
  onCropComplete: (croppedBlob: Blob) => Promise<void>
  /** Whether an upload is in progress */
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
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 })
  const [processing, setProcessing] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)

  // Crop area size (square that fits the modal)
  const CROP_SIZE = 280

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate type
    if (!file.type.startsWith('image/')) {
      alert('Veuillez sélectionner une image (JPG, PNG, etc.)')
      return
    }

    // Validate size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('Image trop volumineuse (max 10 Mo)')
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      setImageSrc(ev.target?.result as string)
      setZoom(1)
      setOffset({ x: 0, y: 0 })
      setShowModal(true)
    }
    reader.readAsDataURL(file)

    // Reset input so same file can be re-selected
    e.target.value = ''
  }

  // Calculate image dimensions to fit-cover the crop area
  const getImageTransform = useCallback(() => {
    if (!imgSize.w || !imgSize.h) return { x: 0, y: 0, w: CROP_SIZE, h: CROP_SIZE }

    const aspect = imgSize.w / imgSize.h
    let drawW: number, drawH: number

    if (aspect > 1) {
      // Landscape: height fits, width extends
      drawH = CROP_SIZE * zoom
      drawW = drawH * aspect
    } else {
      // Portrait: width fits, height extends
      drawW = CROP_SIZE * zoom
      drawH = drawW / aspect
    }

    const x = (CROP_SIZE - drawW) / 2 + offset.x
    const y = (CROP_SIZE - drawH) / 2 + offset.y

    return { x, y, w: drawW, h: drawH }
  }, [imgSize, zoom, offset])

  // Load image dimensions when src changes
  useEffect(() => {
    if (!imageSrc) return
    const img = new window.Image()
    img.onload = () => {
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight })
    }
    img.src = imageSrc
  }, [imageSrc])

  // Mouse/touch drag handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    setDragging(true)
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragging) return
    e.preventDefault()
    setOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }

  const handlePointerUp = () => {
    setDragging(false)
  }

  // Crop and return blob
  const handleCrop = async () => {
    if (!imageSrc || !canvasRef.current) return

    setProcessing(true)

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    const outputSize = 400 // Final image: 400x400px

    canvas.width = outputSize
    canvas.height = outputSize

    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.src = imageSrc

    await new Promise<void>((resolve) => {
      img.onload = () => resolve()
      if (img.complete) resolve()
    })

    // Draw with circular clip
    ctx.clearRect(0, 0, outputSize, outputSize)
    ctx.beginPath()
    ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2)
    ctx.closePath()
    ctx.clip()

    // Scale transform from preview to output
    const scale = outputSize / CROP_SIZE
    const t = getImageTransform()

    ctx.drawImage(
      img,
      t.x * scale,
      t.y * scale,
      t.w * scale,
      t.h * scale
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

  const transform = getImageTransform()
  const isLoading = processing || uploading

  return (
    <>
      {/* Avatar clickable */}
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
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              backgroundColor: '#1e3a5f',
              color: 'white',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
              fontSize: size * 0.35,
            }}
          >
            {initials}
          </div>
        )}

        {/* Overlay hover */}
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

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* Hidden canvas for cropping */}
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* Modal crop */}
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
          <div
            style={{
              backgroundColor: 'white',
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '380px',
              width: '100%',
              boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: '18px', fontWeight: 700, color: '#1e3a5f', textAlign: 'center' }}>
              Recadrer la photo
            </h3>

            {/* Crop area */}
            <div
              ref={previewRef}
              style={{
                width: CROP_SIZE,
                height: CROP_SIZE,
                margin: '0 auto',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '50%',
                backgroundColor: '#e5e7eb',
                cursor: dragging ? 'grabbing' : 'grab',
                touchAction: 'none',
                border: '3px solid #1e3a5f',
              }}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
            >
              {imgSize.w > 0 && (
                <img
                  src={imageSrc}
                  alt="Preview"
                  draggable={false}
                  style={{
                    position: 'absolute',
                    left: transform.x,
                    top: transform.y,
                    width: transform.w,
                    height: transform.h,
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                />
              )}
            </div>

            {/* Zoom slider */}
            <div style={{ margin: '20px auto 0', maxWidth: CROP_SIZE, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <svg width="18" height="18" fill="none" stroke="#6b7280" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
                <path d="M8 11h6" />
              </svg>
              <input
                type="range"
                min="1"
                max="3"
                step="0.01"
                value={zoom}
                onChange={(e) => setZoom(parseFloat(e.target.value))}
                style={{
                  flex: 1,
                  accentColor: '#1e3a5f',
                  height: '6px',
                }}
              />
              <svg width="18" height="18" fill="none" stroke="#6b7280" strokeWidth="2" viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
                <path d="M11 8v6M8 11h6" />
              </svg>
            </div>

            <p style={{ textAlign: 'center', fontSize: '12px', color: '#9ca3af', margin: '8px 0 0' }}>
              Glissez pour repositionner · Zoomez avec le curseur
            </p>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
              <button
                onClick={() => {
                  setShowModal(false)
                  setImageSrc(null)
                }}
                disabled={isLoading}
                style={{
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  border: '1px solid #d1d5db',
                  backgroundColor: 'white',
                  color: '#374151',
                  fontSize: '14px',
                  fontWeight: 600,
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
                  flex: 1,
                  padding: '12px',
                  borderRadius: '10px',
                  border: 'none',
                  backgroundColor: '#1e3a5f',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  opacity: isLoading ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                {isLoading ? (
                  <>
                    <span style={{
                      width: '16px',
                      height: '16px',
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: 'white',
                      borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }} />
                    Envoi...
                  </>
                ) : (
                  'Valider'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  )
}
