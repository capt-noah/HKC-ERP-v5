import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Copy, Check, Sparkles, Code, Eye, 
  ChevronRight, Upload, Sliders, CheckCircle
} from 'lucide-react';

interface ComponentShowcaseProps {
  onNotify: (msg: string, type?: 'success' | 'info' | 'warning') => void;
}

export default function ThemeShowcase({ onNotify }: ComponentShowcaseProps) {
  const [activeCategory, setActiveCategory] = useState<'all' | 'buttons' | 'cards' | 'forms' | 'data'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');

  // Input states
  const [emailInput, setEmailInput] = useState('');
  const [toggleState, setToggleState] = useState(false);
  const [accordionOpen, setAccordionOpen] = useState<string | null>('acc-1');

  // File Upload state
  const [dragOver, setDragOver] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);

  const handleCopy = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    onNotify('Boilerplate code copied to clipboard!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setUploadedFile(e.dataTransfer.files[0].name);
      onNotify(`File "${e.dataTransfer.files[0].name}" uploaded successfully!`, 'success');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setUploadedFile(e.target.files[0].name);
      onNotify(`File "${e.target.files[0].name}" uploaded successfully!`, 'success');
    }
  };

  const categories = [
    { id: 'all', label: 'All Elements' },
    { id: 'buttons', label: 'Buttons & Badges' },
    { id: 'cards', label: 'Cards & Layouts' },
    { id: 'forms', label: 'Forms & Upload' },
    { id: 'data', label: 'Data & Navigation' },
  ] as const;

  const componentsData = [
    {
      id: 'btn-primary',
      name: 'Primary Action Button',
      category: 'buttons' as const,
      description: 'The standard primary call-to-action button featuring smooth elevation scaling, focused outline ring, and active click responses.',
      classes: 'px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-xl shadow-md shadow-slate-950/10 hover:shadow-lg hover:shadow-slate-950/15 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 active:scale-[0.98] transition-all duration-200',
      code: `<button 
  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium rounded-xl shadow-md shadow-slate-950/10 hover:shadow-lg hover:shadow-slate-950/15 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 active:scale-[0.98] transition-all duration-200"
>
  Get Started Today
</button>`
    },
    {
      id: 'btn-secondary',
      name: 'Secondary Interactive Button',
      category: 'buttons' as const,
      description: 'A versatile border-based button ideal for secondary navigation, with a beautiful subtle background color transition on hover.',
      classes: 'px-5 py-2.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-200 active:scale-[0.98] transition-all duration-200',
      code: `<button 
  className="px-5 py-2.5 bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-200 active:scale-[0.98] transition-all duration-200"
>
  Learn More
</button>`
    },
    {
      id: 'badge-green',
      name: 'Status Pill / Badge',
      category: 'buttons' as const,
      description: 'An elegant status highlight badge pairing transparent background tints with high-contrast text and a central pulse indicator.',
      classes: 'inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 border border-green-200/60 text-green-800 text-xs font-semibold leading-none',
      code: `<div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-green-50 border border-green-200/60 text-green-800 text-xs font-semibold leading-none">
  <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
  Interactive Beta
</div>`
    },
    {
      id: 'card-bento',
      name: 'Bento Feature Card',
      category: 'cards' as const,
      description: 'A modern bento-style card showcasing balanced grid alignment, spacious typography, micro-borders, and subtle zoom-on-hover effect.',
      classes: 'group p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200/80 transition-all duration-300',
      code: `<div className="group p-6 bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-slate-200/80 transition-all duration-300">
  <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-800 group-hover:bg-slate-900 group-hover:text-white transition-all duration-300 mb-4">
    <Sparkles className="h-5 w-5" />
  </div>
  <h3 className="font-display font-semibold text-lg text-slate-900 mb-2">Automated Optimization</h3>
  <p className="text-sm text-slate-500 leading-relaxed">
    Dynamically scale resources and maximize execution efficiency with intelligent runtime routing.
  </p>
</div>`
    },
    {
      id: 'card-pricing',
      name: 'Premium Pricing Card',
      category: 'cards' as const,
      description: 'A fully responsive subscription layout including a highlighted focal badge, pricing details, and functional items list.',
      classes: 'relative p-8 bg-white border-2 border-slate-900 rounded-3xl shadow-lg',
      code: `<div className="relative p-8 bg-white border-2 border-slate-900 rounded-3xl shadow-lg">
  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-slate-900 text-white text-[11px] font-bold uppercase tracking-wider">
    Most Popular
  </div>
  <div className="mb-6">
    <h4 className="font-display font-medium text-slate-500 text-sm uppercase tracking-wider">Developer Pro</h4>
    <div className="mt-2 flex items-baseline gap-1.5">
      <span className="text-4xl font-extrabold text-slate-900">$49</span>
      <span className="text-slate-400 text-sm">/month</span>
    </div>
  </div>
  <ul className="space-y-3 mb-8">
    {[
      "Unlimited client projects",
      "Priority API developer queues",
      "Dedicated serverless instances",
      "24/7 technical chat support"
    ].map((feat) => (
      <li key={feat} className="flex items-start gap-2.5 text-sm text-slate-600">
        <CheckCircle className="h-4 w-4 text-slate-900 mt-0.5 flex-shrink-0" />
        <span>{feat}</span>
      </li>
    ))}
  </ul>
  <button className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl transition-colors">
    Upgrade to Pro
  </button>
</div>`
    },
    {
      id: 'form-input',
      name: 'Interactive Input & Validation',
      category: 'forms' as const,
      description: 'An optimized input group that responds interactively with validation feedback and smooth focus transitions.',
      classes: 'relative w-full',
      code: `<div className="space-y-1.5 w-full">
  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Email Address</label>
  <div className="relative">
    <input 
      type="email" 
      placeholder="you@domain.com"
      className="w-full px-4 py-3 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-slate-400 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-4 focus:ring-slate-100 transition-all duration-200" 
    />
  </div>
</div>`
    },
    {
      id: 'form-upload',
      name: 'Interactive File Dropzone',
      category: 'forms' as const,
      description: 'An interactive file upload interface supporting click-to-select and drag-and-drop actions, fully designed with custom progress states.',
      classes: 'w-full p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all duration-200',
      code: `<div className="w-full p-6 border-2 border-dashed border-slate-200 hover:border-slate-400 rounded-2xl flex flex-col items-center justify-center transition-all bg-slate-50/50 hover:bg-slate-50 cursor-pointer">
  <Upload className="h-8 w-8 text-slate-400 mb-3" />
  <span className="text-sm font-medium text-slate-700 mb-1">Drag and drop file here</span>
  <span className="text-xs text-slate-400">or click to browse your disk</span>
</div>`
    },
    {
      id: 'toggle-switch',
      name: 'Smooth Toggle Switch',
      category: 'forms' as const,
      description: 'A completely responsive slider toggle utilizing micro-interactions for active toggling states.',
      classes: 'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full transition-colors duration-200 ease-in-out',
      code: `<button 
  className={\`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out \${enabled ? 'bg-slate-900' : 'bg-slate-200'}\`}
>
  <span className={\`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out \${enabled ? 'translate-x-5' : 'translate-x-0'}\`} />
</button>`
    },
    {
      id: 'accordion-group',
      name: 'Interactive Disclosure Accordion',
      category: 'data' as const,
      description: 'Smooth collapsing disclosure component using CSS and state transitions, perfect for FAQs and structured documentation.',
      classes: 'w-full divide-y divide-slate-100 border border-slate-100 rounded-2xl bg-white overflow-hidden',
      code: `<div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl bg-white overflow-hidden">
  {[
    { id: '1', q: "How do I deploy this template?", a: "Simply export the code as a standard Vite + Tailwind project. All dependencies are configured natively in package.json." },
    { id: '2', q: "Is the layout optimized for mobile devices?", a: "Yes, every component utilizes mobile-first utility classes ensuring fluid responsiveness down to 320px screens." }
  ].map((item) => (
    <div key={item.id} className="group">
      <button className="w-full flex items-center justify-between p-4 text-left font-medium text-slate-800 hover:bg-slate-50/50">
        <span>{item.q}</span>
        <ChevronRight className="h-4 w-4 transform transition-transform group-hover:translate-x-0.5" />
      </button>
      <div className="p-4 pt-0 text-sm text-slate-500 leading-relaxed">
        {item.a}
      </div>
    </div>
  ))}
</div>`
    },
    {
      id: 'table-modern',
      name: 'Clean Team Table',
      category: 'data' as const,
      description: 'A highly structured data table including status rows, custom avatar badges, and action buttons tailored for admin screens.',
      classes: 'min-w-full divide-y divide-slate-100',
      code: `<div className="overflow-x-auto border border-slate-100 rounded-2xl">
  <table className="min-w-full divide-y divide-slate-100 bg-white">
    <thead className="bg-slate-50/70">
      <tr>
        <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Member</th>
        <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Role</th>
        <th className="px-6 py-3.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
      </tr>
    </thead>
    <tbody className="divide-y divide-slate-100">
      {[
        { name: "Albin Cole", email: "albin@domain.com", role: "UI Architect", status: "Active" },
        { name: "Sela Vance", email: "sela@domain.com", role: "DevOps Engineer", status: "Active" }
      ].map((user) => (
        <tr key={user.email} className="hover:bg-slate-50/30 transition-colors">
          <td className="px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-xs font-bold">{user.name.split(' ').map(n=>n[0]).join('')}</div>
              <div>
                <div className="text-sm font-medium text-slate-800">{user.name}</div>
                <div className="text-xs text-slate-400">{user.email}</div>
              </div>
            </div>
          </td>
          <td className="px-6 py-4 text-sm text-slate-500">{user.role}</td>
          <td className="px-6 py-4">
            <span className="inline-flex items-center gap-1 py-0.5 px-2.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200/50">
              {user.status}
            </span>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>`
    }
  ];

  const filteredComponents = activeCategory === 'all' 
    ? componentsData 
    : componentsData.filter(c => c.category === activeCategory);

  return (
    <div id="theme-showcase-section" className="py-12 bg-slate-50/40 border-y border-slate-100">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-900 text-white rounded-full">
                Interactive Block Library
              </span>
              <span className="text-slate-300">|</span>
              <div className="flex items-center gap-1 text-xs text-slate-500">
                <Sliders className="h-3.5 w-3.5 text-slate-400" />
                <span>Modular React Templates</span>
              </div>
            </div>
            <h2 className="font-display font-semibold text-3xl text-slate-900 tracking-tight">
              Interactive Component Boilerplate
            </h2>
            <p className="text-slate-500 text-sm mt-1 max-w-xl">
              Clean responsive UI components crafted entirely with Tailwind utility classes. Switch tabs, interact with states, and copy production-ready code.
            </p>
          </div>

          {/* Toggle View Mode */}
          <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl shadow-sm self-start md:self-auto">
            <button
              id="view-mode-preview"
              onClick={() => setViewMode('preview')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'preview' 
                  ? 'bg-slate-900 text-white shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Eye className="h-3.5 w-3.5" />
              Interactive Preview
            </button>
            <button
              id="view-mode-code"
              onClick={() => setViewMode('code')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'code' 
                  ? 'bg-slate-900 text-white shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Code className="h-3.5 w-3.5" />
              Source Code
            </button>
          </div>
        </div>

        {/* Category Selector */}
        <div className="flex flex-wrap items-center gap-1.5 mb-8 pb-4 border-b border-slate-100">
          {categories.map((cat) => (
            <button
              key={cat.id}
              id={`cat-tab-${cat.id}`}
              onClick={() => setActiveCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all ${
                activeCategory === cat.id
                  ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200/70 hover:border-slate-300 hover:text-slate-800'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Grid of Components */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {filteredComponents.map((comp) => (
            <div 
              key={comp.id} 
              id={`showcase-card-${comp.id}`}
              className="bg-white border border-slate-100 shadow-sm rounded-2xl flex flex-col overflow-hidden hover:border-slate-200 hover:shadow-md transition-all duration-300"
            >
              {/* Header */}
              <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4">
                <div>
                  <h3 className="font-display font-semibold text-slate-800 text-sm">{comp.name}</h3>
                  <p className="text-slate-400 text-[11px] font-mono uppercase tracking-wider">{comp.category}</p>
                </div>
                <button
                  id={`btn-copy-${comp.id}`}
                  onClick={() => handleCopy(comp.id, comp.code)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 text-slate-500 hover:text-slate-800 text-xs font-medium transition-all"
                >
                  {copiedId === comp.id ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-500" />
                      <span className="text-emerald-600 font-semibold">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 text-slate-400" />
                      <span>Copy Tailwind</span>
                    </>
                  )}
                </button>
              </div>

              {/* Content Canvas */}
              <div className="p-6 flex-grow flex flex-col justify-center bg-white min-h-[160px]">
                {viewMode === 'preview' ? (
                  <div className="flex items-center justify-center w-full">
                    {/* Render different items with appropriate simulated actions */}
                    {comp.id === 'btn-primary' && (
                      <button 
                        id="demo-btn-primary"
                        onClick={() => onNotify('Primary Action triggered!', 'info')}
                        className={comp.classes}
                      >
                        Get Started Today
                      </button>
                    )}

                    {comp.id === 'btn-secondary' && (
                      <button 
                        id="demo-btn-secondary"
                        onClick={() => onNotify('Secondary Action triggered!', 'info')}
                        className={comp.classes}
                      >
                        Learn More
                      </button>
                    )}

                    {comp.id === 'badge-green' && (
                      <div className={comp.classes}>
                        <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        Interactive Beta
                      </div>
                    )}

                    {comp.id === 'card-bento' && (
                      <div className={comp.classes}>
                        <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-800 group-hover:bg-slate-900 group-hover:text-white transition-all duration-300 mb-4">
                          <Sparkles className="h-5 w-5" />
                        </div>
                        <h3 className="font-display font-semibold text-lg text-slate-900 mb-2">Automated Optimization</h3>
                        <p className="text-sm text-slate-500 leading-relaxed">
                          Dynamically scale resources and maximize execution efficiency with intelligent runtime routing.
                        </p>
                      </div>
                    )}

                    {comp.id === 'card-pricing' && (
                      <div className="relative p-6 bg-white border border-slate-200 hover:border-slate-300 rounded-3xl shadow-sm transition-all duration-300 max-w-sm w-full">
                        <div className="mb-4">
                          <h4 className="font-display font-semibold text-slate-400 text-xs uppercase tracking-wider">Developer Pro</h4>
                          <div className="mt-1 flex items-baseline gap-1.5">
                            <span className="text-3xl font-extrabold text-slate-900">$49</span>
                            <span className="text-slate-400 text-xs">/month</span>
                          </div>
                        </div>
                        <ul className="space-y-2 mb-6">
                          {["Unlimited client projects", "Priority API queues", "Dedicated instances"].map((feat) => (
                            <li key={feat} className="flex items-start gap-2 text-xs text-slate-600">
                              <CheckCircle className="h-3.5 w-3.5 text-slate-900 mt-0.5 flex-shrink-0" />
                              <span>{feat}</span>
                            </li>
                          ))}
                        </ul>
                        <button 
                          id="pricing-card-btn-demo"
                          onClick={() => onNotify('Pricing option selected!', 'success')}
                          className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl transition-colors"
                        >
                          Upgrade to Pro
                        </button>
                      </div>
                    )}

                    {comp.id === 'form-input' && (
                      <form 
                        onSubmit={(e) => {
                          e.preventDefault();
                          if (!emailInput) return onNotify('Please enter an email address.', 'warning');
                          onNotify(`Mock sign-up complete for: ${emailInput}`, 'success');
                          setEmailInput('');
                        }}
                        className="space-y-3 w-full max-w-md"
                      >
                        <div className="space-y-1 w-full">
                          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider">Email Address</label>
                          <div className="relative flex gap-2">
                            <input 
                              type="email" 
                              value={emailInput}
                              onChange={(e) => setEmailInput(e.target.value)}
                              placeholder="you@domain.com"
                              className="flex-grow px-4 py-2.5 bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 focus:border-slate-400 rounded-xl text-sm text-slate-800 placeholder-slate-400 outline-none focus:ring-4 focus:ring-slate-100 transition-all duration-200" 
                            />
                            <button 
                              type="submit"
                              className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl"
                            >
                              Join
                            </button>
                          </div>
                        </div>
                      </form>
                    )}

                    {comp.id === 'form-upload' && (
                      <div className="w-full max-w-md">
                        <label 
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={handleDrop}
                          className={`w-full p-6 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all bg-slate-50/50 cursor-pointer ${
                            dragOver 
                              ? 'border-slate-800 bg-slate-100/80 scale-[1.02]' 
                              : 'border-slate-200 hover:border-slate-400 hover:bg-slate-50'
                          }`}
                        >
                          <Upload className="h-6 w-6 text-slate-400 mb-2" />
                          <span className="text-xs font-medium text-slate-700 mb-1">
                            {uploadedFile ? `Selected: ${uploadedFile}` : 'Drag and drop file here'}
                          </span>
                          <span className="text-[10px] text-slate-400">or click to browse disk</span>
                          <input type="file" onChange={handleFileChange} className="hidden" />
                        </label>
                        {uploadedFile && (
                          <div className="mt-2 flex items-center justify-between text-xs bg-slate-50 p-2 rounded-lg border border-slate-100">
                            <span className="truncate max-w-[200px] text-slate-600">{uploadedFile}</span>
                            <button onClick={() => setUploadedFile(null)} className="text-red-500 hover:text-red-600 font-semibold">Remove</button>
                          </div>
                        )}
                      </div>
                    )}

                    {comp.id === 'toggle-switch' && (
                      <div className="flex items-center gap-4">
                        <span className="text-xs font-semibold text-slate-600">Toggle Setting: {toggleState ? 'ENABLED' : 'DISABLED'}</span>
                        <button 
                          id="btn-toggle-switch-demo"
                          onClick={() => {
                            const next = !toggleState;
                            setToggleState(next);
                            onNotify(`Interactive toggle switched: ${next ? 'ON' : 'OFF'}`, 'info');
                          }}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out ${toggleState ? 'bg-slate-900' : 'bg-slate-200'}`}
                        >
                          <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${toggleState ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                      </div>
                    )}

                    {comp.id === 'accordion-group' && (
                      <div className="w-full divide-y divide-slate-100 border border-slate-100 rounded-2xl bg-white overflow-hidden shadow-sm">
                        {[
                          { id: 'acc-1', q: "How do I deploy this template?", a: "Simply build using 'npm run build' and deploy your high-performance static files stored inside the output 'dist/' folder." },
                          { id: 'acc-2', q: "Is the layout optimized for mobile devices?", a: "Yes, every component utilizes responsive grid systems and fluid padding classes, beautifully crafted to scale down to the narrowest viewports." }
                        ].map((item) => {
                          const isOpen = accordionOpen === item.id;
                          return (
                            <div key={item.id} className="group">
                              <button 
                                id={`acc-trigger-${item.id}`}
                                onClick={() => setAccordionOpen(isOpen ? null : item.id)}
                                className="w-full flex items-center justify-between p-4 text-left text-xs font-bold text-slate-700 hover:bg-slate-50/50 transition-colors"
                              >
                                <span>{item.q}</span>
                                <ChevronRight className={`h-4 w-4 transform transition-transform text-slate-400 ${isOpen ? 'rotate-90 text-slate-800' : 'group-hover:translate-x-0.5'}`} />
                              </button>
                              <AnimatePresence initial={false}>
                                {isOpen && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                  >
                                    <div id={`acc-content-${item.id}`} className="px-4 pb-4 text-xs text-slate-500 leading-relaxed">
                                      {item.a}
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {comp.id === 'table-modern' && (
                      <div className="overflow-x-auto border border-slate-100 rounded-xl w-full">
                        <table className="min-w-full divide-y divide-slate-100 bg-white">
                          <thead className="bg-slate-50/50">
                            <tr>
                              <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Member</th>
                              <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Role</th>
                              <th className="px-4 py-2.5 text-left text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {[
                              { name: "Albin Cole", email: "albin@domain.com", role: "UI Architect", initials: "AC" },
                              { name: "Sela Vance", email: "sela@domain.com", role: "Developer", initials: "SV" }
                            ].map((user) => (
                              <tr key={user.email} className="hover:bg-slate-50/30 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="flex items-center gap-2.5">
                                    <div className="h-6 w-6 rounded-full bg-slate-900 text-white flex items-center justify-center text-[9px] font-bold">{user.initials}</div>
                                    <div>
                                      <div className="text-xs font-semibold text-slate-700">{user.name}</div>
                                      <div className="text-[10px] text-slate-400">{user.email}</div>
                                    </div>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-500">{user.role}</td>
                                <td className="px-4 py-3">
                                  <span className="inline-flex items-center py-0.5 px-2 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100">
                                    Active
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="relative">
                    <pre className="p-4 bg-slate-900 text-slate-200 text-xs rounded-xl overflow-x-auto font-mono max-h-[180px]">
                      <code>{comp.code}</code>
                    </pre>
                  </div>
                )}
              </div>

              {/* Description Footer */}
              <div className="px-5 py-4 border-t border-slate-50 bg-slate-50/30">
                <p className="text-xs text-slate-500 leading-relaxed">{comp.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
