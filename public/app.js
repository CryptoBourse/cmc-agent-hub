const SKILLS = {
  'market-report': {
    id: 'market-report',
    badge: 'market-report',
    runLabel: 'Run Market Report Skill',
    endpoint: '/api/market-report',
    heroDesc: '9-step CMC pipeline → structured trader briefing for <span class="highlight">#CMCAgentHub</span>.',
    resultsTitle: 'Market Snapshot',
    narrativesTitle: 'Trending Narratives',
    mode: 'market',
    steps: [
      { tool: 'get_global_metrics_latest', label: 'Global Health' },
      { tool: 'get_crypto_marketcap_technical_analysis', label: 'Market TA' },
      { tool: 'get_global_crypto_derivatives_metrics', label: 'Derivatives' },
      { tool: 'trending_crypto_narratives', label: 'Narratives' },
      { tool: 'get_upcoming_macro_events', label: 'Macro Events' },
      { tool: 'get_crypto_quotes_latest', label: 'BTC & ETH' },
      { tool: 'get_crypto_metrics', label: 'BTC Holder Intelligence' },
      { tool: 'get_crypto_technical_analysis', label: 'BTC Technical Depth' },
      { tool: 'get_crypto_latest_news', label: 'Market News Feed' },
    ],
  },
  'scan_spot_altcoin_breakout_with_social_confirmation': {
    id: 'scan_spot_altcoin_breakout_with_social_confirmation',
    badge: 'breakout-scan',
    runLabel: 'Run Breakout Scanner',
    endpoint: '/api/breakout-scan',
    heroDesc: 'Skills Marketplace → spot breakout screener with EMA, volume, MACD, RSI + social confirmation.',
    resultsTitle: 'Breakout Evidence Pack',
    narrativesTitle: 'Analyzed Candidates',
    mode: 'breakout',
    steps: [
      { tool: 'prefetch_listings', label: 'Prefetch Market Listings' },
      { tool: 'find_skill', label: 'Find Marketplace Skill' },
      { tool: 'execute_skill', label: 'Cloud Breakout Pipeline' },
      { tool: 'evidence_pack', label: 'Evidence Pack Output' },
    ],
  },
};

const STEP_BADGE_COLOR = '#5b8cff';
let reportData = {};

function getActiveSkill() {
  const id = $('#skill-select')?.value || 'market-report';
  return SKILLS[id] || SKILLS['market-report'];
}

function getSteps() {
  return getActiveSkill().steps;
}

const $ = (sel) => document.querySelector(sel);

function fmtPct(v) {
  if (v == null || v === 'n/a') return '<span class="mono">n/a</span>';
  const n = Number(String(v).replace(/[%+]/g, ''));
  if (Number.isNaN(n)) return v;
  const cls = n >= 0 ? 'pos' : 'neg';
  const sign = n > 0 ? '+' : '';
  return `<span class="${cls}">${sign}${n.toFixed(2)}%</span>`;
}

function parseNum(s) {
  if (s == null) return 0;
  return Number(String(s).replace(/[%,+$]/g, '')) || 0;
}

function fmtFunding(v) {
  if (v == null || v === '' || v === '—') return '—';
  const n = Number(String(v).replace(/[%,+$]/g, ''));
  if (Number.isNaN(n)) return String(v);
  const pct = Math.abs(n) <= 1 ? n * 100 : n;
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(4)}%`;
}

function stepBadge(i) {
  return String(i + 1).padStart(2, '0');
}

function uniqueNarratives(list) {
  const seen = new Set();
  return (list || []).filter((n) => {
    const key = (n.name || '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function setMcpStatus(state, label) {
  const pill = $('#status-pill');
  pill.dataset.state = state;
  $('#status-label').textContent = label;
}

async function checkMcpHealth() {
  setMcpStatus('checking', 'Checking MCP…');
  try {
    const res = await fetch('/api/health', { method: 'GET' });
    const data = await res.json();
    if (data.ok) {
      const hub = data.skillHub?.ok ? ' · Skill Hub ✓' : '';
      setMcpStatus('connected', `MCP ${data.tools || 6} tools${hub}`);
    } else setMcpStatus('error', 'MCP unreachable');
  } catch {
    setMcpStatus('error', 'MCP connection failed');
  }
}

function applySkillUi() {
  const skill = getActiveSkill();
  $('#skill-badge-name').textContent = skill.badge;
  $('#hero-desc').innerHTML = skill.heroDesc;
  $('#results-title').textContent = skill.resultsTitle;
  $('#narratives-title').textContent = skill.narrativesTitle;
  $('#charts-row').classList.toggle('hidden', skill.mode === 'breakout');
  $('#trader-read-panel')?.classList.toggle('hidden', skill.mode === 'breakout');
  btnRunLabel(skill.runLabel);
  renderSteps();
  renderPipelinePreview();
}

function btnRunLabel(text) {
  const btn = $('#run-btn');
  if (btn) {
    btn.setAttribute('aria-label', text);
    btn.querySelector('.btn-text').textContent = text;
  }
}

function renderPipelinePreview(active = -1, done = [], failed = []) {
  const el = $('#pipeline-preview');
  const steps = getSteps();
  el.innerHTML = steps.map((s, i) => {
    const state = failed.includes(i) ? 'failed' : done.includes(i) ? 'done' : i === active ? 'active' : '';
    const connector = i < steps.length - 1 ? '<span class="preview-connector" aria-hidden="true"></span>' : '';
    return `
      <li class="preview-node ${state}">
        <span class="step-badge mono" style="color:${STEP_BADGE_COLOR}" aria-hidden="true">${stepBadge(i)}</span>
        <span class="preview-label">${s.label}</span>
        <span class="preview-tool mono">${s.tool}</span>
      </li>${connector}`;
  }).join('');
}

function renderSteps(active = -1, done = [], previews = {}, failed = []) {
  const el = $('#steps');
  const steps = getSteps();
  el.innerHTML = steps.map((s, i) => {
    const state = failed.includes(i) ? 'failed' : done.includes(i) ? 'done' : i === active ? 'running' : 'idle';
    const stateLabel = state === 'failed' ? 'FAILED' : state === 'done' ? 'OK' : state === 'running' ? 'Running' : 'Wait';
    return `
      <div class="step ${state}">
        <div class="step-top">
          <span class="step-badge mono" style="color:${STEP_BADGE_COLOR}">${stepBadge(i)}</span>
          <span class="step-state">${stateLabel}</span>
        </div>
        <div class="step-tool">${s.tool}</div>
        <div class="step-preview">${previews[i] || s.label}</div>
      </div>`;
  }).join('');
  renderPipelinePreview(active, done, failed);
}

async function applyStepResults(steps = []) {
  const done = [];
  const failed = [];
  const previews = {};
  const pipeline = getSteps();

  for (let i = 0; i < pipeline.length; i++) {
    renderSteps(i, done, previews, failed);
    try {
      const step = steps[i];
      if (!step) throw new Error('No response');
      if (step.status === 'failed' || step.status === 'error') {
        throw new Error(step.error || 'FAILED');
      }
      previews[i] = step.preview || pipeline[i].label;
      done.push(i);
    } catch (e) {
      failed.push(i);
      previews[i] = e.message || 'FAILED';
    }
    renderSteps(-1, done, previews, failed);
    await new Promise((r) => setTimeout(r, 120));
  }

  return { done, failed, previews };
}

function showSkeletons() {
  $('#results').classList.remove('hidden');
  $('#metrics').innerHTML = Array.from({ length: 4 }, () => `
    <div class="metric-card skeleton-card" aria-hidden="true">
      <div class="skeleton skeleton-line sm"></div>
      <div class="skeleton skeleton-line lg"></div>
      <div class="skeleton skeleton-line md"></div>
    </div>`).join('');
  $('#dominance-chart').innerHTML = '<div class="skeleton skeleton-bars" aria-hidden="true"></div>';
  $('#leverage-chart').innerHTML = '<div class="skeleton skeleton-bars tall" aria-hidden="true"></div>';
  $('#report-list').innerHTML = '<li class="skeleton skeleton-line full" aria-hidden="true"></li>'.repeat(3);
  $('#narratives').innerHTML = Array.from({ length: 3 }, () =>
    '<div class="skeleton skeleton-card narrative" aria-hidden="true"></div>').join('');
  clearSectionErrors();
}

function clearSectionErrors() {
  ['metrics', 'dominance', 'leverage', 'report', 'narratives'].forEach((id) => {
    const el = $(`#err-${id}`);
    if (el) { el.textContent = ''; el.classList.add('hidden'); }
  });
}

function setSectionError(id, msg) {
  const el = $(`#err-${id}`);
  if (el && msg) { el.textContent = msg; el.classList.remove('hidden'); }
}

function drawFearGreedGauge(value, label) {
  const svg = $('#gauge-fng');
  const v = Math.min(100, Math.max(0, parseNum(value)));
  const cx = 100;
  const cy = 100;
  const r = 70;
  const theta = Math.PI * (1 - v / 100);
  const needleX = cx + r * Math.cos(theta);
  const needleY = cy - r * Math.sin(theta);
  const color = v < 25 ? '#ea3943' : v < 45 ? '#f0b90b' : v < 55 ? '#8b9cc0' : v < 75 ? '#9eb6ff' : '#16c784';
  const arcLen = (v / 100) * 220;

  svg.innerHTML = `
    <path d="M 30 100 A 70 70 0 0 1 170 100" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="12" stroke-linecap="round"/>
    <path d="M 30 100 A 70 70 0 0 1 170 100" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round"
      stroke-dasharray="${arcLen} 220"/>
    <line x1="${cx}" y1="${cy}" x2="${needleX}" y2="${needleY}" stroke="${color}" stroke-width="3" stroke-linecap="round"/>
    <circle cx="${cx}" cy="${cy}" r="6" fill="${color}"/>
    <text x="100" y="108" text-anchor="middle" fill="#7d8db5" font-size="9" font-family="IBM Plex Mono">${label || ''}</text>
  `;
  svg.setAttribute('aria-label', `Fear and Greed index ${v}, ${label || ''}`);
  $('#gauge-fng-val').textContent = v;
  $('#gauge-fng-val').style.color = color;
}

function renderDominance(btc, eth) {
  const b = parseNum(btc);
  const e = parseNum(eth);
  const a = Math.max(0, 100 - b - e);
  const el = $('#dominance-chart');
  if (!b && !e) {
    el.innerHTML = '<div class="section-empty compact">Dominance data unavailable.</div>';
    setSectionError('dominance', 'Could not load dominance breakdown.');
    return;
  }
  el.innerHTML = [
    { key: 'btc', label: 'BTC', pct: b },
    { key: 'eth', label: 'ETH', pct: e },
    { key: 'alt', label: 'Alts', pct: a },
  ].map((row) => `
    <div class="bar-row">
      <span class="bar-label">${row.label}</span>
      <div class="bar-track"><div class="bar-fill ${row.key}" style="width:0%" data-w="${row.pct}%"></div></div>
      <span class="bar-pct">${row.pct.toFixed(1)}%</span>
    </div>`).join('');
  requestAnimationFrame(() => {
    el.querySelectorAll('.bar-fill').forEach((bar) => { bar.style.width = bar.dataset.w; });
  });
}

function parseFundingDecimal(v) {
  const n = parseNum(v);
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

function generateTraderRead() {
  const d = reportData;
  const fg = Number(d.fg) || 0;
  const btc24h = Number(d.btc24h) || 0;
  const oiChange = Number(d.oiChange) || 0;
  const fundingRate = Number(d.fundingRate) || 0;
  const rsi = Number(d.rsi) || 0;
  const liq24h = Number(d.liq24h) || 0;
  const btcDominance = Number(d.btcDominance) || 0;
  const btcWhaleConcentration = Number(d.btcWhaleConcentration) || 0;
  const btcLtHolderPct = Number(d.btcLtHolderPct) || 0;
  const btcHolderTrend = d.btcHolderTrend || 'stable';
  const btcCurrentPrice = Number(d.btcCurrentPrice) || 0;
  const btcMa200 = Number(d.btcMa200) || 0;

  let bias;
  if (btc24h > 2 && fg > 50 && oiChange > 0) {
    bias = 'Bullish momentum - les trois piliers confirment la direction';
  } else if (btc24h > 2 && fg < 30) {
    bias = 'Prix haussier mais sentiment en retard - récupération early possible';
  } else if (btc24h < -2 && fg < 25 && fundingRate < 0) {
    bias = 'Pression baissière active - shorts dominants, éviter les longs isolés';
  } else if (btc24h >= -2 && btc24h <= 2) {
    bias = 'Range sans conviction - attendre un trigger directionnel';
  } else {
    bias = 'Signaux mixtes - pas de biais clair';
  }

  let sentiment;
  if (fg < 20) sentiment = 'Extreme Fear - zone d\'accumulation historique, confirmation requise';
  else if (fg < 40) sentiment = 'Fear - territoire d\'accumulation pour les positions long terme';
  else if (fg < 60) sentiment = 'Neutre - aucun excès dans un sens ou dans l\'autre';
  else if (fg < 80) sentiment = 'Greed - réduire l\'exposition, resserrer les stops';
  else sentiment = 'Extreme Greed - zone de distribution, risque de retournement élevé';

  let leverage;
  if (fundingRate < -0.01 && oiChange < -2) {
    leverage = 'Shorts surchargés - risque de short squeeze élevé';
  } else if (fundingRate > 0.05 && oiChange > 2) {
    leverage = 'Longs surexposés - risque de long squeeze, marché fragile';
  } else if (liq24h > 500) {
    leverage = 'Pic de liquidations - volatilité élevée, attendre la stabilisation';
  } else if (Math.abs(fundingRate) < 0.005) {
    leverage = 'Levier neutre - marché non surextendu';
  } else {
    leverage = 'Levier modéré - pas d\'excès extrême détecté';
  }

  let whale;
  if (btcWhaleConcentration > 40) {
    whale = 'Concentration whale élevée - manipulation possible sur les niveaux clés';
  } else if (btcHolderTrend === 'declining') {
    whale = 'Signal de sortie détecté - le smart money réduit son exposition';
  } else if (btcLtHolderPct > 60 && btcHolderTrend === 'growing') {
    whale = 'Accumulation active - les mains fortes absorbent à ces niveaux';
  } else if (btcLtHolderPct > 60) {
    whale = 'Base HODLer solide - pression vendeuse structurellement limitée';
  } else {
    whale = 'Distribution standard - aucun signal extrême détecté';
  }

  let setup;
  let setupColor = 'var(--muted)';
  if (fg < 25 && fundingRate < 0 && rsi < 35 && btcCurrentPrice > btcMa200) {
    setup = 'SETUP LONG HAUTE PROBABILITE - confluence de signaux alignés';
    setupColor = '#16c784';
  } else if (fg > 75 && fundingRate > 0.05 && rsi > 70) {
    setup = 'ZONE DE SUREXTENSION - risque court confirmé, réduire l\'exposition';
    setupColor = '#ea3943';
  } else if (oiChange < -3 && liq24h > 400) {
    setup = 'POST-LIQUIDATION - marché en digestion, rebond technique possible';
    setupColor = '#f7931a';
  } else if (btcDominance > 56) {
    setup = 'BTC Season actif - concentrer le capital sur BTC, éviter les alts';
    setupColor = '#3861fb';
  } else if (btcDominance < 48 && fg > 55) {
    setup = 'Rotation altcoin en cours - sélectivité sur les narratives dominantes';
    setupColor = '#3861fb';
  } else {
    setup = 'Pas de setup propre aujourd\'hui - réduire la taille ou rester flat';
    setupColor = 'var(--muted)';
  }

  $('#tr-bias').textContent = bias;
  $('#tr-sentiment').textContent = sentiment;
  $('#tr-leverage').textContent = leverage;
  $('#tr-whale').textContent = whale;
  const setupEl = $('#tr-setup');
  setupEl.textContent = setup;
  setupEl.style.color = setupColor;
}

function renderLeverage(l) {
  if (!l?.openInterest) {
    $('#leverage-chart').innerHTML = '<div class="section-empty compact">Derivatives data unavailable.</div>';
    setSectionError('leverage', 'Could not load leverage metrics.');
    return;
  }
  $('#leverage-chart').innerHTML = `
    <div class="lev-item"><span>Open Interest</span><span>${l.openInterest}</span></div>
    <div class="lev-item"><span>OI Change 24h</span><span>${l.oiChange24h || '—'}</span></div>
    <div class="lev-item"><span>Funding Rate</span><span>${fmtFunding(l.funding)}</span></div>
    <div class="lev-item"><span>BTC Liq 24h</span><span>${l.liq24h || '—'}</span></div>
    <div class="lev-item"><span>ETF AUM BTC</span><span>${l.etfBtc || '—'}</span></div>
  `;
}

function renderReport(data) {
  clearSectionErrors();
  const r = data.report;
  if (!r) {
    setSectionError('metrics', 'Report payload missing.');
    return;
  }

  const s = r.snapshot || {};
  const a = r.anchors || {};
  const t = r.technicals || {};
  const l = r.leverage || {};

  if (!s.marketCap) setSectionError('metrics', 'Global metrics partially unavailable.');

  const fng = Number(s.fearGreed) || 0;
  const fngClass = fng < 25 ? 'accent-red' : fng < 45 ? 'accent-amber' : 'accent-green';

  $('#metrics').innerHTML = `
    <div class="metric-card">
      <div class="metric-label">Market Cap</div>
      <div class="metric-value">${s.marketCap || '—'}</div>
      <div class="metric-sub">24h ${fmtPct(s.change24h)} · 7d ${fmtPct(s.change7d)}</div>
    </div>
    <div class="metric-card ${fngClass}">
      <div class="metric-label">Fear &amp; Greed</div>
      <div class="metric-value">${s.fearGreed ?? '—'}</div>
      <div class="metric-sub">${s.fearLabel || ''}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">BTC Dominance</div>
      <div class="metric-value">${s.btcDom || '—'}</div>
      <div class="metric-sub">Alt Season: ${s.altSeason ?? '—'}</div>
    </div>
    <div class="metric-card accent-green">
      <div class="metric-label">BTC Price</div>
      <div class="metric-value">$${a.btc?.price || '—'}</div>
      <div class="metric-sub">ETH $${a.eth?.price || '—'} · 24h ${fmtPct(a.btc?.change24h)}</div>
    </div>`;

  if (s.fearGreed != null) drawFearGreedGauge(s.fearGreed, s.fearLabel);
  else $('#gauge-fng-val').textContent = '—';

  renderDominance(s.btcDom, s.ethDom);
  renderLeverage(l);

  const tr = r.traderRead || {};
  reportData = {
    ...tr,
    fundingRate: tr.fundingRate ?? parseFundingDecimal(l.funding),
    liq24h: tr.liq24h ?? parseLiqMillions(l.liq24h),
    oiChange: tr.oiChange ?? parseNum(l.oiChange24h),
    fg: tr.fg ?? parseNum(s.fearGreed),
    btc24h: tr.btc24h ?? parseNum(a.btc?.change24h),
    btcDominance: tr.btcDominance ?? parseNum(s.btcDom),
    rsi: tr.rsi ?? parseNum(tr.btcRsi) ?? parseNum(t.rsi14),
    btcCurrentPrice: tr.btcCurrentPrice ?? parseNum(a.btc?.price),
  };

  const newsHtml = (r.btcNews || []).length
    ? (r.btcNews || []).map((n) => `<a href="${n.url}" target="_blank" rel="noopener">${n.title}</a>`).join(' · ')
    : '—';

  $('#report-list').innerHTML = `
    <li><span class="rlabel">Technicals</span><span>RSI(14): ${t.rsi14 || '—'} · MACD: ${t.macdHist || '—'} · Pivot: ${t.pivot || '—'}</span></li>
    <li><span class="rlabel">BTC Depth</span><span>RSI ${tr.btcRsi ?? '—'} · SMA200 ${tr.btcMa200 ?? '—'} · S ${tr.btcSupport ?? '—'} / R ${tr.btcResistance ?? '—'}</span></li>
    <li><span class="rlabel">Leverage</span><span>OI ${l.openInterest || '—'} (${l.oiChange24h || '—'}) · Funding ${fmtFunding(l.funding)}</span></li>
    <li><span class="rlabel">Liquidations</span><span>BTC 24h: ${l.liq24h || '—'}</span></li>
    <li><span class="rlabel">Holders</span><span>LT ${tr.btcLtHolderPct ?? '—'}% · Whales ${tr.btcWhaleConcentration ?? '—'}% · ${tr.btcHolderTrend || '—'}</span></li>
    <li><span class="rlabel">Institutional</span><span>BTC ETF AUM: ${l.etfBtc || 'n/a'}</span></li>
    <li><span class="rlabel">BTC News</span><span>${newsHtml}</span></li>
  `;

  generateTraderRead();

  if (!r.narratives?.length) {
    $('#narratives').innerHTML = '<div class="section-empty inline">No trending narratives returned.</div>';
    setSectionError('narratives', 'Narrative feed empty for this run.');
  } else {
    const narratives = uniqueNarratives(r.narratives);
    $('#narratives').innerHTML = narratives.map((n, i) => `
      <div class="narrative-card">
        <div class="narrative-rank">#${i + 1}</div>
        <div class="narrative-name">${n.name}</div>
        <div class="narrative-meta">${n.mcap} · 24h ${n.change24h}</div>
      </div>`).join('');
  }

  const ts = new Date(r.generatedAt || Date.now());
  $('#timestamp').textContent = ts.toLocaleString();
  $('#footer-time').textContent = ts.toLocaleTimeString();
  $('#results').classList.remove('hidden');
}

function fmtListHtml(items) {
  if (!items?.length) return '—';
  return `<ul class="inline-list">${items.map((x) => `<li>${x}</li>`).join('')}</ul>`;
}

function renderBreakoutReport(data) {
  clearSectionErrors();
  const r = data.report;
  if (!r) {
    setSectionError('metrics', 'Evidence pack missing.');
    return;
  }

  const analyzed = r.analyzed || [];
  const backup = r.backup || [];
  const dq = r.dataQuality || {};

  $('#metrics').innerHTML = `
    <div class="metric-card">
      <div class="metric-label">Scanned</div>
      <div class="metric-value">${dq.listing_scanned ?? analyzed.length}</div>
      <div class="metric-sub">${dq.listing_passed ?? 0} passed momentum filter</div>
    </div>
    <div class="metric-card accent-amber">
      <div class="metric-label">Analyzed Top</div>
      <div class="metric-value">${analyzed.length}</div>
      <div class="metric-sub">${dq.technical_passed ?? 0} passed technical gate</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Bias</div>
      <div class="metric-value">${r.bias || '—'}</div>
      <div class="metric-sub">${r.summary || 'Breakout scan complete'}</div>
    </div>
    <div class="metric-card accent-green">
      <div class="metric-label">Backup Queue</div>
      <div class="metric-value">${backup.length}</div>
      <div class="metric-sub">Outside top bucket</div>
    </div>`;

  $('#report-list').innerHTML = `
    <li><span class="rlabel">Summary</span><span>${r.summary || '—'}</span></li>
    <li><span class="rlabel">Decision Basis</span><span>${fmtListHtml(r.decisionBasis)}</span></li>
    <li><span class="rlabel">Data Insights</span><span>${fmtListHtml(r.dataInsights)}</span></li>
    <li><span class="rlabel">Confirmation</span><span>${fmtListHtml(r.confirmationNeeded)}</span></li>
    <li><span class="rlabel">Parameters</span><span>top_n ${data.parameters?.top_n ?? '—'} · ${data.parameters?.listing_timeframe}/${data.parameters?.ohlcv_timeframe} · limit ${data.parameters?.limit ?? '—'}</span></li>
  `;

  if (!analyzed.length) {
    $('#narratives').innerHTML = `<div class="section-empty inline">${r.summary || 'No spot altcoin currently clears the full breakout gate set — watchlist state.'}</div>`;
  } else {
    $('#narratives').innerHTML = analyzed.map((n) => `
      <div class="narrative-card">
        <div class="narrative-rank">#${n.rank}</div>
        <div class="narrative-name">${n.name}${n.symbol ? ` (${n.symbol})` : ''}</div>
        <div class="narrative-meta">EMA50 ${n.closeVsEma50 ?? '—'} · Vol ${n.volumeRatio ?? '—'} · MACD ${n.macdExpansion ?? '—'}</div>
        <div class="narrative-meta">RSI Δ ${n.rsiDelta ?? '—'} · ${n.narrativeStatus || 'narrative n/a'}</div>
      </div>`).join('');
  }

  const ts = new Date(r.generatedAt || Date.now());
  $('#timestamp').textContent = ts.toLocaleString();
  $('#footer-time').textContent = ts.toLocaleTimeString();
  $('#results').classList.remove('hidden');
}

async function runSkill() {
  const btn = $('#run-btn');
  const err = $('#error');
  const pipelineStatus = $('#pipeline-status');

  err.classList.add('hidden');
  err.textContent = '';
  btn.disabled = true;
  btn.querySelector('.btn-text').textContent = 'Running Skill…';
  setMcpStatus('running', 'MCP executing…');
  pipelineStatus.textContent = 'Executing…';
  showSkeletons();
  renderSteps(0, [], {}, []);

  const skill = getActiveSkill();

  try {
    const res = await fetch(skill.endpoint, { method: 'POST' });
    const data = await res.json();
    const { failed } = await applyStepResults(data.steps || []);

    if (!res.ok && !data.report && !data.steps?.length) {
      throw new Error(data.error || 'Request failed');
    }

    if (data.report) {
      if (skill.mode === 'breakout') renderBreakoutReport(data);
      else renderReport(data);
      if (!data.error) err.classList.add('hidden');
    } else if (data.error) {
      setSectionError('metrics', data.error);
      $('#results').classList.remove('hidden');
      err.textContent = data.error;
      err.classList.remove('hidden');
    }

    if (failed.length) {
      pipelineStatus.textContent = `Partial · ${failed.length} step(s) failed`;
      setMcpStatus('error', `MCP partial · ${failed.length} failed`);
      err.textContent = `${failed.length} pipeline step(s) failed — partial report shown.`;
      err.classList.remove('hidden');
    } else {
      pipelineStatus.textContent = 'Complete ✓';
      setMcpStatus('connected', 'MCP connected · report ready');
    }
  } catch (e) {
    err.textContent = e.message;
    err.classList.remove('hidden');
    renderSteps();
    renderPipelinePreview();
    pipelineStatus.textContent = 'Error';
    setMcpStatus('error', 'MCP run failed');
    setSectionError('metrics', e.message);
  } finally {
    btn.disabled = false;
    btnRunLabel(getActiveSkill().runLabel);
  }
}

function reportListRow(label) {
  const li = [...document.querySelectorAll('#report-list li')].find((el) => {
    const rlabel = el.querySelector('.rlabel')?.textContent.trim().toLowerCase();
    return rlabel === label.toLowerCase();
  });
  return li?.querySelector('span:last-child')?.textContent.trim() || '—';
}

function metricCardValue(labelMatch) {
  const card = [...document.querySelectorAll('#metrics .metric-card')].find((el) => {
    const lbl = el.querySelector('.metric-label')?.textContent.trim().toLowerCase() || '';
    return lbl.includes(labelMatch.toLowerCase());
  });
  return card?.querySelector('.metric-value')?.textContent.trim() || '—';
}

function metricCardSub(labelMatch) {
  const card = [...document.querySelectorAll('#metrics .metric-card')].find((el) => {
    const lbl = el.querySelector('.metric-label')?.textContent.trim().toLowerCase() || '';
    return lbl.includes(labelMatch.toLowerCase());
  });
  return card?.querySelector('.metric-sub')?.textContent.trim() || '';
}

function formatNarrativesBlock() {
  const cards = [...document.querySelectorAll('#narratives .narrative-card')];
  if (!cards.length) return '';
  const lines = cards.map((card) => {
    const rank = card.querySelector('.narrative-rank')?.textContent.trim() || '';
    const name = card.querySelector('.narrative-name')?.textContent.trim() || '';
    const meta = card.querySelector('.narrative-meta')?.textContent.trim() || '';
    const parts = meta.split('·').map((s) => s.trim());
    const mcap = parts[0] || '—';
    const ch24 = parts[1] || '—';
    return `${rank} ${name} - ${mcap} - ${ch24}`;
  });
  return `TRENDING NARRATIVES:\n${lines.join('\n')}`;
}

async function writeClipboardText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(ta);
    }
  }
}

async function copyReport() {
  const ethSub = metricCardSub('btc price');
  const ethPrice = ethSub.split('·')[0]?.trim().replace(/^ETH\s*/i, '') || '—';
  const fgLabel = metricCardSub('fear');

  const lines = [
    'CMC TRADER TERMINAL - Market Report',
    $('#timestamp')?.textContent.trim() || '—',
    '',
    `MARKET CAP: ${metricCardValue('market cap')}`,
    `FEAR & GREED: ${metricCardValue('fear')} (${fgLabel || '—'})`,
    `BTC DOMINANCE: ${metricCardValue('dominance')}`,
    `BTC PRICE: ${metricCardValue('btc price')}`,
    `ETH PRICE: ${ethPrice}`,
    '',
    reportListRow('Technicals'),
    reportListRow('Leverage'),
    reportListRow('Liquidations'),
    reportListRow('Institutional'),
    '',
    `BIAS: ${$('#tr-bias')?.textContent.trim() || '—'}`,
    `SENTIMENT: ${$('#tr-sentiment')?.textContent.trim() || '—'}`,
    `LEVERAGE SIGNAL: ${$('#tr-leverage')?.textContent.trim() || '—'}`,
    `WHALE: ${$('#tr-whale')?.textContent.trim() || '—'}`,
    `SETUP: ${$('#tr-setup')?.textContent.trim() || '—'}`,
    '',
    formatNarrativesBlock(),
    '',
    'Generated by CMC Agent Hub - market-report Skill + crypto-research Skill',
    '#CMCAgentHub @coinmarketcap',
  ];

  const text = lines.join('\n');

  const btn = $('#copy-report-btn');
  const original = btn?.textContent || '⧉ Copy Report';
  await writeClipboardText(text);
  if (btn) {
    btn.textContent = 'Copied ✓';
    setTimeout(() => { btn.textContent = original; }, 2000);
  }
}

$('#run-btn').addEventListener('click', runSkill);
$('#skill-select').addEventListener('change', applySkillUi);
$('#copy-report-btn')?.addEventListener('click', copyReport);
$('#footer-time').textContent = new Date().toLocaleTimeString();
applySkillUi();
checkMcpHealth();