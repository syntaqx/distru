import type { MetadataRoute } from "next";

/**
 * This is a portfolio/demo recreation of Distru, not a real product on the open
 * internet - so tell every crawler to stay out entirely.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
