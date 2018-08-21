import colorize from "./util/colorize"
import { MiddlewareStack } from "./middleware-stack"
import { ILogger } from "./logger"
import { JsonapiResponseDoc, JsonapiRequestDoc } from "./jsonapi-spec"

export type RequestVerbs = keyof Request

export interface JsonapiResponse extends Response {
  jsonPayload: JsonapiResponseDoc
}

export class Request {
  middleware: MiddlewareStack
  private logger: ILogger

  constructor(middleware: MiddlewareStack, logger: ILogger) {
    this.middleware = middleware
    this.logger = logger
  }

  get(url: string, options: RequestInit): Promise<any> {
    options.method = "GET"
    return this._fetchWithLogging(url, options)
  }

  post(
    url: string,
    payload: JsonapiRequestDoc,
    options: RequestInit
  ): Promise<any> {
    options.method = "POST"
    options.body = JSON.stringify(payload)

    return this._fetchWithLogging(url, options)
  }

  patch(
    url: string,
    payload: JsonapiRequestDoc,
    options: RequestInit
  ): Promise<any> {
    options.method = "PATCH"
    options.body = JSON.stringify(payload)

    return this._fetchWithLogging(url, options)
  }

  delete(url: string, options: RequestInit): Promise<any> {
    options.method = "DELETE"
    return this._fetchWithLogging(url, options)
  }

  // private

  private _logRequest(verb: string, url: string): void {
    this.logger.info(colorize("cyan", `${verb}: `) + colorize("magenta", url))
  }

  private _logResponse(responseJSON: string): void {
    this.logger.debug(colorize("bold", JSON.stringify(responseJSON, null, 4)))
  }

  private _logInvalidJSON(response : Response) : void {
    this.logger.debug(`Invalid Response JSON: ${response.clone().text()}`)
  }

  private async _fetchWithLogging(
    url: string,
    options: RequestInit
  ): Promise<any> {
    this._logRequest(options.method || "UNDEFINED METHOD", url)

    const response = await this._fetch(url, options)

    this._logResponse(response.jsonPayload)

    return response
  }

  private async _fetch(url: string, options: RequestInit): Promise<any> {
    try {
      this.middleware.beforeFetch(url, options)
    } catch (e) {
      throw new RequestError(
        "beforeFetch failed; review middleware.beforeFetch stack",
        url,
        options,
        e
      )
    }

    let response

    try {
      response = await fetch(url, options)
    } catch (e) {
      throw new ResponseError(null, e.message, e)
    }

    await this._handleResponse(response, options)

    return response
  }

  private async _handleResponse(
    response: Response,
    requestOptions: RequestInit
  ) {
    let wasDelete =
      requestOptions.method === "DELETE" &&
      [202, 204, 200].indexOf(response.status) > -1
    if (wasDelete) return

    let json
    try {
      json = await response.clone().json()
    } catch (e) {
      this._logInvalidJSON(response)

      throw new ResponseError(response, `invalid json: ${json}`, e)
    }

    try {
      this.middleware.afterFetch(response, json)
    } catch (e) {
      // afterFetch middleware failed
      throw new ResponseError(
        response,
        "afterFetch failed; review middleware.afterFetch stack",
        e
      )
    }

    if (response.status >= 500) {
      throw new ResponseError(response, "Server Error")
      // Allow 422 since we specially handle validation errors
    } else if (response.status !== 422 && json.data === undefined) {
      if (response.status === 404) {
        throw new ResponseError(response, "record not found")
      } else {
        // Bad JSON, for instance an errors payload
        this._logInvalidJSON(response)
        throw new ResponseError(response, "invalid json")
      }
    }

    ;(<any>response).jsonPayload = json
  }
}

class RequestError extends Error {
  url: string
  options: RequestInit
  originalError: Error

  constructor(
    message: string,
    url: string,
    options: RequestInit,
    originalError: Error
  ) {
    super(message)
    this.stack = originalError.stack
    this.url = url
    this.options = options
    this.originalError = originalError
  }
}

class ResponseError extends Error {
  response: Response | null
  originalError: Error | undefined

  constructor(
    response: Response | null,
    message?: string,
    originalError?: Error
  ) {
    super(message || "Invalid Response")
    this.response = response
    this.originalError = originalError
  }
}
