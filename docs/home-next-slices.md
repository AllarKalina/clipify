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

## 2. Queue / Up Next

Goal: make the home screen useful even when the current track is already obvious.

Why next:

- biggest product win after now-playing
- gives the home screen a forward-looking surface
- makes the app feel like a controller, not only a status board

Desired outcomes:

- small `Up next` or queue panel near the hero
- enough metadata to identify upcoming tracks quickly
- terminal-friendly, compact rendering

## 3. Playlists Quick Launch

Goal: let the home screen start music, not only observe and control it.

Why after queue:

- natural next step once playback state is solid
- gives users a direct “do something” entry point from home

Desired outcomes:

- short list of recent or pinned playlists
- fast keyboard launch from the home screen
- compact metadata and clear selection behavior

## 4. Background Refresh Polish

Goal: make the home feel more live and less mechanically refreshed.

Why:

- live progress now works, but the rest of the sync loop can still feel blunt

Desired outcomes:

- reduce redraw noise
- smarter status-line handling during silent refresh
- optional subtle `live` signal instead of static `Refreshed`

## 5. Better Transport Feedback

Goal: make transport actions easier to trust and debug.

Why:

- current transport works, but error states can still be clearer

Desired outcomes:

- stronger success/error copy for `next` and `previous`
- clearer guidance for premium/device/scope failures
- better relink messaging when scopes are stale

## 6. Progress / Timing Polish

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
2. Queue / up next
3. Playlists quick launch
4. Background refresh polish

This is the best path from “good terminal status app” to “real Spotify terminal surface”.
