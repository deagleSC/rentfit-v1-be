import type { OpenAPIV3 } from "openapi-types";

export const openApiSpec: OpenAPIV3.Document = {
  openapi: "3.0.3",
  info: {
    title: "Rentfit API",
    version: "0.1.0",
    description:
      'Backend for Rentfit AI (Express + MongoDB). JSON responses use `{ "success": true, "data": ... }` on success or `{ "success": false, "error": { "code", "message" } }` on failure (except `/openapi.json`, which returns the raw OpenAPI document).',
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
    { name: "Listings", description: "Planned: CRUD and supply-side flows" },
    { name: "Map", description: "Planned: bbox geospatial queries" },
    { name: "Chat", description: "Planned: AI streaming" },
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
    },
  },
};
