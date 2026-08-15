/** Copy dictionaries for the Subagents management tab. */

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  tab: '子智能体',
  intro: '跨会话查看与管理的子智能体列表。',
  empty: '暂无子智能体。',
  emptyDetail: '会话中委派的子智能体会出现在这里。',
  loading: '正在读取目录…',
  failed: '目录读取失败。',
  retry: '重试',
  refresh: '刷新',
  running: '运行中',
  idle: '空闲',
  modeContinuable: '可继续',
  modeOneShot: '一次性',
  modeUnknown: '未知',
  parentColumn: '父会话',
  actionOpen: '打开',
  actionStop: '停止',
  stopping: '停止中…',
  stopFailed: '停止失败，请重试。',
  unhealthy: '不可用',
} satisfies Record<string, string>

/** Subagents tab locale key union. */
export type SubagentsLocaleKey = keyof typeof zh

/** English dictionary checked against the Chinese key set. */
export const en = {
  tab: 'Subagents',
  intro: 'Subagents across sessions, viewed and managed from one place.',
  empty: 'No subagents yet.',
  emptyDetail: 'Delegated subagents appear here as sessions run.',
  loading: 'Reading catalogs…',
  failed: 'The catalog could not be read.',
  retry: 'Retry',
  refresh: 'Refresh',
  running: 'Running',
  idle: 'Idle',
  modeContinuable: 'Continuable',
  modeOneShot: 'One-shot',
  modeUnknown: 'Unknown',
  parentColumn: 'Parent session',
  actionOpen: 'Open',
  actionStop: 'Stop',
  stopping: 'Stopping…',
  stopFailed: 'The stop failed. Try again.',
  unhealthy: 'Unavailable',
} satisfies Record<SubagentsLocaleKey, string>
