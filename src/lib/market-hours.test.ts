import { describe, it, expect } from 'vitest'
import { enVentanaPrecierre, marketMoment, marketStatus, minutosParaCierre } from './market-hours'

/**
 * Las fechas van en UTC a propósito: lo que se está probando es justamente la
 * traducción a hora de Nueva York, incluido el salto del horario de verano.
 */

describe('marketMoment', () => {
  it('en verano Nueva York va cuatro horas por detrás de UTC', () => {
    // 2026-06-17 es miércoles. 14:00 UTC = 10:00 EDT.
    const m = marketMoment(new Date('2026-06-17T14:00:00.000Z'))
    expect(m.minutosET).toBe(10 * 60)
    expect(m.fechaET).toBe('2026-06-17')
    expect(m.diaSemana).toBe(3)
  })

  it('en invierno son cinco horas', () => {
    // 2026-01-14 es miércoles. 14:00 UTC = 09:00 EST.
    const m = marketMoment(new Date('2026-01-14T14:00:00.000Z'))
    expect(m.minutosET).toBe(9 * 60)
  })

  it('cruza el día correctamente: de madrugada UTC sigue siendo la víspera en ET', () => {
    const m = marketMoment(new Date('2026-06-18T02:00:00.000Z'))
    expect(m.fechaET).toBe('2026-06-17')
    expect(m.minutosET).toBe(22 * 60)
  })
})

describe('marketStatus', () => {
  it('a las 10:00 ET de un miércoles el mercado opera', () => {
    const s = marketStatus(new Date('2026-06-17T14:00:00.000Z'))
    expect(s.abierto).toBe(true)
  })

  it('la misma hora UTC en invierno cae antes de la apertura', () => {
    // 14:00 UTC = 09:00 EST, el mercado ni ha abierto.
    const s = marketStatus(new Date('2026-01-14T14:00:00.000Z'))
    expect(s.abierto).toBe(false)
    expect(s.motivo).toBe('fuera-de-horario')
  })

  it('rechaza los primeros 30 minutos de sesión', () => {
    // 13:35 UTC = 09:35 EDT, cinco minutos tras la apertura.
    const s = marketStatus(new Date('2026-06-17T13:35:00.000Z'))
    expect(s.abierto).toBe(false)
    expect(s.motivo).toBe('apertura-reciente')
  })

  it('acepta justo cuando se cumple el margen de apertura', () => {
    // 14:00 EDT... 10:00 en punto es el primer minuto válido.
    expect(marketStatus(new Date('2026-06-17T14:00:00.000Z')).abierto).toBe(true)
    // Un minuto antes, no.
    expect(marketStatus(new Date('2026-06-17T13:59:00.000Z')).abierto).toBe(false)
  })

  it('rechaza los últimos 15 minutos', () => {
    // 19:50 UTC = 15:50 EDT.
    const s = marketStatus(new Date('2026-06-17T19:50:00.000Z'))
    expect(s.abierto).toBe(false)
    expect(s.motivo).toBe('cierre-inminente')
  })

  it('rechaza después del cierre', () => {
    // 20:30 UTC = 16:30 EDT.
    const s = marketStatus(new Date('2026-06-17T20:30:00.000Z'))
    expect(s.abierto).toBe(false)
    expect(s.motivo).toBe('fuera-de-horario')
  })

  it('rechaza el fin de semana aunque la hora sea de sesión', () => {
    // 2026-06-20 es sábado, 14:00 UTC = 10:00 EDT.
    const s = marketStatus(new Date('2026-06-20T14:00:00.000Z'))
    expect(s.abierto).toBe(false)
    expect(s.motivo).toBe('fin-de-semana')
  })

  it('el domingo por la tarde tampoco', () => {
    const s = marketStatus(new Date('2026-06-21T18:00:00.000Z'))
    expect(s.abierto).toBe(false)
    expect(s.motivo).toBe('fin-de-semana')
  })

  it('un cron fijo a las 14:00 UTC solo opera en horario de verano', () => {
    // Este es el caso que hace falta tener presente al programar el cron:
    // la misma expresión cron cae en dos horas ET distintas según la época.
    expect(marketStatus(new Date('2026-06-17T14:00:00.000Z')).abierto).toBe(true)
    expect(marketStatus(new Date('2026-01-14T14:00:00.000Z')).abierto).toBe(false)
  })
})

describe('ventana de precierre del cron de los agentes', () => {
  /**
   * El workflow dispara a las 19:00 y a las 20:00 UTC porque el desfase con
   * Nueva York cambia dos veces al año. Lo que estas pruebas fijan es que en
   * cada estación pase exactamente uno de los dos: si pasaran los dos, la
   * cascada gastaría tokens dos veces el mismo día; si no pasara ninguno, los
   * agentes dejarían de ejecutarse sin que nadie se enterase.
   */

  it('en verano deja pasar el disparo de las 19:00 UTC y descarta el de las 20:00', () => {
    // 2026-06-17, miércoles. 19:00 UTC = 15:00 EDT, una hora antes del cierre.
    expect(enVentanaPrecierre(new Date('2026-06-17T19:00:00.000Z'))).toBe(true)
    expect(minutosParaCierre(new Date('2026-06-17T19:00:00.000Z'))).toBe(60)

    // 20:00 UTC = 16:00 EDT: la sesión ya cerró.
    expect(enVentanaPrecierre(new Date('2026-06-17T20:00:00.000Z'))).toBe(false)
    expect(marketStatus(new Date('2026-06-17T20:00:00.000Z')).abierto).toBe(false)
  })

  it('en invierno deja pasar el de las 20:00 UTC y descarta el de las 19:00', () => {
    // 2026-01-14, miércoles. 20:00 UTC = 15:00 EST.
    expect(enVentanaPrecierre(new Date('2026-01-14T20:00:00.000Z'))).toBe(true)
    expect(minutosParaCierre(new Date('2026-01-14T20:00:00.000Z'))).toBe(60)

    // 19:00 UTC = 14:00 EST: el mercado está abierto, pero faltan dos horas
    // para el cierre. Sin esta comprobación, en invierno se ejecutaría dos
    // veces al día.
    expect(marketStatus(new Date('2026-01-14T19:00:00.000Z')).abierto).toBe(true)
    expect(enVentanaPrecierre(new Date('2026-01-14T19:00:00.000Z'))).toBe(false)
  })

  it('tolera que el planificador llegue tarde, hasta el margen de cierre', () => {
    // GitHub arranca con retraso a menudo; sin holgura se perdería el día.
    expect(enVentanaPrecierre(new Date('2026-06-17T19:10:00.000Z'))).toBe(true)  // 14:50 restantes → 50 min
    expect(enVentanaPrecierre(new Date('2026-06-17T19:29:00.000Z'))).toBe(true)  // 31 min al cierre

    // Pero no tanto como para invadir los últimos 15 minutos, donde
    // `marketStatus` ya cierra la puerta por su cuenta.
    expect(enVentanaPrecierre(new Date('2026-06-17T19:45:00.000Z'))).toBe(false) // 15 min: justo el límite
    expect(enVentanaPrecierre(new Date('2026-06-17T19:50:00.000Z'))).toBe(false)
  })

  it('tampoco se adelanta más de lo previsto', () => {
    // 18:44 UTC = 14:44 EDT, 76 min al cierre: fuera por un minuto.
    expect(enVentanaPrecierre(new Date('2026-06-17T18:44:00.000Z'))).toBe(false)
    // 18:45 UTC = 14:45 EDT, 75 min: el borde exacto de la holgura.
    expect(enVentanaPrecierre(new Date('2026-06-17T18:45:00.000Z'))).toBe(true)
  })
})
