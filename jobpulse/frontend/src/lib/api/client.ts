/*
this file establish communication from the frontend to backend

what it does:
    - communicate with backend api
    - build request urls
    - send authentication cookies
    - serialize json
    -error handling

*/


/*
Every API response is wrapped in this shape.
Success:  { data: T, error: null } or Failure:  { data: null, error: ApiError }
*/
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
    params?: Record<string, string | number | boolean | null | undefined>;

    //Request body for POST/PATCH/PUT requests
    body?: unknown;

    //Override browser cache behavior
    cache?: RequestCache;

    //extra headers merged with defaults
    headers?: Record<string, string>

    //override revalidation time in seconds
    revalidate?: number;

    credentials?: RequestCredentials;
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
    const baseUrl = 
      process.env.NODE_ENV === "production"
        ? ""
        : (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001");

    //prevent double slashes  example: http://localhost:3001//api/dashboard
    const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

    const normalizedPath = path.startsWith("/") ? path : `/${path}`;

    // ── Build final url ─────────────────────────────────────────────────────

    let url = `${normalizedBaseUrl}${normalizedPath}`;

    // Append query string if params exist
    if (options.params) {

      const queryParams: Record<string, string> = {};

      for (const [key, value] of Object.entries(options.params)) {

        // skip undefined/null params
        if (value !== undefined && value !== null) {
          queryParams[key] = String(value);
        }
      }

      const qs = new URLSearchParams(queryParams).toString();

      if (qs) {
        url = `${url}?${qs}`;
      }
    }


    // ── Build request headers ───────────────────────────────────────────────

    const headers: Record<string, string> = {

      // Allow callers to override/add headers
      ...options.headers,
    };

    if(options.body !== undefined) {
      // Backend expects json requests
      headers["Content-Type"] = "application/json";
    }

    //timeout to prevent it from hanging indefinitely
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, 15000);

    // ── Execute request ────────────────────────────────────────────────────

    try {
      
      const response = await fetch(url, {
        method,
        headers,

        // Required so the browser sends the HttpOnly session cookie
        credentials: options.credentials ?? "include",

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

        signal: controller.signal
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

    } finally {

      //clear timeout
      clearTimeout(timeout);
    }
  
  } catch (err) {

    // timeout-specific handling
    if (err instanceof Error && err.name === "AbortError") {

      return {
        data: null,
        error: {
          message: "Request timed out",
          status: 408,
          raw: err,
        },
      };
    } 

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


/*
adapter function for use with swr

SWR expects:
    - a function that returns data
    - or throws an error

this converts api.get()
into SWR-compatible behavior
*/

export async function swrFetcher<T>(path: string): Promise<T> {
  
    const {data, error} = await api.get<T>(path);

    if (error){

      const err = new Error(error.message) as Error & { status: number };
      err.status = error.status;

      if (error.status === 401 || error.status === 403){
        throw err;
      }

      if (error.status === 0) {
        throw err;
      }
      
      throw err;
    }

    return data as T;
}