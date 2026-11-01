/**
 * Shrinks an oversized photograph in the browser, before it is uploaded.
 *
 * Vercel refuses any request body over 4.5 MB, well below the 12 MB this form
 * used to advertise -- and an iPhone makes that gap easy to fall into. iOS
 * stores photographs as HEIC, then transcodes them to JPEG when handing one to
 * a file input, and the JPEG is routinely two or three times the size of the
 * HEIC the owner saw in Photos. A 3.8 MB photograph arrives as nine, and is
 * rejected by the platform before any of our code runs. The buyer is told the
 * server could not be reached, which is both wrong and unhelpful.
 *
 * So anything near the limit is redrawn smaller here. Files already comfortably
 * under it are passed through untouched, byte for byte: most photographs are
 * never recompressed, and only the ones that could not be uploaded at all are
 * altered. Squares render a few hundred pixels across, so nothing visible is
 * lost from the ones that are.
 *
 * This also quietly fixes HEIC. Safari can decode it even though we do not
 * accept it, so a HEIC that reaches the canvas comes back out as a JPEG.
 */

/** Comfortably under Vercel's 4.5 MB, leaving room for the rest of the form. */
export const UPLOAD_TARGET_BYTES = 3_500_000
/** Longest edge after shrinking. Far above what any square ever displays. */
const MAX_EDGE = 2400
const QUALITY_STEPS = [0.86, 0.75, 0.62, 0.5]

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('The browser could not read that image.'))
    }
    img.src = url
  })
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
}

/**
 * Returns the file to upload. The same object when nothing needed doing, so a
 * caller can tell whether the photograph was touched by identity.
 */
export async function shrinkForUpload(file: File): Promise<File> {
  if (file.size <= UPLOAD_TARGET_BYTES) return file
  // Redrawing an animated GIF would keep only its first frame, which is a
  // worse outcome than refusing it: let the server explain the size instead.
  if (file.type === 'image/gif') return file

  const img = await loadImage(file)
  // naturalWidth/Height and drawImage both honour the EXIF orientation in
  // current browsers, so a photograph taken sideways stays the right way up.
  const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight))
  const width = Math.max(1, Math.round(img.naturalWidth * scale))
  const height = Math.max(1, Math.round(img.naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(img, 0, 0, width, height)

  for (const quality of QUALITY_STEPS) {
    const blob = await toBlob(canvas, quality)
    if (!blob) break
    if (blob.size <= UPLOAD_TARGET_BYTES) {
      const name = file.name.replace(/\.[^.]+$/, '') || 'photo'
      return new File([blob], `${name}.jpg`, { type: 'image/jpeg' })
    }
  }
  // Nothing worked: hand back the original and let the server say why.
  return file
}
