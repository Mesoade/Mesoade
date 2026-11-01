import { Composition } from 'remotion'
import { DURATION, FPS, HEIGHT, LaunchVideo, WIDTH } from './LaunchVideo'

export function Root() {
  return (
    <Composition
      id="LaunchVideo"
      component={LaunchVideo}
      durationInFrames={DURATION}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
    />
  )
}
