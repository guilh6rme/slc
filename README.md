# SLC Digital — IPAJM

**Sistema de Gestão e Monitoramento de Processos e Contratos da Subgerência de Licitações e Contratos (SLC)**

Status: Aplicação Funcional Full-Stack v0.4 (Novembro/2026) · Iniciativa da **GTI (Gerência de Tecnologia da Informação)**.

## 1. Propósito Institucional
Centralizar o acompanhamento interno dos processos administrativos e dos **55 contratos vigentes** da SLC (sincronizados com a planilha oficial `CONTROLE_CONTRATOS-2026_B.xlsm`), substituir controles físicos e planilhas paralelas, e disponibilizar indicadores gerenciais e um painel de monitoramento para **uma única TV** instalada no setor.

O **E-Docs** permanece como fonte oficial de tramitação e documentos. O SLC Digital opera como camada gerencial e operacional complementar, sem presumir integração automática com o E-Docs antes de validação técnica e autorização institucional.

## 2. Estrutura do Repositório

- [`SLC_DIGITAL_CONTEXTO_COMPLETO.md`](SLC_DIGITAL_CONTEXTO_COMPLETO.md): especificação consolidada, decisões confirmadas vs. hipóteses e roteiro de apresentação ao gestor da GTI.
- [`docs/`](docs/): proposta institucional, requisitos, arquitetura (**MySQL + FastAPI + React + NGINX + AD**) e plano incremental.
- [`database/schema_mysql_preliminar.sql`](database/schema_mysql_preliminar.sql): modelagem relacional DDL para **MySQL 8+**.
- [`backend/`](backend/): API RESTful em **Python + FastAPI + SQLAlchemy 2.0 + PyMySQL**:
  - Suporta conexão direta ao **MySQL 8+** via variável `DATABASE_URL` no `.env` (ou banco relacional local `slc_digital_local.db` para demonstrações rápidas);
  - Importador oficial da planilha da SLC ([`backend/import_xlsm.py`](backend/import_xlsm.py)) que carrega os **55 contratos vigentes** e seus respectivos **55 processos E-Docs** (`Proc. Mãe`, `Proc. Pagto`, `NE RPPS`, `NE FPS`, `CNDs`, `CEIS`, `Execução Jan–Dez` e equipe de fiscalização);
  - Endpoint exclusivo e sanitizado para a TV (`GET /api/tv/painel`) que filtra `restrito_tv` e nunca serializa `observacoes_internas`;
  - Documentação interativa Swagger UI em `http://localhost:8000/docs`.
- [`frontend/`](frontend/): aplicação web em **React + TypeScript + Vite + Tailwind CSS + Recharts** com:
  - **M1 · Dashboard Gerencial** (KPIs, gráficos Recharts interativos e ranking de responsáveis com processos ativos);
  - **M2 · Processos da SLC** (busca, filtros, cadastro/edição, trilha de auditoria e importador `.CSV`);
  - **M3 · Contratos, Vigências, Saldos e Fiscais** (ficha completa dos 55 contratos com execução mensal `Jan–Dez`, NFs, rateio `RPPS/FPS` e regularidade das 6 `CNDs` + `CEIS`);
  - **M4 · Painel Híbrido de Fluxo & Execução** (*1. Quadro de Ações da SLC por Gatilhos da Planilha*, *2. Mapa de Execução Mensal Jan–Dez 2026* e *3. Etapas E-Docs Drag & Drop*);
  - **M5 · Prazos e Pendências** (vencidos, a vencer e inatividade interna configurável);
  - **M6 · Relatórios Gerenciais e Exportação `.CSV` (Excel PT-BR)**;
  - **M7 · Modo TV (1 TV · 3 Visões Alternáveis)** em tela cheia (16:9) exibindo todos os 55 contratos vigentes com paginação automática.

---

## 3. Como Executar o Projeto (Backend + Frontend)

### A. Importar/Atualizar Dados da Planilha `.xlsm` (Opcional — já populado)
```powershell
python backend/import_xlsm.py
```

### B. Iniciar a API Backend (FastAPI)
```powershell
cd backend
python -m uvicorn app.main:app --reload --port 8000
```
- Swagger UI: `http://localhost:8000/docs`
- Healthcheck GTI: `http://localhost:8000/api/health`

### C. Iniciar a Aplicação Frontend (React + Vite)
Em outro terminal:
```powershell
cd frontend
npm install
npm run dev
```
- Aplicação Web: `http://localhost:5173`
