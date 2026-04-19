'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchAccounts, deleteAccount, bulkDeleteAccounts, checkAccountHealth, syncAccountTargets } from '@/lib/api';
import toast from 'react-hot-toast';
import { useAppStatus } from '@/lib/AppContext';
import { io } from 'socket.io-client';

const TYPE_LABELS = {
    profile: '👤 Profile',
    page: '📄 Page',
};

const HEALTH_BADGES = {
    healthy: { label: 'Hoạt động', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    expired: { label: 'Hết hạn', color: 'bg-red-50 text-red-700 border-red-200', dot: 'bg-red-500' },
    checkpoint: { label: 'Checkpoint', color: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
    unknown: { label: 'Chưa kiểm tra', color: 'bg-slate-100 text-slate-600 border-slate-200', dot: 'bg-slate-400' },
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
    const { syncState, setSyncState } = useAppStatus();
    const { isSyncingAll, totalToSync, syncedCount, currentAccountName } = syncState;

    const [accounts, setAccounts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [checkingId, setCheckingId] = useState(null); // ID account đang kiểm tra
    const [syncingId, setSyncingId] = useState(null); // ID account đang sync
    
    // Multi-select state
    const [selectedIds, setSelectedIds] = useState([]);
    const [isBulkProcessing, setIsBulkProcessing] = useState(false);

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

    const handleRefresh = async () => {
        setLoading(true);
        await loadAccounts();
        toast.success('Đã cập nhật danh sách tài khoản', { icon: '🔄' });
    };

    // Socket implementation
    useEffect(() => {
        const socketUrl = process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace('/api', '') : 'http://localhost:5000';
        const socket = io(socketUrl);

        socket.on('connect', () => {
            console.log('✅ Connected to WebSocket Server');
        });

        socket.on('ACCOUNT_STATUS_UPDATED', (data) => {
            console.log('📬 Received real-time update:', data);
            
            setAccounts(prev => prev.map(acc => {
                if (acc._id === data.accountId) {
                    // Nếu trạng thái thay đổi sang xấu, báo lỗi
                    if (acc.health_status === 'healthy' && data.status !== 'healthy') {
                        toast.error(`⚠️ Tài khoản "${acc.name}" vừa gặp sự cố: ${data.status.toUpperCase()}`, { duration: 6000 });
                    }
                    
                    return {
                        ...acc,
                        health_status: data.status,
                        last_checked_at: data.lastChecked
                    };
                }
                return acc;
            }));
        });

        return () => socket.disconnect();
    }, []);

    useEffect(() => {
        loadAccounts();
    }, [refreshTrigger, loadAccounts]);

    const handleDelete = async (id, name) => {
        if (!confirm(`Bạn muốn xóa tài khoản "${name}"?`)) return;
        try {
            await deleteAccount(id);
            toast.success('Xóa tài khoản thành công');
            await loadAccounts();
        } catch (err) {
            toast.error('Lỗi: ' + err.message);
        }
    };

    const handleCheckHealth = async (id, silent = false) => {
        if (!silent) setCheckingId(id);
        try {
            const res = await checkAccountHealth(id);
            if (!silent) {
                if (res.data?.healthy) {
                    toast.success('✅ Tài khoản hoạt động bình thường!');
                } else {
                    toast.error(`⚠️ ${res.data?.reason || 'Tài khoản có vấn đề'}`);
                }
            }
            return res.data;
        } catch (err) {
            if (!silent) toast.error('Lỗi kiểm tra: ' + err.message);
            throw err;
        } finally {
            if (!silent) setCheckingId(null);
        }
    };

    // Bulk Actions Logic
    const toggleSelectAll = () => {
        if (selectedIds.length === accounts.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(accounts.map(acc => acc._id));
        }
    };

    const toggleSelect = (id) => {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleDeleteSelected = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`Bạn có chắc chắn muốn xóa ${selectedIds.length} tài khoản đã chọn?`)) return;

        setIsBulkProcessing(true);
        const loadingToast = toast.loading(`Đang xóa ${selectedIds.length} tài khoản...`);
        try {
            await bulkDeleteAccounts(selectedIds);
            toast.success(`✅ Đã xóa thành công ${selectedIds.length} tài khoản`, { id: loadingToast });
            setSelectedIds([]);
            await loadAccounts();
        } catch (err) {
            toast.error('Lỗi xóa hàng loạt: ' + err.message, { id: loadingToast });
        } finally {
            setIsBulkProcessing(false);
        }
    };

    const handleCheckHealthSelected = async () => {
        if (selectedIds.length === 0) return;
        
        setIsBulkProcessing(true);
        setSyncState({ 
            isSyncingAll: true, 
            totalToSync: selectedIds.length, 
            syncedCount: 0,
            currentAccountName: ''
        });

        const globalToast = toast.loading(`Bắt đầu kiểm tra ${selectedIds.length} tài khoản...`);
        let successCount = 0;
        let issueCount = 0;

        for (let i = 0; i < selectedIds.length; i++) {
            const id = selectedIds[i];
            const acc = accounts.find(a => a._id === id);
            if (!acc) continue;

            setSyncState(prev => ({ ...prev, syncedCount: i, currentAccountName: acc.name }));
            toast.loading(`Đang kiểm tra [${i + 1}/${selectedIds.length}]: ${acc.name}...`, { id: globalToast });
            
            try {
                const result = await handleCheckHealth(id, true);
                if (result.healthy) successCount++;
                else issueCount++;
            } catch (error) {
                issueCount++;
                console.error(`Lỗi kiểm tra ${acc.name}:`, error);
            }
        }

        await loadAccounts(); // Refresh to show latest health statuses
        toast.success(`✅ Kiểm tra xong! Hoạt động: ${successCount}, Có vấn đề: ${issueCount}`, { id: globalToast, duration: 5000 });
        
        setSyncState({ isSyncingAll: false, totalToSync: 0, syncedCount: 0, currentAccountName: '' });
        setIsBulkProcessing(false);
    };

    const handleSyncTargets = async (id, hideToast = false) => {
        setSyncingId(id);
        const loadingToast = !hideToast ? toast.loading('Đang đồng bộ Groups (có thể mất 1-2 phút)...') : null;
        try {
            const res = await syncAccountTargets(id);
            if (!hideToast) {
                toast.success(`✅ Đồng bộ thành công: ${res.data.joined_groups.length} Groups`, { id: loadingToast });
            }
            await loadAccounts();
        } catch (err) {
            if (!hideToast) {
                toast.error('Lỗi đồng bộ: ' + err.message, { id: loadingToast });
            }
        } finally {
            setSyncingId(null);
        }
    };

    const handleSyncAll = async () => {
        const profileAccounts = accounts.filter(acc => acc.account_type === 'profile');
        if (profileAccounts.length === 0) {
            toast.error('Không có tài khoản Profile nào để đồng bộ.');
            return;
        }

        if (!confirm(`Bạn có muốn đồng bộ Groups cho ${profileAccounts.length} tài khoản? Quá trình này sẽ chạy lần lượt và mất vài phút.`)) return;

        setSyncState({ 
            isSyncingAll: true, 
            totalToSync: profileAccounts.length, 
            syncedCount: 0,
            currentAccountName: ''
        });

        const globalToast = toast.loading(`Đang khởi động đồng bộ ${profileAccounts.length} tài khoản...`);
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < profileAccounts.length; i++) {
            const acc = profileAccounts[i];
            setSyncState(prev => ({ ...prev, syncedCount: i, currentAccountName: acc.name }));
            toast.loading(`Đang đồng bộ [${i + 1}/${profileAccounts.length}]: ${acc.name}...`, { id: globalToast });
            try {
                await handleSyncTargets(acc._id, true);
                successCount++;
            } catch (error) {
                failCount++;
                console.error(`Lỗi đồng bộ ${acc.name}:`, error);
            }
        }

        toast.success(`✅ Hoàn thành đồng bộ! Thành công: ${successCount}, Thất bại: ${failCount}`, { id: globalToast, duration: 5000 });
        setSyncState({ 
            isSyncingAll: false, 
            totalToSync: 0, 
            syncedCount: 0,
            currentAccountName: ''
        });
    };

    if (loading && accounts.length === 0) {
        return (
            <div className="flex items-center justify-center py-12">
                <svg className="animate-spin h-8 w-8 text-indigo-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
            </div>
        );
    }

    if (accounts.length === 0 && !loading) {
        return (
            <div className="text-center py-12 text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <p className="font-medium">Chưa có tài khoản nào</p>
                <p className="text-sm mt-1">Thêm tài khoản đầu tiên ở form bên trái</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Header ToolBar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <input 
                            type="checkbox" 
                            checked={selectedIds.length === accounts.length && accounts.length > 0}
                            onChange={toggleSelectAll}
                            className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="text-xs text-slate-500 font-medium">Chọn tất cả</span>
                    </div>
                    <p className="text-sm text-slate-500 pl-3 border-l border-slate-200">
                        Tổng cộng: <span className="text-slate-900 font-semibold">{accounts.length}</span>
                    </p>
                </div>
                
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleSyncAll}
                        disabled={isSyncingAll || loading || isBulkProcessing}
                        className="text-xs sm:text-sm bg-white border border-slate-200 text-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition flex items-center gap-2 font-medium disabled:opacity-50"
                        title="Đồng bộ Groups cho tất cả tài khoản"
                    >
                        {isSyncingAll && !isBulkProcessing ? (
                            <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                        ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                            </svg>
                        )}
                        <span>{isSyncingAll && !isBulkProcessing ? 'Đang đồng bộ...' : 'Đồng bộ groups'}</span>
                    </button>
                    <button
                        onClick={handleRefresh}
                        disabled={isSyncingAll || isBulkProcessing}
                        className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition disabled:opacity-50"
                        title="Làm mới"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
            </div>

            {/* Bulk Actions Bar (Sticky/Floating when selection exists) */}
            {selectedIds.length > 0 && (
                <div className="bg-indigo-600 text-white rounded-xl px-4 py-2.5 flex items-center justify-between shadow-lg shadow-indigo-200 sticky top-4 z-10 animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-3">
                        <span className="font-bold bg-white text-indigo-600 w-6 h-6 rounded-full flex items-center justify-center text-xs">
                            {selectedIds.length}
                        </span>
                        <span className="text-sm font-medium">Tài khoản đã chọn</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={handleCheckHealthSelected}
                            disabled={isBulkProcessing || isSyncingAll}
                            className="text-xs bg-indigo-500 hover:bg-indigo-400 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 font-medium border border-indigo-400 disabled:opacity-50"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Check Health
                        </button>
                        <button
                            onClick={handleDeleteSelected}
                            disabled={isBulkProcessing || isSyncingAll}
                            className="text-xs bg-red-500 hover:bg-red-400 px-3 py-1.5 rounded-lg transition flex items-center gap-1.5 font-medium border border-red-400 disabled:opacity-50"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Xóa hàng loạt
                        </button>
                        <button 
                            onClick={() => setSelectedIds([])}
                            className="p-1 hover:bg-white/10 rounded-full transition"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}

            {/* Sync/Health Progress Indicator */}
            {isSyncingAll && (
                <div className={`bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-4 ${isBulkProcessing ? 'border-2 border-indigo-200 shadow-sm' : ''}`}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-semibold text-indigo-700">
                            {isBulkProcessing ? 'Đang kiểm tra sức khỏe hàng loạt...' : 'Đang đồng bộ hàng loạt...'}
                        </span>
                        <span className="text-xs font-bold text-indigo-600">{Math.round((syncedCount / totalToSync) * 100)}%</span>
                    </div>
                    <div className="w-full bg-indigo-200 rounded-full h-1.5 overflow-hidden">
                        <div 
                            className="bg-indigo-600 h-full transition-all duration-500" 
                            style={{ width: `${(syncedCount / totalToSync) * 100}%` }}
                        />
                    </div>
                    <p className="text-[10px] text-indigo-500 mt-1.5 truncate text-center italic">
                        Đang xử lý: {currentAccountName || 'Khởi động...'}
                    </p>
                </div>
            )}

            {/* Account Cards */}
            <div className="space-y-3">
                {accounts.map((acc) => {
                    const health = HEALTH_BADGES[acc.health_status] || HEALTH_BADGES.unknown;
                    const lastChecked = timeAgo(acc.last_checked_at);
                    const isChecking = checkingId === acc._id;
                    const isSyncing = syncingId === acc._id;
                    const isSelected = selectedIds.includes(acc._id);

                    return (
                        <div
                            key={acc._id}
                            className={`bg-white border rounded-xl p-4 transition shadow-sm relative overflow-hidden ${
                                isSelected ? 'border-indigo-400 ring-1 ring-indigo-400 bg-indigo-50/10' : 'border-slate-200 hover:shadow-md'
                            }`}
                        >
                            <div className="flex items-start gap-3">
                                {/* Selection Checkbox */}
                                <div className="mt-1">
                                    <input 
                                        type="checkbox" 
                                        checked={isSelected}
                                        onChange={() => toggleSelect(acc._id)}
                                        className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                                    />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="text-slate-900 font-medium truncate">{acc.name}</h4>
                                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${acc.is_active
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : 'bg-slate-100 text-slate-600 border-slate-200'
                                            }`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${acc.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                            {acc.is_active ? 'Active' : 'Inactive'}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                        <span>{TYPE_LABELS[acc.account_type] || acc.account_type}</span>
                                        <span>🍪 {acc.cookies ? 'Có cookies' : 'Chưa có cookies'}</span>
                                        {acc.proxy && <span>🌐 Có proxy</span>}
                                        {acc.access_token && <span>🔑 Có token</span>}
                                        {acc.joined_groups?.length > 0 && <span className="text-indigo-600 font-medium">👥 {acc.joined_groups.length} Groups</span>}
                                    </div>

                                    {/* Health Status Badge */}
                                    <div className="flex items-center gap-2 mt-2">
                                        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${health.color}`}>
                                            <span className={`w-1.5 h-1.5 rounded-full ${health.dot}`} />
                                            {health.label}
                                        </span>
                                        {lastChecked && (
                                            <span className="text-xs text-slate-500">
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
                                            disabled={isSyncing || isChecking || isSyncingAll}
                                            className="p-2 text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 rounded-lg transition disabled:opacity-50"
                                            title="Đồng bộ Groups"
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
                                        disabled={isChecking || isBulkProcessing || isSyncingAll}
                                        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition disabled:opacity-50"
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
                                        disabled={isBulkProcessing || isSyncingAll}
                                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition disabled:opacity-50"
                                        title="Sửa"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(acc._id, acc.name)}
                                        disabled={isBulkProcessing || isSyncingAll}
                                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
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
