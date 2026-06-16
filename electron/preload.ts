import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  getItems: (filters?: any) => ipcRenderer.invoke('get-items', filters),
  getItem: (id: string) => ipcRenderer.invoke('get-item', id),
  createItem: (item: any) => ipcRenderer.invoke('create-item', item),
  updateItem: (id: string, updates: any) => ipcRenderer.invoke('update-item', id, updates),
  deleteItem: (id: string) => ipcRenderer.invoke('delete-item', id),

  getWorkOrders: (itemId: string) => ipcRenderer.invoke('get-work-orders', itemId),
  createWorkOrder: (order: any) => ipcRenderer.invoke('create-work-order', order),
  updateWorkOrder: (id: string, updates: any) => ipcRenderer.invoke('update-work-order', id, updates),

  getPhotos: (itemId: string) => ipcRenderer.invoke('get-photos', itemId),
  addPhoto: (photo: any) => ipcRenderer.invoke('add-photo', photo),
  deletePhoto: (id: string) => ipcRenderer.invoke('delete-photo', id),

  getInspections: (itemId: string) => ipcRenderer.invoke('get-inspections', itemId),
  createInspection: (inspection: any) => ipcRenderer.invoke('create-inspection', inspection),

  getSeals: (itemId: string) => ipcRenderer.invoke('get-seals', itemId),
  createSeal: (seal: any) => ipcRenderer.invoke('create-seal', seal),

  getAnomalies: (filters?: any) => ipcRenderer.invoke('get-anomalies', filters),
  createAnomaly: (anomaly: any) => ipcRenderer.invoke('create-anomaly', anomaly),
  updateAnomaly: (id: string, updates: any) => ipcRenderer.invoke('update-anomaly', id, updates),

  getWorkers: () => ipcRenderer.invoke('get-workers'),
  createWorker: (worker: any) => ipcRenderer.invoke('create-worker', worker),

  getStatistics: (params?: any) => ipcRenderer.invoke('get-statistics', params),

  getCategoryWorkflow: (category: string) => ipcRenderer.invoke('get-category-workflow', category),
  getCategoryParts: (category: string) => ipcRenderer.invoke('get-category-parts', category),
  getNextItemCode: () => ipcRenderer.invoke('get-next-item-code'),
})

export type API = typeof window.api
