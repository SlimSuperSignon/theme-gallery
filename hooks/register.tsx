import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { ThemeDef, ThemeGalleryView, ThemeShared, ThemeShelf } from '../types'
import {
  BUILT_IN,
  SCENE,
  build,
  extras,
  isHttps,
  isSameName,
  matches,
  parseIndex,
  parseTheme,
  preview,
  rawUrl,
  repoOf,
  slug,
  submitUrl,
  swatches,
  template,
} from './themes'

const PANE = 'theme-gallery'
const TITLE = 'Themes'
const SUFFIX = '.cctheme.json'
const PAGE = 12
const STALE_MS = 60 * 60 * 1000
const EMPTY: ThemeGalleryView = {
  activeName: null,
  mine: [],
  community: [],
  open: null,
  note: '',
  link: null,
  repo: '',
  query: '',
  shown: PAGE,
}

// Change the tag when the view's fields change: it declines what an earlier
// version stored, which outlives a reload.
const view = atom({ plugin: 'theme-gallery', key: 'view' } as const, EMPTY, {
  shape: 'view-3',
})

// The moving background of the theme that is on: what the Backdrop hook draws.
const live = atom({ plugin: 'theme-gallery', key: 'scene' } as const, null, {
  shape: 'scene-1',
})

const HELP = [
  '/themes                    open the gallery: browse, search, add and use themes',
  '/themes list               every theme you have',
  '/themes about <name>       open a theme\'s about page',
  '/themes apply <name>       use a theme',
  '/themes off                back to the app\'s own look',
  `/themes new <name>         write <name>${SUFFIX} here, a starter to edit`,
  '/themes import <file|url>  add a theme file, yours or someone else\'s',
  `/themes export <name>      write <name>${SUFFIX} here`,
  '/themes publish <name>     submit one of your themes to the community',
  '/themes get <name>         add a community theme and turn it on',
  '/themes remove <name>      delete one of your themes',
  '/themes refresh            reload the community',
  '/themes community <owner/name>   choose the community\'s GitHub repository',
  '',
  'The plugin\'s README is the guide to writing a theme file.',
].join('\n')

const reason = (error: unknown): string => (error instanceof Error ? error.message : String(error))

/** What the store holds, read again as theme files: an old or odd entry is dropped. */
const storedThemes = (value: unknown): ThemeDef[] =>
  (Array.isArray(value) ? value : []).flatMap(one => {
    const parsed = parseTheme(JSON.stringify(one) ?? 'null')

    return parsed.ok ? [parsed.value] : []
  })

/** The community as last fetched: cards only, so each is read whole again when opened. */
const storedShared = (value: unknown): ThemeShared[] => {
  const parsed = parseIndex(JSON.stringify({ format: 'claude-theme-index/1', themes: value }) ?? 'null')

  return parsed.ok ? parsed.value : []
}

const say = async ($: EngineInterface, note: string, link: ThemeGalleryView['link'] = null): Promise<string> => {
  await update($, view, old => ({ ...old, note, link }))

  return note
}

const shelfOf = (held: ThemeGalleryView, shelf: ThemeShelf): readonly ThemeDef[] =>
  shelf === 'built-in' ? BUILT_IN : shelf === 'mine' ? held.mine : held.community.map(one => one.theme)

const find = async ($: EngineInterface, name: string): Promise<ThemeDef | undefined> => {
  const { mine } = await read($, view)

  return [...mine, ...BUILT_IN].find(def => isSameName(def.name, name))
}

const apply = async ($: EngineInterface, def: ThemeDef): Promise<string> => {
  const built = build(def)

  if (!built.ok) {
    return say($, `${def.name} can't be used: ${built.error}`)
  }
  await update($, live, () => built.value.scene)
  const set = await $.theme.set(built.value.look)
  await $.store.set('active', def)
  await update($, view, old => ({ ...old, activeName: def.name }))

  return say(
    $,
    set.isDrawn
      ? `${def.name} is on.`
      : `${def.name} is chosen, and shows in the desktop and mobile apps (${set.reason}).`,
  )
}

const turnOff = async ($: EngineInterface): Promise<string> => {
  await $.theme.clear()
  await update($, live, () => null)
  await $.store.delete('active')
  await update($, view, old => ({ ...old, activeName: null }))

  return say($, "Theme off: the app's own look is back.")
}

const keep = async ($: EngineInterface, def: ThemeDef): Promise<string | undefined> => {
  if (BUILT_IN.some(one => isSameName(one.name, def.name))) {
    return `A built-in theme is already called ${def.name}: change "name" in the file.`
  }
  const built = build(def)

  if (!built.ok) {
    return `${def.name} can't be used: ${built.error}`
  }
  const { mine } = await read($, view)
  const next = [...mine.filter(one => !isSameName(one.name, def.name)), def]
  await $.store.set('mine', next)
  await update($, view, old => ({ ...old, mine: next }))

  return undefined
}

const fetchText = async ($: EngineInterface, url: string): Promise<string> => {
  if (!isHttps(url)) {
    throw new Error('only https links are read')
  }
  const answer = await $.http.fetch(url)

  if (!answer.ok) {
    throw new Error(answer.status === 404 ? 'nothing is at that address' : `the link answered ${answer.status}`)
  }

  return answer.text
}

/** Adds a theme to the person's own and turns it on. */
const adopt = async ($: EngineInterface, def: ThemeDef): Promise<string> => {
  const refused = await keep($, def)

  return refused === undefined ? apply($, def) : say($, refused)
}

/** Adds a theme from a file or a link to the person's own, and turns it on. */
const bring = async ($: EngineInterface, from: string): Promise<string> => {
  try {
    const text = /^https?:\/\//i.test(from) ? await fetchText($, from) : await $.fs.read(from)
    const parsed = parseTheme(text)

    return parsed.ok ? adopt($, parsed.value) : say($, `Not added: ${parsed.error}.`)
  } catch (error) {
    return say($, `Not added: ${reason(error)}.`)
  }
}

/** Reads the community's index: one small file that lists every theme with a card of it. */
const refresh = async ($: EngineInterface): Promise<string> => {
  const { repo } = await read($, view)

  if (repo === '') {
    return say($, 'No community is chosen yet: /themes community owner/name sets its GitHub repository.')
  }
  try {
    const parsed = parseIndex(await fetchText($, rawUrl(repo, 'index.json')))

    if (!parsed.ok) {
      return say($, `The community can't be read: ${parsed.error}.`)
    }
    const community = parsed.value
    await update($, view, old => ({ ...old, community, shown: PAGE }))
    await $.store.set('community', community.map(one => ({ file: one.file, extras: one.extras, card: one.theme })))
    await $.store.set('communityAt', await $.clock.now())

    return say($, `${community.length} community themes.`)
  } catch (error) {
    return say($, `The community can't be read: ${reason(error)}.`)
  }
}

/** Reloads the community when what is held is over an hour old; quiet when it fails. */
const refreshIfStale = async ($: EngineInterface): Promise<void> => {
  const { repo } = await read($, view)
  const at = Number((await $.store.get('communityAt')) ?? 0)

  if (repo !== '' && (await $.clock.now()) - at > STALE_MS) {
    await refresh($).catch(() => undefined)
  }
}

/** Fetches a community theme's whole file: its about page and moving scene, which a card leaves out. */
const whole = async ($: EngineInterface, name: string): Promise<ThemeDef> => {
  const { repo, community } = await read($, view)
  const shared = community.find(one => isSameName(one.theme.name, name))

  if (shared === undefined) {
    throw new Error(`no community theme is called ${name}`)
  }
  if (shared.isFull) {
    return shared.theme
  }
  const parsed = parseTheme(await fetchText($, rawUrl(repo, shared.file)))

  if (!parsed.ok) {
    throw new Error(parsed.error)
  }
  const theme = parsed.value
  await update($, view, old => ({
    ...old,
    community: old.community.map(one => (one.file === shared.file ? { ...one, theme, isFull: true } : one)),
  }))

  return theme
}

/** Downloads a community theme: adds it to the person's own and turns it on. */
const download = async ($: EngineInterface, name: string): Promise<string> => {
  try {
    return await adopt($, await whole($, name))
  } catch (error) {
    return say($, `Not added: ${reason(error)}.`)
  }
}

const remove = async ($: EngineInterface, name: string): Promise<string> => {
  const { mine, activeName } = await read($, view)
  const gone = mine.find(def => isSameName(def.name, name))

  if (gone === undefined) {
    return say($, `None of your themes is called ${name}.`)
  }
  const next = mine.filter(def => def !== gone)
  await $.store.set('mine', next)
  await update($, view, old => ({ ...old, mine: next, open: null }))
  if (activeName !== null && isSameName(activeName, gone.name)) {
    await turnOff($)
  }

  return say($, `${gone.name} removed.`)
}

const writeFile = async ($: EngineInterface, def: ThemeDef, isNew: boolean): Promise<string> => {
  const file = `${slug(def.name)}${SUFFIX}`

  if (isNew && (await $.fs.exists(file))) {
    return say($, `${file} is already here: pick another name, or edit that file.`)
  }
  await $.fs.write(file, `${JSON.stringify(def, null, 2)}\n`)

  return say(
    $,
    isNew
      ? `Wrote ${file}. Edit it (the plugin's README is the guide), then /themes import ${file}`
      : `Wrote ${file}. /themes publish ${def.name} submits it to the community.`,
  )
}

/**
 * Uploads a theme: hands the person the community's submission page, filled in
 * where the theme fits in a link, else with the theme on the clipboard and in a file.
 */
const publish = async ($: EngineInterface, def: ThemeDef): Promise<string> => {
  const { repo, mine } = await read($, view)

  if (repo === '') {
    return say($, 'No community is chosen yet: /themes community owner/name sets its GitHub repository.')
  }
  if (!mine.some(one => isSameName(one.name, def.name))) {
    return say($, `${def.name} is built in: only your own themes can be published.`)
  }
  const { href, isFilled } = submitUrl(repo, def)
  const link = { href, label: `Open the submission page for ${def.name}` }

  if (isFilled) {
    return say($, `Open the page below and press Create: ${def.name} is already filled in. It is checked at once and goes live when approved.`, link)
  }
  const file = `${slug(def.name)}${SUFFIX}`
  const text = `${JSON.stringify(def, null, 2)}\n`
  await $.fs.write(file, text)
  const copied = await $.ui.copy({ text }).catch(() => ({ isCopied: false }))

  return say(
    $,
    `Open the page below, paste ${copied.isCopied ? 'your theme (it is on your clipboard)' : `the contents of ${file}`} into the Theme file box and press Create. It is checked at once and goes live when approved.`,
    link,
  )
}

const show = async ($: EngineInterface, shelf: ThemeShelf | null, name = ''): Promise<void> => {
  await update($, view, old => ({ ...old, open: shelf === null ? null : { shelf, name }, note: '', link: null }))
  if (shelf === 'community') {
    await whole($, name).catch(error => say($, `The about page could not be loaded: ${reason(error)}.`))
  }
}

export const register: Register = (on, options) => {
  on('session.start', async ($, e, next) => {
    try {
      await $.command.register({
        name: 'themes',
        description: 'Browse, apply, create and share color themes',
        argumentHint: '[about|apply|get|publish|new|import|export|remove|list|refresh|community|off|help] [name]',
      })
      const mine = storedThemes(await $.store.get('mine'))
      const community = storedShared(await $.store.get('community'))
      const [active] = storedThemes([await $.store.get('active')])
      const repo = repoOf(await $.store.get('repo')) ?? repoOf(options.communityRepo) ?? ''
      const built = active === undefined ? undefined : build(active)
      await update($, view, old => ({
        ...old,
        mine,
        community,
        repo,
        activeName: active?.name ?? null,
      }))
      if (built?.ok === true) {
        const { look, scene } = built.value
        await update($, live, () => scene)
        await $.theme.set(look)
      }
    } catch (error) {
      $.ui.toast(`Themes: ${reason(error)}`)
    }

    return next(e)
  })

  on('command.run', { command: 'themes' }, async ($, e) => {
    const typed = e.args.trim()
    const verb = (typed.split(/\s+/)[0] ?? '').toLowerCase()
    const rest = typed
      .slice(verb.length)
      .trim()
      .replace(/^"(.*)"$/, '$1')
    const named = async (then: (def: ThemeDef) => Promise<string>): Promise<string> => {
      const def = rest === '' ? undefined : await find($, rest)

      return def === undefined ? say($, `No theme of yours is called "${rest}". /themes list shows them.`) : then(def)
    }
    const linked = async (text: string): Promise<{ text: string }> => {
      const { link } = await read($, view)

      return { text: link === null ? text : `${text}\n${link.href}` }
    }

    switch (verb) {
      case '':
        await show($, null)
        await $.ui.open({ id: PANE, title: TITLE })
        await refreshIfStale($)

        return { text: 'Themes gallery opened. /themes help lists the commands.' }
      case 'list': {
        const { mine, community, activeName } = await read($, view)
        const rows = [
          ...BUILT_IN.map(def => `${def.name} (built-in)`),
          ...mine.map(def => `${def.name} (yours)`),
          ...community.map(one => `${one.theme.name} (community)`),
        ]

        return { text: `On: ${activeName ?? 'none'}\n${rows.join('\n')}` }
      }
      case 'about':
        return {
          text: await named(async def => {
            await show($, BUILT_IN.includes(def) ? 'built-in' : 'mine', def.name)
            await $.ui.open({ id: PANE, title: TITLE })

            return `${def.name}'s about page opened.`
          }),
        }
      case 'apply':
        return { text: await named(def => apply($, def)) }
      case 'export':
        return { text: await named(def => writeFile($, def, false)) }
      case 'publish':
        return linked(await named(def => publish($, def)))
      case 'get':
        if (rest !== '') {
          await refreshIfStale($)
        }

        return { text: rest === '' ? 'Name the community theme: /themes get Harbour' : await download($, rest) }
      case 'off':
        return { text: await turnOff($) }
      case 'new':
        return {
          text: rest === '' ? 'Give the theme a name: /themes new Harbour' : await writeFile($, template(rest.slice(0, 40)), true),
        }
      case 'import':
        return { text: rest === '' ? 'Give a file or an https link: /themes import harbour.cctheme.json' : await bring($, rest) }
      case 'remove':
        return { text: rest === '' ? 'Name the theme: /themes remove Harbour' : await remove($, rest) }
      case 'refresh':
        return { text: await refresh($) }
      case 'community': {
        const repo = repoOf(rest.replace(/^https:\/\/github\.com\//i, '').replace(/\/$/, ''))

        if (repo === undefined) {
          const held = await read($, view)

          return { text: `The community is ${held.repo === '' ? 'not chosen yet' : held.repo}. To choose one: /themes community owner/name` }
        }
        await $.store.set('repo', repo)
        await update($, view, old => ({ ...old, repo, community: [] }))

        return { text: `The community is now ${repo}. ${await refresh($)}` }
      }
      default:
        return { text: HELP }
    }
  })

  // A theme's moving background: the creator's SVG, which runs no script and loads nothing.
  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if ((e.surface !== 'desktop' && e.surface !== 'mobile') || e.props.scene !== SCENE) {
      return next(e)
    }
    const held = await read($, live)

    if (held === null) {
      return next(e)
    }
    const { Svg } = $.ui.resolve(e)

    return <Svg source={held.svg} alt={held.alt} isInteractive />
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const table = $.ui.resolve(e)
    const { Box, Text, Button, Markdown, Input, Link } = table
    const held = await read($, view)
    const { activeName, mine, community, note, link, repo, query } = held
    const isOn = (name: string): boolean => activeName !== null && isSameName(activeName, name)
    const isMine = (name: string): boolean => mine.some(def => isSameName(def.name, name))
    const run = (work: () => Promise<unknown>) => (): void => {
      void work().catch(error => say($, reason(error)))
    }
    // The theme drawn as a small window of the app; colors alone where a surface has no pictures.
    const picture = (def: ThemeDef, width: number) =>
      'Svg' in table ? (
        <table.Svg source={preview(def)} alt={`A preview of the ${def.name} theme`} width={width} />
      ) : (
        <Box flexDirection="row">
          {swatches(def).map(color => (
            <Text backgroundColor={color}>{'    '}</Text>
          ))}
        </Box>
      )
    const use = (shelf: ThemeShelf, def: ThemeDef) => () => (shelf === 'community' ? download($, def.name) : apply($, def))
    // What a theme changes beyond its colors: a community card's own list, since a card leaves the scene out.
    const also = (shelf: ThemeShelf, def: ThemeDef): string[] =>
      shelf === 'community' ? (community.find(one => one.theme === def)?.extras ?? []) : extras(def)
    const status = (
      <Box flexDirection="column">
        {note !== '' && <Text dimColor>{note}</Text>}
        {link !== null && <Link href={link.href}>{link.label}</Link>}
      </Box>
    )

    const opened = held.open === null ? undefined : shelfOf(held, held.open.shelf).find(def => isSameName(def.name, held.open?.name ?? ''))

    if (held.open !== null && opened !== undefined) {
      const { shelf } = held.open
      const isLoading = shelf === 'community' && community.find(one => one.theme === opened)?.isFull !== true

      return (
        <Box flexDirection="column" gap={1}>
          <Button key="back" plain onPress={run(() => show($, null))}>
            ← All themes
          </Button>
          {picture(opened, 320)}
          <Box flexDirection="column">
            <Text bold size="heading">
              {opened.name}
            </Text>
            <Text dimColor>
              {opened.author === undefined ? 'No author given' : `by ${opened.author}`}
              {isOn(opened.name) ? '  ·  on now' : ''}
            </Text>
            {also(shelf, opened).length > 0 && <Text dimColor>Also changes: {also(shelf, opened).join(', ')}</Text>}
          </Box>
          {status}
          <Box flexDirection="row" gap={1}>
            <Button key="use" variant="primary" onPress={run(use(shelf, opened))}>
              {shelf !== 'community' ? 'Use this theme' : isMine(opened.name) ? 'Update and use' : 'Add and use'}
            </Button>
            {shelf === 'mine' && (
              <Button key="publish" onPress={run(() => publish($, opened))}>
                Publish to community
              </Button>
            )}
            {shelf !== 'community' && (
              <Button key="export" onPress={run(() => writeFile($, opened, false))}>
                Export file
              </Button>
            )}
            {shelf === 'mine' && (
              <Button key="remove" onPress={run(() => remove($, opened.name))}>
                Remove
              </Button>
            )}
          </Box>
          {opened.about !== undefined ? (
            <Markdown text={opened.about} />
          ) : (
            <Text dimColor>
              {isLoading ? 'Loading the about page…' : (opened.description ?? 'The creator has not written an about page for this theme.')}
            </Text>
          )}
        </Box>
      )
    }

    const card = (shelf: ThemeShelf, def: ThemeDef) => {
      const id = `${shelf}:${slug(def.name)}`

      return (
        <Box flexDirection="column">
          {picture(def, 220)}
          <Box flexDirection="row" gap={1}>
            <Button key={`about:${id}`} plain onPress={run(() => show($, shelf, def.name))}>
              {isOn(def.name) ? '● ' : ''}
              {def.name}
              <Text dimColor>{def.author === undefined ? '' : `  by ${def.author}`}</Text>
            </Button>
            <Button key={`use:${id}`} onPress={run(use(shelf, def))}>
              {shelf === 'community' ? (isMine(def.name) ? 'Update' : 'Add') : 'Use'}
            </Button>
          </Box>
          {def.description !== undefined && <Text dimColor>{def.description}</Text>}
          {also(shelf, def).length > 0 && <Text dimColor>+ {also(shelf, def).join(', ')}</Text>}
        </Box>
      )
    }
    const shelf = (title: string, name: ThemeShelf, empty: string, limit = Infinity) => {
      const found = shelfOf(held, name).filter(def => matches(def, query))
      const left = found.length - limit

      if (found.length === 0 && (empty === '' || query !== '')) {
        return null
      }

      return (
        <Box flexDirection="column" gap={1}>
          <Text bold>
            {title}
            <Text dimColor>{found.length === 0 ? '' : `  ${found.length}`}</Text>
          </Text>
          {found.length === 0 && <Text dimColor>{empty}</Text>}
          {found.slice(0, limit).map(def => card(name, def))}
          {left > 0 && (
            <Button key={`more:${name}`} onPress={run(() => update($, view, old => ({ ...old, shown: old.shown + PAGE })))}>
              Show {Math.min(PAGE, left)} more
            </Button>
          )}
        </Box>
      )
    }
    const hits = (['built-in', 'mine', 'community'] as const).flatMap(name => shelfOf(held, name).filter(def => matches(def, query)))

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold>On now: {activeName ?? "the app's own look"}</Text>
          {note === '' && link === null ? <Text dimColor>Click a name for its about page.</Text> : status}
        </Box>
        <Input
          key="search"
          label="Search"
          placeholder="name, author or words"
          value={query}
          submitLabel="search"
          onSubmit={value => {
            void update($, view, old => ({ ...old, query: value.trim().slice(0, 60), shown: PAGE }))
          }}
        />
        {query !== '' && (
          <Box flexDirection="row" gap={1}>
            <Text dimColor>
              {hits.length === 0 ? `No theme matches "${query}".` : `${hits.length} match "${query}".`}
            </Text>
            <Button key="clear" plain onPress={run(() => update($, view, old => ({ ...old, query: '' })))}>
              Clear
            </Button>
          </Box>
        )}
        {shelf('Built-in', 'built-in', '')}
        {shelf('Yours', 'mine', 'None yet. /themes new Harbour writes a starter file.')}
        {shelf(
          'Community',
          'community',
          repo === '' ? 'No community is chosen yet: /themes community owner/name' : 'Nothing listed yet. Refresh to load it.',
          held.shown,
        )}
        <Box flexDirection="row" gap={1}>
          <Button key="refresh" onPress={run(() => refresh($))}>
            Refresh community
          </Button>
          <Button key="off" onPress={run(() => turnOff($))}>
            Theme off
          </Button>
        </Box>
      </Box>
    )
  })
}
