import { Client } from '@notionhq/client';
import { formatReportText } from './report-format.js';

const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_PARENT_PAGE_ID = process.env.NOTION_PARENT_PAGE_ID
  || '38baec09-f951-81f7-97e8-ee4644723fbb';

const MAX_TEXT = 2000;

/** Formats today's date as JJ/MM/AAAA for the page title. */
function formatPageTitle(date = new Date()) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `Rapport Marché CMC – ${dd}/${mm}/${yyyy}`;
}

/** Splits long text into Notion-safe paragraph chunks (max 2000 chars). */
function textToParagraphBlocks(text) {
  const blocks = [];
  const paragraphs = String(text).split('\n');

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      blocks.push({ object: 'block', type: 'paragraph', paragraph: { rich_text: [] } });
      continue;
    }
    for (let i = 0; i < paragraph.length; i += MAX_TEXT) {
      const chunk = paragraph.slice(i, i + MAX_TEXT);
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ type: 'text', text: { content: chunk } }],
        },
      });
    }
  }
  return blocks;
}

/** Builds Notion block children: heading + full report body. */
function buildPageBlocks(fullText) {
  const bodyBlocks = textToParagraphBlocks(fullText);
  const firstBatch = bodyBlocks.slice(0, 90);
  return [
    {
      object: 'block',
      type: 'heading_1',
      heading_1: {
        rich_text: [{ type: 'text', text: { content: 'CMC Agent Hub — Market Report' } }],
      },
    },
    {
      object: 'block',
      type: 'divider',
      divider: {},
    },
    ...firstBatch,
  ];
}

/**
 * Creates a new sub-page under the configured parent with the full market report.
 * @param {object} reportData - Full `runMarketReport()` payload or `{ report }` object.
 * @returns {Promise<{ ok: boolean, pageId?: string, url?: string, title?: string, error?: string }>}
 */
export async function pushReportToNotion(reportData) {
  if (!NOTION_API_KEY) {
    console.warn('[notion] NOTION_API_KEY missing — skip push');
    return { ok: false, error: 'NOTION_API_KEY not configured' };
  }

  const fullText = formatReportText(reportData);
  const title = formatPageTitle();
  const notion = new Client({ auth: NOTION_API_KEY });

  try {
    const page = await notion.pages.create({
      parent: { page_id: NOTION_PARENT_PAGE_ID },
      properties: {
        title: {
          title: [{ type: 'text', text: { content: title } }],
        },
      },
      children: buildPageBlocks(fullText),
    });

    const pageId = page.id;
    const url = page.url || `https://www.notion.so/${pageId.replace(/-/g, '')}`;

    console.log(`[notion] Report pushed: ${title} → ${url}`);
    return { ok: true, pageId, url, title };
  } catch (err) {
    const message = err?.body?.message || err?.message || String(err);
    console.error('[notion] Push failed:', message);
    return { ok: false, error: message };
  }
}