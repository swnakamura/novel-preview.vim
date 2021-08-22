import { Denops } from "https://deno.land/x/denops_std@v1.0.0/mod.ts";
import { ensureString } from "https://deno.land/x/unknownutil@v1.0.0/mod.ts";
import {
  createApp,
  serveStatic,
} from "https://deno.land/x/servest@v1.3.1/mod.ts";
import { fromFileUrl } from "https://deno.land/std@0.105.0/path/mod.ts";
import type { WebSocket } from "https://deno.land/std@0.105.0/ws/mod.ts";

// 最後に通信してきたクライアントを覚えておくための変数
// このクライアントのみに返信するので、タブやウィンドウを複数開くと一つにしか返信されないがこれは仕様
// クソ雑実装だが自分しか使わないのでまあいいだろう
let lastSocket: WebSocket | undefined = undefined;

interface Content {
  bufferLines: null | Array<string>;
  curPos: null | Array<number>;
}

interface Message {
  isChanged: null | string;
  content: null | Content;
}

// 最後に送信したメッセージを覚えておくための変数
let previousContent: Content = {
  bufferLines: null,
  curPos: null,
};

export async function main(denops: Denops): Promise<void> {
  // denopsコマンドを定義
  await denops.cmd(
    `command! NovelPreviewStartServer call denops#request('${denops.name}', 'startServer', [])`,
  );
  await denops.cmd(
    `command! NovelPreviewSend call denops#request('${denops.name}', 'sendBuffer', [])`,
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

      // websocketサーバに飛んできたメッセージに返信する
      app.ws("/ws", handleHandShake);

      // ページを開く
      let browser = await denops.eval(`get(environ(), 'BROWSER', 'firefox')`);
      denops.cmd(`!${browser} localhost:8899`);

      function handleHandShake(sock: WebSocket) {
        async function handleMessage(sock: WebSocket) {
          lastSocket = sock;
          for await (const msg of sock) {
            if (typeof msg === "string") {
              await sendMessage(denops, previousContent);
            }
          }
        }
        handleMessage(sock);
      }
      return await Promise.resolve();
    },
    async sendBuffer(): Promise<unknown> {
      if (lastSocket !== undefined) {
        await sendMessage(denops, previousContent);
      }
      return await Promise.resolve();
    },
  };
}

async function sendMessage(denops: Denops, previousContent: Content) {
  let bufferLines = (await denops.eval("getline(1, '$')")) as Array<
    string
  >;
  let curPos = await denops.eval("getpos('.')") as Array<number>;
  curPos[2] = await denops.eval(
    `charidx(getline('.'), ${curPos[2]})`,
  ) as number;

  bufferLines = addCursorSpan(bufferLines, curPos);

  let content: Content;
  let message: Message;
  if (bufferLines !== previousContent["bufferLines"]) {
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
  } else if (curPos != previousContent["curPos"]) {
    // バッファの内容は同じだがカーソルの場所だけが異なる場合、カーソルの新しい位置だけ送れば良い
    content = {
      bufferLines: null,
      curPos: curPos,
    };
    // previousContentはcurPosだけ更新
    previousContent["curPos"] = curPos;
    message = {
      "isChanged": "cursor",
      "content": content,
    };
  } else {
    // 何も違わない場合、isChangedをnullにする
    // contentを送る必要もない
    message = {
      "isChanged": null,
      "content": null,
    };
  }
  if (lastSocket !== undefined) {
    lastSocket.send(JSON.stringify(message));
  }
}

function addCursorSpan(
  bufferContentList: Array<string>,
  curPos: Array<number>,
) {
  let linNum = curPos[1];
  let colNum = curPos[2];
  var targetLine = bufferContentList[linNum - 1];
  if (targetLine[colNum] !== undefined) {
    bufferContentList[linNum - 1] = targetLine.substr(0, colNum) +
      '<span id="cursor">' +
      targetLine[colNum] + "</span>" + targetLine.substr(colNum + 1);
  } else {
    bufferContentList[linNum - 1] = targetLine + '<span id="cursor">　</span>';
  }
  return bufferContentList;
}

function pixivFormatter(x: string) {
  //ルビ記法をHTMLに変換
  x = x.replace(
    /\[\[rb:(.*) > (.*)\]\]/g,
    "<ruby>$1<rt>$2</rt></ruby>",
  );
  // 空行が無視されてしまうので、全角空白を加えることで空行にする
  if (x === "") {
    x = "　";
  }
  return x;
}
