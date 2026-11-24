import type { ThemeColors, ThemeSetArgs } from 'claude-code'

import type {
  ThemeBackground,
  ThemeDef,
  ThemeGit,
  ThemeGlass,
  ThemeGradientStop,
  ThemeLiveScene,
  ThemeMode,
  ThemePath,
  ThemeRole,
  ThemeRoles,
  ThemeShared,
  ThemeTile,
} from '../types'
import { checkColors, makeColors } from './make-colors.js'

export const FORMAT = 'claude-theme/1'
export const SCENE = 'creator-scene'

const HEX = /^#[0-9a-fA-F]{6}$/
const RAW = /^(#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?|(rgb|hsl)a?\([0-9.,%\s/deg-]{1,60}\))$/
const PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9eE\s,.+-]+$/
const UNSAFE_SVG =
  /<\s*script|<\s*foreignObject|<\s*iframe|javascript:|\son[a-z]+\s*=|(href|src)\s*=\s*["']?\s*(https?:|\/\/|data:(?!image\/))|url\(\s*["']?\s*(https?:|\/\/)|@import/i
const ANCHORS = [
  'surface-0',
  'surface-1',
  'surface-2',
  'surface-3',
  'text-primary',
  'text-secondary',
  'text-muted',
] as const
const ROLES = ['accent', 'danger', 'success', 'warning', 'pro'] as const
const GIT = ['added', 'removed', 'modified', 'merged', 'closed', 'conflicting', 'draft'] as const
const NAMES = new Set(
  [
    ...ANCHORS,
    'text-disabled',
    'fill-primary',
    'on-primary',
    'border',
    'border-strong',
    'border-stronger',
    ...ROLES.flatMap(role => ['fill', 'text', 'bg', 'on', 'border'].map(part => `${part}-${role}`)),
  ].map(String),
)
const MAX_FILE = 200 * 1024
const MAX_LIST = 500
const MAX_ABOUT = 8000
const MAX_SCENE = 131072
const MAX_LINK = 2000
const INDEX_FORMAT = 'claude-theme-index/1'
const COMMUNITY_FILE = /^themes\/[a-z0-9-]{1,60}\.cctheme\.json$/

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const fail = (message: string): never => {
  throw new Error(message)
}

const line = (value: unknown, max: number): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }
  const text = value.replace(/\s+/g, ' ').trim().slice(0, max)

  return text === '' ? undefined : text
}

/**
 * A creator's about page, kept as words: no control characters, and a picture
 * becomes a plain link, so opening a page loads nothing from anywhere.
 */
const aboutOf = (value: unknown): string | undefined => {
  if (typeof value !== 'string') {
    return undefined
  }
  const text = value
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .replace(/!\[([^\]]*)\]/g, '[$1]')
    .replace(/<[^>]*>/g, '')
    .trim()
    .slice(0, MAX_ABOUT)

  return text === '' ? undefined : text
}

const hex = (value: unknown, where: string): string =>
  typeof value === 'string' && HEX.test(value)
    ? value.toLowerCase()
    : fail(`${where} must be a six-digit hex color such as #2f5d8c`)

const record = (value: unknown, where: string): Record<string, unknown> =>
  isRecord(value) ? value : fail(`"${where}" must be an object`)

const number = (value: unknown, where: string, min: number, max: number): number =>
  typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
    ? value
    : fail(`${where} must be a number from ${min} to ${max}`)

/** A record of hex colors under short keys: shades by stop, or tokens by name. */
const hexes = (value: unknown, where: string, key: RegExp): Record<string, string> | undefined => {
  if (value === undefined) {
    return undefined
  }
  const entries = Object.entries(record(value, where))

  if (entries.length > 200) {
    fail(`"${where}" holds too many entries`)
  }

  return Object.fromEntries(
    entries.map(([name, color]) => [
      key.test(name) ? name : fail(`${where}.${name.slice(0, 40)} is not a name ${where} takes`),
      hex(color, `${where}.${name}`),
    ]),
  )
}

const roleOf = (value: unknown, where: string): ThemeRole => {
  if (typeof value === 'string') {
    return hex(value, where)
  }
  const spec = record(value, where)
  const stops = hexes(spec.stops, `${where}.stops`, /^\d{1,3}$/)

  return {
    ...(spec.seed !== undefined && { seed: hex(spec.seed, `${where}.seed`) }),
    ...(stops !== undefined && { stops }),
    ...(spec.fillShade !== undefined && { fillShade: number(spec.fillShade, `${where}.fillShade`, 0, 900) }),
  }
}

const rolesOf = (value: unknown, where: string): ThemeRoles | undefined => {
  if (value === undefined) {
    return undefined
  }
  const from = record(value, where)
  const roles: ThemeRoles = {}

  for (const name of ROLES) {
    if (from[name] !== undefined) {
      roles[name] = roleOf(from[name], `${where}.${name}`)
    }
  }

  return roles
}

const gitOf = (value: unknown, where: string): ThemeGit | undefined => {
  if (value === undefined) {
    return undefined
  }
  const from = record(value, where)
  const git: ThemeGit = {}

  for (const name of GIT) {
    if (from[name] !== undefined) {
      git[name] = hex(from[name], `${where}.${name}`)
    }
  }

  return git
}

const modeOf = (value: unknown, mode: string): ThemeMode | undefined => {
  if (value === undefined) {
    return undefined
  }
  const from = record(value, mode)
  const out: ThemeMode = {
    'surface-0': hex(from['surface-0'], `${mode}.surface-0`),
    'text-primary': hex(from['text-primary'], `${mode}.text-primary`),
  }

  for (const name of ANCHORS) {
    if (from[name] !== undefined) {
      out[name] = hex(from[name], `${mode}.${name}`)
    }
  }
  const roles = rolesOf(from.roles, `${mode}.roles`)
  const git = gitOf(from.git, `${mode}.git`)
  const stops = hexes(from.stops, `${mode}.stops`, /^\d{1,3}$/)
  const tokens = hexes(from.tokens, `${mode}.tokens`, /^[a-z][a-z0-9-]{0,39}$/)

  return {
    ...out,
    ...(roles !== undefined && { roles }),
    ...(git !== undefined && { git }),
    ...(stops !== undefined && { stops }),
    ...(tokens !== undefined && { tokens }),
  }
}

/** A color of a background: a raw color, `transparent`, or one of the palette's names. */
const paint = (value: unknown, where: string): string =>
  typeof value === 'string' && (value === 'transparent' || NAMES.has(value) || RAW.test(value))
    ? value
    : fail(`${where} must be a color such as #1f1a15 or rgba(0,0,0,0.4), "transparent", or a palette name such as surface-0`)

const tileOf = (from: Record<string, unknown>, where: string): ThemeTile => {
  const size = from.size

  return {
    ...(size !== undefined && {
      size:
        Array.isArray(size) && size.length === 2
          ? [number(size[0], `${where}.size[0]`, 1, 256), number(size[1], `${where}.size[1]`, 1, 256)]
          : fail(`${where}.size must be [width, height]`),
    }),
    ...(from.repeat !== undefined && { repeat: from.repeat === true }),
  }
}

const glassOf = (value: unknown): ThemeGlass | false | undefined => {
  if (value === undefined || value === false) {
    return value
  }
  const from = record(value, 'background.glass')

  return {
    ...(from.blur !== undefined && { blur: number(from.blur, 'background.glass.blur', 0, 64) }),
    ...(from.opacity !== undefined && { opacity: number(from.opacity, 'background.glass.opacity', 0, 1) }),
    ...(from.tint !== undefined && {
      tint:
        typeof from.tint === 'string' && RAW.test(from.tint)
          ? from.tint
          : fail('background.glass.tint must be a raw color such as #101418 or rgba(16,20,24,0.5)'),
    }),
  }
}

const backgroundOf = (value: unknown): ThemeBackground | undefined => {
  if (value === undefined) {
    return undefined
  }
  const from = record(value, 'background')
  const kinds = ['color', 'gradient', 'pattern', 'scene'].filter(kind => from[kind] !== undefined)

  if (kinds.length !== 1) {
    fail('"background" takes exactly one of "color", "gradient", "pattern" or "scene"')
  }
  if (from.color !== undefined) {
    return { color: paint(from.color, 'background.color') }
  }
  if (from.gradient !== undefined) {
    const gradient = record(from.gradient, 'background.gradient')
    const stops = Array.isArray(gradient.stops) ? gradient.stops : []

    if (stops.length < 2 || stops.length > 16) {
      fail('background.gradient.stops takes 2 to 16 colors')
    }

    return {
      gradient: {
        ...tileOf(gradient, 'background.gradient'),
        stops: stops.map((stop, index): ThemeGradientStop => {
          const where = `background.gradient.stops[${index}]`

          return isRecord(stop)
            ? { at: number(stop.at, `${where}.at`, 0, 1), color: paint(stop.color, `${where}.color`) }
            : paint(stop, where)
        }),
        ...(gradient.angle !== undefined && { angle: number(gradient.angle, 'background.gradient.angle', -360, 360) }),
        ...(gradient.shape !== undefined && {
          shape:
            gradient.shape === 'linear' || gradient.shape === 'radial'
              ? gradient.shape
              : fail('background.gradient.shape is "linear" or "radial"'),
        }),
      },
    }
  }
  if (from.pattern !== undefined) {
    const pattern = record(from.pattern, 'background.pattern')
    const paths = Array.isArray(pattern.paths) ? pattern.paths : []
    const box = pattern.viewBox
    const d = (path: unknown, where: string): string =>
      typeof path === 'string' && path.length <= 16384 && PATH.test(path)
        ? path
        : fail(`${where} must be SVG path data, the text of a path's "d"`)

    if (paths.length < 1 || paths.length > 64) {
      fail('background.pattern.paths takes 1 to 64 paths')
    }

    return {
      pattern: {
        ...tileOf(pattern, 'background.pattern'),
        viewBox:
          Array.isArray(box) && box.length === 2
            ? [
                number(box[0], 'background.pattern.viewBox[0]', 1, 256),
                number(box[1], 'background.pattern.viewBox[1]', 1, 256),
              ]
            : number(box, 'background.pattern.viewBox', 1, 256),
        paths: paths.map((path, index): ThemePath => {
          const where = `background.pattern.paths[${index}]`

          return isRecord(path)
            ? {
                d: d(path.d, `${where}.d`),
                ...(path.strokeWidth !== undefined && {
                  strokeWidth: number(path.strokeWidth, `${where}.strokeWidth`, 0.01, 64),
                }),
                ...(path.color !== undefined && { color: paint(path.color, `${where}.color`) }),
              }
            : d(path, where)
        }),
        ...(pattern.color !== undefined && { color: paint(pattern.color, 'background.pattern.color') }),
      },
    }
  }
  const scene = typeof from.scene === 'string' ? from.scene.trim() : ''

  if (!/^<svg[\s>]/i.test(scene) || !/<\/svg>$/i.test(scene)) {
    fail('background.scene must be one SVG document, "<svg ...>...</svg>"')
  }
  if (scene.length > MAX_SCENE) {
    fail(`background.scene is over ${MAX_SCENE} characters`)
  }
  if (UNSAFE_SVG.test(scene)) {
    fail('background.scene may not hold scripts, event handlers or anything loaded from a link')
  }
  const alt = line(from.alt, 120)
  const glass = glassOf(from.glass)

  return { scene, ...(alt !== undefined && { alt }), ...(glass !== undefined && { glass }) }
}

const codeThemeOf = (value: unknown): ThemeDef['codeTheme'] => {
  if (value === undefined) {
    return undefined
  }
  const from = record(value, 'codeTheme')
  const name = (mode: 'light' | 'dark'): string | undefined =>
    from[mode] === undefined
      ? undefined
      : typeof from[mode] === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(from[mode])
        ? from[mode]
        : fail(`codeTheme.${mode} must be a code theme's name, such as "github-dark"`)
  const light = name('light')
  const dark = name('dark')

  return { ...(light !== undefined && { light }), ...(dark !== undefined && { dark }) }
}

/**
 * Reads a theme file. Only the known fields are kept, each checked, so a file
 * from anyone is colors, shapes and a few words, and nothing that runs.
 */
export const parseTheme = (text: string): Parsed<ThemeDef> => {
  if (text.length > MAX_FILE) {
    return { ok: false, error: 'the file is too large to be a theme' }
  }
  try {
    const raw: unknown = JSON.parse(text)

    if (!isRecord(raw)) {
      throw new Error('a theme file is one JSON object')
    }
    if (raw.format !== FORMAT) {
      throw new Error(`"format" must be "${FORMAT}"`)
    }
    const name = line(raw.name, 40) ?? fail('"name" is missing')
    const light = modeOf(raw.light, 'light')
    const dark = modeOf(raw.dark, 'dark')

    if (light === undefined && dark === undefined) {
      throw new Error('give "light", "dark" or both')
    }
    if (raw.mode !== undefined && raw.mode !== 'light' && raw.mode !== 'dark') {
      throw new Error('"mode" is "light" or "dark"')
    }
    if (raw.contrast !== undefined && raw.contrast !== 'more') {
      throw new Error('"contrast" is "more", or left out')
    }
    const author = line(raw.author, 60)
    const description = line(raw.description, 140)
    const about = aboutOf(raw.about)
    const roles = rolesOf(raw.roles, 'roles')
    const codeTheme = codeThemeOf(raw.codeTheme)
    const background = backgroundOf(raw.background)
    const value: ThemeDef = {
      format: FORMAT,
      name,
      ...(author !== undefined && { author }),
      ...(description !== undefined && { description }),
      ...(about !== undefined && { about }),
      ...(raw.mode !== undefined && { mode: raw.mode }),
      ...(raw.contrast !== undefined && { contrast: raw.contrast }),
      ...(codeTheme !== undefined && { codeTheme }),
      ...(roles !== undefined && { roles }),
      ...(light !== undefined && { light }),
      ...(dark !== undefined && { dark }),
      ...(background !== undefined && { background }),
    }

    return { ok: true, value }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Reads a community's index: per theme, where its file is in the repository
 * and a card of it, checked as any theme file is. A row that fails is left out.
 */
export const parseIndex = (text: string): Parsed<ThemeShared[]> => {
  try {
    const raw: unknown = JSON.parse(text)
    const rows: unknown = isRecord(raw) ? raw.themes : undefined

    if (!isRecord(raw) || raw.format !== INDEX_FORMAT || !Array.isArray(rows)) {
      throw new Error('this is not a theme community index')
    }
    const value: ThemeShared[] = []

    for (const row of rows.slice(0, MAX_LIST)) {
      const file = isRecord(row) && typeof row.file === 'string' ? row.file : ''
      const card = isRecord(row) ? parseTheme(JSON.stringify(row.card) ?? 'null') : undefined

      if (!isRecord(row) || !COMMUNITY_FILE.test(file) || card === undefined || !card.ok) {
        continue
      }
      const extra = (Array.isArray(row.extras) ? row.extras : []).slice(0, 8).flatMap(one => line(one, 30) ?? [])

      value.push({ file, theme: card.value, extras: extra, isFull: false })
    }

    return { ok: true, value }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

/** A community's repository, as `owner/name` on GitHub, or undefined for anything else. */
export const repoOf = (value: unknown): string | undefined =>
  typeof value === 'string' && /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/.test(value.trim()) ? value.trim() : undefined

export const rawUrl = (repo: string, file: string): string => `https://raw.githubusercontent.com/${repo}/main/${file}`

/**
 * The page a creator submits a theme on. The theme rides in the link where it
 * is short enough for one, so the page opens already filled in.
 */
export const submitUrl = (repo: string, def: ThemeDef): { href: string; isFilled: boolean } => {
  const base = `https://github.com/${repo}/issues/new?template=submit-theme.yml&title=${encodeURIComponent(`Theme: ${def.name}`)}`
  const filled = `${base}&theme=${encodeURIComponent(JSON.stringify(def))}`

  return filled.length <= MAX_LINK ? { href: filled, isFilled: true } : { href: base, isFilled: false }
}

/** Whether a theme matches what the person typed in the gallery's search. */
export const matches = (def: ThemeDef, query: string): boolean => {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const text = `${def.name} ${def.author ?? ''} ${def.description ?? ''}`.toLowerCase()

  return words.every(word => text.includes(word))
}

export const isHttps = (url: string): boolean => /^https:\/\/[^\s/]+\/?\S*$/.test(url)

const half = (mode: ThemeMode) => {
  const { roles, git, stops, tokens: _tokens, ...anchors } = mode

  return {
    gray: { anchors, ...(stops !== undefined && { stops }) },
    ...(roles !== undefined && { roles }),
    ...(git !== undefined && { git }),
  }
}

const withTokens = (theme: ThemeColors, def: ThemeDef): ThemeColors => {
  const merged = (mode: 'light' | 'dark') => {
    const base = theme.inputs[mode]
    const tokens = def[mode]?.tokens

    return base === undefined ? undefined : { ...base, ...(tokens as Record<string, `#${string}`> | undefined) }
  }
  const light = merged('light')
  const dark = merged('dark')

  return { ...theme, inputs: { ...(light !== undefined && { light }), ...(dark !== undefined && { dark }) } }
}

const backdropOf = (background: ThemeBackground): unknown => {
  if ('color' in background) {
    return background
  }
  if ('gradient' in background) {
    return background
  }
  if ('pattern' in background) {
    return { vector: background.pattern }
  }

  return { scene: SCENE, ...(background.glass !== undefined && { glass: background.glass }) }
}

/** The whole look a theme sets, or why the app would not paint it. */
export const build = (def: ThemeDef): Parsed<{ look: ThemeSetArgs; scene: ThemeLiveScene }> => {
  try {
    const only = def.light === undefined ? 'dark' : def.dark === undefined ? 'light' : undefined
    const { theme, problems } = makeColors({
      label: def.name,
      ...(def.roles !== undefined && { roles: def.roles }),
      ...(def.light !== undefined && { light: half(def.light) }),
      ...(def.dark !== undefined && { dark: half(def.dark) }),
      ...(def.codeTheme !== undefined && { codeTheme: def.codeTheme }),
      ...(def.contrast !== undefined && { contrast: def.contrast }),
      ...(only !== undefined && { only }),
    })
    const hasTokens = def.light?.tokens !== undefined || def.dark?.tokens !== undefined
    const colors = hasTokens ? withTokens(theme, def) : theme
    const lines = hasTokens ? checkColors(colors) : problems
    const refused = lines.find(
      problem => problem.startsWith("Desktop won't paint") || problem.includes("isn't a theme color name"),
    )

    if (refused !== undefined) {
      return { ok: false, error: refused }
    }
    const { background } = def
    const look = {
      colors,
      ...(def.mode !== undefined && { overrideColorScheme: def.mode }),
      ...(background !== undefined && { backdrop: backdropOf(background) }),
    } as ThemeSetArgs
    const scene =
      background !== undefined && 'scene' in background
        ? { svg: background.scene, alt: background.alt ?? `The ${def.name} theme's background` }
        : null

    return { ok: true, value: { look, scene } }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export const slug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'theme'

export const isSameName = (a: string, b: string): boolean => slug(a) === slug(b)

/** What a theme changes beyond its colors, in a few words, for its card and page. */
export const extras = (def: ThemeDef): string[] => {
  const { background } = def
  const hasFine = [def.light, def.dark].some(
    mode => mode?.tokens !== undefined || mode?.stops !== undefined || mode?.git !== undefined,
  )

  return [
    ...(background === undefined
      ? []
      : 'scene' in background
        ? ['moving background']
        : 'pattern' in background
          ? ['patterned background']
          : 'gradient' in background
            ? ['gradient background']
            : ['background color']),
    ...(def.codeTheme === undefined ? [] : ['code colors']),
    ...(def.contrast === undefined ? [] : ['high contrast']),
    ...(def.mode === undefined ? [] : [`${def.mode} only`]),
    ...(hasFine ? ['hand-tuned details'] : []),
  ]
}

/** What `/themes new` writes: a whole theme for the person to recolor. */
export const template = (name: string): ThemeDef => ({
  format: FORMAT,
  name,
  author: 'Your name',
  description: 'One line about the look',
  about: [
    `# ${name}`,
    '',
    'This is your about page: people see it when they open your theme in the gallery.',
    'Write it in markdown. Say what the look is for, what inspired it, and how to reach you.',
    '',
    '- Lists, **bold**, headings and [links](https://example.com) work',
    '- Pictures are shown as links',
  ].join('\n'),
  roles: {
    accent: '#2f5d8c',
    danger: '#b3392f',
    success: '#4e7d3a',
    warning: '#a86f14',
    pro: '#6d4f94',
  },
  light: {
    'surface-0': '#efe6d3',
    'surface-1': '#f4ecdc',
    'surface-2': '#faf5e9',
    'text-primary': '#2a241d',
    'text-secondary': '#544a3d',
    'text-muted': '#6a5f50',
  },
  dark: {
    'surface-0': '#1f1a15',
    'surface-1': '#28221b',
    'surface-2': '#312a22',
    'surface-3': '#3a3229',
    'text-primary': '#f0e7d7',
    'text-secondary': '#cfc4b2',
    'text-muted': '#aca08d',
  },
  background: { gradient: { stops: ['surface-0', 'surface-1'], angle: 180 } },
})

export const BUILT_IN: readonly ThemeDef[] = [
  {
    ...template('Paper'),
    author: 'Theme Gallery',
    description: 'Warm paper by day, lamp-lit paper by night',
    about: [
      '# Paper',
      '',
      'A notebook look. By day the page is warm cream with ink-brown words; by night it is the same paper under a lamp.',
      '',
      'Made for long reading: nothing is pure white or pure black, and the accent is a quiet fountain-pen blue.',
    ].join('\n'),
  },
  {
    format: FORMAT,
    name: 'Fjord',
    author: 'Theme Gallery',
    description: 'Cool slate blues, like water under cloud',
    about: [
      '# Fjord',
      '',
      'Cold water under cloud. Slate-blue surfaces a few shades apart, with a clear blue accent.',
      '',
      'A good fit if you like a calm, cool screen in both modes.',
    ].join('\n'),
    roles: {
      accent: '#3b7ea6',
      danger: '#b8474a',
      success: '#4c8a6a',
      warning: '#b0862b',
      pro: '#7a68a8',
    },
    light: {
      'surface-0': '#e3e9ee',
      'surface-1': '#ebf0f4',
      'surface-2': '#f4f7f9',
      'text-primary': '#1c2630',
      'text-secondary': '#3d4b58',
      'text-muted': '#55636f',
    },
    dark: {
      'surface-0': '#161c22',
      'surface-1': '#1c242b',
      'surface-2': '#232c34',
      'surface-3': '#29333c',
      'text-primary': '#e4ebf1',
      'text-secondary': '#bcc8d2',
      'text-muted': '#98a6b2',
    },
  },
  {
    format: FORMAT,
    name: 'Moss',
    author: 'Theme Gallery',
    description: 'Soft forest greens on stone',
    about: [
      '# Moss',
      '',
      'Forest floor and lichen on stone. Grey-green surfaces with a leaf-green accent.',
      '',
      'The dark mode is a wood at dusk, not an inversion of the light one.',
    ].join('\n'),
    roles: {
      accent: '#4f7d45',
      danger: '#b04a3a',
      success: '#3f8562',
      warning: '#a87a1e',
      pro: '#7c6399',
    },
    light: {
      'surface-0': '#e4e8dc',
      'surface-1': '#ecefe5',
      'surface-2': '#f5f7f0',
      'text-primary': '#20261c',
      'text-secondary': '#434c3c',
      'text-muted': '#5a6352',
    },
    dark: {
      'surface-0': '#171b15',
      'surface-1': '#1e231b',
      'surface-2': '#252b22',
      'surface-3': '#2c3328',
      'text-primary': '#e6ebdf',
      'text-secondary': '#c1c9b7',
      'text-muted': '#9ea793',
    },
  },
  {
    format: FORMAT,
    name: 'Aurora',
    author: 'Theme Gallery',
    description: 'Night sky with slow northern lights behind the chat',
    about: [
      '# Aurora',
      '',
      'A dark-only theme that shows what a theme file can do beyond colors: a moving background, frosted panels over it, and the app held in dark mode while it is on.',
      '',
      'The lights are one small SVG animated with CSS. Export this theme to read how it is written.',
    ].join('\n'),
    mode: 'dark',
    roles: {
      accent: '#3fa58f',
      danger: '#c2525a',
      success: '#4c9a6e',
      warning: '#b58a2e',
      pro: '#8a6fc0',
    },
    dark: {
      'surface-0': '#0f1420',
      'surface-1': '#151b29',
      'surface-2': '#1b2231',
      'surface-3': '#202838',
      'text-primary': '#e6ecf5',
      'text-secondary': '#bcc6d6',
      'text-muted': '#97a3b6',
    },
    background: {
      alt: 'Slow green and violet northern lights over a dark sky',
      glass: { blur: 24, tint: '#0f1420', opacity: 0.7 },
      scene: [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">',
        '<style>',
        '.a{animation:drift 26s ease-in-out infinite alternate;transform-origin:50% 0}',
        '.b{animation:drift 38s ease-in-out infinite alternate-reverse;transform-origin:50% 0}',
        '@keyframes drift{from{transform:translateX(-90px) scaleY(1)}to{transform:translateX(90px) scaleY(1.25)}}',
        '</style>',
        '<defs>',
        '<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#070b14"/><stop offset="1" stop-color="#121a2b"/></linearGradient>',
        '<linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3fd6a8" stop-opacity="0"/><stop offset="0.45" stop-color="#3fd6a8" stop-opacity="0.5"/><stop offset="1" stop-color="#3fd6a8" stop-opacity="0"/></linearGradient>',
        '<linearGradient id="v" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8a6fe0" stop-opacity="0"/><stop offset="0.5" stop-color="#8a6fe0" stop-opacity="0.4"/><stop offset="1" stop-color="#8a6fe0" stop-opacity="0"/></linearGradient>',
        '<filter id="soft"><feGaussianBlur stdDeviation="40"/></filter>',
        '</defs>',
        '<rect width="1600" height="900" fill="url(#sky)"/>',
        '<g filter="url(#soft)">',
        '<path class="a" fill="url(#g)" d="M-200 80 C 200 -40 500 260 800 120 S 1400 -20 1800 140 L 1800 620 C 1400 480 1100 700 800 560 S 200 420 -200 600 Z"/>',
        '<path class="b" fill="url(#v)" d="M-200 220 C 300 80 600 380 900 240 S 1500 120 1800 260 L 1800 700 C 1500 580 1200 780 900 660 S 300 540 -200 700 Z"/>',
        '</g>',
        '</svg>',
      ].join(''),
    },
  },
]

const mix = (a: string, b: string, share: number): string => {
  const part = (color: string, at: number): number => parseInt(color.slice(at, at + 2), 16)
  const blend = (at: number): string =>
    Math.round(part(a, at) * (1 - share) + part(b, at) * share)
      .toString(16)
      .padStart(2, '0')

  return `#${blend(1)}${blend(3)}${blend(5)}`
}

/** The page of the preview: the theme's background where it is a color or a gradient. */
const ground = (def: ThemeDef, anchors: ThemeMode, id: string): { fill: string; defs: string } => {
  const page = anchors['surface-0']
  const named = (color: string): string =>
    color === 'transparent' ? page : NAMES.has(color) ? ((anchors as unknown as Record<string, string | undefined>)[color] ?? page) : color
  const { background } = def

  if (background === undefined || 'scene' in background || 'pattern' in background) {
    return { fill: page, defs: '' }
  }
  if ('color' in background) {
    return { fill: named(background.color), defs: '' }
  }
  const { stops, angle = 180, shape } = background.gradient
  const marks = stops
    .map((stop, index) => {
      const at = typeof stop === 'string' ? index / (stops.length - 1) : stop.at

      return `<stop offset="${at}" stop-color="${named(typeof stop === 'string' ? stop : stop.color)}"/>`
    })
    .join('')
  const turn = (angle * Math.PI) / 180
  const dx = Math.sin(turn) / 2
  const dy = -Math.cos(turn) / 2
  const line = `x1="${0.5 - dx}" y1="${0.5 - dy}" x2="${0.5 + dx}" y2="${0.5 + dy}"`

  return {
    fill: `url(#${id})`,
    defs: shape === 'radial' ? `<radialGradient id="${id}">${marks}</radialGradient>` : `<linearGradient id="${id}" ${line}>${marks}</linearGradient>`,
  }
}

const seed = (role: ThemeRole | undefined, fallback: string): string =>
  role === undefined ? fallback : typeof role === 'string' ? role : (role.seed ?? fallback)

/** One mode of the preview: a small window of the app. */
const scene = (def: ThemeDef, anchors: ThemeMode, id: string, x: number, width: number): string => {
  const roles = { ...def.roles, ...anchors.roles }
  const page = anchors['surface-0']
  const ink = anchors['text-primary']
  const card = anchors['surface-1'] ?? mix(page, ink, 0.04)
  const panel = anchors['surface-2'] ?? mix(page, ink, 0.08)
  const soft = anchors['text-secondary'] ?? mix(ink, page, 0.25)
  const faint = anchors['text-muted'] ?? mix(ink, page, 0.45)
  const accent = seed(roles.accent, '#4a7fb5')
  const dots = [
    seed(roles.danger, '#b8474a'),
    seed(roles.warning, '#b0862b'),
    seed(roles.success, '#4c8a6a'),
    seed(roles.pro, '#7a68a8'),
  ]
  const side = Math.round(width * 0.28)
  const left = x + side + 10
  const room = width - side - 20
  const { fill, defs } = ground(def, anchors, id)
  const bar = (y: number, share: number, color: string, height = 4): string =>
    `<rect x="${left}" y="${y}" width="${Math.round(room * share)}" height="${height}" rx="2" fill="${color}"/>`

  return [
    defs === '' ? '' : `<defs>${defs}</defs>`,
    `<rect x="${x}" y="0" width="${width}" height="110" fill="${fill}"/>`,
    `<rect x="${x}" y="0" width="${side}" height="110" fill="${card}" opacity="${def.background === undefined ? 1 : 0.8}"/>`,
    ...[14, 26, 38, 50].map(
      (y, index) =>
        `<rect x="${x + 8}" y="${y}" width="${side - 16}" height="5" rx="2.5" fill="${index === 1 ? accent : faint}" opacity="${index === 1 ? 1 : 0.55}"/>`,
    ),
    bar(14, 0.5, ink, 6),
    bar(28, 0.95, soft),
    bar(36, 0.8, soft),
    bar(44, 0.6, faint),
    `<rect x="${left}" y="56" width="${room}" height="26" rx="4" fill="${panel}"/>`,
    ...dots.map(
      (color, index) => `<rect x="${left + 8 + index * 18}" y="66" width="12" height="5" rx="2.5" fill="${color}"/>`,
    ),
    `<rect x="${left}" y="90" width="${room - 30}" height="12" rx="6" fill="${card}" stroke="${faint}" stroke-opacity="0.4"/>`,
    `<rect x="${left + room - 24}" y="90" width="24" height="12" rx="6" fill="${accent}"/>`,
  ].join('')
}

/**
 * A picture of the app in a theme's colors, drawn from the theme itself: light
 * on the left and dark on the right when it has both. It loads nothing.
 */
export const preview = (def: ThemeDef): string => {
  const modes = [def.light, def.dark].filter(mode => mode !== undefined)
  const width = 320 / Math.max(1, modes.length)
  const edge = modes[0]?.['text-muted'] ?? '#888888'

  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 110" width="320" height="110">',
    '<defs><clipPath id="frame"><rect width="320" height="110" rx="8"/></clipPath></defs>',
    '<g clip-path="url(#frame)">',
    ...modes.map((mode, index) => scene(def, mode, `ground${index}`, index * width, width)),
    '</g>',
    `<rect x="0.5" y="0.5" width="319" height="109" rx="8" fill="none" stroke="${edge}" stroke-opacity="0.5"/>`,
    '</svg>',
  ].join('')
}

/** The colors a surface with no pictures shows instead, a few per mode. */
export const swatches = (def: ThemeDef): string[] =>
  [def.light, def.dark].flatMap(mode =>
    mode === undefined
      ? []
      : [
          mode['surface-0'],
          mode['surface-1'] ?? mode['surface-0'],
          mode['text-primary'],
          seed({ ...def.roles, ...mode.roles }.accent, mode['text-primary']),
        ],
  )
