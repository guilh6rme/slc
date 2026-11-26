import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Building2,
  CalendarClock,
  CheckCircle2,
  Clock,
  Flame,
  FolderKanban,
  Landmark,
  Lock,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CATEGORIAS_SLC,
  ConfiguracaoTV,
  ContratoSLC,
  DadosContinuidade2025,
  ETAPAS_KANBAN,
  ExecucaoMensalItem,
  ProcessoSLC,
} from '../types/slc';
import {
  calcularDiasAtePrazo,
  calcularDiasSemAtualizacao,
  obterListaResponsaveisUnicos,
  obterStatusPrazo,
} from '../services/slcService';
import {
  PrazoBadge,
  PrioridadeBadge,
  SituacaoBadge,
} from '../components/StatusBadges';

interface DashboardViewProps {
  processos: ProcessoSLC[];
  contratos?: ContratoSLC[];
  configTv: ConfiguracaoTV;
  temaEscuro?: boolean;
  onSelecionarProcesso: (p: ProcessoSLC, modo: 'detalhes' | 'editar') => void;
  onIrParaAba: (aba: 'processos' | 'contratos' | 'kanban' | 'prazos') => void;
}

const MESES_ORDEM = [
  'JAN',
  'FEV',
  'MAR',
  'ABR',
  'MAI',
  'JUN',
  'JUL',
  'AGO',
  'SET',
  'OUT',
  'NOV',
  'DEZ',
];

function formatarMoeda(valor: number): string {
  return (valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatarMoedaCompacta(valor: number): string {
  const v = valor || 0;
  if (v >= 1_000_000) {
    return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}M`;
  }
  if (v >= 1_000) {
    return `R$ ${(v / 1_000).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    })}k`;
  }
  return formatarMoeda(v);
}

// Paleta semântica (color-role ledger):
// Azul = fluxo interno ativo | Âmbar = fila/aguardando | Verde = concluído
function corPorEtapa(etapa: string): string {
  if (etapa === 'Concluído') return '#10B981';
  if (
    etapa === 'Aguardando documentação' ||
    etapa === 'Aguardando aprovação' ||
    etapa === 'Em andamento externo'
  ) {
    return '#F59E0B';
  }
  return '#2563EB';
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  processos,
  contratos = [],
  configTv,
  temaEscuro = false,
  onSelecionarProcesso,
  onIrParaAba,
}) => {
  const [modoGraficoHero, setModoGraficoHero] = useState<'financeiro' | 'processos'>(
    'financeiro'
  );
  const [modoRankingLateral, setModoRankingLateral] = useState<'setores' | 'categorias'>(
    'setores'
  );
  const [filtroFila, setFiltroFila] = useState<'todos' | 'criticos' | 'vencendo'>('todos');

  // --- Indicadores de Processos ---
  const ativos = useMemo(
    () => processos.filter((p) => p.situacao !== 'Concluído'),
    [processos]
  );
  const concluidos = useMemo(
    () => processos.filter((p) => p.situacao === 'Concluído'),
    [processos]
  );

  const vencidos = useMemo(
    () =>
      ativos.filter(
        (p) => obterStatusPrazo(p, configTv.diasAlertaPrazoProximo) === 'VENCIDO'
      ),
    [ativos, configTv.diasAlertaPrazoProximo]
  );
  const proximosVencer = useMemo(
    () =>
      ativos.filter(
        (p) => obterStatusPrazo(p, configTv.diasAlertaPrazoProximo) === 'PROXIMO'
      ),
    [ativos, configTv.diasAlertaPrazoProximo]
  );
  const semAtualizacao = useMemo(
    () =>
      ativos.filter(
        (p) =>
          calcularDiasSemAtualizacao(p.atualizadoEm) >=
          configTv.diasAlertaInatividade
      ),
    [ativos, configTv.diasAlertaInatividade]
  );
  const aguardandoProvidencia = useMemo(
    () =>
      ativos.filter(
        (p) =>
          p.situacao === 'Aguardando documentação' ||
          p.situacao === 'Aguardando aprovação' ||
          p.situacao === 'Em andamento externo'
      ),
    [ativos]
  );

  // --- Indicadores Orçamentários e de Vigência dos Contratos ---
  const resumoFinanceiro = useMemo(() => {
    const totalEmpenhado = contratos.reduce((acc, c) => acc + (c.valorGlobal || 0), 0);
    const totalGasto = contratos.reduce((acc, c) => acc + (c.totalGasto || 0), 0);
    const saldoTotal = contratos.reduce((acc, c) => acc + (c.saldoDisponivel || 0), 0);
    const totalRpps = contratos.reduce((acc, c) => acc + (c.valorRpps || 0), 0);
    const totalFps = contratos.reduce((acc, c) => acc + (c.valorFps || 0), 0);
    const somaFontes = Math.max(1, totalRpps + totalFps);
    const pctExecutado = totalEmpenhado > 0 ? (totalGasto / totalEmpenhado) * 100 : 0;
    const pctSaldo = Math.max(0, 100 - pctExecutado);
    const pctRpps = Math.round((totalRpps / somaFontes) * 100);
    const pctFps = Math.max(0, 100 - pctRpps);

    let critico45 = 0;
    let alerta90 = 0;
    let prev180 = 0;
    let regular = 0;
    contratos.forEach((c) => {
      const d = calcularDiasAtePrazo(c.fimVigencia);
      if (d !== null && d <= 45) critico45 += 1;
      else if (d !== null && d <= 90) alerta90 += 1;
      else if (d !== null && d <= 180) prev180 += 1;
      else regular += 1;
    });

    return {
      totalEmpenhado,
      totalGasto,
      saldoTotal,
      totalRpps,
      totalFps,
      pctExecutado,
      pctSaldo,
      pctRpps,
      pctFps,
      critico45,
      alerta90,
      prev180,
      regular,
      prorrogaveis: contratos.filter((c) => c.prorrogavel).length,
      naoProrrogaveis: contratos.filter((c) => !c.prorrogavel).length,
    };
  }, [contratos]);

  // --- Gráfico Hero A: Curva de Execução Financeira Mensal (2026 vs 2025) ---
  const execucaoMensal = useMemo(() => {
    const mapa26 = new Map<string, number>();
    const mapa25 = new Map<string, number>();
    MESES_ORDEM.forEach((m) => {
      mapa26.set(m, 0);
      mapa25.set(m, 0);
    });

    contratos.forEach((c) => {
      if (c.execucaoMensalJson) {
        try {
          const itens = JSON.parse(c.execucaoMensalJson) as ExecucaoMensalItem[];
          if (Array.isArray(itens)) {
            itens.forEach((it) => {
              const sigla = (it.mes || '').slice(0, 3).toUpperCase();
              if (mapa26.has(sigla)) {
                mapa26.set(sigla, (mapa26.get(sigla) || 0) + (Number(it.valor) || 0));
              }
            });
          }
        } catch {
          // Ignora JSON inválido
        }
      }
      if (c.dados2025Json) {
        try {
          const d25 = JSON.parse(c.dados2025Json) as DadosContinuidade2025;
          if (d25?.possuiHistorico2025 && Array.isArray(d25.execucaoMensal2025)) {
            d25.execucaoMensal2025.forEach((it) => {
              const sigla = (it.mes || '').slice(0, 3).toUpperCase();
              if (mapa25.has(sigla)) {
                mapa25.set(sigla, (mapa25.get(sigla) || 0) + (Number(it.valor) || 0));
              }
            });
          }
        } catch {
          // Ignora JSON inválido
        }
      }
    });

    const serie = MESES_ORDEM.map((mes) => ({
      mes,
      atual2026: Math.round((mapa26.get(mes) || 0) * 100) / 100,
      historico2025: Math.round((mapa25.get(mes) || 0) * 100) / 100,
    }));

    const mesesComGasto = serie.filter((s) => s.atual2026 > 0);
    const mediaMensal2026 =
      mesesComGasto.length > 0
        ? mesesComGasto.reduce((acc, s) => acc + s.atual2026, 0) / mesesComGasto.length
        : 0;
    const pico2026 = serie.reduce(
      (best, cur) => (cur.atual2026 > best.atual2026 ? cur : best),
      { mes: '—', atual2026: 0, historico2025: 0 }
    );

    return { serie, mediaMensal2026, pico2026 };
  }, [contratos]);

  // --- Gráfico Hero B: Evolução Mensal de Processos (últimos 6 meses) ---
  const evolucaoMensalProcessos = useMemo(() => {
    const mapaMeses = new Map<
      string,
      { mes: string; recebidos: number; concluidos: number }
    >();
    const hoje = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      const chave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const rotulo = d.toLocaleDateString('pt-BR', { month: 'short' });
      mapaMeses.set(chave, {
        mes: rotulo.charAt(0).toUpperCase() + rotulo.slice(1).replace('.', ''),
        recebidos: 0,
        concluidos: 0,
      });
    }

    for (const p of processos) {
      const chaveEntrada = p.dataEntrada?.slice(0, 7);
      if (chaveEntrada && mapaMeses.has(chaveEntrada)) {
        const item = mapaMeses.get(chaveEntrada)!;
        item.recebidos += 1;
        if (p.situacao === 'Concluído') {
          item.concluidos += 1;
        }
      }
    }

    return Array.from(mapaMeses.values());
  }, [processos]);

  // --- Gráfico 2: Barras Horizontais por Etapa (com rótulos diretos e cor semântica) ---
  const dadosPorEtapa = useMemo(() => {
    const total = Math.max(1, processos.length);
    return ETAPAS_KANBAN.map((etapa) => {
      const quantidade = processos.filter((p) => p.situacao === etapa).length;
      const pct = Math.round((quantidade / total) * 100);
      return {
        etapa,
        quantidade,
        pct,
        rotuloValor: `${quantidade} (${pct}%)`,
        cor: corPorEtapa(etapa),
      };
    });
  }, [processos]);

  const etapaGargalo = useMemo(
    () =>
      dadosPorEtapa
        .filter((e) => e.etapa !== 'Concluído')
        .reduce((max, cur) => (cur.quantidade > max.quantidade ? cur : max), {
          etapa: '—',
          quantidade: 0,
          pct: 0,
          rotuloValor: '0',
          cor: '#2563EB',
        }),
    [dadosPorEtapa]
  );

  // --- Gráfico 3A: Ranking por Setor Solicitante (Empenho R$ + Contratos) ---
  const rankingSetores = useMemo(() => {
    const mapa = new Map<string, { qtd: number; empenho: number; gasto: number }>();
    contratos.forEach((c) => {
      const sigla = (c.setorDemandante || 'SLC').split(' — ')[0];
      const atual = mapa.get(sigla) || { qtd: 0, empenho: 0, gasto: 0 };
      mapa.set(sigla, {
        qtd: atual.qtd + 1,
        empenho: atual.empenho + (c.valorGlobal || 0),
        gasto: atual.gasto + (c.totalGasto || 0),
      });
    });
    const base = Math.max(1, resumoFinanceiro.totalEmpenhado);
    return Array.from(mapa.entries())
      .map(([setor, info]) => ({
        setor,
        ...info,
        pct: (info.empenho / base) * 100,
      }))
      .sort((a, b) => b.empenho - a.empenho || b.qtd - a.qtd)
      .slice(0, 7);
  }, [contratos, resumoFinanceiro.totalEmpenhado]);

  // --- Gráfico 3B: Distribuição por Categoria de Processo (ranqueada com rótulos diretos) ---
  const dadosPorCategoria = useMemo(() => {
    const total = Math.max(1, processos.length);
    return CATEGORIAS_SLC.map((cat) => {
      const qtd = processos.filter((p) => p.categoria === cat).length;
      return {
        nome: cat.split(' (')[0],
        categoriaCompleta: cat,
        qtd,
        pct: Math.round((qtd / total) * 100),
      };
    })
      .filter((d) => d.qtd > 0)
      .sort((a, b) => b.qtd - a.qtd);
  }, [processos]);

  // --- Gráfico 4: Ranking de Responsáveis (com barra empilhada Normal vs Crítico) ---
  const rankingResponsaveisAtivos = useMemo(() => {
    const lista = obterListaResponsaveisUnicos(processos).map((srv) => {
      const qtdAtivos = ativos.filter((p) => p.responsavel === srv).length;
      const qtdCriticos = ativos.filter(
        (p) => p.responsavel === srv && (p.prioridade === 'Crítica' || p.prioridade === 'Alta')
      ).length;
      const qtdNormais = Math.max(0, qtdAtivos - qtdCriticos);
      return { srv, qtdAtivos, qtdCriticos, qtdNormais };
    });

    return lista
      .filter((item) => item.qtdAtivos > 0)
      .sort((a, b) => b.qtdAtivos - a.qtdAtivos || b.qtdCriticos - a.qtdCriticos);
  }, [processos, ativos]);

  // --- Fila de Atenção Prioritária com filtro interativo ---
  const processosAtencao = useMemo(() => {
    const base = ativos.filter((p) => {
      const st = obterStatusPrazo(p, configTv.diasAlertaPrazoProximo);
      if (filtroFila === 'criticos') return p.prioridade === 'Crítica' || st === 'VENCIDO';
      if (filtroFila === 'vencendo') return st === 'VENCIDO' || st === 'PROXIMO';
      return st === 'VENCIDO' || st === 'PROXIMO' || p.prioridade === 'Crítica';
    });
    return base.slice(0, 7);
  }, [ativos, configTv.diasAlertaPrazoProximo, filtroFila]);

  const corGrade = temaEscuro ? 'rgba(148, 163, 184, 0.14)' : 'rgba(148, 163, 184, 0.25)';
  const corEixo = temaEscuro ? '#94a3b8' : '#475569';
  const estiloTooltip = {
    backgroundColor: temaEscuro ? '#0f172a' : '#ffffff',
    borderColor: temaEscuro ? '#334155' : '#cbd5e1',
    borderRadius: '12px',
    color: temaEscuro ? '#f8fafc' : '#0f172a',
    fontSize: '12px',
    boxShadow: '0 10px 25px -5px rgba(15, 23, 42, 0.18)',
  };

  return (
    <div className="space-y-6">
      {/* ================= FAIXA 1: 5 KPIs EXECUTIVOS (PROCESSOS + ORÇAMENTO 2026) ================= */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <button
          type="button"
          onClick={() => onIrParaAba('processos')}
          className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/90"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-blue-600" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Processos ativos
            </span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
              <FolderKanban className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              {ativos.length}
            </span>
            <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
              {concluidos.length} concl.
            </span>
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            De {processos.length} processos · {semAtualizacao.length} inativos (&gt;
            {configTv.diasAlertaInatividade}d)
          </p>
        </button>

        <button
          type="button"
          onClick={() => onIrParaAba('contratos')}
          className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/90"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-indigo-600" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Empenhado 2026
            </span>
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
              <Landmark className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {formatarMoedaCompacta(resumoFinanceiro.totalEmpenhado)}
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Executado:{' '}
            <strong className="text-indigo-600 dark:text-indigo-300">
              {formatarMoedaCompacta(resumoFinanceiro.totalGasto)}
            </strong>{' '}
            ({resumoFinanceiro.pctExecutado.toFixed(1)}%)
          </p>
        </button>

        <button
          type="button"
          onClick={() => onIrParaAba('contratos')}
          className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/90"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Saldo de empenho
            </span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
            {formatarMoedaCompacta(resumoFinanceiro.saldoTotal)}
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            {resumoFinanceiro.pctSaldo.toFixed(1)}% livre em {contratos.length} contratos
          </p>
        </button>

        <button
          type="button"
          onClick={() => onIrParaAba('kanban')}
          className="group relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/90"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-amber-500" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Ag. providência
            </span>
            <div className="rounded-xl bg-amber-50 p-2 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
              {aguardandoProvidencia.length}
            </span>
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              ({Math.round((aguardandoProvidencia.length / Math.max(1, ativos.length)) * 100)}% dos ativos)
            </span>
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Documentação, aprovação ou externo
          </p>
        </button>

        <button
          type="button"
          onClick={() => onIrParaAba('prazos')}
          className="group relative overflow-hidden rounded-2xl border border-rose-200 bg-rose-50/50 p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-rose-400 hover:shadow-md dark:border-rose-500/30 dark:bg-rose-950/20"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-rose-600" />
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
              Vencendo ≤ 90d
            </span>
            <div className="rounded-xl bg-rose-100 p-2 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
              <Flame className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-600 dark:text-rose-300">
              {resumoFinanceiro.critico45 + resumoFinanceiro.alerta90}
            </span>
            <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
              +{resumoFinanceiro.prev180} até 180d
            </span>
          </div>
          <p className="mt-1.5 text-xs font-medium text-rose-700/85 dark:text-rose-300/80">
            {vencidos.length} proc. vencido(s) · +{proximosVencer.length} próximos →
          </p>
        </button>
      </div>

      {/* ================= FAIXA 2 (HERO): CURVA DE EXECUÇÃO 2026×2025 + SAÚDE ORÇAMENTÁRIA ================= */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Hero Esquerda (8 cols): Evolução Mensal com alternador Financeiro / Processos */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 xl:col-span-8">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {modoGraficoHero === 'financeiro'
                    ? `Execução financeira mensal: pico em ${execucaoMensal.pico2026.mes} (${formatarMoedaCompacta(
                        execucaoMensal.pico2026.atual2026
                      )})`
                    : 'Fluxo de entrada vs. conclusão de processos (6 meses)'}
                </h3>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {modoGraficoHero === 'financeiro'
                    ? `Média mensal executada em 2026: ${formatarMoeda(
                        execucaoMensal.mediaMensal2026
                      )} · Comparativo com o histórico real de 2025`
                    : 'Calculado com base nas datas de entrada e encerramento dos processos'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setModoGraficoHero('financeiro')}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                  modoGraficoHero === 'financeiro'
                    ? 'bg-white text-blue-700 shadow-sm dark:bg-blue-600 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Execução (R$)
              </button>
              <button
                type="button"
                onClick={() => setModoGraficoHero('processos')}
                className={`rounded-lg px-3 py-1 text-xs font-bold transition ${
                  modoGraficoHero === 'processos'
                    ? 'bg-white text-blue-700 shadow-sm dark:bg-blue-600 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Processos
              </button>
            </div>
          </div>

          {/* Legenda embutida de alto contraste */}
          <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-semibold">
            {modoGraficoHero === 'financeiro' ? (
              <>
                <span className="flex items-center gap-1.5 text-blue-700 dark:text-cyan-300">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-600 dark:bg-cyan-400" />
                  Executado 2026 (Atual)
                </span>
                <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                  <span className="h-0.5 w-4 border-t-2 border-dashed border-rose-500" />
                  Histórico 2025
                </span>
                {execucaoMensal.mediaMensal2026 > 0 && (
                  <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                    <span className="h-0.5 w-4 border-t-2 border-dotted border-emerald-500" />
                    Média 2026 ({formatarMoedaCompacta(execucaoMensal.mediaMensal2026)})
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-blue-600" />
                  Recebidos
                </span>
                <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Concluídos
                </span>
              </>
            )}
          </div>

          <div className="mt-4 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              {modoGraficoHero === 'financeiro' ? (
                <AreaChart
                  data={execucaoMensal.serie}
                  margin={{ top: 10, right: 16, left: 4, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="dashGrad2026" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={temaEscuro ? '#22d3ee' : '#2563EB'}
                        stopOpacity={0.32}
                      />
                      <stop
                        offset="95%"
                        stopColor={temaEscuro ? '#22d3ee' : '#2563EB'}
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                    <linearGradient id="dashGrad2025" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F43F5E" stopOpacity={0.14} />
                      <stop offset="95%" stopColor="#F43F5E" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 4"
                    vertical={false}
                    stroke={corGrade}
                  />
                  <XAxis
                    dataKey="mes"
                    tick={{ fontSize: 11, fill: corEixo, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: corEixo }}
                    axisLine={false}
                    tickLine={false}
                    width={64}
                    tickFormatter={(v) => formatarMoedaCompacta(Number(v))}
                  />
                  <Tooltip
                    contentStyle={estiloTooltip}
                    formatter={(value, name) => [
                      formatarMoeda(Number(value || 0)),
                      name === 'atual2026' ? 'Executado 2026' : 'Executado 2025',
                    ]}
                  />
                  {execucaoMensal.mediaMensal2026 > 0 && (
                    <ReferenceLine
                      y={execucaoMensal.mediaMensal2026}
                      stroke="#10B981"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                    />
                  )}
                  <Area
                    type="monotone"
                    dataKey="historico2025"
                    stroke="#F43F5E"
                    strokeWidth={1.8}
                    strokeDasharray="4 4"
                    fill="url(#dashGrad2025)"
                  />
                  <Area
                    type="monotone"
                    dataKey="atual2026"
                    stroke={temaEscuro ? '#22d3ee' : '#2563EB'}
                    strokeWidth={2.6}
                    fill="url(#dashGrad2026)"
                    dot={{
                      r: 3.5,
                      fill: temaEscuro ? '#0f172a' : '#ffffff',
                      stroke: temaEscuro ? '#22d3ee' : '#2563EB',
                      strokeWidth: 2,
                    }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              ) : (
                <AreaChart
                  data={evolucaoMensalProcessos}
                  margin={{ top: 10, right: 16, left: -12, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="dashProcRec" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563EB" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="dashProcConc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.28} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 4"
                    vertical={false}
                    stroke={corGrade}
                  />
                  <XAxis
                    dataKey="mes"
                    tick={{ fontSize: 11, fill: corEixo, fontWeight: 600 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    allowDecimals={false}
                    tick={{ fontSize: 11, fill: corEixo }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip contentStyle={estiloTooltip} />
                  <Area
                    type="monotone"
                    dataKey="recebidos"
                    name="Recebidos"
                    stroke="#2563EB"
                    strokeWidth={2.5}
                    fill="url(#dashProcRec)"
                  />
                  <Area
                    type="monotone"
                    dataKey="concluidos"
                    name="Concluídos"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    fill="url(#dashProcConc)"
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Hero Direita (4 cols): Saúde Orçamentária, Fontes e Horizonte de Vencimentos */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 xl:col-span-4">
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                  <CalendarClock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Orçamento &amp; horizonte 2026
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {contratos.length} contratos ({resumoFinanceiro.prorrogaveis} P ·{' '}
                    {resumoFinanceiro.naoProrrogaveis} NP)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => onIrParaAba('contratos')}
                className="text-xs font-bold text-blue-600 hover:underline dark:text-blue-400"
              >
                Contratos →
              </button>
            </div>

            {/* Barra de Execução Orçamentária com rótulos diretos */}
            <div className="mt-5 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/60">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-slate-700 dark:text-slate-200">
                  Execução do empenho
                </span>
                <span className="font-mono text-indigo-700 dark:text-indigo-300">
                  {resumoFinanceiro.pctExecutado.toFixed(1)}% pago
                </span>
              </div>
              <div className="mt-2 flex h-3 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                <div
                  className="h-full bg-indigo-600 transition-all"
                  style={{ width: `${resumoFinanceiro.pctExecutado}%` }}
                  title={`Executado: ${formatarMoeda(resumoFinanceiro.totalGasto)}`}
                />
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${resumoFinanceiro.pctSaldo}%` }}
                  title={`Saldo livre: ${formatarMoeda(resumoFinanceiro.saldoTotal)}`}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px] font-semibold">
                <span className="text-indigo-700 dark:text-indigo-300">
                  Pago: {formatarMoedaCompacta(resumoFinanceiro.totalGasto)}
                </span>
                <span className="text-emerald-700 dark:text-emerald-400">
                  Saldo: {formatarMoedaCompacta(resumoFinanceiro.saldoTotal)}
                </span>
              </div>
            </div>

            {/* Horizonte de vencimento com barras diretas */}
            <div className="mt-5 space-y-3">
              <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Janelas de vencimento da carteira
              </div>
              {[
                {
                  rotulo: 'Crítico (≤ 45 dias)',
                  qtd: resumoFinanceiro.critico45,
                  cor: 'bg-rose-500',
                  txt: 'text-rose-700 dark:text-rose-300',
                },
                {
                  rotulo: 'Alerta (46 – 90 dias)',
                  qtd: resumoFinanceiro.alerta90,
                  cor: 'bg-amber-500',
                  txt: 'text-amber-700 dark:text-amber-300',
                },
                {
                  rotulo: 'Planejamento (91 – 180d)',
                  qtd: resumoFinanceiro.prev180,
                  cor: 'bg-sky-500',
                  txt: 'text-sky-700 dark:text-sky-300',
                },
                {
                  rotulo: 'Regular (> 180 dias)',
                  qtd: resumoFinanceiro.regular,
                  cor: 'bg-emerald-500',
                  txt: 'text-emerald-700 dark:text-emerald-300',
                },
              ].map((item) => {
                const pct = Math.round((item.qtd / Math.max(1, contratos.length)) * 100);
                return (
                  <div key={item.rotulo}>
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span className="text-slate-700 dark:text-slate-300">
                        {item.rotulo}
                      </span>
                      <span className={`font-mono font-bold ${item.txt}`}>
                        {item.qtd} ({pct}%)
                      </span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full ${item.cor}`}
                        style={{ width: `${Math.max(item.qtd > 0 ? 4 : 0, pct)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Divisão de Fontes RPPS vs FPS */}
          <div className="mt-5 border-t border-slate-200 pt-3.5 dark:border-slate-800">
            <div className="flex items-center justify-between text-[11px] font-bold">
              <span className="text-violet-700 dark:text-violet-300">
                RPPS: {formatarMoedaCompacta(resumoFinanceiro.totalRpps)} (
                {resumoFinanceiro.pctRpps}%)
              </span>
              <span className="text-sky-700 dark:text-sky-300">
                FPS: {formatarMoedaCompacta(resumoFinanceiro.totalFps)} (
                {resumoFinanceiro.pctFps}%)
              </span>
            </div>
            <div className="mt-1.5 flex h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
              <div
                className="h-full bg-violet-500"
                style={{ width: `${resumoFinanceiro.pctRpps}%` }}
              />
              <div
                className="h-full bg-sky-500"
                style={{ width: `${resumoFinanceiro.pctFps}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ================= FAIXA 3: FUNIL DE ETAPAS (BARRAS HORIZONTAIS) + RANKING SETORES/CATEGORIAS ================= */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Gráfico 2 (6 cols): Volume por etapa com barras horizontais e rótulos diretos */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 lg:col-span-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <div className="rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  Processos por etapa — maior volume em &ldquo;{etapaGargalo.etapa}&rdquo;
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Azul: tramitação interna · Âmbar: aguardando/externo · Verde: concluído
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onIrParaAba('kanban')}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-400 dark:hover:bg-blue-500/25"
            >
              Kanban <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-5 h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dadosPorEtapa}
                layout="vertical"
                margin={{ top: 4, right: 64, left: 8, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 4"
                  horizontal={false}
                  stroke={corGrade}
                />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: corEixo }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="etapa"
                  width={158}
                  tick={{ fontSize: 11, fill: corEixo, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(59, 130, 246, 0.08)' }}
                  contentStyle={estiloTooltip}
                  formatter={(value) => [`${value} processo(s)`, 'Quantidade']}
                />
                <Bar dataKey="quantidade" radius={[0, 8, 8, 0]} barSize={22}>
                  {dadosPorEtapa.map((entry) => (
                    <Cell key={entry.etapa} fill={entry.cor} />
                  ))}
                  <LabelList
                    dataKey="rotuloValor"
                    position="right"
                    style={{
                      fill: temaEscuro ? '#e2e8f0' : '#0f172a',
                      fontSize: 11,
                      fontWeight: 700,
                    }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 3 (6 cols): Ranking Direto por Setor Solicitante (R$) ou Categoria de Processo */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 lg:col-span-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div className="flex items-start gap-2.5">
              <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                  {modoRankingLateral === 'setores'
                    ? 'Empenho por setor solicitante (IPAJM)'
                    : 'Processos por categoria administrativa'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {modoRankingLateral === 'setores'
                    ? 'Barras ranqueadas por valor empenhado com nº de contratos'
                    : 'Participação percentual sobre os processos cadastrados'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-950">
              <button
                type="button"
                onClick={() => setModoRankingLateral('setores')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  modoRankingLateral === 'setores'
                    ? 'bg-white text-indigo-700 shadow-sm dark:bg-indigo-600 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Por setor
              </button>
              <button
                type="button"
                onClick={() => setModoRankingLateral('categorias')}
                className={`rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                  modoRankingLateral === 'categorias'
                    ? 'bg-white text-indigo-700 shadow-sm dark:bg-indigo-600 dark:text-white'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Por categoria
              </button>
            </div>
          </div>

          <div className="mt-5 space-y-3">
            {modoRankingLateral === 'setores' ? (
              rankingSetores.length === 0 ? (
                <p className="py-12 text-center text-xs text-slate-400">
                  Nenhum contrato vigente carregado.
                </p>
              ) : (
                rankingSetores.map((item, idx) => {
                  const maxEmp = Math.max(1, rankingSetores[0]?.empenho || 1);
                  const largura = Math.max(4, Math.round((item.empenho / maxEmp) * 100));
                  return (
                    <div key={item.setor} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-slate-100 font-mono text-[10px] font-extrabold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {idx + 1}
                          </span>
                          <span className="font-extrabold text-slate-900 dark:text-white">
                            {item.setor}
                          </span>
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {item.qtd} contr.
                          </span>
                        </div>
                        <div className="font-mono text-xs font-extrabold text-slate-800 dark:text-slate-200">
                          {formatarMoedaCompacta(item.empenho)}{' '}
                          <span className="font-sans text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                            ({item.pct.toFixed(1)}%)
                          </span>
                        </div>
                      </div>
                      <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={`h-full rounded-full ${
                            idx === 0
                              ? 'bg-indigo-600 dark:bg-cyan-400'
                              : idx <= 2
                              ? 'bg-blue-500 dark:bg-indigo-400'
                              : 'bg-slate-400 dark:bg-slate-500'
                          }`}
                          style={{ width: `${largura}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )
            ) : dadosPorCategoria.length === 0 ? (
              <p className="py-12 text-center text-xs text-slate-400">
                Nenhum processo cadastrado ainda.
              </p>
            ) : (
              dadosPorCategoria.map((item, idx) => {
                const maxQtd = Math.max(1, dadosPorCategoria[0]?.qtd || 1);
                const largura = Math.max(6, Math.round((item.qtd / maxQtd) * 100));
                return (
                  <div key={item.categoriaCompleta} className="space-y-1">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-bold text-slate-800 dark:text-slate-200">
                        {item.nome}
                      </span>
                      <span className="shrink-0 font-mono font-extrabold text-slate-900 dark:text-white">
                        {item.qtd}{' '}
                        <span className="font-sans text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                          ({item.pct}%)
                        </span>
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full ${
                          idx === 0
                            ? 'bg-indigo-600'
                            : idx === 1
                            ? 'bg-blue-500'
                            : 'bg-sky-500/80'
                        }`}
                        style={{ width: `${largura}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ================= FAIXA 4: CARGA POR RESPONSÁVEL + FILA DE ATENÇÃO PRIORITÁRIA ================= */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        {/* Carga por servidor com micro-barra empilhada Normal vs Crítico/Alto */}
        <div className="flex flex-col rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 xl:col-span-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-slate-100 p-2 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Carga por responsável
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {rankingResponsaveisAtivos.length} servidores · Azul: regular · Rosa: alto/crítico
              </p>
            </div>
          </div>

          <div className="mt-4 max-h-80 space-y-2.5 overflow-y-auto pr-1">
            {rankingResponsaveisAtivos.length === 0 ? (
              <p className="py-10 text-center text-xs text-slate-400">
                Nenhum responsável com processo ativo no momento.
              </p>
            ) : (
              rankingResponsaveisAtivos.map(({ srv, qtdAtivos, qtdCriticos, qtdNormais }) => {
                const maxAtivos = Math.max(1, rankingResponsaveisAtivos[0]?.qtdAtivos || 1);
                const larguraTotal = Math.max(12, Math.round((qtdAtivos / maxAtivos) * 100));
                const pctCrit = Math.round((qtdCriticos / Math.max(1, qtdAtivos)) * 100);
                const pctNorm = 100 - pctCrit;
                return (
                  <div
                    key={srv}
                    className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 dark:border-slate-800/90 dark:bg-slate-950/50"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span
                        className="truncate font-bold text-slate-800 dark:text-slate-200"
                        title={srv}
                      >
                        {srv}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5 font-mono text-[11px]">
                        {qtdCriticos > 0 && (
                          <span className="rounded bg-rose-100 px-1.5 py-0.5 font-bold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                            {qtdCriticos} crit.
                          </span>
                        )}
                        <span className="rounded-md bg-blue-100 px-1.5 py-0.5 font-extrabold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                          {qtdAtivos}
                        </span>
                      </div>
                    </div>
                    <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="flex h-full overflow-hidden rounded-full"
                        style={{ width: `${larguraTotal}%` }}
                      >
                        {qtdNormais > 0 && (
                          <div className="h-full bg-blue-600" style={{ width: `${pctNorm}%` }} />
                        )}
                        {qtdCriticos > 0 && (
                          <div className="h-full bg-rose-500" style={{ width: `${pctCrit}%` }} />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Fila de atenção imediata com filtros */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 xl:col-span-8">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                Fila de atenção prioritária
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Clique sobre qualquer linha para abrir a ficha detalhada e auditoria
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-0.5 text-xs font-bold dark:border-slate-800 dark:bg-slate-950">
                {(
                  [
                    { id: 'todos', label: 'Todos' },
                    { id: 'criticos', label: 'Críticos' },
                    { id: 'vencendo', label: 'Vencendo' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFiltroFila(f.id)}
                    className={`rounded-lg px-2.5 py-1 transition ${
                      filtroFila === f.id
                        ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white'
                        : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => onIrParaAba('processos')}
                className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-500 dark:text-blue-400"
              >
                Ver todos ({processos.length}) →
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-bold uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="pb-3 pr-4">E-Docs</th>
                  <th className="pb-3 pr-4">Assunto / Setor</th>
                  <th className="pb-3 pr-4">Situação</th>
                  <th className="pb-3 pr-4">Prioridade</th>
                  <th className="pb-3 pr-4">Prazo</th>
                  <th className="pb-3">Responsável</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                {processosAtencao.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="py-10 text-center text-xs text-slate-400"
                    >
                      <div className="inline-flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Nenhum processo nesta seleção de prioridade no momento.
                      </div>
                    </td>
                  </tr>
                ) : (
                  processosAtencao.map((p) => (
                    <tr
                      key={p.id}
                      onClick={() => onSelecionarProcesso(p, 'detalhes')}
                      className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="whitespace-nowrap py-3 pr-4 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                        <div className="flex items-center gap-1.5">
                          {p.numeroEdocs}
                          {p.restritoTv && (
                            <span title="Oculto no Modo TV">
                              <Lock className="h-3.5 w-3.5 text-rose-500" />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="max-w-xs truncate font-semibold text-slate-900 dark:text-slate-100">
                          {p.assunto}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {p.setorDemandante}
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4">
                        <SituacaoBadge situacao={p.situacao} />
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4">
                        <PrioridadeBadge prioridade={p.prioridade} />
                      </td>
                      <td className="whitespace-nowrap py-3 pr-4">
                        <PrazoBadge
                          processo={p}
                          diasAlerta={configTv.diasAlertaPrazoProximo}
                        />
                      </td>
                      <td className="whitespace-nowrap py-3 text-xs font-medium text-slate-700 dark:text-slate-300">
                        {p.responsavel}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
