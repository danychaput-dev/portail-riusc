import type { StepStatus } from '../types'
import { STEP_LABELS, STEP_SUBS } from '../types'

export function SidebarStepper({ statuses, curStep, onStep, selSin, selDep }: {
  statuses: StepStatus[]
  curStep: number
  onStep: (n: number) => void
  selSin?: { nom: string }
  selDep?: { nom: string; identifiant: string }
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Contexte actif */}
      {(selSin || selDep) && (
        <div style={{ padding: '12px 16px', backgroundColor: '#f0fdf4', borderRadius: 10, border: '1px solid #bbf7d0', marginBottom: 20 }}>
          {selSin && <div style={{ fontSize: 12, fontWeight: 600, color: '#065f46', marginBottom: selDep ? 3 : 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>🔥 {selSin.nom}</div>}
          {selDep && <div style={{ fontSize: 11, color: '#047857', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>🚁 {selDep.identifiant} — {selDep.nom}</div>}
        </div>
      )}

      {STEP_LABELS.map((label, i) => {
        const n = i + 1
        const s = statuses[i] || 'locked'
        const isDone = s === 'done'
        const isActive = s === 'active'
        const isLocked = s === 'locked'
        const isAI = n === 7
        const isLast = n === 8

        const circleColor = isDone ? '#10b981' : isActive ? (isAI ? '#8b5cf6' : '#3b82f6') : '#d1d5db'
        const labelColor = isDone ? '#065f46' : isActive ? (isAI ? '#5b21b6' : '#1d4ed8') : '#9ca3af'
        const lineColor = isDone ? '#10b981' : '#e5e7eb'

        return (
          <div key={n}>
            <div
              onClick={() => !isLocked && onStep(n)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 10px', borderRadius: 8,
                cursor: isLocked ? 'default' : 'pointer',
                backgroundColor: isActive ? (isAI ? '#faf5ff' : '#eff6ff') : 'transparent',
                border: isActive ? `1px solid ${isAI ? '#ddd6fe' : '#bfdbfe'}` : '1px solid transparent',
                transition: 'background 0.1s',
              }}
            >
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                backgroundColor: circleColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: isDone ? 13 : 12, fontWeight: 700, color: 'white',
                boxShadow: isActive ? `0 0 0 3px ${isAI ? '#ede9fe' : '#dbeafe'}` : 'none',
                transition: 'box-shadow 0.2s',
              }}>
                {isDone ? '✓' : isAI ? '✦' : n}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: isActive ? 600 : 500, color: labelColor, display: 'flex', alignItems: 'center', gap: 5 }}>
                  {label}
                  {isAI && !isLocked && (
                    <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 6, backgroundColor: '#8b5cf6', color: 'white', fontWeight: 700 }}>IA</span>
                  )}
                  {isLocked && <span style={{ fontSize: 11 }}>🔒</span>}
                </div>
                <div style={{ fontSize: 10, color: isActive ? labelColor : '#c4c4c4', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {STEP_SUBS[i]}
                </div>
              </div>
            </div>

            {!isLast && (
              <div style={{ marginLeft: 23, width: 2, height: 12, backgroundColor: lineColor, borderRadius: 1 }} />
            )}
          </div>
        )
      })}

      <div style={{ marginTop: 20, padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: 8, border: '1px solid #e5e7eb' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 11, color: '#64748b', fontWeight: 600 }}>Progression</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#1e3a5f' }}>
            {statuses.filter(s => s === 'done').length}/8
          </span>
        </div>
        <div style={{ height: 4, backgroundColor: '#e5e7eb', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 2,
            width: `${(statuses.filter(s => s === 'done').length / 8) * 100}%`,
            backgroundColor: '#10b981', transition: 'width 0.4s',
          }} />
        </div>
      </div>
    </div>
  )
}
