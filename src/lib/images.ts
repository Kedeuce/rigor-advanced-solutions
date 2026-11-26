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
