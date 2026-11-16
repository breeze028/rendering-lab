# 成像相机与原场景路径观察

2026-11-16。用户指出第一版丢失鼠标相机控制，且独立二维投影难以对应到场景。本次恢复交互，并用同一份已加载场景几何显示真实采样路径。

## 操作

主渲染图：左键拖动旋转，右键／Shift 拖动平移，滚轮前后移动；单击选择像素。4px 移动阈值区分点击和拖动，拖动不会误选像素。移动成像相机会清空 film、使旧捕获失效。重置相机恢复原始 PBRT 相机。

捕获后：下方显示原场景中的世界空间折线、方向箭头、顶点与 NEE 连接。调试视口左键旋转、右键／Shift 平移、滚轮缩放，可查看全场景、聚焦顶点、回到捕获视角。点击顶点或下拉选择同步高亮。调试相机不修改成像相机、积分器、随机数序列或 film。

绿色实线是连续路径；暗绿虚线使被几何遮挡的路径仍可追踪，可关闭。金色／红色虚线分别表示可见／遮挡的 NEE 连接，可单独关闭。蓝点标记捕获时的相机位置。

默认剖视采用背面隐藏。为兼容 PBRT 双面表面的绕序，显示适配器仅将位于整体包围盒边界上的平面墙壁朝向室内；关闭剖视后所有表面双面显示。它不修改求交数据或几何法线 AOV，盒子等非外围平面保持双面显示。

## 数据与资源边界

`Renderer.getDebugScene()` 从已持有的 layout-v2 vertices / primitives / records 派生显示网格，复用 placement 的完整仿射变换、原 shape ID、材质 ID 和颜色。没有重新解析 PBRT，也没有硬编码 Cornell 的墙壁和盒子。当前场景实际为8 placements、36 triangles；单位测试检查变换、绕序、ID与输入不可变性。

路径继续来自同一个 `camera_sample → trace` 的 GPU replay，并携带捕获相机及 FOV。端点使用真实世界坐标，不在显示时重新归一化或拼接另一条路径。

诊断显示使用按需加载的 Three.js/WebGL2 光栅视图与 OrbitControls。它只提供几何、基础颜色、简化灯光和路径标记；不是另一份路径追踪积分器，也不声称复现主图的光照。当前没有纹理/bump/alpha 的完整显示适配；首版漫反射 Cornell 不需要这些能力。首次捕获才下载该约138KB gzip模块，不阻塞文章阅读。

显示按交互／resize／选择重绘，不创建额外常驻动画循环。关闭捕获、改动成像参数或重新捕获时解除事件、ResizeObserver、OrbitControls，并释放 geometry / materials / WebGL context。主 renderer 的 debug geometry 缓存随场景释放。

## PBRT-v4 调研结论

检查官方 `mmp/pbrt-v4` 的固定 HEAD [`20e41fd83789f12550e2c31b2047898c9e20e46c`](https://github.com/mmp/pbrt-v4/commit/20e41fd83789f12550e2c31b2047898c9e20e46c)：

- [CPU ImageTileIntegrator::Render](https://github.com/mmp/pbrt-v4/blob/20e41fd83789f12550e2c31b2047898c9e20e46c/src/pbrt/cpu/integrators.cpp#L60)：`--debugstart x,y,sample` 调用 `StartPixelSample`，再调用同一个 `EvaluatePixelSample`。这是本项目确定性 replay 可直接借鉴的语义；不要为观察额外消耗随机数。
- [WavefrontPathIntegrator::Render](https://github.com/mmp/pbrt-v4/blob/20e41fd83789f12550e2c31b2047898c9e20e46c/src/pbrt/wavefront/integrator.cpp#L259)：其 `--debugstart` 为样本索引或样本范围，与CPU三元组格式不同。交互 GUI 的 RESET 会回退采样索引并重置 film。
- [util/gui.cpp](https://github.com/mmp/pbrt-v4/blob/20e41fd83789f12550e2c31b2047898c9e20e46c/src/pbrt/util/gui.cpp#L174)：鼠标／键盘改变相机变换，GUI 本身显示 framebuffer。适合参考相机与重置的状态边界。
- [官方调试指南](https://pbrt.org/users-guide-v4#debugging) 和 [显示服务器机制](https://pbr-book.org/4ed/Utilities/User_Interaction)：主要用于确定性重现和图像/通道检查。所检查的 CPU、Wavefront、GUI 和 display 代码中，没有找到一个可直接复用的“原场景内三维路径折线＋逐顶点检查器”。这是一项有范围的源码检查结论，不代表所有外部 PBRT 工具都没有类似功能。

## 验证

本地单元测试4/4、浏览器测试4/4通过；类型检查与生产构建通过。旧默认渲染的线性film回归最大误差仍为0，单样本重放RGB与film相等。新增浏览器测试模拟主图旋转/滚轮/重置与选点，以及调试视图旋转/右键平移/滚轮/聚焦，确认后者前后主相机、采样数、generation和完整线性film逐值相等；控制台无error。

截图 `scene-path.png` 和 `scene-path-camera.png` 为独立无界面 Chromium 的实际诊断画面，不是用户桌面截图。仍未获得用户人工验收。
