'use client';
import { REGIONS_QUEBEC, type RegionQuebec } from '@/utils/regions-quebec';

interface RegionSelectorProps {
  value: string;
  onChange: (region: string) => void;
  /** Si true → affiche un label + encadré d'avertissement, sinon affiche sélecteur discret */
  showWarning?: boolean;
}

export default function RegionSelector({ value, onChange, showWarning = false }: RegionSelectorProps) {
  return (
    <div>
      {showWarning && (
        <div style={{
          background: '#fff8e1',
          border: '1px solid #ffd166',
          borderRadius: 6,
          padding: '8px 12px',
          marginBottom: 8,
          fontSize: 13,
          color: '#7a5c00',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <span>⚠️</span>
          <span>
            La région administrative n'a pas pu être détectée automatiquement pour cette adresse.
            Veuillez la sélectionner manuellement.
          </span>
        </div>
      )}

      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#1e3a5f', marginBottom: 4 }}>
        Région administrative {showWarning && <span style={{ color: '#c0392b' }}>*</span>}
      </label>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 12px',
          border: showWarning && !value ? '1.5px solid #e74c3c' : '1.5px solid #cbd5e1',
          borderRadius: 6,
          fontSize: 14,
          background: '#fff',
          color: value ? '#1e3a5f' : '#94a3b8',
          outline: 'none',
          cursor: 'pointer',
        }}
      >
        <option value="">— Sélectionner une région —</option>
        {REGIONS_QUEBEC.map((region) => (
          <option key={region} value={region}>{region}</option>
        ))}
      </select>
    </div>
  );
}
