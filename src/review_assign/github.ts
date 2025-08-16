import { execSync } from 'child_process';

/**
 * Asigna un revisor a un PR
 */
export async function assignReviewer(repo: string, prNumber: number, reviewer: string): Promise<void> {
    try {
        const cmd = `gh pr edit ${prNumber} --repo ${repo} --add-reviewer ${reviewer}`;
        execSync(cmd);
    } catch (error) {
        console.error(`Error al asignar revisor ${reviewer} al PR ${prNumber} en ${repo}: ${error}`);
        throw error;
    }
}

/**
 * Obtiene información de un PR
 */
export async function getPullRequestInfo(repo: string, prNumber: number) {
    try {
        const prInfoCmd = `gh pr view ${prNumber} --repo ${repo} --json title,url,author`;
        const prInfoOutput = execSync(prInfoCmd).toString();
        return JSON.parse(prInfoOutput);
    } catch (error) {
        console.error(`Error al obtener información del PR ${prNumber} en ${repo}: ${error}`);
        throw error;
    }
}

/**
 * Busca PRs revisados por un usuario en un período de tiempo
 */
export async function searchReviewedPRs(username: string, daysAgo: number) {
    try {
        // Calcular la fecha de hace N días
        const daysAgoDate = new Date();
        daysAgoDate.setDate(daysAgoDate.getDate() - daysAgo);
        const dateString = daysAgoDate.toISOString().split('T')[0];
        
        // Consultar las revisiones usando GitHub CLI
        const cmd = `gh search prs --reviewed-by ${username} --updated ">${dateString}" --json number,repository,url,title --limit 100`;
        const output = execSync(cmd).toString();
        
        // Procesar la salida JSON
        return JSON.parse(output);
    } catch (error) {
        console.error(`Error al buscar PRs revisados por ${username}: ${error}`);
        return []; // En caso de error, devolvemos una lista vacía
    }
}
