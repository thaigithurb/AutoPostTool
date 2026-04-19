'use client';

import { useState } from 'react';
import CreatePostForm from '@/components/CreatePostForm';
import PostsTable from '@/components/PostsTable';

export default function Dashboard() {
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handlePostCreated = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard</h2>
        <p className="text-slate-500 text-sm mt-1">
          Quản lý và lên lịch bài viết tự động cho Facebook
        </p>
      </div>

      {/* Main Grid — 2 cột Desktop, 1 cột Mobile */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Form tạo bài viết (2/5) ── */}
        <div className="lg:col-span-2">
          <div className="glass-card rounded-2xl p-5 sticky top-24">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-indigo-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                Tạo bài viết
              </h3>
            </div>
            <CreatePostForm onPostCreated={handlePostCreated} />
          </div>
        </div>

        {/* ── Bảng bài viết (3/5) ── */}
        <div className="lg:col-span-3">
          <div className="glass-card rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-5">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-indigo-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-900">
                Danh sách bài viết
              </h3>
            </div>
            <PostsTable refreshTrigger={refreshTrigger} />
          </div>
        </div>
      </div>
    </div>
  );
}
