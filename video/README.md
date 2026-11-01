# Launch video

A 40 second, 1080x1920 (9:16) launch video for Reels, TikTok and Shorts, built
with [Remotion](https://www.remotion.dev). It lives in its own folder with its
own dependencies so nothing here touches the Next.js app.

| Time | Beat |
| --- | --- |
| 0 to 5s | Close on the empty squares, pull back to the whole million. "1,000,000 squares." |
| 5 to 21s | Zoom to the centre; squares fill with photos one by one, then in a rush |
| 13 to 21s | "$10 each. One per person. Forever." |
| 21 to 31s | Square #1,000 highlights, gets its photo, and locks in |
| 31 to 40s | End card: "You get one. Forever. Choose wisely." + themillionsquare.com |

The fill order uses the site's real geometry (`../src/lib/wall/geometry.ts`), so
the wall grows centre outward exactly as it does in production. Photos are
painted procedurally (`src/photos.ts`) as placeholders; no real customer images
are used. Colours come from `src/app/globals.css`; type is Inter (OFL, bundled
in `public/fonts`).

## Commands

```bash
npm install
npm run studio   # live preview and scrubbing in the browser
npm run build    # renders out/launch-video.mp4, then out/million-squares-launch.mp4
```

`out/million-squares-launch.mp4` is the file to post: H.264 High, yuv420p,
silent AAC track, faststart. `npm run social` needs `ffmpeg` on the PATH.

If Remotion should use an already-installed Chrome instead of downloading one,
set `REMOTION_BROWSER=/path/to/chrome-headless-shell`.

Timing, copy and the hero square are constants at the top of
`src/LaunchVideo.tsx`.
