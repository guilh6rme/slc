import React, { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  History,
  ShieldAlert,
  Save,
  FileText,
  Clock,
  Lock,
  Trash2,
} from 'lucide-react';
import {
  CATEGORIAS_SLC,
  CategoriaProcesso,
  ETAPAS_KANBAN,
  HistoricoAlteracao,
  PrioridadeProcesso,
  ProcessoSLC,
  SETORES_DEMANDANTES,
  SituacaoProcesso,
} from '../types/slc';
import { PrazoBadge, PrioridadeBadge, SituacaoBadge } from './StatusBadges';

interface ProcessoModalProps {
  aberto: boolean;
  modoInicial: 'detalhes' | 'editar' | 'novo';
  processo: ProcessoSLC | null;
  historico: HistoricoAlteracao[];
  responsaveisSugeridos: string[];
  onFechar: () => void;
  onSalvar: (dados: ProcessoSLC, isNovo: boolean) => void;
  onExcluir?: (id: string) => void;
}

export const ProcessoModal: React.FC<ProcessoModalProps> = ({
  aberto,
  modoInicial,
  processo,
  historico,
  responsaveisSugeridos,
  onFechar,
  onSalvar,
  onExcluir,
}) => {
  const [aba, setAba] = useState<'ficha' | 'auditoria'>('ficha');
  const [editando, setEditando] = useState(modoInicial !== 'detalhes');

  const hojeIso = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState<ProcessoSLC>({
    id: '',
    codigoInterno: '',
    numeroEdocs: '',
    assunto: '',
    objetoDetalhado: '',
    categoria: CATEGORIAS_SLC[0],
    setorDemandante: SETORES_DEMANDANTES[0],
    responsavel: '',
    dataEntrada: hojeIso,
    situacao: 'Recebido pela SLC',
    prioridade: 'Média',
    prazo: null,
    atualizadoEm: new Date().toISOString(),
    observacoesInternas: '',
    pendenciaAtual: '',
    restritoTv: false,
    linkEdocs: 'https://edocs.es.gov.br/',
  });

  useEffect(() => {
    setAba('ficha');
    setEditando(modoInicial !== 'detalhes');
    if (processo && modoInicial !== 'novo') {
      setForm({ ...processo });
    } else {
      setForm({
        id: `proc-${Date.now()}`,
        codigoInterno: `SLC-${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
        numeroEdocs: '',
        assunto: '',
        objetoDetalhado: '',
        categoria: CATEGORIAS_SLC[0],
        setorDemandante: SETORES_DEMANDANTES[0],
        responsavel: '',
        dataEntrada: hojeIso,
        situacao: 'Recebido pela SLC',
        prioridade: 'Média',
        prazo: null,
        atualizadoEm: new Date().toISOString(),
        observacoesInternas: '',
        pendenciaAtual: '',
        restritoTv: false,
        linkEdocs: 'https://edocs.es.gov.br/',
      });
    }
  }, [processo, modoInicial, aberto, hojeIso]);

  if (!aberto) return null;

  const historicoDoProcesso = processo
    ? historico.filter((h) => h.processoId === processo.id)
    : [];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.numeroEdocs.trim() || !form.assunto.trim()) return;
    onSalvar(
      {
        ...form,
        responsavel: form.responsavel.trim() || 'Não atribuído',
        atualizadoEm: new Date().toISOString(),
      },
      modoInicial === 'novo'
    );
  };

  const inputClass =
    'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:focus:border-blue-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600/15 text-blue-600 dark:bg-blue-600/20 dark:text-blue-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {modoInicial === 'novo'
                    ? 'Cadastrar Processo na SLC'
                    : `Processo E-Docs ${form.numeroEdocs}`}
                </h2>
                {form.restritoTv && (
                  <span className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300">
                    <Lock className="h-3 w-3" /> Oculto na TV
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Código interno: {form.codigoInterno}
              </p>
            </div>
          </div>

          <button
            onClick={onFechar}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Abas (ficha vs auditoria) */}
        {modoInicial !== 'novo' && (
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-100/70 px-6 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="flex gap-6">
              <button
                type="button"
                onClick={() => setAba('ficha')}
                className={`border-b-2 py-3 text-sm font-semibold transition-colors ${
                  aba === 'ficha'
                    ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                Ficha do processo
              </button>
              <button
                type="button"
                onClick={() => setAba('auditoria')}
                className={`flex items-center gap-2 border-b-2 py-3 text-sm font-semibold transition-colors ${
                  aba === 'auditoria'
                    ? 'border-blue-600 text-blue-600 dark:border-blue-500 dark:text-blue-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
              >
                <History className="h-4 w-4" />
                Histórico de auditoria ({historicoDoProcesso.length})
              </button>
            </div>

            <div className="flex items-center gap-2 py-2">
              {form.linkEdocs && (
                <a
                  href={form.linkEdocs}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  Abrir referência E-Docs <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              {aba === 'ficha' && !editando && (
                <button
                  type="button"
                  onClick={() => setEditando(true)}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500"
                >
                  Editar dados
                </button>
              )}
            </div>
          </div>
        )}

        {/* Corpo do modal */}
        <div className="flex-1 overflow-y-auto p-6">
          {aba === 'auditoria' ? (
            <div className="space-y-4">
              {historicoDoProcesso.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Nenhuma alteração registrada ainda para este processo.
                </p>
              ) : (
                <div className="space-y-3">
                  {historicoDoProcesso.map((item) => (
                    <div
                      key={item.id}
                      className="flex flex-col justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-slate-950/50 sm:flex-row sm:items-center"
                    >
                      <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                          {item.campo}
                        </span>
                        <div className="mt-1 text-sm text-slate-800 dark:text-slate-200">
                          De{' '}
                          <span className="text-slate-500 dark:text-slate-400">
                            "{item.valorAnterior}"
                          </span>{' '}
                          para{' '}
                          <span className="font-bold text-emerald-600 dark:text-emerald-300">
                            "{item.valorNovo}"
                          </span>
                        </div>
                      </div>
                      <div className="text-right text-xs text-slate-500 dark:text-slate-400">
                        <div className="font-semibold text-slate-700 dark:text-slate-300">
                          {item.usuario}
                        </div>
                        <div className="flex items-center justify-end gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(item.dataHora).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : editando ? (
            <form id="form-processo" onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Nº referência E-Docs *
                  </label>
                  <input
                    required
                    value={form.numeroEdocs}
                    onChange={(e) => setForm({ ...form, numeroEdocs: e.target.value })}
                    placeholder="Informe o nº E-Docs"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Data de entrada na SLC *
                  </label>
                  <input
                    type="date"
                    required
                    value={form.dataEntrada}
                    onChange={(e) => setForm({ ...form, dataEntrada: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Prazo da providência atual
                  </label>
                  <input
                    type="date"
                    value={form.prazo ?? ''}
                    onChange={(e) =>
                      setForm({ ...form, prazo: e.target.value || null })
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Assunto / Objeto resumido *
                </label>
                <input
                  required
                  value={form.assunto}
                  onChange={(e) => setForm({ ...form, assunto: e.target.value })}
                  placeholder="Descrição resumida do processo"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Categoria / Tipo de processo
                  </label>
                  <select
                    value={form.categoria}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        categoria: e.target.value as CategoriaProcesso,
                      })
                    }
                    className={inputClass}
                  >
                    {CATEGORIAS_SLC.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Setor demandante
                  </label>
                  <select
                    value={form.setorDemandante}
                    onChange={(e) =>
                      setForm({ ...form, setorDemandante: e.target.value })
                    }
                    className={inputClass}
                  >
                    {SETORES_DEMANDANTES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Situação / Etapa interna
                  </label>
                  <select
                    value={form.situacao}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        situacao: e.target.value as SituacaoProcesso,
                      })
                    }
                    className={inputClass}
                  >
                    {ETAPAS_KANBAN.map((etapa) => (
                      <option key={etapa} value={etapa}>
                        {etapa}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Responsável na SLC
                  </label>
                  <input
                    list="lista-responsaveis-slc"
                    value={form.responsavel}
                    onChange={(e) => setForm({ ...form, responsavel: e.target.value })}
                    placeholder="Nome do servidor responsável"
                    className={inputClass}
                  />
                  <datalist id="lista-responsaveis-slc">
                    {responsaveisSugeridos.map((srv) => (
                      <option key={srv} value={srv} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Prioridade operacional
                  </label>
                  <select
                    value={form.prioridade}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        prioridade: e.target.value as PrioridadeProcesso,
                      })
                    }
                    className={inputClass}
                  >
                    {(['Baixa', 'Média', 'Alta', 'Crítica'] as PrioridadeProcesso[]).map(
                      (p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      )
                    )}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Pendência / Providência imediata
                </label>
                <input
                  value={form.pendenciaAtual ?? ''}
                  onChange={(e) => setForm({ ...form, pendenciaAtual: e.target.value })}
                  placeholder="Providência atual pendente (opcional)"
                  className={inputClass}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Descrição detalhada do objeto
                </label>
                <textarea
                  rows={2}
                  value={form.objetoDetalhado}
                  onChange={(e) =>
                    setForm({ ...form, objetoDetalhado: e.target.value })
                  }
                  className={inputClass}
                />
              </div>

              <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 dark:border-amber-500/30 dark:bg-amber-500/5">
                <label className="mb-1 flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                  <ShieldAlert className="h-4 w-4" />
                  Observações internas da SLC (Restrito — Nunca exibido na TV)
                </label>
                <textarea
                  rows={2}
                  value={form.observacoesInternas}
                  onChange={(e) =>
                    setForm({ ...form, observacoesInternas: e.target.value })
                  }
                  placeholder="Anotações internas de acompanhamento..."
                  className={`mt-1 ${inputClass}`}
                />

                <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.restritoTv}
                    onChange={(e) => setForm({ ...form, restritoTv: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 dark:border-slate-700"
                  />
                  <span>
                    <strong>Ocultar este processo do modo TV</strong> (para processos com
                    apuração sensível ou sigilo administrativo)
                  </span>
                </label>
              </div>
            </form>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <SituacaoBadge situacao={form.situacao} />
                <PrioridadeBadge prioridade={form.prioridade} />
                <PrazoBadge processo={form} />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {form.assunto}
                </h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                  {form.objetoDetalhado || 'Sem detalhamento adicional cadastrado.'}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60 sm:grid-cols-2">
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Categoria
                  </span>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {form.categoria}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Setor demandante
                  </span>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {form.setorDemandante}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Responsável na SLC
                  </span>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {form.responsavel}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Data de entrada · Última atualização interna
                  </span>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                    {new Date(form.dataEntrada + 'T00:00:00').toLocaleDateString('pt-BR')}{' '}
                    · {new Date(form.atualizadoEm).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>

              {form.pendenciaAtual && (
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 dark:border-blue-500/30 dark:bg-blue-500/10">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-300">
                    Providência / Pendência atual
                  </span>
                  <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
                    {form.pendenciaAtual}
                  </p>
                </div>
              )}

              <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                  <Lock className="h-3.5 w-3.5" />
                  Observações internas (Visível apenas no ambiente administrativo)
                </div>
                <p className="mt-1 text-sm text-amber-900 dark:text-amber-100/90">
                  {form.observacoesInternas || 'Nenhuma observação interna registrada.'}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
          <div>
            {modoInicial !== 'novo' && onExcluir && processo && (
              <button
                type="button"
                onClick={() => onExcluir(processo.id)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300"
              >
                <Trash2 className="h-3.5 w-3.5" /> Excluir processo
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onFechar}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Fechar
            </button>
            {aba === 'ficha' && editando && (
              <button
                type="submit"
                form="form-processo"
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-500"
              >
                <Save className="h-4 w-4" />
                Salvar processo
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
