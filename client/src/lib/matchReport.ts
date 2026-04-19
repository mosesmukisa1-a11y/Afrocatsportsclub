import { AFROCAT_LOGO_BASE64 } from "@/lib/logo-base64";

export function generateMatchReportHTML(data: any): string {
  const fmtEff = (v: number | null) => v !== null && v !== undefined ? `${v}%` : "—";
  const effClass = (v: number | null) => v !== null && v !== undefined ? (v >= 40 ? 'highlight' : v < 20 ? 'error' : '') : '';

  const topPerformersRows = (data.topPerformers || []).map((p: any) =>
    `<tr>
      <td>${p.jerseyNo}</td><td><strong>${p.name}</strong></td><td>${p.position}</td>
      <td class="highlight">${p.pointsTotal >= 0 ? '+' : ''}${p.pointsTotal}</td>
      <td>${p.spikesKill}</td><td>${p.servesAce}</td><td>${p.blocks}</td><td>${p.digs}</td>
      <td>${p.settingAssist}</td><td>${p.receivePerfect ?? 0}</td>
      <td class="${effClass(p.attackEff)}">${fmtEff(p.attackEff)}</td>
      <td class="${p.totalErrors > 3 ? 'error' : ''}">${p.totalErrors ?? 0}</td>
    </tr>`
  ).join("");

  const errorLeadersRows = (data.errorLeaders || []).map((p: any) =>
    `<tr><td>${p.jerseyNo}</td><td>${p.name}</td><td class="error">${p.totalErrors}</td><td>${p.spikesError}</td><td>${p.servesError}</td><td>${p.receiveError}</td><td>${p.settingError}</td></tr>`
  ).join("");

  const allStatsRows = (data.allPlayerStats || []).map((p: any) =>
    `<tr>
      <td>${p.jerseyNo}</td><td><strong>${p.name}</strong></td><td>${p.position}</td>
      <td class="highlight">${p.pointsTotal >= 0 ? '+' : ''}${p.pointsTotal}</td>
      <td>${p.spikesKill}</td><td>${p.servesAce}</td><td>${p.blocks}</td><td>${p.digs}</td>
      <td>${p.settingAssist}</td><td>${p.receivePerfect ?? 0}</td>
      <td class="${effClass(p.attackEff)}">${fmtEff(p.attackEff)}</td>
      <td class="${p.totalErrors > 3 ? 'error' : ''}">${p.totalErrors ?? 0}</td>
    </tr>`
  ).join("");

  const smartFocusRows = (data.smartFocus || []).map((sf: any) =>
    `<tr><td>${sf.playerName}</td><td>${(sf.focusAreas || []).join(", ")}</td></tr>`
  ).join("");

  const resultBadge = data.result
    ? `<span class="result-badge ${data.result === 'W' ? 'win' : 'loss'}">${data.result === 'W' ? 'VICTORY' : 'DEFEAT'} (${data.setsFor || 0} – ${data.setsAgainst || 0})</span>`
    : '<span class="result-badge pending">PENDING</span>';

  const t = data.teamTotals || {};
  const totalErrors = (t.spikesError || 0) + (t.servesError || 0) + (t.receiveError || 0) + (t.settingError || 0);

  const setScoresHtml = (data.setScores || []).length > 0
    ? `<div class="set-scores">${(data.setScores || []).map((s: any) =>
        `<div class="set-card ${s.won ? 'won' : 'lost'}">
          <div class="set-label">Set ${s.setNumber}</div>
          <div class="set-score">${s.home} – ${s.away}</div>
          <div class="set-result">${s.won ? '✓ Won' : '✗ Lost'}</div>
        </div>`
      ).join("")}</div>`
    : "";

  return `<!DOCTYPE html><html><head><title>Match Report - ${data.teamName} vs ${data.opponent}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; max-width: 960px; margin: 0 auto; padding: 28px; color: #1a1a1a; font-size: 12px; }
  .header { text-align: center; margin-bottom: 24px; border-bottom: 4px solid #0d6e6e; padding-bottom: 18px; }
  .header img.logo { width: 72px; height: 72px; object-fit: contain; margin-bottom: 8px; }
  .header h1 { color: #0d6e6e; font-size: 22px; letter-spacing: 2px; margin-bottom: 4px; }
  .header .motto { font-size: 10px; color: #888; letter-spacing: 1px; margin-bottom: 12px; }
  .header h2 { font-size: 16px; color: #333; margin-top: 8px; }
  .match-info { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 20px; background: #f8f9fa; padding: 14px; border-radius: 8px; font-size: 12px; }
  .match-info div strong { color: #0d6e6e; display: inline-block; min-width: 90px; }
  .result-badge { display: inline-block; padding: 6px 18px; border-radius: 20px; font-weight: bold; font-size: 14px; margin-top: 8px; }
  .result-badge.win { background: #d4edda; color: #155724; }
  .result-badge.loss { background: #f8d7da; color: #721c24; }
  .result-badge.pending { background: #fff3cd; color: #856404; }
  .section { margin-bottom: 22px; }
  .section h3 { color: #0d6e6e; font-size: 14px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 2px solid #e0e0e0; text-transform: uppercase; letter-spacing: 0.5px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; }
  th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: center; }
  td:nth-child(2) { text-align: left; }
  th { background: #0d6e6e; color: white; font-size: 10px; text-transform: uppercase; letter-spacing: 0.4px; }
  tr:nth-child(even) { background: #f8f9fa; }
  .highlight { font-weight: bold; color: #0d6e6e; }
  .error { font-weight: bold; color: #dc3545; }
  .totals-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 20px; }
  .total-card { background: #f0faf9; border: 1px solid #b2dfdb; border-radius: 8px; padding: 10px; text-align: center; }
  .total-card .label { font-size: 9px; color: #666; text-transform: uppercase; letter-spacing: 0.4px; }
  .total-card .value { font-size: 20px; font-weight: bold; color: #0d6e6e; margin-top: 2px; }
  .total-card .value.error-val { color: #dc3545; }
  .set-scores { display: flex; gap: 10px; flex-wrap: wrap; margin: 10px 0 18px; }
  .set-card { border: 2px solid #ccc; border-radius: 8px; padding: 10px 14px; text-align: center; min-width: 80px; }
  .set-card.won { border-color: #0d6e6e; background: #f0faf9; }
  .set-card.lost { border-color: #dc3545; background: #fff5f5; }
  .set-label { font-size: 10px; font-weight: bold; text-transform: uppercase; color: #888; }
  .set-score { font-size: 20px; font-weight: 900; color: #1a1a1a; margin: 4px 0; }
  .set-result { font-size: 10px; font-weight: bold; }
  .set-card.won .set-result { color: #0d6e6e; }
  .set-card.lost .set-result { color: #dc3545; }
  .legend { margin-top: 8px; font-size: 10px; color: #777; display: flex; flex-wrap: wrap; gap: 12px; }
  .legend span { white-space: nowrap; }
  .footer { text-align: center; margin-top: 36px; padding-top: 14px; border-top: 2px solid #e0e0e0; font-size: 10px; color: #999; }
  @media print { body { margin: 0; padding: 12px; } .no-print { display: none; } @page { size: A4 landscape; margin: 8mm; } }
</style></head><body>
<div class="header">
  <img src="${AFROCAT_LOGO_BASE64}" alt="Afrocat Logo" class="logo" />
  <h1>${data.clubName || 'AFROCAT VOLLEYBALL CLUB'}</h1>
  <div class="motto">${data.motto || 'One Team One Dream — Passion Discipline Victory'}</div>
  <h2>MATCH REPORT</h2>
</div>

<div class="match-info">
  <div><strong>Team:</strong> ${data.teamName}</div>
  <div><strong>Opponent:</strong> ${data.opponent}</div>
  <div><strong>Date:</strong> ${data.matchDate || '—'}</div>
  <div><strong>Venue:</strong> ${data.venue || '—'}</div>
  <div><strong>Competition:</strong> ${data.competition || '—'}</div>
  <div><strong>Coach:</strong> ${data.coachName || 'N/A'}</div>
</div>

<div style="text-align:center;margin-bottom:20px;">
  ${resultBadge}
</div>

${setScoresHtml ? `<div class="section"><h3>Set-by-Set Scores</h3>${setScoresHtml}</div>` : ''}

<div class="section">
  <h3>Team Totals</h3>
  <div class="totals-grid">
    <div class="total-card"><div class="label">Net Points</div><div class="value">${t.pointsTotal >= 0 ? '+' : ''}${t.pointsTotal || 0}</div></div>
    <div class="total-card"><div class="label">Kills</div><div class="value">${t.spikesKill || 0}</div></div>
    <div class="total-card"><div class="label">Aces</div><div class="value">${t.servesAce || 0}</div></div>
    <div class="total-card"><div class="label">Blocks</div><div class="value">${(t.blocksSolo || 0) + (t.blocksAssist || 0)}</div></div>
    <div class="total-card"><div class="label">Digs</div><div class="value">${t.digs || 0}</div></div>
    <div class="total-card"><div class="label">Assists</div><div class="value">${t.settingAssist || 0}</div></div>
    <div class="total-card"><div class="label">Recv+</div><div class="value">${t.receivePerfect || 0}</div></div>
    <div class="total-card"><div class="label">Atk Eff%</div><div class="value ${t.attackEff !== null && t.attackEff < 20 ? 'error-val' : ''}">${fmtEff(t.attackEff)}</div></div>
    <div class="total-card"><div class="label">Atk Att</div><div class="value">${t.attackAtt || 0}</div></div>
    <div class="total-card"><div class="label">Total Errors</div><div class="value error-val">${totalErrors}</div></div>
  </div>
</div>

<div class="section">
  <h3>Stats Key</h3>
  <div class="legend">
    <span><strong>Net Pts</strong> = Kills + Aces + Block kills − (Attack/Serve/Receive/Setting errors)</span>
    <span><strong>Atk Eff%</strong> = (Kills − Errors) ÷ Total Attacks × 100</span>
    <span><strong>Recv+</strong> = Perfect receptions</span>
  </div>
</div>

<div class="section">
  <h3>Top Performers</h3>
  <table>
    <thead><tr><th>#</th><th>Name</th><th>Pos</th><th>Net Pts</th><th>Kills</th><th>Aces</th><th>Blocks</th><th>Digs</th><th>Assists</th><th>Recv+</th><th>Atk Eff%</th><th>Errors</th></tr></thead>
    <tbody>${topPerformersRows || '<tr><td colspan="12" style="text-align:center;">No data</td></tr>'}</tbody>
  </table>
</div>

<div class="section">
  <h3>Error Analysis</h3>
  <table>
    <thead><tr><th>#</th><th>Name</th><th>Total Errors</th><th>Attack Err</th><th>Serve Err</th><th>Receive Err</th><th>Setting Err</th></tr></thead>
    <tbody>${errorLeadersRows || '<tr><td colspan="7" style="text-align:center;">No data</td></tr>'}</tbody>
  </table>
</div>

${smartFocusRows ? `<div class="section">
  <h3>SmartFocus Training Recommendations</h3>
  <table>
    <thead><tr><th>Player</th><th>Focus Areas</th></tr></thead>
    <tbody>${smartFocusRows}</tbody>
  </table>
</div>` : ''}

<div class="section">
  <h3>Full Player Statistics</h3>
  <table>
    <thead><tr><th>#</th><th>Name</th><th>Pos</th><th>Net Pts</th><th>Kills</th><th>Aces</th><th>Blocks</th><th>Digs</th><th>Assists</th><th>Recv+</th><th>Atk Eff%</th><th>Errors</th></tr></thead>
    <tbody>${allStatsRows || '<tr><td colspan="12" style="text-align:center;">No data</td></tr>'}</tbody>
  </table>
</div>

<div class="footer">
  <p>${data.clubName || 'AFROCAT VOLLEYBALL CLUB'} &mdash; ${data.motto || 'One Team One Dream — Passion Discipline Victory'}</p>
  <p>Generated on ${new Date().toLocaleString()}</p>
</div>
</body></html>`;
}
