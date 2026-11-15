# 第三方来源

- `external/pbrt`：breeze028/pbrt-v4-parser，Apache-2.0，固定 gitlink 版本；直接导入 runtime，不复制 Parser。详见该依赖的 `LICENSE`、`web/THIRD_PARTY.md`。
- LightTransport 算法来源固定 `47a461d267ed61c2c30c5054d98290ab107da581`，作者 breeze028。此次未复制 CUDA 源码或第三方加速结构。
- PBRT 的 BSDF 方程来源、Emscripten/libc++/musl notices、starter MIT 归属由 runtime 的 prepare:assets 原样保留到发布站 `runtime/licenses/`。
- Cornell Box 原始场景与其 CC0 `LICENSE.txt` 在同一经过 SHA256 验证的资源 bundle 中。不包含大型模型、不上传用户私有资产。
- Astro/React/KaTeX/remark/rehype 等按自身许可使用；版本固定于 package-lock.json。KaTeX 字体由构建器随站打包，无远程字体请求。
- 教学参考只链接与自行解释；没有复制参考网站文章、截图或其交互代码。参考站清单见 docs/design-references.md。
