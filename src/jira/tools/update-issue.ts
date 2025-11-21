import { z } from 'zod';
import { getAuthHeaders, JIRA_BASE_URL } from '../config.js';
import { convertToADF } from '../utils.js';

export const updateIssueSchema = {
  issue_key: z.string().describe('Jira issue key'),
  summary: z.string().optional().describe('New summary/title'),
  description: z.string().optional().describe('New description'),
  assignee: z.string().optional().describe('Assignee email or account ID')
};

export const updateIssueHandler = async ({ 
  issue_key, 
  summary, 
  description,
  assignee
}: { 
  issue_key: string; 
  summary?: string; 
  description?: string;
  assignee?: string;
}) => {
  const fields: any = {};
  if (summary) fields.summary = summary;
  if (description) {
    fields.description = convertToADF(description);
  }
  if (assignee) {
    fields.assignee = { id: assignee };
  }
  
  const response = await fetch(`${JIRA_BASE_URL}/rest/api/3/issue/${issue_key}`, {
    method: 'PUT',
    headers: getAuthHeaders(),
    body: JSON.stringify({ fields })
  });

  if (response.status === 204) {
    return {
      content: [{ 
        type: 'text' as const, 
        text: `Issue ${issue_key} actualizado exitosamente\nURL: ${JIRA_BASE_URL}/browse/${issue_key}` 
      }]
    };
  } else {
    const data = await response.json();
    return {
      content: [{ 
        type: 'text' as const, 
        text: `Error al actualizar issue:\n${JSON.stringify(data, null, 2)}` 
      }]
    };
  }
};
