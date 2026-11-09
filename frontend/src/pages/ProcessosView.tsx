import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Filter,
  Eye,
  Edit3,
  Lock,
  ExternalLink,
  RotateCcw,
  FileSpreadsheet,
} from 'lucide-react';
import {
  CATEGORIAS_SLC,
  ConfiguracaoTV,
  ETAPAS_KANBAN,
  PerfilUsuario,
  PrioridadeProcesso,
  ProcessoSLC,
  SituacaoProcesso,
} from '../types/slc';
import { PrazoBadge, PrioridadeBadge, SituacaoBadge } from '../components/StatusBadges';
import {
  calcularDiasSemAtualizacao,
  obterListaResponsaveisUnicos,
} from '../services/slcService';

interface ProcessosViewProps {
  processos: ProcessoSLC[];
  configTv: ConfiguracaoTV;
  perfilAtual: PerfilUsuario;
  onAbrirModal: (p: ProcessoSLC | null, modo: 'detalhes' | 'editar' | 'novo') => void;
  onAbrirImportador: () => void;
  onMudarSituacaoRapida: (processo: ProcessoSLC, novaSituacao: SituacaoProcesso) => void;
}

export const ProcessosView: React.FC<ProcessosViewProps> = ({
  processos,
  configTv,
  perfilAtual,
  onAbrirModal,
  onAbrirImportador,
  onMudarSituacaoRapida,
}) => {
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('TODAS');
  const [filtroSituacao, setFiltroSituacao] = useState<string>('TODAS');
  const [filtroResponsavel, setFiltroResponsavel] = useState<string>('TODOS');
  const [filtroPrioridade, setFiltroPrioridade] = useState<string>('TODAS');

  const podeEditar = perfilAtual !== 'CONSULTA';
  const responsaveisUnicos = useMemo(
    () => obterListaResponsaveisUnicos(processos),
    [processos]
  );

  const filtrados = useMemo(() => {
    return processos.filter((p) => {
      const q = busca.trim().toLowerCase();
      const matchBusca =
        !q ||
        p.numeroEdocs.toLowerCase().includes(q) ||
        p.codigoInterno.toLowerCase().includes(q) ||
        p.assunto.toLowerCase().includes(q) ||
        p.setorDemandante.toLowerCase().includes(q);

      const matchCat =
        filtroCategoria === 'TODAS' || p.categoria === filtroCategoria;
      const matchSit =
        filtroSituacao === 'TODAS' || p.situacao === filtroSituacao;
      const matchResp =
        filtroResponsavel === 'TODOS' || p.responsavel === filtroResponsavel;
      const matchPrio =
        filtroPrioridade === 'TODAS' || p.prioridade === filtroPrioridade;

      return matchBusca && matchCat && matchSit && matchResp && matchPrio;
    });
  }, [
    processos,
    busca,
    filtroCategoria,
    filtroSituacao,
    filtroResponsavel,
    filtroPrioridade,
  ]);

  const limparFiltros = () => {
    setBusca('');
    setFiltroCategoria('TODAS');
    setFiltroSituacao('TODAS');
    setFiltroResponsavel('TODOS');
    setFiltroPrioridade('TODAS');
  };

  const selectClass =
    'w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-800 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200';

  return (
    <div className="space-y-5">
      {/* Barra de Busca, Filtros e Botões */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar por número E-Docs, assunto ou setor demandante..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder-slate-500"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={limparFiltros}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Limpar Filtros
            </button>
            {podeEditar && (
              <>
                <button
                  onClick={onAbrirImportador}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/25"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Importar CSV
                </button>
                <button
                  onClick={() => onAbrirModal(null, 'novo')}
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500"
                >
                  <Plus className="h-4 w-4" />
                  Novo Processo
                </button>
              </>
            )}
          </div>
        </div>

        {/* Filtros combinados */}
        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-200/80 pt-4 dark:border-slate-800/80 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="mb-1 flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              <Filter className="h-3 w-3" /> Categoria
            </label>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className={selectClass}
            >
              <option value="TODAS">Todas as categorias</option>
              {CATEGORIAS_SLC.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Situação / Etapa
            </label>
            <select
              value={filtroSituacao}
              onChange={(e) => setFiltroSituacao(e.target.value)}
              className={selectClass}
            >
              <option value="TODAS">Todas as etapas</option>
              {ETAPAS_KANBAN.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Responsável na SLC
            </label>
            <select
              value={filtroResponsavel}
              onChange={(e) => setFiltroResponsavel(e.target.value)}
              className={selectClass}
            >
              <option value="TODOS">Todos os responsáveis</option>
              {responsaveisUnicos.map((srv) => (
                <option key={srv} value={srv}>
                  {srv}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Prioridade
            </label>
            <select
              value={filtroPrioridade}
              onChange={(e) => setFiltroPrioridade(e.target.value)}
              className={selectClass}
            >
              <option value="TODAS">Todas as prioridades</option>
              {(['Crítica', 'Alta', 'Média', 'Baixa'] as PrioridadeProcesso[]).map(
                (p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                )
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Tabela de Processos */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Exibindo{' '}
            <strong className="text-slate-900 dark:text-white">
              {filtrados.length}
            </strong>{' '}
            de {processos.length} processos acompanhados pela SLC
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-xs font-bold uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-950/50 dark:text-slate-400">
                <th className="px-6 py-3.5">Nº E-Docs</th>
                <th className="px-4 py-3.5">Assunto / Categoria</th>
                <th className="px-4 py-3.5">Etapa / Situação</th>
                <th className="px-4 py-3.5">Prioridade</th>
                <th className="px-4 py-3.5">Prazo</th>
                <th className="px-4 py-3.5">Responsável</th>
                <th className="px-6 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
              {filtrados.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-sm text-slate-500"
                  >
                    Nenhum processo cadastrado ou localizado para os filtros informados.
                  </td>
                </tr>
              ) : (
                filtrados.map((p) => {
                  const diasSemAtu = calcularDiasSemAtualizacao(p.atualizadoEm);
                  const inativo =
                    p.situacao !== 'Concluído' &&
                    diasSemAtu >= configTv.diasAlertaInatividade;

                  return (
                    <tr
                      key={p.id}
                      className="transition hover:bg-slate-50/90 dark:hover:bg-slate-800/40"
                    >
                      <td className="whitespace-nowrap px-6 py-4">
                        <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                          {p.numeroEdocs}
                          {p.restritoTv && (
                            <span
                              title="Processo restrito: oculto no Modo TV"
                              className="rounded bg-rose-100 p-1 text-rose-600 dark:bg-rose-500/20 dark:text-rose-300"
                            >
                              <Lock className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                          {p.codigoInterno}
                        </div>
                      </td>

                      <td className="max-w-md px-4 py-4">
                        <div
                          onClick={() => onAbrirModal(p, 'detalhes')}
                          className="cursor-pointer font-semibold text-slate-900 hover:text-blue-600 dark:text-slate-100 dark:hover:text-blue-400"
                        >
                          {p.assunto}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                          <span>{p.categoria}</span>
                          <span>·</span>
                          <span>{p.setorDemandante}</span>
                          {inativo && (
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
                              Sem atualização há {diasSemAtu}d
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-4 py-4">
                        {podeEditar ? (
                          <select
                            value={p.situacao}
                            onChange={(e) =>
                              onMudarSituacaoRapida(
                                p,
                                e.target.value as SituacaoProcesso
                              )
                            }
                            className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-800 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
                          >
                            {ETAPAS_KANBAN.map((etapa) => (
                              <option key={etapa} value={etapa}>
                                {etapa}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <SituacaoBadge situacao={p.situacao} />
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-4">
                        <PrioridadeBadge prioridade={p.prioridade} />
                      </td>

                      <td className="whitespace-nowrap px-4 py-4">
                        <PrazoBadge
                          processo={p}
                          diasAlerta={configTv.diasAlertaPrazoProximo}
                        />
                      </td>

                      <td className="whitespace-nowrap px-4 py-4">
                        <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                          {p.responsavel}
                        </div>
                        <div className="text-[11px] text-slate-400 dark:text-slate-500">
                          Atu: {new Date(p.atualizadoEm).toLocaleDateString('pt-BR')}
                        </div>
                      </td>

                      <td className="whitespace-nowrap px-6 py-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => onAbrirModal(p, 'detalhes')}
                            title="Ver ficha completa e trilha de auditoria"
                            className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          {podeEditar && (
                            <button
                              onClick={() => onAbrirModal(p, 'editar')}
                              title="Editar processo"
                              className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:border-blue-500 hover:bg-blue-600 hover:text-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-blue-600"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          )}
                          {p.linkEdocs && (
                            <a
                              href={p.linkEdocs}
                              target="_blank"
                              rel="noreferrer"
                              title="Abrir referência no E-Docs"
                              className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
