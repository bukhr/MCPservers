import { JenkinsClientInterface } from '../interfaces/jenkins-client.interface.js';
import type { BuildInfo, CheckJobResponse } from '../types/check-jobs.types.js';

/**
 * Crea una respuesta estándar para la verificación de trabajos
 * @param job Nombre o URL del trabajo
 * @param buildInfo Información del build
 * @param logText Texto completo del log
 * @returns Objeto de respuesta formateado
 */
const createJobCheckResponse = (
  job: string,
  buildInfo: BuildInfo,
  logText: string
): CheckJobResponse => ({
  status: 'success',
  job,
  build: buildInfo,
  log_full: logText
});

/**
 * Extrae el número de build de una URL
 * @param url URL del build
 * @returns Número de build o undefined si no se puede extraer
 */
const extractBuildNumberFromUrl = (url: string): number => {
  const buildNumberMatch = url.replace(/\/$/, '').match(/\/(\d+)(?:$|\/?)/);
  if (!buildNumberMatch) {
    throw new Error(`No se pudo extraer el número de build de la URL ${url}`);
  }
  return Number(buildNumberMatch[1]);
};

/**
 * Procesa la solicitud de verificación de un trabajo por URL
 * @param client Cliente para interactuar con Jenkins
 * @param pipelineUrl URL del pipeline
 * @returns Resultado de la verificación
 */
export const processCheckJobsByUrl = async (
  client: JenkinsClientInterface, 
  pipelineUrl: string
): Promise<CheckJobResponse> => {
  const logText = await client.getConsoleTextByUrl(pipelineUrl);
  const buildNumber = extractBuildNumberFromUrl(pipelineUrl);

  const buildInfo: BuildInfo = {
    number: buildNumber,
    url: pipelineUrl
  };

  return createJobCheckResponse(pipelineUrl, buildInfo, logText);
};

/**
 * Procesa la solicitud de verificación de un trabajo por nombre
 * @param client Cliente para interactuar con Jenkins
 * @param jobFullName Nombre completo del job
 * @returns Resultado de la verificación
 */
export const processCheckJobsByJob = async (
  client: JenkinsClientInterface, 
  jobFullName: string
): Promise<CheckJobResponse> => {
  const builds = await client.getBuilds(jobFullName);
  if (!builds.length) {
    throw new Error(`No builds found for job ${jobFullName}`);
  }

  const lastFailed = client.findLastFailed(builds);
  if (!lastFailed) {
    throw new Error(`No recent failed build found for ${jobFullName}`);
  }

  const buildNumber = lastFailed.number;
  const logText = await client.getConsoleText(jobFullName, buildNumber);

  const buildInfo: BuildInfo = {
    number: buildNumber,
    url: lastFailed.url || '',
    result: lastFailed.result,
    timestamp: lastFailed.timestamp,
    duration: lastFailed.duration
  };

  return createJobCheckResponse(jobFullName, buildInfo, logText);
};
