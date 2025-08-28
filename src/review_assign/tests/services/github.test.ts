import { jest } from '@jest/globals';

const mockExecSync = jest.fn<any>().mockReturnValue([]);
jest.unstable_mockModule('child_process', () => ({
    execSync: mockExecSync
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
    createLogger: () => ({
        error: jest.fn()
    })
}));

let githubService: typeof import('../../services/github.js');

beforeAll(async () => {
    githubService = await import('../../services/github.js');
});

describe('github service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('searchReviewedPRs', () => {
        test('searchReviewedPRs should return array with 2 elements', async () => {
            mockExecSync.mockReturnValue(JSON.stringify([
                { repository: { nameWithOwner: 'test' } },
                { repository: { nameWithOwner: 'test2' } }
            ]));
            
            const result = await githubService.searchReviewedPRs('testuser', 7);
            expect(result).toHaveLength(2);
            expect(mockExecSync).toHaveBeenCalled();
        });

        test('searchReviewedPRs should return empty array', async () => {
            mockExecSync.mockReturnValue('[]');
            
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
            mockExecSync.mockReturnValue(true);
            
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
            mockExecSync.mockReturnValue(JSON.stringify({
                "author": {
                "id": "test=",
                "is_bot": false,
                "login": "testuser",
                "name": "Test User"
                },
                "title": "Feature: Test PR",
                "url": "https://github.com/owner/test/pull/10"
            }));
            
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
}); 