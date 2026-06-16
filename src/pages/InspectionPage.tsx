import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Button, Space, Row, Col, Typography, Table, Select, Input, Form, Rate, Tag, message, Descriptions, Modal } from 'antd'
import { ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import ItemSelector from '../components/ItemSelector'
import { Item, WorkOrder, Inspection, Photo, Worker, CATEGORY_LABELS, STATUS_LABELS, STATUS_COLORS, CONDITION_LABELS, INSPECTION_RESULT_LABELS } from '../types'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { TextArea } = Input
const { Option } = Select

export default function InspectionPage() {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>(itemId)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [photos, setPhotos] = useState<Photo[]>([])
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [form] = Form.useForm()
  const [showReworkModal, setShowReworkModal] = useState(false)

  useEffect(() => {
    loadWorkers()
  }, [])

  useEffect(() => {
    if (selectedItemId) {
      loadItemDetail(selectedItemId)
      loadRelatedData(selectedItemId)
    }
  }, [selectedItemId])

  const loadWorkers = async () => {
    try {
      const data = await window.api.getWorkers()
      setWorkers(data)
    } catch (error) {
      console.error('加载作业员失败', error)
    }
  }

  const loadItemDetail = async (id: string) => {
    try {
      const item = await window.api.getItem(id)
      setSelectedItem(item)
      form.setFieldsValue({
        inspectorId: workers.find(w => w.role === 'INSPECTOR')?.id
      })
    } catch (error) {
      message.error('加载商品详情失败')
      console.error(error)
    }
  }

  const loadRelatedData = async (itemId: string) => {
    try {
      const [orders, insps, phs] = await Promise.all([
        window.api.getWorkOrders(itemId),
        window.api.getInspections(itemId),
        window.api.getPhotos(itemId)
      ])
      setWorkOrders(orders.map((o: any) => ({
        ...o,
        partsChecklist: o.parts_checklist ? JSON.parse(o.parts_checklist) : {},
        cleaningRestrictions: o.cleaning_restrictions ? JSON.parse(o.cleaning_restrictions) : [],
        partsMissing: o.parts_missing ? JSON.parse(o.parts_missing) : []
      })))
      setInspections(insps)
      setPhotos(phs)
    } catch (error) {
      console.error('加载相关数据失败', error)
    }
  }

  const handleItemSelect = (id: string, item?: Item) => {
    setSelectedItemId(id)
    setSelectedItem(item || null)
    setWorkOrders([])
    setInspections([])
    setPhotos([])
    form.resetFields()
  }

  const getWorkerName = (id?: string) => {
    if (!id) return '-'
    return workers.find(w => w.id === id)?.name || '-'
  }

  const calculateFinalScore = (values: any) => {
    const wear = values.wearScore || 0
    const mold = values.moldScore || 0
    const odor = values.odorScore || 0
    const parts = values.partsScore || 0
    return Math.round((wear + mold + odor + parts) / 4)
  }

  const handleSubmit = async (values: any) => {
    if (!selectedItem || !selectedItemId) return
    try {
      const finalScore = calculateFinalScore(values)
      const now = new Date().toISOString()

      const inspection: Inspection = {
        id: crypto.randomUUID(),
        itemId: selectedItemId,
        inspectorId: values.inspectorId,
        result: values.result,
        wearScore: values.wearScore,
        moldScore: values.moldScore,
        odorScore: values.odorScore,
        partsScore: values.partsScore,
        finalScore,
        notes: values.notes,
        createdAt: now
      }

      await window.api.createInspection(inspection)

      let newStatus = selectedItem.status
      if (values.result === 'SELLABLE' || values.result === 'DISCOUNTED') {
        newStatus = 'SEALED'
      } else if (values.result === 'RETURNED') {
        newStatus = 'RETURNED'
      } else if (values.result === 'REWORK') {
        newStatus = 'CLEANING'
      }

      if (values.result === 'REWORK' && workOrders.length > 0) {
        const lastOrder = workOrders[workOrders.length - 1]
        await window.api.updateWorkOrder(lastOrder.id, {
          rework_count: (lastOrder.reworkCount || 0) + 1
        })
      }

      await window.api.updateItem(selectedItemId, {
        status: newStatus,
        updated_at: now
      })

      message.success(`复检完成，结论：${INSPECTION_RESULT_LABELS[values.result as keyof typeof INSPECTION_RESULT_LABELS]}`)
      form.resetFields()
      loadRelatedData(selectedItemId)
      loadItemDetail(selectedItemId)

      if (values.result === 'SELLABLE' || values.result === 'DISCOUNTED') {
        setTimeout(() => navigate(`/seal/${selectedItemId}`), 1000)
      }
    } catch (error) {
      message.error('提交失败')
      console.error(error)
    }
  }

  const ScoreDisplay = ({ label, score, max = 5 }: { label: string; score?: number; max?: number }) => (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <Text strong>{label}</Text>
        <Text type="secondary">{score ?? '-'}/{max}</Text>
      </div>
      <div className="score-bar">
        {Array.from({ length: max }).map((_, i) => (
          <div
            key={i}
            className={`score-item ${i < (score || 0) ? 'filled' : ''}`}
          />
        ))}
      </div>
    </div>
  )

  const latestWorkOrder = workOrders[workOrders.length - 1]

  return (
    <div>
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>返回</Button>
          <div>
            <h1 className="page-title">🔍 复检判级</h1>
            <p className="page-desc">对清洁完成的商品进行分项评分，给出最终处理结论</p>
          </div>
        </Space>
      </div>

      <Card style={{ marginBottom: 20 }}>
        <Space style={{ width: '100%' }} direction="vertical" size="middle">
          <div style={{ minWidth: 400 }}>
            <Text strong>选择商品：</Text>
            <ItemSelector
              value={selectedItemId}
              onChange={handleItemSelect}
              statusFilter={['INSPECTING', 'CLEANING']}
              placeholder="选择要复检的商品"
            />
          </div>
        </Space>
      </Card>

      {selectedItem && (
        <>
          <Card style={{ marginBottom: 20 }}>
            <Row gutter={16} align="middle">
              <Col span={18}>
                <Space direction="vertical" size="small">
                  <Title level={4} style={{ margin: 0 }}>{selectedItem.code} - {selectedItem.name}</Title>
                  <Space>
                    <Tag color="blue">{CATEGORY_LABELS[selectedItem.category as keyof typeof CATEGORY_LABELS]}</Tag>
                    <Tag color={STATUS_COLORS[selectedItem.status as keyof typeof STATUS_COLORS]}>
                      {STATUS_LABELS[selectedItem.status as keyof typeof STATUS_LABELS]}
                    </Tag>
                    <Text type="secondary">{selectedItem.brand} {selectedItem.model}</Text>
                  </Space>
                </Space>
              </Col>
              <Col span={6} style={{ textAlign: 'right' }}>
                <Space direction="vertical" size="small" style={{ textAlign: 'left' }}>
                  <div>
                    <Text type="secondary">清洁员：</Text>
                    <Text strong style={{ marginLeft: 8 }}>{getWorkerName(selectedItem.assignedTo)}</Text>
                  </div>
                  <div>
                    <Text type="secondary">复检次数：</Text>
                    <Tag color="cyan" style={{ marginLeft: 8 }}>{inspections.length} 次</Tag>
                  </div>
                  <div>
                    <Text type="secondary">返工次数：</Text>
                    <Tag color="orange" style={{ marginLeft: 8 }}>{latestWorkOrder?.reworkCount || 0} 次</Tag>
                  </div>
                </Space>
              </Col>
            </Row>
          </Card>

          {latestWorkOrder && (
            <Card title="📋 清洁作业记录" style={{ marginBottom: 20 }}>
              <Row gutter={24}>
                <Col span={12}>
                  <Descriptions bordered column={1} size="small">
                    <Descriptions.Item label="开始时间">
                      {latestWorkOrder.startTime ? dayjs(latestWorkOrder.startTime).format('YYYY-MM-DD HH:mm') : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="完成时间">
                      {latestWorkOrder.endTime ? dayjs(latestWorkOrder.endTime).format('YYYY-MM-DD HH:mm') : '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label="耗时">
                      <Tag color="green">{latestWorkOrder.totalMinutes || 0} 分钟</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="返工次数">
                      <Tag color="orange">{latestWorkOrder.reworkCount || 0} 次</Tag>
                    </Descriptions.Item>
                  </Descriptions>
                </Col>
                <Col span={12}>
                  <div style={{ marginBottom: 12 }}>
                    <Text strong>清洁限制：</Text>
                    <Space style={{ marginLeft: 8 }} wrap>
                      {latestWorkOrder.cleaningRestrictions?.length ? (
                        latestWorkOrder.cleaningRestrictions.map((r: string) => (
                          <Tag key={r} color="blue">{r}</Tag>
                        ))
                      ) : <Text type="secondary">无特殊限制</Text>}
                    </Space>
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <Text strong>初检评估：</Text>
                    <Space style={{ marginLeft: 8 }}>
                      <span className={`condition-tag ${latestWorkOrder.wearLevel || 'NONE'}`}>
                        磨损：{CONDITION_LABELS[(latestWorkOrder.wearLevel as keyof typeof CONDITION_LABELS) || 'NONE']}
                      </span>
                      <span className={`condition-tag ${latestWorkOrder.moldLevel || 'NONE'}`}>
                        霉点：{CONDITION_LABELS[(latestWorkOrder.moldLevel as keyof typeof CONDITION_LABELS) || 'NONE']}
                      </span>
                      <span className={`condition-tag ${latestWorkOrder.odorLevel || 'NONE'}`}>
                        异味：{CONDITION_LABELS[(latestWorkOrder.odorLevel as keyof typeof CONDITION_LABELS) || 'NONE']}
                      </span>
                    </Space>
                  </div>
                  {(latestWorkOrder.partsMissing?.length || 0) > 0 && (
                    <div>
                      <Text strong>缺失部件：</Text>
                      <Tag color="red" style={{ marginLeft: 8 }}>
                        {latestWorkOrder.partsMissing?.join('、')}
                      </Tag>
                    </div>
                  )}
                  {latestWorkOrder.notes && (
                    <div style={{ marginTop: 12, padding: 12, background: '#f5f7fa', borderRadius: 6 }}>
                      <Text type="secondary">作业备注：</Text>
                      <div style={{ marginTop: 4 }}>{latestWorkOrder.notes}</div>
                    </div>
                  )}
                </Col>
              </Row>
            </Card>
          )}

          {photos.length > 0 && (
            <Card title="📷 照片记录" style={{ marginBottom: 20 }}>
              <Row gutter={12}>
                {photos.slice(0, 6).map((photo) => (
                  <Col span={4} key={photo.id}>
                    <img
                      src={photo.dataUrl}
                      alt={photo.type}
                      style={{ width: '100%', height: 100, objectFit: 'cover', borderRadius: 6 }}
                    />
                    <div style={{ fontSize: 12, textAlign: 'center', marginTop: 4 }}>
                      <Tag color={photo.type === 'BEFORE' ? 'orange' : photo.type === 'AFTER' ? 'green' : 'blue'}>
                        {photo.type === 'BEFORE' ? '处理前' : photo.type === 'AFTER' ? '处理后' : '细节'}
                      </Tag>
                    </div>
                  </Col>
                ))}
              </Row>
            </Card>
          )}

          <Row gutter={20}>
            <Col span={14}>
              <Card title="⚖️ 分项评分" extra={
                <Tag color="cyan">满分 5 分</Tag>
              }>
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="wearScore" label="磨损程度 (1-5分)" rules={[{ required: true, message: '请评分' }]}>
                        <Rate count={5} />
                      </Form.Item>
                      <ScoreDisplay label="磨损评分" score={form.getFieldValue('wearScore')} />
                    </Col>
                    <Col span={12}>
                      <Form.Item name="moldScore" label="霉点清洁 (1-5分)" rules={[{ required: true, message: '请评分' }]}>
                        <Rate count={5} />
                      </Form.Item>
                      <ScoreDisplay label="霉点评分" score={form.getFieldValue('moldScore')} />
                    </Col>
                    <Col span={12}>
                      <Form.Item name="odorScore" label="异味清除 (1-5分)" rules={[{ required: true, message: '请评分' }]}>
                        <Rate count={5} />
                      </Form.Item>
                      <ScoreDisplay label="异味评分" score={form.getFieldValue('odorScore')} />
                    </Col>
                    <Col span={12}>
                      <Form.Item name="partsScore" label="部件完整性 (1-5分)" rules={[{ required: true, message: '请评分' }]}>
                        <Rate count={5} />
                      </Form.Item>
                      <ScoreDisplay label="部件评分" score={form.getFieldValue('partsScore')} />
                    </Col>
                  </Row>

                  <div style={{ padding: 16, background: '#f0fdf4', borderRadius: 8, marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text strong>综合评分：</Text>
                      <span style={{ fontSize: 32, fontWeight: 700, color: '#16a34a' }}>
                        {calculateFinalScore(form.getFieldsValue())}
                        <span style={{ fontSize: 16, color: '#6b7280', fontWeight: 400 }}>/5</span>
                      </span>
                    </div>
                  </div>

                  <Form.Item name="inspectorId" label="复检员" rules={[{ required: true, message: '请选择复检员' }]} style={{ marginTop: 16 }}>
                    <Select>
                      {workers.filter(w => w.role === 'INSPECTOR').map(w => (
                        <Option key={w.id} value={w.id}>{w.name}</Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <Form.Item name="notes" label="复检备注">
                    <TextArea rows={3} placeholder="记录复检发现的问题和处理建议..." />
                  </Form.Item>
                </Form>
              </Card>
            </Col>

            <Col span={10}>
              <Card title="🎯 最终结论">
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <Button
                    type="primary"
                    size="large"
                    icon={<CheckCircleOutlined />}
                    style={{ width: '100%', height: 50, fontSize: 16 }}
                    onClick={() => form.setFieldsValue({ result: 'SELLABLE' })}
                  >
                    ✅ 可售 - 正常定价
                  </Button>
                  <Button
                    size="large"
                    icon={<ExclamationCircleOutlined />}
                    style={{ width: '100%', height: 50, fontSize: 16, background: '#fef3c7', borderColor: '#f59e0b', color: '#92400e' }}
                    onClick={() => form.setFieldsValue({ result: 'DISCOUNTED' })}
                  >
                    ⚠️ 降价售 - 有瑕疵
                  </Button>
                  <Button
                    size="large"
                    icon={<ReloadOutlined />}
                    style={{ width: '100%', height: 50, fontSize: 16, background: '#dbeafe', borderColor: '#3b82f6', color: '#1e40af' }}
                    onClick={() => setShowReworkModal(true)}
                  >
                    🔄 返工重洗 - 未达标
                  </Button>
                  <Button
                    danger
                    size="large"
                    icon={<CloseCircleOutlined />}
                    style={{ width: '100%', height: 50, fontSize: 16 }}
                    onClick={() => form.setFieldsValue({ result: 'RETURNED' })}
                  >
                    ❌ 退回 - 不可出售
                  </Button>
                </Space>

                {form.getFieldValue('result') && (
                  <div style={{ marginTop: 20, padding: 16, background: '#f5f7fa', borderRadius: 8, textAlign: 'center' }}>
                    <Text type="secondary">已选择结论：</Text>
                    <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4, color: '#166534' }}>
                      {INSPECTION_RESULT_LABELS[form.getFieldValue('result') as keyof typeof INSPECTION_RESULT_LABELS]}
                    </div>
                    <Button
                      type="primary"
                      style={{ marginTop: 12, width: '100%' }}
                      onClick={() => form.submit()}
                    >
                      确认提交
                    </Button>
                  </div>
                )}
              </Card>

              {inspections.length > 0 && (
                <Card title="📜 历史复检记录" style={{ marginTop: 20 }} size="small">
                  <Table
                    size="small"
                    dataSource={inspections}
                    rowKey="id"
                    pagination={false}
                    columns={[
                      {
                        title: '时间',
                        dataIndex: 'createdAt',
                        render: (t: string) => dayjs(t).format('MM-DD HH:mm'),
                        width: 120
                      },
                      {
                        title: '复检员',
                        dataIndex: 'inspectorId',
                        render: (id: string) => getWorkerName(id),
                        width: 80
                      },
                      {
                        title: '评分',
                        dataIndex: 'finalScore',
                        render: (s: number) => `${s}/5`,
                        width: 60
                      },
                      {
                        title: '结论',
                        dataIndex: 'result',
                        render: (r: string) => (
                          <Tag color={
                            r === 'SELLABLE' ? 'green' :
                            r === 'DISCOUNTED' ? 'gold' :
                            r === 'REWORK' ? 'blue' : 'red'
                          }>
                            {INSPECTION_RESULT_LABELS[r as keyof typeof INSPECTION_RESULT_LABELS]}
                          </Tag>
                        )
                      }
                    ]}
                  />
                </Card>
              )}
            </Col>
          </Row>
        </>
      )}

      <Modal
        title="确认返工"
        open={showReworkModal}
        onCancel={() => setShowReworkModal(false)}
        onOk={() => {
          form.setFieldsValue({ result: 'REWORK' })
          setShowReworkModal(false)
        }}
        okText="确认返工"
        cancelText="取消"
      >
        <p>确定将此商品退回重新清洗吗？这将增加一次返工记录。</p>
        {latestWorkOrder && (
          <p style={{ color: '#f59e0b' }}>
            目前已返工 {latestWorkOrder.reworkCount || 0} 次
          </p>
        )}
      </Modal>
    </div>
  )
}
