# Orlo extensions

Built-in extensions live in `quick-timer/`, `voice-note/` and `calculator/`. The shared catalog describes known capabilities; enabled settings determine which capabilities the AI may select. `external/` owns folder imports and the isolated HTML renderer.

## Importing an external plugin

On `/plugins`, click **Import** in the main header and choose the plugin folder. It must contain exactly one `orlo-plugin.json` and the built HTML entry file it names. Imported plugins start disabled. Enable a card, select **Try it**, or ask the dashboard to “Show Mini Counter” after importing the included sample at `examples/plugins/mini-counter`.

```json
{
  "version": 1,
  "id": "mini-counter",
  "name": "Mini Counter",
  "description": "A small counter for tracking repetitions or completed steps.",
  "entry": "index.html"
}
```

Use a unique lowercase ID with letters, digits and hyphens, 3–64 characters. Built-in IDs are reserved. Packages have a limit of 100 files / 2 MB; up to 10 plugins can be installed. Re-importing an existing ID is rejected. Remove the installed package before importing a replacement; saved dashboard references keep their plugin ID.

HTML can reference local JavaScript, CSS, image and WOFF2 assets with quoted `src` or `href` attributes. Import embeds those files into the saved document. Bundle JavaScript dependencies into one file and embed CSS dependencies such as images/fonts as data URLs. Relative module imports, runtime asset fetching, remote URLs, parent-folder paths, npm installs and raw React/TypeScript source builds are outside this package format. This is a browser plugin import, not a build pipeline.

Plugins run inside an iframe with `sandbox="allow-scripts"` and a restrictive content policy. They have no Orlo data/API bridge, parent DOM access, microphone/camera permissions or parent storage access. The host does not handle plugin messages. Plugin names/descriptions are treated as catalog data by intent routing. See [MDN iframe sandbox documentation](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/iframe#sandbox).

Installed HTML, metadata and enabled state are stored in browserDatabase. Import reports when changes can only be kept for the current session. Plugin internal state stays within the iframe and is not persisted by Orlo. Disabling removes its live iframe, while saved dashboard components remain placeholders. Local-data reset removes imported packages and all enabled settings.

Calculator is a built-in component with operator precedence, parentheses, unary signs, decimals, percentages and keyboard input. `%` divides a value by 100 (`200 × 10% = 20`). It parses arithmetic rather than executing JavaScript.

Verification: `npm test`, `npm run test:plugin-import`, and `npm run test:extensions`. Browser scripts accept `ORLO_PLAYWRIGHT_MODULE` and `ORLO_CHROME_PATH` for an existing Playwright/Chromium installation.

## Card icons

Each built-in extension owns a `metadata.json` with an `iconSvg` string. Its definition exposes that icon through the extension catalog, and the Plugins page renders it as an SVG image. Stopwatch and Whiteboard keep their coming-soon card metadata in their own folders. Imported plugins currently use the external extension’s default icon. Change an icon in its metadata file instead of adding plugin-specific icon conditions to the page.
