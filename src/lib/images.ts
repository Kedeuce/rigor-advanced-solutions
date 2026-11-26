import { supabase } from './supabase'

const BUCKET = 'site-images'

/** Compress an image file to a JPEG data URL, max 1200px wide, quality 0.82. */
export async function compressImageToDataUrl(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 1200 / bitmap.width)
  const width = Math.max(1, Math.round(bitmap.width * scale))
  const height = Math.max(1, Math.round(bitmap.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not read this image.')
  ctx.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
  if (!blob) throw new Error('Could not compress this image.')
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read this image.'))
    reader.readAsDataURL(blob)
  })
}

export interface CropRect {
  /** Fractions (0–1) of the rotated image's width/height. */
  x: number
  y: number
  w: number
  h: number
}

/** Load a file as an image bitmap. */
async function loadBitmap(file: File | Blob): Promise<ImageBitmap> {
  return await createImageBitmap(file)
}

/**
 * Render a file rotated by `rotation` degrees (0/90/180/270) into a canvas
 * and return it as a JPEG blob. Used both for the crop preview and for the
 * final cropped file, so the crop box always matches what is saved.
 */
export async function rotatedImageBlob(file: File | Blob, rotation: number): Promise<Blob> {
  const bitmap = await loadBitmap(file)
  const swap = rotation === 90 || rotation === 270
  const width = swap ? bitmap.height : bitmap.width
  const height = swap ? bitmap.width : bitmap.height
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) { bitmap.close(); throw new Error('Could not read this image.') }
  ctx.translate(width / 2, height / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.drawImage(bitmap, -bitmap.width / 2, -bitmap.height / 2)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
  if (!blob) throw new Error('Could not read this image.')
  return blob
}

/** Data URL of the file rotated by `rotation` degrees, for the crop preview. */
export async function rotatedImageDataUrl(file: File | Blob, rotation: number): Promise<string> {
  const blob = await rotatedImageBlob(file, rotation)
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Could not read this image.'))
    reader.readAsDataURL(blob)
  })
}

/**
 * Crop an already-rotated image blob to `crop` (fractions of its size),
 * compressing to max 1200px on the long edge, and return a JPEG File
 * ready to upload. Pass the full rect {x:0,y:0,w:1,h:1} to skip cropping.
 */
export async function cropImageFile(blob: Blob, crop: CropRect, name: string): Promise<File> {
  const bitmap = await loadBitmap(blob)
  const sx = Math.round(crop.x * bitmap.width)
  const sy = Math.round(crop.y * bitmap.height)
  const sw = Math.max(1, Math.round(crop.w * bitmap.width))
  const sh = Math.max(1, Math.round(crop.h * bitmap.height))
  const scale = Math.min(1, 1200 / Math.max(sw, sh))
  const width = Math.max(1, Math.round(sw * scale))
  const height = Math.max(1, Math.round(sh * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) { bitmap.close(); throw new Error('Could not read this image.') }
  ctx.drawImage(bitmap, sx, sy, sw, sh, 0, 0, width, height)
  bitmap.close()
  const out = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
  if (!out) throw new Error('Could not crop this image.')
  const base = name.replace(/\.[^.]+$/, '') || 'photo'
  return new File([out], `${base}.jpg`, { type: 'image/jpeg' })
}

/**
 * Upload an image for the site. Preferred path: Supabase Storage bucket
 * 'site-images' (public) — returns the public URL. If Supabase is not
 * configured, the bucket does not exist yet, or the upload fails, falls
 * back to a compressed data URL so the image still saves with the settings.
 * Returns { url, stored } where stored is 'storage' or 'data-url'.
 */
export async function uploadSiteImage(file: File): Promise<{ url: string; stored: 'storage' | 'data-url' }> {
  if (supabase) {
    try {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
      const path = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      })
      if (!error) {
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
        if (data?.publicUrl) return { url: data.publicUrl, stored: 'storage' }
      }
    } catch {
      // fall through to the data-URL fallback below
    }
  }
  return { url: await compressImageToDataUrl(file), stored: 'data-url' }
}
