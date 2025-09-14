import { jest } from '@jest/globals';
import fs from 'fs';

let settings: typeof import('../../config/settings.js');

beforeAll(async () => {
    settings = await import('../../config/settings.js');
    console.error = jest.fn();
    process.env = {};
});

describe('settings', () => {
    // No podemos probar directamente las funciones privadas, mejor probarlas a través de las públicas

    describe('loadJenkinsConfig', () => {
        test('should load Jenkins configuration successfully', () => {
            jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ jenkins: {
                baseUrl: 'https://jenkins.example.com',
                auth: {
                    username: 'jenkins_user',
                    apiToken: 'api_token_123'
                }
            }}));
            const config = settings.loadJenkinsConfig();
            expect(config).toBeDefined();
            expect(config).toEqual({
                baseUrl: 'https://jenkins.example.com',
                username: 'jenkins_user',
                apiToken: 'api_token_123'
            });
        });

        test('should use environment variables over config file', () => {
            process.env.JENKINS_BASE_URL = 'https://jenkins.env.com';
            process.env.JENKINS_USERNAME = 'env_user';
            process.env.JENKINS_API_TOKEN = 'env_token';

            jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ jenkins: {
                baseUrl: 'https://jenkins.example.com',
                auth: {
                    username: 'jenkins_user',
                    apiToken: 'api_token_123'
                }
            }}));

            const config = settings.loadJenkinsConfig();
            expect(config).toEqual({
                baseUrl: 'https://jenkins.env.com',
                username: 'env_user',
                apiToken: 'env_token'
            });

            // Limpiar variables de entorno
            delete process.env.JENKINS_BASE_URL;
            delete process.env.JENKINS_USERNAME;
            delete process.env.JENKINS_API_TOKEN;
        });

        test('should resolve environment references', () => {
            process.env.JENKINS_SECRET = 'secret_token_value';

            jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ jenkins: {
                baseUrl: 'https://jenkins.example.com',
                auth: {
                    username: 'jenkins_user',
                    apiToken: 'env:JENKINS_SECRET'
                }
            }}));

            const config = settings.loadJenkinsConfig();
            expect(config).toEqual({
                baseUrl: 'https://jenkins.example.com',
                username: 'jenkins_user',
                apiToken: 'secret_token_value'
            });

            delete process.env.JENKINS_SECRET;
        });

        test('should remove trailing slash from baseUrl', () => {
            jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ jenkins: {
                baseUrl: 'https://jenkins.example.com/',
                auth: {
                    username: 'jenkins_user',
                    apiToken: 'api_token'
                }
            }}));

            const config = settings.loadJenkinsConfig();
            expect(config.baseUrl).toEqual('https://jenkins.example.com');
        });

        test('should throw error when baseUrl is missing', () => {
            jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ jenkins: {
                auth: {
                    username: 'jenkins_user',
                    apiToken: 'api_token'
                }
            }}));

            expect(() => settings.loadJenkinsConfig()).toThrow('Missing JENKINS_BASE_URL');
        });

        test('should throw error when username is missing', () => {
            jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ jenkins: {
                baseUrl: 'https://jenkins.example.com',
                auth: {
                    apiToken: 'api_token'
                }
            }}));

            expect(() => settings.loadJenkinsConfig()).toThrow('Missing JENKINS_USERNAME');
        });

        test('should throw error when apiToken is missing', () => {
            jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ jenkins: {
                baseUrl: 'https://jenkins.example.com',
                auth: {
                    username: 'jenkins_user'
                }
            }}));

            expect(() => settings.loadJenkinsConfig()).toThrow('Missing JENKINS_API_TOKEN');
        });
        
        test('should handle null config', () => {
            jest.spyOn(fs, 'existsSync').mockImplementation(() => false);
            process.env.JENKINS_BASE_URL = 'https://jenkins.env.com';
            process.env.JENKINS_USERNAME = 'env_user';
            process.env.JENKINS_API_TOKEN = 'env_token';

            const config = settings.loadJenkinsConfig();
            expect(config).toEqual({
                baseUrl: 'https://jenkins.env.com',
                username: 'env_user',
                apiToken: 'env_token'
            });
            
            delete process.env.JENKINS_BASE_URL;
            delete process.env.JENKINS_USERNAME;
            delete process.env.JENKINS_API_TOKEN;
        });
    });

    describe('getLogDir', () => {
        test('should return default log directory', () => {
            const logDir = settings.getLogDir();
            expect(logDir).toBeDefined();
            expect(typeof logDir).toBe('string');
            expect(logDir).toContain('logs');
        });
    });

    describe('loadLogConfig', () => {
        test('should return default config when file does not exist', () => {
            jest.spyOn(fs, 'existsSync').mockImplementation(() => false);
            const logConfig = settings.loadLogConfig();
            expect(logConfig).toEqual({
                enableFileLogs: true,
                logLevel: 'info'
            });
        });

        test('should return merged config with defaults when file exists with jenkins logs', () => {
            jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
                jenkins: {
                    logs: {
                        enableFileLogs: false,
                        logLevel: 'debug'
                    }
                }
            }));
            const logConfig = settings.loadLogConfig();
            expect(logConfig).toEqual({
                enableFileLogs: false,
                logLevel: 'debug'
            });
        });

        test('should return merged config with defaults when file exists with jenkins logs (global rename)', () => {
            // Usar mockImplementation en lugar de mockReturnValue para manejar múltiples llamadas
            jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
                jenkins: {
                    logs: {
                        enableFileLogs: false,
                        logLevel: 'debug'
                    }
                }
            }));
            const logConfig = settings.loadLogConfig();
            expect(logConfig).toEqual({
                enableFileLogs: false,
                logLevel: 'debug'
            });
        });

        test('should include logDir when provided in config', () => {
            jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
                jenkins: {
                    logs: {
                        logDir: '/custom/log/path'
                    }
                }
            }));
            const logConfig = settings.loadLogConfig();
            expect(logConfig).toEqual({
                enableFileLogs: true,
                logLevel: 'info',
                logDir: '/custom/log/path'
            });
        });

        test('should use logs when they exist', () => {
            jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
                jenkins: {
                    logs: {
                        logLevel: 'debug'
                    }
                }
            }));
            const logConfig = settings.loadLogConfig();
            expect(logConfig).toEqual({
                enableFileLogs: true,
                logLevel: 'debug'
            });
        });

        test('should return default config when there is a parse error', () => {
            jest.spyOn(fs, 'existsSync').mockImplementation(() => true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue('{ datos inválidos }');
            const logConfig = settings.loadLogConfig();
            expect(logConfig).toEqual({
                enableFileLogs: true,
                logLevel: 'info'
            });
        });
    });
});