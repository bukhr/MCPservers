import { jest } from '@jest/globals';
import { TeamMember } from '../../types/index.js';

const mockExecSync = jest.fn<(command: string) => Buffer>();

jest.unstable_mockModule('child_process', () => ({
    execSync: mockExecSync
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
    createLogger: () => ({
        error: jest.fn()
    })
}));

let githubService: any;

beforeAll(async () => {
    githubService = await import('../../services/github.js');
});

describe('github service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('searchReviewedPRs', () => {
        test('searchReviewedPRs should return array with 2 elements', async () => {
            mockExecSync.mockReturnValue(Buffer.from(JSON.stringify([
                { repository: { nameWithOwner: 'test' } },
                { repository: { nameWithOwner: 'test2' } }
            ])));
            
            const result = await githubService.searchReviewedPRs('testuser', 7);
            expect(result).toHaveLength(2);
            expect(mockExecSync).toHaveBeenCalled();
        });

        test('searchReviewedPRs should return empty array', async () => {
            mockExecSync.mockReturnValue(Buffer.from('[]'));
            
            const result = await githubService.searchReviewedPRs('testuser', 7);
            expect(result).toHaveLength(0);
            expect(mockExecSync).toHaveBeenCalled();
        });

        test('searchReviewedPRs should throw error', async () => {
            mockExecSync.mockImplementation(() => {
                throw new Error('Error al buscar PRs revisados');
            });
            
            const result = await githubService.searchReviewedPRs('testuser', 7);
            expect(result).toHaveLength(0);
            expect(mockExecSync).toHaveBeenCalled();
        });
    });

    describe('assignReviewer', () => {
        test('assignReviewer should assign reviewer', async () => {
            mockExecSync.mockReturnValue(Buffer.from(''));
            
            const result = await githubService.assignReviewer('test', 10, 'testuser');
            expect(result).toBeUndefined();
            expect(mockExecSync).toHaveBeenCalled();
        });
    
        test('assignReviewer should throw error', async () => {
            mockExecSync.mockImplementation(() => {
                throw new Error('Error al asignar revisor');
            });
            
            expect(() => githubService.assignReviewer('test', 10, 'testuser')).rejects.toThrow('Error al asignar revisor');
            expect(mockExecSync).toHaveBeenCalled();
        });
    });

    describe('getPullRequestInfo', () => {
        test('getPullRequestInfo', async () => {
            mockExecSync.mockReturnValue(Buffer.from(JSON.stringify({
                "author": {
                "id": "test=",
                "is_bot": false,
                "login": "testuser",
                "name": "Test User"
                },
                "title": "Feature: Test PR",
                "url": "https://github.com/owner/test/pull/10"
            })));
            
            const result = await githubService.getPullRequestInfo('test', 1);
            expect(result).toBeDefined();
            expect(mockExecSync).toHaveBeenCalled();
        });

        test('getPullRequestInfo should throw error', async () => {
            mockExecSync.mockImplementation(() => {
                throw new Error('Error al obtener información del PR');
            });
            
            expect(() => githubService.getPullRequestInfo('test', 1)).rejects.toThrow('Error al obtener información del PR');
            expect(mockExecSync).toHaveBeenCalled();
        });
    });

    describe('getTeamMembers', () => {
        beforeEach(async () => {
            jest.clearAllMocks();
            jest.resetModules();
            githubService = await import('../../services/github.js');
        });

        test('should fetch and return team members', async () => {
            mockExecSync.mockImplementation((cmd: string) => {
                if (cmd.includes('/orgs/org-name/teams/team-slug/members')) {
                    return Buffer.from('user1\nuser2');
                } else if (cmd.includes('/users/user1')) {
                    return Buffer.from(JSON.stringify({
                        login: 'user1',
                        name: 'User One',
                        email: 'user1@example.com'
                    }));
                } else if (cmd.includes('/users/user2')) {
                    return Buffer.from(JSON.stringify({
                        login: 'user2',
                        name: 'User Two',
                        email: 'user2@example.com'
                    }));
                }
                return Buffer.from('{}');
            });
            
            const result = await githubService.getTeamMembers('org-name', 'team-slug');
            
            expect(result).toHaveLength(2);
            expect(result[0]).toEqual({
                name: 'User One',
                email: 'user1@example.com',
                nickname_github: 'user1'
            });
            expect(result[1]).toEqual({
                name: 'User Two',
                email: 'user2@example.com',
                nickname_github: 'user2'
            });
        });

        test('should handle missing user data', async () => {
            mockExecSync.mockImplementation((cmd: string) => {
                if (cmd.includes('/orgs/org-name/teams/team-slug/members')) {
                    return Buffer.from('user1');
                } else if (cmd.includes('/users/user1')) {
                    return Buffer.from(JSON.stringify({
                        login: 'user1',
                        name: null,
                        email: null
                    }));
                }
                return Buffer.from('{}');
            });
            
            const result = await githubService.getTeamMembers('org-name', 'team-slug');
            
            expect(result).toHaveLength(1);
            expect(result[0]).toEqual({
                name: 'user1',
                email: '',
                nickname_github: 'user1'
            });
        });

        test('should handle errors fetching user profiles', async () => {
            mockExecSync.mockImplementation((cmd: string) => {
                if (cmd.includes('/orgs/org-name/teams/team-slug/members')) {
                    return Buffer.from('user1');
                } else if (cmd.includes('/users/user1')) {
                    throw new Error('Error al obtener perfil');
                }
                return Buffer.from('{}');
            });
            
            const result = await githubService.getTeamMembers('org-name', 'team-slug');
            
            expect(result).toHaveLength(0);
        });

        test('should handle errors fetching team members list', async () => {
            mockExecSync.mockImplementation((cmd: string) => {
                if (cmd.includes('/orgs/org-name/teams/team-slug/members')) {
                    throw new Error('Error al obtener miembros del equipo');
                }
                return Buffer.from('{}');
            });
            
            const result = await githubService.getTeamMembers('org-name', 'team-slug');
            
            expect(result).toEqual([]);
        });

        test('should handle subsequent calls with cache', async () => {
            mockExecSync.mockImplementation((cmd: string) => {
                if (cmd.includes('/orgs/org-name/teams/team-slug/members')) {
                    return Buffer.from('user1');
                } else if (cmd.includes('/users/user1')) {
                    return Buffer.from(JSON.stringify({
                        login: 'user1',
                        name: 'User One',
                        email: 'user1@example.com'
                    }));
                }
                return Buffer.from('{}');
            });
            
            const result1 = await githubService.getTeamMembers('org-name', 'team-slug');
            expect(result1).toHaveLength(1);
            
            jest.clearAllMocks();
            
            const result2 = await githubService.getTeamMembers('org-name', 'team-slug');
            expect(result2).toHaveLength(1);
            expect(result2[0].name).toBe('User One');
            expect(mockExecSync).not.toHaveBeenCalled();
        });
    });
});