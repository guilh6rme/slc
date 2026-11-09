import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutDashboard,
  FileSpreadsheet,
  Columns3,
  ClockAlert,
  Tv,
  Shield,
  Plus,
  Database,
  Sun,
  Moon,
  Upload,
  CheckCircle2,
  Building2,
  FileSignature,
  FileBarChart2,
} from 'lucide-react';
import {
  ConfiguracaoTV,
  ContratoSLC,
  HistoricoAlteracao,
  PerfilUsuario,
  ProcessoSLC,
  SituacaoProcesso,
} from './types/slc';
import {
  carregarConfigTV,
  carregarContratos,
  carregarHistorico,
  carregarProcessos,
  excluirProcessoNoBackend,
  obterListaResponsaveisUnicos,
  obterStatusPrazo,
  persistirConfigTvNoBackend,
  persistirContratoNoBackend,
  persistirProcessoNoBackend,
  registrarAlteracoesProcesso,
  salvarConfigTV,
  salvarContratos,
  salvarHistorico,
  salvarProcessos,
  sincronizarComBackendFastAPI,
  StatusBackendAPI,
} from './services/slcService';
import { DashboardView } from './pages/DashboardView';
import { ProcessosView } from './pages/ProcessosView';
import { KanbanView } from './pages/KanbanView';
import { PrazosView } from './pages/PrazosView';
import { ContratosView } from './pages/ContratosView';
import { RelatoriosView } from './pages/RelatoriosView';
import { ModoTvView } from './pages/ModoTvView';
import { ProcessoModal } from './components/ProcessoModal';
import { ImportarPlanilhaModal } from './components/ImportarPlanilhaModal';

type AbaAtiva =
  | 'dashboard'
  | 'processos'
  | 'kanban'
  | 'prazos'
  | 'contratos'
  | 'relatorios';

export function App() {
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('dashboard');
  const [modoTvAtivo, setModoTvAtivo] = useState<boolean>(false);
  const [perfilAtual, setPerfilAtual] = useState<PerfilUsuario>('GESTOR_SLC');
  const [temaEscuro, setTemaEscuro] = useState<boolean>(false);

  const [processos, setProcessos] = useState<ProcessoSLC[]>([]);
  const [contratos, setContratos] = useState<ContratoSLC[]>([]);
  const [historico, setHistorico] = useState<HistoricoAlteracao[]>([]);
  const [configTv, setConfigTv] = useState<ConfiguracaoTV>(() => carregarConfigTV());
  const [statusApi, setStatusApi] = useState<StatusBackendAPI>({
    online: false,
    modoBanco: 'Verificando API FastAPI...',
    swaggerUrl: 'http://localhost:8000/docs',
  });

  // Estado dos Modais
  const [modalAberto, setModalAberto] = useState<boolean>(false);
  const [modoModal, setModoModal] = useState<'detalhes' | 'editar' | 'novo'>('detalhes');
  const [processoSelecionado, setProcessoSelecionado] =
    useState<ProcessoSLC | null>(null);
  const [importadorAberto, setImportadorAberto] = useState<boolean>(false);

  // Toast de feedback visual
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const dispararToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((atual) => (atual === msg ? null : atual));
    }, 4000);
  };

  useEffect(() => {
    setProcessos(carregarProcessos());
    setContratos(carregarContratos());
    setHistorico(carregarHistorico());

    sincronizarComBackendFastAPI().then((res) => {
      setStatusApi(res.status);
      if (res.status.online) {
        if (res.processos) setProcessos(res.processos);
        if (res.contratos) setContratos(res.contratos);
        if (res.historico) setHistorico(res.historico);
        if (res.configTv) setConfigTv(res.configTv);
      }
    });
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (temaEscuro) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [temaEscuro]);

  const nomeUsuarioPorPerfil: Record<PerfilUsuario, string> = {
    GESTOR_SLC: 'Gestor SLC',
    SERVIDOR_SLC: 'Servidor SLC',
    CONSULTA: 'Consulta Interna',
  };

  const responsaveisSugeridos = useMemo(
    () => obterListaResponsaveisUnicos(processos),
    [processos]
  );

  const handleAbrirModal = (
    p: ProcessoSLC | null,
    modo: 'detalhes' | 'editar' | 'novo'
  ) => {
    setProcessoSelecionado(p);
    setModoModal(modo);
    setModalAberto(true);
  };

  const handleSalvarProcesso = (dados: ProcessoSLC, isNovo: boolean) => {
    const autor = nomeUsuarioPorPerfil[perfilAtual];

    if (isNovo) {
      const novaLista = [dados, ...processos];
      setProcessos(novaLista);
      salvarProcessos(novaLista);

      const novoRegistroHist: HistoricoAlteracao = {
        id: `hist-${Date.now()}`,
        processoId: dados.id,
        usuario: autor,
        dataHora: new Date().toISOString(),
        campo: 'Cadastro Inicial',
        valorAnterior: '—',
        valorNovo: `Processo ${dados.numeroEdocs} registrado (${dados.situacao})`,
      };
      const novoHist = [novoRegistroHist, ...historico];
      setHistorico(novoHist);
      salvarHistorico(novoHist);
      persistirProcessoNoBackend(dados, true, autor);
      dispararToast(`Processo ${dados.numeroEdocs} cadastrado com sucesso!`);
    } else {
      const antigo = processos.find((item) => item.id === dados.id);
      const novaLista = processos.map((item) =>
        item.id === dados.id ? dados : item
      );
      setProcessos(novaLista);
      salvarProcessos(novaLista);

      if (antigo) {
        const novoHist = registrarAlteracoesProcesso(
          antigo,
          dados,
          autor,
          historico
        );
        setHistorico(novoHist);
      }
      persistirProcessoNoBackend(dados, false, autor);
      dispararToast(
        `Processo ${dados.numeroEdocs} atualizado e registrado na auditoria.`
      );
    }

    setModalAberto(false);
  };

  const handleExcluirProcesso = (id: string) => {
    const novaLista = processos.filter((p) => p.id !== id);
    const novoHist = historico.filter((h) => h.processoId !== id);
    setProcessos(novaLista);
    setHistorico(novoHist);
    salvarProcessos(novaLista);
    salvarHistorico(novoHist);
    excluirProcessoNoBackend(id);
    setModalAberto(false);
    dispararToast('Processo excluído com sucesso.');
  };

  const handleSalvarContrato = (dados: ContratoSLC, isNovo: boolean) => {
    const novaLista = isNovo
      ? [dados, ...contratos]
      : contratos.map((c) => (c.id === dados.id ? dados : c));
    setContratos(novaLista);
    salvarContratos(novaLista);
    persistirContratoNoBackend(dados);
    dispararToast(
      `Contrato nº ${dados.numeroContrato} ${
        isNovo ? 'registrado' : 'atualizado'
      } com sucesso!`
    );
  };

  const handleImportarProcessosPlanilha = (novos: ProcessoSLC[]) => {
    const autor = nomeUsuarioPorPerfil[perfilAtual];
    const novaLista = [...novos, ...processos];
    setProcessos(novaLista);
    salvarProcessos(novaLista);
    novos.forEach((p) => persistirProcessoNoBackend(p, true, autor));

    const novosHistoricos: HistoricoAlteracao[] = novos.map((p, idx) => ({
      id: `hist-imp-${Date.now()}-${idx}`,
      processoId: p.id,
      usuario: autor,
      dataHora: new Date().toISOString(),
      campo: 'Importação via CSV',
      valorAnterior: 'Planilha CSV',
      valorNovo: `Importado como "${p.situacao}" (${p.categoria})`,
    }));

    const histAtualizado = [...novosHistoricos, ...historico];
    setHistorico(histAtualizado);
    salvarHistorico(histAtualizado);
    dispararToast(
      `${novos.length} processo(s) importado(s) do CSV com sucesso!`
    );
  };

  const handleMudarSituacaoRapida = (
    processo: ProcessoSLC,
    novaSituacao: SituacaoProcesso
  ) => {
    if (processo.situacao === novaSituacao) return;
    const atualizado: ProcessoSLC = {
      ...processo,
      situacao: novaSituacao,
      atualizadoEm: new Date().toISOString(),
    };
    handleSalvarProcesso(atualizado, false);
  };

  const handleAtualizarConfigTv = (novaConfig: ConfiguracaoTV) => {
    setConfigTv(novaConfig);
    salvarConfigTV(novaConfig);
    persistirConfigTvNoBackend(novaConfig);
    dispararToast('Configurações de alerta e painel TV atualizadas.');
  };

  if (modoTvAtivo) {
    return (
      <div className="dark">
        <ModoTvView
          processos={processos}
          configTv={configTv}
          onAtualizarConfigTv={handleAtualizarConfigTv}
          onSairModoTv={() => setModoTvAtivo(false)}
        />
      </div>
    );
  }

  const ativos = processos.filter((p) => p.situacao !== 'Concluído');
  const qtdAlertasPrazo = ativos.filter((p) => {
    const st = obterStatusPrazo(p, configTv.diasAlertaPrazoProximo);
    return st === 'VENCIDO' || st === 'PROXIMO';
  }).length;

  const infoModulo: Record<AbaAtiva, { titulo: string; subtitulo: string }> = {
    dashboard: {
      titulo: 'Painel Gerencial da SLC (M1)',
      subtitulo:
        'Visão consolidada de indicadores, gargalos por etapa e distribuição operacional',
    },
    processos: {
      titulo: 'Cadastro e Acompanhamento de Processos (M2)',
      subtitulo:
        'Consulta centralizada complementar ao E-Docs, com filtros, sigilo e trilha de auditoria',
    },
    kanban: {
      titulo: 'Quadro Kanban Operacional (M3)',
      subtitulo:
        'Fluxo visual por etapas internas · Arraste e solte os cards para movimentar processos',
    },
    prazos: {
      titulo: 'Monitoramento de Prazos e Inatividade Interna (M4)',
      subtitulo:
        'Controle proativo de vencimentos críticos e processos sem atualização recente',
    },
    contratos: {
      titulo: 'Gestão de Contratos, Vigências, Saldos e Fiscais (M5)',
      subtitulo:
        'Acompanhamento de prorrogações, apostilamentos, garantias e designação de gestores/fiscais',
    },
    relatorios: {
      titulo: 'Relatórios Gerenciais e Exportação de Dados (M6)',
      subtitulo:
        'Consolidação por setor demandante, tempo de tramitação e exportação em CSV/Excel',
    },
  };

  return (
    <div className="flex min-h-screen bg-slate-100/80 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Toast Flutuante de Confirmação */}
      {toastMsg && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-2xl border border-emerald-500/40 bg-slate-900 px-4 py-3 text-xs font-semibold text-white shadow-2xl">
          <CheckCircle2 className="h-4 w-4 text-emerald-400" />
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Sidebar Institucional (Gov.ES / IPAJM Navy) */}
      <aside className="hidden w-72 shrink-0 flex-col justify-between bg-[#0B2239] text-slate-100 lg:flex">
        <div>
          {/* Identidade Institucional */}
          <div className="border-b border-white/10 px-6 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-sky-400 text-base font-black text-white shadow-lg shadow-blue-500/30">
                SLC
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-extrabold tracking-tight text-white">
                    SLC Digital
                  </span>
                </div>
                <p className="text-[11px] font-medium text-slate-300/80">
                  IPAJM · Governo do Estado do ES
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-[11px] text-slate-300">
              <Building2 className="h-4 w-4 shrink-0 text-sky-400" />
              <span>GTI · Subgerência de Licitações e Contratos</span>
            </div>
          </div>

          {/* Menu de Navegação (M1 a M6) */}
          <div className="px-4 py-5">
            <div className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Módulos do Sistema (M1–M6)
            </div>
            <nav className="space-y-1">
              <button
                onClick={() => setAbaAtiva('dashboard')}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${
                  abaAtiva === 'dashboard'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <LayoutDashboard className="h-4 w-4" />
                  M1 · Dashboard Gerencial
                </span>
              </button>

              <button
                onClick={() => setAbaAtiva('processos')}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${
                  abaAtiva === 'processos'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <FileSpreadsheet className="h-4 w-4" />
                  M2 · Processos da SLC
                </span>
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-extrabold text-white">
                  {processos.length}
                </span>
              </button>

              <button
                onClick={() => setAbaAtiva('kanban')}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${
                  abaAtiva === 'kanban'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <Columns3 className="h-4 w-4" />
                  M3 · Quadro Kanban
                </span>
              </button>

              <button
                onClick={() => setAbaAtiva('prazos')}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${
                  abaAtiva === 'prazos'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <ClockAlert className="h-4 w-4" />
                  M4 · Prazos e Pendências
                </span>
                {qtdAlertasPrazo > 0 && (
                  <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[11px] font-extrabold text-white">
                    {qtdAlertasPrazo}
                  </span>
                )}
              </button>

              <button
                onClick={() => setAbaAtiva('contratos')}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${
                  abaAtiva === 'contratos'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <FileSignature className="h-4 w-4" />
                  M5 · Contratos e Fiscais
                </span>
                <span className="rounded-full bg-emerald-500/25 px-2 py-0.5 text-[11px] font-extrabold text-emerald-300">
                  {contratos.length}
                </span>
              </button>

              <button
                onClick={() => setAbaAtiva('relatorios')}
                className={`flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-xs font-bold transition ${
                  abaAtiva === 'relatorios'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                    : 'text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex items-center gap-3">
                  <FileBarChart2 className="h-4 w-4" />
                  M6 · Relatórios e CSV
                </span>
              </button>
            </nav>

            {/* Ações Rápidas na Sidebar */}
            <div className="mt-6 mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Monitoramento (M7) e Importação
            </div>
            <div className="space-y-2">
              <button
                onClick={() => setModoTvAtivo(true)}
                className="flex w-full items-center justify-between rounded-xl border border-sky-400/30 bg-gradient-to-r from-blue-600/30 to-sky-500/20 px-3.5 py-3 text-xs font-bold text-white transition hover:border-sky-400/60"
              >
                <span className="flex items-center gap-2.5">
                  <Tv className="h-4 w-4 text-sky-300" />
                  M7 · Modo TV (1 TV · 3 Telas)
                </span>
                <span className="rounded bg-sky-400/20 px-1.5 py-0.5 text-[10px] text-sky-200">
                  16:9
                </span>
              </button>

              {perfilAtual !== 'CONSULTA' && (
                <button
                  onClick={() => setImportadorAberto(true)}
                  className="flex w-full items-center gap-2.5 rounded-xl border border-white/10 bg-white/5 px-3.5 py-2.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10"
                >
                  <Upload className="h-4 w-4 text-emerald-400" />
                  Importar Planilha (.CSV)
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Rodapé da Sidebar: Banco MySQL + Status FastAPI */}
        <div className="border-t border-white/10 p-4 space-y-3">
          <div className="rounded-xl bg-white/5 p-3 text-[11px] text-slate-300">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-bold text-sky-300">
                <Database className="h-3.5 w-3.5" />
                Arquitetura GTI · MySQL 8+
              </span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  statusApi.online
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-amber-500/20 text-amber-300'
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    statusApi.online ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                {statusApi.online ? 'FastAPI Online' : 'Modo Local'}
              </span>
            </div>
            <p className="mt-1 text-slate-400 leading-relaxed">
              {statusApi.modoBanco}
            </p>
            {statusApi.online && (
              <a
                href={statusApi.swaggerUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex w-full items-center justify-center rounded-lg border border-sky-400/30 bg-sky-500/15 py-1 text-[11px] font-bold text-sky-200 hover:bg-sky-500/25"
              >
                Abrir Swagger API (/docs) ↗
              </a>
            )}
          </div>
        </div>
      </aside>

      {/* Área Principal à Direita */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* Topbar Executiva */}
        <header className="border-b border-slate-200/90 bg-white px-6 py-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
          <div className="mx-auto flex max-w-7xl flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                {infoModulo[abaAtiva].titulo}
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {infoModulo[abaAtiva].subtitulo}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Alternador Tema Claro / Escuro */}
              <button
                onClick={() => setTemaEscuro((v) => !v)}
                title="Alternar entre Tema Claro Institucional e Tema Escuro"
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                {temaEscuro ? (
                  <>
                    <Sun className="h-4 w-4 text-amber-400" /> Tema Claro
                  </>
                ) : (
                  <>
                    <Moon className="h-4 w-4 text-slate-600" /> Tema Escuro
                  </>
                )}
              </button>

              {/* Seletor de Perfil */}
              <div className="flex items-center gap-2 rounded-xl border border-slate-300 bg-slate-50 px-3 py-1.5 dark:border-slate-700 dark:bg-slate-950">
                <Shield className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <div>
                  <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-400">
                    Perfil de Acesso
                  </span>
                  <select
                    value={perfilAtual}
                    onChange={(e) =>
                      setPerfilAtual(e.target.value as PerfilUsuario)
                    }
                    className="bg-transparent text-xs font-bold text-slate-800 focus:outline-none dark:text-slate-200"
                  >
                    <option value="GESTOR_SLC" className="bg-white dark:bg-slate-900">
                      Gestor SLC (Completo)
                    </option>
                    <option value="SERVIDOR_SLC" className="bg-white dark:bg-slate-900">
                      Servidor SLC (Operacional)
                    </option>
                    <option value="CONSULTA" className="bg-white dark:bg-slate-900">
                      Consulta (Leitura)
                    </option>
                  </select>
                </div>
              </div>

              {perfilAtual !== 'CONSULTA' && (
                <button
                  onClick={() => handleAbrirModal(null, 'novo')}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500"
                >
                  <Plus className="h-4 w-4" />
                  Novo Processo
                </button>
              )}

              <button
                onClick={() => setModoTvAtivo(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-[#0B2239] px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-slate-800 dark:bg-sky-600 dark:hover:bg-sky-500"
              >
                <Tv className="h-4 w-4 text-sky-400 dark:text-white" />
                Abrir Modo TV
              </button>
            </div>
          </div>

          {/* Navegação Mobile */}
          <div className="mt-4 flex gap-2 overflow-x-auto border-t border-slate-200 pt-3 dark:border-slate-800 lg:hidden">
            <button
              onClick={() => setAbaAtiva('dashboard')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                abaAtiva === 'dashboard'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              M1 · Dashboard
            </button>
            <button
              onClick={() => setAbaAtiva('processos')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                abaAtiva === 'processos'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              M2 · Processos ({processos.length})
            </button>
            <button
              onClick={() => setAbaAtiva('kanban')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                abaAtiva === 'kanban'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              M3 · Kanban
            </button>
            <button
              onClick={() => setAbaAtiva('prazos')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                abaAtiva === 'prazos'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              M4 · Prazos ({qtdAlertasPrazo})
            </button>
            <button
              onClick={() => setAbaAtiva('contratos')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                abaAtiva === 'contratos'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              M5 · Contratos ({contratos.length})
            </button>
            <button
              onClick={() => setAbaAtiva('relatorios')}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                abaAtiva === 'relatorios'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
              }`}
            >
              M6 · Relatórios
            </button>
          </div>
        </header>

        {/* Conteúdo Principal */}
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          {abaAtiva === 'dashboard' && (
            <DashboardView
              processos={processos}
              configTv={configTv}
              onSelecionarProcesso={handleAbrirModal}
              onIrParaAba={(aba) => setAbaAtiva(aba)}
            />
          )}

          {abaAtiva === 'processos' && (
            <ProcessosView
              processos={processos}
              configTv={configTv}
              perfilAtual={perfilAtual}
              onAbrirModal={handleAbrirModal}
              onAbrirImportador={() => setImportadorAberto(true)}
              onMudarSituacaoRapida={handleMudarSituacaoRapida}
            />
          )}

          {abaAtiva === 'kanban' && (
            <KanbanView
              processos={processos}
              configTv={configTv}
              perfilAtual={perfilAtual}
              onSelecionarProcesso={handleAbrirModal}
              onMoverEtapa={handleMudarSituacaoRapida}
            />
          )}

          {abaAtiva === 'prazos' && (
            <PrazosView
              processos={processos}
              configTv={configTv}
              onAtualizarConfigTv={handleAtualizarConfigTv}
              onSelecionarProcesso={handleAbrirModal}
            />
          )}

          {abaAtiva === 'contratos' && (
            <ContratosView
              contratos={contratos}
              perfilAtual={perfilAtual}
              onSalvarContrato={handleSalvarContrato}
            />
          )}

          {abaAtiva === 'relatorios' && (
            <RelatoriosView
              processos={processos}
              contratos={contratos}
              historico={historico}
              onNotificar={dispararToast}
            />
          )}
        </main>

        {/* Rodapé */}
        <footer className="border-t border-slate-200/80 bg-white px-6 py-3.5 text-xs text-slate-500 dark:border-slate-900 dark:bg-slate-950 dark:text-slate-500">
          <div className="mx-auto flex max-w-7xl flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <span>
              <strong>SLC Digital</strong> · IPAJM — Gerência de Tecnologia da
              Informação (GTI) &amp; Subgerência de Licitações e Contratos (SLC)
            </span>
            <span>
              Camada complementar ao E-Docs · SGBD Padrão GTI: MySQL
            </span>
          </div>
        </footer>
      </div>

      {/* Modal de Detalhes / Cadastro / Edição / Auditoria */}
      <ProcessoModal
        aberto={modalAberto}
        modoInicial={modoModal}
        processo={processoSelecionado}
        historico={historico}
        perfilAtual={perfilAtual}
        responsaveisSugeridos={responsaveisSugeridos}
        onFechar={() => setModalAberto(false)}
        onSalvar={handleSalvarProcesso}
        onExcluir={handleExcluirProcesso}
      />

      {/* Modal de Importação de Planilha CSV */}
      <ImportarPlanilhaModal
        aberto={importadorAberto}
        onFechar={() => setImportadorAberto(false)}
        onImportarProcessos={handleImportarProcessosPlanilha}
      />
    </div>
  );
}
