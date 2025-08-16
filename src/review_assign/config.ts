import fs from 'fs';
import path from 'path';
import { Config, TeamConfig, TeamMember } from './types.js';

/**
 * Carga la configuración del archivo JSON
 */
export function loadConfiguration(): Config {
    const configPath = path.join(process.env.HOME || '~', '.codeium/windsurf/mcp_config.json');
    
    if (!fs.existsSync(configPath)) {
        throw new Error(`Archivo de configuración no encontrado: ${configPath}`);
    }
    
    try {
        const configData = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const config = configData.reviewAssign || { teams: [], reviewDays: 15 };
        
        return config;
    } catch (error) {
        console.error(`Error al cargar la configuración: ${error}`);
        throw error;
    }
}

/**
 * Filtra miembros del equipo disponibles para revisión
 */
export function filterTeamMembers(teamConfig: TeamConfig, prAuthor: string): TeamMember[] {
    return teamConfig.members.filter(member => member.nickname_github !== prAuthor);
}

/**
 * Verifica si un repositorio pertenece al equipo
 */
export function isTeamRepository(teamConfig: TeamConfig, repoFullName: string): boolean {
    return teamConfig.repositories.includes(repoFullName);
}
