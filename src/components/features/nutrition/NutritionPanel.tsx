// src/components/features/nutrition/NutritionPanel.tsx
'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import type { Profile, Meal } from '@/types/supabase'
import toast from 'react-hot-toast'
import Markdown from 'react-markdown'
import { formatNumber } from '@/lib/utils'

const IconPlus = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
const IconLoader = () => <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/></svg>
const IconTrash = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
const IconWater = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg>
const IconUtensils = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/></svg>

const MACRO_COLORS = { protein: '#E8002D', carbs: '#F59E0B', fat: '#6366F1' }
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'other']
const MEAL_LABELS: Record<string, string> = { breakfast: 'Café', lunch: 'Almoço', dinner: 'Jantar', snack: 'Lanche', other: 'Outro' }
const WATER_OPTIONS = [150, 250, 350, 500]

interface MacroBarProps { label: string; current: number; target: number; color: string; unit?: string }

function MacroBar({ label, current, target, color, unit = 'g' }: MacroBarProps) {
  const pct = Math.min((current / Math.max(target, 1)) * 100, 100)
  return (
    <div>
      <div className="flex justify-between items-baseline mb-2">
        <span className="text-xs font-black uppercase tracking-widest text-[#666]" style={{ fontFamily: 'var(--font-display)', color }}>
          {label}
        </span>
        <span className="text-xs text-[#666]">{formatNumber(current)}/{formatNumber(target)}{unit}</span>
      </div>
      <div className="progress-track">
        <motion.div
          className="progress-fill"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

interface NutritionPanelProps {
  profile: Profile
  onProfileUpdate: (data: Partial<Profile>) => void
}

export default function NutritionPanel({ profile, onProfileUpdate }: NutritionPanelProps) {
  const [meals, setMeals] = useState<Meal[]>([])
  const [waterMl, setWaterMl] = useState(0)
  const [foodInput, setFoodInput] = useState('')
  const [mealType, setMealType] = useState<string>('other')
  const [addingMeal, setAddingMeal] = useState(false)
  const [addingWater, setAddingWater] = useState(false)
  const [activeView, setActiveView] = useState<'log' | 'plan'>('log')
  const supabase = createClient()

  const today = new Date().toISOString().split('T')[0]

  const totals = meals.reduce((acc, m) => ({
    calories: acc.calories + (m.calories || 0),
    protein: acc.protein + (m.protein || 0),
    carbs: acc.carbs + (m.carbs || 0),
    fat: acc.fat + (m.fat || 0),
  }), { calories: 0, protein: 0, carbs: 0, fat: 0 })

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    const [mealsRes, waterRes] = await Promise.all([
      supabase.from('meals').select('*').eq('user_id', profile.id)
        .gte('logged_at', today + 'T00:00:00').order('logged_at', { ascending: false }),
      supabase.from('water_logs').select('amount_ml').eq('user_id', profile.id)
        .gte('logged_at', today + 'T00:00:00'),
    ])
    if (mealsRes.data) setMeals(mealsRes.data)
    if (waterRes.data) setWaterMl(waterRes.data.reduce((sum, r) => sum + r.amount_ml, 0))
  }

  const addMeal = async () => {
    if (!foodInput.trim()) return
    setAddingMeal(true)
    try {
      const res = await fetch('/api/ai/meal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: foodInput, mealType, language: profile.language }),
      })
      const data = await res.json()
      const { error } = await supabase.from('meals').insert({
        user_id: profile.id,
        name: data.name || foodInput,
        calories: data.calories || 0,
        protein: data.protein || 0,
        carbs: data.carbs || 0,
        fat: data.fat || 0,
        meal_type: mealType,
      })
      if (error) throw error
      setFoodInput('')
      await loadData()
      toast.success(`${data.name} registrado — ${data.calories} kcal`)
    } catch {
      toast.error('Erro ao registrar refeição')
    } finally {
      setAddingMeal(false)
    }
  }

  const addWater = async (ml: number) => {
    setAddingWater(true)
    try {
      await supabase.from('water_logs').insert({ user_id: profile.id, amount_ml: ml })
      setWaterMl(prev => prev + ml)
      toast.success(`+${ml}ml registrado`)
    } catch {
      toast.error('Erro')
    } finally {
      setAddingWater(false)
    }
  }

  const deleteMeal = async (id: string) => {
    await supabase.from('meals').delete().eq('id', id)
    setMeals(prev => prev.filter(m => m.id !== id))
  }

  const calTarget = profile.target_calories || 2000
  const proteinTarget = profile.target_protein || 150
  const carbsTarget = profile.target_carbs || 200
  const fatTarget = profile.target_fat || 60
  const waterTarget = 3000
  const calPct = Math.min((totals.calories / calTarget) * 100, 100)

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <div className="px-8 py-6 border-b border-[#1C1C1C] flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black text-white uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
            NUTRIÇÃO
          </h1>
          <p className="text-[#555] text-sm mt-0.5">Rastreamento calórico e macros do dia</p>
        </div>
        <div className="flex gap-1 bg-[#111] border border-[#1C1C1C] rounded-lg p-1">
          {(['log', 'plan'] as const).map(v => (
            <button key={v} onClick={() => setActiveView(v)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${v === activeView ? 'bg-[#E8002D] text-white' : 'text-[#666] hover:text-[#999]'}`}>
              {v === 'log' ? 'Diário' : 'Plano IA'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-8">
        <AnimatePresence mode="wait">
          {activeView === 'log' ? (
            <motion.div key="log" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-8">
                {/* Left: Input + Meals */}
                <div className="space-y-6">
                  {/* Add Meal */}
                  <div className="rounded-2xl bg-[#111] border border-[#1C1C1C] p-6">
                    <p className="text-xs font-black uppercase tracking-widest text-[#555] mb-4" style={{ fontFamily: 'var(--font-display)' }}>
                      REGISTRAR REFEIÇÃO
                    </p>
                    <div className="flex gap-3 mb-3">
                      <input
                        value={foodInput}
                        onChange={e => setFoodInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && addMeal()}
                        placeholder="Ex: 200g frango grelhado + arroz integral"
                        className="input flex-1"
                      />
                      <select value={mealType} onChange={e => setMealType(e.target.value)} className="input w-32">
                        {MEAL_TYPES.map(t => <option key={t} value={t}>{MEAL_LABELS[t]}</option>)}
                      </select>
                    </div>
                    <button onClick={addMeal} disabled={addingMeal || !foodInput.trim()} className="btn btn-primary w-full">
                      {addingMeal ? <><IconLoader />Analisando com IA...</> : <><IconPlus />Registrar Refeição</>}
                    </button>
                    <p className="text-[#444] text-xs text-center mt-2">A IA calcula os macros automaticamente</p>
                  </div>

                  {/* Meals List */}
                  <div className="space-y-3">
                    <p className="text-xs font-black uppercase tracking-widest text-[#555]" style={{ fontFamily: 'var(--font-display)' }}>
                      REFEIÇÕES DE HOJE ({meals.length})
                    </p>
                    <AnimatePresence>
                      {meals.map(meal => (
                        <motion.div key={meal.id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 8 }}
                          className="rounded-xl bg-[#111] border border-[#1C1C1C] p-4 flex items-center justify-between group"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-[#E8002D]/10 text-[#E8002D]">
                                {MEAL_LABELS[meal.meal_type] || meal.meal_type}
                              </span>
                              <p className="text-sm font-medium text-white truncate">{meal.name}</p>
                            </div>
                            <div className="flex gap-4 text-xs text-[#555]">
                              <span className="text-[#E8002D]">{formatNumber(meal.calories)} kcal</span>
                              <span>P: {formatNumber(meal.protein)}g</span>
                              <span>C: {formatNumber(meal.carbs)}g</span>
                              <span>G: {formatNumber(meal.fat)}g</span>
                            </div>
                          </div>
                          <button onClick={() => deleteMeal(meal.id)}
                            className="opacity-0 group-hover:opacity-100 text-[#444] hover:text-[#E8002D] transition-all ml-4">
                            <IconTrash />
                          </button>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {meals.length === 0 && (
                      <div className="text-center py-12 text-[#333]">
                        <IconUtensils />
                        <p className="text-sm mt-2">Nenhuma refeição registrada hoje</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Macros + Water */}
                <div className="space-y-4">
                  {/* Calorie Ring */}
                  <div className="rounded-2xl bg-[#111] border border-[#1C1C1C] p-6">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-xs font-black uppercase tracking-widest text-[#555]" style={{ fontFamily: 'var(--font-display)' }}>CALORIAS HOJE</p>
                      <span className="text-xs text-[#555]">{Math.round(calPct)}%</span>
                    </div>
                    <div className="flex items-baseline gap-1 mb-4">
                      <span className="stat-value">{formatNumber(totals.calories)}</span>
                      <span className="text-[#444] text-sm">/ {formatNumber(calTarget)} kcal</span>
                    </div>
                    <div className="progress-track h-2 mb-6">
                      <motion.div className="h-full rounded-full bg-[#E8002D]" style={{ width: `${calPct}%` }}
                        initial={{ width: 0 }} animate={{ width: `${calPct}%` }} transition={{ duration: 0.8 }} />
                    </div>
                    <div className="space-y-3">
                      <MacroBar label="PROTEÍNA" current={totals.protein} target={proteinTarget} color={MACRO_COLORS.protein} />
                      <MacroBar label="CARBOIDRATO" current={totals.carbs} target={carbsTarget} color={MACRO_COLORS.carbs} />
                      <MacroBar label="GORDURA" current={totals.fat} target={fatTarget} color={MACRO_COLORS.fat} />
                    </div>
                  </div>

                  {/* Water */}
                  <div className="rounded-2xl bg-[#111] border border-[#1C1C1C] p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="text-[#6366F1]"><IconWater /></span>
                      <p className="text-xs font-black uppercase tracking-widest text-[#555]" style={{ fontFamily: 'var(--font-display)' }}>HIDRATAÇÃO</p>
                    </div>
                    <div className="flex items-baseline gap-1 mb-3">
                      <span className="text-3xl font-display font-black text-white" style={{ fontFamily: 'var(--font-display)' }}>{(waterMl / 1000).toFixed(1)}L</span>
                      <span className="text-[#444] text-sm">/ {waterTarget / 1000}L</span>
                    </div>
                    <div className="progress-track h-2 mb-4">
                      <motion.div className="h-full rounded-full bg-[#6366F1]"
                        style={{ width: `${Math.min((waterMl / waterTarget) * 100, 100)}%` }}
                        initial={{ width: 0 }} animate={{ width: `${Math.min((waterMl / waterTarget) * 100, 100)}%` }} transition={{ duration: 0.6 }} />
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {WATER_OPTIONS.map(ml => (
                        <button key={ml} onClick={() => addWater(ml)} disabled={addingWater}
                          className="py-2 rounded-lg bg-[#1A1A1A] border border-[#252525] text-xs text-[#666] hover:text-white hover:border-[#6366F1]/40 transition-all font-medium">
                          +{ml}ml
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Remaining */}
                  <div className="rounded-xl bg-[#0A0A0A] border border-[#1C1C1C] p-4">
                    <p className="text-xs text-[#444] mb-2 uppercase tracking-widest" style={{ fontFamily: 'var(--font-display)' }}>RESTANTE</p>
                    <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                      <span className="text-[#555]">Calorias</span>
                      <span className={`text-right font-mono font-bold ${calTarget - totals.calories < 0 ? 'text-amber-500' : 'text-[#E8002D]'}`}>
                        {formatNumber(Math.max(calTarget - totals.calories, 0))} kcal
                      </span>
                      <span className="text-[#555]">Proteína</span>
                      <span className="text-right font-mono text-white">{formatNumber(Math.max(proteinTarget - totals.protein, 0))}g</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="plan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {profile.nutrition_plan ? (
                <div className="max-w-3xl mx-auto rounded-2xl bg-[#111] border border-[#1C1C1C] p-8">
                  <div className="prose-dark">
                    <Markdown>{profile.nutrition_plan}</Markdown>
                  </div>
                </div>
              ) : (
                <div className="text-center py-20">
                  <div className="w-20 h-20 rounded-2xl bg-[#111] border border-[#1C1C1C] flex items-center justify-center mx-auto mb-4 text-[#333]">
                    <IconUtensils />
                  </div>
                  <p className="text-white font-semibold mb-1">Nenhum plano gerado</p>
                  <p className="text-[#555] text-sm">Vá para Análise Corporal e gere seu plano personalizado</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
