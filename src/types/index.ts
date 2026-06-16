export type ItemStatus = 'PENDING' | 'CLEANING' | 'INSPECTING' | 'SEALED' | 'SOLD' | 'RETURNED' | 'ANOMALY'

export type ItemCategory = 'STROLLER' | 'TOY' | 'FEEDING' | 'CLOTHING'

export type ConditionLevel = 'NONE' | 'MILD' | 'MODERATE' | 'SEVERE'

export type InspectionResult = 'SELLABLE' | 'DISCOUNTED' | 'RETURNED' | 'REWORK'

export type AnomalyType = 'RECALL' | 'COUNTERFEIT' | 'SAFETY' | 'DAMAGE' | 'OTHER'

export type AnomalyStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'

export type WorkerRole = 'CLEANER' | 'INSPECTOR' | 'OPERATOR' | 'SUPERVISOR'

export interface Item {
  id: string
  code: string
  name: string
  category: ItemCategory
  brand?: string
  model?: string
  receivedDate: string
  source?: string
  status: ItemStatus
  assignedTo?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface WorkOrder {
  id: string
  itemId: string
  category: ItemCategory
  workerId?: string
  startTime?: string
  endTime?: string
  totalMinutes?: number
  reworkCount: number
  partsChecklist?: Record<string, boolean>
  cleaningRestrictions?: string[]
  wearLevel?: ConditionLevel
  moldLevel?: ConditionLevel
  odorLevel?: ConditionLevel
  partsMissing?: string[]
  notes?: string
  createdAt: string
}

export interface Photo {
  id: string
  itemId: string
  type: 'BEFORE' | 'AFTER' | 'DETAIL'
  dataUrl: string
  notes?: string
  createdAt: string
}

export interface Inspection {
  id: string
  itemId: string
  inspectorId: string
  result: InspectionResult
  wearScore?: number
  moldScore?: number
  odorScore?: number
  partsScore?: number
  finalScore?: number
  notes?: string
  createdAt: string
}

export interface Seal {
  id: string
  itemId: string
  sealCode: string
  operatorId: string
  historyCard: HistoryCard
  createdAt: string
}

export interface HistoryCard {
  item: Item
  workOrders: WorkOrder[]
  inspections: Inspection[]
  photos: Photo[]
  sealCode: string
  sealedAt: string
  operatorName: string
}

export interface Anomaly {
  id: string
  itemId?: string
  type: AnomalyType
  title: string
  description?: string
  reportedBy?: string
  status: AnomalyStatus
  resolution?: string
  createdAt: string
  resolvedAt?: string
}

export interface Worker {
  id: string
  name: string
  role: WorkerRole
  status: 'ACTIVE' | 'INACTIVE'
  createdAt: string
}

export interface WorkflowStep {
  id: string
  category: ItemCategory
  stepOrder: number
  stepName: string
  description?: string
  requiredTimeMinutes?: number
  tools?: string
}

export interface Statistics {
  totalItems: number
  byStatus: { status: ItemStatus; count: number }[]
  byCategory: { category: ItemCategory; count: number }[]
  workerStats: {
    workerId: string
    workerName: string
    totalItems: number
    passed: number
    totalReworks: number
    avgMinutes: number
  }[]
  avgMinutesByCategory: { category: ItemCategory; avgMinutes: number }[]
}

export const CATEGORY_LABELS: Record<ItemCategory, string> = {
  STROLLER: '婴儿车',
  TOY: '玩具',
  FEEDING: '喂养器具',
  CLOTHING: '服装'
}

export const STATUS_LABELS: Record<ItemStatus, string> = {
  PENDING: '待处理',
  CLEANING: '清洁中',
  INSPECTING: '复检中',
  SEALED: '已封存',
  SOLD: '已出售',
  RETURNED: '已退回',
  ANOMALY: '异常'
}

export const STATUS_COLORS: Record<ItemStatus, string> = {
  PENDING: 'gold',
  CLEANING: 'blue',
  INSPECTING: 'cyan',
  SEALED: 'green',
  SOLD: 'purple',
  RETURNED: 'red',
  ANOMALY: 'orange'
}

export const CONDITION_LABELS: Record<ConditionLevel, string> = {
  NONE: '无',
  MILD: '轻微',
  MODERATE: '中等',
  SEVERE: '严重'
}

export const INSPECTION_RESULT_LABELS: Record<InspectionResult, string> = {
  SELLABLE: '可售',
  DISCOUNTED: '降价售',
  RETURNED: '退回',
  REWORK: '返工'
}

export const ANOMALY_TYPE_LABELS: Record<AnomalyType, string> = {
  RECALL: '召回型号',
  COUNTERFEIT: '疑似仿品',
  SAFETY: '安全隐患',
  DAMAGE: '损坏',
  OTHER: '其他'
}

export const ANOMALY_STATUS_LABELS: Record<AnomalyStatus, string> = {
  OPEN: '待处理',
  IN_PROGRESS: '处理中',
  RESOLVED: '已解决',
  CLOSED: '已关闭'
}

export const WORKER_ROLE_LABELS: Record<WorkerRole, string> = {
  CLEANER: '清洗员',
  INSPECTOR: '复检员',
  OPERATOR: '仓管员',
  SUPERVISOR: '主管'
}
