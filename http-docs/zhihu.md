### 获取用户信息接口
GET https://www.zhihu.com/api/v4/me?include=is_realname


Headers:
```js
{
    "Accept": "*/*",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "cache-control": "no-cache",
    "content-type": "application/json; charset=utf-8",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Cookie": this.authToken
}
```


Response:
```js
{
    id: 'c35e2956cf02319af580b11dd10e4bab',
    url_token: 'erpan-30',
    name: 'Erpan',
    use_default_avatar: false,
    avatar_url: 'https://pica.zhimg.com/v2-c829d46ec39af20c8a234a2e9edb7e55_xl.jpg?source=32738c0c&needBackground=1',
    avatar_url_template: 'https://picx.zhimg.com/v2-c829d46ec39af20c8a234a2e9edb7e55_l.jpg?source=32738c0c&needBackground=1',
    is_org: false,
    type: 'people',
    url: 'https://www.zhihu.com/api/v4/people/erpan-30',
    user_type: 'people',
    headline: '一个30岁的IT',
    headline_render: '一个30岁的IT',
    gender: 1,
    is_advertiser: false,
    ip_info: 'IP 属地中国香港',
    vip_info: {
        is_vip: false,
        vip_type: 0,
        rename_days: '0',
        entrance_v2: null,
        rename_frequency: 0,
        rename_await_days: 0
    },
    kvip_info: { is_vip: false },
    answer_count: 85,
    question_count: 22,
    articles_count: 26,
    columns_count: 0,
    zvideo_count: 0,
    favorite_count: 1,
    pins_count: 0,
    voteup_count: 38,
    thanked_count: 53,
    line_comment_count: 0,
    line_like_count: 0,
    line_comment_only_count: 0,
    available_medals_count: 0,
    org_verify_status: null,
    uid: '945021335114584064',
    default_notifications_count: 69,
    follow_notifications_count: 0,
    vote_thank_notifications_count: 0,
    messages_count: 6,
    creation_count: 133,
    is_realname: true,
    has_applying_column: false,
    has_add_baike_summary_permission: false,
    editor_info: [ 'bio', 'topic' ],
    ai_assistant_info: null


### 创建文章草稿
POST https://zhuanlan.zhihu.com/api/articles/drafts

Headers:
```js
{
    "Accept": "*/*",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "cache-control": "no-cache",
    "content-type": "application/json; charset=utf-8",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Cookie": this.authToken
}
```

Body:
```js
{
    "content": "<p>一个30岁的IT一个30岁的IT一个30岁的IT一个30岁的IT</p>",
    "table_of_contents": false,
    "delta_time": 13,
    "can_reward": true
}
```

Response:
```js
{
    "image_url": "",
    "updated": 1770102725,
    "copyright_permission": "need_review",
    "reviewers": [],
    "topics": [],
    "excerpt": "",
    "article_type": "normal",
    "force_login_when_click_read_more": false,
    "excerpt_title": "",
    "summary": "",
    "title_image_size": {
        "width": 0,
        "height": 0
    },
    "id": "2002036615099471373",
    "author": {
        "is_followed": false,
        "avatar_url_template": "https://pica.zhimg.com/v2-c829d46ec39af20c8a234a2e9edb7e55.jpg?source=d16d100b",
        "uid": "945021335114584064",
        "user_type": "people",
        "is_following": false,
        "url_token": "erpan-30",
        "id": "c35e2956cf02319af580b11dd10e4bab",
        "description": "没有简介，只有回答",
        "name": "Erpan",
        "is_advertiser": false,
        "headline": "一个30岁的IT",
        "gender": 1,
        "url": "/people/c35e2956cf02319af580b11dd10e4bab",
        "avatar_url": "https://pic1.zhimg.com/v2-c829d46ec39af20c8a234a2e9edb7e55_l.jpg?source=d16d100b",
        "is_org": false,
        "type": "people"
    },
    "url": "https://zhuanlan.zhihu.com/p/2002036615099471373",
    "comment_permission": "all",
    "settings": {
        "commercial_report_info": {
            "is_report": false,
            "commercial_types": []
        },
        "commercial_zhitask_bind_info": {},
        "table_of_contents": {
            "enabled": false
        }
    },
    "created": 1770102725,
    "content": "",
    "has_publishing_draft": false,
    "state": "draft",
    "content_need_truncated": false,
    "is_title_image_full_screen": false,
    "title": "一个30岁的IT",
    "title_image": "",
    "type": "article_draft"
}
```

### MD文件转HTML
POST https://www.zhihu.com/api/v4/document/convert

Request Body:
```js
{
    "document": "二进制MD文件",
    "task_id": f52089c2-8cc1-4556-b80d-ea186f288b12,
    "scene": article,
    "content_token": undefined
}
```

Response Body:
```js
{
    "code": 0,
    "data": {
        "filename": "conetent.md",
        "html_content": "转换内容"
    },
    "message": "success"


### 文章发布
POST https://www.zhihu.com/api/v4/content/publish

Request Body:
```js
{
    "action": "article",
    "data": {
        "publish": {
            "traceId": "1769868138503,6a25f914-4cdb-4938-a716-778718c81818"
        },
        "extra_info": {
            "publisher": "pc",
            "pc_business_params": "{\"commentPermission\":\"anyone\",\"disclaimer_type\":\"none\",\"disclaimer_status\":\"close\",\"table_of_contents_enabled\":false,\"content\":\"<p>x上周我把一个核心模块交给。💩</p>\",\"title\":\"周我把一个核心模块交给AI重构1\",\"commercial_report_info\":{\"commercial_types\":[]},\"commercial_zhitask_bind_info\":null,\"canReward\":true}"
        },
        "draft": {
            "disabled": 1,
            "id": "2001052724515591629",
            "isPublished": false
        },
        "commentsPermission": {
            "comment_permission": "anyone"
        },
        "creationStatement": {
            "disclaimer_type": "none",
            "disclaimer_status": "close"
        },
        "contentsTables": {
            "table_of_contents_enabled": false
        },
        "commercialReportInfo": {
            "isReport": 0
        },
        "appreciate": {
            "can_reward": true,
            "tagline": "真诚赞赏，手留余香"
        },
        "hybridInfo": {},
        "hybrid": {
            "html": "<p>x上周我把一个核心模块交给。💩</p>",
            "textLength": 2224
        },
        "title": {
            "title": "周我把一个核心模块交给AI重构1"
        }
    }
}
```

Response Body:
```js
{
    "publish": {
        "id": "2002529657535345354",
        "content": ""
    },
    "pinDraft": null,
    "pinResp": "",
    "questionResp": ""
}