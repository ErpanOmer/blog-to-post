---
name: publishing-adapters
description: Blog-to-Post platform adapter guide for drafts, publishing, image upload, code highlighting, and adapter trace diagnostics.
skill_version: 1.0.0
updated_at: 2026-04-27T00:00:00Z
tags: [publishing, adapters, images, wechat, csdn, zhihu]
---

# Publishing Adapters

Use this skill when changing files under `src/worker/accounts`, shared media utilities, publish task execution, or platform-specific HTML output.

## Contract

All adapters implement `AccountService`:

- `verify`
- `status`
- `info`
- `articleDraft`
- `articlePublish`
- `articleDelete`
- `articleList`
- `articleDetail`
- `articleTags`
- `imageUpload`

Register adapters from `src/worker/accounts/index.ts`.

## Publish Trace Rule

Publish-time diagnostics must use `tracePublish` from `AbstractAccountService`.

Use traces for:

- content image scan/start/done/failure
- cover image scan/start/done/failure
- platform API request failure
- fallback behavior
- final draft/publish result

Never log raw access tokens, cookies, app secrets, upload signatures, or authorization headers.

## Image Upload Rule

Do not trust image URL suffixes.

Use shared helpers:

- `resolveImageMimeTypeFromBlob`
- `resolveImageExtensionByMime`
- `uploadImageWithCandidates`
- `buildCloudinaryImageFormatRewriteSources`

Expected flow:

1. Normalize URL or data URI.
2. Download/parse image.
3. Detect actual MIME from blob type or bytes.
4. Map MIME to platform-supported suffix.
5. Upload candidate.
6. Retry converted candidates only when platform error indicates unsupported image type.

## WeChat Notes

WeChat requires official API credentials and IP whitelist.

- Auth is `appId` + `appSecret`.
- Draft creation requires `thumb_media_id`.
- Cover upload uses `/cgi-bin/material/add_material?type=thumb`.
- Content image upload uses `/cgi-bin/media/uploadimg`.
- `errcode: 40164` means the current outbound IP is not in WeChat's whitelist.
- Code blocks use GitHub-dark-like inline style because WeChat strips most CSS.
- Header/footer placeholders:
  - `{{WECHAT_HEADER_SLOT}}`
  - `{{WECHAT_FOOTER_SLOT}}`

## CSDN Notes

CSDN accepts both markdown and HTML payloads.

- Keep markdown in `markdowncontent`.
- Keep rendered HTML in `content`.
- Use `highlightHtmlPreCodeBlocksWithPrism` for `pre > code`.
- Preserve Prism classes and token spans.
- Avoid forced inline token colors unless a CSDN regression proves it is needed.
- Clean emoji from titles before save/publish.

## Testing Guidance

For risky adapter changes:

- Test with `draftOnly: true` first.
- Use an article with at least one remote PNG/JPEG and one code block.
- Check `publish_task_steps` adapter traces, not just the final task result.
- If a platform fails, identify the upstream API error before changing fallback logic.

