import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

export declare type Body = {
    [key: string]: any;
};

export declare type Headers = {
    [key: string]: any;
};

export declare type Params = {
    [key: string]: any;
};

export class HttpRequestBuilder {
    private axiosInstance: AxiosInstance;
    private config: AxiosRequestConfig;

    constructor(config: AxiosRequestConfig = {}) {
        if (!config.baseURL) {
            throw new Error('baseURL should be defined!');
        }
        this.config = {
            ...config,
        };
        this.axiosInstance = axios.create(this.config);
    }

    setHeaders(headers: Headers): HttpRequestBuilder {
        this.config.headers = headers;
        return this;
    }

    setParams(params: Params): HttpRequestBuilder {
        this.config.params = params;
        return this;
    }

    setBody(data: Body): HttpRequestBuilder {
        this.config.data = data;
        return this;
    }

    setMethod(method: string): HttpRequestBuilder {
        this.config.method = method;
        return this;
    }

    async execute<T>(): Promise<AxiosResponse<T>> {
        // eslint-disable-next-line no-useless-catch
        try {
            return await this.axiosInstance.request<T>(this.config);
        } catch (error) {
            throw error;
        }
    }
}
