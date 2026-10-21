# AI Test Pilot UI and favicon transfer instructions

This repository contains a UI transfer package, not a standalone Angular application.
Use these files as the source of truth when porting the recording page into the destination application. Do not copy an entire application or backend into this repository.

## Files to transfer

- `src/app/components/test-recording-page/test-recording-page.html`
- `src/app/components/test-recording-page/test-recording-page.scss`
- `src/app/components/test-recording-page/test-recording-page.ts`
- `public/assets/frameworks/playwright.svg`
- `public/assets/frameworks/puppeteer.svg`
- `public/favicon.svg` — vector paper-plane and test-checkmark favicon
- `public/favicon.ico` — 16, 32, 48, and 64px browser fallback
- `public/favicon.png` — 256px preview/export
- `src/index.html` — browser title and favicon link reference

## Prompt for GitHub Copilot

Port the recording-page UI from this package into the destination Angular application. Preserve destination functionality if it has additional behavior. Review differences before replacing existing files.

1. Port the HTML template and its accompanying SCSS together. Preserve Angular bindings, handlers, validation, recording controls, credentials, export, test generation, execution, and recorded-data functionality.
2. Include the gradient hero, browser illustration, fixed-proportion curved dashed SVG arrows, and framework preview icons.
3. Keep the URL input with dynamic subscript sizing and no Enter-key helper text. Enter must still start recording.
4. Keep Start Recording blue. Bind `recording-active` to `isRecording || isExternalRecording` so Stop Recording is red with a darker red hover state in both themes.
5. Include Cypress, Playwright, and Puppeteer selection cards with the supplied SVG icons. Copy both SVG files exactly into `public/assets/frameworks/` and preserve their template URLs.
6. For TypeScript, port only this UI-related change into the destination component; preserve the rest of its existing logic and default selections:

   ```typescript
   availableFrameworks: TestFramework[] = this.testGeneratorService.frameworks.filter(
     framework => framework.id !== 'selenium'
   );
   ```

   The supplied full TypeScript file is context. Do not overwrite newer destination recording logic. Remove Selenium only from this page's choices, not from the shared generation service.
7. Include Quick Stats and What You Get. Use overview columns `minmax(0, 0.9fr) minmax(0, 1.2fr)` on desktop, retaining mobile stacking. Keep User Actions, Auto-Generate, and Multiple Frameworks intact; wrap whole feature items when necessary.
8. Preserve compact panel heights, aligned content, consistent framework icon sizing, selected/hover/focus styles, and responsive behavior.
9. Include all `:host-context(.dark-theme)` styles for the hero, illustration, form field, controls, cards, statistics, feature icons, settings, selected, disabled, focus, and validation states. Use the application's existing theme toggle.
10. Preserve expandable recording settings and credentials, and the conditional secondary export/generation actions.

Do not modify backend files, dependencies, global theme settings, or shared framework-generation services. Specifically, do not include `server/src/services/headless-recording.service.js`; its local changes are unrelated.

## AI Test Pilot favicon and browser title

![AI Test Pilot favicon](public/favicon.png)

Use the paper-plane icon with the green test checkmark provided in this package. Do not regenerate or substitute the earlier scan-frame icon.

1. Copy `public/favicon.svg` and `public/favicon.ico` exactly into the destination application's `public/` directory. The supplied ICO already contains 16, 32, 48, and 64px variants. `public/favicon.png` is an optional 256px preview/export.
2. Merge these entries into the destination `src/index.html` head, using the supplied file as a reference. Preserve the destination base URL, scripts, metadata, font links, and other head content. Replace existing favicon declarations to avoid duplicate or conflicting icons:

   ```html
   <title>AI Test Pilot</title>
   <link rel="icon" type="image/x-icon" href="favicon.ico">
   <link rel="icon" type="image/svg+xml" href="favicon.svg">
   ```

3. Keep the asset paths relative so the application's base URL resolves them correctly. Angular's existing public-assets configuration should serve them at the app root; do not add dependencies.
4. Confirm the SVG and ICO load successfully in the destination app, inspect the browser tab in both light and dark browser themes, and check the small-size rendering. Browsers cache favicons aggressively; if the previous icon persists, reload with cache disabled or open a fresh browser session.

This commit includes the favicon and browser title. Other local AI Test Pilot branding changes across navigation, emails, and reports are not included in this transfer package.

## Validation in the destination application

- Run `npx ngc -p tsconfig.app.json --noEmit`.
- Compile SCSS using the project's build tooling and run `git diff --check`.
- Review desktop and mobile layouts in both light and dark themes.
- Verify blue Start and red Stop states, framework selection, URL validation, recording controls, credentials, export, generation, and execution.

The source changes passed Angular template/type checking and standalone SCSS compilation. The full Angular build previously exited without diagnostics; do not treat that as a successful build. This transfer repository has no package manifest or complete app, so application validation must run in the destination repository.
