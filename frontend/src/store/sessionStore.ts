/**
 * SessionStore — 会话状态管理
 * SPEC: §8.3 Store #1
 * 持久化: 当前标签页的 sessionId 使用 sessionStorage，其他状态不持久化
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { subscribeWithSelector } from 'zustand/middleware';

const ACTIVE_SESSION_KEY = 'zhikuncode.activeSessionId';

function readActiveSessionId(): string | null {
    if (typeof window === 'undefined') return null;
    try {
        return window.sessionStorage.getItem(ACTIVE_SESSION_KEY);
    } catch {
        return null;
    }
}

function saveActiveSessionId(sessionId: string): void {
    if (typeof window === 'undefined') return;
    try {
        if (sessionId) {
            window.sessionStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
        } else {
            window.sessionStorage.removeItem(ACTIVE_SESSION_KEY);
        }
    } catch {
        // Storage may be unavailable (for example, browser privacy settings).
    }
}

export interface SessionStoreState {
    // 状态
    sessionId: string | null;
    model: string | null;
    status: 'idle' | 'streaming' | 'waiting_permission' | 'compacting';
    turnCount: number;
    effortValue: number;
    isAborted: boolean;

    // Actions
    createSession: (dir: string, model: string) => Promise<void>;
    resumeSession: (sessionId: string) => Promise<void>;
    setModel: (model: string) => void;
    setEffort: (value: number) => void;
    setStatus: (status: SessionStoreState['status']) => void;
    handleRateLimit: (data: { retryAfterMs: number; limitType: string }) => void;
    abort: () => void;
}

export const useSessionStore = create<SessionStoreState>()(
    subscribeWithSelector(immer((set) => ({
        // 初始值
        sessionId: readActiveSessionId(),
        model: null,
        status: 'idle' as const,
        turnCount: 0,
        effortValue: 3,
        isAborted: false,

        // Actions
        createSession: async (dir, model) => {
            set(d => { d.status = 'streaming'; d.model = model; d.turnCount = 0; d.isAborted = false; });
            const resp = await fetch('/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ dir, model }),
            });
            const { sessionId } = await resp.json();
            set(d => { d.sessionId = sessionId; });
            saveActiveSessionId(sessionId);
        },
        resumeSession: async (sessionId) => {
            set(d => { d.sessionId = sessionId; d.status = 'idle'; });
            saveActiveSessionId(sessionId);
        },
        setModel: (model) => set(d => { d.model = model; }),
        setEffort: (value) => set(d => { d.effortValue = value; }),
        setStatus: (status) => set(d => { d.status = status; }),
        handleRateLimit: (_data) => set(d => { d.status = 'idle'; }),
        abort: () => set(d => { d.isAborted = true; d.status = 'idle'; }),
    })))
);
