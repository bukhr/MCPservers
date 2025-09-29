import { jest } from '@jest/globals';

const mockErrorLogger = jest.fn();
const mockInfoLogger = jest.fn();
const mockWarnLogger = jest.fn();
jest.unstable_mockModule('../../utils/logger.js', () => ({
    createLogger: () => ({
        error: mockErrorLogger,
        info: mockInfoLogger,
        warn: mockWarnLogger,
    })
}));

let notificationService: typeof import('../../services/notification.js');

beforeAll(async () => {
    notificationService = await import('../../services/notification.js');
});

const mockFetch = (mockResponse: any, ok: boolean = true, status: number = 200) => {
    const mockJsonPromise = Promise.resolve(mockResponse);
    const mockFetchPromise = Promise.resolve({
        ok,
        json: () => mockJsonPromise,
        status,
    } as Response);
    jest.spyOn(global, 'fetch').mockImplementation(() => mockFetchPromise);
}
    

describe('notification service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });    

    test('sendChatNotification should send assignment notification', async () => {
        mockFetch({ data: 'test' });

        const webhookUrl = 'test';
        const prTitle = 'test';
        const repo = 'test';
        const prAuthor = 'test';
        const reviewerName = 'test';
        const prUrl = 'test';
        const threadKey = 'test';

        const message = {
            text: `*Nuevo PR asignado para revisión*\n\n` +
            `- *PR:* ${prTitle}\n` +
            `- *Repositorio:* ${repo}\n` +
            `- *Creado por:* ${prAuthor}\n` +
            `- *Revisor asignado:* ${reviewerName}\n` +
            `- *Link:* ${prUrl}`,
            thread: {
                threadKey
            }
        };

        await notificationService.sendChatNotification(
            webhookUrl,
            prTitle,
            repo,
            prAuthor,
            reviewerName,
            prUrl,
            threadKey
        );
        expect(global.fetch).toHaveBeenCalledTimes(1);
        expect(mockInfoLogger).toHaveBeenCalledWith('Mensaje enviada exitosamente', {
            message: JSON.stringify(message)
        });
    });

    test('sendChatNotification should not send notification', async () => {
        mockFetch({ data: 'test' });

        await notificationService.sendChatNotification(
            undefined,
            'test',
            'test',
            'test',
            'test',
            'test',
            'test'
        );
        expect(global.fetch).not.toHaveBeenCalled();
        expect(mockWarnLogger).toHaveBeenCalledWith('No se envió notificación: webhook_url no configurado');
    });

    test('sendChatNotification should log error on HTTP failure', async () => {
        mockFetch({ data: 'test' }, false, 500);

        await notificationService.sendChatNotification(
            'test',
            'test',
            'test',
            'test',
            'test',
            'test',
            'test'
        );
        expect(global.fetch).toHaveBeenCalled();
        expect(mockErrorLogger).toHaveBeenCalledWith('Error al enviar notificación', expect.objectContaining({
            error: expect.stringContaining('Error HTTP al enviar mensaje: 500'),
            repo: 'test',
            pr: 'test'
        }));
    });
});
