/**
 * Plesk & Phusion Passenger Entry Point for HKC-ERP-v5
 *
 * Boots the unified Express API & Static SPA Server located at ./server/index.js.
 * Ensures Plesk Node.js extension works seamlessly whether Application Startup File
 * is set to app.js, index.js, or server/index.js.
 */
import "./server/index.js"
export { default } from "./server/index.js"
