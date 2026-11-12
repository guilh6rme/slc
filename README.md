# SLC Digital — IPAJM

**Sistema de Gestão e Monitoramento de Processos e Contratos da Subgerência de Licitações e Contratos (SLC)**

## 1. Propósito Institucional

Centralizar o acompanhamento interno dos processos administrativos e dos **contratos vigentes** da SLC, substituir controles físicos e planilhas paralelas, e disponibilizar indicadores gerenciais e um painel de monitoramento.

O **E-Docs** permanece como fonte oficial de tramitação e documentos. O SLC Digital opera como camada gerencial e operacional complementar, sem presumir integração automática com o E-Docs (ainda).

## 2. Estrutura do Repositório

- [`docs/`](docs/): proposta institucional, requisitos, arquitetura (**MySQL + FastAPI + React + NGINX + AD**) e plano incremental.
- [`database/schema_mysql_preliminar.sql`](database/schema_mysql_preliminar.sql): modelagem relacional DDL para **MySQL 8+**.
- [`backend/`](backend/): API RESTful em **Python + FastAPI + SQLAlchemy 2.0 + PyMySQL**:
  - Suporta conexão direta ao **MySQL 8+** via variável `DATABASE_URL` no `.env` (ou banco relacional local `slc_digital_local.db` para demonstrações rápidas);
  - Importador oficial da planilha da SLC ([`backend/import_xlsm.py`](backend/import_xlsm.py)) que carrega os **55 contratos vigentes** e seus respectivos **55 processos E-Docs** (`Proc. Mãe`, `Proc. Pagto`, `NE RPPS`, `NE FPS`, `CNDs`, `CEIS`, `Execução Jan–Dez` e equipe de fiscalização);
  - Endpoint exclusivo e sanitizado para a TV (`GET /api/tv/painel`) que filtra `restrito_tv` e nunca serializa `observacoes_internas`;
  - Documentação interativa Swagger UI em `http://localhost:8000/docs`.
- [`frontend/`](frontend/): aplicação web em **React + TypeScript + Vite + Tailwind CSS + Recharts** com:
  - **M1 · Dashboard** (KPIs, gráficos Recharts interativos e ranking de responsáveis com processos ativos);
  - **M2 · Processos** (busca, filtros, cadastro/edição, trilha de auditoria e importador `.CSV`);
  - **M3 · Contratos** (ficha completa dos 55 contratos com execução mensal `Jan–Dez`, NFs, rateio `RPPS/FPS` e regularidade das 6 `CNDs` + `CEIS`);
  - **M4 · Fluxo & Execução** (_1. Quadro de ações da SLC por gatilhos da planilha_, _2. Mapa de execução mensal Jan–Dez 2026_ e _3. Etapas E-Docs drag & drop_);
  - **M5 · Prazos e Pendências** (vencidos, a vencer e inatividade interna configurável);
  - **M6 · Relatórios e Exportação `.CSV`**;
  - **Modo TV** em tela cheia (16:9) exibindo todos os 55 contratos vigentes com paginação automática.

---

## 3. Como Executar o Projeto (Backend + Frontend)

### A. Importar/Atualizar Dados da Planilha `.xlsm` (Opcional — já populado)

```powershell ou bash
python backend/import_xlsm.py
```

### B. Iniciar a API Backend (FastAPI)

```powershell ou bash
cd backend
python -m uvicorn app.main:app --reload --port 8000
```

- Swagger UI: `http://localhost:8000/docs`
- Healthcheck GTI: `http://localhost:8000/api/health`

### C. Iniciar a Aplicação Frontend (React + Vite)

Em outro terminal:

```powershell ou bash
cd frontend
npm install
npm run dev
```

- Aplicação Web: `http://localhost:5173`
