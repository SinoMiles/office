import 'server-only';
import mongoose from 'mongoose';
import BillingRecord from '@/models/BillingRecord';
import PaymentOrder from '@/models/PaymentOrder';
import User from '@/models/User';

export async function fulfillPaymentOrder({ outTradeNo, transactionId, amountFen, paidAt }) {
  let result;
  await mongoose.connection.transaction(async (session) => {
    const order = await PaymentOrder.findOne({ outTradeNo }).session(session);
    if (!order) throw new Error('支付订单不存在');
    if (order.status === 'paid') {
      result = { alreadyPaid: true, order };
      return;
    }
    if (!['created', 'paying'].includes(order.status)) throw new Error('支付订单状态不可入账');
    if (Number(amountFen) !== order.amountFen) throw new Error('微信支付通知金额不匹配');
    order.status = 'crediting';
    order.providerTransactionId = transactionId;
    order.paidAt = paidAt || new Date();
    await order.save({ session });
    const user = await User.findByIdAndUpdate(order.userId, { $inc: { balance: order.credits } }, { new: true, session });
    await BillingRecord.findOneAndUpdate(
      { idempotencyKey: `wechat-payment:${order.outTradeNo}` },
      { $setOnInsert: { userId: order.userId, type: 'charge', amount: order.credits, balanceDelta: order.credits, balanceBefore: user.balance - order.credits, balanceAfter: user.balance, description: `微信支付充值 · ¥${(order.amountFen / 100).toFixed(2)}`, idempotencyKey: `wechat-payment:${order.outTradeNo}`, metadata: { paymentOrderId: order._id, outTradeNo: order.outTradeNo, transactionId } } },
      { upsert: true, new: true, setDefaultsOnInsert: true, session },
    );
    order.status = 'paid';
    await order.save({ session });
    result = { paid: true, order, balance: user.balance };
  });
  return result;
}
