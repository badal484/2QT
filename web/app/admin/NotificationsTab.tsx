"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Edit3, Save, X, RefreshCw, Send, CheckCircle2, XCircle, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Search } from "lucide-react";
import { toast } from "sonner";
import { api } from "../lib/api";
import { motion, AnimatePresence } from "framer-motion";

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

      {!editing ? (
        <div className="space-y-1.5">
          <p className="text-xs text-zinc-400"><span className="text-zinc-600">Title:</span> {tmpl.title_template}</p>
          <p className="text-xs text-zinc-400"><span className="text-zinc-600">Body:</span> {tmpl.body_template}</p>
          {tmpl.whatsapp_template && (
            <p className="text-xs text-zinc-400"><span className="text-zinc-600">WA:</span> {tmpl.whatsapp_template}</p>
          )}
        </div>
      ) : (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Title template</label>
              <input
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
                value={form.title_template}
                onChange={e => setForm(f => ({ ...f, title_template: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Push body</label>
              <textarea
                rows={2}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500 resize-none"
                value={form.body_template}
                onChange={e => setForm(f => ({ ...f, body_template: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">WhatsApp message</label>
              <textarea
                rows={2}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500 resize-none"
                value={form.whatsapp_template}
                onChange={e => setForm(f => ({ ...f, whatsapp_template: e.target.value }))}
              />
            </div>
            <p className="text-xs text-zinc-600">Variables: {"{{displayId}} {{riderName}} {{otp}} {{minutes}} {{amount}} {{upiId}} {{count}}"}</p>
            <button
              onClick={save}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-black rounded-lg text-xs font-medium hover:bg-zinc-100 disabled:opacity-50 transition-colors"
            >
              {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              Save
            </button>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

// ─── Broadcast sub-tab ────────────────────────────────────────────────────────

function BroadcastPanel() {
  const [segment, setSegment] = useState<"all" | "zone" | "active_last_7">("all");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [zones, setZones] = useState<{ id: string; name: string }[]>([]);
  const [zoneId, setZoneId] = useState("");

  useEffect(() => {
    api.get("/admin/zones").then((d: any) => setZones(d.zones ?? [])).catch(() => {});
  }, []);

  async function send() {
    if (!title.trim() || !message.trim()) return toast.error("Title and message required");
    setSending(true);
    try {
      await api.post("/admin/broadcast", {
        segment,
        zoneId: segment === "zone" ? zoneId : undefined,
        title,
        message,
      });
      toast.success("Broadcast queued!");
      setTitle(""); setMessage("");
    } catch {
      toast.error("Broadcast failed");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="max-w-xl space-y-4">
      <div>
        <label className="text-xs text-zinc-500 mb-1.5 block">Audience</label>
        <div className="flex gap-2">
          {(["all", "zone", "active_last_7"] as const).map(s => (
            <button
              key={s}
              onClick={() => setSegment(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${segment === s ? "bg-white text-black" : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"}`}
            >
              {s === "all" ? "All Customers" : s === "zone" ? "By Zone" : "Active (7d)"}
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
      <button
        onClick={send}
        disabled={sending}
        className="flex items-center gap-2 px-4 py-2 bg-white text-black rounded-xl text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 transition-colors"
      >
        {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        {sending ? "Sending…" : "Send Broadcast"}
      </button>
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
      const d: any = await api.get(`/notifications/admin/log?${params.toString()}`);
      setLogs(d.notifications ?? []);
    } catch {
      toast.error("Failed to load log");
    } finally {
      setLoading(false);
    }
  }, [typeFilter, statusFilter]);

  useEffect(() => { load(); }, [load]);

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
        <select
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none"
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
        >
          <option value="">All types</option>
          {["order_confirmed","order_preparing","order_ready","order_out_for_delivery","order_delivered","order_cancelled","rider_payout","kitchen_payout","broadcast_message","rider_verified"].map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select
          className="bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-300 focus:outline-none"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
          <option value="skipped">Skipped</option>
        </select>
        <button onClick={load} className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 transition-colors">
          <RefreshCw className={`w-4 h-4 text-zinc-400 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-zinc-600 text-sm">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center text-zinc-600 text-sm">No notifications found</div>
      ) : (
        <div className="rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900/60">
              <tr className="text-left">
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium">User</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium">Type</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium">Title</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium">Channel</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium">Status</th>
                <th className="px-4 py-3 text-xs text-zinc-500 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {filtered.map(n => (
                <tr key={n.id} className="hover:bg-zinc-900/40 transition-colors">
                  <td className="px-4 py-3">
                    <p className="text-white text-xs font-medium">{n.user_name ?? "—"}</p>
                    <p className="text-zinc-600 text-xs">{n.user_phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-zinc-400">{n.type}</span>
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <p className="text-zinc-300 text-xs truncate">{n.title}</p>
                    <p className="text-zinc-600 text-xs truncate">{n.body}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-xs bg-zinc-800 text-zinc-400">{n.channel}</span>
                  </td>
                  <td className="px-4 py-3">
                    {n.delivery_status === "sent" ? (
                      <span className="flex items-center gap-1 text-xs text-green-400">
                        <CheckCircle2 className="w-3 h-3" /> sent
                      </span>
                    ) : n.delivery_status === "failed" ? (
                      <span className="flex items-center gap-1 text-xs text-red-400">
                        <XCircle className="w-3 h-3" /> failed
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-600">{n.delivery_status}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-zinc-600 whitespace-nowrap">
                    {new Date(n.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main NotificationsTab ─────────────────────────────────────────────────────

export function NotificationsTab() {
  const [subTab, setSubTab] = useState<"templates" | "broadcast" | "log">("templates");
  const [templates, setTemplates] = useState<NotifTemplate[]>([]);
  const [loadingTmpls, setLoadingTmpls] = useState(true);

  const loadTemplates = useCallback(async () => {
    setLoadingTmpls(true);
    try {
      const d: any = await api.get("/notifications/admin/templates");
      setTemplates(d.templates ?? []);
    } catch {
      toast.error("Failed to load templates");
    } finally {
      setLoadingTmpls(false);
    }
  }, []);

  useEffect(() => { loadTemplates(); }, [loadTemplates]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Bell className="w-5 h-5 text-zinc-400" />
        <div>
          <h2 className="text-white font-semibold text-lg">Notifications</h2>
          <p className="text-zinc-500 text-sm">Manage templates, broadcast to customers, view delivery log</p>
        </div>
      </div>

      {/* Sub-tab switcher */}
      <div className="flex gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1 w-fit">
        {(["templates", "broadcast", "log"] as const).map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${subTab === t ? "bg-white text-black" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            {t}
          </button>
        ))}
      </div>

      {subTab === "templates" && (
        <div>
          {loadingTmpls ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-32 bg-zinc-900 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {templates.map(t => (
                <TemplateCard key={t.type} tmpl={t} onSaved={loadTemplates} />
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === "broadcast" && <BroadcastPanel />}
      {subTab === "log" && <LogPanel />}
    </div>
  );
}
