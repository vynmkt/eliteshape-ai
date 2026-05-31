// src/lib/openai.ts
// All OpenAI interactions go through this service
import OpenAI from 'openai'

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

// ============================================================
// TYPES
// ============================================================
export interface AnalysisResult {
  overall_score: number        // 0-10
  fat_percentage_estimate: number
  muscle_mass: 'low' | 'moderate' | 'high' | 'very_high'
  strong_points: string[]
  weak_points: string[]
  priority_muscles: string[]
  training_focus: string
  diet_approach: string
  training_plan: string        // markdown
  nutrition_plan: string       // markdown
  motivational_message: string
  week_protocol: Record<string, string>
  nutrition_schedule: Record<string, any>
  estimated_timeframe: string
}

export interface MacroResult {
  calories: number
  protein: number
  carbs: number
  fat: number
  name: string
  meal_type: string
}

// ============================================================
// SYSTEM PROMPTS
// ============================================================
const ELITE_COACH_PERSONA = `
Você é o ELITE SHAPE AI — o coach de treino e nutrição mais avançado do mundo.
Combine o conhecimento de fisiculturistas de elite, cientistas do esporte e nutricionistas.
SEMPRE responda no idioma do usuário (pt-BR ou en-US conforme indicado).
SEMPRE responda em português do Brasil quando o idioma for pt-BR.
NÃO use inglês em nenhuma palavra se o idioma for pt-BR.

Adapte sua PERSONALIDADE conforme o modo:
- motivational: energia máxima, hype, frases de impacto, use exclamações, motive o atleta, celebre pontos fortes com entusiasmo antes de falar fraquezas
- technical: linguagem científica precisa, cite estudos, seja detalhado e educativo, explique o porquê de cada recomendação
- raiz: direto ao ponto, sem rodeios, linguagem simples e prática, fale os pontos fracos sem filtro mas com respeito
`

const PERSONALITY_INSTRUCTIONS: Record<string, string> = {
  motivational: `Tom motivacional: Comece SEMPRE destacando os pontos fortes com entusiasmo e frases de impacto. Use emojis estratégicos. Depois aborde fraquezas como "oportunidades de crescimento". Finalize com uma mensagem que faça o atleta querer treinar agora.`,
  technical: `Tom técnico: Use terminologia científica. Cite percentuais, taxas metabólicas, princípios de hipertrofia. Seja analítico. Explique o mecanismo fisiológico de cada recomendação. Seja preciso com números.`,
  raiz: `Tom raiz: Seja direto e sem enrolação. Fale os pontos fracos claramente sem suavizar. Use linguagem simples e prática. Diga exatamente o que o atleta precisa fazer, sem teoria desnecessária. Seja honesto mesmo que doa.`,
}

// ============================================================
// BODY ANALYSIS FROM IMAGES
// ============================================================
export async function analyzeBodyShape(params: {
  imageBase64Array: string[]
  profile: {
    age: number
    height: number
    weight: number
    gender: string
    activity_level: string
    training_level: string
    objective: string
    training_time: string
    routine: string
    sleep: string
    current_diet: string
    financial_condition: string
    wants_supplements: boolean
    personality_mode: string
    fat_percentage?: number
  }
  language: string
  tdee: number
  isRoastMode?: boolean
}): Promise<AnalysisResult> {
  const { imageBase64Array, profile, language, tdee, isRoastMode } = params
  const lang = language === 'pt' ? 'pt-BR' : 'en-US'

  const profileContext = `
Atleta/Athlete Data:
- Age: ${profile.age} years | Height: ${profile.height}cm | Weight: ${profile.weight}kg
- Gender: ${profile.gender} | Activity: ${profile.activity_level} | Level: ${profile.training_level}
- Goal/Objetivo: ${profile.objective}
- Training time/Tempo de treino: ${profile.training_time}
- Routine/Rotina: ${profile.routine}
- Sleep/Sono: ${profile.sleep}h
- Current diet/Dieta atual: ${profile.current_diet}
- Budget/Orçamento: ${profile.financial_condition}
- Supplements/Suplementos: ${profile.wants_supplements ? 'Yes/Sim' : 'No/Não'}
- TDEE: ${tdee} kcal/day
- Personality mode: ${profile.personality_mode}
`

  const personalityMode = (profile.personality_mode as string) || 'motivational'
  const personalityInstructions: Record<string, string> = {
    motivational: 'Tom motivacional: Destaque pontos fortes com MUITO entusiasmo e energia. Use frases de impacto. Celebre o que é bom antes de falar fraquezas como oportunidades de crescimento. Finalize motivando o atleta.',
    technical: 'Tom técnico: Use terminologia científica, percentuais precisos e princípios de hipertrofia. Explique o mecanismo fisiológico de cada recomendação.',
    raiz: 'Tom raiz: Seja completamente direto. Fale os pontos fracos sem suavizar. Linguagem simples e prática. Diga exatamente o que fazer sem enrolação.',
  }
  const personalityTip = personalityInstructions[personalityMode] || personalityInstructions.motivational
  const systemPrompt = isRoastMode
    ? `${ELITE_COACH_PERSONA}\nROAST MODE: Faça um roast brutal e engraçado mas educativo do físico. Máx 4 frases.\nIdioma: ${lang}`
    : `${ELITE_COACH_PERSONA}\n${personalityTip}\nAnalise as imagens e retorne JSON completo. TODAS as strings em ${lang}. Idioma: ${lang}`
Be savage but educational. Mix humor with real actionable advice. 3-5 sentences max for roast.
  const userPrompt = isRoastMode
    ? `${profileContext}
Roast this physique in ${lang}. Be savage, funny, but educational. Then give 3 priority actions.
Return JSON: { "roast": "...", "score": 0-10, "priority_actions": ["...", "...", "..."], "fat_percentage_estimate": 0, "training_plan": "...", "nutrition_plan": "..." }`
    : `${profileContext}

Analyze these physique images and return a detailed JSON plan. Be extremely specific and scientific.

Return ONLY valid JSON with this exact structure:
{
  "overall_score": 7,
  "fat_percentage_estimate": 18.5,
  "muscle_mass": "moderate",
  "strong_points": ["Broad shoulders", "Good quad sweep"],
  "weak_points": ["Lagging hamstrings", "Thin calves"],
  "priority_muscles": ["Hamstrings", "Calves", "Rear delts"],
  "training_focus": "Hypertrophy with emphasis on posterior chain",
  "diet_approach": "Moderate caloric deficit with high protein",
  "motivational_message": "...",
  "estimated_timeframe": "12-16 weeks to visible transformation",
  "week_protocol": {
    "Monday": "Chest + Triceps — 4x10-12",
    "Tuesday": "Back + Biceps — 4x10-12",
    "Wednesday": "Active Recovery / LISS Cardio 30min",
    "Thursday": "Legs — Quad focus — 5x10-15",
    "Friday": "Shoulders + Rear Delts — 4x12-15",
    "Saturday": "Legs — Hamstring/Glute focus — 4x10-15",
    "Sunday": "Rest"
  },
  "nutrition_schedule": {
    "target_calories": ${tdee - 400},
    "target_protein": ${Math.round(profile.weight * 2.2)},
    "target_carbs": ${Math.round((tdee - 400 - profile.weight * 2.2 * 4 - profile.weight * 0.8 * 9) / 4)},
    "target_fat": ${Math.round(profile.weight * 0.8)},
    "meal_timing": {
      "pre_workout": "...",
      "post_workout": "...",
      "before_bed": "..."
    }
  },
  "training_plan": "## PLANO DE TREINO\\n\\n[Full detailed markdown training plan...]",
  "nutrition_plan": "## PLANO NUTRICIONAL\\n\\n[Full detailed markdown nutrition plan...]"
}`

  const messageContent: OpenAI.ChatCompletionContentPart[] = [
    { type: 'text', text: userPrompt },
    ...imageBase64Array.map(base64 => ({
      type: 'image_url' as const,
      image_url: {
        url: `data:image/jpeg;base64,${base64}`,
        detail: 'high' as const,
      }
    }))
  ]

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: messageContent },
    ],
    max_tokens: 4096,
    temperature: 0.4,
    response_format: { type: 'json_object' },
  })

  const text = response.choices[0].message.content ?? '{}'
  return JSON.parse(text) as AnalysisResult
}

// ============================================================
// TEXT-ONLY PLAN GENERATION (no images)
// ============================================================
export async function generatePlanFromProfile(params: {
  profile: Record<string, any>
  tdee: number
  language: string
}): Promise<Pick<AnalysisResult, 'training_plan' | 'nutrition_plan' | 'week_protocol' | 'nutrition_schedule' | 'motivational_message'>> {
  const { profile, tdee, language } = params
  const lang = language === 'pt' ? 'pt-BR' : 'en-US'

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: `${ELITE_COACH_PERSONA}\nLanguage: ${lang}` },
      {
        role: 'user',
        content: `Create a complete personalized training and nutrition plan for:
Age: ${profile.age} | Height: ${profile.height}cm | Weight: ${profile.weight}kg
Gender: ${profile.gender} | Level: ${profile.training_level} | Goal: ${profile.objective}
Activity: ${profile.activity_level} | TDEE: ${tdee}kcal
Training time: ${profile.training_time} | Sleep: ${profile.sleep}h
Budget: ${profile.financial_condition} | Supplements: ${profile.wants_supplements}

Return JSON: { "training_plan": "markdown", "nutrition_plan": "markdown", "week_protocol": {}, "nutrition_schedule": { "target_calories": 0, "target_protein": 0, "target_carbs": 0, "target_fat": 0 }, "motivational_message": "..." }`
      }
    ],
    max_tokens: 3000,
    temperature: 0.5,
    response_format: { type: 'json_object' },
  })

  return JSON.parse(response.choices[0].message.content ?? '{}')
}

// ============================================================
// COACH CHAT
// ============================================================
export async function chatWithCoach(params: {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
  profile: Record<string, any>
  language: string
  lastAnalysis?: string
}): Promise<string> {
  const { messages, profile, language, lastAnalysis } = params
  const lang = language === 'pt' ? 'pt-BR' : 'en-US'

  const chatPersonality: Record<string, string> = {
    motivational: 'Seja EXTREMAMENTE motivador. Elogie o esforço. Use energia alta. Finalize com algo que motive a ação imediata.',
    technical: 'Seja preciso e científico. Cite fisiologia quando relevante. Explique o porquê.',
    raiz: 'Seja direto e prático. Sem enrolação. Fale o que precisa ser feito sem teoria desnecessária.',
  }
  const chatTone = chatPersonality[(profile.personality_mode as string) || 'motivational'] || chatPersonality.motivational
  const systemPrompt = `${ELITE_COACH_PERSONA}
Idioma: ${lang}. RESPONDA SEMPRE EM ${lang}. NUNCA use inglês se o idioma for pt-BR.
${chatTone}
Comunicação: máximo 2 parágrafos curtos por resposta. Foco em ação prática.
IMPORTANTE: Você é um coach de FITNESS E NUTRIÇÃO. Recuse perguntas fora desse contexto.

Contexto do atleta:
- Objetivo: ${profile.objective} | Nível: ${profile.training_level} | Peso: ${profile.weight}kg
- Horário de treino: ${profile.training_time}
${lastAnalysis ? \`Última análise: \${lastAnalysis.slice(0, 500)}\` : ''}\`

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    max_tokens: 512,
    temperature: 0.6,
  })

  return response.choices[0].message.content ?? ''
}

// ============================================================
// MEAL / FOOD RECOGNITION
// ============================================================
export async function recognizeMeal(params: {
  description: string
  language: string
  imageBase64?: string
}): Promise<MacroResult> {
  const { description, language, imageBase64 } = params
  const lang = language === 'pt' ? 'pt-BR' : 'en-US'
  const userContent: any[] = []
  if (imageBase64) {
    userContent.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'low' } })
  }
  userContent.push({ type: 'text', text: `${imageBase64 ? 'Analyze this meal photo.' : `Food: "\"`}
Return JSON: { "name": "Food Name", "calories": 350, "protein": 28, "carbs": 42, "fat": 8, "meal_type": "lunch" }
Be precise. Language: ${lang}` })
  const response = await openai.chat.completions.create({
    model: imageBase64 ? 'gpt-4o' : 'gpt-4o-mini',
    messages: [
      { role: 'system', content: `You are a precision nutritionist. Return accurate macros in JSON only. Language: ${lang}` },
      { role: 'user', content: userContent }
    ],
    max_tokens: 200, temperature: 0.2,
    response_format: { type: 'json_object' },
  })
  return JSON.parse(response.choices[0].message.content ?? '{}') as MacroResult
}

// ============================================================
// FITNESS CALCULATIONS
// ============================================================
export function calculateTDEE(profile: {
  weight: number
  height: number
  age: number
  gender: string
  activity_level: string
}): number {
  const { weight, height, age, gender, activity_level } = profile

  // Mifflin-St Jeor
  let bmr = 10 * weight + 6.25 * height - 5 * age
  bmr += gender === 'male' ? 5 : -161

  const multipliers: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  }

  return Math.round(bmr * (multipliers[activity_level] ?? 1.55))
}
