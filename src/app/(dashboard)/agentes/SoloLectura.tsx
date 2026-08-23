import { Eye } from 'lucide-react'

/**
 * Aviso que sustituye a los controles del agente para quien no lo administra.
 *
 * Las recomendaciones son una cartera única. Los demás usuarios la siguen: ven
 * lo mismo, con los mismos precios y el mismo track record, pero no generan
 * señales propias ni cierran posiciones ajenas.
 *
 * Ocultar el botón es cortesía, no seguridad: quien lo pulsara igualmente
 * chocaría con un 403 en la API y con la política RLS de la tabla.
 */
export default function SoloLectura({ agente }: { agente: string }) {
  return (
    <div
      className="flex items-start gap-2.5 rounded-lg px-3.5 py-3"
      style={{
        border: '1px solid var(--color-border-subtle)',
        background: 'var(--color-surface)',
      }}
    >
      <Eye size={14} className="mt-0.5 shrink-0 text-text-muted" />
      <div className="space-y-0.5">
        <p className="text-xs font-semibold text-text-primary">
          Estás viendo el {agente} en modo lectura
        </p>
        <p className="text-[11px] leading-relaxed text-text-secondary">
          Las recomendaciones las genera el administrador y son las mismas para
          todos. Aquí puedes seguir su cartera y su rendimiento, pero no ejecutar
          el agente.
        </p>
      </div>
    </div>
  )
}
