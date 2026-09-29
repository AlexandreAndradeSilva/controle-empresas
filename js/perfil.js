import { $, $$, toast, fmtDate, escapeHtml, statusClass, statusLabel, docField, docFieldWithValue, docPillClass,
         digitsToMoneyStr, moneyStrToNumber, applyMoneyMask, copyableField, copyValue,
         colorizeSelectsIn, ativarAnimacaoBarras, formatTempo } from './utils.js';
import { DATA, saveData, currentProfileId, setCurrentProfileId, perfilReturnTo, setPerfilReturnTo } from './state.js';
import { openModal, closeModal, confirmDialog } from './modal.js';
import { DOC_FIELDS, DOC_GROUPS, docGroupsHtml, getImpostosFieldsForCompany, getDeclaracaoFieldsForCompany,
         getObrigacoesFieldsForCompany, getFieldDefault, getDocDefault, docsProgressPercent,
         statusFromProgress, atualizarStatusEData, temImpostosSistemaPraRegime, IMPOSTOS_SISTEMA,
         impostoSistemaAtivoGlobal, REINF_TIPOS, isReinfLabel } from './fields.js';
import { guiaBadgeHtml, bindGuiaButtons } from './guias.js';
import { getResponsaveisArray, getSistemasArray, render } from './companies.js';
import { renderApuracao } from './apuracao.js';
import { renderRelatorio } from './relatorio.js';
import { getGrupoDaEmpresa } from './grupos.js';

/* Ao trocar o status de ICMS/IPI/PIS-COFINS pra "Credor", esconde a data de
   vencimento (e zera ela) e o espaço da guia — crédito não tem prazo nem guia
   pra anexar, só o valor. */
document.addEventListener('change', (e) => {
  if(e.target.matches && e.target.matches('#impostosSection select[data-impkey]')){
    const impKey = e.target.dataset.impkey;
    const row = e.target.closest('.imposto-row');
    if(!row) return;
    const dateInput = row.querySelector(`[data-impvenc="${CSS.escape(impKey)}"]`);
    const guiaSlot = row.children[4];
    if(dateInput){
      dateInput.style.visibility = e.target.value === 'CREDOR' ? 'hidden' : '';
      if(e.target.value === 'CREDOR') dateInput.value = '';
    }
    if(guiaSlot) guiaSlot.style.display = e.target.value === 'CREDOR' ? 'none' : '';
  }
});

export function updateDocsProgressUI(percent){
  const bar = $('#docsProgressBar');
  const label = $('#docsProgressLabel');
  const pill = $('#statusPill');
  if(bar) bar.style.width = percent + '%';
  if(label) label.textContent = percent + '%';
  if(pill){
    const st = statusFromProgress(percent);
    pill.className = 'status-pill ' + statusClass(st);
    pill.textContent = statusLabel(st);
  }
}

export function openPadraoGeralModal(c){
  $('#padraoModalTitle').textContent = 'Padrões da empresa';
  const box = $('#padraoFields');

  const grupos = [
    { key: 'declaracaoPadrao', title: 'DECLARAÇÃO', fields: getDeclaracaoFieldsForCompany(c) },
    { key: 'documentosPadrao', title: 'Apuração', fields: DOC_FIELDS },
    { key: 'impostosPadrao', title: 'Impostos', fields: getImpostosFieldsForCompany(c) },
    { key: 'obrigacoesPadrao', title: 'Obrigações', fields: getObrigacoesFieldsForCompany(c) }
  ].filter(g => g.fields.length);
  // dctfWeb sempre salva no mesmo lugar (declaracaoPadrao), mesmo quando aparece
  // visualmente dentro de Obrigações (Presumido/Real)
  const padraoKeyDoCampo = (k, grupoKey) => k === 'dctfWeb' ? 'declaracaoPadrao' : grupoKey;

  const rowHtml = (padraoKey, p, k, label, options) => `
    <div class="field">
      <label>${label}</label>
      <select data-padraogroup="${padraoKey}" data-padraokey="${k}">
        <option value="">Usar padrão do sistema</option>
        ${options.map(([v,l]) => `<option value="${v}" ${p[k]===v?'selected':''}>${l}</option>`).join('')}
      </select>
    </div>`;

  box.innerHTML = grupos.map(g => {
    const rows = [];
    for(let i=0;i<g.fields.length;i+=g.fields.length>4?2:4){
      const chunk = g.fields.length>4?2:g.fields.length;
      rows.push(`<div class="row${chunk}">${g.fields.slice(i,i+chunk).map(([k,label,opts]) => {
        const pk = padraoKeyDoCampo(k, g.key);
        return rowHtml(pk, c[pk] || {}, k, label, opts);
      }).join('')}</div>`);
    }
    return `<div class="section-title">${g.title}</div>${rows.join('')}`;
  }).join('');

  colorizeSelectsIn(box);
  $('#btnSalvarPadrao').onclick = async () => {
    grupos.forEach(g => {
      const novoPadrao = {};
      $$(`#padraoFields select[data-padraogroup="${g.key}"]`).forEach(sel => {
        if(sel.value) novoPadrao[sel.dataset.padraokey] = sel.value;
      });
      c[g.key] = novoPadrao;
    });
    await saveData();
    closeModal('#modalPadrao');
    toast('Padrões salvos.');
    const editando = estaEditandoApuracao();
    renderDeclaracaoSection(c, editando);
    renderDocsSection(c, editando);
    renderImpostosSection(c, editando);
    renderObrigacoesSection(c, editando);
    renderFatorRSection(c, editando);
    updateDocsProgressUI(docsProgressPercent(c.documentos, c.documentosPadrao, c.declaracao, c.regime, c.obrigacoes, c.fatorR, c.fatorRStatus));
  };
  openModal('#modalPadrao');
}
$('#btnPadraoGeral').addEventListener('click', () => {
  const c = DATA.companies.find(x => x.id === currentProfileId);
  if(c) openPadraoGeralModal(c);
});

export function estaEditandoApuracao(){
  const btn = $('#btnSalvarDocsTop');
  return !!btn && btn.style.display !== 'none';
}
export function renderDocsSection(c, editMode){
  const d = c.documentos || {};
  const box = $('#docsSection');
  if(!editMode){
    box.innerHTML = `
      <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Apuração</span>
      </div>
      ${docGroupsHtml((k, [, label,, def]) => docField(label, d[k]||getDocDefault(c,k,def)))}
    `;
    if($('#btnSalvarDocsTop')) $('#btnSalvarDocsTop').style.display = 'none';
    if($('#btnIniciarTopo')){
      $('#btnIniciarTopo').style.display = 'inline-flex';
      $('#btnIniciarTopo').textContent = c.status === 'CONCLUIDA' ? 'Reiniciar Apuração' : 'Iniciar';
    }
  } else {
    if($('#btnIniciarTopo')) $('#btnIniciarTopo').style.display = 'none';
    if($('#btnSalvarDocsTop')) $('#btnSalvarDocsTop').style.display = 'inline-flex';
    const selectHtml = (k,label,options,def) => {
      const eff = d[k] || getDocDefault(c,k,def);
      return `
      <div class="field">
        <label>${label}</label>
        <select data-dockey="${k}">
          ${options.map(([v,l]) => `<option value="${v}" ${eff===v?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>`;
    };
    box.innerHTML = `
      <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Apuração</span>
      </div>
      ${docGroupsHtml((k, [, label, opts, def]) => selectHtml(k, label, opts, def))}
    `;
    if($('#btnSalvarDocsTop')) $('#btnSalvarDocsTop').style.display = 'inline-flex';
    colorizeSelectsIn(box);
    $$('#docsSection select[data-dockey]').forEach(sel => {
      sel.addEventListener('change', () => {
        const live = { ...d };
        $$('#docsSection select[data-dockey]').forEach(s => { live[s.dataset.dockey] = s.value; });
        const liveDec = { ...(c.declaracao||{}) };
        $$('#declaracaoSection select[data-deckey]').forEach(s => { liveDec[s.dataset.deckey] = s.value; });
        updateDocsProgressUI(docsProgressPercent(live, null, liveDec, c.regime, c.obrigacoes, c.fatorR, c.fatorRStatus));
      });
    });
  }
}

export async function salvarApuracaoDoPerfil(){
  const c = DATA.companies.find(x => x.id === currentProfileId);
  if(!c) return;
  if(!$('#docsSection').querySelector('select[data-dockey]')) return; // não está em modo de edição

  const novo = { ...(c.documentos||{}) };
  $$('#docsSection select[data-dockey]').forEach(sel => { novo[sel.dataset.dockey] = sel.value; });
  c.documentos = novo;

  const novoImp = { ...(c.impostos||{}) };
  $$('#impostosSection select[data-impkey]').forEach(sel => { novoImp[sel.dataset.impkey] = sel.value; });
  c.impostos = novoImp;

  const novoImpV = { ...(c.impostosValores||{}) };
  $$('#impostosSection input[data-impvalue]').forEach(inp => {
    novoImpV[inp.dataset.impvalue] = moneyStrToNumber(inp.value);
  });
  c.impostosValores = novoImpV;

  const novoImpVenc = { ...(c.impostosVencimentos||{}) };
  $$('#impostosSection input[data-impvenc]').forEach(inp => {
    novoImpVenc[inp.dataset.impvenc] = inp.value;
  });
  Object.keys(novoImp).forEach(k => { if(novoImp[k] === 'CREDOR') novoImpVenc[k] = ''; });
  c.impostosVencimentos = novoImpVenc;

  const novoReinfTipos = { ...(c.impostosReinfTipos||{}) };
  $$('#impostosSection input[data-reinftipo]').forEach(inp => {
    const k = inp.dataset.reinftipo;
    novoReinfTipos[k] = novoReinfTipos[k] || {};
    novoReinfTipos[k][inp.dataset.reinftipovalor] = inp.checked;
  });
  c.impostosReinfTipos = novoReinfTipos;

  const novoDec = { ...(c.declaracao||{}) };
  $$('#declaracaoSection select[data-deckey]').forEach(sel => { novoDec[sel.dataset.deckey] = sel.value; });
  $$('#obrigacoesSection select[data-deckey]').forEach(sel => { novoDec[sel.dataset.deckey] = sel.value; });
  c.declaracao = novoDec;

  const novoObrig = { ...(c.obrigacoes||{}) };
  $$('#obrigacoesSection select[data-obrigkey]').forEach(sel => { novoObrig[sel.dataset.obrigkey] = sel.value; });
  c.obrigacoes = novoObrig;

  const fatorRSel = document.querySelector('#fatorRSection select[data-fatorrstatus]');
  if(fatorRSel) c.fatorRStatus = fatorRSel.value;

  const pct = docsProgressPercent(c.documentos, c.documentosPadrao, c.declaracao, c.regime, c.obrigacoes, c.fatorR, c.fatorRStatus);
  atualizarStatusEData(c, pct);

  // ao salvar, finaliza (pausa) o cronômetro da apuração, se estiver rodando
  const estavaRodando = !!c.tempoApuracaoRodando;
  if(estavaRodando){
    c.tempoApuracaoSegundos = tempoApuracaoEfetivo(c);
    c.tempoApuracaoRodando = false;
    c.tempoApuracaoInicio = null;
  }

  await saveData();
  renderDocsSection(c, false);
  renderImpostosSection(c, false);
  renderDeclaracaoSection(c, false);
  renderObrigacoesSection(c, false);
  renderFatorRSection(c, false);
  updateDocsProgressUI(pct);
  renderTimerApuracao(c);
  render();
  toast('Salvo com sucesso!');
}
$('#btnSalvarDocsTop').addEventListener('click', salvarApuracaoDoPerfil);
$('#btnIniciarTopo').addEventListener('click', async () => {
  const c = DATA.companies.find(x => x.id === currentProfileId);
  if(!c) return;
  renderDocsSection(c, true);
  renderImpostosSection(c, true);
  renderDeclaracaoSection(c, true);
  renderObrigacoesSection(c, true);
  renderFatorRSection(c, true);
  if(!c.tempoApuracaoRodando){
    c.tempoApuracaoRodando = true;
    c.tempoApuracaoInicio = new Date().toISOString();
    await saveData();
  }
  renderTimerApuracao(c);
});

export function renderDeclaracaoSection(c, editMode){
  const d = c.declaracao || {};
  const box = $('#declaracaoSection');
  const fields = getDeclaracaoFieldsForCompany(c);
  const gridCls = fields.length === 3 ? 'row3' : 'row2';
  if(!editMode){
    box.innerHTML = `
      <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Declaração</span>
      </div>
      <div class="${gridCls}">${fields.map(([k,label,,def])=>docField(label, d[k]||getFieldDefault(c,'declaracaoPadrao',k,def))).join('')}</div>
    `;
  } else {
    const selectHtml = (k,label,options,def) => {
      const eff = d[k] || getFieldDefault(c,'declaracaoPadrao',k,def);
      return `
      <div class="field">
        <label>${label}</label>
        <select data-deckey="${k}">
          ${options.map(([v,l]) => `<option value="${v}" ${eff===v?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>`;
    };
    box.innerHTML = `
      <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Declaração</span>
      </div>
      <div class="${gridCls}">${fields.map(([k,label,opts,def])=>selectHtml(k,label,opts,def)).join('')}</div>
    `;
    colorizeSelectsIn(box);
    $$('#declaracaoSection select[data-deckey]').forEach(sel => {
      sel.addEventListener('change', () => {
        const liveDoc = { ...(c.documentos||{}) };
        $$('#docsSection select[data-dockey]').forEach(s => { liveDoc[s.dataset.dockey] = s.value; });
        const liveDec = { ...(c.declaracao||{}) };
        $$('#declaracaoSection select[data-deckey]').forEach(s => { liveDec[s.dataset.deckey] = s.value; });
        $$('#obrigacoesSection select[data-deckey]').forEach(s => { liveDec[s.dataset.deckey] = s.value; });
        updateDocsProgressUI(docsProgressPercent(liveDoc, null, liveDec, c.regime, c.obrigacoes, c.fatorR, c.fatorRStatus));
      });
    });
  }
}

export function renderObrigacoesSection(c, editMode){
  const box = $('#obrigacoesSection');
  const fields = getObrigacoesFieldsForCompany(c);
  if(!fields.length){ box.innerHTML = ''; return; }
  const obrig = c.obrigacoes || {};
  const dec = c.declaracao || {};
  const valorAtual = (k, def) => k === 'dctfWeb' ? (dec[k] || getFieldDefault(c,'declaracaoPadrao',k,def)) : (obrig[k] || def);
  const gridCls = fields.length === 2 ? 'row2' : 'row3';
  if(!editMode){
    box.innerHTML = `
      <div class="section-title">Obrigações</div>
      <div class="${gridCls}">${fields.map(([k,label,,def])=>docField(label, valorAtual(k,def))).join('')}</div>
    `;
  } else {
    const selectHtml = (k,label,options,def) => {
      const eff = valorAtual(k,def);
      const dataAttr = k === 'dctfWeb' ? `data-deckey="${k}"` : `data-obrigkey="${k}"`;
      return `
      <div class="field">
        <label>${label}</label>
        <select ${dataAttr}>
          ${options.map(([v,l]) => `<option value="${v}" ${eff===v?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>`;
    };
    box.innerHTML = `
      <div class="section-title">Obrigações</div>
      <div class="${gridCls}">${fields.map(([k,label,opts,def])=>selectHtml(k,label,opts,def)).join('')}</div>
    `;
    colorizeSelectsIn(box);
    $$('#obrigacoesSection select').forEach(sel => {
      sel.addEventListener('change', () => {
        const liveDoc2 = { ...(c.documentos||{}) };
        $$('#docsSection select[data-dockey]').forEach(s => { liveDoc2[s.dataset.dockey] = s.value; });
        const liveDec2 = { ...(c.declaracao||{}) };
        $$('#declaracaoSection select[data-deckey]').forEach(s => { liveDec2[s.dataset.deckey] = s.value; });
        $$('#obrigacoesSection select[data-deckey]').forEach(s => { liveDec2[s.dataset.deckey] = s.value; });
        const liveObrig = { ...(c.obrigacoes||{}) };
        $$('#obrigacoesSection select[data-obrigkey]').forEach(s => { liveObrig[s.dataset.obrigkey] = s.value; });
        updateDocsProgressUI(docsProgressPercent(liveDoc2, null, liveDec2, c.regime, liveObrig, c.fatorR, c.fatorRStatus));
      });
    });
  }
}

export function renderFatorRSection(c, editMode){
  const box = $('#fatorRSection');
  if(!box) return;
  if(c.fatorR !== 'SIM'){ box.innerHTML = ''; return; }
  const valor = c.fatorRStatus || 'PENDENTE';
  if(!editMode){
    box.innerHTML = `
      <div class="section-title">Fator R</div>
      <div class="row2"><div><span class="status-pill ${docPillClass(valor)}">${escapeHtml(valor)}</span></div></div>
    `;
  } else {
    box.innerHTML = `
      <div class="section-title">Fator R</div>
      <div class="row2">
        <div class="field">
          <select data-fatorrstatus>
            <option value="PENDENTE" ${valor==='PENDENTE'?'selected':''}>Pendente</option>
            <option value="CONCLUIDO" ${valor==='CONCLUIDO'?'selected':''}>Concluído</option>
          </select>
        </div>
      </div>
    `;
    colorizeSelectsIn(box);
    $$('#fatorRSection select[data-fatorrstatus]').forEach(sel => {
      sel.addEventListener('change', () => {
        const liveDoc3 = { ...(c.documentos||{}) };
        $$('#docsSection select[data-dockey]').forEach(s => { liveDoc3[s.dataset.dockey] = s.value; });
        const liveDec3 = { ...(c.declaracao||{}) };
        $$('#declaracaoSection select[data-deckey]').forEach(s => { liveDec3[s.dataset.deckey] = s.value; });
        $$('#obrigacoesSection select[data-deckey]').forEach(s => { liveDec3[s.dataset.deckey] = s.value; });
        const liveObrig2 = { ...(c.obrigacoes||{}) };
        $$('#obrigacoesSection select[data-obrigkey]').forEach(s => { liveObrig2[s.dataset.obrigkey] = s.value; });
        updateDocsProgressUI(docsProgressPercent(liveDoc3, null, liveDec3, c.regime, liveObrig2, c.fatorR, sel.value));
      });
    });
  }
}

export function renderImpostosSection(c, editMode){
  const d = c.impostos || {};
  const v = c.impostosValores || {};
  const venc = c.impostosVencimentos || {};
  const reinfTipos = c.impostosReinfTipos || {};
  const fields = getImpostosFieldsForCompany(c);
  const box = $('#impostosSection');
  if(!editMode){
    const rows = fields.map(([k,label,,def]) => {
      const tiposSelecionados = isReinfLabel(label) ? REINF_TIPOS.filter(([tk]) => (reinfTipos[k]||{})[tk]).map(([,tl])=>tl) : [];
      return `
      <div class="imposto-row-view">
        <div>
          <strong style="font-size:.85rem">${escapeHtml(label)}</strong>
          ${venc[k] ? `<div class="small-muted" style="margin-top:2px">Vence em ${fmtDate(venc[k])}</div>` : ''}
          ${tiposSelecionados.length ? `<div class="small-muted" style="margin-top:2px">${tiposSelecionados.join(', ')}</div>` : ''}
        </div>
        <div>${docFieldWithValue('', d[k]||getFieldDefault(c,'impostosPadrao',k,def), v[k])}</div>
        <div style="display:flex;justify-content:flex-end">${guiaBadgeHtml(c,k)}</div>
      </div>`;
    }).join('');
    box.innerHTML = `
      <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Impostos ${temImpostosSistemaPraRegime(c) ? `<button class="btn-icon" id="btnImpostosSistemaEmpresa" title="Ativar/desativar impostos do sistema só para esta empresa" style="width:26px;height:26px;background:var(--bg);color:var(--navy-700);border:1px solid var(--line);border-radius:7px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg></button>` : ''}</span>
      </div>
      ${rows || `<p class="small-muted">Selecione o Regime no cadastro da empresa pra ver os impostos dela aqui.</p>`}
    `;
    bindGuiaButtons(box, c, () => renderImpostosSection(c, false));
    if($('#btnImpostosSistemaEmpresa')) $('#btnImpostosSistemaEmpresa').addEventListener('click', () => openImpostosSistemaEmpresaModal(c, () => renderImpostosSection(c, false)));
  } else {
    const rowHtml = (k,label,options,def) => {
      const eff = d[k] || getFieldDefault(c,'impostosPadrao',k,def);
      const isCredor = eff === 'CREDOR';
      const valorFormatado = v[k] != null ? digitsToMoneyStr(Math.round(v[k]*100).toString()) : '';
      const tiposAtual = reinfTipos[k] || {};
      return `
      <div class="imposto-row">
        <input type="date" data-impvenc="${k}" value="${venc[k]||''}" style="width:100%;border:1px solid var(--line);border-radius:9px;padding:8px 9px;font-size:.82rem;font-family:inherit;background:var(--bg);color:var(--ink);${isCredor?'visibility:hidden':''}">
        <div style="font-weight:700;font-size:.85rem">${escapeHtml(label)}</div>
        <select data-impkey="${k}" style="width:100%">
          ${options.map(([v2,l]) => `<option value="${v2}" ${eff===v2?'selected':''}>${l}</option>`).join('')}
        </select>
        <div style="position:relative">
          <span class="small-muted" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);font-size:.82rem">R$</span>
          <input type="text" inputmode="numeric" data-impvalue="${k}" value="${valorFormatado}" placeholder="0,00" style="width:100%;padding-left:32px">
        </div>
        <div style="display:flex;justify-content:flex-end">${isCredor ? '' : guiaBadgeHtml(c,k)}</div>
        ${isReinfLabel(label) ? `
        <div style="grid-column:1/-1;display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:2px">
          <span class="small-muted" style="font-weight:700;font-size:.7rem">Esse REINF é de:</span>
          ${REINF_TIPOS.map(([tk,tl]) => `
            <label style="display:flex;align-items:center;gap:6px;font-size:.8rem;font-weight:600;cursor:pointer;margin:0">
              <input type="checkbox" data-reinftipo="${k}" data-reinftipovalor="${tk}" ${tiposAtual[tk]?'checked':''} style="width:15px;height:15px;accent-color:var(--navy-700);margin:0">
              ${tl}
            </label>`).join('')}
        </div>` : ''}
      </div>`;
    };
    const rows = fields.map(([k,label,opts,def]) => rowHtml(k,label,opts,def)).join('');
    box.innerHTML = `
      <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Impostos ${temImpostosSistemaPraRegime(c) ? `<button class="btn-icon" id="btnImpostosSistemaEmpresa" title="Ativar/desativar impostos do sistema só para esta empresa" style="width:26px;height:26px;background:var(--bg);color:var(--navy-700);border:1px solid var(--line);border-radius:7px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg></button>` : ''}</span>
      </div>
      <p class="small-muted" style="margin-top:-4px">Ao marcar um imposto como Concluído, você poderá anexar o PDF da guia. Preencha o vencimento pra ele aparecer no Calendário de Vencimentos.</p>
      ${fields.length ? `
      <div class="imposto-header">
        <span>Vencimento</span><span>Imposto</span><span>Status</span><span>Valor</span><span></span>
      </div>` : ''}
      ${rows || `<p class="small-muted">Selecione o Regime no cadastro da empresa pra poder lançar impostos aqui.</p>`}
    `;
    $$('#impostosSection input[data-impvalue]').forEach(applyMoneyMask);
    colorizeSelectsIn(box);
    bindGuiaButtons(box, c, () => renderImpostosSection(c, true));
    if($('#btnImpostosSistemaEmpresa')) $('#btnImpostosSistemaEmpresa').addEventListener('click', () => openImpostosSistemaEmpresaModal(c, () => renderImpostosSection(c, true)));
  }
}

export function openImpostosSistemaEmpresaModal(c, onSaved){
  const box = $('#impostosSistemaEmpresaList');
  const itens = IMPOSTOS_SISTEMA.filter(item => item.regimes.includes(c.regime));
  const override = c.impostosSistemaOverride || {};
  box.innerHTML = itens.map(item => {
    const val = override[item.key] || '';
    const globalAtivo = impostoSistemaAtivoGlobal(item.key);
    return `
    <div class="client-row" style="cursor:default;flex-wrap:wrap;gap:10px">
      <div class="client-main">
        <div style="min-width:0">
          <div class="client-name">${escapeHtml(item.label)}</div>
          <div class="small-muted" style="font-size:.72rem">Padrão do sistema: ${globalAtivo?'Ativo':'Inativo'}</div>
        </div>
      </div>
      <select data-overridekey="${item.key}" style="min-width:200px">
        <option value="" ${val===''?'selected':''}>Seguir padrão do sistema</option>
        <option value="ATIVO" ${val==='ATIVO'?'selected':''}>Ativo só nesta empresa</option>
        <option value="INATIVO" ${val==='INATIVO'?'selected':''}>Inativo só nesta empresa</option>
      </select>
    </div>`;
  }).join('');

  $$('#impostosSistemaEmpresaList select').forEach(sel => sel.addEventListener('change', async () => {
    const key = sel.dataset.overridekey;
    c.impostosSistemaOverride = c.impostosSistemaOverride || {};
    if(sel.value){
      c.impostosSistemaOverride[key] = sel.value;
    } else {
      delete c.impostosSistemaOverride[key];
    }
    const ok = await saveData();
    if(!ok){ toast('Não foi possível salvar — tente novamente.'); return; }
    const item = IMPOSTOS_SISTEMA.find(i => i.key === key);
    toast(`"${item.label}" atualizado só para esta empresa.`);
    if(onSaved) onSaved();
  }));

  openModal('#modalImpostosSistemaEmpresa');
}

let timerApuracaoInterval = null;
export function tempoApuracaoEfetivo(c){
  const acumulado = c.tempoApuracaoSegundos || 0;
  if(c.tempoApuracaoRodando && c.tempoApuracaoInicio){
    const decorrido = (Date.now() - new Date(c.tempoApuracaoInicio).getTime()) / 1000;
    return acumulado + Math.max(0, decorrido);
  }
  return acumulado;
}
export function renderTimerApuracao(c){
  $('#timerApuracaoTexto').textContent = formatTempo(tempoApuracaoEfetivo(c));
  const btn = $('#btnTimerApuracao');
  if(c.tempoApuracaoRodando){
    btn.title = 'Pausar cronômetro da apuração';
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1.1em" height="1.1em" fill="currentColor" class="icon-svg"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>`;
    btn.style.color = '#c22e4c';
  } else {
    btn.title = 'Iniciar cronômetro da apuração';
    btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1.1em" height="1.1em" fill="currentColor" class="icon-svg"><polygon points="6 3 20 12 6 21 6 3"/></svg>`;
    btn.style.color = 'var(--navy-700)';
  }
  if(timerApuracaoInterval){ clearInterval(timerApuracaoInterval); timerApuracaoInterval = null; }
  if(c.tempoApuracaoRodando){
    timerApuracaoInterval = setInterval(() => {
      // se o perfil não estiver mais aberto (fechou o modal), para de atualizar
      if(!$('#modalPerfil').classList.contains('show') || currentProfileId !== c.id){
        clearInterval(timerApuracaoInterval);
        timerApuracaoInterval = null;
        return;
      }
      $('#timerApuracaoTexto').textContent = formatTempo(tempoApuracaoEfetivo(c));
    }, 1000);
  }
}
$('#btnTimerApuracao').addEventListener('click', async (e) => {
  e.stopPropagation();
  const c = DATA.companies.find(x => x.id === currentProfileId);
  if(!c) return;
  if(c.tempoApuracaoRodando){
    // pausa: consolida o tempo decorrido até agora
    c.tempoApuracaoSegundos = tempoApuracaoEfetivo(c);
    c.tempoApuracaoRodando = false;
    c.tempoApuracaoInicio = null;
  } else {
    c.tempoApuracaoRodando = true;
    c.tempoApuracaoInicio = new Date().toISOString();
  }
  await saveData();
  renderTimerApuracao(c);
});

/* ---------------- faixa de sol/lua conforme o horário, no topo do perfil ---------------- */
export function openPerfil(id, startDocsEdit){
  const c = DATA.companies.find(x => x.id === id);
  if(!c) return;
  setCurrentProfileId(id);
  $('#perfilNome').textContent = c.razaoSocial;
  $('#perfilMeta').textContent = [c.municipio, c.uf].filter(Boolean).join('/') || '—';

  $('#perfilBody').innerHTML = `
    ${c.baixada ? `<div class="banner" style="background:#fde3e8;border-color:#f5c2ce;color:#9c2c46;margin-bottom:14px"><span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg" style="vertical-align:-0.15em" ><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg></span><span><strong>Empresa arquivada</strong>${c.dataBaixa?(' em '+fmtDate(c.dataBaixa.slice(0,10))):''}. Motivo: ${escapeHtml(c.motivoBaixa)||'—'}</span></div>` : ''}
    <div class="section-title">Identificação</div>
    <div class="row3">
      <div><span class="small-muted">Nº (código interno)</span><br><strong>${escapeHtml(c.numero)||'—'}</strong></div>
      ${copyableField('CNPJ / CPF', c.cnpj)}
      ${copyableField('IE', c.ie)}
    </div>
    <div class="row3" style="margin-top:10px">
      <div><span class="small-muted">Regime</span><br><strong>${escapeHtml(c.regime)||'—'}</strong></div>
      <div><span class="small-muted">Atividade</span><br><strong>${escapeHtml(c.atividade)||'—'}</strong></div>
      <div><span class="small-muted">Dificuldade</span><br><strong>${escapeHtml(c.dificuldade)||'—'}</strong></div>
    </div>
    ${c.regime === 'SIMPLES NACIONAL' ? `
    <div class="row3" style="margin-top:10px">
      <div><span class="small-muted">Fator R</span><br><strong>${c.fatorR==='SIM'?'Sim':'Não'}</strong></div>
    </div>` : ''}
    ${(() => {
      const grupo = getGrupoDaEmpresa(c);
      if(!grupo) return '';
      return `<div class="row3" style="margin-top:10px">
        <div><span class="small-muted">Pertence ao Grupo</span><br><strong style="color:var(--navy-700)">${escapeHtml(grupo.nome)}</strong></div>
      </div>`;
    })()}
    <div class="section-title">Situação</div>
    <div class="row3">
      <div>
        <span class="small-muted">Status</span><br>
        <span class="status-pill ${statusClass(statusFromProgress(docsProgressPercent(c.documentos, c.documentosPadrao, c.declaracao, c.regime, c.obrigacoes, c.fatorR, c.fatorRStatus)))}" id="statusPill">${statusLabel(statusFromProgress(docsProgressPercent(c.documentos, c.documentosPadrao, c.declaracao, c.regime, c.obrigacoes, c.fatorR, c.fatorRStatus)))}</span>
        <span style="display:inline-flex;align-items:center;gap:6px;margin-left:8px;vertical-align:middle">
          <span style="display:inline-block;width:100px;height:8px;background:var(--line);border-radius:4px;overflow:hidden">
            <span id="docsProgressBar" class="progress-fill" style="display:block;height:100%;width:${docsProgressPercent(c.documentos, c.documentosPadrao, c.declaracao, c.regime, c.obrigacoes, c.fatorR, c.fatorRStatus)}%" data-bar-target="${docsProgressPercent(c.documentos, c.documentosPadrao, c.declaracao, c.regime, c.obrigacoes, c.fatorR, c.fatorRStatus)}%"></span>
          </span>
          <span id="docsProgressLabel" class="small-muted">${docsProgressPercent(c.documentos, c.documentosPadrao, c.declaracao, c.regime, c.obrigacoes, c.fatorR, c.fatorRStatus)}%</span>
        </span>
      </div>
      <div><span class="small-muted">Vencimento/Certificado</span><br><strong>${fmtDate(c.vencimento)}</strong></div>
      <div><span class="small-muted">Observações da empresa</span><br><strong style="font-weight:600;white-space:pre-line">${escapeHtml(c.observacoes)||'—'}</strong></div>
    </div>
    <div class="section-title">Responsável pela empresa</div>
    ${(() => {
      const lista = getResponsaveisArray(c).filter(r => r.nome || r.telefone || r.email || r.outros);
      if(lista.length === 0) return `<div><span class="small-muted">Nome</span><br><strong>—</strong></div>`;
      return lista.map((r, idx) => {
        const items = [
          [`<div><span class="small-muted">Nome</span><br><strong>${escapeHtml(r.nome)||'—'}</strong></div>`, true]
        ];
        if((r.telefone||'').trim()) items.push([copyableField('Telefone', r.telefone), true]);
        if((r.email||'').trim()) items.push([copyableField('E-mail', r.email), true]);
        if((r.outros||'').trim()) items.push([copyableField('Outros', r.outros), true]);
        const cells = items.map(i=>i[0]);
        let out = lista.length > 1 ? `<div class="small-muted" style="font-weight:700;margin-top:${idx>0?'14px':'0'};margin-bottom:6px">Responsável ${idx+1}</div>` : '';
        for(let i=0;i<cells.length;i+=2){
          out += `<div class="row2" ${i>0?'style="margin-top:10px"':''}>${cells[i]}${cells[i+1]||''}</div>`;
        }
        return out;
      }).join('');
    })()}
    ${(() => {
      const s = c.senhas || {};
      function compactBlock(fallbackTitle, obj){
        obj = obj || {};
        const hasNome = (obj.nome||'').trim();
        const hasLogin = (obj.login||'').trim();
        const hasSenha = (obj.senha||'').trim();
        const hasLink = (obj.link||'').trim();
        if(!hasNome && !hasLogin && !hasSenha && !hasLink) return '';
        const title = hasNome ? obj.nome : fallbackTitle;
        const titleHtml = hasLink
          ? `<a href="${escapeHtml(obj.link)}" target="_blank" rel="noopener noreferrer" style="font-size:.78rem;font-weight:700;color:var(--navy-600);text-decoration:underline">${escapeHtml(title)}</a>`
          : `<strong style="font-size:.78rem">${escapeHtml(title)}</strong>`;
        let line = titleHtml;
        if(hasLogin) line += `<br><span class="copy-field" data-copy="${escapeHtml(obj.login)}" data-label="Login" style="cursor:pointer;font-size:.76rem;color:var(--ink)">Login: ${escapeHtml(obj.login)} <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg" style="vertical-align:-0.15em" ><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></span>`;
        if(hasSenha) line += `<br><span style="font-size:.76rem;color:var(--ink);display:inline-flex;align-items:center;gap:5px">Senha: <span class="senha-mask" data-senhareal="${escapeHtml(obj.senha)}" data-mostrando="0" style="font-family:monospace;letter-spacing:1px">••••••••</span><button type="button" class="btn-icon" data-togglesenha style="width:20px;height:20px;padding:0;border:none;background:none;color:var(--muted)" title="Mostrar/ocultar senha"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button><span class="copy-field" data-copy="${escapeHtml(obj.senha)}" data-label="Senha" style="cursor:pointer;display:inline-flex;align-items:center;color:var(--muted)" title="Copiar senha"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg" ><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></span></span>`;
        return `<div style="min-width:150px">${line}</div>`;
      }
      const blocks = [compactBlock('Prefeitura', s.prefeitura), ...getSistemasArray(c).map((sis,idx) => compactBlock(`Sistema ${idx+1}`, sis))].filter(Boolean);
      if(blocks.length === 0) return '';
      return `<div style="margin-top:12px"><span class="small-muted">Senhas</span><div style="margin-top:6px;background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:16px 20px;line-height:1.8;display:flex;flex-wrap:wrap;gap:32px">${blocks.join('')}</div></div>`;
    })()}
    <div id="declaracaoSection" style="margin-top:16px"></div>
    <div id="docsSection" style="margin-top:16px"></div>
    <div id="impostosSection" style="margin-top:16px"></div>
    <div id="obrigacoesSection" style="margin-top:16px"></div>
    <div id="fatorRSection" style="margin-top:16px"></div>
    <div class="section-title">Observações</div>
    <div class="field">
      <textarea id="obsApuracaoInput" rows="3" placeholder="Escreva aqui qualquer observação sobre a apuração desta empresa...">${escapeHtml(c.observacoesApuracao)}</textarea>
    </div>
  `;
  renderDocsSection(c, !!startDocsEdit);
  renderImpostosSection(c, !!startDocsEdit);
  renderDeclaracaoSection(c, !!startDocsEdit);
  renderObrigacoesSection(c, !!startDocsEdit);
  renderFatorRSection(c, !!startDocsEdit);
  $('#obsApuracaoInput').addEventListener('blur', async () => {
    const val = $('#obsApuracaoInput').value.trim();
    if(val === (c.observacoesApuracao||'')) return;
    c.observacoesApuracao = val;
    await saveData();
    toast('Observações salvas.');
  });
  $$('#perfilBody .copy-field[data-copy]').forEach(el => {
    el.addEventListener('click', () => copyValue(el.dataset.copy, el.dataset.label));
  });
  renderTimerApuracao(c);
  ativarAnimacaoBarras($('#perfilBody'));
  openModal('#modalPerfil');
}

$('#btnPrintPerfil').addEventListener('click', () => window.print());
$('#btnPrintEmpresaForm').addEventListener('click', () => window.print());

function pausarTimerApuracaoAoFechar(){
  const c = DATA.companies.find(x => x.id === currentProfileId);
  if(!c || !c.tempoApuracaoRodando) return;
  c.tempoApuracaoSegundos = tempoApuracaoEfetivo(c);
  c.tempoApuracaoRodando = false;
  c.tempoApuracaoInicio = null;
  saveData();
}
$('#modalPerfil').addEventListener('click', (e) => {
  if(e.target.closest('[data-close]') || e.target.closest('#btnVoltarPerfil') || e.target.id === 'modalPerfil'){
    pausarTimerApuracaoAoFechar();
  }
});

$('#btnVoltarPerfil').addEventListener('click', () => {
  closeModal('#modalPerfil');
  if(perfilReturnTo === 'apuracao'){
    renderApuracao();
    openModal('#modalApuracao');
  } else if(perfilReturnTo === 'vencimentos'){
    openModal('#modalVenc');
  } else if(perfilReturnTo === 'relatorio'){
    renderRelatorio();
    openModal('#modalRelatorio');
  }
  setPerfilReturnTo(null);
});
