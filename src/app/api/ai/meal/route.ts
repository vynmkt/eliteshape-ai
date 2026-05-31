// @ts-nocheck
// src/app/api/ai/meal/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { recognizeMeal } from '@/lib/openai'

export async function POST(req: NextRequest) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { description, mealType, language } = await req.json()
    const result = await recognizeMeal({ description, language: language || 'pt' })
    return NextResponse.json({ ...result, meal_type: mealType || result.meal_type })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

