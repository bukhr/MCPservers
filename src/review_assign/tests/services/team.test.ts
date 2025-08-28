import { jest } from '@jest/globals';
import { TeamConfig } from '../../types/index.js';

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

jest.unstable_mockModule('../../utils/logger.js', () => ({
  createLogger: () => ({
      warn: jest.fn()
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
});