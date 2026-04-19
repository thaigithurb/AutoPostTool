import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { AppProvider } from "@/lib/AppContext";
import ToastProvider from "@/components/ToastProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Auto Post Tool - Dashboard",
  description: "Quản lý đăng bài tự động lên Facebook",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="light">
      <body
        className={`${inter.className} bg-slate-50 text-slate-900 min-h-screen antialiased`}
      >
        <AppProvider>
          {/* Toast Notifications (Client Component) */}
          <ToastProvider />

          {/* Top bar */}
          <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-xl">
            <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-indigo-500/20">
                  AP
                </div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-indigo-400 to-indigo-400 bg-clip-text text-transparent">
                  Auto Post Tool
                </h1>
              </div>
              <div className="flex items-center gap-2">
                Janencl - @thaigithurb
              </div>
            </div>
          </header>

          {/* Layout: Sidebar + Main content */}
          <div className="flex">
            <Sidebar />
            <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 pb-20 md:pb-6 overflow-x-hidden">
              {children}
            </main>
          </div>
        </AppProvider>
      </body>
    </html>
  );
}
