import { JenkinsClient } from '../services/jenkins-client.js';

// Servicio de dominio para la herramienta check_jobs
// Mantiene el tool delgado y testeable.

function tail(text: string, n?: number): string {
  if (n === undefined || n === null) return text;
  if (n <= 0) return '';
  const lines = text.split(/\r?\n/);
  return lines.slice(-n).join('\n');
}

export async function processCheckJobsByUrl(params: { pipelineUrl: string; tailLines?: number }) {
  const { pipelineUrl, tailLines } = params;
  const client = new JenkinsClient();
  const logText = await client.getConsoleTextByUrl(pipelineUrl);
  const excerpt = tail(logText, tailLines);

  // Extraer número de build del final de la URL si existe
  const m = pipelineUrl.replace(/\/$/, '').match(/\/(\d+)(?:$|\/?)/);
  const buildNumber = m ? Number(m[1]) : undefined;

  return {
    status: 'success',
    job: pipelineUrl,
    build: {
      number: buildNumber,
      url: pipelineUrl
    },
    log_tail_lines: tailLines ?? null,
    log_excerpt: excerpt
  };
}

export async function processCheckJobsByJob(params: { jobFullName: string; tailLines?: number }) {
  const { jobFullName, tailLines } = params;
  const client = new JenkinsClient();

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
  const excerpt = tail(logText, tailLines);

  return {
    status: 'success',
    job: jobFullName,
    build: {
      number: buildNumber,
      url: lastFailed.url,
      result: lastFailed.result,
      timestamp: lastFailed.timestamp,
      duration: lastFailed.duration
    },
    log_tail_lines: tailLines,
    log_excerpt: excerpt
  };
}
