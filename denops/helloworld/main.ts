import { Denops } from "https://deno.land/x/denops_std@v1.0.0/mod.ts";
import { ensureString } from "https://deno.land/x/unknownutil@v1.0.0/mod.ts";
import {
  createApp,
  serveStatic,
} from "https://deno.land/x/servest@v1.3.1/mod.ts";
import { fromFileUrl } from "https://deno.land/std@0.105.0/path/mod.ts";
import { create_index_html } from "./server.ts";
import type { WebSocket } from "https://deno.land/std@0.105.0/ws/mod.ts";

export async function main(denops: Denops): Promise<void> {
  // denopsコマンドを定義
  await denops.cmd(
    `command! Up call denops#request('${denops.name}', 'startServer', [])`,
  );

  // dispatcherを定義
  denops.dispatcher = {
    async echo(text: unknown): Promise<unknown> {
      ensureString(text);
      return await Promise.resolve(text);
    },
    async startServer(): Promise<unknown> {
      // サーバを立てる
      const app = createApp();

      // index.htmlにアクセスされたときだけはbodyHTMLを返す
      const index_url = new URL("./index.html", import.meta.url);
      const bodyHTML = Deno.readTextFileSync(fromFileUrl(index_url));
      app.get("/", async (req) => {
        await req.respond({
          status: 200,
          headers: new Headers({
            "content-type": "text/html",
          }),
          body: bodyHTML,
        });
      });

      // それ以外のときはstaticの中身をそのまま返す
      let misc_url = new URL("./static", import.meta.url);
      let misc_root_directory = fromFileUrl(misc_url);
      app.use(serveStatic(misc_root_directory));
      app.listen({ port: 8899 });

      // websocketサーバを立てる
      const ws_app = createApp();
      ws_app.ws("/ws", handleHandShake);
      ws_app.listen({ port: 8900 });

      function handleHandShake(sock: WebSocket) {
        async function handleMessage(sock: WebSocket) {
          for await (const msg of sock) {
            if (typeof msg === "string") {
              let bufferContentList =
                (await denops.eval("getline(1, '$')")) as [
                  string,
                ];
              var bufferContent = bufferContentList.map((x) =>
                '<p class="honbun">' + pixivFormatter(x) + "</p>"
              ).join(
                "",
              );
              sock.send(bufferContent);
            }
          }
        }
        handleMessage(sock);
      }
      return await Promise.resolve();
    },
  };
}

function pixivFormatter(x: string) {
  //ルビ記法をHTMLに変換
  x = x.replace(
    /\[\[rb:(.*) > (.*)\]\]/g,
    "<ruby>$1<rt>$2</rt></ruby>",
  );
  return x;
}
