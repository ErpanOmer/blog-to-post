---
name: frontend-style
description: 前端开发与 UI 设计指南：Tailwind CSS, Shadcn UI, Hooks 模式及响应式设计。
skill_version: 1.0.0
updated_at: 2026-02-02T00:00:00Z
tags: [react, tailwindcss, shadcn-ui, ux, components]
---

# 前端开发与 UI 设计指南

本指南指导 AI 如何构建美观、统一且高性能的 React 前端界面。

## 1. UI 设计哲学

- **极简与现代**: 采用类似 Vercel/Linear 的设计风格。大留白、微妙的边框、精致的阴影。
- **色彩系统**: 依赖 CSS Variables (在 `globals.css` 中定义)。使用 `bg-background`, `text-foreground`, `border-border` 等语义化类名，而非硬编码颜色值。
- **响应式优先**: 所有组件必须适配 Mobile 和 Desktop。使用 `md:`前缀区分。

## 2. 组件开发规范 (Shadcn UI)

本项目使用 Shadcn UI (基于 Radix UI)。

- **组件位置**: `src/components/ui/` (基础组件), `src/react-app/components/` (业务组件)。
- **新建组件**: 如果需要新的基础组件 (如 Accordion)，请提示用户运行 `npx shadcn-ui@latest add accordion`，不要手动从头写。
- **图标 usage**: 统一使用 `lucide-react`。
  ```tsx
  import { Flame } from "lucide-react";
  <Flame className="w-4 h-4 text-orange-500" />
  ```

## 3. 状态管理与 API 交互

- **Hooks 封装**: 复杂的业务逻辑（如文章管理）应抽取为 Custom Hook (如 `useArticles.ts`)。
- **API 调用**:
  - 所有后端请求必须封装在 `src/react-app/api.ts` 中。
  - **严禁**在组件内直接写 `fetch("/api/...")`。
  - `api.ts` 中应处理 JSON 解析和基础错误抛出。
- **Loading 状态**: 操作过程中必须展示 Loading 状态（Spinner 或 Skeleton）。

## 4. 常用代码片段

### 响应式容器
```tsx
<div className="container mx-auto px-4 py-6 md:py-10 max-w-5xl">
  {/* Content */}
</div>
```

### 卡片布局
```tsx
<div className="rounded-xl border bg-card text-card-foreground shadow-sm">
  <div className="p-6">
    <h3 className="font-semibold leading-none tracking-tight">标题</h3>
    <p className="text-sm text-muted-foreground mt-2">副标题描述</p>
  </div>
</div>
```

### 交互按钮
```tsx
<Button 
  variant="default" // 或 outline, ghost, destructive
  size="sm" 
  onClick={handler}
  disabled={isLoading}
>
  {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
  保存更改
</Button>
```

## 5. 调试与错误处理

- 使用 `src/components/NotificationSystem` (`notify.success`, `notify.error`) 向用户展示操作结果。
- 捕获 `api.ts` 抛出的错误并优雅降级。

---
**由 Antigravity 设计，确保前端代码的一致性与美观度。**
