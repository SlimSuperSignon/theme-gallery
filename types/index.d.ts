/** The named colors of one mode. Every value is six-digit hex, such as `#1f1a15`. */
export type ThemeAnchors = {
  'surface-0': string
  'text-primary': string
  'surface-1'?: string
  'surface-2'?: string
  'surface-3'?: string
  'text-secondary'?: string
  'text-muted'?: string
}

/** A role's color: one hex, or a seed with single shades set by hand. */
export type ThemeRole = string | { seed?: string; stops?: Record<string, string>; fillShade?: number }

export type ThemeRoles = {
  accent?: ThemeRole
  danger?: ThemeRole
  success?: ThemeRole
  warning?: ThemeRole
  pro?: ThemeRole
}

export type ThemeGit = {
  added?: string
  removed?: string
  modified?: string
  merged?: string
  closed?: string
  conflicting?: string
  draft?: string
}

/** One mode of a theme: its named colors, and every finer control over it. */
export type ThemeMode = ThemeAnchors & {
  /** Roles for this mode alone, over the theme's own. */
  roles?: ThemeRoles
  git?: ThemeGit
  /** Single shades of the gray ramp set by hand, by stop: `{ "500": "#7b8892" }`. */
  stops?: Record<string, string>
  /** Single design tokens set by hand, over everything else: `{ "role-tooltip-bg": "#101418" }`. */
  tokens?: Record<string, string>
}

export type ThemeGlass = { blur?: number; tint?: string; opacity?: number }

export type ThemeTile = { size?: [number, number]; repeat?: boolean }

export type ThemeGradientStop = string | { at: number; color: string }

export type ThemePath = string | { d: string; strokeWidth?: number; color?: string }

/** What is behind the conversation. */
export type ThemeBackground =
  | { color: string }
  | { gradient: ThemeTile & { stops: ThemeGradientStop[]; angle?: number; shape?: 'linear' | 'radial' } }
  | { pattern: ThemeTile & { viewBox: number | [number, number]; paths: ThemePath[]; color?: string } }
  | { scene: string; alt?: string; glass?: ThemeGlass | false }

/** A theme file: plain data, the whole of what one person shares with another. */
export type ThemeDef = {
  format: 'claude-theme/1'
  name: string
  author?: string
  description?: string
  /** The creator's about page, as markdown. */
  about?: string
  /** Makes the app use this mode while the theme is on. */
  mode?: 'light' | 'dark'
  contrast?: 'more'
  codeTheme?: { light?: string; dark?: string }
  roles?: ThemeRoles
  light?: ThemeMode
  dark?: ThemeMode
  background?: ThemeBackground
}

/**
 * A community theme: where its file is in the community's repository, and the
 * theme. From the index it is a card, without its about page or moving scene;
 * `isFull` says the whole file has been fetched since.
 */
export type ThemeShared = {
  file: string
  theme: ThemeDef
  extras: string[]
  isFull: boolean
}

export type ThemeShelf = 'built-in' | 'mine' | 'community'

export type ThemeGalleryView = {
  activeName: string | null
  mine: ThemeDef[]
  community: ThemeShared[]
  /** The theme whose about page is showing, or null for the gallery. */
  open: { shelf: ThemeShelf; name: string } | null
  note: string
  /** A link the note points at, such as the page a theme is submitted on. */
  link: { href: string; label: string } | null
  /** The community's repository on GitHub, as `owner/name`; empty for none. */
  repo: string
  /** What the person typed in the search box. */
  query: string
  /** How many community themes the shelf shows. */
  shown: number
}

/** The moving background of the theme that is on, or null for none. */
export type ThemeLiveScene = { svg: string; alt: string } | null

declare module 'claude-code' {
  interface PluginState {
    'theme-gallery': { view: Shaped<ThemeGalleryView>; scene: Shaped<ThemeLiveScene> }
  }
}
