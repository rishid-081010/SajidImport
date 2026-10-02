import OpenAI, { toFile } from 'openai';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import axios from 'axios';

export async function processImageWithOpenAI(originalAbsolutePath, prompt, outputAbsolutePath) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes('your_openai_api_key')) {
    throw new Error('OpenAI API Key is missing or invalid in .env file.');
  }

  const openai = new OpenAI({ apiKey });

  const tempPngPath = `${originalAbsolutePath}.temp.png`;
  
  const cleanPrompt = (prompt || 'Professionally enhance real estate image with bright natural lighting, sharp focus, and luxury color balance.')
    .trim()
    .substring(0, 950);

  try {
    // 1. Convert input photo to square PNG for OpenAI image edit
    await sharp(originalAbsolutePath)
      .resize(1024, 1024, { fit: 'cover' })
      .png()
      .toFile(tempPngPath);

    // 2. Prepare file object with explicit image/png mimetype
    const imageFile = await toFile(fs.createReadStream(tempPngPath), 'image.png', { type: 'image/png' });

    // 3. Call OpenAI images.edit API with model 'gpt-image-1'
    const response = await openai.images.edit({
      model: 'gpt-image-1',
      image: imageFile,
      prompt: cleanPrompt,
    });

    if (response.data && response.data[0]) {
      if (response.data[0].b64_json) {
        const buffer = Buffer.from(response.data[0].b64_json, 'base64');
        fs.writeFileSync(outputAbsolutePath, buffer);
        return outputAbsolutePath;
      } else if (response.data[0].url) {
        const imgRes = await axios.get(response.data[0].url, { responseType: 'arraybuffer' });
        fs.writeFileSync(outputAbsolutePath, Buffer.from(imgRes.data));
        return outputAbsolutePath;
      }
    }
    throw new Error('OpenAI returned empty image payload.');
  } catch (err) {
    console.warn('OpenAI images.edit primary attempt encountered error:', err?.message || err);

    // Fallback: If image edit fails, generate enhanced architectural rendering with gpt-image-1
    try {
      const fallbackPrompt = `High-resolution professional luxury real estate photography: ${cleanPrompt}`.substring(0, 950);
      const fallbackResponse = await openai.images.generate({
        model: 'gpt-image-1',
        prompt: fallbackPrompt,
      });

      if (fallbackResponse.data && fallbackResponse.data[0]) {
        if (fallbackResponse.data[0].b64_json) {
          const buffer = Buffer.from(fallbackResponse.data[0].b64_json, 'base64');
          fs.writeFileSync(outputAbsolutePath, buffer);
          return outputAbsolutePath;
        } else if (fallbackResponse.data[0].url) {
          const imgRes = await axios.get(fallbackResponse.data[0].url, { responseType: 'arraybuffer' });
          fs.writeFileSync(outputAbsolutePath, Buffer.from(imgRes.data));
          return outputAbsolutePath;
        }
      }
      throw err;
    } catch (fallbackErr) {
      throw new Error(`OpenAI Processing Error: ${err.message}`);
    }
  } finally {
    if (fs.existsSync(tempPngPath)) {
      try {
        fs.unlinkSync(tempPngPath);
      } catch (cleanupErr) {
        console.error('Failed to delete temp file:', cleanupErr);
      }
    }
  }
}
