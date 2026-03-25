import type { OpenAPIV3 } from "openapi-types";

export const openApiSpec: OpenAPIV3.Document = {
  openapi: "3.0.3",
  info: {
    title: "Rentfit API",
    version: "0.1.0",
    description:
      'Backend for Rentfit AI (Express + MongoDB). JSON responses use `{ "success": true, "data": ... }` on success or `{ "success": false, "error": { "code", "message" } }` on failure (except `/openapi.json`, which returns the raw OpenAPI document). **POST /api/chat** streams the Vercel AI UI message protocol (not the JSON envelope); the client should use `@ai-sdk/react` `useChat` (or compatible) with `credentials: "include"`. Response includes **X-Chat-Id** when a session is created or continued. AI uses **OpenRouter** (OpenAI-compatible API at `OPENROUTER_BASE_URL`, default `https://openrouter.ai/api/v1`).',
  },
  servers: [
    {
      url: "/",
      description:
        "This server (use full URL in Try it out, e.g. http://localhost:3001)",
    },
  ],
  tags: [
    { name: "System", description: "Health and metadata" },
    {
      name: "Auth",
      description: "Email/password; JWT returned as HTTP-only cookie",
    },
    { name: "Listings", description: "Property CRUD (writes: owners/admins)" },
    { name: "Map", description: "Geospatial queries for the map view" },
    {
      name: "Chat",
      description:
        "OpenRouter-backed streaming chat; `search_listings` uses seeded service areas (Bangalore, Mumbai, Kolkata only). After each stream, UI messages are stored for `GET /api/chats/{id}`.",
    },
    {
      name: "Service areas",
      description:
        "Curated city and neighborhood centers (no external geocoding)",
    },
  ],
  paths: {
    "/health": {
      get: {
        tags: ["System"],
        summary: "Health check",
        operationId: "getHealth",
        responses: {
          "200": {
            description: "Service is running",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/HealthSuccess" },
              },
            },
          },
        },
      },
    },
    "/api": {
      get: {
        tags: ["System"],
        summary: "API metadata",
        operationId: "getApiMeta",
        responses: {
          "200": {
            description: "Service name and version",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ApiMetaSuccess" },
              },
            },
          },
        },
      },
    },
    "/openapi.json": {
      get: {
        tags: ["System"],
        summary: "OpenAPI document",
        operationId: "getOpenApiJson",
        responses: {
          "200": {
            description: "OpenAPI 3.0 JSON",
            content: {
              "application/json": {
                schema: { type: "object", additionalProperties: true },
              },
            },
          },
        },
      },
    },
    "/api/auth/register": {
      post: {
        tags: ["Auth"],
        summary: "Register",
        operationId: "authRegister",
        description:
          "Creates a user, hashes the password, and sets the session cookie. Self-registration is `renter` or `owner` only.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/RegisterRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Created; `Set-Cookie` contains the JWT",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthUserSuccess" },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
          "409": {
            description: "Email already registered",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
        },
      },
    },
    "/api/auth/login": {
      post: {
        tags: ["Auth"],
        summary: "Login",
        operationId: "authLogin",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/LoginRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "OK; `Set-Cookie` contains the JWT",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthUserSuccess" },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
          "401": {
            description: "Invalid credentials",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
        },
      },
    },
    "/api/auth/logout": {
      post: {
        tags: ["Auth"],
        summary: "Logout",
        operationId: "authLogout",
        description: "Clears the session cookie.",
        responses: {
          "200": {
            description: "Logged out",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/LogoutSuccess" },
              },
            },
          },
        },
      },
    },
    "/api/auth/me": {
      get: {
        tags: ["Auth"],
        summary: "Current user",
        operationId: "authMe",
        security: [{ sessionCookie: [] }],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/AuthUserSuccess" },
              },
            },
          },
          "401": {
            description: "Not authenticated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
        },
      },
    },
    "/api/chat": {
      post: {
        tags: ["Chat"],
        summary: "Stream AI chat (search + refine)",
        operationId: "postChat",
        description:
          "Streams the **Vercel AI SDK UI message protocol** (not `{ success, data }`). Use `@ai-sdk/react` `useChat` with the same `messages` shape. Optional session cookie: new chats are tied to the user when logged in. **Requires `OPENROUTER_API_KEY` on the server** (OpenRouter, OpenAI-compatible base URL). Response header **X-Chat-Id** is the Mongo chat document id—send as `chatId` on the next request. After the stream completes, messages are saved; reload via **`GET /api/chats/{id}`** (`data.chat.messages`).",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ChatRequest" },
            },
          },
        },
        responses: {
          "200": {
            description:
              "UI message stream (tool calls, text deltas). See Vercel AI SDK docs for the wire format.",
            headers: {
              "X-Chat-Id": {
                description:
                  "Chat session id (Mongo ObjectId); pass back as `chatId` in the body",
                schema: { type: "string" },
              },
            },
            content: {
              "text/event-stream": {
                schema: {
                  type: "string",
                  description: "Server-Sent Events stream (AI SDK UI protocol)",
                },
              },
            },
          },
          "400": {
            description: "Invalid body (e.g. missing `messages`)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
          "403": {
            description: "chatId belongs to another user",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
          "404": {
            description: "chatId not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
          "503": {
            description:
              "OpenRouter not configured (`OPENROUTER_API_KEY` missing)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
        },
      },
    },
    "/api/listings": {
      post: {
        tags: ["Listings"],
        summary: "Create listing",
        operationId: "createListing",
        description:
          "Owner or admin. Sets `location` as a GeoJSON Point (`coordinates`: [lng, lat]).",
        security: [{ sessionCookie: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/CreateListingRequest" },
            },
          },
        },
        responses: {
          "201": {
            description: "Created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ListingOneSuccess" },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
          "401": {
            description: "Not authenticated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
          "403": {
            description: "Not an owner/admin",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
        },
      },
    },
    "/api/listings/{id}": {
      get: {
        tags: ["Listings"],
        summary: "Get listing by id",
        operationId: "getListingById",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ListingOneSuccess" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
        },
      },
      put: {
        tags: ["Listings"],
        summary: "Update listing",
        operationId: "updateListing",
        description:
          "Owner of the listing or admin. Partial body; only provided fields are updated.",
        security: [{ sessionCookie: [] }],
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/UpdateListingRequest" },
            },
          },
        },
        responses: {
          "200": {
            description: "Updated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ListingOneSuccess" },
              },
            },
          },
          "400": {
            description: "Validation error",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
          "401": {
            description: "Not authenticated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
          "403": {
            description: "Cannot edit this listing",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
        },
      },
    },
    "/api/map/listings": {
      get: {
        tags: ["Map"],
        summary: "Listings in bounding box",
        operationId: "mapListingsInBbox",
        description:
          "Returns up to 200 **active** listings whose point lies inside the bbox. Query: `bbox=minLng,minLat,maxLng,maxLat`.",
        parameters: [
          {
            name: "bbox",
            in: "query",
            required: true,
            schema: { type: "string", example: "77.5,12.9,77.7,13.1" },
          },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ListingsMapSuccess" },
              },
            },
          },
          "400": {
            description: "Invalid bbox",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
        },
      },
    },
    "/api/chats": {
      get: {
        tags: ["Chat"],
        summary: "List my chat sessions",
        operationId: "listChats",
        description:
          "Requires login. Returns up to 50 chats for the current user, newest first.",
        security: [{ sessionCookie: [] }],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ChatListSuccess" },
              },
            },
          },
          "401": {
            description: "Not authenticated",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
        },
      },
    },
    "/api/chats/{id}": {
      get: {
        tags: ["Chat"],
        summary: "Get chat session (UI messages + search context)",
        operationId: "getChatById",
        description:
          "Anonymous chats (no `userId`) can be read by anyone with the id. User-owned chats require the same session cookie.",
        parameters: [
          {
            name: "id",
            in: "path",
            required: true,
            schema: { type: "string" },
          },
        ],
        responses: {
          "200": {
            description:
              "OK; `data.chat.messages` is the saved UI message array for `useChat` `initialMessages`",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ChatDetailSuccess" },
              },
            },
          },
          "400": {
            description: "Invalid id",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
          "403": {
            description: "Chat belongs to another user",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
          "404": {
            description: "Not found",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ErrorEnvelope" },
              },
            },
          },
        },
      },
    },
    "/api/service-areas": {
      get: {
        tags: ["Service areas"],
        summary: "List cities and neighborhoods",
        operationId: "listServiceAreas",
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ServiceAreasSuccess" },
              },
            },
          },
        },
      },
    },
  },
  components: {
    securitySchemes: {
      sessionCookie: {
        type: "apiKey",
        in: "cookie",
        name: "rentfit_session",
        description: "HTTP-only JWT set by register/login",
      },
    },
    schemas: {
      ErrorEnvelope: {
        type: "object",
        required: ["success", "error"],
        properties: {
          success: { type: "boolean", enum: [false] },
          error: {
            type: "object",
            required: ["code", "message"],
            properties: {
              code: {
                type: "string",
                description: "Stable code for clients",
                example: "VALIDATION_ERROR",
              },
              message: { type: "string", description: "Human-readable detail" },
            },
          },
        },
      },
      HealthSuccess: {
        type: "object",
        required: ["success", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          data: {
            type: "object",
            required: ["service"],
            properties: {
              service: { type: "string", example: "rentfit-v1-be" },
            },
          },
        },
      },
      ApiMetaSuccess: {
        type: "object",
        required: ["success", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          data: {
            type: "object",
            required: ["name", "version"],
            properties: {
              name: { type: "string", example: "rentfit-v1-be" },
              version: { type: "string", example: "0.1.0" },
            },
          },
        },
      },
      RegisterRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", format: "password", minLength: 8 },
          role: {
            type: "string",
            enum: ["renter", "owner"],
            description: "Defaults to renter when omitted",
          },
        },
      },
      LoginRequest: {
        type: "object",
        required: ["email", "password"],
        properties: {
          email: { type: "string", format: "email" },
          password: { type: "string", format: "password" },
        },
      },
      PublicUser: {
        type: "object",
        required: ["id", "email", "role", "createdAt"],
        properties: {
          id: { type: "string" },
          email: { type: "string", format: "email" },
          role: { type: "string", enum: ["renter", "owner", "admin"] },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      AuthUserSuccess: {
        type: "object",
        required: ["success", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          data: {
            type: "object",
            required: ["user"],
            properties: {
              user: { $ref: "#/components/schemas/PublicUser" },
            },
          },
        },
      },
      LogoutSuccess: {
        type: "object",
        required: ["success", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          data: {
            nullable: true,
            description: "Always `null` (no payload).",
          },
        },
      },
      ChatRequest: {
        type: "object",
        required: ["messages"],
        properties: {
          chatId: {
            type: "string",
            description:
              "Existing chat session id from `X-Chat-Id`; omit to create a new chat",
          },
          messages: {
            type: "array",
            description: "Full or incremental UI messages for the AI SDK",
            items: { $ref: "#/components/schemas/UIMessage" },
          },
        },
      },
      UIMessage: {
        type: "object",
        required: ["role", "parts"],
        properties: {
          id: { type: "string" },
          role: {
            type: "string",
            enum: ["user", "assistant", "system"],
          },
          parts: {
            type: "array",
            items: { $ref: "#/components/schemas/UIMessageTextPart" },
          },
        },
      },
      UIMessageTextPart: {
        type: "object",
        required: ["type", "text"],
        properties: {
          type: { type: "string", enum: ["text"] },
          text: { type: "string" },
        },
      },
      ChatSummary: {
        type: "object",
        required: ["id", "title", "createdAt"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          lastCitySlug: { type: "string" },
        },
      },
      ChatListSuccess: {
        type: "object",
        required: ["success", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          data: {
            type: "object",
            required: ["chats"],
            properties: {
              chats: {
                type: "array",
                items: { $ref: "#/components/schemas/ChatSummary" },
              },
            },
          },
        },
      },
      ChatDetailPayload: {
        type: "object",
        required: ["id", "title", "createdAt", "messages"],
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          userId: { type: "string" },
          lastCitySlug: { type: "string" },
          lastFilters: { type: "object", additionalProperties: true },
          lastListingIds: { type: "array", items: { type: "string" } },
          messages: {
            type: "array",
            description: "Vercel AI UI messages for replay",
            items: { type: "object", additionalProperties: true },
          },
        },
      },
      ChatDetailSuccess: {
        type: "object",
        required: ["success", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          data: {
            type: "object",
            required: ["chat"],
            properties: {
              chat: { $ref: "#/components/schemas/ChatDetailPayload" },
            },
          },
        },
      },
      ServiceAreaRow: {
        type: "object",
        required: [
          "id",
          "citySlug",
          "kind",
          "name",
          "aliases",
          "location",
          "radiusMeters",
        ],
        properties: {
          id: { type: "string" },
          citySlug: {
            type: "string",
            enum: ["bangalore", "mumbai", "kolkata"],
          },
          kind: { type: "string", enum: ["city", "neighborhood"] },
          name: { type: "string" },
          aliases: { type: "array", items: { type: "string" } },
          location: { $ref: "#/components/schemas/GeoPoint" },
          radiusMeters: { type: "number" },
        },
      },
      ServiceAreasSuccess: {
        type: "object",
        required: ["success", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          data: {
            type: "object",
            required: ["areas"],
            properties: {
              areas: {
                type: "array",
                items: { $ref: "#/components/schemas/ServiceAreaRow" },
              },
            },
          },
        },
      },
      GeoPoint: {
        type: "object",
        required: ["type", "coordinates"],
        properties: {
          type: { type: "string", enum: ["Point"] },
          coordinates: {
            type: "array",
            minItems: 2,
            maxItems: 2,
            items: { type: "number" },
            description: "[longitude, latitude]",
          },
        },
      },
      Address: {
        type: "object",
        properties: {
          text: { type: "string" },
          locality: { type: "string" },
          city: { type: "string" },
        },
      },
      AiInsights: {
        type: "object",
        properties: {
          pros: { type: "array", items: { type: "string" } },
          cons: { type: "array", items: { type: "string" } },
          trustScore: { type: "number", minimum: 0, maximum: 100 },
          dealQuality: {
            type: "string",
            enum: ["Great", "Fair", "Overpriced"],
          },
        },
      },
      Listing: {
        type: "object",
        required: [
          "id",
          "ownerId",
          "title",
          "description",
          "price",
          "type",
          "location",
          "amenities",
          "images",
          "status",
          "createdAt",
        ],
        properties: {
          id: { type: "string" },
          ownerId: { type: "string" },
          title: { type: "string" },
          description: { type: "string" },
          price: { type: "number" },
          type: { type: "string" },
          location: { $ref: "#/components/schemas/GeoPoint" },
          address: { $ref: "#/components/schemas/Address" },
          amenities: { type: "array", items: { type: "string" } },
          images: { type: "array", items: { type: "string" } },
          aiInsights: { $ref: "#/components/schemas/AiInsights" },
          status: { type: "string", enum: ["active", "rented", "pending"] },
          createdAt: { type: "string", format: "date-time" },
        },
      },
      CreateListingRequest: {
        type: "object",
        required: ["title", "description", "price", "type", "location"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          price: { type: "number", minimum: 0, exclusiveMinimum: true },
          type: { type: "string", example: "2BHK" },
          location: {
            type: "object",
            required: ["coordinates"],
            properties: {
              coordinates: {
                type: "array",
                minItems: 2,
                maxItems: 2,
                items: { type: "number" },
              },
            },
          },
          address: { $ref: "#/components/schemas/Address" },
          amenities: { type: "array", items: { type: "string" } },
          images: { type: "array", items: { type: "string" } },
        },
      },
      UpdateListingRequest: {
        type: "object",
        description: "At least one field required",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          price: { type: "number", minimum: 0, exclusiveMinimum: true },
          type: { type: "string" },
          location: {
            type: "object",
            required: ["coordinates"],
            properties: {
              coordinates: {
                type: "array",
                minItems: 2,
                maxItems: 2,
                items: { type: "number" },
              },
            },
          },
          address: { $ref: "#/components/schemas/Address" },
          amenities: { type: "array", items: { type: "string" } },
          images: { type: "array", items: { type: "string" } },
          status: { type: "string", enum: ["active", "rented", "pending"] },
        },
      },
      ListingOneSuccess: {
        type: "object",
        required: ["success", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          data: {
            type: "object",
            required: ["listing"],
            properties: {
              listing: { $ref: "#/components/schemas/Listing" },
            },
          },
        },
      },
      ListingsMapSuccess: {
        type: "object",
        required: ["success", "data"],
        properties: {
          success: { type: "boolean", enum: [true] },
          data: {
            type: "object",
            required: ["listings", "count"],
            properties: {
              listings: {
                type: "array",
                items: { $ref: "#/components/schemas/Listing" },
              },
              count: { type: "integer", minimum: 0 },
            },
          },
        },
      },
    },
  },
};
