/** Chinese dictionary; its key set defines KanyeLocaleKey. */
export const zh = {
  tab: '桌宠',
  cardTitle: '桌宠',
  cardDescription: '桌面右下角悬浮的 Kanye 宠物：可拖拽、可配置角色/尺寸/透明度。',
  desktopPet: '显示桌宠',
  desktopPetHint: '在操作系统桌面显示透明置顶的桌宠窗口（可拖拽）。',
  character: '角色',
  characterHint: '选择宠物形象。',
  size: '尺寸',
  sizeHint: '桌宠大小（像素，100–300）。',
  opacity: '透明度',
  opacityHint: '常态透明度（0.2–1）。',
  overridden: '已覆盖',
  reset: '重置',
  invalidNumber: '必须是数字',
  save: '保存',
  discard: '放弃',
} satisfies Record<string, string>

/** Kanye card locale key union. */
export type KanyeLocaleKey = keyof typeof zh

/** English dictionary checked against the Chinese key set. */
export const en = {
  tab: 'Pet',
  cardTitle: 'Pet',
  cardDescription: 'Kanye desktop pet: draggable, configurable character/size/opacity.',
  desktopPet: 'Show pet',
  desktopPetHint: 'Show a transparent always-on-top pet window on the OS desktop (draggable).',
  character: 'Character',
  characterHint: 'Choose the pet look.',
  size: 'Size',
  sizeHint: 'Pet size in pixels (100–300).',
  opacity: 'Opacity',
  opacityHint: 'Steady-state opacity (0.2–1).',
  overridden: 'Overridden',
  reset: 'Reset',
  invalidNumber: 'Must be a number',
  save: 'Save',
  discard: 'Discard',
} satisfies Record<KanyeLocaleKey, string>
