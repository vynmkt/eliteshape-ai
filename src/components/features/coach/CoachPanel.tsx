// src/components/features/coach/CoachPanel.tsx
'use client'
import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Markdown from 'react-markdown'
import type { Profile } from '@/types/supabase'
import { resizeImage } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import toast from 'react-hot-toast'

// ---- SVG Icons ----
const IconCamera = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
const IconScan = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><line x1="7" y1="12" x2="17" y2="12"/></svg>
const IconZap = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
const IconX = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
const IconLoader = () => <svg className="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round"/></svg>
const IconCheck = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
const IconChat = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
const IconSend = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>

interface CoachPanelProps {
  profile: Profile
  onProfileUpdate: (data: Partial<Profile>) => void
}

type TabType = 'analysis' | 'chat'

interface AnalysisResult {
  overall_score?: number
  fat_percentage_estimate?: number
  muscle_mass?: string
  strong_points?: string[]
  weak_points?: string[]
  priority_muscles?: string[]
  training_plan?: string
  nutrition_plan?: string
  motivational_message?: string
  roast?: string
}

export default function CoachPanel({ profile, onProfileUpdate }: CoachPanelProps) {
  const [activeTab, setActiveTab] = useState<TabType>('analysis')
  const [images, setImages] = useState<{ file: File; preview: string; base64: string }[]>([])
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState('')
  const [result, setResult] = useState<AnalysisResult | null>(null)
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([])
  const fileRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const isProfileReady = profile.age && profile.height && profile.weight && profile.objective

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter(f => f.type.startsWith('image/')).slice(0, 5)
    const processed = await Promise.all(arr.map(async (file) => {
      const base64 = await resizeImage(file, 1200)
      const preview = URL.createObjectURL(file)
      return { file, preview, base64 }
    }))
    setImages(prev => [...prev, ...processed].slice(0, 5))
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const runAnalysis = async (isRoast = false) => {
    if (images.length === 0) { toast.error('Adicione pelo menos uma foto'); return }
    if (!isProfileReady) { toast.error('Complete seu perfil primeiro'); return }
    if (!profile.is_premium && images.length > 1) { toast.error('Plano free permite apenas 1 foto'); return }

    setLoading(true)
    setLoadingStep('Processando imagens...')
    setResult(null)

    try {
      setLoadingStep('Consultando IA de elite...')
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: images.map(i => i.base64),
          profile,
          isRoast,
        }),
      })

      if (!res.ok) throw new Error((await res.json()).error ?? 'Erro na análise')
      const data = await res.json()
      setResult(data)
      setLoadingStep('Salvando análise...')

      // Save to Supabase
      await supabase.from('shape_history').insert({
        user_id: profile.id,
        analysis: data,
        fat_percentage: data.fat_percentage_estimate,
        muscle_score: data.overall_score,
      })

      // Update profile plans
      if (data.training_plan) {
        await supabase.from('profiles').update({
          training_plan: data.training_plan,
          nutrition_plan: data.nutrition_plan,
          last_analysis: JSON.stringify(data).slice(0, 2000),
          target_calories: data.nutrition_schedule?.target_calories,
          target_protein: data.nutrition_schedule?.target_protein,
          target_carbs: data.nutrition_schedule?.target_carbs,
          target_fat: data.nutrition_schedule?.target_fat,
        }).eq('id', profile.id)

        onProfileUpdate({
          training_plan: data.training_plan,
          nutrition_plan: data.nutrition_plan,
          target_calories: data.nutrition_schedule?.target_calories,
          target_protein: data.nutrition_schedule?.target_protein,
          target_carbs: data.nutrition_schedule?.target_carbs,
          target_fat: data.nutrition_schedule?.target_fat,
        })
      }

      toast.success('Análise concluída!')
    } catch (e: any) {
      toast.error(e.message || 'Erro ao analisar')
    } finally {
      setLoading(false)
      setLoadingStep('')
    }
  }

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return
    const msg = chatInput.trim()
    setChatInput('')
    const newMessages = [...chatMessages, { role: 'user' as const, content: msg }]
    setChatMessages(newMessages)
    setChatLoading(true)

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, profile }),
      })
      const data = await res.json()
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } catch {
      toast.error('Erro ao conectar com o Coach')
    } finally {
      setChatLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="px-8 py-6 border-b border-[#1C1C1C] flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-black text-white uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
            COACH DE ELITE
          </h1>
          <p className="text-[#555] text-sm mt-0.5">Análise corporal por visão computacional + OpenAI</p>
        </div>
        {/* Tabs */}
        <div className="flex gap-1 bg-[#111] border border-[#1C1C1C] rounded-lg p-1">
          {([['analysis', 'Análise', IconCamera], ['chat', 'Chat', IconChat]] as const).map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                activeTab === id ? 'bg-[#E8002D] text-white' : 'text-[#666] hover:text-[#999]'
              }`}
            >
              <Icon />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 p-8">
        <AnimatePresence mode="wait">
          {/* ---- ANALYSIS TAB ---- */}
          {activeTab === 'analysis' && (
            <motion.div key="analysis" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {!isProfileReady && (
                <div className="mb-6 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm">
                  Complete seu perfil antes de gerar uma análise.
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                {/* Upload Zone */}
                <div>
                  <h2 className="text-xs font-black uppercase tracking-widest text-[#555] mb-4" style={{ fontFamily: 'var(--font-display)' }}>
                    FOTOS DO SHAPE (até {profile.is_premium ? 5 : 1})
                  </h2>

                  {/* Drop Area */}
                  <div
                    onDragOver={e => { e.preventDefault(); setDragging(true) }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={onDrop}
                    onClick={() => images.length < (profile.is_premium ? 5 : 1) && fileRef.current?.click()}
                    className={`relative rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
                      dragging ? 'border-[#E8002D] bg-[#E8002D]/5' : 'border-[#252525] hover:border-[#E8002D]/40 hover:bg-white/[0.02]'
                    } ${images.length > 0 ? 'p-4' : 'p-12 flex flex-col items-center justify-center'}`}
                  >
                    {images.length === 0 ? (
                      <div className="text-center">
                        <div className="w-16 h-16 rounded-2xl bg-[#E8002D]/10 border border-[#E8002D]/20 flex items-center justify-center mx-auto mb-4 text-[#E8002D]">
                          <IconCamera />
                        </div>
                        <p className="text-white font-semibold mb-1">Arraste ou clique para enviar</p>
                        <p className="text-[#555] text-sm">Fotos do shape em poses padrão — max {profile.is_premium ? 5 : 1} foto{profile.is_premium ? 's' : ''}</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-3">
                        {images.map((img, i) => (
                          <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-[#1A1A1A]">
                            <img src={img.preview} alt="" className="w-full h-full object-cover" />
                            <button
                              onClick={e => { e.stopPropagation(); setImages(prev => prev.filter((_, j) => j !== i)) }}
                              className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-[#E8002D] transition-colors"
                            >
                              <IconX />
                            </button>
                          </div>
                        ))}
                        {images.length < (profile.is_premium ? 5 : 1) && (
                          <div className="aspect-square rounded-xl border-2 border-dashed border-[#252525] flex items-center justify-center text-[#444] hover:text-[#E8002D] hover:border-[#E8002D]/40 transition-colors cursor-pointer">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                    onChange={e => e.target.files && handleFiles(e.target.files)} />

                  {/* Action Buttons */}
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => runAnalysis(false)}
                      disabled={loading || images.length === 0}
                      className="btn btn-primary flex-1"
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {loading ? (
                        <><IconLoader />{loadingStep || 'Analisando...'}</>
                      ) : (
                        <><IconScan />GERAR PLANO ELITE</>
                      )}
                    </button>
                    {profile.is_premium && (
                      <button
                        onClick={() => runAnalysis(true)}
                        disabled={loading || images.length === 0}
                        className="btn btn-secondary px-4"
                        title="Zoar meu shape"
                      >
                        <IconZap />
                      </button>
                    )}
                  </div>

                  {/* Tips */}
                  <div className="mt-6 rounded-xl bg-[#111] border border-[#1C1C1C] p-5">
                    <p className="text-xs font-black text-[#E8002D] uppercase tracking-widest mb-3" style={{ fontFamily: 'var(--font-display)' }}>DICAS DO COACH</p>
                    <ul className="space-y-2">
                      {[
                        'Envie fotos em jejum para melhor análise de gordura',
                        'Use iluminação consistente e poses padrão de fisiculturismo',
                        'Envie fotos de frente, lado e costas para análise completa',
                      ].map((tip, i) => (
                        <li key={i} className="flex gap-2 text-sm text-[#555]">
                          <span className="text-[#E8002D] mt-0.5 flex-shrink-0"><IconCheck /></span>
                          {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Results */}
                <div>
                  {!result ? (
                    <div className="h-full flex items-center justify-center text-center py-20">
                      <div>
                        <div className="w-20 h-20 rounded-2xl bg-[#111] border border-[#1C1C1C] flex items-center justify-center mx-auto mb-4 text-[#333]">
                          <IconScan />
                        </div>
                        <p className="text-[#444] text-sm">
                          {loading ? loadingStep : 'Envie fotos e clique em "Gerar Plano Elite"'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                      {result.roast && (
                        <div className="rounded-2xl bg-gradient-to-br from-[#E8002D]/10 to-[#6366F1]/5 border border-[#E8002D]/20 p-6">
                          <p className="text-xs font-black text-[#E8002D] uppercase tracking-widest mb-3" style={{ fontFamily: 'var(--font-display)' }}>ROAST MODE ATIVADO</p>
                          <p className="text-white text-sm leading-relaxed italic">{result.roast}</p>
                        </div>
                      )}

                      {result.overall_score !== undefined && (
                        <div className="grid grid-cols-2 gap-3">
                          {/* Score */}
                          <div className="rounded-2xl bg-[#111] border border-[#1C1C1C] p-5 text-center">
                            <p className="stat-label mb-2">Score Geral</p>
                            <p className="stat-value text-[#E8002D]">{result.overall_score}<span className="text-lg text-[#444">/10</span></p>
                          </div>
                          {/* BF% */}
                          <div className="rounded-2xl bg-[#111] border border-[#1C1C1C] p-5 text-center">
                            <p className="stat-label mb-2">% Gordura Est.</p>
                            <p className="stat-value">{result.fat_percentage_estimate}<span className="text-lg text-[#444]">%</span></p>
                          </div>
                        </div>
                      )}

                      {result.strong_points && (
                        <div className="rounded-2xl bg-[#111] border border-[#1C1C1C] p-5">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="text-xs font-black text-emerald-500 uppercase tracking-widest mb-2" style={{ fontFamily: 'var(--font-display)' }}>PONTOS FORTES</p>
                              <ul className="space-y-1">
                                {result.strong_points.map((p, i) => (
                                  <li key={i} className="text-sm text-[#999] flex gap-2"><span className="text-emerald-500 mt-0.5 flex-shrink-0"><IconCheck /></span>{p}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className="text-xs font-black text-[#E8002D] uppercase tracking-widest mb-2" style={{ fontFamily: 'var(--font-display)' }}>PRIORIDADES</p>
                              <ul className="space-y-1">
                                {result.weak_points?.map((p, i) => (
                                  <li key={i} className="text-sm text-[#999]">• {p}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}

                      {result.motivational_message && (
                        <div className="rounded-xl bg-[#E8002D]/5 border border-[#E8002D]/15 p-4">
                          <p className="text-sm text-[#E8E8E8] italic leading-relaxed">{result.motivational_message}</p>
                        </div>
                      )}

                      {result.training_plan && (
                        <details className="rounded-2xl bg-[#111] border border-[#1C1C1C] overflow-hidden">
                          <summary className="p-5 cursor-pointer text-white font-semibold text-sm flex items-center justify-between">
                            Ver Plano de Treino Completo
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                          </summary>
                          <div className="p-5 pt-0 border-t border-[#1C1C1C]">
                            <div className="prose-dark"><Markdown>{result.training_plan}</Markdown></div>
                          </div>
                        </details>
                      )}
                    </motion.div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* ---- CHAT TAB ---- */}
          {activeTab === 'chat' && (
            <motion.div key="chat" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col h-[calc(100vh-180px)]">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto space-y-4 pb-4">
                {chatMessages.length === 0 && (
                  <div className="text-center py-20">
                    <div className="w-16 h-16 rounded-2xl bg-[#E8002D]/10 border border-[#E8002D]/20 flex items-center justify-center mx-auto mb-4 text-[#E8002D]">
                      <IconChat />
                    </div>
                    <p className="text-white font-semibold mb-1">Coach Especialista</p>
                    <p className="text-[#555] text-sm">Pergunte sobre treino, dieta, suplementação e protocolos</p>
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-5 py-4 ${
                      msg.role === 'user'
                        ? 'bg-[#E8002D] text-white rounded-br-md'
                        : 'bg-[#111] border border-[#1C1C1C] text-[#E8E8E8] rounded-bl-md'
                    }`}>
                      {msg.role === 'assistant'
                        ? <div className="prose-dark text-sm"><Markdown>{msg.content}</Markdown></div>
                        : <p className="text-sm">{msg.content}</p>
                      }
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-[#111] border border-[#1C1C1C] rounded-2xl rounded-bl-md px-5 py-4">
                      <div className="flex gap-1">
                        {[0,1,2].map(i => (
                          <motion.div key={i} animate={{ y: [0,-4,0] }} transition={{ repeat: Infinity, duration: 0.8, delay: i*0.15 }}
                            className="w-2 h-2 rounded-full bg-[#E8002D]" />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="border-t border-[#1C1C1C] pt-4">
                <div className="flex gap-3">
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendChat()}
                    placeholder="Pergunte ao seu coach de elite..."
                    className="input flex-1"
                  />
                  <button
                    onClick={sendChat}
                    disabled={chatLoading || !chatInput.trim()}
                    className="btn btn-primary px-5"
                  >
                    <IconSend />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
