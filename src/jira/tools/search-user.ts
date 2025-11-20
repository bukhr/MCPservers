import { z } from 'zod';
import { getAuthHeaders, JIRA_BASE_URL } from '../config.js';

export const searchUserSchema = {
  email: z.string().describe('User email to search for')
};

export const searchUserHandler = async ({ email }: { email: string }) => {
  const response = await fetch(
    `${JIRA_BASE_URL}/rest/api/3/user/search?query=${encodeURIComponent(email)}`,
    {
      method: 'GET',
      headers: getAuthHeaders()
    }
  );

  if (response.ok) {
    const users = await response.json();
    return {
      content: [{ 
        type: 'text' as const, 
        text: JSON.stringify(users, null, 2)
      }]
    };
  } else {
    const data = await response.json();
    return {
      content: [{ 
        type: 'text' as const, 
        text: `Error al buscar usuario:\n${JSON.stringify(data, null, 2)}` 
      }]
    };
  }
};
