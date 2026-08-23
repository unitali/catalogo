import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import templates from './templates.json'

const FAVORITES_KEY = 'previewer:favorites'
const NOTES_KEY = 'previewer:notes'
const VISITED_KEY = 'previewer:visited'
const NOTE_DEBOUNCE_MS = 400

const VIEWPORTS = {
  desktop: { label: 'Desktop', width: '100%' },
  tablet: { label: 'Tablet', width: '768px' },
  mobile: { label: 'Mobile', width: '375px' },
}

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

export default function App() {
  const [search, setSearch] = useState('')
  const [filterMode, setFilterMode] = useState('all') // all | favorites | unvisited
  const [selectedId, setSelectedId] = useState(null)
  const [selectedUrl, setSelectedUrl] = useState(null)
  const [viewport, setViewport] = useState('desktop')
  const [iframeKey, setIframeKey] = useState(0)
  const [favorites, setFavorites] = useState(() => loadJSON(FAVORITES_KEY, []))
  const [notes, setNotes] = useState(() => loadJSON(NOTES_KEY, {}))
  const [visited, setVisited] = useState(() => loadJSON(VISITED_KEY, []))
  const [notesOpen, setNotesOpen] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')

  const searchInputRef = useRef(null)
  const noteDebounceRef = useRef(null)

  useEffect(() => {
    fetch('/api/favorites')
      .then((r) => (r.ok ? r.json() : null))
      .then((ids) => {
        if (Array.isArray(ids)) setFavorites(ids)
      })
      .catch(() => {})
    // runs once on mount: favorites.json is the source of truth when the dev API is available
  }, [])

  useEffect(() => {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites))
    fetch('/api/favorites', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(favorites),
    }).catch(() => {})
  }, [favorites])

  useEffect(() => {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes))
  }, [notes])

  useEffect(() => {
    localStorage.setItem(VISITED_KEY, JSON.stringify(visited))
  }, [visited])

  useEffect(() => {
    setNoteDraft(selectedId ? (notes[selectedId] ?? '') : '')
  }, [selectedId]) // eslint: intentionally excludes `notes` so this doesn't clobber the draft while typing

  useEffect(() => {
    if (!selectedId) return
    if (noteDebounceRef.current) clearTimeout(noteDebounceRef.current)
    noteDebounceRef.current = setTimeout(() => {
      setNotes((prev) => (prev[selectedId] === noteDraft ? prev : { ...prev, [selectedId]: noteDraft }))
    }, NOTE_DEBOUNCE_MS)
    return () => clearTimeout(noteDebounceRef.current)
  }, [noteDraft, selectedId])

  const filtered = useMemo(() => {
    let list = templates
    if (filterMode === 'favorites') list = list.filter((t) => favorites.includes(t.id))
    if (filterMode === 'unvisited') list = list.filter((t) => !visited.includes(t.id))
    const q = search.trim().toLowerCase()
    if (q) list = list.filter((t) => t.name.toLowerCase().includes(q))
    return list
  }, [filterMode, favorites, visited, search])

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedId) ?? null,
    [selectedId],
  )

  const selectTemplate = useCallback((id) => {
    const t = templates.find((x) => x.id === id)
    if (!t) return
    setSelectedId(id)
    setSelectedUrl(t.entry)
    setIframeKey((k) => k + 1)
    setVisited((prev) => (prev.includes(id) ? prev : [...prev, id]))
  }, [])

  const toggleFavorite = useCallback((id) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }, [])

  const copyFavorites = useCallback(() => {
    const names = templates.filter((t) => favorites.includes(t.id)).map((t) => t.id).join('\n')
    navigator.clipboard?.writeText(names)
  }, [favorites])

  useEffect(() => {
    function handleKeyDown(e) {
      const tag = document.activeElement?.tagName
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      if (e.key === '/' && !isTyping) {
        e.preventDefault()
        searchInputRef.current?.focus()
        return
      }

      if (isTyping) return

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        if (filtered.length === 0) return
        e.preventDefault()
        const currentIndex = filtered.findIndex((t) => t.id === selectedId)
        let nextIndex
        if (currentIndex === -1) {
          nextIndex = 0
        } else if (e.key === 'ArrowDown') {
          nextIndex = Math.min(currentIndex + 1, filtered.length - 1)
        } else {
          nextIndex = Math.max(currentIndex - 1, 0)
        }
        selectTemplate(filtered[nextIndex].id)
        return
      }

      if (e.key === 'f' && selectedId) {
        toggleFavorite(selectedId)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [filtered, selectedId, selectTemplate, toggleFavorite])

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="sidebar-search">
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Buscar template…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="filter-tabs">
          <button className={filterMode === 'all' ? 'active' : ''} onClick={() => setFilterMode('all')}>
            Todos
          </button>
          <button className={filterMode === 'favorites' ? 'active' : ''} onClick={() => setFilterMode('favorites')}>
            Escolhidos
          </button>
          <button className={filterMode === 'unvisited' ? 'active' : ''} onClick={() => setFilterMode('unvisited')}>
            Não vistos
          </button>
        </div>

        <ul className="template-list">
          {filtered.map((t) => (
            <li key={t.id}>
              <button
                className={'template-item' + (t.id === selectedId ? ' selected' : '')}
                onClick={() => selectTemplate(t.id)}
              >
                <span className="template-name">{t.name}</span>
                <span className="template-pages">
                  {t.pages.length} página{t.pages.length === 1 ? '' : 's'}
                </span>
                <span
                  className={'star' + (favorites.includes(t.id) ? ' active' : '')}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleFavorite(t.id)
                  }}
                  role="button"
                  aria-label="Marcar como escolhido para migração"
                >
                  ★
                </span>
              </button>
            </li>
          ))}
          {filtered.length === 0 && <li className="empty-list">Nenhum template encontrado.</li>}
        </ul>

        <div className="sidebar-footer">
          <span>
            {favorites.length} de {templates.length} escolhidos
          </span>
          <button onClick={copyFavorites} disabled={favorites.length === 0}>
            Copiar escolhidos
          </button>
        </div>
      </aside>

      <section className="preview-area">
        {selectedTemplate ? (
          <>
            <div className="preview-toolbar">
              <span className="preview-title">{selectedTemplate.name}</span>

              <select value={selectedUrl ?? ''} onChange={(e) => setSelectedUrl(e.target.value)}>
                {selectedTemplate.pages.map((p) => (
                  <option key={p.url} value={p.url}>
                    {p.label}
                  </option>
                ))}
              </select>

              <div className="viewport-buttons">
                {Object.entries(VIEWPORTS).map(([key, v]) => (
                  <button
                    key={key}
                    className={viewport === key ? 'active' : ''}
                    onClick={() => setViewport(key)}
                  >
                    {v.label}
                  </button>
                ))}
              </div>

              <button onClick={() => setIframeKey((k) => k + 1)} title="Recarregar preview">
                ⟳
              </button>
              <button onClick={() => window.open(selectedUrl, '_blank', 'noopener')} title="Abrir em nova aba">
                ↗
              </button>
              <button
                className={'star' + (favorites.includes(selectedTemplate.id) ? ' active' : '')}
                onClick={() => toggleFavorite(selectedTemplate.id)}
                title="Marcar/desmarcar como escolhido"
              >
                ★
              </button>
            </div>

            <div className="preview-frame-wrap">
              <div className="preview-frame-inner" style={{ width: VIEWPORTS[viewport].width }}>
                <iframe key={iframeKey} src={selectedUrl} title={selectedTemplate.name} />
              </div>
            </div>

            <div className={'notes-panel' + (notesOpen ? ' open' : '')}>
              <button className="notes-toggle" onClick={() => setNotesOpen((o) => !o)}>
                {notesOpen ? '▾' : '▸'} Notas
              </button>
              {notesOpen && (
                <textarea
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="Ex: usa jQuery, vai dar trabalho…"
                />
              )}
            </div>
          </>
        ) : (
          <div className="empty-state">
            <h2>Nenhum template selecionado</h2>
            <p>
              Adicione pastas com HTML em <code>public/templates/</code> e rode <code>npm run scan</code> (ou
              reinicie o <code>npm run dev</code>) para vê-las aqui.
            </p>
          </div>
        )}
      </section>
    </div>
  )
}
