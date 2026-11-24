import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine, TestBody } from 'claude-code/testing'

// What a command typed at the prompt carries: where it came from and how it shows.
const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

const PANE = {
  plugin: 'theme-gallery',
  component: 'Pane',
  requestId: 'theme-gallery',
  props: {
    title: 'Themes',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const SHARED = JSON.stringify({
  format: 'claude-theme/1',
  name: 'Harbour',
  author: 'Someone',
  script: 'ignored',
  light: { 'surface-0': '#e3e9ee', 'text-primary': '#1c2630', 'text-muted': '#55636f' },
  dark: { 'surface-0': '#161c22', 'text-primary': '#e4ebf1', 'text-muted': '#98a6b2' },
})

test('a built-in theme is applied, kept, and shown as on', async ($, on) => {
  const store = new Map<string, unknown>()
  const themes: unknown[] = []
  on('command.register', () => ({ value: { command: 'themes' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => {
    store.set(e.key, e.value)

    return { value: undefined }
  })
  on('theme.set', (_, e) => {
    themes.push(e)

    return { value: { isDrawn: true, requestId: 'theme' } }
  })

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ran = await $.command.run({ ...RUN, command: 'themes', args: 'apply fjord' })

  expect(ran.text).toBe('Fjord is on.')
  expect(themes.length).toBe(1)
  expect((store.get('active') as { name: string }).name).toBe('Fjord')

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })

    expect((await ui.find({ type: 'Text', text: /On now/ }))?.text).toBe('On now: Fjord')
    await ui.unmount()
  }
})

test('a shared theme file is added from a link, as colors only', async ($, on) => {
  const store = new Map<string, unknown>()
  on('command.register', () => ({ value: { command: 'themes' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => {
    store.set(e.key, e.value)

    return { value: undefined }
  })
  on('theme.set', () => ({ value: { isDrawn: true, requestId: 'theme' } }))
  on('http.fetch', () => ({
    value: { status: 200, ok: true, headers: {}, text: SHARED },
  }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ran = await $.command.run({ ...RUN,
    command: 'themes',
    args: 'import https://example.com/harbour.cctheme.json',
  })

  expect(ran.text).toBe('Harbour is on.')
  const [kept] = store.get('mine') as Record<string, unknown>[]
  expect(kept?.name).toBe('Harbour')
  expect(kept?.script).toBe(undefined)

  const plain = await $.command.run({ ...RUN,
    command: 'themes',
    args: 'import http://example.com/harbour.cctheme.json',
  })
  expect(plain.text).toBe('Not added: only https links are read.')
})

test('a file that is no theme is refused with the reason', async ($, on) => {
  on('command.register', () => ({ value: { command: 'themes' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('store.get', () => ({ value: undefined }))
  on('fs.read', () => ({ value: '{"format":"claude-theme/1","name":"Bad","dark":{"surface-0":"red","text-primary":"#ffffff"}}' }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  const ran = await $.command.run({ ...RUN, command: 'themes', args: 'import bad.cctheme.json' })

  expect(ran.text).toBe('Not added: dark.surface-0 must be a six-digit hex color such as #2f5d8c.')
})

test('a theme shows a preview, and its name opens the about page', async ($, on) => {
  on('command.register', () => ({ value: { command: 'themes' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('store.get', () => ({ value: undefined }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })

    if (surface === 'desktop') {
      const picture = await ui.find({ type: 'Svg' })
      expect(picture?.props.alt).toBe('A preview of the Paper theme')
    }
    await ui.press({ key: 'about:built-in:fjord' })
    expect((await ui.find({ type: 'Markdown' }))?.props.text).toMatch(/^# Fjord/)
    expect((await ui.find({ type: 'Button', key: 'use' }))?.text).toBe('Use this theme')

    await ui.press({ key: 'back' })
    expect((await ui.find({ type: 'Text', text: /On now/ }))?.text).toBe("On now: the app's own look")
    await ui.unmount()
  }
})

test('an about page from a shared file is kept as words', async ($, on) => {
  const store = new Map<string, unknown>()
  on('command.register', () => ({ value: { command: 'themes' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => {
    store.set(e.key, e.value)

    return { value: undefined }
  })
  on('theme.set', () => ({ value: { isDrawn: true, requestId: 'theme' } }))
  on('fs.read', () => ({
    value: JSON.stringify({
      ...JSON.parse(SHARED),
      about: '# Harbour\n\n![shot](https://example.com/track.png) <img src="https://example.com/x.png"> Made by the sea.',
    }),
  }))

  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ ...RUN, command: 'themes', args: 'import harbour.cctheme.json' })

  const [kept] = store.get('mine') as { about: string }[]
  expect(kept?.about).toBe('# Harbour\n\n[shot](https://example.com/track.png)  Made by the sea.')
})

const FULL = {
  format: 'claude-theme/1',
  name: 'Everything',
  mode: 'dark',
  contrast: 'more',
  codeTheme: { dark: 'nord' },
  roles: { accent: { seed: '#3b7ea6', fillShade: 600 }, danger: '#b8474a' },
  dark: {
    'surface-0': '#161c22',
    'surface-1': '#1c242b',
    'text-primary': '#e4ebf1',
    'text-muted': '#98a6b2',
    roles: { success: '#4c8a6a' },
    git: { added: '#3fa56b' },
    stops: { '500': '#7b8892' },
    tokens: { 'role-tooltip-bg': '#0b0f14' },
  },
  background: { gradient: { stops: ['surface-0', { at: 1, color: '#0b1016' }], angle: 135 } },
}

const start = async ($: Engine, on: On, file: unknown) => {
  const looks: Record<string, unknown>[] = []
  on('command.register', () => ({ value: { command: 'themes' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('theme.set', (_, e) => {
    looks.push(e as Record<string, unknown>)

    return { value: { isDrawn: true, requestId: 'theme' } }
  })
  on('fs.read', () => ({ value: JSON.stringify(file) }))
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  return looks
}

test('a theme sets its mode, code colors, single tokens and a gradient background', async ($, on) => {
  const looks = await start($, on, FULL)
  const ran = await $.command.run({ ...RUN, command: 'themes', args: 'import everything.cctheme.json' })

  expect(ran.text).toBe('Everything is on.')
  const look = looks[0] as {
    overrideColorScheme: string
    backdrop: { gradient: { angle: number } }
    colors: { contrast: string; codeTheme: { dark: string }; inputs: { dark: Record<string, string> } }
  }
  expect(look.overrideColorScheme).toBe('dark')
  expect(look.backdrop.gradient.angle).toBe(135)
  expect(look.colors.contrast).toBe('more')
  expect(look.colors.codeTheme.dark).toBe('nord')
  expect(look.colors.inputs.dark['role-tooltip-bg']).toBe('#0b0f14')
  expect(look.colors.inputs.dark['gray-500']).toBe('#7b8892')
})

test('a token that is no design token is refused by name', async ($, on) => {
  await start($, on, { ...FULL, dark: { ...FULL.dark, tokens: { background: '#000000' } } })
  const ran = await $.command.run({ ...RUN, command: 'themes', args: 'import x.cctheme.json' })

  expect(ran.text).toMatch(/inputs\.dark\.background isn't a theme color name/)
})

test('a moving background is drawn from the theme, and one that could run or load is refused', async ($, on) => {
  const looks = await start($, on, {
    ...FULL,
    background: { scene: '<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>' },
  })
  const bad = await $.command.run({ ...RUN, command: 'themes', args: 'import x.cctheme.json' })
  expect(bad.text).toMatch(/may not hold scripts/)

  const ran = await $.command.run({ ...RUN, command: 'themes', args: 'apply aurora' })
  expect(ran.text).toBe('Aurora is on.')
  const look = looks[0] as { backdrop: { scene: string; glass: { blur: number } } }
  expect(look.backdrop.scene).toBe('creator-scene')
  expect(look.backdrop.glass.blur).toBe(24)

  const ui = await $.ui.mount({
    plugin: 'theme-gallery',
    component: 'Backdrop',
    requestId: 'backdrop',
    surface: 'desktop',
    props: { scene: 'creator-scene', plugin: 'theme-gallery', glass: false },
  })
  expect((await ui.find({ type: 'Svg' }))?.props.alt).toBe('Slow green and violet northern lights over a dark sky')
  await ui.unmount()
})
