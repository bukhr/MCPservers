import { jest } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

type ToolHandler = (params: any) => Promise<{ content: Array<{ type: string; text: string }> }>;

const mockLoadConfiguration = jest.fn().mockReturnValue({ teams: [] });
jest.unstable_mockModule('../../config/settings.js', () => ({
  loadConfiguration: mockLoadConfiguration
}));

const mockGetTeamMembers = jest.fn<() => Promise<any[]>>().mockResolvedValue([]);
const mockIsTeamRepository = jest.fn().mockReturnValue(true);
jest.unstable_mockModule('../../services/team.js', () => ({
  getMembers: mockGetTeamMembers,
  isTeamRepository: mockIsTeamRepository
}));

const mockPostChatMessage = jest.fn();
jest.unstable_mockModule('../../services/notification.js', () => ({
  postChatMessage: mockPostChatMessage
}));

const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerError = jest.fn();
jest.unstable_mockModule('../../utils/logger.js', () => ({
  createLogger: () => ({
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError
  })
}));

let toolModule: typeof import('../../tools/open-review-thread.js');
let mockServer: McpServer;

beforeAll(async () => {
  toolModule = await import('../../tools/open-review-thread.js');
});

beforeEach(() => {
  jest.clearAllMocks();
  mockServer = { tool: jest.fn() } as unknown as McpServer;
});

describe('open-review-thread tool', () => {
  test('registers tool', () => {
    toolModule.registerOpenReviewThreadTool(mockServer);
    expect(mockServer.tool).toHaveBeenCalledTimes(1);
    expect(mockServer.tool).toHaveBeenCalledWith(
      'open_review_thread',
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  test('publishes with team', async () => {
    toolModule.registerOpenReviewThreadTool(mockServer);
    const handlerFn = (mockServer.tool as jest.Mock).mock.calls[0][3] as ToolHandler;

    mockGetTeamMembers.mockResolvedValue([
      { team_name: 'DevOps', webhook_url: 'https://webhook', members: [], repositories: [] }
    ]);

    const res = await handlerFn({ team: 'DevOps', thread_key: 'k', text: 'hola' });

    expect(mockPostChatMessage).toHaveBeenCalledWith('https://webhook', 'k', 'hola');
    expect(JSON.parse(res.content[0].text)).toEqual(expect.objectContaining({ status: 'success', team: 'DevOps' }));
  });

  test('publishes with repo fallback', async () => {
    toolModule.registerOpenReviewThreadTool(mockServer);
    const handlerFn = (mockServer.tool as jest.Mock).mock.calls[0][3] as ToolHandler;

    mockIsTeamRepository.mockReturnValue(true);
    mockGetTeamMembers.mockResolvedValue([
      { team_name: 'DevOps', webhook_url: 'https://webhook', members: [], repositories: ['owner/repo'] }
    ]);

    const res = await handlerFn({ repo: 'owner/repo', thread_key: 'k', text: 'hola' });

    expect(mockPostChatMessage).toHaveBeenCalledWith('https://webhook', 'k', 'hola');
    expect(JSON.parse(res.content[0].text)).toEqual(expect.objectContaining({ status: 'success', repo: 'owner/repo' }));
  });

  test('errors when neither team nor repo provided', async () => {
    toolModule.registerOpenReviewThreadTool(mockServer);
    const handlerFn = (mockServer.tool as jest.Mock).mock.calls[0][3] as ToolHandler;

    const res = await handlerFn({ thread_key: 'k', text: 'hola' });

    expect(mockPostChatMessage).not.toHaveBeenCalled();
    expect(res.content[0].text).toContain('Error: Debe proporcionar');
  });

  test('errors when webhook not found', async () => {
    toolModule.registerOpenReviewThreadTool(mockServer);
    const handlerFn = (mockServer.tool as jest.Mock).mock.calls[0][3] as ToolHandler;

    mockGetTeamMembers.mockResolvedValue([{ team_name: 'DevOps', members: [], repositories: [] }]);

    const res = await handlerFn({ team: 'DevOps', thread_key: 'k', text: 'hola' });

    expect(mockPostChatMessage).not.toHaveBeenCalled();
    expect(res.content[0].text).toContain('Error: No se encontró webhook_url');
  });
});
