import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useConfigStore } from '@/store/configStore';
import { useProjectStore, type Project } from '@/store/projectStore';
import { useSessionStore } from '@/store/sessionStore';
import { requestAuthorizedSession } from './authorizedSession';

const project: Project = {
    id: 'project-1',
    name: 'Demo',
    workspaceRoot: '/workspace/demo',
    createdAt: '2026-07-30T00:00:00Z',
};

const originalRequestSelection =
    useProjectStore.getState().requestSelection;
const originalCreateSession = useSessionStore.getState().createSession;

describe('requestAuthorizedSession', () => {
    beforeEach(() => {
        useConfigStore.setState({ defaultModel: 'model-default' });
        useProjectStore.setState({
            requestSelection: originalRequestSelection,
        });
        useSessionStore.setState({
            sessionId: null,
            createSession: originalCreateSession,
        });
    });

    afterEach(() => {
        useProjectStore.setState({
            requestSelection: originalRequestSelection,
        });
        useSessionStore.setState({
            sessionId: null,
            createSession: originalCreateSession,
        });
        vi.restoreAllMocks();
    });

    it('creates a Session only after a Project is selected', async () => {
        const requestSelection = vi.fn().mockResolvedValue(project);
        const createSession = vi.fn()
            .mockResolvedValue('session-created');
        useProjectStore.setState({ requestSelection });
        useSessionStore.setState({ createSession });

        await expect(requestAuthorizedSession())
            .resolves.toBe('session-created');

        expect(requestSelection).toHaveBeenCalledTimes(1);
        expect(createSession).toHaveBeenCalledWith(
            project.id,
            'model-default',
        );
    });

    it('does not create a Session when folder selection is canceled', async () => {
        const requestSelection = vi.fn().mockResolvedValue(null);
        const createSession = vi.fn();
        useProjectStore.setState({ requestSelection });
        useSessionStore.setState({ createSession });

        await expect(requestAuthorizedSession()).resolves.toBeNull();

        expect(createSession).not.toHaveBeenCalled();
    });

    it('shares one authorization and Session request across double sends', async () => {
        let resolveSelection!: (selection: Project | null) => void;
        const selection = new Promise<Project | null>(resolve => {
            resolveSelection = resolve;
        });
        const requestSelection = vi.fn(() => selection);
        const createSession = vi.fn()
            .mockResolvedValue('session-created');
        useProjectStore.setState({ requestSelection });
        useSessionStore.setState({ createSession });

        const first = requestAuthorizedSession();
        const second = requestAuthorizedSession();

        expect(second).toBe(first);
        expect(requestSelection).toHaveBeenCalledTimes(1);
        resolveSelection(project);
        await expect(Promise.all([first, second])).resolves.toEqual([
            'session-created',
            'session-created',
        ]);
        expect(createSession).toHaveBeenCalledTimes(1);
    });
});
