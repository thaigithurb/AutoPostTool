'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

// ── Search State Interface ──
interface SearchResult {
    content: string;
    author: string;
    timestamp: string;
    postUrl: string;
    groupId: string;
    groupName: string;
    hasImages: boolean;
}

interface SearchState {
    keyword: string;
    selectedAccountId: string;
    selectedGroups: string[];
    isRecent: boolean;
    results: SearchResult[];
    isSearching: boolean;
    searchDone: boolean;
    currentPage: number;
}

// ── Sync State Interface ──
interface SyncState {
    isSyncingAll: boolean;
    totalToSync: number;
    syncedCount: number;
    currentAccountName: string;
}

interface AppContextType {
    // Search
    searchState: SearchState;
    setSearchState: React.Dispatch<React.SetStateAction<SearchState>>;
    
    // Sync
    syncState: SyncState;
    setSyncState: React.Dispatch<React.SetStateAction<SyncState>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
    // Initial Search State
    const [searchState, setSearchState] = useState<SearchState>({
        keyword: '',
        selectedAccountId: '',
        selectedGroups: [],
        isRecent: true,
        results: [],
        isSearching: false,
        searchDone: false,
        currentPage: 1,
    });

    // ── Persistence Logic ──
    // Load state from localStorage on mount
    useEffect(() => {
        const saved = localStorage.getItem('fb_search_state');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Ensure we don't restore 'isSearching: true' to avoid stuck UI
                // Also ensure results is always an array
                setSearchState({ 
                    ...parsed, 
                    isSearching: false,
                    results: parsed.results || [],
                    currentPage: parsed.currentPage || 1
                });
            } catch (e) {
                console.error('Failed to restore search state:', e);
            }
        }
    }, []);

    // Save state to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('fb_search_state', JSON.stringify(searchState));
    }, [searchState]);

    // Initial Sync State
    const [syncState, setSyncState] = useState<SyncState>({
        isSyncingAll: false,
        totalToSync: 0,
        syncedCount: 0,
        currentAccountName: '',
    });

    return (
        <AppContext.Provider value={{ searchState, setSearchState, syncState, setSyncState }}>
            {children}
        </AppContext.Provider>
    );
}

export function useAppStatus() {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useAppStatus must be used within an AppProvider');
    }
    return context;
}
