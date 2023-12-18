import { Denops } from "https://deno.land/x/denops_std@v1.0.0/mod.ts";
import { ensureString } from "https://deno.land/x/unknownutil@v1.0.0/mod.ts";
import * as vars from "https://deno.land/x/denops_std@v3.9.1/variable/mod.ts";
import { open } from "https://deno.land/x/open@v0.0.5/index.ts";

// A local server that returns the content of a specific buffer
class Server {
  denops: Denops;
  bufnr: number;
  buffer: string[] = [];
  _listener: Deno.Listener | undefined;
  _sockets: globalThis.WebSocket[] = [];
  constructor(denops: Denops, bufnr: number) {
    this.denops = denops;
    this.bufnr = bufnr;
    this.evalBufferContent();
  }

  async evalBufferContent() {
    this.buffer = await (this.denops.eval("getline(1, '$')")) as string[];
  }

  run(host: string, port: number) {
    this._listener = Deno.listen({ hostname: host, port: port });
    this._serve(this._listener);
  }

  private async _serve(listener: Deno.Listener) {
    const handleHttp = async (conn: Deno.Conn) => {
      for await (const e of Deno.serveHttp(conn)) {
        const { request, respondWith } = e;
        const wantsUpgradeTo = request.headers.get("upgrade") || "";
        if (wantsUpgradeTo.toLowerCase() == "websocket") {
          const { socket, response } = Deno.upgradeWebSocket(request);
          this._socket = socket;
          e.respondWith(response);
        } else {
          respondWith(this._httpResponse(request));
        }
      }
    };
    for await (const conn of listener) {
      handleHttp(conn);
    }
  }

  private async _httpResponse(req: Request): Promise<Response> {
    if (req.method !== "GET") {
      return new Response("404 Not Found", { status: 404 });
    }
    const url = new URL(req.url);
    let requested_filepath = decodeURIComponent(url.pathname);
    if (requested_filepath == "/") {
      requested_filepath = "/index.html";
    }
    if (requested_filepath != "/index.html") {
      requested_filepath = "/static" + requested_filepath;
    }
    let file;
    try {
      const filepath = new URL(".", import.meta.url).pathname +
        requested_filepath;
      console.log(filepath);
      file = await Deno.open(filepath, { read: true });
    } catch {
      return new Response("404 Not Found", { status: 404 });
    }
    const readableStream = file.readable;
    return new Response(readableStream);
  }
}

let server: Server | undefined;

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
      // サーバを立て、ページを開く
      console.log("Starting server");
      if (server != undefined){
        if (server._socket != undefined) {
          server._socket.close();
        }
        server._listener.close();
        server = undefined;
        previousContent = {
          bufferLines: [],
          curPos: [],
        };
      }
      server = new Server(denops, await denops.eval("bufnr()") as number);
      server.run("localhost", 8899);

      // const browser = {
      //   app: await denops.eval(
      //     `get(environ(), 'BROWSER', 'google-chrome')`,
      //   ) as string,
      // };
      // open("localhost:8899", browser);
      denops.cmd(`!open http://localhost:8899`);
      return await Promise.resolve();
    },
    async sendBuffer(): Promise<unknown> {
      // こちらから送信するとき
      if (server !== undefined) {
        await sendContentMessage(denops, server._socket);
      } else {
        console.error("ERROR");
      }
      return Promise.resolve();
    },
    async sendNewSettings(): Promise<unknown> {
      if (server !== undefined) {
        sendSettings(denops, server._socket);
      } else {
        console.error("ERROR");
      }
      return await Promise.resolve();
    },
  };
}

async function sendSettings(denops: Denops, socket: WebSocket) {
  const message: Message = {
    "isChanged": "setting",
    "content": null,
    "settings": {
      "charperline": await vars.g.get(
        denops,
        "novelpreview#charperline",
      ) as number,
      "height": await vars.g.get(denops, "novelpreview#height") as number,
    },
  };
  socket.send(JSON.stringify(message));
}

// Content = (cursor position, 本文)が変わった（かもしれない）というメッセージを送信
async function sendContentMessage(denops: Denops, socket: WebSocket) {
  const bufferLines = (await denops.eval("getline(1, '$')")) as Array<
    string
    >;
  const curPos = await denops.eval("getcursorcharpos()") as Array<number>;

  let content: Content;
  let message: Message;
  const prevCurPos = previousContent["curPos"];
  const prevBufferLines = previousContent["bufferLines"];
  if (curPos[1] == prevCurPos[1]) {
    // カーソルの行は変わっていない
    if (bufferLines[curPos[1] - 1] !== prevBufferLines[curPos[1] - 1]) {
      // バッファのこの行が変わっている
      // なので、この行だけを更新するよういってやればよい
      let isChanged = 'line'
      if (bufferLines[curPos[1]] !== prevBufferLines[curPos[1]]) {
        // ただし、バッファの次の行も変わっている場合、
        // ddなどにより、カーソル自体は動いていないが行が変わっている可能性がある
        // なので全書き換え
        isChanged = 'buffer'
      }
      content = {
        bufferLines: bufferLines,
        curPos: curPos,
      };
      previousContent = content;
      message = {
        "isChanged": isChanged,
        "content": content,
        "settings": null,
      };
    } else {
      // カーソル列が変わっているかもしれないがテキストは変わっていない
      return;
    }
  } else {
    if (bufferLines.join(",") === prevBufferLines.join(",")) {
      // バッファの内容は同じだがカーソル位置が異なるので、カーソルの新しい位置だけ送れば良い
      content = {
        bufferLines: [],
        curPos: curPos,
      };
      // previousContentはcurPosだけ更新
      previousContent["curPos"] = curPos;
      message = {
        "isChanged": "cursor",
        "content": content,
        "settings": null,
      };
    } else {
      // 前回とはバッファの内容が異なる場合、全部の情報を送信して画面を全書き換えする
      content = {
        bufferLines: bufferLines,
        curPos: curPos,
      };
      previousContent = content;
      message = {
        "isChanged": "buffer",
        "content": content,
        "settings": null,
      };
    }
  }
  if (socket.readyState == 1) {
    socket.send(JSON.stringify(message));
  }
}
