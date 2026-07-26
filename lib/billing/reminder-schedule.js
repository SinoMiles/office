// 到期提醒的分档规则。抽成纯函数是为了能脱离数据库单测 ——
// 这里曾经踩过一个坑：按降序 [7,3,1] 查找时，剩 2 天也会匹配到 7 天档，
// 用户被标记「已发 7 天提醒」后，T-3 与 T-1 就再也不会触发，三段提醒退化成一次。
export const REMINDER_MILESTONES = [1, 3, 7];

/**
 * 返回 daysLeft 应该命中的里程碑，取「最紧的那一档」。
 * 超出最大里程碑（还很久才到期）或已过期时返回 null。
 */
export function reminderMilestoneFor(daysLeft) {
  if (!Number.isFinite(daysLeft) || daysLeft <= 0) return null;
  return REMINDER_MILESTONES.find((value) => daysLeft <= value) ?? null;
}
