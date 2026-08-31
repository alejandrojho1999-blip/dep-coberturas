import { describe, expect, it } from 'vitest'
import {
  horaEcuador,
  horaTexto,
  lineaNivel,
  lineaProbabilidad,
  mensajeAvisoPrevio,
  mensajeDecision,
  mensajeGuerra,
  mensajeSnapshot,
  num,
  pct,
  type NivelConSimbolo,
} from '@/lib/alertas/mensajes'
import { buscarSimbolo } from '@/lib/alertas/simbolos'
import { EVENTOS } from '@/lib/alertas/calendario'
import type { ProbabilidadTasas } from '@/lib/alertas/fedwatch'

const oro = buscarSimbolo('GC=F')!
const nasdaq = buscarSimbolo('NQ=F')!

const nivelOro: NivelConSimbolo = {
  simbolo: oro,
  nivel: { direccion: 'buy', precio: 3412.5, nivel: 3427.5, atr: 30, k: 0.5, distanciaPct: 0.4395 },
}

const nivelNq: NivelConSimbolo = {
  simbolo: nasdaq,
  nivel: { direccion: 'sell', precio: 20000, nivel: 19900, atr: 200, k: 0.5, distanciaPct: 0.5 },
}

const prob: ProbabilidadTasas = {
  reunion: '2026-09-16',
  etiqueta: 'FOMC septiembre 2026 (con proyecciones)',
  contrato: 'ZQU26.CBT',
  precioContrato: 96.295,
  tasaActual: 3.8,
  tasaMediaImplicita: 3.705,
  tasaImplicitaPost: 3.9,
  probSubida: 40,
  probMantener: 60,
  probBajada: 0,
  aproximado: false,
  nota: 'x',
}

describe('formateo', () => {
  it('num usa el formato español', () => {
    expect(num(20134.25, 2)).toBe('20.134,25')
    expect(num(72140, 0)).toBe('72.140')
  })

  it('pct antepone el signo y tolera nulos', () => {
    expect(pct(4.2)).toBe('+4,2%')
    expect(pct(-1)).toBe('-1,0%')
    expect(pct(null)).toBe('—')
  })

  it('horaEcuador convierte a la hora local', () => {
    // 18:00 UTC son las 13:00 en Guayaquil (UTC-5 todo el año).
    expect(horaEcuador('2026-09-16T18:00:00Z')).toBe('13:00 ECT')
    expect(horaEcuador(null)).toBe('hora desconocida')
    expect(horaEcuador('ayer')).toBe('hora desconocida')
  })

  it('horaTexto rellena con ceros', () => {
    expect(horaTexto(8 * 60 + 30)).toBe('08:30')
    expect(horaTexto(14 * 60)).toBe('14:00')
  })
})

describe('lineaNivel', () => {
  it('describe un buy stop por encima del precio', () => {
    const l = lineaNivel(nivelOro)
    expect(l).toContain('ORO (GC=F)')
    // El español no agrupa los millares en números de cuatro cifras.
    expect(l).toContain('buy stop 3427,50')
    expect(l).toContain('ATR14')
  })

  it('describe un sell stop por debajo del precio', () => {
    expect(lineaNivel(nivelNq)).toContain('sell stop 19.900,00')
  })
})

describe('mensajeGuerra', () => {
  const titular = {
    titulo: 'Polonia derriba un dron ruso',
    url: 'https://ejemplo.com/n1',
    fuente: 'Reuters',
    publicadoAt: '2026-08-31T18:32:00Z',
  }
  const clasificacion = {
    relevante: true, tipo: 'guerra' as const, severidad: 4,
    eventoKey: 'dron-polonia', resumen: 'Un dron ruso fue derribado sobre Polonia.', motivo: 'refugio al alza',
  }

  it('incluye titular, enlace y niveles', () => {
    const m = mensajeGuerra({ titular, clasificacion, niveles: [nivelOro], mercadoAbierto: true })
    expect(m).toContain('severidad 4/5')
    expect(m).toContain('https://ejemplo.com/n1')
    expect(m).toContain('buy stop 3427,50')
    expect(m).toContain('sesión regular abierta')
  })

  it('avisa cuando no hay ningún nivel', () => {
    const m = mensajeGuerra({ titular, clasificacion, niveles: [], mercadoAbierto: false })
    expect(m).toContain('Sin niveles')
    expect(m).toContain('fuera de sesión regular')
  })

  it('lista los activos que se quedaron sin nivel', () => {
    const m = mensajeGuerra({ titular, clasificacion, niveles: [nivelOro], mercadoAbierto: true, faltantes: ['SI=F'] })
    expect(m).toContain('Sin nivel: SI=F')
  })
})

describe('mensajes macro', () => {
  it('la línea de probabilidad suma los tres escenarios', () => {
    const l = lineaProbabilidad(prob)
    expect(l).toContain('subir 40,0%')
    expect(l).toContain('mantener 60,0%')
    expect(l).toContain('bajar 0,0%')
  })

  it('el snapshot incluye el contrato y las métricas', () => {
    const m = mensajeSnapshot({
      probabilidad: prob,
      metricas: [{ clave: 'm2', etiqueta: 'M2', valor: 22000, unidad: 'miles de millones USD', var12mPct: 4.2, fecha: '2026-07-01' }],
      proximaReunionFaltaMin: 1500,
    })
    expect(m).toContain('ZQU26.CBT')
    expect(m).toContain('M2')
    expect(m).toContain('+4,2%')
    expect(m).toContain('1 d 1 h')
  })

  it('el aviso previo enuncia los dos escenarios', () => {
    const evento = EVENTOS.find((e) => e.fechaET === '2026-09-16')!
    const m = mensajeAvisoPrevio({ evento, faltanMin: 60, probabilidad: prob })
    expect(m).toContain('DECISIÓN DE TASAS EEUU en 1 h 0 min')
    expect(m).toContain('sell stop')
    expect(m).toContain('activos de riesgo')
  })

  it('el mensaje de publicación trae los dos juegos de niveles', () => {
    const evento = EVENTOS.find((e) => e.fechaET === '2026-09-16')!
    const m = mensajeDecision({
      evento,
      nivelesVenta: [nivelNq],
      nivelesCompra: [{ ...nivelNq, nivel: { ...nivelNq.nivel, direccion: 'buy', nivel: 20100 } }],
      probabilidad: prob,
    })
    expect(m).toContain('SI SUBEN TASAS')
    expect(m).toContain('SI MANTIENEN O BAJAN')
    expect(m).toContain('Comunicado aún no localizado')
  })
})
