/**
 * Service for Zendesk Help Center articles
 */
import { isAxiosError } from "axios";
import { BaseService } from "./base-service.js";
import {
  ZendeskArticle,
  ZendeskSearchResponse,
  ZendeskArticleResponse,
  ArticleSearchParams,
  ArticleGetParams
} from "../types/article.types.js";
import { ZendeskConfig } from "../types/config.types.js";
import { cleanHtmlContent } from "../utils/html-cleaner.js";

/**
 * Service class for Zendesk Help Center articles
 */
export class ArticleService extends BaseService {
  private defaultLocale: string;

  /**
   * Creates a new ArticleService instance
   * @param config Zendesk API configuration
   */
  constructor(config: ZendeskConfig) {
    super(config);
    this.defaultLocale = config.defaultLocale || "en";
  }

  /**
   * Search for articles in Zendesk Help Center
   * @param params Search parameters including query, locale, page, and per_page
   * @returns Search results with filtered article data
   */
  async searchArticles(params: ArticleSearchParams): Promise<ZendeskSearchResponse> {
    const { query, locale = this.defaultLocale, page = 1, per_page = 20 } = params;
    const searchUrl = `/help_center/articles/search.json`;

    const data = await this.makeRequest<ZendeskSearchResponse>(searchUrl, {
      query,
      locale,
      page,
      per_page,
    });

    // Filter results to only include specified fields
    if (data.results && Array.isArray(data.results)) {
      data.results = data.results.map((article: ZendeskArticle) => {
        // Only keep the specified fields
        const filteredArticle: Partial<ZendeskArticle> = {
          id: article.id,
          url: article.url,
          html_url: article.html_url,
          author_id: article.author_id,
          created_at: article.created_at,
          updated_at: article.updated_at,
          title: article.title,
          label_names: article.label_names,
        };
        return filteredArticle as ZendeskArticle;
      });
    }

    return data;
  }

  /**
   * Fetch a single article from the Zendesk API using the locale in the URL path.
   * The Zendesk Help Center API requires the locale as part of the path:
   * /help_center/{locale}/articles/{id}.json
   * @param id Article ID
   * @param locale Locale code to use in the URL path
   * @returns Raw article response
   */
  private async fetchArticle(id: number, locale: string): Promise<ZendeskArticleResponse> {
    const articleUrl = `/help_center/${locale}/articles/${id}.json`;
    return this.makeRequest<ZendeskArticleResponse>(articleUrl);
  }

  /**
   * Get detailed information about a specific article.
   * If the request fails with 404 and the locale is not 'es-419', retries automatically
   * with 'es-419' (Latin American Spanish), which is the locale used by Buk articles.
   * @param params Parameters including article ID and locale
   * @returns Article data with cleaned HTML content
   */
  async getArticle(params: ArticleGetParams): Promise<ZendeskArticleResponse> {
    const { id, locale = this.defaultLocale } = params;

    let data: ZendeskArticleResponse;
    try {
      data = await this.fetchArticle(id, locale);
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404 && locale !== 'es-419') {
        // Retry with es-419 (Latin American Spanish) — the locale used by Buk articles
        data = await this.fetchArticle(id, 'es-419');
      } else {
        throw error;
      }
    }

    // Filter article to only include specified fields
    if (data.article) {
      const filteredArticle: Partial<ZendeskArticle> = {
        id: data.article.id,
        url: data.article.url,
        html_url: data.article.html_url,
        author_id: data.article.author_id,
        created_at: data.article.created_at,
        updated_at: data.article.updated_at,
        title: data.article.title,
        label_names: data.article.label_names,
        body: cleanHtmlContent(data.article.body),
      };

      data.article = filteredArticle as ZendeskArticle;
    }

    return data;
  }
}
