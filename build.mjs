// Generates the Sunny VS Code themes from the site's OKLCH tokens (src/styles/sunny.css).
// Run: node build.mjs  → writes themes/*.json and iterm/*.itermcolors
import { writeFileSync, mkdirSync } from 'node:fs';

// Sunny defaults (primary yellow, accent red), same as --p-* / --a-* in sunny.css
const P = { l: 0.8197, c: 0.167, h: 79.11 };
const A = { l: 0.6515, c: 0.1996, h: 34.62 };

// --- OKLCH → sRGB hex, reducing chroma until in gamut -----------------------
function toRgb(L, C, h) {
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
const inGamut = (rgb) => rgb.every((v) => v >= -1e-4 && v <= 1 + 1e-4);
function oklch(L, C, h, alpha) {
  let rgb = toRgb(L, C, h);
  while (!inGamut(rgb) && C > 0) rgb = toRgb(L, (C -= 0.002), h);
  const hex = rgb
    .map((v) => {
      v = Math.min(1, Math.max(0, v));
      v = v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
      return Math.round(v * 255)
        .toString(16)
        .padStart(2, '0');
    })
    .join('');
  const a =
    alpha === undefined
      ? ''
      : Math.round(alpha * 255)
          .toString(16)
          .padStart(2, '0');
  return `#${hex}${a}`;
}

// Neutrals, tinted toward the primary hue — straight from sunny.css
function neutrals(mode) {
  const n = (l, k, alpha) => oklch(l, P.c * k, P.h, alpha);
  return mode === 'light'
    ? {
        bg: n(0.975, 0.1),
        raised: n(0.995, 0.04),
        surface: n(0.945, 0.16),
        surface2: n(0.915, 0.18),
        border: n(0.885, 0.16),
        borderStrong: n(0.78, 0.2),
        text: n(0.2, 0.12),
        muted: n(0.4, 0.14),
        subtle: n(0.5, 0.14),
        primary: oklch(0.48, P.c * 0.75, P.h),
        thumb: n(0.78, 0.55, 0.7),
      }
    : {
        bg: n(0.155, 0.1),
        raised: n(0.195, 0.14),
        surface: n(0.225, 0.16),
        surface2: n(0.27, 0.18),
        border: n(0.32, 0.2),
        borderStrong: n(0.42, 0.24),
        text: n(0.95, 0.06),
        muted: n(0.76, 0.1),
        subtle: n(0.6, 0.12),
        primary: oklch(P.l, P.c, P.h),
        thumb: n(0.42, 0.6, 0.7),
      };
}

// Syntax: Sunny yellow + red, plus a 70s set at matching lightness/chroma
// (avocado, teal, plum, burnt orange). Dark editor uses high L, light editor low L.
function syntax(mode) {
  const dark = mode === 'dark';
  const c = (lDark, lLight, C, h) => oklch(dark ? lDark : lLight, C, h);
  return {
    keyword: c(P.l, 0.52, P.c, P.h), // Sunny yellow (darkened in light mode)
    operator: c(0.72, 0.55, A.c, A.h), // Sunny red
    tag: c(0.72, 0.55, A.c, A.h),
    string: c(0.8, 0.5, 0.12, 128), // avocado
    func: c(0.8, 0.5, 0.1, 215), // teal
    type: c(0.78, 0.5, 0.11, 320), // plum
    number: c(0.78, 0.55, 0.15, 55), // burnt orange
    escape: c(0.82, 0.52, 0.11, 185), // aqua
    property: c(0.86, 0.38, 0.05, P.h), // warm tan
    comment: c(0.6, 0.55, P.c * 0.15, P.h),
  };
}

/**
 * Terminal ANSI colors (VS Code terminal and iTerm). Mostly the syntax hues, but the terminal
 * paints big areas in blue (folders in `ls`), so blue is its own calmer hue, clearly apart from
 * cyan. Bright = a step further from the background (lighter in dark mode, darker in light), so
 * bold and "bright" output stand out.
 */
function ansi(mode) {
  const dark = mode === 'dark';
  const base = {
    Red: [dark ? 0.72 : 0.55, A.c, A.h],
    Green: [dark ? 0.8 : 0.5, 0.12, 128],
    Yellow: [dark ? P.l : 0.52, P.c, P.h],
    Blue: [dark ? 0.7 : 0.48, 0.09, 250],
    Magenta: [dark ? 0.78 : 0.5, 0.11, 320],
    Cyan: [dark ? 0.82 : 0.52, 0.11, 185],
  };
  const step = dark ? 0.08 : -0.08;
  const out = {};
  for (const [name, [l, c, h]] of Object.entries(base)) {
    out[name] = oklch(l, c, h);
    out[`Bright${name}`] = oklch(Math.min(0.95, l + step), c, h);
  }
  return out;
}

const t = (scope, foreground, fontStyle) => ({
  scope,
  settings: { foreground, ...(fontStyle && { fontStyle }) },
});

function tokenColors(s, n) {
  return [
    t(['comment', 'punctuation.definition.comment'], s.comment, 'italic'),
    t(['keyword', 'storage', 'storage.type', 'keyword.control'], s.keyword),
    t(['keyword.operator', 'punctuation.separator.key-value', 'storage.modifier'], s.operator),
    t(['string', 'markup.inline.raw'], s.string),
    t(['constant.character.escape', 'string.regexp', 'string.template punctuation.definition'], s.escape),
    t(['constant.numeric', 'constant.language', 'constant.other', 'support.constant'], s.number),
    t(['entity.name.function', 'support.function', 'meta.function-call entity.name.function'], s.func),
    t(
      [
        'entity.name.type',
        'entity.name.class',
        'support.type',
        'support.class',
        'entity.other.inherited-class',
      ],
      s.type,
    ),
    t(['variable', 'meta.definition.variable'], n.text),
    t(['variable.parameter'], n.text, 'italic'),
    t(['variable.language', 'variable.language.this'], s.operator, 'italic'),
    t(
      [
        'variable.other.property',
        'support.type.property-name',
        'meta.object-literal.key',
        'entity.name.tag.yaml',
      ],
      s.property,
    ),
    t(['entity.name.tag', 'meta.tag.sgml'], s.tag),
    t(['entity.other.attribute-name'], s.keyword, 'italic'),
    t(['punctuation', 'meta.brace'], n.muted),
    t(['markup.heading', 'entity.name.section'], s.keyword, 'bold'),
    t(['markup.bold'], undefined, 'bold'),
    t(['markup.italic'], undefined, 'italic'),
    t(['markup.underline.link', 'string.other.link'], s.func),
    t(['markup.inserted'], s.string),
    t(['markup.deleted', 'invalid'], s.operator),
  ];
}

// Mixed: VS Code has no "code editor only" background. editor.background paints the whole
// editor area (Settings, extension pages, Welcome, Markdown preview, …), and those pages use
// the global foreground / descriptionForeground. So the theme is dark at its base (dark global
// text, dark webviews), and every light part of the chrome gets its own dark text color here.
function mixedOverrides(ui, ed) {
  const fill = oklch(P.l, P.c, P.h);
  const red = oklch(A.l, A.c, A.h);
  return {
    // global = the dark editor area
    foreground: ed.text,
    descriptionForeground: ed.muted,
    'icon.foreground': oklch(0.58, P.c * 0.14, P.h), // mid tone: icons sit on light and dark
    'textLink.foreground': red,
    'textLink.activeForeground': fill,
    'textPreformat.foreground': fill,
    'textPreformat.background': ed.surface,
    'editorWidget.foreground': ed.text,
    'editorSuggestWidget.foreground': ed.text,
    'editorHoverWidget.foreground': ed.text,

    // Settings editor
    'settings.headerForeground': ed.text,
    'settings.settingsHeaderHoverForeground': fill,
    'settings.modifiedItemIndicator': fill,
    'settings.focusedRowBackground': ed.raised,
    'settings.focusedRowBorder': ed.border,
    'settings.rowHoverBackground': ed.raised,
    'settings.headerBorder': ed.border,
    'settings.sashBorder': ed.border,
    'settings.textInputBackground': ed.surface,
    'settings.textInputForeground': ed.text,
    'settings.textInputBorder': ed.border,
    'settings.numberInputBackground': ed.surface,
    'settings.numberInputForeground': ed.text,
    'settings.numberInputBorder': ed.border,
    'settings.dropdownBackground': ed.surface,
    'settings.dropdownForeground': ed.text,
    'settings.dropdownBorder': ed.border,
    'settings.dropdownListBorder': ed.border,
    'settings.checkboxBackground': ed.surface,
    'settings.checkboxForeground': ed.text,
    'settings.checkboxBorder': ed.border,

    // light chrome: explicit dark text everywhere it would inherit the global foreground
    'surface.foreground': ui.text, // floating cards: sidebar, panel, aux bar
    'sideBar.foreground': ui.text,
    'sideBarTitle.foreground': ui.muted,
    'sideBarSectionHeader.foreground': ui.text,
    'panelSectionHeader.foreground': ui.text,
    // Modern activity bar + panel tabs fall back to the global (light) foreground.
    'modernActivityBar.activeForeground': ui.text,
    'modernActivityBar.hoverForeground': ui.text,
    'modernActivityBarItem.activeForeground': ui.text,
    'modernActivityBarItem.hoverForeground': ui.text,
    'modernActivityBarItem.activeBackground': oklch(P.l, P.c, P.h, 0.35),
    'modernActivityBarItem.hoverBackground': oklch(P.l, P.c, P.h, 0.18),
    'modernTab.activeForeground': ui.text,
    'modernTab.hoverForeground': ui.text,
    'panelTitle.activeForeground': ui.text,
    'panelTitle.inactiveForeground': ui.subtle,
    // Lists live on light (sidebar) and dark (suggest widget, Settings TOC) backgrounds: translucent
    // Sunny for hover / inactive selection, and the text inherits whatever its container uses.
    'list.hoverBackground': oklch(P.l, P.c, P.h, 0.16),
    'list.inactiveSelectionBackground': oklch(P.l, P.c, P.h, 0.24),
    'list.deemphasizedForeground': ui.subtle,
    'quickInput.foreground': ui.text,
    'pickerGroup.foreground': ui.primary,
    'menu.foreground': ui.text,
    'dropdown.foreground': ui.text,
    'input.foreground': ui.text,
    'checkbox.foreground': ui.text,
    'checkbox.background': ui.raised,
    'checkbox.border': ui.borderStrong,
    'keybindingLabel.foreground': ui.text,
    'keybindingLabel.background': ui.surface,
    'keybindingLabel.border': ui.border,
    'keybindingLabel.bottomBorder': ui.borderStrong,
    'notifications.foreground': ui.text,
    'notifications.background': ui.raised,
    'notifications.border': ui.border,
    'notificationCenterHeader.foreground': ui.text,
    'notificationCenterHeader.background': ui.surface,
    'notificationToast.border': ui.border,
    'commandCenter.foreground': ui.text,
    'commandCenter.activeForeground': ui.text,
    'commandCenter.background': ui.raised,
    'commandCenter.border': ui.border,
    'banner.foreground': ui.text,
    'banner.background': ui.surface2,
    'button.secondaryForeground': ui.text,
    // Output is a text editor using editor.foreground: keep it a dark box inside the light panel.
    'outputView.background': ed.bg,
  };
}

// ui: neutrals for workbench chrome; ed: neutrals for editor + panel area
function theme(name, uiMode, edMode) {
  const ui = neutrals(uiMode);
  const ed = neutrals(edMode);
  const s = syntax(edMode);
  const term = ansi(uiMode);
  // Mixed: a light line next to the dark editor reads as a hard seam, so borders that touch
  // the editor blend into the chrome instead.
  const mixed = uiMode !== edMode;
  const seam = mixed ? ui.surface : ui.border;
  const fill = oklch(P.l, P.c, P.h);
  const onFill = oklch(0.17, P.c * 0.25, P.h);
  const red = oklch(A.l, A.c, A.h);
  const sel = oklch(P.l, P.c, P.h, edMode === 'dark' ? 0.22 : 0.3);

  return {
    name,
    type: edMode, // decides default icon/diff tints; the editor is what matters most
    semanticHighlighting: true,
    colors: {
      // global
      focusBorder: ui.primary,
      foreground: ui.text,
      descriptionForeground: ui.muted,
      'icon.foreground': ui.muted,
      'widget.shadow': '#00000030',
      // Floating-panel cards (VS Code's modern layout). Their frame defaults to 15 % foreground over
      // surface.background, and surface.background defaults to the editor background, which is
      // dark in Mixed: hence the heavy dark frames. Pin both to the light chrome.
      'surface.background': ui.bg,
      'surface.border': ui.text + '26',
      'modernPanel.border': ui.text + '26',
      'modernActivityBar.border': ui.text + '26',
      // One thumb for every scrollbar, so in Mixed it has to sit on light and dark: translucent Sunny.
      'scrollbarSlider.background': oklch(P.l, P.c, P.h, 0.28),
      'scrollbarSlider.hoverBackground': oklch(P.l, P.c, P.h, 0.45),
      'scrollbarSlider.activeBackground': oklch(P.l, P.c, P.h, 0.65),
      'selection.background': sel,
      'textLink.foreground': ui.primary,
      'textLink.activeForeground': red,

      // chrome (UI mode)
      'titleBar.activeBackground': ui.surface,
      'titleBar.activeForeground': ui.text,
      'titleBar.inactiveBackground': ui.surface,
      'titleBar.inactiveForeground': ui.subtle,
      'titleBar.border': ui.border,
      'activityBar.background': ui.surface,
      'activityBar.foreground': ui.text,
      'activityBar.inactiveForeground': ui.subtle,
      'activityBar.activeBorder': red,
      'activityBar.border': ui.border,
      'activityBarBadge.background': red,
      'activityBarBadge.foreground': '#ffffff',
      'sideBar.background': ui.bg,
      'sideBar.foreground': ui.text,
      'sideBar.border': mixed ? ui.bg : ui.border,
      'sideBarTitle.foreground': ui.muted,
      'sideBarSectionHeader.background': ui.surface,
      'sideBarSectionHeader.foreground': ui.text,
      'sideBarSectionHeader.border': ui.border,
      'list.activeSelectionBackground': fill,
      'list.activeSelectionForeground': onFill,
      'list.inactiveSelectionBackground': ui.surface2,
      'list.hoverBackground': ui.surface,
      'list.focusOutline': ui.primary,
      'list.highlightForeground': red,
      'statusBar.background': ui.surface,
      'statusBar.foreground': ui.muted,
      'statusBar.border': ui.border,
      'statusBar.debuggingBackground': red,
      'statusBar.debuggingForeground': '#ffffff',
      'statusBar.noFolderBackground': ui.surface,
      'statusBarItem.remoteBackground': fill,
      'statusBarItem.remoteForeground': onFill,
      'statusBarItem.hoverBackground': ui.surface2,
      'badge.background': fill,
      'badge.foreground': onFill,
      'button.background': fill,
      'button.foreground': onFill,
      'button.hoverBackground': oklch(P.l + 0.05, P.c, P.h),
      'button.secondaryBackground': ui.surface2,
      'button.secondaryForeground': ui.text,
      'input.background': ui.raised,
      'input.foreground': ui.text,
      'input.border': ui.border,
      'input.placeholderForeground': ui.subtle,
      'dropdown.background': ui.raised,
      'dropdown.border': ui.border,
      'quickInput.background': ui.raised,
      'quickInputList.focusBackground': fill,
      'quickInputList.focusForeground': onFill,
      'menu.background': ui.raised,
      'menu.foreground': ui.text,
      'menu.selectionBackground': fill,
      'menu.selectionForeground': onFill,
      'progressBar.background': red,

      // tabs: strip belongs to the chrome, the active tab merges into the editor
      'editorGroupHeader.tabsBackground': ui.surface,
      'editorGroupHeader.tabsBorder': seam,
      'editorGroup.border': mixed ? ed.border : ui.border,
      'tab.activeBackground': ed.bg,
      'tab.activeForeground': ed.text,
      'tab.activeBorderTop': fill,
      'tab.inactiveBackground': ui.surface,
      'tab.inactiveForeground': ui.muted,
      'tab.border': seam,
      'tab.hoverBackground': ui.surface2,
      // The modern tab styling ignores tab.active* and falls back to the global (dark) foreground.
      // The close icon inherits the label color, so this fixes both.
      'tab.selectedBackground': ed.bg,
      'tab.selectedForeground': ed.text,
      'tab.unfocusedActiveForeground': ed.muted,
      'modernEditorTab.activeBackground': ed.bg,
      'modernEditorTab.activeForeground': ed.text,
      'modernEditorTab.activeHoverBackground': ed.bg,
      'modernEditorTab.activeActionBackground': ed.bg,
      'modernEditorTab.activeHoverActionBackground': ed.surface,
      'modernEditorTab.selectedActionBackground': ed.surface,
      'modernEditorTab.hoverBackground': ui.surface2,
      'modernEditorTab.hoverForeground': ui.text,
      'breadcrumb.background': ed.bg,
      'breadcrumb.foreground': ed.subtle,
      'breadcrumb.focusForeground': ed.text,

      // editor (editor mode)
      'editor.background': ed.bg,
      'editor.foreground': ed.text,
      'editorLineNumber.foreground': ed.borderStrong,
      'editorLineNumber.activeForeground': ed.primary,
      'editorCursor.foreground': fill,
      'editor.selectionBackground': sel,
      'editor.inactiveSelectionBackground': oklch(P.l, P.c, P.h, 0.12),
      'editor.selectionHighlightBackground': oklch(P.l, P.c, P.h, 0.12),
      'editor.wordHighlightBackground': oklch(P.l, P.c, P.h, 0.1),
      'editor.findMatchBackground': oklch(A.l, A.c, A.h, 0.45),
      'editor.findMatchHighlightBackground': oklch(A.l, A.c, A.h, 0.2),
      'editor.lineHighlightBackground': ed.raised,
      'editor.lineHighlightBorder': '#00000000',
      'editorIndentGuide.background1': ed.border,
      'editorIndentGuide.activeBackground1': ed.borderStrong,
      'editorWhitespace.foreground': ed.border,
      'editorBracketMatch.background': oklch(P.l, P.c, P.h, 0.15),
      'editorBracketMatch.border': ed.primary,
      'editorBracketHighlight.foreground1': s.keyword,
      'editorBracketHighlight.foreground2': s.func,
      'editorBracketHighlight.foreground3': s.type,
      'editorGutter.background': ed.bg,
      'editorGutter.addedBackground': s.string,
      'editorGutter.modifiedBackground': fill,
      'editorGutter.deletedBackground': red,
      'editorWidget.background': ed.surface,
      'editorWidget.border': ed.border,
      'editorSuggestWidget.background': ed.surface,
      'editorSuggestWidget.selectedBackground': ed.surface2,
      'editorSuggestWidget.highlightForeground': ed.primary,
      // The selected row would default to the list selection text (dark, for the yellow fill).
      'editorSuggestWidget.selectedForeground': ed.text,
      'editorSuggestWidget.selectedIconForeground': ed.text,
      'editorSuggestWidget.focusHighlightForeground': ed.primary,
      'editorSuggestWidget.border': ed.border,
      'editorHoverWidget.background': ed.surface,
      'editorHoverWidget.border': ed.border,
      'editorError.foreground': red,
      'editorWarning.foreground': fill,
      'editorRuler.foreground': ed.border,
      'minimap.background': ed.bg,

      // panel + terminal follow the UI, only the editor itself is dark in Mixed
      'panel.background': ui.bg,
      'panel.border': ui.border,
      'panelTitle.activeForeground': ui.text,
      'panelTitle.activeBorder': fill,
      'panelTitle.inactiveForeground': ui.subtle,
      'terminal.background': ui.bg,
      'terminal.foreground': ui.text,
      'terminalCursor.foreground': fill,
      'terminal.ansiBlack': ui.surface2,
      'terminal.ansiRed': term.Red,
      'terminal.ansiGreen': term.Green,
      'terminal.ansiYellow': term.Yellow,
      'terminal.ansiBlue': term.Blue,
      'terminal.ansiMagenta': term.Magenta,
      'terminal.ansiCyan': term.Cyan,
      'terminal.ansiWhite': ui.muted,
      'terminal.ansiBrightBlack': ui.subtle,
      'terminal.ansiBrightRed': term.BrightRed,
      'terminal.ansiBrightGreen': term.BrightGreen,
      'terminal.ansiBrightYellow': term.BrightYellow,
      'terminal.ansiBrightBlue': term.BrightBlue,
      'terminal.ansiBrightMagenta': term.BrightMagenta,
      'terminal.ansiBrightCyan': term.BrightCyan,
      'terminal.ansiBrightWhite': ui.text,

      'gitDecoration.modifiedResourceForeground': ui.primary,
      'gitDecoration.untrackedResourceForeground': oklch(uiMode === 'dark' ? 0.8 : 0.5, 0.12, 128),
      'gitDecoration.deletedResourceForeground': red,
      'gitDecoration.ignoredResourceForeground': ui.subtle,
      ...(mixed && mixedOverrides(ui, ed)),
    },
    tokenColors: tokenColors(s, ed),
    semanticTokenColors: {
      parameter: { foreground: ed.text, italic: true },
      property: s.property,
      'variable.readonly': ed.text,
      enumMember: s.number,
    },
  };
}

// --- iTerm2 color presets, from the same colors as the VS Code terminal ------
const hexRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
/** `#rrggbbaa` composited over an opaque background: iTerm ignores alpha on most colors. */
const over = (hex, bg) => {
  const a = hex.length === 9 ? parseInt(hex.slice(7), 16) / 255 : 1;
  const [f, b] = [hexRgb(hex), hexRgb(bg)];
  return f.map((v, i) => v * a + b[i] * (1 - a));
};
const plistColor = ([r, g, b], alpha = 1) =>
  `\t<dict>
\t\t<key>Alpha Component</key><real>${alpha}</real>
\t\t<key>Blue Component</key><real>${b.toFixed(6)}</real>
\t\t<key>Color Space</key><string>sRGB</string>
\t\t<key>Green Component</key><real>${g.toFixed(6)}</real>
\t\t<key>Red Component</key><real>${r.toFixed(6)}</real>
\t</dict>`;

function itermColors(c) {
  const bg = c['terminal.background'];
  const names = ['Black', 'Red', 'Green', 'Yellow', 'Blue', 'Magenta', 'Cyan', 'White'];
  const entries = {
    ...Object.fromEntries(
      names.flatMap((n, i) => [
        [`Ansi ${i} Color`, hexRgb(c[`terminal.ansi${n}`])],
        [`Ansi ${i + 8} Color`, hexRgb(c[`terminal.ansiBright${n}`])],
      ]),
    ),
    'Background Color': hexRgb(bg),
    'Foreground Color': hexRgb(c['terminal.foreground']),
    'Bold Color': hexRgb(c['terminal.ansiBrightWhite']),
    'Cursor Color': hexRgb(c['terminalCursor.foreground']),
    'Cursor Text Color': hexRgb(bg),
    // Same yellow tint as the editor selection, pre-blended (iTerm draws selections opaque).
    'Selection Color': over(c['editor.selectionBackground'], bg),
    'Selected Text Color': hexRgb(c['terminal.foreground']),
    'Link Color': hexRgb(c['terminal.ansiBlue']),
    'Badge Color': [...hexRgb(c['terminalCursor.foreground'])],
    'Cursor Guide Color': over(c['editor.selectionBackground'], bg),
  };
  const alpha = { 'Badge Color': 0.5, 'Cursor Guide Color': 0.25 };
  const body = Object.entries(entries)
    .toSorted(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `\t<key>${k}</key>\n${plistColor(v, alpha[k] ?? 1)}`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
${body}
</dict>
</plist>
`;
}

mkdirSync(new URL('./themes/', import.meta.url), { recursive: true });
mkdirSync(new URL('./iterm/', import.meta.url), { recursive: true });
for (const [file, name, ui, ed] of [
  ['sunny-mixed', 'Sunny Mixed', 'light', 'dark'],
  ['sunny-dark', 'Sunny Dark', 'dark', 'dark'],
  ['sunny-light', 'Sunny Light', 'light', 'light'],
]) {
  const json = theme(name, ui, ed);
  writeFileSync(new URL(`./themes/${file}.json`, import.meta.url), JSON.stringify(json, null, 2));
  console.log(`themes/${file}.json`);
  // Mixed has a light terminal, same as Light: no separate preset.
  if (file !== 'sunny-mixed') {
    writeFileSync(new URL(`./iterm/${file}.itermcolors`, import.meta.url), itermColors(json.colors));
    console.log(`iterm/${file}.itermcolors`);
  }
}
