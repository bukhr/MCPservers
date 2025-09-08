import { JenkinsBuild } from '../types/index.js';

/**
 * Interfaz que define las operaciones disponibles para interactuar con Jenkins
 */
export interface JenkinsClientInterface {
  /**
   * Construye la ruta de un trabajo en Jenkins
   */
  buildJobPath(jobFullName: string): string;
  
  /**
   * Obtiene los builds de un trabajo
   */
  getBuilds(jobFullName: string): Promise<JenkinsBuild[]>;
  
  /**
   * Obtiene el texto de la consola de un build específico
   */
  getConsoleText(jobFullName: string, buildNumber: number): Promise<string>;
  
  /**
   * Obtiene el texto de la consola a partir de la URL del build
   */
  getConsoleTextByUrl(absoluteBuildUrl: string): Promise<string>;
  
  /**
   * Encuentra el último build fallido
   */
  findLastFailed(builds: JenkinsBuild[]): JenkinsBuild | null;
}
