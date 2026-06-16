import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Card, Button, Space, Row, Col, Typography, Upload, message, Image, Input, Tag, Select } from 'antd'
import { ArrowLeftOutlined, CameraOutlined, UploadOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons'
import ItemSelector from '../components/ItemSelector'
import { Item, Photo, CATEGORY_LABELS } from '../types'
import type { UploadProps } from 'antd'

const { Title, Text } = Typography
const { Option } = Select

export default function PhotoArchive() {
  const { itemId } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [selectedItemId, setSelectedItemId] = useState<string | undefined>(itemId)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [photos, setPhotos] = useState<Photo[]>([])
  const [photoType, setPhotoType] = useState<'BEFORE' | 'AFTER' | 'DETAIL'>('BEFORE')
  const [newPhotoNotes, setNewPhotoNotes] = useState('')

  useEffect(() => {
    if (selectedItemId) {
      loadItemDetail(selectedItemId)
      loadPhotos(selectedItemId)
    }
  }, [selectedItemId])

  const loadItemDetail = async (id: string) => {
    try {
      const item = await window.api.getItem(id)
      setSelectedItem(item)
    } catch (error) {
      message.error('加载商品详情失败')
      console.error(error)
    }
  }

  const loadPhotos = async (itemId: string) => {
    try {
      const data = await window.api.getPhotos(itemId)
      setPhotos(data)
    } catch (error) {
      console.error('加载照片失败', error)
    }
  }

  const handleItemSelect = (id: string, item?: Item) => {
    setSelectedItemId(id)
    setSelectedItem(item || null)
    setPhotos([])
  }

  const handleFileUpload = async (file: File) => {
    if (!selectedItemId) {
      message.error('请先选择商品')
      return false
    }
    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
      try {
        const photo = {
          id: crypto.randomUUID(),
          itemId: selectedItemId,
          type: photoType,
          dataUrl,
          notes: newPhotoNotes,
          createdAt: new Date().toISOString()
        }
        await window.api.addPhoto(photo)
        setPhotos(prev => [...prev, photo])
        setNewPhotoNotes('')
        message.success('照片上传成功')
      } catch (error) {
        message.error('照片上传失败')
        console.error(error)
      }
    }
    reader.readAsDataURL(file)
    return false
  }

  const handleDeletePhoto = async (photoId: string) => {
    try {
      await window.api.deletePhoto(photoId)
      setPhotos(prev => prev.filter(p => p.id !== photoId))
      message.success('删除成功')
    } catch (error) {
      message.error('删除失败')
      console.error(error)
    }
  }

  const triggerFileInput = () => {
    fileInputRef.current?.click()
  }

  const beforePhotos = photos.filter(p => p.type === 'BEFORE')
  const afterPhotos = photos.filter(p => p.type === 'AFTER')
  const detailPhotos = photos.filter(p => p.type === 'DETAIL')

  const uploadProps: UploadProps = {
    beforeUpload: handleFileUpload,
    showUploadList: false,
    accept: 'image/*',
    multiple: true
  }

  const renderPhotoSection = (title: string, type: Photo['type'], photoList: Photo[]) => (
    <Card title={title} size="small" style={{ marginBottom: 20 }}>
      {photoList.length === 0 ? (
        <div className="photo-box" onClick={() => { setPhotoType(type); triggerFileInput() }}>
          <CameraOutlined style={{ fontSize: 48, color: '#999', marginBottom: 10 }} />
          <Text type="secondary">点击拍摄/上传{title}照片</Text>
        </div>
      ) : (
        <Row gutter={12}>
          {photoList.map(photo => (
            <Col span={8} key={photo.id}>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <Image
                  width="100%"
                  height={150}
                  src={photo.dataUrl}
                  style={{ borderRadius: 8, objectFit: 'cover' }}
                />
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  style={{ position: 'absolute', top: 8, right: 8 }}
                  onClick={() => handleDeletePhoto(photo.id)}
                />
                {photo.notes && (
                  <div style={{ fontSize: 12, color: '#666', marginTop: 4, padding: '4px 8px', background: '#f5f7fa', borderRadius: 4 }}>
                    {photo.notes}
                  </div>
                )}
              </div>
            </Col>
          ))}
          <Col span={8}>
            <div
              className="photo-box"
              style={{ minHeight: 150, height: 150 }}
              onClick={() => { setPhotoType(type); triggerFileInput() }}
            >
              <PlusOutlined style={{ fontSize: 24, color: '#999' }} />
              <Text type="secondary" style={{ fontSize: 12 }}>添加更多</Text>
            </div>
          </Col>
        </Row>
      )}
    </Card>
  )

  return (
    <div>
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')}>返回</Button>
          <div>
            <h1 className="page-title">📷 拍照留档</h1>
            <p className="page-desc">作业前后照片对照，记录商品处理前后状态</p>
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
              placeholder="选择要拍照留档的商品"
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
                    <Text type="secondary">{selectedItem.brand} {selectedItem.model}</Text>
                  </Space>
                  {selectedItem.notes && (
                    <Text type="secondary">收货备注：{selectedItem.notes}</Text>
                  )}
                </Space>
              </Col>
              <Col span={6} style={{ textAlign: 'right' }}>
                <Space direction="vertical" size="small" style={{ textAlign: 'left' }}>
                  <div>
                    <Text type="secondary">处理前照片：</Text>
                    <Tag color="orange" style={{ marginLeft: 8 }}>{beforePhotos.length} 张</Tag>
                  </div>
                  <div>
                    <Text type="secondary">处理后照片：</Text>
                    <Tag color="green" style={{ marginLeft: 8 }}>{afterPhotos.length} 张</Tag>
                  </div>
                  <div>
                    <Text type="secondary">细节照片：</Text>
                    <Tag color="blue" style={{ marginLeft: 8 }}>{detailPhotos.length} 张</Tag>
                  </div>
                </Space>
              </Col>
            </Row>
          </Card>

          <Card title="添加照片" style={{ marginBottom: 20 }}>
            <Row gutter={16} align="middle">
              <Col span={8}>
                <Text strong>照片类型：</Text>
                <Select
                  value={photoType}
                  onChange={setPhotoType}
                  style={{ width: 150, marginLeft: 10 }}
                >
                  <Option value="BEFORE">处理前</Option>
                  <Option value="AFTER">处理后</Option>
                  <Option value="DETAIL">细节特写</Option>
                </Select>
              </Col>
              <Col span={10}>
                <Text strong>备注说明：</Text>
                <Input
                  placeholder="如：污渍位置、磨损部位等"
                  value={newPhotoNotes}
                  onChange={(e) => setNewPhotoNotes(e.target.value)}
                  style={{ marginLeft: 10, width: 250 }}
                />
              </Col>
              <Col span={6} style={{ textAlign: 'right' }}>
                <Space>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) handleFileUpload(file)
                      e.target.value = ''
                    }}
                  />
                  <Button icon={<CameraOutlined />} onClick={triggerFileInput}>
                    拍摄/选择照片
                  </Button>
                  <Upload {...uploadProps}>
                    <Button icon={<UploadOutlined />}>上传文件</Button>
                  </Upload>
                </Space>
              </Col>
            </Row>
          </Card>

          <Row gutter={20}>
            <Col span={12}>
              {renderPhotoSection('🟠 处理前照片', 'BEFORE', beforePhotos)}
            </Col>
            <Col span={12}>
              {renderPhotoSection('🟢 处理后照片', 'AFTER', afterPhotos)}
            </Col>
          </Row>

          {renderPhotoSection('🔵 细节特写', 'DETAIL', detailPhotos)}

          {beforePhotos.length > 0 && afterPhotos.length > 0 && (
            <Card title="📊 前后对照" style={{ marginTop: 20 }}>
              <Row gutter={20}>
                <Col span={12}>
                  <Image
                    width="100%"
                    src={beforePhotos[0]?.dataUrl}
                    style={{ borderRadius: 8 }}
                  />
                  <div style={{ textAlign: 'center', marginTop: 8, fontWeight: 500, color: '#d97706' }}>
                    处理前
                  </div>
                </Col>
                <Col span={12}>
                  <Image
                    width="100%"
                    src={afterPhotos[0]?.dataUrl}
                    style={{ borderRadius: 8 }}
                  />
                  <div style={{ textAlign: 'center', marginTop: 8, fontWeight: 500, color: '#16a34a' }}>
                    处理后
                  </div>
                </Col>
              </Row>
            </Card>
          )}

          <Card style={{ marginTop: 20 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => navigate(`/workorder/${selectedItemId}`)}>
                返回作业单
              </Button>
              <Button type="primary" onClick={() => navigate(`/inspection/${selectedItemId}`)}>
                前往复检判级
              </Button>
            </Space>
          </Card>
        </>
      )}
    </div>
  )
}
