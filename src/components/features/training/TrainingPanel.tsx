// src/components/features/training/TrainingPanel.tsx
'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Markdown from 'react-markdown'
import type { Profile } from '@/types/supabase'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

const IconDumbbell = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="m6.5 6.5 11 11"/><path d="m21 21-1-1"/><path d="m3 3 1 1"/><path d="m18 22 4-4"/><path d="m2 6 4-4"/><path d="m3 10 7-7"/><path d="m14 21 7-7"/></svg>
const IconCheck = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
const IconLoader = () => <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/></svg>
const IconPlay = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>

const DAYS_PT: Record<string, string> = {
  Monday: 'Segunda', Tuesday: 'Terça', Wednesday: 'Quarta',
  Thursday: 'Quinta', Friday: 'Sexta', Saturday: 'Sábado', Sunday: 'Domingo'
}

interface TrainingPanelProps {
  profile: Profile
  onProfileUpdate: (data: Partial<Profile>) => void
}

export default function TrainingPanel({ profile, onProfileUpdate }: TrainingPanelProps) {
  const [activeView, setActiveView] = useState<'plan' | 'log'>('plan')
  const [generating, setGenerating] = useState(false)
  const [weekProtocol, setWeekProtocol] = useState<Record<string, string>>({})
  const supabase = createClient()

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' }) // 'Monday' etc
  const todayPt = DAYS_PT[today] || today

  const generatePlan = async () => {
    if (!profile.age || !profile.weight) {
      toast.error('Complete seu perfil primeiro')
      return
    }
    setGenerating(true)
    try {
      const res = await fetch('/api/ai/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile }),
      })
      const data = await res.json()
      await supabase.from('profiles').update({
        training_plan: data.training_plan,
        nutrition_plan: data.nutrition_plan,
      }).eq('id', profile.id)
      onProfileUpdate({ training_plan: data.training_plan, nutrition_plan: data.nutrition_plan })
      if (data.week_protocol) setWeekProtocol(data.week_protocol)
      toast.success('Plano gerado com sucesso!')
    } catch {
      toast.error('Erro ao gerar plano')
    } finally {
      setGenerating(false)
    }
  }

  const markTrainingDone = async () => {
    const today = new Date().toISOString().split('T')[0]
    await supabase.from('daily_missions').upsert({
      user_id: profile.id, date: today, training_done: true
    }, { onConflict: 'user_id,date' })
    toast.success('Treino marcado como concluído!')
  }

  const days = Object.keys(weekProtocol).length > 0
    ? weekProtocol
    : {
      Segunda: 'Peito + Tríceps',
      Terça: 'Costas + Bíceps',
      Quarta: 'Cardio LISS 30min',
      Quinta: 'Pernas — Quadríceps',
      Sexta: 'Ombros + Deltóides',
      Sábado: 'Pernas — Posterior',
      Domingo: 'Descanso Ativo',
    }

  return (
    <div className="min-h-screen flex flex-col">
      <div className="px-8 py-6 border-b border-[#1C1C1C] flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black text-white uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>TREINO</h1>
          <p className="text-[#555] text-sm mt-0.5">Protocolos de elite personalizados por IA</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 bg-[#111] border border-[#1C1C1C] rounded-lg p-1">
            {(['plan', 'log'] as const).map(v => (
              <button key={v} onClick={() => setActiveView(v)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${v === activeView ? 'bg-[#E8002D] text-white' : 'text-[#666] hover:text-[#999]'}`}>
                {v === 'plan' ? 'Plano' : 'Histórico'}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 p-8">
        {activeView === 'plan' && (
          <div className="grid grid-cols-1 xl:grid-cols-[300px_1fr] gap-8">
            {/* Week Protocol Sidebar */}
            <div className="space-y-3">
              <p className="text-xs font-black uppercase tracking-widest text-[#555] mb-4" style={{ fontFamily: 'var(--font-display)' }}>PROTOCOLO SEMANAL</p>
              {Object.entries(days).map(([day, workout]) => {
                const dayEn = Object.entries(DAYS_PT).find(([, pt]) => pt === day)?.[0] || day
                const isToday = dayEn === today || day === todayPt
                return (
                  <div key={day} className={`rounded-xl p-4 border transition-all ${
                    isToday
                      ? 'bg-[#E8002D]/10 border-[#E8002D]/30'
                      : 'bg-[#111] border-[#1C1C1C]'
                  }`}>
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-black uppercase tracking-widest ${isToday ? 'text-[#E8002D]' : 'text-[#444]'}`} style={{ fontFamily: 'var(--font-display)' }}>
                        {day}
                        {isToday && <span className="ml-2 text-[9px] bg-[#E8002D] text-white px-1.5 py-0.5 rounded-full">HOJE</span>}
                      </span>
                    </div>
                    <p className="text-sm text-[#999]">{workout}</p>
                  </div>
                )
              })}

              <button onClick={markTrainingDone} className="btn btn-secondary w-full mt-2">
                <IconCheck />Marcar Treino Feito
              </button>
            </div>

            {/* Full Plan */}
            <div>
              {!profile.training_plan ? (
                <div className="flex items-center justify-center h-full min-h-[300px]">
                  <div className="text-center">
                    <div className="w-20 h-20 rounded-2xl bg-[#111] border border-[#1C1C1C] flex items-center justify-center mx-auto mb-4 text-[#333]">
                      <IconDumbbell />
                    </div>
                    <p className="text-white font-semibold mb-1">Nenhum plano gerado</p>
                    <p className="text-[#555] text-sm mb-6">Gere um plano de treino personalizado com IA</p>
                    <button onClick={generatePlan} disabled={generating} className="btn btn-primary">
                      {generating ? <><IconLoader />Gerando...</> : <><IconPlay />Gerar Plano de Treino</>}
                    </button>
                  </div>
                </div>
              ) : (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="rounded-2xl bg-[#111] border border-[#1C1C1C] p-8">
                  <div className="flex justify-between items-center mb-6">
                    <p className="text-xs font-black uppercase tracking-widest text-[#E8002D]" style={{ fontFamily: 'var(--font-display)' }}>
                      PLANO PERSONALIZADO
                    </p>
                    <button onClick={generatePlan} disabled={generating} className="btn btn-ghost btn-sm">
                      {generating ? <IconLoader /> : 'Regenerar'}
                    </button>
                  </div>
                  <div className="prose-dark">
                    <Markdown>{profile.training_plan}</Markdown>
                  </div>
                </motion.div>
              )}
            </div>
          </div>
        )}

        {activeView === 'log' && (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-2xl bg-[#111] border border-[#1C1C1C] flex items-center justify-center mx-auto mb-4 text-[#333]">
              <IconDumbbell />
            </div>
            <p className="text-[#555] text-sm">Histórico de treinos em breve</p>
          </div>
        )}
      </div>
    </div>
  )
}
