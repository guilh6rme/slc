import React, { useState, useMemo } from 'react';
import {
  FileSignature,
  CalendarClock,
  ShieldAlert,
  Wallet,
  Search,
  Plus,
  Users,
  Building,
  CheckCircle2,
  X,
  Save,
  Edit3,
  BarChart3,
  ShieldCheck,
  FileCheck2,
  ChevronDown,
  ChevronUp,
  Landmark,
} from 'lucide-react';
import {
  ContratoSLC,
  CndsContrato,
  ExecucaoMensalItem,
  PerfilUsuario,
  SETORES_DEMANDANTES,
  StatusGarantia,
} from '../types/slc';
import { calcularDiasAtePrazo } from '../services/slcService';

interface ContratosViewProps {
  contratos: ContratoSLC[];
  perfilAtual: PerfilUsuario;
  onSalvarContrato: (contrato: ContratoSLC, isNovo: boolean) => void;
}

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

export const ContratosView: React.FC<ContratosViewProps> = ({
  contratos,
  perfilAtual,
  onSalvarContrato,
}) => {
  const [busca, setBusca] = useState('');
  const [filtroSetor, setFiltroSetor] = useState('TODOS');
  const [filtroVigencia, setFiltroVigencia] = useState('TODOS');
  const [expandidoId, setExpandidoId] = useState<string | null>(null);
  const [modalAberto, setModalAberto] = useState(false);
  const [contratoEditando, setContratoEditando] = useState<ContratoSLC | null>(
    null
  );

  const podeEditar = perfilAtual !== 'CONSULTA';
  const hojeIso = new Date().toISOString().split('T')[0];

  const [form, setForm] = useState<ContratoSLC>({
    id: '',
    numeroContrato: '',
    numeroEdocs: '',
    processoPagamento: '',
    idTces: '',
    abaPlanilha: '',
    grupoPlanilha: 'S',
    empresaContratada: '',
    razaoSocial: '',
    cnpj: '',
    objeto: '',
    objetoCompleto: '',
    modalidadeContratacao: 'Pregão Eletrônico (P)',
    setorDemandante: SETORES_DEMANDANTES[0],
    valorGlobal: 0,
    totalGasto: 0,
    saldoDisponivel: 0,
    mediaMensal: 0,
    reforcoEmpenho: '',
    valorRpps: 0,
    neRpps: '',
    valorFps: 0,
    neFps: '',
    inicioVigencia: hojeIso,
    fimVigencia: hojeIso,
    duracaoMmMax: '12/060',
    dataDuracaoMaxima: '',
    prorrogavel: true,
    optanteSimples: 'N',
    regraPagamento: '10U',
    retencaoIr: 'S',
    statusGarantia: 'Vigente',
    modalidadeGarantia: 'SG',
    validadeGarantia: '',
    gestorContrato: '',
    gestorSuplente: '',
    fiscalTitular: '',
    fiscalSuplente: '',
    fiscaisAdicionais: '',
    cndsJson: '{}',
    sancaoCeis: 'Nada Consta (CEIS/CGU Regular)',
    execucaoMensalJson: '[]',
    prepostoContato: '',
    emailContratada: '',
    ultimoTermo: 'Contrato Original',
    portariaFiscalizacao: '',
  });

  const abrirModal = (c: ContratoSLC | null) => {
    setContratoEditando(c);
    if (c) {
      setForm({ ...c });
    } else {
      const proxAno = new Date();
      proxAno.setFullYear(proxAno.getFullYear() + 1);
      setForm({
        id: `cont-${Date.now()}`,
        numeroContrato: '',
        numeroEdocs: '',
        processoPagamento: '',
        idTces: '',
        abaPlanilha: '',
        grupoPlanilha: 'S',
        empresaContratada: '',
        razaoSocial: '',
        cnpj: '',
        objeto: '',
        objetoCompleto: '',
        modalidadeContratacao: 'Pregão Eletrônico (P)',
        setorDemandante: SETORES_DEMANDANTES[0],
        valorGlobal: 0,
        totalGasto: 0,
        saldoDisponivel: 0,
        mediaMensal: 0,
        reforcoEmpenho: '',
        valorRpps: 0,
        neRpps: '',
        valorFps: 0,
        neFps: '',
        inicioVigencia: hojeIso,
        fimVigencia: proxAno.toISOString().split('T')[0],
        duracaoMmMax: '12/060',
        dataDuracaoMaxima: '',
        prorrogavel: true,
        optanteSimples: 'N',
        regraPagamento: '10U',
        retencaoIr: 'S',
        statusGarantia: 'Vigente',
        modalidadeGarantia: 'SG',
        validadeGarantia: '',
        gestorContrato: '',
        gestorSuplente: '',
        fiscalTitular: '',
        fiscalSuplente: '',
        fiscaisAdicionais: '',
        cndsJson: '{}',
        sancaoCeis: 'Nada Consta (CEIS/CGU Regular)',
        execucaoMensalJson: '[]',
        prepostoContato: '',
        emailContratada: '',
        ultimoTermo: 'Contrato Original',
        portariaFiscalizacao: '',
      });
    }
    setModalAberto(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.numeroContrato.trim() || !form.empresaContratada.trim()) return;
    onSalvarContrato(form, !contratoEditando);
    setModalAberto(false);
  };

  const valorTotalEmpenhado = contratos.reduce((acc, c) => acc + (c.valorGlobal || 0), 0);
  const valorTotalGasto = contratos.reduce((acc, c) => acc + (c.totalGasto || 0), 0);
  const saldoTotalDisponivel = contratos.reduce(
    (acc, c) => acc + (c.saldoDisponivel || 0),
    0
  );

  const countProrrogaveis = contratos.filter((c) => c.prorrogavel).length;
  const countNovasContratacoes = contratos.filter((c) => !c.prorrogavel).length;

  const vencendoAte90d = contratos.filter((c) => {
    const dias = calcularDiasAtePrazo(c.fimVigencia);
    return dias !== null && dias <= 90;
  });

  const setoresDisponiveis = useMemo(() => {
    const set = new Set<string>(SETORES_DEMANDANTES);
    contratos.forEach((c) => {
      if (c.setorDemandante) set.add(c.setorDemandante);
    });
    return Array.from(set);
  }, [contratos]);

  const filtrados = useMemo(() => {
    return contratos
      .filter((c) => {
        const q = busca.trim().toLowerCase();
        const matchBusca =
          !q ||
          c.numeroContrato.toLowerCase().includes(q) ||
          c.numeroEdocs.toLowerCase().includes(q) ||
          (c.processoPagamento || '').toLowerCase().includes(q) ||
          (c.idTces || '').toLowerCase().includes(q) ||
          (c.abaPlanilha || '').toLowerCase().includes(q) ||
          c.empresaContratada.toLowerCase().includes(q) ||
          (c.razaoSocial || '').toLowerCase().includes(q) ||
          c.cnpj.toLowerCase().includes(q) ||
          c.objeto.toLowerCase().includes(q) ||
          c.gestorContrato.toLowerCase().includes(q) ||
          c.fiscalTitular.toLowerCase().includes(q) ||
          (c.fiscaisAdicionais || '').toLowerCase().includes(q);

        const matchSetor =
          filtroSetor === 'TODOS' || c.setorDemandante === filtroSetor;

        const dias = calcularDiasAtePrazo(c.fimVigencia) ?? 999;
        const matchVigencia =
          filtroVigencia === 'TODOS' ||
          (filtroVigencia === 'CRITICO_45' && dias <= 45) ||
          (filtroVigencia === 'JANELA_90' && dias <= 90) ||
          (filtroVigencia === 'JANELA_180' && dias <= 180) ||
          (filtroVigencia === 'NAO_PRORROGAVEL' && !c.prorrogavel) ||
          (filtroVigencia === 'REGULAR' && dias > 90);

        return matchBusca && matchSetor && matchVigencia;
      })
      .sort((a, b) => a.fimVigencia.localeCompare(b.fimVigencia));
  }, [contratos, busca, filtroSetor, filtroVigencia]);

  const inputClass =
    'w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white';

  return (
    <div className="space-y-6">
      {/* KPIs espelhados da aba 'vigentes' e 'geral' */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
          <div className="absolute inset-x-0 top-0 h-1 bg-blue-600" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Aba &ldquo;vigentes&rdquo; (Ativos)
            </span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-500/15 dark:text-blue-400">
              <FileSignature className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-slate-900 dark:text-white">
            {contratos.length}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {countProrrogaveis} Prorrogáveis (P) · {countNovasContratacoes} Nova Contratação (NP)
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
          <div className="absolute inset-x-0 top-0 h-1 bg-indigo-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Empenhado (2026)
            </span>
            <div className="rounded-xl bg-indigo-50 p-2 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400">
              <Landmark className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-slate-900 dark:text-white">
            {formatarMoeda(valorTotalEmpenhado)}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Executado (Jan–Out):{' '}
            <strong className="text-slate-700 dark:text-slate-200">
              {formatarMoeda(valorTotalGasto)}
            </strong>
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
          <div className="absolute inset-x-0 top-0 h-1 bg-emerald-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Saldo de Empenho Disponível
            </span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-emerald-600 dark:text-emerald-300">
            {formatarMoeda(saldoTotalDisponivel)}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Rateado entre Fundo RPPS e Fundo FPS
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/15">
          <div className="absolute inset-x-0 top-0 h-1 bg-amber-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              Janela de Vencimento (&le;90d)
            </span>
            <div className="rounded-xl bg-amber-100 p-2 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <CalendarClock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-amber-700 dark:text-amber-300">
            {vencendoAte90d.length}
          </div>
          <p className="mt-1 text-xs font-medium text-amber-800/80 dark:text-amber-300/80">
            Ordenados por Término (igual à aba &ldquo;vigentes&rdquo;)
          </p>
        </div>
      </div>

      {/* Busca, Filtros e Novo Contrato */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por empresa (ex: ABCPREV, AGENDA, DATAPREV), nº contrato, Processo Mãe, Processo Pagto, ID TCES ou Fiscal..."
              className="w-full rounded-xl border border-slate-300 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filtroSetor}
              onChange={(e) => setFiltroSetor(e.target.value)}
              className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="TODOS">Todos os setores solicitantes</option>
              {setoresDisponiveis.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              value={filtroVigencia}
              onChange={(e) => setFiltroVigencia(e.target.value)}
              className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="TODOS">Todas as vigências ({filtrados.length})</option>
              <option value="CRITICO_45">Crítico: vence em &le; 45 dias</option>
              <option value="JANELA_90">Alerta: vence em &le; 90 dias</option>
              <option value="JANELA_180">Planejamento: vence em &le; 180 dias</option>
              <option value="NAO_PRORROGAVEL">Não Prorrogáveis (NP · Nova Contratação)</option>
              <option value="REGULAR">Vigência regular (&gt; 90 dias)</option>
            </select>

            {podeEditar && (
              <button
                onClick={() => abrirModal(null)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500"
              >
                <Plus className="h-4 w-4" />
                Novo Contrato
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Lista de Contratos Vigentes ordenada por Término */}
      <div className="space-y-4">
        {filtrados.map((c, index) => {
          const diasRestantes = calcularDiasAtePrazo(c.fimVigencia) ?? 0;
          const pctSaldo =
            c.valorGlobal > 0
              ? Math.max(
                  0,
                  Math.min(100, Math.round((c.saldoDisponivel / c.valorGlobal) * 100))
                )
              : 0;

          const isCritico = diasRestantes <= 45;
          const isAlerta = diasRestantes > 45 && diasRestantes <= 90;
          const isExpandido = expandidoId === c.id;

          let cnds: CndsContrato = {};
          try {
            if (c.cndsJson) cnds = JSON.parse(c.cndsJson);
          } catch {
            cnds = {};
          }

          let execucaoMensal: ExecucaoMensalItem[] = [];
          try {
            if (c.execucaoMensalJson) execucaoMensal = JSON.parse(c.execucaoMensalJson);
          } catch {
            execucaoMensal = [];
          }

          const fiscaisExtrasList = (c.fiscaisAdicionais || '')
            .split(';')
            .map((x) => x.trim())
            .filter(Boolean);

          return (
            <div
              key={c.id}
              className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm transition hover:border-blue-300 dark:border-slate-800 dark:bg-slate-900/90 dark:hover:border-slate-700"
            >
              {/* Cabeçalho do Card (Espelho da linha na aba 'vigentes') */}
              <div className="flex flex-col justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800 lg:flex-row lg:items-center">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-slate-200 px-2.5 py-0.5 font-mono text-xs font-extrabold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                      #{index + 1}
                    </span>
                    {c.abaPlanilha && (
                      <span className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-0.5 font-mono text-xs font-bold text-blue-700 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300">
                        Aba: {c.abaPlanilha}
                      </span>
                    )}
                    <span className="rounded-lg bg-[#0B2239] px-3 py-1 font-mono text-xs font-extrabold text-white dark:bg-blue-600">
                      Contrato: {c.numeroContrato}
                    </span>
                    <span className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-mono text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                      Proc. Mãe: {c.numeroEdocs}
                    </span>
                    {c.processoPagamento && (
                      <span className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 font-mono text-xs font-bold text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
                        Proc. Pagto 2026: {c.processoPagamento}
                      </span>
                    )}
                    {c.modalidadeContratacao && (
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {c.modalidadeContratacao}
                      </span>
                    )}
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
                        c.prorrogavel
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300'
                      }`}
                    >
                      {c.prorrogavel ? 'P · Prorrogável' : 'NP · Nova Contratação'}
                    </span>
                  </div>

                  <h3 className="pt-1 text-base font-extrabold text-slate-900 dark:text-white">
                    {c.empresaContratada}{' '}
                    {c.razaoSocial && c.razaoSocial !== c.empresaContratada && (
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        — {c.razaoSocial}
                      </span>
                    )}{' '}
                    <span className="font-mono text-xs font-normal text-slate-500">
                      (CNPJ/CPF: {c.cnpj})
                    </span>
                  </h3>
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    <strong>Objeto:</strong> {c.objeto}
                    {c.idTces && (
                      <span className="ml-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                        · ID TCES: {c.idTces}
                      </span>
                    )}
                  </p>
                </div>

                {/* Bloco de Vigência e Ações */}
                <div className="flex flex-wrap items-center gap-2.5">
                  <div
                    className={`rounded-xl border px-4 py-2.5 text-right ${
                      isCritico
                        ? 'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/40 dark:bg-rose-950/30 dark:text-rose-200'
                        : isAlerta
                        ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-950/25 dark:text-amber-200'
                        : 'border-slate-200 bg-slate-50 text-slate-800 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200'
                    }`}
                  >
                    <div className="text-[11px] font-bold uppercase tracking-wider opacity-75">
                      Início: {formatarDataBr(c.inicioVigencia)} → Término:{' '}
                      {formatarDataBr(c.fimVigencia)}
                    </div>
                    <div className="text-sm font-extrabold">
                      {diasRestantes < 0
                        ? `Vencido há ${Math.abs(diasRestantes)} dias`
                        : `${diasRestantes} dias para o término`}
                    </div>
                    {c.dataDuracaoMaxima && (
                      <div className="text-[10px] opacity-75">
                        Duração: {c.duracaoMmMax || '—'} (Limite legal:{' '}
                        {formatarDataBr(c.dataDuracaoMaxima)})
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() =>
                      setExpandidoId(isExpandido ? null : c.id)
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-700 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300"
                  >
                    <BarChart3 className="h-4 w-4" />
                    {isExpandido ? 'Ocultar Ficha' : 'Ficha Completa (Jan-Dez / CNDs)'}
                    {isExpandido ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>

                  {podeEditar && (
                    <button
                      onClick={() => abrirModal(c)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-blue-600 hover:text-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-blue-600"
                    >
                      <Edit3 className="h-4 w-4" />
                      Editar
                    </button>
                  )}
                </div>
              </div>

              {/* 3 Colunas Principais: Execução Orçamentária (RPPS/FPS), Equipe de Fiscalização (G/GS/F/F1..F9) e Regras/Garantia */}
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* 1. Controle de Empenho, Gasto, Saldo e Rateio RPPS / FPS */}
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      Saldo Empenho ({pctSaldo}%)
                    </span>
                    <span className="font-extrabold text-emerald-700 dark:text-emerald-400">
                      {formatarMoeda(c.saldoDisponivel)}
                    </span>
                  </div>
                  <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${pctSaldo}%` }}
                    />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1 text-[11px] text-slate-600 dark:text-slate-400">
                    <div>
                      <strong>Empenhado:</strong> {formatarMoeda(c.valorGlobal)}
                    </div>
                    <div>
                      <strong>Gasto 2026:</strong> {formatarMoeda(c.totalGasto || 0)}
                    </div>
                    <div>
                      <strong>Média/mês:</strong> {formatarMoeda(c.mediaMensal || 0)}
                    </div>
                    <div>
                      <strong>Reforço Emp.:</strong> {c.reforcoEmpenho || '—'}
                    </div>
                  </div>
                  {((c.valorRpps || 0) > 0 || (c.valorFps || 0) > 0) && (
                    <div className="mt-2 border-t border-slate-200/80 pt-1.5 text-[10px] text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      <div>
                        <strong>RPPS:</strong> {formatarMoeda(c.valorRpps || 0)}{' '}
                        {c.neRpps && `(${c.neRpps})`}
                      </div>
                      <div>
                        <strong>FPS:</strong> {formatarMoeda(c.valorFps || 0)}{' '}
                        {c.neFps && `(${c.neFps})`}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Equipe de Gestão e Fiscalização (G, GS, F, F1..F9) */}
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/50">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      Gestores e Fiscais Designados
                    </span>
                    <span className="font-mono text-[10px] text-slate-500">
                      {c.portariaFiscalizacao}
                    </span>
                  </div>
                  <div className="mt-1.5 space-y-0.5 text-[11px] text-slate-600 dark:text-slate-400">
                    <div>
                      <strong>Gestor (G):</strong> {c.gestorContrato}
                      {c.gestorSuplente && c.gestorSuplente !== '—' && (
                        <span className="text-slate-500">
                          {' '}
                          · <strong>Suplente (GS):</strong> {c.gestorSuplente}
                        </span>
                      )}
                    </div>
                    <div>
                      <strong>Fiscal (F):</strong> {c.fiscalTitular}
                    </div>
                    {c.fiscalSuplente && c.fiscalSuplente !== '—' && (
                      <div>
                        <strong>Fiscal (F1):</strong> {c.fiscalSuplente}
                      </div>
                    )}
                    {fiscaisExtrasList.length > 0 && (
                      <div className="pt-0.5 text-[10px] text-blue-700 dark:text-blue-300">
                        <strong>Fiscais Setoriais (F2..F9):</strong>{' '}
                        {fiscaisExtrasList.join(' · ')}
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Setor Solicitante, Pagamento, Garantia e Conformidade CEIS */}
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/50">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Building className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                      {c.setorDemandante}
                    </span>
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[10px] text-slate-800 dark:bg-slate-800 dark:text-slate-200">
                      Pagto: {c.regraPagamento || '—'}
                    </span>
                  </div>
                  <div className="mt-1.5 space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                    <div className="flex flex-wrap gap-2">
                      <span>
                        <strong>Simples Nac.:</strong> {c.optanteSimples || 'N'}
                      </span>
                      <span>·</span>
                      <span>
                        <strong>Ret. IR:</strong> {c.retencaoIr || '—'}
                      </span>
                      <span>·</span>
                      <span>
                        <strong>Garantia ({c.modalidadeGarantia || '—'}):</strong>{' '}
                        {formatarDataBr(c.validadeGarantia)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-slate-800 dark:text-slate-200">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      <span>
                        <strong>Aditivos/Termos:</strong> {c.ultimoTermo}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                      <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                      <span>{c.sancaoCeis || 'Nada Consta (CEIS/CGU Regular)'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Gaveta Expansível: Ficha Individual da Aba (Execução Jan..Dez + 6 CNDs + Objeto Completo) */}
              {isExpandido && (
                <div className="mt-5 space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                  {c.objetoCompleto && (
                    <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                      <strong>Objeto Completo (Aba {c.abaPlanilha}):</strong>{' '}
                      {c.objetoCompleto}
                      {(c.prepostoContato || c.emailContratada) && (
                        <div className="mt-1 text-[11px] text-slate-500">
                          <strong>Preposto / Contato:</strong>{' '}
                          {c.prepostoContato || '—'} · <strong>E-mail:</strong>{' '}
                          {c.emailContratada || '—'}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Tabela de Execução Financeira Mensal (Jan a Dez) igual às linhas 16 a 27 das abas individuais */}
                  <div>
                    <h4 className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      <BarChart3 className="h-3.5 w-3.5 text-blue-600" />
                      Execução Financeira Mensal 2026 (Jan – Dez · Valores e Notas Fiscais / RPAs)
                    </h4>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12">
                      {execucaoMensal.map((item) => (
                        <div
                          key={item.mes}
                          className={`rounded-xl border p-2.5 text-center ${
                            item.valor > 0
                              ? 'border-blue-200 bg-blue-50/50 dark:border-blue-500/30 dark:bg-blue-950/20'
                              : 'border-slate-200 bg-slate-50/50 opacity-70 dark:border-slate-800 dark:bg-slate-950/40'
                          }`}
                        >
                          <div className="text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">
                            {item.mes}/26
                          </div>
                          <div className="mt-1 text-xs font-extrabold text-slate-900 dark:text-white">
                            {item.valor > 0 ? formatarMoeda(item.valor) : '—'}
                          </div>
                          {item.nf && (
                            <div
                              className="mt-0.5 truncate font-mono text-[10px] text-blue-700 dark:text-blue-300"
                              title={`NF/RPA: ${item.nf}`}
                            >
                              NF: {item.nf}
                            </div>
                          )}
                          {item.medicao && (
                            <div className="truncate text-[9px] text-slate-500">
                              {item.medicao}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Controle de Certidões Negativas de Débito (6 CNDs + Peça E-Docs) */}
                  <div>
                    <h4 className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      <FileCheck2 className="h-3.5 w-3.5 text-emerald-600" />
                      Regularidade Fiscal — Certidões Negativas (CNDs) e Peças E-Docs (#)
                    </h4>
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
                      {[
                        { chave: 'municipal', rotulo: 'CND Municipal', dados: cnds.municipal },
                        { chave: 'estadual_es', rotulo: 'CND Estadual (ES)', dados: cnds.estadual_es },
                        { chave: 'estadual', rotulo: 'CND Estadual (Origem)', dados: cnds.estadual },
                        { chave: 'federal', rotulo: 'CND Federal / INSS', dados: cnds.federal },
                        { chave: 'trabalhista', rotulo: 'CNDT Trabalhista', dados: cnds.trabalhista },
                        { chave: 'fgts', rotulo: 'CRF — FGTS', dados: cnds.fgts },
                      ].map((cert) => {
                        const valIso = cert.dados?.validade || '';
                        const peca = cert.dados?.pecaEdocs || '';
                        const diasCnd =
                          valIso.length === 10 ? calcularDiasAtePrazo(valIso) : null;
                        const vencida = diasCnd !== null && diasCnd < 0;

                        return (
                          <div
                            key={cert.chave}
                            className={`rounded-xl border p-2.5 ${
                              vencida
                                ? 'border-rose-300 bg-rose-50/60 dark:border-rose-500/40 dark:bg-rose-950/25'
                                : 'border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/60'
                            }`}
                          >
                            <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">
                              {cert.rotulo}
                            </div>
                            <div className="mt-1 text-xs font-extrabold text-slate-900 dark:text-white">
                              {valIso ? formatarDataBr(valIso) : 'Isento / *'}
                            </div>
                            <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-500">
                              <span>Peça: {peca ? `#${peca}` : '—'}</span>
                              {diasCnd !== null && (
                                <span
                                  className={
                                    vencida
                                      ? 'font-bold text-rose-600 dark:text-rose-400'
                                      : 'font-semibold text-emerald-600 dark:text-emerald-400'
                                  }
                                >
                                  {diasCnd < 0 ? `${Math.abs(diasCnd)}d venc.` : `+${diasCnd}d`}
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal de Cadastro / Edição de Contrato Alinhado com a Planilha */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {contratoEditando
                  ? `Editar Contrato nº ${form.numeroContrato} (${form.empresaContratada})`
                  : 'Registrar Novo Contrato na SLC'}
              </h2>
              <button
                onClick={() => setModalAberto(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              id="form-contrato"
              onSubmit={handleSubmit}
              className="flex-1 space-y-4 overflow-y-auto p-6"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Nº do Contrato *
                  </label>
                  <input
                    required
                    value={form.numeroContrato}
                    onChange={(e) =>
                      setForm({ ...form, numeroContrato: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Nº Processo Mãe (E-Docs) *
                  </label>
                  <input
                    required
                    value={form.numeroEdocs}
                    onChange={(e) =>
                      setForm({ ...form, numeroEdocs: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Nº Processo Pagto (2026)
                  </label>
                  <input
                    value={form.processoPagamento || ''}
                    onChange={(e) =>
                      setForm({ ...form, processoPagamento: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    ID TCES (CidadES)
                  </label>
                  <input
                    value={form.idTces || ''}
                    onChange={(e) =>
                      setForm({ ...form, idTces: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Nome Curto / Empresa *
                  </label>
                  <input
                    required
                    value={form.empresaContratada}
                    onChange={(e) =>
                      setForm({ ...form, empresaContratada: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    CNPJ / CPF
                  </label>
                  <input
                    value={form.cnpj}
                    onChange={(e) => setForm({ ...form, cnpj: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Setor Solicitante
                  </label>
                  <select
                    value={form.setorDemandante}
                    onChange={(e) =>
                      setForm({ ...form, setorDemandante: e.target.value })
                    }
                    className={inputClass}
                  >
                    {setoresDisponiveis.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Objeto Resumido *
                </label>
                <input
                  required
                  value={form.objeto}
                  onChange={(e) => setForm({ ...form, objeto: e.target.value })}
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Total Empenhado (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.valorGlobal}
                    onChange={(e) =>
                      setForm({ ...form, valorGlobal: Number(e.target.value) })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Total Gasto no Ano (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.totalGasto || 0}
                    onChange={(e) =>
                      setForm({ ...form, totalGasto: Number(e.target.value) })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Saldo Empenho (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.saldoDisponivel}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        saldoDisponivel: Number(e.target.value),
                      })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Prorrogável (P / NP)
                  </label>
                  <select
                    value={form.prorrogavel ? 'P' : 'NP'}
                    onChange={(e) =>
                      setForm({ ...form, prorrogavel: e.target.value === 'P' })
                    }
                    className={inputClass}
                  >
                    <option value="P">P · Prorrogável</option>
                    <option value="NP">NP · Não Prorrogável (Nova Contratação)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Início da Vigência
                  </label>
                  <input
                    type="date"
                    value={form.inicioVigencia}
                    onChange={(e) =>
                      setForm({ ...form, inicioVigencia: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Término (Fim Vigência)
                  </label>
                  <input
                    type="date"
                    value={form.fimVigencia}
                    onChange={(e) =>
                      setForm({ ...form, fimVigencia: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Duração MM//MM
                  </label>
                  <input
                    value={form.duracaoMmMax || ''}
                    placeholder="Ex: 12/060"
                    onChange={(e) =>
                      setForm({ ...form, duracaoMmMax: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Regra Data Pagto
                  </label>
                  <input
                    value={form.regraPagamento || ''}
                    placeholder="Ex: 10U, 15C, 30D"
                    onChange={(e) =>
                      setForm({ ...form, regraPagamento: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Gestor (G)
                  </label>
                  <input
                    value={form.gestorContrato}
                    onChange={(e) =>
                      setForm({ ...form, gestorContrato: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Gestor Suplente (GS)
                  </label>
                  <input
                    value={form.gestorSuplente || ''}
                    onChange={(e) =>
                      setForm({ ...form, gestorSuplente: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Fiscal Titular (F)
                  </label>
                  <input
                    value={form.fiscalTitular}
                    onChange={(e) =>
                      setForm({ ...form, fiscalTitular: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Fiscal Suplente (F1)
                  </label>
                  <input
                    value={form.fiscalSuplente}
                    onChange={(e) =>
                      setForm({ ...form, fiscalSuplente: e.target.value })
                    }
                    className={inputClass}
                  />
                </div>
              </div>
            </form>

            <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                form="form-contrato"
                className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500"
              >
                <Save className="h-4 w-4" />
                Salvar Contrato
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
