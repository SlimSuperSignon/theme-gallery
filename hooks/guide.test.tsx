import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine, TestBody } from 'claude-code/testing'

// What a command typed at the prompt carries: where it came from and how it shows.
const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

const BASE = {
  format: 'claude-theme/1',
  name: 'Harbour',
  dark: { 'surface-0': '#161c22', 'text-primary': '#e4ebf1', 'text-muted': '#98a6b2' },
}

// Each example the README's creator guide gives, as a theme file.
const EXAMPLES: Record<string, unknown> = {
  smallest: BASE,
  described: {
    ...BASE,
    author: 'Your name',
    description: 'Cool slate blues, like water under cloud',
    about: '# Harbour\n\nMade for long evenings.\n\n- Calm, low-glare dark mode\n- Find me at [my site](https://example.com)',
  },
  roles: {
    ...BASE,
    roles: { accent: '#3b7ea6', danger: '#b8474a', success: '#4c8a6a', warning: '#b0862b', pro: '#7a68a8' },
    dark: { ...BASE.dark, roles: { accent: '#5aa7d6' } },
  },
  code: { ...BASE, codeTheme: { light: 'github-light', dark: 'nord' }, contrast: 'more', mode: 'dark' },
  color: { ...BASE, background: { color: 'surface-1' } },
  gradient: {
    ...BASE,
    background: {
      gradient: { stops: ['surface-0', { at: 0.7, color: 'bg-accent' }, 'surface-1'], angle: 135, shape: 'linear' },
    },
  },
  pattern: {
    ...BASE,
    background: {
      pattern: {
        viewBox: 24,
        size: [24, 24],
        repeat: true,
        color: 'border',
        paths: ['M11 11h2v2h-2z', { d: 'M0 0L24 24', strokeWidth: 0.5, color: 'border-strong' }],
      },
    },
  },
  scene: {
    ...BASE,
    background: {
      scene:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice"><style>.sun{animation:rise 40s ease-in-out infinite alternate}@keyframes rise{to{transform:translateY(-60px)}}</style><rect width="1600" height="900" fill="#0f1420"/><circle class="sun" cx="1200" cy="500" r="160" fill="#e0a458" opacity="0.35"/></svg>',
      alt: 'A dim sun rising slowly over a dark sky',
      glass: { blur: 24, tint: '#0f1420', opacity: 0.7 },
    },
  },
  shaded: {
    ...BASE,
    roles: { accent: { seed: '#3b7ea6', fillShade: 600, stops: { '700': '#2c6183' } } },
  },
  fine: {
    ...BASE,
    dark: {
      ...BASE.dark,
      git: { added: '#3fa56b', removed: '#d0565c', modified: '#c79a3a' },
      stops: { '500': '#7b8892', '650': '#4f5b66' },
      tokens: {
        'role-tooltip-bg': '#0b0f14',
        'role-tooltip-fg': '#e4ebf1',
        'role-accent-fill': '#3b7ea6',
        'role-accent-fill-hover': '#4a8fb8',
        'role-accent-on': '#ffffff',
      },
    },
  },
}

for (const [name, file] of Object.entries(EXAMPLES)) {
  test(`the guide's ${name} example is a theme the app paints`, async ($, on) => {
    on('command.register', () => ({ value: { command: 'themes' } }))
    on('session.start', (_, e) => ({ cwd: e.cwd }))
    on('store.get', () => ({ value: undefined }))
    on('store.set', () => ({ value: undefined }))
    on('theme.set', () => ({ value: { isDrawn: true, requestId: 'theme' } }))
    on('fs.read', () => ({ value: JSON.stringify(file) }))

    await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
    const ran = await $.command.run({ ...RUN, command: 'themes', args: 'import harbour.cctheme.json' })

    expect(ran.text).toBe('Harbour is on.')
  })
}

test('every built-in theme and the starter file are themes the app paints', async ($, on) => {
  on('command.register', () => ({ value: { command: 'themes' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('theme.set', () => ({ value: { isDrawn: true, requestId: 'theme' } }))
  let written = ''
  on('fs.exists', () => ({ value: false }))
  on('fs.write', (_, e) => {
    written = e.text

    return { value: undefined }
  })
  on('fs.read', () => ({ value: written }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const name of ['Paper', 'Fjord', 'Moss', 'Aurora']) {
    expect((await $.command.run({ ...RUN, command: 'themes', args: `apply ${name}` })).text).toBe(`${name} is on.`)
  }
  await $.command.run({ ...RUN, command: 'themes', args: 'new Dune' })
  expect((await $.command.run({ ...RUN, command: 'themes', args: 'import dune.cctheme.json' })).text).toBe('Dune is on.')
})
