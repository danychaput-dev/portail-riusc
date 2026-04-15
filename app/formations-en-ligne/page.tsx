'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/utils/supabase/client'
import PortailHeader from '@/app/components/PortailHeader'

const supabase = createClient()

interface Module {
  id: string
  titre: string
  description: string | null
  bucket_path: string
  ordre: number | null
  certificat: boolean | null
}

interface Progression {
  module_id: string
  statut: string | null
  progression_pct: number | null
  score: number | null
  nb_tentatives: number | null
  date_debut: string | null
  date_completion: string | null
}

export default function FormationsEnLignePage() {
  const [user, setUser] = useState<any>(null)
  const [reserviste, setReserviste] = useState<any>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [progressions, setProgressions] = useState<Record<string, Progression>>({})
  const [moduleActif, setModuleActif] = useState<Module | null>(null)
  const [loading, setLoading] = useState(true)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const debutRef = useRef<boolean>(false)
  const [iframeLoading, setIframeLoading] = useState(false)
  const [loadProgress, setLoadProgress] = useState(0)
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Charger l'utilisateur et les données
  useEffect(() => {
    const init = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { window.location.href = '/login'; return }
      setUser(authUser)

      // Charger le réserviste
      const { data: res } = await supabase
        .from('reservistes')
        .select('benevole_id, prenom, nom, groupe')
        .eq('user_id', authUser.id)
        .single()
      if (res) setReserviste(res)

      // Charger les modules accessibles
      const { data: mods } = await supabase
        .from('lms_modules')
        .select('id, titre, description, bucket_path, ordre, certificat')
        .order('ordre')
      if (mods) setModules(mods)

      // Charger les progressions
      if (res) {
        const { data: progs } = await supabase
          .from('lms_progression')
          .select('*')
          .eq('benevole_id', res.benevole_id)

        if (progs) {
          const map: Record<string, Progression> = {}
          progs.forEach(p => { map[p.module_id] = p })
          setProgressions(map)
        }
      }

      setLoading(false)
    }
    init()
  }, [])

  // Tracking : démarrer le module
  const marquerDebut = useCallback(async (mod: Module) => {
    if (!reserviste || debutRef.current) return
    debutRef.current = true

    const prog = progressions[mod.id]
    if (prog?.statut === 'complété') return

    await supabase
      .from('lms_progression')
      .upsert({
        benevole_id: reserviste.benevole_id,
        module_id: mod.id,
        statut: 'en_cours',
        date_debut: prog?.date_debut || new Date().toISOString(),
        nb_tentatives: (prog?.nb_tentatives || 0) + 1,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'benevole_id,module_id' })

    setProgressions(prev => ({
      ...prev,
      [mod.id]: {
        ...prev[mod.id],
        module_id: mod.id,
        statut: 'en_cours',
        date_debut: prev[mod.id]?.date_debut || new Date().toISOString(),
        nb_tentatives: (prev[mod.id]?.nb_tentatives || 0) + 1,
        progression_pct: prev[mod.id]?.progression_pct || 0,
        score: prev[mod.id]?.score || null,
        date_completion: prev[mod.id]?.date_completion || null,
      }
    }))
  }, [reserviste, progressions])

  const marquerCompletion = useCallback(async (mod: Module, score?: number | null) => {
    if (!reserviste) return
    const prog = progressions[mod.id]
    if (prog?.statut === 'complété') return

    await supabase
      .from('lms_progression')
      .upsert({
        benevole_id: reserviste.benevole_id,
        module_id: mod.id,
        statut: 'complété',
        progression_pct: 100,
        score: score || null,
        date_completion: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'benevole_id,module_id' })

    setProgressions(prev => ({
      ...prev,
      [mod.id]: {
        ...prev[mod.id],
        module_id: mod.id,
        statut: 'complété',
        progression_pct: 100,
        score: score || null,
        date_completion: new Date().toISOString(),
        date_debut: prev[mod.id]?.date_debut || null,
        nb_tentatives: prev[mod.id]?.nb_tentatives || 1,
      }
    }))
  }, [reserviste, progressions])

  // Verbes xAPI officiels ADL
  const XAPI_VERBS = {
    completed:   'http://adlnet.gov/expapi/verbs/completed',
    passed:      'http://adlnet.gov/expapi/verbs/passed',
    initialized: 'http://adlnet.gov/expapi/verbs/initialized',
    experienced: 'http://adlnet.gov/expapi/verbs/experienced',
  } as const

  // Écouter les statements xAPI via postMessage (Storyline — détection principale)
  useEffect(() => {
    const ALLOWED_ORIGINS = new Set([
      'https://portail.riusc.ca',
      'https://lrs.aqbrs.ca',
    ])

    const handleMessage = (event: MessageEvent) => {
      if (!ALLOWED_ORIGINS.has(event.origin)) return
      if (!moduleActif) return

      const statement = event.data?.statement || event.data
      if (!statement?.verb?.id) return

      const verb = String(statement.verb.id)

      if (verb === XAPI_VERBS.completed || verb === XAPI_VERBS.passed) {
        const score =
          statement.result?.score?.scaled != null
            ? Math.round(statement.result.score.scaled * 100)
            : null
        marquerCompletion(moduleActif, score)
        return
      }

      if (verb === XAPI_VERBS.initialized || verb === XAPI_VERBS.experienced) {
        marquerDebut(moduleActif)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [moduleActif, marquerCompletion, marquerDebut])

  // Debug postMessage — dev uniquement, à retirer une fois Storyline validé
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return
    const debug = (e: MessageEvent) =>
      console.log('[xAPI postMessage]', e.origin, e.data)
    window.addEventListener('message', debug)
    return () => window.removeEventListener('message', debug)
  }, [])

  const handleIframeLoad = useCallback(() => {
    if (!moduleActif) return

    try {
      const href = iframeRef.current?.contentWindow?.location?.href || ''
      if (href.includes('goodbye')) {
        marquerCompletion(moduleActif)
      } else {
        marquerDebut(moduleActif)
      }
    } catch {
      marquerDebut(moduleActif)
    }
  }, [moduleActif, marquerDebut, marquerCompletion])

  const ouvrirModule = (mod: Module) => {
    debutRef.current = false
    setIframeLoading(true)
    setLoadProgress(0)
    setModuleActif(mod)

    // Progression simulée
    if (progressRef.current) clearInterval(progressRef.current)
    progressRef.current = setInterval(() => {
      setLoadProgress(p => {
        if (p >= 90) { clearInterval(progressRef.current!); return 90 }
        return p + 1.5
      })
    }, 120)
  }

  const fermerModule = async () => {
    setModuleActif(null)
    debutRef.current = false
    setIframeLoading(false)
    setLoadProgress(0)
    if (progressRef.current) clearInterval(progressRef.current)

    // Rafraîchir les progressions après fermeture
    if (reserviste) {
      const { data: progs } = await supabase
        .from('lms_progression')
        .select('*')
        .eq('benevole_id', reserviste.benevole_id)
      if (progs) {
        const map: Record<string, Progression> = {}
        progs.forEach(p => { map[p.module_id] = p })
        setProgressions(map)
      }
    }
  }

  const getStatutBadge = (moduleId: string) => {
    const prog = progressions[moduleId]
    if (!prog || prog.statut === 'non_commencé') return null
    if (prog.statut === 'complété') return { label: '✓ Complété', color: '#2e7d32', bg: '#e8f5e9' }
    if (prog.statut === 'en_cours') return { label: '⏳ En cours', color: '#e65100', bg: '#fff3e0' }
    return null
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#f5f7fa', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#1e3a5f', fontSize: 16 }}>Chargement...</div>
      </div>
    )
  }

  // Mode plein écran iFrame
  if (moduleActif) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
        {/* Barre du haut */}
        <div style={{
          background: '#1e3a5f',
          color: '#fff',
          padding: '10px 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
          height: 48,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>{moduleActif.titre}</span>
            {progressions[moduleActif.id]?.statut === 'en_cours' && (
              <span style={{ fontSize: 12, background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: 4 }}>
                En cours
              </span>
            )}
            {progressions[moduleActif.id]?.statut === 'complété' && (
              <span style={{ fontSize: 12, background: '#2e7d32', padding: '2px 8px', borderRadius: 4 }}>
                ✓ Complété
              </span>
            )}
          </div>
          <button
            onClick={fermerModule}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: 'none',
              color: '#fff',
              padding: '6px 14px',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            ← Retour
          </button>
        </div>

        {/* iFrame xAPI */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          {iframeLoading && (
            <div style={{
              position: 'absolute', inset: 0, background: '#f5f7fa',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              zIndex: 10, gap: 20
            }}>
              <div style={{
                width: 52, height: 52,
                border: '4px solid #e2e8f0',
                borderTop: '4px solid #1e3a5f',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite'
              }} />
              <div style={{ textAlign: 'center' }}>
                <p style={{ color: '#1e3a5f', fontSize: 17, fontWeight: 600, margin: '0 0 6px' }}>
                  Chargement de la formation...
                </p>
                <p style={{ color: '#9ca3af', fontSize: 14, margin: 0 }}>
                  {moduleActif.titre}
                </p>
              </div>
              <div style={{ width: 260, height: 6, background: '#e2e8f0', borderRadius: 99 }}>
                <div style={{
                  width: `${loadProgress}%`, height: '100%',
                  background: '#1e3a5f', borderRadius: 99,
                  transition: 'width 0.12s linear'
                }} />
              </div>
              <p style={{ color: '#9ca3af', fontSize: 12, margin: 0 }}>{Math.round(loadProgress)}%</p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          )}
          <iframe
            ref={iframeRef}
            src={(() => {
              const endpoint = encodeURIComponent('https://lrs.aqbrs.ca/xapi/')
              const auth = encodeURIComponent('Basic ' + btoa('riusc:RiuscLrs2026!'))
              const actorObj = {
                name: `${reserviste?.prenom || ''} ${reserviste?.nom || ''}`.trim(),
                mbox: `mailto:${user?.email || ''}`,
                objectType: 'Agent',
              }
              const actor = encodeURIComponent(JSON.stringify(actorObj))
              return `/api/lms/${moduleActif.bucket_path}/scormdriver/indexAPI.html?endpoint=${endpoint}&auth=${auth}&actor=${actor}`
            })()}
            style={{ width: '100%', height: '100%', border: 'none', display: 'block' }}
            onLoad={() => {
              if (progressRef.current) clearInterval(progressRef.current)
              setLoadProgress(100)
              setTimeout(() => setIframeLoading(false), 300)
              handleIframeLoad()
            }}
            title={moduleActif.titre}
            allow="fullscreen"
          />
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <PortailHeader />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '32px 16px' }}>

        {/* En-tête */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1e3a5f', margin: '0 0 8px' }}>
            Formations en ligne
          </h1>
          <p style={{ color: '#555', fontSize: 15, margin: 0 }}>
            Complétez les modules à votre rythme. Votre progression est sauvegardée automatiquement.
          </p>
        </div>

        {/* Liste des modules */}
        {modules.length === 0 ? (
          <div style={{
            background: '#fff',
            borderRadius: 12,
            padding: 40,
            textAlign: 'center',
            color: '#888',
            border: '1px solid #e2e8f0',
          }}>
            Aucun module disponible pour l'instant.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {modules.map((mod, idx) => {
              const badge = getStatutBadge(mod.id)
              const prog = progressions[mod.id]
              const isComplete = prog?.statut === 'complété'

              return (
                <div
                  key={mod.id}
                  style={{
                    background: '#fff',
                    borderRadius: 12,
                    border: `1px solid ${isComplete ? '#a5d6a7' : '#e2e8f0'}`,
                    padding: '24px 28px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 20,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                  }}
                >
                  {/* Numéro */}
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: isComplete ? '#2e7d32' : '#1e3a5f',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    fontWeight: 700,
                    flexShrink: 0,
                  }}>
                    {isComplete ? '✓' : idx + 1}
                  </div>

                  {/* Contenu */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 16, fontWeight: 600, color: '#1e3a5f' }}>
                        {mod.titre}
                      </span>
                      {badge && (
                        <span style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: badge.color,
                          background: badge.bg,
                          padding: '2px 10px',
                          borderRadius: 20,
                        }}>
                          {badge.label}
                        </span>
                      )}
                      {mod.certificat && (
                        <span style={{
                          fontSize: 12,
                          color: '#b45309',
                          background: '#fef3c7',
                          padding: '2px 10px',
                          borderRadius: 20,
                        }}>
                          🎓 Certificat
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 14, color: '#666', margin: 0, lineHeight: 1.5 }}>
                      {mod.description}
                    </p>
                    {prog?.date_completion && (
                      <p style={{ fontSize: 12, color: '#888', margin: '6px 0 0' }}>
                        Complété le {new Date(prog.date_completion).toLocaleDateString('fr-CA', {
                          day: 'numeric', month: 'long', year: 'numeric'
                        })}
                        {prog.score != null && ` · Score : ${prog.score}%`}
                      </p>
                    )}
                  </div>

                  {/* Bouton */}
                  <button
                    onClick={() => ouvrirModule(mod)}
                    style={{
                      background: isComplete ? '#f1f8f1' : '#1e3a5f',
                      color: isComplete ? '#2e7d32' : '#fff',
                      border: isComplete ? '1px solid #a5d6a7' : 'none',
                      padding: '10px 22px',
                      borderRadius: 8,
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: 600,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isComplete ? 'Revoir' : prog?.statut === 'en_cours' ? 'Continuer →' : 'Commencer →'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
