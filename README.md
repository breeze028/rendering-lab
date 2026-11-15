# Rendering Lab

用数学、交互图表与真实 WebGPU 路径，解释光如何形成图像。首版完整链路为 **Monte Carlo → NEE → MIS → Cornell Box → 指定样本路径检查**。

在线使用：[Rendering Lab](https://breeze028.github.io/rendering-lab/)。源码：[GitHub 仓库](https://github.com/breeze028/rendering-lab)。部署状态与真实证据见 [validation](docs/validation.md)。

## 先看哪里

- 首页就是 MIS 综合课程。浏览器不支持 WebGPU 仍可阅读公式、代码、操作二维实验。
- Cornell 实验需要点击 Start WebGPU，首次下载并启动单线程 WASM Worker。支持 BSDF-only、NEE-only、MIS、深度、目标 SPP、曝光及8种最终/AOV显示。
- 点击图像选择像素，展开 Path inspector，指定 sample index，Capture GPU path。Debug orbit 只旋转路径图。
- Open full Lab 在同一会话内改变布局，保留累积；Escape 返回。跨课程导航只保留采样策略。
- 设计依据：[design-references](docs/design-references.md)。复用边界、AOV与捕获协议：[architecture](docs/architecture.md)。

## 本地运行

工具：Node 24、Python 3、CMake ≥3.21、C++20 编译器、Ninja、Emscripten 7.0.0。Node20过旧，不要沿用系统默认版本。开发者已执行下列流程；这里是维护说明，不要求读者为首次交付补做开发工作。

```powershell
git clone --recurse-submodules https://github.com/breeze028/rendering-lab.git
cd rendering-lab
npm ci
npm ci --prefix external/pbrt/web
cmake -S external/pbrt -B external/pbrt/build-web-native -G 'Visual Studio 17 2022' -A x64 -DPBRT4_BUILD_WEB=ON
cmake --build external/pbrt/build-web-native --config Release --parallel 4
git clone https://github.com/emscripten-core/emsdk.git external/pbrt/.reference/emsdk
git -C external/pbrt/.reference/emsdk checkout 708dcbcc9ee23bc7d2dad44fc90db377e38b771c
python external/pbrt/.reference/emsdk/emsdk.py install 7.0.0
python external/pbrt/.reference/emsdk/emsdk.py activate 7.0.0
npm run build:wasm --prefix external/pbrt/web
npm run prepare:assets --prefix external/pbrt/web
node scripts/prepare-runtime.mjs
npm run dev
```

Linux native build 用 `-DCMAKE_BUILD_TYPE=Release` 替代 Visual Studio generator / `--config`。复用已安装的 emsdk 可设置 `EMSDK`，不必重装。网站 URL 含 `/rendering-lab/`，终端会打印正确地址。

## 新增课程与实验

在 `src/pages/learn/` 新增 `.mdx`，frontmatter 指定 `layout: ../../layouts/Lesson.astro`、title、section、toc。`$...$` 为行内公式，独立三行 `$$ / expression / $$` 为公式块。更新 `Lesson.astro` 中导航；规划章节不要链接到不存在的页面。

交互组件放在 `src/components`，数学模型放在 `src/lib`，MDX 用 `client:load` 挂载。GPU 资源仍延迟到用户启动，不在 SSR 或 import 时申请。需要展示源码时从实际执行的 WGSL `?raw` 导入；用 `snippet:...:start/end` 标记与 `snippet()` 提取，缺失标记会令构建失败。

## 使用和升级 renderer

`external/pbrt` 是固定提交的 Git submodule，拥有唯一 parser、Scene IR、资源系统和 renderer。本站直接 import 其 TS/WGSL；不是独立复制后各自维护。依赖改动在上游 `feat/rendering-lab-observation` 分支；旧 main 默认行为不变。

先在依赖独立分支实现并验证，再提交/推送依赖，最后在本仓库提交新的 gitlink。不能只改子模块工作区而忘记推送。构建顺序为 native → WASM → prepare:assets → site build。C++改变必须重建WASM；shader改变只需重建网站。

## 验证与发布

```powershell
npm run typecheck
npm test
npm run build
npm run preview -- --port 4321
# 保持预览运行，另一终端：
node scripts/check-http.mjs http://127.0.0.1:4321/rendering-lab/
npx playwright install chromium
npm run test:browser
```

无界面 Chromium 测试是独立测试进程，不操作用户桌面浏览器。使用完整 Chromium 的新 headless 模式；精简 headless-shell 在部分 Windows 安装缺少 DXC，可能无法创建 D3D12 WebGPU device。GPU 测试须有实际可用的 WebGPU adapter；不把测试跳过标为通过。`?verify=1` 暴露仅供同源测试的 runtime 对象，普通页面不暴露。

推送 `main` 后 Actions 自动构建、测试并部署 `dist`。Pages source 应为 GitHub Actions，本次通过已有账号权限配置。base 默认为 `/rendering-lab/`；改仓库名时同时修改 `astro.config.mjs` 的默认 base、workflow 的资源检查路径与站点地址，或统一传入 `PAGES_BASE_PATH`。没有后端、域名购买、pthreads 或跨源隔离依赖。

## 常见加载问题

- WASM 404/返回 HTML：检查子路径与 `public/runtime/wasm`，先运行上游 prepare:assets，再构建本站。HTTP 检查会验证 MIME、magic 和实际编译。
- Worker 404：不要复制 TS 到 public；由 Vite 的 `new URL(..., import.meta.url)` 构建 Worker。开发与生产必须都测。
- 场景 checksum mismatch：重新生成原始 bundle，不要手改 manifest。测试逐文件检查 SHA256。
- 无 WebGPU：使用 HTTPS/localhost 与支持 WebGPU 的浏览器；文章不依赖 GPU。设备丢失和编译错误会显示真实错误。
- 修改后图像混合：相机、深度、策略和 AOV 需要 reset；曝光/布局只重绘显示。捕获必须绑定当时的相机与算法配置。

## 当前边界与下一步

三篇实质课程、一个可运行 Cornell benchmark。其余课程是有标记的规划。Path Inspector 已记录真实路径与基本计算，空间视图为独立可旋转的世界坐标投影；场景网格叠加、反向 PDF、完整贡献归因、variance/error AOV、导出参考图与多算法性能统计尚未实现。没有在线 WGSL 编辑器。

下一步按 BDPT 双向子路径与密度 → Photon/SPPM 的多阶段 buffer/grid → MLT bootstrap/chain → Denoiser guide与reprojection推进。通用会话接口是草案，尚未为这些算法承诺统一执行实现。详见网站 Roadmap 与架构文档。

## 许可

本站源码 Apache-2.0。共享 runtime 的 Apache-2.0、LightTransport 作者归属、PBRT及工具链 notices、Cornell CC0 均保留；完整来源见 [THIRD_PARTY](THIRD_PARTY.md) 与上游 web/THIRD_PARTY。

## 代码排版

教程正文与阅读导航使用中文，保留 BSDF、PDF、MIS、WGSL 等技术标识。网站源码统一用 `npm run format` 格式化，用 `npm run format:check` 检查；共享 WGSL 教学函数直接在依赖源码中按多行展开，课程引用同一份运行代码。
