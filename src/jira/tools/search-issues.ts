import { z } from 'zod';
import { getAuthHeaders, JIRA_BASE_URL } from '../config.js';

export const searchIssuesSchema = {
  jql: z.string().describe('JQL query string (e.g., "project = SEL AND summary ~ Provider")'),
  max_results: z.number().optional().describe('Maximum number of results (default: 20)')
};

export const searchIssuesHandler = async ({ jql, max_results = 20 }: { jql: string; max_results?: number }) => {
  const url = new URL(`${JIRA_BASE_URL}/rest/api/3/search/jql`);
  url.searchParams.append('jql', jql);
  url.searchParams.append('maxResults', max_results.toString());
  url.searchParams.append('fields', 'summary,status,assignee,created,issuetype,description');
  
  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: getAuthHeaders()
  });

  const data = await response.json();
  
  // Check for errors
  if (!response.ok) {
    return {
      content: [{ 
        type: 'text' as const, 
        text: `Búsqueda fallida\nStatus: ${response.status}\nError: ${JSON.stringify(data, null, 2)}` 
      }]
    };
  }
  
  // Simplify response
  const simplified = {
    total: data.issues?.length || 0,
    isLast: data.isLast || false,
    issues: data.issues?.map((issue: any) => ({
      key: issue.key || issue.id,
      id: issue.id,
      summary: issue.fields?.summary || 'No summary',
      status: issue.fields?.status?.name || 'Unknown',
      assignee: issue.fields?.assignee?.displayName || 'Unassigned',
      created: issue.fields?.created,
      issueType: issue.fields?.issuetype?.name,
      description: issue.fields?.description
    })) || []
  };
  
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(simplified, null, 2) }]
  };
};
