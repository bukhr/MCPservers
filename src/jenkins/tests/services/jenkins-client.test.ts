// @ts-nocheck
import { jest } from '@jest/globals';
import { JenkinsConfig, JenkinsBuild } from '../../types/index.js';
import axios from 'axios';
import { JenkinsClientInterface } from '../../interfaces/jenkins-client.interface.js';

const mockConfig: JenkinsConfig = {
  baseUrl: 'https://jenkins.example.com',
  username: 'testuser',
  apiToken: 'testtoken'
};
const mockGet = jest.fn();
const mockAxiosInstance = { get: mockGet };
const mockCreate = jest.fn().mockReturnValue(mockAxiosInstance);
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;
mockedAxios.create = mockCreate;

const mockErrorLogger = jest.fn();
const mockInfoLogger = jest.fn();
jest.unstable_mockModule('../../utils/logger.js', () => ({
  createLogger: () => ({
    error: mockErrorLogger,
    info: mockInfoLogger,
    warn: jest.fn(),
  })
}));

let jenkinsClientModule: any;
let jenkinsClient: JenkinsClientInterface;
beforeAll(async () => {
    jenkinsClientModule = await import('../../services/jenkins-client.js');
});

describe('JenkinsClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    jenkinsClient = new jenkinsClientModule.JenkinsClient(mockConfig);
  });
  
  describe('constructor', () => {
    test('should create axios instance with correct config', () => {
      expect(mockCreate).toHaveBeenCalledWith({
        baseURL: mockConfig.baseUrl,
        auth: { username: mockConfig.username, password: mockConfig.apiToken }
      });
    });
  });

  describe('buildJobPath', () => {
    test('should format simple job name correctly', () => {
      const result = jenkinsClient.buildJobPath('simple-job');
      expect(result).toBe('job/simple-job');
    });

    test('should format nested job path correctly', () => {
      const result = jenkinsClient.buildJobPath('Folder/Subfolder/job-name');
      expect(result).toBe('job/Folder/job/Subfolder/job/job-name');
    });

    test('should handle empty job name', () => {
      const result = jenkinsClient.buildJobPath('');
      expect(result).toBe('');
    });

    test('should handle job name with special characters', () => {
      const result = jenkinsClient.buildJobPath('job with spaces/sub-folder');
      expect(result).toBe('job/job%20with%20spaces/job/sub-folder');
    });
  });

  describe('getBuilds', () => {
    const mockBuilds = [
      { number: 1, result: 'SUCCESS', timestamp: 1630000000000, duration: 1000, url: 'https://jenkins.example.com/job/test-job/1/' },
      { number: 2, result: 'FAILURE', timestamp: 1630001000000, duration: 2000, url: 'https://jenkins.example.com/job/test-job/2/' }
    ];

    test('should fetch builds for a job', async () => {
      mockGet.mockResolvedValueOnce({ data: { builds: mockBuilds } });
      
      const result = await jenkinsClient.getBuilds('test-job');
      
      expect(mockGet).toHaveBeenCalledWith(
        '/job/test-job/api/json', 
        { params: { tree: 'builds[number,result,building,timestamp,duration,url]' } }
      );
      
      expect(result).toEqual(mockBuilds);
    });

    test('should handle empty builds response', async () => {
      mockGet.mockResolvedValueOnce({ data: {} });
      
      const result = await jenkinsClient.getBuilds('test-job');
      expect(result).toEqual([]);
    });

    test('should handle API error and return empty array', async () => {
      mockGet.mockRejectedValueOnce(new Error('API error'));
      
      const result = await jenkinsClient.getBuilds('test-job');
      
      expect(mockErrorLogger).toHaveBeenCalled();
      expect(result).toEqual([]);
    });
  });

  describe('getConsoleText', () => {
    test('should fetch console text for a job build', async () => {
      mockGet.mockResolvedValueOnce({ data: 'Console output text' });
      
      const result = await jenkinsClient.getConsoleText('test-job', 1);
      
      expect(mockGet).toHaveBeenCalledWith(
        '/job/test-job/1/consoleText', 
        { responseType: 'text' }
      );
      
      expect(result).toBe('Console output text');
    });
  });

  describe('getConsoleTextByUrl', () => {
    test('should fetch console text using absolute URL', async () => {
      mockGet.mockResolvedValueOnce({ data: 'Console output text' });
      
      const result = await jenkinsClient.getConsoleTextByUrl('https://jenkins.example.com/job/test-job/1/');
      
      expect(mockGet).toHaveBeenCalledWith(
        'https://jenkins.example.com/job/test-job/1/consoleText', 
        { responseType: 'text' }
      );
      
      expect(result).toBe('Console output text');
    });

    test('should handle non-string response data', async () => {
      mockGet.mockResolvedValueOnce({ data: { message: 'Not a string' } });
      
      const result = await jenkinsClient.getConsoleTextByUrl('https://jenkins.example.com/job/test-job/1/');
      expect(result).toBe('[object Object]');
    });

    test('should handle error when fetching console text', async () => {
      mockGet.mockRejectedValueOnce(new Error('Network error'));
      
      const result = await jenkinsClient.getConsoleTextByUrl('https://jenkins.example.com/job/test-job/1/');
      
      expect(mockErrorLogger).toHaveBeenCalled();
      expect(result).toBe('');
    });

    test('should convert Blue Ocean URL to classic URL', async () => {
      const spy = jest.spyOn(jenkinsClient as any, 'convertToClassicBuildUrl')
        .mockReturnValue('https://jenkins.example.com/job/test-job/1');
      
      mockGet.mockResolvedValueOnce({ data: 'Console output text' });
      
      await jenkinsClient.getConsoleTextByUrl('https://jenkins.example.com/blue/organizations/jenkins/test-job/detail/master/1/');
      
      expect(spy).toHaveBeenCalledWith(
        'https://jenkins.example.com/blue/organizations/jenkins/test-job/detail/master/1'
      );
      
      expect(mockGet).toHaveBeenCalledWith(
        'https://jenkins.example.com/job/test-job/1/consoleText', 
        { responseType: 'text' }
      );
    });
  });

  describe('findLastFailed', () => {
    const mockBuilds = [
      { number: 3, result: 'SUCCESS', url: 'https://jenkins.example.com/job/test-job/3/' },
      { number: 2, result: 'FAILURE', url: 'https://jenkins.example.com/job/test-job/2/' },
      { number: 1, result: 'SUCCESS', url: 'https://jenkins.example.com/job/test-job/1/' }
    ];

    test('should find the first failed build', () => {
      const result = jenkinsClient.findLastFailed(mockBuilds);
      expect(result).toEqual(mockBuilds[1]);
    });

    test('should return null when no failed build is found', () => {
      const successfulBuilds = [
        { number: 3, result: 'SUCCESS', url: 'https://jenkins.example.com/job/test-job/3/' },
        { number: 2, result: 'SUCCESS', url: 'https://jenkins.example.com/job/test-job/2/' }
      ];
      
      const result = jenkinsClient.findLastFailed(successfulBuilds);
      expect(result).toBeNull();
    });

    test('should handle empty builds array', () => {
      const result = jenkinsClient.findLastFailed([]);
      expect(result).toBeNull();
    });
  });

  describe('convertToClassicBuildUrl', () => {
    test('should convert Blue Ocean job URL to classic URL', () => {
      const blueUrl = 'https://jenkins.example.com/blue/organizations/jenkins/test-job/detail/master/1/';
      const result = (jenkinsClient as any).convertToClassicBuildUrl(blueUrl);
      
      expect(result).toBe('https://jenkins.example.com/job/test-job/job/master/1');
    });

    test('should convert Blue Ocean PR URL to classic URL', () => {
      const blueUrl = 'https://jenkins.example.com/blue/organizations/jenkins/test-job/detail/PR-123/1/';
      const result = (jenkinsClient as any).convertToClassicBuildUrl(blueUrl);
      
      expect(result).toBe('https://jenkins.example.com/job/test-job/view/change-requests/job/PR-123/1');
    });

    test('should return null for invalid URLs', () => {
      const invalidUrl = 'not-a-url';
      const result = (jenkinsClient as any).convertToClassicBuildUrl(invalidUrl);
      
      expect(result).toBeNull();
      expect(mockErrorLogger).toHaveBeenCalled();
    });

    test('should return null for non-Blue Ocean URLs', () => {
      const classicUrl = 'https://jenkins.example.com/job/test-job/1/';
      const result = (jenkinsClient as any).convertToClassicBuildUrl(classicUrl);
      
      expect(result).toBeNull();
    });
  });
});
