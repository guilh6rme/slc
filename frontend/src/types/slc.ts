export type CategoriaProcesso =
  | 'Licitação (Pregão/Concorrência)'
  | 'Contratação Direta (Dispensa/Inexig.)'
  | 'Formalização de Contrato'
  | 'Aditivo / Prorrogação / Apostilamento'
  | 'Pesquisa de Preços / ETP / TR'
  | 'Designação de Gestor/Fiscal'
  | 'Outros Processos Administrativos';

export type SituacaoProcesso =
  | 'Recebido pela SLC'
  | 'Em análise'
  | 'Aguardando documentação'
  | 'Em elaboração'
  | 'Aguardando aprovação'
  | 'Em andamento externo'
  | 'Concluído';

export type PrioridadeProcesso = 'Baixa' | 'Média' | 'Alta' | 'Crítica';

export type PerfilUsuario = 'GESTOR_SLC' | 'SERVIDOR_SLC' | 'CONSULTA';

export interface HistoricoAlteracao {
  id: string;
  processoId: string;
  usuario: string;
  dataHora: string; // ISO string
  campo: string;
  valorAnterior: string;
  valorNovo: string;
}

export interface ProcessoSLC {
  id: string;
  codigoInterno: string;
  numeroEdocs: string;
  assunto: string;
  objetoDetalhado: string;
  categoria: CategoriaProcesso;
  setorDemandante: string;
  responsavel: string;
  dataEntrada: string; // YYYY-MM-DD
  situacao: SituacaoProcesso;
  prioridade: PrioridadeProcesso;
  prazo: string | null; // YYYY-MM-DD
  atualizadoEm: string; // ISO string
  observacoesInternas: string; // Nunca exibido na TV
  pendenciaAtual?: string;
  restritoTv: boolean; // Se true, não aparece na TV
  linkEdocs?: string;
}

export interface ConfiguracaoTV {
  intervaloSegundos: number;
  exibirResponsavelTv: boolean;
  diasAlertaInatividade: number;
  diasAlertaPrazoProximo: number;
}

export type StatusGarantia =
  | 'Vigente'
  | 'Pendente de Renovação'
  | 'Isento / Não Exigida';

export interface CndItem {
  validade: string;
  pecaEdocs: string;
}

export interface CndsContrato {
  municipal?: CndItem;
  estadual_es?: CndItem;
  estadual?: CndItem;
  federal?: CndItem;
  trabalhista?: CndItem;
  fgts?: CndItem;
}

export interface ExecucaoMensalItem {
  mes: string;
  valor: number;
  nf: string;
  medicao: string;
}

export interface ContratoSLC {
  id: string;
  numeroContrato: string;
  numeroEdocs: string; // Processo Mãe (E-Docs)
  processoPagamento?: string; // Processo Pagamento 2026 (E-Docs)
  idTces?: string; // Código CidadES TCE-ES
  abaPlanilha?: string; // Aba original na planilha XLSM
  grupoPlanilha?: string; // S (Contratos Gerais), S2 (Peritos Médicos), S5 (INSS)
  empresaContratada: string;
  razaoSocial?: string;
  cnpj: string;
  objeto: string;
  objetoCompleto?: string;
  modalidadeContratacao?: string;
  setorDemandante: string;
  valorGlobal: number; // Empenho Total
  totalGasto?: number; // Total Gasto Acumulado
  saldoDisponivel: number; // Saldo de Empenho
  mediaMensal?: number; // Gasto Médio/Mês
  reforcoEmpenho?: string; // Projeção Reforço Empenho
  valorRpps?: number; // Empenho Fundo Previdenciário
  neRpps?: string; // Notas de Empenho RPPS
  valorFps?: number; // Empenho Fundo Financeiro
  neFps?: string; // Notas de Empenho FPS
  inicioVigencia: string;
  fimVigencia: string;
  duracaoMmMax?: string; // Ex: 12/060, 36/120
  dataDuracaoMaxima?: string; // Limite legal
  prorrogavel: boolean; // P vs NP
  optanteSimples?: string; // S, N, NC, -
  regraPagamento?: string; // 10U, 15C, 30D
  retencaoIr?: string;
  statusGarantia: StatusGarantia;
  modalidadeGarantia?: string; // SG, CAUÇÃO, NASC
  validadeGarantia?: string;
  gestorContrato: string;
  gestorSuplente?: string;
  fiscalTitular: string;
  fiscalSuplente: string;
  fiscaisAdicionais?: string; // F2..F9
  cndsJson?: string;
  sancaoCeis?: string;
  execucaoMensalJson?: string;
  prepostoContato?: string;
  emailContratada?: string;
  ultimoTermo: string;
  portariaFiscalizacao: string;
}

export const CATEGORIAS_SLC: CategoriaProcesso[] = [
  'Licitação (Pregão/Concorrência)',
  'Contratação Direta (Dispensa/Inexig.)',
  'Formalização de Contrato',
  'Aditivo / Prorrogação / Apostilamento',
  'Pesquisa de Preços / ETP / TR',
  'Designação de Gestor/Fiscal',
  'Outros Processos Administrativos',
];

export const ETAPAS_KANBAN: SituacaoProcesso[] = [
  'Recebido pela SLC',
  'Em análise',
  'Aguardando documentação',
  'Em elaboração',
  'Aguardando aprovação',
  'Em andamento externo',
  'Concluído',
];

export const SETORES_DEMANDANTES: string[] = [
  'SAG — Subgerência Administrativa Geral',
  'GTI — Gerência de Tecnologia da Informação',
  'GPMS — Gerência de Perícia Médica e Social',
  'GAD — Gerência Administrativa',
  'GJP — Gerência Jurídica Previdenciária',
  'SRH — Subgerência de Recursos Humanos',
  'DIN — Diretoria de Investimentos',
  'GFI — Gerência Financeira',
  'GGA — Gerência de Gestão Atuarial',
  'SCP — Subgerência de Contabilidade / Compensação',
  'SSE — Subgerência de Serviços Especiais',
  'UGP — Unidade de Gestão de Projetos',
  'SLC — Subgerência de Licitações e Contratos',
  'CPAD — Coord. de Protocolo e Acervo Documental',
  'SAR — Subgerência de Arrecadação',
  'DMS — Diretoria / Concurso',
];
