import { useEffect, useState } from 'react'
import { Select, Spin } from 'antd'
import { Item } from '../types'

interface ItemSelectorProps {
  value?: string
  onChange?: (value: string, item?: Item) => void
  statusFilter?: string[]
  placeholder?: string
}

export default function ItemSelector({ value, onChange, statusFilter, placeholder = '选择商品' }: ItemSelectorProps) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadItems()
  }, [])

  const loadItems = async () => {
    setLoading(true)
    try {
      const filters: any = {}
      if (statusFilter && statusFilter.length > 0) {
        filters.status = statusFilter
      }
      const data = await window.api.getItems(filters)
      setItems(data)
    } catch (error) {
      console.error('加载商品列表失败', error)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (val: string) => {
    const item = items.find(i => i.id === val)
    onChange?.(val, item)
  }

  if (loading) {
    return <Spin size="small" />
  }

  return (
    <Select
      showSearch
      placeholder={placeholder}
      optionFilterProp="children"
      style={{ width: '100%' }}
      value={value}
      onChange={handleChange}
      filterOption={(input, option) =>
        (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
      }
      options={items.map(item => ({
        value: item.id,
        label: `${item.code} - ${item.name}`,
      }))}
    />
  )
}
