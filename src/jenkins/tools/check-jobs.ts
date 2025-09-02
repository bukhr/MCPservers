import { z } from 'zod';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createLogger } from '../utils/logger.js';
import { processCheckJobsByUrl, processCheckJobsByJob } from '../services/check-jobs-service.js';

const toolLogger = createLogger('jenkins_tool', 'check-jobs');

export const registerCheckJobsTool = (server: McpServer) => {
  server.tool(
    'check_jobs',
    'Get the last failed build for a Jenkins job and return a log excerpt (tail)',
    {
      job_full_name: z.string().describe('Full Jenkins job name, e.g., "Folder/Sub/Job"').optional(),
      pipeline_url: z.string().url().describe('Absolute Jenkins build URL, e.g., "https://jenkins.example.com/job/foo/15/"').optional(),
      tail_lines: z.number().int().positive().optional().describe('Number of trailing log lines to return. If omitted, returns the full log')
    },
    async ({ job_full_name, pipeline_url, tail_lines }) => {
      try {
        if (pipeline_url) {
          toolLogger.info('Fetching build by URL', { pipeline_url });
          const payload = await processCheckJobsByUrl({ pipelineUrl: pipeline_url, tailLines: tail_lines });
          return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
        }

        if (!job_full_name) {
          return { content: [{ type: 'text', text: 'Either pipeline_url or job_full_name is required' }] };
        }

        toolLogger.info('Fetching builds', { job_full_name });
        const payload = await processCheckJobsByJob({ jobFullName: job_full_name, tailLines: tail_lines });
        
        return { content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] };
      } catch (error) {
        toolLogger.error('check_jobs error', {
          error: error instanceof Error ? error.message : String(error),
          job_full_name
        });
        return {
          content: [{ 
            type: 'text', 
            text: `Error while checking jobs: ${error instanceof Error ? error.message : String(error)}` 
          }]
        };
      }
    }
  );
}
