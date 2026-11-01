import { Config } from '@remotion/cli/config'

Config.setVideoImageFormat('jpeg')
Config.setJpegQuality(95)
Config.setOverwriteOutput(true)
Config.setConcurrency(4)

// In environments with a preinstalled Chromium, point at it instead of letting
// Remotion download its own. Set REMOTION_BROWSER to override.
if (process.env.REMOTION_BROWSER) {
  Config.setBrowserExecutable(process.env.REMOTION_BROWSER)
}
