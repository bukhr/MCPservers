import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import type { JenkinsBuild, JenkinsConfig } from '../types/index.js';
import { JenkinsClientInterface } from '../interfaces/jenkins-client.interface.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('jenkins_mcp', 'jenkins-client');

const API_ENDPOINTS = {
  CONSOLE_TEXT: 'consoleText',
  API_JSON: 'api/json'
} as const;

const API_PARAMS = {
  BUILD_TREE: 'builds[number,result,building,timestamp,duration,url]'
} as const;

const URL_PATTERNS = {
  BLUE_OCEAN: /^\/blue\/organizations\/jenkins\/([^\/]+)\/detail\/([^\/]+)\/(\d+)(?:\/.*)?$/,
  PR_NUMBER: /^PR-\d+$/i
} as const;

export class JenkinsClient implements JenkinsClientInterface {
  private client: AxiosInstance;

  /**
   * Crea una instancia del cliente Jenkins
   * @param jenkinsConfig Configuración para conectar a Jenkins
   */
  constructor(jenkinsConfig: JenkinsConfig) {
    this.client = axios.create({
      baseURL: jenkinsConfig.baseUrl,
      auth: { username: jenkinsConfig.username, password: jenkinsConfig.apiToken }
    });
  }

  /**
   * Construye la ruta para un trabajo de Jenkins
   * @param jobFullName Nombre completo del trabajo (puede incluir carpetas separadas por /)
   * @returns Ruta formateada para uso en la API de Jenkins
   */
  buildJobPath = (jobFullName: string): string => {
    const parts = jobFullName.split('/').filter(Boolean);
    return parts.map(p => `job/${encodeURIComponent(p)}`).join('/');
  };

  /**
   * Obtiene los builds de un trabajo
   * @param jobFullName Nombre completo del trabajo
   * @returns Lista de builds del trabajo
   */
  getBuilds = async (jobFullName: string): Promise<JenkinsBuild[]> => {
    const path = this.buildJobPath(jobFullName);
    const url = `/${path}/${API_ENDPOINTS.API_JSON}`;
    const params = { tree: API_PARAMS.BUILD_TREE } as const;
    
    try {
      const { data } = await this.client.get(url, { params });
      return data?.builds || [];
    } catch (error) {
      logger.error(`Error al obtener builds para ${jobFullName}:`, error);
      return [];
    }
  };

  /**
   * Método genérico para obtener texto de la consola
   * @param url URL para obtener el texto de la consola
   * @returns Texto de la consola
   * @private
   */
  private fetchConsoleText = async (url: string): Promise<string> => {
    const config: AxiosRequestConfig = { responseType: 'text' };
    
    try {
      const { data } = await this.client.get(url, config);
      return typeof data === 'string' ? data : String(data);
    } catch (error) {
      logger.error(`Error al obtener texto de consola desde ${url}:`, error);
      return '';
    }
  };

  /**
   * Obtiene el texto de la consola de un build específico
   * @param jobFullName Nombre completo del trabajo
   * @param buildNumber Número del build
   * @returns Texto de la consola
   */
  getConsoleText = async (jobFullName: string, buildNumber: number): Promise<string> => {
    const path = this.buildJobPath(jobFullName);
    const url = `/${path}/${buildNumber}/${API_ENDPOINTS.CONSOLE_TEXT}`;
    return this.fetchConsoleText(url);
  };

  /**
   * Obtiene el texto de la consola usando la URL del build
   * @param absoluteBuildUrl URL absoluta del build
   * @returns Texto de la consola
   */
  getConsoleTextByUrl = async (absoluteBuildUrl: string): Promise<string> => {
    const clean = absoluteBuildUrl.replace(/\/$/, '');
    const classicBase = this.convertToClassicBuildUrl(clean) || clean;
    const url = `${classicBase}/${API_ENDPOINTS.CONSOLE_TEXT}`;
    return this.fetchConsoleText(url);
  };

  /**
   * Encuentra el último build fallido en una lista de builds
   * @param builds Lista de builds a analizar
   * @returns El primer build con estado FAILURE o null si no hay ninguno
   */
  findLastFailed = (builds: JenkinsBuild[]): JenkinsBuild | null => {
    return builds.find(build => build && build.result === 'FAILURE') || null;
  };

  /**
   * Convierte una URL de Jenkins Blue Ocean a su equivalente en la interfaz clásica
   * @param blueUrl URL de la interfaz Blue Ocean
   * @returns URL equivalente en la interfaz clásica o null si no se puede convertir
   * @private
   */
  private convertToClassicBuildUrl = (blueUrl: string): string | null => {
    try {
      const u = new URL(blueUrl);
      const path = u.pathname.replace(/\/$/, '');
      const pathMatch = path.match(URL_PATTERNS.BLUE_OCEAN);
      
      if (!pathMatch) return null;
      
      const [, jobNameRaw, branchOrPrRaw, buildNumber] = pathMatch;
      const jobName = decodeURIComponent(jobNameRaw);
      const branchOrPr = decodeURIComponent(branchOrPrRaw);

      const isPr = URL_PATTERNS.PR_NUMBER.test(branchOrPr);
      const encodedJob = encodeURIComponent(jobName);
      const encodedBranch = encodeURIComponent(branchOrPr);

      const base = `${u.origin}/job/${encodedJob}`;
      if (isPr) {
        return `${base}/view/change-requests/job/${encodedBranch}/${buildNumber}`;
      }
      return `${base}/job/${encodedBranch}/${buildNumber}`;
    } catch (error) {
      logger.error('Error al convertir URL de Blue Ocean:', error);
      return null;
    }
  };
}
