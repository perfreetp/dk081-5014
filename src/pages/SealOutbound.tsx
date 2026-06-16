import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Button, Space, Row, Col, Typography, Select, Form, Tag, message, Descriptions, Table, Divider, QRCode } from 'antd'
import { ArrowLeftOutlined, PrinterOutlined, QrcodeOutlined, CheckCircleOutlined } from '@ant-design/icons'
import ItemSelector from '../components/ItemSelector'
import { Item, WorkOrder, Inspection, Photo, Seal, HistoryCard, Worker, CATEGORY_LABELS, STATUS_LABELS, STATUS_COLORS, INSPECTION_RESULT_LABELS } from '../types'
import dayjs from 'dayjs'

const { Title, Text } = Typography
const { Option } = Select

export default function SealOutbound() {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const printRef = useRef<HTMLDivElement>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>(itemId)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([])
  const [photos, setPhotos] = useState<Photo[]>([])
  const [inspections, setInspections] = useState<Inspection[]>([])
  const [workers, setWorkers] = useState<Worker[]>([])
  const [seals, setSeals] = useState<Seal[]>([])
  const [form] = Form.useForm()
  const [currentSeal, setCurrentSeal] = useState<Seal | null>(null)

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
        operatorId: workers.find(w => w.role === 'OPERATOR')?.id
      })
    } catch (error) {
      message.error('加载商品详情失败')
      console.error(error)
    }
  }

  const loadRelatedData = async (itemId: string) => {
    try {
      const [orders, insps, phs, sls] = await Promise.all([
        window.api.getWorkOrders(itemId),
        window.api.getInspections(itemId),
        window.api.getPhotos(itemId),
        window.api.getSeals(itemId)
      ])
      setWorkOrders(orders.map((o: any) => ({
        ...o,
        partsChecklist: o.parts_checklist ? JSON.parse(o.parts_checklist) : {},
        cleaningRestrictions: o.cleaning_restrictions ? JSON.parse(o.cleaning_restrictions) : [],
        partsMissing: o.parts_missing ? JSON.parse(o.parts_missing) : []
      })))
      setInspections(insps)
      setPhotos(phs)
      setSeals(sls.map((s: any) => ({
        ...s,
        historyCard: JSON.parse(s.history_card)
      })))
      if (sls.length > 0) {
        const latestSeal = sls[sls.length - 1]
        setCurrentSeal({
          ...latestSeal,
          historyCard: JSON.parse(latestSeal.history_card)
        })
      }
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
    setSeals([])
    setCurrentSeal(null)
    form.resetFields()
  }

  const getWorkerName = (id?: string) => {
    if (!id) return '-'
    return workers.find(w => w.id === id)?.name || '-'
  }

  const generateSealCode = () => {
    const date = dayjs().format('YYYYMMDD')
    const random = Math.random().toString(36).substring(2, 8).toUpperCase()
    return `SEAL-${date}-${random}`
  }

  const handleSeal = async (values: any) => {
    if (!selectedItem || !selectedItemId) return
    try {
      const now = new Date().toISOString()
      const sealCode = generateSealCode()
      const operatorName = getWorkerName(values.operatorId)

      const historyCard: HistoryCard = {
        item: selectedItem,
        workOrders,
        inspections,
        photos: photos.slice(0, 4),
        sealCode,
        sealedAt: now,
        operatorName
      }

      const seal: Seal = {
        id: crypto.randomUUID(),
        itemId: selectedItemId,
        sealCode,
        operatorId: values.operatorId,
        historyCard,
        createdAt: now
      }

      await window.api.createSeal(seal)
      await window.api.updateItem(selectedItemId, {
        status: 'SEALED',
        updated_at: now
      })

      setCurrentSeal(seal)
      message.success('封存成功！')
      loadRelatedData(selectedItemId)
    } catch (error) {
      message.error('封存失败')
      console.error(error)
    }
  }

  const handlePrint = () => {
    if (printRef.current) {
      const printWindow = window.open('', '_blank')
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>履历卡 - ${currentSeal?.sealCode}</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 20px; }
                .history-card { border: 2px solid #000; padding: 20px; max-width: 400px; margin: 0 auto; }
                .header { text-align: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 15px; }
                .logo { font-size: 24px; font-weight: bold; color: #166534; }
                .title { font-size: 18px; font-weight: 600; margin-top: 5px; }
                .item-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 14px; }
                .label { color: #666; }
                .value { font-weight: 500; }
                .footer { margin-top: 15px; padding-top: 10px; border-top: 1px solid #000; text-align: center; font-size: 12px; color: #666; }
                .seal-code { font-family: 'Courier New', monospace; font-size: 18px; font-weight: bold; letter-spacing: 2px; text-align: center; margin: 10px 0; }
                .qr-container { text-align: center; margin: 15px 0; }
                .tag { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
                .tag-green { background: #dcfce7; color: #166534; }
                .tag-blue { background: #dbeafe; color: #1e40af; }
                .tag-gold { background: #fef3c7; color: #92400e; }
              </style>
            </head>
            <body>
              ${printRef.current.innerHTML}
            </body>
          </html>
        `)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => {
          printWindow.print()
          printWindow.close()
        }, 500)
      }
    }
  }

  const handleMarkSold = async () => {
    if (!selectedItemId) return
    try {
      await window.api.updateItem(selectedItemId, {
        status: 'SOLD',
        updated_at: new Date().toISOString()
      })
      message.success('已标记为已出售')
      loadItemDetail(selectedItemId)
    } catch (error) {
      message.error('操作失败')
      console.error(error)
    }
  }

  const latestInspection = inspections[inspections.length - 1]
  const latestWorkOrder = workOrders[workOrders.length - 1]

  return (
    <div>
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>返回</Button>
          <div>
            <h1 className="page-title">📦 封存出库</h1>
            <p className="page-desc">生成封签和履历卡，完成商品出库前的最后确认</p>
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
              statusFilter={['SEALED', 'INSPECTING']}
              placeholder="选择要封存的商品"
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
                {latestInspection && (
                  <Space direction="vertical" size="small" style={{ textAlign: 'left' }}>
                    <div>
                      <Text type="secondary">复检评分：</Text>
                      <Text strong style={{ marginLeft: 8, fontSize: 18, color: '#16a34a' }}>
                        {latestInspection.finalScore}/5
                      </Text>
                    </div>
                    <div>
                      <Text type="secondary">复检结论：</Text>
                      <Tag
                        color={
                          latestInspection.result === 'SELLABLE' ? 'green' :
                          latestInspection.result === 'DISCOUNTED' ? 'gold' : 'red'
                        }
                        style={{ marginLeft: 8 }}
                      >
                        {INSPECTION_RESULT_LABELS[latestInspection.result as keyof typeof INSPECTION_RESULT_LABELS]}
                      </Tag>
                    </div>
                  </Space>
                )}
              </Col>
            </Row>
          </Card>

          <Row gutter={20}>
            <Col span={14}>
              {!currentSeal ? (
                <Card title="🔒 生成封签">
                  <Descriptions bordered column={2} size="small" style={{ marginBottom: 16 }}>
                    <Descriptions.Item label="清洁耗时">
                      {latestWorkOrder?.totalMinutes || 0} 分钟
                    </Descriptions.Item>
                    <Descriptions.Item label="返工次数">
                      <Tag color={latestWorkOrder?.reworkCount ? 'orange' : 'green'}>
                        {latestWorkOrder?.reworkCount || 0} 次
                      </Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="清洁员">
                      {getWorkerName(latestWorkOrder?.workerId)}
                    </Descriptions.Item>
                    <Descriptions.Item label="复检员">
                      {getWorkerName(latestInspection?.inspectorId)}
                    </Descriptions.Item>
                  </Descriptions>

                  {latestWorkOrder?.cleaningRestrictions?.length ? (
                    <div style={{ marginBottom: 16 }}>
                      <Text strong>清洁限制：</Text>
                      <Space style={{ marginLeft: 8 }} wrap>
                        {latestWorkOrder.cleaningRestrictions.map((r: string) => (
                          <Tag key={r} color="blue">{r}</Tag>
                        ))}
                      </Space>
                    </div>
                  ) : null}

                  {latestInspection?.notes && (
                    <div style={{ marginBottom: 16, padding: 12, background: '#fef3c7', borderRadius: 6 }}>
                      <Text type="secondary" strong>复检备注：</Text>
                      <div style={{ marginTop: 4 }}>{latestInspection.notes}</div>
                    </div>
                  )}

                  <Form form={form} layout="vertical" onFinish={handleSeal}>
                    <Form.Item name="operatorId" label="仓管员" rules={[{ required: true, message: '请选择仓管员' }]}>
                      <Select>
                        {workers.filter(w => w.role === 'OPERATOR' || w.role === 'SUPERVISOR').map(w => (
                          <Option key={w.id} value={w.id}>{w.name}</Option>
                        ))}
                      </Select>
                    </Form.Item>
                    <Form.Item style={{ marginBottom: 0 }}>
                      <Button type="primary" size="large" icon={<QrcodeOutlined />} htmlType="submit" style={{ width: '100%', height: 48, fontSize: 16 }}>
                        生成封签并封存
                      </Button>
                    </Form.Item>
                  </Form>
                </Card>
              ) : (
                <Card title="✅ 封签信息" extra={
                  <Tag color="green" icon={<CheckCircleOutlined />}>已封存</Tag>
                }>
                  <div className="seal-preview">
                    <div style={{ fontSize: 14, opacity: 0.9 }}>封签编号</div>
                    <div className="seal-code">{currentSeal.sealCode}</div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      封存时间：{dayjs(currentSeal.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.8 }}>
                      仓管员：{currentSeal.historyCard.operatorName}
                    </div>
                    <div style={{ marginTop: 15, background: 'white', padding: 15, borderRadius: 8, display: 'inline-block' }}>
                      <QRCode
                        value={`https://babycare-recycle.com/verify?code=${currentSeal.sealCode}`}
                        size={100}
                        color="#166534"
                        bgColor="transparent"
                      />
                    </div>
                  </div>

                  <Space style={{ marginTop: 20, width: '100%' }} direction="vertical">
                    <Button icon={<PrinterOutlined />} size="large" onClick={handlePrint} style={{ width: '100%' }}>
                      打印履历卡
                    </Button>
                    {selectedItem.status !== 'SOLD' && (
                      <Button type="primary" size="large" onClick={handleMarkSold} style={{ width: '100%' }}>
                        标记为已出售
                      </Button>
                    )}
                  </Space>
                </Card>
              )}

              {seals.length > 1 && (
                <Card title="📜 历史封签记录" style={{ marginTop: 20 }} size="small">
                  <Table
                    size="small"
                    dataSource={seals}
                    rowKey="id"
                    pagination={false}
                    columns={[
                      {
                        title: '封签编号',
                        dataIndex: 'sealCode',
                        render: (code: string) => (
                          <span style={{ fontFamily: 'monospace' }}>{code}</span>
                        )
                      },
                      {
                        title: '时间',
                        dataIndex: 'createdAt',
                        render: (t: string) => dayjs(t).format('YYYY-MM-DD HH:mm')
                      },
                      {
                        title: '仓管员',
                        dataIndex: 'operatorId',
                        render: (id: string) => getWorkerName(id)
                      }
                    ]}
                  />
                </Card>
              )}
            </Col>

            <Col span={10}>
              <Card title="📇 履历卡预览">
                <div ref={printRef}>
                  <div className="history-card">
                    <div className="history-card-header">
                      <div className="history-card-logo">🌿 母婴回收</div>
                      <div className="history-card-title">商品处理履历卡</div>
                    </div>

                    <div style={{ textAlign: 'center', margin: '10px 0' }}>
                      <div style={{ fontSize: 12, color: '#666' }}>封签编号</div>
                      <div style={{ fontFamily: 'Courier New, monospace', fontSize: 18, fontWeight: 'bold', letterSpacing: 1 }}>
                        {currentSeal?.sealCode || '待生成'}
                      </div>
                    </div>

                    <div className="history-card-item">
                      <span className="history-card-label">商品编码：</span>
                      <span className="history-card-value">{selectedItem.code}</span>
                    </div>
                    <div className="history-card-item">
                      <span className="history-card-label">商品名称：</span>
                      <span className="history-card-value">{selectedItem.name}</span>
                    </div>
                    <div className="history-card-item">
                      <span className="history-card-label">品类：</span>
                      <span className="history-card-value">{CATEGORY_LABELS[selectedItem.category as keyof typeof CATEGORY_LABELS]}</span>
                    </div>
                    <div className="history-card-item">
                      <span className="history-card-label">品牌型号：</span>
                      <span className="history-card-value">{selectedItem.brand} {selectedItem.model}</span>
                    </div>
                    <div className="history-card-item">
                      <span className="history-card-label">收货日期：</span>
                      <span className="history-card-value">{selectedItem.receivedDate}</span>
                    </div>

                    <Divider style={{ margin: '10px 0' }} />

                    {latestWorkOrder && (
                      <>
                        <div className="history-card-item">
                          <span className="history-card-label">清洁耗时：</span>
                          <span className="history-card-value">{latestWorkOrder.totalMinutes || 0} 分钟</span>
                        </div>
                        <div className="history-card-item">
                          <span className="history-card-label">返工次数：</span>
                          <span className="history-card-value">
                            <span className={`tag ${latestWorkOrder.reworkCount ? 'tag-gold' : 'tag-green'}`}>
                              {latestWorkOrder.reworkCount || 0} 次
                            </span>
                          </span>
                        </div>
                        <div className="history-card-item">
                          <span className="history-card-label">清洁员：</span>
                          <span className="history-card-value">{getWorkerName(latestWorkOrder.workerId)}</span>
                        </div>
                      </>
                    )}

                    {latestInspection && (
                      <>
                        <div className="history-card-item">
                          <span className="history-card-label">复检评分：</span>
                          <span className="history-card-value">{latestInspection.finalScore}/5 分</span>
                        </div>
                        <div className="history-card-item">
                          <span className="history-card-label">复检结论：</span>
                          <span className="history-card-value">
                            <span className={`tag ${latestInspection.result === 'SELLABLE' ? 'tag-green' : latestInspection.result === 'DISCOUNTED' ? 'tag-gold' : ''}`}>
                              {INSPECTION_RESULT_LABELS[latestInspection.result as keyof typeof INSPECTION_RESULT_LABELS]}
                            </span>
                          </span>
                        </div>
                        <div className="history-card-item">
                          <span className="history-card-label">复检员：</span>
                          <span className="history-card-value">{getWorkerName(latestInspection.inspectorId)}</span>
                        </div>
                      </>
                    )}

                    <div className="history-card-footer">
                      封存时间：{currentSeal ? dayjs(currentSeal.createdAt).format('YYYY-MM-DD HH:mm:ss') : '待封存'}
                      <br />
                      本商品已通过标准化清洁消毒处理，可安全使用
                    </div>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </div>
  )
}
