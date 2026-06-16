import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { initDatabase, runQuery, getQuery, getOne } from './database'

let win: BrowserWindow | null = null

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 768,
    title: '母婴二手回收作业系统',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    win.loadFile(join(__dirname, '../dist/index.html'))
  }

  win.on('closed', () => {
    win = null
  })
}

app.whenReady().then(async () => {
  await initDatabase()
  setupIpcHandlers()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

function mapToCamel(row: any): any {
  if (!row) return row
  const mapped: any = {}
  for (const key of Object.keys(row)) {
    const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase())
    mapped[camelKey] = row[key]
  }
  return mapped
}

function mapArrayToCamel(rows: any[]): any[] {
  return rows.map(mapToCamel)
}

function setupIpcHandlers() {
  ipcMain.handle('get-items', (_e, filters) => {
    let sql = 'SELECT * FROM items WHERE 1=1'
    const params: any[] = []
    if (filters?.status) {
      const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
      const placeholders = statuses.map(() => '?').join(', ')
      sql += ` AND status IN (${placeholders})`
      params.push(...statuses)
    }
    if (filters?.category) {
      sql += ' AND category = ?'
      params.push(filters.category)
    }
    if (filters?.assignedTo) {
      sql += ' AND assigned_to = ?'
      params.push(filters.assignedTo)
    }
    sql += ' ORDER BY created_at DESC'
    return mapArrayToCamel(getQuery(sql, params))
  })

  ipcMain.handle('get-item', (_e, id) => {
    const row = getOne('SELECT * FROM items WHERE id = ?', [id])
    return mapToCamel(row)
  })

  ipcMain.handle('create-item', (_e, item) => {
    runQuery(`
      INSERT INTO items (id, code, name, category, brand, model, received_date, 
        source, status, assigned_to, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      item.id, item.code, item.name, item.category, item.brand, item.model,
      item.receivedDate, item.source, item.status, item.assignedTo,
      item.notes, item.createdAt, item.updatedAt
    ])
    return item
  })

  ipcMain.handle('update-item', (_e, id, updates) => {
    const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ')
    const values = Object.values(updates)
    values.push(id)
    runQuery(`UPDATE items SET ${fields} WHERE id = ?`, values)
    const row = getOne('SELECT * FROM items WHERE id = ?', [id])
    return mapToCamel(row)
  })

  ipcMain.handle('delete-item', (_e, id) => {
    runQuery('DELETE FROM items WHERE id = ?', [id])
    return { success: true }
  })

  ipcMain.handle('get-work-orders', (_e, itemId) => {
    const rows = getQuery('SELECT * FROM work_orders WHERE item_id = ? ORDER BY created_at DESC', [itemId])
    const mapped = mapArrayToCamel(rows)
    return mapped.map((wo: any) => ({
      ...wo,
      partsChecklist: wo.partsChecklist ? JSON.parse(wo.partsChecklist) : undefined,
      cleaningRestrictions: wo.cleaningRestrictions ? JSON.parse(wo.cleaningRestrictions) : undefined,
      partsMissing: wo.partsMissing ? JSON.parse(wo.partsMissing) : undefined
    }))
  })

  ipcMain.handle('create-work-order', (_e, order) => {
    runQuery(`
      INSERT INTO work_orders (id, item_id, category, worker_id, start_time, 
        end_time, total_minutes, rework_count, parts_checklist, cleaning_restrictions,
        wear_level, mold_level, odor_level, parts_missing, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      order.id, order.itemId, order.category, order.workerId, order.startTime,
      order.endTime, order.totalMinutes, order.reworkCount,
      JSON.stringify(order.partsChecklist), JSON.stringify(order.cleaningRestrictions),
      order.wearLevel, order.moldLevel, order.odorLevel,
      JSON.stringify(order.partsMissing), order.notes, order.createdAt
    ])
    return order
  })

  ipcMain.handle('update-work-order', (_e, id, updates) => {
    const dbUpdates: any = { ...updates }
    if (dbUpdates.partsChecklist) dbUpdates.parts_checklist = JSON.stringify(dbUpdates.partsChecklist)
    if (dbUpdates.cleaningRestrictions) dbUpdates.cleaning_restrictions = JSON.stringify(dbUpdates.cleaningRestrictions)
    if (dbUpdates.partsMissing) dbUpdates.parts_missing = JSON.stringify(dbUpdates.partsMissing)
    delete dbUpdates.partsChecklist
    delete dbUpdates.cleaningRestrictions
    delete dbUpdates.partsMissing

    const fields = Object.keys(dbUpdates).map(k => `${k} = ?`).join(', ')
    const values = Object.values(dbUpdates)
    values.push(id)
    runQuery(`UPDATE work_orders SET ${fields} WHERE id = ?`, values)
    const row = getOne('SELECT * FROM work_orders WHERE id = ?', [id])
    const mapped = mapToCamel(row)
    return {
      ...mapped,
      partsChecklist: mapped.partsChecklist ? JSON.parse(mapped.partsChecklist) : undefined,
      cleaningRestrictions: mapped.cleaningRestrictions ? JSON.parse(mapped.cleaningRestrictions) : undefined,
      partsMissing: mapped.partsMissing ? JSON.parse(mapped.partsMissing) : undefined
    }
  })

  ipcMain.handle('get-photos', (_e, itemId) => {
    const rows = getQuery('SELECT * FROM photos WHERE item_id = ? ORDER BY created_at ASC', [itemId])
    return mapArrayToCamel(rows)
  })

  ipcMain.handle('add-photo', (_e, photo) => {
    runQuery(`
      INSERT INTO photos (id, item_id, type, data_url, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [photo.id, photo.itemId, photo.type, photo.dataUrl, photo.notes, photo.createdAt])
    return photo
  })

  ipcMain.handle('delete-photo', (_e, id) => {
    runQuery('DELETE FROM photos WHERE id = ?', [id])
    return { success: true }
  })

  ipcMain.handle('get-inspections', (_e, itemId) => {
    const rows = getQuery('SELECT * FROM inspections WHERE item_id = ? ORDER BY created_at DESC', [itemId])
    return mapArrayToCamel(rows)
  })

  ipcMain.handle('create-inspection', (_e, inspection) => {
    runQuery(`
      INSERT INTO inspections (id, item_id, inspector_id, result, wear_score,
        mold_score, odor_score, parts_score, final_score, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      inspection.id, inspection.itemId, inspection.inspectorId, inspection.result,
      inspection.wearScore, inspection.moldScore, inspection.odorScore,
      inspection.partsScore, inspection.finalScore, inspection.notes, inspection.createdAt
    ])
    return inspection
  })

  ipcMain.handle('get-seals', (_e, itemId) => {
    const rows = getQuery('SELECT * FROM seals WHERE item_id = ? ORDER BY created_at DESC', [itemId])
    const mapped = mapArrayToCamel(rows)
    return mapped.map((s: any) => ({
      ...s,
      historyCard: s.historyCard ? JSON.parse(s.historyCard) : undefined
    }))
  })

  ipcMain.handle('create-seal', (_e, seal) => {
    runQuery(`
      INSERT INTO seals (id, item_id, seal_code, operator_id, history_card,
        created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `, [seal.id, seal.itemId, seal.sealCode, seal.operatorId,
      JSON.stringify(seal.historyCard), seal.createdAt])
    return seal
  })

  ipcMain.handle('get-anomalies', (_e, filters) => {
    let sql = 'SELECT * FROM anomalies WHERE 1=1'
    const params: any[] = []
    if (filters?.type) {
      sql += ' AND type = ?'
      params.push(filters.type)
    }
    if (filters?.status) {
      sql += ' AND status = ?'
      params.push(filters.status)
    }
    sql += ' ORDER BY created_at DESC'
    const rows = getQuery(sql, params)
    return mapArrayToCamel(rows)
  })

  ipcMain.handle('create-anomaly', (_e, anomaly) => {
    runQuery(`
      INSERT INTO anomalies (id, item_id, type, title, description, 
        reported_by, status, resolution, created_at, resolved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      anomaly.id, anomaly.itemId, anomaly.type, anomaly.title,
      anomaly.description, anomaly.reportedBy, anomaly.status,
      anomaly.resolution, anomaly.createdAt, anomaly.resolvedAt
    ])
    return anomaly
  })

  ipcMain.handle('update-anomaly', (_e, id, updates) => {
    const dbUpdates: any = { ...updates }
    const fields = Object.keys(dbUpdates).map(k => `${k} = ?`).join(', ')
    const values = Object.values(dbUpdates)
    values.push(id)
    runQuery(`UPDATE anomalies SET ${fields} WHERE id = ?`, values)
    const row = getOne('SELECT * FROM anomalies WHERE id = ?', [id])
    return mapToCamel(row)
  })

  ipcMain.handle('get-workers', () => {
    const rows = getQuery('SELECT * FROM workers ORDER BY name ASC')
    return mapArrayToCamel(rows)
  })

  ipcMain.handle('create-worker', (_e, worker) => {
    runQuery(`
      INSERT INTO workers (id, name, role, status, created_at)
      VALUES (?, ?, ?, ?, ?)
    `, [worker.id, worker.name, worker.role, worker.status, worker.createdAt])
    return worker
  })

  ipcMain.handle('get-statistics', (_e, params) => {
    const { startDate, endDate } = params || {}
    let dateFilter = ''
    const sqlParams: any[] = []
    if (startDate && endDate) {
      dateFilter = 'WHERE items.created_at BETWEEN ? AND ?'
      sqlParams.push(startDate, endDate)
    }

    const countRow = getOne(`SELECT COUNT(*) as count FROM items ${dateFilter}`, sqlParams)
    const totalItems = countRow ? countRow.count : 0

    const byStatus = getQuery(`
      SELECT status, COUNT(*) as count FROM items ${dateFilter} GROUP BY status
    `, sqlParams)

    const byCategory = getQuery(`
      SELECT category, COUNT(*) as count FROM items ${dateFilter} GROUP BY category
    `, sqlParams)

    const workerParams = startDate && endDate ? [startDate, endDate] : []
    const workerStats = getQuery(`
      SELECT 
        w.id as worker_id,
        w.name as worker_name,
        COUNT(DISTINCT wo.item_id) as total_items,
        SUM(CASE WHEN i.status IN ('SEALED','SOLD') THEN 1 ELSE 0 END) as passed,
        SUM(wo.rework_count) as total_reworks,
        AVG(wo.total_minutes) as avg_minutes
      FROM workers w
      LEFT JOIN work_orders wo ON w.id = wo.worker_id
      LEFT JOIN items i ON wo.item_id = i.id
      ${startDate && endDate ? 'WHERE wo.created_at BETWEEN ? AND ?' : ''}
      GROUP BY w.id, w.name
    `, workerParams)

    const avgParams = startDate && endDate ? [startDate, endDate] : []
    const avgMinutesByCategory = getQuery(`
      SELECT category, AVG(total_minutes) as avg_minutes
      FROM work_orders
      WHERE total_minutes IS NOT NULL
      ${startDate && endDate ? 'AND created_at BETWEEN ? AND ?' : ''}
      GROUP BY category
    `, avgParams)

    return {
      totalItems,
      byStatus: mapArrayToCamel(byStatus),
      byCategory: mapArrayToCamel(byCategory),
      workerStats: mapArrayToCamel(workerStats),
      avgMinutesByCategory: mapArrayToCamel(avgMinutesByCategory)
    }
  })

  ipcMain.handle('get-category-workflow', (_e, category) => {
    const rows = getQuery('SELECT * FROM category_workflows WHERE category = ? ORDER BY step_order ASC', [category])
    return mapArrayToCamel(rows)
  })

  ipcMain.handle('get-category-parts', (_e, category) => {
    const row = getOne('SELECT parts FROM category_parts WHERE category = ?', [category])
    return row ? JSON.parse(row.parts) : []
  })

  ipcMain.handle('get-next-item-code', () => {
    const rows = getQuery(`
      SELECT code FROM items 
      WHERE code LIKE 'BC-____-%'
    `)
    const year = new Date().getFullYear()
    let maxSeq = 0
    rows.forEach((row: any) => {
      const match = row.code.match(/BC-\d{4}-(\d+)/)
      if (match) {
        const seq = parseInt(match[1], 10)
        if (seq > maxSeq) {
          maxSeq = seq
        }
      }
    })
    const nextSeq = maxSeq + 1
    const padded = nextSeq.toString().padStart(4, '0')
    return `BC-${year}-${padded}`
  })
}
