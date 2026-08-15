/** Copy dictionaries for the Skills management tab. */

/** Simplified Chinese dictionary and key source of truth. */
export const zh = {
  tab: '技能',
  loading: '正在读取技能…',
  error: '暂时无法读取技能。',
  retry: '重试',
  search: '搜索技能',
  catalog: '技能列表',
  empty: '暂无技能。',
  emptySearch: '没有匹配的技能。',
  noSession: '请先打开一个会话；技能列表按当前会话展示。',
  modelInvocable: '模型可调用',
  userInvocable: '用户可调用',
  invoking: '正在生效…',
  failed: '设置失败，请重试。',
  detailSource: '来源',
  detailProvider: '提供方',
  detailPath: '路径',
  detailContent: '正文',
  contentLoading: '正在读取正文…',
  contentFailed: '正文读取失败。',
} satisfies Record<string, string>

/** Skills tab locale key union. */
export type SkillsLocaleKey = keyof typeof zh

/** English dictionary checked against the Chinese key set. */
export const en = {
  tab: 'Skills',
  loading: 'Reading skills…',
  error: 'Skills are temporarily unavailable.',
  retry: 'Retry',
  search: 'Search skills',
  catalog: 'Skill list',
  empty: 'No skills are available.',
  emptySearch: 'No matching skills.',
  noSession: 'Open a session first; the list shows the active session\'s skills.',
  modelInvocable: 'Model-invocable',
  userInvocable: 'User-invocable',
  invoking: 'Applying…',
  failed: 'The change failed. Try again.',
  detailSource: 'Source',
  detailProvider: 'Provider',
  detailPath: 'Path',
  detailContent: 'Body',
  contentLoading: 'Reading body…',
  contentFailed: 'The body could not be read.',
} satisfies Record<SkillsLocaleKey, string>
