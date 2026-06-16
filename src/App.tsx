import { useState } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import PendingQueue from './pages/PendingQueue'
import WorkOrderPage from './pages/WorkOrderPage'
import PhotoArchive from './pages/PhotoArchive'
import InspectionPage from './pages/InspectionPage'
import SealOutbound from './pages/SealOutbound'
import AnomalyPool from './pages/AnomalyPool'
import StatisticsPage from './pages/StatisticsPage'

const navItems = [
  { key: 'queue', label: '待处理队列', icon: '📋', path: '/' },
  { key: 'workorder', label: '分品类作业单', icon: '📝', path: '/workorder' },
  { key: 'photo', label: '拍照留档', icon: '📷', path: '/photo' },
  { key: 'inspection', label: '复检判级', icon: '🔍', path: '/inspection' },
  { key: 'seal', label: '封存出库', icon: '📦', path: '/seal' },
  { key: 'anomaly', label: '异常池', icon: '⚠️', path: '/anomaly' },
  { key: 'stats', label: '统计分析', icon: '📊', path: '/stats' },
]

function App() {
  const navigate = useNavigate()
  const location = useLocation()
  const [currentWorker] = useState({
    id: 'demo-worker',
    name: '当前用户',
    role: 'SUPERVISOR'
  })

  const activeKey = navItems.find(item => item.path === location.pathname)?.key || 'queue'

  return (
    <div className="app-container">
      <div className="sidebar no-print">
        <div className="sidebar-title">
          <div style={{ fontSize: '16px', marginBottom: '4px' }}>🌿 母婴回收</div>
          <div style={{ fontSize: '12px', fontWeight: 400, opacity: 0.8 }}>作业处理系统</div>
        </div>
        {navItems.map(item => (
          <div
            key={item.key}
            className={`nav-item ${activeKey === item.key ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '15px 20px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
          <div style={{ fontSize: '13px' }}>{currentWorker.name}</div>
          <div style={{ fontSize: '11px', opacity: 0.7 }}>主管</div>
        </div>
      </div>
      <div className="main-content">
        <Routes>
          <Route path="/" element={<PendingQueue />} />
          <Route path="/workorder" element={<WorkOrderPage />} />
          <Route path="/workorder/:itemId" element={<WorkOrderPage />} />
          <Route path="/photo" element={<PhotoArchive />} />
          <Route path="/photo/:itemId" element={<PhotoArchive />} />
          <Route path="/inspection" element={<InspectionPage />} />
          <Route path="/inspection/:itemId" element={<InspectionPage />} />
          <Route path="/seal" element={<SealOutbound />} />
          <Route path="/seal/:itemId" element={<SealOutbound />} />
          <Route path="/anomaly" element={<AnomalyPool />} />
          <Route path="/stats" element={<StatisticsPage />} />
        </Routes>
      </div>
    </div>
  )
}

export default App
