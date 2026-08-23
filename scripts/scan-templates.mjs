import { readdir } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const publicDir = join(__dirname, '..', 'public')
const outFile = join(__dirname, '..', 'src', 'templates.json')

// Vite serves public/ with case-sensitive matching, so the URL prefix has to
// match the folder's real on-disk casing (e.g. "Templates", not "templates").
async function resolveTemplatesDirName() {
  const entries = await readdir(publicDir, { withFileTypes: true })
  const match = entries.find((e) => e.isDirectory() && e.name.toLowerCase() === 'templates')
  return match ? match.name : 'templates'
}

const IGNORED_DIRS = new Set(['node_modules', '.git'])

function toTitle(folderName) {
  return folderName
    .split('-')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

async function findHtmlFiles(dir, base = dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) continue
      files.push(...(await findHtmlFiles(join(dir, entry.name), base)))
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.html')) {
      files.push(relative(base, join(dir, entry.name)))
    }
  }

  return files.sort()
}

async function scan() {
  const templatesDirName = await resolveTemplatesDirName()
  const templatesDir = join(publicDir, templatesDirName)

  let templateFolders
  try {
    templateFolders = (await readdir(templatesDir, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory() && !entry.name.startsWith('.'))
      .map((entry) => entry.name)
      .sort()
  } catch {
    console.error(`Não foi possível ler ${templatesDir}. Crie a pasta public/${templatesDirName}/ antes de rodar o scan.`)
    process.exit(1)
  }

  const templates = []

  for (const folder of templateFolders) {
    const folderPath = join(templatesDir, folder)
    const htmlFiles = await findHtmlFiles(folderPath)

    if (htmlFiles.length === 0) {
      console.warn(`⚠ "${folder}" não tem nenhum arquivo .html — ignorada.`)
      continue
    }

    const indexFiles = htmlFiles.filter((f) => f.split(sep).pop().toLowerCase() === 'index.html')
    const entryRelative =
      indexFiles.length > 0
        ? indexFiles.sort((a, b) => a.split(sep).length - b.split(sep).length || a.length - b.length)[0]
        : htmlFiles[0]
    const toUrl = (relPath) =>
      ['', templatesDirName, folder, ...relPath.split(sep)].map(encodeURIComponent).join('/')

    templates.push({
      id: folder,
      name: toTitle(folder),
      entry: toUrl(entryRelative),
      pages: htmlFiles.map((relPath) => ({
        label: relPath.split(sep).join('/'),
        url: toUrl(relPath),
      })),
    })
  }

  const { writeFile } = await import('node:fs/promises')
  await writeFile(outFile, JSON.stringify(templates, null, 2) + '\n', 'utf-8')
  console.log(`✓ ${templates.length} template(s) escritos em src/templates.json`)
}

scan()
