import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../.env') });

export async function generateDubaiPortalCopy(data, tone = 'luxury') {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.includes('your_openai_api_key')) {
    throw new Error('OpenAI API Key is missing or invalid in .env file.');
  }

  const openai = new OpenAI({ apiKey });

  const {
    name = '',
    reference = '',
    property_type = 'Apartment',
    purpose = 'For Sale',
    price = '',
    bedrooms = '',
    bathrooms = '',
    size_sqft = '',
    furnishing = 'Unfurnished',
    rough_notes = '',
  } = data;

  const tonePrompts = {
    luxury: 'Prestigious, refined, and authoritative luxury editorial tone tailored for high-net-worth buyers in prime Dubai communities (Downtown, Palm Jumeirah, Dubai Marina, Emirates Hills). Focus on architectural elegance, unobstructed vistas, and bespoke finishes.',
    investor_roi: 'Data-driven, analytical, and yield-focused tone highlighting high rental yields, capital appreciation potential, prime tenant demand, and low service charge efficiency.',
    fast_deal: 'High-urgency, hot-deal market positioning highlighting turnkey readiness, vacant on transfer status, and exclusive pricing.',
  };

  const selectedToneGuideline = tonePrompts[tone] || tonePrompts.luxury;

  const systemPrompt = `You are the Lead Real Estate Copywriter & Multi-Channel Marketing Specialist for A SQUARED REAL ESTATE in Dubai.
Your mission is to produce authoritative, high-converting property marketing assets across multiple channels (Property Finder / Bayut, WhatsApp broker broadcasts, Instagram, VIP Investor Email, Arabic, and Russian).

TONE & STYLE DIRECTIVE:
${selectedToneGuideline}

STRICT WORD CHOICE & VOCABULARY RULES:
- BANNED CLICHÉS (NEVER USE): "Nestled in the heart of", "boasts stunning views", "look no further", "rare gem", "sought-after sanctuary", "a testament to luxury", "step into a world of", "haven of tranquility".
- REQUIRED REAL ESTATE VOCABULARY: Use precise architectural terminology: "Panoramic vistas", "Floor-to-ceiling glazing", "Expansive floorplan", "Seamless indoor-outdoor flow", "Bespoke cabinetry", "Vacant on transfer", "Turnkey condition", "Sun-drenched interiors", "Generous terrace", "Chiller free", "En-suite bathrooms".

PORTAL SEO RULES:
- Title must be under 80 characters for optimal mobile search display on Bayut and Property Finder apps.
- Format: [Bedrooms + Type] | [Building Name] | [Top View or Feature] | [Status]
  (Example: "Luxury 2BR | Marina Gate 2 | Full Marina View | Vacant on Transfer")

5-PART DESCRIPTION ARCHITECTURE (MANDATORY FORMAT FOR PORTAL):
1. ✨ Executive Overview: 1-2 powerful sentences establishing the primary value proposition and view.
2. 🏠 Property Specifications: Clean bulleted list (Type, BUA sq.ft, Bedrooms, En-suites, Parking, Chiller/Furnishing).
3. 🏢 Interior Highlights & Layout: Bulleted list of layout strengths, kitchen specification, terrace access, and natural light.
4. 🏊 World-Class Building Amenities: Bulleted list of authentic amenities (Infinity pool, gymnasium, 24/7 concierge, security, valet).
5. 📞 Private Viewings: Authoritative CTA prompting private viewing appointments with A SQUARED REAL ESTATE.

OUTPUT FORMAT:
Return strictly valid JSON with these exact 7 keys:
{
  "portal_title": "String (SEO Title under 80 chars with pipes)",
  "portal_description": "String (5-section description formatted with line breaks and emojis)",
  "whatsapp_copy": "String (High-impact WhatsApp broker broadcast formatted with emojis and *bold* tags: headline, price, key specs, bullet points, and A SQUARED Real Estate viewing CTA)",
  "instagram_copy": "String (Engaging Instagram caption with luxury hook, key highlights, swipe cue for photos, and top Dubai real estate hashtags)",
  "investor_email": "String (VIP Investor Pitch: Subject Line + concise investment thesis highlighting yields, capital growth, floorplan efficiency, and viewing request)",
  "arabic_summary": "String (Professional Arabic property summary tailored for GCC and Arab high-net-worth investors)",
  "russian_summary": "String (Professional Russian property summary tailored for international CIS investors)"
}

Do NOT invent fake amenities or features not implied by the property details and notes.`;

  const userPrompt = `
Property Name: ${name}
Reference: ${reference || 'N/A'}
Property Type: ${property_type}
Purpose: ${purpose}
Price: ${price ? price + ' AED' : 'Price on Application'}
Bedrooms: ${bedrooms || 'Not specified'}
Bathrooms: ${bathrooms || 'Not specified'}
Built-Up Area: ${size_sqft ? size_sqft + ' sq. ft.' : 'Not specified'}
Furnishing: ${furnishing}
Admin Rough Notes & Key Highlights:
${rough_notes || 'High floor, prime location, stunning views, luxury finishing, vacant and ready for immediate viewing.'}
`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.45,
    });

    const content = response.choices[0].message.content;
    const parsed = JSON.parse(content);

    return {
      portal_title: parsed.portal_title || `${name} | Prime Dubai Real Estate`,
      portal_description: parsed.portal_description || 'Detailed property listing coming soon.',
      whatsapp_copy: parsed.whatsapp_copy || 'Exclusive property listing in Dubai. Contact for details.',
      instagram_copy: parsed.instagram_copy || `✨ Luxury Living at ${name}\n\nKey Highlights:\n• ${property_type} | ${bedrooms} BR\n• Price: ${price ? price + ' AED' : 'POA'}\n\nDM A SQUARED REAL ESTATE for private viewing details. #DubaiRealEstate #LuxuryHomes`,
      investor_email: parsed.investor_email || `Subject: Exclusive Off-Market / Prime Opportunity: ${name}\n\nDear Investor,\n\nA SQUARED Real Estate is pleased to present this premier ${property_type} in ${name}.\n\nPrice: ${price ? price + ' AED' : 'POA'}\nArea: ${size_sqft ? size_sqft + ' sq.ft.' : 'N/A'}\n\nContact us for comprehensive yield metrics and private inspections.`,
      arabic_summary: parsed.arabic_summary || `فرصة استثمارية مميزة في ${name}، دبي. للتفاصيل يرجى التواصل مع إيه سكويرد للعقارات.`,
      russian_summary: parsed.russian_summary || `Эксклюзивная недвижимость в ${name}, Дубай. Свяжитесь с A SQUARED REAL ESTATE для организации просмотра.`,
    };
  } catch (err) {
    console.error('Error in generateDubaiPortalCopy:', err);
    // Return an elevated structured fallback
    return {
      portal_title: `${bedrooms ? bedrooms + ' | ' : ''}${name} | ${property_type} ${purpose}`,
      portal_description: `✨ Executive Overview\nA SQUARED Real Estate presents this exceptional ${bedrooms || ''} ${property_type} in ${name}.\n\n🏠 Property Specifications\n• Type: ${property_type}\n• Price: ${price ? price + ' AED' : 'POA'}\n• Bedrooms: ${bedrooms}\n• Bathrooms: ${bathrooms}\n• Built-Up Area: ${size_sqft ? size_sqft + ' sq. ft.' : 'N/A'}\n\n🏢 Interior Highlights\n• ${rough_notes || 'Bright layout with expansive glazing and premium finishes'}\n\n📞 Private Viewings\nContact A SQUARED Real Estate today to arrange an exclusive private viewing.`,
      whatsapp_copy: `🔥 *EXCLUSIVE LISTING: ${name}*\n💰 *Price:* ${price ? price + ' AED' : 'POA'}\n📐 *Size:* ${size_sqft ? size_sqft + ' sq.ft.' : 'N/A'} | 🛏️ ${bedrooms || 'N/A'} | 🚿 ${bathrooms || 'N/A'}\n\n✨ *Key Highlights:*\n• ${rough_notes || 'Prime Location • Turnkey Condition'}\n\n📲 *Contact A SQUARED Real Estate for Private Viewings!*`,
      instagram_copy: `✨ Experience elevated living at ${name}.\n\n📍 Prime Dubai Location\n📐 ${size_sqft ? size_sqft + ' sq.ft.' : ''} | 🛏️ ${bedrooms || ''} | 🚿 ${bathrooms || ''}\n💰 ${price ? price + ' AED' : 'POA'}\n\nSwipe left to tour this immaculate residence. Contact @asquaredrealestate for private viewing appointments.\n\n#DubaiRealEstate #DubaiLuxury #PropertyFinder #Bayut #LuxuryLiving #DubaiInvestments`,
      investor_email: `Subject: High-Yield Investment Opportunity: ${name}\n\nDear Investor,\n\nA SQUARED Real Estate presents an exceptional acquisition opportunity at ${name}.\n\nKey Metrics:\n• Property: ${bedrooms || ''} ${property_type}\n• Price: ${price ? price + ' AED' : 'POA'}\n• Built-Up Area: ${size_sqft ? size_sqft + ' sq.ft.' : 'N/A'}\n• Highlights: ${rough_notes || 'High rental demand, prime location, turnkey condition'}\n\nReply directly to this email to receive full financial forecasts and arrange an exclusive private inspection.\n\nWarm regards,\nA SQUARED REAL ESTATE`,
      arabic_summary: `✨ نظرة عامة تنعكس فيها الفخامة في ${name}.\n• النوع: ${property_type}\n• السعر: ${price ? price + ' درهم' : 'عند الطلب'}\n• المساحة: ${size_sqft ? size_sqft + ' قدم مربع' : ''}\n\nللمزيد من التفاصيل وحجز موعد للمعاينة، تواصلوا مع شركة إيه سكويرد العقارية.`,
      russian_summary: `✨ Премиальная недвижимость в ${name}, Дубай.\n• Тип: ${property_type}\n• Цена: ${price ? price + ' AED' : 'По запросу'}\n• Площадь: ${size_sqft ? size_sqft + ' кв. футов' : ''}\n\nДля получения подробной информации и организации частного просмотра свяжитесь с A SQUARED REAL ESTATE.`,
    };
  }
}
