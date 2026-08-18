import { $, $$, toast, fmtDate, escapeHtml, statusClass, statusLabel, docField, docFieldWithValue, digitsToMoneyStr, moneyStrToNumber, applyMoneyMask, copyableField, copyValue, colorizeSelectsIn } from './utils.js';
import { DATA, saveData, setCurrentProfileId, perfilReturnTo, setPerfilReturnTo } from './state.js';
import { openModal, closeModal } from './modal.js';
import { DOC_FIELDS, DECLARACAO_FIELDS, getImpostosFieldsForCompany, getFieldDefault, getDocDefault, docsProgressPercent, statusFromProgress } from './fields.js';
import { guiaBadgeHtml, bindGuiaButtons } from './guias.js';
import { render } from './companies.js';
import { renderApuracao } from './apuracao.js';

function updateDocsProgressUI(percent){
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

function openPadraoModal(c, fields, padraoKey, title, onSaved){
  fields = fields || DOC_FIELDS;
  padraoKey = padraoKey || 'documentosPadrao';
  $('#padraoModalTitle').textContent = title || 'Padrão da Apuração';
  const p = c[padraoKey] || {};
  const box = $('#padraoFields');
  const rowHtml = (k,label,options) => `
    <div class="field">
      <label>${label}</label>
      <select data-padraokey="${k}">
        <option value="">Usar padrão do sistema</option>
        ${options.map(([v,l]) => `<option value="${v}" ${p[k]===v?'selected':''}>${l}</option>`).join('')}
      </select>
    </div>`;
  const rows = [];
  for(let i=0;i<fields.length;i+=fields.length>4?2:4){
    rows.push(`<div class="row${fields.length>4?2:fields.length}">${fields.slice(i,i+(fields.length>4?2:fields.length)).map(([k,label,opts])=>rowHtml(k,label,opts)).join('')}</div>`);
  }
  box.innerHTML = rows.join('');
  colorizeSelectsIn(box);
  $('#btnSalvarPadrao').onclick = async () => {
    const novoPadrao = {};
    $$('#padraoFields select[data-padraokey]').forEach(sel => {
      if(sel.value) novoPadrao[sel.dataset.padraokey] = sel.value;
    });
    c[padraoKey] = novoPadrao;
    await saveData();
    closeModal('#modalPadrao');
    toast('Padrão salvo.');
    if(onSaved) onSaved();
  };
  openModal('#modalPadrao');
}

function renderDocsSection(c, editMode){
  const d = c.documentos || {};
  const box = $('#docsSection');
  if(!editMode){
    box.innerHTML = `
      <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Apuração <button class="btn-icon" id="btnPadraoApuracao" title="Definir padrão do mês" style="width:26px;height:26px;background:var(--bg);color:var(--navy-700);border:1px solid var(--line);border-radius:7px;font-size:.8rem"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg" style="vertical-align:-0.15em" ><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg></button></span>
        <button class="btn btn-primary btn-sm" id="btnIniciarDocs">Iniciar</button>
      </div>
      <div class="row4">${DOC_FIELDS.slice(0,4).map(([k,label,,def])=>docField(label, d[k]||getDocDefault(c,k,def))).join('')}</div>
      <div class="row4" style="margin-top:10px">${DOC_FIELDS.slice(4,8).map(([k,label,,def])=>docField(label, d[k]||getDocDefault(c,k,def))).join('')}</div>
    `;
    $('#btnIniciarDocs').addEventListener('click', () => {
      renderDocsSection(c, true);
      renderImpostosSection(c, true);
      renderDeclaracaoSection(c, true);
    });
    $('#btnPadraoApuracao').addEventListener('click', () => openPadraoModal(c, DOC_FIELDS, 'documentosPadrao', 'Padrão da Apuração', () => { renderDocsSection(c, false); updateDocsProgressUI(docsProgressPercent(c.documentos, c.documentosPadrao, c.declaracao)); }));
  } else {
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
        <span>Apuração <button class="btn-icon" id="btnPadraoApuracao" title="Definir padrão do mês" style="width:26px;height:26px;background:var(--bg);color:var(--navy-700);border:1px solid var(--line);border-radius:7px;font-size:.8rem"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg" style="vertical-align:-0.15em" ><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg></button></span>
        <button class="btn btn-primary btn-sm" id="btnSalvarDocs">Salvar</button>
      </div>
      <div class="row4">${DOC_FIELDS.slice(0,4).map(([k,label,opts,def])=>selectHtml(k,label,opts,def)).join('')}</div>
      <div class="row4">${DOC_FIELDS.slice(4,8).map(([k,label,opts,def])=>selectHtml(k,label,opts,def)).join('')}</div>
    `;
    $('#btnPadraoApuracao').addEventListener('click', () => openPadraoModal(c, DOC_FIELDS, 'documentosPadrao', 'Padrão da Apuração', () => { renderDocsSection(c, false); updateDocsProgressUI(docsProgressPercent(c.documentos, c.documentosPadrao, c.declaracao)); }));
    colorizeSelectsIn(box);
    $('#btnSalvarDocs').addEventListener('click', async () => {
      const novo = { ...d };
      $$('#docsSection select[data-dockey]').forEach(sel => { novo[sel.dataset.dockey] = sel.value; });
      c.documentos = novo;

      const impD = c.impostos || {};
      const novoImp = { ...impD };
      $$('#impostosSection select[data-impkey]').forEach(sel => { novoImp[sel.dataset.impkey] = sel.value; });
      c.impostos = novoImp;

      const impV = c.impostosValores || {};
      const novoImpV = { ...impV };
      $$('#impostosSection input[data-impvalue]').forEach(inp => {
        novoImpV[inp.dataset.impvalue] = moneyStrToNumber(inp.value);
      });
      c.impostosValores = novoImpV;

      const decD = c.declaracao || {};
      const novoDec = { ...decD };
      $$('#declaracaoSection select[data-deckey]').forEach(sel => { novoDec[sel.dataset.deckey] = sel.value; });
      c.declaracao = novoDec;

      const pct = docsProgressPercent(c.documentos, c.documentosPadrao, c.declaracao);
      c.status = statusFromProgress(pct);
      await saveData();
      renderDocsSection(c, false);
      renderImpostosSection(c, false);
      renderDeclaracaoSection(c, false);
      updateDocsProgressUI(pct);
      render();
      toast('Apuração atualizada.');
    });
    $$('#docsSection select[data-dockey]').forEach(sel => {
      sel.addEventListener('change', () => {
        const live = { ...d };
        $$('#docsSection select[data-dockey]').forEach(s => { live[s.dataset.dockey] = s.value; });
        const liveDec = { ...(c.declaracao||{}) };
        $$('#declaracaoSection select[data-deckey]').forEach(s => { liveDec[s.dataset.deckey] = s.value; });
        updateDocsProgressUI(docsProgressPercent(live, null, liveDec));
      });
    });
  }
}

function renderDeclaracaoSection(c, editMode){
  const d = c.declaracao || {};
  const box = $('#declaracaoSection');
  if(!editMode){
    box.innerHTML = `
      <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Declaração <button class="btn-icon" id="btnPadraoDeclaracao" title="Definir padrão do mês" style="width:26px;height:26px;background:var(--bg);color:var(--navy-700);border:1px solid var(--line);border-radius:7px;font-size:.8rem"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg" style="vertical-align:-0.15em" ><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg></button></span>
      </div>
      <div class="row3">${DECLARACAO_FIELDS.map(([k,label,,def])=>docField(label, d[k]||getFieldDefault(c,'declaracaoPadrao',k,def))).join('')}</div>
    `;
    $('#btnPadraoDeclaracao').addEventListener('click', () => openPadraoModal(c, DECLARACAO_FIELDS, 'declaracaoPadrao', 'Padrão de Declaração', () => renderDeclaracaoSection(c, false)));
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
        <span>Declaração <button class="btn-icon" id="btnPadraoDeclaracao" title="Definir padrão do mês" style="width:26px;height:26px;background:var(--bg);color:var(--navy-700);border:1px solid var(--line);border-radius:7px;font-size:.8rem"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg" style="vertical-align:-0.15em" ><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg></button></span>
      </div>
      <div class="row3">${DECLARACAO_FIELDS.map(([k,label,opts,def])=>selectHtml(k,label,opts,def)).join('')}</div>
    `;
    $('#btnPadraoDeclaracao').addEventListener('click', () => openPadraoModal(c, DECLARACAO_FIELDS, 'declaracaoPadrao', 'Padrão de Declaração', () => renderDeclaracaoSection(c, false)));
    colorizeSelectsIn(box);
    $$('#declaracaoSection select[data-deckey]').forEach(sel => {
      sel.addEventListener('change', () => {
        const liveDoc = { ...(c.documentos||{}) };
        $$('#docsSection select[data-dockey]').forEach(s => { liveDoc[s.dataset.dockey] = s.value; });
        const liveDec = { ...(c.declaracao||{}) };
        $$('#declaracaoSection select[data-deckey]').forEach(s => { liveDec[s.dataset.deckey] = s.value; });
        updateDocsProgressUI(docsProgressPercent(liveDoc, null, liveDec));
      });
    });
  }
}

export function renderImpostosSection(c, editMode){
  const d = c.impostos || {};
  const v = c.impostosValores || {};
  const fields = getImpostosFieldsForCompany(c);
  const box = $('#impostosSection');
  if(!editMode){
    const rows = fields.map(([k,label,,def]) => `
      <div class="client-row" style="cursor:default;align-items:flex-start;flex-wrap:wrap;gap:10px">
        <div style="min-width:140px;font-weight:700;font-size:.85rem;padding-top:2px">${escapeHtml(label)}</div>
        <div style="flex:1;min-width:160px">
          ${docFieldWithValue('', d[k]||getFieldDefault(c,'impostosPadrao',k,def), v[k])}
        </div>
        <div>${guiaBadgeHtml(c,k)}</div>
      </div>`).join('');
    box.innerHTML = `
      <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Impostos <button class="btn-icon" id="btnPadraoImpostos" title="Definir padrão do mês" style="width:26px;height:26px;background:var(--bg);color:var(--navy-700);border:1px solid var(--line);border-radius:7px;font-size:.8rem"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg" style="vertical-align:-0.15em" ><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg></button></span>
      </div>
      ${rows}
    `;
    $('#btnPadraoImpostos').addEventListener('click', () => openPadraoModal(c, fields, 'impostosPadrao', 'Padrão de Impostos', () => renderImpostosSection(c, false)));
    bindGuiaButtons(box, c, () => renderImpostosSection(c, false));
  } else {
    const rowHtml = (k,label,options,def) => {
      const eff = d[k] || getFieldDefault(c,'impostosPadrao',k,def);
      const valorFormatado = v[k] != null ? digitsToMoneyStr(Math.round(v[k]*100).toString()) : '';
      return `
      <div class="client-row" style="cursor:default;align-items:flex-start;flex-wrap:wrap;gap:10px;padding:12px 4px">
        <div style="min-width:130px;font-weight:700;font-size:.85rem;padding-top:9px">${escapeHtml(label)}</div>
        <div style="min-width:170px">
          <select data-impkey="${k}">
            ${options.map(([v2,l]) => `<option value="${v2}" ${eff===v2?'selected':''}>${l}</option>`).join('')}
          </select>
        </div>
        <div style="position:relative;min-width:130px">
          <span class="small-muted" style="position:absolute;left:11px;top:50%;transform:translateY(-50%);font-size:.82rem">R$</span>
          <input type="text" inputmode="numeric" data-impvalue="${k}" value="${valorFormatado}" placeholder="0,00" style="padding-left:32px">
        </div>
        <div>${guiaBadgeHtml(c,k)}</div>
      </div>`;
    };
    const rows = fields.map(([k,label,opts,def]) => rowHtml(k,label,opts,def)).join('');
    box.innerHTML = `
      <div class="section-title" style="display:flex;justify-content:space-between;align-items:center">
        <span>Impostos <button class="btn-icon" id="btnPadraoImpostos" title="Definir padrão do mês" style="width:26px;height:26px;background:var(--bg);color:var(--navy-700);border:1px solid var(--line);border-radius:7px;font-size:.8rem"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg" style="vertical-align:-0.15em" ><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg></button></span>
      </div>
      <p class="small-muted" style="margin-top:-4px">Ao marcar um imposto como Concluído, você poderá anexar o PDF da guia.</p>
      ${rows}
    `;
    $('#btnPadraoImpostos').addEventListener('click', () => openPadraoModal(c, fields, 'impostosPadrao', 'Padrão de Impostos', () => renderImpostosSection(c, false)));
    $$('#impostosSection input[data-impvalue]').forEach(applyMoneyMask);
    colorizeSelectsIn(box);
    bindGuiaButtons(box, c, () => renderImpostosSection(c, true));
  }
}

export function openPerfil(id, startDocsEdit){
  const c = DATA.companies.find(x => x.id === id);
  if(!c) return;
  setCurrentProfileId(id);
  $('#perfilNome').textContent = c.razaoSocial;
  $('#perfilMeta').textContent = [c.municipio, c.uf].filter(Boolean).join('/') || '—';

  $('#perfilBody').innerHTML = `
    ${c.baixada ? `<div class="banner" style="background:#fde3e8;border-color:#f5c2ce;color:#9c2c46;margin-bottom:14px"><span><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg" style="vertical-align:-0.15em" ><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg></span><span><strong>Empresa baixada</strong>${c.dataBaixa?(' em '+fmtDate(c.dataBaixa.slice(0,10))):''}. Motivo: ${escapeHtml(c.motivoBaixa)||'—'}</span></div>` : ''}
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
    <div class="section-title">Situação</div>
    <div class="row2">
      <div>
        <span class="small-muted">Status</span><br>
        <span class="status-pill ${statusClass(statusFromProgress(docsProgressPercent(c.documentos, c.documentosPadrao, c.declaracao)))}" id="statusPill">${statusLabel(statusFromProgress(docsProgressPercent(c.documentos, c.documentosPadrao, c.declaracao)))}</span>
        <span style="display:inline-flex;align-items:center;gap:6px;margin-left:8px;vertical-align:middle">
          <span style="display:inline-block;width:100px;height:8px;background:var(--line);border-radius:4px;overflow:hidden">
            <span id="docsProgressBar" style="display:block;height:100%;width:${docsProgressPercent(c.documentos, c.documentosPadrao, c.declaracao)}%;background:var(--green);transition:width .2s ease"></span>
          </span>
          <span id="docsProgressLabel" class="small-muted">${docsProgressPercent(c.documentos, c.documentosPadrao, c.declaracao)}%</span>
        </span>
      </div>
      <div><span class="small-muted">Vencimento/Certificado</span><br><strong>${fmtDate(c.vencimento)}</strong></div>
    </div>
    <div class="section-title">Responsável pela empresa</div>
    ${(() => {
      const r = c.responsavelEmpresa || {};
      const items = [
        [`<div><span class="small-muted">Nome</span><br><strong>${escapeHtml(r.nome)||'—'}</strong></div>`, true]
      ];
      if((r.telefone||'').trim()) items.push([copyableField('Telefone', r.telefone), true]);
      if((r.email||'').trim()) items.push([copyableField('E-mail', r.email), true]);
      if((r.outros||'').trim()) items.push([copyableField('Outros', r.outros), true]);
      const cells = items.map(i=>i[0]);
      let out = '';
      for(let i=0;i<cells.length;i+=2){
        out += `<div class="row2" ${i>0?'style="margin-top:10px"':''}>${cells[i]}${cells[i+1]||''}</div>`;
      }
      return out;
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
        if(hasSenha) line += `<br><span class="copy-field" data-copy="${escapeHtml(obj.senha)}" data-label="Senha" style="cursor:pointer;font-size:.76rem;color:var(--ink)">Senha: ${escapeHtml(obj.senha)} <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg" style="vertical-align:-0.15em" ><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></span>`;
        return `<div style="min-width:150px">${line}</div>`;
      }
      const blocks = [compactBlock('Prefeitura', s.prefeitura), compactBlock('Sistema 1', s.sistema1), compactBlock('Sistema 2', s.sistema2)].filter(Boolean);
      if(blocks.length === 0) return '';
      return `<div style="margin-top:12px"><span class="small-muted">Senhas</span><div style="margin-top:6px;background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:16px 20px;line-height:1.8;display:flex;flex-wrap:wrap;gap:32px">${blocks.join('')}</div></div>`;
    })()}
    <div id="declaracaoSection" style="margin-top:16px"></div>
    <div id="docsSection" style="margin-top:16px"></div>
    <div id="impostosSection" style="margin-top:16px"></div>
    <div class="section-title">Observações</div>
    <div class="field">
      <textarea id="obsApuracaoInput" rows="3" placeholder="Escreva aqui qualquer observação sobre a apuração desta empresa...">${escapeHtml(c.observacoesApuracao)}</textarea>
    </div>
  `;
  renderDocsSection(c, !!startDocsEdit);
  renderImpostosSection(c, !!startDocsEdit);
  renderDeclaracaoSection(c, !!startDocsEdit);
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
  openModal('#modalPerfil');
}

$('#btnPrintPerfil').addEventListener('click', () => window.print());

$('#btnVoltarPerfil').addEventListener('click', () => {
  closeModal('#modalPerfil');
  if(perfilReturnTo === 'apuracao'){
    renderApuracao();
    openModal('#modalApuracao');
  }
  setPerfilReturnTo(null);
});
