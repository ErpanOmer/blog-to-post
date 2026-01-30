# 文章编辑Dialog重构详细计划

## 需求分析

### 1. 左侧标题区域改造
- 左上角显示"文章标题"文案
- 右上角"AI生成标题"按钮
- 下方是两行高度的输入框（支持长标题）
- 点击"AI生成标题"后，在输入框下方显示标题选项列表（Radio选择）
- 选择后自动填充到输入框

### 2. 右侧内容编辑区域改造
- 移除原有的"文章标题"板块
- MD编辑器拉满整个右侧高度
- 右上角新增"AI生成正文"按钮

### 3. 左侧移除"文章内容"板块
- 将"AI生成正文"功能移到右侧内容编辑区域
- 移除"先生成标题以创建文章"的提示

### 4. 元信息区域放开限制
- 摘要、标签、封面图全部可编辑
- 保留AI生成功能
- 移除禁用状态

### 5. 保存按钮智能验证
- 检测表单完整性（标题、正文、摘要、标签、封面）
- 全部合法填写后才能点击保存
- 未填写完整时显示禁用状态

### 6. Loading状态全局控制
- 任何AI生成按钮loading时：
  - 弹窗无法关闭（点击遮罩或关闭按钮无效）
  - 所有按钮无法点击
  - 所有输入框无法编辑
  - 显示全局遮罩层

### 7. 后端API调整
- 新增批量生成标题API（返回多个标题选项）
- 或修改现有API支持返回多个标题

---

## 实施步骤

### 阶段1: 后端API调整
1. 修改 `/api/articles/generate-title` 接口，支持返回多个标题选项
2. 更新类型定义

### 阶段2: 前端组件重构
1. **App.tsx** - 重构Dialog布局，调整左右分栏结构
2. **新建 TitleGenerator.tsx** - 提取标题生成为独立组件
3. **重构 ArticleEditor.tsx** - 移除标题输入，添加AI生成正文按钮，MD编辑器拉满高度
4. **重构 GenerationPanel.tsx** - 移除文章内容板块，调整元信息区域（放开禁用）
5. **新建 GlobalLoadingOverlay.tsx** - 全局Loading遮罩组件

### 阶段3: 状态管理优化
1. 新增全局loading状态管理
2. 表单验证逻辑
3. 保存按钮状态计算

### 阶段4: 样式调整
1. 调整Dialog左右分栏比例
2. MD编辑器高度自适应
3. 标题选项Radio样式

---

## 详细修改清单

### 后端修改
- [ ] `src/worker/index.ts` - 修改generate-title接口，返回多个标题
- [ ] `src/worker/types.ts` - 更新类型定义（如需要）

### 前端组件修改/新建
- [ ] `src/react-app/App.tsx` - 重构Dialog，添加全局loading控制
- [ ] `src/react-app/components/TitleGenerator.tsx` - 新建标题生成组件
- [ ] `src/react-app/components/ArticleEditor.tsx` - 重构，移除标题输入，添加生成正文按钮
- [ ] `src/react-app/components/GenerationPanel.tsx` - 重构，移除内容板块，放开元信息编辑
- [ ] `src/react-app/components/GlobalLoadingOverlay.tsx` - 新建全局遮罩组件
- [ ] `src/react-app/api.ts` - 更新API调用（如需要）

### 样式调整
- [ ] 调整Dialog布局为左右分栏
- [ ] MD编辑器高度calc(100vh - header - padding)
- [ ] 标题选项Radio样式美化

---

## 技术要点

1. **全局Loading状态** - 使用React Context或提升状态到App组件
2. **表单验证** - 实时检测所有字段是否已填写
3. **Dialog关闭控制** - 根据loading状态控制onOpenChange
4. **标题选项** - Radio Group组件，选择后自动填充
5. **MD编辑器高度** - 使用flex布局让编辑器自适应剩余空间

请确认这个计划后，我将开始实施具体的代码修改。