export const cleanFields = (obj: any) => {
  if (!obj.fields) return { ...obj, fields: {}, description: null };
  
  const { description, ...otherFields } = obj.fields;
  
  const cleanedFields = Object.fromEntries(
    Object.entries(otherFields)
      .filter(([_, value]) => value !== null)
  );

  return {
    ...obj,
    description: description || null,
    fields: cleanedFields
  };
};

// Convierte un texto plano a ADF:
// ADF es el formato que requiere Jira para las descripciones
export const convertToADF = (text: string) => {
  const lines = text.split('\n');
  const content: any[] = [];
  
  for (const line of lines) {
    if (line.trim() === '') {
      continue; // Skip empty lines
    }
    
    // Check if it's a bullet point
    if (line.trim().startsWith('-')) {
      const bulletText = line.trim().substring(1).trim();
      content.push({
        type: 'bulletList',
        content: [{
          type: 'listItem',
          content: [{
            type: 'paragraph',
            content: [{ type: 'text', text: bulletText }]
          }]
        }]
      });
    } else if (line.trim().startsWith('**') && line.trim().endsWith('**')) {
      // Bold text (e.g., **Historia de Usuario:**)
      const boldText = line.trim().replace(/^\*\*|\*\*$/g, '');
      content.push({
        type: 'paragraph',
        content: [{
          type: 'text',
          text: boldText,
          marks: [{ type: 'strong' }]
        }]
      });
    } else {
      // Regular paragraph
      content.push({
        type: 'paragraph',
        content: [{ type: 'text', text: line.trim() }]
      });
    }
  }
  
  return {
    version: 1,
    type: 'doc',
    content
  };
};
