"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Navigation, DollarSign, Clock } from "lucide-react";
import { motion } from "framer-motion";

export default function BecomeARider() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-brand-light text-brand-dark font-sans selection:bg-brand-primary selection:text-white pb-24 overflow-hidden">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-bl from-brand-primary/10 via-brand-accent/5 to-transparent -z-10 blur-[100px] rounded-full" />
      <div className="absolute top-[40%] left-[-20%] w-[500px] h-[500px] bg-gradient-to-tr from-brand-primary/10 to-transparent -z-10 blur-[100px] rounded-full" />

      {/* Navigation Bar */}
      <nav className="w-full px-6 sm:px-10 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="text-2xl font-bold tracking-tight">
            2QT<span className="text-brand-primary">.</span>
          </div>
          <button 
            onClick={() => router.push("/login")}
            className="text-sm font-bold text-black/60 hover:text-brand-primary transition-colors"
          >
            Sign In
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="relative pt-20 pb-24 px-6">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-black/5 shadow-sm text-xs font-bold text-brand-primary mb-8 uppercase tracking-widest">
               <Navigation className="w-3.5 h-3.5" />
               Join the Elite Fleet
            </div>
            
            <h1 className="text-6xl md:text-8xl font-black mb-8 tracking-tighter leading-[0.9]">
              Ride with <span className="text-brand-primary">2QT</span>
            </h1>
            
            <p className="text-xl md:text-2xl text-black/60 mb-12 max-w-2xl mx-auto font-medium leading-relaxed">
              Experience the freedom of being your own boss. Deliver the city's finest culinary creations and earn premium rates on your own schedule.
            </p>
            
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <button 
                onClick={() => router.push("/become-a-rider/apply")}
                className="w-full sm:w-auto bg-brand-dark hover:bg-black text-white font-semibold py-4 px-10 rounded-[24px] text-lg transition-all shadow-xl shadow-black/10 flex items-center justify-center group"
              >
                Start Earning Today <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Premium Benefits Grid */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid md:grid-cols-3 gap-6">
          {[
            { 
              icon: DollarSign, 
              title: "Premium Payouts", 
              desc: "Earn the highest base pay in the industry, plus exclusive distance bonuses and 100% of customer tips." 
            },
            { 
              icon: Clock, 
              title: "Absolute Freedom", 
              desc: "Work strictly on your terms. No minimum shifts, no rigid schedules. Just log in and start earning." 
            },
            { 
              icon: Navigation, 
              title: "Smart Dispatch", 
              desc: "Our proprietary AI minimizes dead miles, clustering your deliveries to maximize your hourly earnings." 
            }
          ].map((benefit, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="bg-white border border-black/5 p-10 rounded-[40px] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] hover:-translate-y-2 transition-transform duration-300"
            >
              <div className="bg-brand-light w-16 h-16 rounded-[20px] flex items-center justify-center mb-8 shadow-inner border border-black/5">
                <benefit.icon className="text-brand-primary w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold mb-4 tracking-tight">{benefit.title}</h3>
              <p className="text-black/60 leading-relaxed font-medium text-sm">
                {benefit.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Requirements Section */}
      <div className="max-w-7xl mx-auto px-6 py-24">
        <motion.div 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="bg-brand-dark rounded-[48px] overflow-hidden relative border border-black/10 shadow-2xl"
        >
          {/* Subtle gradient inside dark card */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
          
          <div className="p-12 md:p-20 relative z-10">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-16 tracking-tight text-center">
              Requirements
            </h2>
            <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {[
                "A reliable iOS or Android smartphone",
                "Valid Driver's License or ID",
                "Registered vehicle (Bike, Scooter, EV)",
                "Clear background check",
                "Bank account for weekly payouts",
                "A passion for premium service"
              ].map((req, i) => (
                <div key={i} className="flex items-center gap-5 bg-white/5 backdrop-blur-md p-6 rounded-[24px] border border-white/10">
                  <div className="w-8 h-8 rounded-full bg-brand-primary/20 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="text-brand-primary w-5 h-5" />
                  </div>
                  <span className="text-white/90 font-semibold text-lg">{req}</span>
                </div>
              ))}
            </div>
            
            <div className="mt-16 text-center">
               <button 
                onClick={() => router.push("/become-a-rider/apply")}
                className="bg-brand-primary hover:bg-brand-primary-dark text-white font-bold py-5 px-12 rounded-full text-xl transition-all shadow-xl shadow-brand-primary/30"
              >
                Apply to 2QT
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
