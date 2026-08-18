import { toast, statusLabel, fmtDate } from './utils.js';
import { DATA } from './state.js';

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
    'Baixada': c.baixada ? 'SIM' : 'NÃO',
    'Motivo da baixa': c.motivoBaixa||'',
    'Responsável — Nome': (c.responsavelEmpresa && c.responsavelEmpresa.nome) || '',
    'Responsável — Telefone': (c.responsavelEmpresa && c.responsavelEmpresa.telefone) || '',
    'Responsável — E-mail': (c.responsavelEmpresa && c.responsavelEmpresa.email) || '',
    'Responsável — Outros': (c.responsavelEmpresa && c.responsavelEmpresa.outros) || '',
    'Situação dos documentos': c.situacaoDocumentos||'',
    'Prefeitura — Login': (c.senhas && c.senhas.prefeitura && c.senhas.prefeitura.login) || '',
    'Prefeitura — Senha': (c.senhas && c.senhas.prefeitura && c.senhas.prefeitura.senha) || '',
    'Sistema 1 — Nome': (c.senhas && c.senhas.sistema1 && c.senhas.sistema1.nome) || '',
    'Sistema 1 — Login': (c.senhas && c.senhas.sistema1 && c.senhas.sistema1.login) || '',
    'Sistema 1 — Senha': (c.senhas && c.senhas.sistema1 && c.senhas.sistema1.senha) || '',
    'Sistema 2 — Nome': (c.senhas && c.senhas.sistema2 && c.senhas.sistema2.nome) || '',
    'Sistema 2 — Login': (c.senhas && c.senhas.sistema2 && c.senhas.sistema2.login) || '',
    'Sistema 2 — Senha': (c.senhas && c.senhas.sistema2 && c.senhas.sistema2.senha) || '',
    'Observações (PDF)': c.observacoes||''
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Empresas');
  XLSX.writeFile(wb, 'controle-empresas.xlsx');
  toast('Excel gerado.');
}
