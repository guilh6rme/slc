import React from 'react';
import {
  AlertOctagon,
  AlertTriangle,
  Clock,
  SlidersHorizontal,
  Info,
} from 'lucide-react';
import { ConfiguracaoTV, ProcessoSLC } from '../types/slc';
import {
  calcularDiasSemAtualizacao,
  obterStatusPrazo,
} from '../services/slcService';
import { PrazoBadge, PrioridadeBadge, SituacaoBadge } from '../components/StatusBadges';

interface PrazosViewProps {
  processos: ProcessoSLC[];
  configTv: ConfiguracaoTV;
  onAtualizarConfigTv: (nova: ConfiguracaoTV) => void;
  onSelecionarProcesso: (p: ProcessoSLC, modo: 'detalhes' | 'editar') => void;
}

export const PrazosView: React.FC<PrazosViewProps> = ({
  processos,
  configTv,
  onAtualizarConfigTv,
  onSelecionarProcesso,
}) => {
  const ativos = processos.filter((p) => p.situacao !== 'Concluído');

  const vencidos = ativos.filter(
    (p) => obterStatusPrazo(p, configTv.diasAlertaPrazoProximo) === 'VENCIDO'
  );
  const proximos = ativos.filter(
    (p) => obterStatusPrazo(p, configTv.diasAlertaPrazoProximo) === 'PROXIMO'
  );
  const semAtualizacao = ativos.filter(
    (p) =>
      calcularDiasSemAtualizacao(p.atualizadoEm) >= configTv.diasAlertaInatividade
  );

  return (
    <div className="space-y-6">
      {/* Regra de Alerta Configurável (M4) */}
      <div className="flex flex-col justify-between gap-4 rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 lg:flex-row lg:items-center">
        <div className="flex items-start gap-3">
          <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
            <SlidersHorizontal className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Regras de Alerta de Prazos e Inatividade Interna (M4)
            </h3>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Diferencia ausência de atualização interna no SLC Digital de movimentação
              oficial no E-Docs. Parâmetros refletem imediatamente no Dashboard e na TV.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Alerta vencimento próximo:
            </label>
            <select
              value={configTv.diasAlertaPrazoProximo}
              onChange={(e) =>
                onAtualizarConfigTv({
                  ...configTv,
                  diasAlertaPrazoProximo: Number(e.target.value),
                })
              }
              className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value={3}>Até 3 dias</option>
              <option value={5}>Até 5 dias</option>
              <option value={7}>Até 7 dias</option>
              <option value={15}>Até 15 dias</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Sem atualização interna:
            </label>
            <select
              value={configTv.diasAlertaInatividade}
              onChange={(e) =>
                onAtualizarConfigTv({
                  ...configTv,
                  diasAlertaInatividade: Number(e.target.value),
                })
              }
              className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            >
              <option value={5}>&gt; 5 dias</option>
              <option value={10}>&gt; 10 dias</option>
              <option value={15}>&gt; 15 dias</option>
              <option value={30}>&gt; 30 dias</option>
            </select>
          </div>
        </div>
      </div>

      {/* Três blocos operacionais: Vencidos, Próximos e Sem Atualização */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* 1. Vencidos */}
        <div className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm dark:border-rose-500/30 dark:bg-slate-900/90">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <AlertOctagon className="h-5 w-5 text-rose-500 dark:text-rose-400" />
              <h4 className="text-sm font-bold text-rose-700 dark:text-rose-200">
                Prazos Vencidos ({vencidos.length})
              </h4>
            </div>
            <span className="rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">
              Ação Imediata
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {vencidos.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                Nenhum processo com prazo vencido.
              </p>
            ) : (
              vencidos.map((p) => (
                <div
                  key={p.id}
                  onClick={() => onSelecionarProcesso(p, 'detalhes')}
                  className="cursor-pointer rounded-xl border border-rose-200 bg-rose-50/50 p-4 transition hover:border-rose-400 dark:border-rose-500/30 dark:bg-rose-950/20 dark:hover:border-rose-500/60"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-rose-700 dark:text-rose-300">
                      {p.numeroEdocs}
                    </span>
                    <PrazoBadge
                      processo={p}
                      diasAlerta={configTv.diasAlertaPrazoProximo}
                    />
                  </div>
                  <p className="mt-2 text-xs font-bold text-slate-900 dark:text-white">
                    {p.assunto}
                  </p>
                  {p.pendenciaAtual && (
                    <p className="mt-1.5 text-[11px] text-rose-800 dark:text-rose-200/90">
                      <strong>Pendência:</strong> {p.pendenciaAtual}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{p.responsavel}</span>
                    <SituacaoBadge situacao={p.situacao} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 2. Vencem nos próximos X dias */}
        <div className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm dark:border-amber-500/30 dark:bg-slate-900/90">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <Clock className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              <h4 className="text-sm font-bold text-amber-800 dark:text-amber-200">
                Vencem em até {configTv.diasAlertaPrazoProximo} dias ({proximos.length})
              </h4>
            </div>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
              Atenção
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {proximos.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                Nenhum processo vencendo nos próximos {configTv.diasAlertaPrazoProximo}{' '}
                dias.
              </p>
            ) : (
              proximos.map((p) => (
                <div
                  key={p.id}
                  onClick={() => onSelecionarProcesso(p, 'detalhes')}
                  className="cursor-pointer rounded-xl border border-amber-200 bg-amber-50/50 p-4 transition hover:border-amber-400 dark:border-amber-500/30 dark:bg-amber-950/15 dark:hover:border-amber-500/60"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-amber-800 dark:text-amber-300">
                      {p.numeroEdocs}
                    </span>
                    <PrazoBadge
                      processo={p}
                      diasAlerta={configTv.diasAlertaPrazoProximo}
                    />
                  </div>
                  <p className="mt-2 text-xs font-bold text-slate-900 dark:text-white">
                    {p.assunto}
                  </p>
                  {p.pendenciaAtual && (
                    <p className="mt-1.5 text-[11px] text-amber-900 dark:text-amber-200/90">
                      <strong>Pendência:</strong> {p.pendenciaAtual}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{p.responsavel}</span>
                    <PrioridadeBadge prioridade={p.prioridade} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 3. Sem atualização interna > Y dias */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-5 w-5 text-sky-500 dark:text-sky-400" />
              <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                Sem Atualização &gt; {configTv.diasAlertaInatividade}d (
                {semAtualizacao.length})
              </h4>
            </div>
            <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-800 dark:bg-sky-500/20 dark:text-sky-300">
              Revisar Status
            </span>
          </div>

          <div className="mt-4 space-y-3">
            {semAtualizacao.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">
                Todos os processos ativos foram atualizados recentemente.
              </p>
            ) : (
              semAtualizacao.map((p) => {
                const diasInativo = calcularDiasSemAtualizacao(p.atualizadoEm);
                return (
                  <div
                    key={p.id}
                    onClick={() => onSelecionarProcesso(p, 'detalhes')}
                    className="cursor-pointer rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-sky-400 dark:border-slate-800 dark:bg-slate-950/70 dark:hover:border-sky-500/50"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                        {p.numeroEdocs}
                      </span>
                      <span className="rounded-md border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/15 dark:text-sky-300">
                        {diasInativo} dias sem registro interno
                      </span>
                    </div>
                    <p className="mt-2 text-xs font-bold text-slate-900 dark:text-white">
                      {p.assunto}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                      <span>{p.responsavel}</span>
                      <SituacaoBadge situacao={p.situacao} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
        <Info className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
        <span>
          <strong>Nota de Governança:</strong> A ausência de atualização interna no SLC
          Digital indica apenas que o registro de acompanhamento interno não foi editado
          há mais de {configTv.diasAlertaInatividade} dias, não significando
          necessariamente paralisação no sistema oficial E-Docs.
        </span>
      </div>
    </div>
  );
};
