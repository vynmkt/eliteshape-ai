// src/components/features/training/TrainingPanel.tsx
'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Markdown from 'react-markdown'
import type { Profile } from '@/types/supabase'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const IconDumbbell = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/></svg>
const IconCheck = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
const IconLoader = () => <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/></svg>
const IconPlay = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
const IconSwap = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M7 16V4m0 0L3 8m4-4 4 4"/><path d="M17 8v12m0 0 4-4m-4 4-4-4"/></svg>
const IconWeight = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="5" r="3"/><path d="M6.5 8a2 2 0 0 0-1.905 1.46L2.1 18.5A2 2 0 0 0 4 21h16a2 2 0 0 0 1.925-2.54L19.4 9.5A2 2 0 0 0 17.48 8z"/></svg>
const IconPlus = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
const IconX = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>

const DAYS_PT: Record<string, string> = { Monday:'Segunda', Tuesday:'Terça', Wednesday:'Quarta', Thursday:'Quinta', Friday:'Sexta', Saturday:'Sábado', Sunday:'Domingo' }
const DAY_ORDER = ['Segunda','Terça','Quarta','Quinta','Sexta','Sábado','Domingo']

interface ExerciseLog { sets: { reps: string; weight: string }[] }
interface TrainingPanelProps { profile: Profile; onProfileUpdate: (data: Partial<Profile>) => void }

export default function TrainingPanel({ profile, onProfileUpdate }: TrainingPanelProps) {
  const [generating, setGenerating] = useState(false)
  const [weekProtocol, setWeekProtocol] = useState<Record<string, string>>({})
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [exerciseLogs, setExerciseLogs] = useState<Record<string, ExerciseLog>>({})
  const [swapModal, setSwapModal] = useState<{ exercise: string; day: string } | null>(null)
  const [swapReason, setSwapReason] = useState('')
  const [swapLoading, setSwapLoading] = useState(false)
  const [swapResult, setSwapResult] = useState('')
  const supabase = createClient()

  const todayEn = new Date().toLocaleDateString('en-US', { weekday: 'long' })
  const todayPt = DAYS_PT[todayEn] || todayEn

  useEffect(() => {
    if (profile.training_plan) {
      const parsed = parseWeekProtocol(profile.training_plan)
      setWeekProtocol(parsed)
      setSelectedDay(todayPt)
    } else {
      setSelectedDay(todayPt)
    }
    loadLogs()
  }, [profile.training_plan])

  const loadLogs = async () => {
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase.from('workout_logs').select('*').eq('user_id', profile.id).gte('logged_at', today + 'T00:00:00')
    if (data) {
      const logs: Record<string, ExerciseLog> = {}
      data.forEach((d: any) => { logs[d.exercise_name] = d.sets_data || { sets: [] } })
      setExerciseLogs(logs)
    }
  }

  const parseWeekProtocol = (plan: string): Record<string, string> => {
    const result: Record<string, string> = {}
    const lines = plan.split('\n')
    const dayNames = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo']
    const dayMap: Record<string, string> = { 'segunda': 'Segunda', 'terça': 'Terça', 'quarta': 'Quarta', 'quinta': 'Quinta', 'sexta': 'Sexta', 'sábado': 'Sábado', 'domingo': 'Domingo' }
    lines.forEach(line => {
      const lower = line.toLowerCase()
      dayNames.forEach(d => {
        if (lower.includes(d + '-feira') || lower.includes(d + ':') || lower.startsWith(d)) {
          const match = line.match(/[:\-]\s*(.+)/)
          if (match) result[dayMap[d]] = match[1].trim()
        }
      })
    })
    return result
  }

  const getExercisesForDay = (day: string): string[] => {
    if (!profile.training_plan) return []
    const lines = profile.training_plan.split('\n')
    const dayLower = day.toLowerCase().replace('ç','c').replace('á','a').replace('é','e').replace('ã','a')
    let inDay = false, exercises: string[] = []
    for (const line of lines) {
      const lower = line.toLowerCase()
      if (lower.includes(dayLower)) { inDay = true; continue }
      if (inDay) {
        if (lower.match(/^(segunda|terça|quarta|quinta|sexta|sábado|domingo|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/)) break
        const ex = line.replace(/^[-*•\d.)\s]+/, '').trim()
        if (ex && ex.length > 3 && !ex.includes(':') && ex.match(/[a-zA-Z]/)) exercises.push(ex)
      }
    }
    return exercises.slice(0, 8)
  }

  const generatePlan = async () => {
    if (!profile.age || !profile.weight) { toast.error('Complete seu perfil primeiro'); return }
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/plan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile }) })
      const data = await res.json()
      await supabase.from('profiles').update({ training_plan: data.training_plan, nutrition_plan: data.nutrition_plan }).eq('id', profile.id)
      onProfileUpdate({ training_plan: data.training_plan, nutrition_plan: data.nutrition_plan })
      const parsed = parseWeekProtocol(data.training_plan)
      setWeekProtocol(parsed)
      toast.success('Plano gerado!')
    } catch { toast.error('Erro ao gerar plano') } finally { setGenerating(false) }
  }

  const addSet = (exercise: string) => {
    setExerciseLogs(prev => {
      const current = prev[exercise] || { sets: [] }
      return { ...prev, [exercise]: { sets: [...current.sets, { reps: '12', weight: '' }] } }
    })
  }

  const updateSet = (exercise: string, idx: number, field: 'reps' | 'weight', value: string) => {
    setExerciseLogs(prev => {
      const current = { ...(prev[exercise] || { sets: [] }) }
      current.sets = [...current.sets]
      current.sets[idx] = { ...current.sets[idx], [field]: value }
      return { ...prev, [exercise]: current }
    })
  }

  const saveExerciseLog = async (exercise: string) => {
    const log = exerciseLogs[exercise]
    if (!log || log.sets.length === 0) return
    await supabase.from('workout_logs').upsert({
      user_id: profile.id, exercise_name: exercise,
      sets_data: log, logged_at: new Date().toISOString()
    }, { onConflict: 'user_id,exercise_name,logged_at' } as any)
    toast.success('Carga salva!')
  }

  const requestAlternative = async () => {
    if (!swapModal) return
    setSwapLoading(true)
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Preciso de uma alternativa para o exercício "${swapModal.exercise}" no dia ${swapModal.day}. Motivo: ${swapReason || 'não tenho esse equipamento'}. Me dê 2-3 opções de substituição com séries e repetições.` }],
          profile
        })
      })
      const data = await res.json()
      setSwapResult(data.reply)
    } catch { toast.error('Erro ao buscar alternativa') } finally { setSwapLoading(false) }
  }

  const markTrainingDone = async () => {
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('daily_missions').upsert({ user_id: profile.id, date: today, training_done: true }, { onConflict: 'user_id,date' } as any)
    toast.success('Treino concluído! 💪')
  }

  const days = Object.keys(weekProtocol).length > 0 ? weekProtocol : { Segunda:'Peito + Tríceps', Terça:'Costas + Bíceps', Quarta:'Cardio LISS 30min', Quinta:'Pernas — Quadríceps', Sexta:'Ombros + Deltóides', Sábado:'Pernas — Posterior', Domingo:'Descanso Ativo' }
  const orderedDays = DAY_ORDER.filter(d => days[d]).map(d => ({ day: d, workout: days[d] }))
  const dayExercises = selectedDay ? getExercisesForDay(selectedDay) : []

  return (
    <div className="min-h-screen flex flex-col">
      <div className="px-8 py-6 border-b border-[#1C1C1C] flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black text-white uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>TREINO</h1>
          <p className="text-[#555] text-sm mt-0.5">Protocolos personalizados com registro de carga</p>
        </div>
        {profile.training_plan && (
          <button onClick={generatePlan} disabled={generating} className="btn btn-ghost btn-sm">
            {generating ? <><IconLoader />Gerando...</> : 'Regenerar Plano'}
          </button>
        )}
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Days sidebar */}
        <div className="w-64 border-r border-[#1C1C1C] p-4 space-y-2 overflow-y-auto flex-shrink-0">
          <p className="text-xs font-black uppercase tracking-widest text-[#444] mb-4 px-2" style={{ fontFamily: 'var(--font-display)' }}>PROTOCOLO SEMANAL</p>
          {orderedDays.map(({ day, workout }) => {
            const isToday = day === todayPt
            const isSelected = day === selectedDay
            return (
              <button key={day} onClick={() => setSelectedDay(day)}
                className={`w-full text-left rounded-xl p-3 border transition-all ${isSelected ? 'bg-[#E8002D]/10 border-[#E8002D]/40' : isToday ? 'bg-[#1A1A1A] border-[#E8002D]/20' : 'bg-[#0E0E0E] border-[#1C1C1C] hover:border-[#333]'}`}>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`text-xs font-black uppercase tracking-widest ${isSelected ? 'text-[#E8002D]' : isToday ? 'text-[#E8002D]/70' : 'text-[#444]'}`} style={{ fontFamily: 'var(--font-display)' }}>{day}</span>
                  {isToday && <span className="text-[8px] bg-[#E8002D] text-white px-1.5 py-0.5 rounded-full font-bold">HOJE</span>}
                </div>
                <p className="text-xs text-[#666]">{workout}</p>
              </button>
            )
          })}
          <button onClick={markTrainingDone} className="btn btn-secondary w-full mt-2 text-sm">
            <IconCheck />Marcar Feito
          </button>
        </div>

        {/* Day detail */}
        <div className="flex-1 p-6 overflow-y-auto">
          {!profile.training_plan ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="w-20 h-20 rounded-2xl bg-[#111] border border-[#1C1C1C] flex items-center justify-center mx-auto mb-4 text-[#333]"><IconDumbbell /></div>
                <p className="text-white font-semibold mb-1">Nenhum plano gerado</p>
                <p className="text-[#555] text-sm mb-6">Gere um plano personalizado com IA</p>
                <button onClick={generatePlan} disabled={generating} className="btn btn-primary">
                  {generating ? <><IconLoader />Gerando...</> : <><IconPlay />Gerar Plano com IA</>}
                </button>
              </div>
            </div>
          ) : selectedDay ? (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-xl font-black text-white uppercase" style={{ fontFamily: 'var(--font-display)' }}>{selectedDay}</h2>
                  <p className="text-[#555] text-sm">{days[selectedDay]}</p>
                </div>
              </div>

              {dayExercises.length > 0 ? (
                <div className="space-y-4">
                  {dayExercises.map(exercise => {
                    const log = exerciseLogs[exercise] || { sets: [] }
                    return (
                      <div key={exercise} className="rounded-2xl bg-[#111] border border-[#1C1C1C] p-5">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-[#E8002D]" />
                            <span className="font-semibold text-white text-sm">{exercise}</span>
                          </div>
                          <button onClick={() => { setSwapModal({ exercise, day: selectedDay }); setSwapResult(''); setSwapReason('') }}
                            className="flex items-center gap-1.5 text-xs text-[#555] hover:text-[#E8002D] transition-colors px-3 py-1.5 rounded-lg border border-[#1C1C1C] hover:border-[#E8002D]/30">
                            <IconSwap /><span>Alternativa</span>
                          </button>
                        </div>

                        {/* Sets */}
                        <div className="space-y-2 mb-3">
                          {log.sets.length > 0 && (
                            <div className="grid grid-cols-3 gap-2 text-xs text-[#444] uppercase tracking-wide mb-1">
                              <span>Série</span><span>Reps</span><span>Carga (kg)</span>
                            </div>
                          )}
                          {log.sets.map((s, i) => (
                            <div key={i} className="grid grid-cols-3 gap-2 items-center">
                              <span className="text-xs text-[#555] font-mono">#{i + 1}</span>
                              <input type="number" value={s.reps} onChange={e => updateSet(exercise, i, 'reps', e.target.value)}
                                className="input py-2 px-3 text-sm text-center" placeholder="12" />
                              <input type="number" value={s.weight} onChange={e => updateSet(exercise, i, 'weight', e.target.value)}
                                className="input py-2 px-3 text-sm text-center" placeholder="—" />
                            </div>
                          ))}
                        </div>

                        <div className="flex gap-2">
                          <button onClick={() => addSet(exercise)} className="flex items-center gap-1 text-xs text-[#555] hover:text-white transition-colors border border-[#1C1C1C] hover:border-[#333] rounded-lg px-3 py-1.5">
                            <IconPlus />Série
                          </button>
                          {log.sets.length > 0 && (
                            <button onClick={() => saveExerciseLog(exercise)} className="flex items-center gap-1 text-xs text-[#E8002D] hover:text-white transition-colors border border-[#E8002D]/30 hover:bg-[#E8002D]/10 rounded-lg px-3 py-1.5">
                              <IconWeight />Salvar carga
                            </button>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="rounded-2xl bg-[#111] border border-[#1C1C1C] p-8">
                  <div className="prose-dark">
                    <Markdown>{profile.training_plan}</Markdown>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Swap Modal */}
      <AnimatePresence>
        {swapModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4"
            onClick={e => e.target === e.currentTarget && setSwapModal(null)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#111] border border-[#1C1C1C] rounded-2xl p-6 w-full max-w-md">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-black text-white uppercase text-sm tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>ALTERNATIVA PARA</h3>
                <button onClick={() => setSwapModal(null)} className="text-[#555] hover:text-white"><IconX /></button>
              </div>
              <p className="text-[#E8002D] font-semibold mb-4">{swapModal.exercise}</p>

              {!swapResult ? (
                <>
                  <textarea value={swapReason} onChange={e => setSwapReason(e.target.value)}
                    placeholder="Por que precisa trocar? (ex: não tenho barra, dor no ombro, sem equipamento...)"
                    rows={3} className="input w-full py-3 px-4 resize-none mb-4 text-sm" />
                  <button onClick={requestAlternative} disabled={swapLoading} className="btn btn-primary w-full">
                    {swapLoading ? <><IconLoader />Buscando alternativas...</> : 'Pedir alternativa'}
                  </button>
                </>
              ) : (
                <div className="prose-dark text-sm">
                  <Markdown>{swapResult}</Markdown>
                  <button onClick={() => setSwapResult('')} className="btn btn-ghost btn-sm mt-3">← Perguntar novamente</button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
