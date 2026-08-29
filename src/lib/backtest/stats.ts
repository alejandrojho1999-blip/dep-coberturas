/**
 * Fase 4 — Métricas y contrastes estadísticos.
 *
 * Reutiliza `maxDrawdown`, `media` y `desviacion` de
 * `src/lib/portafolios/metrics.ts`. Lo que se añade aquí es lo que esas
 * funciones no cubren: frecuencia mensual, errores estándar robustos a
 * autocorrelación, y las correcciones que impiden confundir suerte con alfa.
 */
import { media, desviacion, maxDrawdown } from '@/lib/portafolios/metrics'
import type { PuntoCurva } from '@/lib/backtest/types'

export const PERIODOS_POR_ANIO = 12

/**
 * Por debajo de esta desviación típica la serie se considera constante. Sin el
 * umbral, el error de redondeo en coma flotante actúa de denominador y produce
 * Sharpes de varios billones en una curva perfectamente plana.
 */
const SIGMA_MINIMA = 1e-12

// ── Aleatoriedad reproducible ───────────────────────────────────────────────

/** mulberry32: PRNG determinista de 32 bits. Misma semilla, mismo resultado. */
export function crearRng(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6D2B79F5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ── Métricas de curva a frecuencia arbitraria ───────────────────────────────

export interface MetricasCurva {
  nPeriodos: number
  retornoTotal: number
  cagr: number | null
  volatilidadAnual: number | null
  sharpe: number | null
  maxDrawdown: number
}

export function metricasCurva(
  curva: PuntoCurva[],
  retornos: number[],
  rfAnual: number,
  periodos = PERIODOS_POR_ANIO,
): MetricasCurva {
  const sigma = desviacion(retornos)
  const rfPeriodo = rfAnual / periodos
  const exceso = retornos.map(r => r - rfPeriodo)
  const sigmaExceso = desviacion(exceso)

  const inicio = curva[0]?.valor ?? 1
  const fin = curva[curva.length - 1]?.valor ?? 1
  const anios = retornos.length / periodos

  return {
    nPeriodos: retornos.length,
    retornoTotal: fin / inicio - 1,
    cagr: anios > 0 && inicio > 0 ? (fin / inicio) ** (1 / anios) - 1 : null,
    volatilidadAnual: sigma != null ? sigma * Math.sqrt(periodos) : null,
    sharpe: sigmaExceso != null && sigmaExceso > SIGMA_MINIMA
      ? (media(exceso) / sigmaExceso) * Math.sqrt(periodos)
      : null,
    maxDrawdown: maxDrawdown(curva.map(p => ({ date: p.fecha, valor: p.valor }))) / 100,
  }
}

// ── Contraste de la media con errores estándar robustos ─────────────────────

/**
 * Varianza de la media con corrección Newey-West: los retornos de una cartera
 * con rotación baja están autocorrelados, y un t-stat OLS los sobrevalora.
 */
export function neweyWestSE(xs: number[], lag = 3): number | null {
  const n = xs.length
  if (n < 3) return null
  const m = media(xs)
  const d = xs.map(x => x - m)

  let s = d.reduce((a, x) => a + x * x, 0) / n
  for (let l = 1; l <= Math.min(lag, n - 1); l++) {
    let cov = 0
    for (let t = l; t < n; t++) cov += d[t] * d[t - l]
    cov /= n
    s += 2 * (1 - l / (lag + 1)) * cov
  }
  return s > 0 ? Math.sqrt(s / n) : null
}

export interface ContrasteMedia {
  media: number
  se: number | null
  tStat: number | null
  /** p-valor bilateral por aproximación normal. */
  pValor: number | null
}

export function contrastarMedia(xs: number[], lag = 3): ContrasteMedia {
  const m = media(xs)
  const se = neweyWestSE(xs, lag)
  const t = se != null && se > 0 ? m / se : null
  return { media: m, se, tStat: t, pValor: t != null ? 2 * (1 - cdfNormal(Math.abs(t))) : null }
}

/** Φ(x) por la aproximación de Abramowitz-Stegun 26.2.17. */
export function cdfNormal(x: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989422804014327 * Math.exp(-x * x / 2)
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  return x >= 0 ? 1 - p : p
}

// ── Cartera contra benchmark ────────────────────────────────────────────────

export interface ComparacionBenchmark {
  retornoActivoMedio: number
  trackingError: number | null
  informationRatio: number | null
  beta: number | null
  alphaAnual: number | null
  contraste: ContrasteMedia
}

export function compararConBenchmark(
  retornos: number[],
  retornosBench: number[],
  periodos = PERIODOS_POR_ANIO,
): ComparacionBenchmark {
  const n = Math.min(retornos.length, retornosBench.length)
  const activos = Array.from({ length: n }, (_, i) => retornos[i] - retornosBench[i])
  const sigmaActivo = desviacion(activos)

  const mb = media(retornosBench.slice(0, n))
  const mp = media(retornos.slice(0, n))
  let cov = 0, varb = 0
  for (let i = 0; i < n; i++) {
    cov += (retornosBench[i] - mb) * (retornos[i] - mp)
    varb += (retornosBench[i] - mb) ** 2
  }
  const beta = varb > 0 ? cov / varb : null

  return {
    retornoActivoMedio: media(activos),
    trackingError: sigmaActivo != null ? sigmaActivo * Math.sqrt(periodos) : null,
    informationRatio: sigmaActivo != null && sigmaActivo > SIGMA_MINIMA
      ? (media(activos) / sigmaActivo) * Math.sqrt(periodos)
      : null,
    beta,
    alphaAnual: beta != null ? (mp - beta * mb) * periodos : null,
    contraste: contrastarMedia(activos),
  }
}

// ── Bootstrap de bloques ────────────────────────────────────────────────────

/**
 * p-valor de "la media es ≤ 0" remuestreando bloques contiguos, que preservan
 * la autocorrelación. Se centra la serie para simular la hipótesis nula.
 */
export function bootstrapBloques(
  xs: number[],
  rng: () => number,
  replicas: number,
  tamBloque = 3,
): { pValor: number; mediaObservada: number } {
  const m = media(xs)
  const centrado = xs.map(x => x - m)
  const n = xs.length
  if (n < tamBloque + 1) return { pValor: 1, mediaObservada: m }

  let masExtremos = 0
  for (let r = 0; r < replicas; r++) {
    let suma = 0
    for (let i = 0; i < n; i += tamBloque) {
      const inicio = Math.floor(rng() * (n - tamBloque))
      for (let j = 0; j < tamBloque && i + j < n; j++) suma += centrado[inicio + j]
    }
    if (suma / n >= m) masExtremos++
  }
  return { pValor: (masExtremos + 1) / (replicas + 1), mediaObservada: m }
}

// ── Deflated Sharpe Ratio ───────────────────────────────────────────────────

/**
 * Sharpe deflactado (Bailey & López de Prado, 2014).
 *
 * Probar N configuraciones y quedarse con la mejor infla el Sharpe aunque no
 * haya señal. Esto corrige por ese número de pruebas, por la asimetría y por
 * las colas de la distribución de retornos. Devuelve la probabilidad de que el
 * Sharpe verdadero sea > 0.
 */
export function deflatedSharpe(
  retornos: number[],
  sharpeObservado: number,
  nPruebas: number,
  periodos = PERIODOS_POR_ANIO,
  /** Varianza (por periodo) de los Sharpe estimados entre configuraciones. */
  varSharpeEntrePruebas: number | null = null,
): { sharpeEsperadoPorAzar: number; probabilidad: number } | null {
  const n = retornos.length
  if (n < 4 || nPruebas < 1) return null

  const m = media(retornos)
  const s = desviacion(retornos)
  if (s == null || s === 0) return null

  const g1 = retornos.reduce((a, x) => a + ((x - m) / s) ** 3, 0) / n
  const g2 = retornos.reduce((a, x) => a + ((x - m) / s) ** 4, 0) / n

  // Sharpe (por periodo) máximo esperado al probar `nPruebas` estrategias sin
  // señal. El factor de escala es la desviación típica del Sharpe estimado
  // entre pruebas; sin las series de todas ellas se usa su valor bajo la
  // hipótesis nula, sqrt(1/(n-1)).
  const gamma = 0.5772156649015329
  const e = Math.E
  const z1 = cdfNormalInv(1 - 1 / nPruebas)
  const z2 = cdfNormalInv(1 - 1 / (nPruebas * e))
  const sdSharpeEntrePruebas = varSharpeEntrePruebas != null
    ? Math.sqrt(varSharpeEntrePruebas)
    : Math.sqrt(1 / (n - 1))
  const sr0 = sdSharpeEntrePruebas * ((1 - gamma) * z1 + gamma * z2)

  const srPeriodo = sharpeObservado / Math.sqrt(periodos)
  const denom = Math.sqrt(1 - g1 * srPeriodo + ((g2 - 1) / 4) * srPeriodo ** 2)
  if (!Number.isFinite(denom) || denom <= 0) return null

  const z = ((srPeriodo - sr0) * Math.sqrt(n - 1)) / denom
  return {
    sharpeEsperadoPorAzar: sr0 * Math.sqrt(periodos),
    probabilidad: cdfNormal(z),
  }
}

/** Φ⁻¹(p) por la aproximación racional de Acklam. */
export function cdfNormalInv(p: number): number {
  if (p <= 0 || p >= 1) return p <= 0 ? -Infinity : Infinity
  const a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02, 1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00]
  const b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02, 6.680131188771972e+01, -1.328068155288572e+01]
  const c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00, -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00]
  const d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00, 3.754408661907416e+00]
  const pl = 0.02425

  if (p < pl) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  if (p > 1 - pl) return -cdfNormalInv(1 - p)

  const q = p - 0.5, r = q * q
  return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
         (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
}

/** Percentil (0-100) de `valor` dentro de `muestra`. */
export function percentil(muestra: number[], valor: number): number {
  if (!muestra.length) return NaN
  const menores = muestra.filter(x => x < valor).length
  return (menores / muestra.length) * 100
}
