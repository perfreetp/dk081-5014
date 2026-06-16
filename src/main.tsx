import React from 'react'
import ReactDOM from 'react-dom/client'
import { HashRouter } from 'react-router-dom'
import { ConfigProvider, App as AntdApp } from 'antd'
import zhCN from 'antd/locale/zh_CN'
import App from './App'
import './index.css'

declare global {
  interface Window {
    api: {
      getItems: (filters?: any) => Promise<any[]>
      getItem: (id: string) => Promise<any>
      createItem: (item: any) => Promise<any>
      updateItem: (id: string, updates: any) => Promise<any>
      deleteItem: (id: string) => Promise<any>
      
      getWorkOrders: (itemId: string) => Promise<any[]>
      createWorkOrder: (order: any) => Promise<any>
      updateWorkOrder: (id: string, updates: any) => Promise<any>
      
      getPhotos: (itemId: string) => Promise<any[]>
      addPhoto: (photo: any) => Promise<any>
      deletePhoto: (id: string) => Promise<any>
      
      getInspections: (itemId: string) => Promise<any[]>
      createInspection: (inspection: any) => Promise<any>
      
      getSeals: (itemId: string) => Promise<any[]>
      createSeal: (seal: any) => Promise<any>
      
      getAnomalies: (filters?: any) => Promise<any[]>
      createAnomaly: (anomaly: any) => Promise<any>
      updateAnomaly: (id: string, updates: any) => Promise<any>
      
      getWorkers: () => Promise<any[]>
      createWorker: (worker: any) => Promise<any>
      
      getStatistics: (params?: any) => Promise<any>
      
      getCategoryWorkflow: (category: string) => Promise<any[]>
      getCategoryParts: (category: string) => Promise<any[]>
      getNextItemCode: () => Promise<string>
      getItemReworkCount: (itemId: string) => Promise<number>
      getItemsByStatuses: (statuses: string[]) => Promise<any[]>
      getItemsWithReworkCount: (statuses: string[]) => Promise<any[]>
    }
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HashRouter>
      <ConfigProvider locale={zhCN} theme={{
        token: {
          colorPrimary: '#22c55e',
          colorInfo: '#22c55e',
          colorSuccess: '#22c55e',
          colorWarning: '#f59e0b',
          colorError: '#ef4444',
          borderRadius: 8,
        }
      }}>
        <AntdApp>
          <App />
        </AntdApp>
      </ConfigProvider>
    </HashRouter>
  </React.StrictMode>,
)
