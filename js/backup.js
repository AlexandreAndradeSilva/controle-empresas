import { $, toast } from './utils.js';
import { DATA, saveData, setData } from './state.js';
import { openModal, closeModal } from './modal.js';
import { render } from './companies.js';

$('#btnBackup').addEventListener('click', () => { openModal('#modalBackup'); });

$('#btnExportJson').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(DATA, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'backup-controle-empresas.json'; a.click();
  URL.revokeObjectURL(url);
});
$('#importJson').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = async () => {
    try{
      const parsed = JSON.parse(reader.result);
      if(!parsed.companies) throw new Error('formato inválido');
      setData(parsed);
      await saveData();
      render();
      toast('Backup restaurado com sucesso.');
      closeModal('#modalBackup');
    }catch(err){ toast('Arquivo inválido.'); }
  };
  reader.readAsText(file);
});
$('#btnWipe').addEventListener('click', async () => {
  if(!confirm('Isso apagará todas as empresas cadastradas. Confirma?')) return;
  setData({ companies: [] });
  await saveData();
  render();
  closeModal('#modalBackup');
  toast('Dados apagados.');
});
