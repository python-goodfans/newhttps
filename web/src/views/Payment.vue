<template>
  <div class="payment-page">
    <a-page-header title="升级套餐" sub-title="选择适合您的套餐计划" />

    <div class="payment-content">
      <!-- 套餐列表 -->
      <div v-if="!selectedPlan" class="plans-section">
        <a-spin :spinning="plansLoading">
          <a-row :gutter="24" justify="center">
            <a-col
              v-for="plan in plans"
              :key="plan.id"
              :xs="24"
              :sm="12"
              :lg="8"
            >
              <a-card
                :class="['plan-card', plan.price === 0 ? '' : plan.price < 200 ? 'plan-popular' : 'plan-enterprise']"
                hoverable
                @click="handleSelectPlan(plan)"
              >
                <template #title>
                  <div class="plan-title">
                    <span>{{ plan.name }}</span>
                    <a-tag v-if="plan.price > 0 && plan.price < 200" color="orange">推荐</a-tag>
                  </div>
                </template>
                <div class="plan-price">
                  <span class="price-value">
                    <template v-if="plan.price === 0">免费</template>
                    <template v-else>¥{{ plan.price }}<small>/年</small></template>
                  </span>
                </div>
                <p class="plan-desc">{{ plan.description }}</p>
                <ul class="plan-features">
                  <li v-for="(feature, idx) in plan.features" :key="idx">
                    <CheckCircleOutlined class="feature-icon" />
                    {{ feature }}
                  </li>
                </ul>
                <a-button
                  :type="plan.price === 0 ? 'default' : 'primary'"
                  block
                  style="margin-top: 16px"
                >
                  {{ plan.price === 0 ? '当前免费版' : '立即购买' }}
                </a-button>
              </a-card>
            </a-col>
          </a-row>
        </a-spin>
      </div>

      <!-- 支付区域 -->
      <div v-else class="checkout-section">
        <a-card class="checkout-card">
          <template #title>
            <div style="display: flex; align-items: center; gap: 8px">
              <a-button type="text" @click="selectedPlan = null">
                <ArrowLeftOutlined />
              </a-button>
              <span>确认订单</span>
            </div>
          </template>

          <a-descriptions :column="1" bordered>
            <a-descriptions-item label="套餐">{{ selectedPlan.name }}</a-descriptions-item>
            <a-descriptions-item label="有效期">{{ selectedPlan.duration_days }} 天</a-descriptions-item>
            <a-descriptions-item label="金额">
              <span style="font-size: 20px; color: #f5222d; font-weight: bold">¥{{ selectedPlan.price }}</span>
            </a-descriptions-item>
          </a-descriptions>

          <div style="margin-top: 24px">
            <p style="margin-bottom: 12px; font-weight: 500">选择支付方式：</p>
            <a-tabs v-model:activeKey="paymentMethod">
              <a-tab-pane key="wechat" tab="微信支付">
                <div class="qr-container">
                  <img
                    v-if="order && order.pay_url"
                    :src="`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(order.pay_url)}`"
                    alt="微信支付二维码"
                    class="qr-code"
                  />
                  <p class="qr-tip">请使用微信扫码支付</p>
                </div>
              </a-tab-pane>
              <a-tab-pane key="alipay" tab="支付宝支付">
                <div class="qr-container">
                  <img
                    v-if="order && order.pay_url"
                    :src="`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(order.pay_url)}`"
                    alt="支付宝支付二维码"
                    class="qr-code"
                  />
                  <p class="qr-tip">请使用支付宝扫码支付</p>
                </div>
              </a-tab-pane>
            </a-tabs>
          </div>

          <div v-if="!order" style="margin-top: 16px">
            <a-button type="primary" size="large" :loading="payLoading" block @click="handleCreateOrder">
              生成支付二维码
            </a-button>
          </div>

          <div v-if="order" class="order-status">
            <a-alert
              v-if="order.status === 'paid'"
              message="支付成功！感谢您的购买。"
              type="success"
              show-icon
            />
            <a-alert
              v-else
              message="等待支付中，二维码有效期 15 分钟"
              type="info"
              show-icon
            />
          </div>
        </a-card>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { message } from 'ant-design-vue'
import { CheckCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons-vue'
import { getPlansApi, createPaymentApi, getOrderDetailApi, type PaymentPlan, type PaymentOrder } from '@/api/payment'

const plansLoading = ref(false)
const payLoading = ref(false)
const plans = ref<PaymentPlan[]>([])
const selectedPlan = ref<PaymentPlan | null>(null)
const paymentMethod = ref<'wechat' | 'alipay'>('wechat')
const order = ref<PaymentOrder | null>(null)
let pollTimer: ReturnType<typeof setInterval> | null = null

const fetchPlans = async () => {
  plansLoading.value = true
  try {
    const res = await getPlansApi()
    plans.value = res.data || []
  } catch {
    message.error('获取套餐列表失败')
  } finally {
    plansLoading.value = false
  }
}

const handleSelectPlan = (plan: PaymentPlan) => {
  if (plan.price === 0) {
    message.info('您当前使用的是免费版')
    return
  }
  selectedPlan.value = plan
  order.value = null
}

const handleCreateOrder = async () => {
  if (!selectedPlan.value) return
  payLoading.value = true
  try {
    const res = await createPaymentApi({
      amount: selectedPlan.value.price,
      paymentMethod: paymentMethod.value,
      description: `购买 ${selectedPlan.value.name}`,
      planId: selectedPlan.value.id
    })
    order.value = res.data
    startPolling()
  } catch (error: any) {
    message.error(error?.message || '创建订单失败')
  } finally {
    payLoading.value = false
  }
}

const startPolling = () => {
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = setInterval(async () => {
    if (!order.value || order.value.status === 'paid') {
      clearInterval(pollTimer!)
      return
    }
    try {
      const res = await getOrderDetailApi(order.value.id)
      order.value = res.data
      if (res.data.status === 'paid') {
        clearInterval(pollTimer!)
        message.success('支付成功！')
      }
    } catch {
      // 静默处理轮询错误
    }
  }, 3000)
}

watch(paymentMethod, () => {
  order.value = null
  if (pollTimer) clearInterval(pollTimer)
})

onMounted(() => {
  fetchPlans()
})
</script>

<style scoped>
.payment-page {
  padding: 24px;
}

.payment-content {
  margin-top: 24px;
}

.plan-card {
  margin-bottom: 24px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.plan-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.plan-popular {
  border-color: #fa8c16;
}

.plan-enterprise {
  border-color: #722ed1;
}

.plan-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 18px;
  font-weight: bold;
}

.plan-price {
  text-align: center;
  margin: 16px 0;
}

.price-value {
  font-size: 32px;
  font-weight: bold;
  color: #1890ff;
}

.price-value small {
  font-size: 14px;
  color: #666;
}

.plan-desc {
  color: #666;
  text-align: center;
  margin-bottom: 16px;
}

.plan-features {
  list-style: none;
  padding: 0;
  margin: 0;
}

.plan-features li {
  padding: 6px 0;
  color: #333;
}

.feature-icon {
  color: #52c41a;
  margin-right: 8px;
}

.checkout-card {
  max-width: 560px;
  margin: 0 auto;
}

.qr-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 0;
}

.qr-code {
  width: 200px;
  height: 200px;
  border: 1px solid #eee;
  border-radius: 4px;
}

.qr-tip {
  margin-top: 12px;
  color: #666;
}

.order-status {
  margin-top: 16px;
}
</style>
