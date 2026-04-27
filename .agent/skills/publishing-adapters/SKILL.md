---
name: publishing-adapters
description: Blog-to-Post platform adapter guide for drafts, publishing, image upload, code highlighting, and adapter trace diagnostics.
skill_version: 1.0.0
updated_at: 2026-04-27T00:00:00Z
tags: [publishing, adapters, images, wechat, csdn, zhihu]
---

# Publishing Adapters

Use this skill when changing files under `src/worker/accounts`, shared media utilities, publish task execution, or platform-specific HTML output.

All adapters implement `AccountService` from `src/worker/accounts/types.ts`.

Adapter rules:

- Keep platform-specific behavior inside the adapter.
- Use `tracePublish` for diagnostic events.
- Never log cookies, access tokens, app secrets, upload signatures, or authorization headers.
- Do not trust image URL suffixes.
- Use shared media helpers for MIME sniffing and upload candidate retries.
- Test risky changes with `draftOnly: true`.

Shared media helpers:

- `resolveImageMimeTypeFromBlob`
- `resolveImageExtensionByMime`
- `uploadImageWithCandidates`
- `buildCloudinaryImageFormatRewriteSources`

WeChat notes:

- Requires `appId` + `appSecret`.
- Requires IP whitelist for official API calls.
- Draft creation requires `thumb_media_id`.
- Uses inline code styles because WeChat strips most CSS.

CSDN notes:

- Sends both `markdowncontent` and HTML `content`.
- Uses Prism token output for code blocks.
- Cleans emoji from titles before save/publish.

