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
