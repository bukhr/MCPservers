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

    describe('loadGrafanaConfig', () => {
        test('should load Grafana configuration successfully', () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ grafana: {
                baseUrl: 'https://grafana.example.com',
                apiKey: 'api_key_123',
                orgId: 1
            }}));
            const config = settings.loadGrafanaConfig();
            expect(config).toBeDefined();
            expect(config).toEqual({
                baseUrl: 'https://grafana.example.com',
                apiKey: 'api_key_123',
                orgId: 1
            });
        });

        test('should use environment variables over config file', () => {
            process.env.GRAFANA_BASE_URL = 'https://grafana.env.com';
            process.env.GRAFANA_API_KEY = 'env_key';
            process.env.GRAFANA_ORG_ID = '2';

            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ grafana: {
                baseUrl: 'https://grafana.example.com',
                apiKey: 'api_key_123',
                orgId: 1
            }}));

            const config = settings.loadGrafanaConfig();
            expect(config).toEqual({
                baseUrl: 'https://grafana.env.com',
                apiKey: 'env_key',
                orgId: 2
            });

            // Limpiar variables de entorno
            delete process.env.GRAFANA_BASE_URL;
            delete process.env.GRAFANA_API_KEY;
            delete process.env.GRAFANA_ORG_ID;
        });

        test('should resolve environment references', () => {
            process.env.GRAFANA_SECRET = 'secret_key_value';

            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ grafana: {
                baseUrl: 'https://grafana.example.com',
                apiKey: 'env:GRAFANA_SECRET',
                orgId: 1
            }}));

            const config = settings.loadGrafanaConfig();
            expect(config).toEqual({
                baseUrl: 'https://grafana.example.com',
                apiKey: 'secret_key_value',
                orgId: 1
            });

            delete process.env.GRAFANA_SECRET;
        });

        test('should remove trailing slash from baseUrl', () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ grafana: {
                baseUrl: 'https://grafana.example.com/',
                apiKey: 'api_key'
            }}));

            const config = settings.loadGrafanaConfig();
            expect(config.baseUrl).toEqual('https://grafana.example.com');
        });

        test('should throw error when baseUrl is missing', () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ grafana: {
                apiKey: 'api_key'
            }}));

            expect(() => settings.loadGrafanaConfig()).toThrow('Missing GRAFANA_BASE_URL');
        });

        test('should throw error when apiKey is missing', () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ grafana: {
                baseUrl: 'https://grafana.example.com'
            }}));

            expect(() => settings.loadGrafanaConfig()).toThrow('Missing GRAFANA_API_KEY');
        });
        
        test('should handle null config with environment variables', () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(false);
            process.env.GRAFANA_BASE_URL = 'https://grafana.env.com';
            process.env.GRAFANA_API_KEY = 'env_key';
            process.env.GRAFANA_ORG_ID = '2';

            const config = settings.loadGrafanaConfig();
            expect(config).toEqual({
                baseUrl: 'https://grafana.env.com',
                apiKey: 'env_key',
                orgId: 2
            });
            
            delete process.env.GRAFANA_BASE_URL;
            delete process.env.GRAFANA_API_KEY;
            delete process.env.GRAFANA_ORG_ID;
        });

        test('should handle config without orgId', () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ grafana: {
                baseUrl: 'https://grafana.example.com',
                apiKey: 'api_key_123'
            }}));

            const config = settings.loadGrafanaConfig();
            expect(config).toEqual({
                baseUrl: 'https://grafana.example.com',
                apiKey: 'api_key_123',
                orgId: 1
            });
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
            jest.spyOn(fs, 'existsSync').mockReturnValue(false);
            const logConfig = settings.loadLogConfig();
            expect(logConfig).toEqual({
                enableFileLogs: true,
                logLevel: 'info'
            });
        });

        test('should return merged config with defaults when file exists with grafana logs', () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
                grafana: {
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

        test('should return merged config with defaults when file exists with global logs', () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
                logs: {
                    enableFileLogs: false,
                    logLevel: 'debug'
                }
            }));
            const logConfig = settings.loadLogConfig();
            expect(logConfig).toEqual({
                enableFileLogs: false,
                logLevel: 'debug'
            });
        });

        test('should include logDir when provided in config', () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
                grafana: {
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

        test('should fallback to global logs when grafana.logs is undefined', () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
                logs: {
                    logLevel: 'debug'
                }
            }));
            const logConfig = settings.loadLogConfig();
            expect(logConfig).toEqual({
                enableFileLogs: true,
                logLevel: 'debug'
            });
        });

        test('should return default config when there is a parse error', () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue('{ datos inválidos }');
            const logConfig = settings.loadLogConfig();
            expect(logConfig).toEqual({
                enableFileLogs: true,
                logLevel: 'info'
            });
        });
    });
});