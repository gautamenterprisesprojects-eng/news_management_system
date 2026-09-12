# Newspaper Generator API Details

This document describes how NMS sends selected processed news to the Newspaper Generator project, and how the Newspaper Generator sends the finished PDF back to NMS.

## 1. NMS Sends Bundle To Newspaper Generator

Set this environment variable in NMS:

```env
NEWSPAPER_GENERATOR_URL=https://generator.pagemint1.gautamenterprises.org/api/nms-bundle
NEWSPAPER_GENERATOR_API_KEY=
NEWSPAPER_GENERATOR_PAGEMINT_USER_ID=cliffdemo3
```

When the Main Editor selects a Sub-editor or API-enabled Reporter and sends a bundle, NMS sends a `POST` request to `NEWSPAPER_GENERATOR_URL`.

Headers:

```http
Content-Type: application/json
Authorization: Bearer your-secret-key
```

`Authorization` is sent only when `NEWSPAPER_GENERATOR_API_KEY` is configured.

Example payload:

```json
{
  "source": "NMS THE CLIFF NEWS",
  "sentAt": "2026-09-09T10:30:00.000Z",
  "job_id": "JOB-1788904947291-AB12CD34",
  "bundle_id": "BUNDLE-1788904947291-EF56GH78",
  "edition_id": "EDITION-2026-09-09",
  "target_user_id": 12,
  "pagemint_user_id": "cliffdemo3",
  "pagemint_target_id": "cliffdemo3",
  "targetUser": {
    "id": 12,
    "pagemintId": "cliffdemo3",
    "externalId": "cliffdemo3",
    "role": "sub_editor",
    "nameHi": "राकेश सिंह",
    "nameEn": "Rakesh Singh",
    "fullName": "Rakesh Singh",
    "post": "जिला प्रभारी",
    "district": "Bhopal",
    "place": "Bhopal",
    "avatarUrl": "https://nms.example.com/uploads/avatars/avatar-12.jpg"
  },
  "pdfCallback": {
    "url": "https://nms.example.com/api/webhook/newspaper-pdf",
    "method": "POST",
    "targetUserId": 12,
    "pagemintTargetId": "cliffdemo3",
    "fileField": "pdf",
    "targetField": "target_user_id",
    "authHeader": "x-webhook-key"
  },
  "count": 8,
  "articles": [
    {
      "newsId": 101,
      "language": "hi",
      "headline": "AI rewritten headline",
      "originalHeadline": "Original reporter headline",
      "body": "AI rewritten article body",
      "originalBody": "Original reporter body",
      "reporter": {
        "id": 44,
        "name": "Reporter Name",
        "nameHi": "रिपोर्टर नाम",
        "nameEn": "Reporter Name"
      },
      "place": "Bhopal",
      "category": "local",
      "tags": "tag1, tag2",
      "images": [
        {
          "id": 1,
          "order": 1,
          "sortOrder": 0,
          "isCover": false,
          "url": "https://nms.example.com/uploads/news-101-image-1.jpg",
          "path": "/uploads/news-101-image-1.jpg"
        },
        {
          "id": 2,
          "order": 2,
          "sortOrder": 1,
          "isCover": true,
          "url": "https://nms.example.com/uploads/news-101-image-2.jpg",
          "path": "/uploads/news-101-image-2.jpg"
        }
      ],
      "coverImage": {
        "id": 2,
        "order": 2,
        "sortOrder": 1,
        "isCover": true,
        "url": "https://nms.example.com/uploads/news-101-image-2.jpg",
        "path": "/uploads/news-101-image-2.jpg"
      },
      "websiteLinks": {
        "hindi": "https://thecliffnews.in/hi/article-url",
        "english": "https://thecliffnews.in/en/article-url"
      },
      "createdAt": "2026-09-09 10:00:00",
      "processedAt": "2026-09-09 10:15:00",
      "forwardedAt": null
    }
  ]
}
```

Important image rule:

Each article has its own `images` array. Images are never sent as one mixed global list. The Newspaper Generator should keep each article's images attached to that same `newsId`.

Image order:

Use `images[].order` ascending. The `coverImage` field is the selected cover image for that article.

Important ID rule:

NMS sends `pagemint_user_id`, `pagemint_target_id`, `targetUser.pagemintId`, and `targetUser.externalId` for PageMint routing. These values default to `cliffdemo3`.

Do not replace numeric NMS IDs with `cliffdemo3`. `target_user_id`, `targetUser.id`, `callback.targetUserId`, and `pdfCallback.targetUserId` must remain the numeric NMS user ID so returned PDFs are stored under the correct NMS user.

## 2. Newspaper Generator Sends PDF Back To NMS

After generating the PDF, the Newspaper Generator should call the callback URL from `pdfCallback.url`.

Request:

```http
POST https://nms.example.com/api/webhook/newspaper-pdf
Content-Type: multipart/form-data
x-webhook-key: your-webhook-secret
```

Form fields:

```txt
target_user_id = 12
pdf = generated-newspaper.pdf
```

If `NEWSPAPER_GENERATOR_WEBHOOK_KEY` is set in NMS, the Newspaper Generator must send the same value as:

```http
x-webhook-key: your-webhook-secret
```

or:

```http
x-api-key: your-webhook-secret
```

NMS response:

```json
{
  "success": true,
  "message": "PDF received and stored successfully.",
  "pdfUrl": "/uploads/pdfs/newspaper-12-1788904947291.pdf"
}
```

## 3. Where PDFs Appear In NMS

After NMS receives the PDF:

- Main Editor PDF section shows the PDF under the selected target user.
- The target user sees only their own PDFs in their PDF tab.
- Other users cannot see that target user's PDFs.

## 4. Retention

PDFs are cleaned automatically after about `48-49 hours` when:

```env
ENABLE_NEWS_CLEANUP=true
```

The cleanup job runs every 1 hour.
