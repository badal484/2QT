"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, ArrowLeft, UploadCloud, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "../../lib/api";

export default function ApplyToRide() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  
  const [formData, setFormData] = useState<{vehicleType: string, licenseNumber: string, idPhoto: File | null}>({
    vehicleType: "bike",
    licenseNumber: "",
    idPhoto: null,
  });

  // Check login and existing application status
  useEffect(() => {
    const init = async () => {
      try {
        const userStr = localStorage.getItem("2qt_user");
        if (!userStr) {
          // Force login before applying
          router.push("/login?redirect=/become-a-rider/apply");
          return;
        }

        const { application } = await api.getApplicationStatus();
        if (application) {
          if (application.status === "pending") setStep(4); // Show pending status
          else if (application.status === "approved") {
            window.location.href = "/rider"; // Force reload to refresh user state
          } else {
            setError(`Your previous application was rejected. Reason: ${application.rejection_reason || "Not specified."}`);
            setStep(4);
          }
        }
      } catch (err) {
        console.error("Failed to fetch app status", err);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router]);

  const handleSubmit = async () => {
    if (!formData.licenseNumber) {
      setError("Please provide a valid License or ID Number.");
      return;
    }
    
    setSubmitting(true);
    setError("");
    try {
      let photoUrl = undefined;
      if (formData.idPhoto) {
        const res = await api.uploadImage(formData.idPhoto);
        photoUrl = res.url;
      }
      await api.applyToRide(formData.vehicleType, formData.licenseNumber, photoUrl);
      setStep(4); // Move to success/pending screen
    } catch (err: any) {
      setError(err.message || "Failed to submit application.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-light flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-primary/30 border-t-brand-primary rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-light text-brand-dark font-sans selection:bg-brand-primary selection:text-white flex flex-col relative overflow-hidden">
      
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-gradient-to-bl from-brand-primary/10 to-transparent -z-10 blur-[80px] rounded-full" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] bg-gradient-to-tr from-brand-accent/10 to-transparent -z-10 blur-[100px] rounded-full" />

      {/* Header */}
      <nav className="w-full px-6 py-6 border-b border-black/5 bg-white/50 backdrop-blur-md sticky top-0 z-20">
        <div className="max-w-3xl mx-auto flex items-center">
          {step > 1 && step < 4 && (
            <button onClick={() => setStep(step - 1)} className="mr-4 w-10 h-10 rounded-full bg-white border border-black/5 flex items-center justify-center text-black/60 hover:text-brand-primary hover:shadow-md transition-all">
              <ArrowLeft size={20} />
            </button>
          )}
          <h1 className="text-xl font-bold tracking-tight">Rider Application</h1>
        </div>
      </nav>

      {/* Form Container */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-lg bg-white border border-black/5 p-8 md:p-12 rounded-[40px] shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)] relative z-10">
          
          {error && step < 4 && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-600 p-4 rounded-2xl mb-8 flex items-start gap-3">
              <AlertCircle size={20} className="mt-0.5 flex-shrink-0 text-red-500" />
              <p className="text-sm font-medium">{error}</p>
            </div>
          )}

          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <h2 className="text-3xl font-bold mb-2 tracking-tight">Vehicle Details</h2>
              <p className="text-black/50 mb-10 text-sm font-medium">What will you be riding?</p>
              
              <div className="space-y-4 mb-10">
                {["bike", "scooter", "ev", "bicycle"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setFormData({ ...formData, vehicleType: type })}
                    className={`w-full p-5 rounded-[24px] border-2 flex items-center justify-between transition-all group ${
                      formData.vehicleType === type 
                        ? "border-brand-primary bg-brand-primary/5 shadow-sm" 
                        : "border-black/5 hover:border-black/10 hover:bg-brand-light"
                    }`}
                  >
                    <span className={`capitalize font-semibold text-lg transition-colors ${formData.vehicleType === type ? 'text-brand-primary' : 'text-brand-dark'}`}>{type}</span>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                      formData.vehicleType === type ? "border-brand-primary" : "border-black/20 group-hover:border-black/40"
                    }`}>
                      {formData.vehicleType === type && <div className="w-2.5 h-2.5 rounded-full bg-brand-primary" />}
                    </div>
                  </button>
                ))}
              </div>
              
              <button 
                onClick={() => setStep(2)}
                className="w-full bg-brand-dark hover:bg-black text-white font-bold py-5 rounded-full transition-all shadow-xl shadow-black/10 flex items-center justify-center group"
              >
                Continue <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
              <h2 className="text-3xl font-bold mb-2 tracking-tight">Identity & Docs</h2>
              <p className="text-black/50 mb-10 text-sm font-medium">We need this for your background check.</p>
              
              <div className="mb-8">
                <label className="block text-sm font-bold text-brand-dark mb-3">Driver's License / Govt ID Number</label>
                <input
                  type="text"
                  value={formData.licenseNumber}
                  onChange={(e) => setFormData({ ...formData, licenseNumber: e.target.value })}
                  placeholder="e.g. DL-1234567890"
                  className="w-full bg-brand-light border border-black/10 rounded-[24px] px-6 py-5 text-brand-dark font-medium focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary transition-all placeholder:text-black/30"
                />
              </div>

              <div className="mb-10">
                <label className="block text-sm font-bold text-brand-dark mb-3">Upload ID Photo <span className="text-black/40 font-normal">(Optional for now)</span></label>
                <input 
                  type="file" 
                  id="id-upload" 
                  className="hidden" 
                  accept="image/*"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setFormData({ ...formData, idPhoto: e.target.files[0] });
                    }
                  }}
                />
                <label 
                  htmlFor="id-upload"
                  className="w-full border-2 border-dashed border-black/10 rounded-[24px] p-10 flex flex-col items-center justify-center text-black/40 bg-brand-light hover:bg-black/5 hover:border-black/20 transition-all cursor-pointer group"
                >
                  <div className="w-16 h-16 rounded-full bg-white shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    {formData.idPhoto ? (
                       <CheckCircle2 size={24} className="text-[#00D084]" />
                    ) : (
                       <UploadCloud size={24} className="text-brand-primary" />
                    )}
                  </div>
                  <span className="text-sm font-semibold text-brand-dark">
                    {formData.idPhoto ? formData.idPhoto.name : "Tap to select a file"}
                  </span>
                </label>
              </div>
              
              <button 
                onClick={handleSubmit}
                disabled={submitting}
                className="w-full bg-brand-primary hover:bg-brand-primary-dark disabled:opacity-50 text-white font-bold py-5 rounded-full transition-all flex justify-center items-center shadow-xl shadow-brand-primary/20"
              >
                {submitting ? (
                  <div className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Submit Application"
                )}
              </button>
            </div>
          )}

          {step === 4 && (
            <div className="text-center animate-in fade-in zoom-in-95 py-10 duration-500">
              {error ? (
                <>
                  <div className="mx-auto w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mb-8 border-[6px] border-white shadow-sm">
                    <AlertCircle className="text-red-500" size={40} />
                  </div>
                  <h2 className="text-3xl font-bold mb-4 tracking-tight">Application Rejected</h2>
                  <p className="text-black/60 mb-10 font-medium leading-relaxed">{error}</p>
                  <button 
                    onClick={() => router.push("/profile")}
                    className="w-full bg-brand-dark hover:bg-black text-white font-bold py-5 rounded-full transition-all shadow-xl"
                  >
                    View Status in Profile
                  </button>
                </>
              ) : (
                <>
                  <div className="mx-auto w-24 h-24 bg-[#00D084]/10 rounded-full flex items-center justify-center mb-8 border-[6px] border-white shadow-sm">
                    <CheckCircle2 className="text-[#00D084]" size={40} />
                  </div>
                  <h2 className="text-3xl font-bold mb-4 tracking-tight">Application Pending</h2>
                  <p className="text-black/60 mb-10 font-medium leading-relaxed">
                    Your application has been received and is currently under review by our operations team. We will notify you once approved.
                  </p>
                  <button 
                    onClick={() => router.push("/profile")}
                    className="w-full bg-brand-dark hover:bg-black text-white font-bold py-5 rounded-full transition-all shadow-xl"
                  >
                    View Status in Profile
                  </button>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
