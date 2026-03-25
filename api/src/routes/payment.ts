import { Router, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Database } from '../services/database';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();

/**
 * 生成订单号
 */
function generateOrderNo(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `ORD${date}${random}`;
}

/**
 * 生成模拟支付二维码 URL
 */
function generateMockPayUrl(paymentMethod: 'wechat' | 'alipay', orderNo: string, amount: number): string {
  if (paymentMethod === 'wechat') {
    return `https://wx.tenpay.com/cgi-bin/mmpayweb-bin/checkmweb?prepay_id=mock_${orderNo}&package=Sign%3DWxPaySign&mock=1&amount=${amount}`;
  } else {
    return `https://openapi.alipay.com/gateway.do?mock=1&out_trade_no=${orderNo}&total_amount=${amount}`;
  }
}

/**
 * GET /api/v1/payment/plans - 获取套餐计划列表
 */
router.get('/plans', async (req, res: Response): Promise<any> => {
  try {
    const db = Database.getInstance();
    const plans = await db.getAllPaymentPlans();
    return res.json({ success: true, data: plans });
  } catch (error) {
    logger.error('Get plans error:', error);
    return res.status(500).json({ success: false, error: '获取套餐列表失败' });
  }
});

/**
 * POST /api/v1/payment/create - 创建支付订单（需认证）
 */
router.post('/create', authMiddleware, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { amount, paymentMethod, description, planId } = req.body;

    if (!amount || !paymentMethod || !description) {
      return res.status(400).json({ success: false, error: '金额、支付方式和描述不能为空' });
    }

    if (!['wechat', 'alipay'].includes(paymentMethod)) {
      return res.status(400).json({ success: false, error: '支付方式仅支持 wechat 或 alipay' });
    }

    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ success: false, error: '金额必须为正数' });
    }

    const db = Database.getInstance();
    const orderNo = generateOrderNo();
    const payUrl = generateMockPayUrl(paymentMethod, orderNo, amount);

    const order = await db.createPaymentOrder({
      user_id: req.user!.id,
      order_no: orderNo,
      amount,
      payment_method: paymentMethod,
      description,
      plan_id: planId,
      pay_url: payUrl
    });

    return res.status(201).json({ success: true, data: order });
  } catch (error) {
    logger.error('Create payment order error:', error);
    return res.status(500).json({ success: false, error: '创建订单失败' });
  }
});

/**
 * GET /api/v1/payment/orders - 获取用户订单列表（需认证）
 */
router.get('/orders', authMiddleware, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const db = Database.getInstance();
    const orders = await db.getPaymentOrdersByUserId(req.user!.id);
    return res.json({ success: true, data: orders });
  } catch (error) {
    logger.error('Get orders error:', error);
    return res.status(500).json({ success: false, error: '获取订单列表失败' });
  }
});

/**
 * GET /api/v1/payment/orders/:orderId - 获取订单详情（需认证）
 */
router.get('/orders/:orderId', authMiddleware, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { orderId } = req.params;
    const db = Database.getInstance();
    const order = await db.getPaymentOrderById(orderId);

    if (!order) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }

    if (order.user_id !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ success: false, error: '无权限访问该订单' });
    }

    return res.json({ success: true, data: order });
  } catch (error) {
    logger.error('Get order detail error:', error);
    return res.status(500).json({ success: false, error: '获取订单详情失败' });
  }
});

/**
 * POST /api/v1/payment/notify/wechat - 微信支付回调（模拟）
 */
router.post('/notify/wechat', async (req, res: Response): Promise<any> => {
  try {
    const { order_no, transaction_id } = req.body;

    if (!order_no) {
      return res.status(400).json({ success: false, error: '缺少订单号' });
    }

    const db = Database.getInstance();
    const order = await db.getPaymentOrderByOrderNo(order_no);

    if (!order) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }

    if (order.status === 'pending') {
      await db.updatePaymentOrderStatus(order.id, 'paid', new Date().toISOString());
      logger.info(`WeChat payment callback: order ${order_no} paid`);
    }

    return res.json({ success: true, data: { message: 'OK' } });
  } catch (error) {
    logger.error('WeChat notify error:', error);
    return res.status(500).json({ success: false, error: '回调处理失败' });
  }
});

/**
 * POST /api/v1/payment/notify/alipay - 支付宝支付回调（模拟）
 */
router.post('/notify/alipay', async (req, res: Response): Promise<any> => {
  try {
    const { out_trade_no, trade_no } = req.body;

    if (!out_trade_no) {
      return res.status(400).json({ success: false, error: '缺少订单号' });
    }

    const db = Database.getInstance();
    const order = await db.getPaymentOrderByOrderNo(out_trade_no);

    if (!order) {
      return res.status(404).json({ success: false, error: '订单不存在' });
    }

    if (order.status === 'pending') {
      await db.updatePaymentOrderStatus(order.id, 'paid', new Date().toISOString());
      logger.info(`Alipay payment callback: order ${out_trade_no} paid`);
    }

    return res.send('success');
  } catch (error) {
    logger.error('Alipay notify error:', error);
    return res.send('fail');
  }
});

export { router as paymentRoutes };
