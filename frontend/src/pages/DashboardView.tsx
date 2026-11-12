import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FolderKanban,
  Flame,
  Users,
  ArrowUpRight,
  Lock,
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import {
  CATEGORIAS_SLC,
  ConfiguracaoTV,
  ETAPAS_KANBAN,
  ProcessoSLC,
} from '../types/slc';
import {
  calcularDiasSemAtualizacao,
  obterListaResponsaveisUnicos,
  obterStatusPrazo,
} from '../services/slcService';
import { PrazoBadge, PrioridadeBadge, SituacaoBadge } from '../components/StatusBadges';

interface DashboardViewProps {
  processos: ProcessoSLC[];
  configTv: ConfiguracaoTV;
  onSelecionarProcesso: (p: ProcessoSLC, modo: 'detalhes' | 'editar') => void;
  onIrParaAba: (aba: 'processos' | 'kanban' | 'prazos') => void;
}

const CORES_GRAFICO = [
  '#2563EB',
  '#7C3AED',
  '#0891B2',
  '#D97706',
  '#059669',
  '#E11D48',
  '#4F46E5',
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  processos,
  configTv,
  onSelecionarProcesso,
  onIrParaAba,
}) => {
  const ativos = processos.filter((p) => p.situacao !== 'Concluído');
  const concluidos = processos.filter((p) => p.situacao === 'Concluído');

  const vencidos = ativos.filter(
    (p) => obterStatusPrazo(p, configTv.diasAlertaPrazoProximo) === 'VENCIDO'
  );
  const proximosVencer = ativos.filter(
    (p) => obterStatusPrazo(p, configTv.diasAlertaPrazoProximo) === 'PROXIMO'
  );
  const semAtualizacao = ativos.filter(
    (p) =>
      calcularDiasSemAtualizacao(p.atualizadoEm) >= configTv.diasAlertaInatividade
  );
  const aguardandoProvidencia = ativos.filter(
    (p) =>
      p.situacao === 'Aguardando documentação' ||
      p.situacao === 'Aguardando aprovação' ||
      p.situacao === 'Em andamento externo'
  );

  // Dados para o Gráfico de Barras por Etapa
  const dadosPorEtapa = ETAPAS_KANBAN.map((etapa) => {
    const itens = processos.filter((p) => p.situacao === etapa);
    const nomeCurto = etapa
      .replace('Recebido pela SLC', 'Recebido')
      .replace('Aguardando documentação', 'Ag. doc.')
      .replace('Aguardando aprovação', 'Ag. aprov.')
      .replace('Em andamento externo', 'Externo');
    return {
      etapa: nomeCurto,
      etapaCompleta: etapa,
      quantidade: itens.length,
    };
  });

  // Dados para o gráfico de rosca por categoria
  const dadosPorCategoria = CATEGORIAS_SLC.map((cat) => {
    const qtd = processos.filter((p) => p.categoria === cat).length;
    const nomeCurto = cat.split(' (')[0];
    return {
      name: nomeCurto,
      categoriaCompleta: cat,
      value: qtd,
    };
  }).filter((d) => d.value > 0);

  // Evolução mensal calculada a partir das datas reais de entrada dos processos cadastrados
  const evolucaoMensalReal = React.useMemo(() => {
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

  const rankingResponsaveisAtivos = React.useMemo(() => {
    const lista = obterListaResponsaveisUnicos(processos).map((srv) => {
      const qtdAtivos = ativos.filter((p) => p.responsavel === srv).length;
      const qtdTotal = processos.filter((p) => p.responsavel === srv).length;
      const qtdCriticos = ativos.filter(
        (p) => p.responsavel === srv && p.prioridade === 'Crítica'
      ).length;
      return { srv, qtdAtivos, qtdTotal, qtdCriticos };
    });

    return lista
      .filter((item) => item.qtdAtivos > 0)
      .sort((a, b) => b.qtdAtivos - a.qtdAtivos || b.qtdTotal - a.qtdTotal);
  }, [processos, ativos]);

  const processosAtencao = ativos
    .filter(
      (p) =>
        obterStatusPrazo(p, configTv.diasAlertaPrazoProximo) === 'VENCIDO' ||
        obterStatusPrazo(p, configTv.diasAlertaPrazoProximo) === 'PROXIMO' ||
        p.prioridade === 'Crítica'
    )
    .slice(0, 6);

  return (
    <div className="space-y-6">
      {/* KPIs executivos */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <div
          onClick={() => onIrParaAba('processos')}
          className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/90"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-blue-600" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Processos ativos
            </span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
              <FolderKanban className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
              {ativos.length}
            </span>
            <span className="rounded-md bg-blue-50 px-1.5 py-0.5 text-[11px] font-bold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
              Total: {processos.length}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Em tramitação interna na SLC
          </p>
        </div>

        <div
          onClick={() => onIrParaAba('kanban')}
          className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/90"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-amber-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Ag. providência
            </span>
            <div className="rounded-xl bg-amber-50 p-2 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-amber-600 dark:text-amber-300">
            {aguardandoProvidencia.length}
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Documentação, aprovação ou externo
          </p>
        </div>

        <div
          onClick={() => onIrParaAba('prazos')}
          className="group relative cursor-pointer overflow-hidden rounded-2xl border border-rose-200 bg-rose-50/40 p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-rose-400 hover:shadow-md dark:border-rose-500/30 dark:bg-rose-950/20"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-rose-600" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
              Prazos críticos
            </span>
            <div className="rounded-xl bg-rose-100 p-2 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400">
              <Flame className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-rose-600 dark:text-rose-300">
              {vencidos.length}
            </span>
            <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
              +{proximosVencer.length} em {configTv.diasAlertaPrazoProximo}d
            </span>
          </div>
          <p className="mt-1.5 text-xs font-medium text-rose-700/80 dark:text-rose-300/80">
            Ver painel de prazos →
          </p>
        </div>

        <div
          onClick={() => onIrParaAba('prazos')}
          className="group relative cursor-pointer overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-900/90"
        >
          <div className="absolute inset-x-0 top-0 h-1 bg-sky-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Sem atualização (&gt;{configTv.diasAlertaInatividade}d)
            </span>
            <div className="rounded-xl bg-sky-50 p-2 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-sky-600 dark:text-sky-300">
            {semAtualizacao.length}
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Inatividade de registro interno
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
          <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Concluídos
            </span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-emerald-600 dark:text-emerald-300">
            {concluidos.length}
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
            Etapa concluída na SLC
          </p>
        </div>
      </div>

      {/* Linha principal de gráficos recharts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Gráfico 1: Barras por etapa do fluxo interno */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 lg:col-span-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
                <BarChart3 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Volume de processos por etapa interna
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Distribuição real dos processos cadastrados no sistema
                </p>
              </div>
            </div>
            <button
              onClick={() => onIrParaAba('kanban')}
              className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-100 dark:bg-blue-500/15 dark:text-blue-400 dark:hover:bg-blue-500/25"
            >
              Abrir kanban <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-6 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={dadosPorEtapa}
                margin={{ top: 8, right: 12, left: -18, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="rgba(148, 163, 184, 0.2)"
                />
                <XAxis
                  dataKey="etapa"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(59, 130, 246, 0.08)' }}
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '12px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <Bar
                  dataKey="quantidade"
                  name="Processos"
                  fill="#2563EB"
                  radius={[8, 8, 0, 0]}
                  barSize={34}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico 2: Rosca por categoria */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 lg:col-span-5">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
              <PieChartIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Distribuição por categoria
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Classificação dos processos cadastrados
              </p>
            </div>
          </div>

          {dadosPorCategoria.length === 0 ? (
            <div className="flex h-52 items-center justify-center text-xs text-slate-400">
              Nenhum processo cadastrado ainda.
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-1 items-center gap-4 sm:grid-cols-2">
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dadosPorCategoria}
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={78}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {dadosPorCategoria.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CORES_GRAFICO[index % CORES_GRAFICO.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#1e293b',
                        borderRadius: '12px',
                        color: '#f8fafc',
                        fontSize: '12px',
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2">
                {dadosPorCategoria.map((item, idx) => (
                  <div
                    key={item.name}
                    className="flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{
                          backgroundColor:
                            CORES_GRAFICO[idx % CORES_GRAFICO.length],
                        }}
                      />
                      <span className="truncate font-medium text-slate-700 dark:text-slate-300">
                        {item.name}
                      </span>
                    </div>
                    <span className="ml-2 font-bold text-slate-900 dark:text-white">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Segunda linha: Evolução mensal + carga por servidor */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Evolução mensal recebidos vs concluídos */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 lg:col-span-7">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Fluxo mensal: Recebidos vs. Concluídos
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Calculado com base na data de entrada dos processos registrados
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <span className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-600" /> Recebidos
              </span>
              <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Concluídos
              </span>
            </div>
          </div>

          <div className="mt-5 h-52 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={evolucaoMensalReal}
                margin={{ top: 10, right: 12, left: -18, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorRec" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#2563EB" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#2563EB" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorConc" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="rgba(148, 163, 184, 0.2)"
                />
                <XAxis
                  dataKey="mes"
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: '#64748b' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0f172a',
                    borderColor: '#1e293b',
                    borderRadius: '12px',
                    color: '#f8fafc',
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="recebidos"
                  name="Recebidos"
                  stroke="#2563EB"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorRec)"
                />
                <Area
                  type="monotone"
                  dataKey="concluidos"
                  name="Concluídos"
                  stroke="#10B981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorConc)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Distribuição por servidor responsável */}
        <div className="flex flex-col justify-between rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 lg:col-span-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="rounded-xl bg-slate-100 p-2 text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                <Users className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Processos ativos por responsável
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ranking de gestores com processos ativos ({rankingResponsaveisAtivos.length})
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 max-h-52 space-y-2.5 overflow-y-auto pr-1.5">
            {rankingResponsaveisAtivos.length === 0 ? (
              <p className="py-10 text-center text-xs text-slate-400">
                Nenhum responsável com processo ativo no momento.
              </p>
            ) : (
              rankingResponsaveisAtivos.map(({ srv, qtdAtivos, qtdCriticos }) => {
                const pct = Math.min(
                  100,
                  Math.round((qtdAtivos / Math.max(1, ativos.length)) * 100)
                );
                return (
                  <div
                    key={srv}
                    className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-2.5 dark:border-slate-800/90 dark:bg-slate-950/50"
                  >
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-semibold text-slate-800 dark:text-slate-200">
                        {srv}
                      </span>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {qtdCriticos > 0 && (
                          <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
                            {qtdCriticos} crítico(s)
                          </span>
                        )}
                        <span className="rounded-md bg-blue-100 px-2 py-0.5 font-bold text-blue-700 dark:bg-blue-500/20 dark:text-blue-300">
                          {qtdAtivos} ativo(s)
                        </span>
                      </div>
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-blue-600"
                        style={{ width: `${Math.max(pct, 12)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Tabela de atenção imediata */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Fila de atenção prioritária (críticos e prazos sensíveis)
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Clique sobre qualquer processo para abrir a ficha detalhada e a trilha de
              auditoria
            </p>
          </div>
          <button
            onClick={() => onIrParaAba('processos')}
            className="inline-flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-500 dark:text-blue-400"
          >
            Ver todos os {processos.length} processos →
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs font-bold uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <th className="pb-3 pr-4">E-Docs</th>
                <th className="pb-3 pr-4">Assunto / Setor demandante</th>
                <th className="pb-3 pr-4">Situação</th>
                <th className="pb-3 pr-4">Prioridade</th>
                <th className="pb-3 pr-4">Prazo</th>
                <th className="pb-3 pr-4">Responsável</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
              {processosAtencao.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-xs text-slate-400"
                  >
                    Nenhum processo crítico ou com alerta de prazo registrado no momento.
                  </td>
                </tr>
              ) : (
                processosAtencao.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => onSelecionarProcesso(p, 'detalhes')}
                    className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="whitespace-nowrap py-3.5 pr-4 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                      <div className="flex items-center gap-1.5">
                        {p.numeroEdocs}
                        {p.restritoTv && (
                          <span title="Oculto no Modo TV">
                            <Lock className="h-3.5 w-3.5 text-rose-500" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 pr-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">
                        {p.assunto}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {p.categoria} · {p.setorDemandante}
                      </div>
                    </td>
                    <td className="whitespace-nowrap py-3.5 pr-4">
                      <SituacaoBadge situacao={p.situacao} />
                    </td>
                    <td className="whitespace-nowrap py-3.5 pr-4">
                      <PrioridadeBadge prioridade={p.prioridade} />
                    </td>
                    <td className="whitespace-nowrap py-3.5 pr-4">
                      <PrazoBadge
                        processo={p}
                        diasAlerta={configTv.diasAlertaPrazoProximo}
                      />
                    </td>
                    <td className="whitespace-nowrap py-3.5 pr-4 text-xs font-medium text-slate-700 dark:text-slate-300">
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
  );
};
