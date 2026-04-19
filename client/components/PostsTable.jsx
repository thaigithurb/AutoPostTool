'use client';

import { useState, useEffect, useCallback } from 'react';
import { fetchPosts, deletePost } from '@/lib/api';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
    pending: {
        label: 'Đang chờ',
        color: 'bg-yellow-50 text-yellow-700 border-yellow-200',
        dot: 'bg-yellow-500',
    },
    processing: {
        label: 'Đang xử lý',
        color: 'bg-blue-50 text-blue-700 border-blue-200',
        dot: 'bg-blue-500 animate-pulse',
    },
    success: {
        label: 'Thành công',
        color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        dot: 'bg-emerald-500',
    },
    failed: {
        label: 'Thất bại',
        color: 'bg-red-50 text-red-700 border-red-200',
        dot: 'bg-red-500',
    },
};

const TARGET_LABELS = {
    page: '📄 Page',
    group: '👥 Group',
    profile: '👤 Profile',
};

const translateError = (errMsg) => {
    if (!errMsg) return '';
    const lowerMsg = String(errMsg).toLowerCase();

    if (lowerMsg.includes('enoent') || lowerMsg.includes('no such file')) return 'Không tìm thấy file ảnh/video (có thể đã bị xóa trước khi đăng).';
    if (lowerMsg.includes('timeout') || lowerMsg.includes('exceeded')) return 'Kết nối quá chậm hoặc tính năng đăng bài tạm thời không phản hồi (Timeout).';
    if (lowerMsg.includes('checkpoint') || lowerMsg.includes('bị checkpoint')) return 'Tài khoản Facebook bị khóa (Checkpoint) hoặc yêu cầu xác minh.';
    if (lowerMsg.includes('hết hạn') || lowerMsg.includes('cookie')) return 'Cookies đã hết hạn, vui lòng cập nhật lại Cookies mới.';
    if (lowerMsg.includes('không tìm thấy ô') || lowerMsg.includes('không tìm thấy nút') || lowerMsg.includes('không tìm thấy editor')) return 'Bị Facebook chặn đăng bài (Spam) hoặc tài khoản bị giới hạn.';
    if (lowerMsg.includes('vô hiệu hóa')) return 'Tài khoản đã bị vô hiệu hóa trong hệ thống.';
    if (lowerMsg.includes('cannot read') || lowerMsg.includes('undefined')) return 'Lỗi hệ thống không xác định.';

    // Fallback: Nếu không phải tiếng anh (thường là lỗi tiếng Việt mình tự defined)
    return errMsg;
};

export default function PostsTable({ refreshTrigger }) {
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    
    // Pagination state
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({
        totalPosts: 0,
        totalPages: 1,
        currentPage: 1,
        limit: 10
    });

    const loadPosts = useCallback(async (targetPage = page) => {
        try {
            const res = await fetchPosts(`page=${targetPage}&limit=10`);
            setPosts(res.data || []);
            if (res.pagination) {
                setPagination(res.pagination);
            }
        } catch (err) {
            console.error('Lỗi tải bài viết:', err);
        } finally {
            setLoading(false);
            setIsRefreshing(false);
        }
    }, [page]);

    const handleManualRefresh = async () => {
        setIsRefreshing(true);
        await loadPosts(page);
        toast.success('Đã cập nhật danh sách bài viết', { icon: '🔄' });
    };

    const handlePageChange = (newPage) => {
        if (newPage < 1 || newPage > pagination.totalPages) return;
        setPage(newPage);
        setLoading(true);
        loadPosts(newPage);
    };

    // Load lần đầu + khi parent trigger refresh
    useEffect(() => {
        loadPosts(page);
    }, [refreshTrigger, loadPosts]);

    // Auto-refresh mỗi 30 giây (giữ đúng trang hiện tại)
    useEffect(() => {
        const interval = setInterval(() => loadPosts(page), 30000);
        return () => clearInterval(interval);
    }, [loadPosts, page]);

    // ── Hủy bài viết (pending → deleted) ──
    const handleCancel = async (id) => {
        if (!confirm('Bạn muốn hủy bài viết này?')) return;
        try {
            await deletePost(id);
            await loadPosts(page);
        } catch (err) {
            toast.error('Lỗi: ' + err.message);
        }
    };

    // ── Format thời gian ──
    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleString('vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (loading && posts.length === 0) {
        return (
            <div className="flex items-center justify-center py-12">
                <svg className="animate-spin h-8 w-8 text-indigo-600" viewBox="0 0 24 24">
                    <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                    />
                    <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                </svg>
            </div>
        );
    }

    if (posts.length === 0 && !loading) {
        return (
            <div className="text-center py-12 text-slate-500">
                <div className="flex justify-end mb-4">
                    <button
                        onClick={handleManualRefresh}
                        className="text-sm text-indigo-600 hover:text-indigo-700 transition flex items-center gap-1 font-medium"
                    >
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                            />
                        </svg>
                        Làm mới
                    </button>
                </div>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-12 w-12 mx-auto mb-3 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                </svg>
                <p className="font-medium">Chưa có bài viết nào</p>
                <p className="text-sm mt-1">Tạo bài viết đầu tiên ở form bên trái</p>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">
                    Tổng cộng: <span className="text-slate-900 font-semibold">{pagination.totalPosts}</span> bài viết
                </p>
                <button
                    onClick={handleManualRefresh}
                    disabled={isRefreshing}
                    className="text-sm text-indigo-600 hover:text-indigo-700 transition flex items-center gap-1 font-medium disabled:opacity-50"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                        />
                    </svg>
                    Làm mới
                </button>
            </div>

            {/* ── Desktop Table (ẩn trên mobile) ── */}
            <div className="hidden md:block overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="border-b border-slate-200 bg-slate-50">
                            <th className="text-left px-4 py-3 text-slate-500 font-medium">Nội dung</th>
                            <th className="text-left px-4 py-3 text-slate-500 font-medium">Target</th>
                            <th className="text-left px-4 py-3 text-slate-500 font-medium">Thời gian</th>
                            <th className="text-left px-4 py-3 text-slate-500 font-medium">Trạng thái</th>
                            <th className="text-left px-4 py-3 text-slate-500 font-medium">Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {posts.map((post) => {
                            const status = STATUS_CONFIG[post.status] || STATUS_CONFIG.pending;
                            return (
                                <tr
                                    key={post._id}
                                    className="border-b border-slate-100 hover:bg-slate-50 transition"
                                >
                                    <td className="px-4 py-3">
                                        <p className="text-slate-900 truncate max-w-[200px]" title={post.content}>
                                            {post.content}
                                        </p>
                                        {post.media_urls?.length > 0 && (
                                            <span className="text-xs text-slate-500">
                                                📎 {post.media_urls.length} media
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-slate-700 text-nowrap">
                                        <div className="flex flex-col">
                                            <span className="font-medium text-slate-900">{post.account?.name || '—'}</span>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-xs text-slate-500">{TARGET_LABELS[post.target_type] || post.target_type}</span>
                                                {post.target_name && (
                                                    <span className="text-[10px] text-slate-400 max-w-[120px] truncate" title={post.target_name}>
                                                        / {post.target_name}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-slate-500 text-xs">
                                        {formatDate(post.scheduled_at)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span
                                            className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${status.color}`}
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                                            <div className='text-nowrap'>
                                                {status.label}
                                            </div>
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        {post.status !== 'success' && (
                                            <button
                                                onClick={() => handleCancel(post._id)}
                                                className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-3 py-1.5 rounded-lg transition font-medium"
                                            >
                                                Hủy
                                            </button>
                                        )}
                                        {post.status === 'failed' && post.error_message && (
                                            <span
                                                className="text-xs text-slate-500 cursor-help ml-2"
                                                title={translateError(post.error_message)}
                                            >
                                                ⓘ Lỗi
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* ── Mobile Cards (ẩn trên desktop) ── */}
            <div className="md:hidden space-y-3">
                {posts.map((post) => {
                    const status = STATUS_CONFIG[post.status] || STATUS_CONFIG.pending;
                    return (
                        <div
                            key={post._id}
                            className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 shadow-sm"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <p className="text-slate-900 text-sm line-clamp-2 flex-1">{post.content}</p>
                                <span
                                    className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full border whitespace-nowrap ${status.color}`}
                                >
                                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                                    {status.label}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
                                <div className="flex flex-col gap-0.5 text-nowrap">
                                    <span className="font-medium text-slate-900">{post.account?.name}</span>
                                    <div className="flex items-center gap-1 truncate max-w-[150px]">
                                        <span>{TARGET_LABELS[post.target_type]}</span>
                                        {post.target_name && (
                                            <span className="text-[10px] text-slate-400 truncate">/ {post.target_name}</span>
                                        )}
                                    </div>
                                </div>
                                <span className='text-nowrap ml-2'>{formatDate(post.scheduled_at)}</span>
                            </div>
                            {post.status !== 'success' && (
                                <button
                                    onClick={() => handleCancel(post._id)}
                                    className="w-full text-sm text-red-600 border border-red-200 rounded-lg py-2 hover:bg-red-50 transition font-medium"
                                >
                                    Hủy bài viết
                                </button>
                            )}
                            {post.status === 'failed' && post.error_message && (
                                <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2">
                                    {translateError(post.error_message)}
                                </p>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ── Pagination Controls ── */}
            {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                    <p className="text-xs text-slate-500">
                        Hiển thị bài {((pagination.currentPage - 1) * pagination.limit) + 1} đến {Math.min(pagination.currentPage * pagination.limit, pagination.totalPosts)} trong tổng số {pagination.totalPosts}
                    </p>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handlePageChange(page - 1)}
                            disabled={page === 1 || loading}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>
                        <div className="flex items-center gap-1">
                            {[...Array(pagination.totalPages)].map((_, i) => (
                                <button
                                    key={i + 1}
                                    onClick={() => handlePageChange(i + 1)}
                                    className={`w-8 h-8 text-xs font-medium rounded-lg transition ${
                                        page === i + 1
                                            ? 'bg-indigo-600 text-white shadow-md shadow-indigo-200'
                                            : 'text-slate-600 hover:bg-slate-100 border border-transparent'
                                    }`}
                                >
                                    {i + 1}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={() => handlePageChange(page + 1)}
                            disabled={page === pagination.totalPages || loading}
                            className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:hover:bg-transparent transition"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
