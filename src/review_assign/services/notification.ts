import { createLogger } from '../utils/logger.js';

export const notificationLogger = createLogger('review_assign_notification', 'notification');

/**
 * Envía un mensaje a Google Chat en un hilo
 * @param webhookUrl URL del webhook del espacio de Google Chat
 * @param threadKey Clave del hilo
 * @param text Texto del mensaje
 */
export const postChatMessage = async (
    webhookUrl: string,
    threadKey: string,
    text: string
) => {
    const threadPayload = threadKey?.startsWith('spaces/')
        ? { name: threadKey }
        : { threadKey };

    const payload = {
        text,
        thread: threadPayload
    };
    const resp = await fetch(`${webhookUrl}&messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!resp.ok) {
        throw new Error(`Error HTTP al enviar mensaje: ${resp.status}`);
    }
    notificationLogger.info(`Mensaje enviada exitosamente`, {
        message: JSON.stringify(payload)
    });
};

/**
 * Envía una notificación al Google Chat
 * @param webhookUrl URL del webhook del espacio de Google Chat
 * @param prTitle Título del PR
 * @param repo Repositorio en formato owner/repo
 * @param prAuthor Login del autor del PR
 * @param reviewerName Nombre del revisor
 * @param prUrl URL del PR
 * @param threadKey Clave del hilo
 */
export const sendChatNotification = async (
    webhookUrl: string | undefined,
    prTitle: string,
    repo: string,
    prAuthor: string,
    reviewerName: string,
    prUrl: string,
    threadKey: string
): Promise<void> => {
    if (!webhookUrl) {
        notificationLogger.warn('No se envió notificación: webhook_url no configurado');
        return;
    }
    
    try {
        const assignmentText = `*Nuevo PR asignado para revisión*\n\n` +
            `- *PR:* ${prTitle}\n` +
            `- *Repositorio:* ${repo}\n` +
            `- *Creado por:* ${prAuthor}\n` +
            `- *Revisor asignado:* ${reviewerName}\n` +
            `- *Link:* ${prUrl}`;
        
        await postChatMessage(webhookUrl, threadKey, assignmentText);
    } catch (error) {
        notificationLogger.error(`Error al enviar notificación`, {
            error: error instanceof Error ? error.message : String(error),
            repo,
            pr: prTitle
        });
    }
}
