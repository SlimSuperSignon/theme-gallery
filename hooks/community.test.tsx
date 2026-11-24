import { expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'
import type { Engine, TestBody } from 'claude-code/testing'

// What a command typed at the prompt carries: where it came from and how it shows.
const RUN = { origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

const PANE = {
  plugin: 'theme-gallery',
  component: 'Pane',
  requestId: 'theme-gallery',
  surface: 'desktop',
  props: {
    title: 'Themes',
    isFocused: false,
    bodyColumns: 60,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 30 },
    view: {},
  },
} as const

const CARD = {
  format: 'claude-theme/1',
  name: 'Harbour',
  author: 'Someone',
  description: 'Still water at dusk',
  light: { 'surface-0': '#e3e9ee', 'text-primary': '#1c2630', 'text-muted': '#55636f' },
  dark: { 'surface-0': '#161c22', 'text-primary': '#e4ebf1', 'text-muted': '#98a6b2' },
}
const WHOLE = { ...CARD, about: '# Harbour\n\nMade by the sea.' }
const INDEX = {
  format: 'claude-theme-index/1',
  themes: [
    { file: 'themes/harbour.cctheme.json', extras: ['sparkles'], card: CARD },
    { file: '../secrets.json', extras: [], card: { ...CARD, name: 'Escape' } },
    { file: 'themes/broken.cctheme.json', extras: [], card: { ...CARD, name: 'Broken', dark: { 'surface-0': 'red' } } },
  ],
}

type Kit = Parameters<TestBody>

const start = async ($: Kit[0], on: Kit[1]) => {
  const store = new Map<string, unknown>()
  const fetched: string[] = []
  on('command.register', () => ({ value: { command: 'themes' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('ui.copy', () => ({ value: { isCopied: true } }))
  on('clock.now', () => ({ value: 1_000_000_000_000 }))
  on('store.get', (_, e) => ({ value: store.get(e.key) }))
  on('store.set', (_, e) => {
    store.set(e.key, e.value)

    return { value: undefined }
  })
  on('fs.write', () => ({ value: undefined }))
  on('theme.set', () => ({ value: { isDrawn: true, requestId: 'theme' } }))
  on('http.fetch', (_, e) => {
    fetched.push(e.url)
    const text = e.url.endsWith('/index.json') ? INDEX : e.url.endsWith('/themes/harbour.cctheme.json') ? WHOLE : undefined

    return {
      value:
        text === undefined
          ? { status: 404, ok: false, headers: {}, text: '' }
          : { status: 200, ok: true, headers: {}, text: JSON.stringify(text) },
    }
  })
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })

  return { store, fetched }
}

test('choosing a community lists its themes from one index, leaving out rows that are not themes', async ($, on) => {
  const { fetched } = await start($, on)
  const ran = await $.command.run({ ...RUN, command: 'themes', args: 'community https://github.com/someone/themes/' })

  expect(ran.text).toBe('The community is now someone/themes. 1 community themes.')
  expect(fetched).toEqual(['https://raw.githubusercontent.com/someone/themes/main/index.json'])

  const ui = await $.ui.mount(PANE)
  expect((await ui.find({ type: 'Button', key: 'about:community:harbour' }))?.text).toMatch(/Harbour/)
  expect(await ui.find({ type: 'Button', key: 'about:community:escape' })).toBe(undefined)
  expect((await ui.find({ type: 'Text', text: /sparkles/ }))?.text).toBe('+ sparkles')
  await ui.unmount()
})

test('a community theme opens with its about page, and one click adds it and turns it on', async ($, on) => {
  const { store, fetched } = await start($, on)
  await $.command.run({ ...RUN, command: 'themes', args: 'community someone/themes' })

  const ui = await $.ui.mount(PANE)
  await ui.press({ key: 'about:community:harbour' })
  expect((await ui.find({ type: 'Markdown' }))?.props.text).toMatch(/Made by the sea/)
  expect((await ui.find({ type: 'Button', key: 'use' }))?.text).toBe('Add and use')

  await ui.press({ key: 'use' })
  const [kept] = store.get('mine') as { name: string; about: string }[]
  expect(kept?.name).toBe('Harbour')
  expect(kept?.about).toMatch(/Made by the sea/)
  expect((store.get('active') as { name: string }).name).toBe('Harbour')
  // The whole file is fetched once, when the theme is opened.
  expect(fetched.filter(url => url.endsWith('harbour.cctheme.json')).length).toBe(1)
  await ui.unmount()
})

test('a community theme is downloaded by name', async ($, on) => {
  const { store } = await start($, on)
  await $.command.run({ ...RUN, command: 'themes', args: 'community someone/themes' })
  const ran = await $.command.run({ ...RUN, command: 'themes', args: 'get harbour' })

  expect(ran.text).toBe('Harbour is on.')
  expect((store.get('mine') as unknown[]).length).toBe(1)
})

test('search narrows every shelf', async ($, on) => {
  await start($, on)
  await $.command.run({ ...RUN, command: 'themes', args: 'community someone/themes' })

  const ui = await $.ui.mount(PANE)
  await ui.input({ key: 'search', text: 'dusk' })
  expect((await ui.find({ type: 'Button', key: 'about:community:harbour' }))?.text).toMatch(/Harbour/)
  expect(await ui.find({ type: 'Button', key: 'about:built-in:fjord' })).toBe(undefined)
  expect((await ui.find({ type: 'Text', text: /match/ }))?.text).toBe('1 match "dusk".')

  await ui.press({ key: 'clear' })
  expect((await ui.find({ type: 'Button', key: 'about:built-in:fjord' }))?.text).toMatch(/Fjord/)
  await ui.unmount()
})

test('publishing a theme of your own gives the submission page, filled in where it fits', async ($, on) => {
  await start($, on)
  await $.command.run({ ...RUN, command: 'themes', args: 'community someone/themes' })
  await $.command.run({ ...RUN, command: 'themes', args: 'get harbour' })

  const ran = await $.command.run({ ...RUN, command: 'themes', args: 'publish harbour' })
  const url = (ran.text ?? '').split('\n')[1] ?? ''
  expect(url.startsWith('https://github.com/someone/themes/issues/new?template=submit-theme.yml&title=Theme%3A%20Harbour&theme=')).toBe(true)
  expect(JSON.parse(decodeURIComponent(url.split('&theme=')[1] ?? '')).name).toBe('Harbour')
  expect(url.length <= 2000).toBe(true)

  const built = await $.command.run({ ...RUN, command: 'themes', args: 'publish fjord' })
  expect(built.text).toMatch(/No theme of yours|only your own themes/)

  const ui = await $.ui.mount(PANE)
  await ui.press({ key: 'about:mine:harbour' })
  await ui.press({ key: 'publish' })
  expect((await ui.find({ type: 'Link' }))?.props.href).toBe(url)
  await ui.unmount()
})

test('a fresh install reads the default community', async ($, on) => {
  const { fetched } = await start($, on)
  const ran = await $.command.run({ ...RUN, command: 'themes', args: 'refresh' })

  expect(ran.text).toBe('1 community themes.')
  expect(fetched).toEqual(['https://raw.githubusercontent.com/SlimSuperSignon/claude-themes/main/index.json'])
})

test('with the community option cleared, the gallery says how to choose one', { options: { communityRepo: '' } }, async ($, on) => {
  await start($, on)
  const ran = await $.command.run({ ...RUN, command: 'themes', args: 'refresh' })

  expect(ran.text).toMatch(/No community is chosen yet/)
})
