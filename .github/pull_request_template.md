## Descrição

<!-- O que muda e por quê. Se resolver uma issue, feche-a com "Closes #N". -->

## Área

- [ ] Backend
- [ ] Frontend
- [ ] Documentação / infraestrutura

## Tipo de mudança

- [ ] `feat:` nova funcionalidade
- [ ] `fix:` correção
- [ ] `test:` testes
- [ ] `docs:` documentação
- [ ] `chore:` manutenção / refatoração

## Como testar

<!-- Passos manuais reproduzíveis. Para mudanças de UI, inclua prints ou vídeo. -->

## Checklist geral

- [ ] Título no formato Conventional Commits (`feat: add best-move endpoint`)
- [ ] Branch segue o padrão `tipo/área-descrição` (ex.: `feat/frontend-board`)
- [ ] Nenhum segredo ou credencial commitado (confira `.env` e afins)
- [ ] `backend/AGENTS.md` relido se a mudança tocar arquitetura
- [ ] Documentação (`README` / `AGENTS.md`) atualizada
- [ ] Próprio diff revisado antes de abrir o PR

<!-- -------------------------------------------------- -->
<!-- Preencha o bloco correspondente à área alterada.   -->
<!-- Remova o bloco que não for aplicável, se preferir. -->
<!-- -------------------------------------------------- -->

### Backend

- [ ] `uv run pytest`
- [ ] `uv run ruff check`
- [ ] `uv run ruff format --check`
- [ ] `uv run pyright` (strict, sem erros)
- [ ] Testes novos para regra ou caminho alterado (usar `FakeEngine`, sem Stockfish)

### Frontend

> Bloco ativo quando `frontend/` existir (React + react-chessboard + chess.js).

- [ ] `npm run lint`
- [ ] `npm run build`
- [ ] Testes de unidade
- [ ] Print ou vídeo da tela alterada
