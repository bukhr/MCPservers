import { jest } from '@jest/globals';
import { Config, TeamConfig, TeamMember } from '../../types/index.js';
import { TeamProvider } from '../../interfaces/team-provider.js';

const team: TeamConfig = {
  team_name: 'teamTest',
  members: [
    {
      name: 'memberTest',
      email: 'memberTest@test.com',
      nickname_github: 'testuser',
    },
    {
      name: 'memberTest2',
      email: 'memberTest2@test.com',
      nickname_github: 'testuser2',
    }
  ],
  repositories: ["test", "test2", "test3"],
}

// Mock the TeamProvider interface implementation
const mockGetMembers = jest.fn<(org: string, teamSlug: string) => Promise<TeamMember[]>>();
const mockTeamProvider: TeamProvider = {
    getMembers: mockGetMembers
};

jest.unstable_mockModule('../../utils/logger.js', () => ({
  createLogger: () => ({
      warn: jest.fn(),
      error: jest.fn()
  })
}));

let teamService: typeof import('../../services/team.js');

beforeAll(async () => {
  teamService = await import('../../services/team.js');
});

describe('team service', () => {
  test('isTeamRepository', () => {
    expect(teamService.isTeamRepository(team, "test2")).toBe(true);
    expect(teamService.isTeamRepository(team, "test4")).toBe(false);
    expect(teamService.isTeamRepository({...team, repositories: []}, "test2")).toBe(false);
  });

  test('getAvailableTeamMembers', () => {
    const teamWithoutMembers = {...team, members: []};
    const teamWithOneMember = {...team, members: [team.members[0]]};
    const teamWithThreeMembers = {...team, members: [...team.members, {name: 'memberTest3', email: 'memberTest3@test.com', nickname_github: 'testuser3'}]};
    expect(teamService.getAvailableTeamMembers(team, "testuser2")).toHaveLength(1);
    expect(teamService.getAvailableTeamMembers(teamWithThreeMembers, "testuser2")).toHaveLength(2);
    expect(teamService.getAvailableTeamMembers(teamWithOneMember, "testuser")).toEqual([]);
    expect(teamService.getAvailableTeamMembers(teamWithoutMembers, "testuser")).toEqual([]);
  });

  describe('getMembers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });
    
    test('should return teams without modification when auto_detect_members_from_github is false', async () => {
      const mockConfig: Config = {
          teams: [
              {
                  team_name: 'Team 1',
                  members: [{ name: 'User 1', nickname_github: 'user1', email: '' }],
                  repositories: ['repo1']
              }
          ],
          reviewDays: 15,
          auto_detect_members_from_github: false
      };

      const result = await teamService.getMembers(mockConfig, mockTeamProvider);
      
      expect(result).toEqual(mockConfig.teams);
      expect(mockGetMembers).not.toHaveBeenCalled();
    });

    test('should fetch and merge team members when auto_detect_members_from_github is true', async () => {
      const mockConfig: Config = {
          teams: [
              {
                  team_name: 'Team 1',
                  org: 'organization',
                  team_slug: 'team-slug',
                  members: [
                      { 
                          name: 'Custom Name', 
                          nickname_github: 'user1', 
                          email: 'custom@example.com',
                          workloadFactor: 1.5 
                      }
                  ],
                  repositories: ['repo1']
              }
          ],
          reviewDays: 15,
          auto_detect_members_from_github: true
      };

      const githubMembers: TeamMember[] = [
          { name: 'User 1', nickname_github: 'user1', email: 'user1@example.com' },
          { name: 'User 2', nickname_github: 'user2', email: 'user2@example.com' }
      ];

      mockGetMembers.mockResolvedValue(githubMembers);

      const result = await teamService.getMembers(mockConfig, mockTeamProvider);
      
      expect(mockGetMembers).toHaveBeenCalledWith('organization', 'team-slug');
      expect(result[0].members).toHaveLength(2);
      
      // Check that custom values overrode GitHub values for existing users
      expect(result[0].members.find(m => m.nickname_github === 'user1')).toEqual({
          name: 'Custom Name',
          nickname_github: 'user1',
          email: 'custom@example.com',
          workloadFactor: 1.5
      });

      // Check that new GitHub users were added
      expect(result[0].members.find(m => m.nickname_github === 'user2')).toEqual({
          name: 'User 2',
          nickname_github: 'user2',
          email: 'user2@example.com'
      });
    });

    test('should skip GitHub fetching for teams without org or team_slug', async () => {
      const mockConfig: Config = {
          teams: [
              {
                  team_name: 'Team 1',
                  // Missing org and team_slug
                  members: [{ name: 'User 1', nickname_github: 'user1', email: '' }],
                  repositories: ['repo1']
              }
          ],
          reviewDays: 15,
          auto_detect_members_from_github: true
      };

      const result = await teamService.getMembers(mockConfig, mockTeamProvider);
      
      expect(result).toEqual(mockConfig.teams);
      expect(mockGetMembers).not.toHaveBeenCalled();
    });

    test('should handle case insensitivity in GitHub usernames', async () => {
      const mockConfig: Config = {
          teams: [
              {
                  team_name: 'Team 1',
                  org: 'organization',
                  team_slug: 'team-slug',
                  members: [
                      { name: 'User One', nickname_github: 'USER1', email: '' }
                  ],
                  repositories: ['repo1']
              }
          ],
          reviewDays: 15,
          auto_detect_members_from_github: true
      };

      const githubMembers: TeamMember[] = [
          { name: 'User 1 GitHub', nickname_github: 'user1', email: 'user1@example.com' }
      ];

      mockGetMembers.mockResolvedValue(githubMembers);

      const result = await teamService.getMembers(mockConfig, mockTeamProvider);
      
      expect(result[0].members).toHaveLength(1);
      expect(result[0].members[0]).toEqual({
          name: 'User One', // Preserved the custom name
          nickname_github: 'user1', // But kept the GitHub nickname case
          email: 'user1@example.com' // Used GitHub email since custom was empty
      });
    });
  });
});