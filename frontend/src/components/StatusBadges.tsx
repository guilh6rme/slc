import React from 'react';
import {
  PrioridadeProcesso,
  ProcessoSLC,
  SituacaoProcesso,
} from '../types/slc';
import {
  calcularDiasAtePrazo,
  obterStatusPrazo,
} from '../services/slcService';

export const PrioridadeBadge: React.FC<{
  prioridade: PrioridadeProcesso | string;
  size?: 'sm' | 'lg';
}> = ({ prioridade, size = 'sm' }) => {
  const styles: Record<string, string> = {
    Crítica:
      'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40',
    Alta:
      'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40',
    Média:
      'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/40',
    Baixa:
      'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-500/20 dark:text-slate-300 dark:border-slate-500/40',
  };

  const dotColors: Record<string, string> = {
    Crítica: 'bg-rose-500',
    Alta: 'bg-amber-500',
    Média: 'bg-sky-500',
    Baixa: 'bg-slate-400',
  };

  const sizeClass =
    size === 'lg'
      ? 'px-3.5 py-1.5 text-sm font-bold'
      : 'px-2.5 py-0.5 text-xs font-semibold';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${
        styles[prioridade] ?? styles.Média
      } ${sizeClass}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          dotColors[prioridade] ?? dotColors.Média
        }`}
      />
      {prioridade}
    </span>
  );
};

export const SituacaoBadge: React.FC<{
  situacao: SituacaoProcesso;
  size?: 'sm' | 'lg';
}> = ({ situacao, size = 'sm' }) => {
  const styles: Record<SituacaoProcesso, string> = {
    'Recebido pela SLC':
      'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-300 dark:border-indigo-500/40',
    'Em análise':
      'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/40',
    'Aguardando documentação':
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/40',
    'Em elaboração':
      'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-300 dark:border-cyan-500/40',
    'Aguardando aprovação':
      'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-500/20 dark:text-purple-300 dark:border-purple-500/40',
    'Em andamento externo':
      'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/20 dark:text-orange-300 dark:border-orange-500/40',
    Concluído:
      'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40',
  };

  const sizeClass =
    size === 'lg'
      ? 'px-3.5 py-1.5 text-sm font-bold'
      : 'px-2.5 py-0.5 text-xs font-semibold';

  return (
    <span
      className={`inline-flex items-center rounded-lg border ${styles[situacao]} ${sizeClass}`}
    >
      {situacao}
    </span>
  );
};

export const PrazoBadge: React.FC<{
  processo: Pick<ProcessoSLC, 'prazo' | 'situacao'>;
  diasAlerta?: number;
  size?: 'sm' | 'lg';
}> = ({ processo, diasAlerta = 7, size = 'sm' }) => {
  const status = obterStatusPrazo(processo as ProcessoSLC, diasAlerta);
  const dias = calcularDiasAtePrazo(processo.prazo);

  const sizeClass =
    size === 'lg'
      ? 'px-3.5 py-1.5 text-sm font-bold'
      : 'px-2.5 py-0.5 text-xs font-semibold';

  if (status === 'CONCLUIDO') {
    return (
      <span
        className={`inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 ${sizeClass}`}
      >
        Concluído
      </span>
    );
  }

  if (!processo.prazo || dias === null) {
    return (
      <span
        className={`inline-flex items-center rounded-md border border-slate-200 bg-slate-100 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400 ${sizeClass}`}
      >
        Sem prazo definido
      </span>
    );
  }

  const dataFormatada = new Date(processo.prazo + 'T00:00:00').toLocaleDateString(
    'pt-BR'
  );

  if (status === 'VENCIDO') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/20 dark:text-rose-200 ${sizeClass}`}
      >
        <span>Vencido há {Math.abs(dias)}d</span>
        <span className="opacity-75">({dataFormatada})</span>
      </span>
    );
  }

  if (status === 'PROXIMO') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/50 dark:bg-amber-500/20 dark:text-amber-200 ${sizeClass}`}
      >
        <span>{dias === 0 ? 'Vence hoje' : `Vence em ${dias}d`}</span>
        <span className="opacity-75">({dataFormatada})</span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-300 ${sizeClass}`}
    >
      <span>{dataFormatada}</span>
      <span className="opacity-60">({dias}d)</span>
    </span>
  );
};
