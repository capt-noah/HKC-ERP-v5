import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, ChevronRight, Star, ArrowRight, CheckCircle2,
  Zap, Shield, Globe, Cpu, Users
} from 'lucide-react';

interface TemplatesProps {
  onNotify: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export default function PageTemplates({ onNotify }: TemplatesProps) {
  const [activeHeroTab, setActiveHeroTab] = useState<'perf' | 'sec' | 'scale'>('perf');
  const [testimonialIndex, setTestimonialIndex] = useState(0);

  const heroTabs = [
    { 
      id: 'perf' as const, 
      label: 'Performance', 
      title: 'Blazing Fast Standard Execution',
      desc: 'Optimized server-side hydration cycles ensuring 100ms first contentful paint averages globally.',
      stat: '99.8%',
      statLabel: 'Lighthouse Score'
    },
    { 
      id: 'sec' as const, 
      label: 'Security', 
      title: 'Hardened Threat Insulation',
      desc: 'Built-in defense protocols against database injections, automated scanning bots, and DDoS triggers.',
      stat: '256-bit',
      statLabel: 'AES Hardening'
    },
    { 
      id: 'scale' as const, 
      label: 'Scalability', 
      title: 'Elastic Node Distribution',
      desc: 'Dynamically scale static serverless assets across 45 edge regions with instant cold start bypass.',
      stat: '1.2B+',
      statLabel: 'Requests Managed'
    }
  ];

  const testimonials = [
    {
      quote: "Using this React boilerplate allowed our engineering team to completely skip the foundational layout stage and launch our SaaS platform weeks ahead of the scheduled roadmap. The responsive utility configurations are incredibly elegant.",
      author: "Evelyn Sterling",
      role: "VP of Product, CloudScale Inc.",
      rating: 5,
      avatar: "ES"
    },
    {
      quote: "The visual grid alignment, modern color weights, and complete lack of bloated CSS are exactly what senior developers look for in a Tailwind setup. It's clean, lightweight, and structured for infinite extension.",
      author: "Marcus Drake",
      role: "Lead Frontend Engineer, Veloce Lab",
      rating: 5,
      avatar: "MD"
    },
    {
      quote: "Outstanding typography paired with robust micro-interactions. The copyable component templates saved us countless hours during our prototype validation phase.",
      author: "Soraya Lin",
      role: "Founder, Zenith AI",
      rating: 5,
      avatar: "SL"
    }
  ];

  const nextTestimonial = () => {
    setTestimonialIndex((prev) => (prev + 1) % testimonials.length);
  };

  const prevTestimonial = () => {
    setTestimonialIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  const activeTabDetails = heroTabs.find(t => t.id === activeHeroTab)!;

  return (
    <div id="templates-section" className="py-16 bg-white space-y-24">
      
      {/* 1. Hero Showcase Block */}
      <div id="hero-showcase-template" className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-semibold uppercase tracking-wider mb-4">
            Template Block 01
          </span>
          <h3 className="font-display font-semibold text-3xl md:text-4xl text-slate-900 tracking-tight">
            High-Converting Interactive Hero Grid
          </h3>
          <p className="text-slate-500 text-sm mt-2">
            A beautiful, balanced splitscreen layout containing dynamic state controls and structured call-to-actions.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center p-8 md:p-12 rounded-3xl border border-slate-100 bg-slate-50/40">
          
          {/* Left Column - Hero Pitch */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex gap-2 p-1 bg-white border border-slate-200/80 rounded-xl shadow-sm">
              {heroTabs.map((tab) => (
                <button
                  key={tab.id}
                  id={`hero-tab-${tab.id}`}
                  onClick={() => {
                    setActiveHeroTab(tab.id);
                    onNotify(`Switched feature highlight: ${tab.label}`, 'info');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    activeHeroTab === tab.id
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50/50'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeHeroTab}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <h1 className="font-display font-bold text-3xl md:text-4xl lg:text-5xl text-slate-900 tracking-tight leading-none">
                  {activeTabDetails.title}
                </h1>
                <p className="text-slate-500 text-sm md:text-base leading-relaxed max-w-lg">
                  {activeTabDetails.desc}
                </p>
              </motion.div>
            </AnimatePresence>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button 
                id="hero-template-cta"
                onClick={() => onNotify('Primary Hero call-to-action clicked!', 'success')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl shadow-md transition-all active:scale-[0.98]"
              >
                Start Free Trial
                <ArrowRight className="h-4 w-4" />
              </button>
              <button 
                id="hero-template-secondary"
                onClick={() => onNotify('Secondary Hero link clicked!', 'info')}
                className="inline-flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold rounded-xl transition-all"
              >
                Request Custom Demo
              </button>
            </div>
          </div>

          {/* Right Column - Stats Card Dashboard */}
          <div className="lg:col-span-5 bg-white border border-slate-100 shadow-xl rounded-2xl p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Metrics Engine</span>
              </div>
              <span className="text-xs font-mono text-slate-400">Live Simulation</span>
            </div>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeHeroTab}
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100/50 flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">{activeTabDetails.statLabel}</span>
                    <span className="block text-3xl font-black text-slate-950 mt-1 font-mono">{activeTabDetails.stat}</span>
                  </div>
                  <div className="h-12 w-12 rounded-lg bg-slate-900 text-white flex items-center justify-center">
                    {activeHeroTab === 'perf' ? <Zap className="h-5 w-5" /> : activeHeroTab === 'sec' ? <Shield className="h-5 w-5" /> : <Globe className="h-5 w-5" />}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold text-slate-500">
                    <span>Performance Threshold</span>
                    <span>Optimal</span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-slate-900 rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ width: activeHeroTab === 'perf' ? '98%' : activeHeroTab === 'sec' ? '85%' : '92%' }}
                      transition={{ duration: 0.6, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

              <div className="text-center pt-2">
                <span className="text-[10px] text-slate-400 leading-normal">
                  Toggle the category tabs to verify reactive dashboard state changes.
                </span>
              </div>
            </div>
          </div>

        </div>

      {/* 2. Bento Grid Features */}
      <div id="bento-grid-template" className="max-w-7xl mx-auto px-6">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-semibold uppercase tracking-wider mb-4">
            Template Block 02
          </span>
          <h3 className="font-display font-semibold text-3xl md:text-4xl text-slate-900 tracking-tight">
            Cohesive Responsive Bento Grid
          </h3>
          <p className="text-slate-500 text-sm mt-2">
            A beautiful high-contrast modular container showcase representing typical features, stats, or assets.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          
          {/* Bento Tile 1: Hero Large Tile */}
          <div className="md:col-span-8 p-8 bg-slate-900 text-white rounded-3xl border border-slate-950 flex flex-col justify-between min-h-[300px]">
            <div>
              <span className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider bg-white/15 text-white rounded-full">
                Core Engine
              </span>
              <h4 className="font-display font-semibold text-2xl mt-4 max-w-md">
                Pre-configured D3 & Recharts Integration out of the Box
              </h4>
              <p className="text-slate-400 text-sm mt-2 max-w-lg leading-relaxed">
                Connect data streams instantly. Designed with robust modular foundations allowing clean declarative rendering on high-density charts.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-6 pt-6 border-t border-white/10 text-xs text-slate-300">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Standardized Interfaces</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                <span>Zero Layout Jitter</span>
              </div>
            </div>
          </div>

          {/* Bento Tile 2: Side Highlight Tile */}
          <div className="md:col-span-4 p-8 bg-slate-50 border border-slate-100 hover:border-slate-200 rounded-3xl flex flex-col justify-between transition-colors">
            <div className="h-10 w-10 rounded-xl bg-white border border-slate-100 flex items-center justify-center text-slate-800 shadow-sm">
              <Cpu className="h-5 w-5 text-slate-700" />
            </div>
            <div className="mt-8">
              <h4 className="font-display font-semibold text-lg text-slate-900">Type-Safe Structure</h4>
              <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
                Strict compilation constraints protect component interactions from runtime exceptions.
              </p>
            </div>
          </div>

          {/* Bento Tile 3: Small Stats Tile */}
          <div className="md:col-span-4 p-8 bg-white border border-slate-100 hover:border-slate-200 rounded-3xl flex flex-col justify-between transition-colors shadow-sm">
            <div>
              <span className="block text-3xl font-extrabold text-slate-900 tracking-tight font-mono">100%</span>
              <span className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mt-1">Open Source License</span>
            </div>
            <p className="text-slate-500 text-xs mt-6 leading-relaxed">
              Apache 2.0 attribution structure for custom corporate integrations.
            </p>
          </div>

          {/* Bento Tile 4: Large Tech Grid */}
          <div className="md:col-span-8 p-8 bg-slate-50/50 border border-slate-100 hover:border-slate-200 rounded-3xl flex flex-col justify-between transition-colors">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              {[
                { title: "React 19 Hooks", desc: "Native optimized lifecycle", icon: Users },
                { title: "Tailwind v4", desc: "No configuration overhead", icon: Zap },
                { title: "Vite Bundler", desc: "Sub-second hot dev loading", icon: Cpu },
              ].map((tech, idx) => (
                <div key={idx} className="space-y-2">
                  <div className="h-8 w-8 rounded-lg bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                    <tech.icon className="h-4 w-4 text-slate-800" />
                  </div>
                  <h5 className="font-display font-bold text-slate-800 text-xs">{tech.title}</h5>
                  <p className="text-slate-400 text-[10px] leading-snug">{tech.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-slate-500 text-xs mt-8 pt-4 border-t border-slate-200/50">
              This system compiles clean production-ready static outputs stored completely in standard <code className="font-mono text-[10px] bg-slate-100 px-1 rounded">dist/</code> bundles.
            </p>
          </div>

        </div>
      </div>

      {/* 3. Testimonial Slider */}
      <div id="testimonial-slider-template" className="max-w-7xl mx-auto px-6">
        <div className="p-8 md:p-12 rounded-3xl border border-slate-100 bg-slate-50/20 max-w-4xl mx-auto">
          <div className="flex flex-col items-center text-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-semibold uppercase tracking-wider mb-6">
              Testimonial Slider
            </span>
            
            {/* Rating Stars */}
            <div className="flex items-center gap-1 text-green-600 mb-6">
              {[...Array(testimonials[testimonialIndex].rating)].map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
              ))}
            </div>

            <AnimatePresence mode="wait">
              <motion.blockquote
                key={testimonialIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="text-lg md:text-xl font-display text-slate-800 leading-relaxed font-medium mb-8 italic"
              >
                "{testimonials[testimonialIndex].quote}"
              </motion.blockquote>
            </AnimatePresence>

            {/* Author details */}
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold font-mono shadow">
                {testimonials[testimonialIndex].avatar}
              </div>
              <div className="text-left">
                <span className="block text-sm font-semibold text-slate-900">{testimonials[testimonialIndex].author}</span>
                <span className="block text-[11px] text-slate-400 font-medium">{testimonials[testimonialIndex].role}</span>
              </div>
            </div>

            {/* Carousel navigation controls */}
            <div className="flex items-center gap-2">
              <button
                id="btn-prev-testimonial"
                onClick={() => {
                  prevTestimonial();
                  onNotify('Previous testimonial loaded', 'info');
                }}
                className="h-9 w-9 rounded-full border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-all active:scale-90 shadow-sm"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-semibold text-slate-400 font-mono">
                {testimonialIndex + 1} / {testimonials.length}
              </span>
              <button
                id="btn-next-testimonial"
                onClick={() => {
                  nextTestimonial();
                  onNotify('Next testimonial loaded', 'info');
                }}
                className="h-9 w-9 rounded-full border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-600 flex items-center justify-center transition-all active:scale-90 shadow-sm"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

          </div>
        </div>
      </div>

    </div>
  );
}
