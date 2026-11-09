import React, { useState } from 'react';
import {
  Download,
  Printer,
  FileBarChart2,
  ShieldCheck,
  Building2,
  Clock,
  FileCheck,
} from 'lucide-react';
import {
  CATEGORIAS_SLC,
  ContratoSLC,
  ETAPAS_KANBAN,
  HistoricoAlteracao,
  ProcessoSLC,
  SETORES_DEMANDANTES,
} from '../types/slc';
import { exportarDadosParaCsv } from '../services/slcService';

interface RelatoriosViewProps {
  processos: ProcessoSLC[];
  contratos: ContratoSLC[];
  historico: HistoricoAlteracao[];
  onNotificar: (msg: string) => void;
}

export const RelatoriosView: React.FC<RelatoriosViewProps> = ({
  processos,
  contratos,
  historico,
  onNotificar,
}) => {
  const [setorFiltro, setSetorFiltro] = useState<string>('TODOS');
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('TODAS');

  const processosFiltrados = processos.filter((p) => {
    const matchSetor =
      setorFiltro === 'TODOS' || p.setorDemandante === setorFiltro;
    const matchCat =
      categoriaFiltro === 'TODAS' || p.categoria === categoriaFiltro;
    return matchSetor && matchCat;
  });

  const handleExportarProcessosCsv = () => {
    exportarDadosParaCsv(
      `relatorio_processos_slc_${new Date().toISOString().split('T')[0]}.csv`,
      [
        'Codigo Interno',
        'Numero E-Docs',
        'Assunto',
        'Categoria',
        'Setor Demandante',
        'Situacao / Etapa',
        'Prioridade',
        'Responsavel',
        'Data Entrada',
        'Prazo',
        'Ultima Atualizacao',
        'Restrito TV',
      ],
      processosFiltrados.map((p) => [
        p.codigoInterno,
        p.numeroEdocs,
        p.assunto,
        p.categoria,
        p.setorDemandante,
        p.situacao,
        p.prioridade,
        p.responsavel,
        p.dataEntrada,
        p.prazo ?? 'Sem prazo',
        new Date(p.atualizadoEm).toLocaleString('pt-BR'),
        p.restritoTv ? 'SIM' : 'NAO',
      ])
    );
    onNotificar(
      `Planilha CSV com ${processosFiltrados.length} processos exportada com sucesso!`
    );
  };

  const handleExportarContratosCsv = () => {
    exportarDadosParaCsv(
      `relatorio_contratos_vigentes_slc_${new Date().toISOString().split('T')[0]}.csv`,
      [
        'Numero Contrato',
        'Processo E-Docs',
        'Empresa Contratada',
        'CNPJ',
        'Objeto',
        'Setor Demandante',
        'Valor Global (R$)',
        'Saldo Disponivel (R$)',
        'Inicio Vigencia',
        'Fim Vigencia',
        'Status Garantia',
        'Gestor',
        'Fiscal Titular',
        'Fiscal Suplente',
        'Ultimo Termo',
      ],
      contratos.map((c) => [
        c.numeroContrato,
        c.numeroEdocs,
        c.empresaContratada,
        c.cnpj,
        c.objeto,
        c.setorDemandante,
        c.valorGlobal,
        c.saldoDisponivel,
        c.inicioVigencia,
        c.fimVigencia,
        c.statusGarantia,
        c.gestorContrato,
        c.fiscalTitular,
        c.fiscalSuplente,
        c.ultimoTermo,
      ])
    );
    onNotificar(
      `Relatório CSV com ${contratos.length} contratos exportado com sucesso!`
    );
  };

  const handleExportarAuditoriaCsv = () => {
    exportarDadosParaCsv(
      `trilha_auditoria_slc_${new Date().toISOString().split('T')[0]}.csv`,
      ['ID', 'Processo ID', 'Usuario Autor', 'Data/Hora', 'Campo', 'De', 'Para'],
      historico.map((h) => [
        h.id,
        h.processoId,
        h.usuario,
        new Date(h.dataHora).toLocaleString('pt-BR'),
        h.campo,
        h.valorAnterior,
        h.valorNovo,
      ])
    );
    onNotificar('Trilha de auditoria exportada em CSV com sucesso!');
  };

  // Tempo médio estimado em dias desde a entrada por etapa (indicador demonstrativo M6)
  const resumoEtapas = ETAPAS_KANBAN.map((etapa) => {
    const itens = processosFiltrados.filter((p) => p.situacao === etapa);
    const mediaDias =
      itens.length === 0
        ? 0
        : Math.round(
            itens.reduce((acc, item) => {
              const entrada = new Date(item.dataEntrada + 'T00:00:00');
              const diff = Math.max(
                1,
                Math.floor(
                  (Date.now() - entrada.getTime()) / (1000 * 60 * 60 * 24)
                )
              );
              return acc + diff;
            }, 0) / itens.length
          );
    return {
      etapa,
      quantidade: itens.length,
      mediaDiasAcumulados: mediaDias,
    };
  });

  return (
    <div className="space-y-6">
      {/* Cabeçalho de Exportação e Filtros */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
              <FileBarChart2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Central de Relatórios Gerenciais e Exportação de Dados (M6)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Geração de planilhas compatíveis com Excel (UTF-8) e consolidação por
                setor demandante, categoria e etapas
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleExportarProcessosCsv}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500"
            >
              <Download className="h-4 w-4" />
              Exportar Processos (.CSV)
            </button>

            <button
              onClick={handleExportarContratosCsv}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-500"
            >
              <FileCheck className="h-4 w-4" />
              Exportar Contratos (.CSV)
            </button>

            <button
              onClick={handleExportarAuditoriaCsv}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Download className="h-4 w-4" />
              Auditoria (.CSV)
            </button>

            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              <Printer className="h-4 w-4" />
              Imprimir / PDF
            </button>
          </div>
        </div>

        {/* Filtros de recorte do relatório */}
        <div className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 dark:border-slate-800 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Filtrar Relatório por Setor Demandante
            </label>
            <select
              value={setorFiltro}
              onChange={(e) => setSetorFiltro(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="TODOS">Todos os setores demandantes do IPAJM</option>
              {SETORES_DEMANDANTES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Filtrar Relatório por Categoria
            </label>
            <select
              value={categoriaFiltro}
              onChange={(e) => setCategoriaFiltro(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="TODAS">Todas as categorias de processos</option>
              {CATEGORIAS_SLC.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tabelas Consolidadas de Indicadores */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 1. Demandas por Setor Demandante do IPAJM */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Demandas por Unidade / Gerência Solicitante
            </h4>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Volume de processos originados por área demandante do IPAJM
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="pb-2.5">Unidade Demandante</th>
                  <th className="pb-2.5 text-center">Ativos</th>
                  <th className="pb-2.5 text-center">Concluídos</th>
                  <th className="pb-2.5 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                {SETORES_DEMANDANTES.map((setor) => {
                  const doSetor = processosFiltrados.filter(
                    (p) => p.setorDemandante === setor
                  );
                  const ativos = doSetor.filter(
                    (p) => p.situacao !== 'Concluído'
                  ).length;
                  const conc = doSetor.filter(
                    (p) => p.situacao === 'Concluído'
                  ).length;

                  return (
                    <tr key={setor}>
                      <td className="py-3 font-semibold text-slate-800 dark:text-slate-200">
                        {setor}
                      </td>
                      <td className="py-3 text-center font-bold text-blue-600 dark:text-blue-400">
                        {ativos}
                      </td>
                      <td className="py-3 text-center font-bold text-emerald-600 dark:text-emerald-400">
                        {conc}
                      </td>
                      <td className="py-3 text-right font-extrabold text-slate-900 dark:text-white">
                        {doSetor.length}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 2. Tempo Médio Acumulado por Etapa */}
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Volume e Tempo Médio desde a Entrada por Etapa
            </h4>
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Auxilia na identificação de etapas que demandam apoio ou revisão de fluxo
          </p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 uppercase text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="pb-2.5">Etapa Interna da SLC</th>
                  <th className="pb-2.5 text-center">Qtd. Processos</th>
                  <th className="pb-2.5 text-right">Tempo Médio Acumulado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/70">
                {resumoEtapas.map((r) => (
                  <tr key={r.etapa}>
                    <td className="py-3 font-semibold text-slate-800 dark:text-slate-200">
                      {r.etapa}
                    </td>
                    <td className="py-3 text-center font-bold text-blue-600 dark:text-blue-400">
                      {r.quantidade}
                    </td>
                    <td className="py-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                      {r.quantidade > 0 ? `${r.mediaDiasAcumulados} dias` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Nota Institucional de Governança de Indicadores (Seção 6 - M6) */}
      <div className="flex items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 dark:border-blue-500/30 dark:bg-blue-950/20 dark:text-blue-200">
        <ShieldCheck className="h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <div>
          <strong>Diretriz Institucional de Uso de Indicadores (M6):</strong> Conforme
          especificado no plano do SLC Digital, os relatórios e métricas de tempo de
          tramitação têm finalidade estritamente gerencial para identificar gargalos de
          fluxo, dependências externas e necessidades de apoio operacional, não devendo
          ser utilizados para classificações simplistas de produtividade individual, uma
          vez que processos licitatórios e contratuais possuem complexidades distintas.
        </div>
      </div>
    </div>
  );
};

