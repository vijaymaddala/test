# AI Test Pilot UI, navigation, and favicon transfer instructions

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

Additional navigation reference files:

- `src/app/components/navigation/sidenav/sidenav.html`
- `src/app/components/navigation/sidenav/sidenav.scss`
- `src/app/components/navigation/sidenav/sidenav.ts`
- `src/app/components/navigation/navbar/navbar.html`
- `src/app/components/navigation/navbar/navbar.scss`
- `src/app/components/navigation/navbar/navbar.ts`

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

## Recorded Data section update

Apply the latest Recorded Data changes from the supplied HTML and SCSS together. No additional TypeScript changes are needed for this section.

- Use the `recorded-data-card` surface, history icon, compact heading/subtitle, and styled Material tabs. Preserve the card's `hasRecordingData` condition and the conditional Network Activity tab.
- Render actions as compact `recorded-action` rows with an icon, description, metadata, and grouped badges. Keep timestamps in metadata only, removing the old duplicate right-aligned timestamp.
- Keep `showActionTypes`, `showTimestamps`, `showValidations`, `showNetworkCalls`, and compact/detailed layout preferences connected to the existing component state.
- Preserve validation relevance, confidence, tooltip, validation-trigger badge, and validation-description behavior using the existing component methods.
- In detailed mode, show Element, Text, Value, XPath, and Position in the definition-list detail block. Long selectors, XPath values, and network URLs must wrap without overflowing the card.
- Include styled API call, asset failure, and API failure entries; retain their existing conditions, methods, statuses, timestamps, content types, errors, and request/response indicators.
- Preserve empty states and the responsive mobile layout, where badges move below the action description.
- Include the appended Recorded Data SCSS, its Material tab overrides, and its `:host-context(.dark-theme)` overrides. Check text, badge, field, divider, and card contrast in both themes.
- Keep the preceding recording controls, framework cards, statistics, generated tests, and execution components unchanged when merging this section into an existing destination app.

Validation: run Angular template/type checking and SCSS compilation in the destination application. Inspect empty and populated action/network tabs, compact and detailed views, long URLs/selectors, validation badges, and mobile layouts in both themes. The source update passed Angular template/type checking and standalone SCSS compilation.

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

This commit includes the favicon and browser title. Top-bar and side-navigation branding are included in the navigation update below. Other local branding changes across emails, reports, login, and other screens are not included in this transfer package.

## Side navigation and top bar update

Port the six navigation files listed above as a coordinated change. They are full component references; merge the changes into the destination app without removing newer navigation items, authentication behavior, or application-specific actions.

### Side navigation

- Use the supplied `sidenav.html` and `sidenav.scss` for grouped Workspace, Testing, Insights, and Team sections, compact icon/text rows, muted section labels, and active/hover/focus states.
- Keep the AI Test Pilot logo, name, and slogan in the TOP BAR only. Do not restore the earlier duplicate sidebar brand header. In overlay/push modes, preserve the sidebar Navigation label and accessible close button.
- Keep flat 4px menu corners and the slim active indicator. Use the Angular Material 20 `--mat-list-*` variables, especially `--mat-list-active-indicator-shape` and `--mat-list-active-indicator-color`; the older `--mdc-list-*` names do not control this app's menu appearance.
- In TypeScript, remove the old `applySidenavStyles()` DOM color overrides, delayed reapplication, `AfterViewInit`, and element reference. Use the supplied theme/class/CSS-variable bindings instead, so active and hover styling can work.
- Preserve the settings and authentication subscriptions and clean them up on destroy. Preserve configured item visibility, custom background/contrast colors, dark/light themes, route navigation, nested item expansion, emitted events, mobile closing behavior, and backdrop handling.
- Build `navigationSections` from the visible items as in the supplied component. Omit empty groups, and include unmatched/future destinations in More. Merge any destination-only routes into the appropriate group or leave them in More; never drop enabled destinations.
- Retain semantic navigation links, current-page state, keyboard focus indicators, accessible group labels, child controls, and close-button labels.

### Top navigation

- Point the brand image at `favicon.svg`, with explicit 32px width/height. Remove the obsolete `assets/images/logo.png` reference and its hide-on-error attribute.
- Use the two-line `logo-copy` block: AI Test Pilot followed by “Test smarter. Ship confidently.” The caption is hidden at widths of 600px and below to preserve space for controls.
- Port the appended SCSS for the brand text, caption, hamburger button, and responsive spacing. Keep existing login/user menus, theme toggle, permissions, and navigation behavior.
- Merge the contrast calculation in `applyNavbarStyles()`: preserve the configured navbar background and derive `--navbar-foreground` from its relative luminance. Use it for the brand and hamburger, including hover/focus states. This keeps the icon visible on both light and dark custom backgrounds.
- Preserve the existing navbar theme/settings subscriptions, lifecycle, and user state logic. Do not replace newer destination behavior wholesale with the supplied full TypeScript file.

Validation: Angular template/type checking and standalone SCSS compilation passed in the source app. Navigation grouping checks verified all 19 existing routes appear once, hidden links are excluded, empty groups disappear, and future links remain available. In the destination, check active-route styling, keyboard navigation, visibility settings, custom light/dark colors, long labels, mobile closing, backdrop behavior, child expansion, the slogan breakpoint, and hamburger contrast.

## Validation in the destination application

- Run `npx ngc -p tsconfig.app.json --noEmit`.
- Compile SCSS using the project's build tooling and run `git diff --check`.
- Review desktop and mobile layouts in both light and dark themes.
- Verify blue Start and red Stop states, framework selection, URL validation, recording controls, credentials, export, generation, and execution.

The source changes passed Angular template/type checking and standalone SCSS compilation. The full Angular build previously exited without diagnostics; do not treat that as a successful build. This transfer repository has no package manifest or complete app, so application validation must run in the destination repository.
