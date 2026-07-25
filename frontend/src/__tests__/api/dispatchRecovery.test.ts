import { beforeEach, describe, expect, it, vi } from 'vitest';
import { bindSessionAndWait, dispatch, resetBoundSession } from '@/api/dispatch';
import { useCostStore } from '@/store/costStore';
import { useMessageStore } from '@/store/messageStore';
import { useNotificationStore } from '@/store/notificationStore';
import { useRunStore } from '@/store/runStore';
import { useSessionStore } from '@/store/sessionStore';

describe('transport-scoped bind recovery', () => {
    beforeEach(() => {
        resetBoundSession();
        window.sessionStorage.clear();
        useSessionStore.setState({ sessionId: null });
        useMessageStore.getState().clearMessages();
        useNotificationStore.getState().clearAll();
        useCostStore.setState({
            sessionCost: 0,
            totalCost: 0,
            usage: { inputTokens: 0, outputTokens: 0, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
        });
        useRunStore.setState({ recoverySnapshots: new Map(), recoveryEventSeq: new Map() });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    });

    it('matches bindRequestId, snapshots atomically, then replays frames received during recovery', async () => {
        let firstPayload: { sessionId: string; protocolVersion: number; bindRequestId: string; bindingEpoch: number } | undefined;
        let secondPayload: typeof firstPayload;
        const first = bindSessionAndWait('session-a', payload => { firstPayload = payload; });
        const second = bindSessionAndWait('session-b', payload => { secondPayload = payload; });
        await expect(first).resolves.toBe(false);

        dispatch({
            type: 'cost_update', sessionCost: 9, totalCost: 12,
            usage: { inputTokens: 2, outputTokens: 1, cacheReadInputTokens: 0, cacheCreationInputTokens: 0 },
        });
        dispatch({
            type: 'session_restored', bindRequestId: firstPayload!.bindRequestId, protocolVersion: 3,
            bindingEpoch: firstPayload!.bindingEpoch,
            messages: [], metadata: { sessionId: 'session-a', model: 'wrong', status: 'idle' },
        });
        dispatch({
            type: 'session_restored', bindRequestId: secondPayload!.bindRequestId, protocolVersion: 3,
            bindingEpoch: secondPayload!.bindingEpoch,
            messages: [], metadata: { sessionId: 'session-b', model: 'model', status: 'idle' },
            runSnapshot: { id: 'run-b', status: 'RUNNING' }, snapshotEventSeq: 42,
            activeToolCalls: [{ toolUseId: 'tool-b', toolName: 'Bash', input: { command: 'work' } }],
            costSummary: { totalCost: 3 },
        });

        await expect(second).resolves.toBe(true);
        expect(useRunStore.getState().recoveryEventSeq.get('run-b')).toBe(42);
        expect(useMessageStore.getState().activeToolCalls.has('tool-b')).toBe(true);
        expect(useCostStore.getState().sessionCost).toBe(9);
        expect(useCostStore.getState().totalCost).toBe(12);
    });

    it('clears a persisted session only when its bind returns SESSION_NOT_FOUND', async () => {
        await useSessionStore.getState().resumeSession('session-deleted');
        let payload: { sessionId: string; protocolVersion: number; bindRequestId: string; bindingEpoch: number } | undefined;
        const bound = bindSessionAndWait('session-deleted', value => { payload = value; });

        dispatch({
            type: 'protocol_error',
            code: 'SESSION_NOT_FOUND',
            supportedVersion: 3,
            bindRequestId: payload!.bindRequestId,
            bindingEpoch: payload!.bindingEpoch,
        });

        await expect(bound).resolves.toBe(false);
        expect(useSessionStore.getState().sessionId).toBe('');
        expect(window.sessionStorage.getItem('zhikuncode.activeSessionId')).toBeNull();
        expect(useNotificationStore.getState().notifications.at(-1)?.message)
            .toBe('原会话已不存在，已清除本地恢复状态');
    });

    it('does not clear a newer session when an older bind fails', async () => {
        await useSessionStore.getState().resumeSession('session-old');
        let payload: { sessionId: string; protocolVersion: number; bindRequestId: string; bindingEpoch: number } | undefined;
        const oldBind = bindSessionAndWait('session-old', value => { payload = value; });
        await useSessionStore.getState().resumeSession('session-new');

        dispatch({
            type: 'protocol_error',
            code: 'SESSION_NOT_FOUND',
            supportedVersion: 3,
            bindRequestId: payload!.bindRequestId,
            bindingEpoch: payload!.bindingEpoch,
        });

        await expect(oldBind).resolves.toBe(false);
        expect(useSessionStore.getState().sessionId).toBe('session-new');
        expect(window.sessionStorage.getItem('zhikuncode.activeSessionId')).toBe('session-new');
        expect(useNotificationStore.getState().notifications.at(-1)?.message)
            .toBe('请求恢复的会话已不存在，当前会话未受影响');
    });
});
