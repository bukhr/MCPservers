import { z } from 'zod';
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createLogger } from '../utils/logger.js';
import { processCheckJobsByUrl, processCheckJobsByJob } from '../services/check-jobs-service.js';
import { JenkinsClientInterface } from '../interfaces/jenkins-client.interface.js';
import { JenkinsClient } from '../services/jenkins-client.js';
import { loadJenkinsConfig } from '../config/settings.js';
import { createSuccessResponse, createErrorResponse, extractErrorMessage } from '../utils/mcp-responses.js';

const toolLogger = createLogger('jenkins_tool', 'check-jobs');

/**
 * Registra la herramienta check_jobs en el servidor MCP
 * @param server Servidor MCP donde se registrará la herramienta
 */
export const registerCheckJobsTool = (server: McpServer): void => {
  server.tool(
    'check_jobs',
    'Get the last failed build for a Jenkins job and return the full log',
    {
      job_full_name: z.string().describe('Full Jenkins job name, e.g., "Folder/Sub/Job"').optional(),
      pipeline_url: z.string().url().describe('Absolute Jenkins build URL, e.g., "https://jenkins.example.com/job/foo/15/"').optional()
    },
    async ({ job_full_name, pipeline_url }) => {
      try {
        if (!pipeline_url && !job_full_name) {
          return { 
            content: [{ 
              type: 'text' as const, 
              text: 'Either pipeline_url or job_full_name is required' 
            }] 
          };
        }

        const jenkinsConfig = loadJenkinsConfig();
        const client: JenkinsClientInterface = new JenkinsClient(jenkinsConfig);

        if (pipeline_url) {
          toolLogger.info('Fetching build by URL', { pipeline_url });
          
          const payload = await processCheckJobsByUrl(client, pipeline_url);

          if (!payload || !payload.log_full) {
            return createErrorResponse('The logs could not be found', { 
              error: 'No log found',
              job_full_name,
              pipeline_url
            });
          }
          
          return createSuccessResponse(payload);
        }

        toolLogger.info('Fetching builds', { job_full_name });
        
        const payload = await processCheckJobsByJob(client, job_full_name!);

        if (!payload || !payload.log_full) {
          return createErrorResponse('The logs could not be found', { 
            error: 'No log found',
            job_full_name,
            pipeline_url
          });
        }
        
        return createSuccessResponse(payload);
      } catch (error) {
        const errorMessage = extractErrorMessage(error);
        return createErrorResponse(errorMessage, { 
          error: errorMessage,
          job_full_name,
          pipeline_url
        });
      }
    }
  );
}
