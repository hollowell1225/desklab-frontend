# DeskLab Memory Bank

> 最后更新: 2026-06-25T01:52 (UTC+8)
> 对话 ID: `5f8b7330-8c07-499c-b481-5b3bd2473aae`

---

## 1. 项目概况

| 项 | 值 |
|---|---|
| 项目名称 | DeskLab |
| 前端路径 | `C:\Users\lyj\.gemini\antigravity\scratch\DeskLab` |
| 后端路径 | `D:\Claude` |
| 技术栈 | React 19 + Three.js (react-three-fiber/drei) + Vite 8 |
| 测试框架 | Node.js 内置 `node:test` |
| 当前分支 | `master` |
| 最新 Commit | `4d53bcc` |
| 单元测试 | **151 全绿** |
| ESLint | **0 问题** |
| 生产构建 | **成功** |
| 后端契约 | **全部通过** (`npm run check:contracts` @ `D:\Claude`) |

---

## 2. 功能特性清单

### ✅ 已完成

| # | 功能 | 关键文件 | Commit |
|---|------|---------|--------|
| 1 | 以太网端口拓扑面板 | `connections.js`, `ConnectionsEditor.jsx` | `c674ecf` |
| 2 | 一键自动网络连线 | `recommendations.js`, `App.jsx` | `2d8024a` |
| 3 | 连线目标设备下拉选择 | `ConnectionsEditor.jsx` | `5d44f64` |
| 4 | 设备功耗/安全承载模板配置 | `catalog.js` | `db3b846` |
| 5 | 电力拓扑递归累加算法 | `analysis.js` (`analyzeProjectWiring` + `computeDevicePowerLoad`) | `db3b846` |
| 6 | 过载 `power_overload` 错误 + `power_warning` 警告 | `analysis.js` | `db3b846` |
| 7 | 属性面板"电力与负载"小节 + 实时彩色进度条 | `PropertiesEditor.jsx`, `App.jsx` | `c188d8d` |
| 8 | 电源过载智能购买/分流建议 `buy_ups_overload` | `recommendations.js` | `5233f6f` |
| 9 | 布线检查 & 改进建议面板 UI 接入过载操作按钮 | `App.jsx` | `b03fd92` |
| 10 | 3D 场景电力状态浮标 `PowerStatusOverlay` | `SceneObjects.jsx`, `App.jsx` | `4d53bcc` |

### 🔒 安全红线

- **绝不触碰**：`.agents/`、`skills-lock.json`、`.vscode/`
- 所有 `git add` 仅包含本次相关的源码 and 测试文件

---

## 3. 核心算法

### 电力负载递归累加

```
ExternalLoad(X) = Σ [ ExternalLoad(child) + child.wattage ]   ∀ child ∈ powerGraph[X]
```

- 使用 `POWER_OUTPUT_TYPES` / `POWER_INPUT_TYPES` 有向边构建电力拓扑图
- `findPowerCycle()` 检测环路，环路时跳过功耗计算返回 0
- `loadCache` (Map) 做记忆化避免重复递归
- 取值优先级：`object.wattage ?? template?.wattage ?? 0`（空值合并操作符 `??`）

### 过载判定阈值

| 条件 | 代码 | 级别 |
|------|------|------|
| `currentLoad > maxLoad` | `power_overload` | error |
| `currentLoad > maxLoad * 0.9` | `power_warning` | warning |

---

## 4. 关键文件索引

### 前端 Domain 层 (`src/domain/`)

| 文件 | 职责 |
|------|------|
| `analysis.js` | 布线分析引擎：端口方向/类型/占用/电源环路/功耗负载/过载检测 |
| `catalog.js` | 设备模板目录 (DEVICE_CATALOG) + `findModelTemplate` |
| `connections.js` | 连接工具函数：兼容性判断、长度评估、以太网拓扑构建 |
| `recommendations.js` | 免费修复建议 + 购买建议引擎 |
| `geometry.js` | 几何约束与碰撞检测 |
| `layout-analysis.js` | 布局分析（出界/悬空/墙插） |
| `placement.js` | 设备放置与约束 |
| `identifiers.js` | 碰撞安全 ID 生成 |
| `camera-snapshot.js` | 相机位姿同步 |
| `coordinates.js` | 坐标系转换 |

### 前端组件层 (`src/components/`)

| 文件 | 职责 |
|------|------|
| `PropertiesEditor.jsx` | 属性编辑面板：名称、位置、旋转、尺寸 + **电力与负载** |
| `ConnectionsEditor.jsx` | 连线编辑面板：端口级连接创建/编辑 + 以太网拓扑 |
| `SceneObjects.jsx` | 3D 渲染组件：房间墙壁、设备网格、连接线、端口标记 + **PowerStatusOverlay** |

### 测试 (`test/`)

| 文件 | 用例数 |
|------|--------|
| `analysis.test.js` | 含 `power_overload`/`power_warning`/`computeDevicePowerLoad` 共 ~20 条 |
| `recommendations.test.js` | 含 `buy_ups_overload` 共 ~15 条 |
| 其余 16 个测试文件 | ~116 条 |

---

## 5. 提交记录 (本轮)

```
4d53bcc feat: add 3D power status overlay labels and overload quick-action buttons
b03fd92 feat: wire up overload purchase suggestion UI with quick actions
5233f6f feat: suggest purchasing UPS or splitting load when power hub is overloaded
c188d8d feat: display real-time power load in properties panel with interactive inputs
db3b846 feat: implement power consumption calculation and overload/warning analysis
```

---

## 6. 验证命令

```bash
# 前端
cd C:\Users\lyj\.gemini\antigravity\scratch\DeskLab
npm test                   # 151 pass, 0 fail
npm run lint               # 0 问题
npm run build              # ✓ built

# 后端契约
cd D:\Claude
npm run check:contracts    # All contract checks passed
```

---

## 7. 运行环境

| 项 | 值 |
|---|---|
| 前端 dev server | `npm run dev` (Vite, 默认 port 5173) |
| 后端 server | `npm start` @ `D:\Claude` (默认 port 3000) |
| Node.js | v22+ (支持 `node:test`, `??`, `?.`) |

---

## 8. 后续可选方向

- [ ] 3D 场景中为过载设备添加脉冲发光动画（emissive pulse）
- [ ] 电力拓扑树视图组件（可折叠的树状结构展示供电链路）
- [ ] 导出功耗报告为 PDF/Markdown
- [ ] 按设备类型批量编辑功耗参数
- [ ] 后端持久化 `wattage` / `maxLoad` 字段（需同步更新 `project.schema.json`）
