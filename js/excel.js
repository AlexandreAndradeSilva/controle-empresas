import { toast, statusLabel, fmtDate } from './utils.js';
import { DATA } from './state.js';
import { getResponsaveisArray, getSistemasArray } from './companies.js';

export function exportExcel(){
  if(DATA.companies.length === 0){ toast('Não há empresas para exportar.'); return; }
  const rows = DATA.companies.slice().sort((a,b)=>a.razaoSocial.localeCompare(b.razaoSocial)).map(c => ({
    'Nº': c.numero||'',
    'Razão Social': c.razaoSocial,
    'CNPJ': c.cnpj||'',
    'IE': c.ie||'',
    'Atividade': c.atividade||'',
    'Município': c.municipio||'',
    'UF': c.uf||'',
    'Dificuldade': c.dificuldade||'',
    'Regime': c.regime||'',
    'Responsáveis': c.responsaveis||'',
    'Status': statusLabel(c.status),
    'Vencimento/Cert.': c.vencimento ? fmtDate(c.vencimento) : '',
    'Arquivada': c.baixada ? 'SIM' : 'NÃO',
    'Motivo da baixa': c.motivoBaixa||'',
    'Responsável — Nome': getResponsaveisArray(c).map(r=>r.nome||'').filter(Boolean).join(' | '),
    'Responsável — Telefone': getResponsaveisArray(c).map(r=>r.telefone||'').filter(Boolean).join(' | '),
    'Responsável — E-mail': getResponsaveisArray(c).map(r=>r.email||'').filter(Boolean).join(' | '),
    'Responsável — Outros': getResponsaveisArray(c).map(r=>r.outros||'').filter(Boolean).join(' | '),
    'Situação dos documentos': c.situacaoDocumentos||'',
    'Prefeitura — Login': (c.senhas && c.senhas.prefeitura && c.senhas.prefeitura.login) || '',
    'Prefeitura — Senha': (c.senhas && c.senhas.prefeitura && c.senhas.prefeitura.senha) || '',
    'Sistemas — Nome': getSistemasArray(c).map(s=>s.nome||'').filter(Boolean).join(' | '),
    'Sistemas — Login': getSistemasArray(c).map(s=>s.login||'').filter(Boolean).join(' | '),
    'Sistemas — Senha': getSistemasArray(c).map(s=>s.senha||'').filter(Boolean).join(' | '),
    'Observações (PDF)': c.observacoes||''
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Empresas');
  XLSX.writeFile(wb, 'controle-empresas.xlsx');
  toast('Excel gerado.');
}
