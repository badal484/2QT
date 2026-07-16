import React, { useState, useEffect } from 'react';
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

interface SurveyWizardProps {
  onComplete: (data: SurveyData) => void;
}

const QUESTIONS = [
  { id: 'name', title: 'What is your full name?', type: 'text', placeholder: 'John Doe' },
  { id: 'college', title: 'Which college do you attend?', type: 'text', placeholder: 'St. Xavier\'s College' },
  { id: 'year', title: 'What year are you in?', type: 'radio', options: ['1st Year', '2nd Year', '3rd Year', '4th Year', 'Masters'] },
  { id: 'preference', title: 'What is your food preference?', type: 'radio', options: ['Strictly Veg', 'Non-Veg', 'Both'] },
  { id: 'cuisine', title: 'Your absolute favorite cuisine?', type: 'radio', options: ['Indian', 'Chinese', 'Italian', 'Continental', 'Healthy Bowls'] },
  { id: 'mostOrdered', title: 'What do you order most often?', type: 'text', placeholder: 'E.g., Biryani, Pizza, Momos' },
  { id: 'budget', title: 'What is your ideal budget per meal?', type: 'radio', options: ['Under ₹100', '₹100 - ₹200', '₹200 - ₹300', '₹300+'] },
  { id: 'frequency', title: 'How often do you order food online?', type: 'radio', options: ['Daily', '2-3 times a week', 'Weekly', 'Rarely'] },
  { id: 'mealTime', title: 'When do you order the most?', type: 'radio', options: ['Lunch', 'Dinner', 'Late Night Cravings'] },
  { id: 'biggestPain', title: 'What frustrates you most about food delivery?', type: 'radio', options: ['High Delivery Fees', 'Cold Food', 'Late Delivery', 'Spilled / Bad Packaging'] },
  { id: 'tryNewBrand', title: 'What makes you try a new food brand?', type: 'radio', options: ['Great Discounts', 'Friend\'s Recommendation', 'Beautiful Packaging', 'Unique Menu'] },
  { id: 'referFriends', title: 'Would you refer 2QT to your friends?', type: 'radio', options: ['Definitely', 'Maybe', 'Probably Not'] },
  { id: 'anythingElse', title: 'Anything specific you want 2QT to serve?', type: 'text', placeholder: 'Tell us your ultimate craving...' },
];

export function SurveyWizard({ onComplete }: SurveyWizardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [data, setData] = useState<Partial<SurveyData>>({});
  const [direction, setDirection] = useState(1);

  // Auto-save logic
  useEffect(() => {
    const saved = sessionStorage.getItem('2qt_survey_progress');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setData(parsed.data || {});
        setCurrentIndex(parsed.index || 0);
      } catch (e) {}
    }
  }, []);

  useEffect(() => {
    sessionStorage.setItem('2qt_survey_progress', JSON.stringify({ data, index: currentIndex }));
  }, [data, currentIndex]);

  const q = QUESTIONS[currentIndex];
  const progress = ((currentIndex) / QUESTIONS.length) * 100;

  const handleNext = () => {
    if (currentIndex === QUESTIONS.length - 1) {
      onComplete(data as SurveyData);
      sessionStorage.removeItem('2qt_survey_progress');
    } else {
      setDirection(1);
      setCurrentIndex(c => c + 1);
    }
  };

  const handleBack = () => {
    if (currentIndex > 0) {
      setDirection(-1);
      setCurrentIndex(c => c - 1);
    }
  };

  const handleChange = (val: string) => {
    setData(prev => ({ ...prev, [q.id]: val }));
    if (q.type === 'radio') {
      setTimeout(handleNext, 400); // Auto advance
    }
  };

  const isCurrentValid = !!data[q.id as keyof SurveyData]?.trim();

  // Handle enter key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && isCurrentValid && q.type === 'text') {
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isCurrentValid]);

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 50 : -50, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir < 0 ? 50 : -50, opacity: 0 }),
  };

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col min-h-[60vh] md:min-h-[500px]">
      
      {/* Sticky Progress Header */}
      <div className="w-full mb-12">
        <div className="flex justify-between items-center mb-4">
          <button 
            onClick={handleBack}
            className={cn(
              "flex items-center justify-center w-10 h-10 rounded-full bg-zinc-100 hover:bg-zinc-200 transition-colors text-zinc-600",
              currentIndex === 0 && "opacity-0 pointer-events-none"
            )}
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="text-sm font-bold text-zinc-500 tracking-widest uppercase">
            {currentIndex + 1} / {QUESTIONS.length}
          </div>
          <div className="w-10" /> {/* Spacer */}
        </div>
        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
          <motion.div 
            className="h-full bg-brand-primary shadow-[0_0_10px_rgba(255,107,53,0.8)]"
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ type: 'spring', stiffness: 50, damping: 15 }}
          />
        </div>
      </div>

      {/* Question Content */}
      <div className="flex-1 relative">
        <AnimatePresence custom={direction} mode="wait">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute inset-0 flex flex-col"
          >
            <h2 className="text-3xl md:text-5xl font-extrabold font-serif text-white tracking-tight mb-8 leading-[1.1]">
              {q.title}
            </h2>

            {q.type === 'text' && (
              <div className="flex-1">
                <input 
                  type="text"
                  autoFocus
                  placeholder={q.placeholder}
                  value={data[q.id as keyof SurveyData] || ''}
                  onChange={e => setData(prev => ({ ...prev, [q.id]: e.target.value }))}
                  className="w-full text-2xl md:text-4xl font-medium text-white bg-transparent border-b-2 border-white/20 py-4 placeholder:text-zinc-600 focus:border-brand-primary outline-none transition-colors"
                />
              </div>
            )}

            {q.type === 'radio' && (
              <div className="flex-1 flex flex-col gap-3">
                {q.options?.map((opt) => {
                  const isSelected = data[q.id as keyof SurveyData] === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => handleChange(opt)}
                      className={cn(
                        "w-full text-left px-6 py-5 rounded-2xl border-2 transition-all flex items-center justify-between group",
                        isSelected 
                          ? "border-brand-primary bg-brand-primary/10 text-white shadow-[0_0_20px_rgba(255,107,53,0.15)]" 
                          : "border-white/10 bg-white/5 hover:border-white/30 text-zinc-400 hover:text-white"
                      )}
                    >
                      <span className="text-lg md:text-xl font-semibold">{opt}</span>
                      <div className={cn(
                        "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                        isSelected ? "border-brand-primary bg-brand-primary" : "border-white/20 group-hover:border-white/40"
                      )}>
                        {isSelected && <Check className="w-4 h-4 text-white" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            
            {/* Mobile/Text Next Button */}
            {(q.type === 'text' || isCurrentValid) && (
              <div className="mt-8 pt-8 md:hidden">
                <button 
                  onClick={handleNext}
                  disabled={!isCurrentValid}
                  className="w-full flex items-center justify-center gap-2 bg-brand-primary text-white py-4 rounded-2xl font-bold text-lg hover:bg-brand-primary-dark transition-all disabled:opacity-50 disabled:grayscale"
                >
                  {currentIndex === QUESTIONS.length - 1 ? 'Complete' : 'Continue'}
                  <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            )}

          </motion.div>
        </AnimatePresence>
      </div>

      {/* Desktop Next Button */}
      <div className="hidden md:flex justify-end pt-12 pb-8">
        <button 
          onClick={handleNext}
          disabled={!isCurrentValid}
          className={cn(
            "flex items-center gap-2 bg-brand-primary text-white px-8 py-4 rounded-2xl font-bold text-lg transition-all hover:bg-brand-primary-dark",
            !isCurrentValid ? "opacity-0 translate-y-4 pointer-events-none" : "opacity-100 translate-y-0 hover:scale-105 shadow-[0_0_20px_rgba(255,107,53,0.3)]"
          )}
        >
          {currentIndex === QUESTIONS.length - 1 ? 'Complete' : 'Press Enter ↵'}
        </button>
      </div>

    </div>
  );
}
