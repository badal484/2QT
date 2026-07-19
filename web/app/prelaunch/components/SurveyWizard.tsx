'use client';
import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export type SurveyData = Record<string, string | string[]>;

const OTHER = '__other__';

interface Question {
  id: string;
  title: string;
  subtitle?: string;
  type: 'radio' | 'radio-other' | 'checkbox' | 'checkbox-other' | 'text';
  options?: string[];
  maxSelect?: number;
  placeholder?: string;
  optional?: boolean;
  otherCount?: number; // how many custom text inputs to show for "Other"
}

const QUESTIONS: Question[] = [
  {
    id: 'mostOrderedDishes',
    title: 'Which dishes do you order most often?',
    subtitle: 'Select up to 5',
    type: 'checkbox-other',
    maxSelect: 5,
    otherCount: 5,
    options: ['Chicken Biryani', 'Veg Biryani', 'Fried Rice', 'Hakka Noodles', 'Chicken Roll', 'Paneer Roll', 'Burger', 'Pizza', 'Momos', 'Sandwich', 'Chole Bhature', 'Rajma Rice', 'Veg Thali', 'Chicken Thali', 'Dosa', 'Idli', 'Chow Mein', 'Pasta', 'Shawarma', 'Wraps', 'Pav Bhaji', 'Maggi', 'Cold Coffee', 'Milkshake', 'Brownie / Dessert'],
  },
  {
    id: 'personType',
    title: 'Which category best describes you?',
    type: 'radio-other',
    options: ['School Student (11th)', 'School Student (12th)', 'College Student', 'Coaching Student', 'Medical Student', 'Working Professional', 'Business Owner / Self-employed'],
  },
  {
    id: 'institution',
    title: 'Which school, college, coaching institute, company, or workplace are you associated with?',
    type: 'text',
    placeholder: 'e.g. BIT Lalpur, St. Xavier\'s College, RIMS, TCS, Own Business',
  },
  {
    id: 'orderFrequency',
    title: 'How often do you order food online?',
    type: 'radio',
    options: ['Never', 'Once a week', '2–3 times a week', '4–6 times a week', 'Daily'],
  },
  {
    id: 'spendPerOrder',
    title: 'How much do you usually spend on one food order?',
    type: 'radio',
    options: ['₹100–149', '₹150–199', '₹200–299', '₹300+'],
  },
  {
    id: 'cuisines',
    title: 'Which cuisines do you enjoy the most?',
    subtitle: 'Select up to 3',
    type: 'checkbox-other',
    maxSelect: 3,
    options: ['North Indian', 'Chinese', 'Biryani', 'Pizza', 'Burger', 'Rolls', 'Momos', 'Sandwiches', 'South Indian', 'Healthy Meals', 'Street Food', 'Fast Food', 'Desserts'],
  },
  {
    id: 'biggestProblems',
    title: 'What are the biggest problems you face while ordering food online?',
    subtitle: 'Select up to 3',
    type: 'checkbox-other',
    maxSelect: 3,
    options: ['Platform Fees', 'Slow Delivery', 'Food Arrives Cold', 'Bad Packaging', 'Poor Taste', 'Poor Food Quality', 'Hygiene Concerns', 'Limited Restaurant Options', 'Expensive Prices', 'Late-night Delivery Unavailable', 'Poor Customer Support', 'Order Mistakes'],
  },
  {
    id: 'orderTime',
    title: 'When do you usually order food?',
    subtitle: 'Select all that apply',
    type: 'checkbox',
    options: ['7:00–9:00 AM', '9:00–11:00 AM', '12:00–2:00 PM', '2:00–4:00 PM', '4:00–6:00 PM', '6:00–8:00 PM', '8:00–10:00 PM', 'After 10:00 PM'],
  },
  {
    id: 'waitTime',
    title: "What's the longest you're willing to wait for your food?",
    type: 'radio',
    options: ['Under 15 minutes', '15–20 minutes', '20–30 minutes', '30–45 minutes', 'More than 45 minutes'],
  },
  {
    id: 'priorities',
    title: 'What matters most to you when ordering food online?',
    subtitle: 'Select up to 3',
    type: 'checkbox',
    maxSelect: 3,
    options: ['Great Taste', 'Guaranteed Quality', 'Hot & Fresh Food', 'Hygiene', 'Fast Delivery', 'Fresh Ingredients', 'Good Packaging', 'Affordable Pricing', 'Brand Reputation'],
  },
  {
    id: 'likelyToTry',
    title: 'If a new food delivery app offered guaranteed quality, great taste, hot & fresh food, no platform fee, and fast delivery — how likely would you be to try it?',
    type: 'radio',
    options: ['Definitely', 'Probably', 'Maybe', 'Unlikely', 'No'],
  },
  {
    id: 'wishFeature',
    title: "Is there anything else you'd like to tell us?",
    subtitle: 'Share your food suggestions, app features, delivery expectations, offers you\'d like to see, or any other feedback.',
    type: 'text',
    placeholder: 'Your thoughts…',
    optional: true,
  },
];

function getOtherValues(qId: string, otherCount: number, inputs: Record<string, string>): string[] {
  if (otherCount <= 1) {
    const v = (inputs[qId] || '').trim();
    return v ? [v] : [];
  }
  const result: string[] = [];
  for (let i = 0; i < otherCount; i++) {
    const v = (inputs[`${qId}_${i}`] || '').trim();
    if (v) result.push(v);
  }
  return result;
}

export function SurveyWizard({ onComplete }: { onComplete: (data: SurveyData) => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [data, setData]               = useState<Record<string, string | string[]>>({});
  const [otherInputs, setOtherInputs] = useState<Record<string, string>>({});
  const [direction, setDirection]     = useState(1);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('2qt_survey_v2');
      if (saved) {
        const p = JSON.parse(saved);
        setData(p.data || {});
        setOtherInputs(p.otherInputs || {});
        setCurrentIndex(p.index || 0);
      }
    } catch {}
  }, []);

  useEffect(() => {
    sessionStorage.setItem('2qt_survey_v2', JSON.stringify({ data, otherInputs, index: currentIndex }));
  }, [data, otherInputs, currentIndex]);

  const q = QUESTIONS[currentIndex];
  const isLast = currentIndex === QUESTIONS.length - 1;
  const progress = ((currentIndex + 1) / QUESTIONS.length) * 100;
  const isRadioType = q.type === 'radio' || q.type === 'radio-other';
  const isCheckType = q.type === 'checkbox' || q.type === 'checkbox-other';
  const hasOther = q.type === 'radio-other' || q.type === 'checkbox-other';

  const checkArr: string[] = useMemo(() =>
    Array.isArray(data[q.id]) ? (data[q.id] as string[]) : [], [data, q.id]);
  const nonOtherCount = checkArr.filter(v => v !== OTHER).length;
  const otherSelected = isRadioType ? data[q.id] === OTHER : checkArr.includes(OTHER);

  const valid = useMemo(() => {
    const val = data[q.id];
    const other = (otherInputs[q.id] || '').trim();
    if (q.type === 'text') return q.optional || Boolean(String(val || '').trim());
    if (q.type === 'radio') return Boolean(val);
    if (q.type === 'radio-other') {
      if (!val) return false;
      return val === OTHER ? Boolean(other) : true;
    }
    // dish-picker mode: inputs at top, no OTHER sentinel needed
    if (q.type === 'checkbox-other' && (q.otherCount ?? 1) > 1) {
      const filledCustom = getOtherValues(q.id, q.otherCount!, otherInputs).length;
      return checkArr.length + filledCustom > 0;
    }
    if (checkArr.length === 0) return false;
    if (q.type === 'checkbox-other' && checkArr.includes(OTHER)) {
      const count = q.otherCount ?? 1;
      return getOtherValues(q.id, count, otherInputs).length > 0;
    }
    return true;
  }, [data, otherInputs, q, checkArr]);

  function buildData(snapshot: Record<string, string | string[]> = data): SurveyData {
    const result: SurveyData = {};
    for (const question of QUESTIONS) {
      const val = snapshot[question.id];
      const other = (otherInputs[question.id] || '').trim();
      if (question.type === 'text' || question.type === 'radio') {
        result[question.id] = String(val || '');
      } else if (question.type === 'radio-other') {
        result[question.id] = val === OTHER ? (other || '') : String(val || '');
      } else {
        const arr = Array.isArray(val) ? val : [];
        const count = question.otherCount ?? 1;
        if (count > 1) {
          // dish-picker: combine preset selections + custom typed dishes
          const presets = arr.filter(v => v !== OTHER);
          const customs = getOtherValues(question.id, count, otherInputs);
          result[question.id] = [...presets, ...customs];
        } else {
          const other = (otherInputs[question.id] || '').trim();
          result[question.id] = arr.map(v => v === OTHER ? (other ? `Other: ${other}` : 'Other') : v);
        }
      }
    }
    return result;
  }

  const next = () => {
    if (!valid) return;
    if (isLast) { onComplete(buildData()); return; }
    setDirection(1);
    setCurrentIndex(i => i + 1);
  };

  const back = () => {
    if (currentIndex === 0) return;
    setDirection(-1);
    setCurrentIndex(i => i - 1);
  };

  const pickRadio = (val: string) => {
    const updatedData = { ...data, [q.id]: val };
    setData(updatedData);
    if (val !== OTHER) {
      setTimeout(() => {
        if (isLast) {
          onComplete(buildData(updatedData));
        } else {
          setDirection(1);
          setCurrentIndex(i => i + 1);
        }
      }, 320);
    }
  };

  const toggleCheck = (val: string) => {
    setData(prev => {
      const cur = Array.isArray(prev[q.id]) ? (prev[q.id] as string[]) : [];
      if (cur.includes(val)) return { ...prev, [q.id]: cur.filter(v => v !== val) };
      if (q.maxSelect && val !== OTHER && cur.filter(v => v !== OTHER).length >= q.maxSelect) return prev;
      return { ...prev, [q.id]: [...cur, val] };
    });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && valid && (q.type === 'text' || (isRadioType && otherSelected))) next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentIndex, valid, otherSelected]);

  const variants = {
    enter:  (d: number) => ({ x: d > 0 ? 48 : -48, opacity: 0, filter: 'blur(4px)' }),
    center: { x: 0, opacity: 1, filter: 'blur(0px)' },
    exit:   (d: number) => ({ x: d < 0 ? 48 : -48, opacity: 0, filter: 'blur(4px)' }),
  };

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col" style={{ minHeight: '75vh' }}>
      
      {/* Glow ambient */}
      <div className="absolute top-0 right-1/4 w-40 h-40 bg-brand-primary/20 rounded-full blur-[80px] pointer-events-none -z-10"></div>

      {/* Progress */}
      <div className="mb-8 flex-shrink-0 relative z-10">
        <div className="flex items-center justify-between mb-4">
          <button onClick={back} aria-label="Back"
            className={cn('flex items-center justify-center w-10 h-10 rounded-full bg-white/5 border border-white/10 text-white hover:bg-white/10 hover:border-brand-primary/50 transition-colors shadow-[0_0_15px_rgba(255,90,31,0.1)]', currentIndex === 0 && 'opacity-0 pointer-events-none')}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold text-zinc-400 tracking-widest uppercase">
            Step {currentIndex + 1} <span className="text-zinc-500">/ {QUESTIONS.length}</span>
          </span>
          <div className="w-10" />
        </div>
        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden border border-white/5 shadow-inner">
          <motion.div
            className="h-full bg-gradient-to-r from-orange-500 to-orange-400 rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ type: 'spring', stiffness: 60, damping: 18 }}
          />
        </div>
      </div>

      {/* Question slide */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={currentIndex}
            custom={direction} variants={variants}
            initial="enter" animate="center" exit="exit"
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 flex flex-col"
          >
            {/* Title */}
            <div className="mb-6 flex-shrink-0 relative z-10">
              <h2 className="text-2xl md:text-3xl font-display font-bold text-white tracking-tight leading-snug drop-shadow-md">
                {q.title}
              </h2>
              {q.subtitle && (
                <p className="mt-2 text-sm text-zinc-400 font-medium">
                  {q.subtitle}{q.maxSelect ? ` (max ${q.maxSelect})` : ''}
                </p>
              )}
            </div>

            {/* TEXT */}
            {q.type === 'text' && (
              <div className="flex-1 overflow-y-auto pb-6 relative z-10">
                <input autoFocus type="text"
                  placeholder={q.placeholder}
                  value={String(data[q.id] || '')}
                  onChange={e => setData(prev => ({ ...prev, [q.id]: e.target.value }))}
                  className="w-full text-xl font-bold text-white bg-white/5 border-2 border-white/10 rounded-2xl py-4 px-6 placeholder:text-zinc-600 focus:bg-white/10 focus:border-brand-primary/60 hover:border-white/20 outline-none transition-all shadow-inner"
                />
                <p className="mt-3 text-xs font-semibold text-zinc-500 ml-2">
                  {q.optional ? 'Optional — press Enter ↵ to skip' : 'Press Enter ↵ to continue'}
                </p>
                <button onClick={next} disabled={!valid}
                  className="mt-6 w-full flex items-center justify-center gap-2 text-white px-7 py-4 rounded-full font-bold text-sm transition-all shadow-[0_0_20px_rgba(255,90,31,0.4)] hover:shadow-[0_0_30px_rgba(255,90,31,0.6)] disabled:opacity-40 disabled:pointer-events-none border border-brand-primary/50"
                  style={{ background: 'linear-gradient(135deg, #FF5A1F 0%, #FFA03A 100%)' }}>
                  {isLast ? 'Submit' : 'Continue'} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* RADIO */}
            {isRadioType && (
              <div className="flex-1 overflow-y-auto pb-6 flex flex-col gap-3 relative z-10 p-1">
                {q.options?.map(opt => {
                  const sel = data[q.id] === opt;
                  return (
                    <button key={opt} onClick={() => pickRadio(opt)}
                      className={cn('w-full text-left px-5 sm:px-6 py-3.5 sm:py-4 rounded-2xl border-2 transition-all flex items-center justify-between group select-none backdrop-blur-xl',
                        sel ? 'border-brand-primary/60 bg-brand-primary/20 shadow-[0_0_15px_rgba(255,90,31,0.3)]'
                            : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 shadow-sm')}>
                      <span className={cn("text-sm md:text-base font-bold transition-colors", sel ? "text-white" : "text-zinc-300")}>{opt}</span>
                      <span className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                        sel ? 'border-brand-primary bg-brand-primary text-white shadow-[0_0_10px_rgba(255,90,31,0.5)]' : 'border-white/20 group-hover:border-white/40')}>
                        {sel && <div className="w-2 h-2 rounded-full bg-white" />}
                      </span>
                    </button>
                  );
                })}
                {hasOther && (
                  <>
                    <button onClick={() => pickRadio(OTHER)}
                      className={cn('w-full text-left px-5 sm:px-6 py-3.5 sm:py-4 rounded-2xl border-2 transition-all flex items-center justify-between group select-none backdrop-blur-xl',
                        otherSelected ? 'border-brand-primary/60 bg-brand-primary/20 shadow-[0_0_15px_rgba(255,90,31,0.3)]'
                                      : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 shadow-sm')}>
                      <span className={cn("text-sm md:text-base font-bold transition-colors", otherSelected ? "text-white" : "text-zinc-300")}>Other (Please specify)</span>
                      <span className={cn('w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                        otherSelected ? 'border-brand-primary bg-brand-primary text-white shadow-[0_0_10px_rgba(255,90,31,0.5)]' : 'border-white/20 group-hover:border-white/40')}>
                        {otherSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                      </span>
                    </button>
                    {otherSelected && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2">
                        <input autoFocus type="text" placeholder="Please specify…"
                          value={otherInputs[q.id] || ''}
                          onChange={e => setOtherInputs(prev => ({ ...prev, [q.id]: e.target.value }))}
                          className="w-full bg-white/5 border-2 border-white/10 rounded-2xl px-6 py-4 text-white text-sm font-bold outline-none focus:bg-white/10 focus:border-brand-primary/60 hover:border-white/20 transition-colors placeholder:text-zinc-600 shadow-inner"
                        />
                      </motion.div>
                    )}
                    {otherSelected && (
                      <button onClick={next} disabled={!valid}
                        className="mt-2 w-full flex items-center justify-center gap-2 text-white px-6 py-4 rounded-full font-bold text-sm transition-all shadow-[0_0_20px_rgba(255,90,31,0.4)] hover:shadow-[0_0_30px_rgba(255,90,31,0.6)] disabled:opacity-40 disabled:pointer-events-none border border-brand-primary/50"
                        style={{ background: 'linear-gradient(135deg, #FF5A1F 0%, #FFA03A 100%)' }}>
                        {isLast ? 'Submit' : 'Continue'} <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* CHECKBOX */}
            {isCheckType && (
              <div className="flex-1 flex flex-col min-h-0 relative z-10">
                <div className="flex-1 overflow-y-auto flex flex-col gap-3 pb-4 min-h-0 p-1">

                  {/* dish-picker mode: custom inputs at top, presets below */}
                  {hasOther && (q.otherCount ?? 1) > 1 ? (() => {
                    const filledCustom = getOtherValues(q.id, q.otherCount!, otherInputs).length;
                    const totalSelected = nonOtherCount + filledCustom;
                    const customSlots = Math.max(1, Math.min(q.otherCount!, (q.maxSelect ?? q.otherCount!) - nonOtherCount));
                    return (
                      <>
                        {/* Custom write-in inputs */}
                        <div className="space-y-2 mb-1">
                          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest px-1">Type what you want</p>
                          {Array.from({ length: customSlots }).map((_, i) => (
                            <input key={i} autoFocus={i === 0}
                              type="text"
                              placeholder={i === 0 ? 'e.g. Dal Makhani' : `Dish ${i + 1} (optional)`}
                              value={otherInputs[`${q.id}_${i}`] || ''}
                              onChange={e => setOtherInputs(prev => ({ ...prev, [`${q.id}_${i}`]: e.target.value }))}
                              className="w-full bg-white/5 border-2 border-white/10 rounded-2xl px-5 py-3.5 text-white text-sm font-bold outline-none focus:bg-white/10 focus:border-brand-primary/60 hover:border-white/20 transition-colors placeholder:text-zinc-600 shadow-inner"
                            />
                          ))}
                        </div>

                        {/* Divider */}
                        <div className="flex items-center gap-3 my-1">
                          <div className="flex-1 h-px bg-white/10" />
                          <span className="text-zinc-600 text-xs font-bold uppercase tracking-widest">or pick from list</span>
                          <div className="flex-1 h-px bg-white/10" />
                        </div>

                        {/* Preset options */}
                        {q.options?.map(opt => {
                          const sel = checkArr.includes(opt);
                          const maxReached = !sel && totalSelected >= (q.maxSelect ?? Infinity);
                          return (
                            <button key={opt} onClick={() => toggleCheck(opt)} disabled={maxReached}
                              className={cn('w-full text-left px-5 sm:px-6 py-3.5 sm:py-4 rounded-2xl border-2 transition-all flex items-center justify-between group select-none flex-shrink-0 backdrop-blur-xl',
                                sel         ? 'border-brand-primary/60 bg-brand-primary/20 shadow-[0_0_15px_rgba(255,90,31,0.3)]'
                                : maxReached ? 'border-white/5 bg-white/5 text-zinc-700 cursor-not-allowed'
                                             : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 shadow-sm')}>
                              <span className={cn("text-sm md:text-base font-bold transition-colors", sel ? "text-white" : maxReached ? "text-zinc-700" : "text-zinc-300")}>{opt}</span>
                              <span className={cn('w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all',
                                sel ? 'border-brand-primary bg-brand-primary text-white shadow-[0_0_10px_rgba(255,90,31,0.5)]' : maxReached ? 'border-white/5 bg-transparent' : 'border-white/20 group-hover:border-white/40')}>
                                {sel && <Check className="w-3.5 h-3.5 text-white" strokeWidth={4} />}
                              </span>
                            </button>
                          );
                        })}
                      </>
                    );
                  })() : (
                    // Standard checkbox mode
                    <>
                      {q.options?.map(opt => {
                        const sel = checkArr.includes(opt);
                        const maxReached = !sel && q.maxSelect !== undefined && nonOtherCount >= q.maxSelect;
                        return (
                          <button key={opt} onClick={() => toggleCheck(opt)} disabled={maxReached}
                            className={cn('w-full text-left px-5 sm:px-6 py-3.5 sm:py-4 rounded-2xl border-2 transition-all flex items-center justify-between group select-none flex-shrink-0 backdrop-blur-xl',
                              sel         ? 'border-brand-primary/60 bg-brand-primary/20 shadow-[0_0_15px_rgba(255,90,31,0.3)]'
                              : maxReached ? 'border-white/5 bg-white/5 text-zinc-700 cursor-not-allowed'
                                           : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 shadow-sm')}>
                            <span className={cn("text-sm md:text-base font-bold transition-colors", sel ? "text-white" : maxReached ? "text-zinc-700" : "text-zinc-300")}>{opt}</span>
                            <span className={cn('w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all',
                              sel ? 'border-brand-primary bg-brand-primary text-white shadow-[0_0_10px_rgba(255,90,31,0.5)]' : maxReached ? 'border-white/5 bg-transparent' : 'border-white/20 group-hover:border-white/40')}>
                              {sel && <Check className="w-3.5 h-3.5 text-white" strokeWidth={4} />}
                            </span>
                          </button>
                        );
                      })}
                      {hasOther && (
                        <>
                          <button onClick={() => toggleCheck(OTHER)}
                            className={cn('w-full text-left px-5 sm:px-6 py-3.5 sm:py-4 rounded-2xl border-2 transition-all flex items-center justify-between group select-none flex-shrink-0 backdrop-blur-xl',
                              checkArr.includes(OTHER) ? 'border-brand-primary/60 bg-brand-primary/20 shadow-[0_0_15px_rgba(255,90,31,0.3)]'
                                                       : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10 shadow-sm')}>
                            <span className={cn("text-sm md:text-base font-bold transition-colors", checkArr.includes(OTHER) ? "text-white" : "text-zinc-300")}>Other (Please specify)</span>
                            <span className={cn('w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-all',
                              checkArr.includes(OTHER) ? 'border-brand-primary bg-brand-primary text-white shadow-[0_0_10px_rgba(255,90,31,0.5)]' : 'border-white/20 group-hover:border-white/40')}>
                              {checkArr.includes(OTHER) && <Check className="w-3.5 h-3.5 text-white" strokeWidth={4} />}
                            </span>
                          </button>
                          {checkArr.includes(OTHER) && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-1">
                              <input autoFocus type="text" placeholder="Please specify…"
                                value={otherInputs[q.id] || ''}
                                onChange={e => setOtherInputs(prev => ({ ...prev, [q.id]: e.target.value }))}
                                className="w-full bg-white/5 border-2 border-white/10 rounded-2xl px-6 py-4 text-white text-sm font-bold outline-none focus:bg-white/10 focus:border-brand-primary/60 hover:border-white/20 transition-colors placeholder:text-zinc-600 shadow-inner flex-shrink-0"
                              />
                            </motion.div>
                          )}
                        </>
                      )}
                    </>
                  )}
                </div>

                <div className="flex-shrink-0 pt-4 pb-2">
                  <motion.button onClick={next} disabled={!valid}
                    animate={{ opacity: valid ? 1 : 0.4 }}
                    className="w-full flex items-center justify-center gap-2 text-white px-6 py-4 rounded-full font-bold text-sm transition-all shadow-[0_0_20px_rgba(255,90,31,0.4)] hover:shadow-[0_0_30px_rgba(255,90,31,0.6)] border border-brand-primary/50 disabled:pointer-events-none"
                    style={{ background: 'linear-gradient(135deg, #FF5A1F 0%, #FFA03A 100%)' }}>
                    {isLast ? 'Submit' : 'Continue'} <ArrowRight className="w-4 h-4" />
                  </motion.button>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
