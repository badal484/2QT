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
}

const QUESTIONS: Question[] = [
  {
    id: 'personType', title: 'Who are you?', type: 'radio-other',
    options: ['School Student (11th)', 'School Student (12th)', 'College Student', 'Coaching Student', 'Medical Student (RIMS)', 'Working Professional'],
  },
  {
    id: 'institution', title: 'Which school, college, or coaching institute are you from?', type: 'radio-other',
    options: ["St. Xavier's College", "Ranchi Women's College", "BIT Lalpur", "RIMS", "Motion Education", "Physics Wallah", "Adda247", "Mind Makers", "Eternal Career Classes"],
  },
  {
    id: 'stayType', title: 'Where do you usually stay?', type: 'radio-other',
    options: ['Home', 'Hostel', 'PG', 'Rented Apartment'],
  },
  {
    id: 'orderFrequency', title: 'How often do you order food online?', type: 'radio-other',
    options: ['Never', 'Once a week', '2–3 times a week', '4–6 times a week', 'Daily'],
  },
  {
    id: 'deliveryApps', title: 'Which food delivery apps do you use?', subtitle: 'Select all that apply', type: 'checkbox-other',
    options: ['Swiggy', 'Zomato', 'Magicpin', 'Directly from Restaurants', "I don't order online"],
  },
  {
    id: 'biggestProblems', title: 'What is the biggest problem you face while ordering food?', subtitle: 'Select multiple', type: 'checkbox-other',
    options: ['Expensive prices', 'Platform fees', 'Slow delivery', 'Cold food', 'Bad packaging', 'Poor taste', 'Hygiene concerns', 'Limited options', 'Late-night delivery unavailable'],
  },
  {
    id: 'spendPerOrder', title: 'How much do you usually spend on one order?', type: 'radio-other',
    options: ['Under ₹100', '₹100–149', '₹150–199', '₹200–299', '₹300+'],
  },
  {
    id: 'cuisines', title: 'Which cuisines do you enjoy the most?', subtitle: 'Select multiple', type: 'checkbox-other',
    options: ['North Indian', 'Chinese', 'Biryani', 'Pizza', 'Burger', 'Rolls', 'Momos', 'Sandwiches', 'South Indian', 'Healthy Meals'],
  },
  {
    id: 'mostOrderedDishes', title: 'Which dishes do you order most often?', subtitle: 'Select up to 5', type: 'checkbox-other', maxSelect: 5,
    options: ['Chicken Biryani', 'Veg Biryani', 'Fried Rice', 'Noodles', 'Chicken Roll', 'Paneer Roll', 'Burger', 'Pizza', 'Momos', 'Sandwich', 'Chole Bhature', 'Rajma Rice', 'Thali', 'Dosa', 'Idli', 'Cold Coffee', 'Milkshake'],
  },
  {
    id: 'mealPreference', title: 'Which meal do you order the most?', type: 'radio-other',
    options: ['Breakfast', 'Lunch', 'Evening Snacks', 'Dinner', 'Late-night Food'],
  },
  {
    id: 'orderTime', title: 'What time do you usually order food?', subtitle: 'Select multiple', type: 'checkbox-other',
    options: ['7–9 AM', '9–11 AM', '12–2 PM', '2–4 PM', '4–6 PM', '6–8 PM', '8–10 PM', 'After 10 PM'],
  },
  {
    id: 'waitTime', title: 'How long are you willing to wait for food?', type: 'radio-other',
    options: ['Under 15 minutes', '15–20 minutes', '20–30 minutes', '30–45 minutes', 'More than 45 minutes'],
  },
  {
    id: 'priorities', title: 'What matters most while ordering food?', subtitle: 'Choose up to 3', type: 'checkbox-other', maxSelect: 3,
    options: ['Taste', 'Hygiene', 'Fast Delivery', 'Low Price', 'Quantity', 'Fresh Ingredients', 'Good Packaging', 'Brand Reputation'],
  },
  {
    id: 'wantedFeatures', title: 'Which features would you like in a food delivery app?', subtitle: 'Select multiple', type: 'checkbox-other',
    options: ['Live Tracking', 'Group Ordering', 'Scheduled Delivery', 'Subscription Meals', 'AI Food Recommendations', 'Loyalty Rewards', 'Student Discounts', 'One-tap Reorder'],
  },
  {
    id: 'convincingOffer', title: 'Which offer would convince you to try a new food delivery app?', type: 'radio-other',
    options: ['₹100 Welcome Credit', 'Free Delivery', 'Buy 1 Get 1', 'Free Dessert', '20% Off First Order', 'Loyalty Points'],
  },
  {
    id: 'chooseOver', title: 'What would make you order from 2QT instead of Swiggy or Zomato?', subtitle: 'Select multiple', type: 'checkbox-other',
    options: ['Better Taste', 'Faster Delivery', 'Better Prices', 'Student Discounts', 'Better Packaging', 'More Quantity', 'Cleaner Kitchen', 'No Platform Fee'],
  },
  {
    id: 'wishFeature', title: "What food or feature do you wish existed but can't find easily in Ranchi?",
    type: 'text', placeholder: "Tell us what's missing in Ranchi…", optional: true,
  },
  {
    id: 'earlyAccess', title: 'Would you like early access to 2QT?', type: 'radio',
    options: ['Yes', 'Maybe', 'No'],
  },
];

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
  const progress = (currentIndex / QUESTIONS.length) * 100;
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
    if (checkArr.length === 0) return false;
    if (q.type === 'checkbox-other' && checkArr.includes(OTHER)) return Boolean(other);
    return true;
  }, [data, otherInputs, q, checkArr]);

  // Accept an optional snapshot so callers can pass freshly-computed data
  // without waiting for React state to flush (avoids stale-closure bug).
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
        result[question.id] = arr.map(v => v === OTHER ? (other ? `Other: ${other}` : 'Other') : v);
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
    // Capture the updated data NOW (before setData flushes) so the
    // setTimeout callback doesn't use a stale closure.
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
    <div className="w-full max-w-xl mx-auto flex flex-col" style={{ minHeight: '80vh' }}>

      {/* Progress */}
      <div className="mb-8 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <button onClick={back} aria-label="Back"
            className={cn('flex items-center justify-center w-10 h-10 border-2 border-brand-dark bg-white text-brand-dark shadow-[2px_2px_0px_#1A1A1A] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none active:bg-brand-primary active:text-white transition-all', currentIndex === 0 && 'opacity-0 pointer-events-none')}>
            <ArrowLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-black text-brand-dark uppercase tracking-[0.16em]">
            {currentIndex + 1} <span className="text-brand-dark/50">/ {QUESTIONS.length}</span>
          </span>
          <div className="w-9" />
        </div>
        <div className="h-2 w-full bg-white border-2 border-brand-dark overflow-hidden shadow-[2px_2px_0px_#1A1A1A]">
          <motion.div
            className="h-full bg-brand-primary"
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
            <div className="mb-5 flex-shrink-0">
              <h2 className="text-2xl md:text-4xl font-black font-serif text-brand-dark tracking-tight uppercase leading-[1.15]">
                {q.title}
              </h2>
              {q.subtitle && (
                <p className="mt-2 text-sm font-bold text-brand-dark/70 uppercase tracking-widest">
                  {q.subtitle}{q.maxSelect ? ` (max ${q.maxSelect})` : ''}
                </p>
              )}
            </div>

            {/* TEXT */}
            {q.type === 'text' && (
              <div className="flex-1 overflow-y-auto pb-6">
                <input autoFocus type="text"
                  placeholder={q.placeholder}
                  value={String(data[q.id] || '')}
                  onChange={e => setData(prev => ({ ...prev, [q.id]: e.target.value }))}
                  className="w-full text-xl md:text-2xl font-black text-brand-dark bg-transparent border-b-4 border-brand-dark py-3 placeholder:text-brand-dark/30 focus:border-brand-primary outline-none transition-colors caret-brand-primary"
                />
                <p className="mt-2 text-xs font-bold uppercase tracking-widest text-brand-dark/60">
                  {q.optional ? 'Optional — press Enter ↵ or tap Continue' : 'Press Enter ↵ to continue'}
                </p>
                <button onClick={next} disabled={!valid}
                  className="mt-6 flex items-center gap-2 bg-brand-primary border-2 border-brand-dark shadow-[4px_4px_0px_#1A1A1A] text-white px-7 py-3.5 font-black uppercase text-sm disabled:opacity-40 transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none active:translate-x-[4px] active:translate-y-[4px]">
                  {isLast ? 'Submit' : 'Continue'} <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* RADIO */}
            {isRadioType && (
              <div className="flex-1 overflow-y-auto pb-6 flex flex-col gap-2">
                {q.options?.map(opt => {
                  const sel = data[q.id] === opt;
                  return (
                    <button key={opt} onClick={() => pickRadio(opt)}
                      className={cn('w-full text-left px-4 py-3.5 border-4 transition-all flex items-center justify-between group select-none shadow-[4px_4px_0px_#1A1A1A] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]',
                        sel ? 'border-brand-primary bg-brand-primary text-white'
                            : 'border-brand-dark bg-white hover:bg-brand-primary/10 text-brand-dark')}>
                      <span className="text-sm md:text-base font-black uppercase tracking-wide">{opt}</span>
                      <span className={cn('w-6 h-6 border-2 flex items-center justify-center flex-shrink-0 transition-all',
                        sel ? 'border-white bg-white text-brand-primary' : 'border-brand-dark group-hover:border-brand-primary')}>
                        {sel && <Check className="w-4 h-4" strokeWidth={4} />}
                      </span>
                    </button>
                  );
                })}
                {hasOther && (
                  <>
                    <button onClick={() => pickRadio(OTHER)}
                      className={cn('w-full text-left px-4 py-3.5 border-4 transition-all flex items-center justify-between group select-none shadow-[4px_4px_0px_#1A1A1A] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]',
                        otherSelected ? 'border-brand-primary bg-brand-primary text-white'
                                      : 'border-brand-dark bg-white hover:bg-brand-primary/10 text-brand-dark')}>
                      <span className="text-sm md:text-base font-black uppercase tracking-wide">Other (Please specify)</span>
                      <span className={cn('w-6 h-6 border-2 flex items-center justify-center flex-shrink-0 transition-all',
                        otherSelected ? 'border-white bg-white text-brand-primary' : 'border-brand-dark group-hover:border-brand-primary')}>
                        {otherSelected && <Check className="w-4 h-4" strokeWidth={4} />}
                      </span>
                    </button>
                    {otherSelected && (
                      <input autoFocus type="text" placeholder="Please specify…"
                        value={otherInputs[q.id] || ''}
                        onChange={e => setOtherInputs(prev => ({ ...prev, [q.id]: e.target.value }))}
                        className="w-full bg-[#FFF7ED] border-4 border-brand-dark px-4 py-3 text-brand-dark font-bold text-sm outline-none focus:border-brand-primary transition-colors placeholder:text-brand-dark/30 shadow-[4px_4px_0px_#1A1A1A]"
                      />
                    )}
                    {otherSelected && (
                      <button onClick={next} disabled={!valid}
                        className="flex items-center justify-center gap-2 bg-brand-primary border-2 border-brand-dark shadow-[4px_4px_0px_#1A1A1A] text-white px-6 py-3 font-black uppercase text-sm disabled:opacity-40 transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none active:translate-x-[4px] active:translate-y-[4px]">
                        {isLast ? 'Submit' : 'Continue'} <ArrowRight className="w-4 h-4" />
                      </button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* CHECKBOX — options scroll, Continue button pinned at bottom */}
            {isCheckType && (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Scrollable options */}
                <div className="flex-1 overflow-y-auto flex flex-col gap-2 pb-2 min-h-0">
                  {q.options?.map(opt => {
                    const sel = checkArr.includes(opt);
                    const maxReached = !sel && q.maxSelect !== undefined && nonOtherCount >= q.maxSelect;
                    return (
                      <button key={opt} onClick={() => toggleCheck(opt)} disabled={maxReached}
                        className={cn('w-full text-left px-4 py-3.5 border-4 transition-all flex items-center justify-between group select-none flex-shrink-0 shadow-[4px_4px_0px_#1A1A1A] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]',
                          sel         ? 'border-brand-primary bg-brand-primary text-white'
                          : maxReached ? 'border-brand-dark/20 bg-black/5 text-brand-dark/40 cursor-not-allowed shadow-none'
                                       : 'border-brand-dark bg-white hover:bg-brand-primary/10 text-brand-dark')}>
                        <span className="text-sm md:text-base font-black uppercase tracking-wide">{opt}</span>
                        <span className={cn('w-6 h-6 border-2 flex items-center justify-center flex-shrink-0 transition-all',
                          sel ? 'border-white bg-white text-brand-primary' : 'border-brand-dark group-hover:border-brand-primary')}>
                          {sel && <Check className="w-4 h-4" strokeWidth={4} />}
                        </span>
                      </button>
                    );
                  })}
                  {hasOther && (
                    <>
                      <button onClick={() => toggleCheck(OTHER)}
                        className={cn('w-full text-left px-4 py-3.5 border-4 transition-all flex items-center justify-between group select-none flex-shrink-0 shadow-[4px_4px_0px_#1A1A1A] active:shadow-none active:translate-x-[2px] active:translate-y-[2px]',
                          checkArr.includes(OTHER) ? 'border-brand-primary bg-brand-primary text-white'
                                                   : 'border-brand-dark bg-white hover:bg-brand-primary/10 text-brand-dark')}>
                        <span className="text-sm md:text-base font-black uppercase tracking-wide">Other (Please specify)</span>
                        <span className={cn('w-6 h-6 border-2 flex items-center justify-center flex-shrink-0 transition-all',
                          checkArr.includes(OTHER) ? 'border-white bg-white text-brand-primary' : 'border-brand-dark group-hover:border-brand-primary')}>
                          {checkArr.includes(OTHER) && <Check className="w-4 h-4" strokeWidth={4} />}
                        </span>
                      </button>
                      {checkArr.includes(OTHER) && (
                        <input autoFocus type="text" placeholder="Please specify…"
                          value={otherInputs[q.id] || ''}
                          onChange={e => setOtherInputs(prev => ({ ...prev, [q.id]: e.target.value }))}
                          className="w-full bg-[#FFF7ED] border-4 border-brand-dark px-4 py-3 text-brand-dark font-bold text-sm outline-none focus:border-brand-primary transition-colors placeholder:text-brand-dark/30 shadow-[4px_4px_0px_#1A1A1A] flex-shrink-0"
                        />
                      )}
                    </>
                  )}
                </div>

                {/* Pinned Continue button — always visible */}
                <div className="flex-shrink-0 pt-3 pb-1">
                  <motion.button onClick={next} disabled={!valid}
                    animate={{ opacity: valid ? 1 : 0.4 }}
                    className="w-full flex items-center justify-center gap-2 bg-brand-primary border-4 border-brand-dark text-white px-6 py-4 font-black uppercase tracking-widest text-sm transition-all disabled:cursor-not-allowed shadow-[6px_6px_0px_#1A1A1A] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[4px_4px_0px_#1A1A1A] active:translate-x-[6px] active:translate-y-[6px] active:shadow-none">
                    {isLast ? 'Submit' : 'Continue'} <ArrowRight className="w-5 h-5" />
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
