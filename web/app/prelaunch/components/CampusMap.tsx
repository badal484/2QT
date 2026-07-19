'use client';
import { motion } from 'framer-motion';
import { useState } from 'react';

const CATEGORIES = [
  {
    id: 'colleges',
    emoji: '🎓',
    label: 'Colleges',
    color: '#22c55e',
    items: [
      "St. Xavier's College",
      "Mahendra Prasad Inter Mahila Mahavidyalaya",
      "Ranchi Women's College",
      "BIT Mesra Extension Centre (Lalpur)",
      "St. Aloysius Intermediate College",
      "Marwari College",
      "Maulana Azad College",
    ],
  },
  {
    id: 'jee',
    emoji: '📘',
    label: 'JEE / NEET / Foundation',
    color: '#3b82f6',
    items: [
      "Physics Wallah Vidyapeeth Lalpur",
      "Motion Education Ranchi",
      "Eternal Career Classes",
      "Mind Makers Coaching Institute",
      "Brothers Academy (Lalpur Branch)",
      "Ignite Classes",
      "Newton Tutorials",
      "Aim Entrance Institute",
    ],
  },
  {
    id: 'commerce',
    emoji: '📊',
    label: 'Commerce / CA / CUET',
    color: '#a855f7',
    items: [
      "Sukrishna Commerce Academy (RS Tower)",
      "Alpine Commerce Academy",
      "Chartered Commerce Classes",
      "Concepts Commerce Classes",
      "Analysis Classes (Lalpur)",
    ],
  },
  {
    id: 'govt',
    emoji: '🏛️',
    label: 'Govt Exam Coaching',
    color: '#f97316',
    items: [
      "Mishra Institute",
      "Axis Institute",
      "Bhavishya Bharti",
      "Mahendra's Institute Lalpur",
      "Chanakya IAS Academy",
      "Vision IAS",
      "Career Power",
    ],
  },
  {
    id: 'law',
    emoji: '⚖️',
    label: 'Law / MBA / CLAT',
    color: '#ec4899',
    items: [
      "LegalEdge by Toprankers (Lalpur)",
      "IMS Ranchi",
      "Career Launcher Ranchi",
    ],
  },
  {
    id: 'medical',
    emoji: '🏥',
    label: 'Medical (RIMS)',
    color: '#ef4444',
    items: [
      "RIMS Medical College (0.8 KM)",
      "RIMS Nursing College (0.9 KM)",
      "RIMS Dental College (1.0 KM)",
      "RIMS Paramedical Institute (1.1 KM)",
      "RIMS Boys' Hostels (1.2 KM)",
      "RIMS Girls' Hostels (1.3 KM)",
      "Resident Doctors & Interns",
    ],
  },
];

const SCHOOLS = [
  "St. Aloysius Intermediate College",
  "Guru Nanak Higher Secondary School",
  "DAV Schools (near your radius)",
  "Surendranath Centenary School",
  "St. Anne's School",
  "St. Thomas School",
];

const HOTSPOTS = [
  "Hari Om Tower", "RS Tower", "Nucleus Mall Area", "Lalpur Chowk",
  "Circular Road", "East Jail Road", "Peace Road", "P&T Colony",
  "Medical Chowk (RIMS)", "Pantaloons Junction",
];

// Pins: [label, color, top%, left%, align]
type Pin = { label: string; color: string; top: number; left: number; align: 'left' | 'right' };
const PINS: Pin[] = [
  { label: "St. Xavier's College",       color: '#22c55e', top: 6,  left: 48, align: 'right' },
  { label: "Mahendra Prasad College",    color: '#22c55e', top: 14, left: 18, align: 'right' },
  { label: "BIT Mesra (Lalpur)",         color: '#22c55e', top: 16, left: 57, align: 'right' },
  { label: "Ranchi Women's College",     color: '#22c55e', top: 20, left: 68, align: 'right' },
  { label: "St. Aloysius College",       color: '#22c55e', top: 30, left: 24, align: 'right' },
  { label: "Marwari College",            color: '#22c55e', top: 48, left: 10, align: 'right' },
  { label: "Physics Wallah Lalpur",      color: '#3b82f6', top: 30, left: 63, align: 'right' },
  { label: "Motion Education",           color: '#3b82f6', top: 42, left: 60, align: 'right' },
  { label: "Mind Makers",               color: '#3b82f6', top: 44, left: 18, align: 'right' },
  { label: "Eternal Career Classes",     color: '#3b82f6', top: 56, left: 20, align: 'right' },
  { label: "Sukrishna Commerce",         color: '#a855f7', top: 46, left: 70, align: 'right' },
  { label: "Alpine Commerce",            color: '#a855f7', top: 56, left: 66, align: 'right' },
  { label: "Concepts Commerce",          color: '#a855f7', top: 63, left: 70, align: 'right' },
  { label: "Axis Institute",             color: '#f97316', top: 60, left: 44, align: 'right' },
  { label: "Bhavishya Bharti",           color: '#f97316', top: 70, left: 36, align: 'right' },
  { label: "Maulana Azad College",       color: '#22c55e', top: 68, left: 20, align: 'right' },
  { label: "LegalEdge (Lalpur)",         color: '#ec4899', top: 72, left: 60, align: 'right' },
  { label: "IMS Ranchi",                color: '#ec4899', top: 80, left: 52, align: 'right' },
  { label: "Career Launcher",           color: '#ec4899', top: 83, left: 62, align: 'right' },
  { label: "RIMS Medical College",       color: '#ef4444', top: 10, left: 84, align: 'left' },
  { label: "RIMS Nursing College",       color: '#ef4444', top: 20, left: 84, align: 'left' },
  { label: "RIMS Dental College",        color: '#ef4444', top: 30, left: 84, align: 'left' },
  { label: "RIMS Paramedical",           color: '#ef4444', top: 40, left: 84, align: 'left' },
  { label: "RIMS Boys' Hostels",         color: '#ef4444', top: 50, left: 84, align: 'left' },
];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const } }),
};

export function CampusMap() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <section className="relative py-24 px-4 sm:px-6 overflow-hidden">
      {/* background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-brand-primary/10 rounded-full blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto relative z-10">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }} transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-primary/10 border border-brand-primary/20 text-brand-primary text-xs font-bold uppercase tracking-widest mb-5">
            📍 2QT in Lalpur
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-black text-white tracking-tight leading-tight mb-4">
            Built Around <span className="text-brand-primary">Students.</span>
          </h2>
          <p className="text-zinc-400 text-lg font-medium max-w-xl mx-auto">
            From classrooms to cafés, hostels to coaching hubs — 2QT is everywhere you are.
          </p>
        </motion.div>

        {/* ── Map ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }} whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }} transition={{ duration: 0.8 }}
          className="relative mx-auto mb-16 rounded-3xl overflow-hidden border border-white/10 shadow-2xl"
          style={{ background: 'linear-gradient(135deg, #0a0a14 0%, #0f0f1a 100%)' }}
        >
          {/* map area */}
          <div className="relative w-full" style={{ paddingBottom: '68%' }}>

            {/* SVG concentric rings — perfect circles that never clip */}
            <svg
              className="absolute inset-0 w-full h-full pointer-events-none"
              viewBox="0 0 100 68"
              aria-hidden="true"
            >
              {[
                { r: 13, label: '1 KM' },
                { r: 23, label: '3 KM' },
                { r: 34, label: '5 KM' },
              ].map(({ r, label }) => (
                <g key={r}>
                  <circle
                    cx="47" cy="34" r={r}
                    fill="none"
                    stroke="rgba(255,255,255,0.10)"
                    strokeWidth="0.3"
                    strokeDasharray="2 1.5"
                  />
                  <text
                    x={47 + r * 0.707 + 0.5}
                    y={34 - r * 0.707 - 0.5}
                    fill="rgba(90,90,110,0.9)"
                    fontSize="2.2"
                    fontWeight="bold"
                    fontFamily="system-ui,sans-serif"
                  >
                    {label}
                  </text>
                </g>
              ))}
            </svg>

            {/* Center pin */}
            <div className="absolute -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center" style={{ left: '47%', top: '50%' }}>
              <motion.div
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                className="w-3 h-3 rounded-full bg-brand-primary shadow-[0_0_20px_rgba(255,90,31,0.8)] mb-1"
              />
              <div className="bg-brand-primary/90 backdrop-blur-sm text-white text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full whitespace-nowrap shadow-lg">
                LALPUR CHOWK
              </div>
            </div>

            {/* Map Pins */}
            {PINS.map((pin, i) => (
              <motion.div
                key={pin.label}
                initial={{ opacity: 0, scale: 0 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.04 + 0.5, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                className="absolute z-10 flex items-center gap-1 group cursor-default"
                style={{ top: `${pin.top}%`, left: `${pin.left}%`, transform: 'translate(-50%, -50%)' }}
              >
                {pin.align === 'left' && (
                  <span className="hidden sm:inline text-[9px] font-bold text-right max-w-[80px] leading-tight"
                    style={{ color: pin.color }}>
                    {pin.label}
                  </span>
                )}
                <div className="w-2 h-2 rounded-full flex-shrink-0 shadow-sm group-hover:scale-150 transition-transform"
                  style={{ backgroundColor: pin.color, boxShadow: `0 0 6px ${pin.color}80` }} />
                {pin.align === 'right' && (
                  <span className="hidden sm:inline text-[9px] font-bold max-w-[80px] leading-tight"
                    style={{ color: pin.color }}>
                    {pin.label}
                  </span>
                )}
              </motion.div>
            ))}

            {/* Bottom tagline */}
            <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-6 py-3 px-4 border-t border-white/5 bg-black/40 backdrop-blur-sm">
              {[
                { icon: '🚫', text: 'No Platform Fee' },
                { icon: '⭐', text: 'Quality First' },
                { icon: '❤️', text: 'Made for Students' },
              ].map(t => (
                <div key={t.text} className="flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-zinc-300">
                  <span>{t.icon}</span> {t.text}
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* ── Category Cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
          {CATEGORIES.map((cat, i) => (
            <motion.div
              key={cat.id}
              custom={i} variants={fadeUp} initial="hidden" whileInView="show"
              viewport={{ once: true }}
              onClick={() => setActive(active === cat.id ? null : cat.id)}
              className="rounded-2xl border cursor-pointer transition-all duration-300 overflow-hidden"
              style={{
                borderColor: active === cat.id ? cat.color + '60' : 'rgba(255,255,255,0.06)',
                background: active === cat.id ? cat.color + '12' : 'rgba(255,255,255,0.02)',
              }}
            >
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl">{cat.emoji}</span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full"
                    style={{ background: cat.color + '20', color: cat.color }}>
                    {cat.items.length}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-white leading-tight">{cat.label}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5 font-medium">
                  {active === cat.id ? 'Tap to collapse' : 'Tap to expand'}
                </p>
              </div>

              {active === cat.id && (
                <motion.ul
                  initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-4 pb-4 space-y-1.5 border-t"
                  style={{ borderColor: cat.color + '30' }}
                >
                  {cat.items.map(item => (
                    <li key={item} className="flex items-start gap-2 text-[11px] font-medium text-zinc-300">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: cat.color }} />
                      {item}
                    </li>
                  ))}
                </motion.ul>
              )}
            </motion.div>
          ))}
        </div>

        {/* ── Schools + Hotspots ── */}
        <div className="grid sm:grid-cols-2 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.5 }}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🏫</span>
              <div>
                <p className="text-sm font-black text-white">Schools</p>
                <p className="text-[10px] text-zinc-500 font-medium">11th–12th Focus</p>
              </div>
            </div>
            <ul className="space-y-2">
              {SCHOOLS.map(s => (
                <li key={s} className="flex items-start gap-2 text-[11px] font-medium text-zinc-300">
                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }} transition={{ duration: 0.5, delay: 0.1 }}
            className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5"
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">📍</span>
              <div>
                <p className="text-sm font-black text-white">Student Hotspots</p>
                <p className="text-[10px] text-zinc-500 font-medium">Where students hang out</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {HOTSPOTS.map(h => (
                <span key={h} className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-zinc-300">
                  {h}
                </span>
              ))}
            </div>
          </motion.div>
        </div>

      </div>
    </section>
  );
}
