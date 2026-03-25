<template>
  <div class="orders-page">
    <a-page-header title="我的订单" sub-title="查看历史支付记录" />

    <a-card style="margin-top: 24px">
      <a-table
        :columns="columns"
        :data-source="orders"
        :loading="loading"
        row-key="id"
        :pagination="{ pageSize: 10 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'payment_method'">
            <a-tag :color="record.payment_method === 'wechat' ? 'green' : 'blue'">
              {{ record.payment_method === 'wechat' ? '微信支付' : '支付宝' }}
            </a-tag>
          </template>

          <template v-if="column.key === 'status'">
            <a-badge
              :status="statusMap[record.status]?.badge"
              :text="statusMap[record.status]?.label"
            />
          </template>

          <template v-if="column.key === 'amount'">
            <span style="font-weight: bold; color: #f5222d">¥{{ record.amount.toFixed(2) }}</span>
          </template>

          <template v-if="column.key === 'action'">
            <a-button type="link" size="small" @click="handleViewDetail(record)">
              查看详情
            </a-button>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 订单详情弹窗 -->
    <a-modal
      v-model:open="detailVisible"
      title="订单详情"
      :footer="null"
      width="480px"
    >
      <template v-if="currentOrder">
        <a-descriptions :column="1" bordered>
          <a-descriptions-item label="订单号">{{ currentOrder.order_no }}</a-descriptions-item>
          <a-descriptions-item label="描述">{{ currentOrder.description }}</a-descriptions-item>
          <a-descriptions-item label="金额">
            <span style="font-size: 18px; color: #f5222d; font-weight: bold">
              ¥{{ currentOrder.amount.toFixed(2) }}
            </span>
          </a-descriptions-item>
          <a-descriptions-item label="支付方式">
            <a-tag :color="currentOrder.payment_method === 'wechat' ? 'green' : 'blue'">
              {{ currentOrder.payment_method === 'wechat' ? '微信支付' : '支付宝' }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="状态">
            <a-badge
              :status="statusMap[currentOrder.status]?.badge"
              :text="statusMap[currentOrder.status]?.label"
            />
          </a-descriptions-item>
          <a-descriptions-item label="创建时间">
            {{ formatDate(currentOrder.created_at) }}
          </a-descriptions-item>
          <a-descriptions-item v-if="currentOrder.paid_at" label="支付时间">
            {{ formatDate(currentOrder.paid_at) }}
          </a-descriptions-item>
        </a-descriptions>
      </template>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { message } from 'ant-design-vue'
import { getOrdersApi, type PaymentOrder } from '@/api/payment'

const loading = ref(false)
const orders = ref<PaymentOrder[]>([])
const detailVisible = ref(false)
const currentOrder = ref<PaymentOrder | null>(null)

const statusMap: Record<string, { badge: string; label: string }> = {
  pending: { badge: 'processing', label: '待支付' },
  paid: { badge: 'success', label: '已支付' },
  cancelled: { badge: 'default', label: '已取消' },
  refunded: { badge: 'warning', label: '已退款' }
}

const columns = [
  { title: '订单号', dataIndex: 'order_no', key: 'order_no', ellipsis: true },
  { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: '金额', dataIndex: 'amount', key: 'amount' },
  { title: '支付方式', dataIndex: 'payment_method', key: 'payment_method' },
  { title: '状态', dataIndex: 'status', key: 'status' },
  { title: '创建时间', dataIndex: 'created_at', key: 'created_at', ellipsis: true },
  { title: '操作', key: 'action' }
]

const formatDate = (dateStr: string) => {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleString('zh-CN')
}

const fetchOrders = async () => {
  loading.value = true
  try {
    const res = await getOrdersApi()
    orders.value = res.data || []
  } catch {
    message.error('获取订单列表失败')
  } finally {
    loading.value = false
  }
}

const handleViewDetail = (record: PaymentOrder) => {
  currentOrder.value = record
  detailVisible.value = true
}

onMounted(() => {
  fetchOrders()
})
</script>

<style scoped>
.orders-page {
  padding: 24px;
}
</style>
