# Design System — EQF Terminal (dep-coberturas)

## Product Context
- **What this is:** Sistema de Análisis de Riesgos para el Departamento de Coberturas de Emporium Quality Funds
- **Who it's for:** Portfolio managers y analistas cuantitativos internos
- **Space/industry:** Institutional finance / hedge fund / risk management
- **Project type:** Financial dashboard web app

## Aesthetic Direction
- **Direction:** Industrial/Utilitarian — Bloomberg Terminal aesthetic
- **Decoration level:** minimal (typography y color hacen todo el trabajo)
- **Mood:** Serio, denso en datos, de alta confianza. Cada pixel comunica precisión. No hay decoración que distraiga del análisis.

## Typography
- **Display/Brand:** Geist (variable, already loaded via next/font)
- **Body:** Geist Sans — clean, tabular-friendly
- **Data/Tables/Labels:** Geist Mono — `font-mono` para valores numéricos, códigos de tickers, etiquetas de panel
- **Scale:** xs(12px) sm(14px) base(16px) — la app prioriza densidad sobre tamaño

## Color System

### Brand Palette
| Token | Value | Use |
|-------|-------|-----|
| `--color-background` | `#07070b` | App background — true terminal black |
| `--color-surface` | `#0f0f17` | Panel backgrounds, sidebar, topbar |
| `--color-surface-raised` | `#161622` | Active states, hover states, raised cards |
| `--color-border` | `#1e2035` | All borders and dividers |

### Accent
| Token | Value | Use |
|-------|-------|-----|
| `--color-accent` | `#F59E0B` | Brand primary — Bloomberg amber. Active nav, headings, CTAs |
| `--color-accent-hover` | `#D97706` | Hover state for accent elements |
| `--color-accent-muted` | `rgba(245,158,11,0.08)` | Subtle accent backgrounds |

### Semantic / Market Signals
| Token | Value | Use |
|-------|-------|-----|
| `--color-positive` | `#22c55e` | Bullish, up, success |
| `--color-negative` | `#ef4444` | Bearish, down, error |
| `--color-neutral` | `#3b82f6` | Informational, neutral signal |

### Text
| Token | Value | Use |
|-------|-------|-----|
| `--color-text-primary` | `#F0EFE8` | Main content — warm white |
| `--color-text-secondary` | `#64748b` | Labels, subtitles |
| `--color-text-muted` | `#374151` | Very muted — panel headers, categories |

## Spacing
- **Base unit:** 4px
- **Density:** compact-to-comfortable
- **Panel headers:** `px-4 py-2`, panel content: `p-4`

## Layout
- **Sidebar:** 240px expanded / 60px collapsed — persistent, collapsible
- **Max content width:** none (full-width panels) / 4xl for reading-heavy pages
- **Border radius:** sm(6px) for cards/panels, md(8px) for inputs/modals

## Components (installed)
### shadcn
`button`, `card`, `input`, `label`, `badge`, `table`, `tabs`, `tooltip`, `separator`, `skeleton`, `progress`

### Magic UI
`marquee`, `number-ticker`, `border-beam`, `animated-gradient-text`, `shimmer-button`, `bento-grid`

## Bloomberg Design Patterns
1. **Panel headers:** `text-[9px] font-mono font-bold tracking-[0.15em] uppercase text-[#374151]`
2. **Colored top border on panels:** `border-t-2 border-[color]` para categorías
3. **Active nav item:** `border-l-2 border-[#F59E0B] bg-[#161622] text-[#F59E0B]`
4. **Market signal pill:** `h-1.5 w-1.5 rounded-full bg-[#22c55e] animate-pulse`
5. **Stat values:** `text-3xl font-bold font-mono tabular-nums`
6. **Ticker:** Marquee with `[--duration:40s]`, items separated by `|`

## Decisions Log
| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-04-26 | Bloomberg amber (#F59E0B) as primary accent | User selected. Reads "institutional finance" vs neon green |
| 2026-04-26 | Dark-only theme maintained | Target users work in low-light trading environments |
| 2026-04-26 | Geist Mono for all data labels | Tabular numbers, ticker codes need monospace alignment |
