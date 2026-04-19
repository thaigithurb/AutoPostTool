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
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            
            {/* ─── PHẦN 1: GIAO DIỆN MÔ PHỎNG FACEBOOK POST ─── */}
            <div className="bg-white p-4 flex flex-col relative">
                {/* Fake Header: Giả dạng người đăng */}
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 flex-shrink-0 flex items-center justify-center text-slate-500 font-bold overflow-hidden shadow-inner">
                        {(() => {
                            const activeAccountObj = accounts.find(a => a._id === selectedAccount);
                            return activeAccountObj ? activeAccountObj.name.charAt(0).toUpperCase() : (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                            );
                        })()}
                    </div>
                    <div className="flex flex-col flex-1">
                        <span className="font-bold text-[15px] text-slate-900 leading-tight">
                            {(() => {
                                const activeAccountObj = accounts.find(a => a._id === selectedAccount);
                                return activeAccountObj ? activeAccountObj.name : 'Người đăng ẩn danh';
                            })()}
                        </span>
                        <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-500 font-medium">
                            {targetType === 'profile' && <span>Công khai • 👤</span>}
                            {targetType === 'group' && <span>Trong Group • 👥</span>}
                        </div>
                    </div>
                </div>

                {/* Textarea nội dung */}
                <textarea
                    id="post-content"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={content.split('\n').length > 6 ? Math.min(content.split('\n').length, 15) : 6}
                    placeholder={`${(() => {
                        const activeAccountObj = accounts.find(a => a._id === selectedAccount);
                        return activeAccountObj ? activeAccountObj.name.split(' ').pop() : 'Bạn';
                    })()} ơi, bạn đang nghĩ gì thế?`}
                    className="w-full text-[15px] bg-transparent border-none p-0 focus:ring-0 focus:outline-none outline-none resize-none placeholder-slate-400 text-slate-900 min-h-[400px]"
                />

                {/* Vùng Xem trước Hình ảnh */}
                {images.length > 0 && (
                    <div className="mt-2 mb-3">
                        <ImagePreview images={images} onRemove={removeImage} />
                    </div>
                )}

                {/* Add to your post Toolbar */}
                <div className="border border-slate-200 rounded-xl p-3 flex flex-wrap gap-2 items-center justify-between shadow-sm bg-slate-50/50 mt-2">
                    <span className="font-semibold text-slate-800 text-[15px]">Thêm vào bài viết</span>
                    
                    <div className="flex items-center gap-1">
                        <label
                            htmlFor="image-upload"
                            className="p-1.5 rounded-full hover:bg-slate-200 cursor-pointer transition text-emerald-500"
                            title="Thêm ảnh/video"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" viewBox="0 0 24 24" fill="currentColor">
                                <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z" />
                            </svg>
                        </label>
                        <input
                            id="image-upload"
                            type="file"
                            accept="image/*,video/*"
                            multiple
                            onChange={handleImageChange}
                            className="hidden"
                        />
                    </div>
                </div>
            </div>

            {/* ─── PHẦN 2: CẤU HÌNH ĐĂNG BÀI ÁP DỤNG MÀU INDIGO ─── */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl shadow-sm p-4 flex flex-col gap-4">
                <h4 className="font-semibold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    Cấu hình tiện ích
                </h4>

                {/* Chọn tài khoản */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Tài khoản đăng
                    </label>
                    <select
                        id="select-account"
                        value={selectedAccount}
                        onChange={(e) => setSelectedAccount(e.target.value)}
                        className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition appearance-none shadow-sm text-sm"
                    >
                        <option value="">-- Chọn tài khoản --</option>
                        {accounts.map((acc) => (
                            <option key={acc._id} value={acc._id}>
                                {acc.name} ({acc.account_type})
                            </option>
                        ))}
                    </select>
                </div>

                {/* Target Type */}
                <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 sm:col-span-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Nơi đăng
                        </label>
                        <select
                            id="select-target"
                            value={targetType}
                            onChange={(e) => setTargetType(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition appearance-none shadow-sm text-sm"
                        >
                            <option value="profile">Của mình (Profile)</option>
                            <option value="group">Vào Nhóm (Group)</option>
                        </select>
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                            Lên lịch đăng
                        </label>
                        <input
                            id="scheduled-at"
                            type="datetime-local"
                            value={scheduledAt}
                            onChange={(e) => setScheduledAt(e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition [color-scheme:light] shadow-sm text-sm cursor-pointer"
                            title="Để trống nếu muốn đăng ngay"
                        />
                    </div>
                </div>

                {/* Target IDs (Group) */}
                {targetType === 'group' && (() => {
                    const activeAccountObj = accounts.find(a => a._id === selectedAccount);
                    const availableGroups = activeAccountObj?.joined_groups || [];

                    if (selectedAccount && availableGroups.length > 0) {
                        return (
                            <div className="bg-white border border-slate-200 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-2">
                                    <label className="block text-sm font-medium text-slate-700">
                                        Nhóm đã tham gia ({selectedGroups.length}/{availableGroups.length})
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
                                        className="text-xs text-indigo-600 hover:text-indigo-800 transition font-medium"
                                    >
                                        {selectedGroups.length === availableGroups.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                                    </button>
                                </div>
                                <div className="max-h-40 overflow-y-auto space-y-1 rounded-md pr-1 custom-scrollbar">
                                    {availableGroups.map(g => (
                                        <label key={g.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded cursor-pointer transition">
                                            <input
                                                type="checkbox"
                                                checked={selectedGroups.includes(g.id)}
                                                onChange={(e) => {
                                                    if (e.target.checked) setSelectedGroups(prev => [...prev, g.id]);
                                                    else setSelectedGroups(prev => prev.filter(id => id !== g.id));
                                                }}
                                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 bg-white w-4 h-4 cursor-pointer"
                                            />
                                            <span className="text-sm text-slate-700 line-clamp-1">{g.name}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div className="bg-white border border-slate-200 rounded-lg p-3">
                            <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                Group IDs (Không có dữ liệu đồng bộ)
                            </label>
                            <textarea
                                value={targetIds}
                                onChange={(e) => setTargetIds(e.target.value)}
                                rows={2}
                                placeholder={"Nhập Group IDs, cách nhau bởi dấu cách hoặc xuống dòng\nVD: 111111 222222"}
                                className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none transition text-sm shadow-sm"
                            />
                        </div>
                    );
                })()}

                {/* Nút Submit */}
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow mt-2"
                >
                    {loading ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Đang xử lý...
                        </span>
                    ) : (
                        'Đăng bài viết'
                    )}
                </button>
            </div>
        </form>
    );
}
