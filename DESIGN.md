# Design System — SynerGy (dep-coberturas)

Fuente de verdad: **BrandBook (Manual de marca)_SynerGy.pdf**
(Google Drive → `Emporium/Manual de Marca/`). Ante cualquier duda, manda el manual.

Los tokens viven en `src/app/globals.css` dentro de `@theme inline`. **No escribas
hex literales en componentes** — usa las clases de token (`bg-surface`,
`text-text-secondary`, `border-border`) o `var(--color-*)` en estilos inline.

## Product Context
- **Qué es:** plataforma quant de SynerGy — agentes IA, estrategias, portafolios algorítmicos y recomendaciones
- **Para quién:** portfolio managers y analistas cuantitativos
- **Sector:** institutional finance / fintech / gestión de riesgo
- **Tipo:** dashboard financiero web (Next.js 16 + Tailwind v4 + shadcn v4)

## Identidad de marca

| Elemento | Valor |
|---|---|
| Marca | SynerGy |
| Slogan interno (Identidad) | *When SynerGy Happens* — usado en el TopBar del dashboard |
| Slogan externo (Imagen) | *Find your Freedom* — usado en las pantallas de auth |
| Arquetipos | El Creador + El Mago |
| Valores | Innovación · Sinergia · Empatía · Excelencia · Lealtad |

### Assets (`public/brand/`)

| Archivo | Uso |
|---|---|
| `logo-hrz-blanco.png` | Sidebar expandido |
| `logo-vrt-blanco.png` | Pantallas de auth (login, register, reset) |
| `isotipo-blanco.png` | Sidebar colapsado (60 px) y favicon |
| `logo-hrz-azul.png`, `logo-vrt-azul.png`, `isotipo-azul.png` | Sobre fondos claros (exportaciones, impresos) |
| `patronaje-blanco.png` | Textura de fondo en dashboard y auth |
| `patronaje-navy.png` | Patronaje sobre fondos claros |

El **patronaje nunca supera el 3 % de opacidad** (regla explícita del manual). Está
implementado como la utilidad `.bg-patronaje` en `globals.css`, que lo pinta en un
pseudo-elemento `::before` con `opacity: 0.03`.

## Aesthetic Direction
- **Dirección:** institucional/sobria — densidad de datos con superficie azul corporativa
- **Nivel de decoración:** mínimo; tipografía, peso y relleno hacen el trabajo
- **Mood:** confianza, solidez, inteligencia. Es la "psicología del color" que pide el manual: profundidad y alcance global, sin ruido visual

## Typography

El manual define **Avenir Black** como primaria y **Roboto** como secundaria.
Avenir es de licencia paga y no está en Google Fonts, así que se sustituye por
**Nunito Sans**, el clon geométrico-humanista más cercano disponible.

| Rol | Familia | Clase | Uso |
|---|---|---|---|
| Display / Brand | Nunito Sans (800/900) | `font-brand` | Titulares, nombres de sección, logotipo tipográfico |
| Body | Roboto | `font-sans` (por defecto) | Texto corrido, formularios, descripciones |
| Data | Roboto Mono | `font-mono` | Valores numéricos, tickers, tablas, etiquetas de panel |

Escala: `xs(12px) sm(14px) base(16px)` — la app prioriza densidad sobre tamaño.

Las tres familias se cargan en `src/app/layout.tsx` vía `next/font/google` y se
exponen como `--font-brand`, `--font-body` y `--font-numeric`.

## Color System

### Marca (valores exactos del manual)

| Token | Valor | Nombre en el manual |
|---|---|---|
| `--color-brand-navy` | `#1C3042` | Principal |
| `--color-brand-deep` | `#05141f` | Secundario |
| `--color-brand-blue` | `#003D66` | Alterno |

El manual aplica estos colores al 100 % / 50 % / 10 %. Las superficies de abajo
derivan de esa escala.

### Superficies

| Token | Valor | Uso |
|---|---|---|
| `--color-background` | `#05141f` | Fondo de la app (Secundario del manual) |
| `--color-surface` | `#0C1E2C` | Paneles, sidebar, topbar |
| `--color-surface-raised` | `#1C3042` | Tarjetas elevadas, hover (Principal del manual) |
| `--color-surface-hover` | `#24405A` | Hover sobre superficies elevadas |
| `--color-border` | `#24405A` | Bordes y divisores |
| `--color-border-subtle` | `#16293A` | Divisores internos, separación de filas |

### Acento — **regla crítica**

`#003D66` sobre `#05141f` da un contraste de **1.66:1**. No es legible como texto
ni como borde fino sobre fondo oscuro. Por eso:

> **El Alterno es relleno, nunca color de texto sobre fondo oscuro.**

| Token | Valor | Uso |
|---|---|---|
| `--color-accent` | `#003D66` | Fondo de botones, chips, nav activo, barras |
| `--color-accent-hover` | `#004F85` | Hover de los anteriores |
| `--color-accent-muted` | `rgba(0,61,102,0.18)` | Fondos sutiles, badges |
| `--color-accent-ring` | `rgba(0,61,102,0.55)` | Anillo de foco |
| `--color-on-accent` | `#FFFFFF` | Texto sobre `accent` (contraste 11.3:1) |

Cuando antes se usaba el ámbar como *color de texto* para destacar un valor, ahora
se destaca con **peso y familia** (`font-brand font-bold`), no con color.

### Texto

| Token | Valor | Contraste sobre `background` | Uso |
|---|---|---|---|
| `--color-text-primary` | `#FFFFFF` | 18.7:1 | Contenido principal |
| `--color-text-secondary` | `rgba(255,255,255,0.62)` | ≈ 8.5:1 | Etiquetas, subtítulos |
| `--color-text-muted` | `rgba(255,255,255,0.38)` | ≈ 4.6:1 | Cabeceras de panel, categorías |

### Funcionales — excepción consciente al manual

El manual no cubre visualización de datos. Un P&L necesita verde y rojo, y un
gráfico de tarta de 15 porciones no puede resolverse con tres azules. Estos tonos
son **funcionales, no de marca**, y se eligen fríos para convivir con el azul:

| Token | Valor | Uso |
|---|---|---|
| `--color-positive` | `#10B981` | Alcista, ganancia, éxito |
| `--color-negative` | `#F04438` | Bajista, pérdida, error |
| `--color-warning` | `#F5A524` | Advertencia, en curso |
| `--color-info` / `--color-neutral` | `#4D95D0` | Informativo, señal neutra |

Las series de gráfico viven en `src/components/charts/chart-theme.ts`
(`CHART_COLORS`, `AGENT_COLORS`, `RUEDA`). Recharts recibe los colores como
atributos SVG, donde `var(--color-*)` no es fiable, así que ahí sí se usan hex
literales — es el único sitio del código donde está permitido.

### Alias de shadcn/ui

`globals.css` define también `--color-primary`, `--color-card`, `--color-input`,
`--color-ring`, `--color-destructive`, `--color-muted-foreground`, etc., mapeados a
los tokens de marca. Antes no existían y las clases de shadcn no generaban ninguna
regla; ahora los 18 componentes de `src/components/ui/` heredan la marca.

`components.json` usa `baseColor: "slate"` para que futuros `shadcn add` no
reintroduzcan neutrales cálidos.

## Spacing
- **Unidad base:** 4px
- **Densidad:** compacta a cómoda
- **Cabeceras de panel:** `px-4 py-2` · **Contenido:** `p-4`

## Layout
- **Sidebar:** 240px expandido / 60px colapsado — persistente, colapsable (`localStorage['sidebar-collapsed']`)
- **Ancho máximo:** sin límite (paneles a todo el ancho) / `4xl` en páginas de lectura
- **Radios:** `--radius-sm` 6px (tarjetas), `--radius-md` 8px (inputs), `--radius-lg` 12px

## Patrones

1. **Cabecera de panel:** `font-brand text-[9px] font-semibold uppercase tracking-[0.12em] text-text-muted`
2. **Nav item activo:** `bg-accent text-on-accent font-semibold border-l-2 border-white/70` — relleno, no color de texto
3. **Botón primario:** `bg-accent text-on-accent hover:bg-accent-hover`
4. **Botón secundario:** `border border-border text-text-secondary hover:bg-surface-raised hover:text-text-primary`
5. **Señal de mercado:** `h-1.5 w-1.5 rounded-full bg-positive animate-pulse`
6. **Valor destacado:** `font-mono text-xl font-bold tabular-nums` + color por signo (`positive`/`negative`), o `text-text-primary` si es neutro
7. **Ticker:** `Marquee` con `[--duration:40s]`, ítems separados por `|`
8. **Patronaje:** añadir `bg-patronaje` al contenedor de página (ya aplicado en `DashboardShell` y en el layout de auth)

## Decisions Log

| Fecha | Decisión | Razón |
|---|---|---|
| 2026-04-26 | Ámbar Bloomberg (#F59E0B) como acento | *(obsoleto — sustituido el 2026-08-21)* |
| 2026-04-26 | Tema oscuro únicamente | Los usuarios trabajan en entornos de baja luz. Se mantiene |
| 2026-08-21 | Rebrand completo a SynerGy | El manual de marca oficial define la identidad; el ámbar y el nombre "EQF Quant / Emporium Quality Funds" no respondían a él |
| 2026-08-21 | Solo los 3 azules del manual como marca | Decisión del usuario: fidelidad al manual por encima de la jerarquía visual del ámbar |
| 2026-08-21 | El Alterno `#003D66` es relleno, nunca texto | 1.66:1 sobre el fondo. Como relleno con texto blanco da 11.3:1 |
| 2026-08-21 | Nunito Sans sustituye a Avenir | Avenir es de licencia paga y no está en Google Fonts; Nunito Sans es el clon geométrico-humanista más cercano |
| 2026-08-21 | Roboto Mono para datos | El manual asigna Roboto a documentos; su variante mono mantiene la familia y alinea cifras |
| 2026-08-21 | Colores de datos fuera del manual | El manual no cubre visualización de datos. Verde/rojo de P&L y la rueda de 15 series son funcionales, retonalizados fríos |
| 2026-08-21 | Alias de shadcn añadidos al `@theme` | Los 18 componentes de `ui/` usaban clases que no generaban ninguna regla — bug latente cerrado con el rebrand |
