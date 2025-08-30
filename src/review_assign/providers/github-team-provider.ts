import { TeamMember } from '../types/index.js';
import { TeamProvider } from '../interfaces/team-provider.js';
import { getTeamMembers } from '../services/github.js';

export class GithubTeamProvider implements TeamProvider {
  async getMembers(org: string, teamSlug: string): Promise<TeamMember[]> {
    return await getTeamMembers(org, teamSlug);
  }
}
