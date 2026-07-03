# TaskFlow AI

TaskFlow AI e um task manager inteligente construido em Angular para demonstrar um fluxo enterprise de tarefas com revisao assistida por IA, aprovacao humana, geracao de payload, simulacao de CMS, observabilidade e chaos engineering.

O projeto nasceu como `cms-ai-portal`, mas foi reestruturado em fases para virar uma plataforma de estudo e portfolio tecnico.

## Screenshots

As imagens abaixo sao geradas a partir do app local durante a fase final de polimento.

| Home                               | Kanban                                       |
| ---------------------------------- | -------------------------------------------- |
| ![Home](docs/screenshots/home.png) | ![Kanban](docs/screenshots/tasks-kanban.png) |

| Review                                      | Analytics                                    |
| ------------------------------------------- | -------------------------------------------- |
| ![Review](docs/screenshots/task-review.png) | ![Analytics](docs/screenshots/analytics.png) |

## Funcionalidades

- Criacao de tasks enriquecidas com prioridade, categoria, tags, responsavel, prazo e criterios de aceite.
- Persistencia encapsulada por repository, com `localStorage` no frontend e API backend de tasks.
- Workflow principal: `Draft -> AI Reviewed -> Approved -> Published -> In Progress -> Completed`.
- Revisao por IA via Agent Gateway no backend, com fallback mockado.
- Aplicacao ou rejeicao individual de sugestoes.
- Aprovacao humana e geracao de payload JSON.
- Simulacao de envio para CMS/backend com sucesso e falhas controladas.
- Chaos Dashboard para ativar cenarios de falha de IA, CMS e rede.
- Analytics Dashboard com metricas de status, falhas, sugestoes e tempo ate aprovacao.
- Kanban com Angular CDK Drag and Drop e audit log de movimentacao.
- Dark mode e light mode com preferencia persistida no navegador.
- Cobertura de testes unitarios em 100%.

## Rotas

| Rota                    | Tela                             |
| ----------------------- | -------------------------------- |
| `/`                     | Home com resumo operacional      |
| `/tasks`                | Board Kanban e filtros           |
| `/tasks/new`            | Criacao de task                  |
| `/tasks/:taskId/review` | Revisao, IA, aprovacao e payload |
| `/chaos`                | Chaos Dashboard                  |
| `/analytics`            | Observabilidade e auditoria      |

## Arquitetura

```txt
src/app/
  core/
    models/
    services/
  features/
    analytics-dashboard/
    chaos-dashboard/
    home/
    task-create/
    task-list/
    task-review/
```

Principais services:

- `TaskService`: estado das tasks, status, Kanban e audit logs.
- `LocalStorageTaskRepository`: persistencia local e migracao de dados legados.
- `TaskApiClient`: client HTTP para a API backend de tasks.
- `AuditLogService`: criacao padronizada de logs.
- `AiReviewService`: simulacao de revisao por IA.
- `OpenAiTaskAnalysisProvider`: integracao backend com OpenAI Responses API para a analise inicial.
- `TaskWorkflowService`: orquestracao do fluxo de negocio.
- `TaskPayloadBuilderService`: criacao do payload final.
- `CmsService`: simulacao de backend/CMS.
- `ChaosService`: flags e logs dos cenarios de caos.
- `AnalyticsService`: metricas consolidadas.

## Modelo de workflow

```txt
Draft
  -> AI Reviewed
  -> Approved
  -> Published
  -> In Progress
  -> Completed
```

Status auxiliares:

- `Rejected`
- `Error`

## Comandos

Instalar dependencias:

```bash
npm install
```

Rodar em desenvolvimento:

```bash
npm run start
```

Ativar IA real no backend:

```bash
OPENAI_API_KEY=sk-... npm run start
```

Modelo padrao: `gpt-5.5`. Para trocar:

```bash
OPENAI_API_KEY=sk-... OPENAI_MODEL=gpt-5.5 npm run start
```

Persistencia backend de tasks:

```bash
TASKFLOW_TASKS_FILE=.taskflow/tasks.json npm run start
```

Quando `TASKFLOW_TASKS_FILE` nao e informado, a API usa `.taskflow/tasks.json` no diretorio do projeto.

## API de tasks

| Metodo   | Endpoint                    | Uso                           |
| -------- | --------------------------- | ----------------------------- |
| `GET`    | `/api/tasks`                | Lista tasks persistidas       |
| `PUT`    | `/api/tasks`                | Substitui a colecao de tasks  |
| `POST`   | `/api/tasks`                | Cria ou atualiza uma task     |
| `PATCH`  | `/api/tasks/:taskId`        | Atualiza campos de uma task   |
| `PATCH`  | `/api/tasks/:taskId/status` | Atualiza o status de uma task |
| `DELETE` | `/api/tasks/:taskId`        | Remove uma task               |

Validar TypeScript dos testes:

```bash
npx tsc -p tsconfig.spec.json --noEmit
```

Rodar testes com cobertura:

```bash
npm run test:coverage
```

Gerar build:

```bash
npm run build
```

## Qualidade

O projeto usa a configuracao de testes do Angular com Vitest e thresholds de cobertura por arquivo:

- Statements: 100%
- Branches: 100%
- Functions: 100%
- Lines: 100%

## Roadmap executado

- Fase 1: base arquitetural e modelos enterprise.
- Fase 2: workflow principal.
- Fase 3: IA mockada.
- Fase 4: chaos engineering.
- Fase 5: observabilidade.
- Fase 6: Kanban com drag and drop.
- Fase 7: acabamento de UX, documentacao e preparacao para portfolio.
- Fase 8: metricas de tempo por baia.
- Fase 9: recomendacoes deterministicas de IA mockada.
- Fase 10: contratos agent-ready.
- Fase 11: Agent Gateway seguro.
- Fase 12: providers HTTP com fallback.
- Fase 13: integracao OpenAI no backend para analise inicial.
- Fase 15: repository de tasks e API backend de persistencia.

## Decisoes tecnicas

- `localStorage` segue como repository ativo do frontend nesta versao, agora isolado por `TaskRepository`.
- A API backend de tasks persiste em JSON local para preparar a troca futura para banco de dados sem reescrever componentes.
- IA usa gateway backend com OpenAI quando `OPENAI_API_KEY` esta disponivel; sem chave ou em falha, cai para mocks para manter o projeto autocontido.
- Angular CDK e usado apenas onde ha ganho real de interacao: Kanban drag and drop.
- A aplicacao prioriza componentes standalone e services pequenos.
- A UI segue uma linguagem operacional, focada em leitura rapida, status e acoes recorrentes.
