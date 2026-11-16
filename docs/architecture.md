# 架构与工程审查

## 审查基线

2026-11-16 检查远端与本地 `pbrt-v4-parser` HEAD 均为 `551334a7bae833db733c542879288b89bf7b6085`，本地工作区干净。`LightTransport` 本地 HEAD 为 `47a461d267ed61c2c30c5054d98290ab107da581`，工作区干净。未修改这两个原始检出目录。

已阅读 Parser 的 web/README、THIRD_PARTY、renderer、全部组成 shader、worker、构建/资产脚本、Actions 与 UI redesign 文档。实际代码已有 BLAS/TLAS、RGB 材质、NEE/MIS、RR、HDR film、generation Worker、求交/BSDF/纹理 GPU 自检；原来没有教学采样切换、主射线 AOV 和样本路径捕获。

LightTransport 可复用的是 PDF、BSDF、NEE/MIS、RR 和后续 SVGF 算法参考；CUDA 调度、指针/allocator、TinyBVH、场景 Loader 与 GPU 原子/波前机制不能直接搬到 WebGPU。本次继续使用已经存在的 WGSL 移植，不引入 `.lt` 加载器或第二套 Parser。后续 denoiser 必须先建立线性 film、稳定 guide、motion/reprojection 与 disocclusion 契约，不能只复制滤波 shader。

## 依赖与构建

`external/pbrt` 是 Git submodule，URL 指向原公开 SDK，固定 gitlink commit `1bc431970d7044dd5052e8b21b4277a6f8d52854`；共享改动发布在 `feat/rendering-lab-observation`，原 `main` 不变。准确提交亦可见 `git ls-tree HEAD external/pbrt`。没有在网站内复制 renderer。

1. 递归检出固定依赖。
2. CMake 构建独立 native SDK、consumer packer 与测试。
3. 固定 emsdk commit `708dcbcc9ee23bc7d2dad44fc90db377e38b771c`，Emscripten 7.0.0 编译单线程 WASM。
4. 上游 `prepare:assets` 将原 Cornell PBRT/PLY 与许可证打包；manifest 逐文件 SHA256。
5. `prepare-runtime.mjs` 仅复制生成的 WASM、Cornell bundle 与许可证到 public/runtime。由 Astro/Vite 原生导入 runtime TS/WGSL，并构建两个 Worker。
6. 静态 `dist` 发布到 `/rendering-lab/`。

升级：先在独立依赖分支运行旧站类型检查、构建、WASM parity 与 GPU 自检；再更新 gitlink，重建生成资源并运行网站测试。禁止用 `git submodule update --remote` 作为发布步骤。

## 网站所有权

`src/pages` 为 MDX 课程/静态路由；`layouts` 控制阅读布局；`SamplingLab` 与 `lib/sampling.ts` 实现可复现的一维实验；`RendererLab` 拥有 GPU 会话、Worker、参数与错误状态；`PathView` 只显示回读的路径数据。数学图与渲染共享 BSDF/Light/MIS 策略选择；一维光源/BSDF 形状参数不映射成 Cornell 材质，课程明确说明差别。

Full Lab 是同一组件的 CSS 布局模式，canvas 和 Renderer 不卸载。跨课程文档导航保留 localStorage 策略参数，不承诺保留 GPU 对象。未来跨多篇课程复用活跃会话可增加持久外壳，但首版不提前建立 SPA 框架。

## Runtime 模块边界

保留现有 Scene IR/GPU packing、intersection、bsdf、texture、integrator 与 present 文件。此次只增加可选策略位、AOV 输出和 capture pass，默认 MIS、clamp、相机与旧 API 行为不变。教学站单独启用 `teachingDepth=true`：有限深度按散射顶点计数，并评估末端 emission，使三种策略在深度边界仍针对同一积分；旧站默认false。

后续 integrator 会话应拥有 `initialize → reset(reason) → step/multiple passes → capture → dispose`；Film 与 AOV schema 独立。`lib/session.ts` 是扩展契约草案，**不是声称现有 Renderer 已实现通用调度器**。BDPT 可持有双向路径 buffer；SPPM 可持有 hash grid 与 progressive statistics；MLT 可持有 bootstrap/chain 状态，不能都塞进 `trace(ray)`。

## AOV 定义

见 `lib/session.ts`，所有值来自 GPU 的真实主射线求交。AOV 使用中心射线，不带 film jitter；miss=黑。Albedo 为基础 RGB 参数；法线世界空间编码到 [0,1]；depth=t/(1+t)，不是线性距离灰阶；UV 为 fract；Object 为 placement ID，Material 为 GPU material ID，颜色仅为明确的稳定 ID 编码。AOV 绕过 tone map/gamma；Final 使用原显示变换。切换 AOV 清空该 view film；模式切换/曝光不清空。

## 捕获 schema

独立 `capture_path` dispatch 调用与 film 相同的 `camera_sample → trace`。它使用独立 uniform/capture/diagnostic buffers，重建同一 pixel、sample index、seed 的初始 RNG。观察语句不调用 random，普通 dispatch 的 capturing=false。最多记录64顶点，积分本身不截断；标志对恰好64顶点也保守提示达到容量。

头部 vec4=sample RGB/count。每顶点12个vec4：

| slot | xyz / w |
|---|---|
|0|world position / GPU material ID|
|1|world geometric normal / reserved|
|2|world shading normal / transport depth|
|3|incoming direction away from surface / ray distance|
|4|entry throughput / previous forward PDF|
|5|sampled outgoing world direction / forward solid-angle PDF|
|6|BSDF value evaluated in local frame / delta flag|
|7|NEE world direction / light PDF|
|8|weighted NEE RGB contribution / light MIS weight|
|9|partial radiance / RR survival probability|
|10|NEE endpoint / visible flag|
|11|UV.xy, placement ID, RR-terminated flag|

未执行的分支字段保持零，例如 emitter 顶点没有 BSDF scatter。RR 存活概率在未启用时为1。delta 不能将普通连续 BSDF/PDF 当作狄拉克概率。当前用于 diffuse Cornell，没有对特殊透射计数的高级解释。

空间视图已改为同一GPU场景数据派生网格中的三维折线，支持独立调试相机、剖视和遮挡提示；详见 [相机与路径观察](camera-and-path-inspector.md)。反向 PDF、逐路径贡献分解与全策略权重图仍留待后续，现有表格不会伪造这些字段。
