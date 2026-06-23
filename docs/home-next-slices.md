---
read_when:
  - planning the next authenticated home-screen improvements
  - resuming homepage roadmap work after the initial now-playing and transport slices
---

# Home Next Slices

Short capture of the most valuable follow-up improvements after:

1. authenticated home shell
2. now-playing hero
3. recent panel
4. transport controls
5. live playback progress sync

## Recommended Order

### 1. Device State Polish

Goal: make playback/device state feel trustworthy.

Why next:

- current home can still show `No active device` in cases that are confusing
- transport failures are more understandable if device state is explicit

Desired outcomes:

- show the active device more reliably
- explain `no active device` vs `playback controlled elsewhere`
- surface a clearer failure state when transport has nowhere to go

Status:

- started with stale active-device reconciliation and contextual no-device transport errors

## 2. Spotify-Like Home Reshape

Goal: make the authenticated shell feel like a compact Spotify client.

Why next:

- biggest product win after now-playing
- removes low-value Home chrome that duplicated the bottom player
- gives Home a clearer hierarchy: search, shortcuts, discovery

Desired outcomes:

- library-first sidebar instead of page navigation
- interactive search bar at the top of the main pane
- `Quick launch` from the user library
- `Picked for you` from featured playlists

Status:

- completed in the Spotify-like shell slice
- bottom player owns now-playing; Home no longer duplicates it
- sidebar now represents the user library
- Home shows search, quick launch, and featured picks
- Quick launch uses library priority: pinned playlists, then owned playlists, then Spotify order
- search results replace Home content in the main pane

## 3. Background Refresh Polish

Goal: make the home feel more live and less mechanically refreshed.

Why:

- live progress now works, but the rest of the sync loop can still feel blunt

Desired outcomes:

- reduce redraw noise
- smarter status-line handling during silent refresh
- optional subtle `live` signal instead of static `Refreshed`

## 4. Better Transport Feedback

Goal: make transport actions easier to trust and debug.

Why:

- current transport works, but error states can still be clearer

Desired outcomes:

- stronger success/error copy for `next` and `previous`
- clearer guidance for premium/device/scope failures
- better relink messaging when scopes are stale

## 5. Progress / Timing Polish

Goal: refine playback feel after the functional fix is shipped.

Desired outcomes:

- smoother progress bar behavior
- elapsed + remaining time
- better snapping on scrub or sudden track transitions

## 7. Home Architecture Cleanup

Goal: keep future homepage work maintainable.

Why:

- `terminal-app.tsx` still owns a lot of orchestration
- more home features will get expensive without one more split

Desired outcomes:

- separate authenticated home controller from launcher/auth shell
- keep state/update logic testable outside the main terminal entry file

Status:

- completed in the authenticated shell split
- launcher/auth shell stays in `terminal-app.tsx`
- authenticated page orchestration moved behind dedicated controller/state modules
- follow-up cleanup split commands, selectors, effects, input intents, and view pieces so future home work should land in feature modules instead of the controller

## Recommendation

If only one roadmap order is needed, use:

1. Device state polish
2. Background refresh polish
3. Better transport feedback
4. Progress / timing polish

This is the best path from “good terminal status app” to “real Spotify-like terminal surface”.
