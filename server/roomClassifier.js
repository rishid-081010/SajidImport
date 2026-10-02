import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

export async function classifyRoomType(imagePath) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes('your_openai_api_key')) {
    return 'Room_Photo';
  }

  const openai = new OpenAI({ apiKey });

  try {
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    const ext = path.extname(imagePath).toLowerCase().replace('.', '') || 'jpeg';
    const mimeType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Identify the specific real estate room or feature shown in this photo.
Return ONLY ONE concise, sanitized label (max 3 words, snake_case or clean capitalized words separated by underscore), chosen from one of these standard categories:
- Living_Room
- Master_Bedroom
- Bedroom
- Modern_Kitchen
- Balcony_Skyline_View
- Luxury_Bathroom
- Dining_Area
- Infinity_Pool
- Building_Exterior
- Foyer_Entrance
- Walk_in_Closet
- Terrace_Lounge

Output ONLY the category name and nothing else.`,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`,
                detail: 'low', // Low detail uses ~65 tokens (< $0.0003 per image) and is ultra fast
              },
            },
          ],
        },
      ],
      max_tokens: 15,
      temperature: 0.2,
    });

    const label = response.choices[0].message.content.trim().replace(/[^a-zA-Z0-9_]/g, '');
    return label || 'Property_Photo';
  } catch (err) {
    console.warn('Room classification error (using fallback):', err.message);
    return 'Property_Photo';
  }
}
