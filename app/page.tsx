"use client"

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'

const PlantaViewer3D = dynamic(() => import('@/components/PlantaViewer3D'), { ssr: false })

// ─── Design System ────────────────────────────────────────────────────────────
const C = {
  cyan:         "#00F5FF",
  violet:       "#A78BFA",
  amber:        "#FFB020",
  green:        "#00FF88",
  red:          "#FF4458",
  white:        "#E8F8FF",
  muted:        "#4A7A8A",
  muted2:       "#6B9EAE",
  deep:         "#020C10",
  deep2:        "#041820",
  deep3:        "#071F2C",
  border:       "rgba(0,245,255,0.12)",
  borderBright: "rgba(0,245,255,0.4)",
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Status   = 'OPERATIVO' | 'COMISIONADO' | 'INSTALADO' | 'PLANIFICADO' | 'FALLA'
type Variable = 'CAUDAL' | 'NIVEL' | 'PRESION' | 'PH' | 'TURBIDEZ' | 'CLORO' | 'CONDUCTIVIDAD' | 'OXIGENO' | 'TEMPERATURA' | 'VALVULA' | 'CONTROL'
type Stage    = 'captacion' | 'tratamiento' | 'desinfeccion' | 'almacenamiento' | 'distribucion'

interface Instrument {
  tag:      string
  desc:     string
  variable: Variable
  stage:    Stage
  unit:     string
  min:      number
  max:      number
  nominal:  number
  protocol: string
  status:   Status
}

interface StageInfo {
  id:       Stage
  label:    string
  sublabel: string
  units:    string[]
  icon:     string
}

// ─── Static Plant Data (AP01 La Soledad, P&ID Rev.00) ────────────────────────
const PLANT = {
  codigo:        'AP01',
  nombre:        'La Soledad',
  contrato:      '4182.010.26.1.507-2023',
  corregimiento: 'La Buitrera',
  fuentes:       ['Río Lili', 'Río FCYS'],
  tipo:          'FIME',
  supervisor:    'Giovanny Guevara Duque',
  interventoria: 'Arles Octavio Lemos',
  contratista:   'Consorcio AQUATECH',
  pid:           'Rev.00 — 29/04/2024',
}

const STAGES: StageInfo[] = [
  {
    id:       'captacion',
    label:    'CAPTACIÓN',
    sublabel: 'Bocatomas',
    icon:     '◈',
    units:    ['Bocatoma Río Lili', 'Bocatoma FCYS'],
  },
  {
    id:       'tratamiento',
    label:    'TRATAMIENTO',
    sublabel: 'Filtración',
    icon:     '⬡',
    units:    ['Floculadores de Grava', 'Canal de Aforo', 'Filtros Lentos', 'Filtros Rápidos'],
  },
  {
    id:       'desinfeccion',
    label:    'DESINFECCIÓN',
    sublabel: 'Cloración',
    icon:     '◉',
    units:    ['Caseta de Cloración', 'Laberinto de Cloración'],
  },
  {
    id:       'almacenamiento',
    label:    'ALMACENAMIENTO',
    sublabel: 'Tanques',
    icon:     '▣',
    units:    ['Tanque Principal', 'Tanque San Antonio', 'Tanque Quijote'],
  },
  {
    id:       'distribucion',
    label:    'DISTRIBUCIÓN',
    sublabel: 'Red de suministro',
    icon:     '⊕',
    units:    ['Punto de Entrega', 'Red de Distribución'],
  },
]

const INSTRUMENTS: Instrument[] = [
  // ── CAPTACIÓN ──────────────────────────────────────────────────────────────
  { tag: 'AP01FT2001',     desc: 'Caudal agua cruda',              variable: 'CAUDAL',        stage: 'captacion',      unit: 'L/s',   min: 10,  max: 70,   nominal: 42.3,  protocol: 'HART',   status: 'OPERATIVO'   },
  { tag: 'AP01FR2001',     desc: 'Registrador caudal entrada',     variable: 'CAUDAL',        stage: 'captacion',      unit: 'L/s',   min: 10,  max: 70,   nominal: 42.3,  protocol: 'MODBUS', status: 'OPERATIVO'   },
  { tag: 'AP01AT9001TURB', desc: 'Turbidez agua cruda',            variable: 'TURBIDEZ',      stage: 'captacion',      unit: 'NTU',   min: 0,   max: 250,  nominal: 8.2,   protocol: 'HART',   status: 'OPERATIVO'   },
  { tag: 'AP01AT9010XY',   desc: 'Oxígeno disuelto agua cruda',    variable: 'OXIGENO',       stage: 'captacion',      unit: 'mg/L',  min: 3,   max: 14,   nominal: 7.8,   protocol: 'HART',   status: 'OPERATIVO'   },
  { tag: 'AP01AT9001CDC',  desc: 'Conductividad agua cruda',       variable: 'CONDUCTIVIDAD', stage: 'captacion',      unit: 'µS/cm', min: 20,  max: 700,  nominal: 145,   protocol: 'HART',   status: 'OPERATIVO'   },
  { tag: 'AP01AT9001PH',   desc: 'pH agua cruda',                  variable: 'PH',            stage: 'captacion',      unit: 'pH',    min: 5.0, max: 9.5,  nominal: 7.2,   protocol: 'HART',   status: 'OPERATIVO'   },
  { tag: 'AP01AT9001TEMP', desc: 'Temperatura agua cruda',         variable: 'TEMPERATURA',   stage: 'captacion',      unit: '°C',    min: 8,   max: 35,   nominal: 19.5,  protocol: 'HART',   status: 'OPERATIVO'   },
  // ── DESINFECCIÓN ───────────────────────────────────────────────────────────
  { tag: 'AP01AT9002CL2',  desc: 'Cloro residual agua tratada',    variable: 'CLORO',         stage: 'desinfeccion',   unit: 'mg/L',  min: 0,   max: 2.0,  nominal: 0.5,   protocol: 'HART',   status: 'OPERATIVO'   },
  // ── ALMACENAMIENTO ─────────────────────────────────────────────────────────
  { tag: 'AP01LT4001',     desc: 'Nivel tanque principal',         variable: 'NIVEL',         stage: 'almacenamiento', unit: 'm',     min: 0,   max: 4.5,  nominal: 3.2,   protocol: 'HART',   status: 'OPERATIVO'   },
  { tag: 'AP01LR4001',     desc: 'Registrador nivel tanque princ.', variable: 'NIVEL',        stage: 'almacenamiento', unit: 'm',     min: 0,   max: 4.5,  nominal: 3.2,   protocol: 'MODBUS', status: 'OPERATIVO'   },
  { tag: 'AP01LT4002',     desc: 'Nivel tanque San Antonio',       variable: 'NIVEL',         stage: 'almacenamiento', unit: 'm',     min: 0,   max: 3.0,  nominal: 2.4,   protocol: 'HART',   status: 'OPERATIVO'   },
  { tag: 'AP01LR4002',     desc: 'Registrador nivel San Antonio',  variable: 'NIVEL',         stage: 'almacenamiento', unit: 'm',     min: 0,   max: 3.0,  nominal: 2.4,   protocol: 'MODBUS', status: 'OPERATIVO'   },
  { tag: 'AP01LT4003',     desc: 'Nivel tanque Quijote',           variable: 'NIVEL',         stage: 'almacenamiento', unit: 'm',     min: 0,   max: 2.5,  nominal: 1.8,   protocol: 'HART',   status: 'INSTALADO'   },
  { tag: 'AP01LR4003',     desc: 'Registrador nivel Quijote',      variable: 'NIVEL',         stage: 'almacenamiento', unit: 'm',     min: 0,   max: 2.5,  nominal: 1.8,   protocol: 'MODBUS', status: 'INSTALADO'   },
  // ── DISTRIBUCIÓN ───────────────────────────────────────────────────────────
  { tag: 'AP01FT2002',     desc: 'Caudal agua tratada salida',     variable: 'CAUDAL',        stage: 'distribucion',   unit: 'L/s',   min: 10,  max: 65,   nominal: 38.7,  protocol: 'HART',   status: 'OPERATIVO'   },
  { tag: 'AP01FR2002',     desc: 'Registrador caudal salida',      variable: 'CAUDAL',        stage: 'distribucion',   unit: 'L/s',   min: 10,  max: 65,   nominal: 38.7,  protocol: 'MODBUS', status: 'OPERATIVO'   },
  { tag: 'AP01AT9002TURB', desc: 'Turbidez agua tratada',          variable: 'TURBIDEZ',      stage: 'distribucion',   unit: 'NTU',   min: 0,   max: 2.0,  nominal: 0.3,   protocol: 'HART',   status: 'OPERATIVO'   },
  { tag: 'AP01AT9002PH',   desc: 'pH agua tratada',                variable: 'PH',            stage: 'distribucion',   unit: 'pH',    min: 5.0, max: 9.5,  nominal: 7.1,   protocol: 'HART',   status: 'OPERATIVO'   },
  { tag: 'AP01AT9002TEMP', desc: 'Temperatura agua tratada',       variable: 'TEMPERATURA',   stage: 'distribucion',   unit: '°C',    min: 8,   max: 35,   nominal: 19.3,  protocol: 'HART',   status: 'OPERATIVO'   },
  { tag: 'AP01PT5002',     desc: 'Presión salida red',             variable: 'PRESION',       stage: 'distribucion',   unit: 'bar',   min: 0,   max: 6.0,  nominal: 2.1,   protocol: 'HART',   status: 'OPERATIVO'   },
  { tag: 'AP01PR5002',     desc: 'Registrador presión salida',     variable: 'PRESION',       stage: 'distribucion',   unit: 'bar',   min: 0,   max: 6.0,  nominal: 2.1,   protocol: 'MODBUS', status: 'OPERATIVO'   },
  { tag: 'AP01V1002',      desc: 'Electroválvula de salida',       variable: 'VALVULA',       stage: 'distribucion',   unit: '%',     min: 0,   max: 100,  nominal: 85,    protocol: '4-20mA', status: 'OPERATIVO'   },
  { tag: 'AP01C1002',      desc: 'Control electroválvula salida',  variable: 'CONTROL',       stage: 'distribucion',   unit: '',      min: 0,   max: 1,    nominal: 1,     protocol: 'MODBUS', status: 'OPERATIVO'   },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
function varColor(v: Variable): string {
  const map: Record<Variable, string> = {
    CAUDAL:        C.cyan,
    NIVEL:         '#4A9EFF',
    PRESION:       C.violet,
    PH:            C.amber,
    TURBIDEZ:      '#88AAFF',
    CLORO:         C.green,
    CONDUCTIVIDAD: '#FF88FF',
    OXIGENO:       '#00FFCC',
    TEMPERATURA:   '#FF8844',
    VALVULA:       C.amber,
    CONTROL:       C.muted2,
  }
  return map[v]
}

function statusColor(s: Status): string {
  const map: Record<Status, string> = {
    OPERATIVO:   C.green,
    COMISIONADO: C.cyan,
    INSTALADO:   C.amber,
    PLANIFICADO: C.muted,
    FALLA:       C.red,
  }
  return map[s]
}

function statusLabel(s: Status): string {
  return { OPERATIVO: 'Operativo', COMISIONADO: 'Comisionado', INSTALADO: 'Instalado', PLANIFICADO: 'Planificado', FALLA: 'Falla' }[s]
}

function simulate(inst: Instrument, t: number): number {
  if (inst.variable === 'CONTROL') return 1
  const spread = (inst.max - inst.min) * 0.025
  const v = inst.nominal + Math.sin(t * 0.3 + inst.nominal * 0.7) * spread * 0.8 + Math.cos(t * 0.17 + inst.tag.length) * spread * 0.4
  const clamped = Math.max(inst.min, Math.min(inst.max, v))
  return parseFloat(clamped.toFixed(inst.unit === 'pH' || inst.unit === 'm' || inst.unit === 'bar' || inst.unit === 'mg/L' ? 2 : 1))
}

function displayValue(inst: Instrument, v: number): string {
  if (inst.variable === 'CONTROL') return 'ON'
  if (inst.unit === '%') return `${Math.round(v)}%`
  return `${v}`
}

// ─── Process Flow SVG Component ───────────────────────────────────────────────
function ProcessFlowSVG({ activeStage, onStageClick }: { activeStage: Stage | null; onStageClick: (s: Stage) => void }) {
  const stages: { id: Stage; label: string; short: string; x: number }[] = [
    { id: 'captacion',      label: 'CAPTACIÓN',       short: '◈', x: 60  },
    { id: 'tratamiento',    label: 'TRATAMIENTO',     short: '⬡', x: 230 },
    { id: 'desinfeccion',   label: 'DESINFECCIÓN',    short: '◉', x: 400 },
    { id: 'almacenamiento', label: 'ALMACENAMIENTO',  short: '▣', x: 570 },
    { id: 'distribucion',   label: 'DISTRIBUCIÓN',    short: '⊕', x: 740 },
  ]

  return (
    <svg
      viewBox="0 0 860 120"
      style={{ width: '100%', maxWidth: 860, display: 'block' }}
    >
      <defs>
        {/* Animated flow gradient */}
        <linearGradient id="flowGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor={C.cyan} stopOpacity="0.1" />
          <stop offset="50%"  stopColor={C.cyan} stopOpacity="0.6" />
          <stop offset="100%" stopColor={C.cyan} stopOpacity="0.1" />
          <animateTransform
            attributeName="gradientTransform"
            type="translate"
            from="-1 0" to="1 0"
            dur="2s" repeatCount="indefinite"
          />
        </linearGradient>
        <marker id="arrow" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill={C.muted} />
        </marker>
        <marker id="arrowActive" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill={C.cyan} />
        </marker>
        <filter id="glow">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Background pipe */}
      <rect x="90" y="57" width="680" height="6" rx="3" fill={`${C.muted}30`} />
      {/* Animated flow */}
      <rect x="90" y="57" width="680" height="6" rx="3" fill="url(#flowGrad)" />

      {/* Connector arrows */}
      {stages.slice(0, -1).map((s, i) => (
        <line
          key={s.id}
          x1={s.x + 130} y1="60"
          x2={stages[i+1].x - 10} y2="60"
          stroke={C.muted} strokeWidth="1.5"
          strokeDasharray="4 3"
          markerEnd="url(#arrow)"
        />
      ))}

      {/* Water source labels */}
      <text x="60" y="14" textAnchor="middle" fill={C.muted} fontSize="7" fontFamily="IBM Plex Mono">Río Lili</text>
      <text x="60" y="24" textAnchor="middle" fill={C.muted} fontSize="7" fontFamily="IBM Plex Mono">+ FCYS</text>

      {/* Stage boxes */}
      {stages.map((s) => {
        const isActive = activeStage === s.id
        const count = INSTRUMENTS.filter(i => i.stage === s.id).length
        return (
          <g
            key={s.id}
            onClick={() => onStageClick(s.id)}
            style={{ cursor: 'pointer' }}
          >
            <rect
              x={s.x - 60} y="28"
              width="120" height="64"
              rx="6"
              fill={isActive ? 'rgba(0,245,255,0.07)' : C.deep2}
              stroke={isActive ? C.cyan : C.border}
              strokeWidth={isActive ? 1.5 : 1}
              filter={isActive ? 'url(#glow)' : undefined}
            />
            <text
              x={s.x} y="48"
              textAnchor="middle"
              fill={isActive ? C.cyan : C.white}
              fontSize="9"
              fontWeight="700"
              fontFamily="Orbitron, monospace"
            >
              {s.label}
            </text>
            <text x={s.x} y="62" textAnchor="middle" fill={C.muted} fontSize="8" fontFamily="IBM Plex Mono">
              {s.short}
            </text>
            {count > 0 && (
              <>
                <circle cx={s.x} cy="78" r="10" fill={isActive ? `${C.cyan}20` : `${C.muted}15`} />
                <text
                  x={s.x} y="82"
                  textAnchor="middle"
                  fill={isActive ? C.cyan : C.muted}
                  fontSize="9"
                  fontWeight="700"
                  fontFamily="Orbitron, monospace"
                >
                  {count}
                </text>
              </>
            )}
          </g>
        )
      })}

      {/* Source arrow */}
      <line x1="30" y1="60" x2="88" y2="60" stroke={C.muted} strokeWidth="1.5" markerEnd="url(#arrow)" />

      {/* Output arrow */}
      <line x1="800" y1="60" x2="840" y2="60" stroke={C.muted} strokeWidth="1.5" markerEnd="url(#arrow)" />
      <text x="843" y="63" fill={C.muted} fontSize="7" fontFamily="IBM Plex Mono">RED</text>
    </svg>
  )
}

// ─── Instrument Card ──────────────────────────────────────────────────────────
function InstrumentCard({
  inst, value, selected, onClick,
}: {
  inst: Instrument; value: number; selected: boolean; onClick: () => void
}) {
  const vc = varColor(inst.variable)
  const sc = statusColor(inst.status)
  const pct = Math.max(0, Math.min(100, ((value - inst.min) / (inst.max - inst.min)) * 100))
  const stageName = STAGES.find(s => s.id === inst.stage)?.label ?? inst.stage

  return (
    <div
      onClick={onClick}
      style={{
        background:    selected ? 'rgba(0,245,255,0.05)' : C.deep2,
        border:        `1px solid ${selected ? C.cyan : C.border}`,
        borderRadius:  8,
        padding:       '14px 16px',
        cursor:        'pointer',
        transition:    'border-color 0.15s, background 0.15s',
        position:      'relative',
        overflow:      'hidden',
      }}
    >
      {/* Accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: selected ? vc : `${vc}40`,
        transition: 'background 0.15s',
      }} />

      {/* TAG + Status */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 11, fontWeight: 700, color: vc }}>
          {inst.tag}
        </div>
        <div style={{
          display:       'flex',
          alignItems:    'center',
          gap:           4,
          fontSize:      9,
          color:         sc,
          background:    `${sc}15`,
          padding:       '2px 7px',
          borderRadius:  10,
          flexShrink:    0,
          marginLeft:    8,
        }}>
          <span style={{ width: 4, height: 4, borderRadius: '50%', background: sc, display: 'inline-block' }} />
          {statusLabel(inst.status)}
        </div>
      </div>

      {/* Description */}
      <div style={{ fontSize: 11, color: C.muted2, marginBottom: 10, lineHeight: 1.4 }}>
        {inst.desc}
      </div>

      {/* Value */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 8 }}>
        <span style={{
          fontFamily: "'Orbitron', monospace",
          fontSize:   22,
          fontWeight: 700,
          color:      C.white,
          lineHeight: 1,
        }}>
          {displayValue(inst, value)}
        </span>
        {inst.unit && inst.variable !== 'CONTROL' && (
          <span style={{ fontSize: 11, color: C.muted }}>{inst.unit}</span>
        )}
      </div>

      {/* Progress bar */}
      {inst.variable !== 'CONTROL' && (
        <div style={{ height: 3, background: `${vc}18`, borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{
            height:     '100%',
            width:      `${pct}%`,
            background: vc,
            borderRadius: 2,
            transition: 'width 0.8s ease',
          }} />
        </div>
      )}

      {/* Tags row */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 9, color: vc, background: `${vc}12`, padding: '2px 6px', borderRadius: 3 }}>
          {inst.variable}
        </span>
        <span style={{ fontSize: 9, color: C.muted, background: `${C.muted}18`, padding: '2px 6px', borderRadius: 3 }}>
          {inst.protocol}
        </span>
        <span style={{ fontSize: 9, color: C.muted, background: `${C.muted}18`, padding: '2px 6px', borderRadius: 3, marginLeft: 'auto' }}>
          {stageName}
        </span>
      </div>
    </div>
  )
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────
function DetailPanel({
  inst, value, onClose,
}: {
  inst: Instrument; value: number; onClose: () => void
}) {
  const vc = varColor(inst.variable)
  const sc = statusColor(inst.status)
  const pct = Math.max(0, Math.min(100, ((value - inst.min) / (inst.max - inst.min)) * 100))
  const stage = STAGES.find(s => s.id === inst.stage)

  const rows = [
    ['Variable',    inst.variable],
    ['Protocolo',   inst.protocol],
    ['Etapa',       stage?.label ?? '—'],
    ['Mín / Máx',   `${inst.min} — ${inst.max} ${inst.unit}`],
    ['Nominal',     `${inst.nominal} ${inst.unit}`],
    ['Contrato',    PLANT.contrato],
    ['P&ID',        PLANT.pid],
    ['Planta',      `${PLANT.codigo} — ${PLANT.nombre}`],
  ]

  return (
    <div style={{
      width:       340,
      background:  C.deep2,
      borderLeft:  `1px solid ${C.border}`,
      display:     'flex',
      flexDirection: 'column',
      flexShrink:  0,
      overflowY:   'auto',
    }}>
      {/* Panel header */}
      <div style={{
        padding:      '16px 20px 12px',
        borderBottom: `1px solid ${C.border}`,
        display:      'flex',
        justifyContent: 'space-between',
        alignItems:   'center',
        position:     'sticky',
        top:          0,
        background:   C.deep2,
        zIndex:       1,
      }}>
        <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.18em' }}>DETALLE INSTRUMENTO</div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent', border: 'none',
            color: C.muted, cursor: 'pointer',
            fontSize: 20, lineHeight: 1, padding: '0 4px',
          }}
        >
          ×
        </button>
      </div>

      <div style={{ padding: '20px' }}>
        {/* TAG */}
        <div style={{
          fontFamily: "'Orbitron', monospace",
          fontSize:   22, fontWeight: 700,
          color:      vc, marginBottom: 6,
        }}>
          {inst.tag}
        </div>
        <div style={{ fontSize: 13, color: C.white, marginBottom: 8, lineHeight: 1.5 }}>
          {inst.desc}
        </div>
        {/* Status */}
        <div style={{
          display:    'inline-flex', alignItems: 'center', gap: 6,
          fontSize:   11, color: sc,
          background: `${sc}12`,
          padding:    '4px 12px', borderRadius: 12, marginBottom: 20,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: sc, display: 'inline-block' }} />
          {statusLabel(inst.status)}
        </div>

        {/* Live value */}
        <div style={{
          background:   C.deep3,
          border:       `1px solid ${C.border}`,
          borderRadius: 8, padding: '16px',
          textAlign:    'center', marginBottom: 16,
        }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.15em', marginBottom: 8 }}>LECTURA EN TIEMPO REAL</div>
          <div style={{
            fontFamily: "'Orbitron', monospace",
            fontSize:   42, fontWeight: 700,
            color:      vc, lineHeight: 1,
          }}>
            {displayValue(inst, value)}
          </div>
          {inst.unit && inst.variable !== 'CONTROL' && (
            <div style={{ fontSize: 13, color: C.muted2, marginTop: 6 }}>{inst.unit}</div>
          )}
          <div style={{ fontSize: 9, color: C.muted, marginTop: 8 }}>
            ↺ actualización cada 2 s (simulado)
          </div>
        </div>

        {/* Range bar */}
        {inst.variable !== 'CONTROL' && (
          <div style={{ marginBottom: 20 }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              fontSize: 10, color: C.muted, marginBottom: 6,
            }}>
              <span>Rango operativo</span>
              <span style={{ color: C.muted2 }}>{Math.round(pct)}%</span>
            </div>
            <div style={{ height: 8, background: `${vc}18`, borderRadius: 4, overflow: 'hidden', marginBottom: 4 }}>
              <div style={{
                height:     '100%',
                width:      `${pct}%`,
                background: vc,
                borderRadius: 4,
                transition: 'width 0.8s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.muted }}>
              <span>{inst.min} {inst.unit}</span>
              <span style={{ color: C.muted2 }}>Nominal: {inst.nominal}</span>
              <span>{inst.max} {inst.unit}</span>
            </div>
          </div>
        )}

        {/* Metadata */}
        <div style={{ fontSize: 11 }}>
          <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.15em', marginBottom: 10 }}>ESPECIFICACIONES</div>
          {rows.map(([label, val]) => (
            <div key={label} style={{
              display:        'flex',
              justifyContent: 'space-between',
              padding:        '7px 0',
              borderBottom:   `1px solid ${C.border}`,
              gap:            8,
            }}>
              <span style={{ color: C.muted, flexShrink: 0 }}>{label}</span>
              <span style={{ color: C.white, textAlign: 'right', wordBreak: 'break-word' }}>{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function PlantaInteractivaPage() {
  const [view,         setView]         = useState<'3d' | 'dashboard'>('3d')
  const [selected,     setSelected]     = useState<string | null>(null)
  const [activeStage,  setActiveStage]  = useState<Stage | null>(null)
  const [values,       setValues]       = useState<Record<string, number>>({})
  const [tick,         setTick]         = useState(0)
  const [now,          setNow]          = useState('')

  // Seed initial values
  useEffect(() => {
    const init: Record<string, number> = {}
    INSTRUMENTS.forEach(i => { init[i.tag] = i.nominal })
    setValues(init)
    setNow(new Date().toLocaleTimeString('es-CO'))
  }, [])

  // Simulate live readings every 2 s
  useEffect(() => {
    const id = setInterval(() => {
      const t = Date.now() / 1000
      setTick(n => n + 1)
      setValues(() => {
        const next: Record<string, number> = {}
        INSTRUMENTS.forEach(i => { next[i.tag] = simulate(i, t) })
        return next
      })
      setNow(new Date().toLocaleTimeString('es-CO'))
    }, 2000)
    return () => clearInterval(id)
  }, [])

  const handleStageClick = useCallback((s: Stage) => {
    setActiveStage(prev => prev === s ? null : s)
    setSelected(null)
  }, [])

  const displayed = activeStage
    ? INSTRUMENTS.filter(i => i.stage === activeStage)
    : INSTRUMENTS

  const selectedInst = selected ? INSTRUMENTS.find(i => i.tag === selected) : null

  const operativos = INSTRUMENTS.filter(i => i.status === 'OPERATIVO').length
  const operPct    = Math.round((operativos / INSTRUMENTS.length) * 100)

  // Key metrics for ticker
  const keyMetrics = [
    { label: 'Q entrada',   inst: INSTRUMENTS.find(i => i.tag === 'AP01FT2001')! },
    { label: 'pH cruda',    inst: INSTRUMENTS.find(i => i.tag === 'AP01AT9001PH')! },
    { label: 'Turbidez cruda', inst: INSTRUMENTS.find(i => i.tag === 'AP01AT9001TURB')! },
    { label: 'Cloro',       inst: INSTRUMENTS.find(i => i.tag === 'AP01AT9002CL2')! },
    { label: 'Q salida',    inst: INSTRUMENTS.find(i => i.tag === 'AP01FT2002')! },
    { label: 'pH tratada',  inst: INSTRUMENTS.find(i => i.tag === 'AP01AT9002PH')! },
    { label: 'Turbidez tratada', inst: INSTRUMENTS.find(i => i.tag === 'AP01AT9002TURB')! },
    { label: 'Presión',     inst: INSTRUMENTS.find(i => i.tag === 'AP01PT5002')! },
    { label: 'Nivel princ.', inst: INSTRUMENTS.find(i => i.tag === 'AP01LT4001')! },
    { label: 'Nivel S.A.',  inst: INSTRUMENTS.find(i => i.tag === 'AP01LT4002')! },
  ]

  return (
    <div style={{
      height:         '100vh',
      background:     C.deep,
      fontFamily:     "'IBM Plex Mono', monospace",
      color:          C.white,
      display:        'flex',
      flexDirection:  'column',
      overflow:       'hidden',
    }}>

      {/* ── HEADER ──────────────────────────────────────────────────────────── */}
      <header style={{
        background:   `linear-gradient(180deg, ${C.deep2} 0%, rgba(4,24,32,0.97) 100%)`,
        borderBottom: `1px solid ${C.border}`,
        padding:      '10px 24px',
        display:      'flex',
        alignItems:   'center',
        justifyContent: 'space-between',
        flexShrink:   0,
        flexWrap:     'wrap',
        gap:          12,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Brand */}
          <div>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: '0.22em', marginBottom: 2 }}>
              UAESP CALI — ACUEDUCTOS RURALES
            </div>
            <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 17, fontWeight: 700, color: C.cyan, letterSpacing: '0.08em' }}>
              AP01 — PTAP LA SOLEDAD
            </div>
          </div>

          {/* Status pill */}
          <div style={{
            background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.28)',
            borderRadius: 20, padding: '4px 12px',
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 10, color: C.green,
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%', background: C.green,
              display: 'inline-block',
              boxShadow: `0 0 6px ${C.green}`,
              animation: 'pulse-dot 2s infinite',
            }} />
            SISTEMA ACTIVO
          </div>

          {/* FIME badge */}
          <div style={{
            background: `${C.violet}12`, border: `1px solid ${C.violet}30`,
            borderRadius: 4, padding: '3px 10px', fontSize: 10, color: C.violet,
          }}>
            FIME
          </div>
        </div>

        {/* Right: quick stats + info */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 9, color: C.muted }}>INSTRUMENTOS OPERATIVOS</div>
            <div style={{ fontFamily: "'Orbitron', monospace", fontSize: 15, fontWeight: 700, color: C.cyan }}>
              {operativos}
              <span style={{ fontSize: 11, color: C.muted, fontWeight: 400 }}>/{INSTRUMENTS.length}</span>
              <span style={{ fontSize: 10, color: C.green, marginLeft: 6 }}>{operPct}%</span>
            </div>
          </div>
          <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 16 }}>
            <div style={{ fontSize: 9, color: C.muted }}>FUENTES</div>
            <div style={{ fontSize: 10, color: C.white }}>Río Lili + FCYS</div>
          </div>
          <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 16 }}>
            <div style={{ fontSize: 9, color: C.muted }}>CORREGIMIENTO</div>
            <div style={{ fontSize: 10, color: C.white }}>La Buitrera</div>
          </div>
          <div style={{ borderLeft: `1px solid ${C.border}`, paddingLeft: 16 }}>
            <div style={{ fontSize: 9, color: C.muted }}>ÚLTIMA ACTUALIZACIÓN</div>
            <div style={{ fontSize: 10, color: C.white, fontFamily: "'Orbitron', monospace" }}>{now || '--:--:--'}</div>
          </div>
        </div>
      </header>

      {/* ── METRICS TICKER ──────────────────────────────────────────────────── */}
      <div style={{
        background:   C.deep3,
        borderBottom: `1px solid ${C.border}`,
        padding:      '6px 24px',
        display:      'flex',
        gap:          24,
        overflowX:    'auto',
        flexShrink:   0,
        alignItems:   'center',
      }}>
        <div style={{ fontSize: 9, color: C.muted, letterSpacing: '0.15em', flexShrink: 0 }}>
          LECTURAS CLAVE
        </div>
        {keyMetrics.map(({ label, inst }) => {
          const val = values[inst.tag] ?? inst.nominal
          const vc = varColor(inst.variable)
          return (
            <div
              key={inst.tag}
              onClick={() => setSelected(prev => prev === inst.tag ? null : inst.tag)}
              style={{
                display:    'flex',
                alignItems: 'center',
                gap:        8,
                flexShrink: 0,
                cursor:     'pointer',
                padding:    '2px 8px',
                borderRadius: 4,
                background: selected === inst.tag ? `${vc}10` : 'transparent',
                border:     `1px solid ${selected === inst.tag ? vc : 'transparent'}`,
              }}
            >
              <span style={{ fontSize: 9, color: C.muted }}>{label}</span>
              <span style={{
                fontFamily: "'Orbitron', monospace",
                fontSize:   12, fontWeight: 700,
                color:      vc,
              }}>
                {displayValue(inst, val)}
              </span>
              {inst.unit && inst.variable !== 'CONTROL' && (
                <span style={{ fontSize: 9, color: C.muted }}>{inst.unit}</span>
              )}
            </div>
          )
        })}
      </div>

      {/* ── VIEW TABS ───────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: 0,
        background: C.deep2,
        borderBottom: `1px solid ${C.border}`,
        flexShrink: 0,
      }}>
        {([
          { key: '3d',        label: '⬡ GEMELO 3D',      title: 'Vista tridimensional interactiva de la planta' },
          { key: 'dashboard', label: '◈ INSTRUMENTACIÓN', title: 'Dashboard de sensores IoT' },
        ] as const).map(tab => (
          <button
            key={tab.key}
            title={tab.title}
            onClick={() => setView(tab.key)}
            style={{
              padding: '9px 22px',
              fontFamily: "'Orbitron', monospace",
              fontSize: 10, letterSpacing: '0.1em',
              background: view === tab.key ? 'rgba(0,245,255,0.06)' : 'transparent',
              color: view === tab.key ? C.cyan : C.muted,
              border: 'none',
              borderBottom: view === tab.key ? `2px solid ${C.cyan}` : '2px solid transparent',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── BODY ────────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* ── 3D VIEW ── */}
        {view === '3d' && <PlantaViewer3D />}

        {/* ── DASHBOARD VIEW ── */}
        {view === 'dashboard' && (
        <>
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>

          {/* Process flow diagram */}
          <div style={{
            background:   C.deep2,
            border:       `1px solid ${C.border}`,
            borderRadius: 10,
            padding:      '20px 24px',
            marginBottom: 20,
          }}>
            <div style={{
              display:        'flex',
              justifyContent: 'space-between',
              alignItems:     'center',
              marginBottom:   16,
            }}>
              <div>
                <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.18em', marginBottom: 2 }}>
                  DIAGRAMA DE PROCESO — P&ID REV.00
                </div>
                <div style={{ fontSize: 11, color: C.muted2 }}>
                  Haz clic en una etapa para filtrar los instrumentos
                </div>
              </div>
              {activeStage && (
                <button
                  onClick={() => { setActiveStage(null); setSelected(null) }}
                  style={{
                    background:   'transparent',
                    border:       `1px solid ${C.border}`,
                    color:        C.muted,
                    fontSize:     10,
                    padding:      '4px 12px',
                    borderRadius: 4,
                    cursor:       'pointer',
                  }}
                >
                  Limpiar filtro ×
                </button>
              )}
            </div>
            <ProcessFlowSVG activeStage={activeStage} onStageClick={handleStageClick} />
          </div>

          {/* Instruments section header */}
          <div style={{
            display:        'flex',
            justifyContent: 'space-between',
            alignItems:     'center',
            marginBottom:   14,
          }}>
            <div>
              <div style={{ fontSize: 10, color: C.muted, letterSpacing: '0.18em' }}>
                INSTRUMENTACIÓN IoT — P&ID Rev.00
              </div>
              <div style={{ fontSize: 12, color: C.white, marginTop: 2 }}>
                {activeStage
                  ? `${displayed.length} instrumento(s) en etapa ${STAGES.find(s => s.id === activeStage)?.label}`
                  : `${INSTRUMENTS.length} instrumentos totales · ${operativos} operativos`
                }
              </div>
            </div>
            {/* Variable legend */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {(['CAUDAL','NIVEL','PRESION','PH','TURBIDEZ','CLORO'] as Variable[]).map(v => (
                <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 9, color: C.muted }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: varColor(v), display: 'inline-block' }} />
                  {v}
                </div>
              ))}
            </div>
          </div>

          {/* Instruments grid */}
          <div style={{
            display:               'grid',
            gridTemplateColumns:   'repeat(auto-fill, minmax(260px, 1fr))',
            gap:                   10,
          }}>
            {displayed.map(inst => (
              <InstrumentCard
                key={inst.tag}
                inst={inst}
                value={values[inst.tag] ?? inst.nominal}
                selected={selected === inst.tag}
                onClick={() => setSelected(prev => prev === inst.tag ? null : inst.tag)}
              />
            ))}
          </div>

          {/* Empty state */}
          {displayed.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: C.muted }}>
              No hay instrumentos en esta etapa del proceso.
            </div>
          )}

          {/* Bottom info */}
          <div style={{
            marginTop:   32,
            padding:     '16px 20px',
            background:  C.deep2,
            border:      `1px solid ${C.border}`,
            borderRadius: 8,
            display:     'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap:         12,
            fontSize:    11,
          }}>
            {[
              ['Código AQUATECH', PLANT.codigo],
              ['Contrato SECOP', '507-2023'],
              ['Contratista', PLANT.contratista],
              ['Supervisor UAESP', PLANT.supervisor],
              ['Interventoría', PLANT.interventoria],
              ['P&ID', PLANT.pid],
              ['Tipo tratamiento', PLANT.tipo],
              ['Número de fuentes', PLANT.fuentes.join(', ')],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ fontSize: 9, color: C.muted, marginBottom: 2 }}>{label}</div>
                <div style={{ color: C.white }}>{val}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Detail panel (slides in) */}
        {selectedInst && (
          <DetailPanel
            inst={selectedInst}
            value={values[selectedInst.tag] ?? selectedInst.nominal}
            onClose={() => setSelected(null)}
          />
        )}
        </>
        )}
      </div>

      {/* ── FOOTER ──────────────────────────────────────────────────────────── */}
      <footer style={{
        background:   C.deep2,
        borderTop:    `1px solid ${C.border}`,
        padding:      '7px 24px',
        display:      'flex',
        justifyContent: 'space-between',
        alignItems:   'center',
        fontSize:     10,
        color:        C.muted,
        flexShrink:   0,
        flexWrap:     'wrap',
        gap:          8,
      }}>
        <span>UAESP Cali — Plataforma de Monitoreo PTAP 2026</span>
        <span>
          Lectura #{tick} · {now || '—'}
        </span>
        <span>AP01 La Soledad · La Buitrera · Datos simulados en tiempo real</span>
      </footer>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  )
}
