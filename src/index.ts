import { R2ListOptions } from "@cloudflare/workers-types";
import { Hono } from "hono";
import { env } from "hono/adapter";
import { bodyLimit } from "hono/body-limit";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { validator } from "hono/validator";

const BASE_URL = "https://resource.jweboy.asia";

const app = new Hono();

app.use(logger());
app.use("/*", cors());

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

app.get("/list", async (c) => {
  const query = c.req.query();
  const { MY_BUCKET } = env<{ MY_BUCKET: R2Bucket }>(c);
  const options: R2ListOptions = {
    limit: 1000,
    delimiter: "/",
    prefix: query.catalog,
  };
  const listing = await MY_BUCKET.list(options);
  return c.json({ data: listing, code: 0 });
});

app.post(
  "/",
  validator("form", (value, c) => {
    const file = value["file"];
    const catalog = value["catalog"];
    if (!file) {
      return c.json(
        {
          data: null,
          msg: "Oh no, that's too bad :(, missing file field.",
          success: false,
        },
        200
      );
    }
    return {
      file,
      catalog: catalog || "",
    };
  }),
  bodyLimit({
    maxSize: 1024 * 1024, // 1M
    onError: (c) => {
      return c.json({
        data: null,
        msg: "Oh no, that's too bad :(, it exceeded the 1M size limit. ",
        success: false,
      });
    },
  }),
  async (c) => {
    const body = c.req.valid("form");
    const file = body.file as File;
    const catalog = body.catalog as string;
    const key = !!catalog ? `${catalog}/${file.name}` : file.name;
    const { MY_BUCKET } = env<{ MY_BUCKET: R2Bucket }>(c);

    try {
      const data = await MY_BUCKET.put(key, file);
      if (data != null) {
        const res = {
          ...data,
          url: `${BASE_URL}/${data.key}`,
        };
        return c.json({ success: true, data: res });
      } else {
        c.json({
          data: "Oh no, upload failed, please try again later",
          success: false,
        });
      }
    } catch (error: any) {
      c.json({ data: error.message, success: false });
    }
  }
);

export default app;
