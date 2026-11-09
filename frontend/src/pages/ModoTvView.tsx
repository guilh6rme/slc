import React, { useState, useEffect } from 'react';
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
  FolderKanban,
  LogOut,
  Eye,
  EyeOff,
} from 'lucide-react';
import {
  ConfiguracaoTV,
  ETAPAS_KANBAN,
  ProcessoSLC,
} from '../types/slc';
import {
  calcularDiasSemAtualizacao,
  obterProcessosSanitizadosParaTV,
  obterStatusPrazo,
} from '../services/slcService';
import { PrazoBadge, PrioridadeBadge, SituacaoBadge } from '../components/StatusBadges';

interface ModoTvViewProps {
  processos: ProcessoSLC[];
  configTv: ConfiguracaoTV;
  onAtualizarConfigTv: (nova: ConfiguracaoTV) => void;
  onSairModoTv: () => void;
}

const TELAS_TV = [
  {
    indice: 0,
    titulo: '1/3 · Visão Geral do Setor',
    subtitulo: 'Indicadores consolidados e distribuição operacional da SLC',
  },
  {
    indice: 1,
    titulo: '2/3 · Acompanhamento de Processos Prioritários',
    subtitulo: 'Fila ativa de processos acompanhados pela Subgerência de Licitações e Contratos',
  },
  {
    indice: 2,
    titulo: '3/3 · Prazos e Prioridades Operacionais',
    subtitulo: 'Monitoramento de vencimentos críticos, alertas próximos e revisão interna',
  },
];

export const ModoTvView: React.FC<ModoTvViewProps> = ({
  processos,
  configTv,
  onAtualizarConfigTv,
  onSairModoTv,
}) => {
  const [telaAtual, setTelaAtual] = useState<number>(0);
  const [pausado, setPausado] = useState<boolean>(false);
  const [segundosDecorridos, setSegundosDecorridos] = useState<number>(0);
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState<Date>(new Date());
  const [simulandoFalhaRede, setSimulandoFalhaRede] = useState<boolean>(false);

  // Sanitiza os dados (remove restritoTv e observacoesInternas)
  const processosPublicos = obterProcessosSanitizadosParaTV(processos, configTv);
  const qtdRestritosOcultos = processos.filter((p) => p.restritoTv).length;

  const ativos = processosPublicos.filter((p) => p.situacao !== 'Concluído');
  const concluidos = processosPublicos.filter((p) => p.situacao === 'Concluído');
  const pendentes = ativos.filter(
    (p) =>
      p.situacao === 'Aguardando documentação' ||
      p.situacao === 'Aguardando aprovação' ||
      p.situacao === 'Em andamento externo'
  );

  const vencidos = ativos.filter(
    (p) =>
      obterStatusPrazo(p as unknown as ProcessoSLC, configTv.diasAlertaPrazoProximo) ===
      'VENCIDO'
  );
  const proximos = ativos.filter(
    (p) =>
      obterStatusPrazo(p as unknown as ProcessoSLC, configTv.diasAlertaPrazoProximo) ===
      'PROXIMO'
  );
  const semAtualizacao = ativos.filter(
    (p) =>
      calcularDiasSemAtualizacao(p.atualizadoEm) >= configTv.diasAlertaInatividade
  );

  // Tecla ESC para sair do modo TV
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSairModoTv();
      if (e.key === 'ArrowRight') {
        setTelaAtual((prev) => (prev + 1) % 3);
        setSegundosDecorridos(0);
      }
      if (e.key === ' ') {
        e.preventDefault();
        setPausado((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onSairModoTv]);

  // Temporizador de alternância automática e atualização de relógio
  useEffect(() => {
    if (pausado) return;
    const timer = setInterval(() => {
      setSegundosDecorridos((prev) => {
        if (prev + 1 >= configTv.intervaloSegundos) {
          setTelaAtual((t) => (t + 1) % 3);
          if (!simulandoFalhaRede) {
            setUltimaSincronizacao(new Date());
          }
          return 0;
        }
        return prev + 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [pausado, configTv.intervaloSegundos, simulandoFalhaRede]);

  const progressoPct = Math.min(
    100,
    Math.round((segundosDecorridos / configTv.intervaloSegundos) * 100)
  );

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-slate-950 text-slate-100">
      {/* Barra de Progresso da Rotação da TV */}
      <div className="h-1.5 w-full bg-slate-900">
        <div
          className="h-full bg-blue-500 transition-all duration-1000 ease-linear"
          style={{ width: `${progressoPct}%` }}
        />
      </div>

      {/* Alerta de Perda de Conexão (RNF-07) */}
      {simulandoFalhaRede && (
        <div className="flex items-center justify-between bg-amber-500/20 border-b border-amber-500/50 px-8 py-2.5 text-amber-200">
          <div className="flex items-center gap-3 text-sm font-semibold">
            <WifiOff className="h-5 w-5 text-amber-400 animate-pulse" />
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
            Restabelecer Conexão
          </button>
        </div>
      )}

      {/* Cabeçalho da TV */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800/90 bg-slate-900/90 px-8 py-5">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600/20 border border-blue-500/40 text-blue-400">
            <Tv className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold uppercase tracking-widest text-blue-400">
                IPAJM · SLC DIGITAL · PAINEL DE MONITORAMENTO (1 TV)
              </span>
            </div>
            <h1 className="mt-0.5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              {TELAS_TV[telaAtual].titulo}
            </h1>
          </div>
        </div>

        {/* Seletor das 3 Telas + Controles para Apresentação */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl border border-slate-800 bg-slate-950 p-1">
            {TELAS_TV.map((t) => (
              <button
                key={t.indice}
                onClick={() => {
                  setTelaAtual(t.indice);
                  setSegundosDecorridos(0);
                }}
                className={`rounded-lg px-3.5 py-2 text-xs font-bold transition ${
                  telaAtual === t.indice
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Tela {t.indice + 1}
              </button>
            ))}
          </div>

          <button
            onClick={() => setPausado((p) => !p)}
            title="Pausar/Retomar rotação (Espaço)"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-700"
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
              setTelaAtual((prev) => (prev + 1) % 3);
              setSegundosDecorridos(0);
            }}
            title="Próxima tela (Seta direita)"
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
            <option value={15}>Ciclo: 15s</option>
            <option value={20}>Ciclo: 20s</option>
            <option value={30}>Ciclo: 30s</option>
          </select>

          <button
            onClick={() =>
              onAtualizarConfigTv({
                ...configTv,
                exibirResponsavelTv: !configTv.exibirResponsavelTv,
              })
            }
            title="Alternar visibilidade do nome do responsável na TV"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700"
          >
            {configTv.exibirResponsavelTv ? (
              <>
                <Eye className="h-3.5 w-3.5 text-blue-400" /> Resp: Visível
              </>
            ) : (
              <>
                <EyeOff className="h-3.5 w-3.5 text-slate-400" /> Resp: Oculto
              </>
            )}
          </button>

          <button
            onClick={onSairModoTv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-500/40 bg-rose-500/15 px-3.5 py-2 text-xs font-bold text-rose-200 hover:bg-rose-500/25"
          >
            <LogOut className="h-4 w-4" /> Sair (Esc)
          </button>
        </div>
      </header>

      {/* Conteúdo Principal em Tela Cheia 16:9 */}
      <main className="flex-1 overflow-y-auto px-8 py-6">
        {telaAtual === 0 && (
          /* ================= TELA 1: VISÃO GERAL ================= */
          <div className="flex h-full flex-col justify-between gap-6">
            <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
              <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-7">
                <div className="flex items-center justify-between text-slate-400">
                  <span className="text-sm font-bold uppercase tracking-wider">
                    Processos Ativos
                  </span>
                  <FolderKanban className="h-7 w-7 text-blue-400" />
                </div>
                <div className="mt-4 text-6xl font-black text-white">
                  {ativos.length}
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  Em acompanhamento público no painel
                </p>
              </div>

              <div className="rounded-3xl border border-amber-500/30 bg-slate-900/90 p-7">
                <div className="flex items-center justify-between text-amber-300">
                  <span className="text-sm font-bold uppercase tracking-wider">
                    Aguardando Providência
                  </span>
                  <Clock className="h-7 w-7 text-amber-400" />
                </div>
                <div className="mt-4 text-6xl font-black text-amber-300">
                  {pendentes.length}
                </div>
                <p className="mt-2 text-sm text-amber-200/70">
                  Documentação, aprovação ou externo
                </p>
              </div>

              <div className="rounded-3xl border border-rose-500/40 bg-rose-950/20 p-7">
                <div className="flex items-center justify-between text-rose-300">
                  <span className="text-sm font-bold uppercase tracking-wider">
                    Prazos Críticos / Vencidos
                  </span>
                  <AlertOctagon className="h-7 w-7 text-rose-400" />
                </div>
                <div className="mt-4 flex items-baseline gap-3">
                  <span className="text-6xl font-black text-rose-300">
                    {vencidos.length}
                  </span>
                  <span className="text-lg font-semibold text-amber-300">
                    + {proximos.length} próximos
                  </span>
                </div>
                <p className="mt-2 text-sm text-rose-200/80">
                  Prioridade máxima de acompanhamento
                </p>
              </div>

              <div className="rounded-3xl border border-emerald-500/30 bg-slate-900/90 p-7">
                <div className="flex items-center justify-between text-emerald-300">
                  <span className="text-sm font-bold uppercase tracking-wider">
                    Concluídos no Período
                  </span>
                  <CheckCircle2 className="h-7 w-7 text-emerald-400" />
                </div>
                <div className="mt-4 text-6xl font-black text-emerald-300">
                  {concluidos.length}
                </div>
                <p className="mt-2 text-sm text-emerald-200/70">
                  Etapa interna na SLC encerrada
                </p>
              </div>
            </div>

            {/* Distribuição por Situação em Tamanho Grande para Leitura a Distância */}
            <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-8">
              <h2 className="text-xl font-bold text-white">
                Distribuição dos Processos por Etapa Interna
              </h2>
              <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {ETAPAS_KANBAN.map((etapa) => {
                  const qtd = processosPublicos.filter(
                    (p) => p.situacao === etapa
                  ).length;
                  const pct = Math.round(
                    (qtd / Math.max(1, processosPublicos.length)) * 100
                  );
                  return (
                    <div
                      key={etapa}
                      className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-300">
                          {etapa}
                        </span>
                        <span className="text-2xl font-extrabold text-white">
                          {qtd}
                        </span>
                      </div>
                      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-800">
                        <div
                          className={`h-full rounded-full ${
                            etapa === 'Concluído'
                              ? 'bg-emerald-500'
                              : etapa.includes('Aguardando')
                              ? 'bg-amber-500'
                              : 'bg-blue-500'
                          }`}
                          style={{ width: `${Math.max(pct, qtd > 0 ? 8 : 0)}%` }}
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
          /* ================= TELA 2: ACOMPANHAMENTO DE PROCESSOS ================= */
          <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800 text-sm uppercase tracking-wider text-slate-400">
                  <th className="pb-4 pr-4">E-Docs</th>
                  <th className="pb-4 pr-4">Objeto / Categoria</th>
                  <th className="pb-4 pr-4">Situação Atual</th>
                  <th className="pb-4 pr-4">Prioridade</th>
                  <th className="pb-4 pr-4">Prazo</th>
                  {configTv.exibirResponsavelTv && (
                    <th className="pb-4">Responsável</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-base">
                {ativos.slice(0, 8).map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap py-4 pr-4 font-mono text-lg font-extrabold text-blue-400">
                      {p.numeroEdocs}
                    </td>
                    <td className="py-4 pr-4">
                      <div className="text-lg font-bold text-white">{p.assunto}</div>
                      <div className="text-sm text-slate-400">
                        {p.categoria} · {p.setorDemandante}
                      </div>
                    </td>
                    <td className="whitespace-nowrap py-4 pr-4">
                      <SituacaoBadge situacao={p.situacao} size="lg" />
                    </td>
                    <td className="whitespace-nowrap py-4 pr-4">
                      <PrioridadeBadge prioridade={p.prioridade} size="lg" />
                    </td>
                    <td className="whitespace-nowrap py-4 pr-4">
                      <PrazoBadge
                        processo={p as unknown as ProcessoSLC}
                        diasAlerta={configTv.diasAlertaPrazoProximo}
                        size="lg"
                      />
                    </td>
                    {configTv.exibirResponsavelTv && (
                      <td className="whitespace-nowrap py-4 text-base font-medium text-slate-200">
                        {p.responsavel?.split(' (')[0]}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {telaAtual === 2 && (
          /* ================= TELA 3: PRAZOS E PRIORIDADES ================= */
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Coluna Vencidos */}
              <div className="rounded-3xl border border-rose-500/40 bg-rose-950/20 p-6">
                <div className="flex items-center justify-between border-b border-rose-500/30 pb-4">
                  <div className="flex items-center gap-3">
                    <AlertOctagon className="h-7 w-7 text-rose-400" />
                    <h2 className="text-xl font-bold text-rose-200">
                      Prazos Vencidos
                    </h2>
                  </div>
                  <span className="rounded-2xl bg-rose-500/30 px-4 py-1 text-2xl font-black text-rose-200">
                    {vencidos.length}
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  {vencidos.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-2xl border border-rose-500/30 bg-slate-950/80 p-5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-lg font-bold text-rose-300">
                          {p.numeroEdocs}
                        </span>
                        <PrazoBadge
                          processo={p as unknown as ProcessoSLC}
                          diasAlerta={configTv.diasAlertaPrazoProximo}
                        />
                      </div>
                      <p className="mt-2 text-base font-bold text-white">
                        {p.assunto}
                      </p>
                      {p.pendenciaAtual && (
                        <p className="mt-2 text-sm text-rose-200/90">
                          Providência: {p.pendenciaAtual}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Coluna Próximos de Vencer */}
              <div className="rounded-3xl border border-amber-500/40 bg-amber-950/15 p-6">
                <div className="flex items-center justify-between border-b border-amber-500/30 pb-4">
                  <div className="flex items-center gap-3">
                    <Clock className="h-7 w-7 text-amber-400" />
                    <h2 className="text-xl font-bold text-amber-200">
                      Vencem em até {configTv.diasAlertaPrazoProximo} dias
                    </h2>
                  </div>
                  <span className="rounded-2xl bg-amber-500/30 px-4 py-1 text-2xl font-black text-amber-200">
                    {proximos.length}
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  {proximos.map((p) => (
                    <div
                      key={p.id}
                      className="rounded-2xl border border-amber-500/30 bg-slate-950/80 p-5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-lg font-bold text-amber-300">
                          {p.numeroEdocs}
                        </span>
                        <PrazoBadge
                          processo={p as unknown as ProcessoSLC}
                          diasAlerta={configTv.diasAlertaPrazoProximo}
                        />
                      </div>
                      <p className="mt-2 text-base font-bold text-white">
                        {p.assunto}
                      </p>
                      {p.pendenciaAtual && (
                        <p className="mt-2 text-sm text-amber-200/90">
                          Providência: {p.pendenciaAtual}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Coluna Sem Atualização Interna */}
              <div className="rounded-3xl border border-slate-800 bg-slate-900/90 p-6">
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-7 w-7 text-sky-400" />
                    <h2 className="text-xl font-bold text-slate-100">
                      Sem Atualização &gt; {configTv.diasAlertaInatividade}d
                    </h2>
                  </div>
                  <span className="rounded-2xl bg-sky-500/25 px-4 py-1 text-2xl font-black text-sky-300">
                    {semAtualizacao.length}
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  {semAtualizacao.map((p) => {
                    const diasInat = calcularDiasSemAtualizacao(p.atualizadoEm);
                    return (
                      <div
                        key={p.id}
                        className="rounded-2xl border border-slate-800 bg-slate-950/80 p-5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-lg font-bold text-blue-400">
                            {p.numeroEdocs}
                          </span>
                          <span className="rounded-lg bg-sky-500/20 px-2.5 py-1 text-xs font-bold text-sky-300">
                            {diasInat} dias sem registro interno
                          </span>
                        </div>
                        <p className="mt-2 text-base font-bold text-white">
                          {p.assunto}
                        </p>
                        <p className="mt-2 text-sm text-slate-400">
                          Etapa atual: {p.situacao}
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

      {/* Rodapé de Segurança e Status de Sincronização (RNF-07 / RF-13) */}
      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 bg-slate-900/95 px-8 py-3.5 text-xs text-slate-400">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
            <ShieldCheck className="h-4 w-4" />
            Filtro de Privacidade Ativo: observações internas e {qtdRestritosOcultos}{' '}
            processo(s) restrito(s) ocultados automaticamente da TV
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

