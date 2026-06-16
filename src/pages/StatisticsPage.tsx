import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Space, Row, Col, Typography, DatePicker, Table, Progress, Tag, message } from 'antd'
import { ArrowLeftOutlined, UserOutlined, ClockCircleOutlined, CheckCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Statistics, CATEGORY_LABELS, STATUS_LABELS } from '../types'
import dayjs from 'dayjs'

const { Text } = Typography
const { RangePicker } = DatePicker

const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  CLEANING: '#3b82f6',
  INSPECTING: '#06b6d4',
  SEALED: '#22c55e',
  SOLD: '#8b5cf6',
  RETURNED: '#ef4444',
  ANOMALY: '#f97316'
}

const CATEGORY_COLORS: Record<string, string> = {
  STROLLER: '#22c55e',
  TOY: '#3b82f6',
  FEEDING: '#f59e0b',
  CLOTHING: '#8b5cf6'
}

export default function StatisticsPage() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Statistics | null>(null)
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState<[dayjs.Dayjs, dayjs.Dayjs] | null>(null)

  useEffect(() => {
    loadStatistics()
  }, [dateRange])

  const loadStatistics = async () => {
    setLoading(true)
    try {
      const params: any = {}
      if (dateRange && dateRange[0] && dateRange[1]) {
        params.startDate = dateRange[0].format('YYYY-MM-DD')
        params.endDate = dateRange[1].format('YYYY-MM-DD')
      }
      const data = await window.api.getStatistics(params)
      setStats(data)
    } catch (error) {
      message.error('加载统计数据失败')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusChartData = () => {
    if (!stats) return []
    return stats.byStatus.map(item => ({
      name: STATUS_LABELS[item.status as keyof typeof STATUS_LABELS] || item.status,
      value: item.count,
      fill: STATUS_COLORS[item.status] || '#999'
    }))
  }

  const getCategoryChartData = () => {
    if (!stats) return []
    return stats.byCategory.map(item => ({
      name: CATEGORY_LABELS[item.category as keyof typeof CATEGORY_LABELS] || item.category,
      value: item.count,
      fill: CATEGORY_COLORS[item.category] || '#999'
    }))
  }

  const getWorkerChartData = () => {
    if (!stats) return []
    return stats.workerStats.map(ws => ({
      name: ws.workerName,
      处理数量: ws.totalItems || 0,
      通过数量: ws.passed || 0,
      返工次数: ws.totalReworks || 0
    }))
  }

  const getAvgTimeChartData = () => {
    if (!stats) return []
    return stats.avgMinutesByCategory.map(item => ({
      name: CATEGORY_LABELS[item.category as keyof typeof CATEGORY_LABELS] || item.category,
      平均耗时: Math.round(item.avgMinutes || 0),
      fill: CATEGORY_COLORS[item.category] || '#999'
    }))
  }

  const calculatePassRate = (ws: any) => {
    if (!ws || !ws.totalItems) return 0
    return Math.round((ws.passed / ws.totalItems) * 100)
  }

  const calculateReworkRate = (ws: any) => {
    if (!ws || !ws.totalItems) return 0
    return Math.round((ws.totalReworks / ws.totalItems) * 100)
  }

  const workerColumns = [
    {
      title: '作业员',
      dataIndex: 'workerName',
      key: 'workerName',
      render: (name: string) => (
        <Space>
          <UserOutlined />
          {name}
        </Space>
      )
    },
    {
      title: '处理数量',
      dataIndex: 'totalItems',
      key: 'totalItems',
      render: (val: number) => <Tag color="blue">{val || 0} 件</Tag>
    },
    {
      title: '通过数量',
      dataIndex: 'passed',
      key: 'passed',
      render: (val: number) => <Tag color="green">{val || 0} 件</Tag>
    },
    {
      title: '通过率',
      key: 'passRate',
      render: (_: any, record: any) => {
        const rate = calculatePassRate(record)
        return (
          <Progress
            percent={rate}
            size="small"
            strokeColor={rate >= 90 ? '#22c55e' : rate >= 70 ? '#f59e0b' : '#ef4444'}
          />
        )
      }
    },
    {
      title: '返工次数',
      dataIndex: 'totalReworks',
      key: 'totalReworks',
      render: (val: number) => <Tag color={val > 0 ? 'orange' : 'default'}>{val || 0} 次</Tag>
    },
    {
      title: '返工率',
      key: 'reworkRate',
      render: (_: any, record: any) => {
        const rate = calculateReworkRate(record)
        return (
          <Progress
            percent={rate}
            size="small"
            strokeColor={rate <= 5 ? '#22c55e' : rate <= 15 ? '#f59e0b' : '#ef4444'}
          />
        )
      }
    },
    {
      title: '平均耗时',
      dataIndex: 'avgMinutes',
      key: 'avgMinutes',
      render: (val: number) => (
        <Space>
          <ClockCircleOutlined />
          {val ? Math.round(val) : 0} 分钟
        </Space>
      )
    }
  ]

  return (
    <div>
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>返回</Button>
          <div>
            <h1 className="page-title">📊 统计分析</h1>
            <p className="page-desc">作业员绩效、处理效率、品类分布等多维度数据分析</p>
          </div>
        </Space>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <Space wrap>
          <Text strong>时间范围：</Text>
          <RangePicker
            value={dateRange}
            onChange={(dates) => setDateRange(dates as [dayjs.Dayjs, dayjs.Dayjs] | null)}
            format="YYYY-MM-DD"
          />
          <Button onClick={() => setDateRange(null)}>重置</Button>
          <Button type="primary" icon={<ReloadOutlined />} onClick={loadStatistics}>刷新</Button>
        </Space>
      </Card>

      {stats && (
        <>
          <Row gutter={16} style={{ marginBottom: 20 }}>
            <Col span={6}>
              <Card className="stat-card">
                <div className="stat-value">{stats.totalItems}</div>
                <div className="stat-label">总处理商品数</div>
              </Card>
            </Col>
            <Col span={6}>
              <Card className="stat-card">
                <div className="stat-value" style={{ color: '#22c55e' }}>
                  {stats.byStatus.find(s => s.status === 'SEALED' || s.status === 'SOLD')?.count || 0}
                </div>
                <div className="stat-label">已完成处理</div>
              </Card>
            </Col>
            <Col span={6}>
              <Card className="stat-card">
                <div className="stat-value" style={{ color: '#f59e0b' }}>
                  {stats.byStatus.find(s => s.status === 'PENDING')?.count || 0}
                </div>
                <div className="stat-label">待处理</div>
              </Card>
            </Col>
            <Col span={6}>
              <Card className="stat-card">
                <div className="stat-value" style={{ color: '#ef4444' }}>
                  {stats.byStatus.find(s => s.status === 'RETURNED')?.count || 0}
                </div>
                <div className="stat-label">已退回</div>
              </Card>
            </Col>
          </Row>

          <Row gutter={20} style={{ marginBottom: 20 }}>
            <Col span={12}>
              <Card title="📈 状态分布" loading={loading}>
                <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={getStatusChartData()}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {getStatusChartData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="📊 品类分布" loading={loading}>
                <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getCategoryChartData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="value" name="数量" radius={[4, 4, 0, 0]}>
                        {getCategoryChartData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>
          </Row>

          <Row gutter={20} style={{ marginBottom: 20 }}>
            <Col span={12}>
              <Card title="👥 作业员绩效对比" loading={loading}>
                <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getWorkerChartData()}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="处理数量" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="通过数量" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="返工次数" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="⏱️ 各品类平均处理耗时" loading={loading}>
                <div style={{ height: 300 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getAvgTimeChartData()} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" unit="分钟" />
                      <YAxis type="category" dataKey="name" width={80} />
                      <Tooltip formatter={(value) => [`${value} 分钟`, '平均耗时']} />
                      <Bar dataKey="平均耗时" radius={[0, 4, 4, 0]}>
                        {getAvgTimeChartData().map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </Col>
          </Row>

          <Card title="📋 作业员详细绩效表" loading={loading} extra={
            <Space>
              <Tag color="green">
                <CheckCircleOutlined /> 通过率 ≥ 90% 优秀
              </Tag>
              <Tag color="gold">
                <ReloadOutlined /> 返工率 ≤ 5% 优秀
              </Tag>
            </Space>
          }>
            <Table
              columns={workerColumns}
              dataSource={stats.workerStats}
              rowKey="workerId"
              pagination={false}
              rowClassName={(record) => {
                const passRate = calculatePassRate(record)
                const reworkRate = calculateReworkRate(record)
                if (passRate >= 90 && reworkRate <= 5) return 'bg-green-50'
                if (passRate < 70 || reworkRate > 15) return 'bg-red-50'
                return ''
              }}
            />
          </Card>

          <Card title="💡 数据洞察" style={{ marginTop: 20 }}>
            <Row gutter={16}>
              <Col span={8}>
                <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8, height: '100%' }}>
                  <Text strong style={{ color: '#166534', display: 'block', marginBottom: 8 }}>
                    ✅ 效率最佳品类
                  </Text>
                  {getAvgTimeChartData().length > 0 && (
                    <>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#166534' }}>
                        {getAvgTimeChartData().sort((a, b) => a.平均耗时 - b.平均耗时)[0]?.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                        平均耗时 {getAvgTimeChartData().sort((a, b) => a.平均耗时 - b.平均耗时)[0]?.平均耗时} 分钟
                      </div>
                    </>
                  )}
                </div>
              </Col>
              <Col span={8}>
                <div style={{ padding: 16, background: '#fef3c7', borderRadius: 8, height: '100%' }}>
                  <Text strong style={{ color: '#92400e', display: 'block', marginBottom: 8 }}>
                    ⚠️ 需关注作业员
                  </Text>
                  {stats.workerStats.filter(w => calculatePassRate(w) < 70 || calculateReworkRate(w) > 15).length > 0 ? (
                    stats.workerStats
                      .filter(w => calculatePassRate(w) < 70 || calculateReworkRate(w) > 15)
                      .map((w, i) => (
                        <div key={i} style={{ marginBottom: 4 }}>
                          <Tag color="orange">{w.workerName}</Tag>
                          <span style={{ fontSize: 12, color: '#666' }}>
                            通过率 {calculatePassRate(w)}% | 返工率 {calculateReworkRate(w)}%
                          </span>
                        </div>
                      ))
                  ) : (
                    <div style={{ fontSize: 14, color: '#92400e' }}>所有作业员表现良好</div>
                  )}
                </div>
              </Col>
              <Col span={8}>
                <div style={{ padding: 16, background: '#dbeafe', borderRadius: 8, height: '100%' }}>
                  <Text strong style={{ color: '#1e40af', display: 'block', marginBottom: 8 }}>
                    📦 最热门品类
                  </Text>
                  {getCategoryChartData().length > 0 && (
                    <>
                      <div style={{ fontSize: 24, fontWeight: 700, color: '#1e40af' }}>
                        {getCategoryChartData().sort((a, b) => b.value - a.value)[0]?.name}
                      </div>
                      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                        共 {getCategoryChartData().sort((a, b) => b.value - a.value)[0]?.value} 件
                      </div>
                    </>
                  )}
                </div>
              </Col>
            </Row>
          </Card>
        </>
      )}
    </div>
  )
}
