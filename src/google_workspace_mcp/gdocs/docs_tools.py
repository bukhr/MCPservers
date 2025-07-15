"""
Google Docs MCP Tools

This module provides MCP tools for interacting with Google Docs API and managing Google Docs via Drive.
"""
import asyncio
import logging
import io
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta

from mcp import types
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaIoBaseDownload

# Auth & server utilities
from auth.service_decorator import require_google_service, require_multiple_services
from core.utils import extract_office_xml_text, handle_http_errors
from core.server import server

logger = logging.getLogger(__name__)

# Global cache for document content
# Structure: {document_id: {"content": processed_content, "timestamp": datetime, "tabs_data": dict}}
_document_cache: Dict[str, Dict[str, Any]] = {}
_cache_ttl_minutes = 30  # Time to live for cached documents


def _is_cache_valid(document_id: str) -> bool:
    """Check if cached document data is still valid."""
    if document_id not in _document_cache:
        return False
    
    cached_time = _document_cache[document_id].get("timestamp")
    if not cached_time:
        return False
    
    return datetime.now() - cached_time < timedelta(minutes=_cache_ttl_minutes)


def _get_cached_document(document_id: str) -> Optional[Dict[str, Any]]:
    """Get cached document data if valid."""
    if _is_cache_valid(document_id):
        return _document_cache[document_id]
    return None


def _cache_document(document_id: str, content: str, tabs_data: Dict[str, Any]) -> None:
    """Cache processed document content and tabs data."""
    _document_cache[document_id] = {
        "content": content,
        "tabs_data": tabs_data,
        "timestamp": datetime.now()
    }
    logger.info(f"Cached document {document_id}")


def _extract_document_content_with_tabs(docs_service, document_id: str) -> Dict[str, Any]:
    """
    Extract and process document content with tabs, including all metadata.
    
    Args:
        docs_service: Google Docs service instance
        document_id: ID of the document to process
        
    Returns:
        Dict containing processed content, tabs_data, and metadata
    """
    # Check cache first
    cached_data = _get_cached_document(document_id)
    if cached_data:
        logger.info(f"Using cached content for document {document_id}")
        return cached_data
    
    # Get document data from API
    doc_data = docs_service.documents().get(
        documentId=document_id,
        includeTabsContent=True
    ).execute()
    
    # Process all text formatting functions (moved from get_doc_content_with_tabs)
    def process_text_run(text_run):
        """Process a text run and extract content with formatting info."""
        content = text_run.get('content', '')
        text_style = text_run.get('textStyle', {})
        
        # Check for person properties (mentions, smart chips)
        if 'personProperties' in text_style:
            person_props = text_style['personProperties']
            email = person_props.get('email', '')
            name = person_props.get('name', content.strip())
            if email:
                return f"@{name} ({email})"
            else:
                return f"@{name}"
        
        # Check for rich link properties (smart chips, file links, etc.)
        if 'richLinkProperties' in text_style:
            rich_link = text_style['richLinkProperties']
            title = rich_link.get('title', content.strip())
            uri = rich_link.get('uri', '')
            mime_type = rich_link.get('mimeType', '')
            
            if uri:
                if mime_type:
                    return f"[{title}]({uri}) [{mime_type}]"
                else:
                    return f"[{title}]({uri})"
            else:
                return f"[RICH_LINK: {title}]"
        
        # Check for regular links
        if 'link' in text_style:
            link_url = text_style['link'].get('url', '')
            if link_url:
                # Case 1: Direct URL as content
                if content.strip() == link_url:
                    return f"[LINK: {link_url}]"
                # Case 2: Custom text with URL
                else:
                    return f"[LINK: {content.strip()} -> {link_url}]"
        
        # Check for formatting
        formatting = []
        if text_style.get('bold'):
            formatting.append('**')
        if text_style.get('italic'):
            formatting.append('*')
        if text_style.get('underline'):
            formatting.append('_')
        if text_style.get('strikethrough'):
            formatting.append('~~')
        
        # Check for color formatting
        if 'foregroundColor' in text_style:
            color = text_style['foregroundColor']
            if 'color' in color and 'rgbColor' in color['color']:
                rgb = color['color']['rgbColor']
                r = int(rgb.get('red', 0) * 255)
                g = int(rgb.get('green', 0) * 255)
                b = int(rgb.get('blue', 0) * 255)
                content = f"[COLOR(rgb({r},{g},{b})): {content}]"
        
        # Check for background color
        if 'backgroundColor' in text_style:
            bg_color = text_style['backgroundColor']
            if 'color' in bg_color and 'rgbColor' in bg_color['color']:
                rgb = bg_color['color']['rgbColor']
                r = int(rgb.get('red', 0) * 255)
                g = int(rgb.get('green', 0) * 255)
                b = int(rgb.get('blue', 0) * 255)
                content = f"[HIGHLIGHT(rgb({r},{g},{b})): {content}]"
        
        # Check for font properties
        if 'fontSize' in text_style:
            font_size = text_style['fontSize'].get('magnitude', 0)
            if font_size and font_size != 11:  # Only show if different from default
                content = f"[FONT_SIZE({font_size}pt): {content}]"
        
        if 'weightedFontFamily' in text_style:
            font_family = text_style['weightedFontFamily'].get('fontFamily', '')
            if font_family and font_family != 'Arial':  # Only show if different from default
                content = f"[FONT({font_family}): {content}]"
        
        if formatting:
            return f"{''.join(formatting)}{content}{''.join(reversed(formatting))}"
        
        return content
    
    def process_paragraph(paragraph, inline_objects=None):
        """Process a paragraph element and return formatted text."""
        para_elements = paragraph.get('elements', [])
        paragraph_text = ""
        
        for pe in para_elements:
            if 'textRun' in pe:
                paragraph_text += process_text_run(pe['textRun'])
            elif 'inlineObjectElement' in pe:
                # Handle images and other inline objects with rich information
                inline_obj = pe['inlineObjectElement']
                object_id = inline_obj.get('inlineObjectId', '')
                
                # Try to get image URI from inline_objects
                if inline_objects and object_id in inline_objects:
                    inline_data = inline_objects[object_id]
                    embedded_obj = inline_data.get('inlineObjectProperties', {}).get('embeddedObject', {})
                    image_props = embedded_obj.get('imageProperties', {})
                    content_uri = image_props.get('contentUri', '')
                    
                    # Get additional image properties for better display
                    title = embedded_obj.get('title', '')
                    description = embedded_obj.get('description', '')
                    
                    if content_uri:
                        # Display the image inline using markdown syntax
                        alt_text = title or description or f"Image {object_id}"
                        paragraph_text += f"![{alt_text}]({content_uri})"
                    else:
                        # Fallback if no URI available
                        paragraph_text += f"[IMAGE: {object_id}]"
                else:
                    # Fallback to basic format if no inline_objects data available
                    paragraph_text += f"[IMAGE: {object_id}]"
            elif 'pageBreak' in pe:
                paragraph_text += "[PAGE BREAK]"
            elif 'columnBreak' in pe:
                paragraph_text += "[COLUMN BREAK]"
            elif 'footnoteReference' in pe:
                footnote_ref = pe['footnoteReference']
                footnote_id = footnote_ref.get('footnoteId', '')
                footnote_number = footnote_ref.get('footnoteNumber', '')
                paragraph_text += f"[FOOTNOTE: {footnote_number}]"
            elif 'horizontalRule' in pe:
                paragraph_text += "\n---\n"
            elif 'equation' in pe:
                paragraph_text += "[EQUATION]"
            elif 'person' in pe:
                person = pe['person']
                person_id = person.get('personId', '')
                person_properties = person.get('personProperties', {})
                name = person_properties.get('name', 'Unknown Person')
                email = person_properties.get('email', '')
                if email:
                    paragraph_text += f"@{name} ({email})"
                else:
                    paragraph_text += f"@{name}"
        
        # Check for bullet points or numbering
        bullet = paragraph.get('bullet')
        if bullet:
            list_id = bullet.get('listId', '')
            nesting_level = bullet.get('nestingLevel', 0)
            indent = "  " * nesting_level
            
            # Check if it's numbered or bulleted
            if 'textStyle' in bullet:
                paragraph_text = f"{indent}• {paragraph_text}"
            else:
                paragraph_text = f"{indent}• {paragraph_text}"
        
        return paragraph_text.rstrip('\n')
    
    def process_table(table, inline_objects=None):
        """Process a table element and return formatted table."""
        table_content = []
        table_content.append("\n[TABLE]")
        
        rows = table.get('tableRows', [])
        for row_idx, row in enumerate(rows):
            row_content = []
            cells = row.get('tableCells', [])
            
            for cell in cells:
                cell_content = []
                cell_body = cell.get('content', [])
                
                for element in cell_body:
                    if 'paragraph' in element:
                        cell_text = process_paragraph(element['paragraph'], inline_objects)
                        if cell_text.strip():
                            cell_content.append(cell_text)
                
                row_content.append(' '.join(cell_content) if cell_content else '')
            
            table_content.append("| " + " | ".join(row_content) + " |")
            
            # Add separator after header row
            if row_idx == 0 and len(rows) > 1:
                table_content.append("| " + " | ".join(["-" * len(cell) for cell in row_content]) + " |")
        
        table_content.append("[/TABLE]\n")
        return '\n'.join(table_content)
    
    def process_content_elements(content_elements, indent="", inline_objects=None):
        """Process a list of content elements (paragraphs, tables, etc.)."""
        processed = []
        
        for element in content_elements:
            if 'paragraph' in element:
                para_text = process_paragraph(element['paragraph'], inline_objects)
                if para_text.strip():
                    processed.append(f"{indent}{para_text}")
            
            elif 'table' in element:
                table_text = process_table(element['table'], inline_objects)
                processed.append(f"{indent}{table_text}")
            
            elif 'sectionBreak' in element:
                processed.append(f"{indent}[SECTION BREAK]")
            
            elif 'tableOfContents' in element:
                processed.append(f"{indent}[TABLE OF CONTENTS]")
        
        return processed
    
    def extract_document_metadata(doc_data, inline_objects=None):
        """Extract additional document metadata and properties."""
        metadata = []
        
        # Extract named ranges
        named_ranges = doc_data.get('namedRanges', {})
        if named_ranges:
            metadata.append("\n=== NAMED RANGES ===")
            for range_name, range_data in named_ranges.items():
                ranges = range_data.get('namedRanges', [])
                metadata.append(f"Range: {range_name}")
                for r in ranges:
                    start = r.get('range', {}).get('startIndex', 0)
                    end = r.get('range', {}).get('endIndex', 0)
                    metadata.append(f"  - Position: {start}-{end}")
        
        # Extract suggested changes
        suggested_changes = doc_data.get('suggestedChanges', {})
        if suggested_changes:
            metadata.append("\n=== SUGGESTED CHANGES ===")
            for change_id, change_data in suggested_changes.items():
                change_type = change_data.get('suggestionType', 'Unknown')
                metadata.append(f"Change ID: {change_id} - Type: {change_type}")
        
        # Extract footnotes
        footnotes = doc_data.get('footnotes', {})
        if footnotes:
            metadata.append("\n=== FOOTNOTES ===")
            for footnote_id, footnote_data in footnotes.items():
                content = footnote_data.get('content', [])
                footnote_text = []
                for element in content:
                    if 'paragraph' in element:
                        footnote_text.append(process_paragraph(element['paragraph'], inline_objects))
                metadata.append(f"Footnote {footnote_id}: {''.join(footnote_text)}")
        
        # Extract document style information
        doc_style = doc_data.get('documentStyle', {})
        if doc_style:
            metadata.append("\n=== DOCUMENT STYLE ===")
            
            # Page size
            page_size = doc_style.get('pageSize', {})
            if page_size:
                width = page_size.get('width', {}).get('magnitude', 0)
                height = page_size.get('height', {}).get('magnitude', 0)
                unit = page_size.get('width', {}).get('unit', 'PT')
                metadata.append(f"Page Size: {width} x {height} {unit}")
            
            # Margins
            margins = doc_style.get('marginTop', {})
            if margins:
                top = margins.get('magnitude', 0)
                unit = margins.get('unit', 'PT')
                metadata.append(f"Top Margin: {top} {unit}")
        
        # Extract lists information
        lists = doc_data.get('lists', {})
        if lists:
            metadata.append("\n=== LISTS ===")
            for list_id, list_data in lists.items():
                properties = list_data.get('listProperties', {})
                nesting_levels = properties.get('nestingLevels', [])
                metadata.append(f"List ID: {list_id} - Levels: {len(nesting_levels)}")
        
        return '\n'.join(metadata) if metadata else ""
    
    # Extract inline objects for rich image processing
    inline_objects = doc_data.get('inlineObjects', {})
    
    # Process document content
    processed_content = []
    processed_content.append('--- CONTENIDO ---')
    
    # Process main document body
    body = doc_data.get('body', {})
    if body:
        main_content = body.get('content', [])
        if main_content:
            processed_content.extend(process_content_elements(main_content, inline_objects=inline_objects))
    
    # Structure tabs data for easy access
    tabs_data = {}
    tabs = doc_data.get('tabs', [])
    if tabs:
        processed_content.append("\n=== CONTENIDO DE PESTAÑAS ===")
        for i, tab in enumerate(tabs):
            tab_id = tab.get('tabId', f'tab_{i}')
            
            # Store tab data in structured format
            tab_info = {
                'tab_id': tab_id,
                'properties': tab.get('tabProperties', {}),
                'content': [],
                'child_tabs': {}
            }
            
            # Process tab properties
            tab_properties = tab.get('tabProperties', {})
            title = tab_properties.get('title', 'Untitled Tab')
            index = tab_properties.get('index', i)
            
            processed_content.append(f"\n--- ID DE PESTAÑA: {tab_id} ---")
            processed_content.append(f"Título de Pestaña: {title}")
            processed_content.append(f"Índice de Pestaña: {index}")
            
            # Process tab content
            document_tab = tab.get('documentTab', {})
            if document_tab:
                # Get tab-specific inline objects if available, otherwise use document-level ones
                tab_inline_objects = document_tab.get('inlineObjects', inline_objects)
                body_content = document_tab.get('body', {}).get('content', [])
                if body_content:
                    processed_content.append("Contenido de Pestaña:")
                    tab_processed = process_content_elements(body_content, "  ", tab_inline_objects)
                    processed_content.extend(tab_processed)
                    tab_info['content'] = tab_processed
            
            # Process child tabs
            child_tabs = tab.get('childTabs', [])
            if child_tabs:
                processed_content.append(f"Pestañas secundarias: {len(child_tabs)}")
                for j, child_tab in enumerate(child_tabs):
                    child_tab_id = child_tab.get('tabId', f'child_tab_{j}')
                    processed_content.append(f"  ID de Pestaña Secundaria: {child_tab_id}")
                    
                    child_doc_tab = child_tab.get('documentTab', {})
                    if child_doc_tab:
                        # Get child tab-specific inline objects if available, otherwise use document-level ones
                        child_inline_objects = child_doc_tab.get('inlineObjects', inline_objects)
                        child_body = child_doc_tab.get('body', {}).get('content', [])
                        if child_body:
                            processed_content.append("  Contenido de Pestaña Secundaria:")
                            child_processed = process_content_elements(child_body, "    ", child_inline_objects)
                            processed_content.extend(child_processed)
                            
                            # Store child tab data
                            tab_info['child_tabs'][child_tab_id] = {
                                'tab_id': child_tab_id,
                                'properties': child_tab.get('tabProperties', {}),
                                'content': child_processed
                            }
            
            tabs_data[tab_id] = tab_info
    
    # Extract document metadata
    metadata = extract_document_metadata(doc_data, inline_objects)
    if metadata:
        processed_content.append("\n=== METADATOS DEL DOCUMENTO ===")
        processed_content.append(metadata)
    
    # Prepare result
    result = {
        'content': '\n'.join(processed_content),
        'tabs_data': tabs_data,
        'doc_data': doc_data,
        'timestamp': datetime.now()
    }
    
    # Cache the result
    _cache_document(document_id, result['content'], tabs_data)
    
    return result


def _extract_tab_id_from_url(url_or_id: str) -> str:
    """
    Extract tab ID from Google Docs URL or return the ID as-is if it's already a tab ID.
    
    Args:
        url_or_id: Either a Google Docs URL with tab parameter or a direct tab ID
        
    Returns:
        str: Extracted or original tab ID
    """
    if url_or_id.startswith('http'):
        # Extract from URL: https://docs.google.com/document/d/.../edit?tab=t.xyz
        import urllib.parse
        parsed = urllib.parse.urlparse(url_or_id)
        query_params = urllib.parse.parse_qs(parsed.query)
        if 'tab' in query_params:
            return query_params['tab'][0]  # Return first tab parameter
    return url_or_id  # Return as-is if not a URL


def _get_tab_content_lightweight(docs_service, document_id: str, tab_id: str) -> Dict[str, Any]:
    """
    Lightweight function to get only specific tab content without processing entire document.
    Falls back to full document processing if needed.
    
    Args:
        docs_service: Google Docs service instance
        document_id: ID of the document
        tab_id: Specific tab ID to retrieve
        
    Returns:
        Dict containing tab content and metadata
    """
    try:
        # First try to get just the document structure without full content
        doc_data = docs_service.documents().get(
            documentId=document_id,
            includeTabsContent=False  # Load structure only first
        ).execute()
        
        tabs = doc_data.get('tabs', [])
        target_tab = None
        
        # Find the specific tab
        for tab in tabs:
            if tab.get('tabId') == tab_id:
                target_tab = tab
                break
        
        if target_tab:
            # Now get just this tab's content
            full_doc = docs_service.documents().get(
                documentId=document_id,
                includeTabsContent=True
            ).execute()
            
            # Find and return just the target tab
            for tab in full_doc.get('tabs', []):
                if tab.get('tabId') == tab_id:
                    return {
                        'tab_data': tab,
                        'doc_title': full_doc.get('title', 'Unknown Document'),
                        'inline_objects': full_doc.get('inlineObjects', {}),
                        'timestamp': datetime.now()
                    }
        
        # Fallback: tab not found or structure loading failed
        return None
        
    except Exception as e:
        logger.warning(f"Lightweight tab loading failed: {e}, falling back to full processing")
        return None


def _format_tab_selection_prompt(doc_title: str, tabs_count: int) -> str:
    """Helper function to format the tab selection prompt for users."""
    return f"""
🎯 **Listo para leer contenido de "{doc_title}"**

Encontré {tabs_count} pestañas en este documento. 

**¿Qué te gustaría que lea?**
- Proporciona el ID de la pestaña (código entre comillas invertidas como `tab_0`)
- Cargaré ese contenido y lo usaré como contexto para nuestra conversación
- También puedes especificar IDs de sub-pestañas para una lectura más enfocada

**Ejemplo:** "Lee la pestaña `tab_0`" o "Muéstrame el contenido de `child_tab_2`"
"""


@server.tool()
@require_multiple_services([
    {"service_type": "drive", "scopes": "drive_read", "param_name": "drive_service"},
    {"service_type": "docs", "scopes": "docs_read", "param_name": "docs_service"}
])
@handle_http_errors("get_tab_content")
async def get_tab_content(
    drive_service,
    docs_service,
    user_google_email: str,
    document_id: str,
    tab_identifier: str,
    parent_tab_id: Optional[str] = None,
    search_by_name: bool = False,
) -> str:
    """
    **STEP 3 of Interactive Flow:** Retrieve content of a specific tab or subtab from a Google Doc.
    
    **Usage Flow:**
    1. First see available tabs
    2. User chooses which tab to read  
    3. Use this function to get the actual content
    
    **Performance Optimized:** Uses lightweight loading for fast response times.
    
    Args:
        user_google_email: The user's Google email address
        document_id: The ID of the Google Document
        tab_identifier: Tab ID, subtab ID, tab name, or Google Docs URL with tab parameter
        parent_tab_id: Optional parent tab ID (required for subtabs)
        search_by_name: If True, searches for tabs/subtabs by name instead of ID
    
    Returns:
        str: The content of the specified tab/subtab formatted for context usage.
    """
    # Extract tab ID from URL if needed
    tab_id = _extract_tab_id_from_url(tab_identifier)
    
    logger.info(f"[get_tab_content] Getting content for document {document_id}, tab: {tab_id}, parent: {parent_tab_id}, search_by_name: {search_by_name}")
    
    try:
        # First, try the lightweight approach for specific tab content (if not searching by name)
        if not search_by_name and not parent_tab_id:
            logger.info(f"[get_tab_content] Attempting lightweight loading for tab {tab_id}")
            lightweight_result = await asyncio.to_thread(
                _get_tab_content_lightweight,
                docs_service,
                document_id,
                tab_id
            )
            
            if lightweight_result:
                logger.info(f"[get_tab_content] Successfully loaded tab {tab_id} using lightweight method")
                tab_data = lightweight_result.get('tab_data', {})
                doc_title = lightweight_result.get('doc_title', 'Unknown Document')
                inline_objects = lightweight_result.get('inline_objects', {})
                doc_link = f"https://docs.google.com/document/d/{document_id}/edit?usp=drivesdk"
                
                tab_properties = tab_data.get('tabProperties', {})
                tab_title = tab_properties.get('title', 'Untitled Tab')
                tab_index = tab_properties.get('index', 0)
                
                response_parts = [
                    f'Archivo: "{doc_title}" (ID: {document_id}, Tipo: application/vnd.google-apps.document)',
                    f'Enlace: {doc_link}',
                    f'ID de Pestaña Solicitado: {tab_id}',
                    '',
                    f'--- PESTAÑA ENCONTRADA: {tab_id} ---',
                    f'Título de Pestaña: {tab_title}',
                    f'Índice de Pestaña: {tab_index}',
                    '',
                    '--- CONTENIDO DE PESTAÑA ---'
                ]
                
                # Process tab content
                document_tab = tab_data.get('documentTab', {})
                if document_tab:
                    body_content = document_tab.get('body', {}).get('content', [])
                    if body_content:
                        # We need to define process_content_elements here since we're not loading the full doc
                        from core.utils import extract_office_xml_text
                        
                        def process_content_elements(elements, indent="", inline_objects=None):
                            """Simplified content processing for lightweight mode"""
                            processed = []
                            for element in elements:
                                if 'paragraph' in element:
                                    para = element['paragraph']
                                    para_elements = para.get('elements', [])
                                    line_content = []
                                    
                                    for para_element in para_elements:
                                        if 'textRun' in para_element:
                                            text_run = para_element['textRun']
                                            text_content = text_run.get('content', '')
                                            
                                            # Skip empty content (like \n at the end)
                                            if not text_content.strip():
                                                continue
                                                
                                            # Check if this textRun contains a link
                                            text_style = text_run.get('textStyle', {})
                                            link_info = text_style.get('link', {})
                                            
                                            if link_info and 'url' in link_info:
                                                url = link_info['url']
                                                # Case 1: Direct URL as content
                                                if text_content.strip() == url:
                                                    line_content.append(f"[LINK: {url}]")
                                                # Case 2: Custom text with URL
                                                else:
                                                    line_content.append(f"[LINK: {text_content.strip()} -> {url}]")
                                            else:
                                                # Regular text content
                                                line_content.append(text_content)
                                        elif 'inlineObjectElement' in para_element:
                                            # Handle images with rich information
                                            inline_obj = para_element['inlineObjectElement']
                                            object_id = inline_obj.get('inlineObjectId', '')
                                            
                                            # Try to get image URI from inline_objects
                                            if inline_objects and object_id in inline_objects:
                                                inline_data = inline_objects[object_id]
                                                embedded_obj = inline_data.get('inlineObjectProperties', {}).get('embeddedObject', {})
                                                image_props = embedded_obj.get('imageProperties', {})
                                                content_uri = image_props.get('contentUri', '')
                                                
                                                # Get additional image properties for better display
                                                title = embedded_obj.get('title', '')
                                                description = embedded_obj.get('description', '')
                                                
                                                if content_uri:
                                                    # Display the image inline using markdown syntax
                                                    alt_text = title or description or f"Image {object_id}"
                                                    line_content.append(f"![{alt_text}]({content_uri})")
                                                else:
                                                    # Fallback if no URI available
                                                    line_content.append(f"[IMAGE: {object_id}]")
                                            else:
                                                # Fallback to basic format
                                                line_content.append(f"[IMAGE: {object_id}]")
                                    
                                    if line_content:
                                        processed.append(indent + ''.join(line_content).strip())
                                elif 'table' in element:
                                    processed.append(indent + "[TABLE CONTENT]")
                                elif 'sectionBreak' in element:
                                    processed.append(indent + "[SECTION BREAK]")
                            
                            return processed
                        
                        # Get tab-specific inline objects if available, otherwise use document-level ones
                        tab_inline_objects = document_tab.get('inlineObjects', inline_objects)
                        processed_content = process_content_elements(body_content, "", tab_inline_objects)
                        response_parts.extend(processed_content)
                    else:
                        response_parts.append('No content found in this tab.')
                else:
                    response_parts.append('No content found in this tab.')
                
                return '\n'.join(response_parts)
        
        # Fallback: Full document processing (for search by name, subtabs, or when lightweight fails)
        logger.info(f"[get_tab_content] Using full document processing for document {document_id}")
        # Extract document content with tabs - Add timeout protection
        doc_result = await asyncio.wait_for(
            asyncio.to_thread(
                _extract_document_content_with_tabs,
                docs_service,
                document_id
            ),
            timeout=60.0  # 60 second timeout
        )
        
        tabs_data = doc_result.get('tabs_data', {})
        doc_title = doc_result.get('title', 'Unknown Document')
        doc_link = f"https://docs.google.com/document/d/{document_id}/edit?usp=drivesdk"
        
        response_parts = [
            f'Archivo: "{doc_title}" (ID: {document_id}, Tipo: application/vnd.google-apps.document)',
            f'Enlace: {doc_link}',
            f'ID de Pestaña Solicitado: {tab_id}',
            ''
        ]
        
        # If search_by_name is True, find tab/subtab by name instead of ID
        if search_by_name:
            search_lower = tab_id.lower()
            matches = []
            
            # Search through all tabs and subtabs by name
            for tab_id_key, tab_info in tabs_data.items():
                tab_properties = tab_info.get('properties', {})
                tab_title = tab_properties.get('title', 'Untitled Tab')
                
                # Check if main tab title matches
                if search_lower in tab_title.lower():
                    matches.append({
                        'type': 'tab',
                        'id': tab_id_key,
                        'title': tab_title,
                        'content': tab_info.get('content', []),
                        'parent_id': None,
                        'parent_title': None
                    })
                
                # Check subtabs
                child_tabs = tab_info.get('child_tabs', {})
                for subtab_id, subtab_info in child_tabs.items():
                    subtab_properties = subtab_info.get('properties', {})
                    subtab_title = subtab_properties.get('title', 'Untitled Subtab')
                    
                    if search_lower in subtab_title.lower():
                        matches.append({
                            'type': 'subtab',
                            'id': subtab_id,
                            'title': subtab_title,
                            'content': subtab_info.get('content', []),
                            'parent_id': tab_id_key,
                            'parent_title': tab_title
                        })
            
            if matches:
                response_parts.append(f'--- ENCONTRADO {len(matches)} COINCIDENCIA(S) POR NOMBRE ---')
                response_parts.append('')
                
                for i, match in enumerate(matches, 1):
                    response_parts.append(f'Match {i} ({match["type"].upper()}):')
                    if match['type'] == 'subtab':
                        response_parts.extend([
                            f'Parent Tab: {match["parent_title"]} (ID: {match["parent_id"]})',
                            f'Subtab: {match["title"]} (ID: {match["id"]})',
                            '--- CONTENIDO DE SUBPESTAÑA ---'
                        ])
                    else:
                        response_parts.extend([
                            f'Tab: {match["title"]} (ID: {match["id"]})',
                            '--- CONTENIDO DE PESTAÑA ---'
                        ])
                    
                    # Add content
                    content = match['content']
                    if content:
                        response_parts.extend(content)
                    else:
                        response_parts.append('No content found.')
                    
                    response_parts.append('')  # Spacing between matches
            else:
                response_parts.extend([
                    f'--- NO COINCIDENCIAS ENCONTRADAS PARA EL NOMBRE: "{tab_id}" ---',
                    '',
                    'Available tabs and subtabs in this document:'
                ])
                
                for tab_id_key, tab_info in tabs_data.items():
                    tab_properties = tab_info.get('properties', {})
                    tab_title = tab_properties.get('title', 'Untitled Tab')
                    response_parts.append(f'- Tab: "{tab_title}" (ID: {tab_id_key})')
                    
                    child_tabs = tab_info.get('child_tabs', {})
                    for subtab_id, subtab_info in child_tabs.items():
                        subtab_properties = subtab_info.get('properties', {})
                        subtab_title = subtab_properties.get('title', 'Untitled Subtab')
                        response_parts.append(f'  - Subtab: "{subtab_title}" (ID: {subtab_id})')
            
            return '\n'.join(response_parts)
        
        # If parent_tab_id is provided, look for subtab
        if parent_tab_id:
            if parent_tab_id in tabs_data:
                parent_tab = tabs_data[parent_tab_id]
                parent_properties = parent_tab.get('properties', {})
                parent_title = parent_properties.get('title', 'Untitled Tab')
                child_tabs = parent_tab.get('child_tabs', {})
                
                response_parts.append(f'Parent Tab ID: {parent_tab_id}')
                
                # Try to find subtab by exact ID match first
                target_subtab = None
                target_subtab_id = None
                
                for subtab_id, subtab_info in child_tabs.items():
                    if subtab_id == tab_id:
                        target_subtab = subtab_info
                        target_subtab_id = subtab_id
                        break
                
                # If not found by exact match, try partial match on web tab ID
                if not target_subtab:
                    for subtab_id, subtab_info in child_tabs.items():
                        subtab_properties = subtab_info.get('properties', {})
                        # Check if the web tab ID might correspond to this subtab
                        if tab_id.startswith('t.') and subtab_properties.get('index') is not None:
                            target_subtab = subtab_info
                            target_subtab_id = subtab_id
                            break
                
                if target_subtab:
                    subtab_properties = target_subtab.get('properties', {})
                    subtab_title = subtab_properties.get('title', 'Untitled Subtab')
                    subtab_index = subtab_properties.get('index', 0)
                    
                    response_parts.extend([
                        f'--- SUBTAB ENCONTRADO: {target_subtab_id} ---',
                        f'Parent Tab: {parent_title} (ID: {parent_tab_id})',
                        f'Subtab Title: {subtab_title}',
                        f'Subtab Index: {subtab_index}',
                        '',
                        '--- CONTENIDO DE SUBPESTAÑA ---'
                    ])
                    
                    # Extract content for this specific subtab
                    subtab_content = target_subtab.get('content', [])
                    if subtab_content:
                        response_parts.extend(subtab_content)
                    else:
                        response_parts.append('No content found in this subtab.')
                else:
                    response_parts.extend([
                        f'--- SUBTAB NO ENCONTRADO: {tab_id} ---',
                        f'Parent Tab: {parent_title} (ID: {parent_tab_id})',
                        '',
                        'Available subtabs in this parent tab:'
                    ])
                    
                    for subtab_id, subtab_info in child_tabs.items():
                        subtab_properties = subtab_info.get('properties', {})
                        subtab_title = subtab_properties.get('title', 'Untitled Subtab')
                        response_parts.append(f'- Subtab ID: {subtab_id} | Title: "{subtab_title}"')
            else:
                response_parts.append(f'Parent tab {parent_tab_id} not found.')
        
        else:
            # Look for main tab or search through all tabs and subtabs
            found_content = False
            
            # Try exact match on main tabs first
            if tab_id in tabs_data:
                tab_info = tabs_data[tab_id]
                tab_properties = tab_info.get('properties', {})
                tab_title = tab_properties.get('title', 'Untitled Tab')
                tab_index = tab_properties.get('index', 0)
                
                response_parts.extend([
                    f'--- PESTAÑA ENCONTRADA: {tab_id} ---',
                    f'Título de Pestaña: {tab_title}',
                    f'Índice de Pestaña: {tab_index}',
                    '',
                    '--- CONTENIDO DE PESTAÑA ---'
                ])
                
                # Extract content for this tab
                tab_content = tab_info.get('content', [])
                if tab_content:
                    response_parts.extend(tab_content)
                else:
                    response_parts.append('No content found in this tab.')
                
                # Show child tabs if any
                child_tabs = tab_info.get('child_tabs', {})
                if child_tabs:
                    response_parts.extend(['', '--- SUBPESTAÑAS ---'])
                    for child_id, child_info in child_tabs.items():
                        child_properties = child_info.get('properties', {})
                        child_title = child_properties.get('title', 'Untitled Child Tab')
                        response_parts.append(f'  - Subtab ID: {child_id} | Title: "{child_title}"')
                
                found_content = True
            
            # If not found as main tab, search through all subtabs
            if not found_content:
                for parent_id, parent_tab in tabs_data.items():
                    child_tabs = parent_tab.get('child_tabs', {})
                    if tab_id in child_tabs:
                        parent_properties = parent_tab.get('properties', {})
                        parent_title = parent_properties.get('title', 'Untitled Tab')
                        
                        subtab_info = child_tabs[tab_id]
                        subtab_properties = subtab_info.get('properties', {})
                        subtab_title = subtab_properties.get('title', 'Untitled Subtab')
                        
                        response_parts.extend([
                            f'--- SUBTAB ENCONTRADO: {tab_id} ---',
                            f'Parent Tab: {parent_title} (ID: {parent_id})',
                            f'Subtab Title: {subtab_title}',
                            '',
                            '--- CONTENIDO DE SUBPESTAÑA ---'
                        ])
                        
                        subtab_content = subtab_info.get('content', [])
                        if subtab_content:
                            response_parts.extend(subtab_content)
                        else:
                            response_parts.append('No content found in this subtab.')
                        
                        found_content = True
                        break
            
            # If still not found, show available tabs
            if not found_content:
                response_parts.extend([
                    f'--- PESTAÑA NO ENCONTRADA: {tab_id} ---',
                    '',
                    'Available tabs in this document:'
                ])
                
                for available_tab_id, tab_info in tabs_data.items():
                    tab_properties = tab_info.get('properties', {})
                    tab_title = tab_properties.get('title', 'Untitled Tab')
                    response_parts.append(f'- Tab ID: {available_tab_id} | Title: "{tab_title}" | Index: {tab_properties.get("index", 0)}')
                    
                    child_tabs = tab_info.get('child_tabs', {})
                    if child_tabs:
                        for child_id, child_info in child_tabs.items():
                            child_properties = child_info.get('properties', {})
                            child_title = child_properties.get('title', 'Untitled Child Tab')
                            response_parts.append(f'  - Subtab ID: {child_id} | Title: "{child_title}"')
        
        return '\n'.join(response_parts)
        
    except Exception as e:
        return f"Error reading document tab: {str(e)}"


@server.tool()
@require_google_service("drive", "drive_read")
@handle_http_errors("read_doc_comments")
async def read_doc_comments(
    service,
    user_google_email: str,
    document_id: str,
) -> str:
    """
    Read all comments from a Google Doc.

    Args:
        document_id: The ID of the Google Document

    Returns:
        str: A formatted list of all comments and replies in the document.
    """
    logger.info(f"[read_doc_comments] Reading comments for document {document_id}")

    response = await asyncio.to_thread(
        service.comments().list(
            fileId=document_id,
            fields="comments(id,content,author,createdTime,modifiedTime,resolved,replies(content,author,id,createdTime,modifiedTime))"
        ).execute
    )
    
    comments = response.get('comments', [])
    
    if not comments:
        return f"No comments found in document {document_id}"
    
    output = [f"Found {len(comments)} comments in document {document_id}:\n"]
    
    for comment in comments:
        author = comment.get('author', {}).get('displayName', 'Unknown')
        content = comment.get('content', '')
        created = comment.get('createdTime', '')
        resolved = comment.get('resolved', False)
        comment_id = comment.get('id', '')
        status = " [RESOLVED]" if resolved else ""
        
        output.append(f"Comment ID: {comment_id}")
        output.append(f"Author: {author}")
        output.append(f"Created: {created}{status}")
        output.append(f"Content: {content}")
        
        # Add replies if any
        replies = comment.get('replies', [])
        if replies:
            output.append(f"  Replies ({len(replies)}):")
            for reply in replies:
                reply_author = reply.get('author', {}).get('displayName', 'Unknown')
                reply_content = reply.get('content', '')
                reply_created = reply.get('createdTime', '')
                reply_id = reply.get('id', '')
                output.append(f"    Reply ID: {reply_id}")
                output.append(f"    Author: {reply_author}")
                output.append(f"    Created: {reply_created}")
                output.append(f"    Content: {reply_content}")
        
        output.append("")  # Empty line between comments
    
    return "\n".join(output)


@server.tool()
@require_google_service("drive", "drive_file")
@handle_http_errors("reply_to_comment")
async def reply_to_comment(
    service,
    user_google_email: str,
    document_id: str,
    comment_id: str,
    reply_content: str,
) -> str:
    """
    Reply to a specific comment in a Google Doc.

    Args:
        document_id: The ID of the Google Document
        comment_id: The ID of the comment to reply to
        reply_content: The content of the reply

    Returns:
        str: Confirmation message with reply details.
    """
    logger.info(f"[reply_to_comment] Replying to comment {comment_id} in document {document_id}")

    body = {'content': reply_content}
    
    reply = await asyncio.to_thread(
        service.replies().create(
            fileId=document_id,
            commentId=comment_id,
            body=body,
            fields="id,content,author,createdTime,modifiedTime"
        ).execute
    )
    
    reply_id = reply.get('id', '')
    author = reply.get('author', {}).get('displayName', 'Unknown')
    created = reply.get('createdTime', '')
    
    return f"Reply posted successfully!\nReply ID: {reply_id}\nAuthor: {author}\nCreated: {created}\nContent: {reply_content}"


@server.tool()
@require_multiple_services([
    {"service_type": "docs", "scopes": "docs_write", "param_name": "docs_service"},
    {"service_type": "drive", "scopes": "drive_file", "param_name": "drive_service"}
])
@handle_http_errors("edit_tab_content")
async def edit_tab_content(
    docs_service,
    drive_service,
    user_google_email: str,
    document_id: str,
    tab_identifier: str,
    content_to_add: str,
    position: str = "end",
    parent_tab_id: Optional[str] = None,
    search_by_name: bool = False,
) -> str:
    """
    Edit content directly in a specific tab of a Google document.
    
    Args:
        docs_service: Google Docs service instance
        drive_service: Google Drive service instance
        user_google_email: The user's Google email address
        document_id: The ID of the Google Document
        tab_identifier: Tab ID, subtab ID, tab name, or Google Docs URL with tab parameter
        content_to_add: The content to add to the tab
        position: Where to add the content ("end", "beginning", or "replace")
        parent_tab_id: Optional parent tab ID (required for subtabs)
        search_by_name: If True, searches for tabs/subtabs by name instead of ID
    
    Returns:
        str: Confirmation message with edit details.
    """
    logger.info(f"[edit_tab_content] Editing content in tab {tab_identifier} of document {document_id}")
    
    try:
        # First, get the document to understand its structure
        doc_data = await asyncio.to_thread(
            docs_service.documents().get(
                documentId=document_id,
                includeTabsContent=True
            ).execute
        )
        
        # Extract tab ID from URL if needed
        tab_id = _extract_tab_id_from_url(tab_identifier)
        
        # Find the target tab
        target_tab = None
        tabs = doc_data.get('tabs', [])
        
        if search_by_name:
            # Search by name (case-insensitive partial match)
            for tab in tabs:
                tab_properties = tab.get('tabProperties', {})
                tab_title = tab_properties.get('title', '')
                if tab_identifier.lower() in tab_title.lower():
                    target_tab = tab
                    tab_id = tab_properties.get('tabId')
                    break
                    
                # Check child tabs if this is a parent tab
                child_tabs = tab.get('childTabs', [])
                for child_tab in child_tabs:
                    child_properties = child_tab.get('tabProperties', {})
                    child_title = child_properties.get('title', '')
                    if tab_identifier.lower() in child_title.lower():
                        target_tab = child_tab
                        tab_id = child_properties.get('tabId')
                        break
                if target_tab:
                    break
        else:
            # Search by ID
            for tab in tabs:
                tab_properties = tab.get('tabProperties', {})
                if tab_properties.get('tabId') == tab_id:
                    target_tab = tab
                    break
                    
                # Check child tabs
                child_tabs = tab.get('childTabs', [])
                for child_tab in child_tabs:
                    child_properties = child_tab.get('tabProperties', {})
                    if child_properties.get('tabId') == tab_id:
                        target_tab = child_tab
                        break
                if target_tab:
                    break
        
        if not target_tab:
            available_tabs = []
            for tab in tabs:
                tab_props = tab.get('tabProperties', {})
                tab_title = tab_props.get('title', 'Untitled')
                tab_id_str = tab_props.get('tabId', 'unknown')
                available_tabs.append(f"- {tab_title} (ID: {tab_id_str})")
                
                # Add child tabs
                child_tabs = tab.get('childTabs', [])
                for child_tab in child_tabs:
                    child_props = child_tab.get('tabProperties', {})
                    child_title = child_props.get('title', 'Untitled')
                    child_id = child_props.get('tabId', 'unknown')
                    available_tabs.append(f"  - {child_title} (ID: {child_id}) [subtab]")
            
            return f"Tab '{tab_identifier}' not found in document {document_id}.\n\nAvailable tabs:\n" + "\n".join(available_tabs)
        
        # Get the tab content to find the end position
        tab_content = target_tab.get('documentTab', {}).get('body', {}).get('content', [])
        
        # Find the insertion point based on position
        if position == "end":
            # Use a much more conservative approach for tab insertion
            # Start from a safe position and work backwards
            end_index = 1  # Default safe position
            
            # Find the last paragraph element specifically
            for element in reversed(tab_content):
                if 'paragraph' in element and 'endIndex' in element:
                    # Use a very conservative offset from the paragraph end
                    end_index = max(1, element['endIndex'] - 3)
                    break
            
            # If no paragraph found, try any element with endIndex
            if end_index == 1:
                for element in reversed(tab_content):
                    if 'endIndex' in element and element['endIndex'] > 10:
                        # Use a very safe position well before the end
                        end_index = max(1, element['endIndex'] - 10)
                        break
        elif position == "beginning":
            # Insert at the beginning of the tab content
            end_index = 1
        else:
            return f"Position '{position}' not supported. Use 'end' or 'beginning'."
        
        # Prepare the batch update request
        requests = []
        
        # Add a newline before the content if we're adding at the end and there's existing content
        if position == "end" and end_index > 1:
            content_to_insert = "\n" + content_to_add
        else:
            content_to_insert = content_to_add
        
        # Create the insert text request
        insert_request = {
            'insertText': {
                'location': {
                    'index': end_index,
                    'tabId': tab_id
                },
                'text': content_to_insert
            }
        }
        requests.append(insert_request)
        
        # Execute the batch update
        await asyncio.to_thread(
            docs_service.documents().batchUpdate(
                documentId=document_id,
                body={'requests': requests}
            ).execute
        )
        
        # Clear the document cache to ensure fresh content on next read
        if document_id in _document_cache:
            del _document_cache[document_id]
            logger.info(f"Cleared cache for document {document_id}")
        
        tab_title = target_tab.get('tabProperties', {}).get('title', 'Unknown')
        return f"Successfully added content to tab '{tab_title}' (ID: {tab_id}) at position '{position}' in document {document_id}.\n\nContent added: {content_to_add}"
        
    except HttpError as e:
        error_msg = f"HTTP error while editing tab content: {e}"
        logger.error(error_msg)
        return error_msg
    except Exception as e:
        error_msg = f"Error editing tab content: {str(e)}"
        logger.error(error_msg, exc_info=True)
        return error_msg


@server.tool()
@require_google_service("drive", "drive_file")
@handle_http_errors("create_doc_comment")
async def create_doc_comment(
    service,
    user_google_email: str,
    document_id: str,
    comment_content: str,
) -> str:
    """
    Create a new comment on a Google Doc.

    Args:
        document_id: The ID of the Google Document
        comment_content: The content of the comment

    Returns:
        str: Confirmation message with comment details.
    """
    logger.info(f"[create_doc_comment] Creating comment in document {document_id}")

    body = {"content": comment_content}
    
    comment = await asyncio.to_thread(
        service.comments().create(
            fileId=document_id,
            body=body,
            fields="id,content,author,createdTime,modifiedTime"
        ).execute
    )
    
    comment_id = comment.get('id', '')
    author = comment.get('author', {}).get('displayName', 'Unknown')
    created = comment.get('createdTime', '')
    
    return f"Comment created successfully!\nComment ID: {comment_id}\nAuthor: {author}\nCreated: {created}\nContent: {comment_content}"