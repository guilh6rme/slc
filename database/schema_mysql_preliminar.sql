-- =============================================================================
-- SLC Digital — IPAJM
-- Script DDL Preliminar (MySQL 8.0+)
-- AVISO: Estrutura provisória baseada no levantamento inicial da GTI/SLC.
-- Sujeita a ajustes após acesso e análise das colunas reais da planilha da SLC.
-- =============================================================================

CREATE DATABASE IF NOT EXISTS slc_digital
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE slc_digital;

-- 1. Categorias de Processos acompanhados pela SLC
CREATE TABLE IF NOT EXISTS categorias (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  nome VARCHAR(100) NOT NULL,
  descricao VARCHAR(255) NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 2. Situações / Etapas do Fluxo Operacional
CREATE TABLE IF NOT EXISTS situacoes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  nome VARCHAR(100) NOT NULL,
  ordem INT NOT NULL DEFAULT 1,
  terminal TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 indica etapa final/concluída',
  cor_badge VARCHAR(30) NOT NULL DEFAULT 'blue',
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 3. Usuários / Servidores da SLC (Integração futura com Active Directory)
CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  login_ad VARCHAR(100) NOT NULL UNIQUE COMMENT 'Identificador no Active Directory do IPAJM',
  nome_exibicao VARCHAR(120) NOT NULL,
  cargo_funcao VARCHAR(100) NULL,
  perfil ENUM('GESTOR_SLC', 'SERVIDOR_SLC', 'CONSULTA', 'PAINEL_TV') NOT NULL DEFAULT 'SERVIDOR_SLC',
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 4. Processos Administrativos acompanhados pela SLC
CREATE TABLE IF NOT EXISTS processos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo_interno VARCHAR(30) NOT NULL UNIQUE,
  numero_edocs VARCHAR(40) NOT NULL COMMENT 'Referência oficial no E-Docs (ex: 2026-X9A12)',
  assunto_resumido VARCHAR(255) NOT NULL,
  objeto_detalhado TEXT NULL,
  categoria_id INT UNSIGNED NOT NULL,
  setor_demandante VARCHAR(80) NOT NULL,
  responsavel_id INT UNSIGNED NULL,
  data_entrada DATE NOT NULL,
  situacao_id INT UNSIGNED NOT NULL,
  prioridade ENUM('BAIXA', 'MEDIA', 'ALTA', 'CRITICA') NOT NULL DEFAULT 'MEDIA',
  prazo DATE NULL COMMENT 'Data limite da providência atual',
  observacoes_internas TEXT NULL COMMENT 'Notas internas restritas; nunca exibidas no Modo TV',
  restrito_tv TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'Se 1, processo é ocultado do Modo TV',
  pendencia_atual VARCHAR(255) NULL,
  link_edocs VARCHAR(500) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_processos_categoria FOREIGN KEY (categoria_id) REFERENCES categorias(id),
  CONSTRAINT fk_processos_situacao FOREIGN KEY (situacao_id) REFERENCES situacoes(id),
  CONSTRAINT fk_processos_responsavel FOREIGN KEY (responsavel_id) REFERENCES usuarios(id),
  INDEX idx_processos_edocs (numero_edocs),
  INDEX idx_processos_situacao (situacao_id),
  INDEX idx_processos_prazo (prazo),
  INDEX idx_processos_atualizado (atualizado_em)
) ENGINE=InnoDB;

-- 5. Trilha de Auditoria / Histórico de Alterações
CREATE TABLE IF NOT EXISTS historico_alteracoes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  processo_id INT UNSIGNED NOT NULL,
  usuario_nome VARCHAR(120) NOT NULL,
  campo VARCHAR(80) NOT NULL,
  valor_anterior TEXT NULL,
  valor_novo TEXT NULL,
  instante DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_historico_processo FOREIGN KEY (processo_id) REFERENCES processos(id) ON DELETE CASCADE,
  INDEX idx_historico_processo (processo_id, instante DESC)
) ENGINE=InnoDB;

-- 6. Configuração do Painel de Monitoramento (1 Única TV no setor)
CREATE TABLE IF NOT EXISTS configuracao_painel (
  id INT UNSIGNED PRIMARY KEY DEFAULT 1,
  intervalo_segundos INT NOT NULL DEFAULT 20,
  exibir_responsavel_tv TINYINT(1) NOT NULL DEFAULT 1,
  dias_alerta_inatividade INT NOT NULL DEFAULT 10,
  dias_alerta_prazo_proximo INT NOT NULL DEFAULT 7,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- 7. Gestão de Contratos, Vigências, Saldos, Empenhos RPPS/FPS, CNDs, CEIS e Fiscais (Módulo M5 - Alinhado com CONTROLE_CONTRATOS-2026_B.xlsm)
CREATE TABLE IF NOT EXISTS contratos (
  id VARCHAR(60) PRIMARY KEY,
  numero_contrato VARCHAR(60) NOT NULL COMMENT 'Ex: 2025.000047.60201.01 ou 005/2023',
  numero_edocs VARCHAR(60) NOT NULL COMMENT 'Processo Mãe no E-Docs (ex: 2025-LLM3W)',
  processo_pagamento VARCHAR(60) NULL COMMENT 'Processo de Pagamento anual no E-Docs (ex: 2026-73KQ6)',
  id_tces VARCHAR(80) NULL COMMENT 'Identificador CidadES TCE-ES (ex: 2025.500E0800001.10.0013)',
  aba_planilha VARCHAR(40) NULL COMMENT 'Código da aba individual na planilha (ex: ABC, AGENDA)',
  grupo_planilha VARCHAR(20) NOT NULL DEFAULT 'S' COMMENT 'S=Contratos Gerais, S2=Perícia Médica, S5=Encargos, Z=Encerrados',
  empresa_contratada VARCHAR(220) NOT NULL,
  razao_social VARCHAR(255) NULL,
  cnpj VARCHAR(60) NOT NULL,
  objeto TEXT NOT NULL,
  objeto_completo TEXT NULL,
  modalidade_contratacao VARCHAR(40) NULL COMMENT 'I=Inexigibilidade, D=Dispensa, P=Pregão, RP=Ata RP, C=Credenciamento, CO=Concorrência, CC=Cessão',
  setor_demandante VARCHAR(120) NOT NULL COMMENT 'Ex: GTI, SAG, SRH, GJP, GAD, GPMS, DIN, GGA, SCP, SSE, UGP, SLC',
  valor_global DECIMAL(15, 2) NOT NULL DEFAULT 0.00 COMMENT 'Total empenhado no exercício/contrato',
  total_gasto DECIMAL(15, 2) NOT NULL DEFAULT 0.00 COMMENT 'Total executado/pago de Jan a Dez',
  saldo_disponivel DECIMAL(15, 2) NOT NULL DEFAULT 0.00 COMMENT 'Saldo de empenho disponível',
  media_mensal DECIMAL(15, 2) NOT NULL DEFAULT 0.00 COMMENT 'Gasto médio mensal calculado',
  reforco_empenho VARCHAR(60) NULL COMMENT 'Projeção de reforço/sobra de empenho até dezembro',
  valor_rpps DECIMAL(15, 2) NOT NULL DEFAULT 0.00 COMMENT 'Valor empenhado no Fundo Previdenciário (RPPS)',
  ne_rpps VARCHAR(120) NULL COMMENT 'Notas de Empenho RPPS (ex: 2026NE00089)',
  valor_fps DECIMAL(15, 2) NOT NULL DEFAULT 0.00 COMMENT 'Valor empenhado no Fundo Financeiro (FPS)',
  ne_fps VARCHAR(120) NULL COMMENT 'Notas de Empenho FPS (ex: 2026NE00090)',
  inicio_vigencia DATE NOT NULL,
  fim_vigencia DATE NOT NULL,
  duracao_mm_max VARCHAR(30) NULL COMMENT 'Duração contratada / máxima legal em meses (ex: 12/060, 36/120)',
  data_duracao_maxima DATE NULL COMMENT 'Data limite legal de prorrogação',
  prorrogavel TINYINT(1) NOT NULL DEFAULT 1 COMMENT '1=Prorrogável (P), 0=Não Prorrogável / Nova Contratação (NP)',
  optante_simples VARCHAR(10) NULL DEFAULT 'N' COMMENT 'S, N, NC, -',
  regra_pagamento VARCHAR(30) NULL COMMENT 'Ex: 10U (10º dia útil), 15C (15 dias corridos), 30D',
  retencao_ir VARCHAR(15) NULL,
  status_garantia VARCHAR(60) NOT NULL DEFAULT 'Vigente',
  modalidade_garantia VARCHAR(40) NULL COMMENT 'SG, SG 5%, CAUÇÃO, PR, NASC',
  validade_garantia VARCHAR(40) NULL COMMENT 'Data de validade da apólice ou registro CRM',
  gestor_contrato VARCHAR(140) NOT NULL,
  gestor_suplente VARCHAR(140) NULL,
  fiscal_titular VARCHAR(140) NOT NULL,
  fiscal_suplente VARCHAR(140) NOT NULL,
  fiscais_adicionais TEXT NULL COMMENT 'Fiscais F2 a F9 separados por ponto-e-vírgula',
  cnds_json JSON NULL COMMENT 'Validades e peças E-Docs das 6 CNDs (Municipal, Estadual ES, Estadual, Federal, Trabalhista, FGTS)',
  sancao_ceis VARCHAR(255) NULL DEFAULT 'Nada Consta' COMMENT 'Cruzamento com base CEIS/CGU',
  execucao_mensal_json JSON NULL COMMENT 'Valores e NFs pagos de Janeiro a Dezembro',
  preposto_contato VARCHAR(255) NULL,
  email_contratada VARCHAR(180) NULL,
  ultimo_termo VARCHAR(180) NULL COMMENT 'Termos Aditivos (TA) e Apostilamentos (APO)',
  portaria_fiscalizacao VARCHAR(120) NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_contratos_fim_vigencia (fim_vigencia),
  INDEX idx_contratos_grupo (grupo_planilha),
  INDEX idx_contratos_setor (setor_demandante)
) ENGINE=InnoDB;


