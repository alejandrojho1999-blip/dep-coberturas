/**
 * Las guardas horarias de las dos tareas programadas de opciones.
 *
 * Se prueban aquí, y no en la ruta, porque desde el 2026-09-08 quien las
 * ejecuta es el crontab del VPS y la ruta HTTP es solo un respaldo: la regla
 * tiene que ser una sola para los dos.
 *
 * El motivo de fijarlas: durante toda su vida el archivo de cadenas se disparó
 * fuera de su ventana. GitHub programaba las 21:15 UTC y ejecutaba pasadas las
 * 23:00 —más de una hora tarde, todos los días—, así que el endpoint respondía
 * `ejecutado: false`, devolvía 200 y el job salía verde. La tabla
 * `options_chain_snapshots` estaba vacía. Un `false` correcto puede esconder un
 * planificador roto, y por eso hay que poder leer el motivo.
 */

import { describe, expect, it, vi } from 'vitest'

import {
  archivarCadenasProgramado,
  revisarSalidasProgramada,
} from '@/lib/options/cron-opciones'

vi.mock('@/lib/options/chain-archive-run', () => ({
  UNIVERSO_ARCHIVO: ['AAPL', 'MSFT'],
  archivarCadenas: vi.fn(async (_admin: unknown, fecha: string) => ({
    fecha, archivados: 2, contratos: 400, bytes: 20480, vacios: [], fallidos: [], log: [],
  })),
}))

vi.mock('@/lib/options/exit-review-run', () => ({
  OPTION_CATEGORIES: ['GAMMA', 'THETA'],
  runExitReview: vi.fn(async (_a: unknown, _u: string, categoria: string) => ({
    categoria, cerradas: 1, fallidos: 0,
  })),
}))

const { archivarCadenas } = await import('@/lib/options/chain-archive-run')
const { runExitReview } = await import('@/lib/options/exit-review-run')

const admin = {} as never

/** Un instante concreto de Nueva York, expresado en UTC (septiembre = EDT, UTC-4). */
const et = (dia: string, hora: number, minuto = 0) =>
  new Date(`${dia}T${String(hora + 4).padStart(2, '0')}:${String(minuto).padStart(2, '0')}:00Z`)

describe('revisarSalidasProgramada', () => {
  // 2026-09-07 es lunes; 2026-09-05, sábado.
  it('trabaja con la sesión regular abierta', async () => {
    const r = await revisarSalidasProgramada(admin, 'usuario', et('2026-09-07', 11))

    expect(r.ejecutado).toBe(true)
    expect(r.cerradas).toBe(2)          // una por categoría
    expect(r.errores).toEqual([])
    expect(runExitReview).toHaveBeenCalledTimes(2)
  })

  it('no cotiza fuera de la sesión: sería la horquilla congelada del cierre', async () => {
    vi.mocked(runExitReview).mockClear()
    const r = await revisarSalidasProgramada(admin, 'usuario', et('2026-09-07', 20))

    expect(r.ejecutado).toBe(false)
    expect(r.motivo).toBeTruthy()
    expect(runExitReview).not.toHaveBeenCalled()
  })

  it('el fin de semana tampoco', async () => {
    vi.mocked(runExitReview).mockClear()
    const r = await revisarSalidasProgramada(admin, 'usuario', et('2026-09-05', 11))

    expect(r.ejecutado).toBe(false)
    expect(r.motivo).toBe('fin-de-semana')
    expect(runExitReview).not.toHaveBeenCalled()
  })

  it('un fallo en una categoría no impide revisar la otra', async () => {
    // Gamma y Theta son carteras distintas: cada una se mide contra su propio
    // capital, así que una no puede llevarse a la otra por delante.
    vi.mocked(runExitReview)
      .mockRejectedValueOnce(new Error('Yahoo no responde'))
      .mockResolvedValueOnce({ categoria: 'THETA', cerradas: 3, fallidos: 0 } as never)

    const r = await revisarSalidasProgramada(admin, 'usuario', et('2026-09-07', 11))

    expect(r.ejecutado).toBe(true)
    expect(r.cerradas).toBe(3)
    expect(r.errores).toHaveLength(1)
    expect(r.errores[0]).toMatch(/Yahoo no responde/)
  })
})

describe('archivarCadenasProgramado', () => {
  it('captura dentro de la ventana posterior al cierre', async () => {
    const r = await archivarCadenasProgramado(admin, et('2026-09-07', 17))

    expect(r.ejecutado).toBe(true)
    expect(r.fecha).toBe('2026-09-07')
    expect(r.archivados).toBe(2)
    expect(r.kb).toBe(20)
  })

  it('rechaza antes del cierre: la horquilla todavía se mueve', async () => {
    vi.mocked(archivarCadenas).mockClear()
    const r = await archivarCadenasProgramado(admin, et('2026-09-07', 15, 59))

    expect(r.ejecutado).toBe(false)
    expect(r.motivo).toBe('fuera-de-ventana')
    expect(archivarCadenas).not.toHaveBeenCalled()
  })

  it('rechaza pasadas las 19:00 ET: Yahoo ya refleja la sesión siguiente', async () => {
    // Este es el caso real que dejó la tabla vacía: GitHub disparaba a las
    // 19:1x-19:2x ET todos los días, y aquí se responde que no toca.
    vi.mocked(archivarCadenas).mockClear()
    const r = await archivarCadenasProgramado(admin, et('2026-09-07', 19, 29))

    expect(r.ejecutado).toBe(false)
    expect(r.motivo).toBe('fuera-de-ventana')
    expect(archivarCadenas).not.toHaveBeenCalled()
  })

  it('el fin de semana no hay sesión que archivar', async () => {
    vi.mocked(archivarCadenas).mockClear()
    const r = await archivarCadenasProgramado(admin, et('2026-09-05', 17))

    expect(r.ejecutado).toBe(false)
    expect(r.motivo).toBe('fin-de-semana')
    expect(archivarCadenas).not.toHaveBeenCalled()
  })

  it('la fecha la manda Nueva York, no el reloj del servidor', async () => {
    // 2026-09-07 22:30 ET son ya las 02:30 UTC del día 8. Archivar con la fecha
    // del servidor guardaría la sesión del lunes como si fuera del martes, un
    // error imposible de detectar meses después. Cae fuera de ventana, pero lo
    // que se comprueba es que el día se lee en ET.
    const r = await archivarCadenasProgramado(admin, new Date('2026-09-08T02:30:00Z'))

    expect(r.ejecutado).toBe(false)
    expect(r.motivo).toBe('fuera-de-ventana')
  })
})
