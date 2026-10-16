# Haunted Slime Overlay (Chrome MV3)

Puts a Halloween overlay on any website: glossy orange and toxic-green slime dripping from the top of the page and the tops of cards, slimed progress bars, recolored card borders (orange, green, or purple), jack-o'-lanterns on card corners, spiders hanging on threads, corner cobwebs, faint ghosts, bats, and tombstones in the background, a ghost peeking in from the edge, and a haunted-house and graveyard silhouette on dashed empty-state cards. All of the art is original inline SVG.

![screenshot](docs/screenshot.png)

## Slime rendering
`slimeSVG(width, color, seed, kind)` is a seeded generator. For each strip it builds ONE continuous path made only of smooth cubic Béziers: a wavy band that sags slightly between drips, with drips that flow out through concave shoulders, taper at the neck and end in round bulbs. There is no threshold filter, so the edges stay crisp and anti-aliased.
- **Shading:** a vertical gradient (light top, saturated middle, slightly darker bottom), a faint inner luminance, a soft blurred specular streak along the upper band, and small highlights on the bulbs.
- **Glow:** a tight same-hue halo made of two stacked CSS `drop-shadow`s (1.2px and 3.5px).
- **Colours:** sampled from the reference. Orange is #e96c1a and green is #6cc338.
- **kind = top:** the orange band runs from the left to about 52% of the width. The green band starts after a 6px gap, with no blending between them.
- **kind = card:** slime sits at the top-right corner and thins out toward the left. It wraps a short way down the right border and has 3–5 drips.
- **kind = bar:** the progress-bar fill becomes a goo bar with short, fairly regular drips.
- **Card styling:** cards follow the reference's order of colours and toppers: a pumpkin, a ghost plus pumpkin, a tombstone, or a bat. Alert banners get an orange border and a pumpkin or ghost by their button.
- **Graveyard:** dashed empty-state cards get a low-contrast graveyard and haunted-house silhouette. It is drawn behind the card content (`z-index:-1` inside an isolated card).

## Pumpkins and spiders
- **Jack-o'-lanterns:** each one has a radial halo layer and a blurred face-glow layer. Their opacity (and the halo's scale) breathes on a 2.6–4s ease-in-out cycle with small irregular flickers. Each pumpkin has its own duration and phase.
- **Hanging spiders:** a seeded `requestAnimationFrame` scheduler moves them. Each spider drops in short bursts, rests, sometimes climbs back up (more slowly), and turns slightly. It swings like a damped pendulum after each move, with a slower swing on a longer thread. The legs wiggle while it moves.
- **Crawling spider:** one spider walks along the top-right cobweb, pausing and changing direction.
- Everything is driven by transforms only. Under reduced-motion the spiders stay static.

## Overlay layer, progress bars, fog
- **Overlay layer:** card decorations (slime, pumpkins, ghosts, tombstones, bats) and progress-bar slime are drawn in a fixed top-level layer, not inside the cards, so a card's `overflow:hidden` can never clip them. Each one is positioned from its card's `getBoundingClientRect()`. Positions are refreshed on scroll (capture phase, so scroll containers count too), on resize, by a `ResizeObserver`, and by a 500ms safety re-sync. Each decoration is clipped to its card's nearest scrolling/clipping ancestor. Hidden elements (`checkVisibility`) such as closed menus are skipped.
- **Progress bars:** the slime covers only the *filled* part of the bar. The fill is measured from the coloured descendant's rendered box (which includes `transform: scaleX`). If there isn't one, it falls back to `aria-valuenow`/`max` or `<progress>.value`. A fill of 0% gets no slime. Fills nested inside a track are never treated as tracks themselves. The goo stays close to the bar's real height (6–11px) and updates when the fill changes.
- **Fog:** the fog layers are `100% + 1600px` wide and use a seamless, stitched `feTurbulence` tile that loops by exactly two tile widths, so no edge is ever exposed. They are feathered with vertical mask gradients and have no blur filter or clip. Checked at 1280, 1728 and 2560px wide, at the start, middle and end of the animation.

## Gloom layer
A full-viewport layer that ignores clicks: an edge vignette with an occasional subtle flicker, a light desaturating purple/green grade (`backdrop-filter: saturate(.88)`), two layers of slowly drifting `feTurbulence` fog near the bottom, and faint film grain. All of it is animated with transform/opacity only and stops under reduced-motion.

## Install
1. Go to `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. Click **Load unpacked** and select this folder
4. Click the extension's toolbar icon to turn it on or off for the current site, or for every site.

## How it works
- `content.js` runs on `<all_urls>`. It adds one fixed `.hw-root` layer (z-index 2147483000, `pointer-events:none`) that holds the top slime band, the cobwebs, the spiders, the background ghosts and bats, and the flying bat.
- **Card detection:** looks for elements that are at least 160×60 and narrower than 95% of the viewport, have a border-radius of 3px or more, and have a border or box-shadow. Fixed and sticky elements and nested cards are skipped. At most 24 cards get decorated. Borders are recolored on a rotating orange/purple/green cycle. Orange and green cards get slime on the top-right; purple cards get a little ghost instead.
- **Progress bars:** `<progress>`, `[role=progressbar]`, and thin rounded bars inside cards (3–14px tall with a child fill element). The fill width comes from the child element's width or from `aria-valuenow`/`value`. At most 20 bars.
- **Dynamic pages:** a `MutationObserver` with an 800ms throttle plus `requestIdleCallback`. The observer ignores the extension's own nodes.
- **Settings:** stored in `chrome.storage.sync` (`hwDisabledHosts`, `hwGlobalOff`).
- **Animation:** only `transform` and `opacity` are animated. Drips slowly stretch, droplets break off and fall, spiders bob up and down on their threads, ghosts drift and pulse, bats flap and one flits across the page, and pumpkins flicker. All of it is turned off under `prefers-reduced-motion: reduce`.

## Known limitations
- The gloom grade sits above the page, so it also tones the slime a little. The grade is kept light so the slime stays vivid. `backdrop-filter` has some GPU cost on very large screens.
- The card detection is a heuristic. Sites built on flat or borderless designs (Hacker News, much of GitHub's logged-out homepage) get only the page-level layer (top band, webs, spiders, ghosts), not per-card slime.
- An overlaid decoration can briefly lag (one frame) behind a card while it animates or moves. Clipping only goes as far as the nearest scroll container, so a sticky header inside that container can end up with decorations drawn over it.
- Statically positioned dashed empty-state cards are switched to `position: relative` so the decorations can anchor to them. Cards with `overflow:hidden` clip any slime that hangs past their edges.
- Turning the overlay off reloads the tab so the page goes back to exactly how it was.
- Iframes and closed shadow DOM are not decorated. Chrome blocks content scripts on `chrome://` pages and the Web Store.
