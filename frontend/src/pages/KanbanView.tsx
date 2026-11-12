import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Columns3,
  ExternalLink,
  Eye,
  EyeOff,
  FileCheck2,
  Flame,
  GripVertical,
  Layers,
  Lock,
  Search,
  ShieldAlert,
  Table2,
  TrendingUp,
  User,
  Wallet,
} from 'lucide-react';
import {
  CATEGORIAS_SLC,
  CndsContrato,
  ConfiguracaoTV,
  ContratoSLC,
  ETAPAS_KANBAN,
  ExecucaoMensalItem,
  ProcessoSLC,
  SituacaoProcesso,
} from '../types/slc';
import { PrazoBadge, PrioridadeBadge } from '../components/StatusBadges';
import {
  calcularDiasAtePrazo,
  obterListaResponsaveisUnicos,
} from '../services/slcService';

interface KanbanViewProps {
  processos: ProcessoSLC[];
  contratos?: ContratoSLC[];
  configTv: ConfiguracaoTV;
  onSelecionarProcesso: (p: ProcessoSLC, modo: 'detalhes' | 'editar') => void;
  onMoverEtapa: (processo: ProcessoSLC, novaEtapa: SituacaoProcesso) => void;
}

type ModoVisualizacaoM3 = 'ACOES_SLC' | 'MATRIZ_MENSAL' | 'KANBAN_EDOCS';

const MESES_EXECUCAO: string[] = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

interface CndVencidaInfo {
  nome: string;
  data: string;
  dias: number;
}

function formatarMoedaBRL(valor: number): string {
  return (valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatarDataBR(iso?: string | null): string {
  if (!iso || iso.length < 10) return iso || '—';
  try {
    return new Date(iso.slice(0, 10) + 'T00:00:00').toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

function parseExecucaoMensal(c: ContratoSLC): ExecucaoMensalItem[] {
  if (!c.execucaoMensalJson) return [];
  try {
    const parsed = JSON.parse(c.execucaoMensalJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseReforcoNumerico(reforco?: string): number {
  if (!reforco) return 0;
  const limpo = reforco
    .replace(/[R$\s]/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const n = parseFloat(limpo);
  return isNaN(n) || n <= 0 ? 0 : n;
}

function obterCndsVencidasContrato(c: ContratoSLC): CndVencidaInfo[] {
  if (!c.cndsJson) return [];
  let cnds: CndsContrato = {};
  try {
    cnds = JSON.parse(c.cndsJson);
  } catch {
    return [];
  }

  const lista: { nome: string; validade?: string }[] = [
    { nome: 'Municipal', validade: cnds.municipal?.validade },
    { nome: 'Estadual (ES)', validade: cnds.estadual_es?.validade },
    { nome: 'Estadual', validade: cnds.estadual?.validade },
    { nome: 'Federal/INSS', validade: cnds.federal?.validade },
    { nome: 'Trabalhista', validade: cnds.trabalhista?.validade },
    { nome: 'FGTS', validade: cnds.fgts?.validade },
  ];

  const vencidas: CndVencidaInfo[] = [];
  for (const item of lista) {
    if (!item.validade || !/^\d{4}-\d{2}-\d{2}/.test(item.validade)) continue;
    const dataIso = item.validade.slice(0, 10);
    const dias = calcularDiasAtePrazo(dataIso);
    if (dias !== null && dias < 0) {
      vencidas.push({ nome: item.nome, data: dataIso, dias });
    }
  }
  return vencidas;
}

function formatarValorCurto(valor: number): string {
  if (!valor || valor <= 0) return '—';
  if (valor >= 1_000_000) {
    return `${(valor / 1_000_000).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}M`;
  }
  if (valor >= 1_000) {
    return `${(valor / 1_000).toLocaleString('pt-BR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })}k`;
  }
  return valor.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export const KanbanView: React.FC<KanbanViewProps> = ({
  processos,
  contratos = [],
  configTv,
  onSelecionarProcesso,
  onMoverEtapa,
}) => {
  const [modoM3, setModoM3] = useState<ModoVisualizacaoM3>('ACOES_SLC');

  // Filtros globais da visão híbrida
  const [busca, setBusca] = useState<string>('');
  const [filtroSetor, setFiltroSetor] = useState<string>('TODOS');
  const [mostrarRegularesCompletos, setMostrarRegularesCompletos] =
    useState<boolean>(false);

  // Estados específicos do mapa de execução mensal (Jan-Dez)
  const [mesReferencia, setMesReferencia] = useState<string>('Out');
  const [filtroExecucaoMensal, setFiltroExecucaoMensal] = useState<
    'TODOS' | 'PAGOS_MES' | 'PENDENTES_MES' | 'CND_VENCIDA' | 'REFORCO_EMPENHO'
  >('TODOS');
  const [contratoExpandidoMatrizId, setContratoExpandidoMatrizId] = useState<
    string | null
  >(null);

  // Estados do kanban E-Docs clássico (Modo 3)
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODAS');
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>('TODOS');
  const [ocultarConcluidosKanban, setOcultarConcluidosKanban] =
    useState<boolean>(true);
  const [processoArrastandoId, setProcessoArrastandoId] = useState<string | null>(
    null
  );
  const [colunaAlvo, setColunaAlvo] = useState<SituacaoProcesso | null>(null);

  // Mapa rápido numeroEdocs -> ProcessoSLC para vincular cada contrato ao seu processo
  const mapaProcessoPorEdocs = useMemo(() => {
    const map = new Map<string, ProcessoSLC>();
    for (const p of processos) {
      map.set(p.numeroEdocs, p);
    }
    return map;
  }, [processos]);

  const obterProcessoDoContrato = (c: ContratoSLC): ProcessoSLC | undefined => {
    if (c.numeroEdocs && mapaProcessoPorEdocs.has(c.numeroEdocs)) {
      return mapaProcessoPorEdocs.get(c.numeroEdocs);
    }
    return processos.find((p) =>
      p.assunto.toLowerCase().includes(c.numeroContrato.toLowerCase())
    );
  };

  const setoresUnicos = useMemo(() => {
    const s = new Set<string>();
    contratos.forEach((c) => {
      if (c.setorDemandante) s.add(c.setorDemandante);
    });
    return Array.from(s).sort();
  }, [contratos]);

  // Filtro base de contratos para modo 1 e modo 2
  const contratosFiltradosBase = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return contratos.filter((c) => {
      const matchSetor =
        filtroSetor === 'TODOS' || c.setorDemandante === filtroSetor;
      if (!matchSetor) return false;
      if (!termo) return true;
      return (
        c.numeroContrato.toLowerCase().includes(termo) ||
        c.empresaContratada.toLowerCase().includes(termo) ||
        (c.razaoSocial || '').toLowerCase().includes(termo) ||
        c.objeto.toLowerCase().includes(termo) ||
        c.numeroEdocs.toLowerCase().includes(termo) ||
        (c.processoPagamento || '').toLowerCase().includes(termo) ||
        c.gestorContrato.toLowerCase().includes(termo) ||
        (c.abaPlanilha || '').toLowerCase() === termo
      );
    });
  }, [contratos, busca, filtroSetor]);

  // ============================================================================
  // CLASSIFICAÇÃO EM 5 FRENTES DE AÇÃO REAIS DA SLC (MODO 1)
  // ============================================================================
  const frentesAcaoSLC = useMemo(() => {
    const criticosRenovacao: {
      contrato: ContratoSLC;
      dias: number;
      cndsVencidas: CndVencidaInfo[];
      reforcoVal: number;
      processo?: ProcessoSLC;
    }[] = [];
    const janelaPlanejamento: {
      contrato: ContratoSLC;
      dias: number;
      cndsVencidas: CndVencidaInfo[];
      reforcoVal: number;
      processo?: ProcessoSLC;
    }[] = [];
    const bloqueioDocumentalCnd: {
      contrato: ContratoSLC;
      dias: number;
      cndsVencidas: CndVencidaInfo[];
      reforcoVal: number;
      processo?: ProcessoSLC;
    }[] = [];
    const alertaReforcoEmpenho: {
      contrato: ContratoSLC;
      dias: number;
      cndsVencidas: CndVencidaInfo[];
      reforcoVal: number;
      processo?: ProcessoSLC;
    }[] = [];
    const execucaoRegular: {
      contrato: ContratoSLC;
      dias: number;
      cndsVencidas: CndVencidaInfo[];
      reforcoVal: number;
      processo?: ProcessoSLC;
    }[] = [];

    const ordenados = [...contratosFiltradosBase].sort(
      (a, b) =>
        (calcularDiasAtePrazo(a.fimVigencia) ?? 9999) -
        (calcularDiasAtePrazo(b.fimVigencia) ?? 9999)
    );

    for (const c of ordenados) {
      const dias = calcularDiasAtePrazo(c.fimVigencia) ?? 999;
      const cndsVencidas = obterCndsVencidasContrato(c);
      const reforcoVal = parseReforcoNumerico(c.reforcoEmpenho);
      const proc = obterProcessoDoContrato(c);
      const item = {
        contrato: c,
        dias,
        cndsVencidas,
        reforcoVal,
        processo: proc,
      };

      if (dias <= 90) {
        criticosRenovacao.push(item);
      } else if (dias <= 180) {
        janelaPlanejamento.push(item);
      } else if (cndsVencidas.length > 0) {
        bloqueioDocumentalCnd.push(item);
      } else if (reforcoVal > 0) {
        alertaReforcoEmpenho.push(item);
      } else {
        execucaoRegular.push(item);
      }
    }

    return {
      criticosRenovacao,
      janelaPlanejamento,
      bloqueioDocumentalCnd,
      alertaReforcoEmpenho,
      execucaoRegular,
    };
  }, [contratosFiltradosBase, mapaProcessoPorEdocs]);

  // ============================================================================
  // DADOS DO MAPA DE EXECUÇÃO MENSAL JAN-DEZ (MODO 2)
  // ============================================================================
  const resumoExecucaoMensal = useMemo(() => {
    const totalEmpenhado = contratosFiltradosBase.reduce(
      (acc, c) => acc + (c.valorGlobal || 0),
      0
    );
    const totalPagoAno = contratosFiltradosBase.reduce(
      (acc, c) => acc + (c.totalGasto || 0),
      0
    );
    const totalSaldo = contratosFiltradosBase.reduce(
      (acc, c) => acc + (c.saldoDisponivel || 0),
      0
    );

    let qtdPagosNoMes = 0;
    let totalPagoNoMes = 0;

    for (const c of contratosFiltradosBase) {
      const exec = parseExecucaoMensal(c);
      const reg = exec.find(
        (x) => x.mes.toLowerCase() === mesReferencia.toLowerCase()
      );
      if (reg && reg.valor > 0) {
        qtdPagosNoMes += 1;
        totalPagoNoMes += reg.valor;
      }
    }

    const qtdComReforco = contratosFiltradosBase.filter(
      (c) => parseReforcoNumerico(c.reforcoEmpenho) > 0
    ).length;

    return {
      totalEmpenhado,
      totalPagoAno,
      totalSaldo,
      qtdPagosNoMes,
      qtdPendentesNoMes: contratosFiltradosBase.length - qtdPagosNoMes,
      totalPagoNoMes,
      qtdComReforco,
    };
  }, [contratosFiltradosBase, mesReferencia]);

  const contratosMatrizFiltrados = useMemo(() => {
    return contratosFiltradosBase
      .filter((c) => {
        if (filtroExecucaoMensal === 'TODOS') return true;
        const exec = parseExecucaoMensal(c);
        const m = exec.find(
          (x) => x.mes.toLowerCase() === mesReferencia.toLowerCase()
        );
        const pagoMes = !!(m && m.valor > 0);
        if (filtroExecucaoMensal === 'PAGOS_MES') return pagoMes;
        if (filtroExecucaoMensal === 'PENDENTES_MES') return !pagoMes;
        if (filtroExecucaoMensal === 'CND_VENCIDA')
          return obterCndsVencidasContrato(c).length > 0;
        if (filtroExecucaoMensal === 'REFORCO_EMPENHO')
          return parseReforcoNumerico(c.reforcoEmpenho) > 0;
        return true;
      })
      .sort((a, b) => {
        const numA = parseInt(a.abaPlanilha || '999', 10);
        const numB = parseInt(b.abaPlanilha || '999', 10);
        return numA - numB;
      });
  }, [contratosFiltradosBase, filtroExecucaoMensal, mesReferencia]);

  // ============================================================================
  // DADOS DO KANBAN E-DOCS POR ETAPA (MODO 3)
  // ============================================================================
  const responsaveisUnicos = useMemo(
    () => obterListaResponsaveisUnicos(processos),
    [processos]
  );

  const processosKanbanFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return processos.filter((p) => {
      const matchCat =
        filtroCategoria === 'TODAS' || p.categoria === filtroCategoria;
      const matchResp =
        filtroResponsavel === 'TODOS' || p.responsavel === filtroResponsavel;
      const matchSetor =
        filtroSetor === 'TODOS' || p.setorDemandante === filtroSetor;
      const matchBusca =
        !termo ||
        p.numeroEdocs.toLowerCase().includes(termo) ||
        p.assunto.toLowerCase().includes(termo) ||
        p.responsavel.toLowerCase().includes(termo);
      return matchCat && matchResp && matchSetor && matchBusca;
    });
  }, [processos, filtroCategoria, filtroResponsavel, filtroSetor, busca]);

  const etapasVisiveisKanban = useMemo(() => {
    if (ocultarConcluidosKanban) {
      return ETAPAS_KANBAN.filter((e) => e !== 'Concluído');
    }
    return ETAPAS_KANBAN;
  }, [ocultarConcluidosKanban]);

  const moverParaIndice = (proc: ProcessoSLC, delta: number) => {
    const idxAtual = ETAPAS_KANBAN.indexOf(proc.situacao);
    const novoIdx = idxAtual + delta;
    if (novoIdx >= 0 && novoIdx < ETAPAS_KANBAN.length) {
      onMoverEtapa(proc, ETAPAS_KANBAN[novoIdx]);
    }
  };

  const handleDragStart = (e: React.DragEvent, proc: ProcessoSLC) => {
    e.dataTransfer.setData('text/plain', proc.id);
    e.dataTransfer.effectAllowed = 'move';
    setProcessoArrastandoId(proc.id);
  };

  const handleDragOver = (e: React.DragEvent, etapa: SituacaoProcesso) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (colunaAlvo !== etapa) {
      setColunaAlvo(etapa);
    }
  };

  const handleDrop = (e: React.DragEvent, etapaDestino: SituacaoProcesso) => {
    e.preventDefault();
    setColunaAlvo(null);
    const id = e.dataTransfer.getData('text/plain') || processoArrastandoId;
    setProcessoArrastandoId(null);
    if (!id) return;
    const proc = processos.find((p) => p.id === id);
    if (proc && proc.situacao !== etapaDestino) {
      onMoverEtapa(proc, etapaDestino);
    }
  };

  const coresTopoColuna: Record<SituacaoProcesso, string> = {
    'Recebido pela SLC': 'bg-indigo-500',
    'Em análise': 'bg-blue-600',
    'Aguardando documentação': 'bg-amber-500',
    'Em elaboração': 'bg-cyan-500',
    'Aguardando aprovação': 'bg-purple-500',
    'Em andamento externo': 'bg-orange-500',
    Concluído: 'bg-emerald-500',
  };

  // Renderizador de card de ação da SLC (Modo 1)
  const renderCardAcaoSLC = (
    item: {
      contrato: ContratoSLC;
      dias: number;
      cndsVencidas: CndVencidaInfo[];
      reforcoVal: number;
      processo?: ProcessoSLC;
    },
    tipoColuna: 'CRITICO' | 'PLANEJAMENTO' | 'CND' | 'EMPENHO' | 'REGULAR'
  ) => {
    const {
      contrato: c,
      dias,
      cndsVencidas,
      reforcoVal,
      processo: proc,
    } = item;
    const isProrrogavel = c.prorrogavel;
    const siglaSetor = c.setorDemandante.split('—')[0].trim();

    return (
      <div
        key={c.id}
        className="group flex flex-col justify-between rounded-xl border border-slate-200/90 bg-white p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-950/90 dark:hover:border-slate-700"
      >
        <div>
          {/* Topo: Aba + Badge P/NP + Sigla do Setor */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {c.abaPlanilha && (
                <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-extrabold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                  #{c.abaPlanilha}
                </span>
              )}
              <span
                title={
                  isProrrogavel
                    ? 'P — Contrato Prorrogável'
                    : 'NP — Não Prorrogável (Exige Nova Licitação)'
                }
                className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold ${
                  isProrrogavel
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                    : 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300'
                }`}
              >
                {isProrrogavel ? 'P · Prorrogável' : 'NP · Licitar'}
              </span>
            </div>
            <span
              title={c.setorDemandante}
              className="shrink-0 rounded-md bg-blue-50 px-2 py-0.5 text-[10px] font-extrabold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300"
            >
              {siglaSetor}
            </span>
          </div>

          {/* Número do contrato com espaço total */}
          <div className="mt-2 font-mono text-xs font-extrabold text-blue-600 dark:text-sky-400">
            CT {c.numeroContrato}
          </div>

          {/* Credor e objeto */}
          <h4 className="mt-1 line-clamp-1 text-xs font-extrabold text-slate-900 dark:text-white">
            {c.empresaContratada}
          </h4>
          <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500 dark:text-slate-400">
            {c.objeto}
          </p>

          {/* Gatilho específico da coluna */}
          {tipoColuna === 'CRITICO' && (
            <div className="mt-2.5 rounded-lg border border-rose-200 bg-rose-50/90 px-2.5 py-2 text-[11px] dark:border-rose-500/30 dark:bg-rose-950/40">
              <div className="flex items-center justify-between font-extrabold text-rose-700 dark:text-rose-300">
                <span>
                  {dias < 0
                    ? `Vencido há ${Math.abs(dias)}d`
                    : `Vence em ${dias} dias`}
                </span>
                <span>{formatarDataBR(c.fimVigencia)}</span>
              </div>
              <p className="mt-1 text-[10px] font-semibold leading-snug text-rose-600 dark:text-rose-200/80">
                Ação:{' '}
                {isProrrogavel
                  ? 'Instruir Termo Aditivo de Prorrogação (P)'
                  : 'Instruir Nova Contratação / Licitação (NP)'}
              </p>
            </div>
          )}

          {tipoColuna === 'PLANEJAMENTO' && (
            <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50/90 px-2.5 py-2 text-[11px] dark:border-amber-500/30 dark:bg-amber-950/40">
              <div className="flex items-center justify-between font-extrabold text-amber-800 dark:text-amber-300">
                <span>Faltam {dias} dias</span>
                <span>{formatarDataBR(c.fimVigencia)}</span>
              </div>
              <p className="mt-1 text-[10px] font-semibold leading-snug text-amber-700 dark:text-amber-200/80">
                Ação: Consultar gestor ({siglaSetor}) sobre{' '}
                {isProrrogavel ? 'renovação [P]' : 'novo TR [NP]'}
              </p>
            </div>
          )}

          {tipoColuna === 'CND' && cndsVencidas.length > 0 && (
            <div className="mt-2.5 rounded-lg border border-orange-200 bg-orange-50/90 px-2.5 py-2 text-[11px] dark:border-orange-500/30 dark:bg-orange-950/40">
              <div className="font-extrabold text-orange-800 dark:text-orange-300">
                {cndsVencidas.length} CND(s) vencida(s):
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {cndsVencidas.map((cv) => (
                  <span
                    key={cv.nome}
                    className="rounded bg-orange-200/80 px-1.5 py-0.5 text-[10px] font-bold text-orange-900 dark:bg-orange-500/30 dark:text-orange-200"
                  >
                    {cv.nome} ({formatarDataBR(cv.data)})
                  </span>
                ))}
              </div>
            </div>
          )}

          {tipoColuna === 'EMPENHO' && (
            <div className="mt-2.5 rounded-lg border border-purple-200 bg-purple-50/90 px-2.5 py-2 text-[11px] dark:border-purple-500/30 dark:bg-purple-950/40">
              <div className="flex items-center justify-between font-extrabold text-purple-800 dark:text-purple-300">
                <span>Reforço Estimado:</span>
                <span>{formatarMoedaBRL(reforcoVal)}</span>
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-between gap-1 text-[10px] font-semibold text-purple-700 dark:text-purple-200/80">
                <span>Saldo: {formatarValorCurto(c.saldoDisponivel)}</span>
                <span>Média: {formatarValorCurto(c.mediaMensal || 0)}/mês</span>
              </div>
            </div>
          )}

          {tipoColuna === 'REGULAR' && (
            <div className="mt-2.5 flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-900 dark:text-slate-300">
              <span>
                Término: {formatarDataBR(c.fimVigencia)} ({dias}d)
              </span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">
                Saldo: {formatarValorCurto(c.saldoDisponivel)}
              </span>
            </div>
          )}

          {/* Processos E-Docs vinculados (mãe e pagto) */}
          <div className="mt-2.5 grid grid-cols-2 gap-1.5 text-[10px]">
            <div className="min-w-0 rounded border border-slate-200/80 bg-slate-50/70 px-2 py-1 dark:border-slate-800 dark:bg-slate-900/60">
              <span className="block text-[9px] font-bold uppercase text-slate-400">
                Proc. mãe
              </span>
              <span className="block truncate font-mono font-bold text-blue-600 dark:text-blue-400">
                {c.numeroEdocs}
              </span>
            </div>
            <div className="min-w-0 rounded border border-slate-200/80 bg-slate-50/70 px-2 py-1 dark:border-slate-800 dark:bg-slate-900/60">
              <span className="block text-[9px] font-bold uppercase text-slate-400">
                Proc. pagto 2026
              </span>
              <span className="block truncate font-mono font-bold text-emerald-700 dark:text-emerald-400">
                {c.processoPagamento || '—'}
              </span>
            </div>
          </div>
        </div>

        {/* Rodapé do card: Etapa E-Docs + botão abrir processo */}
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-2.5 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-[11px]">
            <span className="inline-flex items-center gap-1 truncate font-medium text-slate-600 dark:text-slate-400">
              <User className="h-3 w-3 shrink-0 text-slate-400" />
              <span className="truncate">{c.gestorContrato}</span>
            </span>
            {proc && (
              <button
                type="button"
                onClick={() => onSelecionarProcesso(proc, 'detalhes')}
                className="inline-flex shrink-0 items-center gap-1 font-bold text-blue-600 hover:underline dark:text-blue-400"
              >
                Abrir E-Docs <ExternalLink className="h-3 w-3" />
              </button>
            )}
          </div>

          {proc && (
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-slate-400">
                Etapa:
              </span>
              <select
                value={proc.situacao}
                onChange={(e) =>
                  onMoverEtapa(proc, e.target.value as SituacaoProcesso)
                }
                className="flex-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-bold text-slate-700 focus:border-blue-500 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
              >
                {ETAPAS_KANBAN.map((et) => (
                  <option key={et} value={et}>
                    {et}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Cabeçalho híbrido M3 com seletor de modo + filtros rápidos */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          {/* Seletor das 3 visões híbridas */}
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-100 p-1.5 dark:bg-slate-950">
            <button
              type="button"
              onClick={() => setModoM3('ACOES_SLC')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-extrabold transition ${
                modoM3 === 'ACOES_SLC'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Layers className="h-4 w-4" />
              1. Quadro de ações da SLC
            </button>

            <button
              type="button"
              onClick={() => setModoM3('MATRIZ_MENSAL')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-extrabold transition ${
                modoM3 === 'MATRIZ_MENSAL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Table2 className="h-4 w-4" />
              2. Mapa de execução mensal
            </button>

            <button
              type="button"
              onClick={() => setModoM3('KANBAN_EDOCS')}
              className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-extrabold transition ${
                modoM3 === 'KANBAN_EDOCS'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Columns3 className="h-4 w-4" />
              3. Etapas E-Docs
            </button>
          </div>

          {/* Busca + filtro por setor demandante */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[280px] flex-1 sm:w-80 sm:flex-initial">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar contrato, credor, E-Docs, gestor..."
                className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2 pl-9 pr-3 text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              />
            </div>

            <select
              value={filtroSetor}
              onChange={(e) => setFiltroSetor(e.target.value)}
              className="rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-700 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="TODOS">
                Todos os setores ({setoresUnicos.length})
              </option>
              {setoresUnicos.map((setor) => (
                <option key={setor} value={setor}>
                  Setor: {setor}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ==========================================================================
          MODO 1: QUADRO DE AÇÕES DA SLC POR GATILHOS REAIS DA PLANILHA
         ========================================================================== */}
      {modoM3 === 'ACOES_SLC' && (
        <div className="space-y-4">
          {/* Resumo rápido das 5 frentes */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-2xl border border-rose-200 bg-rose-50/70 p-3.5 dark:border-rose-500/30 dark:bg-rose-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase text-rose-700 dark:text-rose-300">
                  1. Crítico (&lt;= 90d)
                </span>
                <Flame className="h-4 w-4 text-rose-600 dark:text-rose-400" />
              </div>
              <div className="mt-1 text-2xl font-black text-rose-700 dark:text-rose-300">
                {frentesAcaoSLC.criticosRenovacao.length}
              </div>
              <p className="text-[11px] text-rose-600/90 dark:text-rose-300/80">
                Instruir aditivo [P] ou licitação [NP]
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 dark:border-amber-500/30 dark:bg-amber-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase text-amber-800 dark:text-amber-300">
                  2. Planejamento (91–180d)
                </span>
                <CalendarClock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="mt-1 text-2xl font-black text-amber-800 dark:text-amber-300">
                {frentesAcaoSLC.janelaPlanejamento.length}
              </div>
              <p className="text-[11px] text-amber-700/90 dark:text-amber-300/80">
                Notificar gestor do contrato
              </p>
            </div>

            <div className="rounded-2xl border border-orange-200 bg-orange-50/70 p-3.5 dark:border-orange-500/30 dark:bg-orange-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase text-orange-800 dark:text-orange-300">
                  3. CND / Regularidade
                </span>
                <ShieldAlert className="h-4 w-4 text-orange-600 dark:text-orange-400" />
              </div>
              <div className="mt-1 text-2xl font-black text-orange-800 dark:text-orange-300">
                {frentesAcaoSLC.bloqueioDocumentalCnd.length}
              </div>
              <p className="text-[11px] text-orange-700/90 dark:text-orange-300/80">
                Cobrar certidão p/ liberar pagto
              </p>
            </div>

            <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-3.5 dark:border-purple-500/30 dark:bg-purple-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase text-purple-800 dark:text-purple-300">
                  4. Reforço de empenho
                </span>
                <Wallet className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
              <div className="mt-1 text-2xl font-black text-purple-800 dark:text-purple-300">
                {frentesAcaoSLC.alertaReforcoEmpenho.length}
              </div>
              <p className="text-[11px] text-purple-700/90 dark:text-purple-300/80">
                Projeção anual supera saldo NE
              </p>
            </div>

            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 dark:border-emerald-500/30 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-extrabold uppercase text-emerald-800 dark:text-emerald-300">
                  5. Execução regular
                </span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="mt-1 text-2xl font-black text-emerald-800 dark:text-emerald-300">
                {frentesAcaoSLC.execucaoRegular.length}
              </div>
              <p className="text-[11px] text-emerald-700/90 dark:text-emerald-300/80">
                Vigência &gt; 180d, CNDs e saldo OK
              </p>
            </div>
          </div>

          {/* As 5 colunas operacionais em grade fluida de largura total */}
          <div className="grid grid-cols-1 items-start gap-4 pb-4 md:grid-cols-2 xl:grid-cols-5">
            {/* Coluna 1: Crítico <= 90 dias */}
            <div className="flex min-w-0 w-full flex-col overflow-hidden rounded-2xl border border-rose-200/90 bg-slate-100/80 dark:border-rose-500/30 dark:bg-slate-900/60">
              <div className="h-1.5 w-full bg-rose-500" />
              <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/90">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                    🔥 Renovação crítica (&lt;= 90d)
                  </span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Aditivos [P] ou nova licitação [NP]
                  </p>
                </div>
                <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-extrabold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                  {frentesAcaoSLC.criticosRenovacao.length}
                </span>
              </div>
              <div className="flex-1 space-y-3 p-3">
                {frentesAcaoSLC.criticosRenovacao.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-slate-300/70 py-8 text-center text-xs text-slate-400 dark:border-slate-800">
                    Nenhum contrato vencendo em &lt;= 90 dias
                  </div>
                ) : (
                  frentesAcaoSLC.criticosRenovacao.map((item) =>
                    renderCardAcaoSLC(item, 'CRITICO')
                  )
                )}
              </div>
            </div>

            {/* Coluna 2: Janela de planejamento (91 a 180 dias) */}
            <div className="flex min-w-0 w-full flex-col overflow-hidden rounded-2xl border border-amber-200/90 bg-slate-100/80 dark:border-amber-500/30 dark:bg-slate-900/60">
              <div className="h-1.5 w-full bg-amber-500" />
              <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/90">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                    ⏳ Planejamento (91 a 180d)
                  </span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Oficiar setor gestor no proc. mãe
                  </p>
                </div>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-extrabold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                  {frentesAcaoSLC.janelaPlanejamento.length}
                </span>
              </div>
              <div className="flex-1 space-y-3 p-3">
                {frentesAcaoSLC.janelaPlanejamento.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-slate-300/70 py-8 text-center text-xs text-slate-400 dark:border-slate-800">
                    Nenhum contrato entre 91 e 180 dias
                  </div>
                ) : (
                  frentesAcaoSLC.janelaPlanejamento.map((item) =>
                    renderCardAcaoSLC(item, 'PLANEJAMENTO')
                  )
                )}
              </div>
            </div>

            {/* Coluna 3: Bloqueio documental (CNDs vencidas) */}
            <div className="flex min-w-0 w-full flex-col overflow-hidden rounded-2xl border border-orange-200/90 bg-slate-100/80 dark:border-orange-500/30 dark:bg-slate-900/60">
              <div className="h-1.5 w-full bg-orange-500" />
              <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/90">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-orange-800 dark:text-orange-300">
                    🚨 Pendência CND / Fiscal
                  </span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Certidões vencidas no proc. pagto
                  </p>
                </div>
                <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-extrabold text-orange-800 dark:bg-orange-500/20 dark:text-orange-300">
                  {frentesAcaoSLC.bloqueioDocumentalCnd.length}
                </span>
              </div>
              <div className="flex-1 space-y-3 p-3">
                {frentesAcaoSLC.bloqueioDocumentalCnd.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-slate-300/70 py-8 text-center text-xs text-slate-400 dark:border-slate-800">
                    Todas as CNDs regulares
                  </div>
                ) : (
                  frentesAcaoSLC.bloqueioDocumentalCnd.map((item) =>
                    renderCardAcaoSLC(item, 'CND')
                  )
                )}
              </div>
            </div>

            {/* Coluna 4: Alerta de empenho (reforço de empenho > 0) */}
            <div className="flex min-w-0 w-full flex-col overflow-hidden rounded-2xl border border-purple-200/90 bg-slate-100/80 dark:border-purple-500/30 dark:bg-slate-900/60">
              <div className="h-1.5 w-full bg-purple-500" />
              <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/90">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-purple-800 dark:text-purple-300">
                    💰 Reforço de empenho
                  </span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Saldo NE menor que projeção anual
                  </p>
                </div>
                <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-extrabold text-purple-800 dark:bg-purple-500/20 dark:text-purple-300">
                  {frentesAcaoSLC.alertaReforcoEmpenho.length}
                </span>
              </div>
              <div className="flex-1 space-y-3 p-3">
                {frentesAcaoSLC.alertaReforcoEmpenho.length === 0 ? (
                  <div className="rounded-xl border-2 border-dashed border-slate-300/70 py-8 text-center text-xs text-slate-400 dark:border-slate-800">
                    Nenhum contrato pedindo reforço
                  </div>
                ) : (
                  frentesAcaoSLC.alertaReforcoEmpenho.map((item) =>
                    renderCardAcaoSLC(item, 'EMPENHO')
                  )
                )}
              </div>
            </div>

            {/* Coluna 5: Execução regular (compactada por padrão para não gerar rolagem infinita) */}
            <div className="flex min-w-0 w-full flex-col overflow-hidden rounded-2xl border border-emerald-200/90 bg-slate-100/80 dark:border-emerald-500/30 dark:bg-slate-900/60">
              <div className="h-1.5 w-full bg-emerald-500" />
              <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/80 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/90">
                <div>
                  <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    ✅ Execução regular (&gt;180d)
                  </span>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Vigência, CNDs e saldo em dia
                  </p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-extrabold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                  {frentesAcaoSLC.execucaoRegular.length}
                </span>
              </div>
              <div className="flex-1 space-y-3 p-3">
                {(mostrarRegularesCompletos
                  ? frentesAcaoSLC.execucaoRegular
                  : frentesAcaoSLC.execucaoRegular.slice(0, 5)
                ).map((item) => renderCardAcaoSLC(item, 'REGULAR'))}

                {frentesAcaoSLC.execucaoRegular.length > 5 && (
                  <button
                    type="button"
                    onClick={() =>
                      setMostrarRegularesCompletos((atual) => !atual)
                    }
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50/80 py-2.5 text-xs font-extrabold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-950/40 dark:text-emerald-300"
                  >
                    {mostrarRegularesCompletos ? (
                      <>
                        <EyeOff className="h-3.5 w-3.5" /> Recolher lista
                        regular
                      </>
                    ) : (
                      <>
                        <Eye className="h-3.5 w-3.5" /> Ver todos os{' '}
                        {frentesAcaoSLC.execucaoRegular.length} contratos
                        regulares
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
          MODO 2: MAPA DE EXECUÇÃO MENSAL JAN–DEZ 2026 (FECHAMENTO DE PAGAMENTOS)
         ========================================================================== */}
      {modoM3 === 'MATRIZ_MENSAL' && (
        <div className="space-y-4">
          {/* KPIs do Fechamento Mensal e Seletor de Mês */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-400">
                  Mês em conferência
                </span>
                <select
                  value={mesReferencia}
                  onChange={(e) => setMesReferencia(e.target.value)}
                  className="rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1 text-xs font-extrabold text-blue-700 dark:border-blue-500/40 dark:bg-blue-950/60 dark:text-blue-300"
                >
                  {MESES_EXECUCAO.map((m) => (
                    <option key={m} value={m}>
                      Mês: {m}/2026
                    </option>
                  ))}
                </select>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
                    {resumoExecucaoMensal.qtdPagosNoMes}
                  </span>
                  <span className="ml-1 text-xs font-semibold text-slate-500">
                    pagos em {mesReferencia}
                  </span>
                </div>
                <span className="rounded-lg bg-amber-100 px-2 py-0.5 text-xs font-extrabold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                  {resumoExecucaoMensal.qtdPendentesNoMes} sem lançamento
                </span>
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Total lançado em {mesReferencia}:{' '}
                <strong className="text-slate-800 dark:text-slate-200">
                  {formatarMoedaBRL(resumoExecucaoMensal.totalPagoNoMes)}
                </strong>
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-400">
                  Empenhado 2026 (RPPS + FPS)
                </span>
                <TrendingUp className="h-4 w-4 text-blue-500" />
              </div>
              <div className="mt-2 text-xl font-black text-slate-900 dark:text-white">
                {formatarMoedaBRL(resumoExecucaoMensal.totalEmpenhado)}
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Soma das notas de empenho ativas
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-400">
                  Executado acumulado (Jan–Dez)
                </span>
                <FileCheck2 className="h-4 w-4 text-emerald-500" />
              </div>
              <div className="mt-2 text-xl font-black text-emerald-600 dark:text-emerald-400">
                {formatarMoedaBRL(resumoExecucaoMensal.totalPagoAno)}
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                Total de NFs/RPAs liquidados na planilha
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase text-slate-400">
                  Saldo de empenho disponível
                </span>
                <Wallet className="h-4 w-4 text-purple-500" />
              </div>
              <div className="mt-2 text-xl font-black text-blue-600 dark:text-blue-400">
                {formatarMoedaBRL(resumoExecucaoMensal.totalSaldo)}
              </div>
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                {resumoExecucaoMensal.qtdComReforco} contrato(s) com alerta de
                reforço
              </p>
            </div>
          </div>

          {/* Filtros rápidos do mapa mensal */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setFiltroExecucaoMensal('TODOS')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  filtroExecucaoMensal === 'TODOS'
                    ? 'bg-slate-900 text-white dark:bg-blue-600'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'
                }`}
              >
                Todos ({contratosFiltradosBase.length})
              </button>
              <button
                type="button"
                onClick={() => setFiltroExecucaoMensal('PAGOS_MES')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  filtroExecucaoMensal === 'PAGOS_MES'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300'
                }`}
              >
                Com pagamento em {mesReferencia} (
                {resumoExecucaoMensal.qtdPagosNoMes})
              </button>
              <button
                type="button"
                onClick={() => setFiltroExecucaoMensal('PENDENTES_MES')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  filtroExecucaoMensal === 'PENDENTES_MES'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/50 dark:text-amber-300'
                }`}
              >
                Sem lançamento em {mesReferencia} (
                {resumoExecucaoMensal.qtdPendentesNoMes})
              </button>
              <button
                type="button"
                onClick={() => setFiltroExecucaoMensal('CND_VENCIDA')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  filtroExecucaoMensal === 'CND_VENCIDA'
                    ? 'bg-rose-600 text-white'
                    : 'bg-rose-50 text-rose-800 hover:bg-rose-100 dark:bg-rose-950/50 dark:text-rose-300'
                }`}
              >
                Com CND vencida
              </button>
              <button
                type="button"
                onClick={() => setFiltroExecucaoMensal('REFORCO_EMPENHO')}
                className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                  filtroExecucaoMensal === 'REFORCO_EMPENHO'
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-50 text-purple-800 hover:bg-purple-100 dark:bg-purple-950/50 dark:text-purple-300'
                }`}
              >
                Pede reforço de empenho ({resumoExecucaoMensal.qtdComReforco})
              </button>
            </div>

            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
              Clique em qualquer linha para ver as notas fiscais (NFs), CNDs e
              abrir o processo E-Docs
            </span>
          </div>

          {/* Grade matriz jan a Dez */}
          <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-100/90 text-[10px] font-extrabold uppercase tracking-wider text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
                    <th className="py-3 pl-3 pr-2">Aba</th>
                    <th className="min-w-[210px] px-2 py-3">
                      Contrato &amp; credor
                    </th>
                    <th className="px-2 py-3">Setor</th>
                    {MESES_EXECUCAO.map((m) => (
                      <th
                        key={m}
                        onClick={() => setMesReferencia(m)}
                        className={`cursor-pointer px-2 py-3 text-center transition ${
                          mesReferencia === m
                            ? 'bg-blue-600 text-white'
                            : 'hover:bg-slate-200/70 dark:hover:bg-slate-800'
                        }`}
                      >
                        {m}
                      </th>
                    ))}
                    <th className="px-2.5 py-3 text-right">Total pago</th>
                    <th className="px-2.5 py-3 text-right">Saldo NE</th>
                    <th className="py-3 pl-2 pr-3 text-center">CNDs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                  {contratosMatrizFiltrados.map((c) => {
                    const cndsVencidas = obterCndsVencidasContrato(c);
                    const execMensal = parseExecucaoMensal(c);
                    const reforcoVal = parseReforcoNumerico(c.reforcoEmpenho);
                    const isExpandido = contratoExpandidoMatrizId === c.id;
                    const proc = obterProcessoDoContrato(c);

                    return (
                      <React.Fragment key={c.id}>
                        <tr
                          onClick={() =>
                            setContratoExpandidoMatrizId(
                              isExpandido ? null : c.id
                            )
                          }
                          className={`cursor-pointer transition ${
                            isExpandido
                              ? 'bg-blue-50/70 dark:bg-blue-950/30'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <td className="py-2.5 pl-3 pr-2 font-mono text-[11px] font-bold text-slate-500">
                            #{c.abaPlanilha || '—'}
                          </td>
                          <td className="px-2 py-2.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-extrabold text-slate-900 dark:text-white">
                                {c.numeroContrato}
                              </span>
                              <span
                                className={`rounded px-1 py-0.2 text-[9px] font-bold ${
                                  c.prorrogavel
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                                    : 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-300'
                                }`}
                              >
                                {c.prorrogavel ? 'P' : 'NP'}
                              </span>
                            </div>
                            <div className="line-clamp-1 text-[11px] font-medium text-slate-600 dark:text-slate-300">
                              {c.empresaContratada}
                            </div>
                          </td>
                          <td className="px-2 py-2.5">
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                              {c.setorDemandante}
                            </span>
                          </td>

                          {/* 12 colunas mensais jan-dez */}
                          {MESES_EXECUCAO.map((m) => {
                            const reg = execMensal.find(
                              (x) => x.mes.toLowerCase() === m.toLowerCase()
                            );
                            const val = reg?.valor || 0;
                            const nf = reg?.nf || '';
                            const isMesAtivo = mesReferencia === m;

                            return (
                              <td
                                key={m}
                                title={
                                  val > 0
                                    ? `${m}/2026: ${formatarMoedaBRL(val)}${
                                        nf ? ` · NF: ${nf}` : ''
                                      }`
                                    : `${m}/2026: Sem lançamento`
                                }
                                className={`px-2 py-2.5 text-center font-mono text-[11px] ${
                                  isMesAtivo
                                    ? 'bg-blue-50/60 dark:bg-blue-950/25'
                                    : ''
                                }`}
                              >
                                {val > 0 ? (
                                  <span className="inline-block rounded bg-emerald-100/90 px-1.5 py-0.5 font-bold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                                    {formatarValorCurto(val)}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 dark:text-slate-700">
                                    —
                                  </span>
                                )}
                              </td>
                            );
                          })}

                          <td className="px-2.5 py-2.5 text-right font-mono text-xs font-extrabold text-slate-900 dark:text-white">
                            {formatarValorCurto(c.totalGasto || 0)}
                          </td>

                          <td className="px-2.5 py-2.5 text-right font-mono text-xs font-bold">
                            <span
                              className={
                                reforcoVal > 0
                                  ? 'text-purple-600 dark:text-purple-400'
                                  : 'text-blue-600 dark:text-blue-400'
                              }
                            >
                              {formatarValorCurto(c.saldoDisponivel)}
                            </span>
                          </td>

                          <td className="py-2.5 pl-2 pr-3 text-center">
                            {cndsVencidas.length === 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
                                6/6 OK
                              </span>
                            ) : (
                              <span
                                title={cndsVencidas
                                  .map(
                                    (x) =>
                                      `${x.nome}: ${formatarDataBR(x.data)}`
                                  )
                                  .join(' | ')}
                                className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-extrabold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
                              >
                                <AlertTriangle className="h-3 w-3" />
                                {cndsVencidas.length} Venc.
                              </span>
                            )}
                          </td>
                        </tr>

                        {/* Faixa expansível com NFs, rateio RPPS/FPS, CNDs e ação rápida E-Docs */}
                        {isExpandido && (
                          <tr className="bg-slate-50/95 dark:bg-slate-950/90">
                            <td colSpan={18} className="p-4">
                              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="rounded bg-blue-600 px-2 py-0.5 text-[10px] font-extrabold text-white">
                                      Aba #{c.abaPlanilha} · Contrato nº{' '}
                                      {c.numeroContrato}
                                    </span>
                                    <span className="text-xs font-extrabold text-slate-900 dark:text-white">
                                      {c.razaoSocial || c.empresaContratada}
                                    </span>
                                    <span className="font-mono text-xs text-slate-500">
                                      CNPJ/CPF: {c.cnpj}
                                    </span>
                                  </div>
                                  <p className="text-xs text-slate-600 dark:text-slate-300">
                                    <strong>Objeto:</strong>{' '}
                                    {c.objetoCompleto || c.objeto}
                                  </p>
                                  <div className="flex flex-wrap gap-4 pt-1 text-[11px] text-slate-600 dark:text-slate-400">
                                    <span>
                                      <strong>Proc. mãe:</strong>{' '}
                                      <code className="font-bold text-blue-600 dark:text-blue-400">
                                        {c.numeroEdocs}
                                      </code>
                                    </span>
                                    <span>
                                      <strong>Proc. pagamento:</strong>{' '}
                                      <code className="font-bold text-emerald-600 dark:text-emerald-400">
                                        {c.processoPagamento || '—'}
                                      </code>
                                    </span>
                                    <span>
                                      <strong>NE RPPS:</strong>{' '}
                                      {c.neRpps || '—'} (
                                      {formatarMoedaBRL(c.valorRpps || 0)})
                                    </span>
                                    <span>
                                      <strong>NE FPS:</strong> {c.neFps || '—'}{' '}
                                      ({formatarMoedaBRL(c.valorFps || 0)})
                                    </span>
                                    <span>
                                      <strong>Gestor:</strong>{' '}
                                      {c.gestorContrato} ({c.setorDemandante})
                                    </span>
                                  </div>
                                </div>

                                {proc && (
                                  <div className="flex shrink-0 items-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onSelecionarProcesso(proc, 'detalhes')
                                      }
                                      className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-blue-500"
                                    >
                                      Abrir processo E-Docs ({proc.situacao})
                                      <ExternalLink className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Detalhe das 12 NFs */}
                              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12">
                                {MESES_EXECUCAO.map((m) => {
                                  const reg = execMensal.find(
                                    (x) =>
                                      x.mes.toLowerCase() === m.toLowerCase()
                                  );
                                  const val = reg?.valor || 0;
                                  const nf = reg?.nf || '—';
                                  return (
                                    <div
                                      key={m}
                                      className={`rounded-lg border p-2 text-[10px] ${
                                        val > 0
                                          ? 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-500/30 dark:bg-emerald-950/30'
                                          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                                      }`}
                                    >
                                      <div className="font-extrabold uppercase text-slate-500">
                                        {m}/2026
                                      </div>
                                      <div className="mt-0.5 font-mono text-xs font-extrabold text-slate-900 dark:text-white">
                                        {val > 0 ? formatarMoedaBRL(val) : '—'}
                                      </div>
                                      <div className="mt-0.5 truncate text-[9px] text-slate-500">
                                        NF: {nf}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================================================
          MODO 3: FLUXO E-DOCS POR ETAPA (DRAG & DROP COM OCULTAR CONCLUÍDOS)
         ========================================================================== */}
      {modoM3 === 'KANBAN_EDOCS' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={filtroCategoria}
                onChange={(e) => setFiltroCategoria(e.target.value)}
                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                <option value="TODAS">Todas as categorias</option>
                {CATEGORIAS_SLC.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <select
                value={filtroResponsavel}
                onChange={(e) => setFiltroResponsavel(e.target.value)}
                className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
              >
                <option value="TODOS">Todos os responsáveis</option>
                {responsaveisUnicos.map((srv) => (
                  <option key={srv} value={srv}>
                    {srv}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => setOcultarConcluidosKanban((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold transition ${
                ocultarConcluidosKanban
                  ? 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/30 dark:bg-blue-950/40 dark:text-blue-300'
                  : 'border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              {ocultarConcluidosKanban ? (
                <>
                  <Eye className="h-3.5 w-3.5" /> Mostrar coluna
                  &ldquo;Concluído&rdquo;
                </>
              ) : (
                <>
                  <EyeOff className="h-3.5 w-3.5" /> Ocultar coluna
                  &ldquo;Concluído&rdquo;
                </>
              )}
            </button>
          </div>

          <div
            className={`grid grid-cols-1 items-start gap-4 pb-4 md:grid-cols-2 ${
              ocultarConcluidosKanban
                ? 'xl:grid-cols-3 2xl:grid-cols-6'
                : 'xl:grid-cols-4 2xl:grid-cols-7'
            }`}
          >
            {etapasVisiveisKanban.map((etapa) => {
              const idxEtapa = ETAPAS_KANBAN.indexOf(etapa);
              const itens = processosKanbanFiltrados.filter(
                (p) => p.situacao === etapa
              );
              const isAlvo = colunaAlvo === etapa;

              return (
                <div
                  key={etapa}
                  onDragOver={(e) => handleDragOver(e, etapa)}
                  onDragLeave={() => setColunaAlvo(null)}
                  onDrop={(e) => handleDrop(e, etapa)}
                  className={`flex min-w-0 w-full flex-col overflow-hidden rounded-2xl border transition-all ${
                    isAlvo
                      ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/30 dark:border-blue-400 dark:bg-blue-950/30'
                      : 'border-slate-200/90 bg-slate-100/80 dark:border-slate-800 dark:bg-slate-900/60'
                  }`}
                >
                  <div className={`h-1.5 w-full ${coresTopoColuna[etapa]}`} />

                  <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                      {etapa}
                    </span>
                    <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-extrabold text-blue-700 dark:bg-slate-800 dark:text-blue-400">
                      {itens.length}
                    </span>
                  </div>

                  <div className="flex-1 space-y-3 p-3">
                    {itens.length === 0 ? (
                      <div className="rounded-xl border-2 border-dashed border-slate-300/70 py-10 text-center text-xs font-medium text-slate-400 dark:border-slate-800/80 dark:text-slate-500">
                        Sem processos nesta etapa
                      </div>
                    ) : (
                      itens.map((proc) => {
                        const isArrastando = processoArrastandoId === proc.id;
                        return (
                          <div
                            key={proc.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, proc)}
                            onDragEnd={() => {
                              setProcessoArrastandoId(null);
                              setColunaAlvo(null);
                            }}
                            className={`group flex cursor-grab flex-col justify-between rounded-xl border bg-white p-3.5 shadow-sm transition-all active:cursor-grabbing dark:bg-slate-950/90 ${
                              isArrastando
                                ? 'scale-95 border-blue-500 opacity-50'
                                : 'border-slate-200/90 hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md dark:border-slate-800 dark:hover:border-slate-700'
                            }`}
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5">
                                  <GripVertical className="h-3.5 w-3.5 text-slate-400 opacity-60 group-hover:opacity-100" />
                                  <span
                                    onClick={() =>
                                      onSelecionarProcesso(proc, 'detalhes')
                                    }
                                    className="cursor-pointer font-mono text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
                                  >
                                    {proc.numeroEdocs}
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  {proc.restritoTv && (
                                    <span
                                      title="Oculto no Modo TV"
                                      className="rounded bg-rose-100 p-1 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300"
                                    >
                                      <Lock className="h-3 w-3" />
                                    </span>
                                  )}
                                  <PrioridadeBadge
                                    prioridade={proc.prioridade}
                                  />
                                </div>
                              </div>

                              <h4
                                onClick={() =>
                                  onSelecionarProcesso(proc, 'detalhes')
                                }
                                className="mt-2 cursor-pointer text-xs font-bold leading-snug text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-300"
                              >
                                {proc.assunto}
                              </h4>

                              <p className="mt-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                                {proc.categoria} · {proc.setorDemandante}
                              </p>

                              {proc.pendenciaAtual && (
                                <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/80 px-2.5 py-1.5 text-[11px] text-amber-900 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-300">
                                  <span className="font-bold text-amber-700 dark:text-amber-300">
                                    Status:{' '}
                                  </span>
                                  {proc.pendenciaAtual}
                                </div>
                              )}
                            </div>

                            <div className="mt-3 space-y-2 border-t border-slate-100 pt-2.5 dark:border-slate-800/80">
                              <div className="flex items-center justify-between">
                                <span className="inline-flex items-center gap-1 truncate text-[11px] font-medium text-slate-600 dark:text-slate-400">
                                  <User className="h-3 w-3 text-slate-400" />
                                  {proc.responsavel}
                                </span>
                                <PrazoBadge
                                  processo={proc}
                                  diasAlerta={configTv.diasAlertaPrazoProximo}
                                />
                              </div>

                              <div className="flex items-center justify-between gap-2 pt-1">
                                <button
                                  type="button"
                                  disabled={idxEtapa === 0}
                                  onClick={() => moverParaIndice(proc, -1)}
                                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
                                >
                                  <ChevronLeft className="h-3 w-3" /> Ant.
                                </button>
                                <button
                                  type="button"
                                  disabled={
                                    idxEtapa === ETAPAS_KANBAN.length - 1
                                  }
                                  onClick={() => moverParaIndice(proc, 1)}
                                  className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-blue-200 bg-blue-50 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-30 dark:border-blue-500/30 dark:bg-blue-600/20 dark:text-blue-300 dark:hover:bg-blue-600/30"
                                >
                                  Avançar <ChevronRight className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
