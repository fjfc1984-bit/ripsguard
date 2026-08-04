import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ripsguard.com'
  const now = new Date()
  return [
    {
      url: baseUrl,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 1,
    },
    {
      url: baseUrl + '/register',
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.9,
    },
    {
      url: baseUrl + '/login',
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.8,
    },
    {
      url: baseUrl + '/forgot-password',
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ]
    }
