import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, FileText, CheckCircle, Clock, XCircle, Car, CreditCard, Upload, Camera, Loader2 } from "lucide-react";
import { api } from "../../lib/api";
import { toast } from "sonner";
import { uploadToImageKit } from "../../utils/imageKit";

const VEHICLE_TYPES = ["bicycle", "motorcycle", "scooter", "car"];

const STATUS_CONFIG: Record<string, any> = {
  pending: { label: "Under Review", color: "text-amber-500", bg: "bg-amber-500/10", border: "border-amber-500/30", Icon: Clock },
  approved: { label: "Verified", color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/30", Icon: CheckCircle },
  rejected: { label: "Rejected", color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500/30", Icon: XCircle },
};

export function RiderDocumentsModal({ onClose }: { onClose: () => void }) {
  const [doc, setDoc] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [vehicleType, setVehicleType] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [idPhotoUrl, setIdPhotoUrl] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocs = async () => {
    try {
      const data = await api.get("/riders/documents");
      setDoc(data);
      if (data) {
        setVehicleType(data.vehicle_type || "");
        setLicenseNumber(data.license_number || "");
        setIdPhotoUrl(data.id_photo_url || null);
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const uploaded = await uploadToImageKit(file, "rider_docs");
      setIdPhotoUrl(uploaded.url);
      toast.success("Photo uploaded!");
    } catch (err: any) {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSave = async () => {
    if (!vehicleType) {
      toast.error("Please select a vehicle type");
      return;
    }
    setSaving(true);
    try {
      await api.patch("/riders/documents", { vehicleType, licenseNumber, idPhotoUrl });
      toast.success("Documents submitted for verification");
      onClose();
    } catch (e: any) {
      toast.error(e.message || "Failed to save documents");
    } finally {
      setSaving(false);
    }
  };

  const status = doc?.status;
  const cfg = status ? STATUS_CONFIG[status] : null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-950/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-[#111] border border-white/10 rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
      >
        <div className="p-6 border-b border-white/[0.05] flex justify-between items-center bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center border border-orange-500/20">
              <FileText className="w-5 h-5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white leading-none">My Documents</h2>
              <p className="text-zinc-500 text-xs font-semibold mt-1">Verification & Details</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-white/10 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : (
            <>
              {cfg && (
                <div className={`p-4 rounded-2xl border ${cfg.bg} ${cfg.border} flex items-start gap-3`}>
                  <cfg.Icon className={`w-5 h-5 ${cfg.color} mt-0.5`} />
                  <div>
                    <h3 className={`text-sm font-bold ${cfg.color}`}>{cfg.label}</h3>
                    {status === "rejected" && doc?.rejection_reason && (
                      <p className="text-xs text-red-400/80 mt-1 font-semibold">{doc.rejection_reason}</p>
                    )}
                  </div>
                </div>
              )}

              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-3">Vehicle Type</h3>
                <div className="grid grid-cols-2 gap-3">
                  {VEHICLE_TYPES.map(v => (
                    <button
                      key={v}
                      onClick={() => setVehicleType(v)}
                      className={`flex items-center gap-2 p-3 rounded-xl border transition-all ${
                        vehicleType === v ? "bg-orange-500/10 border-orange-500/30 text-orange-400" : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <Car className="w-4 h-4" />
                      <span className="text-sm font-bold capitalize">{v}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-3">License / Registration Number</h3>
                <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3">
                  <CreditCard className="w-5 h-5 text-zinc-500" />
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => setLicenseNumber(e.target.value.toUpperCase())}
                    placeholder="Enter license number"
                    className="bg-transparent border-none outline-none text-white font-bold flex-1 placeholder:text-zinc-600"
                  />
                </div>
              </div>

              <div>
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-3">ID / License Photo</h3>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />
                
                {idPhotoUrl ? (
                  <div className="relative rounded-2xl overflow-hidden border border-white/10 group h-48 bg-zinc-900">
                    <img src={idPhotoUrl} alt="ID" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button onClick={() => fileInputRef.current?.click()} className="px-4 py-2 bg-white/10 rounded-xl text-white font-bold text-sm backdrop-blur-md flex items-center gap-2">
                        <Upload className="w-4 h-4" /> Re-upload
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full h-32 rounded-2xl border-2 border-dashed border-white/10 hover:border-orange-500/50 hover:bg-orange-500/5 flex flex-col items-center justify-center gap-2 transition-all"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
                        <span className="text-xs font-bold text-orange-500">Uploading...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-8 h-8 text-zinc-600" />
                        <span className="text-sm font-bold text-zinc-400">Tap to upload photo</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </>
          )}
        </div>

        <div className="p-6 pt-0 mt-auto">
          <button
            onClick={handleSave}
            disabled={saving || uploading || loading}
            className="w-full py-4 rounded-xl bg-orange-500 text-white font-black text-sm uppercase tracking-widest hover:bg-orange-600 disabled:opacity-50 flex items-center justify-center transition-colors shadow-[0_0_20px_rgba(255,107,53,0.3)]"
          >
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit for Verification"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
