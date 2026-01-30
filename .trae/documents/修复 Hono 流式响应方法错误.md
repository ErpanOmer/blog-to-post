## 修复步骤

1. **修改 src/worker/index.ts 第 96 行**
   - 将 `c.streamText()` 改为 `c.stream()`
   - 这是 Hono 框架正确的流式响应方法

## 问题原因
代码使用了不存在的 `c.streamText()` 方法，导致运行时错误。Hono 框架只提供 `c.stream()` 方法用于流式响应。

## 预期结果
修复后，前端调用 `/api/articles/generate-content` 接口时将能够正常接收流式响应，不再出现 500 错误。