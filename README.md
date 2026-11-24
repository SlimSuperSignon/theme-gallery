# Theme Gallery

Create, share, browse and apply themes for Claude, the way community themes work in a notes app. A theme is one JSON file that sets the app's colors, code highlighting and background, and carries its creator's about page.

Themes paint the Claude desktop and mobile apps. The terminal and editor extensions keep their own look.

## Install

At the prompt of a Claude Code terminal session:

```
/plugin install theme-gallery --marketplace SlimSuperSignon/theme-gallery
```

Answer `y` to add the marketplace, then press Enter to install for your user. `/themes` is ready at once.

From a shell:

```
claude plugin install theme-gallery --marketplace SlimSuperSignon/theme-gallery
```

In the Claude desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `SlimSuperSignon/theme-gallery`, then **Add plugin**.

- [Using themes](#using-themes)
- [Creator guide](#creator-guide)
  - [1. Start a theme](#1-start-a-theme)
  - [2. The edit loop](#2-the-edit-loop)
  - [3. Describe your theme](#3-describe-your-theme)
  - [4. Surfaces and text](#4-surfaces-and-text)
  - [5. Roles: accent and meaning](#5-roles-accent-and-meaning)
  - [6. Light, dark, or one mode only](#6-light-dark-or-one-mode-only)
  - [7. Code colors and contrast](#7-code-colors-and-contrast)
  - [8. Backgrounds](#8-backgrounds)
  - [9. Fine control: every element](#9-fine-control-every-element)
  - [10. When a theme is refused](#10-when-a-theme-is-refused)
  - [11. What makes a good theme](#11-what-makes-a-good-theme)
  - [12. Share your theme](#12-share-your-theme)
- [What a theme cannot change](#what-a-theme-cannot-change)
- [Reference](#reference)

## Using themes

| Command | What it does |
| --- | --- |
| `/themes` | Opens the gallery: each theme shows a preview, its name opens its about page, and **Use** turns it on |
| `/themes list` | Lists every theme you have |
| `/themes about <name>` | Opens a theme's about page |
| `/themes apply <name>` | Turns a theme on; it stays on in later sessions |
| `/themes off` | Back to the app's own look |
| `/themes new <name>` | Writes `<name>.cctheme.json` in the current folder, a starter to edit |
| `/themes import <file or https link>` | Adds a theme file, yours or someone else's, and turns it on |
| `/themes export <name>` | Writes `<name>.cctheme.json`, ready to share |
| `/themes get <name>` | Downloads a community theme and turns it on |
| `/themes publish <name>` | Submits one of your themes to the community |
| `/themes remove <name>` | Deletes one of your themes |
| `/themes refresh` | Reloads the community |
| `/themes community <owner/name>` | Chooses the community's GitHub repository |

The gallery has three shelves: **Built-in** (Paper, Fjord, Moss and Aurora), **Yours** (themes you made or added) and **Community** (themes other people published).

**Browsing the community.** Open `/themes`. The Community shelf shows every published theme with its preview, twelve at a time. Type in **Search** and press Enter to narrow all shelves by name, author or description. Click a theme's name for its about page; **Add** downloads it into **Yours** and turns it on, and **Update** fetches the creator's newest version. The shelf reloads by itself when it is over an hour old. No account is needed to browse or download.

The community lives in the public GitHub repository [SlimSuperSignon/claude-themes](https://github.com/SlimSuperSignon/claude-themes), which the plugin uses by default. To use another community, run `/themes community owner/name`.

A theme file is data. It holds no code, only the fields in this guide are read, and each is checked before the theme is used.

---

## Creator guide

### 1. Start a theme

```
/themes new Harbour
```

This writes `harbour.cctheme.json` in the current folder: a complete, working theme you can recolor. You can also export any theme you have and start from it, which is the quickest way to learn a feature:

```
/themes export Aurora
```

The smallest theme that works is this:

```json
{
  "format": "claude-theme/1",
  "name": "Harbour",
  "dark": {
    "surface-0": "#161c22",
    "text-primary": "#e4ebf1",
    "text-muted": "#98a6b2"
  }
}
```

Everything else is optional and adds control.

### 2. The edit loop

1. Edit the file in any text editor.
2. Run `/themes import harbour.cctheme.json`. The theme is added to **Yours** (replacing the earlier one of that name) and turned on.
3. Look at the app, then repeat.

If the file has a mistake, the import says what and where, for example `dark.surface-0 must be a six-digit hex color such as #2f5d8c`. Nothing changes until the file is right.

Check your theme in both modes, with a long code block on screen, and at a larger text size.

### 3. Describe your theme

```json
{
  "format": "claude-theme/1",
  "name": "Harbour",
  "author": "Your name",
  "description": "Cool slate blues, like water under cloud",
  "about": "# Harbour\n\nMade for long evenings.\n\n- Calm, low-glare dark mode\n- Find me at [my site](https://example.com)"
}
```

| Field | What it is | Limit |
| --- | --- | --- |
| `format` | Always `"claude-theme/1"` | required |
| `name` | The theme's name, shown everywhere | required, 40 characters |
| `author` | Your name or handle | 60 characters |
| `description` | One line under the theme's card | 140 characters |
| `about` | Your about page, in markdown | 8,000 characters |

**The about page** is what people see when they click your theme's name. Headings, lists, bold, italics, tables, code and links all work. In JSON a new line is written `\n`. Pictures and HTML are not shown: a picture becomes a plain link, so opening a theme never loads anything from the internet.

**The preview picture** on your card is drawn automatically from your colors, light on the left and dark on the right. There is no screenshot to make or host. A color or gradient background shows in the preview too.

### 4. Surfaces and text

Each mode (`light`, `dark`) names up to seven colors. Every color in a mode is six-digit hex, such as `#1f1a15`.

| Name | What it paints | Required |
| --- | --- | --- |
| `surface-0` | The page behind everything | yes |
| `surface-1` | Cards and the sidebar | |
| `surface-2` | Panels | |
| `surface-3` | Menus and popovers | |
| `text-primary` | Main text | yes |
| `text-secondary` | Supporting text | |
| `text-muted` | Hints, timestamps, placeholders | recommended |

Rules the app holds a theme to:

- **`surface-0` is the darkest surface in both modes**, and each later surface is as light or lighter. So in light mode, cards sit lighter than the page.
- In light mode, `surface-2` and `surface-3` must match if you give both.
- In dark mode, keep `surface-3` close to `surface-0`. Too light, and muted text on it fails contrast and the theme is refused.
- A color you leave out is worked out from the ones you give. Give `text-muted` yourself: the worked-out one is often too faint to pass.

From these seven the app builds a full gray scale for borders, hovers, dividers and disabled states, so a theme with only these already recolors the whole interface.

### 5. Roles: accent and meaning

`roles` sets the five colors that carry meaning. They apply to both modes.

```json
"roles": {
  "accent": "#3b7ea6",
  "danger": "#b8474a",
  "success": "#4c8a6a",
  "warning": "#b0862b",
  "pro": "#7a68a8"
}
```

| Role | Used for | In code blocks |
| --- | --- | --- |
| `accent` | Buttons, links, focus rings, selection | keywords |
| `danger` | Errors, destructive actions | names |
| `success` | Confirmations, additions | strings |
| `warning` | Cautions | variables |
| `pro` | Highlights and badges | literals |

You give one color per role. The app keeps its hue and works out every shade it needs (backgrounds, borders, text, hover), so a role always reads on your surfaces. A role you leave out stays the app's own.

To set a role for one mode only, put `roles` inside that mode. It replaces the top-level role there:

```json
"dark": {
  "surface-0": "#161c22",
  "text-primary": "#e4ebf1",
  "roles": { "accent": "#5aa7d6" }
}
```

### 6. Light, dark, or one mode only

- **Both modes**: give `light` and `dark`. The theme follows the person's own light/dark setting.
- **One mode**: give only `dark` (or only `light`). The app acts as if the person chose that mode while your theme is on.
- **Both, but pinned**: give both and add `"mode": "dark"` to hold the app in that mode. Use it when your background only suits one mode. The desktop app may ignore this for now and follow the person's own setting.

Make dark a second version of the idea, not an inversion: lamp-lit paper for a paper theme, dusk for a forest theme.

### 7. Code colors and contrast

```json
"codeTheme": { "light": "github-light", "dark": "nord" },
"contrast": "more"
```

- `codeTheme` names the syntax highlighting theme for each mode, by the name the app knows it by (the usual editor theme names, such as `github-dark` or `nord`). A name the app does not offer is ignored and its own highlighting stays. Without `codeTheme`, code is colored from your roles, as in the table above.
- `"contrast": "more"` asks for stronger borders and focus rings, as a high-contrast theme needs.

### 8. Backgrounds

`background` sets what is behind the conversation. Give exactly one of `color`, `gradient`, `pattern` or `scene`.

A background color can be a raw color (`#1f1a15`, `#1f1a15cc`, `rgb(...)`, `rgba(...)`, `hsl(...)`), `transparent`, or a **palette name** such as `surface-0` or `fill-accent`. A palette name follows the mode, so one background serves light and dark. The names are listed in the [reference](#palette-names-for-backgrounds).

#### A flat color

```json
"background": { "color": "surface-1" }
```

#### A gradient

```json
"background": {
  "gradient": {
    "stops": ["surface-0", { "at": 0.7, "color": "bg-accent" }, "surface-1"],
    "angle": 135,
    "shape": "linear"
  }
}
```

| Field | What it is |
| --- | --- |
| `stops` | 2 to 16 colors. Bare colors are spaced evenly; `{ "at": 0–1, "color": ... }` places one. Places must run in order |
| `angle` | Degrees, as in CSS: `0` runs up, `90` right, `180` (the default) down |
| `shape` | `"linear"` (default) or `"radial"`, an ellipse out to the edges |
| `size`, `repeat` | `"size": [48, 48], "repeat": true` tiles the gradient in boxes of that size (1 to 256 each side) |

#### A pattern

A pattern is a small drawing in SVG path data, tiled across the screen. It suits dots, grids, stripes and paper textures.

```json
"background": {
  "pattern": {
    "viewBox": 24,
    "size": [24, 24],
    "repeat": true,
    "color": "border",
    "paths": [
      "M11 11h2v2h-2z",
      { "d": "M0 0L24 24", "strokeWidth": 0.5, "color": "border-strong" }
    ]
  }
}
```

| Field | What it is |
| --- | --- |
| `viewBox` | The drawing's own size: one number for a square, or `[width, height]`, 1 to 256 |
| `paths` | 1 to 64 paths. A string is filled. `{ "d", "strokeWidth" }` is stroked instead, at a width from 0.01 to 64. Each may name its own `color` |
| `color` | The color of every path that names none |
| `size`, `repeat` | The box one copy fills, and whether it tiles |

`d` is the text of an SVG path's `d` attribute, which any vector editor exports.

#### A moving scene

A scene is a whole SVG document drawn full-window behind the chat. It can move, using CSS animation inside its own `<style>`. See the built-in **Aurora** theme for a complete one (`/themes export Aurora`).

```json
"background": {
  "scene": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1600 900\" preserveAspectRatio=\"xMidYMid slice\"><style>.sun{animation:rise 40s ease-in-out infinite alternate}@keyframes rise{to{transform:translateY(-60px)}}</style><rect width=\"1600\" height=\"900\" fill=\"#0f1420\"/><circle class=\"sun\" cx=\"1200\" cy=\"500\" r=\"160\" fill=\"#e0a458\" opacity=\"0.35\"/></svg>",
  "alt": "A dim sun rising slowly over a dark sky",
  "glass": { "blur": 24, "tint": "#0f1420", "opacity": 0.7 }
}
```

| Field | What it is |
| --- | --- |
| `scene` | One SVG document, `<svg ...>...</svg>`, at most 131,072 characters. In JSON, write each `"` inside it as `\"` |
| `alt` | What the scene shows, for someone who cannot see it. 120 characters |
| `glass` | How the app's panels sit over the scene, to keep words readable. `false` leaves panels as they are |
| `glass.blur` | How far the scene blurs behind a panel, 0 to 64. Default 16 |
| `glass.tint` | The panel's color over the scene, a raw color. Default: the app's own panel color |
| `glass.opacity` | How solid the tinted panel is, 0 to 1. Default 0.6 |

Rules for a scene:

- Give the root `viewBox` and `preserveAspectRatio="xMidYMid slice"`, so it fills any window, from a tall phone to a wide monitor, by cropping.
- Keep what matters away from the middle, where the words sit, and the bottom, where the message box sits.
- Colors inside a scene are raw; palette names do not work there. A scene made for one mode should come with `"mode"` or a single-mode theme.
- No scripts, no event handlers, no `<foreignObject>`, and nothing loaded from a link: no web fonts, no remote images, no `@import`. A theme holding any of these is refused. An embedded `data:image/...` picture is allowed, but the app may still decline to draw it, and it counts toward the size limit.
- Prefer slow, quiet motion. The scene runs behind someone's work all day.

### 9. Fine control: every element

The fields so far cover the look of most themes. These reach the rest. All of them go inside a mode.

#### Shade a role by hand

A role can be an object instead of one color:

```json
"roles": {
  "accent": { "seed": "#3b7ea6", "fillShade": 600, "stops": { "700": "#2c6183" } }
}
```

- `seed`: the role's color, as the plain form gives it.
- `stops`: single shades of the role's scale set by hand. The stops a role has are listed in the [reference](#design-tokens).
- `fillShade`: which shade filled buttons use.

#### Git colors

```json
"dark": {
  "git": { "added": "#3fa56b", "removed": "#d0565c", "modified": "#c79a3a" }
}
```

`added`, `removed`, `modified`, `merged`, `closed`, `conflicting` and `draft` color diffs, branch states and pull request badges.

#### The gray scale

Your surfaces and text become a scale of 35 grays, from stop `0` to stop `900`. Borders, dividers, hovers and disabled states are picked from it. `stops` sets single grays by hand:

```json
"dark": {
  "surface-0": "#161c22",
  "text-primary": "#e4ebf1",
  "stops": { "500": "#7b8892", "650": "#4f5b66" }
}
```

#### Any single design token

`tokens` is the last word: it sets one of the app's design tokens directly, over everything worked out above it.

```json
"dark": {
  "tokens": {
    "role-tooltip-bg": "#0b0f14",
    "role-tooltip-fg": "#e4ebf1",
    "role-accent-fill": "#3b7ea6",
    "role-accent-fill-hover": "#4a8fb8",
    "role-accent-on": "#ffffff"
  }
}
```

The full list of tokens is in the [reference](#design-tokens). A name that is not a design token is refused, with the name, so a typo never silently paints nothing. Token names belong to the app's design system and can change when the app updates; a theme that leans on many of them needs more upkeep than one built from surfaces and roles.

### 10. When a theme is refused

The app refuses a whole theme whose text would be too hard to read. The gallery checks this first and tells you the pair that fails:

```
Harbour can't be used: Desktop won't paint this theme, because this text is under 3:1:
text-muted on surface-0 is 2.71:1 in light mode; it needs 3.4:1
```

Read it as: *this text color, on this surface, in this mode, has this contrast, and needs that much*. Then move the two colors apart.

| The message names | Usual fix |
| --- | --- |
| `text-muted` on a surface | Give `text-muted` yourself, further from the surface |
| anything on `surface-3` in dark mode | Bring `surface-3` closer to `surface-0` |
| a role's text (`text-success`, `text-accent`...) | Pick a role color with more contrast against your surfaces, or set that role per mode |
| `inputs.dark.xyz isn't a theme color name` | `xyz` under `tokens` is not a design token: check the [list](#design-tokens) |
| a `stops` or `fillShade` value | The message lists the stops that exist |

### 11. What makes a good theme

- **Tint the grays.** Take every surface from your theme's hue and keep neighbors a few percent of lightness apart, so a card reads as paper on paper. Leave pure black and pure white to themes that are about them.
- **Words come first.** Aim for `text-primary` at 7:1 or better on every surface and `text-muted` at 4.5:1. Passing the check is the floor, not the goal.
- **Keep meaning.** `danger` stays a red, `success` a green, `warning` an amber, each tuned toward your palette. Five roles of one hue also flatten code blocks.
- **Both modes, unless the idea can't.**
- **Backgrounds stay behind.** Low contrast, slow motion, and glass strong enough that text over the busiest part still reads.
- **Your own art.** Take the spirit of a place or an era, never a company's logo, artwork or name.

### 12. Share your theme

#### Publish to the community

1. Open your theme's about page in the gallery and press **Publish to community**, or run `/themes publish Harbour`.
2. Click the link it gives you. It opens the community's **Submit a theme** page on GitHub. You need a free GitHub account for this step.
3. Press **Create**.
   - A theme small enough to ride in the link arrives already filled in.
   - A larger one (a long about page, a moving scene) is put on your clipboard and written to `harbour.cctheme.json`: paste it into the **Theme file** box first.
4. Within about a minute a comment on your submission says whether the theme passed. If it did not, the comment quotes the reason, in the same words the gallery uses. Fix the file, edit your submission, paste the new contents, and it is checked again.
5. A theme that passes goes live once a maintainer approves it. It then shows on everyone's Community shelf.

**To update a theme you published**, publish it again under the same name. People who added it see **Update** on its card.

**Names are first come, first served.** A name already in the community belongs to whoever published it, and a built-in theme's name cannot be used.

**What a maintainer looks at.** The automatic check covers the file's shape, its colors' readability and that a scene holds nothing that runs or loads. A person reads the about page before approving, so keep it about the theme.

#### Share a theme directly

A theme does not have to be in the community. Put the exported file online as a raw https link, such as a GitHub gist's **Raw** link, and send it. Anyone with this plugin runs:

```
/themes import https://example.com/harbour.cctheme.json
```

Only https links are read. A theme from anywhere is checked exactly as your own files are.

---

## What a theme cannot change

These are limits of what the Claude apps let a theme set, not of this plugin:

- **Fonts.** The apps offer no way to change typefaces or text sizes. A theme cannot set the interface font or the code font.
- **Layout, spacing, corner shapes and icons.**
- **Photo backgrounds from a theme file.** The apps only draw a picture that ships inside a plugin's own folder, so a shared theme file cannot carry one. Use a gradient, a pattern or an SVG scene.
- **Permission prompts**, which always keep the app's own look.
- **The terminal and editor extensions**, which draw no themes.

## Reference

### Every field

```json
{
  "format": "claude-theme/1",
  "name": "", "author": "", "description": "", "about": "",
  "mode": "light | dark",
  "contrast": "more",
  "codeTheme": { "light": "", "dark": "" },
  "roles": { "accent": "", "danger": "", "success": "", "warning": "", "pro": "" },
  "light": {
    "surface-0": "", "surface-1": "", "surface-2": "", "surface-3": "",
    "text-primary": "", "text-secondary": "", "text-muted": "",
    "roles": {}, "git": {}, "stops": {}, "tokens": {}
  },
  "dark": { },
  "background": { "color | gradient | pattern | scene": "" }
}
```

A theme file is at most 200 KB.

### Palette names for backgrounds

`surface-0` `surface-1` `surface-2` `surface-3` `text-primary` `text-secondary` `text-muted` `text-disabled` `fill-primary` `on-primary` `border` `border-strong` `border-stronger`, and for each role (`accent`, `danger`, `success`, `warning`, `pro`): `fill-<role>` `text-<role>` `bg-<role>` `on-<role>` `border-<role>`.

`bg-<role>` is a soft wash of the role and suits backgrounds best.

### Design tokens

The names `tokens` takes, as of this version of the plugin.

**Grays** (also the stops `stops` takes): `gray-0` `gray-10` `gray-20` `gray-30` `gray-40` `gray-50` `gray-60` `gray-70` `gray-80` `gray-90` `gray-100` `gray-150` `gray-200` `gray-250` `gray-300` `gray-350` `gray-400` `gray-450` `gray-500` `gray-550` `gray-600` `gray-650` `gray-700` `gray-750` `gray-800` `gray-810` `gray-820` `gray-830` `gray-840` `gray-850` `gray-860` `gray-870` `gray-880` `gray-890` `gray-900`

**Accent**: `role-accent-50` `role-accent-100` `role-accent-250` `role-accent-300` `role-accent-400` `role-accent-450` `role-accent-600` `role-accent-700` `role-accent-800` `role-accent-850` `role-accent-fill` `role-accent-fill-hover` `role-accent-on`

**Danger**: `role-danger-100` `role-danger-250` `role-danger-300` `role-danger-400` `role-danger-450` `role-danger-600` `role-danger-700` `role-danger-800` `role-danger-fill` `role-danger-fill-hover` `role-danger-on`

**Success**: `role-success-100` `role-success-250` `role-success-400` `role-success-450` `role-success-600` `role-success-700` `role-success-800` `role-success-fill` `role-success-fill-hover` `role-success-on`

**Warning**: `role-warning-100` `role-warning-200` `role-warning-250` `role-warning-300` `role-warning-600` `role-warning-700` `role-warning-800` `role-warning-fill` `role-warning-fill-hover` `role-warning-on`

**Pro**: `role-pro-100` `role-pro-250` `role-pro-300` `role-pro-400` `role-pro-450` `role-pro-600` `role-pro-700` `role-pro-800` `role-pro-fill` `role-pro-fill-hover` `role-pro-on`

**Tooltips**: `role-tooltip-bg` `role-tooltip-fg`

**Git**: `fill-git-added` `fill-git-modified` `text-git-added` `text-git-removed` `text-git-modified` `text-git-merged` `text-git-closed` `text-git-conflicting` `text-git-draft`

In a role, `-fill` is a filled button, `-fill-hover` its hover, and `-on` the text on it. Low numbers are the role's washes and high numbers its text and borders; which end is light depends on the mode.
