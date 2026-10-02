import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

/**
 * Non-destructive, zero-distortion image formatter for real estate media.
 * Preserves 100% authentic architecture and optical sharpness using Lanczos3 resampling.
 */

// 1. Bayut & Property Finder Landscape (16:9 - 1920x1080)
export async function formatForPortals16x9(inputPath) {
  const image = sharp(inputPath);
  const metadata = await image.metadata();

  return await image
    .resize(1920, 1080, {
      fit: 'cover',
      position: 'center',
      kernel: sharp.kernel.lanczos3,
    })
    .png({ quality: 95 })
    .toBuffer();
}

// 2. Portal Standard (4:3 - 1600x1200)
export async function formatForPortals4x3(inputPath) {
  return await sharp(inputPath)
    .resize(1600, 1200, {
      fit: 'cover',
      position: 'center',
      kernel: sharp.kernel.lanczos3,
    })
    .png({ quality: 95 })
    .toBuffer();
}

// 3. WhatsApp Square (1:1 - 1080x1080)
export async function formatForWhatsApp1x1(inputPath) {
  return await sharp(inputPath)
    .resize(1080, 1080, {
      fit: 'cover',
      position: 'center',
      kernel: sharp.kernel.lanczos3,
    })
    .png({ quality: 95 })
    .toBuffer();
}

// 4. Instagram Reels & TikTok Vertical (9:16 - 1080x1920) with Frosted Ambient Backdrop
export async function formatForSocials9x16(inputPath) {
  // Step A: Generate frosted blurred luxury backdrop from the photo
  const blurredBackdrop = await sharp(inputPath)
    .resize(1080, 1920, { fit: 'cover' })
    .blur(35)
    .modulate({ brightness: 0.7 })
    .toBuffer();

  // Step B: Resize original crisp photo to fit perfectly across 1080px width without distortion
  const crispForeground = await sharp(inputPath)
    .resize(1080, 1080, { fit: 'inside' })
    .toBuffer();

  // Step C: Composite crisp foreground on top of the ambient blurred background
  return await sharp(blurredBackdrop)
    .composite([
      {
        input: crispForeground,
        gravity: 'center',
      },
    ])
    .png({ quality: 95 })
    .toBuffer();
}
