'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Send, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

export default function PreLaunchPage() {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', cuisine: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || (!formData.email && !formData.phone)) {
      toast.error('Please provide your name and an email or phone number.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/proxy/prelaunch/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          surveyResponses: { cuisine: formData.cuisine }
        })
      });

      if (res.ok) {
        setIsSuccess(true);
        toast.success('You have successfully joined the waitlist!');
      } else {
        throw new Error('Failed to join');
      }
    } catch (err) {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full text-center"
        >
          <motion.div 
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6"
          >
            <CheckCircle2 size={40} />
          </motion.div>
          <h1 className="text-3xl font-bold text-zinc-900 mb-4">You're on the list!</h1>
          <p className="text-zinc-600 mb-8">
            Thank you for joining the Velto Food Palace waitlist. We will notify you as soon as we launch!
          </p>
          <button 
            onClick={() => window.location.href = '/'}
            className="w-full py-4 rounded-xl font-bold text-white bg-brand-primary"
          >
            Return Home
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-primary/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-brand-accent/10 rounded-full blur-3xl pointer-events-none" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white p-8 md:p-12 rounded-3xl shadow-xl max-w-lg w-full relative z-10"
      >
        <div className="text-center mb-8">
          <div className="inline-block px-4 py-1.5 rounded-full bg-brand-primary/10 text-brand-primary font-semibold text-sm mb-4">
            COMING SOON
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-zinc-900 mb-4 tracking-tight">
            Velto Food Palace
          </h1>
          <p className="text-zinc-500 text-lg">
            A premium food delivery experience is cooking. Join the exclusive waitlist to get early access and launch offers.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Full Name</label>
            <input 
              type="text"
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all outline-none"
              placeholder="John Doe"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Email Address</label>
              <input 
                type="email"
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all outline-none"
                placeholder="john@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Phone Number</label>
              <input 
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all outline-none"
                placeholder="+91 9000000000"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Favorite Cuisine?</label>
            <select 
              value={formData.cuisine}
              onChange={e => setFormData({ ...formData, cuisine: e.target.value })}
              className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 focus:bg-white focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all outline-none"
            >
              <option value="">Select one...</option>
              <option value="Indian">Indian</option>
              <option value="Chinese">Chinese</option>
              <option value="Italian">Italian</option>
              <option value="Fast Food">Fast Food</option>
              <option value="Healthy">Healthy / Salads</option>
            </select>
          </div>

          <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 mt-6 rounded-xl font-bold text-white bg-brand-primary hover:bg-brand-primary-dark transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {isSubmitting ? 'Joining...' : 'Join Waitlist'}
            <Send size={18} />
          </button>
        </form>
      </motion.div>
    </div>
  );
}
