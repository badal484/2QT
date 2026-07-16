import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface SurveyData {
  name: string;
  college: string;
  year: string;
  preference: string;
  cuisine: string;
  mostOrdered: string;
  budget: string;
  frequency: string;
  mealTime: string;
  biggestPain: string;
  tryNewBrand: string;
  referFriends: string;
  anythingElse: string;
}

const QUESTIONS = [
  { id: 'name',         title: 'What\'s your full name?',                       type: 'text',  placeholder: 'Rahul Sharma' },
  { id: 'college',      title: 'Which college do you attend?',                   type: 'text',  placeholder: 'St. Xavier\'s College' },
  { id: 'year',         title: 'What year are you in?',                          type: 'radio', options: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Masters / PhD'] },
  { id: 'preference',   title: 'What\'s your food preference?',                  type: 'radio', options: ['Strictly Veg', 'Non-Veg', 'Both'] },
  { id: 'cuisine',      title: 'Your absolute favourite cuisine?',                type: 'radio', options: ['North Indian', 'South Indian', 'Chinese', 'Continental', 'Healthy Bowls'] },
  { id: 'mostOrdered',  title: 'What dish do you order most often?',             type: 'text',  placeholder: 'e.g. Biryani, Paneer, Momos…' },
  { id: 'budget',       title: 'Ideal budget per meal?',                          type: 'radio', options: ['Under ₹80', '₹80 – ₹150', '₹150 – ₹250', '₹250+'] },
  { id: 'frequency',    title: 'How often do you order food online?',             type: 'radio', options: ['Every day', '2–3 times a week', 'Once a week', 'Rarely'] },
  { id: 'mealTime',     title: 'When do you order the most?',                    type: 'radio', options: ['Lunch', 'Dinner', 'Late Night'] },
  { id: 'biggestPain',  title: 'What frustrates you most about food delivery?',  type: 'radio', options: ['High fees', 'Cold / late food', 'Wrong order', 'Bad packaging'] },
  { id: 'tryNewBrand',  title: 'What makes you try a new food brand?',           type: 'radio', options: ['Big discount', 'Friend\'s recommendation', 'Unique menu', 'Great packaging'] },
  { id: 'referFriends', title: 'Would you refer 2QT to your friends?',           type: 'radio', options: ['Absolutely!', 'Probably yes', 'Maybe', 'I\'m not sure'] },
  { id: 'anythingElse', title: 'Any dish you wish someone would deliver?',       type: 'text',  placeholder: 'Tell us your ultimate craving…' },
];

export function SurveyWizard({ onComplete }: { onComplete: (data: SurveyData) => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [data, setData] = useState<Partial<SurveyData>>({});
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('2qt_survey_progress');
      if (saved) {
        const parsed = JSON.parse(saved);
        setData(parsed.data || {});
        setCurrentIndex(parsed.index || 0);
      }
    } catch {}
  }, []);

  useEffect(() => {
    sessionStorage.setItem('2qt_survey_progress', JSON.stringify({ data, index: currentIndex }));
  }, [data, currentIndex]);

  const q = QUESTIONS[currentIndex];
  const isLast = currentIndex === QUESTIONS.length - 1;
  const progress = (currentIndex / QUESTIONS.length) * 100;
  const isValid = !!(data[q.id as keyof SurveyData] ?? '').trim();

  const next = () => {
    if (isLast) { onComplete(data as SurveyData); return; }
    setDirection(1);
    setCurrentIndex(i => i + 1);
  };

  const back = () => {
    if (currentIndex === 0) return;
    setDirection(-1);
    setCurrentIndex(i => i - 1);
  };

  const pick = (val: string) => {
    setData(prev => ({ ...prev, [q.id]: val }));
    if (q.type === 'radio') setTimeout(next, 380);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && isValid && q.type === 'text') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentIndex, isValid]);

  const variants = {
    enter:  (d: number) => ({ x: d > 0 ? 48 : -48, opacity: 0, filter: 'blur(4px)' }),
    center: { x: 0, opacity: 1, filter: 'blur(0px)' },
    exit:   (d: number) => ({ x: d < 0 ? 48 : -48, opacity: 0, filter: 'blur(4px)' }),
  };

  return (
    <div className="w-full max-w-xl mx-auto flex flex-col" style={{ minHeight: '70vh' }}>

      {/* Progress bar + counter */}
      <div className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={back}
            aria-label="Back"
            className={cn(
              'flex items-center justify-center w-9 h-9 rounded-full border border-white/10 bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white transition-all',
              currentIndex === 0 && 'opacity-0 pointer-events-none'
            )}
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <span className="text-xs font-bold text-zinc-500 uppercase tracking-[0.16em]">
            {currentIndex + 1} <span className="text-zinc-700">/ {QUESTIONS.length}</span>
          </span>

          <div className="w-9" />
        </div>

        {/* Progress track */}
        <div className="h-1 w-full bg-white/[0.07] rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-brand-primary shadow-[0_0_8px_rgba(255,107,53,0.6)]"
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
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 flex flex-col"
          >
            <h2 className="text-2xl md:text-4xl font-extrabold font-serif text-white tracking-tight mb-8 leading-[1.12]">
              {q.title}
            </h2>

            {q.type === 'text' && (
              <div className="flex-1">
                <input
                  autoFocus
                  type="text"
                  placeholder={q.placeholder}
                  value={data[q.id as keyof SurveyData] ?? ''}
                  onChange={e => setData(prev => ({ ...prev, [q.id]: e.target.value }))}
                  className="w-full text-xl md:text-3xl font-medium text-white bg-transparent border-b-2 border-white/15 py-4 placeholder:text-zinc-600 focus:border-brand-primary outline-none transition-colors caret-brand-primary"
                />
                <p className="mt-3 text-xs text-zinc-600">Press Enter ↵ to continue</p>
              </div>
            )}

            {q.type === 'radio' && (
              <div className="flex-1 flex flex-col gap-2.5">
                {q.options?.map(opt => {
                  const selected = data[q.id as keyof SurveyData] === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => pick(opt)}
                      className={cn(
                        'w-full text-left px-5 py-4 rounded-2xl border transition-all flex items-center justify-between group select-none',
                        selected
                          ? 'border-brand-primary bg-brand-primary/10 text-white shadow-[0_0_18px_rgba(255,107,53,0.12)]'
                          : 'border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.06] hover:border-white/20 text-zinc-400 hover:text-white'
                      )}
                    >
                      <span className="text-base md:text-lg font-semibold">{opt}</span>
                      <span className={cn(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all',
                        selected ? 'border-brand-primary bg-brand-primary' : 'border-white/20 group-hover:border-white/40'
                      )}>
                        {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Mobile next (text questions only) */}
            {q.type === 'text' && (
              <div className="mt-8 md:hidden">
                <button
                  onClick={next}
                  disabled={!isValid}
                  className="w-full flex items-center justify-center gap-2 bg-brand-primary text-white py-4 rounded-2xl font-bold text-base disabled:opacity-40 transition-all"
                >
                  {isLast ? 'Submit' : 'Continue'}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Desktop next (text questions) */}
      {q.type === 'text' && (
        <div className="hidden md:flex justify-end pt-10 pb-6">
          <motion.button
            onClick={next}
            disabled={!isValid}
            animate={{ opacity: isValid ? 1 : 0, y: isValid ? 0 : 8 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2 bg-brand-primary text-white px-7 py-3.5 rounded-2xl font-bold text-base hover:bg-brand-primary-dark hover:scale-[1.03] active:scale-[0.97] transition-all shadow-[0_0_20px_rgba(255,107,53,0.25)] disabled:pointer-events-none"
          >
            {isLast ? 'Submit' : 'Continue'} <ArrowRight className="w-4 h-4" />
          </motion.button>
        </div>
      )}
    </div>
  );
}
