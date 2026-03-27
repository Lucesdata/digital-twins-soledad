"use client"

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  cyan: '#00F5FF', violet: '#A78BFA', amber: '#FFB020',
  green: '#00FF88', red: '#FF4458', white: '#E8F8FF',
  muted: '#4A7A8A', muted2: '#6B9EAE',
  deep: '#020C10', deep2: '#041820', deep3: '#071F2C',
  border: 'rgba(0,245,255,0.12)',
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Status = 'OPERATIVO' | 'COMISIONADO' | 'INSTALADO' | 'PLANIFICADO' | 'FALLA'
type Variable = 'CAUDAL' | 'NIVEL' | 'PRESION' | 'PH' | 'TURBIDEZ' | 'CLORO' |
  'CONDUCTIVIDAD' | 'OXIGENO' | 'TEMPERATURA' | 'VALVULA' | 'CONTROL'

interface Instrument {
  tag: string; desc: string; variable: Variable; stage: string
  unit: string; min: number; max: number; nominal: number
  protocol: string; status: Status
}

// ─── P&ID Rev.00 — 23 instrumentos ───────────────────────────────────────────
const INSTRUMENTS: Instrument[] = [
  { tag: 'AP01FT2001',     desc: 'Caudal agua cruda',              variable: 'CAUDAL',        stage: 'captacion',      unit: 'L/s',   min: 10,  max: 70,  nominal: 42.3, protocol: 'HART',   status: 'OPERATIVO'  },
  { tag: 'AP01FR2001',     desc: 'Registrador caudal entrada',     variable: 'CAUDAL',        stage: 'captacion',      unit: 'L/s',   min: 10,  max: 70,  nominal: 42.3, protocol: 'MODBUS', status: 'OPERATIVO'  },
  { tag: 'AP01AT9001TURB', desc: 'Turbidez agua cruda',            variable: 'TURBIDEZ',      stage: 'captacion',      unit: 'NTU',   min: 0,   max: 250, nominal: 8.2,  protocol: 'HART',   status: 'OPERATIVO'  },
  { tag: 'AP01AT9010XY',   desc: 'Oxígeno disuelto agua cruda',    variable: 'OXIGENO',       stage: 'captacion',      unit: 'mg/L',  min: 3,   max: 14,  nominal: 7.8,  protocol: 'HART',   status: 'OPERATIVO'  },
  { tag: 'AP01AT9001CDC',  desc: 'Conductividad agua cruda',       variable: 'CONDUCTIVIDAD', stage: 'captacion',      unit: 'µS/cm', min: 20,  max: 700, nominal: 145,  protocol: 'HART',   status: 'OPERATIVO'  },
  { tag: 'AP01AT9001PH',   desc: 'pH agua cruda',                  variable: 'PH',            stage: 'captacion',      unit: 'pH',    min: 5.0, max: 9.5, nominal: 7.2,  protocol: 'HART',   status: 'OPERATIVO'  },
  { tag: 'AP01AT9001TEMP', desc: 'Temperatura agua cruda',         variable: 'TEMPERATURA',   stage: 'captacion',      unit: '°C',    min: 8,   max: 35,  nominal: 19.5, protocol: 'HART',   status: 'OPERATIVO'  },
  { tag: 'AP01AT9002CL2',  desc: 'Cloro residual agua tratada',    variable: 'CLORO',         stage: 'desinfeccion',   unit: 'mg/L',  min: 0,   max: 2.0, nominal: 0.5,  protocol: 'HART',   status: 'OPERATIVO'  },
  { tag: 'AP01LT4001',     desc: 'Nivel tanque principal',         variable: 'NIVEL',         stage: 'almacenamiento', unit: 'm',     min: 0,   max: 4.5, nominal: 3.2,  protocol: 'HART',   status: 'OPERATIVO'  },
  { tag: 'AP01LR4001',     desc: 'Registrador nivel tanque princ.',variable: 'NIVEL',         stage: 'almacenamiento', unit: 'm',     min: 0,   max: 4.5, nominal: 3.2,  protocol: 'MODBUS', status: 'OPERATIVO'  },
  { tag: 'AP01LT4002',     desc: 'Nivel tanque San Antonio',       variable: 'NIVEL',         stage: 'almacenamiento', unit: 'm',     min: 0,   max: 3.0, nominal: 2.4,  protocol: 'HART',   status: 'OPERATIVO'  },
  { tag: 'AP01LR4002',     desc: 'Registrador nivel San Antonio',  variable: 'NIVEL',         stage: 'almacenamiento', unit: 'm',     min: 0,   max: 3.0, nominal: 2.4,  protocol: 'MODBUS', status: 'OPERATIVO'  },
  { tag: 'AP01LT4003',     desc: 'Nivel tanque Quijote',           variable: 'NIVEL',         stage: 'almacenamiento', unit: 'm',     min: 0,   max: 2.5, nominal: 1.8,  protocol: 'HART',   status: 'INSTALADO'  },
  { tag: 'AP01LR4003',     desc: 'Registrador nivel Quijote',      variable: 'NIVEL',         stage: 'almacenamiento', unit: 'm',     min: 0,   max: 2.5, nominal: 1.8,  protocol: 'MODBUS', status: 'INSTALADO'  },
  { tag: 'AP01FT2002',     desc: 'Caudal agua tratada salida',     variable: 'CAUDAL',        stage: 'distribucion',   unit: 'L/s',   min: 10,  max: 65,  nominal: 38.7, protocol: 'HART',   status: 'OPERATIVO'  },
  { tag: 'AP01FR2002',     desc: 'Registrador caudal salida',      variable: 'CAUDAL',        stage: 'distribucion',   unit: 'L/s',   min: 10,  max: 65,  nominal: 38.7, protocol: 'MODBUS', status: 'OPERATIVO'  },
  { tag: 'AP01AT9002TURB', desc: 'Turbidez agua tratada',          variable: 'TURBIDEZ',      stage: 'distribucion',   unit: 'NTU',   min: 0,   max: 2.0, nominal: 0.3,  protocol: 'HART',   status: 'OPERATIVO'  },
  { tag: 'AP01AT9002PH',   desc: 'pH agua tratada',                variable: 'PH',            stage: 'distribucion',   unit: 'pH',    min: 5.0, max: 9.5, nominal: 7.1,  protocol: 'HART',   status: 'OPERATIVO'  },
  { tag: 'AP01AT9002TEMP', desc: 'Temperatura agua tratada',       variable: 'TEMPERATURA',   stage: 'distribucion',   unit: '°C',    min: 8,   max: 35,  nominal: 19.3, protocol: 'HART',   status: 'OPERATIVO'  },
  { tag: 'AP01PT5002',     desc: 'Presión salida red',             variable: 'PRESION',       stage: 'distribucion',   unit: 'bar',   min: 0,   max: 6.0, nominal: 2.1,  protocol: 'HART',   status: 'OPERATIVO'  },
  { tag: 'AP01PR5002',     desc: 'Registrador presión salida',     variable: 'PRESION',       stage: 'distribucion',   unit: 'bar',   min: 0,   max: 6.0, nominal: 2.1,  protocol: 'MODBUS', status: 'OPERATIVO'  },
  { tag: 'AP01V1002',      desc: 'Electroválvula de salida',       variable: 'VALVULA',       stage: 'distribucion',   unit: '%',     min: 0,   max: 100, nominal: 85,   protocol: '4-20mA', status: 'OPERATIVO'  },
  { tag: 'AP01C1002',      desc: 'Control electroválvula salida',  variable: 'CONTROL',       stage: 'distribucion',   unit: '',      min: 0,   max: 1,   nominal: 1,    protocol: 'MODBUS', status: 'OPERATIVO'  },
]

// ─── Sensor 3D positions (x, y, z) mapped to scene coordinates ───────────────
const SENSOR_POS: Record<string, [number, number, number]> = {
  // Captación — cámara en (7, z=36)
  'AP01FT2001':     [9.5,  1.8, 36.0],
  'AP01FR2001':     [9.5,  2.8, 34.0],
  'AP01AT9001TURB': [5.5,  2.0, 35.0],
  'AP01AT9010XY':   [5.5,  2.0, 37.0],
  'AP01AT9001CDC':  [7.5,  2.6, 38.5],
  'AP01AT9001PH':   [7.5,  2.6, 33.5],
  'AP01AT9001TEMP': [6.5,  2.0, 36.0],
  // Desinfección — cámara Cl2 en (47, z=38)
  'AP01AT9002CL2':  [46.0, 2.6, 36.0],
  // Almacenamiento — tanque en (56, z=38), h=4.5
  'AP01LT4001':     [53.0, 5.2, 38.0],
  'AP01LR4001':     [53.0, 6.8, 40.0],
  'AP01LT4002':     [56.0, 5.2, 33.5],
  'AP01LR4002':     [56.0, 6.8, 31.5],
  'AP01LT4003':     [59.0, 5.2, 38.0],
  'AP01LR4003':     [59.0, 6.8, 40.0],
  // Distribución — salida más allá del tanque
  'AP01FT2002':     [62.0, 2.2, 38.0],
  'AP01FR2002':     [62.0, 3.4, 40.5],
  'AP01AT9002TURB': [64.5, 2.2, 36.0],
  'AP01AT9002PH':   [64.5, 2.2, 40.0],
  'AP01AT9002TEMP': [64.5, 2.2, 38.0],
  'AP01PT5002':     [67.0, 2.2, 36.5],
  'AP01PR5002':     [67.0, 3.4, 36.5],
  'AP01V1002':      [60.0, 2.2, 38.0],
  'AP01C1002':      [60.0, 3.4, 40.5],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function varColorHex(v: Variable): number {
  const map: Record<Variable, number> = {
    CAUDAL: 0x00F5FF, NIVEL: 0x4A9EFF, PRESION: 0xA78BFA,
    PH: 0xFFB020, TURBIDEZ: 0x88AAFF, CLORO: 0x00FF88,
    CONDUCTIVIDAD: 0xFF88FF, OXIGENO: 0x00FFCC,
    TEMPERATURA: 0xFF8844, VALVULA: 0xFFB020, CONTROL: 0x6B9EAE,
  }
  return map[v]
}
function varColorCSS(v: Variable): string {
  return '#' + varColorHex(v).toString(16).padStart(6, '0')
}
function statusColorCSS(s: Status): string {
  return { OPERATIVO: C.green, COMISIONADO: C.cyan, INSTALADO: C.amber, PLANIFICADO: C.muted, FALLA: C.red }[s]
}
function statusLabel(s: Status): string {
  return { OPERATIVO: 'Operativo', COMISIONADO: 'Comisionado', INSTALADO: 'Instalado', PLANIFICADO: 'Planificado', FALLA: 'Falla' }[s]
}
function simulate(inst: Instrument, t: number): number {
  if (inst.variable === 'CONTROL') return 1
  const spread = (inst.max - inst.min) * 0.025
  const v = inst.nominal
    + Math.sin(t * 0.3 + inst.nominal * 0.7) * spread * 0.8
    + Math.cos(t * 0.17 + inst.tag.length) * spread * 0.4
  const clamped = Math.max(inst.min, Math.min(inst.max, v))
  const decimals = ['pH', 'm', 'bar', 'mg/L'].includes(inst.unit) ? 2 : 1
  return parseFloat(clamped.toFixed(decimals))
}
function displayValue(inst: Instrument, v: number): string {
  if (inst.variable === 'CONTROL') return 'ON'
  if (inst.unit === '%') return `${Math.round(v)}%`
  return `${v}`
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function PlantaViewer3D() {
  const mountRef   = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<Instrument | null>(null)
  const tRef       = useRef(0)

  const [selected, setSelected] = useState<Instrument | null>(null)
  const [reading,  setReading]  = useState(0)
  const [tooltip,  setTooltip]  = useState<{ x: number; y: number; inst: Instrument; val: number } | null>(null)

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const W = () => el.clientWidth
    const H = () => el.clientHeight

    // ── Renderer ──────────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W(), H())
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    el.appendChild(renderer.domElement)
    const canvas = renderer.domElement
    canvas.style.cursor = 'grab'

    // ── Scene ─────────────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x6896b8)
    scene.fog = new THREE.Fog(0x6896b8, 180, 300)

    // ── Camera ────────────────────────────────────────────────────────────────
    const CTR = new THREE.Vector3(33, 0, 36)
    const sph = { th: -0.7, ph: 0.78, r: 92 }
    const camera = new THREE.PerspectiveCamera(42, W() / H(), 0.1, 600)

    function applyCam() {
      camera.position.set(
        CTR.x + sph.r * Math.sin(sph.ph) * Math.sin(sph.th),
        sph.r * Math.cos(sph.ph),
        CTR.z + sph.r * Math.sin(sph.ph) * Math.cos(sph.th),
      )
      camera.lookAt(CTR)
    }
    applyCam()

    // ── Controls ──────────────────────────────────────────────────────────────
    const drag = { on: false, btn: 0, x: 0, y: 0, dx: 0, dy: 0 }

    const onMouseDown = (e: MouseEvent) => {
      drag.on = true; drag.btn = e.button
      drag.x = drag.dx = e.clientX; drag.y = drag.dy = e.clientY
      e.preventDefault()
    }
    const onMouseUp = () => { drag.on = false; canvas.style.cursor = 'grab' }
    const onMouseMove = (e: MouseEvent) => {
      if (!drag.on) { doHover(e); return }
      canvas.style.cursor = 'grabbing'
      const ddx = e.clientX - drag.dx, ddy = e.clientY - drag.dy
      drag.dx = e.clientX; drag.dy = e.clientY
      if (drag.btn === 0 && !e.shiftKey) {
        sph.th -= ddx * 0.005
        sph.ph = Math.max(0.05, Math.min(1.52, sph.ph + ddy * 0.005))
      } else {
        const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd)
        const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize()
        const up2 = new THREE.Vector3().crossVectors(right, fwd).normalize()
        CTR.addScaledVector(right, -ddx * sph.r * 0.001)
        CTR.addScaledVector(up2, ddy * sph.r * 0.001)
      }
      applyCam()
    }
    const onWheel = (e: WheelEvent) => {
      sph.r = Math.max(12, Math.min(240, sph.r + e.deltaY * 0.05))
      applyCam(); e.preventDefault()
    }

    canvas.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('wheel', onWheel, { passive: false })

    // ── Lights ────────────────────────────────────────────────────────────────
    scene.add(new THREE.HemisphereLight(0x88b8d8, 0x1a4010, 1.3))
    const sun = new THREE.DirectionalLight(0xfff4d6, 3.8)
    sun.position.set(70, 110, 55)
    sun.castShadow = true
    sun.shadow.camera.left = -130; sun.shadow.camera.right = 130
    sun.shadow.camera.top = 130; sun.shadow.camera.bottom = -130
    sun.shadow.camera.far = 300; sun.shadow.camera.updateProjectionMatrix()
    sun.shadow.mapSize.width = sun.shadow.mapSize.height = 2048
    sun.shadow.bias = -0.001
    scene.add(sun)
    scene.add(new THREE.DirectionalLight(0xadd8e6, 0.5).translateX(-50).translateY(40).translateZ(-40))
    scene.add(new THREE.AmbientLight(0x203050, 1.0))

    // ── Material helpers ──────────────────────────────────────────────────────
    const lam  = (hex: number) => new THREE.MeshLambertMaterial({ color: hex })
    const lamD = (hex: number) => new THREE.MeshLambertMaterial({ color: hex, side: THREE.DoubleSide })
    const lamT = (hex: number, op: number) => new THREE.MeshLambertMaterial({ color: hex, transparent: true, opacity: op, side: THREE.DoubleSide })

    const mConc  = lam(0xd8d0c0), mConcD = lam(0xb0a898), mConcN = lam(0xe8e0d0)
    const mGrass = lam(0x0e2e08), mSoil  = lam(0x1a0e04), mGravel = lam(0x3c3028)
    const mSteel = lam(0x909898), mSteelR = lam(0x9a6644)
    const mBlueHi = lam(0x1a60b0), mBlueSh = lam(0x2278d8)
    const mPVC = lam(0xdddddd), mPVCb = lam(0x2255cc)
    const mWater  = lamT(0x0e9ad4, 0.82), mWaterD = lamT(0x2a6a40, 0.75)
    const mSand = lam(0xc8b870), mYellow = lam(0xddaa00), mRed = lam(0xcc2200)
    const mRoof = lam(0x4a4440), mPaint = lam(0xe8e0cc), mBlueTr = lam(0x1a4fa0)

    interface StageColors { band: THREE.Material; top: THREE.Material }
    const SC: Record<string, StageColors> = {
      cap:  { band: lam(0x3a90e8), top: lamD(0x3a90e8) },
      clar: { band: lam(0x1a8ee8), top: lamD(0x1a8ee8) },
      fg:   { band: lam(0xe8b800), top: lamD(0xe8b800) },
      flo:  { band: lam(0x22c060), top: lamD(0x22c060) },
      fr:   { band: lam(0x14c8a0), top: lamD(0x14c8a0) },
      clo:  { band: lam(0xe03020), top: lamD(0xe03020) },
      tan:  { band: lam(0x1050cc), top: lamD(0x1050cc) },
    }

    // ── Geometry helpers ──────────────────────────────────────────────────────
    function Box(cx: number, cy: number, cz: number, w: number, h: number, d: number, mat: THREE.Material) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)
      m.position.set(cx, cy, cz); m.castShadow = true; m.receiveShadow = true
      scene.add(m); return m
    }
    function Cyl(cx: number, cy: number, cz: number, rt: number, rb: number, h: number, seg: number, mat: THREE.Material) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat)
      m.position.set(cx, cy, cz); m.castShadow = true; scene.add(m); return m
    }
    function Plane(cx: number, cy: number, cz: number, w: number, d: number, mat: THREE.Material) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat)
      m.rotation.x = -Math.PI / 2; m.position.set(cx, cy, cz)
      m.receiveShadow = true; scene.add(m); return m
    }
    function PipeSeg(ax: number, ay: number, az: number, bx: number, by: number, bz: number, r: number, mat?: THREE.Material) {
      const a = new THREE.Vector3(ax, ay, az), b = new THREE.Vector3(bx, by, bz)
      const dir = new THREE.Vector3().subVectors(b, a)
      const len = dir.length(); if (len < 0.04) return
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat ?? mSteel)
      m.position.copy(a).addScaledVector(dir.normalize(), len / 2)
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())
      m.castShadow = true; scene.add(m)
    }
    function Pipe(ax: number, az: number, bx: number, bz: number, r: number, y = 0.72, mat?: THREE.Material) {
      PipeSeg(ax, y, az, bx, y, bz, r, mat ?? mPVC)
    }
    function PipeV(x: number, z: number, y1: number, y2: number, r = 0.08, mat?: THREE.Material) {
      PipeSeg(x, y1, z, x, y2, z, r, mat ?? mPVC)
    }

    function Pool(cx: number, cz: number, pw: number, pd: number, wh: number, wt: number, sc: StageColors) {
      const gy = wh / 2
      Box(cx, 0.06, cz, pw, wt * 0.7, pd, mConcD)
      Box(cx, gy, cz - pd/2 + wt/2, pw, wh, wt, mConc)
      Box(cx, gy, cz + pd/2 - wt/2, pw, wh, wt, mConc)
      Box(cx - pw/2 + wt/2, gy, cz, wt, wh, pd, mConc)
      Box(cx + pw/2 - wt/2, gy, cz, wt, wh, pd, mConc)
      const bh = 0.35, by2 = wh + bh / 2
      Box(cx, by2, cz - pd/2 + wt/2, pw + 0.08, bh, wt + 0.08, sc.band)
      Box(cx, by2, cz + pd/2 - wt/2, pw + 0.08, bh, wt + 0.08, sc.band)
      Box(cx - pw/2 + wt/2, by2, cz, wt + 0.08, bh, pd + 0.08, sc.band)
      Box(cx + pw/2 - wt/2, by2, cz, wt + 0.08, bh, pd + 0.08, sc.band)
      Plane(cx, wh + bh + 0.01, cz, pw + 0.08, pd + 0.08, sc.top)
      return { wh, bh }
    }
    function Baffles(cx: number, cz: number, pw: number, pd: number, wh: number, n: number) {
      const sp = pd / (n + 1)
      for (let i = 1; i <= n; i++) Box(cx, wh * 0.45, cz - pd/2 + sp * i, pw - 0.3, wh * 0.85, 0.10, mConcD)
    }

    // ── TERRAIN ───────────────────────────────────────────────────────────────
    Plane(0, 0, 0, 300, 300, mGrass)
    const LOT = [[2.62,72.32],[0.03,72.07],[1.14,68.56],[1.73,61.17],[2.77,32.62],[4.42,0.23],[19.53,1.84],[31.18,12.88],[53.18,6.42],[62.19,40.90],[43.84,61.55],[23.47,63.09],[14.23,65.44],[4.21,69.20]]
    const lotShape = new THREE.Shape()
    lotShape.moveTo(LOT[0][0], -LOT[0][1])
    for (let i = 1; i < LOT.length; i++) lotShape.lineTo(LOT[i][0], -LOT[i][1])
    lotShape.closePath()
    const lotMesh = new THREE.Mesh(new THREE.ShapeGeometry(lotShape), mSoil)
    lotMesh.rotation.x = -Math.PI / 2; lotMesh.position.y = 0.02; lotMesh.receiveShadow = true
    scene.add(lotMesh)
    Box(33, 0.06, 21, 62, 0.08, 4, mGravel)
    Box(56, 0.06, 36, 12, 0.08, 12, mGravel)
    const lBndPts = [...LOT.map(p => new THREE.Vector3(p[0], 0.15, p[1])), new THREE.Vector3(LOT[0][0], 0.15, LOT[0][1])]
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(lBndPts), new THREE.LineBasicMaterial({ color: 0xff5533 })))
    LOT.forEach(p => {
      const sp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff2200 }))
      sp.position.set(p[0], 0.18, p[1]); scene.add(sp)
    })

    // ── STRUCTURES ────────────────────────────────────────────────────────────
    const WT = 0.22, WH = 1.8

    // 1. Captación
    Pool(7, 36, 3, 3, 1.4, WT, SC.cap)
    Plane(7, 0.9, 36, 2.6, 2.6, mWaterD)
    PipeV(7, 36, 1.9, 1.0, 0.07)

    // 2. Clarificadores
    function buildClarifier(cx: number, cz: number) {
      const r = 1.1, h = 3.2
      Cyl(cx, h/2, cz, r, r, h, 22, mBlueHi)
      Cyl(cx, 0.25, cz, r, 0.3, 0.5, 16, mBlueSh)
      const dome = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), mBlueSh)
      dome.position.set(cx, h, cz); dome.castShadow = true; scene.add(dome)
      Cyl(cx, h * 0.68, cz, r + 0.12, r + 0.12, 0.32, 22, SC.clar.band)
      PipeV(cx, cz, h, h + 1.3, 0.06)
      PipeSeg(cx + r, h * 0.65, cz, cx + r + 1.4, h * 0.65, cz, 0.06, mSteel)
      PipeSeg(cx, 0.0, cz, cx + r + 0.8, 0.1, cz, 0.05, mSteelR)
      for (let i = 0; i < 4; i++) {
        const rg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.28, 6), mSteel)
        rg.rotation.z = Math.PI / 2; rg.position.set(cx + r + 0.03, i * 0.72 + 0.55, cz); scene.add(rg)
      }
      Cyl(cx + r + 0.04, h * 0.22, cz, r * 0.28, r * 0.28, 0.13, 10, lam(0x0a2550))
    }
    buildClarifier(14, 32); buildClarifier(14, 40)

    // 3. Filtros Gruesos
    function buildFG(cx: number, cz: number) {
      Pool(cx, cz, 7, 5, WH, WT, SC.fg)
      Plane(cx, WH * 0.55, cz, 6.56, 4.56, mWaterD)
      Baffles(cx, cz, 7, 5, WH, 4)
      PipeSeg(cx-3.5, WH*0.78, cz-2.5, cx-4.5, WH*0.78, cz-2.5, 0.08, mPVC)
    }
    buildFG(21, 29); buildFG(21, 37)

    // 4. Floculador
    Pool(30, 34.5, 5, 9.5, WH + 0.4, WT, SC.flo)
    Plane(30, WH * 0.58, 34.5, 4.56, 9.06, mWater)
    Baffles(30, 34.5, 5, 9.5, WH + 0.4, 3)
    PipeV(30, 34.5, WH + 0.4, WH + 1.9, 0.04, mPVCb)

    // 5. Filtros Rápidos
    function buildFR(cx: number, cz: number) {
      const res = Pool(cx, cz, 7, 6.8, WH + 0.2, WT, SC.fr)
      Plane(cx, WH * 0.18, cz, 6.56, 6.36, mSand)
      Plane(cx, WH * 0.35, cz, 6.56, 6.36, mWater)
      Baffles(cx, cz, 7, 6.8, WH + 0.2, 5)
      const rh = 1.1, ry = res.wh + 0.2 + res.bh + rh;
      [-3.6, 3.6].forEach(ox => {
        Box(cx + ox, res.wh+0.2+res.bh+rh/2, cz, 0.07, rh, 0.07, mBlueTr)
        Box(cx + ox, ry - 0.04, cz, 0.07, 0.07, 6.8, mBlueTr)
      })
      Box(cx, res.wh + 0.2 + res.bh + 0.08, cz, 0.1, 0.1, 3.2, mYellow)
      PipeSeg(cx + 3.5, WH * 0.7, cz - 3.2, cx + 4.8, WH * 0.7, cz - 3.2, 0.10, mPVC)
    }
    buildFR(38, 28); buildFR(38, 37); buildFR(38, 46)

    // 6. Cámara Cl₂
    Pool(47, 38, 5, 10, WH, WT, SC.clo)
    Plane(47, WH * 0.62, 38, 4.56, 9.56, mWater)
    Baffles(47, 38, 5, 10, WH, 3)
    Cyl(49.8, 1.0, 33.3, 0.28, 0.28, 1.0, 10, mYellow)
    PipeV(49.8, 33.3, 1.0, WH * 0.6, 0.04, mPVCb)

    // 7. Tanque Almacenamiento
    Pool(56, 38, 10.4, 10.5, 4.5, 0.3, SC.tan)
    Plane(56, 4.5 * 0.7, 38, 9.8, 9.9, lamT(0x0a50a0, 0.86))
    Box(56, 4.5 + 0.44, 38, 10.5, 0.18, 10.6, mConcN)
    PipeSeg(61.2, 4.5 * 0.7, 38, 62.8, 4.5 * 0.7, 38, 0.08, mSteel)
    const gps = new THREE.Mesh(new THREE.ConeGeometry(0.24, 0.5, 3), mYellow)
    gps.position.set(56, 5.1, 38); scene.add(gps)

    // 8. Caseta de Operación
    const cx = 30, cz2 = 22, cW = 11, cD = 6.5, cH = 3.4, rH = 1.15
    Box(cx, 0.08, cz2, cW+0.3, 0.16, cD+0.3, mConcN)
    Box(cx, cH/2, cz2-cD/2+WT/2, cW, cH, WT, mPaint)
    Box(cx, cH/2, cz2+cD/2-WT/2, cW, cH, WT, mPaint)
    Box(cx-cW/2+WT/2, cH/2, cz2, WT, cH, cD, mPaint)
    Box(cx+cW/2-WT/2, cH/2, cz2, WT, cH, cD, mPaint)
    Box(cx, cH*0.84, cz2-cD/2, cW, 0.13, WT*0.6, mBlueTr)
    Box(cx, cH*0.38, cz2-cD/2, cW, 0.09, WT*0.6, mBlueTr)
    Box(cx-0.4, cH*0.42, cz2-cD/2-0.01, 1.1, cH*0.78, 0.07, lam(0x181818));
    [-3.4, 2.6].forEach(ox => {
      Box(cx+ox, cH*0.65, cz2-cD/2-0.01, 1.4, 0.68, 0.05, lamT(0x2a3d55, 0.7))
      Box(cx+ox, cH*0.65, cz2-cD/2-0.01, 1.42, 0.70, 0.04, mBlueTr)
    });
    [-1, 1].forEach(side => {
      const pts = [
        new THREE.Vector3(-cW/2-0.25, cH+rH, cz2),
        new THREE.Vector3( cW/2+0.25, cH+rH, cz2),
        new THREE.Vector3( cW/2+0.25, cH-0.1, cz2 + side*(cD/2+0.35)),
        new THREE.Vector3(-cW/2-0.25, cH-0.1, cz2 + side*(cD/2+0.35)),
      ]
      const verts = new Float32Array([
        pts[0].x,pts[0].y,pts[0].z, pts[1].x,pts[1].y,pts[1].z, pts[2].x,pts[2].y,pts[2].z,
        pts[0].x,pts[0].y,pts[0].z, pts[2].x,pts[2].y,pts[2].z, pts[3].x,pts[3].y,pts[3].z,
      ])
      const rg = new THREE.BufferGeometry()
      rg.setAttribute('position', new THREE.BufferAttribute(verts, 3))
      rg.computeVertexNormals()
      const rm = new THREE.Mesh(rg, mRoof); rm.castShadow = true; scene.add(rm)
    })
    Box(cx, cH+rH+0.07, cz2, cW+0.5, 0.12, 0.12, mConcD)
    Box(cx, 0.12, cz2-cD/2-1.2, cW, 0.24, 2.4, mConcN)
    Box(cx, cH*0.25+0.96, cz2-cD/2-2.4, cW, 0.08, 0.08, mBlueTr)
    for (let ox = -cW/2+0.5; ox <= cW/2; ox += 1.2) Box(cx+ox, cH*0.25+0.46, cz2-cD/2-2.4, 0.07, 0.9, 0.07, mBlueTr)
    Cyl(cx+2.4, 1.1, cz2-cD/2-0.15, 0.06, 0.06, 0.7, 8, mRed)

    // 9. Lecho de secado
    Box(46, 0.15, 25, 9, 0.32, 5.5, mGravel);
    [-4.5, 4.5].forEach(ox => Box(46+ox, 0.5, 25, 0.2, 1, 5.5, mConc));
    [-2.75, 2.75].forEach(oz => Box(46, 0.5, 25+oz, 9, 0.2, 1, mConc))

    // 10. Muro de contención
    Box(50.5, 1.4, 34, 0.4, 2.8, 40, mConcD)
    Box(50.5, 2.82, 34, 0.46, 0.15, 40.1, mConcN)

    // ── PIPE NETWORK ──────────────────────────────────────────────────────────
    const PH = 0.72
    Pipe(8.5, 36, 11, 34, 0.08, PH); Pipe(8.5, 36, 11, 40, 0.08, PH)
    PipeV(11, 33, PH, 3.5, 0.07); PipeV(11, 40, PH, 3.5, 0.07)
    PipeSeg(15.1, 3.2*0.65, 32, 17.5, 3.2*0.65, 30, 0.06, mSteel)
    PipeSeg(17.5, 3.2*0.65, 30, 17.5, PH, 30, 0.06, mSteel)
    Pipe(17.5, 30, 17.5, 29, 0.08, PH); Pipe(17.5, 29, 21-3.5, 29, 0.08, PH)
    PipeSeg(15.1, 3.2*0.65, 40, 17.5, 3.2*0.65, 38, 0.06, mSteel)
    PipeSeg(17.5, 3.2*0.65, 38, 17.5, PH, 38, 0.06, mSteel)
    Pipe(17.5, 38, 21-3.5, 37, 0.08, PH)
    Pipe(21+3.5, 31, 27.5, 33, 0.09, PH); Pipe(21+3.5, 38.5, 27.5, 36, 0.09, PH)
    Pipe(30+2.5, 34.5, 34.5, 28, 0.12, PH); Pipe(34.5, 28, 38-3.5, 28, 0.12, PH)
    Pipe(34.5, 28, 34.5, 46, 0.12, PH)
    Pipe(34.5, 37, 38-3.5, 37, 0.12, PH); Pipe(34.5, 46, 38-3.5, 46, 0.12, PH)
    Pipe(38+3.5, 28, 44.5, 37, 0.10, PH); Pipe(38+3.5, 37, 44.5, 37.5, 0.10, PH); Pipe(38+3.5, 46, 44.5, 38.5, 0.10, PH)
    Pipe(47+2.5, 38, 56-5.3, 38, 0.10, PH)
    const dk = lam(0x444454)
    Pipe(21+3.5, 32, 46, 25, 0.06, PH*0.7, dk); Pipe(38+3.5, 37, 46, 26, 0.06, PH*0.7, dk)

    // ── VEGETATION ────────────────────────────────────────────────────────────
    const trees: [number, number, number][] = [[7,55,4.2],[9,47,3.6],[6,34,4.8],[8,20,3.9],[17,14,4.1],[56,30,3.5],[57,17,4.3],[7,64,3.2],[25,16,3.6],[48,15,3.8]]
    trees.forEach(([x, z, h]) => {
      Cyl(x, h*0.19, z, 0.2, 0.25, h*0.38, 6, lam(0x3a1e07))
      const layers: [number, number][] = [[0,0x1c5010],[0.5,0x226016],[1.0,0x2a7020]]
      layers.forEach(([o, col]) => {
        const c = new THREE.Mesh(new THREE.ConeGeometry(1.4 - o*0.2, h*0.5, 8), lam(col))
        c.position.set(x, h*0.55 + o*0.55, z); c.castShadow = true; scene.add(c)
      })
    })
    const bushes: [number, number][] = [[13,26],[25,20],[32,19],[48,28],[60,26],[10,44],[55,25]]
    bushes.forEach(([x, z]) => Cyl(x, 0.5, z, 0.55, 0.55, 0.9, 8, lam(0x1e5a14)))

    // ── COMPASS ───────────────────────────────────────────────────────────────
    Cyl(8, 0.04, 10, 3, 3, 0.06, 24, lam(0x070e1a))
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(8,0.14,7.4), new THREE.Vector3(8.8,0.14,10),
      new THREE.Vector3(8,0.14,12.6), new THREE.Vector3(7.2,0.14,10), new THREE.Vector3(8,0.14,7.4)
    ]), new THREE.LineBasicMaterial({ color: 0xff1a00 })))

    // ── SENSOR MARKERS ────────────────────────────────────────────────────────
    const sensorMeshes = new Map<string, THREE.Mesh>()
    const sensorMats   = new Map<string, THREE.MeshStandardMaterial>()
    const sensorClickable: THREE.Mesh[] = []
    const ringMatsArr: THREE.MeshBasicMaterial[] = []

    INSTRUMENTS.forEach(inst => {
      const pos = SENSOR_POS[inst.tag]
      if (!pos) return
      const colorHex = varColorHex(inst.variable)
      const color = new THREE.Color(colorHex)

      // Pole from ground to sensor
      PipeSeg(pos[0], 0.1, pos[2], pos[0], pos[1] - 0.25, pos[2], 0.018, lam(colorHex))

      // Glowing sphere
      const mat = new THREE.MeshStandardMaterial({
        color, emissive: color, emissiveIntensity: 0.75,
        metalness: 0.2, roughness: 0.3,
      })
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 16), mat)
      sphere.position.set(pos[0], pos[1], pos[2])
      sphere.userData.instrument = inst
      scene.add(sphere)
      sensorMeshes.set(inst.tag, sphere)
      sensorMats.set(inst.tag, mat)
      sensorClickable.push(sphere)

      // Pulse ring on ground
      const ringMat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, side: THREE.DoubleSide })
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.30, 0.38, 32), ringMat)
      ring.rotation.x = -Math.PI / 2
      ring.position.set(pos[0], 0.08, pos[2])
      scene.add(ring)
      ringMatsArr.push(ringMat)
    })

    // ── RAYCASTER + INTERACTION ───────────────────────────────────────────────
    const rc = new THREE.Raycaster()
    const mouse = new THREE.Vector2(-9, -9)

    function doHover(e: MouseEvent) {
      if (drag.on) return
      const rect = el!.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      rc.setFromCamera(mouse, camera)
      const hits = rc.intersectObjects(sensorClickable)
      if (hits.length) {
        const inst = (hits[0].object as THREE.Mesh).userData.instrument as Instrument
        const val = simulate(inst, tRef.current)
        setTooltip({ x: e.clientX, y: e.clientY, inst, val })
        canvas.style.cursor = 'pointer'
      } else {
        setTooltip(null)
        canvas.style.cursor = 'grab'
      }
    }

    const onClick = (e: MouseEvent) => {
      if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 5) return
      const rect = el.getBoundingClientRect()
      mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      rc.setFromCamera(mouse, camera)
      const hits = rc.intersectObjects(sensorClickable)
      if (!hits.length) { setSelected(null); selectedRef.current = null; return }
      const inst = (hits[0].object as THREE.Mesh).userData.instrument as Instrument
      setSelected(inst); selectedRef.current = inst
      setReading(simulate(inst, tRef.current))
    }
    canvas.addEventListener('click', onClick)

    // View preset buttons
    const ISO   = () => { sph.th=-.7; sph.ph=.78; sph.r=92; CTR.set(33,0,36); applyCam() }
    const TOP   = () => { sph.th=-.7; sph.ph=.06; sph.r=92; CTR.set(33,0,36); applyCam() }
    const FRONT = () => { sph.th= 0;  sph.ph=.70; sph.r=92; CTR.set(33,0,36); applyCam() }
    document.getElementById('v3d-iso')?.addEventListener('click', ISO)
    document.getElementById('v3d-top')?.addEventListener('click', TOP)
    document.getElementById('v3d-fr')?.addEventListener('click', FRONT)
    document.getElementById('v3d-rst')?.addEventListener('click', ISO)

    // ── ANIMATION LOOP ────────────────────────────────────────────────────────
    let rafId: number
    const t0 = Date.now()

    function animate() {
      rafId = requestAnimationFrame(animate)
      const t = (Date.now() - t0) * 0.001
      tRef.current = t
      mWater.opacity  = 0.79 + Math.sin(t * 1.3) * 0.04
      mWaterD.opacity = 0.71 + Math.sin(t * 1.1 + 1) * 0.04
      sensorMats.forEach((mat, tag) => {
        mat.emissiveIntensity = 0.55 + Math.sin(t * 2.5 + tag.length * 0.4) * 0.35
      })
      ringMatsArr.forEach((rm, i) => {
        rm.opacity = 0.18 + Math.sin(t * 1.8 + i * 0.7) * 0.18
      })
      renderer.render(scene, camera)
    }
    animate()

    // Update selected panel reading every 500 ms
    const interval = setInterval(() => {
      const sel = selectedRef.current
      if (sel) setReading(simulate(sel, tRef.current))
    }, 500)

    // Resize
    const onResize = () => {
      camera.aspect = W() / H()
      camera.updateProjectionMatrix()
      renderer.setSize(W(), H())
    }
    window.addEventListener('resize', onResize)

    // ── CLEANUP ───────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(rafId)
      clearInterval(interval)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('click', onClick)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('resize', onResize)
      renderer.dispose()
      if (el.contains(canvas)) el.removeChild(canvas)
    }
  }, [])

  // ── Panel values ──────────────────────────────────────────────────────────
  const vc  = selected ? varColorCSS(selected.variable)  : C.cyan
  const sc  = selected ? statusColorCSS(selected.status) : C.green
  const pct = selected
    ? Math.max(0, Math.min(100, ((reading - selected.min) / (selected.max - selected.min)) * 100))
    : 0

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: '#020C10' }}>

      {/* Three.js mount */}
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

      {/* Header overlay */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        background: 'linear-gradient(to bottom,rgba(4,10,22,.97) 55%,transparent)',
        padding: '10px 16px 28px', pointerEvents: 'none',
      }}>
        <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 12, color: '#7ecae3', fontWeight: 700 }}>
          PTAP AP01 · La Soledad — Gemelo Digital 3D
        </div>
        <div style={{ fontSize: 9, color: '#445a68', marginTop: 2 }}>
          {INSTRUMENTS.length} sensores IoT · P&ID Rev.00 · 29/04/2024 · Contrato 507-2023
        </div>
      </div>

      {/* View controls */}
      <div style={{ position: 'absolute', top: 56, right: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {[
          { id: 'v3d-iso', icon: '◈', title: 'Isométrica' },
          { id: 'v3d-top', icon: '⊙', title: 'Planta' },
          { id: 'v3d-fr',  icon: '▷', title: 'Frontal' },
          { id: 'v3d-rst', icon: '↺', title: 'Resetear' },
        ].map(b => (
          <button key={b.id} id={b.id} title={b.title} style={{
            width: 32, height: 32,
            background: 'rgba(6,14,28,.92)', border: '1px solid rgba(100,160,200,.22)',
            borderRadius: 5, color: '#7ecae3', cursor: 'pointer', fontSize: 14,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {b.icon}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 14, left: 12,
        background: 'rgba(4,10,20,.94)', border: '1px solid rgba(100,160,200,.14)',
        borderRadius: 7, padding: '9px 13px', minWidth: 190,
      }}>
        <div style={{ fontSize: 8, textTransform: 'uppercase', letterSpacing: '1.5px', color: '#7ecae3', marginBottom: 7 }}>
          Sensores IoT — {INSTRUMENTS.length} inst.
        </div>
        {(['CAUDAL','NIVEL','PRESION','PH','TURBIDEZ','CLORO','TEMPERATURA','OXIGENO'] as Variable[]).map(v => (
          <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <div style={{ width: 9, height: 9, borderRadius: 2, background: varColorCSS(v), flexShrink: 0 }} />
            <span style={{ fontSize: 9, color: '#8ab4c6' }}>{v}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid rgba(100,160,200,.1)', marginTop: 7, paddingTop: 7, fontSize: 8, color: '#445a68', lineHeight: 1.8 }}>
          Arrastra: Rotar · Scroll: Zoom<br />
          Shift+Drag: Desplazar · Clic: Detalle
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed', left: tooltip.x + 14, top: tooltip.y - 12,
          background: 'rgba(4,10,20,.96)', border: `1px solid ${varColorCSS(tooltip.inst.variable)}44`,
          borderRadius: 5, padding: '5px 10px', fontSize: 11,
          color: varColorCSS(tooltip.inst.variable),
          pointerEvents: 'none', zIndex: 30, whiteSpace: 'nowrap',
        }}>
          <span style={{ fontFamily: "'Orbitron',monospace", fontWeight: 700 }}>{tooltip.inst.tag}</span>
          {' '}<span style={{ color: C.muted2 }}>·</span>{' '}
          {displayValue(tooltip.inst, tooltip.val)} {tooltip.inst.unit}
        </div>
      )}

      {/* Selected sensor detail panel */}
      {selected && (
        <div style={{
          position: 'absolute', top: 56, left: 12, width: 240,
          background: 'rgba(4,10,20,.97)', border: `1px solid ${vc}33`,
          borderRadius: 9, padding: '13px 15px',
          boxShadow: `0 0 24px ${vc}1a`,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 8, color: C.muted, letterSpacing: '0.18em' }}>SENSOR IoT</span>
            <button onClick={() => { setSelected(null); selectedRef.current = null }}
              style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>
              ×
            </button>
          </div>

          <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 13, fontWeight: 700, color: vc, marginBottom: 3 }}>
            {selected.tag}
          </div>
          <div style={{ fontSize: 11, color: C.white, marginBottom: 8, lineHeight: 1.4 }}>
            {selected.desc}
          </div>

          {/* Status */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 10, color: sc,
            background: `${sc}12`, padding: '3px 10px', borderRadius: 10, marginBottom: 12,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: sc, display: 'inline-block',
              boxShadow: selected.status === 'OPERATIVO' ? `0 0 5px ${sc}` : 'none' }} />
            {statusLabel(selected.status)}
          </div>

          {/* Live reading */}
          <div style={{
            background: C.deep3, border: `1px solid ${C.border}`,
            borderRadius: 6, padding: '12px', textAlign: 'center', marginBottom: 10,
          }}>
            <div style={{ fontSize: 9, color: C.muted, letterSpacing: '0.14em', marginBottom: 6 }}>LECTURA EN VIVO</div>
            <div style={{ fontFamily: "'Orbitron',monospace", fontSize: 28, fontWeight: 700, color: vc, lineHeight: 1 }}>
              {displayValue(selected, reading)}
            </div>
            {selected.unit && selected.variable !== 'CONTROL' && (
              <div style={{ fontSize: 11, color: C.muted2, marginTop: 4 }}>{selected.unit}</div>
            )}
          </div>

          {/* Range bar */}
          {selected.variable !== 'CONTROL' && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: C.muted, marginBottom: 4 }}>
                <span>{selected.min}</span>
                <span style={{ color: vc }}>{Math.round(pct)}%</span>
                <span>{selected.max} {selected.unit}</span>
              </div>
              <div style={{ height: 4, background: `${vc}18`, borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: vc, borderRadius: 2, transition: 'width 0.8s ease' }} />
              </div>
            </div>
          )}

          {/* Metadata */}
          {[
            ['Variable', selected.variable],
            ['Protocolo', selected.protocol],
            ['Nominal', `${selected.nominal} ${selected.unit}`],
            ['Etapa', selected.stage],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${C.border}`, fontSize: 10 }}>
              <span style={{ color: C.muted }}>{k}</span>
              <span style={{ color: C.white, textTransform: 'uppercase' }}>{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
