import { $, $$, debounce, toast, fmtDate, escapeHtml, initials, uid, isValidDoc, maskDoc,
         isVencendoEsteMes, pad2, isoDate, mesKeyDe } from './utils.js';
import { DATA, saveData } from './state.js';
import { openModal, closeModal, confirmDialog } from './modal.js';
import { openPerfil } from './perfil.js';
import { renderAvisosMetas } from './metas.js';
import { setCalDate, impostoEnviadoEfetivo } from './calendario.js';

export function countImpostosPendentesNoCalendario(){
  let count = 0;
  const hoje = new Date();
  const mesKey = mesKeyDe(hoje);
  DATA.companies.filter(c => !c.baixada).forEach(c => {
    const venc = c.impostosVencimentos || {};
    Object.keys(venc).forEach(k => {
      if(!venc[k]) return;
      if(!impostoEnviadoEfetivo(c, k)) count++;
    });
    const dia = parseInt(c.diaVencimentoIss, 10);
    if(dia >= 1 && dia <= 31){
      if(!(c.issDismissedMeses || {})[mesKey]) count++;
    }
  });
  return count;
}
function getVencimentosDeHoje(){
  const hoje = new Date();
  const anoHoje = hoje.getFullYear();
  const mesHoje = hoje.getMonth();
  const diaHoje = hoje.getDate();
  const hojeISO = isoDate(anoHoje, mesHoje, diaHoje);
  const mesKey = mesKeyDe(hoje);
  const diasNoMesHoje = new Date(anoHoje, mesHoje+1, 0).getDate();

  let impostosPendentes = 0;
  let issPendentes = 0;
  DATA.companies.filter(c => !c.baixada).forEach(c => {
    const venc = c.impostosVencimentos || {};
    Object.keys(venc).forEach(k => {
      if(venc[k] === hojeISO && !impostoEnviadoEfetivo(c, k)) impostosPendentes++;
    });
    const dia = parseInt(c.diaVencimentoIss, 10);
    if(dia >= 1 && dia <= 31){
      const diaClamp = Math.min(dia, diasNoMesHoje);
      if(diaClamp === diaHoje && !(c.issDismissedMeses || {})[mesKey]) issPendentes++;
    }
  });
  return { impostosPendentes, issPendentes };
}

let notificacaoDiaDispensada = false;
export function renderNotificacaoDoDia(){
  const banner = $('#bannerNotificacaoDia');
  if(!banner) return;
  if(notificacaoDiaDispensada){ banner.style.display = 'none'; return; }
  const { impostosPendentes, issPendentes } = getVencimentosDeHoje();
  const total = impostosPendentes + issPendentes;
  if(total === 0){ banner.style.display = 'none'; return; }
  const partes = [];
  if(impostosPendentes > 0) partes.push(`${impostosPendentes} ${impostosPendentes===1?'guia vence':'guias vencem'} hoje`);
  if(issPendentes > 0) partes.push(`${issPendentes} ${issPendentes===1?'Guia ISS vence':'Guias ISS vencem'} hoje`);
  $('#bannerNotificacaoDiaText').textContent = 'Hoje: ' + partes.join(' · ') + '.';
  banner.style.display = 'flex';
}
$('#btnVerNotificacaoDia').addEventListener('click', () => {
  setCalDate(new Date());
  document.getElementById('btnCalendarioVencimentos').click();
});
$('#btnDispensarNotificacaoDia').addEventListener('click', () => {
  notificacaoDiaDispensada = true;
  $('#bannerNotificacaoDia').style.display = 'none';
});
export function render(){
  renderList();
  const calBadge = $('#calPendentesCount');
  if(calBadge) calBadge.textContent = countImpostosPendentesNoCalendario();
  renderNotificacaoDoDia();
  renderAvisosMetas();
}

export function renderList(){
  const q = $('#searchInput').value.trim().toLowerCase();
  let list = DATA.companies.filter(c => !c.baixada).sort((a,b)=>a.razaoSocial.localeCompare(b.razaoSocial));

  if(q){
    list = list.filter(c =>
      c.razaoSocial.toLowerCase().includes(q) ||
      (c.cnpj||'').includes(q) ||
      (c.responsaveis||'').toLowerCase().includes(q) ||
      (c.municipio||'').toLowerCase().includes(q) ||
      (c.numero||'').toLowerCase().includes(q)
    );
  }
  if($('#filtroCertVencendo').checked){
    list = list.filter(c => isVencendoEsteMes(c.vencimento));
  }
  const homeRegime = $('#homeRegimeFilter').value;
  if(homeRegime){
    list = list.filter(c => c.regime === homeRegime);
  }
  const homeIssqn = $('#homeIssqnFilter').value;
  if(homeIssqn === 'PRESTADO'){
    list = list.filter(c => c.issqnPrest === 'SIM');
  } else if(homeIssqn === 'TOMADO'){
    list = list.filter(c => c.issqnTomado === 'SIM');
  } else if(homeIssqn === 'QUALQUER'){
    list = list.filter(c => c.issqnPrest === 'SIM' && c.issqnTomado === 'SIM');
  }
  const homeFatorR = $('#homeFatorRFilter').value;
  if(homeFatorR === 'SIM'){
    list = list.filter(c => c.fatorR === 'SIM');
  } else if(homeFatorR === 'NAO'){
    list = list.filter(c => c.fatorR !== 'SIM');
  }

  $('#clientCount').textContent = list.length;
  const box = $('#clientList');

  if(list.length === 0){
    box.innerHTML = `<div class="empty">Nenhuma empresa encontrada.</div>`;
    return;
  }

  box.innerHTML = list.map(c => {
    const vencendo = isVencendoEsteMes(c.vencimento);
    const vencTexto = c.vencimento ? `· <span style="${vencendo?'color:var(--red);font-weight:700':''}">vence ${fmtDate(c.vencimento)}</span>` : '';
    return `
    <div class="client-row" data-id="${c.id}">
      <div class="client-main">
        <div class="avatar">${initials(c.razaoSocial)||'?'}</div>
        <div style="min-width:0">
          <div class="client-name">${escapeHtml(c.razaoSocial)}</div>
          <div class="client-meta">${c.numero?('Nº '+c.numero+' · '):''}${c.atividade?(escapeHtml(c.atividade)+' · '):''}${c.issqnPrest==='SIM'?'<span class="meta-badge meta-badge-blue">ISSQN Prest.</span>':''}${c.issqnTomado==='SIM'?'<span class="meta-badge meta-badge-blue">ISSQN Tomado</span>':''}${c.fatorR==='SIM'?'<span class="meta-badge meta-badge-orange">Fator R</span>':''}${c.municipio||''}${c.uf?'/'+c.uf:''} ${vencTexto}</div>
        </div>
      </div>
      <button class="btn btn-outline btn-sm" data-open="${c.id}" style="flex:none">Abrir perfil</button>
    </div>`;
  }).join('');

  $$('#clientList .client-row').forEach(row => row.addEventListener('click', () => openEditFromList(row.dataset.id)));
}

export function openEditFromList(id){
  const c = DATA.companies.find(x => x.id === id);
  if(!c) return;
  fillForm(c);
  $('#empresaModalTitle').textContent = c.razaoSocial;
  openModal('#modalEmpresa');
}
$('#searchInput').addEventListener('input', debounce(renderList, 150));
$('#filtroCertVencendo').addEventListener('change', renderList);
$('#homeRegimeFilter').addEventListener('change', renderList);
$('#homeIssqnFilter').addEventListener('change', renderList);
$('#homeFatorRFilter').addEventListener('change', renderList);
/* ---------------- cadastro / edição empresa ---------------- */
export function clearForm(){
  ['fNumero','fRazao','fCnpj','fIe','fMunicipio','fResponsaveis','fVencimento','fObservacoesEmpresa','fPrefLink','fPrefLogin','fPrefSenha'].forEach(id => $('#'+id).value='');
  $('#fAtividade').value='';
  $('#fIssqnPrest').value='NAO';
  $('#fIssqnTomado').value='NAO';
  $('#fDiaVencimentoIss').value='';
  $('#fUf').value='';
  $('#fRegime').value='';
  $('#fFatorR').value='NAO';
  $('#fatorRWrap').style.display='none';
  $('#fDificuldade').value='FACIL';
  $('#fBaixada').checked=false;
  $('#fMotivoBaixa').value='';
  $('#motivoBaixaWrap').style.display='none';
  $('#empId').value='';
  $('#btnDeleteEmpresaForm').style.display='none';
  $('#cnpjLookupStatus').textContent='';
  renderResponsaveisBlocks([{}]);
  renderSistemasBlocks([{}]);
}

// aceita tanto o formato antigo (um único objeto) quanto o novo (array de responsáveis)
export function getResponsaveisArray(c){
  const r = c.responsavelEmpresa;
  if(Array.isArray(r)) return r.length ? r : [{}];
  if(r && typeof r === 'object' && (r.nome || r.telefone || r.email || r.outros)) return [r];
  return [{}];
}

function responsavelBlockHtml(idx, r){
  r = r || {};
  return `
  <div class="responsavel-block" data-respidx="${idx}" ${idx>0 ? 'style="margin-top:16px;padding-top:16px;border-top:1px dashed var(--line)"' : ''}>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span class="small-muted" style="font-weight:700">${idx===0?'Responsável principal':'Responsável '+(idx+1)}</span>
      ${idx>0 ? `<button type="button" class="btn btn-danger btn-sm" data-removeresp="${idx}" style="padding:3px 10px;font-size:.72rem">Remover</button>` : ''}
    </div>
    <div class="row2">
      <div class="field"><label>Nome</label><input class="resp-nome" placeholder="Nome do responsável" value="${escapeHtml(r.nome||'')}"></div>
      <div class="field"><label>Telefone</label><input class="resp-telefone" placeholder="(00) 00000-0000" value="${escapeHtml(r.telefone||'')}"></div>
    </div>
    <div class="field"><label>E-mail</label><input class="resp-email" type="email" placeholder="email@empresa.com" value="${escapeHtml(r.email||'')}"></div>
    <div class="field" style="margin-bottom:0"><label>Outros</label><textarea class="resp-outros" rows="2" placeholder="Outras informações de contato">${escapeHtml(r.outros||'')}</textarea></div>
  </div>`;
}

function renderResponsaveisBlocks(lista){
  lista = (lista && lista.length) ? lista : [{}];
  $('#responsaveisContainer').innerHTML = lista.map((r,idx) => responsavelBlockHtml(idx, r)).join('');
  $$('#responsaveisContainer [data-removeresp]').forEach(btn => btn.addEventListener('click', () => {
    const atual = coletarResponsaveisDoForm();
    const idx = parseInt(btn.dataset.removeresp);
    atual.splice(idx,1);
    renderResponsaveisBlocks(atual);
  }));
}

function coletarResponsaveisDoForm(){
  return $$('#responsaveisContainer .responsavel-block').map(bloco => ({
    nome: bloco.querySelector('.resp-nome').value.trim(),
    telefone: bloco.querySelector('.resp-telefone').value.trim(),
    email: bloco.querySelector('.resp-email').value.trim(),
    outros: bloco.querySelector('.resp-outros').value.trim()
  }));
}

$('#btnAddResponsavel').addEventListener('click', () => {
  const atual = coletarResponsaveisDoForm();
  atual.push({});
  renderResponsaveisBlocks(atual);
});

// aceita tanto o formato antigo (sistema1/sistema2 fixos) quanto o novo (array de sistemas)
export function getSistemasArray(c){
  const s = (c.senhas && c.senhas.sistemas);
  if(Array.isArray(s)) return s.length ? s : [{}];
  const legado = [];
  if(c.senhas && c.senhas.sistema1 && (c.senhas.sistema1.nome || c.senhas.sistema1.link || c.senhas.sistema1.login || c.senhas.sistema1.senha)) legado.push(c.senhas.sistema1);
  if(c.senhas && c.senhas.sistema2 && (c.senhas.sistema2.nome || c.senhas.sistema2.link || c.senhas.sistema2.login || c.senhas.sistema2.senha)) legado.push(c.senhas.sistema2);
  return legado.length ? legado : [{}];
}

function sistemaBlockHtml(idx, s){
  s = s || {};
  return `
  <div class="sistema-block" data-sisidx="${idx}" ${idx>0 ? 'style="margin-top:16px;padding-top:16px;border-top:1px dashed var(--line)"' : ''}>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
      <span class="small-muted" style="font-weight:700">Sistema ${idx+1}</span>
      ${idx>0 ? `<button type="button" class="btn btn-danger btn-sm" data-removesis="${idx}" style="padding:3px 10px;font-size:.72rem">Remover</button>` : ''}
    </div>
    <div class="field"><label>Nome do sistema</label><input class="sis-nome" placeholder="Ex.: SEBRAE" value="${escapeHtml(s.nome||'')}"></div>
    <div class="field"><label>Link do site (opcional)</label><input class="sis-link" placeholder="https://..." value="${escapeHtml(s.link||'')}"></div>
    <div class="row2" style="margin-bottom:0">
      <div class="field" style="margin-bottom:0"><label>Login</label><input class="sis-login" placeholder="Login" value="${escapeHtml(s.login||'')}"></div>
      <div class="field" style="margin-bottom:0"><label>Senha</label><div style="display:flex;gap:6px"><input class="sis-senha" type="password" placeholder="Senha" value="${escapeHtml(s.senha||'')}" style="flex:1"><button type="button" class="btn-icon" data-toggleinputsenhaclass style="flex:none" title="Mostrar/ocultar senha"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg></button></div></div>
    </div>
  </div>`;
}

function renderSistemasBlocks(lista){
  lista = (lista && lista.length) ? lista : [{}];
  $('#sistemasContainer').innerHTML = lista.map((s,idx) => sistemaBlockHtml(idx, s)).join('');
  $$('#sistemasContainer [data-removesis]').forEach(btn => btn.addEventListener('click', () => {
    const atual = coletarSistemasDoForm();
    const idx = parseInt(btn.dataset.removesis);
    atual.splice(idx,1);
    renderSistemasBlocks(atual);
  }));
}

function coletarSistemasDoForm(){
  return $$('#sistemasContainer .sistema-block').map(bloco => ({
    nome: bloco.querySelector('.sis-nome').value.trim(),
    link: bloco.querySelector('.sis-link').value.trim(),
    login: bloco.querySelector('.sis-login').value.trim(),
    senha: bloco.querySelector('.sis-senha').value.trim()
  }));
}

$('#btnAddSistema').addEventListener('click', () => {
  const atual = coletarSistemasDoForm();
  atual.push({});
  renderSistemasBlocks(atual);
});

$('#fCnpj').addEventListener('input', (e) => {
  const pos = e.target.selectionStart;
  const before = e.target.value.length;
  e.target.value = maskDoc(e.target.value);
  const diff = e.target.value.length - before;
  e.target.setSelectionRange(pos+diff, pos+diff);

  const digits = e.target.value.replace(/\D/g,'');
  if(digits.length === 14 && /^\d{14}$/.test(digits)){
    lookupCnpjNaReceita(digits);
  } else {
    $('#cnpjLookupStatus').textContent = '';
  }
});

async function lookupCnpjNaReceita(cnpjDigits){
  const status = $('#cnpjLookupStatus');
  status.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg" style="vertical-align:-0.15em" ><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg> Buscando dados na Receita Federal...';
  try{
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjDigits}`);
    if(!res.ok) throw new Error('CNPJ não encontrado');
    const data = await res.json();
    if(data.razao_social) $('#fRazao').value = data.razao_social;
    if(data.municipio) $('#fMunicipio').value = data.municipio;
    if(data.uf) $('#fUf').value = data.uf;
    status.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="icon-svg" style="vertical-align:-0.15em" ><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg> Dados preenchidos automaticamente — confira antes de salvar.';
    status.style.color = 'var(--green,#1b7a41)';
  }catch(e){
    status.textContent = 'Não achei esse CNPJ na Receita Federal. Preencha os dados manualmente.';
    status.style.color = 'var(--muted)';
  }
}

$('#openEmpresa').addEventListener('click', () => {
  clearForm();
  $('#empresaModalTitle').textContent = 'Nova empresa';
  openModal('#modalEmpresa');
});

function normalizeAtividade(v){
  const a = (v||'').toUpperCase().replace('É','E').replace(/\s/g,'');
  if(a.includes('SERVIC') && a.includes('COMERC')) return 'SERVIÇOS/COMÉRCIO';
  if(a.includes('COMERC') && a.includes('INDUST')) return 'COMÉRCIO/INDUSTRIA';
  if(a.includes('INDUST') && a.includes('SERVIC')) return 'INDUSTRIA/COMERCIO';
  if(a.includes('SERVIC')) return 'SERVIÇOS';
  if(a.includes('COMERC')) return 'COMÉRCIO';
  if(a.includes('INDUST')) return 'INDUSTRIA';
  return '';
}

export function fillForm(c){
  $('#empId').value = c.id;
  $('#btnDeleteEmpresaForm').style.display='inline-flex';
  $('#cnpjLookupStatus').textContent='';
  $('#fNumero').value = c.numero||'';
  $('#fRazao').value = c.razaoSocial||'';
  $('#fCnpj').value = c.cnpj||'';
  $('#fIe').value = c.ie||'';
  $('#fAtividade').value = normalizeAtividade(c.atividade);
  $('#fIssqnPrest').value = c.issqnPrest === 'SIM' ? 'SIM' : 'NAO';
  $('#fIssqnTomado').value = c.issqnTomado === 'SIM' ? 'SIM' : 'NAO';
  $('#fDiaVencimentoIss').value = c.diaVencimentoIss||'';
  $('#fMunicipio').value = c.municipio||'';
  $('#fUf').value = c.uf||'';
  $('#fDificuldade').value = c.dificuldade||'FACIL';
  $('#fResponsaveis').value = c.responsaveis||'';
  $('#fRegime').value = c.regime||'';
  $('#fFatorR').value = c.fatorR||'NAO';
  $('#fatorRWrap').style.display = c.regime === 'SIMPLES NACIONAL' ? 'block' : 'none';
  $('#fVencimento').value = c.vencimento||'';
  $('#fObservacoesEmpresa').value = c.observacoes||'';
  $('#fBaixada').checked = !!c.baixada;
  $('#fMotivoBaixa').value = c.motivoBaixa||'';
  $('#motivoBaixaWrap').style.display = c.baixada ? 'block' : 'none';
  renderResponsaveisBlocks(getResponsaveisArray(c));
  const s = c.senhas || {};
  $('#fPrefLink').value = (s.prefeitura && s.prefeitura.link) || '';
  $('#fPrefLogin').value = (s.prefeitura && s.prefeitura.login) || '';
  $('#fPrefSenha').value = (s.prefeitura && s.prefeitura.senha) || '';
  renderSistemasBlocks(getSistemasArray(c));
}

$('#fBaixada').addEventListener('change', () => {
  $('#motivoBaixaWrap').style.display = $('#fBaixada').checked ? 'block' : 'none';
});
$('#fRegime').addEventListener('change', () => {
  $('#fatorRWrap').style.display = $('#fRegime').value === 'SIMPLES NACIONAL' ? 'block' : 'none';
});

$('#btnDeleteEmpresaForm').addEventListener('click', async () => {
  const id = $('#empId').value;
  if(!id) return;
  const c = DATA.companies.find(x => x.id === id);
  if(!c) return;
  if(!(await confirmDialog(`Excluir "${c.razaoSocial}" definitivamente? Todo o histórico, senhas e apurações dessa empresa serão apagados. Essa ação não pode ser desfeita.\n\nSe você só quer parar de apurar essa empresa sem perder os dados, marque "Empresa arquivada" em vez de excluir.`, {okLabel:'Excluir'}))) return;
  DATA.companies = DATA.companies.filter(x => x.id !== id);
  await saveData();
  render();
  closeModal('#modalEmpresa');
  toast('Empresa excluída.');
});

$('#saveEmpresa').addEventListener('click', async () => {
  const razao = $('#fRazao').value.trim();
  if(!razao){ toast('Informe a razão social.'); $('#fRazao').focus(); return; }

  const issqnPrestVal = $('#fIssqnPrest').value === 'SIM' ? 'SIM' : 'NAO';
  const issqnTomadoVal = $('#fIssqnTomado').value === 'SIM' ? 'SIM' : 'NAO';
  const precisaDiaIss = issqnPrestVal === 'SIM' || issqnTomadoVal === 'SIM';

  const camposObrigatorios = [
    ['fCnpj', 'CNPJ / CPF'],
    ['fNumero', 'Nº (código interno)'],
    ['fIe', 'IE'],
    ['fAtividade', 'Atividade'],
    ['fMunicipio', 'Município'],
    ['fUf', 'UF'],
    ['fResponsaveis', 'Responsáveis'],
    ['fRegime', 'Regime'],
    ['fVencimento', 'Vencimento / Certificado'],
  ];
  if(precisaDiaIss) camposObrigatorios.push(['fDiaVencimentoIss', 'Dia de vencimento da Guia ISS']);

  for(const [id, label] of camposObrigatorios){
    const el = $('#'+id);
    if(!el.value || !el.value.trim()){
      toast(`Preencha o campo "${label}" antes de salvar.`);
      el.focus();
      return;
    }
  }
  if(precisaDiaIss){
    const diaIss = parseInt($('#fDiaVencimentoIss').value, 10);
    if(!(diaIss >= 1 && diaIss <= 31)){
      toast('Informe um dia válido (1 a 31) para o vencimento da Guia ISS.');
      $('#fDiaVencimentoIss').focus();
      return;
    }
  }

  const docVal = $('#fCnpj').value.trim();
  if(docVal && !isValidDoc(docVal)){
    if(!(await confirmDialog('O CNPJ/CPF informado não tem 11 dígitos (CPF) nem 14 caracteres (CNPJ numérico ou alfanumérico). Salvar assim mesmo?', {okLabel:'Salvar assim mesmo'}))) return;
  }
  const isBaixada = $('#fBaixada').checked;
  const motivoBaixa = $('#fMotivoBaixa').value.trim();
  if(isBaixada && !motivoBaixa){
    toast('Informe o motivo da baixa para arquivar a empresa.');
    $('#fMotivoBaixa').focus();
    return;
  }
  const id = $('#empId').value || uid('emp');
  const existing = DATA.companies.find(c => c.id === id);

  const payload = {
    id,
    numero: $('#fNumero').value.trim(),
    razaoSocial: razao,
    cnpj: $('#fCnpj').value.trim(),
    ie: $('#fIe').value.trim(),
    atividade: $('#fAtividade').value.trim(),
    issqnPrest: $('#fIssqnPrest').value === 'SIM' ? 'SIM' : 'NAO',
    issqnTomado: $('#fIssqnTomado').value === 'SIM' ? 'SIM' : 'NAO',
    diaVencimentoIss: (() => { const n = parseInt($('#fDiaVencimentoIss').value, 10); return (n>=1 && n<=31) ? n : ''; })(),
    municipio: $('#fMunicipio').value.trim(),
    uf: $('#fUf').value.trim().toUpperCase(),
    dificuldade: $('#fDificuldade').value,
    responsaveis: $('#fResponsaveis').value.trim(),
    regime: $('#fRegime').value,
    fatorR: $('#fRegime').value === 'SIMPLES NACIONAL' ? $('#fFatorR').value : '',
    status: existing ? existing.status : 'PENDENTE',
    vencimento: $('#fVencimento').value,
    baixada: isBaixada,
    motivoBaixa: isBaixada ? motivoBaixa : '',
    dataBaixa: isBaixada ? ((existing && existing.baixada) ? existing.dataBaixa : new Date().toISOString()) : '',
    situacaoDocumentos: (existing && existing.situacaoDocumentos) || '',
    responsavelEmpresa: coletarResponsaveisDoForm().filter(r => r.nome || r.telefone || r.email || r.outros),
    senhas: {
      prefeitura: { link: $('#fPrefLink').value.trim(), login: $('#fPrefLogin').value.trim(), senha: $('#fPrefSenha').value.trim() },
      sistemas: coletarSistemasDoForm().filter(s => s.nome || s.link || s.login || s.senha)
    },
    observacoes: $('#fObservacoesEmpresa').value.trim()
  };

  if(existing){ Object.assign(existing, payload); }
  else { DATA.companies.push(payload); }

  await saveData();
  render();
  closeModal('#modalEmpresa');
  toast('Empresa salva com sucesso.');
});
/* ---------------- empresas baixadas ---------------- */
export function renderBaixadasList(){
  const q = $('#baixadasSearch').value.trim().toLowerCase();
  let list = DATA.companies.filter(c => c.baixada).sort((a,b)=>a.razaoSocial.localeCompare(b.razaoSocial));
  if(q){
    list = list.filter(c =>
      c.razaoSocial.toLowerCase().includes(q) ||
      (c.cnpj||'').includes(q) ||
      (c.municipio||'').toLowerCase().includes(q)
    );
  }
  const box = $('#baixadasList');
  if(list.length === 0){
    box.innerHTML = `<div class="empty">Nenhuma empresa arquivada.</div>`;
    return;
  }
  box.innerHTML = list.map(c => `
    <div class="client-row" data-id="${c.id}" style="cursor:default">
      <div class="client-main">
        <div class="avatar">${initials(c.razaoSocial)||'?'}</div>
        <div style="min-width:0">
          <div class="client-name">${escapeHtml(c.razaoSocial)}</div>
          <div class="client-meta">${c.numero?('Nº '+c.numero+' · '):''}${c.municipio||''}${c.uf?'/'+c.uf:''}${c.dataBaixa?(' · arquivada em '+fmtDate(c.dataBaixa.slice(0,10))):''}</div>
          ${c.motivoBaixa ? `<div class="small-muted" style="margin-top:2px">Motivo: ${escapeHtml(c.motivoBaixa)}</div>` : ''}
        </div>
      </div>
      <div style="display:flex;gap:6px;flex:none">
        <button class="btn btn-outline btn-sm" data-verbaixada="${c.id}">Ver perfil</button>
        <button class="btn btn-outline btn-sm" data-reativar="${c.id}">Reativar</button>
      </div>
    </div>`).join('');

  $$('#baixadasList [data-verbaixada]').forEach(btn => btn.addEventListener('click', () => {
    closeModal('#modalBaixadas');
    openPerfil(btn.dataset.verbaixada);
  }));
  $$('#baixadasList [data-reativar]').forEach(btn => btn.addEventListener('click', async () => {
    const c = DATA.companies.find(x => x.id === btn.dataset.reativar);
    if(!c) return;
    if(!(await confirmDialog(`Reativar "${c.razaoSocial}"? Ela volta a aparecer na lista normal e na Apuração do Mês.`, {okLabel:'Reativar'}))) return;
    c.baixada = false;
    await saveData();
    render();
    renderBaixadasList();
    toast('Empresa reativada.');
  }));
}
$('#btnBaixadas').addEventListener('click', () => {
  renderBaixadasList();
  openModal('#modalBaixadas');
});
$('#baixadasSearch').addEventListener('input', debounce(renderBaixadasList, 150));
