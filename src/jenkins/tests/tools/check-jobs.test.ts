import { jest } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JenkinsBuild } from '../../types/index.js';
import { JenkinsClientInterface } from '../../interfaces/jenkins-client.interface.js';

type ToolHandler = (params: any) => Promise<{ content: Array<{ type: string; text: string }> }>;

const mockLoadJenkinsConfig = jest.fn().mockReturnValue({
  baseUrl: 'https://jenkins.example.com',
  username: 'testuser',
  apiToken: 'testtoken'
});
jest.unstable_mockModule('../../config/settings.js', () => ({
  loadJenkinsConfig: mockLoadJenkinsConfig,
  settingsLogger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
  }
}));

const mockJenkinsBuilds: JenkinsBuild[] = [
    { number: 2, result: 'SUCCESS', timestamp: 1630000000000, duration: 1000, url: 'https://jenkins.example.com/job/test-job/2/' },
    { number: 1, result: 'FAILURE', timestamp: 1630000000000, duration: 1000, url: 'https://jenkins.example.com/job/test-job/1/' }
];

const mockFailedBuild: JenkinsBuild = { 
    number: 1, 
    result: 'FAILURE', 
    timestamp: 1630000000000, 
    duration: 1000, 
    url: 'https://jenkins.example.com/job/test-job/1/' 
};

const getConsoleTextByUrlMock = jest.fn<(url: string) => Promise<string>>();
getConsoleTextByUrlMock.mockResolvedValue('Console output line 1\nLine 2\nLine 3\nLine 4\nLine 5');

const getConsoleTextMock = jest.fn<(jobFullName: string, buildNumber: number) => Promise<string>>();
getConsoleTextMock.mockResolvedValue('Console output line 1\nLine 2\nLine 3\nLine 4\nLine 5');

const getBuildsMock = jest.fn<(jobFullName: string) => Promise<JenkinsBuild[]>>();
getBuildsMock.mockResolvedValue(mockJenkinsBuilds);

const findLastFailedMock = jest.fn<(builds: JenkinsBuild[]) => JenkinsBuild | null>();
findLastFailedMock.mockReturnValue(mockFailedBuild);

const buildJobPathMock = jest.fn<(jobFullName: string) => string>();
buildJobPathMock.mockReturnValue('job/test-job');

const mockJenkinsClient: JenkinsClientInterface = {
getConsoleTextByUrl: getConsoleTextByUrlMock,
getConsoleText: getConsoleTextMock,
getBuilds: getBuildsMock,
findLastFailed: findLastFailedMock,
buildJobPath: buildJobPathMock
};

jest.unstable_mockModule('../../services/jenkins-client.js', () => ({
  JenkinsClient: jest.fn().mockImplementation(() => mockJenkinsClient)
}));

const mockProcessCheckJobsByUrl = jest.fn().mockImplementation(() => {
  return Promise.resolve({
    status: 'success',
    job: 'test-url',
    build: {
      number: 1,
      url: 'https://jenkins.example.com/job/test-job/1/'
    },
    log_full: 'Console output'
  });
});

const mockProcessCheckJobsByJob = jest.fn().mockImplementation(() => {
  return Promise.resolve({
    status: 'success',
    job: 'test-job',
    build: {
      number: 1,
      url: 'https://jenkins.example.com/job/test-job/1/',
      result: 'FAILURE',
      timestamp: 1630000000000,
      duration: 1000
    },
    log_full: 'Console output'
  });
});

jest.unstable_mockModule('../../services/check-jobs-service.js', () => ({
  processCheckJobsByUrl: mockProcessCheckJobsByUrl,
  processCheckJobsByJob: mockProcessCheckJobsByJob
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

let toolModule: typeof import('../../tools/check-jobs.js');
let mockServer: McpServer;

beforeAll(async () => {
  toolModule = await import('../../tools/check-jobs.js');
});

beforeEach(() => {
  jest.clearAllMocks();
  
  mockServer = {
    tool: jest.fn(),
  } as unknown as McpServer;
});

describe('check-jobs tool', () => {
  describe('registerCheckJobsTool', () => {
    test('should register the tool with the server', () => {
      toolModule.registerCheckJobsTool(mockServer);
      
      expect(mockServer.tool).toHaveBeenCalledTimes(1);
      expect(mockServer.tool).toHaveBeenCalledWith(
        'check_jobs',
        'Get the last failed build for a Jenkins job and return the full log',
        expect.any(Object),
        expect.any(Function)
      );
    });
    
    test('should handle check jobs by URL', async () => {
      toolModule.registerCheckJobsTool(mockServer);
      
      const handlerFn = (mockServer.tool as jest.Mock).mock.calls[0][3] as ToolHandler;
      
      const result = await handlerFn({ 
        pipeline_url: 'https://jenkins.example.com/job/test-job/1/'
      });
      
      expect(result).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(JSON.parse(result.content[0].text)).toHaveProperty('status', 'success');
      
      expect(mockLoadJenkinsConfig).toHaveBeenCalled();
      expect(mockProcessCheckJobsByUrl).toHaveBeenCalledWith(
        expect.anything(),
        'https://jenkins.example.com/job/test-job/1/'
      );
    });
    
    test('should handle check jobs by job name', async () => {
      toolModule.registerCheckJobsTool(mockServer);
      
      const handlerFn = (mockServer.tool as jest.Mock).mock.calls[0][3] as ToolHandler;
      
      const result = await handlerFn({ 
        job_full_name: 'test-job'
      });
      
      expect(result).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(JSON.parse(result.content[0].text)).toHaveProperty('status', 'success');
      
      // Verificar llamadas a los mocks
      expect(mockLoadJenkinsConfig).toHaveBeenCalled();
      expect(mockProcessCheckJobsByJob).toHaveBeenCalledWith(
        expect.anything(),
        'test-job'
      );
    });
    
    test('should return error when neither job_full_name nor pipeline_url is provided', async () => {
      toolModule.registerCheckJobsTool(mockServer);
      
      const handlerFn = (mockServer.tool as jest.Mock).mock.calls[0][3] as ToolHandler;
      
      const result = await handlerFn({});
      
      expect(result).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('Either pipeline_url or job_full_name is required');
    });
    
    test('should handle errors during execution', async () => {
      toolModule.registerCheckJobsTool(mockServer);
      
      const handlerFn = (mockServer.tool as jest.Mock).mock.calls[0][3] as ToolHandler;
      
      mockProcessCheckJobsByJob.mockImplementationOnce(() => Promise.reject(new Error('Test error')));
      
      const result = await handlerFn({ job_full_name: 'test-job' });
      
      expect(result).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Error while checking jobs: Test error');
      expect(mockErrorLogger).toHaveBeenCalled();
    });
  });

  describe('MCP response handling', () => {
    test('should return error when URL job has no log', async () => {
      toolModule.registerCheckJobsTool(mockServer);
      
      const handlerFn = (mockServer.tool as jest.Mock).mock.calls[0][3] as ToolHandler;
      
      mockProcessCheckJobsByUrl.mockImplementationOnce(() => {
        return Promise.resolve({
          status: 'success',
          job: 'test-url',
          build: { number: 1 },
          log_full: null
        });
      });
      
      const result = await handlerFn({ 
        pipeline_url: 'https://jenkins.example.com/job/test-job/1/' 
      });
      
      expect(result).toBeDefined();
      expect(result.content[0].text).toContain('Error while checking jobs: The logs could not be found');
    });
    
    test('should return error when job name build has no log', async () => {
      toolModule.registerCheckJobsTool(mockServer);
      
      const handlerFn = (mockServer.tool as jest.Mock).mock.calls[0][3] as ToolHandler;
      
      mockProcessCheckJobsByJob.mockImplementationOnce(() => {
        return Promise.resolve({
          status: 'success',
          job: 'test-job',
          build: { number: 1 },
          log_full: null
        });
      });
      
      const result = await handlerFn({ job_full_name: 'test-job' });
      
      expect(result).toBeDefined();
      expect(result.content[0].text).toContain('Error while checking jobs: The logs could not be found');
    });
  });
});
