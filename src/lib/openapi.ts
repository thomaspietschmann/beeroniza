import { env } from "./env";

// OpenAPI 3.1 description of the public REST API. Served at
// /api/v1/openapi.json and rendered as classic docs at /api-docs. Designed so
// LLM agents / tools can consume it directly to discover templates, upload
// images and generate banners.
export function buildOpenApiSpec() {
  return {
    openapi: "3.1.0",
    info: {
      title: "Beeroniza API",
      version: "1.0.0",
      description:
        "Generate images from visual templates. Authenticate with an API key " +
        "(Authorization: Bearer <key>). Image generation is asynchronous: submit " +
        "a job, then poll the generation or receive a webhook. To use an image in " +
        "a template, either pass a public `image_url`, an inline `data:image/...;base64,` " +
        "URL, or upload bytes via POST /api/v1/uploads and use the returned URL.",
    },
    servers: [{ url: env.appUrl }],
    security: [{ bearerAuth: [] }],
    paths: {
      "/api/v1/templates": {
        get: {
          summary: "List templates",
          description:
            "Lists templates available to this API key, including each template's " +
            "placeholders so you know what you can fill in.",
          security: [{ bearerAuth: [] }],
          responses: {
            "200": {
              description: "Templates",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      templates: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Template" },
                      },
                    },
                  },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
      "/api/v1/images": {
        post: {
          summary: "Generate an image (async)",
          description:
            "Submits a render job. Returns 202 with the generation in status " +
            "\"queued\". Poll GET /api/v1/images/{id} until status is \"completed\" " +
            "(then `image_url` is set) or \"failed\", or supply `webhook_url` to be " +
            "notified.",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/GenerateRequest" },
                examples: {
                  basic: {
                    summary: "Fill a title and a circular avatar",
                    value: {
                      template_id: "ckxyz123",
                      modifications: [
                        { name: "title", text: "Hello from an AI agent" },
                        { name: "author_name", text: "Ada Lovelace" },
                        {
                          name: "avatar",
                          image_url: "https://example.com/ada.png",
                          focal_point: { x: 0.5, y: 0.35 },
                        },
                        { name: "background", color: "#0b0b1a" },
                      ],
                      format: "png",
                    },
                  },
                  inlineImage: {
                    summary: "Send the avatar inline as a data URL",
                    value: {
                      template_id: "ckxyz123",
                      modifications: [
                        { name: "title", text: "Inline image" },
                        { name: "avatar", image_url: "data:image/png;base64,iVBORw0KGgo..." },
                      ],
                    },
                  },
                },
              },
            },
          },
          responses: {
            "202": {
              description: "Generation queued",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Generation" },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { description: "Template not found" },
          },
        },
      },
      "/api/v1/images/{id}": {
        get: {
          summary: "Get a generation",
          description: "Poll a generation's status and result.",
          security: [{ bearerAuth: [] }],
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
              description: "Generation",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Generation" },
                },
              },
            },
            "401": { $ref: "#/components/responses/Unauthorized" },
            "404": { description: "Not found" },
          },
        },
      },
      "/api/v1/uploads": {
        post: {
          summary: "Upload an image",
          description:
            "Upload image bytes and receive a URL usable as an `image_url` in a " +
            "modification. Accepts multipart/form-data (field \"file\") or JSON " +
            "{ file_base64, mime_type }.",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "multipart/form-data": {
                schema: {
                  type: "object",
                  properties: { file: { type: "string", format: "binary" } },
                  required: ["file"],
                },
              },
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    file_base64: { type: "string" },
                    mime_type: { type: "string", default: "image/png" },
                  },
                  required: ["file_base64"],
                },
              },
            },
          },
          responses: {
            "201": {
              description: "Uploaded",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      url: { type: "string", format: "uri" },
                    },
                  },
                },
              },
            },
            "400": { $ref: "#/components/responses/BadRequest" },
            "401": { $ref: "#/components/responses/Unauthorized" },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "An API key created in the dashboard, sent as a Bearer token.",
        },
      },
      responses: {
        Unauthorized: { description: "Invalid or missing API key" },
        BadRequest: { description: "Invalid request" },
      },
      schemas: {
        Placeholder: {
          type: "object",
          properties: {
            key: { type: "string", description: "Use this as `name` in a modification." },
            type: { type: "string", enum: ["text", "image", "color"] },
            label: { type: "string" },
            defaultValue: { type: "string" },
          },
          required: ["key", "type"],
        },
        Template: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            width: { type: "integer" },
            height: { type: "integer" },
            placeholders: {
              type: "array",
              items: { $ref: "#/components/schemas/Placeholder" },
            },
          },
        },
        Modification: {
          type: "object",
          description:
            "Overrides one placeholder layer. Set the field matching the " +
            "placeholder's type: `text` for text, `image_url` for image, `color` for color.",
          properties: {
            name: { type: "string", description: "The placeholder key." },
            text: { type: "string" },
            image_url: {
              type: "string",
              description: "Public http(s) URL or an inline data:image/...;base64 URL.",
            },
            color: { type: "string", description: "Hex color, e.g. #0b0b1a." },
            focal_point: {
              type: "object",
              description:
                "Optional normalized focal point (0..1) of the image — e.g. a face. " +
                "When set, cover-cropping keeps this point centered and in view " +
                "(\"face gravity\") instead of cropping around the geometric center. " +
                "Only applies to image_url.",
              properties: {
                x: { type: "number", minimum: 0, maximum: 1 },
                y: { type: "number", minimum: 0, maximum: 1 },
              },
              required: ["x", "y"],
            },
          },
          required: ["name"],
        },
        GenerateRequest: {
          type: "object",
          properties: {
            template_id: { type: "string" },
            modifications: {
              type: "array",
              items: { $ref: "#/components/schemas/Modification" },
            },
            format: { type: "string", enum: ["png", "jpg", "webp"], default: "png" },
            webhook_url: {
              type: "string",
              format: "uri",
              description: "Optional. POSTed { id, status, url } when the job finishes.",
            },
          },
          required: ["template_id"],
        },
        Generation: {
          type: "object",
          properties: {
            id: { type: "string" },
            status: {
              type: "string",
              enum: ["queued", "processing", "completed", "failed"],
            },
            template_id: { type: "string" },
            width: { type: "integer" },
            height: { type: "integer" },
            format: { type: "string" },
            image_url: {
              type: ["string", "null"],
              description: "Set once status is \"completed\".",
            },
            error: { type: ["string", "null"] },
            created_at: { type: "string", format: "date-time" },
            completed_at: { type: ["string", "null"], format: "date-time" },
          },
        },
      },
    },
  } as const;
}
