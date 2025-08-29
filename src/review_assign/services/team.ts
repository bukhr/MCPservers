import { Config, TeamConfig, TeamMember } from '../types/index.js';
import { createLogger } from '../utils/logger.js';
import { TeamProvider } from '../interfaces/team-provider.js';

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
export const getAvailableTeamMembers = (team: TeamConfig, excludeMembersByNickname: string[]): TeamMember[] => {
  if (!team.members || team.members.length === 0) {
    teamLogger.warn('Equipo sin miembros configurados', { teamName: team.team_name });
    return [];
  }

  const availableMembers = team.members.filter(member => {
    if (!member.nickname_github) {
      teamLogger.warn('Miembro sin usuario de GitHub configurado', { member: member.name });
      return false;
    }
    
    return !excludeMembersByNickname.find(nickname => nickname.toLowerCase() === member.nickname_github.toLowerCase());
  });

  if (availableMembers.length === 0) {
    teamLogger.warn('No hay miembros disponibles para revisión', { 
      teamName: team.team_name, 
      excludeMembersByNickname 
    });
  }

  return availableMembers;
};

/**
 * Obtiene la lista de miembros de un equipo configurado en el servidor MCP
 * con la opción de detectar automáticamente los miembros del equipo en github
 * @param config Configuración del servidor MCP
 * @param teamProvider Proveedor de miembros de equipo
 * @returns Lista de miembros de un equipo
 */
export const getMembers = async (config: Config, teamProvider: TeamProvider): Promise<TeamConfig[]> => {
    const teams: TeamConfig[] = config.auto_detect_members_from_github
        ? await Promise.all(
            config.teams.map(async (team) => {
                if (!team.org || !team.team_slug) {
                    return team;
                }

                const autoMembers = await teamProvider.getMembers(team.org, team.team_slug);
                const mapByNickname = new Map<string, TeamMember>();
                for (const member of autoMembers) {
                    mapByNickname.set(member.nickname_github.toLowerCase(), { ...member });
                }
                for (const member of team.members ?? []) {
                    const key = member.nickname_github.toLowerCase();
                    if (mapByNickname.has(key)) {
                        const base = mapByNickname.get(key)!;
                        mapByNickname.set(key, {
                            nickname_github: base.nickname_github,
                            name: member.name || base.name,
                            email: member.email || base.email,
                            workloadFactor: member.workloadFactor ?? base.workloadFactor,
                        });
                    } else {
                        mapByNickname.set(key, { ...member });
                    }
                }
                const mergedMembers = Array.from(mapByNickname.values());
                return { ...team, members: mergedMembers } as TeamConfig;
            })
        )
        : config.teams;

    return teams;
}