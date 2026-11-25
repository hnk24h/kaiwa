import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import cors from 'cors'
import { buildCatalog } from './catalog.mjs'
import { createStateStore } from './stateStore.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '..')

const MIME_TYPES = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.pdf': 'application/pdf',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
}

export function getDefaultMediaRoot() {
  if (process.env.MEDIA_ROOT) return process.env.MEDIA_ROOT
  if (process.platform === 'win32') return 'D:\\02. Tiếng Nhật\\luyennoi'
  return '/mnt/d/02. Tiếng Nhật/luyennoi'
}

export function createApp({ mediaRoot: initialMediaRoot, dataDir } = {}) {
  const resolvedDataDir = dataDir || path.join(PROJECT_ROOT, 'data')
  const store = createStateStore(resolvedDataDir)

  const persistedConfig = store.readConfig()
  let mediaRoot = initialMediaRoot || process.env.MEDIA_ROOT || persistedConfig.mediaRoot || getDefaultMediaRoot()

  const app = express()
  app.use(
    cors({
      exposedHeaders: ['Accept-Ranges', 'Content-Encoding', 'Content-Length', 'Content-Range'],
    })
  )
  app.use(express.json({ limit: '5mb' }))

  app.get('/api/health', (_req, res) => {
    const catalog = buildCatalog(mediaRoot)
    res.json({
      ok: true,
      mediaRoot: catalog.mediaRoot,
      mediaRootExists: catalog.mediaRootExists,
      bookCount: catalog.books.length,
    })
  })

  app.get('/api/catalog', (_req, res) => {
    const catalog = buildCatalog(mediaRoot)
    res.json(catalog)
  })

  app.get('/api/config', (_req, res) => {
    res.json({
      mediaRoot,
      mediaRootExists: Boolean(mediaRoot && fs.existsSync(mediaRoot)),
      defaultMediaRoot: getDefaultMediaRoot(),
    })
  })

  app.put('/api/config', (req, res) => {
    const nextRoot = typeof req.body?.mediaRoot === 'string' ? req.body.mediaRoot.trim() : ''
    if (!nextRoot) {
      return res.status(400).json({ error: 'mediaRoot is required' })
    }
    mediaRoot = nextRoot
    store.writeConfig({ mediaRoot })
    const catalog = buildCatalog(mediaRoot)
    return res.json({
      mediaRoot,
      mediaRootExists: catalog.mediaRootExists,
      bookCount: catalog.books.length,
    })
  })

  app.get('/api/state', (_req, res) => {
    res.json(store.readState())
  })

  app.put('/api/state', (req, res) => {
    const saved = store.writeState(req.body || {})
    res.json(saved)
  })

  function handleMediaRequest(req, res) {
    const relParam = typeof req.query.p === 'string' ? req.query.p : ''
    if (!relParam) {
      return res.status(400).json({ error: 'Missing query parameter p' })
    }

    const rootResolved = path.resolve(mediaRoot)
    const targetResolved = path.resolve(rootResolved, relParam)

    // Strict path traversal guard
    const rootWithSep = rootResolved.endsWith(path.sep) ? rootResolved : rootResolved + path.sep
    if (targetResolved !== rootResolved && !targetResolved.startsWith(rootWithSep)) {
      return res.status(403).json({ error: 'Forbidden path' })
    }

    if (!fs.existsSync(targetResolved)) {
      return res.status(404).json({ error: 'File not found' })
    }

    const stat = fs.statSync(targetResolved)
    if (!stat.isFile()) {
      return res.status(404).json({ error: 'Not a file' })
    }

    const ext = path.extname(targetResolved).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'
    const fileSize = stat.size

    res.setHeader('Content-Type', contentType)
    res.setHeader('Accept-Ranges', 'bytes')
    res.setHeader('Cache-Control', 'public, max-age=3600')

    const rangeHeader = req.headers.range
    if (rangeHeader) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim())
      if (!match) {
        res.setHeader('Content-Range', `bytes */${fileSize}`)
        return res.status(416).end()
      }

      const start = match[1] ? Number(match[1]) : 0
      const end = match[2] ? Math.min(Number(match[2]), fileSize - 1) : fileSize - 1

      if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= fileSize) {
        res.setHeader('Content-Range', `bytes */${fileSize}`)
        return res.status(416).end()
      }

      const chunkSize = end - start + 1
      res.status(206)
      res.setHeader('Content-Range', `bytes ${start}-${end}/${fileSize}`)
      res.setHeader('Content-Length', String(chunkSize))

      if (req.method === 'HEAD') {
        return res.end()
      }

      const stream = fs.createReadStream(targetResolved, { start, end })
      stream.on('error', () => {
        if (!res.headersSent) res.status(500).end()
      })
      return stream.pipe(res)
    }

    res.status(200)
    res.setHeader('Content-Length', String(fileSize))
    if (req.method === 'HEAD') {
      return res.end()
    }

    const stream = fs.createReadStream(targetResolved)
    stream.on('error', () => {
      if (!res.headersSent) res.status(500).end()
    })
    return stream.pipe(res)
  }

  app.head('/api/media', handleMediaRequest)
  app.get('/api/media', handleMediaRequest)

  // Serve built frontend in production
  const distDir = path.join(PROJECT_ROOT, 'dist')
  if (fs.existsSync(path.join(distDir, 'index.html'))) {
    app.use(express.static(distDir))
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api')) return next()
      return res.sendFile(path.join(distDir, 'index.html'))
    })
  }

  return app
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === __filename
if (isMain) {
  const port = Number(process.env.PORT || 3100)
  const app = createApp()
  app.listen(port, () => {
    console.log(`Kaiwa Shadowing server listening on http://localhost:${port}`)
    console.log(`Media root: ${process.env.MEDIA_ROOT || getDefaultMediaRoot()}`)
  })
}
