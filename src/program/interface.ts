/**
 * Default client node port
 */
export const PORT = 12080
/**
 * Default express port for console manager connect to
 */
export const WebPORT = 11080

/**
 * The upper limit for each message box can hold
 */
export const MESSAGE_LIMIT = 500
/**
 * The client node update tick, this will have effect on resource query.
 */
export const CLIENT_UPDATETICK = 3000
/**
 * The server side update tick, this will have effect on the time gap between task sending
 */
export const RENDER_UPDATETICK = 30
export const RENDER_FILE_UPDATETICK = 5000

/**
 * The environment character for replacing text
 */
export const ENV_CHARACTER = '%'


export * from './interface/base'
export * from './interface/bus'
export * from './interface/enum'
export * from './interface/execute'
export * from './interface/record'
export * from './interface/struct'
export * from './interface/table'
export * from './interface/ui'

