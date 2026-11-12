import React, { useState } from 'react';
import {
  X,
  FileSpreadsheet,
  Upload,
  CheckCircle2,
  ArrowRight,
  Table,
  Database,
  AlertTriangle,
} from 'lucide-react';
import {
  CATEGORIAS_SLC,
  CategoriaProcesso,
  ETAPAS_KANBAN,
  PrioridadeProcesso,
  ProcessoSLC,
  SETORES_DEMANDANTES,
  SituacaoProcesso,
} from '../types/slc';

interface ImportarPlanilhaModalProps {
  aberto: boolean;
  onFechar: () => void;
  onImportarProcessos: (novos: ProcessoSLC[]) => void;
}

interface LinhaPlanilhaLida {
  indice: number;
  numeroEdocs: string;
  assunto: string;
  categoria: CategoriaProcesso;
  setorDemandante: string;
  responsavel: string;
  situacao: SituacaoProcesso;
  prioridade: PrioridadeProcesso;
  prazo: string | null;
}

export const ImportarPlanilhaModal: React.FC<ImportarPlanilhaModalProps> = ({
  aberto,
  onFechar,
  onImportarProcessos,
}) => {
  const [etapa, setEtapa] = useState<'selecao' | 'mapeamento' | 'concluido'>(
    'selecao'
  );
  const [nomeArquivo, setNomeArquivo] = useState<string>('');
  const [linhasLidas, setLinhasLidas] = useState<LinhaPlanilhaLida[]>([]);
  const [selecionados, setSelecionados] = useState<number[]>([]);
  const [erroLeitura, setErroLeitura] = useState<string | null>(null);

  if (!aberto) return null;

  const processarArquivoCsv = (file: File) => {
    setErroLeitura(null);
    setNomeArquivo(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const texto = String(e.target?.result ?? '');
      const linhasBrutas = texto
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (linhasBrutas.length < 2) {
        setErroLeitura(
          'O arquivo CSV deve conter um cabeçalho na primeira linha e pelo menos uma linha de dados.'
        );
        return;
      }

      const separador = linhasBrutas[0].includes(';') ? ';' : ',';
      const registros: LinhaPlanilhaLida[] = [];

      for (let i = 1; i < linhasBrutas.length; i++) {
        const colunas = linhasBrutas[i]
          .split(separador)
          .map((c) => c.replace(/^"|"$/g, '').trim());

        const edocs = colunas[0] || '';
        const assunto = colunas[1] || '';
        if (!edocs && !assunto) continue;

        const catCand = colunas[2] as CategoriaProcesso;
        const categoria: CategoriaProcesso = CATEGORIAS_SLC.includes(catCand)
          ? catCand
          : CATEGORIAS_SLC[0];

        const setor = colunas[3] || SETORES_DEMANDANTES[0];
        const responsavel = colunas[4] || 'Não atribuído';

        const sitCand = colunas[5] as SituacaoProcesso;
        const situacao: SituacaoProcesso = ETAPAS_KANBAN.includes(sitCand)
          ? sitCand
          : 'Recebido pela SLC';

        const prioCand = colunas[6] as PrioridadeProcesso;
        const prioridade: PrioridadeProcesso = (
          ['Baixa', 'Média', 'Alta', 'Crítica'] as PrioridadeProcesso[]
        ).includes(prioCand)
          ? prioCand
          : 'Média';

        const prazo =
          colunas[7] && /^\d{4}-\d{2}-\d{2}$/.test(colunas[7])
            ? colunas[7]
            : null;

        registros.push({
          indice: i + 1,
          numeroEdocs: edocs || `SEM-REF-${i}`,
          assunto: assunto || 'Sem assunto informado',
          categoria,
          setorDemandante: setor,
          responsavel,
          situacao,
          prioridade,
          prazo,
        });
      }

      if (registros.length === 0) {
        setErroLeitura('Nenhum registro válido encontrado nas linhas do CSV.');
        return;
      }

      setLinhasLidas(registros);
      setSelecionados(registros.map((r) => r.indice));
      setEtapa('mapeamento');
    };

    reader.readAsText(file, 'utf-8');
  };

  const toggleLinha = (indice: number) => {
    setSelecionados((prev) =>
      prev.includes(indice)
        ? prev.filter((i) => i !== indice)
        : [...prev, indice]
    );
  };

  const confirmarImportacao = () => {
    const agora = new Date().toISOString();
    const hoje = agora.split('T')[0];

    const processosGerados: ProcessoSLC[] = linhasLidas
      .filter((l) => selecionados.includes(l.indice))
      .map((l, idx) => ({
        id: `proc-imp-${Date.now()}-${idx}`,
        codigoInterno: `SLC-${new Date().getFullYear()}-${l.indice}`,
        numeroEdocs: l.numeroEdocs,
        assunto: l.assunto,
        objetoDetalhado: `Importado do arquivo "${nomeArquivo}" (Linha ${l.indice}).`,
        categoria: l.categoria,
        setorDemandante: l.setorDemandante,
        responsavel: l.responsavel,
        dataEntrada: hoje,
        situacao: l.situacao,
        prioridade: l.prioridade,
        prazo: l.prazo,
        atualizadoEm: agora,
        observacoesInternas: '',
        pendenciaAtual: '',
        restritoTv: false,
        linkEdocs: 'https://edocs.es.gov.br/',
      }));

    onImportarProcessos(processosGerados);
    setEtapa('concluido');
  };

  const resetAndClose = () => {
    setEtapa('selecao');
    setLinhasLidas([]);
    setSelecionados([]);
    setErroLeitura(null);
    onFechar();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600/15 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Importar processos via planilha CSV
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Selecione um arquivo .CSV para importar registros para o sistema
              </p>
            </div>
          </div>

          <button
            onClick={resetAndClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Corpo */}
        <div className="flex-1 overflow-y-auto p-6">
          {etapa === 'selecao' && (
            <div className="space-y-6">
              <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-8 text-center transition hover:border-blue-500 dark:border-slate-700 dark:bg-slate-950/50">
                <input
                  type="file"
                  accept=".csv,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) processarArquivoCsv(file);
                  }}
                />
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-600/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400">
                  <Upload className="h-7 w-7" />
                </div>
                <h3 className="mt-4 text-base font-bold text-slate-900 dark:text-white">
                  Clique para selecionar um arquivo .CSV
                </h3>
                <p className="mx-auto mt-1 max-w-lg text-xs text-slate-500 dark:text-slate-400">
                  Ordem esperada das colunas: <code>numero_edocs</code>;{' '}
                  <code>assunto</code>; <code>categoria</code>;{' '}
                  <code>setor_demandante</code>; <code>responsavel</code>;{' '}
                  <code>situacao</code>; <code>prioridade</code>;{' '}
                  <code>prazo (AAAA-MM-DD)</code>
                </p>
              </label>

              {erroLeitura && (
                <div className="flex items-center gap-2 rounded-xl border border-rose-300 bg-rose-50 p-4 text-xs font-semibold text-rose-700 dark:border-rose-500/40 dark:bg-rose-950/30 dark:text-rose-200">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{erroLeitura}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <Table className="h-4 w-4 text-blue-500" />
                    Pré-visualização
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    Você poderá revisar todas as linhas lidas do arquivo antes de
                    confirmar a inserção dos dados.
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
                    <Database className="h-4 w-4 text-emerald-500" />
                    Dados armazenados de forma segura
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">
                    Cada linha importada é gravada e registrada automaticamente na trilha de auditoria.
                  </p>
                </div>
              </div>
            </div>
          )}

          {etapa === 'mapeamento' && (
            <div className="space-y-4">
              <div className="text-xs font-semibold text-slate-600 dark:text-slate-300">
                Arquivo carregado: <strong>{nomeArquivo}</strong> ({linhasLidas.length}{' '}
                registro(s) localizado(s))
              </div>

              <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-100 uppercase text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                    <tr>
                      <th className="p-3">Importar</th>
                      <th className="p-3">Linha</th>
                      <th className="p-3">Nº E-Docs</th>
                      <th className="p-3">Assunto / Categoria</th>
                      <th className="p-3">Responsável</th>
                      <th className="p-3">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                    {linhasLidas.map((item) => (
                      <tr
                        key={item.indice}
                        className="bg-white dark:bg-slate-900/60"
                      >
                        <td className="p-3">
                          <input
                            type="checkbox"
                            checked={selecionados.includes(item.indice)}
                            onChange={() => toggleLinha(item.indice)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600"
                          />
                        </td>
                        <td className="p-3 font-mono text-slate-500">
                          #{item.indice}
                        </td>
                        <td className="p-3 font-mono font-bold text-blue-600 dark:text-blue-400">
                          {item.numeroEdocs}
                        </td>
                        <td className="p-3">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {item.assunto}
                          </div>
                          <div className="mt-0.5 text-slate-500">
                            {item.categoria} · {item.setorDemandante}
                          </div>
                        </td>
                        <td className="p-3 text-slate-700 dark:text-slate-300">
                          {item.responsavel}
                        </td>
                        <td className="p-3 text-slate-700 dark:text-slate-300">
                          {item.situacao}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {etapa === 'concluido' && (
            <div className="py-10 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
                <CheckCircle2 className="h-9 w-9" />
              </div>
              <h3 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">
                {selecionados.length} Processo(s) importado(s) com sucesso!
              </h3>
            </div>
          )}
        </div>

        {/* Rodapé */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={resetAndClose}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {etapa === 'concluido' ? 'Fechar' : 'Cancelar'}
          </button>
          {etapa === 'mapeamento' && (
            <button
              type="button"
              disabled={selecionados.length === 0}
              onClick={confirmarImportacao}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-500 disabled:opacity-40"
            >
              Confirmar importação ({selecionados.length})
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
