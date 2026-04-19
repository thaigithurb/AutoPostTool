'use client';

import React, { useState, useEffect } from 'react';
import { fetchAccounts, searchGroups } from '@/lib/api';
import { useAppStatus } from '@/lib/AppContext';

interface Account {
    _id: string;
    name: string;
    is_active: boolean;
    health_status: string;
    joined_groups: { id: string; name: string }[];
}

export default function SearchPage() {
    // ── Global State from Context ──
    const { searchState, setSearchState } = useAppStatus();
    const { keyword, selectedAccountId, selectedGroups, isRecent, results, isSearching, searchDone, currentPage } = searchState;

    // Helper to update state partially
    const updateSearchState = (updates: Partial<typeof searchState>) => {
        setSearchState(prev => ({ ...prev, ...updates }));
    };

    // ── Local UI State (Only for accounts list & group filter) ──
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [groupSearchQuery, setGroupSearchQuery] = useState('');
    const [error, setError] = useState('');

    const ITEMS_PER_PAGE = 10;

    // ── Load accounts on mount ──
    useEffect(() => {
        loadAccounts();
    }, []);

    const loadAccounts = async () => {
        try {
            const res = await fetchAccounts();
            setAccounts(res.data || []);
        } catch (err: unknown) {
            console.error('Failed to load accounts:', err);
        }
    };

    // ── Get groups of selected account ──
    const selectedAccount = accounts.find((a) => a._id === selectedAccountId);
    const availableGroups = selectedAccount?.joined_groups || [];

    // ── Toggle group selection ──
    const toggleGroup = (groupId: string) => {
        const newGroups = selectedGroups.includes(groupId) 
            ? selectedGroups.filter((g) => g !== groupId) 
            : [...selectedGroups, groupId];
        updateSearchState({ selectedGroups: newGroups });
    };

    const selectAllGroups = () => {
        if (selectedGroups.length === availableGroups.length) {
            updateSearchState({ selectedGroups: [] });
        } else {
            updateSearchState({ selectedGroups: availableGroups.map((g) => g.id) });
        }
    };

    // ── Handle search ──
    const handleSearch = async () => {
        if (!keyword.trim()) {
            setError('Vui lòng nhập từ khóa tìm kiếm');
            return;
        }
        if (!selectedAccountId) {
            setError('Vui lòng chọn tài khoản');
            return;
        }
        if (selectedGroups.length === 0) {
            setError('Vui lòng chọn ít nhất 1 group');
            return;
        }

        setError('');
        updateSearchState({ 
            isSearching: true,
            searchDone: false, 
            results: [],
            currentPage: 1 // Reset to first page on new search
        });

        try {
            const res = await searchGroups({
                accountId: selectedAccountId,
                groupIds: selectedGroups,
                keyword: keyword.trim(),
                maxResults: 100,
                isRecent,
            });
            updateSearchState({ 
                results: res.data || [], 
                searchDone: true 
            });
        } catch (err: unknown) {
            setError((err as Error).message || 'Có lỗi xảy ra khi tìm kiếm');
        } finally {
            updateSearchState({ isSearching: false });
        }
    };

    // ── Pagination Logic ──
    const totalPages = Math.ceil(results.length / ITEMS_PER_PAGE);
    const paginatedResults = results.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const goToPage = (page: number) => {
        updateSearchState({ currentPage: page });
        // Scroll results header into view when page changes
        document.getElementById('results-header')?.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h2 className="text-2xl font-bold text-slate-900">Tìm bài viết</h2>
                <p className="text-slate-500 text-sm mt-1">
                    Tìm kiếm bài viết trong các Facebook Group theo từ khóa — Tìm khách hàng tiềm năng hoặc theo dõi đối thủ
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* ═════════════════════════════════════════ */}
                {/* LEFT: Search Form (2/5)                   */}
                {/* ═════════════════════════════════════════ */}
                <div className="lg:col-span-2">
                    <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5 sticky top-24 space-y-5">
                        {/* Title */}
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900">Tìm kiếm</h3>
                        </div>

                        {/* Keyword Input */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                Từ khóa tìm kiếm
                            </label>
                            <input
                                id="search-keyword"
                                type="text"
                                value={keyword}
                                onChange={(e) => updateSearchState({ keyword: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder='VD: "cần tìm photobooth", "dịch vụ chụp ảnh"...'
                                className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-sm"
                            />
                        </div>

                        {/* Account Picker */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                Tài khoản Facebook
                            </label>
                            <select
                                id="search-account"
                                value={selectedAccountId}
                                onChange={(e) => {
                                    updateSearchState({ 
                                        selectedAccountId: e.target.value,
                                        selectedGroups: []
                                    });
                                    setGroupSearchQuery(''); 
                                }}
                                className="w-full px-3 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition shadow-sm"
                            >
                                <option value="">-- Chọn tài khoản --</option>
                                {accounts
                                    .filter((a) => a.is_active)
                                    .map((a) => (
                                        <option key={a._id} value={a._id}>
                                            {a.name} {a.health_status === 'healthy' ? '✅' : a.health_status === 'expired' ? '❌' : '⚪'}
                                        </option>
                                    ))}
                            </select>
                        </div>

                        {/* Group Selection */}
                        {selectedAccountId && (
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-medium text-slate-700">
                                        Chọn Group ({selectedGroups.length}/{availableGroups.length})
                                    </label>
                                    {availableGroups.length > 0 && (
                                        <button
                                            onClick={selectAllGroups}
                                            className="text-xs text-emerald-600 hover:text-emerald-700 transition font-medium"
                                        >
                                            {selectedGroups.length === availableGroups.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                                        </button>
                                    )}
                                </div>

                                {/* Group Finder Search Input */}
                                <div className="relative mb-3">
                                    <input
                                        type="text"
                                        placeholder="Tìm tên group..."
                                        value={groupSearchQuery}
                                        onChange={(e) => setGroupSearchQuery(e.target.value)}
                                        className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/10 focus:border-emerald-500/50 transition"
                                    />
                                    <svg className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>

                                {availableGroups.length === 0 ? (
                                    <p className="text-xs text-slate-500 italic">
                                        Tài khoản chưa có group nào. Hãy vào Tài khoản → Đồng bộ Group trước.
                                    </p>
                                ) : (
                                    <div className="max-h-[450px] overflow-y-auto space-y-1.5 pr-1">
                                        {availableGroups
                                            .filter(group => group.name.toLowerCase().includes(groupSearchQuery.toLowerCase()))
                                            .map((group) => (
                                                <label
                                                    key={group.id}
                                                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition text-sm ${
                                                        selectedGroups.includes(group.id)
                                                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-sm'
                                                            : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
                                                    }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedGroups.includes(group.id)}
                                                        onChange={() => toggleGroup(group.id)}
                                                        className="w-4 h-4 rounded accent-emerald-600"
                                                    />
                                                    <span className="truncate">{group.name}</span>
                                                </label>
                                            ))}
                                        
                                        {availableGroups.filter(g => g.name.toLowerCase().includes(groupSearchQuery.toLowerCase())).length === 0 && (
                                            <div className="py-8 text-center">
                                                <p className="text-xs text-slate-400 italic">Không tìm thấy nhóm nào khớp với "{groupSearchQuery}"</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Error */}
                        {error && (
                            <div className="text-red-700 text-sm bg-red-50 border border-red-200 rounded-xl px-3 py-2">
                                {error}
                            </div>
                        )}

                        {/* Search Note Banner */}
                        <div className="mb-2 p-3.5 rounded-xl bg-orange-50 border border-orange-200 flex flex-col gap-1.5 shadow-sm">
                            <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-orange-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                                </svg>
                                <span className="font-semibold text-orange-700 text-sm">Lưu ý hệ thống</span>
                            </div>
                            <p className="text-xs text-orange-800 leading-relaxed">
                                Bot sẽ quét cực sâu để gom toàn bộ bài viết, nhưng <strong className="text-orange-900 font-bold">sẽ khước từ mọi bài rác cũ hơn 7 ngày</strong>. 
                                Việc cào dữ liệu ở số lượng Group lớn {selectedGroups.length > 5 ? `(${selectedGroups.length} groups)` : ''} có thể mất <span className="underline">vài phút</span>, vui lòng giữ kiên nhẫn.
                            </p>
                        </div>

                        {/* Search Button */}
                        <button
                            id="search-button"
                            onClick={handleSearch}
                            disabled={isSearching}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {isSearching ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Đang quét {selectedGroups.length} nhóm...
                                </>
                            ) : (
                                <>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                    Tìm kiếm
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* ═════════════════════════════════════════ */}
                {/* RIGHT: Search Results (3/5)               */}
                {/* ═════════════════════════════════════════ */}
                <div className="lg:col-span-3">
                    <div className="bg-white border border-slate-200 shadow-sm rounded-2xl p-5">
                        {/* Results Header */}
                        <div id="results-header" className="flex items-center gap-2 mb-5">
                            <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-teal-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900">
                                Kết quả {searchDone && `(${results.length} bài)`}
                            </h3>
                        </div>

                        {/* Empty / Loading / Results */}
                        {isSearching ? (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                                <svg className="animate-spin h-10 w-10 mb-4 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                <p className="font-medium text-slate-600">Đang tìm kiếm trong {selectedGroups.length} group...</p>
                                <p className="text-sm text-slate-400 mt-1">Bot đang mở trình duyệt ẩn và tìm kiếm trên Facebook</p>
                            </div>
                        ) : results.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mb-3 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <p className="font-medium text-slate-600">
                                    {searchDone ? 'Không tìm thấy kết quả nào' : 'Nhập từ khóa để bắt đầu tìm kiếm'}
                                </p>
                                <p className="text-sm text-slate-400 mt-1">
                                    {searchDone
                                        ? 'Thử thay đổi từ khóa hoặc chọn thêm group'
                                        : 'Tìm bài viết trong các Group Facebook theo keyword'}
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                <div className="space-y-3">
                                    {paginatedResults.map((post, index) => (
                                        <div
                                            key={index}
                                            className="bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md hover:border-slate-300 transition group"
                                        >
                                            {/* Post Header */}
                                            <div className="flex items-start justify-between gap-3 mb-2">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    {/* Avatar placeholder */}
                                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                                                        <span className="text-white text-xs font-bold">
                                                            {post.author ? post.author.charAt(0).toUpperCase() : '?'}
                                                        </span>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-semibold text-slate-900 truncate">
                                                            {post.author || 'Không rõ'}
                                                        </p>
                                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                                            {post.timestamp && <span>{post.timestamp}</span>}
                                                            {post.timestamp && post.groupName && <span>•</span>}
                                                            {post.groupName && (
                                                                <span className="truncate text-emerald-600 font-medium">{post.groupName}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Open on Facebook */}
                                                {post.postUrl && (
                                                    <a
                                                        href={post.postUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="flex-shrink-0 p-2 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition border border-transparent hover:border-blue-200"
                                                        title="Xem bài gốc trên Facebook"
                                                    >
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                        </svg>
                                                    </a>
                                                )}
                                            </div>

                                            {/* Post Content */}
                                            <p className="text-sm text-slate-700 whitespace-pre-line leading-relaxed">
                                                {post.content.length > 500
                                                    ? post.content.substring(0, 500) + '...'
                                                    : post.content}
                                            </p>

                                            {/* Post Footer */}
                                            <div className="flex items-center gap-3 mt-3 pt-2 border-t border-slate-100">
                                                {post.hasImages && (
                                                    <span className="flex items-center gap-1 text-xs font-medium text-slate-500">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                        </svg>
                                                        Có hình ảnh
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* Pagination Controls */}
                                {totalPages > 1 && (
                                    <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                                        <div className="text-xs text-slate-500">
                                            Hiển thị bài <span className="font-semibold">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> - <span className="font-semibold">{Math.min(currentPage * ITEMS_PER_PAGE, results.length)}</span> trong tổng số <span className="font-semibold">{results.length}</span> bài
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => goToPage(currentPage - 1)}
                                                disabled={currentPage === 1}
                                                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                                </svg>
                                            </button>
                                            
                                            <div className="flex items-center gap-1 px-2">
                                                {Array.from({ length: totalPages }, (_, i) => i + 1)
                                                    .filter(page => {
                                                        // Show first, last, and pages near current
                                                        return page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1;
                                                    })
                                                    .map((page, index, array) => (
                                                        <React.Fragment key={page}>
                                                            {index > 0 && array[index - 1] !== page - 1 && (
                                                                <span className="text-slate-400 text-xs px-1">...</span>
                                                            )}
                                                            <button
                                                                onClick={() => goToPage(page)}
                                                                className={`w-8 h-8 rounded-lg text-xs font-semibold transition ${
                                                                    currentPage === page
                                                                        ? 'bg-emerald-600 text-white shadow-sm'
                                                                        : 'text-slate-600 hover:bg-slate-100'
                                                                }`}
                                                            >
                                                                {page}
                                                            </button>
                                                        </React.Fragment>
                                                    ))}
                                            </div>

                                            <button
                                                onClick={() => goToPage(currentPage + 1)}
                                                disabled={currentPage === totalPages}
                                                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
