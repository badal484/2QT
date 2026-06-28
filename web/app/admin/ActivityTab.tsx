import { useState, useEffect } from 'react';
import { RefreshCw, Activity, User, Bike, ChefHat, ShieldAlert, CheckCircle, Search, Wallet } from 'lucide-react'; // Lucide for React Native? No, this is Next.js. Wait, this is a web app. Let me fix imports.
import { api } from '../lib/api';
import { useSocketRefresh } from '../hooks/useSocketRefresh';

export default function ActivityTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleFilter, setRoleFilter] = useState('all');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/admin/activity-logs?limit=100&role=${roleFilter}`);
      setLogs(res.logs || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLogs();
  }, [roleFilter]);

  useSocketRefresh(['new_activity_log'], () => {
  // (newLog is not passed by useSocketRefresh, we should just call loadLogs)
  loadLogs();
});
/*
    if (roleFilter === 'all' || roleFilter === newLog.user_role) {
      setLogs((prev) => [newLog, ...prev]);
    }
  */

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'rider': return "🏍️";
      case 'kitchen': return "👨‍🍳";
      case 'finance': return "💰";
      case 'admin': return "🛡️";
      default: return "👤";
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'rider': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      case 'kitchen': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      case 'finance': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'admin': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      default: return 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    }
  };

  const formatAction = (action: string) => {
    return action.replace(/_/g, ' ').toLowerCase();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-white flex items-center gap-2">
            <span className="text-xl">📡</span> Team Activity Log
          </h2>
          <p className="text-white/40 text-sm mt-0.5">Real-time command center for all staff actions</p>
        </div>
        <button onClick={loadLogs} className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-colors">
          <span className={`text-white/60 text-sm ${loading ? 'animate-spin' : ''}`}>↻</span>
        </button>
      </div>

      <div className="flex gap-2">
        {(['all', 'rider', 'kitchen', 'finance', 'admin'] as const).map(role => (
          <button
            key={role}
            onClick={() => setRoleFilter(role)}
            className={`px-4 py-2 rounded-xl text-sm font-bold capitalize transition-colors ${
              roleFilter === role ? "bg-purple-500 text-white" : "bg-white/5 text-white/40 hover:text-white hover:bg-white/10"
            }`}
          >
            {role}
          </button>
        ))}
      </div>

      <div className="bg-[#111111] rounded-2xl border border-white/5 p-6">
        {logs.length === 0 && !loading && (
          <div className="text-center py-10 text-white/40">No activity logs found.</div>
        )}
        <div className="space-y-4">
          {logs.map((log: any) => (
            <div key={log.id} className="flex gap-4 items-start p-4 rounded-xl bg-white/5 border border-white/5">
              <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-xl flex-shrink-0">
                {getRoleIcon(log.user_role)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">{log.user_name}</span>
                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border ${getRoleColor(log.user_role)}`}>
                      {log.user_role}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-white/30">
                    {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                  </span>
                </div>
                <div className="text-white/70 text-sm">
                  Performed <span className="font-bold text-white capitalize">{formatAction(log.action_type)}</span>
                  {log.entity_id && (
                    <span className="text-white/50"> on {log.entity_type} <span className="font-mono text-xs">{log.entity_id}</span></span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
