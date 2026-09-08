import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { motion, useInView } from 'framer-motion'
import { ThemeToggle } from '@/components/ThemeToggle'
import {
  BotIcon,
  FreeIcon,
  BrainIcon,
  LightningIcon,
  GlobeIcon,
  ChatIcon,
  CheckIcon,
  ArrowRightIcon,
  PlayIcon,
  SmileIcon,
  BangladeshIcon,
  SparkleIcon,
  ArrowUpRightIcon,
  DiamondIcon,
  DotIcon,
  BarChart3Icon,
  PlugIcon,
  ShieldIcon,
  DaddyAILogo,
} from '@/components/icons'

export const Route = createFileRoute('/')({ component: LandingPage })

// ── Motion keyframes — injected once ──────────────────────────────────────
const KEYFRAMES = `
@keyframes dotBounce {
  0%,100% { transform:translateY(0); opacity:.45; }
  50%      { transform:translateY(-5px); opacity:1; }
}
@keyframes heroFadeUp {
  from { opacity:0; transform:translateY(22px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes floatPhone {
  0%,100% { transform:rotate(1.5deg) translateY(0); }
  50%      { transform:rotate(-1deg) translateY(-12px); }
}
@keyframes glowPulse {
  0%,100% { transform:scale(.88); opacity:.55; }
  50%      { transform:scale(1.1); opacity:.95; }
}
@keyframes dashOrb {
  0%,100% { opacity:.18; }
  50%      { opacity:.35; }
}
@keyframes revealUp {
  from { opacity:0; transform:translateY(28px); }
  to   { opacity:1; transform:translateY(0); }
}
@keyframes revealLeft {
  from { opacity:0; transform:translateX(-24px); }
  to   { opacity:1; transform:translateX(0); }
}
@keyframes countUp {
  from { opacity:0; transform:translateY(12px) scale(.94); }
  to   { opacity:1; transform:translateY(0) scale(1); }
}
@keyframes leadBounce {
  0%   { transform:scale(.85); opacity:0; }
  60%  { transform:scale(1.05); }
  100% { transform:scale(1);   opacity:1; }
}
@keyframes marqueeScroll {
  from { transform:translateX(0); }
  to   { transform:translateX(-50%); }
}
@keyframes headerShine {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
@keyframes shimmerSlide {
  0%   { transform:translateX(-100%); }
  100% { transform:translateX(250%); }
}
@media (prefers-reduced-motion: reduce) {
  *,*::before,*::after {
    animation-duration:.01ms!important;
    animation-iteration-count:1!important;
    transition-duration:.01ms!important;
  }
}
`

// ── AI bot SVG — imported from shared icons ────────────────────────────────
// (BotIcon now lives in src/components/icons/index.tsx)

// ── Scroll-reveal hook ────────────────────────────────────────────────────
function useReveal(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mq.matches) { setVisible(true); return }

    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); obs.disconnect() } },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])

  return { ref, visible }
}

// ── LandingPage ───────────────────────────────────────────────────────────
function LandingPage() {
  // Inject keyframes once
  useEffect(() => {
    if (typeof document === 'undefined') return
    if (document.getElementById('dai-kf')) return
    const s = document.createElement('style')
    s.id = 'dai-kf'
    s.textContent = KEYFRAMES
    document.head.appendChild(s)
  }, [])

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col overflow-x-hidden">
      <div className="noise" />

      {/* ── NAV (b.ai-style: sliding + shimmer) ─────────────────────────── */}
      <header className="fixed top-0 inset-x-0 z-50 flex flex-col">
        {/* Shimmer gradient bar — shining sweep across the top */}
        <div className="h-[3px] w-full overflow-hidden relative"
             style={{ background: 'linear-gradient(90deg, transparent, var(--primary), transparent)', backgroundSize: '200% 100%', animation: 'headerShine 3.5s linear infinite' }} />

        {/* Model marquee — sliding strip like b.ai top header */}
        <div className="relative overflow-hidden border-b border-primary/8 bg-background/95 backdrop-blur-xl">
          <div className="flex w-max animate-[marqueeScroll_28s_linear_infinite] gap-8 py-2 text-[11px] font-medium text-muted-foreground select-none">
            {[ ...Array(2) ].map((_, dup) => (
              <div key={dup} className="flex shrink-0 items-center gap-8">
                {[
                  { label: 'Qwen 3.8 27B', Icon: FreeIcon },
                  { label: 'DeepSeek V4 Flash', Icon: FreeIcon },
                  { label: 'Hunyuan Large 3', Icon: FreeIcon },
                  { label: 'Gemini 3.6 Flash', Icon: BrainIcon },
                  { label: 'Real-time Replies', Icon: LightningIcon },
                  { label: 'Bangla · Banglish · English', Icon: GlobeIcon },
                  { label: 'Messenger · WhatsApp · Instagram', Icon: ChatIcon },
                  { label: '24/7 AI Sales Agent', Icon: BotIcon },
                ].map(({ label, Icon }) => (
                  <span key={label} className="flex items-center gap-1.5 whitespace-nowrap">
                    <Icon size={13} className="text-primary" />
                    {label}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between px-5 md:px-10 h-14 bg-background/80 backdrop-blur-xl relative">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-bold text-base tracking-tight select-none relative overflow-hidden">
            <DaddyAILogo size={26} />
            <span>Daddy<span style={{ color: 'var(--primary)' }}>AI</span></span>
            {/* shine sweep over logo */}
            <span className="pointer-events-none absolute inset-y-0 w-16 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                  style={{ animation: 'shimmerSlide 3s ease-in-out infinite' }} />
          </Link>

          <nav className="hidden md:flex items-center gap-0.5 text-sm text-muted-foreground">
            {[
              ['Features','#features'],
              ['Use Cases','#live-inbox'],
              ['How it works','#how-it-works'],
              ['About','#about'],
            ].map(([label, href]) => (
              <a key={label} href={href}
                 className="px-3 py-2 rounded-lg hover:text-foreground hover:bg-accent/40
                            transition-colors duration-150">
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link to="/auth"
                  className="hidden sm:inline-flex px-4 py-2 rounded-full text-sm font-medium
                             border border-primary/25 text-foreground
                             hover:bg-primary/6 transition-colors duration-150">
              Log in
            </Link>
            <Link to="/signup"
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full
                             text-sm font-bold text-[hsl(150_60%_2%)]
                             transition-all duration-200 relative overflow-hidden
                             hover:brightness-110 hover:scale-[1.03] active:scale-[.97]"
                  style={{ background: 'var(--primary)', boxShadow: '0 0 22px color-mix(in srgb, var(--primary) 35%, transparent)' }}>
              <span className="pointer-events-none absolute inset-y-0 w-10 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                    style={{ animation: 'shimmerSlide 2.8s ease-in-out infinite' }} />
              Get Started Free <span>→</span>
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      {/* Scene intent: establish product identity → copyread → visual proof */}
      <section className="relative overflow-hidden pt-28 pb-16 md:pt-36 md:pb-24 px-5 md:px-10">
        {/* Ambient orbs — slow pulse, no distraction */}
        <div className="pointer-events-none absolute -top-48 left-1/2 -translate-x-1/2
                        h-[500px] w-[750px] rounded-full blur-[150px]"
             style={{ background: 'radial-gradient(circle, color-mix(in srgb, var(--primary) 14%, transparent) 0%, rgba(32,216,120,.06) 50%, transparent 70%)',
                      animation: 'dashOrb 6s ease-in-out infinite' }} />
        <div className="pointer-events-none absolute top-1/2 -right-20 h-72 w-72 rounded-full blur-[110px]"
             style={{ background: 'rgba(32,216,120,.08)', animation: 'dashOrb 8s ease-in-out infinite 2s' }} />
        <div className="sd-grid-bg pointer-events-none absolute inset-0 opacity-40" />

        <div className="relative max-w-7xl mx-auto grid md:grid-cols-[1fr_1.05fr] gap-10 lg:gap-16 items-center">

          {/* ── Left copy — hero choreography:
              pill (0s) → h1 (80ms) → body (200ms) → CTA (360ms) → trust (480ms)
              Each: opacity 0→1, translateY 22→0, ease-out 500ms          ── */}
          <div className="space-y-6">
            <div style={{ animation: 'heroFadeUp 0.55s cubic-bezier(0,0,.2,1) both' }}>
              <div className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5
                              text-sm font-medium
                              border-primary/28 bg-primary/7
                              text-primary">
                <BangladeshIcon size={16} /> &nbsp; Built for Bangladeshi businesses
              </div>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-[3.5rem] xl:text-[4rem]
                           font-black tracking-tight leading-[1.06]
                           text-foreground"
                style={{ animation: 'heroFadeUp 0.55s cubic-bezier(0,0,.2,1) .08s both' }}>
              AI Sales Agent<br />
              for your{' '}
              <span className="sd-animated-gradient-text">
                Facebook &amp;<br className="hidden sm:block" />WhatsApp shop
              </span>
            </h1>

            <p className="text-base sm:text-lg text-muted-foreground leading-[1.75] max-w-[520px]"
               style={{ animation: 'heroFadeUp 0.55s cubic-bezier(0,0,.2,1) .2s both' }}>
              DaddyAI replies to customers 24/7 in Bangla, Banglish &amp; English —
              on Messenger, Instagram and WhatsApp. Auto-replies, vision AI for product
              photos, live inbox with priority queue.
            </p>

            <div className="flex flex-col sm:flex-row gap-3"
                 style={{ animation: 'heroFadeUp 0.55s cubic-bezier(0,0,.2,1) .36s both' }}>
              <Link to="/signup"
                    className="inline-flex items-center justify-center gap-2 px-7 py-3
                               rounded-full text-sm font-bold
                               text-[hsl(150_60%_2%)]
                               transition-all duration-200
                               hover:brightness-110 hover:shadow-xl hover:scale-[1.03]
                               active:scale-[.97]"
                    style={{ background: 'var(--primary)', boxShadow: '0 0 32px color-mix(in srgb, var(--primary) 32%, transparent)' }}>
                Start for free <span>→</span>
              </Link>
              <a href="#live-inbox"
                 className="inline-flex items-center justify-center gap-2 px-7 py-3
                            rounded-full text-sm font-semibold
                            border border-primary/28
                            text-foreground
                            hover:bg-primary/6 transition-colors duration-150">
                See live demo <PlayIcon size={14} className="text-primary" />
              </a>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm"
                 style={{ animation: 'heroFadeUp 0.55s cubic-bezier(0,0,.2,1) .48s both' }}>
              {['No credit card', 'Easy setup', 'Cancel anytime', 'GDPR compliant'].map(t => (
                <span key={t} className="flex items-center gap-1 text-primary/90 font-medium"><CheckIcon size={13} /> {t}</span>
              ))}
            </div>
          </div>

          {/* ── Right visual — enters with slight delay after copy ── */}
          <motion.div className="relative flex flex-col gap-3 items-stretch"
               initial={{ opacity: 0, y: 34, scale: 0.97 }}
               animate={{ opacity: 1, y: 0, scale: 1 }}
               transition={{ duration: 0.7, delay: 0.3, ease: [0, 0, 0.2, 1] }}>

            {/* Dashboard mockup */}
            <div className="glass-panel rounded-2xl p-4 text-xs">
              <div className="flex gap-3">
                {/* Mini sidebar */}
                <div className="flex flex-col gap-1 text-muted-foreground min-w-[80px] shrink-0">
                  <div className="flex items-center gap-1 font-bold mb-2">
                    <DaddyAILogo size={16} />
                    <span className="text-foreground text-[11px]">Daddy<span className="text-primary">AI</span></span>
                  </div>
                  <span className="text-[9px] uppercase tracking-widest text-muted-foreground/50 mb-0.5">Overview</span>
                  {['Dashboard','Conversations','Leads','Automations','Analytics','Inbox'].map((item, i) => (
                    <span key={item} className={`py-0.5 text-[10px] ${i===0 ? 'text-primary font-semibold' : 'text-muted-foreground/70'}`}>
                      {item}
                    </span>
                  ))}
                </div>

                {/* Main panel */}
                <div className="flex-1 min-w-0 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-[13px] text-foreground">Dashboard</p>
                      <p className="text-[10px] text-muted-foreground">Overview</p>
                    </div>
                    <span className="text-[9px] border border-primary/20 rounded px-2 py-1 text-muted-foreground whitespace-nowrap">
                      This Week ⌄
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { label:'Total Conversations', val:'2,856', delta:'↑ 18.6%' },
                      { label:'New Leads',            val:'1,248', delta:'↑ 24.3%' },
                      { label:'Resolved',             val:'98%',   delta:'↑ 8.1%'  },
                      { label:'Response Time',        val:'1.2s',  delta:'↑ 25.4%' },
                    ].map(s => (
                      <div key={s.label} className="rounded-lg p-2 bg-primary/4 border border-primary/10">
                        <p className="text-[9px] text-muted-foreground leading-tight">{s.label}</p>
                        <p className="font-bold text-[12px] text-foreground mt-0.5">{s.val}</p>
                        <p className="text-[9px] text-primary">{s.delta}</p>
                      </div>
                    ))}
                  </div>

                  {/* Sparkline */}
                  <div className="rounded-lg p-2 bg-primary/4 border border-primary/10">
                    <p className="text-[9px] text-muted-foreground mb-1">
                      Conversations <span className="text-primary">2,856 ↑18.6%</span>
                    </p>
                    <svg viewBox="0 0 260 48" className="w-full h-8" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--primary)" stopOpacity=".28"/>
                          <stop offset="100%" stopColor="var(--primary)" stopOpacity="0"/>
                        </linearGradient>
                      </defs>
                      <path d="M0 42 C22 28 38 40 58 22 S88 38 110 16 S144 34 164 12 S194 30 214 8 S238 20 260 4"
                            fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round"/>
                      <path d="M0 42 C22 28 38 40 58 22 S88 38 110 16 S144 34 164 12 S194 30 214 8 S238 20 260 4 L260 48 L0 48Z"
                            fill="url(#sg)"/>
                    </svg>
                  </div>
                </div>
              </div>
            </div>

            {/* Chat card */}
            <div className="glass-panel rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-foreground">Raisa Islam</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                      style={{ background: 'color-mix(in srgb, var(--primary) 15%, transparent)', color: 'var(--primary)' }}>
                  Priority
                </span>
              </div>
              {[
                { side:'in',  text:'এই কুর্তিটা কি আছে? কত দাম?' },
                { side:'out', text:'জি আছে! দাম ৮৮৫৳। ডেলিভারি ৬০৳। ORDER লিখুন' },
                { side:'in',  text:'blue color ta ki available?' },
                { side:'out', text:'Blue available! S/M/L-e paben. Confirm korben?' },
              ].map((m, i) => (
                <div key={i} className={`flex ${m.side==='out' ? 'justify-end' : 'justify-start'}`}>
                  <span className={`max-w-[86%] px-3 py-2 rounded-2xl leading-snug text-[11px] ${
                    m.side==='out'
                      ? 'rounded-tr-none text-[hsl(150_60%_2%)]'
                      : 'bg-primary/9 border border-primary/15 rounded-tl-none text-foreground'
                  }`} style={m.side==='out' ? { background: 'var(--primary)' } : {}}>
                    {m.text}
                  </span>
                </div>
              ))}
            </div>

            {/* Bot icon card — signature element: SVG bot icon */}
            <div className="self-end glass-panel rounded-2xl p-3.5 w-16 h-16
                            flex items-center justify-center text-primary
                            shadow-[0_0_40px_color-mix(in srgb, var(--primary) 22%, transparent)]">
              <BotIcon size={36} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── FEATURE STRIP ────────────────────────────────────────────────── */}
      <FeatureStrip />

      {/* ── LIVE INBOX ───────────────────────────────────────────────────── */}
      <LiveInbox />

      {/* ── HOW IT WORKS ─────────────────────────────────────────────────── */}
      <HowItWorks />

      {/* ── METRICS ──────────────────────────────────────────────────────── */}
      <MetricsBar />

      {/* ── CTA ──────────────────────────────────────────────────────────── */}
      <CtaSection />

      {/* ── FOOTER ───────────────────────────────────────────────────────── */}
      <SiteFooter />
    </div>
  )
}

// ── Feature Strip ─────────────────────────────────────────────────────────
// Scroll-triggered stagger: container reveals, then cards at 70ms intervals
function FeatureStrip() {
  const { ref, visible } = useReveal(0.12)

  const features = [
    { icon: <GlobeIcon size={20} />, title: 'Multi-Channel',      desc: 'Messenger, Instagram and WhatsApp from one unified inbox.' },
    { icon: <BotIcon size={20} />, title: 'AI Responses',        desc: 'Smart replies in Bangla, Banglish & English that convert.' },
    { icon: <LightningIcon size={20} />, title: 'Automation',          desc: 'Automate follow-ups, confirmations and FAQs — save hours.' },
    { icon: <BarChart3Icon size={20} />, title: 'Analytics',           desc: 'Track conversations, lead rates and response times live.' },
    { icon: <PlugIcon size={20} />, title: 'Integrations',        desc: 'bKash, Nagad, Shopify, WooCommerce and more.' },
    { icon: <ShieldIcon size={20} />, title: 'Secure & Compliant',  desc: 'Enterprise-grade security, E2E encryption, GDPR ready.' },
  ]

  return (
    <section id="features" ref={ref}
             className="py-20 border-t border-primary/10 px-5 md:px-10">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12"
             style={visible ? { animation:'revealUp 0.55s cubic-bezier(0,0,.2,1) both' } : { opacity:0 }}>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-foreground">
            Everything your sales team needs,{' '}
            <span className="sd-animated-gradient-text">automated</span>
          </h2>
          <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-xl mx-auto">
            Built for Bangladeshi e-commerce — Bangla/Banglish, Facebook integration, bKash/Nagad ready.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f, i) => (
            <motion.div key={f.title}
                 initial={{ opacity: 0, y: 28 }}
                 whileInView={{ opacity: 1, y: 0 }}
                 viewport={{ once: true, margin: '-60px' }}
                 transition={{ duration: 0.5, delay: i * 0.08, ease: [0, 0, 0.2, 1] }}
                 className="group rounded-2xl p-6
                             border border-primary/12
                             bg-primary/3
                             transition-all duration-300
                             hover:-translate-y-1
                             hover:border-primary/32
                             hover:shadow-[0_12px_40px_color-mix(in srgb, var(--primary) 10%, transparent)]">
              <span className="inline-flex size-11 items-center justify-center rounded-xl text-lg
                               bg-primary/12 text-primary
                               transition-all duration-250
                               group-hover:bg-primary/22 group-hover:scale-110">
                {f.icon}
              </span>
              <h3 className="mt-4 font-bold text-base text-foreground tracking-tight">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Live Inbox ────────────────────────────────────────────────────────────
// Primary action: "customer message becomes qualified lead"
// Choreography: copy reveals left → phone floats in right → conversation plays sequentially
function LiveInbox() {
  const { ref: sectionRef, visible } = useReveal(0.1)

  return (
    <section id="live-inbox" ref={sectionRef}
             className="py-20 border-t border-primary/10 px-5 md:px-10">
      <div className="max-w-7xl mx-auto grid md:grid-cols-[1fr_1.1fr] gap-12 lg:gap-20 items-center">

        {/* Left copy */}
        <div className="space-y-6"
             style={visible
               ? { animation:'revealLeft 0.6s cubic-bezier(0,0,.2,1) both' }
               : { opacity:0 }}>
          <span className="text-xs font-black tracking-[0.22em] text-primary uppercase">Live Inbox</span>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-foreground leading-[1.08]">
            Every message.<br />
            <em className="not-italic text-primary">Handled instantly.</em>
          </h2>
          <p className="text-base text-muted-foreground leading-[1.75] max-w-md">
            Watch DaddyAI understand a customer, respond naturally, detect buying intent
            and turn the conversation into a qualified lead — in under two seconds.
          </p>
          <div className="space-y-3 pt-1">
            {[
              { n:'01', label:'Customer sends a message' },
              { n:'02', label:'AI understands intent & replies' },
              { n:'03', label:'Lead qualified automatically' },
            ].map((s, i) => (
              <div key={s.n}
                   style={visible
                     ? { animation:`revealLeft 0.5s cubic-bezier(0,0,.2,1) ${300 + i*80}ms both` }
                     : { opacity:0 }}
                   className="flex items-center gap-3 text-sm">
                <span className="font-black text-primary w-6 shrink-0">{s.n}</span>
                <div className="h-px flex-1 bg-primary/15" />
                <span className="font-semibold text-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Phone mockup — enters with slight delay after copy */}
        <PhoneMockup play={visible} />
      </div>
    </section>
  )
}

// ── PhoneMockup ───────────────────────────────────────────────────────────
// Primary action: "input becomes lead qualified" — sequential bubble reveal
// Timing: customer (0.4s) → AI (1.2s) → typing (2.0s) → customer2 (3.2s) → AI2 (4.0s) → lead (5.2s)
// Easing: ease-out (entrances), gentle spring for lead checkmark
function PhoneMockup({ play }: { play: boolean }) {
  const refs = {
    b1:  useRef<HTMLDivElement>(null),
    b2:  useRef<HTMLDivElement>(null),
    typ: useRef<HTMLDivElement>(null),
    b3:  useRef<HTMLDivElement>(null),
    b4:  useRef<HTMLDivElement>(null),
    led: useRef<HTMLDivElement>(null),
  }

  useEffect(() => {
    if (!play) return

    const schedule = [
      { ref: refs.b1,  delay: 400,  anim: 'revealUp 0.45s cubic-bezier(0,0,.2,1) both' },
      { ref: refs.b2,  delay: 1200, anim: 'revealUp 0.45s cubic-bezier(0,0,.2,1) both' },
      { ref: refs.typ, delay: 2000, anim: 'revealUp 0.35s cubic-bezier(0,0,.2,1) both' },
      { ref: refs.b3,  delay: 3200, anim: 'revealUp 0.45s cubic-bezier(0,0,.2,1) both' },
      { ref: refs.b4,  delay: 4000, anim: 'revealUp 0.45s cubic-bezier(0,0,.2,1) both' },
      // Lead: restrained bounce — cause→effect payoff, hold long enough to register
      { ref: refs.led, delay: 5200, anim: 'leadBounce 0.5s cubic-bezier(.34,1.56,.64,1) both' },
    ]

    const timers = schedule.map(({ ref, delay, anim }) =>
      setTimeout(() => {
        if (ref.current) ref.current.style.animation = anim
      }, delay)
    )

    // Hide typing dots after bubble 3 appears
    const hideTyping = setTimeout(() => {
      if (refs.typ.current) refs.typ.current.style.opacity = '0'
    }, 3100)

    return () => { timers.forEach(clearTimeout); clearTimeout(hideTyping) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play])

  const hidden: React.CSSProperties = { opacity: 0 }

  const dot = (delay: string): React.CSSProperties => ({
    display: 'inline-block', width: 5, height: 5,
    borderRadius: '50%', background: 'var(--muted-foreground)',
    animation: `dotBounce 1s ease-in-out infinite ${delay}`,
  })

  return (
    <div className="relative flex justify-center items-center py-8"
         style={play ? { animation:'revealUp 0.65s cubic-bezier(0,0,.2,1) .15s both' } : { opacity:0 }}>
      {/* Glow orb — ambient atmosphere, separate from content */}
      <div className="pointer-events-none absolute inset-[-50px] rounded-full"
           style={{
             background: 'radial-gradient(circle, color-mix(in srgb, var(--primary) 16%, transparent) 0%, transparent 65%)',
             animation: 'glowPulse 4s ease-in-out infinite',
             zIndex: 0,
           }} />

      {/* Phone frame */}
      <div className="relative z-10 glass-panel rounded-[2rem] w-72 overflow-hidden"
           style={{ animation: 'floatPhone 5s ease-in-out infinite' }}>

        {/* Status bar */}
        <div className="flex items-center justify-between px-5 py-3
                        border-b border-primary/12">
          <span className="text-muted-foreground text-base leading-none">‹</span>
          <span className="font-semibold text-sm text-foreground">DaddyAI Inbox</span>
          <span style={{ color: 'var(--primary)', fontSize: 9 }}>●</span>
        </div>

        {/* Chat profile */}
        <div className="flex items-center gap-3 px-4 py-3
                        border-b border-primary/8">
          <div className="size-9 rounded-full flex items-center justify-center
                          font-bold text-sm text-[hsl(150_60%_2%)]"
               style={{ background: 'var(--primary)' }}>R</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-foreground">Raisa Islam</p>
            <p className="text-[11px] text-muted-foreground">Messenger · Online</p>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0"
                style={{ background: 'color-mix(in srgb, var(--primary) 15%, transparent)', color: 'var(--primary)' }}>
            Priority
          </span>
        </div>

        {/* Conversation — min-height keeps phone stable as bubbles appear */}
        <div className="px-4 py-4 space-y-2.5 min-h-[290px]">

          <div ref={refs.b1} style={hidden}>
            <div className="flex justify-start">
              <div className="max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-tl-none text-xs
                              bg-primary/8 border border-primary/14
                              text-foreground leading-snug">
                এই টপসটা আছে?
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1 ml-1">10:42 AM</p>
          </div>

          <div ref={refs.b2} style={hidden}>
            <div className="flex justify-end">
              <div className="max-w-[86%] px-3.5 py-2.5 rounded-2xl rounded-tr-none text-[11px]
                              leading-snug"
                   style={{ background: 'var(--primary)', color: 'hsl(150 60% 2%)' }}>
                <strong className="text-[9px] opacity-55 block mb-0.5 uppercase tracking-wider">DaddyAI <LightningIcon size={10} /></strong>
                জি আছে! দাম ৮৮৫৳। ঢাকায় ডেলিভারি ৬০৳।
                <br /><span>অর্ডার করতে <b>ORDER</b> লিখুন</span>
              </div>
            </div>
          </div>

          <div ref={refs.typ} style={hidden}
               className="flex items-center gap-1 text-[11px] text-muted-foreground transition-opacity duration-300">
            <span style={dot('0s')} />
            <span style={dot('.15s')} />
            <span style={dot('.3s')} />
            <span className="ml-1.5">DaddyAI is typing</span>
          </div>

          <div ref={refs.b3} style={hidden}>
            <div className="flex justify-start">
              <div className="max-w-[80%] px-3.5 py-2.5 rounded-2xl rounded-tl-none text-xs
                              bg-primary/8 border border-primary/14
                              text-foreground leading-snug">
                Blue colour ta ki available?
              </div>
            </div>
          </div>

          <div ref={refs.b4} style={hidden}>
            <div className="flex justify-end">
              <div className="max-w-[86%] px-3.5 py-2.5 rounded-2xl rounded-tr-none text-[11px]
                              leading-snug"
                   style={{ background: 'var(--primary)', color: 'hsl(150 60% 2%)' }}>
                <strong className="text-[9px] opacity-55 block mb-0.5 uppercase tracking-wider">DaddyAI <LightningIcon size={10} /></strong>
                Blue colour available ache! Size S/M/L-e paben.
              </div>
            </div>
          </div>

          {/* Lead qualified — payoff beat. Restrained overshoot scale. Hold visible. */}
          <div ref={refs.led} style={hidden}>
            <div className="flex items-center gap-3 mt-3 px-3 py-2.5 rounded-xl
                            border border-primary/30
                            bg-primary/7">
              <span className="size-6 rounded-full flex items-center justify-center
                               text-[11px] font-black text-[hsl(150_60%_2%)] shrink-0"
                    style={{ background: 'var(--primary)' }}><CheckIcon size={13} /></span>
              <div className="flex-1 min-w-0">
                <p className="text-[9px] text-muted-foreground uppercase tracking-[0.12em]">AI Action</p>
                <p className="text-xs font-bold text-primary">Lead Qualified</p>
              </div>
              <span className="text-primary text-sm shrink-0">→</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── How It Works ──────────────────────────────────────────────────────────
// Steps stagger 80ms apart — they ARE a sequence, stagger justified
function HowItWorks() {
  const { ref, visible } = useReveal(0.12)

  const steps = [
    { n:'01', icon: <GlobeIcon size={24} />, title:'Connect',  desc:'Connect Facebook, WhatsApp, Instagram and your website in minutes.' },
    { n:'02', icon: <SparkleIcon size={24} />, title:'Train',    desc:'Add products, FAQs, policies and business information once.' },
    { n:'03', icon: <BotIcon size={24} />, title:'Automate', desc:'Let AI reply, qualify leads and support customers 24/7.' },
    { n:'04', icon: <ArrowUpRightIcon size={24} />, title:'Grow',     desc:'Track conversations, conversions and insights in real-time.' },
  ]

  return (
    <section id="how-it-works" ref={ref}
             className="py-20 border-t border-primary/10 px-5 md:px-10">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12"
             style={visible ? { animation:'revealUp 0.55s cubic-bezier(0,0,.2,1) both' } : { opacity:0 }}>
          <span className="text-xs font-black tracking-[0.22em] text-primary uppercase">How it works</span>
          <h2 className="mt-3 text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-foreground">
            Everything in one{' '}
            <em className="not-italic sd-animated-gradient-text">intelligent flow.</em>
          </h2>
          <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-xl mx-auto">
            Connect your channels, train your AI, automate conversations and turn more chats into customers.
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s, i) => (
            <div key={s.n}
                 style={visible
                   ? { animation:`revealUp 0.5s cubic-bezier(0,0,.2,1) ${i*80}ms both` }
                   : { opacity:0 }}
                 className="relative rounded-3xl p-7
                             border border-primary/12
                             bg-primary/3
                             transition-all duration-300
                             hover:-translate-y-1
                             hover:border-primary/30
                             hover:shadow-[0_12px_36px_color-mix(in srgb, var(--primary) 8%, transparent)]">
              <span className="absolute top-4 right-4 text-xs font-black text-primary/35">{s.n}</span>
              <div className="mb-4">{s.icon}</div>
              <h3 className="font-bold text-base text-foreground">{s.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── Metrics Bar ───────────────────────────────────────────────────────────
// Count-up feel: each number animates in with slight vertical offset
function MetricsBar() {
  const { ref, visible } = useReveal(0.2)

  const metrics = [
    { val:'5,000+', label:'Businesses trust DaddyAI' },
    { val:'10M+',   label:'Conversations automated'  },
    { val:'1.2s',   label:'Avg. response time'       },
    { val:'98%',    label:'Customer satisfaction'    },
  ]

  return (
    <section id="about" ref={ref}
             className="py-14 border-t border-primary/10 px-5 md:px-10
                        bg-primary/2">
      <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
        {metrics.map((m, i) => (
          <div key={m.label}
               style={visible
                 ? { animation:`countUp 0.55s cubic-bezier(0,0,.2,1) ${i*90}ms both` }
                 : { opacity:0 }}>
            <strong className="block text-3xl md:text-4xl font-black sd-animated-gradient-text">
              {m.val}
            </strong>
            <span className="block mt-2 text-sm text-muted-foreground">{m.label}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── CTA Section ───────────────────────────────────────────────────────────
function CtaSection() {
  const { ref, visible } = useReveal(0.15)

  return (
    <section ref={ref}
             className="py-24 border-t border-primary/10 px-5 md:px-10">
      <div className="max-w-3xl mx-auto relative rounded-[2rem] overflow-hidden
                      border border-primary/20 text-center px-8 md:px-14 py-16"
           style={{
             background: 'linear-gradient(145deg, var(--card), var(--background))',
             ...(visible ? { animation:'revealUp 0.6s cubic-bezier(0,0,.2,1) both' } : { opacity:0 }),
           }}>
        {/* Ambient glows — stay behind content */}
        <div className="pointer-events-none absolute -bottom-28 left-1/2 -translate-x-1/2
                        h-56 w-[440px] rounded-full blur-[110px] opacity-20"
             style={{ background: 'var(--primary)' }} />
        <div className="pointer-events-none absolute -top-14 left-1/3
                        h-28 w-56 rounded-full blur-[70px] opacity-10"
             style={{ background: 'var(--primary)' }} />

        <div className="relative space-y-6">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-black tracking-tight text-foreground">
            Ready to <em className="not-italic text-primary">grow</em> your business<br />with AI?
          </h2>
          <p className="text-base md:text-lg text-muted-foreground max-w-md mx-auto">
            Start automating conversations and convert more leads today.
          </p>
          <Link to="/signup"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full
                           text-sm font-bold text-[hsl(150_60%_2%)]
                           transition-all duration-200
                           hover:brightness-110 hover:shadow-2xl hover:scale-[1.04]
                           active:scale-[.97]"
                style={{ background: 'var(--primary)', boxShadow:'0 0 44px color-mix(in srgb, var(--primary) 42%, transparent)' }}>
            Start for free <span>→</span>
          </Link>
          <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap justify-center">
            <span className="flex items-center gap-1"><CheckIcon size={13} /> No credit card required</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="flex items-center gap-1"><CheckIcon size={13} /> Easy setup</span>
            <span className="text-muted-foreground/40">·</span>
            <span className="flex items-center gap-1"><CheckIcon size={13} /> Cancel anytime</span>
          </p>
        </div>
      </div>
    </section>
  )
}

// ── Footer ────────────────────────────────────────────────────────────────
function SiteFooter() {
  return (
    <footer className="border-t border-primary/10 bg-card/20 px-5 md:px-10 py-10">
      <div className="max-w-7xl mx-auto grid gap-10 md:grid-cols-4 mb-10">
        <div className="space-y-4">
          <div className="flex items-center gap-2 font-bold text-base">
            <DaddyAILogo size={22} />
            <span>Daddy<span style={{ color: 'var(--primary)' }}>AI</span></span>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
            AI sales agent for Bangladeshi businesses on Facebook, Instagram &amp; WhatsApp.
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary animate-pulse inline-block" />
            Dhaka, Bangladesh
          </div>
        </div>

        {[
          { heading:'Product', links:[
            { label:'Live Inbox',    href:'/admin/inbox' },
            { label:'Auto-Replies', href:'/admin/auto-replies' },
            { label:'Training',     href:'/admin/training' },
            { label:'Analytics',    href:'/admin/analytics' },
          ]},
          { heading:'Company', links:[
            { label:'Integrations', href:'/connect' },
            { label:'FAQ',          href:'/faq' },
            { label:'Admin',        href:'/admin' },
          ]},
          { heading:'Legal', links:[
            { label:'Privacy',      href:'/privacy' },
            { label:'Terms',        href:'/terms' },
            { label:'GDPR',         href:'/privacy-request' },
            { label:'Data Deletion',href:'/data-deletion' },
          ]},
        ].map(col => (
          <div key={col.heading}>
            <h3 className="text-xs font-bold uppercase tracking-[0.14em] mb-4 text-foreground">
              {col.heading}
            </h3>
            <div className="space-y-2.5">
              {col.links.map(l => (
                <Link key={l.label} to={l.href}
                      className="block text-sm text-muted-foreground hover:text-foreground
                                 transition-colors duration-150">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-primary/10 pt-7
                      flex flex-col sm:flex-row items-center justify-between
                      gap-4 text-xs text-muted-foreground">
        <span>© 2026 DaddyAI. All rights reserved.</span>
        <span>Privacy &nbsp;·&nbsp; Terms &nbsp;·&nbsp; GDPR</span>
      </div>
    </footer>
  )
}
