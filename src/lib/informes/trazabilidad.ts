import type { TrazaDato, ValoracionPropia } from './types'

/**
 * Comprobación de que las cifras de la tesis salen de los archivos adjuntos.
 *
 * El sistema no se fía del modelo: el generador de informes ya sobrescribe los
 * precios que devuelve con los de Yahoo porque un modelo de lenguaje puede
 * escribir un número plausible sin haberlo leído en ninguna parte. Decir «el
 * adjunto es fuente de verdad» no puede significar «me creo lo que el modelo
 * diga que leyó en el adjunto».
 *
 * De ahí este módulo: cada cifra que la tesis atribuye a un archivo se busca
 * literalmente en el texto que se extrajo de ese archivo. Lo que no aparece no
 * se imprime. Es determinista y no necesita al modelo para probarse.
 */

/** Texto realmente extraído de un adjunto, indexado por nombre de archivo. */
export interface AdjuntoVerificable {
  filename: string
  texto_extraido: string | null
}

export interface ResultadoTrazabilidad {
  /** Solo los ítems que se pudieron comprobar. Son los que se imprimen. */
  verificados: TrazaDato[]
  /** Cuántos se descartaron. Se enseña como recuento, sin detallar. */
  descartados: number
}

/**
 * Normaliza una cifra para poder buscarla en un texto.
 *
 * Un Excel escribe `1.234,50`, un PDF `$1,234.50` y el modelo devuelve
 * `1234.5`. Las tres son el mismo número, y comparar las cadenas tal cual
 * daría falsos negativos en casi todos los casos reales.
 */
export function normalizarCifra(valor: string): string {
  const limpio = valor.replace(/[\s$€%]/g, '')
  // Se elimina el separador de millares y se unifica el decimal a punto. El
  // último separador que aparece manda: en `1.234,50` es la coma, en
  // `1,234.50` el punto.
  const ultimaComa = limpio.lastIndexOf(',')
  const ultimoPunto = limpio.lastIndexOf('.')
  const decimal = ultimaComa > ultimoPunto ? ',' : '.'
  const sinMillares = limpio
    .split('')
    .filter((c, i) => c !== '.' && c !== ',' ? true : i === (decimal === ',' ? ultimaComa : ultimoPunto))
    .join('')
  const conPunto = sinMillares.replace(',', '.')
  // Los ceros finales de un decimal no cambian el número: 1234.50 === 1234.5.
  const n = Number(conPunto)
  return Number.isFinite(n) ? String(n) : conPunto.toLowerCase()
}

/** true si el valor aparece en el texto, tolerando formatos distintos. */
export function apareceEn(valor: string, texto: string): boolean {
  const bruto = valor.trim()
  if (!bruto) return false
  if (texto.includes(bruto)) return true

  const objetivo = normalizarCifra(bruto)
  if (!objetivo) return false

  // Se normaliza cada número del texto y se compara contra el objetivo. Buscar
  // la cadena normalizada dentro del texto normalizado daría positivos falsos:
  // «12» aparece dentro de «4125».
  const numeros = texto.match(/-?[\d.,]*\d/g) ?? []
  return numeros.some((n) => normalizarCifra(n) === objetivo)
}

/**
 * Filtra la trazabilidad que devolvió el modelo.
 *
 * Se cae un ítem por dos motivos: cita un archivo que nadie subió (fuente
 * inventada) o la cifra no está en ese archivo (dato inventado). En ambos casos
 * el ítem desaparece del documento y solo se cuenta.
 */
export function validarTrazabilidad(
  items: TrazaDato[] | undefined,
  adjuntos: readonly AdjuntoVerificable[],
): ResultadoTrazabilidad {
  if (!items?.length) return { verificados: [], descartados: 0 }

  const textoPorArchivo = new Map(
    adjuntos.map((a) => [a.filename.toLowerCase(), a.texto_extraido ?? '']),
  )

  const verificados: TrazaDato[] = []
  for (const item of items) {
    const texto = textoPorArchivo.get((item.archivo ?? '').trim().toLowerCase())
    if (texto == null) continue
    if (!apareceEn(item.valor ?? '', texto)) continue
    verificados.push({ ...item, verificado: true })
  }

  return { verificados, descartados: items.length - verificados.length }
}

/**
 * Deja pasar la valoración propia solo si algo verificado la sostiene.
 *
 * Una valoración es una cadena de supuestos sobre cifras. Si ninguna de esas
 * cifras se pudo encontrar en los archivos, lo que queda es una opinión con
 * dos decimales, que es peor que no dar ninguna.
 */
export function valoracionRespaldada(
  valoracion: ValoracionPropia | undefined,
  verificados: readonly TrazaDato[],
): ValoracionPropia | undefined {
  if (!valoracion) return undefined
  if (valoracion.valor_por_accion == null) return valoracion
  return verificados.length > 0 ? valoracion : undefined
}
