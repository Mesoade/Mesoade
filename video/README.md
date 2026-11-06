# Day 6 video edit (Remotion)

B-roll and number graphics on top of the Day 6 talking-head clip. The captions are already burned into the source clip.

- B-roll panels cover the top of the frame (above y=1250), so the burned-in captions stay visible.
- The only audio is the original voice plus synthesized sound effects (`public/sfx`). There is no music.
- Photo tiles in `public/photos` are cropped from the site screenshot (`public/site.png`).

## Setup

1. Put the raw clip at `public/day6.mp4`. It is git-ignored because of its size.
2. `npm i`
3. Preview with `npx remotion studio`. Render with `npx remotion render Day6 out/day6-edited.mp4`.

All cut points are in `src/Day6.tsx`, one `<Sequence>` per B-roll scene. The scenes live in `src/scenes.tsx`.
