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
    { name: "Listings", description: "Property CRUD (writes: owners/admins)" },
    { name: "Map", description: "Geospatial queries for the map view" },
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
