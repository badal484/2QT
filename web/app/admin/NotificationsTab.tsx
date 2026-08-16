"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Edit3, Save, X, RefreshCw, Send, CheckCircle2, XCircle, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Search, Zap, Plus, Trash2, Clock } from "lucide-react";
import { SkeletonList, SkeletonTableRow } from "../components/ui/Skeleton";
import { toast } from "sonner";
import { api } from "../lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { useSocketRefresh } from "../hooks/useSocketRefresh";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface NotifTemplate {
  id: string;
  type: string;
  label: string;
  title_template: string;
  body_template: string;
  whatsapp_template: string | null;
  channels: string[];
  is_active: boolean;
}

interface NotifLog {
  id: string;
  type: string;
  title: string;
  body: string;
  channel: string;
  delivery_status: string;
  is_read: boolean;
  created_at: string;
  user_name: string;
  user_phone: string;
}

// ─── Templates sub-tab ────────────────────────────────────────────────────────

function TemplateCard({ tmpl, onSaved }: { tmpl: NotifTemplate; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title_template: tmpl.title_template,
    body_template: tmpl.body_template,
    whatsapp_template: tmpl.whatsapp_template ?? "",
    is_active: tmpl.is_active,
  });

  async function save() {
    setSaving(true);
    try {
      await api.patch(`/notifications/admin/templates/${tmpl.type}`, form);
      toast.success("Template saved");
      setEditing(false);
      onSaved();
    } catch {
      toast.error("Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    try {
      await api.patch(`/notifications/admin/templates/${tmpl.type}`, { is_active: !tmpl.is_active });
      toast.success(tmpl.is_active ? "Disabled" : "Enabled");
      onSaved();
    } catch {
      toast.error("Update failed");
    }
  }

  return (
    <div className={`rounded-xl border ${tmpl.is_active ? "border-zinc-800" : "border-zinc-800/40 opacity-60"} bg-zinc-900 p-4`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="font-medium text-sm text-white">{tmpl.label}</p>
          <p className="text-xs text-zinc-500 font-mono mt-0.5">{tmpl.type}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={toggleActive} title={tmpl.is_active ? "Disable" : "Enable"}>
            {tmpl.is_active
              ? <ToggleRight className="w-5 h-5 text-green-400" />
              : <ToggleLeft className="w-5 h-5 text-zinc-600" />}
          </button>
          <button
            onClick={() => setEditing(e => !e)}
            className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            {editing ? <X className="w-4 h-4 text-zinc-400" /> : <Edit3 className="w-4 h-4 text-zinc-400" />}
          </button>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap mb-3">
        {tmpl.channels.map(c => (
          <span key={c} className="px-2 py-0.5 rounded-full text-xs bg-zinc-800 text-zinc-400 font-mono">{c}</span>
        ))}
      </div>

      {editing ? (
        <div className="space-y-3 pt-2 border-t border-zinc-800">
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Title Template</label>
            <input
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
              value={form.title_template}
              onChange={e => setForm(f => ({ ...f, title_template: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Push / In-App Body</label>
            <textarea
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
              value={form.body_template}
              onChange={e => setForm(f => ({ ...f, body_template: e.target.value }))}
            />
          </div>
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">WhatsApp Template (optional)</label>
            <textarea
              rows={2}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
              value={form.whatsapp_template}
              onChange={e => setForm(f => ({ ...f, whatsapp_template: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="px-3 py-1 text-xs text-zinc-400 hover:text-white">Cancel</button>
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1 bg-white text-black rounded-lg text-xs font-medium hover:bg-zinc-100 disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-1.5 text-xs text-zinc-300">
          <p><span className="text-zinc-500">Title: </span>{tmpl.title_template}</p>
          <p><span className="text-zinc-500">Body: </span>{tmpl.body_template}</p>
          {tmpl.whatsapp_template && <p className="text-zinc-400 font-mono text-[11px]"><span className="text-zinc-500">WA: </span>{tmpl.whatsapp_template}</p>}
        </div>
      )}
    </div>
  );
}

// ─── Broadcast sub-tab ────────────────────────────────────────────────────────

function BroadcastPanel({ zones }: { zones: { id: string; name: string }[] }) {
  const [segment, setSegment] = useState<string>("customers");
  const [zoneId, setZoneId] = useState("");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  const loadCampaigns = useCallback(async () => {
    try {
      const res: any = await api.get("/admin/broadcast");
      if (res.success) {
        setCampaigns(res.campaigns || []);
      }
    } catch {
      // Ignore fallback
    }
  }, []);

  useEffect(() => {
    loadCampaigns();
    const timer = setInterval(loadCampaigns, 5000);
    return () => clearInterval(timer);
  }, [loadCampaigns]);

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res: any = await api.post("/upload", fd);
      if (res.url) {
        setImageUrl(res.url);
        toast.success("Image uploaded!");
      }
    } catch {
      toast.error("Image upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function send() {
    if (!title.trim() || !message.trim()) return toast.error("Title and message required");
    setSending(true);
    try {
      await api.post("/admin/broadcast", {
        segment,
        targetType: segment === "customers" ? "buyers" : segment,
        zoneId: segment === "zone" ? zoneId : undefined,
        title,
        message,
        body: message,
        imageUrl: imageUrl.trim() || undefined,
      });
      toast.success("Broadcast campaign queued successfully!");
      setTitle(""); setMessage(""); setImageUrl("");
      loadCampaigns();
    } catch (err: any) {
      toast.error(err?.message || "Broadcast failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div className="max-w-xl space-y-4">
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Audience</label>
          <div className="flex gap-2 flex-wrap">
            {(["customers", "zone", "active_last_7", "riders", "kitchens", "everyone"] as const).map(s => (
              <button
                key={s}
                onClick={() => setSegment(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${segment === s ? "bg-white text-black" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
              >
                {s === "customers" ? "All Customers" : s === "zone" ? "By Zone" : s === "active_last_7" ? "Active (7d)" : s === "riders" ? "Riders" : s === "kitchens" ? "Kitchen Partners" : "Everyone"}
              </button>
            ))}
          </div>
          {segment === "zone" && (
            <select
              className="mt-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white w-full focus:outline-none"
              value={zoneId}
              onChange={e => setZoneId(e.target.value)}
            >
              <option value="">Select zone…</option>
              {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          )}
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Notification title</label>
          <input
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
            placeholder="e.g. Weekend Flash Sale 🎉"
            value={title}
            onChange={e => setTitle(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Message body</label>
          <textarea
            rows={4}
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500 resize-none"
            placeholder="Write your message. Use {{name}} for customer name."
            value={message}
            onChange={e => setMessage(e.target.value)}
          />
          <p className="text-xs text-zinc-600 mt-1">{message.length}/300 characters</p>
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1.5 block">Image <span className="text-zinc-600">(optional — shown as banner in notification)</span></label>
          <label className={`flex items-center gap-2 w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm cursor-pointer hover:bg-zinc-700 transition-colors ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
            {uploading ? <RefreshCw className="w-4 h-4 animate-spin text-zinc-400" /> : <span className="text-zinc-400">📎</span>}
            <span className="text-zinc-400">{uploading ? "Uploading…" : imageUrl ? "Change image" : "Upload image"}</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploading} />
          </label>
          {imageUrl && (
            <div className="mt-2 relative">
              <img src={imageUrl} alt="preview" className="rounded-lg w-full max-h-40 object-cover" />
              <button onClick={() => setImageUrl("")} className="absolute top-1 right-1 bg-black/60 text-white text-xs px-2 py-0.5 rounded-md hover:bg-black/80">Remove</button>
            </div>
          )}
        </div>
        <button
          onClick={send}
          disabled={sending}
          className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 transition-colors"
        >
          {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          {sending ? "Sending…" : "Send Broadcast"}
        </button>
      </div>

      {/* Broadcast Campaign Status List */}
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-white flex items-center justify-between">
          <span>Recent Broadcast Campaigns</span>
          <button onClick={loadCampaigns} className="text-xs text-zinc-400 hover:text-white flex items-center gap-1">
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </h3>
        {campaigns.length === 0 ? (
          <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 text-xs text-zinc-500">
            No broadcast campaigns sent yet.
          </div>
        ) : (
          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {campaigns.map((c) => (
              <div key={c.id} className="p-3 rounded-xl border border-zinc-800 bg-zinc-900 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-xs text-white">{c.title}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                    c.status === 'COMPLETED' ? 'bg-green-500/10 text-green-400' :
                    c.status === 'PROCESSING' ? 'bg-yellow-500/10 text-yellow-400' :
                    'bg-zinc-800 text-zinc-400'
                  }`}>
                    {c.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-400 line-clamp-2">{c.body}</p>
                <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-zinc-800/60">
                  <span>Target: <strong className="text-zinc-300 capitalize">{c.target_type}</strong></span>
                  <span>Sent: <strong className="text-green-400">{c.sent_count}</strong> / {c.total_recipients}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Log sub-tab ──────────────────────────────────────────────────────────────

function LogPanel() {
  const [logs, setLogs] = useState<NotifLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (typeFilter) params.set("type", typeFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (search) params.set("search", search);
      const d: any = await api.get(`/notifications/admin/log?${params.toString()}`);
      setLogs(d.notifications ?? []);
    } catch {
      toast.error("Failed to load log");
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  useSocketRefresh(["new_notification", "notification_updated"], load);

  const filtered = search
    ? logs.filter(l =>
        l.user_name?.toLowerCase().includes(search.toLowerCase()) ||
        l.user_phone?.includes(search) ||
        l.title.toLowerCase().includes(search.toLowerCase())
      )
    : logs;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
          <input
            className="pl-8 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 w-48"
            placeholder="Search user or title…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <SkeletonList rows={5} />
      ) : (
        <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-900">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-800/50 text-zinc-400 border-b border-zinc-800">
              <tr>
                <th className="p-3 font-medium">Recipient</th>
                <th className="p-3 font-medium">Notification</th>
                <th className="p-3 font-medium">Channel</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
              {filtered.map(l => (
                <tr key={l.id} className="hover:bg-zinc-800/30">
                  <td className="p-3">
                    <p className="font-medium text-white">{l.user_name || "Unknown"}</p>
                    <p className="text-[11px] text-zinc-500 font-mono">{l.user_phone}</p>
                  </td>
                  <td className="p-3">
                    <p className="font-medium text-white">{l.title}</p>
                    <p className="text-[11px] text-zinc-400 line-clamp-1">{l.body}</p>
                  </td>
                  <td className="p-3 font-mono text-[11px] text-zinc-400">{l.channel}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${l.delivery_status === "delivered" ? "bg-green-500/10 text-green-400" : "bg-yellow-500/10 text-yellow-400"}`}>
                      {l.delivery_status}
                    </span>
                  </td>
                  <td className="p-3 text-[11px] text-zinc-500">{new Date(l.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function NotificationsTab() {
  const [activeTab, setActiveTab] = useState<"templates" | "broadcast" | "log">("broadcast");
  const [templates, setTemplates] = useState<NotifTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [zones, setZones] = useState<{ id: string; name: string }[]>([]);

  const loadTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const d: any = await api.get("/notifications/admin/templates");
      setTemplates(d.templates ?? []);
    } catch {
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
    api.get("/admin/zones").then((d: any) => setZones(d.zones ?? [])).catch(() => {});
  }, [loadTemplates]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <Bell className="w-5 h-5 text-orange-500" /> Notifications
        </h1>
        <p className="text-xs text-zinc-400 mt-1">Manage templates, broadcast to customers, view delivery log</p>
      </div>

      <div className="flex gap-2 border-b border-zinc-800 pb-3">
        {(["broadcast", "templates", "log"] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-xs font-medium capitalize transition-colors ${activeTab === tab ? "bg-white text-black" : "bg-zinc-900 text-zinc-400 hover:text-white hover:bg-zinc-800"}`}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "broadcast" && <BroadcastPanel zones={zones} />}

      {activeTab === "templates" && (
        loading ? (
          <SkeletonList rows={4} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {templates.map(tmpl => (
              <TemplateCard key={tmpl.id} tmpl={tmpl} onSaved={loadTemplates} />
            ))}
          </div>
        )
      )}

      {activeTab === "log" && <LogPanel />}
    </div>
  );
}

export default NotificationsTab;
