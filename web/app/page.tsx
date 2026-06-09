"use client";

import { motion } from "framer-motion";
import { ArrowRight, ShoppingBag, MapPin, Star, Heart, Clock, ChevronRight, Utensils } from "lucide-react";
import Link from "next/link";
import { useAuth } from "./providers";
import Image from "next/image";

export default function HomePage() {
  const { user } = useAuth()!;

  return (
    <div className="min-h-screen bg-brand-light text-brand-dark selection:bg-brand-primary selection:text-white font-sans antialiased">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-[100] px-6 sm:px-10 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between backdrop-blur-2xl bg-white/80 border border-black/5 rounded-[32px] px-6 md:px-8 py-4 shadow-sm">
          <div className="text-2xl font-bold tracking-tight">
            2QT<span className="text-brand-primary">.</span>
          </div>
          
          <div className="flex items-center gap-4 md:gap-10">
            <div className="hidden md:flex items-center gap-10">
              <Link href="#features" className="text-sm font-medium text-black/60 hover:text-brand-primary transition-colors">Our Kitchens</Link>
              <Link href="#app" className="text-sm font-medium text-black/60 hover:text-brand-primary transition-colors">The App</Link>
              {user ? (
                <Link href="/profile" className="text-sm font-medium text-brand-primary hover:text-brand-primary-dark transition-colors">My Account</Link>
              ) : (
                <Link href="/login" className="text-sm font-medium text-black/60 hover:text-black transition-colors">Sign In</Link>
              )}
            </div>
            <Link href="/menu" className="bg-brand-primary text-white px-5 md:px-7 py-2.5 md:py-3 rounded-[20px] text-sm font-semibold hover:bg-brand-primary-dark transition-all shadow-[0_8px_20px_-6px_rgba(255,107,53,0.4)] hover:shadow-[0_8px_25px_-6px_rgba(255,107,53,0.6)] active:scale-95">
              Order Now
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-48 pb-32 px-6 sm:px-10 overflow-hidden">
        <div className="absolute top-0 right-0 w-[80%] h-[120%] bg-gradient-to-bl from-brand-accent/20 via-brand-primary/5 to-transparent -z-10 blur-[120px]" />
        
        <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col z-10"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-brand-primary/10 text-xs font-semibold text-brand-primary mb-6 md:mb-8 border border-brand-primary/20 w-fit shadow-sm">
               <Star className="w-3.5 h-3.5 fill-current" />
               Premium Culinary Experience
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[1.1] tracking-tight mb-6">
              Extraordinary food,<br />
              <span className="bg-clip-text text-transparent bg-gradient-to-r from-brand-primary to-orange-400">delivered to you.</span>
            </h1>
            <p className="text-lg md:text-xl text-black/60 font-medium max-w-md mb-10 leading-relaxed">
              Experience gourmet meals crafted by top chefs, delivered with uncompromising quality directly to your dining table.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link href="/menu" className="group flex items-center gap-3 bg-brand-dark text-white px-8 py-4 rounded-[24px] text-[15px] font-bold hover:bg-black transition-all shadow-[0_10px_30px_rgba(0,0,0,0.15)] hover:shadow-[0_10px_40px_rgba(0,0,0,0.25)] hover:-translate-y-1">
                Explore Menu <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative block mt-10 lg:mt-0"
          >
            <div className="relative z-10 w-full aspect-square md:aspect-[4/5] bg-white rounded-[32px] md:rounded-[40px] shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] p-3 md:p-4 overflow-hidden border border-black/5 hover:scale-[1.02] transition-transform duration-700">
               <div className="relative w-full h-full rounded-[24px] md:rounded-[32px] overflow-hidden bg-brand-light shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]">
                 <Image src="/premium_healthy_bowl_1777968667530.png" alt="Gourmet Bowl" fill className="object-cover" priority />
                 <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                 <div className="absolute bottom-6 md:bottom-8 left-6 md:left-8 right-6 md:right-8 text-white">
                    <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] md:text-xs font-semibold mb-3 shadow-lg">
                       Chef's Signature
                    </div>
                    <div className="text-xl md:text-2xl font-bold mb-1 font-outfit">Mediterranean Quinoa Bowl</div>
                    <div className="text-white/80 text-xs md:text-sm">Fresh, healthy, and perfectly balanced.</div>
                 </div>
               </div>
            </div>
            
            {/* Glowing Orbs for Advanced aesthetic */}
            <div className="absolute -top-10 -right-10 w-48 md:w-72 h-48 md:h-72 bg-brand-accent/40 rounded-full blur-[60px] md:blur-[80px] -z-10 animate-pulse" />
            <div className="absolute -bottom-10 -left-10 w-48 md:w-72 h-48 md:h-72 bg-brand-primary/30 rounded-full blur-[60px] md:blur-[80px] -z-10" />
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 border-y border-black/5 bg-zinc-50 relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]"></div>
        <div className="max-w-7xl mx-auto px-6 sm:px-10 grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-12 relative z-10">
          {[
            { label: "Quality Rating", val: "4.9" },
            { label: "Delivery Fee", val: "₹0" },
            { label: "Curated Dishes", val: "150+" },
            { label: "Happy Diners", val: "50k+" },
          ].map((stat, i) => (
            <motion.div 
              key={i} 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center group cursor-default bg-white p-6 rounded-[24px] shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-black/[0.02] hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] hover:-translate-y-1 transition-all"
            >
              <div className="text-4xl md:text-5xl font-black tracking-tighter mb-2 text-brand-dark bg-clip-text text-transparent bg-gradient-to-br from-zinc-900 to-zinc-500">{stat.val}</div>
              <div className="text-[10px] md:text-xs font-black uppercase tracking-[0.2em] text-zinc-400">{stat.label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-32 px-6 sm:px-10 bg-brand-light">
        <div className="max-w-7xl mx-auto">
          <div className="mb-20 text-center max-w-2xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">The Standard of Excellence.</h2>
            <p className="text-black/60 font-medium leading-relaxed">
              We manage every step of the culinary journey to guarantee that your food arrives fresh, hot, and beautiful.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { title: "Master Chefs", desc: "Expertly curated menus using the finest locally sourced ingredients.", icon: Utensils },
              { title: "Cloud Kitchens", desc: "State-of-the-art facilities designed purely for delivery perfection.", icon: Heart },
              { title: "White-glove Delivery", desc: "Trained professionals ensuring your food arrives exactly as intended.", icon: MapPin },
            ].map((f, i) => (
              <motion.div 
                key={i} 
                whileHover={{ y: -10 }}
                className="bg-white border border-black/5 rounded-[32px] p-10 shadow-sm hover:shadow-xl transition-all duration-300"
              >
                <div className="w-14 h-14 bg-brand-primary/10 rounded-2xl flex items-center justify-center mb-8 text-brand-primary">
                  <f.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                <p className="text-black/60 text-sm font-medium leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-16 px-6 sm:px-10 border-t border-black/5 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-start gap-16">
          <div className="max-w-xs">
            <div className="text-2xl font-bold tracking-tight mb-6">2QT<span className="text-brand-primary">.</span></div>
            <p className="text-black/50 text-sm font-medium leading-relaxed">
              Elevating the everyday dining experience through technology and culinary mastery.
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-16">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-black/40 mb-6">Company</h4>
              <ul className="space-y-4 text-sm font-semibold text-brand-dark">
                <li><Link href="#" className="hover:text-brand-primary transition-colors">About Us</Link></li>
                <li><Link href="#" className="hover:text-brand-primary transition-colors">Careers</Link></li>
                <li><Link href="#" className="hover:text-brand-primary transition-colors">Press</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-black/40 mb-6">Contact</h4>
              <ul className="space-y-4 text-sm font-semibold text-brand-dark">
                <li><Link href="#" className="hover:text-brand-primary transition-colors">Help Center</Link></li>
                <li><Link href="#" className="hover:text-brand-primary transition-colors">Partner with us</Link></li>
                <li><Link href="/become-a-rider/apply" className="hover:text-brand-primary transition-colors">Become a Rider</Link></li>
                <li><Link href="mailto:hello@2qthello.com" className="text-brand-primary">hello@2qthello.com</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto mt-16 pt-8 border-t border-black/5 text-xs font-medium text-black/40 flex justify-between">
          <span>© 2026 2QT Culinary. All rights reserved.</span>
          <div className="flex gap-6">
            <Link href="/login" className="hover:text-brand-dark transition-colors">Partner Portal</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
