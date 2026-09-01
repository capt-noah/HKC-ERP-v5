import express from "express"
import cors from "cors"
import { assertConfig } from "../server/config.js"
import { masterRouter } from "../server/router/index.js"

try {
  assertConfig()
} catch (err) {
  console.warn("Vercel env assertion warning:", err)
}

const app = express()

// 1. CORS First
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "apikey",
      "prefer",
      "x-client-info",
      "Cache-Control",
      "Pragma",
      "If-None-Match",
    ],
    exposedHeaders: ["Content-Length", "Content-Range", "Content-Type", "Authorization"],
    credentials: true,
    maxAge: 86400,
    optionsSuccessStatus: 204,
  })
)

// 2. Middleware
app.use(express.json({ limit: "10mb" }))

// 3. Normalize URL prefix for Vercel serverless routing
app.use((req, _res, next) => {
  if (!req.url.startsWith("/api") && !req.url.startsWith("/health")) {
    req.url = `/api${req.url}`
  }
  next()
})

app.use("/", masterRouter)

export default app
