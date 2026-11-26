import React, { useState, useEffect, useMemo } from 'react';
import {
  Tv,
  Pause,
  Play,
  SkipForward,
  Wifi,
  WifiOff,
  ShieldCheck,
  Clock,
  AlertOctagon,
  AlertTriangle,
  CheckCircle2,
  FileSignature,
  LogOut,
  Eye,
  EyeOff,
  Landmark,
  Wallet,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Treemap,
} from 'recharts';
import {
  ConfiguracaoTV,
  ContratoSLC,
  DadosContinuidade2025,
  ExecucaoMensalItem,
  ProcessoSLC,
} from '../types/slc';
import {
  calcularDiasAtePrazo,
} from '../services/slcService';

interface ModoTvViewProps {
  processos: ProcessoSLC[];
  contratos: ContratoSLC[];
  configTv: ConfiguracaoTV;
  temaEscuro?: boolean;
  onAlternarTema?: () => void;
  onSincronizarDados?: () => Promise<boolean>;
  onAtualizarConfigTv: (nova: ConfiguracaoTV) => void;
  onSairModoTv: () => void;
}

const TELAS_TV = [
  {
    indice: 0,
    titulo: 'Visão geral dos contratos vigentes',
    nomeCurto: 'Visão geral e gráficos',
    subtitulo: 'Indicadores consolidados de vigência, empenho, execução e setores da SLC',
  },
  {
    indice: 1,
    titulo: 'Painel geral de contratos vigentes',
    nomeCurto: 'Painel geral (tabela)',
    subtitulo: 'Todos os contratos vigentes ordenados por data de término e paginados automaticamente',
  },
  {
    indice: 2,
    titulo: 'Alertas de vencimento, prorrogações e novas contratações',
    nomeCurto: 'Alertas de vencimento',
    subtitulo: 'Monitoramento dos contratos em janela crítica (≤90d e ≤180d) e necessidade de licitação',
  },
  {
    indice: 3,
    titulo: 'Quadro de fichas dos contratos',
    nomeCurto: 'Mural de fichas',
    subtitulo: 'Visualização em fichas digitais no padrão do quadro físico da Subgerência',
  },
];

function extrairSiglaModalidade(modalidade?: string): string {
  const m = (modalidade || '').trim().toUpperCase();
  if (!m) return '—';
  if (m.length <= 3) return m;
  if (m.includes('INEXIG')) return 'I';
  if (m.includes('DISPENSA')) return 'D';
  if (m.includes('REGISTRO') || m.includes('ATA')) return 'RP';
  if (m.includes('PREG')) return 'P';
  if (m.includes('CONCORR')) return 'CO';
  if (m.includes('ADES')) return 'AD';
  return m.slice(0, 3);
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

function formatarMoedaCompacta(valor: number): string {
  const v = valor || 0;
  if (v >= 1_000_000) {
    return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}M`;
  }
  if (v >= 1_000) {
    return `R$ ${(v / 1_000).toLocaleString('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    })}k`;
  }
  return formatarMoeda(v);
}

const MESES_ORDEM = [
  'JAN',
  'FEV',
  'MAR',
  'ABR',
  'MAI',
  'JUN',
  'JUL',
  'AGO',
  'SET',
  'OUT',
  'NOV',
  'DEZ',
];

const TREEMAP_PALETA = [
  { bg: '#0e2a47', stroke: '#38bdf8', accent: '#38bdf8' }, // Cyan
  { bg: '#22184a', stroke: '#a855f7', accent: '#c084fc' }, // Violet
  { bg: '#3b1536', stroke: '#ec4899', accent: '#f472b6' }, // Magenta
  { bg: '#13284d', stroke: '#6366f1', accent: '#818cf8' }, // Indigo
  { bg: '#0c302c', stroke: '#10b981', accent: '#34d399' }, // Emerald
  { bg: '#362312', stroke: '#f59e0b', accent: '#fbbf24' }, // Amber
  { bg: '#152742', stroke: '#06b6d4', accent: '#22d3ee' }, // Teal/Cyan
  { bg: '#381525', stroke: '#f43f5e', accent: '#fb7185' }, // Rose
];

const TREEMAP_PALETA_CLARO = [
  { bg: '#e0f2fe', stroke: '#0284c7', accent: '#0369a1' }, // Sky
  { bg: '#f3e8ff', stroke: '#9333ea', accent: '#7e22ce' }, // Purple
  { bg: '#fce7f3', stroke: '#db2777', accent: '#be185d' }, // Pink
  { bg: '#e0e7ff', stroke: '#4f46e5', accent: '#4338ca' }, // Indigo
  { bg: '#d1fae5', stroke: '#059669', accent: '#047857' }, // Emerald
  { bg: '#fef3c7', stroke: '#d97706', accent: '#b45309' }, // Amber
  { bg: '#cffafe', stroke: '#0891b2', accent: '#0e7490' }, // Cyan
  { bg: '#ffe4e6', stroke: '#e11d48', accent: '#be123c' }, // Rose
];

interface TreemapNodeProps {
  depth?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  name?: string;
  qtd?: number;
  empenho?: number;
  pct?: number;
  temaEscuro?: boolean;
}

const TreemapSetorNode: React.FC<TreemapNodeProps> = ({
  depth = 1,
  x = 0,
  y = 0,
  width = 0,
  height = 0,
  index = 0,
  name = '',
  qtd = 0,
  empenho = 0,
  pct = 0,
  temaEscuro = true,
}) => {
  if (depth === 0 || !name || width < 22 || height < 22) return null;
  const paleta = temaEscuro ? TREEMAP_PALETA : TREEMAP_PALETA_CLARO;
  const cor = paleta[index % paleta.length];
  const corTitulo = temaEscuro ? '#ffffff' : '#0f172a';
  const corValor = temaEscuro ? '#f1f5f9' : '#1e293b';
  const corSecundaria = temaEscuro ? '#94a3b8' : '#475569';
  const pad = 3;
  const rx = Math.max(0, x + pad);
  const ry = Math.max(0, y + pad);
  const rw = Math.max(0, width - pad * 2);
  const rh = Math.max(0, height - pad * 2);
  const cx = rx + rw / 2;
  const cy = ry + rh / 2;
  const extraGrande = rw >= 210 && rh >= 170;
  const grande = rw >= 145 && rh >= 115;
  const medio = rw >= 90 && rh >= 64;
  const estreitoAlto = rw >= 48 && rh >= 75;
  const barraW = Math.max(0, Math.min(56, rw - 16));

  return (
    <g>
      <rect
        x={rx}
        y={ry}
        width={rw}
        height={rh}
        rx={4}
        ry={4}
        fill={cor.bg}
        stroke={cor.stroke}
        strokeOpacity={0.6}
        strokeWidth={1.4}
      />
      {/* Faixa neon superior centralizada */}
      <rect
        x={cx - barraW / 2}
        y={ry + 1.5}
        width={barraW}
        height={2.5}
        rx={1}
        fill={cor.accent}
      />
      {grande ? (
        <>
          <text
            x={cx}
            y={cy - (extraGrande ? 26 : 20)}
            textAnchor="middle"
            fill={corTitulo}
            fontSize={extraGrande ? 34 : 26}
            fontWeight={900}
            letterSpacing="0.04em"
          >
            {name}
          </text>
          <text
            x={cx}
            y={cy + (extraGrande ? 10 : 8)}
            textAnchor="middle"
            fill={corValor}
            fontSize={extraGrande ? 25 : 20}
            fontWeight={800}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            {qtd} {qtd === 1 ? 'contrato' : 'contratos'}
          </text>
          <text
            x={cx}
            y={cy + (extraGrande ? 38 : 31)}
            textAnchor="middle"
            fill={cor.accent}
            fontSize={extraGrande ? 19 : 16}
            fontWeight={800}
          >
            ({pct.toFixed(1).replace('.', ',')}%)
          </text>
        </>
      ) : medio ? (
        <>
          <text
            x={cx}
            y={cy - 15}
            textAnchor="middle"
            fill={corTitulo}
            fontSize={20}
            fontWeight={900}
            letterSpacing="0.03em"
          >
            {name}
          </text>
          <text
            x={cx}
            y={cy + 8}
            textAnchor="middle"
            fill={corValor}
            fontSize={17}
            fontWeight={800}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            {qtd} contr.
          </text>
          <text
            x={cx}
            y={cy + 27}
            textAnchor="middle"
            fill={cor.accent}
            fontSize={14}
            fontWeight={800}
          >
            ({pct.toFixed(1).replace('.', ',')}%)
          </text>
        </>
      ) : estreitoAlto ? (
        <>
          <text
            x={cx}
            y={cy - 12}
            textAnchor="middle"
            fill={corTitulo}
            fontSize={15}
            fontWeight={900}
          >
            {name}
          </text>
          <text
            x={cx}
            y={cy + 8}
            textAnchor="middle"
            fill={cor.accent}
            fontSize={13}
            fontWeight={800}
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
          >
            {qtd} contr.
          </text>
          <text
            x={cx}
            y={cy + 24}
            textAnchor="middle"
            fill={corSecundaria}
            fontSize={11}
            fontWeight={700}
          >
            ({pct.toFixed(1).replace('.', ',')}%)
          </text>
        </>
      ) : (
        <text
          x={cx}
          y={cy + 4}
          textAnchor="middle"
          fill={corTitulo}
          fontSize={13}
          fontWeight={800}
        >
          {name} ({qtd})
        </text>
      )}
    </g>
  );
};

interface MiniAnelCircularProps {
  label: string;
  valor: number;
  total: number;
  cor: string;
  temaEscuro?: boolean;
}

const MiniAnelCircular: React.FC<MiniAnelCircularProps> = ({
  label,
  valor,
  total,
  cor,
  temaEscuro = true,
}) => {
  const pct = total > 0 ? Math.min(100, Math.round((valor / total) * 100)) : 0;
  const raio = 23;
  const circ = 2 * Math.PI * raio;
  const offset = circ - (pct / 100) * circ;

  return (
    <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-slate-50 px-2 py-2.5 dark:border-slate-800/80 dark:bg-[#0b1124]/80">
      <div className="relative h-14 w-14">
        <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
          <circle
            cx="28"
            cy="28"
            r={raio}
            fill="none"
            stroke={temaEscuro ? '#1e293b' : '#e2e8f0'}
            strokeWidth="4.5"
          />
          <circle
            cx="28"
            cy="28"
            r={raio}
            fill="none"
            stroke={cor}
            strokeWidth="4.5"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-black text-slate-900 dark:text-white">{valor}</span>
        </div>
      </div>
      <span className="mt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
        {label}
      </span>
      <span className="text-[10px] font-semibold" style={{ color: cor }}>
        {pct}%
      </span>
    </div>
  );
};

interface LiquidFillGaugeProps {
  percentual: number;
  subtitulo: string;
  temaEscuro?: boolean;
}

const LiquidFillGauge: React.FC<LiquidFillGaugeProps> = ({
  percentual,
  subtitulo,
  temaEscuro = true,
}) => {
  const pct = Math.min(100, Math.max(0, percentual));
  // Interior do círculo vai de y=17 (100%) até y=163 (0%)
  const nivelY = 163 - (pct / 100) * 146;

  return (
    <div className="relative flex h-40 w-40 shrink-0 items-center justify-center">
      <svg viewBox="0 0 180 180" className="h-full w-full">
        <defs>
          <clipPath id="tvLiquidClip">
            <circle cx="90" cy="90" r="73" />
          </clipPath>
          <linearGradient id="tvLiquidFrontGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#84cc16" stopOpacity="0.92" />
            <stop offset="35%" stopColor="#2dd4bf" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0.98" />
          </linearGradient>
          <linearGradient id="tvLiquidBackGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.45" />
            <stop offset="100%" stopColor="#1e3a8a" stopOpacity="0.7" />
          </linearGradient>
        </defs>

        {/* Fundo interno */}
        <circle cx="90" cy="90" r="75" fill={temaEscuro ? '#121338' : '#e2e8f0'} />

        {/* Ondas líquidas animadas dentro do círculo */}
        <g clipPath="url(#tvLiquidClip)">
          {/* Onda traseira */}
          <g>
            <path
              d={`M -160 ${nivelY} Q -120 ${nivelY - 10}, -80 ${nivelY} T 0 ${nivelY} T 80 ${nivelY} T 160 ${nivelY} T 240 ${nivelY} T 320 ${nivelY} L 320 190 L -160 190 Z`}
              fill="url(#tvLiquidBackGrad)"
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                from="0 0"
                to="160 0"
                dur="9s"
                repeatCount="indefinite"
              />
            </path>
          </g>

          {/* Onda frontal com crista verde-lima */}
          <g>
            <path
              d={`M -160 ${nivelY + 2} Q -120 ${nivelY + 11}, -80 ${nivelY + 2} T 0 ${nivelY + 2} T 80 ${nivelY + 2} T 160 ${nivelY + 2} T 240 ${nivelY + 2} T 320 ${nivelY + 2} L 320 190 L -160 190 Z`}
              fill="url(#tvLiquidFrontGrad)"
              stroke="#a3e635"
              strokeWidth="2.2"
            >
              <animateTransform
                attributeName="transform"
                type="translate"
                from="0 0"
                to="-160 0"
                dur="6.5s"
                repeatCount="indefinite"
              />
            </path>
          </g>
        </g>

        {/* Anel interno sutil */}
        <circle
          cx="90"
          cy="90"
          r="75"
          fill="none"
          stroke="#a855f7"
          strokeOpacity="0.4"
          strokeWidth="1.2"
        />

        {/* Anel externo roxo neon */}
        <circle
          cx="90"
          cy="90"
          r="82"
          fill="none"
          stroke="#9333ea"
          strokeWidth="6"
        />
      </svg>

      {/* Percentual central em alto contraste */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[26px] font-black tracking-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.65)]">
          {pct.toFixed(1).replace('.', ',')}%
        </span>
        <span className="mt-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-200/90 drop-shadow">
          {subtitulo}
        </span>
      </div>
    </div>
  );
};

export const ModoTvView: React.FC<ModoTvViewProps> = ({
  processos,
  contratos,
  configTv,
  temaEscuro = true,
  onAlternarTema,
  onSincronizarDados,
  onAtualizarConfigTv,
  onSairModoTv,
}) => {
  const [telaAtual, setTelaAtual] = useState<number>(0);
  const [paginaContratos, setPaginaContratos] = useState<number>(0);
  const [paginaFichas, setPaginaFichas] = useState<number>(0);
  const [menuTelasAberto, setMenuTelasAberto] = useState<boolean>(false);
  const menuTelasRef = React.useRef<HTMLDivElement | null>(null);
  const [pausado, setPausado] = useState<boolean>(false);
  const [segundosDecorridos, setSegundosDecorridos] = useState<number>(0);
  const [ultimaSincronizacao, setUltimaSincronizacao] = useState<Date>(new Date());
  const [falhaConexaoReal, setFalhaConexaoReal] = useState<boolean>(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );

  const executarSincronizacao = React.useCallback(async () => {
    if (!onSincronizarDados) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setFalhaConexaoReal(true);
      return;
    }
    try {
      const ok = await onSincronizarDados();
      if (ok) {
        setFalhaConexaoReal(false);
        setUltimaSincronizacao(new Date());
      } else {
        setFalhaConexaoReal(true);
      }
    } catch {
      setFalhaConexaoReal(true);
    }
  }, [onSincronizarDados]);

  // Sincronização real com a API/MySQL ao abrir o Modo TV, a cada 30s e detecção automática de rede (RNF-07)
  useEffect(() => {
    executarSincronizacao();
    const timer = window.setInterval(() => {
      executarSincronizacao();
    }, 30_000);

    const onOffline = () => setFalhaConexaoReal(true);
    const onOnline = () => executarSincronizacao();
    window.addEventListener('offline', onOffline);
    window.addEventListener('online', onOnline);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('online', onOnline);
    };
  }, [executarSincronizacao]);

  const barraProgressoRef = React.useRef<HTMLDivElement | null>(null);
  const acumuladoMsRef = React.useRef<number>(0);

  const resetarProgressoBarra = React.useCallback(() => {
    acumuladoMsRef.current = 0;
    setSegundosDecorridos(0);
    if (barraProgressoRef.current) {
      barraProgressoRef.current.style.transform = 'scaleX(0)';
    }
  }, []);

  const qtdRestritosOcultos = processos.filter((p) => p.restritoTv).length;

  // Ordena todos os contratos pela data de término (exatamente como a aba "vigentes")
  const contratosOrdenados = useMemo(
    () => [...contratos].sort((a, b) => a.fimVigencia.localeCompare(b.fimVigencia)),
    [contratos]
  );

  const ITENS_POR_PAGINA_TV = 11;
  const totalPaginasContratos = Math.max(
    1,
    Math.ceil(contratosOrdenados.length / ITENS_POR_PAGINA_TV)
  );

  const contratosPaginaAtual = useMemo(() => {
    const inicio = paginaContratos * ITENS_POR_PAGINA_TV;
    return contratosOrdenados.slice(inicio, inicio + ITENS_POR_PAGINA_TV);
  }, [contratosOrdenados, paginaContratos]);

  // Paginação da Tela 4 (mural de fichas — 12 fichas por página em grid 4x3)
  const FICHAS_POR_PAGINA_TV = 12;
  const totalPaginasFichas = Math.max(
    1,
    Math.ceil(contratosOrdenados.length / FICHAS_POR_PAGINA_TV)
  );

  const fichasPaginaAtual = useMemo(() => {
    const inicio = paginaFichas * FICHAS_POR_PAGINA_TV;
    return contratosOrdenados.slice(inicio, inicio + FICHAS_POR_PAGINA_TV);
  }, [contratosOrdenados, paginaFichas]);

  // Totais financeiros e de vigência
  const totalEmpenhado = useMemo(
    () => contratos.reduce((acc, c) => acc + (c.valorGlobal || 0), 0),
    [contratos]
  );
  const totalGasto = useMemo(
    () => contratos.reduce((acc, c) => acc + (c.totalGasto || 0), 0),
    [contratos]
  );
  const saldoTotal = useMemo(
    () => contratos.reduce((acc, c) => acc + (c.saldoDisponivel || 0), 0),
    [contratos]
  );

  const criticosAte45d = useMemo(
    () =>
      contratosOrdenados.filter((c) => {
        const d = calcularDiasAtePrazo(c.fimVigencia);
        return d !== null && d <= 45;
      }),
    [contratosOrdenados]
  );

  const janela46a90d = useMemo(
    () =>
      contratosOrdenados.filter((c) => {
        const d = calcularDiasAtePrazo(c.fimVigencia);
        return d !== null && d > 45 && d <= 90;
      }),
    [contratosOrdenados]
  );

  const janela91a180d = useMemo(
    () =>
      contratosOrdenados.filter((c) => {
        const d = calcularDiasAtePrazo(c.fimVigencia);
        return d !== null && d > 90 && d <= 180;
      }),
    [contratosOrdenados]
  );

  const distribuicaoSetores = useMemo(() => {
    const mapa = new Map<string, { qtd: number; empenho: number }>();
    contratos.forEach((c) => {
      const sigla = (c.setorDemandante || 'SLC').split(' — ')[0];
      const atual = mapa.get(sigla) || { qtd: 0, empenho: 0 };
      mapa.set(sigla, {
        qtd: atual.qtd + 1,
        empenho: atual.empenho + (c.valorGlobal || 0),
      });
    });
    return Array.from(mapa.entries())
      .map(([setor, info]) => ({ setor, ...info }))
      .sort((a, b) => b.qtd - a.qtd || b.empenho - a.empenho)
      .slice(0, 8);
  }, [contratos]);

  // Dados para o gráfico treemap por setor solicitante (tamanho proporcional à quantidade de contratos)
  const dadosTreemapSetores = useMemo(() => {
    const totalContratosBase = Math.max(1, contratos.length);
    const pisoVisual = Math.max(1, totalContratosBase * 0.032);
    return distribuicaoSetores.map((item) => ({
      name: item.setor,
      size: Math.max(item.qtd, pisoVisual),
      qtd: item.qtd,
      empenho: item.empenho,
      pct: (item.qtd / totalContratosBase) * 100,
    }));
  }, [distribuicaoSetores, contratos.length]);

  // Curva comparativa de execução financeira mensal (2026 vs 2025)
  const execucaoMensalComparativa = useMemo(() => {
    const mapa26 = new Map<string, number>();
    const mapa25 = new Map<string, number>();
    MESES_ORDEM.forEach((m) => {
      mapa26.set(m, 0);
      mapa25.set(m, 0);
    });

    contratos.forEach((c) => {
      if (c.execucaoMensalJson) {
        try {
          const itens = JSON.parse(c.execucaoMensalJson) as ExecucaoMensalItem[];
          if (Array.isArray(itens)) {
            itens.forEach((it) => {
              const sigla = (it.mes || '').slice(0, 3).toUpperCase();
              if (mapa26.has(sigla)) {
                mapa26.set(sigla, (mapa26.get(sigla) || 0) + (Number(it.valor) || 0));
              }
            });
          }
        } catch {
          // Ignora JSON inválido
        }
      }
      if (c.dados2025Json) {
        try {
          const d25 = JSON.parse(c.dados2025Json) as DadosContinuidade2025;
          if (d25?.possuiHistorico2025 && Array.isArray(d25.execucaoMensal2025)) {
            d25.execucaoMensal2025.forEach((it) => {
              const sigla = (it.mes || '').slice(0, 3).toUpperCase();
              if (mapa25.has(sigla)) {
                mapa25.set(sigla, (mapa25.get(sigla) || 0) + (Number(it.valor) || 0));
              }
            });
          }
        } catch {
          // Ignora JSON inválido
        }
      }
    });

    return MESES_ORDEM.map((mes) => ({
      mes,
      atual2026: Math.round((mapa26.get(mes) || 0) * 100) / 100,
      historico2025: Math.round((mapa25.get(mes) || 0) * 100) / 100,
    }));
  }, [contratos]);

  // Top 5 servidores com mais contratos (separando atuações como Gestor em verde e Fiscal em azul)
  const top5ServidoresContratos = useMemo(() => {
    const mapa = new Map<string, { nome: string; gestor: number; fiscal: number }>();

    const normalizarNome = (raw?: string): string | null => {
      const limpo = (raw || '').trim().replace(/\s+/g, ' ');
      if (!limpo || limpo.length < 3) return null;
      if (/^(não designado|nao designado|sem gestor|sem fiscal|—|-|\.|0|n\/a)$/i.test(limpo)) {
        return null;
      }
      return limpo;
    };

    contratos.forEach((c) => {
      const g = normalizarNome(c.gestorContrato);
      if (g) {
        const chave = g.toUpperCase();
        const atual = mapa.get(chave) || { nome: g, gestor: 0, fiscal: 0 };
        atual.gestor += 1;
        mapa.set(chave, atual);
      }

      const f = normalizarNome(c.fiscalTitular);
      if (f) {
        const chave = f.toUpperCase();
        const atual = mapa.get(chave) || { nome: f, gestor: 0, fiscal: 0 };
        atual.fiscal += 1;
        mapa.set(chave, atual);
      }
    });

    const lista = Array.from(mapa.values())
      .map((item) => {
        const total = item.gestor + item.fiscal;
        const pctGestor = total > 0 ? Math.round((item.gestor / total) * 100) : 0;
        const pctFiscal = Math.max(0, 100 - pctGestor);
        return { ...item, total, pctGestor, pctFiscal };
      })
      .sort((a, b) => b.total - a.total || b.gestor - a.gestor);

    return {
      top5: lista.slice(0, 5),
      totalServidores: lista.length,
      maxTotal: Math.max(1, lista[0]?.total || 1),
    };
  }, [contratos]);

  // Totais por fonte orçamentária (RPPS vs FPS) e métricas da carteira
  const metricasCarteira = useMemo(() => {
    const totalContratos = Math.max(1, contratos.length);
    const qtdProrrogaveis = contratos.filter((c) => c.prorrogavel).length;
    const qtdNovaContratacao = contratos.length - qtdProrrogaveis;
    const qtdAcima180d = Math.max(
      0,
      contratos.length -
        criticosAte45d.length -
        janela46a90d.length -
        janela91a180d.length
    );
    const totalRpps = contratos.reduce((acc, c) => acc + (c.valorRpps || 0), 0);
    const totalFps = contratos.reduce((acc, c) => acc + (c.valorFps || 0), 0);
    const somaFontes = Math.max(1, totalRpps + totalFps);
    const pctExecutado = totalEmpenhado > 0 ? (totalGasto / totalEmpenhado) * 100 : 0;
    const pctSaldo = Math.max(0, 100 - pctExecutado);

    return {
      totalContratos,
      qtdProrrogaveis,
      qtdNovaContratacao,
      pctProrrogaveis: Math.round((qtdProrrogaveis / totalContratos) * 100),
      pctAcima180d: Math.round((qtdAcima180d / totalContratos) * 100),
      qtdAcima180d,
      pctExecutado,
      pctSaldo,
      totalRpps,
      totalFps,
      pctRpps: Math.round((totalRpps / somaFontes) * 100),
      pctFps: Math.max(0, 100 - Math.round((totalRpps / somaFontes) * 100)),
    };
  }, [
    contratos,
    criticosAte45d.length,
    janela46a90d.length,
    janela91a180d.length,
    totalEmpenhado,
    totalGasto,
  ]);

  // Indicadores consolidados de processos para o bloco "Visão geral do setor" na Tela 1
  const resumoProcessosSetor = useMemo(() => {
    const publicos = processos.filter((p) => !p.restritoTv);
    const ativos = publicos.filter((p) => p.situacao !== 'Concluído').length;
    const pendentes = publicos.filter(
      (p) =>
        p.situacao === 'Aguardando documentação' ||
        p.situacao === 'Aguardando aprovação' ||
        p.situacao === 'Em andamento externo'
    ).length;
    const criticos = publicos.filter((p) => {
      if (p.situacao === 'Concluído') return false;
      const dias = calcularDiasAtePrazo(p.prazo);
      return (
        p.prioridade === 'Crítica' ||
        p.prioridade === 'Alta' ||
        (dias !== null && dias <= 45)
      );
    }).length;
    const concluidos = publicos.filter((p) => p.situacao === 'Concluído').length;

    const somaBarra = Math.max(1, ativos + pendentes + concluidos);
    const pctAtivos = Math.round((ativos / somaBarra) * 100);
    const pctPendentes = Math.round((pendentes / somaBarra) * 100);
    const pctConcluidos = Math.max(0, 100 - pctAtivos - pctPendentes);

    return {
      ativos,
      pendentes,
      criticos,
      concluidos,
      pctAtivos,
      pctPendentes,
      pctConcluidos,
    };
  }, [processos]);

  // Telas visíveis no ciclo da TV (garantindo sempre ao menos 1 tela ativa)
  const telasOcultas = useMemo(
    () => configTv.telasOcultas ?? [],
    [configTv.telasOcultas]
  );

  const telasVisiveis = useMemo(() => {
    const filtradas = TELAS_TV.filter((t) => !telasOcultas.includes(t.indice));
    return filtradas.length > 0 ? filtradas : [TELAS_TV[0]];
  }, [telasOcultas]);

  // Se a tela ativa atual for ocultada, salta automaticamente para a primeira tela visível
  useEffect(() => {
    if (!telasVisiveis.some((t) => t.indice === telaAtual)) {
      setTelaAtual(telasVisiveis[0].indice);
      setPaginaContratos(0);
      setPaginaFichas(0);
      resetarProgressoBarra();
    }
  }, [telasVisiveis, telaAtual, resetarProgressoBarra]);

  // Fecha o menu suspenso de telas ao clicar fora
  useEffect(() => {
    if (!menuTelasAberto) return;
    const onMouseDown = (e: MouseEvent) => {
      if (menuTelasRef.current && !menuTelasRef.current.contains(e.target as Node)) {
        setMenuTelasAberto(false);
      }
    };
    window.addEventListener('mousedown', onMouseDown);
    return () => window.removeEventListener('mousedown', onMouseDown);
  }, [menuTelasAberto]);

  const alternarVisibilidadeTela = (indice: number) => {
    const jaOculta = telasOcultas.includes(indice);
    if (!jaOculta && telasVisiveis.length <= 1) {
      return; // Trava de segurança: mantém pelo menos 1 tela ativa
    }
    const proximasOcultas = jaOculta
      ? telasOcultas.filter((i) => i !== indice)
      : [...telasOcultas, indice];
    onAtualizarConfigTv({
      ...configTv,
      telasOcultas: proximasOcultas,
    });
  };

  // Função pura para avançar o ciclo (percorre todas as páginas na Tela 2 e na Tela 4 e somente as telas visíveis)
  const avancarCicloTv = React.useCallback(() => {
    if (telaAtual === 1 && paginaContratos + 1 < totalPaginasContratos) {
      setPaginaContratos(paginaContratos + 1);
    } else if (telaAtual === 3 && paginaFichas + 1 < totalPaginasFichas) {
      setPaginaFichas(paginaFichas + 1);
    } else {
      setPaginaContratos(0);
      setPaginaFichas(0);
      const posAtual = telasVisiveis.findIndex((t) => t.indice === telaAtual);
      const proximaPos = posAtual >= 0 ? (posAtual + 1) % telasVisiveis.length : 0;
      setTelaAtual(telasVisiveis[proximaPos].indice);
    }
  }, [
    telaAtual,
    paginaContratos,
    totalPaginasContratos,
    paginaFichas,
    totalPaginasFichas,
    telasVisiveis,
  ]);

  // Tecla ESC para sair do modo TV e setas para navegar
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSairModoTv();
      if (e.key === 'ArrowRight') {
        avancarCicloTv();
        resetarProgressoBarra();
      }
      if (e.key === ' ') {
        e.preventDefault();
        setPausado((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onSairModoTv, avancarCicloTv, resetarProgressoBarra]);

  const intervaloEfetivo = Math.max(5, configTv.intervaloSegundos || 20);
  const intervaloMs = intervaloEfetivo * 1000;

  // Animação fluida a 60/120fps direto na GPU via requestAnimationFrame (sem re-renderizar o React a cada frame)
  useEffect(() => {
    if (pausado) return;
    let frameId: number;
    let ultimoTimestamp = performance.now();

    const loop = (agora: number) => {
      const delta = agora - ultimoTimestamp;
      ultimoTimestamp = agora;
      acumuladoMsRef.current += delta;

      const proporcao = Math.min(1, acumuladoMsRef.current / intervaloMs);
      if (barraProgressoRef.current) {
        barraProgressoRef.current.style.transform = `scaleX(${proporcao})`;
      }

      const segAtual = Math.min(
        intervaloEfetivo,
        Math.floor(acumuladoMsRef.current / 1000)
      );
      setSegundosDecorridos((prev) => (prev !== segAtual ? segAtual : prev));

      if (acumuladoMsRef.current >= intervaloMs) {
        acumuladoMsRef.current = 0;
        setSegundosDecorridos(0);
        if (barraProgressoRef.current) {
          barraProgressoRef.current.style.transform = 'scaleX(0)';
        }
        avancarCicloTv();
      }

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, [pausado, intervaloMs, intervaloEfetivo, avancarCicloTv]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-between bg-slate-100 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Barra de progresso 60fps acelerada por GPU (scaleX) sem lag e sem delay ao pausar/retomar */}
      <div className="h-1.5 w-full overflow-hidden bg-slate-200 dark:bg-slate-900">
        <div
          ref={barraProgressoRef}
          className="h-full w-full origin-left bg-blue-600 dark:bg-blue-500 will-change-transform"
          style={{ transform: 'scaleX(0)' }}
        />
      </div>

      {/* Alerta automático de perda de conexão (RNF-07) */}
      {falhaConexaoReal && (
        <div className="flex items-center justify-between border-b border-amber-500/50 bg-amber-100 px-8 py-2.5 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200">
          <div className="flex items-center gap-3 text-sm font-semibold">
            <WifiOff className="h-5 w-5 animate-pulse text-amber-600 dark:text-amber-400" />
            <span>
              ATENÇÃO: Falha de comunicação com a API detectada. Exibindo última fotografia
              válida sincronizada em {ultimaSincronizacao.toLocaleDateString('pt-BR')} às{' '}
              {ultimaSincronizacao.toLocaleTimeString('pt-BR')}. Tentando reconexão automática...
            </span>
          </div>
          <button
            onClick={() => executarSincronizacao()}
            className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-bold text-slate-950 hover:bg-amber-400"
          >
            Tentar reconectar agora
          </button>
        </div>
      )}

      {/* Cabeçalho da TV */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white/95 px-8 py-4 shadow-sm dark:border-slate-800/90 dark:bg-slate-900/90 dark:shadow-none">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-500/40 dark:bg-blue-600/20 dark:text-blue-400">
            <Tv className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-400">
                PAINEL DE MONITORAMENTO DE CONTRATOS
              </span>
            </div>
            <h1 className="mt-0.5 text-xl font-extrabold tracking-tight text-slate-900 dark:text-white sm:text-2xl">
              {Math.max(1, telasVisiveis.findIndex((t) => t.indice === telaAtual) + 1)}/
              {telasVisiveis.length} · {TELAS_TV[telaAtual].titulo}
              {telaAtual === 1 && (
                <span className="ml-3 rounded-lg bg-blue-100 px-2.5 py-0.5 text-sm font-bold text-blue-700 dark:bg-blue-600/30 dark:text-blue-300">
                  Página {paginaContratos + 1} de {totalPaginasContratos} ({contratosOrdenados.length} contratos)
                </span>
              )}
              {telaAtual === 3 && (
                <span className="ml-3 rounded-lg bg-blue-100 px-2.5 py-0.5 text-sm font-bold text-blue-700 dark:bg-blue-600/30 dark:text-blue-300">
                  Página {paginaFichas + 1} de {totalPaginasFichas} ({contratosOrdenados.length} fichas)
                </span>
              )}
            </h1>
          </div>
        </div>

        {/* Seletor das telas ativas + controles para apresentação */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-800 dark:bg-slate-950">
            {telasVisiveis.map((t) => (
              <button
                key={t.indice}
                onClick={() => {
                  setTelaAtual(t.indice);
                  setPaginaContratos(0);
                  setPaginaFichas(0);
                  resetarProgressoBarra();
                }}
                className={`rounded-lg px-3.5 py-1.5 text-xs font-bold transition ${
                  telaAtual === t.indice
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Tela {t.indice + 1}
              </button>
            ))}
          </div>

          {telaAtual === 1 && (
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-900">
              <button
                onClick={() => {
                  setPaginaContratos((p) => (p - 1 + totalPaginasContratos) % totalPaginasContratos);
                  resetarProgressoBarra();
                }}
                className="rounded p-1 text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                title="Página anterior de contratos"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-1.5 font-mono text-xs font-bold text-blue-700 dark:text-blue-300">
                Pág. {paginaContratos + 1}/{totalPaginasContratos}
              </span>
              <button
                onClick={() => {
                  setPaginaContratos((p) => (p + 1) % totalPaginasContratos);
                  resetarProgressoBarra();
                }}
                className="rounded p-1 text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                title="Próxima página de contratos"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {telaAtual === 3 && (
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2 py-1 dark:border-slate-700 dark:bg-slate-900">
              <button
                onClick={() => {
                  setPaginaFichas((p) => (p - 1 + totalPaginasFichas) % totalPaginasFichas);
                  resetarProgressoBarra();
                }}
                className="rounded p-1 text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                title="Página anterior do mural de fichas"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-1.5 font-mono text-xs font-bold text-blue-700 dark:text-blue-300">
                Pág. {paginaFichas + 1}/{totalPaginasFichas}
              </span>
              <button
                onClick={() => {
                  setPaginaFichas((p) => (p + 1) % totalPaginasFichas);
                  resetarProgressoBarra();
                }}
                className="rounded p-1 text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
                title="Próxima página do mural de fichas"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          <button
            onClick={() => setPausado((p) => !p)}
            title="Pausar ou retomar (Espaço)"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {pausado ? (
              <>
                <Play className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /> Retomar
              </>
            ) : (
              <>
                <Pause className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Pausar ({Math.max(0, intervaloEfetivo - segundosDecorridos)}s)
              </>
            )}
          </button>

          <button
            onClick={() => {
              avancarCicloTv();
              resetarProgressoBarra();
            }}
            title="Avançar (seta direita)"
            className="rounded-xl border border-slate-200 bg-slate-100 p-2 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <SkipForward className="h-4 w-4" />
          </button>

          <select
            value={configTv.intervaloSegundos}
            onChange={(e) => {
              onAtualizarConfigTv({
                ...configTv,
                intervaloSegundos: Number(e.target.value),
              });
              resetarProgressoBarra();
            }}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            <option value={10}>Ciclo: 10s</option>
            <option value={15}>Ciclo: 15s</option>
            <option value={20}>Ciclo: 20s</option>
            <option value={30}>Ciclo: 30s</option>
          </select>

          {/* Menu suspenso para esconder / exibir telas no ciclo da TV */}
          <div className="relative" ref={menuTelasRef}>
            <button
              onClick={() => setMenuTelasAberto((v) => !v)}
              title="Escolher quais telas aparecem no ciclo da TV"
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                menuTelasAberto || telasOcultas.length > 0
                  ? 'border-blue-400 bg-blue-50 text-blue-700 dark:border-blue-500/50 dark:bg-blue-500/15 dark:text-blue-300'
                  : 'border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {telasOcultas.length > 0 ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
              Telas ({telasVisiveis.length}/{TELAS_TV.length})
            </button>

            {menuTelasAberto && (
              <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                <div className="mb-2 flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-800">
                  <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Telas no ciclo da TV
                  </span>
                  {telasOcultas.length > 0 && (
                    <button
                      onClick={() =>
                        onAtualizarConfigTv({
                          ...configTv,
                          telasOcultas: [],
                        })
                      }
                      className="text-[11px] font-bold text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Exibir todas
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {TELAS_TV.map((t) => {
                    const ativa = !telasOcultas.includes(t.indice);
                    const travada = ativa && telasVisiveis.length <= 1;
                    return (
                      <button
                        key={t.indice}
                        type="button"
                        disabled={travada}
                        onClick={() => alternarVisibilidadeTela(t.indice)}
                        className={`flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left transition ${
                          travada
                            ? 'cursor-not-allowed opacity-60'
                            : 'hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 dark:text-white">
                            Tela {t.indice + 1} · {t.nomeCurto}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400">
                            {ativa
                              ? travada
                                ? 'Mínimo de 1 tela ativa'
                                : 'Visível no ciclo'
                              : 'Oculta da TV'}
                          </div>
                        </div>

                        <span
                          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
                            ativa
                              ? 'bg-blue-600'
                              : 'bg-slate-300 dark:bg-slate-700'
                          }`}
                        >
                          <span
                            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition ${
                              ativa ? 'translate-x-4' : 'translate-x-1'
                            }`}
                          />
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {onAlternarTema && (
            <button
              onClick={onAlternarTema}
              title={temaEscuro ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              className="rounded-xl border border-slate-200 bg-slate-100 p-2 text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {temaEscuro ? (
                <Sun className="h-4 w-4 text-amber-400" />
              ) : (
                <Moon className="h-4 w-4 text-indigo-600" />
              )}
            </button>
          )}

          <button
            onClick={onSairModoTv}
            className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-200 dark:hover:bg-rose-500/25"
          >
            <LogOut className="h-4 w-4" /> Sair (Esc)
          </button>
        </div>
      </header>

      {/* Conteúdo principal em tela cheia 16:9 */}
      <main className="flex-1 overflow-y-auto px-8 py-5">
        {telaAtual === 0 && (
          /* ================= TELA 1: PAINEL ANALÍTICO MODERNO (GRÁFICOS & TREEMAP) ================= */
          <div className="flex h-full flex-col justify-between gap-4">
            {/* Faixa superior: 4 KPIs executivos com micro-indicadores neon */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <div className="rounded-2xl border border-cyan-200 bg-white px-5 py-4 shadow-sm dark:border-cyan-500/25 dark:bg-[#0d1326]/90 dark:shadow-[0_0_25px_rgba(34,211,238,0.06)]">
                <div className="flex items-center justify-between text-cyan-700 dark:text-cyan-300/90">
                  <span className="text-[11px] font-bold uppercase tracking-widest">
                    Contratos (2026)
                  </span>
                  <FileSignature className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">
                    {contratos.length}
                  </span>
                  <span className="text-xs font-bold text-cyan-700 dark:text-cyan-300">
                    {metricasCarteira.qtdProrrogaveis} P · {metricasCarteira.qtdNovaContratacao} NP
                  </span>
                </div>
                <div className="mt-2.5 flex h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-400 to-blue-500"
                    style={{ width: `${metricasCarteira.pctProrrogaveis}%` }}
                  />
                  <div
                    className="h-full bg-gradient-to-r from-pink-500 to-rose-500"
                    style={{ width: `${100 - metricasCarteira.pctProrrogaveis}%` }}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-violet-200 bg-white px-5 py-4 shadow-sm dark:border-violet-500/25 dark:bg-[#0d1326]/90 dark:shadow-[0_0_25px_rgba(168,85,247,0.06)]">
                <div className="flex items-center justify-between text-violet-700 dark:text-violet-300/90">
                  <span className="text-[11px] font-bold uppercase tracking-widest">
                    Total empenhado (2026)
                  </span>
                  <Landmark className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div className="mt-2 text-2xl font-black tracking-tight text-slate-900 dark:text-white xl:text-3xl">
                  {formatarMoeda(totalEmpenhado)}
                </div>
                <p className="mt-1.5 text-xs text-slate-600 dark:text-violet-200/80">
                  Executado: <strong className="text-pink-600 dark:text-pink-400">{formatarMoeda(totalGasto)}</strong>{' '}
                  ({metricasCarteira.pctExecutado.toFixed(1)}%)
                </p>
              </div>

              <div className="rounded-2xl border border-emerald-200 bg-white px-5 py-4 shadow-sm dark:border-emerald-500/25 dark:bg-[#0d1326]/90 dark:shadow-[0_0_25px_rgba(16,185,129,0.06)]">
                <div className="flex items-center justify-between text-emerald-700 dark:text-emerald-300/90">
                  <span className="text-[11px] font-bold uppercase tracking-widest">
                    Saldo de empenho
                  </span>
                  <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="mt-2 text-2xl font-black tracking-tight text-emerald-700 dark:text-emerald-300 xl:text-3xl">
                  {formatarMoeda(saldoTotal)}
                </div>
                <p className="mt-1.5 text-xs text-emerald-700/80 dark:text-emerald-200/70">
                  {metricasCarteira.pctSaldo.toFixed(1)}% disponível nos contratos ativos
                </p>
              </div>

              <div className="rounded-2xl border border-rose-200 bg-rose-50/80 px-5 py-4 shadow-sm dark:border-rose-500/35 dark:bg-gradient-to-br dark:from-[#231024]/90 dark:to-[#0d1326]/90 dark:shadow-[0_0_25px_rgba(244,63,94,0.08)]">
                <div className="flex items-center justify-between text-rose-700 dark:text-rose-300">
                  <span className="text-[11px] font-bold uppercase tracking-widest">
                    Vencendo em ≤ 90 dias
                  </span>
                  <CalendarClock className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                </div>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="text-4xl font-black text-rose-700 dark:text-rose-300">
                    {criticosAte45d.length + janela46a90d.length}
                  </span>
                  <span className="text-sm font-bold text-amber-600 dark:text-amber-300">
                    + {janela91a180d.length} até 180d
                  </span>
                </div>
                <p className="mt-1.5 text-xs text-rose-700/80 dark:text-rose-200/80">
                  {criticosAte45d.length} críticos (≤45d) · {janela46a90d.length} alerta (46–90d)
                </p>
              </div>
            </div>

            {/* Área Principal: Coluna Esquerda (8 cols com 2 faixas) + Treemap Quadrado à Direita (4 cols altura total) */}
            <div className="grid flex-1 grid-cols-1 gap-4 lg:grid-cols-12">
              {/* Coluna Esquerda (8 cols): Saúde + Horizonte no topo, Curva Mensal na base */}
              <div className="flex flex-col gap-4 lg:col-span-8">
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                  {/* Card 1: Top 5 Servidores com Mais Contratos (Barra Empilhada Gestor Verde × Fiscal Azul) */}
                  <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-indigo-500/20 dark:bg-[#0d1326]/90 dark:shadow-none">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
                          CARGA DE GESTÃO &amp; FISCALIZAÇÃO
                        </span>
                        <h2 className="text-xl font-extrabold leading-tight text-slate-900 dark:text-white">
                          Top 5 responsáveis por contratos
                        </h2>
                      </div>
                      <div className="flex shrink-0 items-center gap-3 pt-1 text-[11px] font-bold">
                        <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                          <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />
                          Gestor
                        </span>
                        <span className="flex items-center gap-1.5 text-blue-700 dark:text-sky-400">
                          <span className="h-2.5 w-2.5 rounded-sm bg-blue-500 dark:bg-sky-500" />
                          Fiscal
                        </span>
                      </div>
                    </div>

                    <div className="my-3 space-y-3">
                      {top5ServidoresContratos.top5.length === 0 ? (
                        <p className="py-8 text-center text-xs text-slate-400">
                          Nenhum gestor ou fiscal designado nos contratos ativos.
                        </p>
                      ) : (
                        top5ServidoresContratos.top5.map((srv, idx) => {
                          const larguraBarra = Math.max(
                            22,
                            Math.round((srv.total / top5ServidoresContratos.maxTotal) * 100)
                          );
                          return (
                            <div key={srv.nome} className="space-y-1">
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <div className="flex min-w-0 items-center gap-2">
                                  <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 font-mono text-[11px] font-black text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    {idx + 1}
                                  </span>
                                  <span
                                    className="truncate font-extrabold text-slate-800 dark:text-slate-100"
                                    title={srv.nome}
                                  >
                                    {srv.nome}
                                  </span>
                                </div>
                                <div className="flex shrink-0 items-center gap-2 font-mono text-[11px] font-bold">
                                  <span className="text-emerald-700 dark:text-emerald-400">
                                    {srv.gestor}G
                                  </span>
                                  <span className="text-slate-300 dark:text-slate-600">·</span>
                                  <span className="text-blue-700 dark:text-sky-400">
                                    {srv.fiscal}F
                                  </span>
                                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-black text-slate-900 dark:bg-slate-800 dark:text-white">
                                    {srv.total}
                                  </span>
                                </div>
                              </div>

                              {/* Barra proporcional ao líder, dividida em Verde (Gestor) e Azul (Fiscal) */}
                              <div className="h-5 w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800/80">
                                <div
                                  className="flex h-full overflow-hidden rounded-lg"
                                  style={{ width: `${larguraBarra}%` }}
                                >
                                  {srv.gestor > 0 && (
                                    <div
                                      className="flex h-full items-center justify-center bg-gradient-to-r from-emerald-500 to-emerald-400 px-1 text-[10px] font-black text-white"
                                      style={{ width: `${srv.pctGestor}%` }}
                                      title={`Gestor: ${srv.gestor} contrato(s) (${srv.pctGestor}%)`}
                                    >
                                      {srv.pctGestor >= 18 ? `${srv.pctGestor}%` : ''}
                                    </div>
                                  )}
                                  {srv.fiscal > 0 && (
                                    <div
                                      className="flex h-full items-center justify-center bg-gradient-to-r from-blue-600 to-sky-500 px-1 text-[10px] font-black text-white"
                                      style={{ width: `${srv.pctFiscal}%` }}
                                      title={`Fiscal: ${srv.fiscal} contrato(s) (${srv.pctFiscal}%)`}
                                    >
                                      {srv.pctFiscal >= 18 ? `${srv.pctFiscal}%` : ''}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="flex items-center justify-between border-t border-slate-200 pt-2.5 text-[11px] font-semibold text-slate-500 dark:border-slate-800/80 dark:text-slate-400">
                      <span>
                        {top5ServidoresContratos.totalServidores} servidores designados na carteira
                      </span>
                      <span className="font-mono text-slate-700 dark:text-slate-300">
                        G = Gestor · F = Fiscal
                      </span>
                    </div>
                  </div>

                  {/* Card 2: Liquid Fill Gauge (Saldo vs Empenhado) + Resumo Financeiro & Fontes RPPS/FPS */}
                  <div className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-indigo-500/20 dark:bg-[#0d1326]/90 dark:shadow-none">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold uppercase tracking-widest text-purple-600 dark:text-purple-400">
                          EXECUÇÃO ORÇAMENTÁRIA · EMPENHO
                        </span>
                        <h2 className="text-xl font-extrabold leading-tight text-slate-900 dark:text-white">
                          Saldo e liquidação de empenho
                        </h2>
                      </div>
                    </div>

                    <div className="my-2 flex items-center gap-5">
                      <LiquidFillGauge
                        percentual={metricasCarteira.pctSaldo}
                        subtitulo="Saldo livre"
                        temaEscuro={temaEscuro}
                      />

                      <div className="flex-1 space-y-3">
                        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3.5 py-2.5 dark:border-emerald-500/25 dark:bg-emerald-500/10">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300/90">
                            Saldo de empenho
                          </div>
                          <div className="mt-0.5 font-mono text-lg font-black text-emerald-700 dark:text-emerald-300 xl:text-xl">
                            {formatarMoeda(saldoTotal)}
                          </div>
                        </div>

                        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 dark:border-slate-800 dark:bg-[#0b1124]/80">
                          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                            Total empenhado
                          </div>
                          <div className="mt-0.5 font-mono text-lg font-black text-slate-900 dark:text-white xl:text-xl">
                            {formatarMoeda(totalEmpenhado)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Rodapé: divisão RPPS/FPS */}
                    <div className="mt-2 border-t border-slate-200 pt-3 dark:border-slate-800/80">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-violet-700 dark:text-violet-300">
                          RPPS: {formatarMoedaCompacta(metricasCarteira.totalRpps)} ({metricasCarteira.pctRpps}%)
                        </span>
                        <span className="text-cyan-700 dark:text-cyan-300">
                          FPS: {formatarMoedaCompacta(metricasCarteira.totalFps)} ({metricasCarteira.pctFps}%)
                        </span>
                      </div>
                      <div className="mt-1.5 flex h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div
                          className="h-full bg-gradient-to-r from-violet-500 to-purple-400"
                          style={{ width: `${metricasCarteira.pctRpps}%` }}
                        />
                        <div
                          className="h-full bg-gradient-to-r from-cyan-400 to-sky-400"
                          style={{ width: `${metricasCarteira.pctFps}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Base esquerda: Curva neon de execução mensal (2026 vs 2025) */}
                <div className="flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-indigo-500/20 dark:bg-[#0d1326]/90 dark:shadow-none">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold uppercase tracking-widest text-pink-600 dark:text-pink-400">
                        DESEMBOLSO MENSAL CONSOLIDADO
                      </span>
                      <h2 className="text-xl font-extrabold leading-tight text-slate-900 dark:text-white">
                        Curva de execução financeira (JAN – DEZ)
                      </h2>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-bold">
                      <span className="flex items-center gap-1.5 text-cyan-700 dark:text-cyan-300">
                        <span className="h-2.5 w-2.5 rounded-full bg-cyan-500 dark:bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                        2026 (Atual)
                      </span>
                      <span className="flex items-center gap-1.5 text-pink-600 dark:text-pink-300">
                        <span className="h-2.5 w-2.5 rounded-full bg-pink-500 shadow-[0_0_8px_#ec4899]" />
                        2025 (Histórico)
                      </span>
                    </div>
                  </div>

                  <div className="min-h-[175px] flex-1 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={execucaoMensalComparativa}
                        margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="gradTv2026" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#06b6d4" stopOpacity={temaEscuro ? 0.45 : 0.3} />
                            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
                          </linearGradient>
                          <linearGradient id="gradTv2025" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ec4899" stopOpacity={temaEscuro ? 0.28 : 0.18} />
                            <stop offset="95%" stopColor="#ec4899" stopOpacity={0.01} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="3 6"
                          stroke={temaEscuro ? '#1e293b' : '#e2e8f0'}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="mes"
                          stroke={temaEscuro ? '#64748b' : '#94a3b8'}
                          tick={{ fill: temaEscuro ? '#94a3b8' : '#475569', fontSize: 11, fontWeight: 700 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          stroke={temaEscuro ? '#64748b' : '#94a3b8'}
                          tick={{ fill: temaEscuro ? '#94a3b8' : '#475569', fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          width={62}
                          tickFormatter={(v) => formatarMoedaCompacta(Number(v))}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: temaEscuro ? '#0b1124' : '#ffffff',
                            borderColor: temaEscuro ? '#334155' : '#cbd5e1',
                            borderRadius: '12px',
                            fontSize: '12px',
                            color: temaEscuro ? '#f8fafc' : '#0f172a',
                          }}
                          formatter={(value, name) => [
                            formatarMoeda(Number(value || 0)),
                            name === 'atual2026' ? 'Executado 2026' : 'Executado 2025',
                          ]}
                        />
                        <Area
                          type="monotone"
                          dataKey="historico2025"
                          stroke="#ec4899"
                          strokeWidth={2}
                          strokeDasharray="4 4"
                          fill="url(#gradTv2025)"
                          isAnimationActive={false}
                        />
                        <Area
                          type="monotone"
                          dataKey="atual2026"
                          stroke={temaEscuro ? '#22d3ee' : '#0284c7'}
                          strokeWidth={2.8}
                          fill="url(#gradTv2026)"
                          dot={{
                            r: 3.5,
                            fill: temaEscuro ? '#0b1124' : '#ffffff',
                            stroke: temaEscuro ? '#22d3ee' : '#0284c7',
                            strokeWidth: 2,
                          }}
                          isAnimationActive={false}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Coluna Direita (4 cols, altura total): TREEMAP QUADRADO (1:1) por Setor Solicitante */}
              <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-indigo-500/20 dark:bg-[#0d1326]/90 dark:shadow-none lg:col-span-4">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-widest text-cyan-700 dark:text-cyan-400">
                      TREEMAP DE CONTRATOS · IPAJM
                    </span>
                    <h2 className="text-xl font-extrabold leading-tight text-slate-900 dark:text-white">
                      Contratos por setor solicitante
                    </h2>
                  </div>
                  <span className="shrink-0 rounded-full border border-cyan-300 bg-cyan-50 px-2.5 py-0.5 text-[10px] font-bold text-cyan-800 dark:border-cyan-500/30 dark:bg-cyan-500/10 dark:text-cyan-300">
                    Proporcional (Qtd.)
                  </span>
                </div>

                <div className="aspect-square w-full flex-1 min-h-[360px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <Treemap
                      data={dadosTreemapSetores}
                      dataKey="size"
                      aspectRatio={1}
                      stroke="none"
                      isAnimationActive={false}
                      content={<TreemapSetorNode temaEscuro={temaEscuro} />}
                    />
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        )}

        {telaAtual === 1 && (
          /* ================= TELA 2: TODOS OS CONTRATOS VIGENTES (PAGINADOS) ================= */
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-none">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:text-slate-400">
                  <th className="pb-3 pr-3">#</th>
                  <th className="pb-3 pr-3">Término / Prazo</th>
                  <th className="pb-3 pr-3">P / NP</th>
                  <th className="pb-3 pr-3">Empresa / Objeto</th>
                  <th className="pb-3 pr-3">Nº contrato</th>
                  <th className="pb-3 pr-3">Proc. mãe / Pagto</th>
                  <th className="pb-3 pr-3">Setor</th>
                  <th className="pb-3 pr-3 text-right">Saldo empenho</th>
                  {configTv.exibirResponsavelTv && (
                    <th className="pb-3">Gestor / Fiscal titular</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm dark:divide-slate-800/80">
                {contratosPaginaAtual.map((c, idx) => {
                  const numOrdem = paginaContratos * ITENS_POR_PAGINA_TV + idx + 1;
                  const dias = calcularDiasAtePrazo(c.fimVigencia) ?? 0;
                  const critico = dias <= 45;
                  const alerta = dias > 45 && dias <= 90;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      <td className="whitespace-nowrap py-2.5 pr-3 font-mono text-sm font-bold text-slate-500 dark:text-slate-400">
                        {numOrdem}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm font-extrabold text-slate-900 dark:text-white">
                            {formatarDataBr(c.fimVigencia)}
                          </span>
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-extrabold ${
                              critico
                                ? 'border border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/25 dark:text-rose-300'
                                : alerta
                                ? 'border border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/25 dark:text-amber-300'
                                : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {dias}d
                          </span>
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                            c.prorrogavel
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300'
                          }`}
                        >
                          {c.prorrogavel ? 'P' : 'NP'}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">
                        <div className="font-extrabold text-slate-900 dark:text-white">
                          {c.empresaContratada}
                        </div>
                        <div className="max-w-xs truncate text-xs text-slate-500 dark:text-slate-400">
                          {c.objeto}
                        </div>
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3 font-mono text-xs font-bold text-blue-700 dark:text-blue-300">
                        {c.numeroContrato}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3 font-mono text-xs">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          Mãe: {c.numeroEdocs}
                        </div>
                        {c.processoPagamento && (
                          <div className="text-indigo-700 dark:text-indigo-300">
                            Pagto: {c.processoPagamento}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3 text-xs font-bold text-slate-700 dark:text-slate-300">
                        {(c.setorDemandante || 'SLC').split(' — ')[0]}
                      </td>
                      <td className="whitespace-nowrap py-2.5 pr-3 text-right font-mono text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                        {formatarMoeda(c.saldoDisponivel)}
                      </td>
                      {configTv.exibirResponsavelTv && (
                        <td className="whitespace-nowrap py-2.5 text-xs">
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            G: {c.gestorContrato}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400">
                            F: {c.fiscalTitular}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {telaAtual === 2 && (
          /* ================= TELA 3: JANELAS DE VENCIMENTO (≤45d, 46–90d, 91–180d) ================= */
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Coluna críticos <= 45 dias */}
              <div className="rounded-3xl border border-rose-200 bg-rose-50/70 p-6 dark:border-rose-500/40 dark:bg-rose-950/20">
                <div className="flex items-center justify-between border-b border-rose-200 pb-4 dark:border-rose-500/30">
                  <div className="flex items-center gap-3">
                    <AlertOctagon className="h-7 w-7 text-rose-600 dark:text-rose-400" />
                    <h2 className="text-xl font-bold text-rose-800 dark:text-rose-200">
                      Crítico: vence em ≤ 45 dias
                    </h2>
                  </div>
                  <span className="rounded-2xl bg-rose-200/80 px-4 py-1 text-2xl font-black text-rose-800 dark:bg-rose-500/30 dark:text-rose-200">
                    {criticosAte45d.length}
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  {criticosAte45d.map((c) => {
                    const dias = calcularDiasAtePrazo(c.fimVigencia) ?? 0;
                    return (
                      <div
                        key={c.id}
                        className="rounded-2xl border border-rose-200 bg-white p-5 shadow-sm dark:border-rose-500/30 dark:bg-slate-950/80 dark:shadow-none"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-base font-extrabold text-rose-700 dark:text-rose-300">
                            {c.empresaContratada} ({c.numeroContrato})
                          </span>
                          <span className="rounded-lg bg-rose-100 px-2.5 py-1 text-xs font-extrabold text-rose-700 dark:bg-rose-500/30 dark:text-rose-200">
                            {dias} dias ({formatarDataBr(c.fimVigencia)})
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
                          {c.objeto}
                        </p>
                        <p className="mt-2 text-xs text-rose-700/90 dark:text-rose-200/90">
                          Proc. mãe: {c.numeroEdocs} ·{' '}
                          <strong>
                            {c.prorrogavel
                              ? 'Prorrogável (instruir aditivo)'
                              : 'Não prorrogável (nova contratação)'}
                          </strong>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Coluna alerta 46 a 90 dias */}
              <div className="rounded-3xl border border-amber-200 bg-amber-50/70 p-6 dark:border-amber-500/40 dark:bg-amber-950/15">
                <div className="flex items-center justify-between border-b border-amber-200 pb-4 dark:border-amber-500/30">
                  <div className="flex items-center gap-3">
                    <Clock className="h-7 w-7 text-amber-600 dark:text-amber-400" />
                    <h2 className="text-xl font-bold text-amber-900 dark:text-amber-200">
                      Alerta: 46 a 90 dias
                    </h2>
                  </div>
                  <span className="rounded-2xl bg-amber-200/80 px-4 py-1 text-2xl font-black text-amber-900 dark:bg-amber-500/30 dark:text-amber-200">
                    {janela46a90d.length}
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  {janela46a90d.map((c) => {
                    const dias = calcularDiasAtePrazo(c.fimVigencia) ?? 0;
                    return (
                      <div
                        key={c.id}
                        className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm dark:border-amber-500/30 dark:bg-slate-950/80 dark:shadow-none"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-base font-extrabold text-amber-800 dark:text-amber-300">
                            {c.empresaContratada} ({c.numeroContrato})
                          </span>
                          <span className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-extrabold text-amber-800 dark:bg-amber-500/30 dark:text-amber-200">
                            {dias} dias ({formatarDataBr(c.fimVigencia)})
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
                          {c.objeto}
                        </p>
                        <p className="mt-2 text-xs text-amber-800/90 dark:text-amber-200/90">
                          Proc. mãe: {c.numeroEdocs} ·{' '}
                          <strong>
                            {c.prorrogavel
                              ? 'Prorrogável (P)'
                              : 'Não prorrogável (NP - nova contratação)'}
                          </strong>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Coluna planejamento 91 a 180 dias */}
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 dark:shadow-none">
                <div className="flex items-center justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    <AlertTriangle className="h-7 w-7 text-sky-600 dark:text-sky-400" />
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                      Planejamento: 91 a 180 dias
                    </h2>
                  </div>
                  <span className="rounded-2xl bg-sky-100 px-4 py-1 text-2xl font-black text-sky-700 dark:bg-sky-500/25 dark:text-sky-300">
                    {janela91a180d.length}
                  </span>
                </div>

                <div className="mt-5 space-y-4">
                  {janela91a180d.map((c) => {
                    const dias = calcularDiasAtePrazo(c.fimVigencia) ?? 0;
                    return (
                      <div
                        key={c.id}
                        className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-950/80"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-base font-extrabold text-blue-700 dark:text-blue-400">
                            {c.empresaContratada} ({c.numeroContrato})
                          </span>
                          <span className="rounded-lg bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-700 dark:bg-sky-500/20 dark:text-sky-300">
                            {dias} dias ({formatarDataBr(c.fimVigencia)})
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">
                          {c.objeto}
                        </p>
                        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                          Setor: {(c.setorDemandante || 'SLC').split(' — ')[0]} ·{' '}
                          {c.prorrogavel ? 'Prorrogável (P)' : 'Nova contratação (NP)'}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {telaAtual === 3 && (
          /* ================= TELA 4: MURAL DE FICHAS DOS CONTRATOS (QUADRO FÍSICO SLC) ================= */
          <div className="flex h-full flex-col gap-3">
            {/* Grid 4x3 de cards no layout kanban com as informações do mural SLC */}
            <div className="grid content-start items-start grid-cols-1 gap-3.5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {fichasPaginaAtual.map((c) => {
                const dias = calcularDiasAtePrazo(c.fimVigencia);
                const critico = dias !== null && dias <= 45;
                const alerta = dias !== null && dias > 45 && dias <= 90;
                const preventivo = dias !== null && dias > 90 && dias <= 180;
                const anoMax =
                  c.dataDuracaoMaxima && c.dataDuracaoMaxima.length >= 4
                    ? c.dataDuracaoMaxima.slice(0, 4)
                    : '';
                const setorSigla = (c.setorDemandante || 'SLC').split(' — ')[0];
                const siglaMod = extrairSiglaModalidade(c.modalidadeContratacao);
                const modGarantia =
                  c.modalidadeGarantia && c.modalidadeGarantia !== '—'
                    ? c.modalidadeGarantia
                    : '.';
                const valGarantia =
                  c.validadeGarantia && c.validadeGarantia !== '—'
                    ? c.validadeGarantia.length === 10 && c.validadeGarantia.includes('-')
                      ? formatarDataBr(c.validadeGarantia)
                      : c.validadeGarantia
                    : '.';

                const acaoCard =
                  critico || alerta
                    ? c.prorrogavel
                      ? 'Termo aditivo de prorrogação (P)'
                      : 'Nova contratação / licitação (NP)'
                    : preventivo
                    ? `Consultar gestor (${setorSigla}) sobre ${
                        c.prorrogavel ? 'renovação (P)' : 'nova licitação (NP)'
                      }`
                    : c.statusGarantia === 'Pendente de renovação'
                    ? 'Solicitar renovação / endosso de garantia'
                    : 'Vigência regular · acompanhamento mensal';

                return (
                  <div
                    key={c.id}
                    className={`flex flex-col justify-between overflow-hidden rounded-2xl border bg-white shadow-sm transition dark:bg-[#0d1326]/95 dark:shadow-lg ${
                      critico
                        ? 'border-rose-300 ring-1 ring-rose-200 dark:border-rose-500/60 dark:ring-0 dark:shadow-[0_0_20px_rgba(244,63,94,0.14)]'
                        : alerta
                        ? 'border-amber-300 ring-1 ring-amber-200 dark:border-amber-500/50 dark:ring-0 dark:shadow-[0_0_16px_rgba(245,158,11,0.10)]'
                        : preventivo
                        ? 'border-sky-200 dark:border-sky-500/35'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    {/* Faixa superior colorida de status (padrão colunas do Kanban) */}
                    <div
                      className={`h-1.5 w-full ${
                        critico
                          ? 'bg-gradient-to-r from-rose-500 to-pink-500'
                          : alerta
                          ? 'bg-gradient-to-r from-amber-400 to-orange-500'
                          : preventivo
                          ? 'bg-gradient-to-r from-sky-400 to-blue-500'
                          : 'bg-gradient-to-r from-emerald-400 to-teal-500'
                      }`}
                    />

                    {/* Conteúdo interno do card */}
                    <div className="p-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`rounded-lg px-2 py-0.5 text-[10px] font-extrabold ${
                            c.prorrogavel
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300'
                              : 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300'
                          }`}
                        >
                          {c.prorrogavel ? 'P · Prorrogável' : 'NP · Licitar'}
                        </span>
                        <span className="rounded-lg bg-blue-50 px-2 py-0.5 font-mono text-[10px] font-extrabold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                          {setorSigla} / {c.regraPagamento || '.'}
                        </span>
                      </div>

                      {/* Contrato, empresa (neutro alto contraste) e objeto */}
                      <div className="mt-2">
                        <div className="truncate font-mono text-[11px] font-extrabold text-blue-600 dark:text-blue-400">
                          CT {c.numeroContrato || 'S/N'}
                        </div>
                        <div
                          className="truncate text-base font-black uppercase tracking-tight text-slate-900 dark:text-white"
                          title={c.empresaContratada}
                        >
                          {c.empresaContratada}
                        </div>
                        <div
                          className="truncate text-[11px] font-medium uppercase text-slate-500 dark:text-slate-400"
                          title={c.objeto}
                        >
                          {c.objeto}
                        </div>
                      </div>

                      {/* Caixa destacada de encerramento + ação recomendada (padrão kanban) */}
                      <div
                        className={`mt-2.5 rounded-xl border px-3 py-2 ${
                          critico
                            ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-950/45 dark:text-rose-300'
                            : alerta
                            ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/35 dark:text-amber-300'
                            : preventivo
                            ? 'border-sky-200 bg-sky-50/80 text-sky-800 dark:border-sky-500/35 dark:bg-sky-950/30 dark:text-sky-300'
                            : 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-700/80 dark:bg-slate-800/60 dark:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-extrabold">
                            {dias === null
                              ? 'ENCERRA'
                              : critico || alerta
                              ? `Vence em ${dias} ${dias === 1 ? 'dia' : 'dias'}`
                              : `Faltam ${dias} dias`}
                          </span>
                          <span className="font-mono text-xs font-black">
                            {formatarDataBr(c.fimVigencia)}
                            {anoMax ? ` - ${anoMax}` : ''}
                          </span>
                        </div>
                        <div className="mt-1 line-clamp-2 text-[11px] font-semibold leading-snug opacity-95">
                          {acaoCard}
                        </div>
                      </div>

                      {/* 2 Mini-caixas lado a lado: proc. mãe / mod. e garantia */}
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-900/80">
                          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            PROC. MÃE / MOD.
                          </div>
                          <div className="truncate font-mono text-[11px] font-extrabold text-blue-700 dark:text-blue-300">
                            {c.numeroEdocs || '—'} / {siglaMod}
                          </div>
                        </div>
                        <div className="rounded-xl border border-slate-200 bg-slate-50/80 px-2.5 py-1.5 dark:border-slate-800 dark:bg-slate-900/80">
                          <div className="text-[9px] font-bold uppercase tracking-wider text-slate-400">
                            GARANTIA
                          </div>
                          <div
                            className={`truncate font-mono text-[11px] font-extrabold ${
                              c.statusGarantia === 'Pendente de renovação'
                                ? 'text-amber-700 dark:text-amber-300'
                                : 'text-emerald-700 dark:text-emerald-300'
                            }`}
                          >
                            {modGarantia} - {valGarantia}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </main>

      {/* Rodapé de segurança e status de sincronização (RNF-07 / RF-13) */}
      <footer className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 bg-white/95 px-8 py-3 text-xs text-slate-600 dark:border-slate-800 dark:bg-slate-900/95 dark:text-slate-400">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
            <ShieldCheck className="h-4 w-4" />
            Painel sincronizado com a aba &ldquo;vigentes&rdquo; ({contratos.length} contratos ativos ·{' '}
            {qtdRestritosOcultos} restritos ocultados)
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 font-medium text-slate-700 dark:text-slate-300">
            {falhaConexaoReal ? (
              <WifiOff className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            ) : (
              <Wifi className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            )}
            <span>
              Última atualização:{' '}
              <strong>
                {ultimaSincronizacao.toLocaleDateString('pt-BR')} às{' '}
                {ultimaSincronizacao.toLocaleTimeString('pt-BR')}
              </strong>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
};
