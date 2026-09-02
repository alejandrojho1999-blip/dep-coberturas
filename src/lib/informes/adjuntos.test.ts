import { describe, expect, it } from 'vitest'
import {
  MINIMO_POR_ARCHIVO,
  PRESUPUESTO_TOTAL,
  construirContextoAdjuntos,
  repartirPresupuesto,
  resumirFuentes,
} from './adjuntos'

const adjunto = (filename: string, chars: number, doc_type = 'excel') => ({
  filename,
  doc_type,
  texto_extraido: 'x'.repeat(chars),
})

describe('repartirPresupuesto', () => {
  it('sin archivos no reparte nada', () => {
    expect(repartirPresupuesto([])).toEqual([])
  })

  it('un archivo que cabe entero se lleva solo lo que ocupa', () => {
    expect(repartirPresupuesto([500], 16_000)).toEqual([500])
  })

  it('nunca reparte más de lo que hay', () => {
    const cuotas = repartirPresupuesto([50_000, 50_000, 50_000], 16_000)
    expect(cuotas.reduce((a, b) => a + b, 0)).toBeLessThanOrEqual(16_000)
  })

  it('lo que le sobra al archivo corto va al largo', () => {
    const [corto, largo] = repartirPresupuesto([100, 50_000], 16_000)
    expect(corto).toBe(100)
    // Sin redistribución el largo se habría quedado en 8.000.
    expect(largo).toBeGreaterThan(8_000)
    expect(corto + largo).toBeLessThanOrEqual(16_000)
  })
})

describe('construirContextoAdjuntos', () => {
  it('sin adjuntos devuelve cadena vacía', () => {
    expect(construirContextoAdjuntos([])).toBe('')
  })

  it('ignora un adjunto del que no se pudo extraer texto', () => {
    const ilegible = { filename: 'roto.pdf', doc_type: 'pdf', texto_extraido: null }
    expect(construirContextoAdjuntos([ilegible])).toBe('')
  })

  it('nombra cada fuente con su archivo, en orden, para que se pueda citar', () => {
    const ctx = construirContextoAdjuntos([adjunto('guidance.xlsx', 100), adjunto('memoria.pdf', 100, 'pdf')])
    expect(ctx).toContain('[FUENTE 1 — guidance.xlsx (excel)]')
    expect(ctx).toContain('[FUENTE 2 — memoria.pdf (pdf)]')
    expect(ctx.indexOf('FUENTE 1')).toBeLessThan(ctx.indexOf('FUENTE 2'))
  })

  it('respeta el presupuesto con cinco archivos grandes', () => {
    const cinco = [1, 2, 3, 4, 5].map(n => adjunto(`f${n}.xlsx`, 40_000))
    const ctx = construirContextoAdjuntos(cinco)
    // El texto útil no puede pasarse del presupuesto; las cabeceras aparte.
    const util = ctx.replace(/\[FUENTE \d+ — [^\]]+\]\n/g, '').replace(/\n\[…recortado\]/g, '').replace(/\n\n---\n\n/g, '')
    expect(util.length).toBeLessThanOrEqual(PRESUPUESTO_TOTAL)
    expect(ctx).toContain('[…recortado]')
  })

  it('cada archivo incluido recibe al menos el mínimo', () => {
    const cinco = [1, 2, 3, 4, 5].map(n => adjunto(`f${n}.xlsx`, 40_000))
    const ctx = construirContextoAdjuntos(cinco)
    const bloques = ctx.split('\n\n---\n\n')
    for (const b of bloques) {
      expect(b.length).toBeGreaterThanOrEqual(MINIMO_POR_ARCHIVO)
    }
  })
})

describe('resumirFuentes', () => {
  it('cuenta los caracteres que aportó cada archivo', () => {
    expect(resumirFuentes([adjunto('a.xlsx', 30)])).toEqual([
      { filename: 'a.xlsx', doc_type: 'excel', chars: 30 },
    ])
  })

  it('un archivo ilegible cuenta cero, no desaparece del anexo', () => {
    const ilegible = { filename: 'roto.pdf', doc_type: 'pdf', texto_extraido: null }
    expect(resumirFuentes([ilegible])).toEqual([{ filename: 'roto.pdf', doc_type: 'pdf', chars: 0 }])
  })
})
