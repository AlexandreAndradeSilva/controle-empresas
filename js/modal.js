import { $, $$ } from './utils.js';

export function openModal(id){ $(id).classList.add('show'); }
export function closeModal(id){ $(id).classList.remove('show'); }

export function initModals(){
  $$('[data-close]').forEach(btn => btn.addEventListener('click', (e) => closeModal('#'+e.target.closest('.overlay').id)));
  $$('.overlay').forEach(ov => ov.addEventListener('click', (e) => { if(e.target===ov) closeModal('#'+ov.id); }));

  $('#confirmOk').addEventListener('click', () => _finishConfirmDialog(true));
  $('#confirmCancelar').addEventListener('click', () => _finishConfirmDialog(false));
  $('#modalConfirm').addEventListener('click', (e) => { if(e.target.id === 'modalConfirm') _finishConfirmDialog(false); });
}

/* Diálogo de confirmação próprio do app, em vez do confirm() nativo: dentro de
   um iframe o nativo pode não abrir e retornar false silenciosamente, travando
   qualquer ação destrutiva sem dizer por quê. */
let _confirmResolve = null;
export function confirmDialog(mensagem, opts){
  opts = opts || {};
  $('#confirmTitulo').textContent = opts.titulo || 'Confirmar';
  $('#confirmMensagem').textContent = mensagem;
  $('#confirmOk').textContent = opts.okLabel || 'Confirmar';
  return new Promise((resolve) => {
    _confirmResolve = resolve;
    openModal('#modalConfirm');
  });
}
function _finishConfirmDialog(valor){
  if(_confirmResolve){
    const r = _confirmResolve;
    _confirmResolve = null;
    closeModal('#modalConfirm');
    r(valor);
  }
}
