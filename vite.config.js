import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const favoritesFile = fileURLToPath(new URL('./favorites.json', import.meta.url))

async function readFavorites() {
  try {
    return JSON.parse(await readFile(favoritesFile, 'utf-8'))
  } catch {
    return []
  }
}

// Dev-only API so favorites survive across restarts/ports/browsers as a plain
// local JSON file instead of per-origin localStorage.
function favoritesApiPlugin() {
  return {
    name: 'favorites-api',
    configureServer(server) {
      server.middlewares.use('/api/favorites', async (req, res) => {
        if (req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(await readFavorites()))
          return
        }
        if (req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => (body += chunk))
          req.on('end', async () => {
            try {
              const ids = JSON.parse(body)
              await writeFile(favoritesFile, JSON.stringify(ids, null, 2) + '\n', 'utf-8')
              res.statusCode = 204
              res.end()
            } catch {
              res.statusCode = 400
              res.end()
            }
          })
          return
        }
        res.statusCode = 405
        res.end()
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), favoritesApiPlugin()],
})
