import axios, { AxiosInstance } from 'axios';
import { loadJenkinsConfig } from '../config/settings.js';
import type { JenkinsBuild } from '../types/index.js';

export class JenkinsClient {
  private client: AxiosInstance;

  constructor() {
    const jenkinsConfig = loadJenkinsConfig();
    this.client = axios.create({
      baseURL: jenkinsConfig.baseUrl,
      auth: { username: jenkinsConfig.username, password: jenkinsConfig.apiToken }
    });
  }

  buildJobPath(jobFullName: string): string {
    const parts = jobFullName.split('/').filter(Boolean);
    return parts.map(p => `job/${encodeURIComponent(p)}`).join('/');
  }

  async getBuilds(jobFullName: string): Promise<JenkinsBuild[]> {
    const path = this.buildJobPath(jobFullName);
    const url = `/${path}/api/json`;
    const params = { tree: 'builds[number,result,building,timestamp,duration,url]' } as const;
    const { data } = await this.client.get(url, { params });
    return data?.builds || [];
  }

  async getConsoleText(jobFullName: string, buildNumber: number): Promise<string> {
    const path = this.buildJobPath(jobFullName);
    const url = `/${path}/${buildNumber}/consoleText`;
    const { data } = await this.client.get(url, { responseType: 'text' });
    return typeof data === 'string' ? data : String(data);
  }

  async getConsoleTextByUrl(absoluteBuildUrl: string): Promise<string> {
    const clean = absoluteBuildUrl.replace(/\/$/, '');
    const classicBase = this.convertToClassicBuildUrl(clean) || clean;
    const url = `${classicBase}/consoleText`;
    const jenkinsConfig = loadJenkinsConfig();
    const { data } = await axios.get(url, {
      auth: { username: jenkinsConfig.username, password: jenkinsConfig.apiToken },
      responseType: 'text'
    });
    return typeof data === 'string' ? data : String(data);
  }

  findLastFailed(builds: JenkinsBuild[]): JenkinsBuild | null {
    for (const build of builds) {
      if (build && build.result === 'FAILURE') return build;
    }
    return null;
  }

  private convertToClassicBuildUrl(blueUrl: string): string | null {
    try {
      const u = new URL(blueUrl);
      const path = u.pathname.replace(/\/$/, '');
      const m = path.match(/^\/blue\/organizations\/jenkins\/([^/]+)\/detail\/([^/]+)\/(\d+)(?:\/.*)?$/);
      if (!m) return null;
      const jobName = decodeURIComponent(m[1]);
      const branchOrPr = decodeURIComponent(m[2]);
      const buildNumber = m[3];

      const isPr = /^PR-\d+$/i.test(branchOrPr);
      const encodedJob = encodeURIComponent(jobName);
      const encodedBranch = encodeURIComponent(branchOrPr);

      const base = `${u.origin}/job/${encodedJob}`;
      if (isPr) {
        return `${base}/view/change-requests/job/${encodedBranch}/${buildNumber}`;
      }
      return `${base}/job/${encodedBranch}/${buildNumber}`;
    } catch {
      return null;
    }
  }
}
