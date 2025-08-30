import { jest } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const mockLoadConfiguration = jest.fn();
jest.unstable_mockModule('../../config/settings.js', () => ({
    loadConfiguration: mockLoadConfiguration,
    settingsLogger: {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
    }
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

type ToolHandler = (params: any) => Promise<{ content: Array<{ type: string; text: string }> }>;

let toolModule: typeof import('../../tools/list-teams.js');
let mockServer: McpServer;

beforeAll(async () => {

    toolModule = await import('../../tools/list-teams.js');
});

beforeEach(() => {

    jest.clearAllMocks();

    mockServer = {
        tool: jest.fn().mockImplementation((name, description, schema, handler) => {}),
    } as unknown as McpServer;
});

describe('list-teams tool', () => {
    describe('registerListTeamsTool', () => {
        test('should register the tool with the server', () => {
        
            toolModule.registerListTeamsTool(mockServer);
        
            expect(mockServer.tool).toHaveBeenCalledTimes(1);
            expect(mockServer.tool).toHaveBeenCalledWith(
                'list_teams',
                'Lista los equipos configurados y sus miembros',
                {},
                expect.any(Function)
            );
        });
        
        test('should return teams list when successful', async () => {
        
            toolModule.registerListTeamsTool(mockServer);
            const handlerFn = (mockServer.tool as jest.Mock).mock.calls[0][3] as ToolHandler;
        
            const testConfig = {
                teams: [
                    {
                        team_name: 'Team 1',
                        members: [
                            { nickname_github: 'member1', name: 'Member 1', email: 'member1@test.com' },
                            { nickname_github: 'member2', name: 'Member 2', email: 'member2@test.com' }
                        ],
                        repositories: ['owner/repo1', 'owner/repo2']
                    },
                    {
                        team_name: 'Team 2',
                        members: [
                            { nickname_github: 'member3', name: 'Member 3', email: 'member3@test.com' }
                        ],
                        repositories: ['owner/repo3']
                    }
                ]
            };
            mockLoadConfiguration.mockReturnValue(testConfig);
        
            const result = await handlerFn({});
            
            expect(result).toBeDefined();
            expect(result.content[0].type).toBe('text');
            
            const parsedContent = JSON.parse(result.content[0].text);
            expect(parsedContent).toHaveProperty('teams');
            expect(parsedContent.teams).toHaveLength(2);
            expect(parsedContent.teams[0].name).toBe('Team 1');
            expect(parsedContent.teams[0].members).toEqual(['member1', 'member2']);
            expect(parsedContent.teams[0].repositories).toEqual(['owner/repo1', 'owner/repo2']);
            expect(parsedContent.teams[1].name).toBe('Team 2');
            expect(parsedContent.teams[1].members).toEqual(['member3']);
            expect(parsedContent.teams[1].repositories).toEqual(['owner/repo3']);
            
            expect(mockLoadConfiguration).toHaveBeenCalled();
        });
        
        test('should exclude members by nickname when configured', async () => {
            toolModule.registerListTeamsTool(mockServer);
            const handlerFn = (mockServer.tool as jest.Mock).mock.calls[0][3] as ToolHandler;
        
            const testConfig = {
                teams: [
                    {
                        team_name: 'Team With Exclusions',
                        members: [
                            { nickname_github: 'member1', name: 'Member 1', email: 'member1@test.com' },
                            { nickname_github: 'member2', name: 'Member 2', email: 'member2@test.com' },
                            { nickname_github: 'member3', name: 'Member 3', email: 'member3@test.com' }
                        ],
                        repositories: ['owner/repo1'],
                        exclude_members_by_nickname: ['member2', 'MEMBER3']
                    }
                ]
            };
            mockLoadConfiguration.mockReturnValue(testConfig);
        
            const result = await handlerFn({});
            
            expect(result).toBeDefined();
            expect(result.content[0].type).toBe('text');
            
            const parsedContent = JSON.parse(result.content[0].text);
            expect(parsedContent).toHaveProperty('teams');
            expect(parsedContent.teams).toHaveLength(1);
            expect(parsedContent.teams[0].name).toBe('Team With Exclusions');
            
            // Should only include member1, as member2 and member3 are excluded
            expect(parsedContent.teams[0].members).toEqual(['member1']);
            expect(parsedContent.teams[0].repositories).toEqual(['owner/repo1']);
            
            expect(mockLoadConfiguration).toHaveBeenCalled();
        });
        
        test('should handle errors', async () => {
        
            toolModule.registerListTeamsTool(mockServer);
            const handlerFn = (mockServer.tool as jest.Mock).mock.calls[0][3] as ToolHandler;
            
            mockLoadConfiguration.mockImplementation(() => {
                throw new Error('Error de prueba');
            });
            
            const result = await handlerFn({});
            
            expect(result).toBeDefined();
            expect(result.content[0].type).toBe('text');
            expect(result.content[0].text).toContain('Error al listar equipos: Error: Error de prueba');
            expect(mockErrorLogger).toHaveBeenCalled();
        });
    });
});
