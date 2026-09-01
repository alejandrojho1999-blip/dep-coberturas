/**
 * Catálogo de fuentes del pulso público.
 *
 * Todas se comprobaron desde este servidor el 2026-09-01 y respondieron 200 sin
 * credenciales. Quedaron fuera, con su motivo, para que nadie las vuelva a
 * intentar a ciegas:
 *
 *   - GDELT       → tiempo de espera agotado y 429 en dos intentos seguidos.
 *   - Reddit      → 403 sin OAuth.
 *   - X (Twitter) → 401 sin credenciales de aplicación.
 *   - ACLED       → 403 sin clave.
 *
 * La cobertura geográfica sigue la petición: mundo, Europa, países de la OTAN,
 * países en guerra y sus vecinos.
 */

import type { TemaPulso } from '@/lib/pulso/tipos'

/**
 * Geos de Google Trends.
 *
 * No se pide un término concreto: el feed devuelve lo que la gente está
 * buscando ahora mismo en ese país. Ahí es donde aparece un topónimo antes de
 * que ningún medio publique nada.
 */
export const TRENDS_GEOS: readonly { geo: string; etiqueta: string }[] = [
  { geo: 'US', etiqueta: 'Estados Unidos' },
  { geo: 'GB', etiqueta: 'Reino Unido' },
  { geo: 'DE', etiqueta: 'Alemania' },
  { geo: 'FR', etiqueta: 'Francia' },
  { geo: 'IT', etiqueta: 'Italia' },
  { geo: 'ES', etiqueta: 'España' },
  { geo: 'PL', etiqueta: 'Polonia' },
  { geo: 'UA', etiqueta: 'Ucrania' },
  { geo: 'TR', etiqueta: 'Turquía' },
] as const

/**
 * Artículos de Wikipedia vigilados.
 *
 * Las visitas a un artículo son el termómetro más limpio que hay de atención
 * pública: nadie consulta «Artículo 5 del Tratado del Atlántico Norte» por
 * costumbre. Los títulos están verificados contra la API; uno mal escrito
 * devuelve 404 y la serie se queda muda sin avisar.
 */
export const WIKI_ARTICULOS: readonly { articulo: string; tema: TemaPulso }[] = [
  { articulo: 'NATO', tema: 'otan' },
  { articulo: 'Article_5_of_the_North_Atlantic_Treaty', tema: 'otan' },
  { articulo: 'Enlargement_of_NATO', tema: 'otan' },
  { articulo: 'Russian_invasion_of_Ukraine', tema: 'guerra' },
  { articulo: 'Kaliningrad_Oblast', tema: 'guerra' },
  { articulo: 'Suwalki_Gap', tema: 'guerra' },
  { articulo: 'Baltic_states', tema: 'europa' },
  { articulo: 'World_War_III', tema: 'mundo' },
  { articulo: 'Nuclear_warfare', tema: 'mundo' },
  { articulo: 'Taiwan_Strait', tema: 'mundo' },
  { articulo: 'Strait_of_Hormuz', tema: 'mundo' },
  { articulo: 'Federal_Reserve', tema: 'macro' },
  { articulo: 'Inflation', tema: 'macro' },
  { articulo: 'Gold_as_an_investment', tema: 'macro' },
] as const

/**
 * Canales de YouTube.
 *
 * Los identificadores se resolvieron desde la página del canal y se comprobaron
 * contra el feed; el alias (`@DWNews`) no sirve en la URL del RSS.
 */
export const YOUTUBE_CANALES: readonly { nombre: string; canalId: string; tema: TemaPulso }[] = [
  { nombre: 'DW News', canalId: 'UCbbS1GE942k3UVqpLklyhIA', tema: 'europa' },
  { nombre: 'Al Jazeera English', canalId: 'UCfiwzLy-8yKzIbsmZTzxDgw', tema: 'mundo' },
  { nombre: 'Sky News', canalId: 'UCkFclpi8U9VJjfxLYoms7Aw', tema: 'europa' },
  { nombre: 'Bloomberg Television', canalId: 'UCyxnPZfofoutjmyvaV0GGeQ', tema: 'macro' },
] as const

/**
 * Consultas de noticias.
 *
 * Se lanzan contra dos buscadores distintos (Google News y Bing News) porque
 * cada uno indexa una cola diferente de medios pequeños; la deduplicación por
 * URL normalizada se encarga del solape.
 */
export const CONSULTAS_NOTICIAS: readonly { clave: string; query: string; tema: TemaPulso }[] = [
  { clave: 'otan-rusia', query: 'NATO Russia escalation', tema: 'otan' },
  { clave: 'flanco-este', query: 'Poland Baltic airspace drone incursion', tema: 'otan' },
  { clave: 'ucrania', query: 'Ukraine front line offensive', tema: 'guerra' },
  { clave: 'vecinos', query: 'Moldova Belarus Romania border tension', tema: 'guerra' },
  { clave: 'oriente-medio', query: 'Middle East strike escalation', tema: 'mundo' },
  { clave: 'asia', query: 'Taiwan strait China military drill', tema: 'mundo' },
  { clave: 'energia', query: 'energy prices gas supply Europe', tema: 'europa' },
  { clave: 'macro', query: 'Federal Reserve interest rates decision', tema: 'macro' },
] as const

/**
 * Consultas de Hacker News (Algolia).
 *
 * Es el foro que mejor se deja consultar sin cuenta y el que antes recoge un
 * incidente técnico o energético. Se buscan frases exactas: sin comillas,
 * Algolia da por buena una coincidencia parcial y «nato» aparece dentro de
 * «Antonio».
 */
export const HN_CONSULTAS: readonly { clave: string; frase: string; tema: TemaPulso }[] = [
  { clave: 'nato', frase: 'NATO', tema: 'otan' },
  { clave: 'ukraine', frase: 'Ukraine', tema: 'guerra' },
  { clave: 'sanctions', frase: 'sanctions', tema: 'mundo' },
  { clave: 'undersea-cable', frase: 'undersea cable', tema: 'europa' },
  { clave: 'inflation', frase: 'inflation', tema: 'macro' },
] as const

/**
 * Instancias de Mastodon.
 *
 * La API de tendencias es pública y sin clave. Una sola instancia grande basta
 * para el propósito —medir de qué se habla—, y añadir más multiplicaría el
 * ruido local de cada comunidad.
 */
export const MASTODON_INSTANCIAS: readonly string[] = ['https://mastodon.social'] as const

/** Se identifica el recolector: varias de estas APIs lo piden por escrito. */
export const AGENTE_USUARIO = 'dep-coberturas-pulso/1.0 (+https://github.com/dep-coberturas)'

/** Ninguna fuente puede colgar la recolección más de este tiempo. */
export const TIMEOUT_MS = 8000
