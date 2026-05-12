/*
this file establish communication from the frontend to backend

what it does:
    - communicate with backend api
    - build request urls
    - send authentication cookies
    - serialize json
    -error handling

*/


//standardize api result wrapper
export interface ApiResult<T> {
    data: T | null;
    error: ApiError | null;
}

//standardize error shape across frontend
export interface ApiError {
    message: string;
    status: number;
    raw?: unknown;
}

//supported http request methods 
type HttpMethod = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

//optional configuration passed into each request
interface RequestOptions {

    //query params appended to the url
    params?: Record<string, string | number | boolean>;

    //Request body for POST/PATCH/PUT requests
    body?: unknown;

    //Override browser cache behavior
    cache?: RequestCache;

    //extra headers merged with defaults
    headers?: Record<string, string>

    //override revalidation time in seconds
    revalidate?: number;

}


/*
central request function used by all api helpers

responsibilities:
    - build the final request url
    - attach query params
    - attach auth cookies
    - serialize json bodies
    - normalize backend errors
    - parse json responses
*/

async function request<T>(
  method: HttpMethod,
  path: string,
  options: RequestOptions = {}
): Promise<ApiResult<T>> {

  try {

    // Base backend url from environment variable
    // Falls back to localhost during development
    const baseUrl =
      process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";


    // ── Build final url ─────────────────────────────────────────────────────

    let url = `${baseUrl}${path}`;

    // Append query string if params exist
    if (options.params && Object.keys(options.params).length > 0) {

      const qs = new URLSearchParams(

        // URLSearchParams only accepts strings
        // Convert every value to a string first
        Object.entries(options.params).reduce(
          (acc, [k, v]) => ({
            ...acc,
            [k]: String(v),
          }),
          {} as Record<string, string>
        )

      ).toString();

      url = `${url}?${qs}`;
    }


    // ── Build request headers ───────────────────────────────────────────────

    const headers: Record<string, string> = {

      // Backend expects json requests
      "Content-Type": "application/json",

      // Allow callers to override/add headers
      ...options.headers,
    };


    // ── Execute request ────────────────────────────────────────────────────

    const response = await fetch(url, {
      method,
      headers,

      // Required so the browser sends the HttpOnly session cookie
      credentials: "include",

      // Only attach a body if one exists
      body:
        options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,

      // Next.js cache revalidation config
      next: options.revalidate
        ? { revalidate: options.revalidate }
        : undefined,

      cache: options.cache,
    });


    // ── Handle failed responses ────────────────────────────────────────────

    if (!response.ok) {

      let message = `Request failed with status ${response.status}`;

      try {

        // Attempt to extract backend error message
        const errBody = await response.json();

        message =
          errBody.error ??
          errBody.message ??
          message;

      } catch {

        // Ignore json parsing failure
        // Keep fallback message instead
      }

      return {
        data: null,
        error: {
          message,
          status: response.status,
        },
      };
    }


    // ── Handle empty responses ─────────────────────────────────────────────

    // 204 means success with no response body
    if (response.status === 204) {
      return {
        data: null,
        error: null,
      };
    }


    // ── Parse successful json response ─────────────────────────────────────

    const data = (await response.json()) as T;

    return {
      data,
      error: null,
    };

  } catch (err) {

    // Network failure, CORS issue, or backend unreachable
    return {
      data: null,
      error: {
        message:
          err instanceof Error
            ? err.message
            : "Network error — is the server running?",
        status: 0,
        raw: err,
      },
    };
  }
}


/*
small helper wrappers around request

what it does:
    - avoid http method repetiton everywhere
    - provide the app a clean api surface
*/
export const api = {

    get: <T>(
        path: string,
        options?: RequestOptions
    ) => request<T>("GET", path, options),

    post: <T>(
        path: string,
        body?: unknown,
        options?: RequestOptions
    ) => request<T>("POST", path, {
        ...options,
        body,
    }),

    patch: <T>(
        path: string,
        body?: unknown,
        options?: RequestOptions
    ) => request<T>("PATCH", path, {
        ...options,
        body,
    }),

    delete: <T>(
        path: string,
        options?: RequestOptions
    ) => request<T>("DELETE", path, options),
};