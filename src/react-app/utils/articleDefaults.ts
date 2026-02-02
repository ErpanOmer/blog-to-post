import type { Article } from "../types";

export function createEmptyArticle(): Article {
    const now = Date.now();

    // 开发环境默认填充内容
    if (import.meta.env.DEV) {
        return {
            id: `temp-${now}`,
            title: "探索优雅生活美学",
            content: `## 引言

在这个快节奏的时代，我们常常忽略了生活中的美学细节。本文将带您探索如何在家居空间中融入优雅的美学理念。

## 空间布局的重要性

一个精心设计的空间布局能够显著提升居住体验。关键在于：

1. **动线设计**：合理规划人的活动路线
2. **光线运用**：自然光与人工照明的完美结合
3. **色彩搭配**：和谐的色彩搭配营造舒适氛围

## 材质选择

选择合适的材质是打造高品质空间的关键：

- **天然材质**：原木、大理石、亚麻布
- **金属元素**：黄铜、拉丝不锈钢
- **织物软装**：丝绸、羊毛、棉麻

## 结语

通过这些设计理念，我们可以创造出既美观又实用的生活空间，让每一天都充满仪式感。`,
            summary: "本文探讨了如何在家居设计中融入优雅的生活美学，从空间布局、材质选择到色彩搭配，为追求品质生活的读者提供了实用的设计指南。",
            tags: ["生活方式", "家居设计", "美学", "室内设计"],
            coverImage: "https://newurtopia.com/cdn/shop/articles/Mask_Group_18.jpg?v=1754671914&width=500",
            platform: "",
            status: "draft",
            createdAt: now,
            updatedAt: now,
        };
    }

    return {
        id: `temp-${now}`,
        title: "",
        content: "",
        summary: "",
        tags: [],
        coverImage: "",
        platform: "",
        status: "draft",
        createdAt: now,
        updatedAt: now,
    };
}
