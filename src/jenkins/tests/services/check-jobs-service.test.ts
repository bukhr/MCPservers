import { jest } from '@jest/globals';
import { JenkinsClientInterface } from '../../interfaces/jenkins-client.interface.js';
import { processCheckJobsByJob, processCheckJobsByUrl } from '../../services/check-jobs-service.js';
import { JenkinsBuild } from '../../types/index.js';

describe('check-jobs-service', () => {
  let mockClient: JenkinsClientInterface;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Creamos mock builds con el tipo correcto
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
    
    // Creamos los mocks con los tipos correctos
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
    
    mockClient = {
      getConsoleTextByUrl: getConsoleTextByUrlMock,
      getConsoleText: getConsoleTextMock,
      getBuilds: getBuildsMock,
      findLastFailed: findLastFailedMock,
      buildJobPath: buildJobPathMock
    };
  });

  describe('processCheckJobsByUrl', () => {
    test('should process job check by URL', async () => {
      const pipelineUrl = 'https://jenkins.example.com/job/test-job/1/';
      
      const result = await processCheckJobsByUrl(mockClient, pipelineUrl);
      
      expect(mockClient.getConsoleTextByUrl).toHaveBeenCalledWith('https://jenkins.example.com/job/test-job/1/');
      expect(result).toEqual({
        status: 'success',
        job: 'https://jenkins.example.com/job/test-job/1/',
        build: {
          number: 1,
          url: 'https://jenkins.example.com/job/test-job/1/'
        },
        log_full: 'Console output line 1\nLine 2\nLine 3\nLine 4\nLine 5'
      });
    });
    
    test('should throw error when URL does not contain build number', async () => {
      const invalidUrl = 'https://jenkins.example.com/job/test-job/';
      
      await expect(processCheckJobsByUrl(mockClient, invalidUrl))
        .rejects
        .toThrow(`No se pudo extraer el número de build de la URL ${invalidUrl}`);
    });


    test('should extract build number from URL', async () => {
      const pipelineUrl = 'https://jenkins.example.com/job/test-job/123/';
      
      const result = await processCheckJobsByUrl(mockClient, pipelineUrl);
      
      expect(result.build.number).toBe(123);
    });

    test('should handle URL without trailing slash', async () => {
      const pipelineUrl = 'https://jenkins.example.com/job/test-job/123';
      
      const result = await processCheckJobsByUrl(mockClient, pipelineUrl);
      
      expect(mockClient.getConsoleTextByUrl).toHaveBeenCalledWith('https://jenkins.example.com/job/test-job/123');
      expect(result.build.number).toBe(123);
    });
  });

  describe('processCheckJobsByJob', () => {
    test('should process job check by job name', async () => {
      const jobFullName = 'test-job';
      
      const result = await processCheckJobsByJob(mockClient, jobFullName);
      
      expect(mockClient.getBuilds).toHaveBeenCalledWith('test-job');
      expect(mockClient.findLastFailed).toHaveBeenCalled();
      expect(mockClient.getConsoleText).toHaveBeenCalledWith('test-job', 1);
      
      expect(result).toEqual({
        status: 'success',
        job: 'test-job',
        build: {
          number: 1,
          url: 'https://jenkins.example.com/job/test-job/1/',
          result: 'FAILURE',
          timestamp: 1630000000000,
          duration: 1000
        },
        log_full: 'Console output line 1\nLine 2\nLine 3\nLine 4\nLine 5'
      });
    });


    test('should throw error when no builds found', async () => {
      const emptyBuildsMock = jest.fn<(jobFullName: string) => Promise<JenkinsBuild[]>>();
      emptyBuildsMock.mockResolvedValue([]);
      mockClient.getBuilds = emptyBuildsMock;
      
      await expect(processCheckJobsByJob(mockClient, 'test-job'))
        .rejects
        .toThrow('No builds found for job test-job');
    });

    test('should throw error when no failed builds found', async () => {
      const noFailuresMock = jest.fn<(builds: JenkinsBuild[]) => JenkinsBuild | null>();
      noFailuresMock.mockReturnValue(null);
      mockClient.findLastFailed = noFailuresMock;
      
      await expect(processCheckJobsByJob(mockClient, 'test-job'))
        .rejects
        .toThrow('No recent failed build found for test-job');
    });
  });

  describe('log full text', () => {
    test('should return full log text', async () => {
      const pipelineUrl = 'https://jenkins.example.com/job/test-job/1/';
      
      const result = await processCheckJobsByUrl(mockClient, pipelineUrl);
      
      expect(result.log_full).toBe('Console output line 1\nLine 2\nLine 3\nLine 4\nLine 5');
    });
  });
});
