// hazardEngine.js

export const HAZARD_CASES = [
  {
    key: 'fire',
    label: 'Fire',
    icon: 'flame',
    description: 'Visible flames, sparking, or active burning on or near the pole.',
    ratingGuidance: '0-15 = no fire or sparking visible. 40-60 = small sparking or smoke without open flame. 80-100 = visible open flame or active burning.',
  },
  {
    key: 'exposed_wires',
    label: 'Exposed Wires',
    icon: 'flash-outline',
    description: 'Bare, dangling, or exposed live wires, not part of an active fire.',
    ratingGuidance: '0-15 = wires fully insulated and secured. 40-60 = a wire is visible but not obviously dangling or within reach. 80-100 = wire clearly bare, dangling, or within easy reach.',
  },
  {
    key: 'feeder_sagging',
    label: 'Feeder Sagging',
    icon: 'trending-down-outline',
    description: 'The feeder/power line visibly sags or droops below its normal safe clearance.',
    ratingGuidance: '0-15 = line taut with normal clearance. 20-40 = slight noticeable sag but still well clear of the ground or objects. 45-65 = noticeably low. 75-100 = sagging dangerously close to or touching ground/rooftop.',
  },
  {
    key: 'pole_damage',
    label: 'Damaged / Leaning',
    icon: 'construct-outline',
    description: 'Structural damage to the pole OR the pole visibly tilted/leaning.',
    ratingGuidance: '0-15 = pole sound and vertical. 40-60 = minor damage or slight tilt. 80-100 = major structural damage, breakage, or severe tilt close to falling.',
  },
  {
    key: 'water_logging',
    label: 'Water Logging',
    icon: 'water',
    description: 'The base of the pole is surrounded or encircled by standing water.',
    ratingGuidance: '0-15 = ground dry or distant water. 40-60 = water near base. 80-100 = base clearly surrounded by standing water.',
  },
];

export function buildBlindScanPrompt() {
  const caseBlocks = HAZARD_CASES.map((c) => `- ${c.key}: ${c.description}\n  Rating guidance: ${c.ratingGuidance}`).join('\n');
  return `You are an image analysis system used for electrical utility field inspections.
Examine the supplied photo of a utility/electric pole and rate it against EACH of the following hazard cases independently, from 0 to 100:

${caseBlocks}

Respond with ONLY a raw JSON object in exactly this shape:
{
  "fire": { "percent": number, "note": "one short sentence" },
  "exposed_wires": { "percent": number, "note": "one short sentence" },
  "feeder_sagging": { "percent": number, "note": "one short sentence" },
  "pole_damage": { "percent": number, "note": "one short sentence" },
  "water_logging": { "percent": number, "note": "one short sentence" }
}

Rules: Rate every case independently. Output valid JSON only.`;
}

export function normalizeCaseResult(raw) {
  const percent = Math.max(0, Math.min(100, Math.round(Number(raw && raw.percent) || 0)));
  const note = raw && typeof raw.note === 'string' ? raw.note : '';
  return { percent, note };
}

export function tierFor(percent) {
  if (percent >= 60) return 'urgent';
  if (percent >= 20) return 'attention';
  return 'clear';
}

export const TIER_LABELS = { urgent: 'Severe', attention: 'Normal', clear: 'Clear' };

export async function scanPole({ apiKey, imageBase64, imageMime = 'image/jpeg', model = 'gemini-3.6-flash' }) {
  if (!apiKey) throw new Error('Gemini API key is required.');
  if (!imageBase64) throw new Error('Image data is missing.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const payload = {
    systemInstruction: { parts: [{ text: buildBlindScanPrompt() }] },
    contents: [
      {
        role: 'user',
        parts: [{ inlineData: { mimeType: imageMime, data: imageBase64 } }]
      }
    ],
    generationConfig: { responseMimeType: 'application/json' }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'API request rejected.');

  const firstCandidate = data.candidates?.[0] || {};
  const rawText = firstCandidate.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('Empty response from AI.');

  const cleaned = rawText.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleaned);

  const results = HAZARD_CASES.map((c) => ({
    ...c,
    ...normalizeCaseResult(parsed[c.key])
  }));

  results.sort((a, b) => b.percent - a.percent);
  return results;
}