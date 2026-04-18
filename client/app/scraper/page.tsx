'use client';

import { useState, useEffect } from 'react';
import {
    fetchAccounts,
    fetchScrapedPosts,
    fetchScrapedCategories,
    bookmarkScrapedPost,
    deleteScrapedPost,
    fetchScrapeTargets,
    createScrapeTarget,
    deleteScrapeTarget
} from '@/lib/api';
import toast from 'react-hot-toast';

interface Account {
    _id: string;
    name: string;
    account_type: string;
    joined_groups?: { id: string, name: string }[];
}

interface ScrapeTarget {
    _id: string;
    name: string;
    target_url: string;
    target_id: string;
    type: string;
    frequency_hours: number;
    active: boolean;
    last_scraped_at?: string;
    posts_found: number;
    account_id: { _id: string, name: string };
    createdAt: string;
}

interface ScrapedPost {
    _id: string;
    author_name: string;
    group_name: string;
    group_id: string;
    category: string;
    content: string;
    media_urls?: string[];
    scraped_at: string;
    is_bookmarked: boolean;
}

export default function ScraperPage() {
    const [activeTab, setActiveTab] = useState<'content' | 'targets'>('content');

    // ── Global state ──
    const [accounts, setAccounts] = useState<Account[]>([]);

    // ── Targets state ──
    const [targets, setTargets] = useState<ScrapeTarget[]>([]);
    const [tName, setTName] = useState('');
    const [tUrl, setTUrl] = useState('');
    const [tType, setTType] = useState('group');
    const [tAcc, setTAcc] = useState('');
    const [tFreq, setTFreq] = useState(6);
    const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
    const [savingTarget, setSavingTarget] = useState(false);
    const [loadingTargets, setLoadingTargets] = useState(true);

    // ── Content List state ──
    const [posts, setPosts] = useState<ScrapedPost[]>([]);
    const [categories, setCategories] = useState([]);
    const [filterCategory, setFilterCategory] = useState('');
    const [filterBookmark, setFilterBookmark] = useState(false);
    const [search, setSearch] = useState('');
    const [loadingPosts, setLoadingPosts] = useState(true);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // ── Load data ──
    useEffect(() => {
        loadAccounts();
        loadCategories();
        loadTargets();
    }, []);

    useEffect(() => {
        if (activeTab === 'content') {
            loadPosts();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filterCategory, filterBookmark, search, page, activeTab]);

    const loadAccounts = async () => {
        try {
            const res = await fetchAccounts();
            setAccounts(res.data || []);
        } catch (err) {
            console.error('Lỗi tải tài khoản:', err);
        }
    };

    const loadCategories = async () => {
        try {
            const res = await fetchScrapedCategories();
            setCategories(res.data || []);
        } catch (err) {
            console.error('Lỗi tải categories:', err);
        }
    };

    const loadTargets = async () => {
        setLoadingTargets(true);
        try {
            const res = await fetchScrapeTargets();
            setTargets(res.data || []);
        } catch (e) {
            console.error(e);
        } finally {
            setLoadingTargets(false);
        }
    };

    const loadPosts = async () => {
        setLoadingPosts(true);
        try {
            const params = new URLSearchParams();
            if (filterCategory) params.set('category', filterCategory);
            if (filterBookmark) params.set('is_bookmarked', 'true');
            if (search) params.set('search', search);
            params.set('page', page.toString());
            params.set('limit', '20');

            const res = await fetchScrapedPosts(params.toString());
            setPosts(res.posts || []);
            setTotalPages(res.totalPages || 1);
        } catch (err) {
            console.error('Lỗi tải bài viết:', err);
        } finally {
            setLoadingPosts(false);
        }
    };

    // ── Targets Actions ──
    const handleCreateTarget = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!tAcc) return toast.error('Vui lòng chọn tài khoản thao tác');

        setSavingTarget(true);
        try {
            const activeAccountObj = accounts.find(a => a._id === tAcc);
            const hasSyncedGroups = activeAccountObj?.joined_groups && activeAccountObj.joined_groups.length > 0;

            if (tType === 'group' && hasSyncedGroups && selectedGroups.length > 0) {
                // Tạo hàng loạt Scrape Target cho nhiều Group
                let successCount = 0;
                for (const gid of selectedGroups) {
                    try {
                        const groupInfo = activeAccountObj.joined_groups?.find(g => g.id === gid);
                        if (!groupInfo) continue;

                        // Fix for multi-create: Set URL to https://m.facebook.com/groups/ (hoặc bỏ qua url, để worker tự xử lý)
                        await createScrapeTarget({
                            name: (tName.trim() ? `${tName.trim()} - ` : 'Auto: ') + groupInfo.name,
                            target_url: `https://www.facebook.com/groups/${gid}`,
                            type: 'group',
                            account_id: tAcc,
                            frequency_hours: tFreq
                        });
                        successCount++;
                    } catch (err: any) {
                        console.error('Lỗi tạo nguồn group:', err);
                    }
                }
                toast.success(`Đã thêm ${successCount}/${selectedGroups.length} cấu hình cào tự động!`);
            } else {
                // Tạo 1 mục tiêu đơn (Newsfeed, Page, hoặc Link Group nhập tay)
                if (!tName.trim()) { toast.error('Vui lòng nhập tên nguồn'); setSavingTarget(false); return; }
                if (tType !== 'news_feed' && !tUrl.trim()) { toast.error('Vui lòng cung cấp link URL'); setSavingTarget(false); return; }

                await createScrapeTarget({
                    name: tName.trim(),
                    target_url: tUrl.trim() || null,
                    type: tType,
                    account_id: tAcc,
                    frequency_hours: tFreq
                });
                toast.success('Thêm nguồn tự động thành công!');
            }

            // Reset
            setTName('');
            setTUrl('');
            setSelectedGroups([]);
            setTFreq(6);
            loadTargets();
        } catch (err: any) {
            toast.error(err.message || 'Có lỗi xảy ra');
        } finally {
            setSavingTarget(false);
        }
    };

    const handleDeleteTarget = async (id: string) => {
        if (!confirm('Bạn có chắc chắn muốn xóa cấu hình cào này? (Sẽ không đi cào nữa)')) return;
        try {
            await deleteScrapeTarget(id);
            toast.success('Đã xóa thành công!');
            loadTargets();
        } catch (err: any) {
            toast.error(err.message || 'Có lỗi xảy ra');
        }
    };

    // ── Posts Actions ──
    const handleBookmark = async (id: string) => {
        try {
            const res = await bookmarkScrapedPost(id);
            toast.success(res.message);
            loadPosts();
        } catch (err: any) {
            toast.error(err.message || 'Lỗi');
        }
    };

    const handleDeletePost = async (id: string) => {
        if (!confirm('Xóa bài viết này khỏi Kho Nội Dung?')) return;
        try {
            await deleteScrapedPost(id);
            toast.success('Đã xóa');
            loadPosts();
        } catch (err: any) {
            toast.error(err.message || 'Lỗi');
        }
    };

    const handleCopyContent = (content: string) => {
        navigator.clipboard.writeText(content);
        toast.success('📋 Đã copy nội dung!');
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8">
            <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                🤖 Kho Content (Tự Động Xuất Bản)
            </h1>

            {/* Custom Tabs */}
            <div className="flex gap-2 mb-6 border-b border-white/10 pb-2">
                <button
                    onClick={() => setActiveTab('content')}
                    className={`px-4 py-2 rounded-t-lg font-medium transition ${activeTab === 'content' ? 'text-violet-400 border-b-2 border-violet-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                    📚 Bài Viết Đã Lưu
                </button>
                <button
                    onClick={() => setActiveTab('targets')}
                    className={`px-4 py-2 rounded-t-lg font-medium transition ${activeTab === 'targets' ? 'text-cyan-400 border-b-2 border-cyan-400' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                >
                    ⚙️ Cấu Hình Nguồn Cào
                </button>
            </div>

            {/* ── Tab: Kho Nội Dung ── */}
            {activeTab === 'content' && (
                <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                    {/* Filters */}
                    <div className="flex flex-wrap gap-2 mb-4">
                        <select
                            value={filterCategory}
                            onChange={(e) => { setFilterCategory(e.target.value); setPage(1); }}
                            className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 appearance-none"
                        >
                            <option value="" className="bg-gray-900">Tất cả bài viết</option>
                            {categories.map((cat: string) => (
                                <option key={cat} value={cat} className="bg-gray-900">{cat}</option>
                            ))}
                        </select>

                        <button
                            onClick={() => { setFilterBookmark(!filterBookmark); setPage(1); }}
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${filterBookmark
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                                : 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10'
                                }`}
                        >
                            ⭐ Kế hoạch
                        </button>

                        <input
                            type="text"
                            value={search}
                            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                            placeholder="🔍 Tìm kiếm nội dung..."
                            className="flex-1 min-w-[200px] bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                        />
                    </div>

                    {/* Posts list */}
                    {loadingPosts ? (
                        <div className="flex items-center justify-center py-12">
                            <svg className="animate-spin h-8 w-8 text-violet-400" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                        </div>
                    ) : posts.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <p className="font-medium text-lg">Chưa có bài viết nào trong Kho</p>
                            <p className="text-sm mt-1">Hệ thống sẽ tự động tổng hợp những nội dung hot từ Các nguồn (Tab Cấu Hình Nguồn Cào).</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {posts.map((post) => (
                                <div
                                    key={post._id}
                                    className="bg-black/20 border border-white/10 rounded-xl p-4 flex flex-col justify-between hover:border-violet-500/40 transition"
                                >
                                    <div>
                                        {/* Author & Group */}
                                        <div className="flex items-center gap-2 mb-2 text-xs text-gray-400">
                                            <span className="font-semibold text-gray-200">{post.author_name}</span>
                                            <span>•</span>
                                            <span>{post.group_name || `Nguồn id: ${post.group_id}`}</span>
                                        </div>

                                        {/* Content */}
                                        <p className="text-sm text-gray-300 whitespace-pre-wrap line-clamp-5 mb-3 leading-relaxed">
                                            {post.content}
                                        </p>

                                        {/* Media */}
                                        {post.media_urls && post.media_urls.length > 0 && (
                                            <div className="flex gap-2 mb-3">
                                                {post.media_urls.slice(0, 3).map((url: string, i: number) => (
                                                    <div key={i} className="w-16 h-16 rounded-lg overflow-hidden bg-white/10 border border-white/10">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img src={url} alt="" className="w-full h-full object-cover" />
                                                    </div>
                                                ))}
                                                {post.media_urls.length > 3 && (
                                                    <div className="w-16 h-16 rounded-lg bg-black/40 flex items-center justify-center text-xs text-gray-300 border border-white/10 font-medium">
                                                        +{post.media_urls.length - 3}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Footer Actions */}
                                    <div className="flex items-center justify-between mt-2 pt-3 border-t border-white/5">
                                        <p className="text-[11px] text-gray-500">
                                            Lấy lúc: {new Date(post.scraped_at).toLocaleString('vi-VN')}
                                        </p>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleCopyContent(post.content)}
                                                className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-green-500/10 rounded transition"
                                                title="Copy nội dung làm Mẫu"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleBookmark(post._id)}
                                                className={`p-1.5 rounded transition ${post.is_bookmarked
                                                    ? 'text-amber-400 bg-amber-500/10'
                                                    : 'text-gray-400 hover:text-amber-400 hover:bg-amber-500/10'
                                                    }`}
                                                title={post.is_bookmarked ? 'Bỏ kế hoạch' : 'Lưu vào Kế hoạch Đăng'}
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill={post.is_bookmarked ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDeletePost(post._id)}
                                                className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition"
                                                title="Loại bỏ"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="flex justify-center gap-2 mt-6">
                            <button
                                onClick={() => setPage(Math.max(1, page - 1))}
                                disabled={page <= 1}
                                className="px-3 py-1.5 rounded-lg text-sm bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 disabled:opacity-30"
                            >
                                Trước
                            </button>
                            <span className="text-sm text-gray-400 mt-2">
                                Trang {page} / {totalPages}
                            </span>
                            <button
                                onClick={() => setPage(Math.min(totalPages, page + 1))}
                                disabled={page >= totalPages}
                                className="px-3 py-1.5 rounded-lg text-sm bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 disabled:opacity-30"
                            >
                                Sau
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* ── Tab: Nguồn Cào Tự Động ── */}
            {activeTab === 'targets' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Add Form */}
                    <div className="lg:col-span-1">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 sticky top-8">
                            <h2 className="text-lg font-semibold text-white mb-4">Thêm Nguồn Nội Dung</h2>
                            <p className="text-sm text-gray-400 mb-5">
                                Hệ thống sẽ tự động lướt trang mục tiêu đều đặn để tải nội dung hot về Kho.
                            </p>

                            <form onSubmit={handleCreateTarget} className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Tên Gợi Nhớ (Ví dụ: &quot;Top Post BDS&quot;)</label>
                                    <input
                                        type="text"
                                        value={tName}
                                        onChange={(e) => setTName(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Loại Nguồn</label>
                                    <select
                                        value={tType}
                                        onChange={(e) => setTType(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 appearance-none"
                                    >
                                        <option value="group" className="bg-gray-900">Facebook Group</option>
                                        <option value="page" className="bg-gray-900">Fanpage Facebook</option>
                                        <option value="news_feed" className="bg-gray-900">Bảng Tin (Scroll Newsfeed)</option>
                                    </select>
                                </div>

                                {tType !== 'news_feed' && (() => {
                                    const activeAccountObj = accounts.find(a => a._id === tAcc);
                                    const hasSyncedGroups = activeAccountObj?.joined_groups && activeAccountObj.joined_groups.length > 0;

                                    return (
                                        <div className="space-y-3">
                                            {tType === 'group' && hasSyncedGroups && (
                                                <div className="p-3 bg-cyan-900/20 border border-cyan-500/30 rounded-xl">
                                                    <div className="flex items-center justify-between mb-2">
                                                        <label className="block text-sm font-medium text-cyan-300">
                                                            💡 Cào từ Group đã tham gia ({selectedGroups.length}/{activeAccountObj.joined_groups?.length})
                                                        </label>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                if (selectedGroups.length === activeAccountObj.joined_groups?.length) {
                                                                    setSelectedGroups([]);
                                                                } else {
                                                                    setSelectedGroups(activeAccountObj.joined_groups?.map(g => g.id) || []);
                                                                }
                                                            }}
                                                            className="text-xs text-cyan-400 hover:text-white"
                                                        >
                                                            {selectedGroups.length === activeAccountObj.joined_groups?.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                                                        </button>
                                                    </div>

                                                    <div className="max-h-48 overflow-y-auto space-y-1 bg-black/40 border border-cyan-500/30 rounded-lg p-2 hide-scrollbar">
                                                        {activeAccountObj.joined_groups?.map(g => (
                                                            <label key={g.id} className="flex items-center gap-2 p-1.5 hover:bg-white/10 rounded cursor-pointer transition">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={selectedGroups.includes(g.id)}
                                                                    onChange={(e) => {
                                                                        if (e.target.checked) setSelectedGroups(prev => [...prev, g.id]);
                                                                        else setSelectedGroups(prev => prev.filter(id => id !== g.id));
                                                                    }}
                                                                    className="rounded border-gray-600 text-cyan-500 focus:ring-cyan-500 bg-gray-800 w-4 h-4 cursor-pointer"
                                                                />
                                                                <span className="text-sm text-gray-200 line-clamp-1">{g.name}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            <div>
                                                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                                    {tType === 'group' && hasSyncedGroups ? 'Hoặc copy đường Dẫn Thủ Công (URL)' : 'Đường Dẫn Mục Tiêu (URL)'}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={tUrl}
                                                    onChange={(e) => setTUrl(e.target.value)}
                                                    disabled={tType === 'group' && hasSyncedGroups && selectedGroups.length > 0}
                                                    placeholder={selectedGroups.length > 0 ? `Đang tạo hàng loạt từ ${selectedGroups.length} nhóm chọn trên...` : "https://facebook.com/groups/congdong..."}
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 disabled:opacity-50"
                                                />
                                            </div>
                                        </div>
                                    );
                                })()}

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Dùng Robot Tài Khoản Nào Để Quét?</label>
                                    <select
                                        value={tAcc}
                                        onChange={(e) => setTAcc(e.target.value)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 appearance-none"
                                    >
                                        <option value="" className="bg-gray-900">-- Chọn tài khoản --</option>
                                        {accounts.filter(a => a.account_type === 'profile').map((acc) => (
                                            <option key={acc._id} value={acc._id} className="bg-gray-900">
                                                ✅ {acc.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1.5">Tần Suất Quét (Giờ)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={tFreq}
                                        onChange={(e) => setTFreq(parseInt(e.target.value) || 6)}
                                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={savingTarget}
                                    className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 mt-2"
                                >
                                    {savingTarget ? 'Đang lưu...' : '+ Thêm Cấu Hình Mới'}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Table */}
                    <div className="lg:col-span-2">
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5">
                            <h2 className="text-lg font-semibold text-white mb-4">Danh Sách Tiến Trình Chạy Ngầm</h2>

                            {loadingTargets ? (
                                <div className="text-center py-10 text-gray-400">Đang tải...</div>
                            ) : targets.length === 0 ? (
                                <div className="text-center py-10 text-gray-500">Chưa thiết lập mục tiêu cào tự động nào.</div>
                            ) : (
                                <div className="space-y-3">
                                    {targets.map(target => (
                                        <div key={target._id} className="bg-black/30 border border-white/10 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <h3 className="font-semibold text-gray-200">{target.name}</h3>
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold tracking-wider ${target.active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                        {target.active ? 'ĐANG CHẠY' : 'ĐÃ DỪNG'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-cyan-400 mb-2 truncate max-w-sm">
                                                    {target.type === 'news_feed' ? '📜 Dạo Bảng Tin (Newsfeed)' : target.target_url}
                                                </p>
                                                <p className="text-xs text-gray-400">
                                                    Robot: <span className="text-gray-300 font-medium">{target.account_id?.name}</span> •
                                                    Quét mỗi: <span className="text-gray-300 font-medium">{target.frequency_hours} tiếng</span>
                                                </p>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <div className="text-center">
                                                    <p className="text-[10px] text-gray-500 uppercase font-medium">Đã Tìm</p>
                                                    <p className="text-xl font-bold text-white">{target.posts_found || 0}</p>
                                                </div>
                                                <div className="text-center flex flex-col items-center">
                                                    <p className="text-[10px] text-gray-500 uppercase font-medium">Lần Cuối</p>
                                                    <p className="text-sm text-gray-300">
                                                        {target.last_scraped_at ? new Date(target.last_scraped_at).toLocaleString('vi-VN') : 'Chưa chạy'}
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteTarget(target._id)}
                                                    className="p-2 text-gray-500 hover:text-red-400 bg-white/5 hover:bg-red-500/10 rounded-lg transition shrink-0"
                                                    title="Xóa cấu hình"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
