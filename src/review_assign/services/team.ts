import { TeamConfig, TeamMember } from '../types/index.js';
import { createLogger } from '../utils/logger.js';

const teamLogger = createLogger('review_assign_service', 'team');

/**
 * Verifica si un repositorio pertenece a un equipo específico
 * @param team Configuración del equipo a verificar
 * @param repo Repositorio en formato owner/repo
 * @returns true si el repositorio pertenece al equipo, false en caso contrario
 */
export const isTeamRepository = (team: TeamConfig, repo: string): boolean => {
  if (!team.repositories || team.repositories.length === 0) {
    return false;
  }
  
  return team.repositories.some(teamRepo => {
    if (teamRepo.includes('*')) {
      const repoPrefix = teamRepo.replace('*', '');
      return repo.startsWith(repoPrefix);
    }
    return repo === teamRepo;
  });
};

/**
 * Obtiene la lista de miembros disponibles para revisión en un equipo
 * @param team Configuración del equipo
 * @param prAuthor Usuario que creó el PR (para excluirlo de los revisores potenciales)
 * @returns Lista de miembros disponibles para revisión
 */
export const getAvailableTeamMembers = (team: TeamConfig, prAuthor: string): TeamMember[] => {
  if (!team.members || team.members.length === 0) {
    teamLogger.warn('Equipo sin miembros configurados', { teamName: team.team_name });
    return [];
  }

  const availableMembers = team.members.filter(member => {
    if (!member.nickname_github) {
      teamLogger.warn('Miembro sin usuario de GitHub configurado', { member: member.name });
      return false;
    }
    
    return member.nickname_github.toLowerCase() !== prAuthor.toLowerCase();
  });

  if (availableMembers.length === 0) {
    teamLogger.warn('No hay miembros disponibles para revisión', { 
      teamName: team.team_name, 
      prAuthor 
    });
  }

  return availableMembers;
};
