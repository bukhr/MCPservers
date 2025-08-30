import { jest } from '@jest/globals';
import { TeamMember } from '../../types/index.js';
import { TeamProvider } from '../../interfaces/team-provider.js';

const mockGetTeamMembers = jest.fn<() => Promise<TeamMember[]>>();
jest.unstable_mockModule('../../services/github.js', () => ({
    getTeamMembers: mockGetTeamMembers
}));

let GithubTeamProvider: typeof import('../../providers/github-team-provider.js').GithubTeamProvider;

beforeAll(async () => {
    const module = await import('../../providers/github-team-provider.js');
    GithubTeamProvider = module.GithubTeamProvider;
});

describe('GithubTeamProvider', () => {
    let provider: InstanceType<typeof GithubTeamProvider>;
    
    beforeEach(() => {
        jest.clearAllMocks();
        provider = new GithubTeamProvider();
    });
    
    test('should retrieve team members from github service', async () => {
        const mockMembers: TeamMember[] = [
            { name: 'User One', email: 'user1@example.com', nickname_github: 'user1' },
            { name: 'User Two', email: 'user2@example.com', nickname_github: 'user2' }
        ];
        
        mockGetTeamMembers.mockResolvedValue(mockMembers);
        
        const result = await provider.getMembers('organization', 'team-slug');
        
        expect(result).toEqual(mockMembers);
        expect(mockGetTeamMembers).toHaveBeenCalledWith('organization', 'team-slug');
    });
    
    test('should handle empty team members list', async () => {
        mockGetTeamMembers.mockResolvedValue([]);
        
        const result = await provider.getMembers('organization', 'team-slug');
        
        expect(result).toEqual([]);
        expect(mockGetTeamMembers).toHaveBeenCalledWith('organization', 'team-slug');
    });
    
    test('should propagate errors from github service', async () => {
        const mockError = new Error('API error');
        mockGetTeamMembers.mockRejectedValue(mockError);
        
        await expect(provider.getMembers('organization', 'team-slug'))
            .rejects.toThrow('API error');
            
        expect(mockGetTeamMembers).toHaveBeenCalledWith('organization', 'team-slug');
    });
});
