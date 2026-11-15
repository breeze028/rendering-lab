# 设计参考与观察边界

2026-11-16。正式实现前通过在线正文读取以下页面。桌面浏览器自动化尝试被工具的 URL 识别保护中止，**未取得参考站桌面截图**；以下是内容与交互结构研究，不冒充截图审查。此前三张截图未在当前附件中找到。

| 页面 | 借鉴的具体元素 / 解决的问题 | Rendering Lab 对应组件 | 不照搬 |
|---|---|---|---|
| [FromScratchLab](https://www.fromscratchlab.com/) | 按先修关系组织课程；正文就地嵌入有数值的滑杆，避免读者离开论证 | 可折叠课程树、窄正文、右侧目录、SamplingLab | 首页课程数量与装饰；不声称读过尚未访问的课程页 |
| [Maxime / Raymarching](https://blog.maximeheckel.com/posts/painting-with-math-a-gentle-study-of-raymarching/) | 先单条射线再完整图像，代码紧接图解 | 像素→样本→路径顶点、实际 WGSL 片段 | 全文的视觉特效与个人博客导航 |
| [Maxime / Sky](https://blog.maximeheckel.com/posts/on-rendering-the-sky-sunsets-and-planets/) | 从现象推导模型，逐步控制参数 | MIS 从漏采小光源出发，再讨论权重 | 大气模块超出首版 |
| [Maxime / Painterly](https://blog.maximeheckel.com/posts/on-crafting-painterly-shaders/) | 把中间滤波过程单独展示 | AOV 与最终颜色分开解释 | 艺术滤镜不能充当采样策略差异 |
| [Distill / Gaussian processes](https://distill.pub/2019/visual-exploration-gaussian-processes/) | 多视图共享参数，公式与概率对象同步 | PDF、贡献与收敛曲线共用确定性样本 | 不复制矩阵交互到无关主题 |
| [Lights and Shadows](https://ciechanow.ski/lights-and-shadows/) | 局部滑杆改变几何中的明确量；从简到繁 | 光源角宽、BSDF 宽度、真实路径空间图 | 不把二维概率代理称为 Cornell 的精确截面 |
| [Cameras and Lenses](https://ciechanow.ski/cameras-and-lenses/) | 参数和成像几何对应 | Rendering Camera 与独立 Debug Camera | 首版不增加镜头系统 |
| [Immersive Linear Algebra](https://immersivemath.com/ila/ch03_dotproduct/ch03.html) | 点积/投影可视化与定义并排 | 法线、方向和 BSDF 表格的逐顶点选择 | 不引入整个数学平台 |
| [Radiance Cascades](https://jason.today/rc) | 按算法步骤展示中间缓冲，清楚标注成本 | AOV 定义、诊断抽屉、SPP 与耗时语义 | 不以降噪图替代无偏采样对比 |
| [PlayCanvas interface](https://developer.playcanvas.com/user-manual/editor/interface/) | Viewport/Hierarchy/Inspector 职责明确 | Lab 画面居中，参数右侧、路径检查下方 | 不做通用场景编辑器 |

## 实施选择

中性炭灰与低饱和 sage，渲染结果承担主要色彩；避免卡片墙。阅读页 700–760px 正文，实验可突破正文；宽屏有课程树和目录，窄屏课程树按需展开。Lab 是同一个 React 会话的布局切换：不重建 canvas、device、场景或 accumulation。跨文章导航仅保留参数，不能宣称跨文档保留 GPU 对象。

课程顺序参考 [CSE168](https://cseweb.ucsd.edu/~tzli/cse168/sp2023/)、[CSE272](https://cseweb.ucsd.edu/~tzli/cse272/wi2026/) 与 [PBRT4](https://pbr-book.org/4ed/contents)，按积分→采样→直接光→MIS 的依赖组织；高级模块仅列路线，不生成占位文章。
