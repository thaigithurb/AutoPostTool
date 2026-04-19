'use client';

import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

export default function AccountForm({ editingAccount, onSaved, onCancel }) {
    const [name, setName] = useState('');
    const [accountType, setAccountType] = useState('profile');
    const [cookies, setCookies] = useState('');
    const [accessToken, setAccessToken] = useState('');
    const [proxy, setProxy] = useState('');
    const [loading, setLoading] = useState(false);

    // Pre-fill form nếu đang sửa
    useEffect(() => {
        if (editingAccount) {
            setName(editingAccount.name || '');
            setAccountType(editingAccount.account_type || 'profile');
            setProxy(editingAccount.proxy || '');
            // Cookies và token đã bị mask → không fill lại
            setCookies('');
            setAccessToken('');
        } else {
            resetForm();
        }
    }, [editingAccount]);

    const resetForm = () => {
        setName('');
        setAccountType('profile');
        setCookies('');
        setAccessToken('');
        setProxy('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error('Vui lòng nhập tên tài khoản');
            return;
        }

        // Validate cookies JSON (chỉ khi không sửa hoặc có nhập mới)
        let parsedCookies = undefined;
        if (cookies.trim()) {
            try {
                parsedCookies = JSON.parse(cookies.trim());
                if (!Array.isArray(parsedCookies)) {
                    toast.error('Cookies phải là JSON Array (bắt đầu bằng [ và kết thúc bằng ])');
                    return;
                }
            } catch {
                toast.error('Cookies không đúng định dạng JSON. Hãy copy nguyên văn từ EditThisCookie.');
                return;
            }
        }

        setLoading(true);

        try {
            const { createAccount, updateAccount } = await import('@/lib/api');

            const data = {
                name: name.trim(),
                platform: 'facebook',
                account_type: accountType,
                ...(proxy.trim() && { proxy: proxy.trim() }),
            };

            if (parsedCookies) {
                data.cookies = parsedCookies;
            }
            if (accessToken.trim()) {
                data.access_token = accessToken.trim();
            }

            if (editingAccount) {
                await updateAccount(editingAccount._id, data);
                toast.success('Cập nhật tài khoản thành công!');
            } else {
                await createAccount(data);
                toast.success('Tạo tài khoản thành công!');
            }

            resetForm();
            if (onSaved) onSaved();
        } catch (err) {
            toast.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            {/* Tên tài khoản */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Tên tài khoản
                </label>
                <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: Tài khoản chính"
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition shadow-sm"
                />
            </div>

            {/* Loại tài khoản */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Loại tài khoản
                </label>
                <select
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition appearance-none shadow-sm"
                >
                    <option value="profile" className="bg-white">👤 Profile (Trang cá nhân)</option>
                    <option value="page" className="bg-white">📄 Page (Fanpage)</option>
                </select>
            </div>

            {/* Cookies */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Cookies (JSON)
                    {editingAccount && (
                        <span className="text-slate-500 font-normal"> — để trống nếu không đổi</span>
                    )}
                </label>
                <textarea
                    value={cookies}
                    onChange={(e) => setCookies(e.target.value)}
                    rows={5}
                    placeholder='Paste cookies từ EditThisCookie vào đây...&#10;&#10;Hướng dẫn:&#10;1. Cài extension EditThisCookie cho Chrome&#10;2. Đăng nhập Facebook&#10;3. Click icon 🍪 → Export&#10;4. Paste vào ô này'
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none transition text-sm font-mono shadow-sm"
                />
                {cookies.trim() && (
                    <p className="text-xs mt-1">
                        {(() => {
                            try {
                                const parsed = JSON.parse(cookies.trim());
                                if (Array.isArray(parsed)) {
                                    return <span className="text-emerald-600">✅ JSON hợp lệ — {parsed.length} cookies</span>;
                                }
                                return <span className="text-red-600">❌ Phải là JSON Array</span>;
                            } catch {
                                return <span className="text-red-600">❌ JSON không hợp lệ</span>;
                            }
                        })()}
                    </p>
                )}
            </div>

            {/* Access Token (chỉ hiện khi chọn Page) */}
            {accountType === 'page' && (
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Page Access Token
                        {editingAccount && (
                            <span className="text-slate-500 font-normal"> — để trống nếu không đổi</span>
                        )}
                    </label>
                    <input
                        type="text"
                        value={accessToken}
                        onChange={(e) => setAccessToken(e.target.value)}
                        placeholder="EAABx..."
                        className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition font-mono text-sm shadow-sm"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                        Lấy từ{' '}
                        <a
                            href="https://developers.facebook.com/tools/explorer/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:underline"
                        >
                            Facebook Graph API Explorer
                        </a>
                    </p>
                </div>
            )}

            {/* Proxy */}
            <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Proxy
                    <span className="text-slate-500 font-normal"> (tùy chọn)</span>
                </label>
                <input
                    type="text"
                    value={proxy}
                    onChange={(e) => setProxy(e.target.value)}
                    placeholder="http://username:password@ip:port"
                    className="w-full bg-white border border-slate-300 rounded-xl px-4 py-3 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition font-mono text-sm shadow-sm"
                />
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
                <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-indigo-600 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 text-white font-semibold py-3 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20"
                >
                    {loading ? 'Đang xử lý...' : editingAccount ? '💾 Cập nhật' : '➕ Thêm tài khoản'}
                </button>
                {editingAccount && (
                    <button
                        type="button"
                        onClick={() => {
                            resetForm();
                            if (onCancel) onCancel();
                        }}
                        className="px-6 py-3 border border-slate-300 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition"
                    >
                        Hủy
                    </button>
                )}
            </div>
        </form>
    );
}
