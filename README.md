# Haunted Slime Overlay (Chrome MV3)

Puts a Halloween overlay on any website: glossy orange and toxic-green slime dripping from the top of the page and the tops of cards, slimed progress bars, recolored card borders (orange, green, or purple), jack-o'-lanterns on card corners, spiders hanging on threads, corner cobwebs, faint ghosts, bats, and tombstones in the background, a ghost peeking in from the edge, and a haunted-house and graveyard silhouette on dashed empty-state cards. All of the art is original inline SVG.

![screenshot](docs/screenshot.jpg)

## Slime rendering
Each slime strip is one continuous band, flush with the edge, with dense tapered drips that end in small teardrop tips. A gooey SVG filter (`feGaussianBlur` plus a `feColorMatrix` alpha threshold) fuses the drips into the band. Then `feOffset`/`feComposite` add a darker lower rim, `feSpecularLighting` adds wet gloss, a white specular streak runs along the band and down the drips, and a blurred flood adds a colored glow. On cards the slime starts at the top-right corner, wraps over it and a little way down the right border, and has a pumpkin sitting on it. Progress-bar fills are replaced by a gooey slime bar with short drips.

## Colours
The colours are calibrated to sit slightly darker than the reference. Green is #4fa82a–#5fbf30 with an olive rim (#2f5e18), and orange is #d0601a–#dd7424 with a rim of #8a3d12. The glow and the specular highlights are kept low but still look glossy. The top band is a thin, green-only strip with many thin tapered drips. Card and progress-bar slime keep the colour assigned to each card.

## Pumpkins and spiders
- **Jack-o'-lanterns:** each one has a radial halo layer and a blurred face-glow layer. Their opacity (and the halo's scale) breathes on a 2.6–4s ease-in-out cycle with small irregular flickers. Each pumpkin has its own duration and phase.
- **Hanging spiders:** a seeded `requestAnimationFrame` scheduler moves them. Each spider drops in short bursts, rests, sometimes climbs back up (more slowly), and turns slightly. It swings like a damped pendulum after each move, with a slower swing on a longer thread. The legs wiggle while it moves.
- **Crawling spider:** one spider walks along the top-right cobweb, pausing and changing direction.
- Everything is driven by transforms only. Under reduced-motion the spiders stay static.

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
- Statically positioned cards are switched to `position: relative` so the decorations can anchor to them. Cards with `overflow:hidden` clip any slime that hangs past their edges.
- Turning the overlay off reloads the tab so the page goes back to exactly how it was.
- Iframes and closed shadow DOM are not decorated. Chrome blocks content scripts on `chrome://` pages and the Web Store.
