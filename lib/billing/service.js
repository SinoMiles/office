import 'server-only';
import BillingRecord from '@/models/BillingRecord';
import Task from '@/models/Task';
import User from '@/models/User';
import { calculateReservation, calculateUsageCost, createPricingSnapshot, normalizeUsage, reconcileReservation } from '@/lib/billing/pricing';

function operationKey(taskId, operation) {
  return `task:${taskId}:${operation}`;
}

async function postLedger({ userId, taskId, type, amount, balanceDelta, description, balanceAfter, key, metadata }) {
  const normalizedAmount = Math.max(0, Number(amount) || 0);
  if (!normalizedAmount && type !== 'consume') return null;
  const delta = balanceDelta ?? (type === 'reserve' || type === 'consume' ? -normalizedAmount : normalizedAmount);
  return BillingRecord.findOneAndUpdate(
    { idempotencyKey: key },
    { $setOnInsert: {
      userId,
      relatedTaskId: taskId,
      type,
      amount: normalizedAmount,
      balanceDelta: delta,
      description,
      idempotencyKey: key,
      balanceBefore: Number(balanceAfter) - delta,
      balanceAfter,
      metadata,
    } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

export async function reserveTaskCredits({ taskId, userId, model, membershipLevel, billingSettings }) {
  const snapshot = createPricingSnapshot(billingSettings, model, membershipLevel);
  const reservationCredits = calculateReservation(snapshot);
  const reservationKey = operationKey(taskId, 'reserve');
  const claimed = await Task.findOneAndUpdate(
    { _id: taskId, userId, 'billing.state': 'unreserved' },
    { $set: { 'billing.state': 'reserving', 'billing.reservationCredits': reservationCredits, 'billing.pricingSnapshot': snapshot, 'billing.reservationKey': reservationKey } },
    { new: true },
  );
  if (!claimed) {
    const existing = await Task.findOne({ _id: taskId, userId });
    if (existing?.billing?.state === 'reserved') return existing.billing;
    throw new Error('任务额度预授权状态异常');
  }

  const user = await User.findOneAndUpdate(
    { _id: userId, balance: { $gte: reservationCredits } },
    { $inc: { balance: -reservationCredits } },
    { new: true },
  );
  if (!user) {
    await Task.updateOne({ _id: taskId, 'billing.state': 'reserving' }, { $set: { 'billing.state': 'failed' } });
    throw new Error(`余额不足，本次任务至少需要预留 ${reservationCredits.toFixed(2)} Credits`);
  }

  try {
    await Task.updateOne({ _id: taskId, 'billing.state': 'reserving' }, { $set: { 'billing.state': 'reserved' } });
    await postLedger({ userId, taskId, type: 'reserve', amount: reservationCredits, description: 'AI 任务额度预授权', balanceAfter: user.balance, key: reservationKey, metadata: { model, pricingSnapshot: snapshot } });
    return { state: 'reserved', reservationCredits, pricingSnapshot: snapshot };
  } catch (error) {
    const rolledBack = await Task.findOneAndUpdate(
      { _id: taskId, 'billing.state': { $in: ['reserving', 'reserved'] } },
      { $set: { 'billing.state': 'failed' } },
    );
    if (rolledBack) await User.updateOne({ _id: userId }, { $inc: { balance: reservationCredits } });
    throw error;
  }
}

export async function settleTaskCredits({ taskId, userId, usage: rawUsage, source = 'aioncore' }) {
  const usage = normalizeUsage(rawUsage);
  const settlementKey = operationKey(taskId, 'settle');
  const task = await Task.findOneAndUpdate(
    { _id: taskId, userId, 'billing.state': 'reserved' },
    { $set: { 'billing.state': 'settling', 'billing.settlementKey': settlementKey } },
    { new: true },
  );
  if (!task) {
    const existing = await Task.findOne({ _id: taskId, userId });
    if (existing?.billing?.state === 'settled') return { alreadySettled: true, billing: existing.billing };
    if (existing?.billing?.state === 'released') return { alreadyReleased: true, billing: existing.billing };
    if (existing?.billing?.state === 'settling') return { settlementInProgress: true, billing: existing.billing };
    throw new Error('任务没有可结算的预授权额度');
  }

  const calculated = calculateUsageCost(usage, task.billing.pricingSnapshot);
  const reservationCredits = Number(task.billing.reservationCredits || 0);
  const reconciliation = reconcileReservation(reservationCredits, calculated.chargedCredits);
  const balanceDelta = reconciliation.balanceDelta;
  const user = await User.findByIdAndUpdate(userId, { $inc: { balance: balanceDelta } }, { new: true });
  if (!user) {
    await Task.updateOne({ _id: taskId, 'billing.state': 'settling' }, { $set: { 'billing.state': 'reserved' } });
    throw new Error('结算用户不存在');
  }

  const metadata = { source, model: task.billing.pricingSnapshot?.model, usage: calculated, pricingSnapshot: task.billing.pricingSnapshot };
  try {
    await postLedger({ userId, taskId, type: 'consume', amount: calculated.chargedCredits, balanceDelta: Math.min(0, balanceDelta), description: `AI 任务实际消费 · ${calculated.totalTokens.toLocaleString()} Tokens`, balanceAfter: user.balance, key: settlementKey, metadata });
    if (balanceDelta > 0) {
      await postLedger({ userId, taskId, type: 'refund', amount: balanceDelta, balanceDelta, description: '预授权剩余额度退回', balanceAfter: user.balance, key: operationKey(taskId, 'reservation-refund'), metadata: { source, reservationCredits } });
    }
    await Task.updateOne({ _id: taskId, 'billing.state': 'settling' }, { $set: {
      'billing.state': 'settled',
      'billing.chargedCredits': calculated.chargedCredits,
      'billing.refundedCredits': reconciliation.refundedCredits,
      'billing.usage': calculated,
      'billing.settledAt': new Date(),
      tokensUsed: calculated.totalTokens,
      cost: calculated.chargedCredits,
    } });
    return { chargedCredits: calculated.chargedCredits, refundedCredits: reconciliation.refundedCredits, additionalChargeCredits: reconciliation.additionalChargeCredits, usage: calculated, balance: user.balance };
  } catch (error) {
    await User.updateOne({ _id: userId }, { $inc: { balance: -balanceDelta } });
    await Task.updateOne({ _id: taskId, 'billing.state': 'settling' }, { $set: { 'billing.state': 'reserved' } });
    throw error;
  }
}

export async function releaseTaskReservation({ taskId, userId, reason = '任务未产生可计费用量' }) {
  const task = await Task.findOneAndUpdate(
    { _id: taskId, userId, 'billing.state': 'reserved' },
    { $set: { 'billing.state': 'releasing' } },
    { new: true },
  );
  if (!task) return { released: false };
  const amount = Number(task.billing.reservationCredits || 0);
  const user = await User.findByIdAndUpdate(userId, { $inc: { balance: amount } }, { new: true });
  try {
    await postLedger({ userId, taskId, type: 'refund', amount, description: reason, balanceAfter: user.balance, key: operationKey(taskId, 'release'), metadata: { reservationCredits: amount } });
    await Task.updateOne({ _id: taskId, 'billing.state': 'releasing' }, { $set: { 'billing.state': 'released', 'billing.refundedCredits': amount, 'billing.settledAt': new Date() } });
    return { released: true, refundedCredits: amount, balance: user.balance };
  } catch (error) {
    await User.updateOne({ _id: userId }, { $inc: { balance: -amount } });
    await Task.updateOne({ _id: taskId, 'billing.state': 'releasing' }, { $set: { 'billing.state': 'reserved' } });
    throw error;
  }
}
