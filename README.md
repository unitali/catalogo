# Template Previewer

Ferramenta interna para navegar visualmente por templates de landing page em HTML estático e decidir quais migrar para Next.js. Roda só localmente — sem autenticação, sem backend, sem deploy.

## Como usar

1. Coloque seus templates em `public/templates/`, uma pasta por template. O jeito mais prático é criar um symlink em vez de copiar os arquivos:

   ```bash
   ln -s /caminho/dos/seus/templates public/templates
   ```

2. Instale as dependências e suba o app:

   ```bash
   npm install
   npm run dev
   ```

   O `npm run dev` já roda o scan automaticamente antes de subir o Vite.

3. Sempre que adicionar ou remover pastas dentro de `public/templates/`, rode o scan de novo (ou reinicie o `npm run dev`):

   ```bash
   npm run scan
   ```

## O que o scan faz

`scripts/scan-templates.mjs` varre `public/templates/`, encontra os `.html` de cada template (usa `index.html` como entrada quando existe, senão o primeiro `.html` encontrado) e gera `src/templates.json` — esse arquivo é gerado automaticamente, não edite à mão.

## Atalhos

- `↑` / `↓` — navega entre templates da lista
- `f` — marca/desmarca o template atual como escolhido
- `/` — foca a busca

Um template de exemplo já vem em `public/templates/exemplo-01/` só para o app abrir funcionando de primeira — pode apagar quando adicionar os seus.
