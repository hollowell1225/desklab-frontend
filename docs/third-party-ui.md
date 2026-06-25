# Third-Party UI Ecosystem & Tooling

本文件规定了在 DeskLab 项目中引入与设计、UI 相关的外部第三方开源工具或库的规范和限制原则。

## 1. awesome-design-md
- **链接**: [https://github.com/VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md)
- **用途**: **仅作为设计参考和灵感来源**。
- **限制**: DeskLab 团队可参考其列举的优秀 Markdown 排版和设计方法论，但不直接导入其代码资产。项目的设计理念需结合 DeskLab "专业 3D 布线工具"的自身定位进行内化。

## 2. Impeccable
- **链接**: [https://github.com/pbakaus/impeccable](https://github.com/pbakaus/impeccable)
- **用途**: **用于设计审计与规范验证**。
- **限制**: 可以使用该工具的思想或命令行工具进行只读的 UI 层级审计分析。严禁在生产或开发环境执行会自动修改业务代码（如强行替换 CSS 类名或注入破坏性 Layout 组件）的修正命令。仅提交分析报告指导人工优化。

## 3. React Bits
- **链接**: [https://github.com/DavidHDev/react-bits](https://github.com/DavidHDev/react-bits)
- **用途**: **仅允许以后按需引入单个组件**（例如需要一个极其特定的输入框微交互时）。
- **限制**:
  - **严禁**将任何 React Bits 组件用于 3D 画布 (Canvas) 背景，必须保证中心区域性能和纯粹的 3D 渲染。
  - **严禁**将其用于 DeskLab 核心操作流的动画表现，避免华而不实的动效喧宾夺主。
  - 目前阶段 **尚未安装**，除非经过架构评估，否则不得大批量整体引入其组件库。

## 许可协议与合规
使用上述工具及未来的第三方库时，必须单独审查其许可证和 NOTICE/署名要求：
- **awesome-design-md**：MIT 协议。
- **Impeccable**：Apache-2.0 协议。
- **React Bits**：MIT + Commons Clause 协议。允许应用内商业使用，但明确禁止销售、再分发组件本身。

任何新引入的组件每次均需单独审查许可证，带有病毒式传染性的许可证组件不可进入主应用代码库。
