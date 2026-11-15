# 验证记录

2026-11-16，Asia/Shanghai。区分数值测试、独立无界面 Chromium 观察、部署状态与人工验收。没有操作用户桌面浏览器；参考网页通过云端读取。本文不把自动化测试当作用户人工验收。

## 本地已执行

| 层级 | 命令 / 验证 | 结果 |
|---|---|---|
|C++|CMake / MSVC Release + ctest|36/36，通过|
|WASM|固定 Emscripten 7.0.0 重新编译；上游 npm test|5/5，通过：Cornell GPU数组native/WASM一致、异常/所有权等|
|TS|上游 typecheck/build + 本站 astro check|0 errors / warnings / hints；两站生产构建通过|
|CPU数学|npm test|3/3：全部PDF归一化/支持、5种估计与quadrature一致、seed可重放|
|静态资源|check-http /rendering-lab/|路由、JS/CSS、WASM MIME/magic/compile、Cornell原始2文件及许可SHA256通过|
|浏览器|完整 Chromium，新 headless，NVIDIA Ampere adapter|3/3通过：课程导航/公式/实际WGSL、图表编辑、GPU渲染、AOV、捕获、布局、移动回退与基线回归|
|向后兼容|旧 HEAD `551334a7` 四个WGSL在同一GPU重新编译对比|128²、1SPP、depth8、默认MIS/clamp/旧depth：整个线性film max abs error=0|
|捕获忠实度|单样本film像素与capture RGB比较|pixel(64,80), sample0：逐通道相等，film保持1SPP|

单样本 RGB 为 `[0.10007704794406891, 0.06798981130123138, 0.020945077762007713]`；replay 相同。基线比较由测试直接读取固定 git 对象，不依赖手工保留的截图。

GPU自检：6条CPU/GPU求交对比、28681项BSDF检查、9项解析检查，diagnostics `[0,0,0,0]`；Cornell 无纹理，texels=0，bump normals=3。既有coat近似的能量测试并不等于coat严格守恒，本课不使用coat。

三模式 smoke：128²、128SPP、depth6、seed1、clamp off、教学depth开启，线性RGB全像素全通道均值：BSDF `0.1186861862`，NEE `0.1118534493`，MIS `0.1118788368`。这是确定性运行输出检查，**不是参考图误差/方差结论**；未计算置信区间，不用这些数值推断性能或无偏性。

## 浏览器检查范围

- 真实CPU图表参数改变估计；不是动画占位。
- 原始Cornell经WASM Worker解析并实际GPU累积；输出finite且非黑。
- Albedo、世界几何/着色法线、depth、UV、placement/material ID来自真实GPU求交，数值finite且编码范围合法。
- pixel(192,240), sample0重复捕获一致，首次配置记录9个顶点。
- Reading↔Full Lab不重置SPP；Debug orbit与成像相机分离。
- 390×844下无横向文档溢出；移除navigator.gpu后显示可理解错误，课程与章节仍可用。
- 浏览器 pageerror 与 console error 为零。测试使用独立临时profile，不读取用户现有浏览器数据。

初次使用精简 headless-shell 因缺DXC不能创建设备，改为完整Chromium headless后在同一NVIDIA adapter通过。初期发现的数学块/加载时机问题已修复并重测。

## 未声称完成

没有用户人工验收；没有参考网站真实桌面截图；没有手机实体GPU测试；没有GPU timestamp-query统计；没有高SPP匹配参考图与图像误差验证；路径视图没有网格叠加或高级贡献归因。首版已明确标注这些界限。

## 部署

已创建公开仓库 `breeze028/rendering-lab`，并通过既有账号权限设置 Pages source=workflow。

- 首个源码部署 commit：`ef147f47a04808f9362152a7d880f85f5d99f041`；[Actions run 43747575105](https://github.com/breeze028/rendering-lab/actions/runs/43747575105)，build与deploy均success。
- 有效公开地址：[Rendering Lab](https://breeze028.github.io/rendering-lab/)。不是预览地址。
- 公网 check-http：16个URL、WASM MIME/magic/实际compile、原Cornell2文件及LICENSE SHA256通过。
- 公网完整学习链路浏览器测试通过：PDF交互、真实Cornell、三种估计器、7个AOV、Path Inspector、模式切换和GPU自检。公网移动端阅读/无WebGPU回退也通过。
- 首次公网自动化过早操作SSR控件产生测试时序失败；测试已显式等待Astro hydration完成，再验证交互。独立公网加载确认完整Worker/WASM链和真实GPU输出。
- Git HTTPS连接连续失败，改用官方Git Data API发布；API核对远端tree SHA与已审查本地tree完全一致，并重建/验证提交对象后更新本地引用。未扩大账号权限或暴露凭据。
- 大屏正文最终限制760px，实验可独立拓宽；1660px截图检查readingWidth=760且无横向溢出。390px移动测试再次通过。

本地原始 `pbrt-v4-parser` 和 `LightTransport` 检出始终保持干净；共享改动只位于新站子模块的独立分支。截图位于 `docs/evidence/`，包含阅读页、真实渲染/路径检查及移动回退。

## 中文教程与代码排版更新

三篇课程正文、学习路线、阅读导航、目录和二维实验说明改为中文；数学公式与技术标识符保留。网站源码采用 Prettier（90列、2空格缩进），可运行 `npm run format` / `npm run format:check`。教学 WGSL 的 power、hit_weight 和 NEE 贡献计算在共享 runtime 中直接展开，不维护另一份展示代码；片段提取统一去除公共缩进，代码字号改为13px。

本地 typecheck、format:check、生产构建、数学测试3/3、浏览器测试3/3通过。格式调整后旧基线图像最大误差仍为0，捕获样本RGB仍与film相等。
MDX 的原生 HTML 说明块保留行内短语结构，并排除通用自动格式化，避免生成嵌套 p 标签；浏览器确认 lead 为22px且段落子节点数为0。
