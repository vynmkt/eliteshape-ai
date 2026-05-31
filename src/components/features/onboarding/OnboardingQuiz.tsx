// src/components/features/onboarding/OnboardingQuiz.tsx
'use client'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import type { Profile } from '@/types/supabase'
import toast from 'react-hot-toast'

interface OnboardingQuizProps {
  profile: Profile
  onComplete: (data: Partial<Profile>) => void
}

const steps = [
  {
    id: 'basics', title: 'Vamos começar', subtitle: 'Informações básicas para personalizar tudo',
    fields: [
      { key: 'name', label: 'Qual é o seu nome?', type: 'text', placeholder: 'Ex: João Silva' },
      { key: 'age', label: 'Quantos anos você tem?', type: 'number', placeholder: '25', unit: 'anos' },
      { key: 'gender', label: 'Sexo biológico', type: 'select', options: [
        { value: 'male', label: '♂ Masculino' }, { value: 'female', label: '♀ Feminino' },
      ]},
    ],
  },
  {
    id: 'body', title: 'Seu corpo', subtitle: 'Para calcular suas necessidades calóricas exatas',
    fields: [
      { key: 'height', label: 'Sua altura', type: 'number', placeholder: '175', unit: 'cm' },
      { key: 'weight', label: 'Seu peso atual', type: 'number', placeholder: '80', unit: 'kg' },
      { key: 'fat_percentage', label: '% de gordura estimada (opcional)', type: 'number', placeholder: '20', unit: '%' },
    ],
  },
  {
    id: 'objective', title: 'Seu objetivo', subtitle: 'O que você quer conquistar?',
    fields: [
      { key: 'objective', label: 'Objetivo principal', type: 'cards', options: [
        { value: 'Hipertrofia', label: 'Ganhar Massa', icon: '💪' },
        { value: 'Emagrecimento', label: 'Emagrecer', icon: '🔥' },
        { value: 'Definição', label: 'Definição', icon: '⚡' },
        { value: 'Força', label: 'Força', icon: '🏋️' },
        { value: 'Condicionamento', label: 'Cardio', icon: '🏃' },
        { value: 'Recomposição', label: 'Recomposição', icon: '⚖️' },
      ]},
    ],
  },
  {
    id: 'training', title: 'Sua experiência', subtitle: 'Para adequar intensidade e volume',
    fields: [
      { key: 'training_level', label: 'Nível de treino', type: 'cards', options: [
        { value: 'beginner', label: 'Iniciante', icon: '🌱', sub: '< 1 ano' },
        { value: 'intermediate', label: 'Intermediário', icon: '📈', sub: '1-3 anos' },
        { value: 'advanced', label: 'Avançado', icon: '🏆', sub: '3+ anos' },
      ]},
      { key: 'activity_level', label: 'Frequência semanal', type: 'cards', options: [
        { value: 'sedentary', label: 'Sedentário', icon: '🛋️', sub: 'Sem atividade' },
        { value: 'light', label: 'Leve', icon: '🚶', sub: '1-2x/semana' },
        { value: 'moderate', label: 'Moderado', icon: '🏃', sub: '3-4x/semana' },
        { value: 'active', label: 'Ativo', icon: '⚡', sub: '5-6x/semana' },
        { value: 'very_active', label: 'Atleta', icon: '🔥', sub: '2x/dia' },
      ]},
    ],
  },
  {
    id: 'health', title: 'Saúde & Restrições', subtitle: 'Para recomendar treinos seguros e adaptados',
    fields: [
      { key: 'health_conditions', label: 'Tem algum problema de saúde ou lesão?', type: 'textarea',
        placeholder: 'Ex: joelho operado, hérnia de disco, hipertensão... (deixe vazio se não tiver)' },
      { key: 'current_diet', label: 'Sua alimentação', type: 'cards', options: [
        { value: 'Onívoro', label: 'Como tudo', icon: '🍗' },
        { value: 'Vegetariano', label: 'Vegetariano', icon: '🥗' },
        { value: 'Vegano', label: 'Vegano', icon: '🌱' },
        { value: 'Low-carb', label: 'Low-carb', icon: '🥩' },
      ]},
    ],
  },
  {
    id: 'preferences', title: 'Quase pronto!', subtitle: 'Defina o estilo do seu coach',
    fields: [
      { key: 'personality_mode', label: 'Como você quer que seu coach seja?', type: 'cards', options: [
        { value: 'motivational', label: 'Motivacional', icon: '🔥', sub: 'Energia alta' },
        { value: 'technical', label: 'Técnico', icon: '🧪', sub: 'Ciência aplicada' },
        { value: 'raiz', label: 'Raiz', icon: '💬', sub: 'Direto ao ponto' },
      ]},
      { key: 'wants_supplements', label: 'Usa ou quer usar suplementos?', type: 'toggle' },
    ],
  },
]

export default function OnboardingQuiz({ profile, onComplete }: OnboardingQuizProps) {
  const [step, setStep] = useState(0)
  const [form, setForm] = useState<Record<string, any>>({ name: profile.name || '' })
  const [saving, setSaving] = useState(false)
  const supabase = createClient()
  const set = (key: string, value: any) => setForm(prev => ({ ...prev, [key]: value }))
  const current = steps[step]
  const progress = ((step + 1) / steps.length) * 100

  const next = () => step < steps.length - 1 ? setStep(s => s + 1) : finish()

  const finish = async () => {
    setSaving(true)
    try {
      const updateData = { ...form, onboarding_done: true }
      await supabase.from('profiles').update(updateData).eq('id', profile.id)
      onComplete(updateData)
      toast.success('Perfil configurado!')
    } catch { toast.error('Erro ao salvar') } finally { setSaving(false) }
  }

  const canAdvance = () => {
    const optional = ['fat_percentage', 'health_conditions', 'wants_supplements']
    return current.fields.filter(f => !optional.includes(f.key)).every(f => form[f.key] !== undefined && form[f.key] !== '')
  }

  return (
    <div className="fixed inset-0 bg-[#080808] flex flex-col items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="w-full max-w-lg mb-8">
        <div className="flex justify-between text-xs text-[#444] mb-2 font-mono">
          <span>CONFIGURANDO SEU PERFIL</span><span>{step + 1}/{steps.length}</span>
        </div>
        <div className="h-1 bg-[#1C1C1C] rounded-full overflow-hidden">
          <motion.div className="h-full bg-[#E8002D] rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }} transition={{ duration: 0.25 }} className="w-full max-w-lg">
          <div className="mb-8">
            <h2 className="text-3xl font-black text-white uppercase tracking-wide mb-1" style={{ fontFamily: 'var(--font-display)' }}>{current.title}</h2>
            <p className="text-[#555] text-sm">{current.subtitle}</p>
          </div>

          <div className="space-y-6">
            {current.fields.map(field => (
              <div key={field.key}>
                <label className="text-xs font-black uppercase tracking-widest text-[#666] mb-3 block" style={{ fontFamily: 'var(--font-display)' }}>{field.label}</label>
                {field.type === 'text' && <input type="text" value={form[field.key] || ''} onChange={e => set(field.key, e.target.value)} placeholder={(field as any).placeholder} className="input w-full text-lg py-4 px-5" autoFocus />}
                {field.type === 'number' && (
                  <div className="relative">
                    <input type="number" value={form[field.key] || ''} onChange={e => set(field.key, Number(e.target.value))} placeholder={(field as any).placeholder} className="input w-full text-lg py-4 px-5 pr-16" />
                    {(field as any).unit && <span className="absolute right-5 top-1/2 -translate-y-1/2 text-[#444] text-sm">{(field as any).unit}</span>}
                  </div>
                )}
                {field.type === 'textarea' && <textarea value={form[field.key] || ''} onChange={e => set(field.key, e.target.value)} placeholder={(field as any).placeholder} rows={3} className="input w-full py-4 px-5 resize-none" />}
                {field.type === 'toggle' && (
                  <div className="flex items-center gap-4">
                    <button onClick={() => set(field.key, !form[field.key])} className={`relative w-14 h-7 rounded-full transition-colors ${form[field.key] ? 'bg-[#E8002D]' : 'bg-[#252525]'}`}>
                      <span className={`absolute top-1.5 w-4 h-4 rounded-full bg-white transition-transform ${form[field.key] ? 'translate-x-8' : 'translate-x-1.5'}`} />
                    </button>
                    <span className="text-[#999] text-sm">{form[field.key] ? 'Sim' : 'Não'}</span>
                  </div>
                )}
                {field.type === 'select' && (
                  <select value={form[field.key] || ''} onChange={e => set(field.key, e.target.value)} className="input w-full text-lg py-4 px-5">
                    <option value="">— Selecionar —</option>
                    {field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                )}
                {field.type === 'cards' && (
                  <div className={`grid gap-3 ${(field.options?.length || 0) <= 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-3'}`}>
                    {field.options?.map(o => (
                      <button key={o.value} onClick={() => set(field.key, o.value)}
                        className={`p-4 rounded-xl border text-left transition-all ${form[field.key] === o.value ? 'bg-[#E8002D]/10 border-[#E8002D] text-white' : 'bg-[#111] border-[#1C1C1C] text-[#666] hover:border-[#333]'}`}>
                        <div className="text-2xl mb-1">{(o as any).icon}</div>
                        <div className="text-sm font-bold">{o.label}</div>
                        {(o as any).sub && <div className="text-xs text-[#555] mt-0.5">{(o as any).sub}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between mt-10">
            <button onClick={() => setStep(s => s - 1)} disabled={step === 0} className="btn btn-ghost disabled:opacity-30">← Voltar</button>
            <button onClick={next} disabled={!canAdvance() || saving} className="btn btn-primary px-8 disabled:opacity-40">
              {saving ? 'Salvando...' : step === steps.length - 1 ? 'Concluir 🚀' : 'Próximo →'}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
