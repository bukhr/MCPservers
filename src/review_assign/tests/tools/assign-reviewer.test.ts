import { jest } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PullRequestInfo, ReviewerSelection } from '../../types/index.js';

type ToolHandler = (params: any) => Promise<{ content: Array<{ type: string; text: string }> }>;

const mockLoadConfiguration = jest.fn().mockReturnValue({});
jest.unstable_mockModule('../../config/settings.js', () => ({
    loadConfiguration: mockLoadConfiguration,
    settingsLogger: {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
    }
}));

const mockGetPullRequestInfo = jest.fn<() => Promise<PullRequestInfo>>().mockResolvedValue({
    title: '',
    url: '',
    author: { login: '' }
});
const mockAssignReviewer = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
const mockGetTeamMembers = jest.fn<() => Promise<any[]>>().mockResolvedValue([]);
jest.unstable_mockModule('../../services/github.js', () => ({
    getPullRequestInfo: mockGetPullRequestInfo,
    assignReviewer: mockAssignReviewer,
    getTeamMembers: mockGetTeamMembers
}));

const mockSelectOptimalReviewer = jest.fn<() => Promise<ReviewerSelection>>().mockResolvedValue({
    selectedReviewer: { name: '', nickname_github: '', email: '' },
    reviewerStats: []
});
jest.unstable_mockModule('../../services/reviewer.js', () => ({
    selectOptimalReviewer: mockSelectOptimalReviewer
}));

const mockSendChatNotification = jest.fn<() => Promise<void>>().mockResolvedValue(undefined);
jest.unstable_mockModule('../../services/notification.js', () => ({
    sendChatNotification: mockSendChatNotification
}));

const mockGetAvailableTeamMembers = jest.fn().mockReturnValue([]);
const mockIsTeamRepository = jest.fn().mockReturnValue(true);
const mockGetMembers = jest.fn<() => Promise<any[]>>().mockResolvedValue([]);
jest.unstable_mockModule('../../services/team.js', () => ({
    getAvailableTeamMembers: mockGetAvailableTeamMembers,
    isTeamRepository: mockIsTeamRepository,
    getMembers: mockGetMembers
}));

const mockErrorLogger = jest.fn();
const mockInfoLogger = jest.fn();
jest.unstable_mockModule('../../utils/logger.js', () => ({
    createLogger: () => ({
        error: mockErrorLogger,
        info: mockInfoLogger,
        warn: jest.fn(),
    })
}));


let toolModule: typeof import('../../tools/assign-reviewer.js');
let mockServer: McpServer;

beforeAll(async () => {
    toolModule = await import('../../tools/assign-reviewer.js');
});

beforeEach(() => {
    jest.clearAllMocks();
    
    mockServer = {
        tool: jest.fn(),
    } as unknown as McpServer;
});

describe('assign-reviewer tool', () => {
    describe('registerAssignReviewerTool', () => {
        test('should register the tool with the server', () => {
    
            toolModule.registerAssignReviewerTool(mockServer);
    
            expect(mockServer.tool).toHaveBeenCalledTimes(1);
            expect(mockServer.tool).toHaveBeenCalledWith(
                'assign_reviewer',
                'Asigna automáticamente un revisor a un PR basado en la carga de trabajo',
                expect.any(Object),
                expect.any(Function)
            );
        });
        
        test('should return successful assignment', async () => {
    
            toolModule.registerAssignReviewerTool(mockServer);
            const handlerFn = (mockServer.tool as jest.Mock).mock.calls[0][3] as ToolHandler;
            const testConfig = {
                teams: [{
                    team_name: 'Test Team',
                    repositories: ['owner/test-repo'],
                    webhook_url: 'https://webhook.test',
                    members: [
                        { name: 'Member 1', nickname_github: 'member1', email: 'member1@test.com' }
                    ]
                }]
            };

            mockLoadConfiguration.mockReturnValue(testConfig);
            mockIsTeamRepository.mockReturnValue(true);
            mockGetPullRequestInfo.mockResolvedValue({
                title: 'Test PR',
                url: 'https://github.com/owner/test-repo/pull/1',
                author: { login: 'author1' }
            });
            mockGetAvailableTeamMembers.mockReturnValue([
                { name: 'Member 1', nickname_github: 'member1', email: 'member1@test.com' }
            ]);
            mockSelectOptimalReviewer.mockResolvedValue({
                selectedReviewer: { name: 'Member 1', nickname_github: 'member1', email: 'member1@test.com' },
                reviewerStats: [{ member: { name: 'Member 1', nickname_github: 'member1', email: 'member1@test.com' }, reviewCount: 5, normalizedCount: 5 }]
            });
            mockGetMembers.mockResolvedValue([
                { name: 'Member 1', nickname_github: 'member1', email: 'member1@test.com' }
            ]);
    
            const result = await handlerFn({ 
                repo: 'owner/test-repo', 
                pr_number: 1,
                days: 7,
                thread_key: 'test-key'
            });
    
            expect(result).toBeDefined();
            expect(result.content[0].type).toBe('text');
            expect(JSON.parse(result.content[0].text)).toHaveProperty('status', 'success');
    
            expect(mockLoadConfiguration).toHaveBeenCalled();
            expect(mockIsTeamRepository).toHaveBeenCalled();
            expect(mockGetPullRequestInfo).toHaveBeenCalledWith('owner/test-repo', 1);
            expect(mockGetAvailableTeamMembers).toHaveBeenCalled();
            expect(mockSelectOptimalReviewer).toHaveBeenCalled();
            expect(mockAssignReviewer).toHaveBeenCalledWith('owner/test-repo', 1, 'member1');
            expect(mockSendChatNotification).toHaveBeenCalled();
        });
        
        test('should handle repository not configured', async () => {
    
            toolModule.registerAssignReviewerTool(mockServer);
            const handlerFn = (mockServer.tool as jest.Mock).mock.calls[0][3] as ToolHandler;
            
    
            mockLoadConfiguration.mockReturnValue({ teams: [] });
            mockIsTeamRepository.mockReturnValue(false);
            
    
            const result = await handlerFn({ repo: 'owner/unknown-repo', pr_number: 1 });
            
    
            expect(result).toBeDefined();
            expect(result.content[0].type).toBe('text');
            expect(result.content[0].text).toContain('Error: El repositorio owner/unknown-repo no pertenece');
        });
        
        test('should handle no available members', async () => {
    
            toolModule.registerAssignReviewerTool(mockServer);
            const handlerFn = (mockServer.tool as jest.Mock).mock.calls[0][3] as ToolHandler;
            const testConfig = {
                teams: [{
                    team_name: 'Test Team',
                    repositories: ['owner/test-repo'],
                    webhook_url: 'https://webhook.test',
                    members: [{ name: 'Member 1', nickname_github: 'author1', email: 'member1@test.com' }]
                }]
            };

            mockLoadConfiguration.mockReturnValue(testConfig);
            mockIsTeamRepository.mockReturnValue(true);
            mockGetPullRequestInfo.mockResolvedValue({
                title: 'Test PR',
                url: 'https://github.com/owner/test-repo/pull/1',
                author: { login: 'author1' }
            });
            mockGetAvailableTeamMembers.mockReturnValue([]);
            mockGetMembers.mockResolvedValue([
                { name: 'Member 1', nickname_github: 'author1', email: 'member1@test.com' }
            ]);
    
            const result = await handlerFn({ repo: 'owner/test-repo', pr_number: 1 });
    
            expect(result).toBeDefined();
            expect(result.content[0].type).toBe('text');
            expect(result.content[0].text).toContain('Error: No hay miembros disponibles');
        });
        
        test('should exclude members by nickname when configured', async () => {
            toolModule.registerAssignReviewerTool(mockServer);
            const handlerFn = (mockServer.tool as jest.Mock).mock.calls[0][3] as ToolHandler;
            const testConfig = {
                teams: [{
                    team_name: 'Test Team',
                    repositories: ['owner/test-repo'],
                    webhook_url: 'https://webhook.test',
                    members: [
                        { name: 'Member 1', nickname_github: 'member1', email: 'member1@test.com' },
                        { name: 'Member 2', nickname_github: 'member2', email: 'member2@test.com' },
                        { name: 'Member 3', nickname_github: 'member3', email: 'member3@test.com' }
                    ],
                    exclude_members_by_nickname: ['member3']
                }]
            };

            mockLoadConfiguration.mockReturnValue(testConfig);
            mockIsTeamRepository.mockReturnValue(true);
            mockGetPullRequestInfo.mockResolvedValue({
                title: 'Test PR',
                url: 'https://github.com/owner/test-repo/pull/1',
                author: { login: 'member1' }
            });
            
            // Only member2 should be available as member1 is the author and member3 is excluded by config
            const availableMember = { name: 'Member 2', nickname_github: 'member2', email: 'member2@test.com' };
            mockGetAvailableTeamMembers.mockReturnValue([availableMember]);
            mockGetMembers.mockResolvedValue(testConfig.teams);
            mockSelectOptimalReviewer.mockResolvedValue({
                selectedReviewer: availableMember,
                reviewerStats: [{ member: availableMember, reviewCount: 5, normalizedCount: 5 }]
            });
    
            const result = await handlerFn({ repo: 'owner/test-repo', pr_number: 1 });
    
            expect(result).toBeDefined();
            expect(result.content[0].type).toBe('text');
            
            const responseContent = JSON.parse(result.content[0].text);
            expect(responseContent.status).toBe('success');
            expect(responseContent.reviewer.github).toBe('member2');
            
            // Verify that getAvailableTeamMembers was called with the correct parameters
            expect(mockGetAvailableTeamMembers).toHaveBeenCalledWith(
                expect.objectContaining({
                    exclude_members_by_nickname: ['member3']
                }),
                expect.arrayContaining(['member1'])
            );
        });
        
        test('should temporarily exclude member passed via exclude_nickname', async () => {
            toolModule.registerAssignReviewerTool(mockServer);
            const handlerFn = (mockServer.tool as jest.Mock).mock.calls[0][3] as ToolHandler;
            const testConfig = {
                teams: [{
                    team_name: 'Test Team',
                    repositories: ['owner/test-repo'],
                    webhook_url: 'https://webhook.test',
                    members: [
                        { name: 'Member 1', nickname_github: 'member1', email: 'member1@test.com' },
                        { name: 'Member 2', nickname_github: 'member2', email: 'member2@test.com' },
                        { name: 'Member 3', nickname_github: 'member3', email: 'member3@test.com' }
                    ]
                }]
            };

            mockLoadConfiguration.mockReturnValue(testConfig);
            mockIsTeamRepository.mockReturnValue(true);
            mockGetPullRequestInfo.mockResolvedValue({
                title: 'Test PR',
                url: 'https://github.com/owner/test-repo/pull/1',
                author: { login: 'member1' }
            });

            // exclude_nickname = 'member2' -> disponibles debería ser solo 'member3'
            const availableMember = { name: 'Member 3', nickname_github: 'member3', email: 'member3@test.com' };
            mockGetAvailableTeamMembers.mockReturnValue([availableMember]);
            mockGetMembers.mockResolvedValue(testConfig.teams);
            mockSelectOptimalReviewer.mockResolvedValue({
                selectedReviewer: availableMember,
                reviewerStats: [{ member: availableMember, reviewCount: 3, normalizedCount: 3 }]
            });

            const result = await handlerFn({ repo: 'owner/test-repo', pr_number: 1, exclude_nickname: 'member2' });

            expect(result).toBeDefined();
            expect(result.content[0].type).toBe('text');
            const responseContent = JSON.parse(result.content[0].text);
            expect(responseContent.status).toBe('success');
            expect(responseContent.reviewer.github).toBe('member3');

            // Verifica que getAvailableTeamMembers reciba exclusiones dinámicas [author, exclude_nickname]
            expect(mockGetAvailableTeamMembers).toHaveBeenCalledWith(
                expect.any(Object),
                expect.arrayContaining(['member1', 'member2'])
            );

            expect(mockAssignReviewer).toHaveBeenCalledWith('owner/test-repo', 1, 'member3');
        });
        
        test('should handle errors during execution', async () => {
    
            toolModule.registerAssignReviewerTool(mockServer);
            const handlerFn = (mockServer.tool as jest.Mock).mock.calls[0][3] as ToolHandler;
            
    
            mockLoadConfiguration.mockImplementation(() => {
                throw new Error('Error de prueba');
            });
            
    
            const result = await handlerFn({ repo: 'owner/test-repo', pr_number: 1 });
            
    
            expect(result).toBeDefined();
            expect(result.content[0].type).toBe('text');
            expect(result.content[0].text).toContain('Error al asignar revisor: Error: Error de prueba');
            expect(mockErrorLogger).toHaveBeenCalled();
        });
    });
});
