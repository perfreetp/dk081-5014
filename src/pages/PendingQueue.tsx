import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Table, Tag, Button, Space, Select, Input, Modal, Form, message, Row, Col, Card } from 'antd'
import { PlusOutlined, UserOutlined } from '@ant-design/icons'
import { Item, STATUS_LABELS, STATUS_COLORS, CATEGORY_LABELS, Worker } from '../types'
import dayjs from 'dayjs'

const { Search } = Input
const { Option } = Select

export default function PendingQueue() {
  const navigate = useNavigate()
  const [items, setItems] = useState<Item[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>()
  const [categoryFilter, setCategoryFilter] = useState<string>()
  const [searchText, setSearchText] = useState('')
  const [assignModalVisible, setAssignModalVisible] = useState(false)
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [form] = Form.useForm()
  const [assignForm] = Form.useForm()

  useEffect(() => {
    loadData()
    loadWorkers()
  }, [statusFilter, categoryFilter])

  const loadData = async () => {
    setLoading(true)
    try {
      const filters: any = {}
      if (statusFilter) filters.status = statusFilter
      if (categoryFilter) filters.category = categoryFilter
      const data = await window.api.getItems(filters)
      let filtered = data
      if (searchText) {
        filtered = data.filter((item: Item) =>
          item.name.toLowerCase().includes(searchText.toLowerCase()) ||
          item.code.toLowerCase().includes(searchText.toLowerCase()) ||
          item.brand?.toLowerCase().includes(searchText.toLowerCase())
        )
      }
      setItems(filtered)
    } catch (error) {
      message.error('加载数据失败')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const loadWorkers = async () => {
    try {
      const data = await window.api.getWorkers()
      setWorkers(data)
    } catch (error) {
      console.error('加载作业员失败', error)
    }
  }

  const handleCreate = async (values: any) => {
    try {
      const now = new Date().toISOString()
      const code = await window.api.getNextItemCode()
      await window.api.createItem({
        id: crypto.randomUUID(),
        code,
        name: values.name,
        category: values.category,
        brand: values.brand,
        model: values.model,
        receivedDate: values.receivedDate,
        source: values.source,
        status: 'PENDING',
        notes: values.notes,
        createdAt: now,
        updatedAt: now
      })
      message.success(`创建成功：${code}`)
      setCreateModalVisible(false)
      form.resetFields()
      loadData()
    } catch (error) {
      message.error('创建失败')
      console.error(error)
    }
  }

  const handleAssign = async (values: any) => {
    if (!selectedItem) return
    try {
      await window.api.updateItem(selectedItem.id, {
        assigned_to: values.workerId,
        status: 'CLEANING',
        updated_at: new Date().toISOString()
      })
      message.success('分配成功')
      setAssignModalVisible(false)
      assignForm.resetFields()
      loadData()
    } catch (error) {
      message.error('分配失败')
      console.error(error)
    }
  }

  const handleDelete = async (item: Item) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除商品 "${item.name}" 吗？`,
      onOk: async () => {
        try {
          await window.api.deleteItem(item.id)
          message.success('删除成功')
          loadData()
        } catch (error) {
          message.error('删除失败')
          console.error(error)
        }
      }
    })
  }

  const getWorkerName = (workerId?: string) => {
    if (!workerId) return '-'
    const worker = workers.find(w => w.id === workerId)
    return worker?.name || '-'
  }

  const columns = [
    {
      title: '商品编码',
      dataIndex: 'code',
      key: 'code',
      width: 140,
      render: (text: string) => <span style={{ fontFamily: 'monospace', fontWeight: 500 }}>{text}</span>
    },
    {
      title: '商品名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: Item) => (
        <div>
          <div style={{ fontWeight: 500 }}>{text}</div>
          <div style={{ fontSize: 12, color: '#999' }}>{record.brand} {record.model}</div>
        </div>
      )
    },
    {
      title: '品类',
      dataIndex: 'category',
      key: 'category',
      width: 100,
      render: (cat: string) => CATEGORY_LABELS[cat as keyof typeof CATEGORY_LABELS] || cat
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={STATUS_COLORS[status as keyof typeof STATUS_COLORS]}>
          {STATUS_LABELS[status as keyof typeof STATUS_LABELS]}
        </Tag>
      )
    },
    {
      title: '处理人',
      dataIndex: 'assignedTo',
      key: 'assignedTo',
      width: 100,
      render: (id?: string) => getWorkerName(id)
    },
    {
      title: '收货日期',
      dataIndex: 'receivedDate',
      key: 'receivedDate',
      width: 110,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD')
    },
    {
      title: '备注',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true
    },
    {
      title: '操作',
      key: 'actions',
      width: 200,
      render: (_: any, record: Item) => (
        <Space size="small">
          {record.status === 'PENDING' && (
            <Button size="small" type="primary" onClick={() => {
              setSelectedItem(record)
              setAssignModalVisible(true)
            }}>
              分配
            </Button>
          )}
          {record.status === 'CLEANING' && (
            <Button size="small" onClick={() => navigate(`/workorder/${record.id}`)}>
              作业
            </Button>
          )}
          {record.status === 'INSPECTING' && (
            <Button size="small" type="primary" onClick={() => navigate(`/inspection/${record.id}`)}>
              复检
            </Button>
          )}
          {record.status === 'SEALED' && (
            <Button size="small" type="primary" onClick={() => navigate(`/seal/${record.id}`)}>
              查看
            </Button>
          )}
          <Button size="small" danger onClick={() => handleDelete(record)}>
            删除
          </Button>
        </Space>
      )
    }
  ]

  const stats = {
    total: items.length,
    pending: items.filter(i => i.status === 'PENDING').length,
    cleaning: items.filter(i => i.status === 'CLEANING').length,
    inspecting: items.filter(i => i.status === 'INSPECTING').length,
    sealed: items.filter(i => i.status === 'SEALED').length
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">📋 待处理队列</h1>
        <p className="page-desc">管理所有回收商品的处理进度，分配任务给作业员</p>
      </div>

      <Row gutter={16} style={{ marginBottom: 20 }}>
        <Col span={4.8}>
          <Card className="stat-card" size="small">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">全部商品</div>
          </Card>
        </Col>
        <Col span={4.8}>
          <Card className="stat-card" size="small">
            <div className="stat-value" style={{ color: '#f59e0b' }}>{stats.pending}</div>
            <div className="stat-label">待分配</div>
          </Card>
        </Col>
        <Col span={4.8}>
          <Card className="stat-card" size="small">
            <div className="stat-value" style={{ color: '#3b82f6' }}>{stats.cleaning}</div>
            <div className="stat-label">清洁中</div>
          </Card>
        </Col>
        <Col span={4.8}>
          <Card className="stat-card" size="small">
            <div className="stat-value" style={{ color: '#06b6d4' }}>{stats.inspecting}</div>
            <div className="stat-label">复检中</div>
          </Card>
        </Col>
        <Col span={4.8}>
          <Card className="stat-card" size="small">
            <div className="stat-value" style={{ color: '#22c55e' }}>{stats.sealed}</div>
            <div className="stat-label">已封存</div>
          </Card>
        </Col>
      </Row>

      <Card>
        <Space style={{ marginBottom: 16 }} wrap>
          <Search
            placeholder="搜索商品名称/编码/品牌"
            allowClear
            style={{ width: 280 }}
            onSearch={loadData}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Select
            placeholder="状态筛选"
            allowClear
            style={{ width: 150 }}
            value={statusFilter}
            onChange={setStatusFilter}
          >
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <Option key={value} value={value}>{label}</Option>
            ))}
          </Select>
          <Select
            placeholder="品类筛选"
            allowClear
            style={{ width: 150 }}
            value={categoryFilter}
            onChange={setCategoryFilter}
          >
            {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
              <Option key={value} value={value}>{label}</Option>
            ))}
          </Select>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalVisible(true)}>
            登记新商品
          </Button>
          <Button onClick={loadData}>刷新</Button>
        </Space>

        <Table
          columns={columns}
          dataSource={items}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="登记新商品"
        open={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="商品名称" rules={[{ required: true, message: '请输入商品名称' }]}>
            <Input placeholder="如：好孩子婴儿推车" />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="category" label="品类" rules={[{ required: true, message: '请选择品类' }]}>
                <Select>
                  {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                    <Option key={value} value={value}>{label}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="receivedDate" label="收货日期" rules={[{ required: true, message: '请选择日期' }]}>
                <Input style={{ width: '100%' }} type="date" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item name="brand" label="品牌">
                <Input placeholder="如：好孩子" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="model" label="型号">
                <Input placeholder="如：C400" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="source" label="来源渠道">
            <Input placeholder="如：线下门店回收" />
          </Form.Item>
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={3} placeholder="如：车身有污渍、车轮磨损等" />
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setCreateModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">创建</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="分配作业员"
        open={assignModalVisible}
        onCancel={() => setAssignModalVisible(false)}
        footer={null}
        width={400}
      >
        {selectedItem && (
          <div style={{ marginBottom: 16, padding: 12, background: '#f5f7fa', borderRadius: 6 }}>
            <div style={{ fontWeight: 500 }}>{selectedItem.code} - {selectedItem.name}</div>
            <div style={{ fontSize: 12, color: '#666' }}>
              {CATEGORY_LABELS[selectedItem.category as keyof typeof CATEGORY_LABELS]} | {selectedItem.brand} {selectedItem.model}
            </div>
          </div>
        )}
        <Form form={assignForm} layout="vertical" onFinish={handleAssign}>
          <Form.Item name="workerId" label="选择清洗员" rules={[{ required: true, message: '请选择作业员' }]}>
            <Select placeholder="请选择清洗员">
              {workers.filter(w => w.role === 'CLEANER').map(w => (
                <Option key={w.id} value={w.id}>
                  <UserOutlined /> {w.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => setAssignModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit">确认分配</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
