import {
  ConfiguracaoTV,
  ContratoSLC,
  HistoricoAlteracao,
  ProcessoSLC,
  SituacaoProcesso,
} from '../types/slc';
import { CONFIG_TV_INICIAL } from './slcMockData';

// Limpa chaves antigas de demonstração (v1) que continham dados mock
try {
  localStorage.removeItem('slc_digital_processos_v1');
  localStorage.removeItem('slc_digital_historico_v1');
  localStorage.removeItem('slc_digital_contratos_v1');
} catch {
  // Ignorar erros de storage
}

const STORAGE_KEYS = {
  PROCESSOS: 'slc_digital_processos_v2',
  HISTORICO: 'slc_digital_historico_v2',
  CONFIG_TV: 'slc_digital_config_tv_v2',
  CONTRATOS: 'slc_digital_contratos_v2',
};

export const API_BASE_URL =
  (import.meta as unknown as { env?: Record<string, string> }).env
    ?.VITE_API_URL || 'http://localhost:8000';

export interface StatusBackendAPI {
  online: boolean;
  modoBanco: string;
  swaggerUrl: string;
}

export type StatusPrazo =
  | 'CONCLUIDO'
  | 'VENCIDO'
  | 'PROXIMO'
  | 'NO_PRAZO'
  | 'SEM_PRAZO';

export function obterListaResponsaveisUnicos(processos: ProcessoSLC[]): string[] {
  const conjunto = new Set<string>();
  for (const p of processos) {
    if (p.responsavel && p.responsavel.trim()) {
      conjunto.add(p.responsavel.trim());
    }
  }
  return Array.from(conjunto).sort((a, b) => a.localeCompare(b, 'pt-BR'));
}

export async function sincronizarComBackendFastAPI(): Promise<{
  status: StatusBackendAPI;
  processos?: ProcessoSLC[];
  contratos?: ContratoSLC[];
  historico?: HistoricoAlteracao[];
  configTv?: ConfiguracaoTV;
}> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1800);
    const healthRes = await fetch(`${API_BASE_URL}/api/health`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!healthRes.ok) {
      throw new Error('Health check non-200');
    }
    const healthJson = await healthRes.json();

    const [procRes, contRes, histRes, tvRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/processos`),
      fetch(`${API_BASE_URL}/api/contratos`),
      fetch(`${API_BASE_URL}/api/historico`),
      fetch(`${API_BASE_URL}/api/tv/painel`),
    ]);

    const processos = (await procRes.json()) as ProcessoSLC[];
    const contratos = (await contRes.json()) as ContratoSLC[];
    const historico = (await histRes.json()) as HistoricoAlteracao[];
    const tvData = await tvRes.json();
    const configTv = tvData.configTv as ConfiguracaoTV;

    salvarProcessos(processos);
    salvarContratos(contratos);
    salvarHistorico(historico);
    salvarConfigTV(configTv);

    return {
      status: {
        online: true,
        modoBanco: healthJson?.banco?.modoAtivo || 'MySQL / SQLAlchemy',
        swaggerUrl: `${API_BASE_URL}/docs`,
      },
      processos,
      contratos,
      historico,
      configTv,
    };
  } catch {
    return {
      status: {
        online: false,
        modoBanco: 'Armazenamento Local (API Offline)',
        swaggerUrl: `${API_BASE_URL}/docs`,
      },
    };
  }
}

export async function persistirProcessoNoBackend(
  processo: ProcessoSLC,
  isNovo: boolean,
  usuarioAutor: string
): Promise<void> {
  try {
    const url = isNovo
      ? `${API_BASE_URL}/api/processos?usuario_autor=${encodeURIComponent(usuarioAutor)}`
      : `${API_BASE_URL}/api/processos/${encodeURIComponent(processo.id)}?usuario_autor=${encodeURIComponent(usuarioAutor)}`;
    await fetch(url, {
      method: isNovo ? 'POST' : 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(processo),
    });
  } catch {
    // Fallback local
  }
}

export async function excluirProcessoNoBackend(processoId: string): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/processos/${encodeURIComponent(processoId)}`, {
      method: 'DELETE',
    });
  } catch {
    // Fallback local
  }
}

export async function persistirContratoNoBackend(
  contrato: ContratoSLC
): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/contratos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(contrato),
    });
  } catch {
    // Fallback local
  }
}

export async function excluirContratoNoBackend(contratoId: string): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/contratos/${encodeURIComponent(contratoId)}`, {
      method: 'DELETE',
    });
  } catch {
    // Fallback local
  }
}

export async function persistirConfigTvNoBackend(
  config: ConfiguracaoTV
): Promise<void> {
  try {
    await fetch(`${API_BASE_URL}/api/tv/config`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
  } catch {
    // Fallback local
  }
}

export function calcularDiasAtePrazo(prazo: string | null): number | null {
  if (!prazo) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataPrazo = new Date(prazo + 'T00:00:00');
  const diffMs = dataPrazo.getTime() - hoje.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function calcularDiasSemAtualizacao(atualizadoEm: string): number {
  const agora = new Date();
  const dataAtu = new Date(atualizadoEm);
  const diffMs = agora.getTime() - dataAtu.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

export function obterStatusPrazo(
  processo: ProcessoSLC,
  diasAlertaPrazoProximo = 7
): StatusPrazo {
  if (processo.situacao === 'Concluído') return 'CONCLUIDO';
  const dias = calcularDiasAtePrazo(processo.prazo);
  if (dias === null) return 'SEM_PRAZO';
  if (dias < 0) return 'VENCIDO';
  if (dias <= diasAlertaPrazoProximo) return 'PROXIMO';
  return 'NO_PRAZO';
}

export function carregarProcessos(): ProcessoSLC[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROCESSOS);
    if (!raw) return [];
    return JSON.parse(raw) as ProcessoSLC[];
  } catch {
    return [];
  }
}

export function salvarProcessos(processos: ProcessoSLC[]): void {
  localStorage.setItem(STORAGE_KEYS.PROCESSOS, JSON.stringify(processos));
}

export function carregarHistorico(): HistoricoAlteracao[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORICO);
    if (!raw) return [];
    return JSON.parse(raw) as HistoricoAlteracao[];
  } catch {
    return [];
  }
}

export function salvarHistorico(historico: HistoricoAlteracao[]): void {
  localStorage.setItem(STORAGE_KEYS.HISTORICO, JSON.stringify(historico));
}

export function carregarConfigTV(): ConfiguracaoTV {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG_TV);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.CONFIG_TV, JSON.stringify(CONFIG_TV_INICIAL));
      return CONFIG_TV_INICIAL;
    }
    return { ...CONFIG_TV_INICIAL, ...JSON.parse(raw) };
  } catch {
    return CONFIG_TV_INICIAL;
  }
}

export function salvarConfigTV(config: ConfiguracaoTV): void {
  localStorage.setItem(STORAGE_KEYS.CONFIG_TV, JSON.stringify(config));
}

export function carregarContratos(): ContratoSLC[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONTRATOS);
    if (!raw) return [];
    return JSON.parse(raw) as ContratoSLC[];
  } catch {
    return [];
  }
}

export function salvarContratos(contratos: ContratoSLC[]): void {
  localStorage.setItem(STORAGE_KEYS.CONTRATOS, JSON.stringify(contratos));
}

export function exportarDadosParaCsv(
  nomeArquivo: string,
  cabecalhos: string[],
  linhas: Array<Array<string | number>>
): void {
  const escaparCelula = (valor: string | number) => {
    const texto = String(valor ?? '').replace(/"/g, '""');
    return `"${texto}"`;
  };

  const conteudo = [
    cabecalhos.map(escaparCelula).join(';'),
    ...linhas.map((linha) => linha.map(escaparCelula).join(';')),
  ].join('\r\n');

  const blob = new Blob(['\uFEFF' + conteudo], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', nomeArquivo);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function registrarAlteracoesProcesso(
  antigo: ProcessoSLC,
  novo: ProcessoSLC,
  usuarioAutor: string,
  historicoAtual: HistoricoAlteracao[]
): HistoricoAlteracao[] {
  const camposMonitorados: Array<{ chave: keyof ProcessoSLC; rotulo: string }> = [
    { chave: 'situacao', rotulo: 'Situação / Etapa' },
    { chave: 'responsavel', rotulo: 'Responsável' },
    { chave: 'prioridade', rotulo: 'Prioridade' },
    { chave: 'prazo', rotulo: 'Prazo' },
    { chave: 'categoria', rotulo: 'Categoria' },
    { chave: 'assunto', rotulo: 'Assunto' },
    { chave: 'pendenciaAtual', rotulo: 'Pendência Atual' },
    { chave: 'restritoTv', rotulo: 'Visibilidade na TV' },
  ];

  const novosRegistros: HistoricoAlteracao[] = [];
  const agora = new Date().toISOString();

  for (const item of camposMonitorados) {
    const valAntigo = String(antigo[item.chave] ?? '—');
    const valNovo = String(novo[item.chave] ?? '—');
    if (valAntigo !== valNovo) {
      novosRegistros.push({
        id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        processoId: novo.id,
        usuario: usuarioAutor,
        dataHora: agora,
        campo: item.rotulo,
        valorAnterior:
          item.chave === 'restritoTv'
            ? antigo.restritoTv
              ? 'Oculto na TV'
              : 'Visível na TV'
            : valAntigo,
        valorNovo:
          item.chave === 'restritoTv'
            ? novo.restritoTv
              ? 'Oculto na TV'
              : 'Visível na TV'
            : valNovo,
      });
    }
  }

  const atualizado = [...novosRegistros, ...historicoAtual];
  salvarHistorico(atualizado);
  return atualizado;
}

export interface ProcessoPublicoTV {
  id: string;
  codigoInterno: string;
  numeroEdocs: string;
  assunto: string;
  categoria: string;
  setorDemandante: string;
  responsavel?: string;
  situacao: SituacaoProcesso;
  prioridade: string;
  prazo: string | null;
  atualizadoEm: string;
  pendenciaAtual?: string;
}

export function obterProcessosSanitizadosParaTV(
  processos: ProcessoSLC[],
  config: ConfiguracaoTV
): ProcessoPublicoTV[] {
  return processos
    .filter((p) => !p.restritoTv)
    .map((p) => ({
      id: p.id,
      codigoInterno: p.codigoInterno,
      numeroEdocs: p.numeroEdocs,
      assunto: p.assunto,
      categoria: p.categoria,
      setorDemandante: p.setorDemandante,
      responsavel: config.exibirResponsavelTv ? p.responsavel : undefined,
      situacao: p.situacao,
      prioridade: p.prioridade,
      prazo: p.prazo,
      atualizadoEm: p.atualizadoEm,
      pendenciaAtual: p.pendenciaAtual,
    }));
}
