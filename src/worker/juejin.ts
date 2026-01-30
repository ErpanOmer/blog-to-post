const juejinTop20TitlesUrl = "https://api.juejin.cn/content_api/v1/content/article_rank?category_id=6809637767543259144&type=hot&aid=2608&uuid=7581427136196675078&spider=0";
const userTop50TitlesUrl = "https://api.juejin.cn/content_api/v1/article/query_list?aid=2608&uuid=7581427136196675078&spider=0";

async function fetchJuejinTop20Titles() {
    try {
        const response = await fetch(juejinTop20TitlesUrl, {
            method: "GET",
            headers: { "Content-Type": "application/json" }
        });
        if (!response.ok) {
            return [] as string[];
        }
        const data = (await response.json()) as {
            data?: Array<{ content?: { title?: string }; title?: string }>;
        };
        return (data.data ?? [])
            .map((item) => item.content?.title ?? item.title)
            .filter((title): title is string => Boolean(title))
            .slice(0, 20);
    } catch (error) {
        console.error("掘金标题抓取失败", error);
        return [] as string[];
    }
}

async function fetchUserTop50Titles() {

    const fn = async (cursor = 0) => {
        try {
            const response = await fetch(userTop50TitlesUrl, {
                method: "POST",
                body: JSON.stringify({
                    "user_id": "3878732754331096",
                    "sort_type": 2,
                    "cursor": cursor.toString(),
                }),
                headers: { "Content-Type": "application/json" }
            });
            if (!response.ok) {
                return [] as string[];
            }
            const data = await response.json() as {
                data?: Array<{ article_info?: { title?: string } }>;
            };

            // 避免被封禁
            await new Promise((resolve) => setTimeout(resolve, 1000));

            return (data.data ?? [])
                .map((item) => item.article_info?.title ?? "")
                .filter((title): title is string => Boolean(title));
        } catch (error) {
            console.error("用户标题抓取失败", cursor, error);
            return [] as string[];
        }
    }

        const titles: string[] = [];

        for (let i = 0; i < 5; i++) {
            const data = await fn(i * 10);
            titles.push(...data);
        }

        return titles
}


export default async function() {
    const userTitles = await fetchUserTop50Titles();
    const juejinTitles = await fetchJuejinTop20Titles();
    return {
        userTitles,
        juejinTitles,
    }
}