import { createLogger } from './utils/logger.js';

/**
 * Logger para el módulo de notificaciones
 */
export const notificationLogger = createLogger('review_assign_notification', 'notification');

/**
 * Función para enviar notificación a Google Chat
 */
export async function sendChatNotification(
    webhookUrl: string | undefined,
    prTitle: string,
    repo: string,
    prAuthor: string,
    reviewerName: string,
    prUrl: string,
    threadKey: string
): Promise<void> {
    // Si no hay webhook configurado, no enviamos notificación
    if (!webhookUrl) {
        notificationLogger.warn('No se envió notificación: webhook_url no configurado');
        return;
    }
    
    try {
        const message = {
            text: `*Nuevo PR asignado para revisión*\n\n` +
                  `- *PR:* ${prTitle}\n` +
                  `- *Repositorio:* ${repo}\n` +
                  `- *Creado por:* ${prAuthor}\n` +
                  `- *Revisor asignado:* ${reviewerName}\n` +
                  `- *Link:* ${prUrl}`,
            thread: {
                threadKey: threadKey
            }
        };
        
        // Enviar mensaje a Google Chat
        const response = await fetch(`${webhookUrl}&messageReplyOption=REPLY_MESSAGE_FALLBACK_TO_NEW_THREAD`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message)
        });
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        notificationLogger.info('Notificación enviada exitosamente', {
            message: JSON.stringify(message)
        });
    } catch (error) {
        notificationLogger.error(`Error al enviar notificación`, {
            error: error instanceof Error ? error.message : String(error),
            repo,
            pr: prTitle
        });
        // No lanzamos error aquí para no interrumpir el flujo principal
    }
}
