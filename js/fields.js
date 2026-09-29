/* Campos de domínio da apuração: quais colunas existem em cada bloco
   (Apuração, Impostos, Declaração, Obrigações), que opções cada uma aceita e
   como o progresso da empresa sai disso. */
import { DATA } from './state.js';

export const DOC_OPTIONS = [
  ['NÃO TEM','Não tem'], ['SEM MOVIMENTO','Sem movimento'],
  ['PENDENTE','Pendente'], ['CONCLUIDO','Concluído']
];
export const DOC_OPTIONS_ALUGUEL = [
  ['NÃO TEM','Não tem'], ['LANÇAR','Lançar'], ['CONCLUIDO','Concluído']
];
export const DOC_OPTIONS_CONFERIR = [
  ['CONFERIR','Conferir'], ['CONCLUIDO','Concluído']
];
export const DOC_FIELDS = [
  ['nfSaida','NF-E', DOC_OPTIONS, 'PENDENTE'], ['nfcSaida','NFC-E', DOC_OPTIONS, 'PENDENTE'],
  ['nfsPrestado','PRESTADO', DOC_OPTIONS, 'PENDENTE'],
  ['nfsTomado','TOMADO', DOC_OPTIONS, 'PENDENTE'], ['nfEntrada','NF DE ENTRADA', DOC_OPTIONS, 'PENDENTE'],
  ['cte','CT-E', DOC_OPTIONS, 'PENDENTE'], ['aluguel','ALUGUEL', DOC_OPTIONS_ALUGUEL, 'NÃO TEM'],
  ['naoLancadas','NOTAS NÃO LANÇADAS', DOC_OPTIONS_CONFERIR, 'CONFERIR'], ['regerar','REGERAR', DOC_OPTIONS_CONFERIR, 'CONFERIR']
];
export const DOC_FIELDS_BY_KEY = Object.fromEntries(DOC_FIELDS.map(f => [f[0], f]));
/* Agrupamento visual da Apuração, conforme o esboço: Saídas / Serviços / Entradas
   (cada uma com suas opções NÃO TEM / SEM MOVIMENTO / PENDENTE / CONCLUIDO) e,
   abaixo, Aluguel / Notas Não Lançadas / Regerar lado a lado. */
export const DOC_GROUPS = [
  ['Saídas', ['nfSaida','nfcSaida']],
  ['Serviços', ['nfsPrestado','nfsTomado']],
  ['Entradas', ['nfEntrada','cte']],
  [null, ['aluguel','naoLancadas','regerar']]
];
export function docGroupsHtml(renderField){
  return DOC_GROUPS.map(([title, keys]) => {
    const fieldsHtml = keys.map(k => renderField(k, DOC_FIELDS_BY_KEY[k])).join('');
    const titleHtml = title ? `<div class="doc-group-title">${title}</div>` : '';
    if(keys.length <= 1) return `${titleHtml}${fieldsHtml}`;
    const cls = keys.length === 2 ? 'row2' : 'row3';
    return `${titleHtml}<div class="${cls}">${fieldsHtml}</div>`;
  }).join('');
}

export const IMPOSTOS_OPTIONS = [
  ['NÃO PAGA','Não paga'], ['NÃO TEM','Não tem'], ['CALCULAR','Calcular'], ['CONCLUIDO','Concluído']
];
// ICMS, IPI e PIS/COFINS também podem ficar "Credor" (crédito a favor da empresa
// em vez de imposto a pagar) — nesse caso não faz sentido pedir vencimento nem guia,
// só o valor do crédito.
export const IMPOSTOS_OPTIONS_CREDOR = [...IMPOSTOS_OPTIONS, ['CREDOR','Credor']];
export const IMPOSTOS_KEYS_COM_CREDOR = ['sis_icms','sis_ipi','sis_pis_cofins'];

// Impostos padrão do sistema: já vêm prontos por regime, não podem ser removidos
// (só ativados/desativados globalmente em "Gerenciar Impostos", ou por empresa
// específica direto no perfil dela).
export const IMPOSTOS_SISTEMA = [
  { key: 'sis_efd_reinf',        label: 'EFD-Reinf',       regimes: ['SIMPLES NACIONAL','LUCRO PRESUMIDO','LUCRO REAL'] },
  { key: 'sis_difal',            label: 'DIFAL',            regimes: ['SIMPLES NACIONAL','LUCRO PRESUMIDO','LUCRO REAL'] },
  { key: 'sis_icms_equalizacao', label: 'ICMS EQUALIZAÇÃO', regimes: ['SIMPLES NACIONAL'] },
  { key: 'sis_icms',             label: 'ICMS',             regimes: ['LUCRO PRESUMIDO','LUCRO REAL'] },
  { key: 'sis_ipi',              label: 'IPI',              regimes: ['LUCRO PRESUMIDO','LUCRO REAL'] },
  { key: 'sis_pis_cofins',       label: 'PIS e COFINS',     regimes: ['LUCRO PRESUMIDO','LUCRO REAL'] },
  { key: 'sis_issqn_prestado',   label: 'ISSQN Prestado',   regimes: ['LUCRO PRESUMIDO','LUCRO REAL'] },
  { key: 'sis_issqn_tomado',     label: 'ISSQN Tomado',     regimes: ['LUCRO PRESUMIDO','LUCRO REAL'] }
];
// true = ativo (padrão), a menos que esteja na lista de desativados globalmente
export function impostoSistemaAtivoGlobal(key){
  return !((DATA.impostosSistemaDesativados || []).includes(key));
}
// resolve o estado final pra uma empresa: override dela (se existir) manda mais
// que o padrão global
export function impostoSistemaAtivoParaEmpresa(c, key){
  const overrideVal = (c.impostosSistemaOverride || {})[key];
  if(overrideVal === 'ATIVO') return true;
  if(overrideVal === 'INATIVO') return false;
  return impostoSistemaAtivoGlobal(key);
}
export function temImpostosSistemaPraRegime(c){
  return !!c.regime && IMPOSTOS_SISTEMA.some(item => item.regimes.includes(c.regime));
}
export function getImpostosFieldsForCompany(c){
  if(!c.regime) return [];
  const doSistema = IMPOSTOS_SISTEMA
    .filter(item => item.regimes.includes(c.regime))
    .filter(item => impostoSistemaAtivoParaEmpresa(c, item.key))
    .map(item => [item.key, item.label, IMPOSTOS_KEYS_COM_CREDOR.includes(item.key) ? IMPOSTOS_OPTIONS_CREDOR : IMPOSTOS_OPTIONS, 'CALCULAR']);
  const custom = (DATA.impostosCustom || [])
    .filter(f => (f.regimes||[]).includes(c.regime))
    .map(f => [f.key, f.label, IMPOSTOS_OPTIONS, 'CALCULAR']);
  return [...doSistema, ...custom];
}
export function hasImpostoConcluido(c){
  const d = c.impostos || {};
  return getImpostosFieldsForCompany(c).some(([k]) => d[k] === 'CONCLUIDO');
}

export const DECLARACAO_OPTIONS = [
  ['PENDENTE','Pendente'], ['SOLICITADO','Solicitado'],
  ['CLIENTE_ENVIOU','Cliente enviou'], ['RELATORIO_PREFEITURA','Relatório da Prefeitura']
];
export const PREFEITURA_OPTIONS = [
  ['NÃO TEM ACESSO','Não tem acesso'], ['NÃO PRECISA','Não precisa'],
  ['PENDENTE','Pendente'], ['MOVIMENTO ENCERRADO','Movimento encerrado']
];
export const DCTF_WEB_OPTIONS = [
  ['NÃO PRECISA','Não precisa'], ['FECHAR DCTF','Fechar DCTF'], ['CONCLUIDO','Concluído']
];
export const DECLARACAO_FIELDS = [
  ['declaracao','DECLARAÇÃO', DECLARACAO_OPTIONS, 'PENDENTE'],
  ['prefeitura','FECHAR MOVIMENTO NA PREFEITURA', PREFEITURA_OPTIONS, 'PENDENTE'],
  ['dctfWeb','DCTF WEB', DCTF_WEB_OPTIONS, 'NÃO PRECISA']
];
// DCTF WEB só fica junto de Declaração/Prefeitura pro Simples Nacional;
// pra Presumido/Real ele se muda pra dentro de Obrigações, ao lado de Entrega MIT.
export function getDeclaracaoFieldsForCompany(c){
  return DECLARACAO_FIELDS.filter(([k]) => k !== 'dctfWeb' || c.regime === 'SIMPLES NACIONAL');
}
export function regimeTemObrigacoes(c){
  return c.regime === 'LUCRO PRESUMIDO' || c.regime === 'LUCRO REAL';
}
export const OBRIGACOES_OPTIONS = [
  ['PENDENTE','Pendente'], ['CONCLUIDO','Concluído']
];
export const OBRIGACOES_FIELDS_BASE = [
  ['entregaMit','ENTREGA DE MIT', OBRIGACOES_OPTIONS, 'PENDENTE']
];
// pra Presumido/Real, o DCTF WEB aparece aqui dentro (ao lado do Entrega MIT)
// em vez de lá em cima, na Declaração
export function getObrigacoesFieldsForCompany(c){
  if(!regimeTemObrigacoes(c)) return [];
  return [...OBRIGACOES_FIELDS_BASE, ['dctfWeb','DCTF WEB', DCTF_WEB_OPTIONS, 'NÃO PRECISA']];
}

export const DOC_RESOLVED_VALUES = new Set(['CONCLUIDO', 'NÃO TEM', 'SEM MOVIMENTO']);
export function getFieldDefault(c, padraoKey, key, builtin){
  return (c && c[padraoKey] && c[padraoKey][key]) || builtin;
}
export function getDocDefault(c, key, builtin){
  return getFieldDefault(c, 'documentosPadrao', key, builtin);
}
export function atualizarStatusEData(c, pct){
  const statusAnterior = c.status;
  c.status = statusFromProgress(pct);
  if(c.status === 'CONCLUIDA' && statusAnterior !== 'CONCLUIDA'){
    c.dataConcluida = new Date().toISOString();
  } else if(c.status !== 'CONCLUIDA'){
    c.dataConcluida = '';
  }
}

export function docsProgressPercent(documentos, padrao, declaracao, regime, obrigacoes, fatorR, fatorRStatus){
  const d = documentos || {};
  const p = padrao || {};
  const dec = declaracao || {};
  const obrig = obrigacoes || {};
  let resolved = DOC_FIELDS.filter(([k, , , def]) => DOC_RESOLVED_VALUES.has(d[k] || p[k] || def)).length;
  let total = DOC_FIELDS.length;

  total++; // Declaração
  if(dec.declaracao === 'CLIENTE_ENVIOU' || dec.declaracao === 'RELATORIO_PREFEITURA') resolved++;
  total++; // Fechar movimento na prefeitura
  if(dec.prefeitura === 'NÃO TEM ACESSO' || dec.prefeitura === 'NÃO PRECISA' || dec.prefeitura === 'MOVIMENTO ENCERRADO') resolved++;
  total++; // DCTF WEB
  if(dec.dctfWeb === 'NÃO PRECISA' || dec.dctfWeb === 'CONCLUIDO') resolved++;

  if(regime === 'LUCRO PRESUMIDO' || regime === 'LUCRO REAL'){
    total++; // Entrega MIT
    if(obrig.entregaMit === 'CONCLUIDO') resolved++;
  }

  if(fatorR === 'SIM'){
    total++; // Fator R
    if(fatorRStatus === 'CONCLUIDO') resolved++;
  }

  return Math.round((resolved / total) * 100);
}
export function statusFromProgress(percent){
  if(percent >= 100) return 'CONCLUIDA';
  if(percent > 40) return 'ANDAMENTO';
  return 'PENDENTE';
}

/* ---------------- REINF: de qual tributo aquela apuração é ---------------- */
export const REINF_TIPOS = [['CSLL','CSLL'], ['IRRF','IRRF'], ['IRRF_ALUGUEL','IRRF Aluguel']];
export function isReinfLabel(label){ return /reinf/i.test(label||''); }
