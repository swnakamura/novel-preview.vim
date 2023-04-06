import { Denops } from "https://deno.land/x/denops_std@v1.0.0/mod.ts";
import { ensureString } from "https://deno.land/x/unknownutil@v1.0.0/mod.ts";
import * as vars from "https://deno.land/x/denops_std@v3.9.1/variable/mod.ts";
import * as helper from "https://deno.land/x/denops_std@v3.9.1/helper/mod.ts";
import * as autocmd from "https://deno.land/x/denops_std@v3.9.1/autocmd/mod.ts";
import * as fn from "https://deno.land/x/denops_std@v3.9.1/function/mod.ts";
import * as opts from "https://deno.land/x/denops_std@v3.9.1/option/mod.ts";
import { fromFileUrl } from "https://deno.land/std@0.105.0/path/mod.ts";
import { serve } from "https://deno.land/std@0.114.0/http/server.ts";
import { readFile } from "node:fs/promises";
import type { WebSocket } from "https://deno.land/std@0.105.0/ws/mod.ts";

// 最後に通信してきたクライアントを覚えておくための変数
// このクライアントのみに返信するので、タブやウィンドウを複数開くと一つにしか返信されないがこれは仕様
// クソ雑実装だが自分しか使わないのでまあいいだろう
let lastSocket: globalThis.WebSocket | undefined = undefined;

interface Content {
  bufferLines: Array<string>;
  curPos: Array<number>;
}

interface PreviewSetting {
  charperline: number;
  height: number;
}

interface Message {
  isChanged: null | string;
  content: null | Content;
  settings: null | PreviewSetting;
}

// 最後に送信したメッセージを覚えておくための変数
let previousContent: Content = {
  bufferLines: [],
  curPos: [],
};

export async function main(denops: Denops): Promise<void> {
  // denopsコマンドを定義
  await denops.cmd(
    `command! NovelPreviewStartServer call denops#request('${denops.name}', 'startServer', [])`,
  );
  await denops.cmd(
    `command! NovelPreviewSend call denops#request('${denops.name}', 'sendBuffer', [])`,
  );
  await denops.cmd(
    `command! NovelPreviewUpdateSetting call denops#request('${denops.name}', 'sendNewSettings', [])`,
  );
  // dispatcherを定義
  denops.dispatcher = {
    // example dispatcher
    async echo(text: unknown): Promise<unknown> {
      ensureString(text);
      return await Promise.resolve(text);
    },
    async startServer(): Promise<unknown> {
      // サーバを立てる
      const addr = "localhost:8899";
      serve((req: Request) => {
        const upgrade = req.headers.get("upgrade") || "";
        if (upgrade.toLowerCase() != "websocket") {
          return normalResponse(req);
        }
        const { socket, response } = Deno.upgradeWebSocket(req);
        socket.onmessage = async (e) => {
          lastSocket = socket;
          for await (const msg of e.data) {
            if (typeof msg === "string") {
              await sendContentMessage(denops);
              await sendSettings(denops);
            }
          }
        };
        return response;
      }, { addr });

      async function normalResponse(req: Request): Promise<Response> {
        if (req.method !== "GET") {
          return new Response("404 Not Found", { status: 404 });
        }
        const url = new URL(req.url);
        let requested_filepath = decodeURIComponent(url.pathname);
        if (requested_filepath == '/') {
          requested_filepath = '/index.html'
        }
        if (requested_filepath != '/index.html') {
          requested_filepath = '/static' + requested_filepath
        }
        let file;
        try {
          const filepath =new URL('.', import.meta.url).pathname + requested_filepath; 
          console.log(filepath)
          file = await Deno.open(filepath, { read: true });
        } catch {
          return new Response("404 Not Found", { status: 404 });
        }
        const readableStream = file.readable;
        return new Response(readableStream);
      }

      // // ページを開く
      // let browser = await denops.eval(`get(environ(), 'BROWSER', 'firefox')`);
      // denops.cmd(`!${browser} localhost:8899`);

      return await Promise.resolve();
    },
    async sendBuffer(): Promise<unknown> {
      // こちらから送信するとき
      if (lastSocket !== undefined) {
        try {
          await sendContentMessage(denops);
        } catch (error) {
          console.error(error);
        }
      }
      return await Promise.resolve();
    },
    async sendNewSettings(): Promise<unknown> {
      await sendSettings(denops);
      return await Promise.resolve();
    },
  };
}

async function sendSettings(denops: Denops) {
  let message: Message = {
    "isChanged": "setting",
    "settings": {
      "charperline": await vars.g.get(
        denops,
        "novelpreview#charperline",
      ) as number,
      "height": await vars.g.get(denops, "novelpreview#height") as number,
    },
  };
  if (lastSocket !== undefined) {
    lastSocket.send(JSON.stringify(message));
  }
}

// Content = (cursor position, 本文)が変わったというメッセージを送信
async function sendContentMessage(denops: Denops) {
  let bufferLines = (await denops.eval("getline(1, '$')")) as Array<
    string
  >;
  let curPos = await denops.eval("getpos('.')") as Array<number>;
  curPos[2] = await denops.eval(
    `charidx(getline('.'), ${curPos[2]})`,
  ) as number; // マルチバイト文字の場所を正しく得る

  let content: Content;
  let message: Message;
  if (bufferLines.join() !== previousContent["bufferLines"].join()) {
    // 前回とはバッファの内容が異なる場合、全部の情報を送信して画面を全書き換えする
    content = {
      bufferLines: bufferLines,
      curPos: curPos,
    };
    previousContent = content;
    message = {
      "isChanged": "buffer",
      "content": content,
    };
  } else if (curPos.join() !== previousContent["curPos"].join()) {
    // バッファの内容は同じだがカーソルの場所だけが異なる場合、カーソルの新しい位置だけ送れば良い
    content = {
      bufferLines: [],
      curPos: curPos,
    };
    // previousContentはcurPosだけ更新
    previousContent["curPos"] = curPos;
    message = {
      "isChanged": "cursor",
      "content": content,
    };
  } else {
    // 何も違わない場合
    message = {
      "isChanged": null,
      "content": null,
    };
  }
  if (lastSocket !== undefined) {
    lastSocket.send(JSON.stringify(message));
  }
}
