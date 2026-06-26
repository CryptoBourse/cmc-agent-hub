import { pushReportToNotion } from './notion.js';

const API_KEY = process.env.CMC_API_KEY;

function ensureApiKey() {
  if (!API_KEY) throw new Error('CMC_API_KEY environment variable is not set');
}
const MCP_URL = 'https://mcp.coinmarketcap.com/mcp';
const SKILL_HUB_URL = 'https://mcp.coinmarketcap.com/skill-hub/stream';

const MARKETPLACE_SKILLS = {
  'scan_spot_altcoin_breakout_with_social_confirmation': {
    uniqueName: 'scan_spot_altcoin_breakout_with_social_confirmation',
    label: 'Altcoin Breakout + Social',
    description: 'Spot breakout screener with EMA/volume/MACD/RSI + social confirmation',
    defaultParams: {
      top_n: 5,
      listing_timeframe: '24h',
      ohlcv_timeframe: '4h',
      limit: 100,
      convert: 'USD',
    },
    steps: [
      { id: 1, tool: 'prefetch_listings', label: 'Prefetch Market Listings' },
      { id: 2, tool: 'find_skill', label: 'Find Marketplace Skill' },
      { id: 3, tool: 'execute_skill', label: 'Cloud Breakout Pipeline' },
      { id: 4, tool: 'evidence_pack', label: 'Evidence Pack Output' },
    ],
  },
};

const STEPS = [
  { id: 1, tool: 'get_global_metrics_latest', label: 'Global Market Health', args: {} },
  { id: 2, tool: 'get_crypto_marketcap_technical_analysis', label: 'Market Technical Analysis', args: {} },
  { id: 3, tool: 'get_global_crypto_derivatives_metrics', label: 'Leverage & Derivatives', args: {} },
  { id: 4, tool: 'trending_crypto_narratives', label: 'Trending Narratives', args: {} },
  { id: 5, tool: 'get_upcoming_macro_events', label: 'Upcoming Catalysts', args: {} },
  { id: 6, tool: 'get_crypto_quotes_latest', label: 'BTC & ETH Quotes', args: { id: '1,1027' } },
  { id: 7, tool: 'get_crypto_metrics', label: 'BTC Holder Intelligence', args: { id: '1' } },
  { id: 8, tool: 'get_crypto_technical_analysis', label: 'BTC Technical Depth', args: { id: '1' } },
  { id: 9, tool: 'get_crypto_latest_news', label: 'Market News Feed', args: { id: '1', limit: 5 } },
];

function parseMetricNum(v) {
  if (v == null) return 0;
  return Number(String(v).replace(/[%,+$]/g, '')) || 0;
}

function parseFundingDecimal(v) {
  const n = parseMetricNum(v);
  if (!n) return 0;
  return Math.abs(n) <= 1 ? n : n / 100;
}

function parseLiqMillions(v) {
  if (v == null) return 0;
  const s = String(v).replace(/[$,]/g, '').trim();
  const n = parseFloat(s);
  if (Number.isNaN(n)) return 0;
  if (/B/i.test(s)) return n * 1000;
  if (/M/i.test(s)) return n;
  return n > 1e6 ? n / 1e6 : n;
}

function extractBtcHolderIntel(metrics) {
  const time = metrics?.addressesByHoldingTime || {};
  const supply = metrics?.circulatingSupplyDistribution || {};
  const holdersPct = time.holders?.percentOfAddresses ?? 0;
  const tradersPct = time.traders?.percentOfAddresses ?? 0;
  let holderTrend = 'stable';
  if (tradersPct > 8) holderTrend = 'declining';
  else if (holdersPct > 65) holderTrend = 'growing';

  return {
    btcWhaleConcentration: supply.whales?.percentOfSupply ?? 0,
    btcLtHolderPct: holdersPct,
    btcHolderTrend: holderTrend,
  };
}

function extractBtcTechnicals(ta) {
  const fib = ta?.fibonacciLevels || {};
  const retr = fib.retracementLevels || {};
  const ext = fib.extensionLevels || {};
  return {
    btcMa200: parseMetricNum(ta?.moving_averages?.simple_moving_average_200_day),
    btcSupport: parseMetricNum(fib.swingLow) || parseMetricNum(retr['38.2%']),
    btcResistance: parseMetricNum(fib.swingHigh) || parseMetricNum(ext['127.2%']),
    btcRsi: parseMetricNum(ta?.rsi?.rsi14),
  };
}

function extractBtcNews(news) {
  const headers = news?.headers || [];
  const titleIdx = headers.indexOf('title');
  const urlIdx = headers.indexOf('url');
  return (news?.rows || []).slice(0, 5).map((row) => ({
    title: row[titleIdx >= 0 ? titleIdx : 0],
    url: row[urlIdx >= 0 ? urlIdx : 3],
  }));
}

function parseSse(text) {
  const msgs = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('data:')) {
      const payload = line.slice(5).trim();
      if (payload && payload !== '[DONE]') {
        try { msgs.push(JSON.parse(payload)); } catch { /* skip */ }
      }
    }
  }
  return msgs;
}

async function mcpCall(url, method, params = {}, sessionId) {
  ensureApiKey();
  const headers = {
    'X-CMC-MCP-API-KEY': API_KEY,
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  };
  if (sessionId) headers['mcp-session-id'] = sessionId;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });

  const session = res.headers.get('mcp-session-id') || sessionId;
  const text = await res.text();
  const msgs = parseSse(text);
  const payload = msgs.length ? msgs[msgs.length - 1] : JSON.parse(text);
  return { session, payload };
}

function unwrapSkillHubResponse(payload) {
  if (payload?.error) throw new Error(payload.error.message || JSON.stringify(payload.error));
  const text = payload?.result?.content?.[0]?.text;
  if (!text) throw new Error('Empty skill-hub response');
  const envelope = JSON.parse(text);
  if (envelope?.error) throw new Error(envelope.error.message || JSON.stringify(envelope.error));
  const output = envelope?.result?.output;
  if (typeof output === 'string') {
    const inner = JSON.parse(output);
    const innerResult = inner?.result;
    if (innerResult?.error) throw new Error(innerResult.error.message || JSON.stringify(innerResult.error));
    return innerResult?.data ?? innerResult ?? inner;
  }
  return envelope;
}

async function callTool(session, name, args = {}) {
  const { session: s, payload } = await mcpCall(
    MCP_URL,
    'tools/call',
    { name, arguments: args },
    session,
  );
  if (payload?.error) throw new Error(payload.error.message || JSON.stringify(payload.error));
  const text = payload?.result?.content?.[0]?.text;
  if (!text) throw new Error(`No data from ${name}`);
  return { session: s, data: JSON.parse(text) };
}

function buildReport(results) {
  const g = results.get_global_metrics_latest || {};
  const q = results.get_crypto_quotes_latest || {};
  const ta = results.get_crypto_marketcap_technical_analysis || {};
  const d = results.get_global_crypto_derivatives_metrics || {};
  const n = results.trending_crypto_narratives || {};
  const btcMetrics = results.get_crypto_metrics || {};
  const btcTa = results.get_crypto_technical_analysis || {};
  const btcNewsRaw = results.get_crypto_latest_news || {};
  const btc = q.rows?.[0];
  const eth = q.rows?.[1];
  const fmt = (n) => (n == null ? 'n/a' : typeof n === 'number' ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : n);
  const holderIntel = extractBtcHolderIntel(btcMetrics);
  const btcTechnical = extractBtcTechnicals(btcTa);
  const btcNews = extractBtcNews(btcNewsRaw);
  const fundingRaw = g.leverage?.funding_rate?.average?.current || d.fundingRate?.current;
  const liqRaw = g.leverage?.liquidations?.btc?.total_usd24h || d.btc_liquidations?.total_usd_24h?.total;
  const oiChangeRaw = g.leverage?.open_interest?.total?.percent_change?.['24h'] || d.totalOpenInterest?.percentage_change_24h;

  const narratives = (n.categoryList?.rows || []).slice(0, 5).map((r, i) => ({
    rank: i + 1,
    name: r[3],
    mcap: r[4],
    change24h: r[5],
    change7d: r[6],
  }));

  return {
    snapshot: {
      marketCap: g.market_size?.total_crypto_market_cap_usd?.current,
      change24h: g.market_size?.total_crypto_market_cap_usd?.percent_change?.['24h'],
      change7d: g.market_size?.total_crypto_market_cap_usd?.percent_change?.['7d'],
      fearGreed: g.sentiment?.fear_greed?.current?.index,
      fearLabel: g.sentiment?.fear_greed?.current?.value,
      btcDom: g.dominance?.btc?.current,
      ethDom: g.dominance?.eth?.current,
      altSeason: g.rotation?.altcoin_season?.current?.index,
    },
    anchors: {
      btc: btc ? { price: fmt(btc[4]), change24h: fmt(btc[9]), change7d: fmt(btc[10]) } : null,
      eth: eth ? { price: fmt(eth[4]), change24h: fmt(eth[9]), change7d: fmt(eth[10]) } : null,
    },
    technicals: {
      rsi7: ta.rsi?.rsi7,
      rsi14: ta.rsi?.rsi14,
      macdHist: ta.macd?.histogram,
      pivot: ta.pivotPoint,
    },
    leverage: {
      openInterest: g.leverage?.open_interest?.total?.current || d.totalOpenInterest?.current,
      oiChange24h: g.leverage?.open_interest?.total?.percent_change?.['24h'] || d.totalOpenInterest?.percentage_change_24h,
      funding: g.leverage?.funding_rate?.average?.current || d.fundingRate?.current,
      liq24h: g.leverage?.liquidations?.btc?.total_usd24h || d.btc_liquidations?.total_usd_24h?.total,
      etfBtc: g.trad_fi_flows?.etf_aum?.btc?.current,
    },
    narratives,
    btcNews,
    traderRead: {
      fg: parseMetricNum(g.sentiment?.fear_greed?.current?.index),
      btc24h: parseMetricNum(btc?.[9]),
      oiChange: parseMetricNum(oiChangeRaw),
      fundingRate: parseFundingDecimal(fundingRaw),
      rsi: btcTechnical.btcRsi || parseMetricNum(ta.rsi?.rsi14),
      liq24h: parseLiqMillions(liqRaw),
      btcDominance: parseMetricNum(g.dominance?.btc?.current),
      btcWhaleConcentration: holderIntel.btcWhaleConcentration,
      btcLtHolderPct: holderIntel.btcLtHolderPct,
      btcHolderTrend: holderIntel.btcHolderTrend,
      btcCurrentPrice: parseMetricNum(btc?.[4]),
      btcMa200: btcTechnical.btcMa200,
      btcRsi: btcTechnical.btcRsi,
      btcSupport: btcTechnical.btcSupport,
      btcResistance: btcTechnical.btcResistance,
      btcNews,
    },
    generatedAt: new Date().toISOString(),
  };
}

async function fetchMarketListings(limit = 100) {
  ensureApiKey();
  const capped = Math.min(Math.max(Number(limit) || 100, 100), 100);
  const res = await fetch(
    `https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest?limit=${capped}&convert=USD`,
    { headers: { 'X-CMC_PRO_API_KEY': API_KEY } },
  );
  const json = await res.json();
  if (!json.data?.length) {
    throw new Error(json.status?.error_message || 'Failed to prefetch CMC listings');
  }
  return json.data.map((c) => ({
    name: c.name,
    symbol: c.symbol,
    slug: c.slug,
    cmc_rank: c.cmc_rank,
    tags: c.tags || [],
    quote: {
      USD: {
        market_cap: c.quote?.USD?.market_cap,
        percent_change_24h: c.quote?.USD?.percent_change_24h,
        volume_change_24h: c.quote?.USD?.volume_change_24h,
        volume_24h: c.quote?.USD?.volume_24h,
        price: c.quote?.USD?.price,
      },
    },
  }));
}

export async function runBreakoutScan(params = {}) {
  const skill = MARKETPLACE_SKILLS.scan_spot_altcoin_breakout_with_social_confirmation;
  const steps = [];
  let { session, payload } = await mcpCall(SKILL_HUB_URL, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'cmc-agent-hub', version: '1.0' },
  });
  if (payload?.error) throw new Error(payload.error.message || 'Skill Hub init failed');
  await mcpCall(SKILL_HUB_URL, 'notifications/initialized', {}, session);

  const mergedParams = { ...skill.defaultParams, ...params };
  mergedParams.limit = Math.min(Math.max(Number(mergedParams.limit) || 100, 100), 100);

  const prefetchStarted = Date.now();
  try {
    if (!mergedParams.market_data?.listings?.length) {
      const listings = await fetchMarketListings(mergedParams.limit);
      mergedParams.market_data = { listings };
    }
    steps.push({
      tool: 'prefetch_listings',
      label: 'Prefetch Market Listings',
      status: 'ok',
      durationMs: Date.now() - prefetchStarted,
      preview: `${mergedParams.market_data.listings.length} listings via CMC API`,
    });
  } catch (e) {
    steps.push({
      tool: 'prefetch_listings',
      label: 'Prefetch Market Listings',
      status: 'failed',
      durationMs: Date.now() - prefetchStarted,
      preview: 'FAILED',
      error: e.message,
    });
    throw new Error(`Market data prefetch failed: ${e.message}`);
  }

  const findStarted = Date.now();
  const { session: s1, payload: findPayload } = await mcpCall(
    SKILL_HUB_URL,
    'tools/call',
    { name: 'find_skill', arguments: { query: skill.uniqueName, top_k: 10 } },
    session,
  );
  session = s1;
  const findRaw = JSON.parse(findPayload?.result?.content?.[0]?.text || '{}');
  const candidate = (findRaw.candidates || []).find((c) => c.uniqueName === skill.uniqueName);
  steps.push({
    tool: 'find_skill',
    label: 'Find Marketplace Skill',
    status: 'ok',
    durationMs: Date.now() - findStarted,
    preview: candidate
      ? `Found ${skill.uniqueName}`
      : `Proceeding with registered skill (${(findRaw.candidates || []).length} candidates)`,
  });

  const execStarted = Date.now();
  let evidence = null;
  let execError = null;
  try {
    const { session: s2, payload: execPayload } = await mcpCall(
      SKILL_HUB_URL,
      'tools/call',
      {
        name: 'execute_skill',
        arguments: { unique_name: skill.uniqueName, parameters: mergedParams },
      },
      session,
    );
    session = s2;
    evidence = unwrapSkillHubResponse(execPayload);
    const analyzed = evidence?.report?.analyzed_top || evidence?.analyzed_top || [];
    const preview = analyzed.length
      ? `${analyzed.length} analyzed candidates`
      : (evidence?.summary || 'Scan complete · watchlist state');
    steps.push({
      tool: 'execute_skill',
      label: 'Cloud Breakout Pipeline',
      status: 'ok',
      durationMs: Date.now() - execStarted,
      preview,
    });
    steps.push({
      tool: 'evidence_pack',
      label: 'Evidence Pack Output',
      status: 'ok',
      durationMs: 0,
      preview: evidence?.summary || 'evidence_pack ready',
    });
  } catch (e) {
    execError = e.message;
    steps.push({
      tool: 'execute_skill',
      label: 'Cloud Breakout Pipeline',
      status: 'failed',
      durationMs: Date.now() - execStarted,
      preview: 'FAILED',
      error: execError,
    });
    steps.push({
      tool: 'evidence_pack',
      label: 'Evidence Pack Output',
      status: 'failed',
      durationMs: 0,
      preview: 'No evidence pack',
      error: execError,
    });
  }

  return {
    skill: skill.uniqueName,
    marketplace: 'https://coinmarketcap.com/api/skills-marketplace/',
    agentHub: 'https://coinmarketcap.com/api/agent/',
    skillHub: SKILL_HUB_URL,
    inputSchema: candidate?.inputSchema,
    parameters: mergedParams,
    steps,
    error: execError || undefined,
    report: evidence ? buildBreakoutReport(evidence) : null,
    raw: evidence,
  };
}

function asList(v) {
  if (Array.isArray(v)) return v;
  return v ? [String(v)] : [];
}

function buildBreakoutReport(evidence) {
  const report = evidence?.report || evidence || {};
  const analyzed = (report.analyzed_top || []).map((row, i) => ({
    rank: i + 1,
    name: row.name || row.symbol || row.token || `Candidate ${i + 1}`,
    symbol: row.symbol,
    closeVsEma50: row.close_vs_ema50,
    volumeRatio: row.volume_ratio,
    macdExpansion: row.macd_expansion,
    rsiDelta: row.rsi_delta,
    narrativeStatus: row.narrative_status || report.narrative_status?.[i],
    change24h: row.percent_change_24h || row.change_24h,
  }));
  const backup = (report.backup_candidates || []).map((row, i) => ({
    rank: i + 1,
    name: row.name || row.symbol || `Backup ${i + 1}`,
    symbol: row.symbol,
  }));
  const dq = evidence?.data_quality || {};

  return {
    summary: evidence?.summary,
    bias: evidence?.action_guidance?.bias,
    dataQuality: dq,
    decisionBasis: asList(evidence?.decision_basis || report.decision_basis),
    dataInsights: asList(evidence?.data_insights || report.data_insights),
    confirmationNeeded: asList(
      evidence?.action_guidance?.confirmation_needed
        || report.action_guidance?.confirmation_needed,
    ),
    analyzed,
    backup,
    generatedAt: new Date().toISOString(),
  };
}

export async function runMarketReport() {
  let { session, payload } = await mcpCall(MCP_URL, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'cmc-agent-hub', version: '1.0' },
  });
  if (payload?.error) throw new Error(payload.error.message || 'MCP init failed');
  await mcpCall(MCP_URL, 'notifications/initialized', {}, session);

  const steps = [];
  const results = {};

  for (const step of STEPS) {
    const started = Date.now();
    try {
      const { session: s, data } = await callTool(session, step.tool, step.args);
      session = s;
      results[step.tool] = data;
      steps.push({
        ...step,
        status: 'ok',
        durationMs: Date.now() - started,
        preview: summarize(step.tool, data),
      });
    } catch (e) {
      steps.push({
        ...step,
        status: 'failed',
        durationMs: Date.now() - started,
        error: e.message,
        preview: 'FAILED',
      });
    }
  }

  const result = {
    skill: 'market-report',
    marketplace: 'https://coinmarketcap.com/api/skills-marketplace/',
    agentHub: 'https://coinmarketcap.com/api/agent/',
    steps,
    report: buildReport(results),
    raw: results,
  };

  result.notion = await pushReportToNotion(result);

  return result;
}

function summarize(tool, data) {
  if (tool === 'get_global_metrics_latest') {
    return `Mcap ${data.market_size?.total_crypto_market_cap_usd?.current} · F&G ${data.sentiment?.fear_greed?.current?.index}`;
  }
  if (tool === 'get_crypto_quotes_latest') {
    const btc = data.rows?.[0];
    return btc ? `BTC $${Number(btc[4]).toFixed(0)}` : 'BTC n/a';
  }
  if (tool === 'trending_crypto_narratives') {
    return `${data.categoryList?.rows?.length || 0} narratives`;
  }
  if (tool === 'get_upcoming_macro_events') {
    return `${data.upcomingEventNews?.rows?.length || 0} events`;
  }
  if (tool === 'get_global_crypto_derivatives_metrics') {
    return `OI ${data.totalOpenInterest?.current}`;
  }
  if (tool === 'get_crypto_marketcap_technical_analysis') {
    return `RSI ${data.rsi?.rsi14}`;
  }
  if (tool === 'get_crypto_metrics') {
    const h = data.addressesByHoldingTime?.holders?.percentOfAddresses;
    return h != null ? `LT holders ${Number(h).toFixed(1)}%` : 'BTC metrics';
  }
  if (tool === 'get_crypto_technical_analysis') {
    return `RSI ${data.rsi?.rsi14} · SMA200 ${data.moving_averages?.simple_moving_average_200_day || 'n/a'}`;
  }
  if (tool === 'get_crypto_latest_news') {
    return `${data.rows?.length || 0} BTC headlines`;
  }
  return 'OK';
}

export function getSkillsPayload() {
  return {
    local: [{ id: 'market-report', label: 'Market Report', steps: STEPS.length }],
    marketplace: Object.entries(MARKETPLACE_SKILLS).map(([id, s]) => ({
      id,
      label: s.label,
      description: s.description,
      steps: s.steps.length,
      defaultParams: s.defaultParams,
    })),
  };
}

export async function checkMcpHealth() {
  const started = Date.now();
  let { session, payload } = await mcpCall(MCP_URL, 'initialize', {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'cmc-agent-hub', version: '1.0' },
  });
  if (payload?.error) throw new Error(payload.error.message || 'MCP init failed');
  await mcpCall(MCP_URL, 'notifications/initialized', {}, session);

  const { payload: toolsPayload } = await mcpCall(MCP_URL, 'tools/list', {}, session);
  if (toolsPayload?.error) throw new Error(toolsPayload.error.message || 'tools/list failed');

  const tools = toolsPayload?.result?.tools || [];

  let skillHub = { ok: false, tools: 0 };
  try {
    const hubInit = await mcpCall(SKILL_HUB_URL, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'cmc-agent-hub', version: '1.0' },
    });
    if (!hubInit.payload?.error) {
      await mcpCall(SKILL_HUB_URL, 'notifications/initialized', {}, hubInit.session);
      const hubTools = await mcpCall(SKILL_HUB_URL, 'tools/list', {}, hubInit.session);
      const names = (hubTools.payload?.result?.tools || []).map((t) => t.name);
      skillHub = { ok: names.includes('find_skill'), tools: names.length };
    }
  } catch { /* optional */ }

  return {
    ok: true,
    tools: tools.length || STEPS.length,
    skillHub,
    marketplaceSkills: Object.keys(MARKETPLACE_SKILLS),
    latencyMs: Date.now() - started,
  };
}

export { STEPS, MARKETPLACE_SKILLS };