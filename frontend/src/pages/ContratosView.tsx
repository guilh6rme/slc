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
  SETORES_DEMANDANTES,
  StatusGarantia,
} from '../types/slc';
import { calcularDiasAtePrazo } from '../services/slcService';

interface ContratosViewProps {
  contratos: ContratoSLC[];
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

const MESES_PADRAO = [
  'Jan',
  'Fev',
  'Mar',
  'Abr',
  'Mai',
  'Jun',
  'Jul',
  'Ago',
  'Set',
  'Out',
  'Nov',
  'Dez',
];

function normalizarExecucaoMensal(jsonStr?: string): ExecucaoMensalItem[] {
  let parsed: ExecucaoMensalItem[] = [];
  try {
    if (jsonStr) parsed = JSON.parse(jsonStr);
  } catch {
    parsed = [];
  }
  const mapPorMes = new Map<string, ExecucaoMensalItem>();
  parsed.forEach((item) => {
    if (item && item.mes) mapPorMes.set(item.mes, item);
  });
  return MESES_PADRAO.map((mes) => {
    const existente = mapPorMes.get(mes);
    return {
      mes,
      valor: Number(existente?.valor) || 0,
      nf: existente?.nf || '',
      medicao: existente?.medicao || '',
    };
  });
}

function recalcularTotaisContrato(
  base: ContratoSLC,
  meses: ExecucaoMensalItem[],
  overrideValorGlobal?: number
): ContratoSLC {
  const valorGlobal =
    overrideValorGlobal !== undefined
      ? overrideValorGlobal
      : Number(base.valorGlobal) || 0;

  const totalGasto =
    Math.round(
      meses.reduce((acc, item) => acc + (Number(item.valor) || 0), 0) * 100
    ) / 100;

  const saldoDisponivel = Math.round((valorGlobal - totalGasto) * 100) / 100;

  // Descobre até qual mês já houve movimentação (valor > 0 ou NF preenchida)
  let ultimoIndiceMovimentado = -1;
  meses.forEach((m, idx) => {
    if ((Number(m.valor) || 0) > 0 || (m.nf && m.nf.trim() !== '')) {
      ultimoIndiceMovimentado = idx;
    }
  });

  const qtdMesesDecorridos =
    ultimoIndiceMovimentado >= 0 ? ultimoIndiceMovimentado + 1 : 0;
  const mediaMensal =
    qtdMesesDecorridos > 0
      ? Math.round((totalGasto / qtdMesesDecorridos) * 100) / 100
      : 0;

  let reforcoEmpenho = base.reforcoEmpenho || 'R$ 0,00';
  const diasFim = calcularDiasAtePrazo(base.fimVigencia);
  if (diasFim !== null && diasFim < 0) {
    reforcoEmpenho = 'Encerrado';
  } else if (qtdMesesDecorridos > 0) {
    const mesesRestantesAno = Math.max(0, 12 - qtdMesesDecorridos);
    const estimativaRestante = mesesRestantesAno * mediaMensal;
    const diferenca = Math.round((saldoDisponivel - estimativaRestante) * 100) / 100;
    reforcoEmpenho = formatarMoeda(diferenca);
  } else {
    reforcoEmpenho = formatarMoeda(saldoDisponivel);
  }

  return {
    ...base,
    valorGlobal,
    totalGasto,
    saldoDisponivel,
    mediaMensal,
    reforcoEmpenho,
    execucaoMensalJson: JSON.stringify(meses),
  };
}

export const ContratosView: React.FC<ContratosViewProps> = ({
  contratos,
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
  const [mesesForm, setMesesForm] = useState<ExecucaoMensalItem[]>(() =>
    normalizarExecucaoMensal('[]')
  );

  // Modal rápido de lançamento mensal (ao clicar direto em um mês Jan..Dez)
  const [modalMesContrato, setModalMesContrato] = useState<ContratoSLC | null>(
    null
  );
  const [mesFocoIdx, setMesFocoIdx] = useState<number>(0);
  const [mesesRapidos, setMesesRapidos] = useState<ExecucaoMensalItem[]>([]);

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
      const normalizados = normalizarExecucaoMensal(c.execucaoMensalJson);
      setMesesForm(normalizados);
      setForm({ ...c, execucaoMensalJson: JSON.stringify(normalizados) });
    } else {
      const proxAno = new Date();
      proxAno.setFullYear(proxAno.getFullYear() + 1);
      const vazios = normalizarExecucaoMensal('[]');
      setMesesForm(vazios);
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
        reforcoEmpenho: 'R$ 0,00',
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
        execucaoMensalJson: JSON.stringify(vazios),
        prepostoContato: '',
        emailContratada: '',
        ultimoTermo: 'Contrato Original',
        portariaFiscalizacao: '',
      });
    }
    setModalAberto(true);
  };

  const atualizarMesNoForm = (
    idx: number,
    campo: keyof ExecucaoMensalItem,
    valor: string | number
  ) => {
    const novaLista = mesesForm.map((item, i) =>
      i === idx ? { ...item, [campo]: valor } : item
    );
    setMesesForm(novaLista);
    setForm((prev) => recalcularTotaisContrato(prev, novaLista));
  };

  const abrirLancamentoMensalRapido = (c: ContratoSLC, idxMes = 0) => {
    const lista = normalizarExecucaoMensal(c.execucaoMensalJson);
    setModalMesContrato(c);
    setMesesRapidos(lista);
    setMesFocoIdx(idxMes);
  };

  const salvarLancamentoMensalRapido = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalMesContrato) return;
    const atualizado = recalcularTotaisContrato(modalMesContrato, mesesRapidos);
    onSalvarContrato(atualizado, false);
    setModalMesContrato(null);
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
            {countProrrogaveis} Prorrogáveis (P) · {countNovasContratacoes} Nova contratação (NP)
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90">
          <div className="absolute inset-x-0 top-0 h-1 bg-indigo-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total empenhado (2026)
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
              Saldo de empenho disponível
            </span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400">
              <Wallet className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold text-emerald-600 dark:text-emerald-300">
            {formatarMoeda(saldoTotalDisponivel)}
          </div>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Rateado entre fundo RPPS e fundo FPS
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/40 p-5 shadow-sm dark:border-amber-500/30 dark:bg-amber-950/15">
          <div className="absolute inset-x-0 top-0 h-1 bg-amber-500" />
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
              Janela de vencimento (&le;90d)
            </span>
            <div className="rounded-xl bg-amber-100 p-2 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
              <CalendarClock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-3xl font-extrabold text-amber-700 dark:text-amber-300">
            {vencendoAte90d.length}
          </div>
          <p className="mt-1 text-xs font-medium text-amber-800/80 dark:text-amber-300/80">
            Ordenados por término (igual à aba &ldquo;vigentes&rdquo;)
          </p>
        </div>
      </div>

      {/* Busca, filtros e novo contrato */}
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
              <option value="NAO_PRORROGAVEL">Não prorrogáveis (NP · Nova contratação)</option>
              <option value="REGULAR">Vigência regular (&gt; 90 dias)</option>
            </select>

            <button
              onClick={() => abrirModal(null)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/20 hover:bg-blue-500"
            >
              <Plus className="h-4 w-4" />
              Novo contrato
            </button>
          </div>
        </div>
      </div>

      {/* Lista de contratos vigentes ordenada por término */}
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
              {/* Cabeçalho do card (espelho da linha na aba 'vigentes') */}
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
                      Proc. mãe: {c.numeroEdocs}
                    </span>
                    {c.processoPagamento && (
                      <span className="rounded-lg border border-indigo-200 bg-indigo-50 px-2.5 py-0.5 font-mono text-xs font-bold text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
                        Proc. pagto 2026: {c.processoPagamento}
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

                {/* Bloco de vigência e ações */}
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

                  <button
                    onClick={() => abrirModal(c)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-700 hover:bg-blue-600 hover:text-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-blue-600"
                  >
                    <Edit3 className="h-4 w-4" />
                    Editar
                  </button>
                </div>
              </div>

              {/* 3 Colunas principais: execução orçamentária (RPPS/FPS), equipe de fiscalização (G/GS/F/F1..F9) e regras/garantia */}
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* 1. Controle de empenho, gasto, saldo e rateio RPPS / FPS */}
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/50">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700 dark:text-slate-300">
                      Saldo empenho ({pctSaldo}%)
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
                      <strong>Reforço emp.:</strong> {c.reforcoEmpenho || '—'}
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

                {/* 2. Equipe de gestão e fiscalização (G, GS, F, F1..F9) */}
                <div className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-950/50">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                      Gestores e fiscais designados
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
                        <strong>Fiscais setoriais (F2..F9):</strong>{' '}
                        {fiscaisExtrasList.join(' · ')}
                      </div>
                    )}
                  </div>
                </div>

                {/* 3. Setor solicitante, pagamento, garantia e conformidade CEIS */}
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
                        <strong>Simples nac.:</strong> {c.optanteSimples || 'N'}
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

              {/* Gaveta expansível: ficha individual da aba (execução jan-dez + 6 CNDs + objeto completo) */}
              {isExpandido && (
                <div className="mt-5 space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800">
                  {c.objetoCompleto && (
                    <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-700 dark:bg-slate-950 dark:text-slate-300">
                      <strong>Objeto completo (Aba {c.abaPlanilha}):</strong>{' '}
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

                  {/* Tabela de execução financeira mensal (jan a dez) igual às linhas 16 a 27 das abas individuais */}
                  <div>
                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                      <h4 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                        <BarChart3 className="h-3.5 w-3.5 text-blue-600" />
                        Execução financeira mensal 2026 (Jan – Dez · Valores e notas fiscais / RPAs)
                      </h4>
                      <button
                        type="button"
                        onClick={() => abrirLancamentoMensalRapido(c, 0)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 transition hover:bg-blue-600 hover:text-white dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-600 dark:hover:text-white"
                      >
                        <Edit3 className="h-3 w-3" />
                        Lançar / Editar valores mensais
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12">
                      {normalizarExecucaoMensal(c.execucaoMensalJson).map(
                        (item, idxMes) => (
                          <button
                            type="button"
                            key={item.mes}
                            onClick={() => abrirLancamentoMensalRapido(c, idxMes)}
                            title={`Clique para lançar ou editar ${item.mes}/2026 (Valor, NF/RPA e Medição)`}
                            className={`group relative rounded-xl border p-2.5 text-center transition hover:-translate-y-0.5 hover:border-blue-500 hover:shadow-md ${
                              item.valor > 0
                                ? 'border-blue-200 bg-blue-50/50 dark:border-blue-500/30 dark:bg-blue-950/20'
                                : 'border-slate-200 bg-slate-50/50 opacity-75 hover:opacity-100 dark:border-slate-800 dark:bg-slate-950/40'
                            }`}
                          >
                            <div className="flex items-center justify-center gap-1 text-[10px] font-extrabold uppercase text-slate-500 dark:text-slate-400">
                              <span>{item.mes}/26</span>
                              <Edit3 className="h-2.5 w-2.5 opacity-0 transition group-hover:opacity-100 text-blue-600 dark:text-blue-400" />
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
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Controle de certidões negativas de débito (6 CNDs + peça E-Docs) */}
                  <div>
                    <h4 className="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                      <FileCheck2 className="h-3.5 w-3.5 text-emerald-600" />
                      Regularidade fiscal — Certidões negativas (CNDs) e peças E-Docs (#)
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

      {/* Modal de cadastro / Edição de contrato alinhado com a planilha */}
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
                    Nº do contrato *
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
                    Nº processo mãe (E-Docs) *
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
                    Nº processo pagto (2026)
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
                    Nome curto / Empresa *
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
                    Setor solicitante
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
                  Objeto resumido *
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
                    Total empenhado (R$)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.valorGlobal}
                    onChange={(e) => {
                      const novoEmp = Number(e.target.value);
                      setForm((prev) =>
                        recalcularTotaisContrato(prev, mesesForm, novoEmp)
                      );
                    }}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Total gasto no ano (R$) · Auto
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
                    Saldo empenho (R$) · Auto
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
                    <option value="NP">NP · Não prorrogável (nova contratação)</option>
                  </select>
                </div>
              </div>

              {/* Grade de lançamento mensal Jan-Dez dentro do modal de edição */}
              <div className="rounded-2xl border border-blue-200/80 bg-blue-50/30 p-4 dark:border-blue-500/20 dark:bg-blue-950/15">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      <BarChart3 className="h-4 w-4 text-blue-600" />
                      Execução financeira mensal 2026 (Jan – Dez)
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Ao preencher o valor de qualquer mês, o total gasto, saldo de empenho, média/mês ({formatarMoeda(form.mediaMensal || 0)}) e Reforço ({form.reforcoEmpenho || '—'}) são recalculados automaticamente.
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                  {mesesForm.map((item, idx) => (
                    <div
                      key={item.mes}
                      className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="mb-1.5 text-center text-[11px] font-extrabold uppercase text-blue-700 dark:text-blue-400">
                        {item.mes}/2026
                      </div>
                      <div className="space-y-1.5">
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500">
                            Valor (R$)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.valor || ''}
                            placeholder="0,00"
                            onChange={(e) =>
                              atualizarMesNoForm(
                                idx,
                                'valor',
                                e.target.value === '' ? 0 : Number(e.target.value)
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500">
                            Nº NF / RPA
                          </label>
                          <input
                            type="text"
                            value={item.nf || ''}
                            placeholder="Ex: 4373"
                            onChange={(e) =>
                              atualizarMesNoForm(idx, 'nf', e.target.value)
                            }
                            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 font-mono text-[11px] text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-semibold text-slate-500">
                            Medição / Obs.
                          </label>
                          <input
                            type="text"
                            value={item.medicao || ''}
                            placeholder="Ex: med05"
                            onChange={(e) =>
                              atualizarMesNoForm(idx, 'medicao', e.target.value)
                            }
                            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-1 text-[11px] text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Início da vigência
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
                    Fim da vigência
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
                    Regra data pagto
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
                    Gestor suplente (GS)
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
                    Fiscal titular (F)
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
                    Fiscal suplente (F1)
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
                Salvar contrato
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal rápido de lançamento de execução mensal (jan–dez + NF/RPA + medição) */}
      {modalMesContrato && (() => {
        const preview = recalcularTotaisContrato(modalMesContrato, mesesRapidos);
        const mesAtual = mesesRapidos[mesFocoIdx] || {
          mes: MESES_PADRAO[mesFocoIdx] || 'Jan',
          valor: 0,
          nf: '',
          medicao: '',
        };

        const atualizarMesRapido = (
          idx: number,
          campo: keyof ExecucaoMensalItem,
          valor: string | number
        ) => {
          setMesesRapidos((prev) =>
            prev.map((item, i) =>
              i === idx ? { ...item, [campo]: valor } : item
            )
          );
        };

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    Lançamento de execução financeira mensal (2026)
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Contrato <strong>{modalMesContrato.numeroContrato}</strong> ·{' '}
                    {modalMesContrato.empresaContratada} (Aba:{' '}
                    {modalMesContrato.abaPlanilha || '—'})
                  </p>
                </div>
                <button
                  onClick={() => setModalMesContrato(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form
                id="form-execucao-mensal"
                onSubmit={salvarLancamentoMensalRapido}
                className="flex-1 space-y-5 overflow-y-auto p-6"
              >
                {/* Resumo orçamentário recalculado em tempo real */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                    <div className="text-[10px] font-bold uppercase text-slate-500">
                      Total empenhado
                    </div>
                    <div className="mt-1 text-sm font-extrabold text-slate-900 dark:text-white">
                      {formatarMoeda(preview.valorGlobal)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-500/30 dark:bg-blue-950/25">
                    <div className="text-[10px] font-bold uppercase text-blue-700 dark:text-blue-300">
                      Gasto 2026 (soma jan–dez)
                    </div>
                    <div className="mt-1 text-sm font-extrabold text-blue-900 dark:text-blue-200">
                      {formatarMoeda(preview.totalGasto || 0)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3 dark:border-emerald-500/30 dark:bg-emerald-950/25">
                    <div className="text-[10px] font-bold uppercase text-emerald-700 dark:text-emerald-300">
                      Saldo de empenho atualizado
                    </div>
                    <div className="mt-1 text-sm font-extrabold text-emerald-800 dark:text-emerald-300">
                      {formatarMoeda(preview.saldoDisponivel)}
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950">
                    <div className="text-[10px] font-bold uppercase text-slate-500">
                      Média/Mês · Projeção
                    </div>
                    <div className="mt-1 text-xs font-extrabold text-slate-900 dark:text-white">
                      {formatarMoeda(preview.mediaMensal || 0)}
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Reforço: {preview.reforcoEmpenho || '—'}
                    </div>
                  </div>
                </div>

                {/* Destaque para o mês selecionado */}
                <div className="rounded-2xl border-2 border-blue-500/40 bg-blue-50/40 p-4 dark:border-blue-500/40 dark:bg-blue-950/20">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider text-blue-800 dark:text-blue-300">
                      Mês em edição rápida: {mesAtual.mes}/2026
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {MESES_PADRAO.map((m, idx) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMesFocoIdx(idx)}
                          className={`rounded-lg px-2 py-1 text-[10px] font-extrabold uppercase transition ${
                            mesFocoIdx === idx
                              ? 'bg-blue-600 text-white shadow-sm'
                              : (mesesRapidos[idx]?.valor || 0) > 0
                              ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-200'
                              : 'bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-200">
                        Valor pago / liquidado em {mesAtual.mes}/26 (R$)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        autoFocus
                        value={mesAtual.valor || ''}
                        placeholder="0,00"
                        onChange={(e) =>
                          atualizarMesRapido(
                            mesFocoIdx,
                            'valor',
                            e.target.value === '' ? 0 : Number(e.target.value)
                          )
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-200">
                        Nº da nota fiscal / RPA ({mesAtual.mes}/26)
                      </label>
                      <input
                        type="text"
                        value={mesAtual.nf || ''}
                        placeholder="Ex: 4373"
                        onChange={(e) =>
                          atualizarMesRapido(mesFocoIdx, 'nf', e.target.value)
                        }
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-bold text-slate-700 dark:text-slate-200">
                        Medição / Observação ({mesAtual.mes}/26)
                      </label>
                      <input
                        type="text"
                        value={mesAtual.medicao || ''}
                        placeholder="Ex: med05"
                        onChange={(e) =>
                          atualizarMesRapido(
                            mesFocoIdx,
                            'medicao',
                            e.target.value
                          )
                        }
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>

                {/* Visão anual completa (jan a dez) para edição em lote */}
                <div>
                  <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Todos os meses do exercício 2026 (jan – dez)
                  </div>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                    {mesesRapidos.map((item, idx) => (
                      <div
                        key={item.mes}
                        onClick={() => setMesFocoIdx(idx)}
                        className={`cursor-pointer rounded-xl border p-2.5 transition ${
                          mesFocoIdx === idx
                            ? 'border-blue-600 bg-blue-50/50 ring-2 ring-blue-500/20 dark:border-blue-400 dark:bg-blue-950/30'
                            : item.valor > 0
                            ? 'border-blue-200 bg-white dark:border-slate-700 dark:bg-slate-900'
                            : 'border-slate-200 bg-slate-50/70 dark:border-slate-800 dark:bg-slate-950/50'
                        }`}
                      >
                        <div className="mb-1.5 flex items-center justify-between">
                          <span className="text-[11px] font-extrabold uppercase text-slate-700 dark:text-slate-300">
                            {item.mes}/26
                          </span>
                          {item.valor > 0 && (
                            <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          )}
                        </div>
                        <div className="space-y-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={item.valor || ''}
                            placeholder="R$ 0,00"
                            onChange={(e) =>
                              atualizarMesRapido(
                                idx,
                                'valor',
                                e.target.value === '' ? 0 : Number(e.target.value)
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          />
                          <input
                            type="text"
                            value={item.nf || ''}
                            placeholder="Nº NF / RPA"
                            onChange={(e) =>
                              atualizarMesRapido(idx, 'nf', e.target.value)
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 font-mono text-[10px] text-slate-700 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300"
                          />
                          <input
                            type="text"
                            value={item.medicao || ''}
                            placeholder="Medição/Obs"
                            onChange={(e) =>
                              atualizarMesRapido(idx, 'medicao', e.target.value)
                            }
                            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-[10px] text-slate-600 focus:border-blue-600 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </form>

              <div className="flex justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-900">
                <button
                  type="button"
                  onClick={() => setModalMesContrato(null)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="form-execucao-mensal"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500"
                >
                  <Save className="h-4 w-4" />
                  Salvar lançamentos mensais
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
