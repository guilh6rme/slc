import React, { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Lock,
  User,
  GripVertical,
} from 'lucide-react';
import {
  CATEGORIAS_SLC,
  ConfiguracaoTV,
  ETAPAS_KANBAN,
  PerfilUsuario,
  ProcessoSLC,
  SituacaoProcesso,
} from '../types/slc';
import { PrazoBadge, PrioridadeBadge } from '../components/StatusBadges';
import { obterListaResponsaveisUnicos } from '../services/slcService';

interface KanbanViewProps {
  processos: ProcessoSLC[];
  configTv: ConfiguracaoTV;
  perfilAtual: PerfilUsuario;
  onSelecionarProcesso: (p: ProcessoSLC, modo: 'detalhes' | 'editar') => void;
  onMoverEtapa: (processo: ProcessoSLC, novaEtapa: SituacaoProcesso) => void;
}

export const KanbanView: React.FC<KanbanViewProps> = ({
  processos,
  configTv,
  perfilAtual,
  onSelecionarProcesso,
  onMoverEtapa,
}) => {
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODAS');
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>('TODOS');
  const [processoArrastandoId, setProcessoArrastandoId] = useState<string | null>(
    null
  );
  const [colunaAlvo, setColunaAlvo] = useState<SituacaoProcesso | null>(null);

  const podeEditar = perfilAtual !== 'CONSULTA';
  const responsaveisUnicos = useMemo(
    () => obterListaResponsaveisUnicos(processos),
    [processos]
  );

  const filtrados = processos.filter((p) => {
    const matchCat =
      filtroCategoria === 'TODAS' || p.categoria === filtroCategoria;
    const matchResp =
      filtroResponsavel === 'TODOS' || p.responsavel === filtroResponsavel;
    return matchCat && matchResp;
  });

  const moverParaIndice = (proc: ProcessoSLC, delta: number) => {
    const idxAtual = ETAPAS_KANBAN.indexOf(proc.situacao);
    const novoIdx = idxAtual + delta;
    if (novoIdx >= 0 && novoIdx < ETAPAS_KANBAN.length) {
      onMoverEtapa(proc, ETAPAS_KANBAN[novoIdx]);
    }
  };

  const handleDragStart = (e: React.DragEvent, proc: ProcessoSLC) => {
    if (!podeEditar) return;
    e.dataTransfer.setData('text/plain', proc.id);
    e.dataTransfer.effectAllowed = 'move';
    setProcessoArrastandoId(proc.id);
  };

  const handleDragOver = (e: React.DragEvent, etapa: SituacaoProcesso) => {
    if (!podeEditar) return;
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
    if (!id || !podeEditar) return;
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

  return (
    <div className="space-y-4">
      {/* Barra de filtros do Kanban */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            Quadro Kanban Interativo — Arraste e Solte os Processos (Drag &amp; Drop)
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Arraste qualquer card para outra coluna para atualizar a etapa e registrar
            automaticamente na trilha de auditoria
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={filtroCategoria}
            onChange={(e) => setFiltroCategoria(e.target.value)}
            className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
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
            className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            <option value="TODOS">Todos os responsáveis</option>
            {responsaveisUnicos.map((srv) => (
              <option key={srv} value={srv}>
                {srv}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Colunas do Kanban */}
      <div className="flex gap-4 overflow-x-auto pb-4">
        {ETAPAS_KANBAN.map((etapa, idxEtapa) => {
          const itens = filtrados.filter((p) => p.situacao === etapa);
          const isAlvo = colunaAlvo === etapa;

          return (
            <div
              key={etapa}
              onDragOver={(e) => handleDragOver(e, etapa)}
              onDragLeave={() => setColunaAlvo(null)}
              onDrop={(e) => handleDrop(e, etapa)}
              className={`flex w-80 shrink-0 flex-col overflow-hidden rounded-2xl border transition-all ${
                isAlvo
                  ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/30 dark:border-blue-400 dark:bg-blue-950/30'
                  : 'border-slate-200/90 bg-slate-100/80 dark:border-slate-800 dark:bg-slate-900/60'
              }`}
            >
              <div className={`h-1.5 w-full ${coresTopoColuna[etapa]}`} />

              {/* Cabeçalho da Coluna */}
              <div className="flex items-center justify-between border-b border-slate-200/80 bg-white/70 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/80">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                  {etapa}
                </span>
                <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-extrabold text-blue-700 dark:bg-slate-800 dark:text-blue-400">
                  {itens.length}
                </span>
              </div>

              {/* Cards */}
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
                        draggable={podeEditar}
                        onDragStart={(e) => handleDragStart(e, proc)}
                        onDragEnd={() => {
                          setProcessoArrastandoId(null);
                          setColunaAlvo(null);
                        }}
                        className={`group flex flex-col justify-between rounded-xl border bg-white p-3.5 shadow-sm transition-all dark:bg-slate-950/90 ${
                          podeEditar ? 'cursor-grab active:cursor-grabbing' : ''
                        } ${
                          isArrastando
                            ? 'scale-95 border-blue-500 opacity-50'
                            : 'border-slate-200/90 hover:-translate-y-0.5 hover:border-blue-400 hover:shadow-md dark:border-slate-800 dark:hover:border-slate-700'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              {podeEditar && (
                                <GripVertical className="h-3.5 w-3.5 text-slate-400 opacity-60 group-hover:opacity-100" />
                              )}
                              <span
                                onClick={() => onSelecionarProcesso(proc, 'detalhes')}
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
                              <PrioridadeBadge prioridade={proc.prioridade} />
                            </div>
                          </div>

                          <h4
                            onClick={() => onSelecionarProcesso(proc, 'detalhes')}
                            className="mt-2 cursor-pointer text-xs font-bold leading-snug text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-300"
                          >
                            {proc.assunto}
                          </h4>

                          <p className="mt-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            {proc.categoria}
                          </p>

                          {proc.pendenciaAtual && (
                            <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/80 px-2.5 py-1.5 text-[11px] text-amber-900 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-300">
                              <span className="font-bold text-amber-700 dark:text-amber-300">
                                Pendência:{' '}
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

                          {podeEditar && (
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
                                disabled={idxEtapa === ETAPAS_KANBAN.length - 1}
                                onClick={() => moverParaIndice(proc, 1)}
                                className="inline-flex flex-1 items-center justify-center gap-1 rounded-lg border border-blue-200 bg-blue-50 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-30 dark:border-blue-500/30 dark:bg-blue-600/20 dark:text-blue-300 dark:hover:bg-blue-600/30"
                              >
                                Avançar <ChevronRight className="h-3 w-3" />
                              </button>
                            </div>
                          )}
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
  );
};
