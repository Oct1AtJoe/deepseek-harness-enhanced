# Agent Note: Web 模型选择器中的每模型推理强度记忆

Status: implemented

[English](2026-08-14-web-model-selection-effort-memory.md) | 中文

## 问题

`session.selectModel` 把不带 `reasoningEffort` 的请求视为采用适配器默认强度。Web 选择器的模型行提交时不带强度，因此把 deepseek-v4-flash 设为 `max` 后切到其他模型再切回，会重新物化 flash 的默认 `high`：只要会话选择离开该路由，用户显式选择的强度就丢失了。会话选择只有一个槽位，存储的 Agent 默认值也只是一个选择，两者都无法承载每模型偏好，新建会话更是完全没有该选择的记忆。

## 决策

Host 在 `agent-default-model` 设置段中持久化每路由推理强度记忆（`efforts: { "provider/model": effort }`），并在所有不带强度的选择处应用它：`session.selectModel` 在裸选择时先解析记忆强度再回退适配器默认，`AgentDefaultModelConfig.currentSelection()` 把它组合进新会话的默认选择。显式 `reasoningEffort` 记录该路由记忆；空字符串显式清除它（选择器中的“提供方默认值”行发送 `''`），因此“适配器默认”始终可达。模型不再支持的记忆强度会回退到适配器默认并自我遗忘，而不是阻断切换。

选择器只提交裸的 provider/model 选择，由 Host 解析强度，因此两个入口（`/model` popup 与 composer seat）都免费获得记忆，且不会把偶发的默认物化误记为偏好。wire 契约增加一个含义而非一个字段：`session.selectModel` 请求 schema 接受 `''` 作为清除信号；`RpcMethodMap` 类型不变。

## 备选方案

**客户端选择器记忆。** 第一版把每路由强度放在 `ModelDirectory` 上（第二版改为 localStorage 持久化）。它修好了单页内的切换往返，但无法修正新会话的初始显示——那来自 Host 默认——而且页面刷新或换浏览器都会遗忘选择。推理强度偏好是模型可见状态，应由 Host 持有。

**wire 上加独立清除标志。** `clearReasoningEffort: true` 比 `''` 哨兵更显式，但要新增字段与方法签名变化；`''` 复用了现有可选字符串并赋予一个文档化含义。

## 后果

已选择的强度随模型进入每个会话并跨重启存活，存于 host 设置。显式选择记录偏好；裸选择与新会话应用它；提供方默认值行清除它。过期记忆回退让部署收窄模型支持强度后模型切换仍可用。记忆按 host（设置文档）隔离，而非按浏览器或用户账户。
