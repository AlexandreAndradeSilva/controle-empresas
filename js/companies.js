import { $, $$, debounce, toast, fmtDate, escapeHtml, initials, uid, isValidDoc, maskDoc, isVencendoEsteMes } from './utils.js';
import { DATA, saveData } from './state.js';
import { openModal, closeModal } from './modal.js';
import { openPerfil } from './perfil.js';

/* ---------------- render (tela inicial) ---------------- */
export function render(){
  renderList();
  const badge = $('#baixadasCount');
  if(badge) badge.textContent = DATA.companies.filter(c => c.baixada).length;
}

function renderList(){
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
          <div class="client-meta">${c.numero?('Nº '+c.numero+' · '):''}${c.municipio||''}${c.uf?'/'+c.uf:''} ${vencTexto}</div>
        </div>
      </div>
      <button class="btn btn-outline btn-sm" data-open="${c.id}" style="flex:none">Abrir perfil</button>
    </div>`;
  }).join('');

  $$('#clientList .client-row').forEach(row => row.addEventListener('click', () => openEditFromList(row.dataset.id)));
}

function openEditFromList(id){
  const c = DATA.companies.find(x => x.id === id);
  if(!c) return;
  fillForm(c);
  $('#empresaModalTitle').textContent = c.razaoSocial;
  openModal('#modalEmpresa');
}

$('#searchInput').addEventListener('input', debounce(renderList, 150));
$('#filtroCertVencendo').addEventListener('change', renderList);
$('#homeRegimeFilter').addEventListener('change', renderList);

/* ---------------- cadastro / edição empresa ---------------- */
function clearForm(){
  ['fNumero','fRazao','fCnpj','fIe','fMunicipio','fResponsaveis','fVencimento','fRespNome','fRespTelefone','fRespEmail','fRespOutros','fPrefLink','fPrefLogin','fPrefSenha','fSis1Nome','fSis1Link','fSis1Login','fSis1Senha','fSis2Nome','fSis2Link','fSis2Login','fSis2Senha'].forEach(id => $('#'+id).value='');
  $('#fAtividade').value='';
  $('#fUf').value='';
  $('#fRegime').value='';
  $('#fDificuldade').value='FACIL';
  $('#fBaixada').checked=false;
  $('#fMotivoBaixa').value='';
  $('#motivoBaixaWrap').style.display='none';
  $('#empId').value='';
  $('#btnDeleteEmpresaForm').style.display='none';
  $('#cnpjLookupStatus').textContent='';
}

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
  if(a.includes('INDUST') && a.includes('SERVIC')) return 'INDUSTRIA/SERVIÇOS';
  if(a.includes('SERVIC')) return 'SERVIÇOS';
  if(a.includes('COMERC')) return 'COMÉRCIO';
  if(a.includes('INDUST')) return 'INDUSTRIA';
  return '';
}

function fillForm(c){
  $('#empId').value = c.id;
  $('#btnDeleteEmpresaForm').style.display='inline-flex';
  $('#cnpjLookupStatus').textContent='';
  $('#fNumero').value = c.numero||'';
  $('#fRazao').value = c.razaoSocial||'';
  $('#fCnpj').value = c.cnpj||'';
  $('#fIe').value = c.ie||'';
  $('#fAtividade').value = normalizeAtividade(c.atividade);
  $('#fMunicipio').value = c.municipio||'';
  $('#fUf').value = c.uf||'';
  $('#fDificuldade').value = c.dificuldade||'FACIL';
  $('#fResponsaveis').value = c.responsaveis||'';
  $('#fRegime').value = c.regime||'';
  $('#fVencimento').value = c.vencimento||'';
  $('#fBaixada').checked = !!c.baixada;
  $('#fMotivoBaixa').value = c.motivoBaixa||'';
  $('#motivoBaixaWrap').style.display = c.baixada ? 'block' : 'none';
  $('#fRespNome').value = (c.responsavelEmpresa && c.responsavelEmpresa.nome) || '';
  $('#fRespTelefone').value = (c.responsavelEmpresa && c.responsavelEmpresa.telefone) || '';
  $('#fRespEmail').value = (c.responsavelEmpresa && c.responsavelEmpresa.email) || '';
  $('#fRespOutros').value = (c.responsavelEmpresa && c.responsavelEmpresa.outros) || '';
  const s = c.senhas || {};
  $('#fPrefLink').value = (s.prefeitura && s.prefeitura.link) || '';
  $('#fPrefLogin').value = (s.prefeitura && s.prefeitura.login) || '';
  $('#fPrefSenha').value = (s.prefeitura && s.prefeitura.senha) || '';
  $('#fSis1Nome').value = (s.sistema1 && s.sistema1.nome) || '';
  $('#fSis1Link').value = (s.sistema1 && s.sistema1.link) || '';
  $('#fSis1Login').value = (s.sistema1 && s.sistema1.login) || '';
  $('#fSis1Senha').value = (s.sistema1 && s.sistema1.senha) || '';
  $('#fSis2Nome').value = (s.sistema2 && s.sistema2.nome) || '';
  $('#fSis2Link').value = (s.sistema2 && s.sistema2.link) || '';
  $('#fSis2Login').value = (s.sistema2 && s.sistema2.login) || '';
  $('#fSis2Senha').value = (s.sistema2 && s.sistema2.senha) || '';
}

$('#fBaixada').addEventListener('change', () => {
  $('#motivoBaixaWrap').style.display = $('#fBaixada').checked ? 'block' : 'none';
});

$('#btnDeleteEmpresaForm').addEventListener('click', async () => {
  const id = $('#empId').value;
  if(!id) return;
  const c = DATA.companies.find(x => x.id === id);
  if(!c) return;
  if(!confirm(`Excluir "${c.razaoSocial}" definitivamente? Todo o histórico, senhas e apurações dessa empresa serão apagados. Essa ação não pode ser desfeita.\n\nSe você só quer parar de apurar essa empresa sem perder os dados, marque "Empresa baixada" em vez de excluir.`)) return;
  DATA.companies = DATA.companies.filter(x => x.id !== id);
  await saveData();
  render();
  closeModal('#modalEmpresa');
  toast('Empresa excluída.');
});

$('#saveEmpresa').addEventListener('click', async () => {
  const razao = $('#fRazao').value.trim();
  if(!razao){ toast('Informe a razão social.'); return; }
  const docVal = $('#fCnpj').value.trim();
  if(docVal && !isValidDoc(docVal)){
    if(!confirm('O CNPJ/CPF informado não tem 11 dígitos (CPF) nem 14 caracteres (CNPJ numérico ou alfanumérico). Salvar assim mesmo?')) return;
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
    municipio: $('#fMunicipio').value.trim(),
    uf: $('#fUf').value.trim().toUpperCase(),
    dificuldade: $('#fDificuldade').value,
    responsaveis: $('#fResponsaveis').value.trim(),
    regime: $('#fRegime').value,
    status: existing ? existing.status : 'PENDENTE',
    vencimento: $('#fVencimento').value,
    baixada: isBaixada,
    motivoBaixa: isBaixada ? motivoBaixa : '',
    dataBaixa: isBaixada ? ((existing && existing.baixada) ? existing.dataBaixa : new Date().toISOString()) : '',
    situacaoDocumentos: (existing && existing.situacaoDocumentos) || '',
    responsavelEmpresa: {
      nome: $('#fRespNome').value.trim(),
      telefone: $('#fRespTelefone').value.trim(),
      email: $('#fRespEmail').value.trim(),
      outros: $('#fRespOutros').value.trim()
    },
    senhas: {
      prefeitura: { link: $('#fPrefLink').value.trim(), login: $('#fPrefLogin').value.trim(), senha: $('#fPrefSenha').value.trim() },
      sistema1: { nome: $('#fSis1Nome').value.trim(), link: $('#fSis1Link').value.trim(), login: $('#fSis1Login').value.trim(), senha: $('#fSis1Senha').value.trim() },
      sistema2: { nome: $('#fSis2Nome').value.trim(), link: $('#fSis2Link').value.trim(), login: $('#fSis2Login').value.trim(), senha: $('#fSis2Senha').value.trim() }
    },
    observacoes: (existing && existing.observacoes) || ''
  };

  if(existing){ Object.assign(existing, payload); }
  else { DATA.companies.push(payload); }

  await saveData();
  render();
  closeModal('#modalEmpresa');
  toast('Empresa salva com sucesso.');
});

/* ---------------- empresas baixadas ---------------- */
function renderBaixadasList(){
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
    box.innerHTML = `<div class="empty">Nenhuma empresa baixada.</div>`;
    return;
  }
  box.innerHTML = list.map(c => `
    <div class="client-row" data-id="${c.id}" style="cursor:default">
      <div class="client-main">
        <div class="avatar">${initials(c.razaoSocial)||'?'}</div>
        <div style="min-width:0">
          <div class="client-name">${escapeHtml(c.razaoSocial)}</div>
          <div class="client-meta">${c.numero?('Nº '+c.numero+' · '):''}${c.municipio||''}${c.uf?'/'+c.uf:''}${c.dataBaixa?(' · baixada em '+fmtDate(c.dataBaixa.slice(0,10))):''}</div>
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
    if(!confirm(`Reativar "${c.razaoSocial}"? Ela volta a aparecer na lista normal e na Apuração do Mês.`)) return;
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
