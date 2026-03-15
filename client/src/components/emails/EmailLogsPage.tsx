import React, { useState, useEffect } from 'react';
import { Mail, Send, CheckCircle, XCircle, RefreshCw, TestTube } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { emailApi } from '../../services/api';

interface EmailLog {
    id: string;
    user_id: string;
    display_name: string;
    user_email: string;
    email_type: string;
    status: 'sent' | 'failed';
    error_message: string | null;
    sent_at: string;
    task_ids: string[];
}

export default function EmailLogsPage() {
    const { user } = useAuth();
    const [logs, setLogs] = useState<EmailLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [testLoading, setTestLoading] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
    const [testEmail, setTestEmail] = useState('');

    const load = async () => {
        setLoading(true);
        try {
            const data = user?.role === 'admin' || user?.role === 'manager'
                ? await emailApi.logs()
                : await emailApi.myLogs();
            setLogs(data);
        } catch {
            // ignore
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { load(); }, []);

    const sendTest = async () => {
        setTestLoading(true);
        setTestResult(null);
        try {
            const result = await emailApi.sendTest(testEmail || undefined);
            setTestResult({ success: true, message: result.message });
            load();
        } catch (err: any) {
            setTestResult({
                success: false,
                message: err.response?.data?.error || err.message || 'Eroare la trimitere'
            });
        } finally {
            setTestLoading(false);
        }
    };

    const sentCount = logs.filter(l => l.status === 'sent').length;
    const failedCount = logs.filter(l => l.status === 'failed').length;

    return (
        <div className="p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <Mail className="w-6 h-6 text-blue-400" />
                    <h1 className="text-xl font-bold">Email Logs</h1>
                </div>
                <button onClick={load} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-navy-800 hover:bg-navy-700 text-sm transition-colors">
                    <RefreshCw className="w-4 h-4" />
                    Reîncarcă
                </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-4">
                    <p className="text-2xl font-bold text-white">{logs.length}</p>
                    <p className="text-xs text-navy-400 mt-0.5">Total emailuri</p>
                </div>
                <div className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-4">
                    <p className="text-2xl font-bold text-green-400">{sentCount}</p>
                    <p className="text-xs text-navy-400 mt-0.5">Trimise cu succes</p>
                </div>
                <div className="bg-navy-800/50 border border-navy-700/50 rounded-xl p-4">
                    <p className="text-2xl font-bold text-red-400">{failedCount}</p>
                    <p className="text-xs text-navy-400 mt-0.5">Eșuate</p>
                </div>
            </div>

            {/* Test email (admin only) */}
            {user?.role === 'admin' && (
                <div className="bg-navy-800/30 border border-navy-700/50 rounded-xl p-4 mb-6">
                    <div className="flex items-center gap-2 mb-3">
                        <TestTube className="w-4 h-4 text-amber-400" />
                        <h2 className="text-sm font-semibold">Trimite email de test</h2>
                    </div>
                    <div className="flex gap-3">
                        <input
                            type="email"
                            value={testEmail}
                            onChange={e => setTestEmail(e.target.value)}
                            placeholder={`Implicit: ${user.email}`}
                            className="flex-1 bg-navy-900/50 border border-navy-600 rounded-lg px-3 py-2 text-sm text-white placeholder-navy-500 outline-none focus:border-blue-500 transition-colors"
                        />
                        <button
                            onClick={sendTest}
                            disabled={testLoading}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            <Send className="w-4 h-4" />
                            {testLoading ? 'Se trimite...' : 'Trimite test'}
                        </button>
                    </div>
                    {testResult && (
                        <div className={`mt-3 p-3 rounded-lg text-sm ${testResult.success ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                            {testResult.success ? '✅ ' : '❌ '}{testResult.message}
                        </div>
                    )}
                    <p className="text-xs text-navy-500 mt-2">
                        Necesită AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET și GRAPH_SENDER_EMAIL în Railway Variables.
                    </p>
                </div>
            )}

            {/* Logs table */}
            <div className="bg-navy-800/30 border border-navy-700/50 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-navy-700/50">
                    <h2 className="text-sm font-semibold">
                        {user?.role === 'admin' || user?.role === 'manager' ? 'Toate emailurile' : 'Emailurile mele'}
                    </h2>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : logs.length === 0 ? (
                    <div className="text-center py-12">
                        <Mail className="w-10 h-10 text-navy-600 mx-auto mb-3" />
                        <p className="text-sm text-navy-400">Nu există emailuri în log</p>
                    </div>
                ) : (
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-navy-700/50">
                                <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">Status</th>
                                {(user?.role === 'admin' || user?.role === 'manager') && (
                                    <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">Utilizator</th>
                                )}
                                <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">Tip</th>
                                <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">Taskuri</th>
                                <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">Data</th>
                                <th className="text-left px-4 py-2.5 text-xs text-navy-400 font-medium">Eroare</th>
                            </tr>
                        </thead>
                        <tbody>
                            {logs.map(log => (
                                <tr key={log.id} className="border-b border-navy-700/30 hover:bg-navy-700/20 transition-colors">
                                    <td className="px-4 py-3">
                                        {log.status === 'sent'
                                            ? <span className="flex items-center gap-1.5 text-green-400 text-xs"><CheckCircle className="w-3.5 h-3.5" />Trimis</span>
                                            : <span className="flex items-center gap-1.5 text-red-400 text-xs"><XCircle className="w-3.5 h-3.5" />Eșuat</span>
                                        }
                                    </td>
                                    {(user?.role === 'admin' || user?.role === 'manager') && (
                                        <td className="px-4 py-3">
                                            <p className="text-xs font-medium">{log.display_name}</p>
                                            <p className="text-navy-400 text-[10px]">{log.user_email}</p>
                                        </td>
                                    )}
                                    <td className="px-4 py-3">
                                        <span className="text-xs text-navy-300">{log.email_type.replace('_', ' ')}</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs text-navy-300">{log.task_ids?.length || 0} sarcini</span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className="text-xs text-navy-300">
                                            {new Date(log.sent_at).toLocaleString('ro-RO', {
                                                day: '2-digit', month: '2-digit', year: 'numeric',
                                                hour: '2-digit', minute: '2-digit'
                                            })}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {log.error_message && (
                                            <span className="text-xs text-red-400 max-w-[200px] truncate block" title={log.error_message}>
                                                {log.error_message}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
