import 'server-only';
import BillingRecord from '@/models/BillingRecord';
import User from '@/models/User';

// 生产库是单机 mongod，不支持多文档事务。这里的原语全部基于“单文档原子更新 + 幂等键”，
// 与 lib/billing/service.js 里 settleTaskCredits 使用的机制一致：
// User.appliedBillingOperations 记录已应用过的操作键，天然保证 exactly-once。

export function roundCredits(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.round((number + Number.EPSILON) * 1_000_000) / 1_000_000;
}

/**
 * 以幂等键调整用户余额。重复调用同一个 key 只会生效一次。
 * allowNegative=true 时不校验余额下限（退款扣回场景：用户可能已经把充值花掉了）。
 * 返回 { user, applied }，applied=false 表示这次是重放。
 */
export async function applyBalanceOnce({ userId, key, delta, allowNegative = false }) {
  const amount = roundCredits(delta);
  if (!key) throw new Error('余额调整必须提供幂等键');
  const guard = !allowNegative && amount < 0 ? { balance: { $gte: -amount } } : {};
  const user = await User.findOneAndUpdate(
    { _id: userId, appliedBillingOperations: { $ne: key }, ...guard },
    { $inc: { balance: amount }, $addToSet: { appliedBillingOperations: key } },
    { new: true },
  );
  if (user) return { user, applied: true };
  // 没更新成功有两种可能：已经应用过（重放），或者余额不足。
  const replayed = await User.findOne({ _id: userId, appliedBillingOperations: key }).select('+appliedBillingOperations balance');
  if (replayed) return { user: replayed, applied: false };
  const existing = await User.findById(userId).select('balance');
  if (!existing) throw new Error('用户不存在');
  throw new Error('余额不足，无法完成本次扣减');
}

/**
 * 写一条账本流水。idempotencyKey 上有唯一稀疏索引，重复写入会命中同一条记录。
 */
export async function postLedger({ userId, type, amount, balanceDelta, description, balanceAfter, key, metadata, relatedTaskId }) {
  const normalizedAmount = Math.abs(roundCredits(amount));
  const delta = roundCredits(balanceDelta ?? normalizedAmount);
  return BillingRecord.findOneAndUpdate(
    { idempotencyKey: key },
    { $setOnInsert: {
      userId,
      relatedTaskId,
      type,
      amount: normalizedAmount,
      balanceDelta: delta,
      description,
      idempotencyKey: key,
      balanceBefore: roundCredits(Number(balanceAfter) - delta),
      balanceAfter: roundCredits(balanceAfter),
      metadata,
    } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );
}

/**
 * 调整余额并记账，两步共用同一个幂等键。
 */
export async function creditUser({ userId, key, delta, type, description, metadata, allowNegative = false }) {
  const { user, applied } = await applyBalanceOnce({ userId, key, delta, allowNegative });
  await postLedger({ userId, type, amount: delta, balanceDelta: roundCredits(delta), description, balanceAfter: user.balance, key, metadata });
  return { balance: user.balance, applied };
}
