// Search and AI-answer-engine settings for this app, written by MonstarX's SEO/GEO settings.
//
// Change them in Preview → SEO/GEO or through the authorized builder SEO tools, not here: every save replaces this file. The managed helper
// src/lib/monstarx/seo.ts turns them into the <head> of every page, /robots.txt, /sitemap.xml and /llms.txt.

import type { SeoConfig } from '@/lib/monstarx/seo'

export const seo: SeoConfig = {
  "siteUrl": "",
  "siteName": "FitRoom",
  "defaultTitle": "FitRoom — Virtual Try-On Atelier",
  "titleTemplate": "%s · FitRoom",
  "defaultDescription": "FitRoom is a luxe virtual fitting room. Upload a selfie and any garment photo to generate a realistic AI try-on, compare with a before/after slider, and download your look. No sign-in needed.",
  "keywords": [],
  "locale": "en",
  "themeColor": "",
  "image": null,
  "imageAlt": "",
  "twitterSite": "",
  "twitterCard": "summary_large_image",
  "indexable": false,
  "robots": {
    "mode": "allow",
    "disallow": [],
    "aiCrawlers": "allow",
    "custom": ""
  },
  "sitemap": {
    "enabled": true,
    "exclude": [],
    "extra": []
  },
  "llms": {
    "enabled": true,
    "summary": "",
    "notes": ""
  },
  "organization": {
    "name": "FitRoom",
    "type": "Organization",
    "logo": null,
    "sameAs": [],
    "email": "",
    "phone": "",
    "address": ""
  },
  "verification": {
    "google": "",
    "bing": "",
    "yandex": "",
    "pinterest": ""
  },
  "faq": [],
  "pages": [
    {
      "path": "/",
      "title": "FitRoom — Virtual Try-On Atelier",
      "description": "Upload a selfie and a garment photo to generate a realistic AI try-on. Browse the luxe catalog, compare before/after, download and save your fits."
    },
    {
      "path": "/llms.txt"
    },
    {
      "path": "/robots.txt"
    },
    {
      "path": "/sitemap.xml"
    }
  ],
  "paths": [
    "/",
    "/llms.txt",
    "/robots.txt",
    "/sitemap.xml"
  ],
  "privatePaths": [
    "/"
  ]
}

export default seo
