# 数据库操作快速指南 🚀

本手册汇总了本项目中常用的数据库维护与查询命令。所有命令均通过 `npm run` 执行。

## 1. 核心维护命令

| 命令 | 说明 | 示例 |
| :--- | :--- | :--- |
| `npm run db:sync` | **一键同步**：将所有迁移应用到本地和线上环境 | `npm run db:sync` |
| `npm run db:status` | **查看状态**：检查迁移同步进度 | `npm run db:status -- --local` |
| `npm run db:migrate` | **应用迁移**：手动执行特定的环境迁移 | `npm run db:migrate -- --remote` |
| `npm run db:init` | **重置初始化**：根据 schema.sql 重新建表 | `npm run db:init -- --local` |

> [!IMPORTANT]
> 在执行 `db:status`、`db:migrate` 或 `db:init` 时，必须使用 `-- --local` 或 `-- --remote` 来指定环境。

---

## 2. 万能查询与交互 (便捷入口)

我们提供了 `db:local` (本地) 和 `db:remote` (线上) 两个快捷入口，通过 `--command` 参数执行任意 SQL。

### 查询表示例
```bash
# 查看本地所有表
npm run db:local -- --command="SELECT name FROM sqlite_master WHERE type='table'"

# 查询线上文章总数
npm run db:remote -- --command="SELECT count(*) FROM articles"
```

### 进入交互式终端
直接运行命令不加参数，即可进入 D1 处理器的交互式命令行环境：
```bash
npm run db:local
```

---

## 3. 注意事项
1. **参数传递**：在 `npm run` 命令后传递参数时，中间的 `--` 是必须的（例如：`npm run <cmd> -- <args>`）。
2. **迁移顺序**：本项目采用 0001, 0002... 的编号管理迁移，建议不要手动修改现有迁移文件内容。
3. **数据安全**：执行线上（remote）操作前，请务必确认 SQL 语句无误。
