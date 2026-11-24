"use client"

/**
 * Converts an image the admin picked into a resized WebP before it's uploaded to storage.
 * Product images were going up as 1200 px PNG/JPEG and shown at ~200 px, which made product pages
 * slow on mobile data. Transparency is kept. Anything that can't or shouldn't be converted (GIF, SVG,
 * a browser without a WebP encoder, or a result that isn't smaller) is returned unchanged.
 */
export async function toWebpFile(file: File, maxWidth: number, quality = 0.85): Promise<File> {
  if (!/^image\/(png|jpe?g|webp)$/i.test(file.type)) return file
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, maxWidth / bitmap.width)
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement("canvas")
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext("2d")
    if (!ctx) return file
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality))
    // Old Safari silently falls back to PNG; keep the original then.
    if (!blob || blob.type !== "image/webp") return file
    if (file.type === "image/webp" && blob.size >= file.size) return file
    return new File([blob], `${file.name.replace(/\.[^.]+$/, "")}.webp`, { type: "image/webp" })
  } catch {
    return file
  }
}
