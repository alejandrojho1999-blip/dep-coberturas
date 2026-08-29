import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { entradaDataset } from '@/lib/backtest/dataset-source'
import { TIPO_MIME } from '@/lib/backtest/dataset'

/**
 * Entrega el dataset del backtest, generado al vuelo.
 *
 * Los ficheros no se guardan en `public/`: allí serían descargables sin sesión
 * mientras la pantalla que los enseña sí exige iniciarla. Aquí se comprueba la
 * sesión antes de construir nada.
 *
 * El nombre pedido se busca en el catálogo y solo se sirve si aparece en él, así
 * que el parámetro nunca llega a componer una ruta del sistema de ficheros: no
 * hay superficie de recorrido de directorios porque no se toca el disco.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Hace falta iniciar sesión.' }, { status: 401 })
  }

  const fichero = request.nextUrl.searchParams.get('fichero')
  if (!fichero) {
    return NextResponse.json({ error: 'Falta el parámetro `fichero`.' }, { status: 400 })
  }

  const entrada = entradaDataset(fichero)
  if (!entrada) {
    return NextResponse.json({ error: `No hay ningún fichero llamado «${fichero}».` }, { status: 404 })
  }

  const contenido = entrada.construir()
  const cuerpo = typeof contenido === 'string' ? contenido : new Uint8Array(contenido)

  return new NextResponse(cuerpo, {
    headers: {
      'Content-Type': TIPO_MIME[entrada.formato],
      // Sin esto el navegador abriría el CSV como texto en vez de guardarlo.
      'Content-Disposition': `attachment; filename="${entrada.fichero}"`,
      // El dataset solo cambia cuando se republica, pero es privado: se cachea
      // en el navegador de quien lo pidió, nunca en un intermediario compartido.
      'Cache-Control': 'private, max-age=3600',
    },
  })
}
