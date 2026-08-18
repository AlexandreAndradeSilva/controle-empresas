import { DATA } from './state.js';

const DOC_OPTIONS = [
  ['SEM MOVIMENTO','Sem movimento'],
  ['PENDENTE','Pendente'], ['NÃO TEM','Não tem'], ['CONCLUIDO','Concluído']
];
const DOC_OPTIONS_ALUGUEL = [
  ['NÃO TEM','Não tem'], ['LANÇAR','Lançar'], ['CONCLUIDO','Concluído']
];
const DOC_OPTIONS_PENDCONC = [
  ['PENDENTE','Pendente'], ['CONCLUIDO','Concluído']
];
export const DOC_FIELDS = [
  ['nfSaida','NF de Saída', DOC_OPTIONS, 'PENDENTE'], ['nfsPrestado','NFS Serv. Prestado', DOC_OPTIONS, 'PENDENTE'],
  ['nfsTomado','NFS Serv. Tomado', DOC_OPTIONS, 'PENDENTE'], ['nfEntrada','NF de Entrada', DOC_OPTIONS, 'PENDENTE'],
  ['cte','CT-e', DOC_OPTIONS, 'PENDENTE'], ['aluguel','Aluguel', DOC_OPTIONS_ALUGUEL, 'NÃO TEM'],
  ['naoLancadas','NF Não Lançadas', DOC_OPTIONS_PENDCONC, 'PENDENTE'], ['regerar','Regerar', DOC_OPTIONS_PENDCONC, 'PENDENTE']
];

const IMPOSTOS_OPTIONS = [
  ['NÃO PAGA','Não paga'], ['NÃO TEM','Não tem'], ['CALCULAR','Calcular'], ['CONCLUIDO','Concluído']
];
export const IMPOSTOS_FIELDS = [
  ['difal','DIFAL', IMPOSTOS_OPTIONS, 'CALCULAR'], ['crf','CRF', IMPOSTOS_OPTIONS, 'CALCULAR'],
  ['irrf','IRRF', IMPOSTOS_OPTIONS, 'CALCULAR'], ['reinf','REINF', IMPOSTOS_OPTIONS, 'CALCULAR'],
  ['issqnPrest','ISSQN Prest.', IMPOSTOS_OPTIONS, 'CALCULAR'], ['issqnToma','ISSQN Toma.', IMPOSTOS_OPTIONS, 'CALCULAR']
];
export function getImpostosFieldsForCompany(c){
  const custom = (DATA.impostosCustom || [])
    .filter(f => (f.regimes||[]).includes(c.regime))
    .map(f => [f.key, f.label, IMPOSTOS_OPTIONS, 'CALCULAR']);
  return IMPOSTOS_FIELDS.concat(custom);
}
export function hasImpostoConcluido(c){
  const d = c.impostos || {};
  return getImpostosFieldsForCompany(c).some(([k]) => d[k] === 'CONCLUIDO');
}

const DECLARACAO_OPTIONS = [
  ['PENDENTE','Pendente'], ['SOLICITADO','Solicitado'],
  ['CLIENTE_ENVIOU','Cliente enviou'], ['RELATORIO_PREFEITURA','Relatório da Prefeitura']
];
const PREFEITURA_OPTIONS = [
  ['NÃO TEM ACESSO','Não tem acesso'], ['NÃO PRECISA','Não precisa'],
  ['PENDENTE','Pendente'], ['MOVIMENTO ENCERRADO','Movimento encerrado']
];
const DCTF_WEB_OPTIONS = [
  ['NÃO PRECISA','Não precisa'], ['FECHAR DCTF','Fechar DCTF'], ['CONCLUIDO','Concluído']
];
export const DECLARACAO_FIELDS = [
  ['declaracao','Declaração', DECLARACAO_OPTIONS, 'PENDENTE'],
  ['prefeitura','Prefeitura', PREFEITURA_OPTIONS, 'PENDENTE'],
  ['dctfWeb','DCTF WEB', DCTF_WEB_OPTIONS, 'NÃO PRECISA']
];

const DOC_RESOLVED_VALUES = new Set(['CONCLUIDO', 'NÃO TEM', 'SEM MOVIMENTO']);
export function getFieldDefault(c, padraoKey, key, builtin){
  return (c && c[padraoKey] && c[padraoKey][key]) || builtin;
}
export function getDocDefault(c, key, builtin){
  return getFieldDefault(c, 'documentosPadrao', key, builtin);
}
export function docsProgressPercent(documentos, padrao, declaracao){
  const d = documentos || {};
  const p = padrao || {};
  const dec = declaracao || {};
  let resolved = DOC_FIELDS.filter(([k, , , def]) => DOC_RESOLVED_VALUES.has(d[k] || p[k] || def)).length;
  let total = DOC_FIELDS.length;

  total++; // Declaração
  if(dec.declaracao === 'CLIENTE_ENVIOU' || dec.declaracao === 'RELATORIO_PREFEITURA') resolved++;
  total++; // Prefeitura
  if(dec.prefeitura === 'MOVIMENTO ENCERRADO') resolved++;

  return Math.round((resolved / total) * 100);
}
export function statusFromProgress(percent){
  if(percent >= 100) return 'CONCLUIDA';
  if(percent > 0) return 'ANDAMENTO';
  return 'PENDENTE';
}
