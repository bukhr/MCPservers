import { z } from 'zod';
import { getAuthHeaders, JIRA_BASE_URL } from '../config.js';

export const createIssueSchema = {
  project_key: z.string().describe('Project key (e.g., SEL)'),
  summary: z.string().describe('Issue summary/title'),
  description: z.string().describe('Issue description'),
  issue_type: z.string().optional().describe('Issue type (default: Historia)'),
  parent_key: z.string().optional().describe('Parent epic key if this is a child issue')
};

export const createIssueHandler = async ({ 
  project_key, 
  summary, 
  description, 
  issue_type = 'Historia', 
  parent_key 
}: { 
  project_key: string; 
  summary: string; 
  description: string; 
  issue_type?: string; 
  parent_key?: string;
}) => {
  const body: any = {
    fields: {
      project: { key: project_key },
      summary,
      description,
      issuetype: { name: issue_type }
    }
  };
  
  // Add parent if provided
  if (parent_key) {
    body.fields.parent = { key: parent_key };
  }
  
  const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify(body)
  });

  const data = await response.json();
  
  if (response.ok) {
    return {
      content: [{ 
        type: 'text' as const, 
        text: `Issue creado exitosamente\nKey: ${data.key}\nURL: ${JIRA_BASE_URL}/browse/${data.key}` 
      }]
    };
  } else {
    return {
      content: [{ 
        type: 'text' as const, 
        text: `Error al crear issue:\n${JSON.stringify(data, null, 2)}` 
      }]
    };
  }
};
