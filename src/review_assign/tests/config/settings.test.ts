import { jest } from '@jest/globals';
import fs from 'fs';

let settings: typeof import('../../config/settings.js');

beforeAll(async () => {
    settings = await import('../../config/settings.js');
    console.error = jest.fn();
});

describe('settings', () => {
    describe('loadConfiguration', () => {
        test('should load configuration successfully', () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({ reviewAssign: { teams: [], reviewDays: 15 } }));
            const config = settings.loadConfiguration();
            expect(config).toBeDefined();
            expect(config).toEqual({ teams: [], reviewDays: 15 });
        });

        test('should throw error when config file does not exist', () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(false);
            expect(() => settings.loadConfiguration()).toThrow('Archivo de configuración no encontrado');
        });

        test('should throw error when config file has invalid JSON', () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue('{ datos inválidos }');
            expect(() => settings.loadConfiguration()).toThrow("Expected property name or '}' in JSON at position 2 (line 1 column 3)");
        });
    });

    describe('getLogDir', () => {
        test('should return default log directory', () => {
            const logDir = settings.getLogDir();
            expect(logDir).toBeDefined();
            expect(typeof logDir).toBe('string');
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

        test('should return merged config with defaults when file exists', () => {
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
                reviewAssign: {
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
            jest.spyOn(fs, 'existsSync').mockReturnValue(true);
            jest.spyOn(fs, 'readFileSync').mockReturnValue(JSON.stringify({
                reviewAssign: {
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