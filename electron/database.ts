import initSqlJs, { Database } from 'sql.js'
import { app } from 'electron'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import * as fs from 'fs'

let db: Database | null = null
let SQL: any = null

export function getDb(): Database {
  if (!db) {
    throw new Error('Database not initialized')
  }
  return db
}

export async function initDatabase() {
  SQL = await initSqlJs()
  const dbPath = join(app.getPath('userData'), 'babycare-recycle.db')

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath)
    db = new SQL.Database(fileBuffer)
  } else {
    db = new SQL.Database()
  }

  createTables()
  seedInitialData()
  saveDatabase()
}

function saveDatabase() {
  if (!db) return
  const dbPath = join(app.getPath('userData'), 'babycare-recycle.db')
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(dbPath, buffer)
}

function createTables() {
  const db = getDb()

  db.run(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      brand TEXT,
      model TEXT,
      received_date TEXT NOT NULL,
      source TEXT,
      status TEXT NOT NULL DEFAULT 'PENDING',
      assigned_to TEXT,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS work_orders (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      category TEXT NOT NULL,
      worker_id TEXT,
      start_time TEXT,
      end_time TEXT,
      total_minutes INTEGER,
      rework_count INTEGER DEFAULT 0,
      parts_checklist TEXT,
      cleaning_restrictions TEXT,
      wear_level TEXT,
      mold_level TEXT,
      odor_level TEXT,
      parts_missing TEXT,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      type TEXT NOT NULL,
      data_url TEXT NOT NULL,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS inspections (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      inspector_id TEXT NOT NULL,
      result TEXT NOT NULL,
      wear_score INTEGER,
      mold_score INTEGER,
      odor_score INTEGER,
      parts_score INTEGER,
      final_score INTEGER,
      notes TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS seals (
      id TEXT PRIMARY KEY,
      item_id TEXT NOT NULL,
      seal_code TEXT UNIQUE NOT NULL,
      operator_id TEXT NOT NULL,
      history_card TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS anomalies (
      id TEXT PRIMARY KEY,
      item_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      reported_by TEXT,
      status TEXT NOT NULL DEFAULT 'OPEN',
      resolution TEXT,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS workers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS category_workflows (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      step_order INTEGER NOT NULL,
      step_name TEXT NOT NULL,
      description TEXT,
      required_time_minutes INTEGER,
      tools TEXT,
      UNIQUE(category, step_order)
    );

    CREATE TABLE IF NOT EXISTS category_parts (
      id TEXT PRIMARY KEY,
      category TEXT UNIQUE NOT NULL,
      parts TEXT NOT NULL
    );
  `)

  saveDatabase()
}

function seedInitialData() {
  const db = getDb()

  const workerCount = db.exec('SELECT COUNT(*) as count FROM workers')[0].values[0][0]
  if (workerCount === 0) {
    const now = new Date().toISOString()
    db.run('INSERT INTO workers (id, name, role, status, created_at) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), '张清洗', 'CLEANER', 'ACTIVE', now])
    db.run('INSERT INTO workers (id, name, role, status, created_at) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), '李复检', 'INSPECTOR', 'ACTIVE', now])
    db.run('INSERT INTO workers (id, name, role, status, created_at) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), '王仓管', 'OPERATOR', 'ACTIVE', now])
    db.run('INSERT INTO workers (id, name, role, status, created_at) VALUES (?, ?, ?, ?, ?)',
      [uuidv4(), '赵班长', 'SUPERVISOR', 'ACTIVE', now])
    saveDatabase()
  }

  const workflowCount = db.exec('SELECT COUNT(*) as count FROM category_workflows')[0].values[0][0]
  if (workflowCount === 0) {
    const insertWorkflow = (category: string, step: number, name: string, desc: string, time: number, tools: string) => {
      db.run(`INSERT INTO category_workflows (id, category, step_order, step_name, description, required_time_minutes, tools)
              VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), category, step, name, desc, time, tools])
    }

    insertWorkflow('STROLLER', 1, '整体拆卸', '拆卸车轮、座椅、遮阳篷、安全带', 10, '螺丝刀、扳手')
    insertWorkflow('STROLLER', 2, '织物清洗', '座椅布套、遮阳篷可水洗，水温≤40℃', 30, '洗衣液、软刷')
    insertWorkflow('STROLLER', 3, '车架擦拭', '金属/塑料车架用湿布擦拭，不可浸泡', 15, '湿布、消毒剂')
    insertWorkflow('STROLLER', 4, '零件清洁', '车轮、轴承、卡扣去污除锈', 20, '刷子、润滑油')
    insertWorkflow('STROLLER', 5, '组装检查', '重新组装，检查各部件功能', 15, '螺丝刀、扳手')

    insertWorkflow('TOY', 1, '分类检查', '区分电子玩具、塑料玩具、毛绒玩具', 5, '手套')
    insertWorkflow('TOY', 2, '表面清洁', '根据材质选择擦拭/水洗方式', 20, '抹布、清洁剂')
    insertWorkflow('TOY', 3, '消毒处理', '电子类用酒精棉，非金属类可紫外线', 15, '酒精棉、紫外线灯')
    insertWorkflow('TOY', 4, '功能测试', '检查发声、发光、活动部件', 10, '电池、测试仪')
    insertWorkflow('TOY', 5, '细节处理', '缝隙、边角深度清洁', 10, '棉签、小刷子')

    insertWorkflow('FEEDING', 1, '完全拆解', '拆分瓶身、奶嘴、螺帽、吸管、防胀气阀', 5, '手')
    insertWorkflow('FEEDING', 2, '专用清洁剂清洗', '用奶瓶清洁剂清洗所有部件', 15, '奶瓶刷、清洁剂')
    insertWorkflow('FEEDING', 3, '高温消毒', '煮沸消毒5-10分钟或蒸汽消毒', 20, '消毒锅')
    insertWorkflow('FEEDING', 4, '检查破损', '检查奶嘴是否开裂、瓶身是否有划痕', 5, '放大镜')
    insertWorkflow('FEEDING', 5, '沥干装配', '自然沥干后重新组装', 10, '沥干架')

    insertWorkflow('CLOTHING', 1, '分类检查', '检查尺码、面料、污渍情况', 5, '手套')
    insertWorkflow('CLOTHING', 2, '污渍预处理', '领口、袖口、食物污渍重点处理', 15, '衣领净、软刷')
    insertWorkflow('CLOTHING', 3, '清洗', '根据水洗标要求选择洗涤方式', 30, '洗衣机、洗衣液')
    insertWorkflow('CLOTHING', 4, '消毒', '60℃热水或专用消毒剂', 20, '消毒烘干机')
    insertWorkflow('CLOTHING', 5, '熨烫整理', '熨烫平整，检查线头、配件', 15, '熨斗、剪刀')

    saveDatabase()
  }

  const partsCount = db.exec('SELECT COUNT(*) as count FROM category_parts')[0].values[0][0]
  if (partsCount === 0) {
    db.run('INSERT INTO category_parts (id, category, parts) VALUES (?, ?, ?)',
      [uuidv4(), 'STROLLER', JSON.stringify([
        '车架主体', '前轮×2', '后轮×2', '座椅布套', '遮阳篷',
        '安全带', '置物篮', '扶手', '脚托', '刹车装置'
      ])])
    db.run('INSERT INTO category_parts (id, category, parts) VALUES (?, ?, ?)',
      [uuidv4(), 'TOY', JSON.stringify([
        '主体', '电池盖', '电池', '说明书', '包装盒', '配件'
      ])])
    db.run('INSERT INTO category_parts (id, category, parts) VALUES (?, ?, ?)',
      [uuidv4(), 'FEEDING', JSON.stringify([
        '瓶身', '奶嘴', '螺帽', '吸管', '防胀气阀', '手柄', '防尘盖'
      ])])
    db.run('INSERT INTO category_parts (id, category, parts) VALUES (?, ?, ?)',
      [uuidv4(), 'CLOTHING', JSON.stringify([
        '主体', '纽扣', '拉链', '腰带', '装饰件', '吊牌'
      ])])
    saveDatabase()
  }

  const itemCount = db.exec('SELECT COUNT(*) as count FROM items')[0].values[0][0]
  if (itemCount === 0) {
    seedSampleItems()
  }
}

function seedSampleItems() {
  const db = getDb()
  const now = new Date()

  const workers = db.exec('SELECT id, name FROM workers')[0].values
  const cleaner = workers.find((w: any) => w[1] === '张清洗')
  const inspector = workers.find((w: any) => w[1] === '李复检')

  const sampleItems = [
    {
      code: 'BC-2026-0001',
      name: '好孩子婴儿推车',
      category: 'STROLLER',
      brand: '好孩子',
      model: 'C400',
      status: 'PENDING',
      notes: '车身有轻微污渍，车轮磨损',
      daysAgo: 0
    },
    {
      code: 'BC-2026-0002',
      name: '费雪声光安抚海马',
      category: 'TOY',
      brand: '费雪',
      model: 'DGH82',
      status: 'CLEANING',
      assignedTo: cleaner?.[0],
      notes: '毛绒部分有污渍，功能正常',
      daysAgo: 0
    },
    {
      code: 'BC-2026-0003',
      name: '贝亲宽口径玻璃奶瓶',
      category: 'FEEDING',
      brand: '贝亲',
      model: 'AA91',
      status: 'INSPECTING',
      assignedTo: inspector?.[0],
      notes: '瓶身有轻微划痕，奶嘴需更换',
      daysAgo: 1
    },
    {
      code: 'BC-2026-0004',
      name: '英氏婴儿连体衣',
      category: 'CLOTHING',
      brand: '英氏',
      model: '66cm',
      status: 'PENDING',
      notes: '9成新，轻微污渍',
      daysAgo: 1
    },
    {
      code: 'BC-2026-0005',
      name: 'UPPAbaby Cruz婴儿车',
      category: 'STROLLER',
      brand: 'UPPAbaby',
      model: 'Cruz V2',
      status: 'SEALED',
      notes: '高端车型，已完成处理',
      daysAgo: 3
    },
    {
      code: 'BC-2026-0006',
      name: '乐高得宝大颗粒积木',
      category: 'TOY',
      brand: '乐高',
      model: '10913',
      status: 'CLEANING',
      assignedTo: cleaner?.[0],
      notes: '缺3块积木，已登记',
      daysAgo: 1
    },
    {
      code: 'BC-2026-0007',
      name: '可么多么硅胶奶瓶',
      category: 'FEEDING',
      brand: '可么多么',
      model: '250ml',
      status: 'PENDING',
      notes: '硅胶瓶身，注意清洁方式',
      daysAgo: 0
    },
    {
      code: 'BC-2026-0008',
      name: 'Carters婴儿睡袋',
      category: 'CLOTHING',
      brand: 'Carters',
      model: '9M',
      status: 'INSPECTING',
      assignedTo: inspector?.[0],
      notes: '有轻微霉点，需重点处理',
      daysAgo: 2
    },
  ]

  sampleItems.forEach(item => {
    const date = new Date(now.getTime() - item.daysAgo * 24 * 60 * 60 * 1000)
    const dateStr = date.toISOString().split('T')[0]
    const isoDate = date.toISOString()
    db.run(`INSERT INTO items (id, code, name, category, brand, model, received_date, 
                source, status, assigned_to, notes, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        item.code,
        item.name,
        item.category,
        item.brand,
        item.model,
        dateStr,
        '线下门店回收',
        item.status,
        item.assignedTo || null,
        item.notes,
        isoDate,
        isoDate
      ])
  })

  const anomalyCount = db.exec('SELECT COUNT(*) as count FROM anomalies')[0].values[0][0]
  if (anomalyCount === 0) {
    const nowIso = new Date().toISOString()
    db.run(`INSERT INTO anomalies (id, item_id, type, title, description, 
                reported_by, status, resolution, created_at, resolved_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), null, 'RECALL', '某品牌XXX型号婴儿车召回',
        '接到品牌方通知，2024-2025年生产的XXX型号婴儿车存在刹车安全隐患，需全部召回处理。',
        '赵班长', 'OPEN', null, nowIso, null
      ])
    db.run(`INSERT INTO anomalies (id, item_id, type, title, description, 
                reported_by, status, resolution, created_at, resolved_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), null, 'COUNTERFEIT', '疑似仿品贝亲奶瓶',
        '近期回收的一批贝亲奶瓶中发现疑似仿品，特征为瓶身logo模糊、螺帽螺纹不规整。',
        '李复检', 'OPEN', null, nowIso, null
      ])
  }

  saveDatabase()
}

export function runQuery(sql: string, params: any[] = []) {
  const db = getDb()
  try {
    const stmt = db.prepare(sql)
    stmt.run(params)
    saveDatabase()
    return { changes: db.getRowsModified() }
  } catch (error) {
    console.error('Query error:', sql, error)
    throw error
  }
}

export function getQuery(sql: string, params: any[] = []) {
  const db = getDb()
  try {
    const results = db.exec(sql, params)
    if (results.length === 0) return []

    const columns = results[0].columns
    const values = results[0].values

    return values.map((row: any[]) => {
      const obj: any = {}
      columns.forEach((col: string, i: number) => {
        obj[col] = row[i]
      })
      return obj
    })
  } catch (error) {
    console.error('Query error:', sql, error)
    throw error
  }
}

export function getOne(sql: string, params: any[] = []) {
  const results = getQuery(sql, params)
  return results.length > 0 ? results[0] : null
}
