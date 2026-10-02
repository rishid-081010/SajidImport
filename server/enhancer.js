import OpenAI, { toFile } from 'openai';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

/**
 * State-of-the-Art Real Estate Image Enhancement Engine.
 * 
 * Powered by OpenAI's upgraded 'gpt-image-1.5' neural model with strict architectural preservation.
 */

export async function processImagePhotographically(inputPath, customPrompt = '', outputPath) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes('your_openai_api_key')) {
    throw new Error('OpenAI API Key is missing or invalid in .env file.');
  }

  const openai = new OpenAI({ apiKey });

  // 1. Build prompt with strict real estate quality and architectural preservation guardrails
  const baseDirective = customPrompt && customPrompt.trim()
    ? customPrompt.trim()
    : 'Professional luxury real estate photography: increase resolution, clarity, and crispness. Dramatically improve interior lighting, natural exposure, and vibrant color grading.';

  const promptWithGuardrails = `${baseDirective} STRICT REQUIREMENT: Keep the exact same room structure, window placement, architectural geometry, and real furniture layout. Maintain 100% authentic property proportions.`.substring(0, 950);

  // 2. Prepare image stream
  const tempInputPath = `${outputPath}.input.png`;
  try {
    // Ensure image is compatible PNG format preserving aspect ratio
    await sharp(inputPath)
      .rotate() // Auto-orient
      .png({ quality: 100 })
      .toFile(tempInputPath);

    const fileStream = fs.createReadStream(tempInputPath);
    const fileObj = await toFile(fileStream, 'image.png', { type: 'image/png' });

    // 3. Execute neural enhancement using OpenAI's latest 'gpt-image-1.5' model
    const response = await openai.images.edit({
      model: 'gpt-image-1.5',
      image: fileObj,
      prompt: promptWithGuardrails,
    });

    if (response.data && response.data[0]) {
      if (response.data[0].b64_json) {
        const buffer = Buffer.from(response.data[0].b64_json, 'base64');
        fs.writeFileSync(outputPath, buffer);
        return outputPath;
      } else if (response.data[0].url) {
        const imgRes = await axios.get(response.data[0].url, { responseType: 'arraybuffer' });
        fs.writeFileSync(outputPath, Buffer.from(imgRes.data));
        return outputPath;
      }
    }

    throw new Error('Neural model returned empty payload.');
  } catch (err) {
    console.error('gpt-image-1.5 primary processing error:', err.message);

    // Fallback: If OpenAI edit fails, use high-precision non-destructive color & unsharp mask pipeline
    try {
      console.log('Applying calibrated optical photographic pipeline fallback...');
      await sharp(inputPath)
        .rotate()
        .modulate({ brightness: 1.08, saturation: 1.12 })
        .gamma(1.05)
        .clahe({ width: 64, height: 64, maxSlope: 3 })
        .sharpen({ sigma: 1.0, m1: 1.2, m2: 0.6, x1: 3, y2: 12, y3: 25 })
        .jpeg({ quality: 96, chromaSubsampling: '4:4:4', mozjpeg: true })
        .toFile(outputPath);

      return outputPath;
    } catch (fallbackErr) {
      throw new Error(`Enhancement failed: ${err.message}`);
    }
  } finally {
    if (fs.existsSync(tempInputPath)) {
      try {
        fs.unlinkSync(tempInputPath);
      } catch (e) {}
    }
  }
}
