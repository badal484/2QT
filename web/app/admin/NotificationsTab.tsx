"use client";

import { useState, useEffect, useCallback } from "react";
import { Bell, Edit3, Save, X, RefreshCw, Send, CheckCircle2, XCircle, ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Search, Zap, Plus, Trash2, Clock } from "lucide-react";
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
  const [imageUrl, setImageUrl] = useState("");
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
        imageUrl: imageUrl.trim() || undefined,
      });
      toast.success("Broadcast queued!");
      setTitle(""); setMessage(""); setImageUrl("");
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
      <div>
        <label className="text-xs text-zinc-500 mb-1.5 block">Image URL <span className="text-zinc-600">(optional — shown as banner in notification)</span></label>
        <input
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
          placeholder="https://example.com/promo-banner.jpg"
          value={imageUrl}
          onChange={e => setImageUrl(e.target.value)}
        />
        {imageUrl.trim() && (
          <img src={imageUrl} alt="preview" className="mt-2 rounded-lg w-full max-h-32 object-cover opacity-80" onError={e => (e.currentTarget.style.display = 'none')} />
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

// ─── Trigger Rules sub-tab ────────────────────────────────────────────────────

interface NotifTrigger {
  id: string;
  name: string;
  event_type: string;
  delay_minutes: number;
  template_type: string;
  channels: string[];
  audience_type: string;
  segment: string | null;
  conditions: Record<string, any>;
  is_active: boolean;
  fired_count: number;
  last_fired_at: string | null;
}

const EVENT_LABELS: Record<string, string> = {
  order_delivered: "After delivery",
  cart_abandoned: "Cart abandoned",
  no_order_days: "Inactive users (daily)",
  wallet_low: "Wallet balance low",
  subscription_expiring: "Subscription expiring (daily)",
  birthday_tomorrow: "Birthday tomorrow (daily)",
  happy_hour_starting: "Happy hour starting",
};

const SEGMENT_LABELS: Record<string, string> = {
  new_users: "New users",
  active: "Active (14d)",
  at_risk: "At risk (7–14d)",
  churned: "Churned (30d+)",
  loyal: "Loyal (10+ orders)",
  subscribers: "Subscribers",
};

const BLANK_TRIGGER = {
  name: "",
  event_type: "order_delivered",
  delay_minutes: 45,
  template_type: "broadcast_message",
  channels: ["push", "whatsapp"],
  audience_type: "all",
  segment: "",
  conditions: {} as Record<string, any>,
};

function TriggerRulesPanel() {
  const [triggers, setTriggers] = useState<NotifTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...BLANK_TRIGGER });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const d: any = await api.get("/notifications/admin/triggers");
      setTriggers(d.triggers ?? []);
    } catch { toast.error("Failed to load triggers"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openCreate() {
    setForm({ ...BLANK_TRIGGER });
    setEditingId(null);
    setShowForm(true);
  }

  function openEdit(t: NotifTrigger) {
    setForm({
      name: t.name,
      event_type: t.event_type,
      delay_minutes: t.delay_minutes,
      template_type: t.template_type,
      channels: t.channels,
      audience_type: t.audience_type,
      segment: t.segment ?? "",
      conditions: t.conditions ?? {},
    });
    setEditingId(t.id);
    setShowForm(true);
  }

  async function save() {
    if (!form.name || !form.event_type || !form.template_type) {
      return toast.error("Name, event and template are required");
    }
    setSaving(true);
    try {
      const payload = { ...form, segment: form.segment || null };
      if (editingId) {
        await api.patch(`/notifications/admin/triggers/${editingId}`, payload);
        toast.success("Trigger updated");
      } else {
        await api.post("/notifications/admin/triggers", payload);
        toast.success("Trigger created");
      }
      setShowForm(false);
      load();
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  }

  async function toggle(t: NotifTrigger) {
    try {
      await api.patch(`/notifications/admin/triggers/${t.id}`, { is_active: !t.is_active });
      toast.success(t.is_active ? "Disabled" : "Enabled");
      load();
    } catch { toast.error("Update failed"); }
  }

  async function remove(id: string) {
    if (!confirm("Delete this trigger rule?")) return;
    try {
      await api.delete(`/notifications/admin/triggers/${id}`);
      toast.success("Deleted");
      load();
    } catch { toast.error("Delete failed"); }
  }

  const needsDelay = ["order_delivered", "cart_abandoned", "happy_hour_starting"].includes(form.event_type);
  const needsInactiveDays = form.event_type === "no_order_days";
  const needsExpiryDays = form.event_type === "subscription_expiring";
  const needsWalletThreshold = form.event_type === "wallet_low";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-400">Automated rules that fire based on customer events. Toggle ON to activate.</p>
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-zinc-100 transition-colors"
        >
          <Plus className="w-4 h-4" /> New Rule
        </button>
      </div>

      {/* Form modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-xl border border-zinc-700 bg-zinc-900 p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <p className="text-white font-medium text-sm">{editingId ? "Edit Rule" : "New Trigger Rule"}</p>
              <button onClick={() => setShowForm(false)}><X className="w-4 h-4 text-zinc-500" /></button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Rule name</label>
                <input
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-zinc-500"
                  placeholder="e.g. Rating Reminder"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Trigger event</label>
                <select
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  value={form.event_type}
                  onChange={e => setForm(f => ({ ...f, event_type: e.target.value, conditions: {} }))}
                >
                  {Object.entries(EVENT_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              {needsDelay && (
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Delay (minutes)</label>
                  <input
                    type="number" min={0}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    value={form.delay_minutes}
                    onChange={e => setForm(f => ({ ...f, delay_minutes: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              )}
              {needsInactiveDays && (
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Inactive for (days)</label>
                  <input
                    type="number" min={1}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    value={form.conditions.inactive_days ?? 7}
                    onChange={e => setForm(f => ({ ...f, conditions: { ...f.conditions, inactive_days: parseInt(e.target.value) || 7 } }))}
                  />
                </div>
              )}
              {needsExpiryDays && (
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Days before expiry</label>
                  <input
                    type="number" min={1}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    value={form.conditions.expiry_days ?? 3}
                    onChange={e => setForm(f => ({ ...f, conditions: { ...f.conditions, expiry_days: parseInt(e.target.value) || 3 } }))}
                  />
                </div>
              )}
              {needsWalletThreshold && (
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Fire when wallet below (₹)</label>
                  <input
                    type="number" min={1}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    value={(form.conditions.max_balance_paise ?? 10000) / 100}
                    onChange={e => setForm(f => ({ ...f, conditions: { ...f.conditions, max_balance_paise: (parseInt(e.target.value) || 100) * 100 } }))}
                  />
                </div>
              )}
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Template</label>
                <input
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  placeholder="e.g. broadcast_message"
                  value={form.template_type}
                  onChange={e => setForm(f => ({ ...f, template_type: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Audience</label>
                <select
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                  value={form.audience_type}
                  onChange={e => setForm(f => ({ ...f, audience_type: e.target.value, segment: "" }))}
                >
                  <option value="all">All customers</option>
                  <option value="segment">Segment</option>
                </select>
              </div>
              {form.audience_type === "segment" && (
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">Segment</label>
                  <select
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none"
                    value={form.segment}
                    onChange={e => setForm(f => ({ ...f, segment: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {Object.entries(SEGMENT_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
              )}
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">Channels</label>
                <div className="flex gap-2 mt-1">
                  {["push", "whatsapp"].map(ch => (
                    <label key={ch} className="flex items-center gap-1.5 text-sm text-zinc-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={form.channels.includes(ch)}
                        onChange={e => {
                          const next = e.target.checked
                            ? [...form.channels, ch]
                            : form.channels.filter(c => c !== ch);
                          setForm(f => ({ ...f, channels: next }));
                        }}
                        className="accent-white"
                      />
                      {ch}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-white text-black rounded-lg text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 transition-colors"
              >
                {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {editingId ? "Update" : "Create"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm hover:bg-zinc-700 transition-colors">
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rules list */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 bg-zinc-900 rounded-xl animate-pulse" />)}
        </div>
      ) : triggers.length === 0 ? (
        <div className="py-12 text-center text-zinc-600 text-sm">No trigger rules yet. Click "New Rule" to create one.</div>
      ) : (
        <div className="space-y-3">
          {triggers.map(t => (
            <div key={t.id} className={`rounded-xl border ${t.is_active ? "border-zinc-800" : "border-zinc-800/40 opacity-60"} bg-zinc-900 p-4`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-white text-sm font-medium">{t.name}</p>
                    <span className="px-2 py-0.5 rounded-full text-xs bg-zinc-800 text-zinc-400 font-mono">{EVENT_LABELS[t.event_type] ?? t.event_type}</span>
                    {t.delay_minutes > 0 && (
                      <span className="flex items-center gap-1 text-xs text-zinc-500">
                        <Clock className="w-3 h-3" />{t.delay_minutes}m delay
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="text-xs text-zinc-500">
                      Template: <span className="text-zinc-400 font-mono">{t.template_type}</span>
                    </span>
                    <span className="text-xs text-zinc-500">
                      Audience: <span className="text-zinc-400">{t.audience_type === "segment" ? (SEGMENT_LABELS[t.segment ?? ""] ?? t.segment) : "All customers"}</span>
                    </span>
                    <span className="text-xs text-zinc-500">
                      Fired: <span className="text-zinc-400">{t.fired_count.toLocaleString()}</span>
                    </span>
                    {t.last_fired_at && (
                      <span className="text-xs text-zinc-600">
                        Last: {new Date(t.last_fired_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 mt-1.5">
                    {t.channels.map(c => (
                      <span key={c} className="px-1.5 py-0.5 rounded text-xs bg-zinc-800 text-zinc-500">{c}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggle(t)} title={t.is_active ? "Disable" : "Enable"}>
                    {t.is_active
                      ? <ToggleRight className="w-5 h-5 text-green-400" />
                      : <ToggleLeft className="w-5 h-5 text-zinc-600" />}
                  </button>
                  <button onClick={() => openEdit(t)} className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
                    <Edit3 className="w-4 h-4 text-zinc-400" />
                  </button>
                  <button onClick={() => remove(t.id)} className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors">
                    <Trash2 className="w-4 h-4 text-red-500/70" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main NotificationsTab ─────────────────────────────────────────────────────

export function NotificationsTab() {
  const [subTab, setSubTab] = useState<"templates" | "broadcast" | "triggers" | "log">("templates");
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
        {(["templates", "broadcast", "triggers", "log"] as const).map(t => (
          <button
            key={t}
            onClick={() => setSubTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition-all ${subTab === t ? "bg-white text-black" : "text-zinc-400 hover:text-zinc-200"}`}
          >
            {t === "triggers" ? "Trigger Rules" : t}
          </button>
        ))}
      </div>

      {subTab === "triggers" && <TriggerRulesPanel />}

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
