import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card, Button, Space, Row, Col, Typography, Select, Input, Form, Tag, message, Table, Modal, Divider } from 'antd'
import { ArrowLeftOutlined, PlusOutlined, ExclamationCircleOutlined, WarningOutlined, SafetyOutlined, CloseCircleOutlined } from '@ant-design/icons'
import { Anomaly, AnomalyType, AnomalyStatus, ANOMALY_TYPE_LABELS, ANOMALY_STATUS_LABELS } from '../types'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography
const { TextArea } = Input
const { Option } = Select

const ANOMALY_ICONS: Record<AnomalyType, any> = {
  RECALL: <CloseCircleOutlined style={{ color: '#ef4444', fontSize: 24 }} />,
  COUNTERFEIT: <WarningOutlined style={{ color: '#f59e0b', fontSize: 24 }} />,
  SAFETY: <SafetyOutlined style={{ color: '#8b5cf6', fontSize: 24 }} />,
  DAMAGE: <ExclamationCircleOutlined style={{ color: '#3b82f6', fontSize: 24 }} />,
  OTHER: <ExclamationCircleOutlined style={{ color: '#6b7280', fontSize: 24 }} />,
}

const ANOMALY_STATUS_COLORS: Record<AnomalyStatus, string> = {
  OPEN: 'red',
  IN_PROGRESS: 'orange',
  RESOLVED: 'green',
  CLOSED: 'default'
}

export default function AnomalyPool() {
  const navigate = useNavigate()
  const [anomalies, setAnomalies] = useState<Anomaly[]>([])
  const [typeFilter, setTypeFilter] = useState<AnomalyType>()
  const [statusFilter, setStatusFilter] = useState<AnomalyStatus>()
  const [loading, setLoading] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null)
  const [form] = Form.useForm()
  const [resolveForm] = Form.useForm()

  useEffect(() => {
    loadAnomalies()
  }, [typeFilter, statusFilter])

  const loadAnomalies = async () => {
    setLoading(true)
    try {
      const filters: any = {}
      if (typeFilter) filters.type = typeFilter
      if (statusFilter) filters.status = statusFilter
      const data = await window.api.getAnomalies(filters)
      setAnomalies(data)
    } catch (error) {
      message.error('加载异常列表失败')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (values: any) => {
    try {
      const now = new Date().toISOString()
      const anomaly: Anomaly = {
        id: crypto.randomUUID(),
        type: values.type,
        title: values.title,
        description: values.description,
        reportedBy: values.reportedBy || '当前用户',
        status: 'OPEN',
        createdAt: now
      }
      await window.api.createAnomaly(anomaly)
      message.success('异常记录创建成功')
      setCreateModalVisible(false)
      form.resetFields()
      loadAnomalies()
    } catch (error) {
      message.error('创建失败')
      console.error(error)
    }
  }

  const handleResolve = async (values: any) => {
    if (!selectedAnomaly) return
    try {
      await window.api.updateAnomaly(selectedAnomaly.id, {
        status: values.status,
        resolution: values.resolution,
        resolved_at: values.status === 'RESOLVED' || values.status === 'CLOSED' ? new Date().toISOString() : null
      })
      message.success('状态更新成功')
      setDetailModalVisible(false)
      resolveForm.resetFields()
      loadAnomalies()
    } catch (error) {
      message.error('更新失败')
      console.error(error)
    }
  }

  const openDetail = (anomaly: Anomaly) => {
    setSelectedAnomaly(anomaly)
    resolveForm.setFieldsValue({
      status: anomaly.status,
      resolution: anomaly.resolution
    })
    setDetailModalVisible(true)
  }

  const stats = {
    total: anomalies.length,
    open: anomalies.filter(a => a.status === 'OPEN').length,
    inProgress: anomalies.filter(a => a.status === 'IN_PROGRESS').length,
    resolved: anomalies.filter(a => a.status === 'RESOLVED').length,
    recall: anomalies.filter(a => a.type === 'RECALL').length,
    counterfeit: anomalies.filter(a => a.type === 'COUNTERFEIT').length,
    safety: anomalies.filter(a => a.type === 'SAFETY').length,
  }

  const columns = [
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: AnomalyType) => (
        <Space>
          {ANOMALY_ICONS[type]}
          <Tag color={
            type === 'RECALL' ? 'red' :
            type === 'COUNTERFEIT' ? 'orange' :
            type === 'SAFETY' ? 'purple' :
            type === 'DAMAGE' ? 'blue' : 'default'
          }>
            {ANOMALY_TYPE_LABELS[type]}
          </Tag>
        </Space>
      )
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: Anomaly) => (
        <a onClick={() => openDetail(record)} style={{ fontWeight: 500 }}>{text}</a>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: AnomalyStatus) => (
        <Tag color={ANOMALY_STATUS_COLORS[status]}>
          {ANOMALY_STATUS_LABELS[status]}
        </Tag>
      )
    },
    {
      title: '上报人',
      dataIndex: 'reportedBy',
      key: 'reportedBy',
      width: 100,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'actions',
      width: 100,
      render: (_: any, record: Anomaly) => (
        <Button size="small" onClick={() => openDetail(record)}>处理</Button>
      )
    }
  ]

  return (
    <div>
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>返回</Button>
          <div>
            <h1 className="page-title">⚠️ 异常池</h1>
            <p className="page-desc">集中处理召回型号、疑似仿品、安全隐患等异常情况</p>
          </div>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={4}>
          <Card className="stat-card" size="small">
            <div className="stat-value" style={{ color: '#ef4444' }}>{stats.open}</div>
            <div className="stat-label">待处理</div>
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stat-card" size="small">
            <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.inProgress}</div>
            <div className="stat-label">处理中</div>
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stat-card" size="small">
            <div className="stat-value" style={{ color: '#22c55e' }}>{stats.resolved}</div>
            <div className="stat-label">已解决</div>
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stat-card" size="small">
            <div className="stat-value" style={{ color: '#ef4444' }}>{stats.recall}</div>
            <div className="stat-label">召回</div>
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stat-card" size="small">
            <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.counterfeit}</div>
            <div className="stat-label">疑似仿品</div>
          </Card>
        </Col>
        <Col span={4}>
          <Card className="stat-card" size="small">
            <div className="stat-value" style={{ color: '#8b5cf6' }}>{stats.safety}</div>
            <div className="stat-label">安全隐患</div>
          </Card>
        </Col>
      </Row>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Select
            placeholder="异常类型"
            allowClear
            style={{ width: 150 }}
            value={typeFilter}
            onChange={setTypeFilter}
          >
            {Object.entries(ANOMALY_TYPE_LABELS).map(([value, label]) => (
              <Option key={value} value={value}>{label}</Option>
            ))}
          </Select>
          <Select
            placeholder="状态筛选"
            allowClear
            style={{ width: 150 }}
            value={statusFilter}
            onChange={setStatusFilter}
          >
            {Object.entries(ANOMALY_STATUS_LABELS).map(([value, label]) => (
              <Option key={value} value={value}>{label}</Option>
            ))}
          </Select>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            上报异常
          </Button>
          <Button onClick={loadAnomalies}>刷新</Button>
        </Space>

        <Table
          columns={columns}
          dataSource={anomalies}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          expandable={{
            expandedRowRender: (record) => (
              <Paragraph style={{ margin: 0, padding: '0 40px' }}>
                <Text strong>详细描述：</Text>
                {record.description || '无详细描述'}
                {record.resolution && (
                  <>
                    <Divider style={{ margin: '10px 0' }} />
                    <Text strong type="success">处理方案：</Text>
                    {record.resolution}
                  </>
                )}
              </Paragraph>
            )
          }}
        />
      </Card>

      <Modal
        title="上报异常"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="type" label="异常类型" rules={[{ required: true, message: '请选择类型' }]}>
            <Select>
              {Object.entries(ANOMALY_TYPE_LABELS).map(([value, label]) => (
                <Option key={value} value={value}>
                  <Space>
                    {ANOMALY_ICONS[value as AnomalyType]}
                    {label}
                  </Space>
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="title" label="异常标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="简要描述异常情况" />
          </Form.Item>
          <Form.Item name="description" label="详细描述">
            <TextArea rows={4} placeholder="详细描述异常情况、影响范围、处理建议等..." />
          </Form.Item>
          <Form.Item name="reportedBy" label="上报人">
            <Input placeholder="如：张清洗" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCreateModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">提交</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="异常详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={600}
      >
        {selectedAnomaly && (
          <div>
            <Card size="small" style={{ marginBottom: 16, background: '#fafafa' }}>
              <Space size="large" align="start">
                {ANOMALY_ICONS[selectedAnomaly.type]}
                <div style={{ flex: 1 }}>
                  <Title level={5} style={{ margin: '0 0 8px 0' }}>{selectedAnomaly.title}</Title>
                  <Space>
                    <Tag color={ANOMALY_STATUS_COLORS[selectedAnomaly.status]}>
                      {ANOMALY_STATUS_LABELS[selectedAnomaly.status]}
                    </Tag>
                    <Tag color={
                      selectedAnomaly.type === 'RECALL' ? 'red' :
                      selectedAnomaly.type === 'COUNTERFEIT' ? 'orange' :
                      selectedAnomaly.type === 'SAFETY' ? 'purple' : 'blue'
                    }>
                      {ANOMALY_TYPE_LABELS[selectedAnomaly.type]}
                    </Tag>
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      上报人：{selectedAnomaly.reportedBy || '匿名'} | {dayjs(selectedAnomaly.createdAt).format('YYYY-MM-DD HH:mm')}
                    </Text>
                  </Space>
                </div>
              </Space>
            </Card>

            {selectedAnomaly.description && (
              <div style={{ marginBottom: 16, padding: 12, background: '#fffbeb', borderRadius: 6 }}>
                <Text strong>详细描述：</Text>
                <Paragraph style={{ margin: '8px 0 0 0', whiteSpace: 'pre-wrap' }}>
                  {selectedAnomaly.description}
                </Paragraph>
              </div>
            )}

            {selectedAnomaly.resolution && (
              <div style={{ marginBottom: 16, padding: 12, background: '#f0fdf4', borderRadius: 6 }}>
                <Text strong type="success">处理方案：</Text>
                <Paragraph style={{ margin: '8px 0 0 0', whiteSpace: 'pre-wrap' }}>
                  {selectedAnomaly.resolution}
                </Paragraph>
              </div>
            )}

            <Divider />

            <Form form={resolveForm} layout="vertical" onFinish={handleResolve}>
              <Form.Item name="status" label="更新状态" rules={[{ required: true, message: '请选择状态' }]}>
                <Select>
                  <Option value="OPEN">待处理</Option>
                  <Option value="IN_PROGRESS">处理中</Option>
                  <Option value="RESOLVED">已解决</Option>
                  <Option value="CLOSED">已关闭</Option>
                </Select>
              </Form.Item>
              <Form.Item name="resolution" label="处理方案/备注">
                <TextArea rows={3} placeholder="请输入处理方案或备注信息..." />
              </Form.Item>
              <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
                <Space>
                  <Button onClick={() => setDetailModalVisible(false)}>关闭</Button>
                  <Button type="primary" htmlType="submit">保存</Button>
                </Space>
              </Form.Item>
            </Form>
          </div>
        )}
      </Modal>
    </div>
  )
}
