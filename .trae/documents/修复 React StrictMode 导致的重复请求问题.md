## 优化目标
放宽表单验证，允许用户手动填写所有字段，AI仅作为辅助工具。

## 具体改动

### 1. App.tsx (第70-79行)
简化 `isFormValid` 验证逻辑：
- 只检查必填字段：title 和 content
- summary、tags、coverImage 改为可选

修改前：
```typescript
const isFormValid = useMemo(() => {
  if (!draft) return false;
  return (
    draft.title.trim().length > 0 &&
    draft.content.trim().length > 0 &&
    (draft.summary?.trim().length ?? 0) > 0 &&
    (draft.tags?.length ?? 0) > 0 &&
    (draft.coverImage?.trim().length ?? 0) > 0
  );
}, [draft]);
```

修改后：
```typescript
const isFormValid = useMemo(() => {
  if (!draft) return false;
  return (
    draft.title.trim().length > 0 &&
    draft.content.trim().length > 0
  );
}, [draft]);
```

这样用户只需要填写标题和内容即可保存草稿，其他字段都可以手动填写或留空。