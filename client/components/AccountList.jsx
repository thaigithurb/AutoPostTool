'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchAccounts, deleteAccount, checkAccountHealth, syncAccountTargets } from '@/lib/api';
import toast from 'react-hot-toast';

const TYPE_LABELS = {
    profile: '👤 Profile',
    page: '📄 Page',
};

const HEALTH_BADGES = {
    healthy: { label: 'Hoạt động', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-400' },
    expired: { label: 'Hết hạn', color: 'bg-red-500/20 text-red-300 border-red-500/30', dot: 'bg-red-400' },
    checkpoint: { label: 'Checkpoint', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30', dot: 'bg-amber-400' },
    unknown: { label: 'Chưa kiểm tra', color: 'bg-gray-500/20 text-gray-400 border-gray-500/30', dot: 'bg-gray-500' },
};

function timeAgo(dateStr) {
    if (!dateStr) return null;
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'vừa xong';
    if (mins < 60) return `${mins} phút trước`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    return `${days} ngày trước`;
}

export default function AccountList({ refreshTrigger, onEdit }) {
    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [checkingId, setCheckingId] = useState(null); // ID account đang kiểm tra
    const [syncingId, setSyncingId] = useState(null); // ID account đang sync

    const loadAccounts = useCallback(async () => {
        try {
            const res = await fetchAccounts();
            setAccounts(res.data || []);
        } catch (err) {
            console.error('Lỗi tải tài khoản:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadAccounts();
    }, [refreshTrigger, loadAccounts]);

    const handleDelete = async (id, name) => {
        if (!confirm(`Bạn muốn xóa tài khoản "${name}"?`)) return;
        try {
            await deleteAccount(id);
            await loadAccounts();
        } catch (err) {
            toast.error('Lỗi: ' + err.message);
        }
    };

    const handleCheckHealth = async (id) => {
        setCheckingId(id);
        try {
            const res = await checkAccountHealth(id);
            if (res.data?.healthy) {
                toast.success('✅ Tài khoản hoạt động bình thường!');
            } else {
                toast.error(`⚠️ ${res.data?.reason || 'Tài khoản có vấn đề'}`);
            }
            await loadAccounts(); // Refresh list to show new health status
        } catch (err) {
            toast.error('Lỗi kiểm tra: ' + err.message);
        } finally {
            setCheckingId(null);
        }
    };

    const handleSyncTargets = async (id) => {
        setSyncingId(id);
        const loadingToast = toast.loading('Đang đồng bộ Groups/Pages (có thể mất 1-2 phút)...');
        try {
            const res = await syncAccountTargets(id);
            toast.success(`✅ Đồng bộ thành công: ${res.data.joined_groups.length} Groups, ${res.data.managed_pages.length} Pages`, { id: loadingToast });
            await loadAccounts();
        } catch (err) {
            toast.error('Lỗi đồng bộ: ' + err.message, { id: loadingToast });
        } finally {
            setSyncingId(null);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <svg className="animate-spin h-8 w-8 text-violet-400" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
            </div>
        );
    }

    if (accounts.length === 0) {
        return (
            <div className="text-center py-12 text-gray-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="font-medium">Chưa có tài khoản nào</p>
                <p className="text-sm mt-1">Thêm tài khoản đầu tiên ở form bên trái</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <p className="text-sm text-gray-400">
                    Tổng cộng: <span className="text-white font-semibold">{accounts.length}</span> tài khoản
                </p>
                <button
                    onClick={loadAccounts}
                    className="text-sm text-violet-400 hover:text-violet-300 transition flex items-center gap-1"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Làm mới
                </button>
            </div>

            {/* Account Cards */}
            <div className="space-y-3">
                {accounts.map((acc) => {
                    const health = HEALTH_BADGES[acc.health_status] || HEALTH_BADGES.unknown;
                    const lastChecked = timeAgo(acc.last_checked_at);
                    const isChecking = checkingId === acc._id;
                    const isSyncing = syncingId === acc._id;

                    return (
                        <div
                            key={acc._id}
                            className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/[0.07] transition"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="text-white font-medium truncate">{acc.name}</h4>
                                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${acc.is_active
                                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                            : 'bg-gray-500/20 text-gray-400 border-gray-500/30'
                                            }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${acc.is_active ? 'bg-emerald-400' : 'bg-gray-500'}`} />
                                            {acc.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-400">
                                        <span>{TYPE_LABELS[acc.account_type] || acc.account_type}</span>
                                        <span>🍪 {acc.cookies ? 'Có cookies' : 'Chưa có cookies'}</span>
                                        {acc.proxy && <span>🌐 Có proxy</span>}
                                        {acc.access_token && <span>🔑 Có token</span>}
                                        {acc.joined_groups?.length > 0 && <span className="text-violet-400">👥 {acc.joined_groups.length} Groups</span>}
                                    </div>

                                    {/* Health Status Badge */}
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${health.color}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${health.dot}`} />
                                            {health.label}
                                        </span>
                                        {lastChecked && (
                                            <span className="text-xs text-gray-500">
                                                Kiểm tra {lastChecked}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-1 shrink-0">
                                    {/* Nút Đồng bộ Groups (chỉ cho profile) */}
                                    {acc.account_type === 'profile' && (
                                        <button
                                            onClick={() => handleSyncTargets(acc._id)}
                                            disabled={isSyncing || isChecking}
                                            className="p-2 text-gray-400 hover:text-green-400 hover:bg-green-500/10 rounded-lg transition disabled:opacity-50"
                                            title="Đồng bộ Groups/Pages"
                                        >
                                            {isSyncing ? (
                                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                                </svg>
                                            ) : (
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                </svg>
                                            )}
                                        </button>
                                    )}

                                    {/* Nút Kiểm tra sức khỏe */}
                                    <button
                                        onClick={() => handleCheckHealth(acc._id)}
                                        disabled={isChecking}
                                        className="p-2 text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition disabled:opacity-50"
                                        title="Kiểm tra sức khỏe"
                                    >
                                        {isChecking ? (
                                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => onEdit(acc)}
                                        className="p-2 text-gray-400 hover:text-violet-400 hover:bg-violet-500/10 rounded-lg transition"
                                        title="Sửa"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(acc._id, acc.name)}
                                        className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition"
                                        title="Xóa"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
