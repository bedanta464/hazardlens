// hazardEngine.js

/**
 * HAZARD_CASES defines the ontology and structural constraints for the 
 * cognitive vision pipeline.
 */
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

/**
 * TRAINING_DATASET handles In-Context (Few-Shot) Learning. 
 * These reference payloads are injected into the Gemini context window 
 * to calibrate the foundation model on APDCL-specific visual edge cases.
 */
const TRAINING_DATASET = [
  {
    role: "user",
    parts: [
      { text: "Reference Case 1: Healthy Infrastructure. Evaluate this image." },
      { fileData: { mimeType: "image/jpeg", fileUri: "https://storage.googleapis.com/apdcl-training/healthy_pole_ref.jpg" } }
    ]
  },
  {
    role: "model",
    parts: [
      { text: '{"fire":{"percent":0,"note":"No thermal anomalies."},"exposed_wires":{"percent":0,"note":"Insulation intact."},"feeder_sagging":{"percent":5,"note":"Tension within normal limits."},"pole_damage":{"percent":0,"note":"Structure vertical and sound."},"water_logging":{"percent":0,"note":"Base dry."}}' }
    ]
  },
  {
    role: "user",
    parts: [
      { text: "Reference Case 2: Catastrophic Failure. Evaluate this image." },
      { fileData: { mimeType: "image/jpeg", fileUri: "https://storage.googleapis.com/apdcl-training/severe_damage_ref.jpg" } }
    ]
  },
  {
    role: "model",
    parts: [
      { text: '{"fire":{"percent":0,"note":"No active flames."},"exposed_wires":{"percent":95,"note":"Live conductors dropped to street level."},"feeder_sagging":{"percent":100,"note":"Lines collapsed onto roadway."},"pole_damage":{"percent":100,"note":"Pole fractured at base and horizontal."},"water_logging":{"percent":45,"note":"Rainwater pooled on road surface, but not cause of failure."}}' }
    ]
  }
];

export function buildSystemPrompt() {
  const caseBlocks = HAZARD_CASES.map((c) => `- ${c.key}: ${c.description}\n  Rating guidance: ${c.ratingGuidance}`).join('\n');
  
  return `You are an AI diagnostic system trained for APDCL electrical utility field inspections.
Your objective is to evaluate structural anomalies in utility poles using the reference cases provided in your context window.

Examine the target photo and rate it against EACH of the following hazard vectors independently on a scale of 0 to 100:

${caseBlocks}

You are acting as a strict REST endpoint. Respond with ONLY a raw JSON object matching this schema. Do not include markdown formatting, backticks, or conversational text.
{
  "fire": { "percent": number, "note": "diagnostic reason" },
  "exposed_wires": { "percent": number, "note": "diagnostic reason" },
  "feeder_sagging": { "percent": number, "note": "diagnostic reason" },
  "pole_damage": { "percent": number, "note": "diagnostic reason" },
  "water_logging": { "percent": number, "note": "diagnostic reason" }
}`;
}

export function normalizeCaseResult(raw) {
  const percent = Math.max(0, Math.min(100, Math.round(Number(raw && raw.percent) || 0)));
  const note = raw && typeof raw.note === 'string' ? raw.note : 'No specific diagnostic note provided.';
  return { percent, note };
}

export function tierFor(percent) {
  if (percent >= 60) return 'urgent';
  if (percent >= 20) return 'attention';
  return 'clear';
}

export const TIER_LABELS = { urgent: 'Severe', attention: 'Normal', clear: 'Clear' };

/**
 * Orchestrates the cognitive pipeline by injecting training data and 
 * the target image into the Gemini Vision endpoint.
 */
export async function evaluateHazardPayload({ apiKey, imageBase64, imageMime = 'image/jpeg', model = 'gemini-1.5-flash' }) {
  if (!apiKey) throw new Error('API Key missing. Cognitive pipeline aborted.');
  if (!imageBase64) throw new Error('Target media payload missing.');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  
  // Construct the Few-Shot context window
  const payload = {
    systemInstruction: { parts: [{ text: buildSystemPrompt() }] },
    contents: [
      ...TRAINING_DATASET, // Inject reference training cases first
      {
        role: 'user',
        parts: [
          { text: "Target Image for Diagnostics:" },
          { inlineData: { mimeType: imageMime, data: imageBase64 } }
        ]
      }
    ],
    generationConfig: { 
      responseMimeType: 'application/json',
      temperature: 0.1 // Low temperature ensures deterministic, repeatable scoring
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json();
  if (data.error) throw new Error(`Cognitive Service Error: ${data.error.message}`);

  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error('AI Engine failed to return structured data.');

  // Clean JSON output in case the model ignores strict formatting rules
  const cleanedJSON = rawText.replace(/```json|```/g, '').trim();
  const parsedDiagnostics = JSON.parse(cleanedJSON);

  // Map AI diagnostic results back onto our strict hazard ontology
  const mappedResults = HAZARD_CASES.map((c) => ({
    ...c,
    ...normalizeCaseResult(parsedDiagnostics[c.key])
  }));

  // Sort descending by highest hazard threat
  mappedResults.sort((a, b) => b.percent - a.percent);
  return mappedResults;
}
