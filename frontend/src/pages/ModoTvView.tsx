import React, { useState, useEffect, useMemo } from 'react';
import {
  Tv,
  Pause,
  Play,
  SkipForward,
  Wifi,
  WifiOff,
  ShieldCheck,
  Clock,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  FileSignature,
  LogOut,
  Eye,
  EyeOff,
  Landmark,
  Wallet,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import {
  ConfiguracaoTV,
  ContratoSLC,
  ProcessoSLC,
} from '../types/slc';
import {
  calcularDiasAtePrazo,
} from '../services/slcService';

interface ModoTvViewProps {
  processos: ProcessoSLC[];
  contratos: ContratoSLC[];
  configTv: ConfiguracaoTV;
  onAtualizarConfigTv: (nova: ConfiguracaoTV) => void;
  onSairModoTv: () => void;
}

const TELAS_TV = [
  {
    indice: 0,
    titulo: '1/3 · Visão geral dos contratos vigentes',
    subtitulo: 'Indicadores consolidados de vigência, empenho, execução e setores da SLC',
  },
  {
    indice: 1,
    titulo: '2/3 · Painel geral de contratos vigentes',
    subtitulo: 'Todos os contratos vigentes ordenados por data de término e paginados automaticamente',
  },
  {
    indice: 2,
    titulo: '3/3 · Alertas de vencimento, prorrogações e novas contratações',
    subtitulo: 'Monitoramento dos contratos em janela crítica (≤90d e ≤180d) e necessidade de licitação',
  },
];

function formatarMoeda(valor: number): string {
  return (valor || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function formatarDataBr(iso?: string): string {
  if (!iso || iso.length < 10) return iso || '—';
  try {
    return new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR');
  } catch {
    return iso;
  }
}

export const ModoTvView: React.FC<ModoTvViewProps> = ({
  processos,
  contratos,
  configTv,
  onAtualizarConfigTv,
  onSairModoTv,
}) => {
  const [telaAtual, setTelaAtual] = useState<number>(0);
  const [paginaContratos, setPaginaContratos] = useState<number>(0);
  const [pausado, setPausado] = useState<boolean>(false);
  const [segundosDecorridos, setSegundosDecorridos] = useState<number>(0);
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState<Date>(new Date());
  const [simulandoFalhaRede, setSimulandoFalhaRede] = useState<boolean>(false);

  const qtdRestritosOcultos = processos.filter((p) => p.restritoTv).length;

  // Ordena todos os contratos pela data de término (exatamente como a aba "vigentes")
  const contratosOrdenados = useMemo(
    () => [...contratos].sort((a, b) => a.fimVigencia.localeCompare(b.fimVigencia)),
    [contratos]
  );

  const ITENS_POR_PAGINA_TV = 11;
  const totalPaginasContratos = Math.max(
    1,
    Math.ceil(contratosOrdenados.length / ITENS_POR_PAGINA_TV)
  );

  const contratosPaginaAtual = useMemo(() => {
    const inicio = paginaContratos * ITENS_POR_PAGINA_TV;
    return contratosOrdenados.slice(inicio, inicio + ITENS_POR_PAGINA_TV);
  }, [contratosOrdenados, paginaContratos]);

  // Totais financeiros e de vigência
  const totalEmpenhado = useMemo(
    () => contratos.reduce((acc, c) => acc + (c.valorGlobal || 0), 0),
    [contratos]
  );
  const totalGasto = useMemo(
    () => contratos.reduce((acc, c) => acc + (c.totalGasto || 0), 0),
    [contratos]
  );
  const saldoTotal = useMemo(
    () => contratos.reduce((acc, c) => acc + (c.saldoDisponivel || 0), 0),
    [contratos]
  );

  const criticosAte45d = useMemo(
    () =>
      contratosOrdenados.filter((c) => {
        const d = calcularDiasAtePrazo(c.fimVigencia);
        return d !== null && d <= 45;
      }),
    [contratosOrdenados]
  );

  const janela46a90d = useMemo(
    () =>
      contratosOrdenados.filter((c) => {
        const d = calcularDiasAtePrazo(c.fimVigencia);
        return d !== null && d > 45 && d <= 90;
      }),
    [contratosOrdenados]
  );

  const janela91a180d = useMemo(
    () =>
      contratosOrdenados.filter((c) => {
        const d = calcularDiasAtePrazo(c.fimVigencia);
        return d !== null && d > 90 && d <= 180;
      }),
    [contratosOrdenados]
  );

  const distribuicaoSetores = useMemo(() => {
    const mapa = new Map<string, { qtd: number; empenho: number }>();
    contratos.forEach((c) => {
      const sigla = (c.setorDemandante || 'SLC').split(' — ')[0];
      const atual = mapa.get(sigla) || { qtd: 0, empenho: 0 };
      mapa.set(sigla, {
        qtd: atual.qtd + 1,
        empenho: atual.empenho + (c.valorGlobal || 0),
      });
    });
    return Array.from(mapa.entries())
      .map(([setor, info]) => ({ setor, ...info }))
      .sort((a, b) => b.qtd - a.qtd)
      .slice(0, 8);
  }, [contratos]);

  // Função para avançar o ciclo (se estiver na tela 2, percorre todas as páginas de contratos antes de ir para a tela 3)
  const avancarCicloTv = () => {
    setTelaAtual((tAtual) => {
      if (tAtual === 1 && paginaContratos + 1 < totalPaginasContratos) {
        setPaginaContratos((p) => p + 1);
        return 1;
      }
      setPaginaContratos(0);
      return (tAtual + 1) % 3;
    });
  };

  // Tecla ESC para sair do modo TV e setas para navegar
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSairModoTv();
      if (e.key === 'ArrowRight') {
        avancarCicloTv();
        setSegundosDecorridos(0);
      }
      if (e.key === ' ') {
        e.preventDefault();
        setPausado((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  // Temporizador de alternância automática
  useEffect(() => {
    if (pausado) return;
    const timer = setInterval(() => {
      setSegundosDecorridos((prev) => {
        if (prev + 1 >= configTv.intervaloSegundos) {
          avancarCicloTv();
          if (!simulandoFalhaRede) {
            setUltimaSincronizacao(new Date());
          }
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [pausado, configTv.intervaloSegundos, simulandoFalhaRede, paginaContratos, totalPaginasContratos]);

  const progressoPct = Math.min(
    100,
    Math.round((segundosDecorridos / configTv.intervaloSegundos) * 100)
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-slate-950 text-slate-100">
      {/* Barra de progresso da rotação da TV */}
      <div className="h-1.5 w-full bg-slate-900">
        <div
          className="h-full bg-blue-500 transition-all duration-1000 ease-linear"
          style={{ width: `${progressoPct}%` }}
        />
      </div>

      {/* Alerta de perda de conexão (RNF-07) */}
      {simulandoFalhaRede && (
        <div className="flex items-center justify-between border-b border-amber-500/50 bg-amber-500/20 px-8 py-2.5 text-amber-200">
          <div className="flex items-center gap-3 text-sm font-semibold">
            <WifiOff className="h-5 w-5 animate-pulse text-amber-400" />
            <span>
              ATENÇÃO: Falha de comunicação com a API detectada. Exibindo última fotografia
              válida sincronizada às {ultimaSincronizacao.toLocaleTimeString('pt-BR')}.
              Tentando reconexão automática...
            </span>
          </div>
          <button
            onClick={() => {
              setSimulandoFalhaRede(false);
              setUltimaSincronizacao(new Date());
            }}
            className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-slate-950 hover:bg-amber-400"
          >
            Restabelecer conexão
          </button>
        </div>
      )}

      {/* Cabeçalho da TV */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/90 bg-slate-900/90 px-8 py-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-500/40 bg-blue-600/20 text-blue-400">
            <Tv className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold uppercase tracking-widest text-blue-400">
                PAINEL DE MONITORAMENTO DE CONTRATOS
              </span>
            </div>
            <h1 className="mt-0.5 text-xl font-extrabold tracking-tight text-white sm:text-2xl">
              {TELAS_TV[telaAtual].titulo}
              {telaAtual === 1 && (
                <span className="ml-3 rounded-lg bg-blue-600/30 px-2.5 py-0.5 text-sm font-bold text-blue-300">
                  Página {paginaContratos + 1} de {totalPaginasContratos} ({contratosOrdenados.length} contratos)
                </span>
              )}
            </h1>
          </div>
        </div>

        {/* Seletor das 3 telas + controles para apresentação */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex rounded-xl border border-slate-800 bg-slate-950 p-1">
            {TELAS_TV.map((t) => (
              <button
                key={t.indice}
                onClick={() => {
                  setTelaAtual(t.indice);
                  setPaginaContratos(0);
                  setSegundosDecorridos(0);
                }}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                  telaAtual === t.indice
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Tela {t.indice + 1}
              </button>
            ))}
          </div>

          {telaAtual === 1 && (
            <div className="flex items-center gap-1 rounded-xl border border-slate-700 bg-slate-900 px-2 py-1">
              <button
                onClick={() => {
                  setPaginaContratos((p) => (p - 1 + totalPaginasContratos) % totalPaginasContratos);
                  setSegundosDecorridos(0);
                }}
                className="rounded p-1 text-slate-300 hover:bg-slate-800 hover:text-white"
                title="Página anterior de contratos"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-1.5 font-mono text-xs font-bold text-blue-300">
                Pág. {paginaContratos + 1}/{totalPaginasContratos}
              </span>
              <button
                onClick={() => {
                  setPaginaContratos((p) => (p + 1) % totalPaginasContratos);
                  setSegundosDecorridos(0);
                }}
                className="rounded p-1 text-slate-300 hover:bg-slate-800 hover:text-white"
                title="Próxima página de contratos"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          <button
            onClick={() => setPausado((p) => !p)}
            title="Pausar ou retomar (Espaço)"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            {pausado ? (
              <>
                <Play className="h-4 w-4 text-emerald-400" /> Retomar
              </>
            ) : (
              <>
                <Pause className="h-4 w-4 text-amber-400" /> Pausar ({configTv.intervaloSegundos - segundosDecorridos}s)
              </>
            )}
          </button>

          <button
            onClick={() => {
              avancarCicloTv();
              setSegundosDecorridos(0);
            }}
            title="Avançar (seta direita)"
            className="rounded-xl border border-slate-700 bg-slate-800 p-2 text-slate-200 hover:bg-slate-700"
          >
            <SkipForward className="h-4 w-4" />
          </button>

          <select
            value={configTv.intervaloSegundos}
            onChange={(e) => {
              onAtualizarConfigTv({
                ...configTv,
                intervaloSegundos: Number(e.target.value),
              });
              setSegundosDecorridos(0);
            }}
            className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200"
          >
            <option value={10}>Ciclo: 10s</option>
            <option value={15}>Ciclo: 15s</option>
            <option value={20}>Ciclo: 20s</option>
            <option value={30}>Ciclo: 30s</option>
          </select>
          <button
            onClick={onSairModoTv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/25"
          >
            <LogOut className="h-4 w-4" /> Sair (Esc)
          </button>
        </div>
      </header>

      {/* Conteúdo principal em tela cheia 16:9 */}
      <main className="flex-1 overflow-y-auto px-8 py-5">
        {telaAtual === 0 && (
          /* ================= TELA 1: VISÃO GERAL DOS CONTRATOS ================= */
          <div className="flex h-full flex-col justify-between gap-6">
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-7">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-sm font-bold uppercase tracking-wider">
                    Contratos vigentes
                  </span>
                  <FileSignature className="h-7 w-7 text-blue-400" />
                </div>
                <div className="mt-4 text-6xl font-black text-white">
                  {contratos.length}
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  {contratos.filter((c) => c.prorrogavel).length} Prorrogáveis (P) ·{' '}
                  {contratos.filter((c) => !c.prorrogavel).length} Nova contratação (NP)
                </p>
              </div>

              <div className="rounded-3xl border border-indigo-500/30 bg-slate-900/90 p-7">
                <div className="flex items-center justify-between text-indigo-300">
                  <span className="text-sm font-bold uppercase tracking-wider">
                    Total empenhado (2026)
                  </span>
                  <Landmark className="h-7 w-7 text-indigo-400" />
                </div>
                <div className="mt-4 text-4xl font-black text-white">
                  {formatarMoeda(totalEmpenhado)}
                </div>
                <p className="mt-2 text-sm text-indigo-200/80">
                  Gasto acumulado: <strong>{formatarMoeda(totalGasto)}</strong>
                </p>
              </div>

              <div className="rounded-3xl border border-emerald-500/30 bg-slate-900/90 p-7">
                <div className="flex items-center justify-between text-emerald-300">
                  <span className="text-sm font-bold uppercase tracking-wider">
                    Saldo de empenho
                  </span>
                  <Wallet className="h-7 w-7 text-emerald-400" />
                </div>
                <div className="mt-4 text-4xl font-black text-emerald-300">
                  {formatarMoeda(saldoTotal)}
                </div>
                <p className="mt-2 text-sm text-emerald-200/70">
                  Disponível para execução nos contratos ativos
                </p>
              </div>

              <div className="rounded-3xl border border-rose-500/40 bg-rose-950/20 p-7">
                <div className="flex items-center justify-between text-rose-300">
                  <span className="text-sm font-bold uppercase tracking-wider">
                    Vencendo em ≤ 90 dias
                  </span>
                  <CalendarClock className="h-7 w-7 text-rose-400" />
                </div>
                <div className="mt-4 flex items-baseline gap-3">
                  <span className="text-6xl font-black text-rose-300">
                    {criticosAte45d.length + janela46a90d.length}
                  </span>
                  <span className="text-lg font-semibold text-amber-300">
                    + {janela91a180d.length} até 180d
                  </span>
                </div>
                <p className="mt-2 text-sm text-rose-200/80">
                  Prioridade de instrução de aditivo ou nova licitação
                </p>
              </div>
            </div>

            {/* Distribuição de Contratos por Setor Solicitante do IPAJM */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-7">
              <h2 className="text-xl font-bold text-white">
                Distribuição dos contratos vigentes por setor solicitante (IPAJM)
              </h2>
              <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {distribuicaoSetores.map((item) => {
                  const pct = Math.round(
                    (item.qtd / Math.max(1, contratos.length)) * 100
                  );
                  return (
                    <div
                      key={item.setor}
                      className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-base font-extrabold text-blue-400">
                          {item.setor}
                        </span>
                        <span className="text-2xl font-black text-white">
                          {item.qtd} contr.
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-slate-400">
                        Empenhado: {formatarMoeda(item.empenho)}
                      </div>
                      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className="h-full rounded-full bg-blue-500"
                          style={{ width: `${Math.max(pct, 8)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {telaAtual === 1 && (
          /* ================= TELA 2: TODOS OS CONTRATOS VIGENTES (PAGINADOS) ================= */
          <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-5">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  <th className="pb-3 pr-3">#</th>
                  <th className="pb-3 pr-3">Término / Prazo</th>
                  <th className="pb-3 pr-3">Empresa / Objeto</th>
                  <th className="pb-3 pr-3">Nº contrato</th>
                  <th className="pb-3 pr-3">Proc. mãe / Pagto</th>
                  <th className="pb-3 pr-3">Setor</th>
                  <th className="pb-3 pr-3">P / NP</th>
                  <th className="pb-3 pr-3 text-right">Saldo empenho</th>
                  {configTv.exibirResponsavelTv && (
                    <th className="pb-3">Gestor / Fiscal titular</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-sm">
                {contratosPaginaAtual.map((c, idx) => {
                  const numOrdem = paginaContratos * ITENS_POR_PAGINA_TV + idx + 1;
                  const dias = calcularDiasAtePrazo(c.fimVigencia) ?? 0;
                  const critico = dias <= 45;
                  const alerta = dias > 45 && dias <= 90;

                  return (
                    <tr key={c.id} className="hover:bg-slate-800/40">
                      <td className="whitespace-nowrap py-2.5 pr-3 font-mono text-sm font-bold text-slate-400">
                        {numOrdem}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-extrabold text-white">
                            {formatarDataBr(c.fimVigencia)}
                          </span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-extrabold ${
                              critico
                                ? 'bg-rose-500/25 text-rose-300 border border-rose-500/40'
                                : alerta
                                ? 'bg-amber-500/25 text-amber-300 border border-amber-500/40'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {dias}d
                          </span>
                        </div>
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="font-extrabold text-white">
                          {c.empresaContratada}
                        </div>
                        <div className="max-w-xs truncate text-xs text-slate-400">
                          {c.objeto}
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3 font-mono text-xs font-bold text-blue-300">
                        {c.numeroContrato}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3 font-mono text-xs">
                        <div className="font-bold text-slate-200">
                          Mãe: {c.numeroEdocs}
                        </div>
                        {c.processoPagamento && (
                          <div className="text-indigo-300">
                            Pagto: {c.processoPagamento}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3 text-xs font-bold text-slate-300">
                        {(c.setorDemandante || 'SLC').split(' — ')[0]}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                            c.prorrogavel
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {c.prorrogavel ? 'P' : 'NP'}
                        </span>
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3 text-right font-mono text-sm font-extrabold text-emerald-300">
                        {formatarMoeda(c.saldoDisponivel)}
                      </td>
                      {configTv.exibirResponsavelTv && (
                        <td className="whitespace-nowrap py-2.5 text-xs">
                          <div className="font-bold text-slate-200">
                            G: {c.gestorContrato}
                          </div>
                          <div className="text-slate-400">
                            F: {c.fiscalTitular}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {telaAtual === 2 && (
          /* ================= TELA 3: JANELAS DE VENCIMENTO (≤45d, 46–90d, 91–180d) ================= */
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Coluna críticos <= 45 dias */}
              <div className="rounded-3xl border border-rose-500/40 bg-rose-950/20 p-6">
                <div className="flex items-center justify-between border-b border-rose-500/30 pb-4">
                  <div className="flex items-center gap-3">
                    <AlertOctagon className="h-7 w-7 text-rose-400" />
                    <h2 className="text-xl font-bold text-rose-200">
                      Crítico: vence em ≤ 45 dias
                    </h2>
                  </div>
                  <span className="rounded-2xl bg-rose-500/30 px-4 py-1 text-2xl font-black text-rose-200">
                    {criticosAte45d.length}
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  {criticosAte45d.map((c) => {
                    const dias = calcularDiasAtePrazo(c.fimVigencia) ?? 0;
                    return (
                      <div
                        key={c.id}
                        className="rounded-2xl border border-rose-500/30 bg-slate-950/80 p-5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-base font-extrabold text-rose-300">
                            {c.empresaContratada} ({c.numeroContrato})
                          </span>
                          <span className="rounded-lg bg-rose-500/30 px-2.5 py-1 text-xs font-extrabold text-rose-200">
                            {dias} dias ({formatarDataBr(c.fimVigencia)})
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-bold text-white">
                          {c.objeto}
                        </p>
                        <p className="mt-2 text-xs text-rose-200/90">
                          Proc. mãe: {c.numeroEdocs} ·{' '}
                          <strong>
                            {c.prorrogavel
                              ? 'Prorrogável (instruir aditivo)'
                              : 'Não prorrogável (nova contratação)'}
                          </strong>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Coluna alerta 46 a 90 dias */}
              <div className="rounded-3xl border border-amber-500/40 bg-amber-950/15 p-6">
                <div className="flex items-center justify-between border-b border-amber-500/30 pb-4">
                  <div className="flex items-center gap-3">
                    <Clock className="h-7 w-7 text-amber-400" />
                    <h2 className="text-xl font-bold text-amber-200">
                      Alerta: 46 a 90 dias
                    </h2>
                  </div>
                  <span className="rounded-2xl bg-amber-500/30 px-4 py-1 text-2xl font-black text-amber-200">
                    {janela46a90d.length}
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  {janela46a90d.map((c) => {
                    const dias = calcularDiasAtePrazo(c.fimVigencia) ?? 0;
                    return (
                      <div
                        key={c.id}
                        className="rounded-2xl border border-amber-500/30 bg-slate-950/80 p-5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-base font-extrabold text-amber-300">
                            {c.empresaContratada} ({c.numeroContrato})
                          </span>
                          <span className="rounded-lg bg-amber-500/30 px-2.5 py-1 text-xs font-extrabold text-amber-200">
                            {dias} dias ({formatarDataBr(c.fimVigencia)})
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-bold text-white">
                          {c.objeto}
                        </p>
                        <p className="mt-2 text-xs text-amber-200/90">
                          Proc. mãe: {c.numeroEdocs} ·{' '}
                          <strong>
                            {c.prorrogavel
                              ? 'Prorrogável (P)'
                              : 'Não prorrogável (NP - nova contratação)'}
                          </strong>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Coluna planejamento 91 a 180 dias */}
              <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-7 w-7 text-sky-400" />
                    <h2 className="text-xl font-bold text-slate-100">
                      Planejamento: 91 a 180 dias
                    </h2>
                  </div>
                  <span className="rounded-2xl bg-sky-500/25 px-4 py-1 text-2xl font-black text-sky-300">
                    {janela91a180d.length}
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  {janela91a180d.map((c) => {
                    const dias = calcularDiasAtePrazo(c.fimVigencia) ?? 0;
                    return (
                      <div
                        key={c.id}
                        className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-base font-extrabold text-blue-400">
                            {c.empresaContratada} ({c.numeroContrato})
                          </span>
                          <span className="rounded-lg bg-sky-500/20 px-2.5 py-1 text-xs font-bold text-sky-300">
                            {dias} dias ({formatarDataBr(c.fimVigencia)})
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-bold text-white">
                          {c.objeto}
                        </p>
                        <p className="mt-2 text-xs text-slate-400">
                          Setor: {(c.setorDemandante || 'SLC').split(' — ')[0]} ·{' '}
                          {c.prorrogavel ? 'Prorrogável (P)' : 'Nova contratação (NP)'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Rodapé de segurança e status de sincronização (RNF-07 / RF-13) */}
      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 bg-slate-900/95 px-8 py-3 text-xs text-slate-400">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            Painel sincronizado com a aba &ldquo;vigentes&rdquo; ({contratos.length} contratos ativos ·{' '}
            {qtdRestritosOcultos} restritos ocultados)
          </span>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setSimulandoFalhaRede((v) => !v)}
            className="rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] text-slate-300 hover:bg-slate-700"
          >
            {simulandoFalhaRede
              ? 'Restaurar conexão simulada'
              : 'Testar alerta de queda de conexão (RNF-07)'}
          </button>

          <div className="flex items-center gap-2 font-medium text-slate-300">
            {simulandoFalhaRede ? (
              <WifiOff className="h-4 w-4 text-amber-400" />
            ) : (
              <Wifi className="h-4 w-4 text-emerald-400" />
            )}
            <span>
              Última atualização bem-sucedida:{' '}
              <strong>{ultimaSincronizacao.toLocaleTimeString('pt-BR')}</strong>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
