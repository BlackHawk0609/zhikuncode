import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSessionStore } from '../sessionStore';

describe('SessionStore', () => {
    beforeEach(() => {
        window.sessionStorage.clear();
        useSessionStore.setState({
            sessionId: null,
            model: null,
            status: 'idle',
            turnCount: 0,
            effortValue: 3,
            isAborted: false,
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it('should start with idle status', () => {
        const state = useSessionStore.getState();
        expect(state.status).toBe('idle');
        expect(state.sessionId).toBeNull();
        expect(state.model).toBeNull();
    });

    it('setModel updates model', () => {
        useSessionStore.getState().setModel('gpt-4o');
        expect(useSessionStore.getState().model).toBe('gpt-4o');
    });

    it('setStatus updates status', () => {
        useSessionStore.getState().setStatus('streaming');
        expect(useSessionStore.getState().status).toBe('streaming');
    });

    it('setEffort updates effort value', () => {
        useSessionStore.getState().setEffort(5);
        expect(useSessionStore.getState().effortValue).toBe(5);
    });

    it('abort sets isAborted and status to idle', () => {
        useSessionStore.getState().setStatus('streaming');
        useSessionStore.getState().abort();
        
        const state = useSessionStore.getState();
        expect(state.isAborted).toBe(true);
        expect(state.status).toBe('idle');
    });

    it('resumeSession sets sessionId and idle status', async () => {
        await useSessionStore.getState().resumeSession('session-123');
        const state = useSessionStore.getState();
        expect(state.sessionId).toBe('session-123');
        expect(state.status).toBe('idle');
        expect(window.sessionStorage.getItem('zhikuncode.activeSessionId')).toBe('session-123');
    });

    it('createSession persists the created sessionId', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            json: async () => ({ sessionId: 'session-created' }),
        }));

        await useSessionStore.getState().createSession('/workspace', 'gpt-4o');

        expect(useSessionStore.getState().sessionId).toBe('session-created');
        expect(window.sessionStorage.getItem('zhikuncode.activeSessionId')).toBe('session-created');
    });

    it('resumeSession with an empty id clears the persisted session', async () => {
        window.sessionStorage.setItem('zhikuncode.activeSessionId', 'session-old');

        await useSessionStore.getState().resumeSession('');

        expect(useSessionStore.getState().sessionId).toBe('');
        expect(window.sessionStorage.getItem('zhikuncode.activeSessionId')).toBeNull();
    });

    it('restores the active session when the store module is reloaded', async () => {
        window.sessionStorage.setItem('zhikuncode.activeSessionId', 'session-restored');
        vi.resetModules();

        const { useSessionStore: restoredStore } = await import('../sessionStore');

        expect(restoredStore.getState().sessionId).toBe('session-restored');
    });
});
