'use client';

import { useState } from 'react';
import AccountForm from '@/components/AccountForm';
import AccountList from '@/components/AccountList';

interface Account {
    _id: string;
    name: string;
    account_type: string;
}

export default function AccountsPage() {
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [editingAccount, setEditingAccount] = useState<Account | null>(null);

    const handleSaved = () => {
        setRefreshTrigger((prev) => prev + 1);
        setEditingAccount(null);
    };

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h2 className="text-2xl font-bold text-white">Quản lý tài khoản</h2>
                <p className="text-gray-400 text-sm mt-1">
                    Thêm, sửa, xóa tài khoản Facebook để sử dụng cho việc đăng bài tự động
                </p>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Form thêm/sửa tài khoản */}
                <div className="lg:col-span-2">
                    <div className="glass-card rounded-2xl p-5 sticky top-24">
                        <div className="flex items-center gap-2 mb-5">
                            <div className="w-8 h-8 rounded-lg bg-violet-500/20 flex items-center justify-center">
                                {editingAccount ? (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                ) : (
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                                    </svg>
                                )}
                            </div>
                            <h3 className="text-lg font-semibold text-white">
                                {editingAccount ? `Sửa: ${editingAccount.name}` : 'Thêm tài khoản'}
                            </h3>
                        </div>
                        <AccountForm
                            editingAccount={editingAccount}
                            onSaved={handleSaved}
                            onCancel={() => setEditingAccount(null)}
                        />
                    </div>
                </div>

                {/* Danh sách tài khoản */}
                <div className="lg:col-span-3">
                    <div className="glass-card rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-5">
                            <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                            </div>
                            <h3 className="text-lg font-semibold text-white">
                                Danh sách tài khoản
                            </h3>
                        </div>
                        <AccountList
                            refreshTrigger={refreshTrigger}
                            onEdit={(acc: Account) => setEditingAccount(acc)}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
