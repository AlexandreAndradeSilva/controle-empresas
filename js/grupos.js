/* Grupos de empresas: agrupa empresas do mesmo dono/grupo econômico (uma
   principal + demais associadas), pra mostrar "Pertence ao Grupo" no cadastro
   e permitir filtrar a Apuração do Mês por grupo. */
import { $, $$, debounce, toast, escapeHtml, uid } from './utils.js';
import { DATA, saveData } from './state.js';
import { openModal, confirmDialog } from './modal.js';
import { render } from './companies.js';

export function getGrupoDaEmpresa(c){
  return (DATA.grupos||[]).find(g => g.empresaPrincipalId === c.id || (g.empresaIds||[]).includes(c.id)) || null;
}
export function empresasDoGrupo(g){
  const ids = new Set([g.empresaPrincipalId, ...(g.empresaIds||[])].filter(Boolean));
  return DATA.companies.filter(c => ids.has(c.id));
}

export function openModalGrupos(){
  fecharFormGrupo();
  renderGruposList();
  openModal('#modalGrupos');
}
$('#btnGrupos').addEventListener('click', openModalGrupos);

function renderGruposList(){
  const box = $('#gruposList');
  const grupos = DATA.grupos || [];
  if(grupos.length === 0){
    box.innerHTML = `<div class="empty">Nenhum grupo cadastrado ainda. Clique em "Novo grupo" pra começar.</div>`;
    return;
  }
  box.innerHTML = grupos.map(g => {
    const principal = DATA.companies.find(c => c.id === g.empresaPrincipalId);
    const membros = empresasDoGrupo(g).filter(c => c.id !== g.empresaPrincipalId);
    return `
    <div class="panel" style="margin-top:0;padding:14px 16px">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
        <div style="min-width:0">
          <strong style="font-size:.92rem">${escapeHtml(g.nome)}</strong>
          <div class="small-muted" style="margin-top:4px">
            ${principal ? `Principal: <strong>${escapeHtml(principal.razaoSocial)}</strong>` : '<em>Empresa principal não definida</em>'}
            ${membros.length ? ` · ${membros.length} empresa${membros.length===1?'':'s'} no grupo` : ''}
          </div>
          ${membros.length ? `<div class="small-muted" style="margin-top:4px">${membros.map(c=>escapeHtml(c.razaoSocial)).join(', ')}</div>` : ''}
        </div>
        <div style="display:flex;gap:6px;flex:none">
          <button class="btn btn-outline btn-sm" data-editargrupo="${g.id}">Editar</button>
          <button class="btn btn-danger btn-sm" data-excluirgrupo="${g.id}">Excluir</button>
        </div>
      </div>
    </div>`;
  }).join('');
  box.querySelectorAll('[data-editargrupo]').forEach(btn => {
    btn.addEventListener('click', () => abrirFormGrupo(btn.dataset.editargrupo));
  });
  box.querySelectorAll('[data-excluirgrupo]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if(!(await confirmDialog('Excluir este grupo? As empresas em si não são afetadas, só deixam de fazer parte do grupo.', {okLabel:'Excluir'}))) return;
      DATA.grupos = (DATA.grupos||[]).filter(g => g.id !== btn.dataset.excluirgrupo);
      await saveData();
      renderGruposList();
      render();
    });
  });
}

function fecharFormGrupo(){
  $('#grupoFormCard').style.display = 'none';
}
$('#btnCancelarGrupo').addEventListener('click', fecharFormGrupo);

let grupoFormEmpresasSelecionadas = [];

function popularDatalistPrincipal(){
  const dl = $('#grupoPrincipalDatalist');
  dl.innerHTML = DATA.companies.filter(c => !c.baixada).slice().sort((a,b)=>a.razaoSocial.localeCompare(b.razaoSocial))
    .map(c => `<option data-id="${c.id}" value="${escapeHtml(c.razaoSocial)}">`).join('');
}

function renderGrupoFormEmpresasLista(){
  const busca = $('#grupoFormEmpresasBusca').value.trim().toLowerCase();
  const box = $('#grupoFormEmpresasLista');
  let empresas = DATA.companies.filter(c => !c.baixada).slice().sort((a,b)=>a.razaoSocial.localeCompare(b.razaoSocial));
  if(busca) empresas = empresas.filter(c => c.razaoSocial.toLowerCase().includes(busca) || (c.cnpj||'').includes(busca));
  if(empresas.length === 0){
    box.innerHTML = `<p class="small-muted" style="margin:4px">Nenhuma empresa encontrada.</p>`;
  } else {
    box.innerHTML = empresas.map(c => `
      <label style="display:flex;align-items:center;gap:8px;padding:5px 2px;cursor:pointer;font-size:.85rem">
        <input type="checkbox" data-grupoempresaid="${c.id}" ${grupoFormEmpresasSelecionadas.includes(c.id)?'checked':''} style="width:15px;height:15px;accent-color:var(--navy-700);margin:0">
        ${escapeHtml(c.razaoSocial)}
      </label>`).join('');
  }
  box.querySelectorAll('[data-grupoempresaid]').forEach(chk => {
    chk.addEventListener('change', () => {
      const id = chk.dataset.grupoempresaid;
      if(chk.checked){ if(!grupoFormEmpresasSelecionadas.includes(id)) grupoFormEmpresasSelecionadas.push(id); }
      else { grupoFormEmpresasSelecionadas = grupoFormEmpresasSelecionadas.filter(x => x !== id); }
      atualizarContadorEmpresasGrupo();
    });
  });
}
function atualizarContadorEmpresasGrupo(){
  const n = grupoFormEmpresasSelecionadas.length;
  $('#grupoFormEmpresasCount').textContent = n === 0 ? 'Nenhuma empresa selecionada.' : `${n} empresa${n===1?'':'s'} selecionada${n===1?'':'s'}.`;
}
$('#grupoFormEmpresasBusca').addEventListener('input', debounce(renderGrupoFormEmpresasLista, 120));
$('#grupoFormPrincipalBusca').addEventListener('input', () => {
  const texto = $('#grupoFormPrincipalBusca').value.trim().toLowerCase();
  const encontrada = DATA.companies.find(c => !c.baixada && c.razaoSocial.trim().toLowerCase() === texto);
  $('#grupoFormPrincipalId').value = encontrada ? encontrada.id : '';
});

function abrirFormGrupo(id){
  const g = id ? (DATA.grupos||[]).find(x => x.id === id) : null;
  $('#grupoFormId').value = g ? g.id : '';
  $('#grupoFormTitulo').textContent = g ? 'Editar grupo' : 'Novo grupo';
  $('#grupoFormNome').value = g ? g.nome : '';
  popularDatalistPrincipal();
  const principal = g ? DATA.companies.find(c => c.id === g.empresaPrincipalId) : null;
  $('#grupoFormPrincipalBusca').value = principal ? principal.razaoSocial : '';
  $('#grupoFormPrincipalId').value = g ? (g.empresaPrincipalId || '') : '';
  grupoFormEmpresasSelecionadas = g ? [...(g.empresaIds||[])] : [];
  $('#grupoFormEmpresasBusca').value = '';
  renderGrupoFormEmpresasLista();
  atualizarContadorEmpresasGrupo();
  $('#grupoFormCard').style.display = '';
}
$('#btnNovoGrupo').addEventListener('click', () => abrirFormGrupo(null));

$('#btnSalvarGrupo').addEventListener('click', async () => {
  const nome = $('#grupoFormNome').value.trim();
  if(!nome){ toast('Dê um nome pro grupo.'); return; }
  const id = $('#grupoFormId').value;
  const empresaPrincipalId = $('#grupoFormPrincipalId').value || '';
  let g = id ? (DATA.grupos||[]).find(x => x.id === id) : null;
  const nova = {
    id: g ? g.id : uid('grupo'),
    nome,
    empresaPrincipalId,
    empresaIds: grupoFormEmpresasSelecionadas.slice()
  };
  if(!g){ DATA.grupos = DATA.grupos || []; DATA.grupos.push(nova); }
  else { Object.assign(g, nova); }
  await saveData();
  fecharFormGrupo();
  renderGruposList();
  render();
  toast('Grupo salvo.');
});
