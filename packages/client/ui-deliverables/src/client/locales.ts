/** `deliverables` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'deliverables'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'produced.label': '产物',
  'produced.moreOne': '+ 1 个文件',
  'produced.more': '+ {count} 个文件',
  'produced.open': '打开 {name}',
  'produced.showInFolder': '在文件夹中显示',
  'produced.expand': '展开 {name} 的修改内容',
  'produced.collapse': '收起 {name} 的修改内容',
  'produced.collapsePanel': '收起修改面板',
}

/** English dictionary (same key set). */
export const en: Record<DeliverablesKey, string> = {
  'produced.label': 'Produced',
  'produced.moreOne': '+ 1 file',
  'produced.more': '+ {count} files',
  'produced.open': 'Open {name}',
  'produced.showInFolder': 'Show in folder',
  'produced.expand': 'Show changes to {name}',
  'produced.collapse': 'Hide changes to {name}',
  'produced.collapsePanel': 'Collapse changes',
}

/** Union of this namespace's dictionary keys. */
export type DeliverablesKey = keyof typeof zh
