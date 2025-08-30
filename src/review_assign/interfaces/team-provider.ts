import { TeamMember } from '../types/index.js';

export interface TeamProvider {
  getMembers(org: string, teamSlug: string): Promise<TeamMember[]>;
}
