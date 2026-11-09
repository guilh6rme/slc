# SLC Digital — IPAJM

**Sistema de Gestão e Monitoramento de Processos da Subgerência de Licitações e Contratos (SLC)**

Status: Protótipo Funcional Full-Stack Navegável v0.3 (Novembro/2026) · Iniciativa da **GTI (Gerência de Tecnologia da Informação)**.

## 1. Propósito Institucional
Centralizar o acompanhamento interno dos processos administrativos e contratos da SLC, substituir gradualmente controles físicos (papéis em parede e quadros) e planilhas paralelas, e disponibilizar indicadores gerenciais e um painel de monitoramento para **uma única TV** instalada no setor.

O **E-Docs** permanece como fonte oficial de tramitação e documentos. O SLC Digital opera como camada gerencial e operacional complementar, sem presumir integração automática com o E-Docs antes de validação técnica e autorização institucional.

## 2. Estrutura do Repositório

- [`SLC_DIGITAL_CONTEXTO_COMPLETO.md`](SLC_DIGITAL_CONTEXTO_COMPLETO.md): especificação consolidada, decisões confirmadas vs. hipóteses e roteiro de apresentação ao gestor da GTI.
- [`docs/`](docs/): proposta institucional, requisitos, arquitetura (**MySQL + FastAPI + React + NGINX + AD**) e plano incremental.
- [`database/schema_mysql_preliminar.sql`](database/schema_mysql_preliminar.sql): modelagem relacional DDL para **MySQL 8+**.
- [`backend/`](backend/): API RESTful em **Python + FastAPI + SQLAlchemy 2.0 + PyMySQL**:
  - Suporta conexão direta ao **MySQL 8+** via variável `DATABASE_URL` no `.env` (ou contingência automática local para demonstrações rápidas);
  - Seed automático dos dados fictícios na inicialização;
  - Endpoint exclusivo e sanitizado para a TV (`GET /api/tv/painel`) que filtra `restrito_tv` e nunca serializa `observacoes_internas`;
  - Documentação interativa Swagger UI em `http://localhost:8000/docs`.
- [`frontend/`](frontend/): aplicação web em **React + TypeScript + Vite + Tailwind CSS + Recharts** com:
  - **M1 · Dashboard Gerencial** (KPIs e gráficos Recharts interativos);
  - **M2 · Processos da SLC** (busca, filtros, cadastro/edição, trilha de auditoria e **Assistente de Importação da Planilha da SLC**);
  - **M3 · Quadro Kanban** (com *Drag-and-Drop* nativo entre colunas);
  - **M4 · Prazos e Pendências** (vencidos, a vencer e inatividade interna configurável);
  - **M5 · Contratos, Vigências, Saldos e Fiscais**;
  - **M6 · Relatórios Gerenciais e Exportação `.CSV` (Excel PT-BR)**;
  - **M7 · Modo TV (1 TV · 3 Visões Alternáveis)** em tela cheia (16:9).

## 3. Como Executar o Projeto (Backend + Frontend)

### A. Iniciar a API Backend (FastAPI)
```bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```
- Swagger UI: `http://localhost:8000/docs`
- Healthcheck GTI: `http://localhost:8000/api/health`

### B. Iniciar a Aplicação Frontend (React + Vite)
```bash
cd frontend
npm install
npm run dev
```
- Aplicação Web: `http://localhost:5173`

