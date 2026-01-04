<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { Helper } from 'dxf'

type Point = [number, number]
type Polyline = Point[]
type PolylineLineOverride = { type?: LayerLineType; color?: string; width?: number }
type PolylineItem = {
  id: string
  layer: string
  type: string
  points: Polyline
  visible?: boolean
  entityIndex?: number
  lineOverride?: PolylineLineOverride
  source?: UnknownRecord
}
type UnknownRecord = Record<string, unknown>
type LayerLineType = 'solid' | 'dash' | 'dot' | 'dashdot'
type LayerStyle = {
  line: { type: LayerLineType; color: string; width: number }
  point: { size: number }
  text: {
    fontFamily: string
    italicAngle: number
    bold: boolean
    fontSize: number
    widthFactor: number
    color: string
  }
  dim: { scale: number; textSize: number; arrowSize: number; lineGap: number }
}

function asRecord(v: unknown): UnknownRecord | null {
  if (!v || typeof v !== 'object') return null
  return v as UnknownRecord
}

function asBoxBounds(
  v: unknown,
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const r = asRecord(v)
  const min = asRecord(r?.min)
  const max = asRecord(r?.max)
  const minX = typeof min?.x === 'number' ? min.x : null
  const minY = typeof min?.y === 'number' ? min.y : null
  const maxX = typeof max?.x === 'number' ? max.x : null
  const maxY = typeof max?.y === 'number' ? max.y : null
  if (minX === null || minY === null || maxX === null || maxY === null) return null
  if (
    !Number.isFinite(minX) ||
    !Number.isFinite(minY) ||
    !Number.isFinite(maxX) ||
    !Number.isFinite(maxY)
  )
    return null
  return { minX, minY, maxX, maxY }
}

function normalizePoint(p: unknown): Point | null {
  if (Array.isArray(p) && p.length === 2) {
    const x = (p as unknown[])[0]
    const y = (p as unknown[])[1]
    if (typeof x === 'number' && typeof y === 'number' && Number.isFinite(x) && Number.isFinite(y))
      return [x, y]
    const nx = Number(x)
    const ny = Number(y)
    if (Number.isFinite(nx) && Number.isFinite(ny)) return [nx, ny]
    return null
  }
  const r = asRecord(p)
  if (r && typeof r.x === 'number' && typeof r.y === 'number') return [r.x, r.y]
  return null
}

function normalizeLayer(v: unknown) {
  if (typeof v === 'string') {
    const s = v.trim()
    return s ? s : '0'
  }
  const r = asRecord(v)
  const name = typeof r?.name === 'string' ? r.name : typeof r?.layer === 'string' ? r.layer : null
  if (typeof name === 'string') {
    const s = name.trim()
    return s ? s : '0'
  }
  return '0'
}

function normalizeType(v: unknown) {
  if (typeof v !== 'string') return 'POLYLINE'
  const s = v.trim()
  return s ? s : 'POLYLINE'
}

function normalizeFiniteNumber(v: unknown, fallback: number) {
  if (typeof v === 'number' && Number.isFinite(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

function normalizeColorHex(v: unknown, fallback: string) {
  if (typeof v !== 'string') return fallback
  const s = v.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return s.toLowerCase()
  return fallback
}

function defaultLayerStyle(): LayerStyle {
  return {
    line: { type: 'solid', color: '#2c3e50', width: 1 },
    point: { size: 0.8 },
    text: {
      fontFamily: 'sans-serif',
      italicAngle: 0,
      bold: false,
      fontSize: 12,
      widthFactor: 1,
      color: '#111111',
    },
    dim: { scale: 1, textSize: 12, arrowSize: 2.5, lineGap: 2 },
  }
}

function normalizeLayerLineType(v: unknown): LayerLineType {
  return v === 'dash' || v === 'dot' || v === 'dashdot' ? v : 'solid'
}

function normalizeLayerStyle(v: unknown): LayerStyle {
  const d = defaultLayerStyle()
  const r = asRecord(v)
  const line = asRecord(r?.line)
  const point = asRecord(r?.point)
  const text = asRecord(r?.text)
  const dim = asRecord(r?.dim)
  return {
    line: {
      type: normalizeLayerLineType(line?.type),
      color: normalizeColorHex(line?.color, d.line.color),
      width: Math.max(0.1, normalizeFiniteNumber(line?.width, d.line.width)),
    },
    point: {
      size: Math.max(0.1, normalizeFiniteNumber(point?.size, d.point.size)),
    },
    text: {
      fontFamily:
        typeof text?.fontFamily === 'string' && text.fontFamily.trim()
          ? text.fontFamily
          : d.text.fontFamily,
      italicAngle: normalizeFiniteNumber(text?.italicAngle, d.text.italicAngle),
      bold: Boolean(text?.bold ?? d.text.bold),
      fontSize: Math.max(1, normalizeFiniteNumber(text?.fontSize, d.text.fontSize)),
      widthFactor: Math.max(0.1, normalizeFiniteNumber(text?.widthFactor, d.text.widthFactor)),
      color: normalizeColorHex(text?.color, d.text.color),
    },
    dim: {
      scale: Math.max(0.01, normalizeFiniteNumber(dim?.scale, d.dim.scale)),
      textSize: Math.max(1, normalizeFiniteNumber(dim?.textSize, d.dim.textSize)),
      arrowSize: Math.max(0.1, normalizeFiniteNumber(dim?.arrowSize, d.dim.arrowSize)),
      lineGap: Math.max(0, normalizeFiniteNumber(dim?.lineGap, d.dim.lineGap)),
    },
  }
}

function normalizePolylinePointsLike(pl: unknown): Polyline | null {
  if (Array.isArray(pl)) {
    const pts: Point[] = []
    for (const p of pl) {
      const pt = normalizePoint(p)
      if (pt) pts.push(pt)
    }
    return pts.length >= 2 ? pts : null
  }

  const r = asRecord(pl)
  const vertices = r?.vertices
  if (Array.isArray(vertices)) {
    const pts: Point[] = []
    for (const p of vertices) {
      const pt = normalizePoint(p)
      if (pt) pts.push(pt)
    }
    return pts.length >= 2 ? pts : null
  }

  return null
}

function polylinePointsFromEntity(entity: unknown): Polyline | null {
  const er = asRecord(entity)
  if (!er || typeof er.type !== 'string') return null
  if (er.type === 'SOLID') {
    const corners = Array.isArray(er.corners) ? er.corners : []
    const pts: Point[] = []
    for (const c of corners) {
      const cr = asRecord(c)
      const x = cr ? normalizeFiniteNumber(cr.x, NaN) : NaN
      const y = cr ? normalizeFiniteNumber(cr.y, NaN) : NaN
      if (Number.isFinite(x) && Number.isFinite(y)) pts.push([x, y])
    }
    if (pts.length < 3) return null
    if (pts.length >= 3) pts.push(pts[0])
    return pts
  }
  if (er.type === 'DIMENSION') {
    const ms = asRecord(er.measureStart)
    const me = asRecord(er.measureEnd)
    const x1 = ms ? normalizeFiniteNumber(ms.x, NaN) : NaN
    const y1 = ms ? normalizeFiniteNumber(ms.y, NaN) : NaN
    const x2 = me ? normalizeFiniteNumber(me.x, NaN) : NaN
    const y2 = me ? normalizeFiniteNumber(me.y, NaN) : NaN
    if (
      !Number.isFinite(x1) ||
      !Number.isFinite(y1) ||
      !Number.isFinite(x2) ||
      !Number.isFinite(y2)
    )
      return null
    return [
      [x1, y1],
      [x2, y2],
    ]
  }
  return null
}

let polylineIdSeq = 0
function nextPolylineId(prefix = 'pl') {
  polylineIdSeq++
  return `${prefix}-${polylineIdSeq.toString(36)}`
}

function normalizePolylineItemLike(pl: unknown): PolylineItem | null {
  const r = asRecord(pl)
  if (r && Array.isArray(r.points)) {
    const points = normalizePolylinePointsLike(r.points)
    if (!points) return null
    const lo = asRecord(r.lineOverride)
    const lineOverride =
      lo && (lo.type || lo.color || lo.width)
        ? {
            type: lo.type ? normalizeLayerLineType(lo.type) : undefined,
            color: lo.color ? normalizeColorHex(lo.color, '#000000') : undefined,
            width:
              lo.width !== undefined
                ? Math.max(0.1, normalizeFiniteNumber(lo.width, 1))
                : undefined,
          }
        : undefined
    const entityIndex =
      typeof r.entityIndex === 'number' && Number.isInteger(r.entityIndex) && r.entityIndex >= 0
        ? r.entityIndex
        : undefined
    return {
      id: typeof r.id === 'string' && r.id.trim() ? r.id : nextPolylineId('json'),
      layer: normalizeLayer(r.layer),
      type: normalizeType(r.type),
      points,
      visible: Boolean(r.visible ?? true),
      entityIndex,
      lineOverride,
    }
  }

  const points = normalizePolylinePointsLike(pl)
  if (!points) return null
  return {
    id: nextPolylineId('pl'),
    layer: normalizeLayer(r?.layer),
    type: normalizeType(r?.type),
    points,
    visible: Boolean(r?.visible ?? true),
  }
}

function normalizePolylines(input: unknown): PolylineItem[] {
  const r = asRecord(input)
  const raw = Array.isArray(input) ? input : Array.isArray(r?.polylines) ? r?.polylines : []
  const out: PolylineItem[] = []
  for (const pl of raw) {
    const item = normalizePolylineItemLike(pl)
    if (item) out.push(item)
  }
  return out
}

const polylineItems = ref<PolylineItem[]>([])
const bboxBounds = ref<{ minX: number; minY: number; maxX: number; maxY: number } | null>(null)
const viewBounds = ref<{ minX: number; minY: number; maxX: number; maxY: number }>({
  minX: 0,
  minY: 0,
  maxX: 100,
  maxY: 100,
})
const dragging = ref<{ id: string; ptIndex: number } | null>(null)
const draggingPolyline = ref<{
  pointerId: number
  id: string
  start: { x: number; y: number }
  basePoints: Polyline
} | null>(null)
const panning = ref<{
  pointerId: number
  start: { x: number; y: number }
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
} | null>(null)
const selected = ref<{ id: string; ptIndex: number } | null>(null)
const selectedItemId = ref<string | null>(null)
const selectedEntityIndex = ref<number | null>(null)
const entityVisibleOverrides = ref<Record<string, boolean>>({})
const showGuides = ref(true)
const showMText = ref(true)
const svgEl = ref<SVGSVGElement | null>(null)
const copyState = ref<'idle' | 'ok' | 'fail'>('idle')
const pointCopyState = ref<'idle' | 'ok' | 'fail'>('idle')
const fileName = ref<string | null>(null)
const parsedDxf = ref<unknown | null>(null)
const jsonDraft = ref('')
const jsonState = ref<'idle' | 'ok' | 'fail'>('idle')
const commandLine = ref('')
const commandState = ref<'idle' | 'ok' | 'fail'>('idle')
const parsing = ref(false)
const parseMs = ref<number | null>(null)
const showJsonEditor = ref(false)
const pointMode = ref<'all' | 'sampled' | 'hidden'>('sampled')
const fatalError = ref<string | null>(null)

const selectedLayers = ref<string[]>([])
const layerStyles = ref<Record<string, LayerStyle>>({})

const layerFilterSet = computed(() => new Set(selectedLayers.value))

const visiblePolylineItems = computed<PolylineItem[]>(() => {
  const set = layerFilterSet.value
  return polylineItems.value.filter((it) => set.has(it.layer) && (it.visible ?? true))
})

let dragRaf = 0
let latestDrag: { id: string; ptIndex: number; x: number; y: number } | null = null
let windowErrorHandler: ((ev: ErrorEvent) => void) | null = null
let windowRejectionHandler: ((ev: PromiseRejectionEvent) => void) | null = null

const counts = computed(() => {
  let points = 0
  for (const it of visiblePolylineItems.value) points += it.points.length
  return { polylines: visiblePolylineItems.value.length, points }
})

const polylineStats = computed(() => {
  const tol = 1e-6
  let closed = 0
  let rectangle = 0

  for (const it of visiblePolylineItems.value) {
    const pl = it.points
    if (pl.length < 3) continue
    const first = pl[0]
    const last = pl[pl.length - 1]
    const isClosed = Math.abs(first[0] - last[0]) < tol && Math.abs(first[1] - last[1]) < tol
    if (isClosed) closed++

    const pts = isClosed ? pl.slice(0, -1) : pl
    if (pts.length !== 4) continue
    let axisAlignedEdges = 0
    for (let i = 0; i < 4; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % 4]
      const dx = Math.abs(b[0] - a[0])
      const dy = Math.abs(b[1] - a[1])
      if ((dx < tol && dy > tol) || (dy < tol && dx > tol)) axisAlignedEdges++
    }
    if (axisAlignedEdges === 4) rectangle++
  }

  return { closed, rectangle }
})

const viewBox = computed(() => {
  const b = viewBounds.value
  const w = b.maxX - b.minX
  const h = b.maxY - b.minY
  return `${b.minX} ${-b.maxY} ${w} ${h}`
})

const viewCenter = computed(() => {
  const b = viewBounds.value
  return { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 }
})

const viewSize = computed(() => {
  const b = viewBounds.value
  return { w: b.maxX - b.minX, h: b.maxY - b.minY }
})

const selectedPoint = computed(() => {
  if (!selected.value) return null
  const it = polylineItems.value.find((x) => x.id === selected.value?.id)
  const p = it?.points?.[selected.value.ptIndex]
  if (!p) return null
  return p
})

const pointSampleStep = computed(() => {
  const maxPoints = 3500
  const total = counts.value.points
  if (pointMode.value === 'hidden') return Infinity
  if (pointMode.value === 'all') return 1
  return total > maxPoints ? Math.ceil(total / maxPoints) : 1
})

const pointNudgeStep = ref(1)

const selectedPointMeta = computed(() => {
  const s = selected.value
  if (!s) return null
  const it = findItemById(s.id)
  if (!it) return null
  return { id: it.id, layer: it.layer, ptIndex: s.ptIndex, total: it.points.length }
})

const polylineStrokeStep = computed(() => {
  const total = counts.value.points
  if (total <= 20000) return 1
  if (pointMode.value === 'all') return 1
  return Math.max(1, pointSampleStep.value)
})

const exportJson = computed(() => {
  return JSON.stringify(
    {
      polylines: visiblePolylineItems.value.map(
        ({ id, layer, type, points, visible, entityIndex, lineOverride }) => ({
          id,
          layer,
          type,
          points,
          visible: visible ?? true,
          entityIndex,
          lineOverride,
        }),
      ),
      layers: Object.fromEntries(
        Object.entries(layerStyles.value).map(([layer, style]) => [
          layer,
          { ...style, visible: layerFilterSet.value.has(layer) },
        ]),
      ),
    },
    null,
    2,
  )
})

const entities = computed<unknown[]>(() => {
  const p = asRecord(parsedDxf.value)
  if (!p) return []
  const list = p.entities
  if (Array.isArray(list)) return list
  const nested = asRecord(list)
  const nestedList = nested?.entities
  return Array.isArray(nestedList) ? nestedList : []
})

const entityTypeCounts = computed(() => {
  const countsMap = new Map<string, number>()
  for (const e of entities.value) {
    const er = asRecord(e)
    const t = typeof er?.type === 'string' ? er.type : 'UNKNOWN'
    countsMap.set(t, (countsMap.get(t) ?? 0) + 1)
  }
  return Array.from(countsMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 50)
})

const polylineIdByEntityIndex = computed(() => {
  const m = new Map<number, string>()
  for (const it of polylineItems.value) {
    if (typeof it.entityIndex === 'number') m.set(it.entityIndex, it.id)
  }
  return m
})

const entityRows = computed(() => {
  const rows: Array<{
    index: number
    type: string
    layer: string
    visible: boolean
    handle: string | null
    polylineId: string | null
  }> = []
  const list = entities.value
  const max = 2000
  for (let i = 0; i < list.length && i < max; i++) {
    const er = asRecord(list[i])
    const type = typeof er?.type === 'string' ? er.type : 'UNKNOWN'
    const layer = normalizeLayer(er?.layer)
    const override = entityVisibleOverrides.value[String(i)]
    const visible = typeof override === 'boolean' ? override : Boolean(er?.visible ?? true)
    const handle = typeof er?.handle === 'string' ? er.handle : null
    const polylineId = polylineIdByEntityIndex.value.get(i) ?? null
    rows.push({ index: i, type, layer, visible, handle, polylineId })
  }
  return rows
})

function normalizeMTextString(s: string) {
  return s.split('\\P').join('\n').split('\r\n').join('\n').split('\r').join('\n')
}

const mtextRows = computed(() => {
  if (!showMText.value) return []
  const set = layerFilterSet.value
  const list = entities.value
  const out: Array<{
    index: number
    layer: string
    x: number
    y: number
    rot: number
    lines: string[]
  }> = []
  const max = 500
  for (let i = 0; i < list.length && out.length < max; i++) {
    const er = asRecord(list[i])
    if (!er || er.type !== 'MTEXT') continue
    const layer = normalizeLayer(er.layer)
    if (!set.has(layer)) continue
    const override = entityVisibleOverrides.value[String(i)]
    const visible = typeof override === 'boolean' ? override : Boolean(er.visible ?? true)
    if (!visible) continue
    const x = normalizeFiniteNumber(er.x, NaN)
    const y = normalizeFiniteNumber(er.y, NaN)
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue
    const xAxisX = normalizeFiniteNumber(er.xAxisX, NaN)
    const xAxisY = normalizeFiniteNumber(er.xAxisY, NaN)
    const rot =
      Number.isFinite(xAxisX) && Number.isFinite(xAxisY)
        ? (-Math.atan2(xAxisY, xAxisX) * 180) / Math.PI
        : 0
    const raw = typeof er.string === 'string' ? er.string : ''
    const lines = normalizeMTextString(raw)
      .split('\n')
      .map((t: string) => t.trimEnd())
      .filter((t: string) => t.length > 0)
    out.push({ index: i, layer, x, y, rot, lines: lines.length ? lines : [''] })
  }
  return out
})

function entityDetail(e: unknown) {
  const er = asRecord(e)
  if (!er) return null
  const type = typeof er.type === 'string' ? er.type : 'UNKNOWN'
  const layer = normalizeLayer(er.layer)
  const base: UnknownRecord = {
    type,
    layer,
    handle: typeof er.handle === 'string' ? er.handle : undefined,
    visible: Boolean(er.visible ?? true),
    lineTypeName: typeof er.lineTypeName === 'string' ? er.lineTypeName : undefined,
    colorNumber: typeof er.colorNumber === 'number' ? er.colorNumber : undefined,
  }

  if (type === 'LINE') {
    const s = asRecord(er.start)
    const t = asRecord(er.end)
    return {
      ...base,
      start: s ? { x: s.x, y: s.y } : undefined,
      end: t ? { x: t.x, y: t.y } : undefined,
    }
  }
  if (type === 'LWPOLYLINE' || type === 'POLYLINE') {
    const vertices = Array.isArray(er.vertices)
      ? er.vertices
          .map((v) => {
            const vr = asRecord(v)
            if (!vr) return null
            return { x: vr.x, y: vr.y, bulge: vr.bulge }
          })
          .filter(Boolean)
      : []
    return { ...base, closed: Boolean(er.closed ?? false), vertices }
  }
  if (type === 'ARC') {
    return {
      ...base,
      center: { x: er.x, y: er.y },
      radius: er.r,
      startAngle: er.startAngle,
      endAngle: er.endAngle,
    }
  }
  if (type === 'CIRCLE') {
    return { ...base, center: { x: er.x, y: er.y }, radius: er.r }
  }
  if (type === 'SPLINE') {
    const cps = Array.isArray(er.controlPoints)
      ? er.controlPoints
          .map((p) => {
            const pr = asRecord(p)
            if (!pr) return null
            return { x: pr.x, y: pr.y }
          })
          .filter(Boolean)
      : []
    return {
      ...base,
      degree: er.degree,
      closed: Boolean(er.closed ?? false),
      controlPoints: cps,
      knots: Array.isArray(er.knots) ? er.knots : undefined,
      fitTolerance: er.fitTolerance,
    }
  }
  if (type === 'MTEXT') {
    return {
      ...base,
      insert: { x: er.x, y: er.y },
      text: typeof er.string === 'string' ? er.string : undefined,
      nominalTextHeight: er.nominalTextHeight,
      styleName: er.styleName,
    }
  }
  if (type === 'SOLID') {
    const corners = Array.isArray(er.corners)
      ? er.corners
          .map((c) => {
            const cr = asRecord(c)
            if (!cr) return null
            return { x: cr.x, y: cr.y, z: cr.z }
          })
          .filter(Boolean)
      : []
    return { ...base, corners }
  }
  if (type === 'DIMENSION') {
    return {
      ...base,
      dimensionType: er.dimensionType,
      block: er.block,
      start: er.start,
      measureStart: er.measureStart,
      measureEnd: er.measureEnd,
      textMidpoint: er.textMidpoint,
      rotation: er.rotation,
      textRotation: er.textRotation,
    }
  }

  return base
}

const selectedEntity = computed(() => {
  const i = selectedEntityIndex.value
  if (i === null) return null
  return entities.value[i] ?? null
})

const selectedEntityInfo = computed(() => {
  const e = selectedEntity.value
  if (!e) return null
  const info = entityDetail(e)
  if (!info) return null

  const polylineId = polylineIdByEntityIndex.value.get(selectedEntityIndex.value as number) ?? null
  const it = polylineId ? findItemById(polylineId) : null
  const line = it
    ? effectiveLineStyle(it)
    : ensureLayerStyle(normalizeLayer((info as UnknownRecord).layer)).line
  const idx = selectedEntityIndex.value as number
  const override = entityVisibleOverrides.value[String(idx)]
  const visible =
    typeof override === 'boolean' ? override : Boolean((info as UnknownRecord).visible ?? true)
  return {
    ...info,
    visible,
    effective: {
      line,
      text: ensureLayerStyle(normalizeLayer((info as UnknownRecord).layer)).text,
      dim: ensureLayerStyle(normalizeLayer((info as UnknownRecord).layer)).dim,
    },
    polylineId,
  }
})

function toggleSelectedEntityVisible() {
  const idx = selectedEntityIndex.value
  if (idx === null) return
  const key = String(idx)
  const current = entityRows.value.find((r) => r.index === idx)?.visible ?? true
  const next = !current
  entityVisibleOverrides.value = { ...entityVisibleOverrides.value, [key]: next }
  const polylineId = polylineIdByEntityIndex.value.get(idx) ?? null
  if (polylineId) {
    const it = findItemById(polylineId)
    if (it) it.visible = next
  }
}

const polylineLayerCounts = computed(() => {
  const countsMap = new Map<string, number>()
  for (const it of polylineItems.value) {
    countsMap.set(it.layer, (countsMap.get(it.layer) ?? 0) + 1)
  }
  return Array.from(countsMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 200)
})

const layerRows = computed(() => {
  return polylineLayerCounts.value.map(([layer, n]) => ({
    layer,
    n,
    style: ensureLayerStyle(layer),
  }))
})

function ensureLayerStyle(layer: string) {
  const l = normalizeLayer(layer)
  const existing = layerStyles.value[l]
  if (existing) return existing
  const next = defaultLayerStyle()
  layerStyles.value[l] = next
  return next
}

function pointRadiusForLayer(layer: string, selectedState: boolean) {
  const base = ensureLayerStyle(layer).point.size
  if (!selectedState) return base
  return Math.max(base * 1.35, base + 0.35)
}

function setViewCenterX(x: number) {
  const b = viewBounds.value
  const half = (b.maxX - b.minX) / 2
  if (!Number.isFinite(x) || !Number.isFinite(half) || half <= 0) return
  viewBounds.value = { ...b, minX: x - half, maxX: x + half }
}

function setViewCenterY(y: number) {
  const b = viewBounds.value
  const half = (b.maxY - b.minY) / 2
  if (!Number.isFinite(y) || !Number.isFinite(half) || half <= 0) return
  viewBounds.value = { ...b, minY: y - half, maxY: y + half }
}

function setViewWidth(w: number) {
  const b = viewBounds.value
  if (!Number.isFinite(w) || w <= 0) return
  const cx = (b.minX + b.maxX) / 2
  const half = w / 2
  viewBounds.value = { ...b, minX: cx - half, maxX: cx + half }
}

function setViewHeight(h: number) {
  const b = viewBounds.value
  if (!Number.isFinite(h) || h <= 0) return
  const cy = (b.minY + b.maxY) / 2
  const half = h / 2
  viewBounds.value = { ...b, minY: cy - half, maxY: cy + half }
}

function lineTypeFromName(name: unknown): LayerLineType | null {
  if (typeof name !== 'string') return null
  const s = name.trim().toLowerCase()
  if (!s || s === 'bylayer' || s === 'byblock') return null
  if (s.includes('dashdot') || s.includes('dash-dot') || s.includes('dash_dot')) return 'dashdot'
  if (s.includes('dot')) return 'dot'
  if (s.includes('dash')) return 'dash'
  return 'solid'
}

function rgbToHex(v: unknown): string | null {
  if (!Array.isArray(v) || v.length < 3) return null
  const r = Number(v[0])
  const g = Number(v[1])
  const b = Number(v[2])
  if (![r, g, b].every((n) => Number.isFinite(n))) return null
  const to2 = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, '0')
  return `#${to2(r)}${to2(g)}${to2(b)}`
}

function effectiveLineStyle(it: PolylineItem) {
  const base = ensureLayerStyle(it.layer).line
  const o = it.lineOverride
  return {
    type: o?.type ?? base.type,
    color: o?.color ?? base.color,
    width: o?.width ?? base.width,
  }
}

function selectPolyline(id: string) {
  selectedItemId.value = id
  const it = findItemById(id)
  if (it && typeof it.entityIndex === 'number') selectedEntityIndex.value = it.entityIndex
}

function selectEntityIndex(index: number) {
  selectedEntityIndex.value = index
  const polylineId = polylineIdByEntityIndex.value.get(index) ?? null
  if (polylineId) {
    selectPolyline(polylineId)
  } else {
    selectedItemId.value = null
  }
}

function focusPolyline(id: string) {
  const it = findItemById(id)
  if (!it || it.points.length === 0) return
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of it.points) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  setViewToContentBounds({ minX, minY, maxX, maxY }, 0.1)
}

function focusEntityIndex(index: number) {
  const polylineId = polylineIdByEntityIndex.value.get(index) ?? null
  if (polylineId) {
    focusPolyline(polylineId)
    return
  }
  const e = entities.value[index]
  const er = asRecord(e)
  if (!er) return
  const x = normalizeFiniteNumber(er.x, NaN)
  const y = normalizeFiniteNumber(er.y, NaN)
  if (!Number.isFinite(x) || !Number.isFinite(y)) return
  const w = Math.max(viewSize.value.w * 0.25, 50)
  const h = Math.max(viewSize.value.h * 0.25, 50)
  viewBounds.value = { minX: x - w / 2, maxX: x + w / 2, minY: y - h / 2, maxY: y + h / 2 }
}

function onMTextClick(index: number) {
  selectEntityIndex(index)
  focusEntityIndex(index)
}

function layerDashArray(type: LayerLineType, width: number) {
  const w = Math.max(0.2, width)
  if (type === 'dash') return `${6 * w} ${4 * w}`
  if (type === 'dot') return `${w} ${3 * w}`
  if (type === 'dashdot') return `${6 * w} ${3 * w} ${w} ${3 * w}`
  return null
}

function initLayerStateFromItems(forceSelectAllIfEmpty: boolean) {
  const layers = polylineLayerCounts.value.map(([layer]) => layer)
  for (const l of layers) ensureLayerStyle(l)
  if (forceSelectAllIfEmpty && layers.length > 0 && selectedLayers.value.length === 0)
    selectedLayers.value = layers.slice()
}

function shouldRenderPoint(id: string, ptIndex: number, ptTotal: number) {
  if (selectedItemId.value === id) return true
  if (pointMode.value === 'hidden') return false
  const step = pointSampleStep.value
  if (step <= 1) return true
  const sel = selected.value
  if (sel && sel.id === id && sel.ptIndex === ptIndex) return true
  if (ptIndex === 0 || ptIndex === ptTotal - 1) return true
  return ptIndex % step === 0
}

function findItemById(id: string) {
  return polylineItems.value.find((x) => x.id === id) ?? null
}

function toSvgPoints(pl: Polyline, step = 1) {
  if (!Number.isFinite(step) || step <= 1) return pl.map(([x, y]) => `${x},${-y}`).join(' ')
  const pts: string[] = []
  for (let i = 0; i < pl.length; i += step) {
    const [x, y] = pl[i]
    pts.push(`${x},${-y}`)
  }
  if (pl.length >= 2) {
    const [lx, ly] = pl[pl.length - 1]
    const last = `${lx},${-ly}`
    if (pts[pts.length - 1] !== last) pts.push(last)
  }
  return pts.join(' ')
}

function clientToModel(ev: PointerEvent | MouseEvent) {
  const svg = svgEl.value
  if (!svg) return null
  const CTM = svg.getScreenCTM()
  if (!CTM) return null
  const x = (ev.clientX - CTM.e) / CTM.a
  const y = -((ev.clientY - CTM.f) / CTM.d)
  return { x, y }
}

function setViewToContentBounds(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  padRatio: number,
) {
  let { minX, minY, maxX, maxY } = bounds
  if (![minX, minY, maxX, maxY].every((n) => Number.isFinite(n))) return

  if (maxX < minX) [minX, maxX] = [maxX, minX]
  if (maxY < minY) [minY, maxY] = [maxY, minY]

  let w = maxX - minX
  let h = maxY - minY
  let span = Math.max(w, h)
  if (!Number.isFinite(span) || span <= 0) span = 100

  const pr = Number.isFinite(padRatio) ? Math.max(0, Math.min(0.5, padRatio)) : 0.05
  const pad = span * pr

  minX -= pad
  maxX += pad
  minY -= pad
  maxY += pad

  w = maxX - minX
  h = maxY - minY
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return

  const svg = svgEl.value
  const vw = svg?.clientWidth ?? 0
  const vh = svg?.clientHeight ?? 0
  if (vw > 0 && vh > 0) {
    const viewportRatio = vw / vh
    const contentRatio = w / h
    if (Number.isFinite(viewportRatio) && viewportRatio > 0 && Number.isFinite(contentRatio)) {
      if (contentRatio > viewportRatio) {
        const targetH = w / viewportRatio
        const extra = targetH - h
        minY -= extra / 2
        maxY += extra / 2
      } else if (contentRatio < viewportRatio) {
        const targetW = h * viewportRatio
        const extra = targetW - w
        minX -= extra / 2
        maxX += extra / 2
      }
    }
  }

  viewBounds.value = { minX, minY, maxX, maxY }
}

function fitToContent() {
  const b = bboxBounds.value
  if (
    b &&
    layerFilterSet.value.size > 0 &&
    layerFilterSet.value.size === polylineLayerCounts.value.length
  ) {
    setViewToContentBounds(b, 0.05)
    return
  }

  const pts: Point[] = []
  visiblePolylineItems.value.forEach((it) => pts.push(...it.points))
  if (pts.length === 0) {
    viewBounds.value = { minX: 0, minY: 0, maxX: 100, maxY: 100 }
    return
  }
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of pts) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  setViewToContentBounds({ minX, minY, maxX, maxY }, 0.05)
}

function onFileSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    const text = String(reader.result)
    parsing.value = true
    parseMs.value = null
    const start = performance.now()
    setTimeout(() => {
      try {
        const helper = new Helper(text)
        const polyResult = helper.toPolylines() as unknown
        const pr = asRecord(polyResult)
        bboxBounds.value = asBoxBounds(pr?.bbox)

        const denorm = (helper as unknown as { denormalised?: unknown }).denormalised
        const denormEntities = Array.isArray(denorm) ? denorm : []

        const rawPolylines = Array.isArray(pr?.polylines) ? pr?.polylines : []
        const items: PolylineItem[] = []
        for (let i = 0; i < rawPolylines.length; i++) {
          const pl = rawPolylines[i]
          const ent = denormEntities[i]
          const points = normalizePolylinePointsLike(pl) ?? polylinePointsFromEntity(ent)
          if (!points) continue
          const er = asRecord(ent)
          const type =
            typeof er?.type === 'string'
              ? er.type
              : normalizeType((asRecord(pl) as UnknownRecord | null)?.type)
          const layer = normalizeLayer(er?.layer ?? (asRecord(pl) as UnknownRecord | null)?.layer)
          const visible = Boolean(er?.visible ?? true)
          const o: PolylineLineOverride = {}
          const lt = lineTypeFromName(er?.lineTypeName)
          if (lt) o.type = lt
          if (typeof er?.colorNumber === 'number' && er.colorNumber !== 256) {
            const rgb = (asRecord(pl) as UnknownRecord | null)?.rgb
            const hex = rgbToHex(rgb)
            if (hex) o.color = hex
          }

          items.push({
            id: nextPolylineId('dxf'),
            layer,
            type,
            points,
            visible,
            entityIndex: i,
            lineOverride: Object.keys(o).length ? o : undefined,
            source: { entity: ent as unknown, polyline: pl as unknown },
          })
        }
        polylineItems.value = items
        layerStyles.value = {}
        selectedLayers.value = []
        initLayerStateFromItems(true)
        parsedDxf.value = { entities: denormEntities }
        entityVisibleOverrides.value = {}
        fileName.value = file.name
        selected.value = null
        selectedItemId.value = null
        selectedEntityIndex.value = null
        copyState.value = 'idle'
        jsonDraft.value = exportJson.value
        jsonState.value = 'idle'
        commandLine.value = ''
        commandState.value = 'idle'
        pointMode.value = counts.value.points > 3500 ? 'sampled' : 'all'
        fitToContent()
      } finally {
        parseMs.value = Math.round(performance.now() - start)
        parsing.value = false
      }
    }, 0)
  }
  reader.readAsText(file)
}

function onPointerDown(id: string, ptIndex: number, ev: PointerEvent) {
  dragging.value = { id, ptIndex }
  selected.value = { id, ptIndex }
  selectPolyline(id)
  svgEl.value?.setPointerCapture(ev.pointerId)
}

function onEntityRowClick(row: { index: number; polylineId: string | null }) {
  selectEntityIndex(row.index)
  focusEntityIndex(row.index)
}

function onPointerMove(ev: PointerEvent) {
  if (panning.value) {
    const p = clientToModel(ev)
    if (!p) return
    const start = panning.value.start
    const b = panning.value.bounds
    const dx = p.x - start.x
    const dy = p.y - start.y
    viewBounds.value = {
      minX: b.minX - dx,
      maxX: b.maxX - dx,
      minY: b.minY - dy,
      maxY: b.maxY - dy,
    }
    return
  }
  if (draggingPolyline.value) {
    const p = clientToModel(ev)
    if (!p) return
    const d = draggingPolyline.value
    const it = findItemById(d.id)
    if (!it) return
    const dx = p.x - d.start.x
    const dy = p.y - d.start.y
    it.points = d.basePoints.map(([x, y]) => [x + dx, y + dy])
    return
  }
  if (!dragging.value || polylineItems.value.length === 0) return
  const { id, ptIndex } = dragging.value
  const p = clientToModel(ev)
  if (!p) return
  latestDrag = { id, ptIndex, x: p.x, y: p.y }
  if (dragRaf) return
  dragRaf = requestAnimationFrame(() => {
    dragRaf = 0
    const d = latestDrag
    latestDrag = null
    if (!d) return
    const it = findItemById(d.id)
    if (!it) return
    const pl = it.points
    if (!pl[d.ptIndex]) return
    pl[d.ptIndex] = [d.x, d.y]
  })
}

function onPointerUp(ev: PointerEvent) {
  if (dragging.value) {
    svgEl.value?.releasePointerCapture(ev.pointerId)
  }
  if (draggingPolyline.value) {
    svgEl.value?.releasePointerCapture(ev.pointerId)
  }
  if (panning.value) {
    svgEl.value?.releasePointerCapture(ev.pointerId)
  }
  dragging.value = null
  draggingPolyline.value = null
  panning.value = null
  latestDrag = null
  if (dragRaf) {
    cancelAnimationFrame(dragRaf)
    dragRaf = 0
  }
}

function onPointerCancel(ev: PointerEvent) {
  if (dragging.value) {
    svgEl.value?.releasePointerCapture(ev.pointerId)
  }
  if (draggingPolyline.value) {
    svgEl.value?.releasePointerCapture(ev.pointerId)
  }
  if (panning.value) {
    svgEl.value?.releasePointerCapture(ev.pointerId)
  }
  dragging.value = null
  draggingPolyline.value = null
  panning.value = null
  latestDrag = null
  if (dragRaf) {
    cancelAnimationFrame(dragRaf)
    dragRaf = 0
  }
}

function onCanvasPointerDown(ev: PointerEvent) {
  if (ev.target !== ev.currentTarget) return
  if (ev.button === 1 || ev.shiftKey) {
    const p = clientToModel(ev)
    if (!p) return
    panning.value = { pointerId: ev.pointerId, start: p, bounds: { ...viewBounds.value } }
    svgEl.value?.setPointerCapture(ev.pointerId)
    return
  }
  selected.value = null
  selectedItemId.value = null
  selectedEntityIndex.value = null
}

function onPolylinePointerDown(id: string, ev: PointerEvent) {
  if (ev.button !== 0) return
  if (!ev.altKey && !ev.ctrlKey && !ev.metaKey) return
  const p = clientToModel(ev)
  if (!p) return
  const it = findItemById(id)
  if (!it) return
  selectPolyline(id)
  selected.value = null
  draggingPolyline.value = {
    pointerId: ev.pointerId,
    id,
    start: p,
    basePoints: it.points.map((x) => x),
  }
  svgEl.value?.setPointerCapture(ev.pointerId)
}

function onWheel(ev: WheelEvent) {
  const p = clientToModel(ev)
  if (!p) return
  const b = viewBounds.value
  const w = b.maxX - b.minX
  const h = b.maxY - b.minY
  const scale = Math.exp(Math.max(-10, Math.min(10, ev.deltaY)) * 0.0012)
  const minW = 1
  const minH = 1
  const maxW = 1e9
  const maxH = 1e9
  const nextW = Math.max(minW, Math.min(maxW, w * scale))
  const nextH = Math.max(minH, Math.min(maxH, h * scale))
  const rx = w === 0 ? 0.5 : (p.x - b.minX) / w
  const ry = h === 0 ? 0.5 : (p.y - b.minY) / h
  const minX = p.x - rx * nextW
  const maxX = minX + nextW
  const minY = p.y - ry * nextH
  const maxY = minY + nextH
  viewBounds.value = { minX, minY, maxX, maxY }
}

function setSelectedX(x: number) {
  const s = selected.value
  if (!s) return
  const it = findItemById(s.id)
  const p = it?.points?.[s.ptIndex]
  if (!p) return
  it.points[s.ptIndex] = [x, p[1]]
}

function setSelectedY(y: number) {
  const s = selected.value
  if (!s) return
  const it = findItemById(s.id)
  const p = it?.points?.[s.ptIndex]
  if (!p) return
  it.points[s.ptIndex] = [p[0], y]
}

function insertPointOnPolyline(id: string, ev: MouseEvent) {
  const p = clientToModel(ev)
  if (!p) return
  const it = findItemById(id)
  const pl = it?.points
  if (!pl || pl.length < 2) return

  let bestSeg = 0
  let bestDist2 = Infinity
  for (let i = 0; i < pl.length - 1; i++) {
    const [ax, ay] = pl[i]
    const [bx, by] = pl[i + 1]
    const abx = bx - ax
    const aby = by - ay
    const apx = p.x - ax
    const apy = p.y - ay
    const abLen2 = abx * abx + aby * aby
    const t = abLen2 === 0 ? 0 : Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLen2))
    const cx = ax + t * abx
    const cy = ay + t * aby
    const dx = p.x - cx
    const dy = p.y - cy
    const d2 = dx * dx + dy * dy
    if (d2 < bestDist2) {
      bestDist2 = d2
      bestSeg = i
    }
  }

  pl.splice(bestSeg + 1, 0, [p.x, p.y])
  selected.value = { id, ptIndex: bestSeg + 1 }
}

function deleteSelectedPoint() {
  const s = selected.value
  if (!s) return
  const idx = polylineItems.value.findIndex((x) => x.id === s.id)
  if (idx < 0) return
  const it = polylineItems.value[idx]
  const pl = it.points
  if (!pl[s.ptIndex]) return
  if (pl.length <= 2) {
    polylineItems.value.splice(idx, 1)
    selected.value = null
    return
  }
  pl.splice(s.ptIndex, 1)
  selected.value = { id: s.id, ptIndex: Math.max(0, s.ptIndex - 1) }
}

function nudgeSelectedPoint(dx: number, dy: number, mult = 1) {
  const s = selected.value
  if (!s) return
  const it = findItemById(s.id)
  const p = it?.points?.[s.ptIndex]
  if (!it || !p) return
  const step = Math.max(0, Number(pointNudgeStep.value) || 0)
  if (!Number.isFinite(step) || step <= 0) return
  const nx = p[0] + dx * step * mult
  const ny = p[1] + dy * step * mult
  if (!Number.isFinite(nx) || !Number.isFinite(ny)) return
  it.points[s.ptIndex] = [nx, ny]
}

async function copySelectedPoint() {
  const p = selectedPoint.value
  if (!p) return
  pointCopyState.value = 'idle'
  const text = `${p[0]},${p[1]}`
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
    } else {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.left = '-10000px'
      ta.style.top = '0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    pointCopyState.value = 'ok'
    setTimeout(() => (pointCopyState.value = 'idle'), 1200)
  } catch {
    pointCopyState.value = 'fail'
    setTimeout(() => (pointCopyState.value = 'idle'), 1200)
  }
}

function insertPointAroundSelected(mode: 'before' | 'after') {
  const s = selected.value
  if (!s) return
  const it = findItemById(s.id)
  if (!it) return
  const pl = it.points
  if (pl.length < 2) return
  const i = s.ptIndex
  const prevIndex = Math.max(0, i - 1)
  const nextIndex = Math.min(pl.length - 1, i + 1)
  const a = mode === 'before' ? pl[prevIndex] : pl[i]
  const b = mode === 'before' ? pl[i] : pl[nextIndex]
  const mid: Point = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const insertAt = mode === 'before' ? i : i + 1
  pl.splice(insertAt, 0, mid)
  selected.value = { id: s.id, ptIndex: insertAt }
}

function onKeyDown(ev: KeyboardEvent) {
  const tag = (ev.target as HTMLElement | null)?.tagName?.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return
  if (ev.key === 'Delete' || ev.key === 'Backspace') {
    deleteSelectedPoint()
  }
  if (ev.key === 'ArrowLeft') {
    ev.preventDefault()
    nudgeSelectedPoint(-1, 0, ev.shiftKey ? 10 : 1)
  } else if (ev.key === 'ArrowRight') {
    ev.preventDefault()
    nudgeSelectedPoint(1, 0, ev.shiftKey ? 10 : 1)
  } else if (ev.key === 'ArrowUp') {
    ev.preventDefault()
    nudgeSelectedPoint(0, 1, ev.shiftKey ? 10 : 1)
  } else if (ev.key === 'ArrowDown') {
    ev.preventDefault()
    nudgeSelectedPoint(0, -1, ev.shiftKey ? 10 : 1)
  }
}

function downloadJson() {
  if (visiblePolylineItems.value.length === 0) return
  const blob = new Blob([exportJson.value], { type: 'application/json;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'polylines.json'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function basenameWithoutExt(name: string | null, fallback: string) {
  const raw = (name ?? '').trim()
  if (!raw) return fallback
  return raw.replace(/\.[^.]+$/, '')
}

function downloadTextFile(text: string, mime: string, filename: string) {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

function polylineClosedFlag(pl: Polyline) {
  if (pl.length < 3) return { closed: false, vertices: pl }
  const tol = 1e-6
  const first = pl[0]
  const last = pl[pl.length - 1]
  const closed = Math.abs(first[0] - last[0]) < tol && Math.abs(first[1] - last[1]) < tol
  return { closed, vertices: closed ? pl.slice(0, -1) : pl }
}

function toDxfString() {
  const lines: string[] = []
  const pushPair = (code: number | string, value: number | string) => {
    lines.push(String(code), String(value))
  }

  pushPair(0, 'SECTION')
  pushPair(2, 'HEADER')
  pushPair(9, '$ACADVER')
  pushPair(1, 'AC1027')
  pushPair(0, 'ENDSEC')
  pushPair(0, 'SECTION')
  pushPair(2, 'ENTITIES')

  for (const it of visiblePolylineItems.value) {
    const { closed, vertices } = polylineClosedFlag(it.points)
    if (vertices.length < 2) continue
    pushPair(0, 'LWPOLYLINE')
    pushPair(100, 'AcDbEntity')
    pushPair(8, it.layer || '0')
    pushPair(100, 'AcDbPolyline')
    pushPair(90, vertices.length)
    pushPair(70, closed ? 1 : 0)
    for (const [x, y] of vertices) {
      pushPair(10, x)
      pushPair(20, y)
    }
  }

  pushPair(0, 'ENDSEC')
  pushPair(0, 'EOF')
  return lines.join('\n')
}

function downloadDxf() {
  if (visiblePolylineItems.value.length === 0) return
  const base = basenameWithoutExt(fileName.value, 'export')
  downloadTextFile(toDxfString(), 'application/dxf;charset=utf-8', `${base}.dxf`)
}

function exportSvgMarkup() {
  const vb = viewBox.value
  const polylinesMarkup = visiblePolylineItems.value
    .map((it) => {
      const pts = toSvgPoints(it.points, 1)
      const style = ensureLayerStyle(it.layer)
      const dash = layerDashArray(style.line.type, style.line.width)
      const dashAttr = dash ? ` stroke-dasharray="${dash}"` : ''
      return `<polyline points="${pts}" fill="none" stroke="${style.line.color}" stroke-width="${style.line.width}" vector-effect="non-scaling-stroke"${dashAttr} />`
    })
    .join('')

  return (
    `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>export</title>
    <style>
      @page { size: A4 landscape; margin: 10mm; }
      html, body { height: 100%; margin: 0; }
      body { display: flex; align-items: center; justify-content: center; background: #fff; }
      svg { width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" preserveAspectRatio="xMidYMid meet">
      <rect x="-1000000" y="-1000000" width="2000000" height="2000000" fill="#fff"></rect>
      ${polylinesMarkup}
    </svg>
    <scr` +
    `ipt>
      setTimeout(() => { window.focus(); window.print(); }, 50)
      window.onafterprint = () => { window.close() }
    </scr` +
    `ipt>
  </body>
</html>`
  )
}

function exportPdf() {
  if (visiblePolylineItems.value.length === 0) return
  const html = exportSvgMarkup()
  const w = window.open('', '_blank')
  if (w) {
    w.document.open()
    w.document.write(html)
    w.document.close()
    return
  }
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  document.body.appendChild(iframe)
  const doc = iframe.contentDocument
  if (!doc) return
  doc.open()
  doc.write(html)
  doc.close()
  setTimeout(() => {
    iframe.contentWindow?.focus()
    iframe.contentWindow?.print()
    setTimeout(() => iframe.remove(), 500)
  }, 100)
}

async function copyJson() {
  if (visiblePolylineItems.value.length === 0) return
  copyState.value = 'idle'
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(exportJson.value)
    } else {
      const ta = document.createElement('textarea')
      ta.value = exportJson.value
      ta.style.position = 'fixed'
      ta.style.left = '-10000px'
      ta.style.top = '0'
      document.body.appendChild(ta)
      ta.focus()
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    copyState.value = 'ok'
  } catch {
    copyState.value = 'fail'
  }
}

function refreshJsonDraft() {
  jsonDraft.value = exportJson.value
  jsonState.value = 'idle'
}

function applyJsonDraft() {
  jsonState.value = 'idle'
  try {
    const obj: unknown = JSON.parse(jsonDraft.value)
    const r = asRecord(obj)
    const next = normalizePolylines(obj)
    if (next.length === 0) throw new Error('invalid')
    polylineItems.value = next
    bboxBounds.value = null
    selected.value = null
    selectedItemId.value = null
    selectedEntityIndex.value = null
    layerStyles.value = {}
    selectedLayers.value = []
    const hasLayerConfig = Boolean(r && r.layers && typeof r.layers === 'object')
    if (r && r.layers && typeof r.layers === 'object') {
      const lr = asRecord(r.layers)
      if (lr) {
        const nextStyles: Record<string, LayerStyle> = {}
        const nextVisible: string[] = []
        for (const [k, v] of Object.entries(lr)) {
          const layer = normalizeLayer(k)
          const vr = asRecord(v)
          const visible = vr ? Boolean(vr.visible ?? true) : true
          nextStyles[layer] = normalizeLayerStyle(v)
          if (visible) nextVisible.push(layer)
        }
        layerStyles.value = { ...layerStyles.value, ...nextStyles }
        selectedLayers.value = nextVisible
      }
    }
    initLayerStateFromItems(!hasLayerConfig)
    jsonState.value = 'ok'
  } catch {
    jsonState.value = 'fail'
  }
}

function clearAll() {
  polylineItems.value = []
  bboxBounds.value = null
  viewBounds.value = { minX: 0, minY: 0, maxX: 100, maxY: 100 }
  parsedDxf.value = null
  fileName.value = null
  selected.value = null
  selectedItemId.value = null
  selectedEntityIndex.value = null
  entityVisibleOverrides.value = {}
  selectedLayers.value = []
  layerStyles.value = {}
  copyState.value = 'idle'
  jsonDraft.value = ''
  jsonState.value = 'idle'
  commandLine.value = ''
  commandState.value = 'idle'
}

function setLayerVisible(layer: string, visible: boolean) {
  const l = normalizeLayer(layer)
  const idx = selectedLayers.value.indexOf(l)
  if (visible) {
    if (idx < 0) selectedLayers.value.push(l)
  } else {
    if (idx >= 0) selectedLayers.value.splice(idx, 1)
  }
}

function clearLayerFilter() {
  selectedLayers.value = []
}

function selectAllLayers() {
  selectedLayers.value = polylineLayerCounts.value.map(([layer]) => layer)
}

function runCommand() {
  const raw = commandLine.value.trim()
  const parts = raw.split(/\s+/).filter(Boolean)
  const cmd = (parts[0] ?? '').toLowerCase()
  commandState.value = 'idle'
  try {
    if (cmd === 'clear') {
      clearAll()
      commandState.value = 'ok'
      return
    }
    if (cmd === 'delete') {
      deleteSelectedPoint()
      commandState.value = 'ok'
      return
    }
    if (cmd === 'copy') {
      void copyJson().then(() => (commandState.value = copyState.value === 'fail' ? 'fail' : 'ok'))
      return
    }
    if (cmd === 'export') {
      downloadJson()
      commandState.value = 'ok'
      return
    }
    if (cmd === 'refresh-json') {
      refreshJsonDraft()
      commandState.value = 'ok'
      return
    }
    if (cmd === 'apply-json') {
      applyJsonDraft()
      commandState.value = jsonState.value === 'fail' ? 'fail' : 'ok'
      return
    }
    if (cmd === 'fit') {
      fitToContent()
      commandState.value = 'ok'
      return
    }
    if (cmd === 'move') {
      const id = selectedItemId.value ?? selected.value?.id ?? null
      if (!id) throw new Error('no selection')
      const dx = Number(parts[1])
      const dy = Number(parts[2])
      if (!Number.isFinite(dx) || !Number.isFinite(dy)) throw new Error('invalid args')
      const it = findItemById(id)
      if (!it) throw new Error('not found')
      for (let i = 0; i < it.points.length; i++) {
        const p = it.points[i]
        it.points[i] = [p[0] + dx, p[1] + dy]
      }
      commandState.value = 'ok'
      return
    }
    if (cmd === 'scale') {
      const id = selectedItemId.value ?? selected.value?.id ?? null
      if (!id) throw new Error('no selection')
      const sx = Number(parts[1])
      const sy = parts.length >= 3 ? Number(parts[2]) : sx
      if (!Number.isFinite(sx) || !Number.isFinite(sy) || sx === 0 || sy === 0)
        throw new Error('invalid args')
      const it = findItemById(id)
      if (!it) throw new Error('not found')
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const [x, y] of it.points) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
      const cx = (minX + maxX) / 2
      const cy = (minY + maxY) / 2
      for (let i = 0; i < it.points.length; i++) {
        const p = it.points[i]
        it.points[i] = [cx + (p[0] - cx) * sx, cy + (p[1] - cy) * sy]
      }
      commandState.value = 'ok'
      return
    }
    if (cmd === 'rotate') {
      const id = selectedItemId.value ?? selected.value?.id ?? null
      if (!id) throw new Error('no selection')
      const deg = Number(parts[1])
      if (!Number.isFinite(deg)) throw new Error('invalid args')
      const it = findItemById(id)
      if (!it) throw new Error('not found')
      let minX = Infinity
      let minY = Infinity
      let maxX = -Infinity
      let maxY = -Infinity
      for (const [x, y] of it.points) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
      const cx = (minX + maxX) / 2
      const cy = (minY + maxY) / 2
      const rad = (deg * Math.PI) / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      for (let i = 0; i < it.points.length; i++) {
        const p = it.points[i]
        const dx = p[0] - cx
        const dy = p[1] - cy
        it.points[i] = [cx + dx * cos - dy * sin, cy + dy * cos + dx * sin]
      }
      commandState.value = 'ok'
      return
    }
    if (!cmd) return
    commandState.value = 'fail'
  } catch {
    commandState.value = 'fail'
  }
}

onMounted(() => {
  const el = svgEl.value
  if (el) {
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerCancel)
  }
  window.addEventListener('keydown', onKeyDown)

  windowErrorHandler = (ev: ErrorEvent) => {
    fatalError.value = String(ev.error?.stack || ev.message || ev.error || 'unknown error')
  }
  windowRejectionHandler = (ev: PromiseRejectionEvent) => {
    const r = ev.reason
    fatalError.value = String(r?.stack || r?.message || r || 'unhandled rejection')
  }
  window.addEventListener('error', windowErrorHandler)
  window.addEventListener('unhandledrejection', windowRejectionHandler)
})

onUnmounted(() => {
  const el = svgEl.value
  if (el) {
    el.removeEventListener('pointermove', onPointerMove)
    el.removeEventListener('pointerup', onPointerUp)
    el.removeEventListener('pointercancel', onPointerCancel)
  }
  window.removeEventListener('keydown', onKeyDown)
  if (windowErrorHandler) window.removeEventListener('error', windowErrorHandler)
  if (windowRejectionHandler)
    window.removeEventListener('unhandledrejection', windowRejectionHandler)
})
</script>

<template>
  <div class="layout">
    <div v-if="fatalError" class="fatal">
      <div class="fatal-title">运行时报错</div>
      <pre class="fatal-msg">{{ fatalError }}</pre>
    </div>
    <section class="left" :class="{ 'json-open': showJsonEditor }">
      <div class="viewport">
        <div class="hud">
          <span class="chip" v-if="parsing">解析中…</span>
          <span class="chip" v-else-if="parseMs !== null">解析 {{ parseMs }}ms</span>
          <span class="chip">折线 {{ counts.polylines }} / 点 {{ counts.points }}</span>
          <span class="chip" v-if="counts.polylines > 0"
            >按住 Alt/Ctrl/⌘ 拖动线：移动整条线（含单条线/折线）</span
          >
        </div>
        <svg
          ref="svgEl"
          :viewBox="viewBox"
          xmlns="http://www.w3.org/2000/svg"
          class="canvas"
          @pointerdown="onCanvasPointerDown"
          @wheel.prevent="onWheel"
        >
          <g>
            <g v-if="showGuides">
              <line
                :x1="viewCenter.x"
                :x2="viewCenter.x"
                :y1="-viewBounds.maxY"
                :y2="-viewBounds.minY"
                stroke="rgba(22, 119, 255, 0.45)"
                stroke-width="0.35"
                vector-effect="non-scaling-stroke"
              />
              <line
                :x1="viewBounds.minX"
                :x2="viewBounds.maxX"
                :y1="-viewCenter.y"
                :y2="-viewCenter.y"
                stroke="rgba(22, 119, 255, 0.45)"
                stroke-width="0.35"
                vector-effect="non-scaling-stroke"
              />
            </g>
            <polyline
              v-for="it in visiblePolylineItems"
              :key="it.id"
              :points="toSvgPoints(it.points, polylineStrokeStep)"
              fill="none"
              :stroke="effectiveLineStyle(it).color"
              :stroke-width="
                selectedItemId === it.id
                  ? effectiveLineStyle(it).width * 1.6
                  : effectiveLineStyle(it).width
              "
              :opacity="selectedItemId && selectedItemId !== it.id ? 0.35 : 1"
              :stroke-dasharray="
                layerDashArray(effectiveLineStyle(it).type, effectiveLineStyle(it).width) ??
                undefined
              "
              style="cursor: pointer"
              @pointerdown="onPolylinePointerDown(it.id, $event)"
              @click.stop="selectPolyline(it.id)"
              @dblclick="insertPointOnPolyline(it.id, $event)"
            />
            <g v-if="showMText">
              <text
                v-for="t in mtextRows"
                :key="'mtext-' + t.index"
                :x="t.x"
                :y="-t.y"
                :fill="
                  selectedEntityIndex === t.index ? '#1677ff' : ensureLayerStyle(t.layer).text.color
                "
                :font-family="ensureLayerStyle(t.layer).text.fontFamily"
                :font-size="ensureLayerStyle(t.layer).text.fontSize"
                :font-weight="ensureLayerStyle(t.layer).text.bold ? 700 : 400"
                :font-style="ensureLayerStyle(t.layer).text.italicAngle ? 'italic' : 'normal'"
                style="cursor: pointer; user-select: none"
                @click.stop="onMTextClick(t.index)"
              >
                <tspan
                  v-for="(line, i) in t.lines"
                  :key="i"
                  :x="t.x"
                  :dy="i === 0 ? 0 : 1.2 + 'em'"
                >
                  {{ line }}
                </tspan>
              </text>
            </g>
            <template v-for="it in visiblePolylineItems" :key="'pts-' + it.id">
              <template v-for="(p, j) in it.points" :key="j">
                <circle
                  v-if="shouldRenderPoint(it.id, j, it.points.length)"
                  :cx="p[0]"
                  :cy="-p[1]"
                  :r="
                    pointRadiusForLayer(it.layer, selected?.id === it.id && selected?.ptIndex === j)
                  "
                  :fill="selected?.id === it.id && selected?.ptIndex === j ? '#1677ff' : '#ff4d4f'"
                  :stroke="
                    selected?.id === it.id && selected?.ptIndex === j ? '#003a8c' : '#b30000'
                  "
                  stroke-width="0.25"
                  style="cursor: grab"
                  @pointerdown="onPointerDown(it.id, j, $event)"
                />
              </template>
            </template>
          </g>
        </svg>
      </div>

      <div class="command">
        <div class="row actions">
          <label class="btn fileBtn">
            导入 DXF
            <input class="fileInput" type="file" accept=".dxf" @change="onFileSelected" />
          </label>
          <button
            type="button"
            class="btn"
            :disabled="counts.polylines === 0"
            @click="fitToContent"
          >
            适配视图
          </button>
          <label class="select">
            点
            <select v-model="pointMode">
              <option value="all">全部</option>
              <option value="sampled">抽样</option>
              <option value="hidden">隐藏</option>
            </select>
          </label>
          <button
            type="button"
            class="btn"
            :disabled="counts.polylines === 0"
            @click="downloadJson"
          >
            导出 JSON
          </button>
          <button type="button" class="btn" :disabled="counts.polylines === 0" @click="downloadDxf">
            导出 DXF
          </button>
          <button type="button" class="btn" :disabled="counts.polylines === 0" @click="exportPdf">
            导出 PDF
          </button>
          <button type="button" class="btn" :disabled="counts.polylines === 0" @click="copyJson">
            复制 JSON
          </button>
          <button
            type="button"
            class="btn"
            :disabled="counts.polylines === 0"
            @click="showJsonEditor = !showJsonEditor"
          >
            JSON 面板
          </button>
          <button
            type="button"
            class="btn"
            :disabled="counts.polylines === 0"
            @click="refreshJsonDraft"
          >
            刷新 JSON
          </button>
          <button
            type="button"
            class="btn"
            :disabled="jsonDraft.trim().length === 0"
            @click="applyJsonDraft"
          >
            应用 JSON
          </button>
          <button type="button" class="btn" @click="clearAll">清空</button>
        </div>

        <div class="row status">
          <span v-if="copyState === 'ok'" class="status-chip ok">已复制</span>
          <span v-else-if="copyState === 'fail'" class="status-chip fail">复制失败</span>
          <span v-if="jsonState === 'ok'" class="status-chip ok">已应用</span>
          <span v-else-if="jsonState === 'fail'" class="status-chip fail">JSON 无效</span>
        </div>

        <div class="row">
          <span class="meta">
            文件 {{ fileName ?? '-' }} / 图层 {{ polylineLayerCounts.length }} / 实体
            {{ entities.length }} / 折线 {{ counts.polylines }} / 点 {{ counts.points }}
          </span>
          <span class="meta"
            >闭合折线 {{ polylineStats.closed }} / 方框(近似) {{ polylineStats.rectangle }}</span
          >
        </div>

        <div class="row bottom">
          <div v-if="selectedPoint" class="point-editor">
            <label>
              X
              <input
                type="number"
                :value="selectedPoint[0]"
                step="0.01"
                @input="setSelectedX(($event.target as HTMLInputElement).valueAsNumber)"
              />
            </label>
            <label>
              Y
              <input
                type="number"
                :value="selectedPoint[1]"
                step="0.01"
                @input="setSelectedY(($event.target as HTMLInputElement).valueAsNumber)"
              />
            </label>
            <button type="button" class="danger" @click="deleteSelectedPoint">删除点</button>
          </div>
          <div class="cmd">
            <input
              v-model="commandLine"
              class="cmd-input"
              placeholder="命令：clear | delete | copy | export | refresh-json | apply-json | fit | move dx dy | scale s | rotate deg"
              @keydown.enter.prevent="runCommand"
            />
            <button type="button" class="btn" @click="runCommand">执行</button>
            <span v-if="commandState === 'ok'" class="hint ok">OK</span>
            <span v-else-if="commandState === 'fail'" class="hint fail">未知命令</span>
          </div>
        </div>

        <textarea v-if="showJsonEditor" v-model="jsonDraft" class="json" spellcheck="false" />
      </div>
    </section>

    <aside class="right">
      <div class="panel">
        <div class="title">数据</div>

        <div class="block">
          <div class="block-head">
            <div class="block-title">视图</div>
            <div class="mini-actions">
              <button
                type="button"
                class="link"
                :disabled="counts.polylines === 0"
                @click="fitToContent"
              >
                适配
              </button>
            </div>
          </div>
          <div class="layer-form">
            <div class="layer-group">
              <div class="layer-group-title">中心坐标</div>
              <label class="layer-field">
                <span>X</span>
                <input
                  type="number"
                  :value="viewCenter.x"
                  step="0.01"
                  @input="setViewCenterX(($event.target as HTMLInputElement).valueAsNumber)"
                />
              </label>
              <label class="layer-field">
                <span>Y</span>
                <input
                  type="number"
                  :value="viewCenter.y"
                  step="0.01"
                  @input="setViewCenterY(($event.target as HTMLInputElement).valueAsNumber)"
                />
              </label>
            </div>
            <div class="layer-group">
              <div class="layer-group-title">区域大小</div>
              <label class="layer-field">
                <span>宽</span>
                <input
                  type="number"
                  :value="viewSize.w"
                  min="1"
                  step="1"
                  @input="setViewWidth(($event.target as HTMLInputElement).valueAsNumber)"
                />
              </label>
              <label class="layer-field">
                <span>高</span>
                <input
                  type="number"
                  :value="viewSize.h"
                  min="1"
                  step="1"
                  @input="setViewHeight(($event.target as HTMLInputElement).valueAsNumber)"
                />
              </label>
              <label class="layer-field">
                <span>辅助线</span>
                <label class="layer-switch">
                  <input type="checkbox" v-model="showGuides" />
                  <span class="layer-switch-text">{{ showGuides ? '显示' : '隐藏' }}</span>
                </label>
              </label>
              <label class="layer-field">
                <span>文字</span>
                <label class="layer-switch">
                  <input type="checkbox" v-model="showMText" />
                  <span class="layer-switch-text">{{ showMText ? '显示' : '隐藏' }}</span>
                </label>
              </label>
            </div>
            <div class="layer-group">
              <div class="layer-group-title">操作</div>
              <div class="hint">
                Shift+拖拽平移 / 滚轮缩放 / 双击折线插点 / Alt(Ctrl/⌘)+拖线移动整条线
              </div>
            </div>
            <div class="layer-group">
              <div class="layer-group-title">点编辑</div>
              <template v-if="selectedPoint && selectedPointMeta">
                <div class="hint">
                  当前：{{ selectedPointMeta.layer }} / {{ selectedPointMeta.ptIndex + 1 }} /
                  {{ selectedPointMeta.total }}
                </div>
                <label class="layer-field">
                  <span>步长</span>
                  <input type="number" v-model.number="pointNudgeStep" min="0" step="0.1" />
                </label>
                <div class="mini-actions">
                  <button type="button" class="btn" @click="nudgeSelectedPoint(-1, 0)">←</button>
                  <button type="button" class="btn" @click="nudgeSelectedPoint(0, 1)">↑</button>
                  <button type="button" class="btn" @click="nudgeSelectedPoint(0, -1)">↓</button>
                  <button type="button" class="btn" @click="nudgeSelectedPoint(1, 0)">→</button>
                </div>
                <div class="mini-actions">
                  <button type="button" class="btn" @click="copySelectedPoint">复制坐标</button>
                  <button type="button" class="btn" @click="insertPointAroundSelected('before')">
                    前插点
                  </button>
                  <button type="button" class="btn" @click="insertPointAroundSelected('after')">
                    后插点
                  </button>
                  <button type="button" class="danger" @click="deleteSelectedPoint">删除点</button>
                </div>
                <div class="row status">
                  <span v-if="pointCopyState === 'ok'" class="status-chip ok">已复制</span>
                  <span v-else-if="pointCopyState === 'fail'" class="status-chip fail"
                    >复制失败</span
                  >
                </div>
                <div class="hint">拖拽点 / Delete 删除 / 方向键微调（Shift×10）</div>
              </template>
              <div v-else class="hint">点击红点选中后可编辑：微调/插点/删除</div>
            </div>
          </div>
        </div>
        <div class="block">
          <div class="block-head">
            <div class="block-title">图层(折线)</div>
            <div class="mini-actions">
              <button
                type="button"
                class="link"
                :disabled="polylineLayerCounts.length === 0"
                @click="selectAllLayers"
              >
                全选
              </button>
              <button
                type="button"
                class="link"
                :disabled="selectedLayers.length === 0"
                @click="clearLayerFilter"
              >
                全不选
              </button>
            </div>
          </div>
          <ul class="list">
            <li v-for="row in layerRows" :key="row.layer" class="item layer-row">
              <div class="layer-top">
                <label class="layer-item">
                  <input
                    type="checkbox"
                    :checked="layerFilterSet.has(row.layer)"
                    @change="
                      setLayerVisible(row.layer, ($event.target as HTMLInputElement).checked)
                    "
                  />
                  <span class="k">{{ row.layer }}</span>
                </label>
                <span class="status-chip" :class="layerFilterSet.has(row.layer) ? 'ok' : 'fail'">
                  {{ layerFilterSet.has(row.layer) ? '可视' : '隐藏' }}
                </span>
                <span class="v">{{ row.n }}</span>
              </div>
              <details class="layer-details">
                <summary>配置</summary>
                <div class="layer-form">
                  <div class="layer-group">
                    <div class="layer-group-title">状态</div>
                    <label class="layer-field">
                      <span>可见</span>
                      <label class="layer-switch">
                        <input
                          type="checkbox"
                          :checked="layerFilterSet.has(row.layer)"
                          @change="
                            setLayerVisible(row.layer, ($event.target as HTMLInputElement).checked)
                          "
                        />
                        <span class="layer-switch-text">{{
                          layerFilterSet.has(row.layer) ? '可视' : '隐藏'
                        }}</span>
                      </label>
                    </label>
                  </div>

                  <div class="layer-group">
                    <div class="layer-group-title">默认线</div>
                    <label class="layer-field">
                      <span>线型</span>
                      <select v-model="row.style.line.type">
                        <option value="solid">实线</option>
                        <option value="dash">虚线</option>
                        <option value="dot">点线</option>
                        <option value="dashdot">点划线</option>
                      </select>
                    </label>
                    <label class="layer-field">
                      <span>颜色</span>
                      <input v-model="row.style.line.color" type="color" />
                    </label>
                    <label class="layer-field">
                      <span>线宽</span>
                      <input
                        v-model.number="row.style.line.width"
                        type="number"
                        min="0.1"
                        step="0.1"
                      />
                    </label>
                    <label class="layer-field">
                      <span>点大小</span>
                      <input
                        v-model.number="row.style.point.size"
                        type="number"
                        min="0.1"
                        step="0.1"
                      />
                    </label>
                  </div>

                  <div class="layer-group">
                    <div class="layer-group-title">默认文字</div>
                    <label class="layer-field">
                      <span>字体</span>
                      <input v-model="row.style.text.fontFamily" type="text" />
                    </label>
                    <label class="layer-field">
                      <span>倾斜角</span>
                      <input v-model.number="row.style.text.italicAngle" type="number" step="1" />
                    </label>
                    <label class="layer-field">
                      <span>加粗</span>
                      <input v-model="row.style.text.bold" type="checkbox" />
                    </label>
                    <label class="layer-field">
                      <span>字号</span>
                      <input
                        v-model.number="row.style.text.fontSize"
                        type="number"
                        min="1"
                        step="1"
                      />
                    </label>
                    <label class="layer-field">
                      <span>宽度因子</span>
                      <input
                        v-model.number="row.style.text.widthFactor"
                        type="number"
                        min="0.1"
                        step="0.1"
                      />
                    </label>
                    <label class="layer-field">
                      <span>颜色</span>
                      <input v-model="row.style.text.color" type="color" />
                    </label>
                  </div>

                  <div class="layer-group">
                    <div class="layer-group-title">默认标注</div>
                    <label class="layer-field">
                      <span>标注比例</span>
                      <input
                        v-model.number="row.style.dim.scale"
                        type="number"
                        min="0.01"
                        step="0.01"
                      />
                    </label>
                    <label class="layer-field">
                      <span>文字大小</span>
                      <input
                        v-model.number="row.style.dim.textSize"
                        type="number"
                        min="1"
                        step="1"
                      />
                    </label>
                    <label class="layer-field">
                      <span>箭头大小</span>
                      <input
                        v-model.number="row.style.dim.arrowSize"
                        type="number"
                        min="0.1"
                        step="0.1"
                      />
                    </label>
                    <label class="layer-field">
                      <span>尺寸线间距</span>
                      <input
                        v-model.number="row.style.dim.lineGap"
                        type="number"
                        min="0"
                        step="0.5"
                      />
                    </label>
                  </div>
                </div>
              </details>
            </li>
            <li v-if="polylineLayerCounts.length === 0" class="empty">暂无</li>
          </ul>
        </div>

        <div class="block">
          <div class="block-title">实体类型</div>
          <ul class="list">
            <li v-for="[t, n] in entityTypeCounts" :key="t" class="item">
              <span class="k">{{ t }}</span>
              <span class="v">{{ n }}</span>
            </li>
            <li v-if="entityTypeCounts.length === 0" class="empty">暂无</li>
          </ul>
        </div>

        <div class="block">
          <div class="block-head">
            <div class="block-title">实体列表</div>
            <div class="mini-actions">
              <button
                type="button"
                class="link"
                :disabled="selectedEntityIndex === null"
                @click="selectedEntityIndex = null"
              >
                取消选中
              </button>
            </div>
          </div>
          <ul class="list entity-list">
            <li
              v-for="row in entityRows"
              :key="row.index"
              class="item entity-row"
              :class="selectedEntityIndex === row.index ? 'selected' : ''"
              @click="onEntityRowClick(row)"
            >
              <span class="k">
                {{ row.index }} · {{ row.type }} · {{ row.layer }}
                <span v-if="row.handle" class="muted">#{{ row.handle }}</span>
              </span>
              <span class="v">
                <span class="status-chip mini" :class="row.visible ? 'ok' : 'fail'">{{
                  row.visible ? '可视' : '隐藏'
                }}</span>
                <span v-if="row.polylineId" class="muted">可绘制</span>
              </span>
            </li>
            <li v-if="entityRows.length === 0" class="empty">暂无</li>
          </ul>
        </div>

        <div class="block">
          <div class="block-head">
            <div class="block-title">实体详情</div>
            <div class="mini-actions">
              <button
                v-if="selectedEntityInfo"
                type="button"
                class="link"
                @click="toggleSelectedEntityVisible"
              >
                {{ selectedEntityInfo.visible ? '隐藏' : '显示' }}
              </button>
              <button
                v-if="selectedEntityInfo?.polylineId"
                type="button"
                class="link"
                @click="focusPolyline(selectedEntityInfo.polylineId)"
              >
                定位
              </button>
            </div>
          </div>
          <div v-if="selectedEntityInfo" class="entity-detail">
            <pre class="pre">{{ JSON.stringify(selectedEntityInfo, null, 2) }}</pre>
          </div>
          <div v-else class="empty">未选中</div>
        </div>

        <div class="block">
          <div class="block-title">几何(折线)</div>
          <ul class="list">
            <li class="item">
              <span class="k">折线</span>
              <span class="v">{{ counts.polylines }}</span>
            </li>
            <li class="item">
              <span class="k">点</span>
              <span class="v">{{ counts.points }}</span>
            </li>
            <li class="item">
              <span class="k">闭合</span>
              <span class="v">{{ polylineStats.closed }}</span>
            </li>
            <li class="item">
              <span class="k">方框(近似)</span>
              <span class="v">{{ polylineStats.rectangle }}</span>
            </li>
          </ul>
        </div>
      </div>
    </aside>
  </div>
</template>

<style scoped>
.layout {
  width: 100%;
  height: 100vh;
  height: 100dvh;
  display: grid;
  grid-template-rows: 1fr;
  grid-template-columns: 1fr minmax(260px, 20vw);
  background: var(--color-background);
}
.fatal {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.85);
  color: #fff;
  padding: 16px;
  overflow: auto;
}
.fatal-title {
  font-weight: 700;
  margin-bottom: 8px;
}
.fatal-msg {
  white-space: pre-wrap;
  word-break: break-word;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
  line-height: 1.4;
  opacity: 0.95;
}
.left {
  min-width: 0;
  height: 100%;
  --command-h: clamp(200px, 34vh, 440px);
  position: relative;
  overflow: hidden;
}
.left.json-open {
  --command-h: clamp(320px, 55vh, 720px);
}
.right {
  min-width: 260px;
  height: 100%;
  border-left: 1px solid var(--color-border);
  background: var(--color-background-soft);
  overflow: auto;
}
.panel {
  padding: 0.75rem;
}
.title {
  font-weight: 600;
  margin-bottom: 0.75rem;
  position: sticky;
  top: 0;
  padding: 0.5rem 0;
  background: var(--color-background-soft);
  z-index: 1;
}
.block {
  margin-bottom: 1rem;
}
.block-title {
  font-weight: 600;
  opacity: 0.85;
  margin-bottom: 0.25rem;
}
.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 0.25rem;
}
.mini-actions {
  display: inline-flex;
  gap: 0.35rem;
  align-items: center;
}
.link {
  padding: 0;
  border: 0;
  background: transparent;
  color: #1677ff;
  cursor: pointer;
  font-weight: 600;
  font-size: 12px;
  line-height: 1;
}
.link:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.list {
  list-style: none;
  padding: 0;
  margin: 0;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  max-height: 28vh;
  overflow: auto;
}
.item {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.4rem 0.6rem;
  border-bottom: 1px solid var(--color-border);
}
.layer-row {
  display: block;
}
.layer-top {
  display: flex;
  justify-content: space-between;
  gap: 0.5rem;
  align-items: center;
}
.layer-item {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}
.layer-details {
  margin-top: 0.35rem;
  border-top: 1px dashed var(--color-border);
  padding-top: 0.35rem;
}
.layer-details > summary {
  cursor: pointer;
  user-select: none;
  font-size: 12px;
  opacity: 0.8;
}
.layer-form {
  margin-top: 0.35rem;
  display: grid;
  gap: 0.5rem;
}
.layer-group {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  padding: 0.45rem;
  background: var(--color-background);
}
.layer-group-title {
  font-weight: 600;
  font-size: 12px;
  opacity: 0.9;
  margin-bottom: 0.35rem;
}
.layer-field {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 0.35rem;
  align-items: center;
  margin: 0.25rem 0;
  font-size: 12px;
  opacity: 0.9;
}
.layer-field input[type='text'],
.layer-field input[type='number'],
.layer-field select {
  height: 28px;
  padding: 0 0.4rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-background);
  color: var(--color-text);
}
.layer-field input[type='color'] {
  height: 28px;
  width: 100%;
  padding: 0;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-background);
}
.layer-field input[type='checkbox'] {
  width: 16px;
  height: 16px;
}
.layer-switch {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
}
.layer-switch-text {
  font-size: 12px;
  opacity: 0.9;
}
.item:last-child {
  border-bottom: 0;
}
.k {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.v {
  opacity: 0.75;
  flex: 0 0 auto;
}
.empty {
  padding: 0.5rem 0.6rem;
  opacity: 0.6;
}

.entity-list {
  max-height: 22vh;
}

.entity-row {
  cursor: pointer;
}

.entity-row.selected {
  background: rgba(22, 119, 255, 0.1);
}

.muted {
  opacity: 0.6;
  margin-left: 0.35rem;
}

.status-chip.mini {
  padding: 0.1rem 0.35rem;
  font-size: 11px;
}

.entity-detail {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background);
  overflow: hidden;
}

.pre {
  margin: 0;
  padding: 0.5rem;
  max-height: 22vh;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 11px;
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-word;
}

.point-editor {
  display: flex;
  gap: 0.35rem;
  align-items: center;
  flex-wrap: wrap;
  padding: 0.25rem 0.35rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background-soft);
}
.point-editor label {
  display: flex;
  gap: 0.25rem;
  align-items: center;
  font-size: 12px;
  opacity: 0.85;
}
.point-editor input {
  width: 6.5rem;
  height: 28px;
  padding: 0 0.4rem;
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background: var(--color-background);
  color: var(--color-text);
}
.point-editor input:focus {
  outline: none;
  border-color: var(--color-border-hover);
}
.btn {
  height: 28px;
  padding: 0 0.55rem;
  border: 1px solid rgba(22, 119, 255, 0.45);
  border-radius: 6px;
  background: rgba(22, 119, 255, 0.12);
  color: #1677ff;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  user-select: none;
}
.btn:hover:not(:disabled) {
  border-color: rgba(22, 119, 255, 0.75);
  background: rgba(22, 119, 255, 0.18);
}
.btn:active:not(:disabled) {
  transform: translateY(0.5px);
}
.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.meta {
  opacity: 0.7;
}
.hint {
  font-size: 0.9rem;
}
.ok {
  color: #389e0d;
}
.fail {
  color: #ff4d4f;
}
.danger {
  height: 28px;
  padding: 0 0.55rem;
  border: 1px solid rgba(255, 77, 79, 0.55);
  background: rgba(255, 77, 79, 0.1);
  color: #ff4d4f;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  font-size: 13px;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.danger:hover:not(:disabled) {
  border-color: rgba(255, 77, 79, 0.85);
  background: rgba(255, 77, 79, 0.16);
}
.viewport {
  min-height: 0;
  border-bottom: 1px solid var(--color-border);
  background: var(--color-background-soft);
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: var(--command-h);
  overflow: hidden;
}
.canvas {
  width: 100%;
  height: 100%;
}
.hud {
  position: absolute;
  left: 10px;
  top: 10px;
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  pointer-events: none;
}
.chip {
  pointer-events: none;
  padding: 0.2rem 0.45rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: rgba(255, 255, 255, 0.85);
  color: #1f1f1f;
  font-size: 12px;
  line-height: 1;
}
.select {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  border: 1px solid rgba(22, 119, 255, 0.45);
  border-radius: 6px;
  height: 28px;
  padding: 0 0.45rem;
  background: rgba(22, 119, 255, 0.08);
  color: var(--color-text);
  font-weight: 600;
  font-size: 13px;
}
.select select {
  border: 0;
  outline: none;
  background: transparent;
  color: #1677ff;
  font-weight: 700;
}
.command {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.6rem;
  background: var(--color-background);
  border-top: 1px solid var(--color-border);
  overflow: hidden;
  min-height: 0;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: var(--command-h);
}
.row {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}
.row.actions {
  gap: 0.35rem;
  flex-wrap: nowrap;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 2px;
}
.row.status {
  min-height: 22px;
  gap: 0.35rem;
}
.row.bottom {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 0.5rem;
  align-items: center;
}
.status-chip {
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  border: 1px solid var(--color-border);
  background: var(--color-background-soft);
  font-size: 12px;
  line-height: 1;
}
.status-chip.ok {
  border-color: rgba(56, 158, 13, 0.35);
  background: rgba(56, 158, 13, 0.12);
}
.status-chip.fail {
  border-color: rgba(255, 77, 79, 0.35);
  background: rgba(255, 77, 79, 0.12);
}
.row.actions::-webkit-scrollbar {
  height: 0;
}
.row.actions {
  scrollbar-width: none;
}
.fileBtn {
  position: relative;
  flex: 0 0 auto;
  white-space: nowrap;
  overflow: hidden;
}
.fileInput {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.cmd {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex: 1;
  min-width: 0;
}
.cmd-input {
  flex: 1;
  min-width: 120px;
  height: 28px;
  padding: 0 0.5rem;
  border: 1px solid rgba(22, 119, 255, 0.25);
  border-radius: 6px;
  background: rgba(22, 119, 255, 0.06);
  color: var(--color-text);
  font-size: 13px;
}
.cmd-input:focus {
  outline: none;
  border-color: rgba(22, 119, 255, 0.6);
}
.json {
  flex: 0 0 auto;
  height: 140px;
  width: 100%;
  resize: none;
  padding: 0.5rem;
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: var(--color-background-soft);
  color: var(--color-text);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
  line-height: 1.4;
}
.left.json-open .json {
  height: clamp(180px, 26vh, 320px);
}

@media (max-width: 960px) {
  .layout {
    grid-template-columns: 1fr;
    grid-template-rows: 1fr minmax(180px, 28vh);
  }
  .right {
    min-width: 0;
    border-left: 0;
    border-top: 1px solid var(--color-border);
    height: auto;
  }
  .left {
    --command-h: clamp(220px, 38vh, 520px);
  }
  .left.json-open {
    --command-h: clamp(360px, 62vh, 820px);
  }
  .list {
    max-height: 22vh;
  }
}
</style>
