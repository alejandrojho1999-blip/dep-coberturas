'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp, Download } from 'lucide-react'

interface Props {
  codigo: string
  nombre: string
}

/** Líneas que se muestran antes de pedir "ver completo". */
const LINEAS_PLEGADO = 40

/**
 * Visor del código de producción.
 *
 * El resaltado se hace a mano en vez de traer una librería: son archivos de C#
 * de hasta 1.800 líneas y basta con distinguir comentarios, cadenas y palabras
 * clave para que se lea. Una dependencia de resaltado pesaría más que todo el
 * resto de la sección.
 */
export function VisorCodigo({ codigo, nombre }: Props) {
  const [abierto, setAbierto] = useState(false)

  const lineas = codigo.split('\n')
  const visibles = abierto ? lineas : lineas.slice(0, LINEAS_PLEGADO)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="font-mono text-[10px] text-text-muted">
          {nombre} · {lineas.length.toLocaleString('es-ES')} líneas
        </p>
        <a
          href={`/estrategias/code/${nombre}`}
          download
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 py-1 font-mono text-[10px] uppercase tracking-wide text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
        >
          <Download size={11} />
          Descargar
        </a>
      </div>

      <div className="relative">
        <pre className="max-h-[32rem] overflow-auto rounded-lg border border-border bg-background p-3 text-[11px] leading-relaxed">
          <code className="font-mono">
            {visibles.map((linea, i) => (
              <span key={i} className="block whitespace-pre">
                <span className="mr-3 inline-block w-9 shrink-0 select-none text-right text-text-muted">
                  {i + 1}
                </span>
                <Resaltada linea={linea} />
              </span>
            ))}
          </code>
        </pre>

        {!abierto && lineas.length > LINEAS_PLEGADO && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 rounded-b-lg bg-gradient-to-t from-background to-transparent" />
        )}
      </div>

      {lineas.length > LINEAS_PLEGADO && (
        <button
          onClick={() => setAbierto(v => !v)}
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 font-mono text-[10px] uppercase tracking-wide text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
        >
          {abierto ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          {abierto ? 'Plegar' : `Ver las ${lineas.length.toLocaleString('es-ES')} líneas`}
        </button>
      )}
    </div>
  )
}

const PALABRAS = new Set([
  'using', 'namespace', 'public', 'private', 'protected', 'internal', 'class', 'struct',
  'interface', 'enum', 'void', 'int', 'double', 'bool', 'string', 'var', 'new', 'return',
  'if', 'else', 'for', 'foreach', 'while', 'switch', 'case', 'break', 'continue', 'get',
  'set', 'override', 'static', 'readonly', 'const', 'true', 'false', 'null', 'this',
  'base', 'try', 'catch', 'finally', 'throw', 'in', 'is', 'as', 'default',
])

/** Resalta una línea de C#: comentarios, cadenas, atributos, palabras clave y números. */
function Resaltada({ linea }: { linea: string }) {
  const sinEspacios = linea.trimStart()

  // Un comentario tiñe la línea entera; es el caso más frecuente en estos
  // archivos, donde la cabecera documental ocupa cientos de líneas.
  if (sinEspacios.startsWith('//') || sinEspacios.startsWith('#region') || sinEspacios.startsWith('#endregion')) {
    return <span className="text-text-muted">{linea}</span>
  }

  // Atributos de NinjaScript: [NinjaScriptProperty], [Display(...)]…
  if (sinEspacios.startsWith('[')) {
    return <span className="text-info">{linea}</span>
  }

  const trozos = linea.split(/("(?:[^"\\]|\\.)*")/g)
  return (
    <>
      {trozos.map((trozo, i) => {
        if (i % 2 === 1) return <span key={i} className="text-positive">{trozo}</span>
        return (
          <span key={i}>
            {trozo.split(/(\b\w+\b)/g).map((palabra, j) => {
              if (PALABRAS.has(palabra)) return <span key={j} className="text-info">{palabra}</span>
              if (/^\d+$/.test(palabra)) return <span key={j} className="text-warning">{palabra}</span>
              return <span key={j} className="text-text-secondary">{palabra}</span>
            })}
          </span>
        )
      })}
    </>
  )
}
