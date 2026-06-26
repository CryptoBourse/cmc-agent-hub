/** Server-side Trader Read signals (mirrors public/app.js rules). */
export function computeTraderRead(tr = {}) {
  const fg = Number(tr.fg) || 0;
  const btc24h = Number(tr.btc24h) || 0;
  const oiChange = Number(tr.oiChange) || 0;
  const fundingRate = Number(tr.fundingRate) || 0;
  const rsi = Number(tr.rsi) || 0;
  const liq24h = Number(tr.liq24h) || 0;
  const btcDominance = Number(tr.btcDominance) || 0;
  const btcWhaleConcentration = Number(tr.btcWhaleConcentration) || 0;
  const btcLtHolderPct = Number(tr.btcLtHolderPct) || 0;
  const btcHolderTrend = tr.btcHolderTrend || 'stable';
  const btcCurrentPrice = Number(tr.btcCurrentPrice) || 0;
  const btcMa200 = Number(tr.btcMa200) || 0;

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
  if (fg < 25 && fundingRate < 0 && rsi < 35 && btcCurrentPrice > btcMa200) {
    setup = 'SETUP LONG HAUTE PROBABILITE - confluence de signaux alignés';
  } else if (fg > 75 && fundingRate > 0.05 && rsi > 70) {
    setup = 'ZONE DE SUREXTENSION - risque court confirmé, réduire l\'exposition';
  } else if (oiChange < -3 && liq24h > 400) {
    setup = 'POST-LIQUIDATION - marché en digestion, rebond technique possible';
  } else if (btcDominance > 56) {
    setup = 'BTC Season actif - concentrer le capital sur BTC, éviter les alts';
  } else if (btcDominance < 48 && fg > 55) {
    setup = 'Rotation altcoin en cours - sélectivité sur les narratives dominantes';
  } else {
    setup = 'Pas de setup propre aujourd\'hui - réduire la taille ou rester flat';
  }

  return { bias, sentiment, leverage, whale, setup };
}