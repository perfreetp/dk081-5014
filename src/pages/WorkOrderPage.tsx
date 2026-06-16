import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Descriptions, Button, Space, Steps, Checkbox, Select, Input, Form, Row, Col, Tag, message, Typography, Modal } from 'antd'
import { ArrowLeftOutlined, ClockCircleOutlined, PlayCircleOutlined, PauseCircleOutlined, CheckCircleOutlined } from '@ant-design/icons'
import ItemSelector from '../components/ItemSelector'
import { Item, WorkflowStep, CATEGORY_LABELS, Worker } from '../types'

const { Text } = Typography
const { Option } = Select
const { TextArea } = Input

const CLEANING_RESTRICTIONS = [
  { value: 'WASHABLE', label: '可水洗' },
  { value: 'WIPE_ONLY', label: '仅可擦拭' },
  { value: 'NO_HIGH_TEMP', label: '不可高温' },
  { value: 'NO_BLEACH', label: '不可漂白' },
  { value: 'NO_SUN', label: '不可暴晒' },
  { value: 'DELICATE', label: '轻柔处理' },
]

export default function WorkOrderPage() {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>(itemId)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [workflow, setWorkflow] = useState<WorkflowStep[]>([])
  const [completedSteps, setCompletedSteps] = useState<number[]>([])
  const [categoryParts, setCategoryParts] = useState<string[]>([])
  const [partsChecklist, setPartsChecklist] = useState<Record<string, boolean>>({})
  const [workers, setWorkers] = useState<Worker[]>([])
  const [currentStep, setCurrentStep] = useState(0)
  const [timing, setTiming] = useState(false)
  const [startTime, setStartTime] = useState<string>()
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [form] = Form.useForm()

  useEffect(() => {
    loadWorkers()
  }, [])

  useEffect(() => {
    if (selectedItemId) {
      loadItemDetail(selectedItemId)
      loadCategoryData()
    }
  }, [selectedItemId])

  useEffect(() => {
    let interval: NodeJS.Timeout
    if (timing) {
      interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [timing])

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
        workerId: item.assignedTo,
      })
    } catch (error) {
      message.error('加载商品详情失败')
      console.error(error)
    }
  }

  const loadCategoryData = async () => {
    if (!selectedItem) return
    try {
      const [steps, parts] = await Promise.all([
        window.api.getCategoryWorkflow(selectedItem.category),
        window.api.getCategoryParts(selectedItem.category)
      ])
      setWorkflow(steps)
      setCategoryParts(parts)
      const initialChecklist: Record<string, boolean> = {}
      parts.forEach((p: string) => { initialChecklist[p] = true })
      setPartsChecklist(initialChecklist)
    } catch (error) {
      console.error('加载品类数据失败', error)
    }
  }

  const handleItemSelect = (id: string, item?: Item) => {
    setSelectedItemId(id)
    setSelectedItem(item || null)
    setCompletedSteps([])
    setCurrentStep(0)
    setElapsedSeconds(0)
    setTiming(false)
  }

  const handleStartTimer = () => {
    setStartTime(new Date().toISOString())
    setTiming(true)
    message.info('计时开始')
  }

  const handlePauseTimer = () => {
    setTiming(false)
    message.info('计时暂停')
  }

  const handleStepComplete = (stepIndex: number) => {
    if (!completedSteps.includes(stepIndex)) {
      setCompletedSteps([...completedSteps, stepIndex])
    }
    if (stepIndex + 1 > currentStep) {
      setCurrentStep(stepIndex + 1)
    }
  }

  const handlePartToggle = (part: string, checked: boolean) => {
    setPartsChecklist(prev => ({
      ...prev,
      [part]: checked
    }))
  }

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = seconds % 60
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  const handleSubmit = async (values: any) => {
    if (!selectedItem || !selectedItemId) {
      message.error('请先选择商品')
      return
    }
    if (completedSteps.length < workflow.length) {
      Modal.confirm({
        title: '作业步骤未完成',
        content: `还有 ${workflow.length - completedSteps.length} 个步骤未完成，确定要提交吗？`,
        onOk: async () => await doSubmit(values)
      })
      return
    }
    await doSubmit(values)
  }

  const doSubmit = async (values: any) => {
    if (!selectedItem || !selectedItemId) return
    try {
      const now = new Date().toISOString()
      const missingParts = Object.entries(partsChecklist)
        .filter(([_, present]) => !present)
        .map(([part]) => part)

      const workOrder = {
        id: crypto.randomUUID(),
        itemId: selectedItemId,
        category: selectedItem.category,
        workerId: values.workerId,
        startTime: startTime,
        endTime: now,
        totalMinutes: Math.ceil(elapsedSeconds / 60),
        reworkCount: 0,
        partsChecklist,
        cleaningRestrictions: values.restrictions || [],
        wearLevel: values.wearLevel,
        moldLevel: values.moldLevel,
        odorLevel: values.odorLevel,
        partsMissing: missingParts,
        notes: values.notes,
        createdAt: now
      }

      await window.api.createWorkOrder(workOrder)
      await window.api.updateItem(selectedItemId, {
        status: 'INSPECTING',
        updated_at: now
      })

      message.success('作业完成，已提交复检')
      setTimeout(() => navigate(`/inspection/${selectedItemId}`), 1000)
    } catch (error) {
      message.error('提交失败')
      console.error(error)
    }
  }

  const handlePhotoArchive = () => {
    if (selectedItemId) {
      navigate(`/photo/${selectedItemId}`)
    }
  }

  const getWorkerName = (id?: string) => {
    if (!id) return '-'
    return workers.find(w => w.id === id)?.name || '-'
  }

  return (
    <div>
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>返回</Button>
          <div>
            <h1 className="page-title">📝 分品类作业单</h1>
            <p className="page-desc">根据不同品类执行标准化清洁流程，记录处理过程</p>
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
              statusFilter={['CLEANING']}
              placeholder="选择要处理的商品"
            />
          </div>
        </Space>
      </Card>

      {selectedItem && (
        <>
          <Card style={{ marginBottom: 20 }}>
            <Descriptions bordered column={4} size="small">
              <Descriptions.Item label="商品编码">{selectedItem.code}</Descriptions.Item>
              <Descriptions.Item label="商品名称">{selectedItem.name}</Descriptions.Item>
              <Descriptions.Item label="品类">
                <Tag color="blue">{CATEGORY_LABELS[selectedItem.category as keyof typeof CATEGORY_LABELS]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="品牌型号">{selectedItem.brand} {selectedItem.model}</Descriptions.Item>
              <Descriptions.Item label="收货日期">{selectedItem.receivedDate}</Descriptions.Item>
              <Descriptions.Item label="来源">{selectedItem.source}</Descriptions.Item>
              <Descriptions.Item label="清洗员">{getWorkerName(selectedItem.assignedTo)}</Descriptions.Item>
              <Descriptions.Item label="收货备注">{selectedItem.notes || '-'}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Row gutter={20}>
            <Col span={14}>
              <Card title="作业流程" extra={
                <Space>
                  {!timing && !startTime && (
                    <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleStartTimer}>
                      开始计时
                    </Button>
                  )}
                  {timing && (
                    <Button icon={<PauseCircleOutlined />} onClick={handlePauseTimer}>
                      暂停
                    </Button>
                  )}
                  {!timing && startTime && (
                    <Button type="primary" icon={<PlayCircleOutlined />} onClick={() => setTiming(true)}>
                      继续
                    </Button>
                  )}
                  <span style={{ fontFamily: 'monospace', fontSize: 20, fontWeight: 600, color: '#166534' }}>
                    <ClockCircleOutlined /> {formatTime(elapsedSeconds)}
                  </span>
                </Space>
              }>
                <Steps
                  direction="vertical"
                  current={currentStep}
                  items={workflow.map((step, index) => ({
                    title: (
                      <Space>
                        <span>{step.stepName}</span>
                        <Tag color="gold">预计 {step.requiredTimeMinutes} 分钟</Tag>
                        {completedSteps.includes(index) && <CheckCircleOutlined style={{ color: '#22c55e' }} />}
                      </Space>
                    ),
                    description: (
                      <div style={{ padding: '10px 0' }}>
                        <p style={{ margin: '0 0 8px 0', color: '#666' }}>{step.description}</p>
                        <p style={{ margin: 0, fontSize: 12, color: '#999' }}>
                          所需工具：{step.tools || '无'}
                        </p>
                        <Button
                          size="small"
                          type={completedSteps.includes(index) ? 'default' : 'primary'}
                          style={{ marginTop: 10 }}
                          onClick={() => handleStepComplete(index)}
                          disabled={index > currentStep}
                        >
                          {completedSteps.includes(index) ? '重新标记完成' : '标记完成'}
                        </Button>
                      </div>
                    ),
                    status: completedSteps.includes(index) ? 'finish' : index === currentStep ? 'process' : 'wait'
                  }))}
                />
              </Card>
            </Col>

            <Col span={10}>
              <Card title="部件检查" style={{ marginBottom: 20 }}>
                <div className="timeline">
                  {categoryParts.map((part) => (
                    <div key={part} className="timeline-item completed">
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span>{part}</span>
                        <Checkbox
                          checked={partsChecklist[part] ?? true}
                          onChange={(e) => handlePartToggle(part, e.target.checked)}
                        >
                          {partsChecklist[part] !== false ? '齐全' : '缺失'}
                        </Checkbox>
                      </div>
                    </div>
                  ))}
                </div>
                {Object.values(partsChecklist).some(v => !v) && (
                  <Tag color="red" style={{ marginTop: 10 }}>
                    缺失部件：{Object.entries(partsChecklist).filter(([_, v]) => !v).map(([k]) => k).join('、')}
                  </Tag>
                )}
              </Card>

              <Card title="清洁限制" style={{ marginBottom: 20 }}>
                <Checkbox.Group
                  options={CLEANING_RESTRICTIONS}
                  value={form.getFieldValue('restrictions') || []}
                  onChange={(values) => form.setFieldsValue({ restrictions: values })}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}
                />
              </Card>

              <Card title="初检评估">
                <Form form={form} layout="vertical">
                  <Row gutter={12}>
                    <Col span={8}>
                      <Form.Item name="wearLevel" label="磨损程度">
                        <Select placeholder="请选择">
                          <Option value="NONE">无磨损</Option>
                          <Option value="MILD">轻微</Option>
                          <Option value="MODERATE">中等</Option>
                          <Option value="SEVERE">严重</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="moldLevel" label="霉点情况">
                        <Select placeholder="请选择">
                          <Option value="NONE">无霉点</Option>
                          <Option value="MILD">轻微</Option>
                          <Option value="MODERATE">中等</Option>
                          <Option value="SEVERE">严重</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                    <Col span={8}>
                      <Form.Item name="odorLevel" label="异味情况">
                        <Select placeholder="请选择">
                          <Option value="NONE">无异味</Option>
                          <Option value="MILD">轻微</Option>
                          <Option value="MODERATE">中等</Option>
                          <Option value="SEVERE">严重</Option>
                        </Select>
                      </Form.Item>
                    </Col>
                  </Row>
                  <Form.Item name="workerId" label="作业员">
                    <Select>
                      {workers.filter(w => w.role === 'CLEANER').map(w => (
                        <Option key={w.id} value={w.id}>{w.name}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                  <Form.Item name="notes" label="作业备注">
                    <TextArea rows={3} placeholder="记录清洁过程中的特殊情况..." />
                  </Form.Item>
                </Form>
              </Card>
            </Col>
          </Row>

          <Card style={{ marginTop: 20 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={handlePhotoArchive}>
                前往拍照留档
              </Button>
              <Button type="primary" onClick={() => form.submit()}>
                完成清洁，提交复检
              </Button>
            </Space>
          </Card>
        </>
      )}

      <Form form={form} style={{ display: 'none' }} onFinish={handleSubmit}>
        {/* Hidden form for submit handling */}
      </Form>
    </div>
  )
}
