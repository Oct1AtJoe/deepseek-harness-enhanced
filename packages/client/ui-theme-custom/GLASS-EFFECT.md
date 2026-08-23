# 毛玻璃效果实现参考

## 核心原理

DSH Web GUI 的毛玻璃效果**不使用 `backdrop-filter: blur()`**（因为：
1. blur 会把背景光斑糊没，反而看不出玻璃感
2. blur 会影响 `position: fixed` 子元素的定位
3. 灰色调下 blur 后的渐变与纯色无视觉差异）

**正确配方**：`半透明 rgba 背景层` + `柔和亮色光斑(radial-gradient)` = 玻璃透光感

```
视觉效果 = 深色基底 + 亮灰光斑(alpha 0.20~0.40) + 半透明面板(alpha 0.50~0.65)
          → 光斑从面板下透出 → 毛玻璃质感
```

## 两个光斑层

### 1. 页面背景光斑（`--dsw-alias-bg-app-image`）

位于 `AppFrame.frame` 和 `ConversationRoot.root` 的背景，覆盖整个 UI。

**规则**：
- 最多 **2 个** radial-gradient 光斑（太多则杂乱）
- 每个光斑的位置**随机化**（不要与其他主题位置相同）
- 光斑中心 alpha **0.20~0.40**，边缘淡出至 transparent
- 光斑尺寸 **400~600px**（小而聚，不铺满）
- 保持中性色相（灰/银），不偏色

**模板**：
```css
'--dsw-alias-bg-app-image':
  'linear-gradient(180deg, rgba(R,G,B, 0.08), rgba(R,G,B, 0) 24%),'
  + 'radial-gradient(560px 420px at 右侧%, 顶部%, rgba(R,G,B, 0.20~0.40), transparent 55%),'
  + 'radial-gradient(540px 420px at 左侧%, 中部%, rgba(R,G,B, 0.30), transparent 52%)',
```

**位置随机化策略**：
- 右侧光斑：`at (75%~92%) (8%~25%)`——覆盖右侧面板区域
- 左侧光斑：`at (2%~10%) (30%~60%)`——覆盖侧栏区域
- 不要与 void 的 `88% 18%` 和 `3% 42%` 完全相同

### 2. better-sidebar 面板光斑（`::after` 伪元素）

better-sidebar 插件在 `position: fixed` overlay 中，位于 **frame 之外**（页面右侧超出 frame 宽度），因此无法透出页面背景光斑。需要**面板自带光晕层**。

**实现**（在 SURFACE_GLASS_CSS 中，所有主题通用）：
```css
[class$="_pane"]{
  background-color: var(--dsw-specific-sidebar-fill) !important;
  position: relative; z-index: 0;
}
[class$="_pane"]::after{
  content: ''; position: absolute; inset: 0; pointer-events: none; z-index: -1;
  background: radial-gradient(440px 320px at 82% 12%, rgba(228,222,238,0.18), transparent 56%);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), inset 0 0 0 1px rgba(255,255,255,0.03);
}
```

注：此 CSS 在 `index.ts` 的 `SURFACE_GLASS_CSS` 常量中，**所有主题共享**，不需要重复编写。

## 各主题需调整的参数

每个主题定义在 `src/client/<name>.ts`，export 一个 `*_TOKENS` 对象。

### 需要修改的 token

| Token | 作用 | 推荐值 |
|-------|------|--------|
| `--dsw-alias-bg-app-image` | 页面背景光斑 | 2~3 个 radial-gradient，alpha 0.20~0.40 |
| `--dsw-alias-bg-base` | 基底色 | `rgb(R,G,B)` 深色基底 |
| `--dsw-alias-bg-layer-1` | 抬高面板背景 | `rgba(R,G,B, 0.55~0.65)` 半透明 |
| `--dsw-alias-bg-layer-2` | 次层面板 | `rgba(R,G,B, 0.55~0.65)` 半透明 |
| `--dsw-alias-bg-layer-3` | 三层面板 | `rgba(R,G,B, 0.75~0.85)` 略实 |
| `--dsw-specific-sidebar-fill` | 侧栏背景 | `rgba(R,G,B, 0.50~0.58)` 半透明 |
| `--dsw-specific-bubble` | 消息气泡 | `rgba(R,G,B, 0.70~0.78)` 半透明(文字优先) |
| `--dsw-alias-glass-blur` | 输入栏/面板blur | `blur(20~24px) saturate(1.0~1.2)` |
| `--dsw-alias-surface-glass-blur` | 兼容 token | `blur(12px)`（未使用，保留） |

### 不需要改的 token

Text/border/scrollbar/state 等 token 按各主题的配色方案正常设即可。

## 验证方法

1. 切换到对应主题
2. 检查三个区域是否都有光晕透出：
   - **左侧侧栏**：`[class*="sidebarCol"]` 半透明 bg 透出页面光斑
   - **中间对话区**：`[data-slot="conversation"]` 背景直接显示光斑
   - **右侧 better-sidebar**：`[class$="_pane"]` 半透明 bg + ::after 光晕层
3. 文字全部可读（不因玻璃效果变模糊）
4. 切换到其他主题确认不受影响

## 添加新主题的步骤

1. 在 `src/client/` 下创建 `<name>.ts`
2. 定义 `*_TOKENS` 常量（参考现有主题）
3. 在 `src/client/index.ts` 中：
   - 导入 token
   - 添加 `ThemeDefinition`
   - 在 `ctx.effect()` 中 register
4. 在 `src/client/locales.ts` 加中英文标签
5. 在 `src/client/TechThemeRow.tsx` 加主题方块（`CUBES` 数组）
