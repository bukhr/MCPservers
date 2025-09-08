import { jest } from '@jest/globals';

// Mock para logger
const mockErrorLogger = jest.fn();
jest.unstable_mockModule('../../utils/logger.js', () => ({
  createLogger: () => ({
    error: mockErrorLogger,
    info: jest.fn(),
    warn: jest.fn(),
  })
}));

let mcpResponses: typeof import('../../utils/mcp-responses.js');

beforeAll(async () => {
  mcpResponses = await import('../../utils/mcp-responses.js');
});

describe('mcp-responses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createSuccessResponse', () => {
    test('should create a success response with payload', () => {
      const payload = { data: 'test', status: 'ok' };
      
      const result = mcpResponses.createSuccessResponse(payload);
      
      expect(result).toEqual({
        content: [{
          type: 'text',
          text: JSON.stringify(payload, null, 2)
        }]
      });
    });
  });

  describe('createErrorResponse', () => {
    test('should create an error response with message and details', () => {
      const message = 'Test error';
      const details = { code: 500, reason: 'Server error' };
      
      const result = mcpResponses.createErrorResponse(message, details);
      
      expect(result).toEqual({
        content: [{
          type: 'text',
          text: `Error while checking jobs: ${message}`
        }]
      });
      
      expect(mockErrorLogger).toHaveBeenCalledWith(message, details);
    });

    test('should create an error response with just message', () => {
      const message = 'Simple error';
      
      const result = mcpResponses.createErrorResponse(message);
      
      expect(result).toEqual({
        content: [{
          type: 'text',
          text: `Error while checking jobs: ${message}`
        }]
      });
      
      expect(mockErrorLogger).toHaveBeenCalledWith(message);
    });
  });

  describe('extractErrorMessage', () => {
    test('should extract message from Error object', () => {
      const error = new Error('Test error message');
      
      const result = mcpResponses.extractErrorMessage(error);
      
      expect(result).toBe('Test error message');
    });

    test('should convert non-Error to string', () => {
      const result = mcpResponses.extractErrorMessage('Plain string error');
      expect(result).toBe('Plain string error');
      
      const result2 = mcpResponses.extractErrorMessage(404);
      expect(result2).toBe('404');
      
      const result3 = mcpResponses.extractErrorMessage({ message: 'Object error' });
      expect(result3).toBe('[object Object]');
    });
  });
});
