/* Relatorio: onde o tempo e os impostos concluidos se concentram no mes, a
   proporcao da carteira, o comparativo entre meses ja encerrados e o calendario
   de empresas concluidas por dia. */
import { $, $$, escapeHtml, fmtDate, formatTempo, isoDate, lightenHex, barraTexto,
         ativarAnimacaoBarras, toast, MESES_PT } from './utils.js';
import { DATA, setPerfilReturnTo } from './state.js';
import { openModal, closeModal } from './modal.js';
import { getImpostosFieldsForCompany } from './fields.js';
import { openPerfil, tempoApuracaoEfetivo } from './perfil.js';

const RELATORIO_CORES = ['#20566f','#c99a3d','#2e8f5a','#c1484f','#6a4c93','#2d6c86','#8a6417','#4a7a63','#9c4f6b','#5b6b84'];

function botaoExpandirHtml(key){
  return `<button type="button" class="btn-icon" data-expandirgrafico="${key}" title="Ver em tela cheia" style="width:24px;height:24px;background:none;border:none;color:var(--muted);flex:none"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h6v6"/><path d="M9 21H3v-6"/><path d="M21 3l-7 7"/><path d="M3 21l7-7"/></svg></button>`;
}

const PROPORCAO_ICONS = {
  impostos: '<path d="M9 2H7a2 2 0 0 0-2 2v16l3-2 2 2 2-2 2 2 2-2 3 2V4a2 2 0 0 0-2-2h-2"/><path d="M9 7h6"/><path d="M9 11h6"/><path d="M9 15h4"/>',
  pausa: '<circle cx="12" cy="12" r="10"/><line x1="10" y1="9" x2="10" y2="15"/><line x1="14" y1="9" x2="14" y2="15"/>',
  percent: '<line x1="19" y1="5" x2="5" y2="19"/><circle cx="6.5" cy="6.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>',
  predio: '<rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M8 10h.01"/><path d="M16 10h.01"/><path d="M8 14h.01"/><path d="M16 14h.01"/>'
};
function iconeCategoria(nome, cor){
  return `<span class="chart-cat-icon" style="background:${cor}22;color:${cor}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${PROPORCAO_ICONS[nome]}</svg></span>`;
}

export function construirGraficoProporcaoCarteira(empresas){
  const total = empresas.length;
  if(total === 0){
    return `<div class="form-card"><div class="section-title" style="margin-top:0">Proporção da carteira</div>
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:28px 16px;text-align:center">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--line)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></svg>
        <p class="small-muted" style="margin:0;max-width:260px">Cadastre empresas pra ver esse retrato da carteira.</p>
      </div>
    </div>`;
  }
  const categorias = [
    { label: 'Com impostos', value: empresas.filter(c => getImpostosFieldsForCompany(c).length > 0).length, cor: '#2d6c86', icone: 'impostos' },
    { label: 'Sem movimento', value: empresas.filter(c => c.dificuldade === 'SEM MOVIMENTO').length, cor: '#c1484f', icone: 'pausa' },
    { label: 'Fator R', value: empresas.filter(c => c.fatorR === 'SIM').length, cor: '#c99a3d', icone: 'percent' },
    { label: 'Com ISSQN', value: empresas.filter(c => c.issqnPrest === 'SIM' || c.issqnTomado === 'SIM').length, cor: '#6a4c93', icone: 'predio' },
  ];
  const linhas = categorias.map(cat => {
    const pct = (cat.value / total * 100).toFixed(1);
    return `
    <div style="display:grid;grid-template-columns:170px 1fr auto;align-items:center;gap:12px;margin-bottom:16px">
      <span style="display:flex;align-items:center;gap:8px;font-size:.82rem;font-weight:700;color:var(--ink)">${iconeCategoria(cat.icone, cat.cor)}${cat.label}</span>
      <div class="chart-bar-track">
        <div class="chart-bar" style="height:100%;width:${pct}%;--c1:${lightenHex(cat.cor,0.22)};--c2:${cat.cor}" data-bar-target="${pct}%"></div>
      </div>
      <span class="chart-value-pill" style="background:${cat.cor}1f;color:${cat.cor}">${cat.value} · ${pct}%</span>
    </div>`;
  }).join('');
  return `
    <div class="form-card">
      <div class="section-title" style="margin-top:0;display:flex;justify-content:space-between;align-items:center">Proporção da carteira ${botaoExpandirHtml('proporcao')}</div>
      <p class="small-muted" style="margin-top:-6px">De ${total} ${total===1?'empresa cadastrada':'empresas cadastradas'}, quanto se encaixa em cada característica.</p>
      ${linhas}
    </div>`;
}

export function construirGraficoBarras(titulo, itens, formatarValor, expandKey){
  const max = Math.max(...itens.map(i => i.value), 1);
  const totalGeral = itens.reduce((s,i) => s+i.value, 0) || 1;
  const linhas = itens.map((it, idx) => {
    const largura = (it.value / max * 100).toFixed(1);
    const pct = (it.value / totalGeral * 100).toFixed(1);
    const corHex = idx === 0 ? '#2e8f5a' : '#17435c';
    return `
    <div style="display:grid;grid-template-columns:150px 1fr auto auto;align-items:center;gap:12px;margin-bottom:14px">
      <span style="font-size:.82rem;font-weight:600;color:var(--ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0" title="${escapeHtml(it.label)}">${escapeHtml(it.label)}</span>
      <div class="chart-bar-track" style="height:24px">
        <div class="chart-bar" style="position:relative;height:100%;width:${largura}%;--c1:${lightenHex(corHex,0.2)};--c2:${corHex}" data-bar-target="${largura}%"></div>
        <span style="position:absolute;left:${largura/2}%;top:50%;transform:translate(-50%,-50%);font-size:.68rem;font-weight:800;color:#fff;text-shadow:0 1px 2px rgba(0,0,0,.35);white-space:nowrap;pointer-events:none">${pct}%</span>
      </div>
      <span class="chart-value-pill" style="background:${corHex}1f;color:${corHex}">${formatarValor(it.value)}</span>
      ${it.id ? `<button class="btn btn-outline btn-sm" data-verapuracaorel="${it.id}" style="padding:4px 10px;font-size:.72rem;white-space:nowrap">Ver Apuração</button>` : '<span></span>'}
    </div>`;
  }).join('');
  return `
    <div class="form-card">
      <div class="section-title" style="margin-top:0;display:flex;justify-content:space-between;align-items:center">${titulo}${expandKey?botaoExpandirHtml(expandKey):''}</div>
      ${linhas}
    </div>`;
}

export function construirGraficoPizza(titulo, itens, formatarValor, formatarCentro, expandKey, tamanho){
  tamanho = tamanho || 152;
  const total = itens.reduce((s,i) => s+i.value, 0);
  if(total <= 0){
    return `<div class="form-card"><div class="section-title" style="margin-top:0">${titulo}</div>
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:28px 16px;text-align:center">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--line)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>
        <p class="small-muted" style="margin:0;max-width:260px">Sem dados suficientes ainda.</p>
      </div>
    </div>`;
  }

  const cx = tamanho/2, cy = tamanho/2;
  const strokeWidth = tamanho * 0.24;
  const r = (tamanho/2) - (strokeWidth/2) - 2;
  const circunferencia = 2 * Math.PI * r;

  let acumulado = 0;
  const aneis = itens.map((it, idx) => {
    const cor = RELATORIO_CORES[idx % RELATORIO_CORES.length];
    const fracao = it.value / total;
    const comprimento = fracao * circunferencia;
    const offset = -(acumulado / total) * circunferencia;
    const anguloMeio = ((acumulado + it.value/2) / total) * 2 * Math.PI - Math.PI/2;
    acumulado += it.value;
    const lx = (cx + r * Math.cos(anguloMeio)).toFixed(2);
    const ly = (cy + r * Math.sin(anguloMeio)).toFixed(2);
    const pct = fracao * 100;
    return { cor, comprimento, offset, lx, ly, pct };
  });

  const circulos = aneis.map(s => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.cor}" stroke-width="${strokeWidth}" stroke-dasharray="${s.comprimento.toFixed(2)} ${(circunferencia-s.comprimento).toFixed(2)}" stroke-dashoffset="${s.offset.toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`).join('');
  const fonteLabel = Math.max(10, tamanho * 0.075);
  const labels = aneis.filter(s => s.pct >= 6).map(s => `<text x="${s.lx}" y="${s.ly}" text-anchor="middle" dominant-baseline="central" font-size="${fonteLabel}" font-weight="800" fill="#fff" style="text-shadow:0 1px 2px rgba(0,0,0,.45)">${s.pct.toFixed(0)}%</text>`).join('');
  const donutSvg = `<svg viewBox="0 0 ${tamanho} ${tamanho}" width="${tamanho}" height="${tamanho}" style="filter:drop-shadow(0 6px 14px rgba(20,17,10,.25))">${circulos}${labels}</svg>`;

  const legenda = itens.map((it, idx) => {
    const cor = RELATORIO_CORES[idx % RELATORIO_CORES.length];
    const pct = (it.value/total*100).toFixed(1);
    const nomesTexto = (it.nomes && it.nomes.length) ? it.nomes.join(', ') : '';
    return `
    <div style="padding:9px 0;border-bottom:1px solid var(--line)">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="width:10px;height:10px;border-radius:50%;background:${cor};flex:none;box-shadow:0 0 0 3px ${cor}26"></span>
        <span style="flex:1;font-size:.83rem;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0">${escapeHtml(it.label)}</span>
        <span style="font-size:.8rem;font-weight:800;color:var(--ink);flex:none">${pct}%</span>
        <span class="small-muted" style="font-size:.72rem;flex:none;min-width:70px;text-align:right">${formatarValor(it.value)}</span>
      </div>
      ${nomesTexto ? `<div class="small-muted" style="font-size:.68rem;margin-left:20px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${escapeHtml(nomesTexto)}">${escapeHtml(nomesTexto)}</div>` : ''}
    </div>`;
  }).join('');
  return `
    <div class="form-card">
      <div class="section-title" style="margin-top:0;display:flex;justify-content:space-between;align-items:center">${titulo}${expandKey?botaoExpandirHtml(expandKey):''}</div>
      <div style="display:flex;gap:26px;align-items:center;flex-wrap:wrap">
        <div style="position:relative;width:${tamanho}px;height:${tamanho}px;flex:none">
          ${donutSvg}
          <div style="position:absolute;inset:23%;border-radius:50%;background:var(--card);display:flex;flex-direction:column;align-items:center;justify-content:center;box-shadow:0 2px 6px rgba(20,17,10,.12), inset 0 0 0 1px var(--line);text-align:center;padding:4px">
            <span style="font-size:${Math.max(1,tamanho*0.007)}rem;font-weight:800;color:var(--ink);line-height:1.15">${formatarCentro(total)}</span>
            <span class="small-muted" style="font-size:${Math.max(.6,tamanho*0.004)}rem;font-weight:700;text-transform:uppercase;letter-spacing:.4px">total</span>
          </div>
        </div>
        <div style="flex:1;min-width:200px">${legenda}</div>
      </div>
    </div>`;
}

export function renderRelatorio(){
  const empresas = DATA.companies.filter(c => !c.baixada);

  const porTempo = empresas
    .map(c => ({ label: c.razaoSocial, value: tempoApuracaoEfetivo(c), id: c.id }))
    .filter(it => it.value > 0)
    .sort((a,b) => b.value - a.value);
  const graf1 = porTempo.slice(0,10);
  const outrosTempo = porTempo.slice(10).reduce((s,i)=>s+i.value,0);
  if(outrosTempo > 0) graf1.push({ label: 'Outras empresas', value: outrosTempo });

  const porImpostos = empresas
    .map(c => {
      const fields = getImpostosFieldsForCompany(c);
      const imp = c.impostos || {};
      const concluidosFields = fields.filter(([k]) => imp[k] === 'CONCLUIDO');
      return { label: c.razaoSocial, value: concluidosFields.length, nomes: concluidosFields.map(f => f[1]) };
    })
    .filter(it => it.value > 0)
    .sort((a,b) => b.value - a.value);
  const graf2 = porImpostos.slice(0,8);
  const outrosImp = porImpostos.slice(8).reduce((s,i)=>s+i.value,0);
  if(outrosImp > 0) graf2.push({ label: 'Outras empresas', value: outrosImp });

  $('#relatorioGraficos').innerHTML =
    construirGraficoBarras('Maior tempo de apuração (este mês)', graf1, (v) => formatTempo(v), 'tempo') +
    construirGraficoPizza('Mais impostos concluídos', graf2, (v) => v + (v===1?' imposto':' impostos'), (total) => total, 'impostos');
  ativarAnimacaoBarras($('#relatorioGraficos'));

  $$('#relatorioGraficos [data-verapuracaorel]').forEach(btn => btn.addEventListener('click', () => {
    closeModal('#modalRelatorio');
    setPerfilReturnTo('relatorio');
    openPerfil(btn.dataset.verapuracaorel);
  }));

  $('#relatorioProporcaoCarteira').innerHTML = construirGraficoProporcaoCarteira(empresas);
  ativarAnimacaoBarras($('#relatorioProporcaoCarteira'));

  $('#relatorioComparativo').innerHTML = construirGraficoComparativoMensal();
  ativarAnimacaoBarras($('#relatorioComparativo'));
}

export function exportarRelatorioExcel(){
  const empresas = DATA.companies.filter(c => !c.baixada);
  if(empresas.length === 0){ toast('Não há empresas pra gerar o relatório.'); return; }
  const wb = XLSX.utils.book_new();

  const porTempoTotal = empresas
    .map(c => ({ Empresa: c.razaoSocial, Segundos: tempoApuracaoEfetivo(c) }))
    .filter(it => it.Segundos > 0)
    .sort((a,b) => b.Segundos - a.Segundos);
  const somaTempo = porTempoTotal.reduce((s,i)=>s+i.Segundos,0) || 1;
  const linhasTempo = porTempoTotal.map(it => ({
    'Empresa': it.Empresa,
    'Tempo de apuração': formatTempo(it.Segundos),
    'Gráfico': barraTexto(it.Segundos/somaTempo*100),
    'Segundos': Math.round(it.Segundos)
  }));
  const wsTempo = XLSX.utils.json_to_sheet(linhasTempo.length?linhasTempo:[{'Empresa':'(sem dados)'}]);
  wsTempo['!cols'] = [{wch:30},{wch:14},{wch:26},{wch:10}];
  XLSX.utils.book_append_sheet(wb, wsTempo, 'Tempo de apuração');

  const porImpostosTotal = empresas
    .map(c => {
      const fields = getImpostosFieldsForCompany(c);
      const imp = c.impostos || {};
      const concluidosFields = fields.filter(([k]) => imp[k] === 'CONCLUIDO');
      return { Empresa: c.razaoSocial, Qtd: concluidosFields.length, Nomes: concluidosFields.map(f=>f[1]).join(', ') };
    })
    .filter(it => it.Qtd > 0)
    .sort((a,b) => b.Qtd - a.Qtd);
  const somaImp = porImpostosTotal.reduce((s,i)=>s+i.Qtd,0) || 1;
  const linhasImp = porImpostosTotal.map(it => ({
    'Empresa': it.Empresa,
    'Impostos concluídos': it.Qtd,
    'Gráfico': barraTexto(it.Qtd/somaImp*100),
    'Quais impostos': it.Nomes
  }));
  const wsImp = XLSX.utils.json_to_sheet(linhasImp.length?linhasImp:[{'Empresa':'(sem dados)'}]);
  wsImp['!cols'] = [{wch:30},{wch:16},{wch:26},{wch:40}];
  XLSX.utils.book_append_sheet(wb, wsImp, 'Impostos concluídos');

  const totalCarteira = empresas.length;
  const linhasProporcao = [
    { Característica: 'Com impostos', Quantidade: empresas.filter(c => getImpostosFieldsForCompany(c).length > 0).length },
    { Característica: 'Sem movimento', Quantidade: empresas.filter(c => c.dificuldade === 'SEM MOVIMENTO').length },
    { Característica: 'Fator R', Quantidade: empresas.filter(c => c.fatorR === 'SIM').length },
    { Característica: 'Com ISSQN', Quantidade: empresas.filter(c => c.issqnPrest === 'SIM' || c.issqnTomado === 'SIM').length },
  ].map(l => ({ ...l, 'Gráfico': barraTexto(l.Quantidade/totalCarteira*100), 'Total da carteira': totalCarteira }));
  const wsProp = XLSX.utils.json_to_sheet(linhasProporcao);
  wsProp['!cols'] = [{wch:16},{wch:12},{wch:26},{wch:14}];
  XLSX.utils.book_append_sheet(wb, wsProp, 'Proporção da carteira');

  const semMovList = empresas.filter(c => c.dificuldade === 'SEM MOVIMENTO').map(c => ({ Empresa: c.razaoSocial, Município: c.municipio||'', UF: c.uf||'' }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(semMovList.length?semMovList:[{'Empresa':'(nenhuma empresa sem movimento)'}]), 'Empresas sem movimento');

  const maxHistTempo = Math.max(...((DATA.relatoriosHistorico||[]).map(r => (r.porTempo||[]).reduce((s,i)=>s+i.value,0))), 1);
  const historico = (DATA.relatoriosHistorico||[]).map(r => {
    const tempoTotal = (r.porTempo||[]).reduce((s,i)=>s+i.value,0);
    const impTotal = (r.porImpostos||[]).reduce((s,i)=>s+i.value,0);
    return {
      'Mês': r.label,
      'Encerrado em': fmtDate(r.closedAt.slice(0,10)),
      'Tempo total de apuração': formatTempo(tempoTotal),
      'Gráfico': barraTexto(tempoTotal/maxHistTempo*100),
      'Impostos concluídos (total)': impTotal
    };
  });
  const wsHist = XLSX.utils.json_to_sheet(historico.length?historico:[{'Mês':'(nenhum mês encerrado ainda)'}]);
  wsHist['!cols'] = [{wch:16},{wch:14},{wch:20},{wch:26},{wch:20}];
  XLSX.utils.book_append_sheet(wb, wsHist, 'Comparativo mensal');

  XLSX.writeFile(wb, `relatorio-${new Date().toISOString().slice(0,10)}.xlsx`);
  toast('Excel do relatório gerado, com uma coluna de gráfico em barras de texto em cada aba.');
}
$('#btnRelatorioExportar').addEventListener('click', exportarRelatorioExcel);

export function construirGraficoComparativoMensal(){
  const historico = (DATA.relatoriosHistorico || []).slice(0, 12).slice().reverse();
  if(historico.length === 0){
    return `<div class="form-card"><div class="section-title" style="margin-top:0">Comparativo mês a mês</div>
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:28px 16px;text-align:center">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="var(--line)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
        <p class="small-muted" style="margin:0;max-width:300px">Nenhum mês encerrado ainda — esse gráfico vai se preenchendo conforme você for fechando os meses.</p>
      </div>
    </div>`;
  }
  const dados = historico.map(r => ({
    label: r.label,
    tempo: (r.porTempo||[]).reduce((s,i)=>s+i.value,0),
    impostos: (r.porImpostos||[]).reduce((s,i)=>s+i.value,0)
  }));
  const maxTempo = Math.max(...dados.map(d=>d.tempo), 1);
  const barras = dados.map(d => {
    const alturaPct = (d.tempo / maxTempo * 100).toFixed(1);
    const primeiraPalavra = d.label.split(' ')[0].slice(0,3);
    return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:1;min-width:36px">
      <span class="small-muted" style="font-size:.62rem;font-weight:700;white-space:nowrap">${formatTempo(d.tempo)}</span>
      <div style="width:100%;max-width:34px;height:120px;display:flex;align-items:flex-end;background:var(--bg);border-radius:6px 6px 0 0;overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.05)" title="${escapeHtml(d.label)}: ${formatTempo(d.tempo)} de apuração no total, ${d.impostos} impostos concluídos">
        <div class="chart-bar-v" style="width:100%;height:${alturaPct}%;--c1:${lightenHex('#20566f',0.25)};--c2:#20566f" data-bar-target-h="${alturaPct}%"></div>
      </div>
      <span class="small-muted" style="font-size:.64rem;text-align:center;font-weight:700" title="${escapeHtml(d.label)}">${escapeHtml(primeiraPalavra)}</span>
    </div>`;
  }).join('');
  return `
    <div class="form-card">
      <div class="section-title" style="margin-top:0;display:flex;justify-content:space-between;align-items:center">Comparativo mês a mês ${botaoExpandirHtml('comparativo')}</div>
      <p class="small-muted" style="margin-top:-6px">Tempo total de apuração (soma de todas as empresas) em cada mês encerrado. Passe o mouse pra ver os impostos concluídos também.</p>
      <div style="display:flex;align-items:flex-end;gap:10px;margin-top:12px;overflow-x:auto;padding-bottom:4px">${barras}</div>
    </div>`;
}

let relCalDate = new Date();
export function renderRelatorioCalendario(gridId, labelId){
  gridId = gridId || 'relatorioCalGrid';
  labelId = labelId || 'relCalMesLabel';
  const y = relCalDate.getFullYear();
  const m = relCalDate.getMonth();
  $('#'+labelId).textContent = `${MESES_PT[m]} ${y}`;

  const map = {};
  DATA.companies.filter(c => !c.baixada && c.dataConcluida).forEach(c => {
    const d = new Date(c.dataConcluida);
    const chave = isoDate(d.getFullYear(), d.getMonth(), d.getDate());
    if(!map[chave]) map[chave] = [];
    map[chave].push(c.razaoSocial);
  });

  const firstWeekday = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();
  const cells = [];
  for(let i=firstWeekday; i>0; i--){
    cells.push({ date: new Date(y, m, 1 - i), outside: true });
  }
  for(let d=1; d<=daysInMonth; d++){
    cells.push({ date: new Date(y, m, d), outside: false });
  }
  while(cells.length % 7 !== 0){
    const last = cells[cells.length-1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate()+1), outside: true });
  }

  const hoje = new Date();
  const todayISO = isoDate(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());

  $('#'+gridId).innerHTML = cells.map(cell => {
    const chave = isoDate(cell.date.getFullYear(), cell.date.getMonth(), cell.date.getDate());
    const nomes = map[chave] || [];
    const isToday = chave === todayISO;
    const MAX_VISIVEIS_POR_DIA = 4;
    const visiveis = nomes.slice(0, MAX_VISIVEIS_POR_DIA);
    const restante = nomes.length - visiveis.length;
    const itens = visiveis.map(nome => `<div class="cal-item st-ok" style="cursor:default" title="${escapeHtml(nome)}"><span class="cal-item-text"><span class="cal-item-name">${escapeHtml(nome)}</span></span></div>`).join('')
      + (restante > 0 ? `<div class="small-muted" style="font-size:.64rem;font-weight:700;padding:2px 6px;cursor:default" title="${escapeHtml(nomes.slice(MAX_VISIVEIS_POR_DIA).join(', '))}">+${restante} ${restante===1?'empresa':'empresas'}</div>` : '');
    return `<div class="cal-day ${cell.outside?'outside':''} ${isToday?'today':''}">
      <div class="cal-daynum">${cell.date.getDate()}</div>
      ${itens}
    </div>`;
  }).join('');
}
$('#relCalPrev').addEventListener('click', () => {
  relCalDate = new Date(relCalDate.getFullYear(), relCalDate.getMonth() - 1, 1);
  renderRelatorioCalendario();
  if($('#modalRelatorioExpandido').classList.contains('show') && $('#relatorioCalGridExp')) renderRelatorioCalendario('relatorioCalGridExp','relCalMesLabelExp');
});
$('#relCalNext').addEventListener('click', () => {
  relCalDate = new Date(relCalDate.getFullYear(), relCalDate.getMonth() + 1, 1);
  renderRelatorioCalendario();
  if($('#modalRelatorioExpandido').classList.contains('show') && $('#relatorioCalGridExp')) renderRelatorioCalendario('relatorioCalGridExp','relCalMesLabelExp');
});

function abrirGraficoExpandido(key){
  const empresas = DATA.companies.filter(c => !c.baixada);
  let titulo = '';
  let html = '';

  if(key === 'tempo'){
    titulo = 'Maior tempo de apuração (este mês)';
    const porTempo = empresas
      .map(c => ({ label: c.razaoSocial, value: tempoApuracaoEfetivo(c), id: c.id }))
      .filter(it => it.value > 0)
      .sort((a,b) => b.value - a.value);
    html = construirGraficoBarras('Todas as empresas com tempo registrado', porTempo, (v) => formatTempo(v));
  } else if(key === 'impostos'){
    titulo = 'Mais impostos concluídos';
    const porImpostos = empresas
      .map(c => {
        const fields = getImpostosFieldsForCompany(c);
        const imp = c.impostos || {};
        const concluidosFields = fields.filter(([k]) => imp[k] === 'CONCLUIDO');
        return { label: c.razaoSocial, value: concluidosFields.length, nomes: concluidosFields.map(f => f[1]) };
      })
      .filter(it => it.value > 0)
      .sort((a,b) => b.value - a.value);
    html = construirGraficoPizza('Todas as empresas com impostos concluídos', porImpostos, (v) => v + (v===1?' imposto':' impostos'), (total) => total, null, 280);
  } else if(key === 'proporcao'){
    titulo = 'Proporção da carteira';
    html = construirGraficoProporcaoCarteira(empresas);
  } else if(key === 'comparativo'){
    titulo = 'Comparativo mês a mês';
    html = construirGraficoComparativoMensal();
  } else if(key === 'calendario'){
    titulo = 'Empresas concluídas por dia';
    html = `
      <div class="form-card">
        <div class="section-title" style="margin-top:0;display:flex;justify-content:center;align-items:center;gap:10px">
          <button class="btn-icon" id="relCalPrevExp" title="Mês anterior"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M15 18l-6-6 6-6"/></svg></button>
          <h3 id="relCalMesLabelExp" style="margin:0;font-size:1rem;min-width:160px;text-align:center">Mês</h3>
          <button class="btn-icon" id="relCalNextExp" title="Próximo mês"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M9 18l6-6-6-6"/></svg></button>
        </div>
        <div class="cal-weekdays"><span>Dom</span><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span></div>
        <div class="cal-grid" id="relatorioCalGridExp"></div>
      </div>`;
  }

  $('#relatorioExpandidoTitulo').textContent = titulo;
  $('#relatorioExpandidoBody').innerHTML = html;
  ativarAnimacaoBarras($('#relatorioExpandidoBody'));

  if(key === 'tempo'){
    $$('#relatorioExpandidoBody [data-verapuracaorel]').forEach(btn => btn.addEventListener('click', () => {
      closeModal('#modalRelatorioExpandido');
      closeModal('#modalRelatorio');
      setPerfilReturnTo('relatorio');
      openPerfil(btn.dataset.verapuracaorel);
    }));
  }
  if(key === 'calendario'){
    renderRelatorioCalendario('relatorioCalGridExp', 'relCalMesLabelExp');
    $('#relCalPrevExp').addEventListener('click', () => {
      relCalDate = new Date(relCalDate.getFullYear(), relCalDate.getMonth() - 1, 1);
      renderRelatorioCalendario();
      renderRelatorioCalendario('relatorioCalGridExp', 'relCalMesLabelExp');
    });
    $('#relCalNextExp').addEventListener('click', () => {
      relCalDate = new Date(relCalDate.getFullYear(), relCalDate.getMonth() + 1, 1);
      renderRelatorioCalendario();
      renderRelatorioCalendario('relatorioCalGridExp', 'relCalMesLabelExp');
    });
  }

  openModal('#modalRelatorioExpandido');
}
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-expandirgrafico]');
  if(!btn) return;
  abrirGraficoExpandido(btn.dataset.expandirgrafico);
});

$('#btnRelatorio').addEventListener('click', () => {
  renderRelatorio();
  relCalDate = new Date();
  renderRelatorioCalendario();
  openModal('#modalRelatorio');
});

function renderRelatorioHistoricoLista(){
  const box = $('#relatorioHistoricoLista');
  const lista = DATA.relatoriosHistorico || [];
  if(lista.length === 0){
    box.innerHTML = `<div class="empty">Nenhum mês encerrado ainda.</div>`;
    return;
  }
  box.innerHTML = lista.map((r, idx) => `
    <div class="client-row" data-verrelmes="${idx}">
      <div class="client-main">
        <div style="min-width:0">
          <div class="client-name">${escapeHtml(r.label)}</div>
          <div class="client-meta">Encerrado em ${fmtDate(r.closedAt.slice(0,10))}</div>
        </div>
      </div>
      <button class="btn btn-outline btn-sm" data-verrelmes="${idx}">Ver</button>
    </div>`).join('');
  $$('#relatorioHistoricoLista [data-verrelmes]').forEach(el => el.addEventListener('click', () => {
    abrirRelatorioMesDetalhe(parseInt(el.dataset.verrelmes));
  }));
}

function abrirRelatorioMesDetalhe(idx){
  const r = (DATA.relatoriosHistorico || [])[idx];
  if(!r) return;
  $('#relatorioMesDetalheTitulo').textContent = 'Relatório — ' + r.label;
  $('#relatorioMesDetalheGraficos').innerHTML =
    construirGraficoBarras('Maior tempo de apuração', r.porTempo || [], (v) => formatTempo(v)) +
    construirGraficoPizza('Mais impostos concluídos', r.porImpostos || [], (v) => v + (v===1?' imposto':' impostos'), (total) => total);
  closeModal('#modalRelatorioHistoricoLista');
  openModal('#modalRelatorioMesDetalhe');
}

$('#btnRelatorioHistorico').addEventListener('click', () => {
  renderRelatorioHistoricoLista();
  openModal('#modalRelatorioHistoricoLista');
});
