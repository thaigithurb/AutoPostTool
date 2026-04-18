'use client';

import { useState, useEffect } from 'react';
import { fetchAccounts, createPost, uploadMedia } from '@/lib/api';
import ImagePreview from './ImagePreview';
import toast from 'react-hot-toast';

export default function CreatePostForm({ onPostCreated }) {
    // ── State ──
    const [accounts, setAccounts] = useState([]);
    const [content, setContent] = useState('');
    const [selectedAccount, setSelectedAccount] = useState('');
    const [targetType, setTargetType] = useState('profile');
    const [targetIds, setTargetIds] = useState(''); // Text ID (dự phòng)
    const [selectedGroups, setSelectedGroups] = useState([]); // Array các ID Group đã chọn
    const [scheduledAt, setScheduledAt] = useState('');
    const [images, setImages] = useState([]); // { file, preview }
    const [loading, setLoading] = useState(false);

    // ── Load accounts ──
    useEffect(() => {
        loadAccounts();
    }, []);

    const loadAccounts = async () => {
        try {
            const res = await fetchAccounts();
            setAccounts(res.data || []);
        } catch (err) {
            console.error('Lỗi tải tài khoản:', err);
        }
    };

    // ── Handle image selection ──
    const handleImageChange = (e) => {
        const files = Array.from(e.target.files);
        const newImages = files.map((file) => ({
            file,
            preview: URL.createObjectURL(file),
        }));
        setImages((prev) => [...prev, ...newImages]);
        e.target.value = ''; // Reset input
    };

    const removeImage = (index) => {
        setImages((prev) => {
            URL.revokeObjectURL(prev[index].preview);
            return prev.filter((_, i) => i !== index);
        });
    };

    // ── Submit form ──
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!content.trim()) {
            toast.error('Vui lòng nhập nội dung bài viết');
            return;
        }
        if (!selectedAccount) {
            toast.error('Vui lòng chọn tài khoản');
            return;
        }
        if (targetType === 'group' && !targetIds.trim()) {
            toast.error('Vui lòng nhập ít nhất 1 Group ID');
            return;
        }

        setLoading(true);

        try {
            // Bước 1: Upload ảnh lên Cloudinary (nếu có)
            let mediaUrls = [];
            if (images.length > 0) {
                const files = images.map((img) => img.file);
                const uploadRes = await uploadMedia(files);
                mediaUrls = uploadRes.data.map((item) => item.url);
            }

            // Bước 2: Tạo Post(s)
            const scheduledTime = scheduledAt ? new Date(scheduledAt).toISOString() : new Date().toISOString();

            if (targetType === 'group') {
                const activeAccountObj = accounts.find(a => a._id === selectedAccount);
                const hasSyncedGroups = activeAccountObj?.joined_groups?.length > 0;

                // Parse nhiều Group IDs nếu nhập tay, hoặc lấy từ list chọn if đã sync
                const groupIds = hasSyncedGroups
                    ? selectedGroups
                    : targetIds.split(/[,\s\n\r]+/).map((id) => id.trim()).filter(Boolean);

                if (groupIds.length === 0) {
                    toast.error('Vui lòng chọn ít nhất 1 Group');
                    setLoading(false);
                    return;
                }

                // Tạo 1 Post riêng cho mỗi Group
                let successCount = 0;
                for (const gid of groupIds) {
                    try {
                        let targetName = null;
                        if (hasSyncedGroups) {
                            const found = availableGroups.find(g => g.id === gid);
                            if (found) targetName = found.name;
                        }

                        await createPost({
                            content: content.trim(),
                            media_urls: mediaUrls,
                            account: selectedAccount,
                            target_type: 'group',
                            target_id: gid,
                            target_name: targetName,
                            scheduled_at: scheduledTime,
                            status: 'pending',
                        });
                        successCount++;
                    } catch (err) {
                        console.error(`Lỗi tạo post cho group ${gid}:`, err);
                    }
                }

                if (successCount > 0) {
                    toast.success(`Đã tạo ${successCount}/${groupIds.length} bài viết cho ${groupIds.length} nhóm!`);
                } else {
                    toast.error('Không tạo được bài viết nào');
                }
            } else {
                // Profile / Page — tạo 1 post duy nhất
                const activeAccountObj = accounts.find(a => a._id === selectedAccount);
                await createPost({
                    content: content.trim(),
                    media_urls: mediaUrls,
                    account: selectedAccount,
                    target_type: targetType,
                    target_name: activeAccountObj ? activeAccountObj.name : null,
                    scheduled_at: scheduledTime,
                    status: 'pending',
                });

                toast.success('Tạo bài viết thành công!');
            }

            // Reset form
            setContent('');
            setImages([]);
            setTargetIds('');
            setSelectedGroups([]);
            setScheduledAt('');

            // Notify parent để refresh bảng
            if (onPostCreated) onPostCreated();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-5">
            {/* ── Nội dung bài viết ── */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Nội dung bài viết
                </label>
                <textarea
                    id="post-content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={4}
                    placeholder="Nhập nội dung bài viết..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500/50 resize-none transition"
                />
            </div>

            {/* ── Upload ảnh ── */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Hình ảnh / Video
                </label>
                <label
                    htmlFor="image-upload"
                    className="flex items-center justify-center gap-2 w-full bg-white/5 border-2 border-dashed border-white/10 rounded-xl px-4 py-4 cursor-pointer hover:border-violet-500/40 hover:bg-violet-500/5 transition"
                >
                    <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-gray-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                    </svg>
                    <span className="text-sm text-gray-400">
                        Nhấn để chọn ảnh (tối đa 10)
                    </span>
                </label>
                <input
                    id="image-upload"
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={handleImageChange}
                    className="hidden"
                />
                <ImagePreview images={images} onRemove={removeImage} />
            </div>

            {/* ── Chọn tài khoản ── */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Tài khoản đăng
                </label>
                <select
                    id="select-account"
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition appearance-none"
                >
                    <option value="" className="bg-gray-900">-- Chọn tài khoản --</option>
                    {accounts.map((acc) => (
                        <option key={acc._id} value={acc._id} className="bg-gray-900">
                            {acc.name} ({acc.account_type})
                        </option>
                    ))}
                </select>
            </div>

            {/* ── Target type ── */}
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1.5">
                        Đăng lên
                    </label>
                    <select
                        id="select-target"
                        value={targetType}
                        onChange={(e) => setTargetType(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition appearance-none"
                    >
                        <option value="profile" className="bg-gray-900">Profile</option>
                        <option value="page" className="bg-gray-900">Page</option>
                        <option value="group" className="bg-gray-900">Group</option>
                    </select>
                </div>

                {/* Target IDs (Group) — Smart Selection */}
                {targetType === 'group' && (() => {
                    const activeAccountObj = accounts.find(a => a._id === selectedAccount);
                    const availableGroups = activeAccountObj?.joined_groups || [];

                    if (selectedAccount && availableGroups.length > 0) {
                        return (
                            <div className="col-span-2">
                                <div className="flex items-center justify-between mb-1.5">
                                    <label className="block text-sm font-medium text-gray-300">
                                        Chọn nhóm ({selectedGroups.length}/{availableGroups.length})
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (selectedGroups.length === availableGroups.length) {
                                                setSelectedGroups([]);
                                            } else {
                                                setSelectedGroups(availableGroups.map(g => g.id));
                                            }
                                        }}
                                        className="text-xs text-violet-400 hover:text-white"
                                    >
                                        {selectedGroups.length === availableGroups.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                                    </button>
                                </div>
                                <div className="max-h-48 overflow-y-auto space-y-1 bg-white/5 border border-white/10 rounded-xl p-2 hide-scrollbar">
                                    {availableGroups.map(g => (
                                        <label key={g.id} className="flex items-center gap-2 p-2 hover:bg-white/10 rounded cursor-pointer transition">
                                            <input
                                                type="checkbox"
                                                checked={selectedGroups.includes(g.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedGroups(prev => [...prev, g.id]);
                                                    else setSelectedGroups(prev => prev.filter(id => id !== g.id));
                                                }}
                                                className="rounded border-gray-600 text-violet-500 focus:ring-violet-500 bg-gray-800 w-4 h-4 cursor-pointer"
                                            />
                                            <span className="text-sm text-gray-200 line-clamp-1">{g.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        );
                    }

                    // Fallback to text area if not synced
                    return (
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-300 mb-1.5">
                                Group IDs
                            </label>
                            <textarea
                                value={targetIds}
                                onChange={(e) => setTargetIds(e.target.value)}
                                rows={2}
                                placeholder={"Nhập Group IDs, cách nhau bởi dấu cách hoặc xuống dòng\nVD: 111111 222222 333333"}
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none transition text-sm"
                            />
                            {targetIds.trim() && (
                                <p className="text-xs text-violet-400 mt-1">
                                    📋 {targetIds.split(/[,\s\n\r]+/).map(s => s.trim()).filter(Boolean).length} nhóm được chọn
                                </p>
                            )}
                            <p className="text-xs text-amber-400 mt-1.5 max-w-full">
                                💡 Mẹo: Hãy bấm "Đồng bộ Groups" ở danh sách Tài khoản bên trái để chọn ngay bằng Tên mà không cần nhập ID.
                            </p>
                        </div>
                    );
                })()}
            </div>

            {/* ── Thời gian lên lịch ── */}
            <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Thời gian đăng
                </label>
                <input
                    id="scheduled-at"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-violet-500/50 transition [color-scheme:dark]"
                />
                <p className="text-xs text-gray-500 mt-1">
                    Để trống = đăng ngay lập tức
                </p>
            </div>

            {/* ── Nút Submit ── */}
            <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-violet-500/20 hover:shadow-violet-500/40"
            >
                {loading ? (
                    <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
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
                        Đang xử lý...
                    </span>
                ) : (
                    '🚀 Tạo bài viết'
                )}
            </button>
        </form>
    );
}
