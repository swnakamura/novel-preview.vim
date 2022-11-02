let conn = new WebSocket("ws://localhost:8899/ws");
let bufferLines = null;
conn.onopen = function () {
  console.log("connection opened!");
};
conn.onmessage = function (event) {
  if (event.data !== "Unchanged") {
    const message = JSON.parse(event.data);
    const isChanged = message["isChanged"];
    console.log(isChanged);
    let renderedPreviewHTML = null;
    if (isChanged === null) {
      return;
    }
    if (isChanged === "buffer") {
      const content_ = message["content"];
      // bufferの内容が変わっていた場合、送られてきた最新のバッファの内容でHTMLの内容を更新する
      bufferLines = content_["bufferLines"];
      renderedPreviewHTML = renderPreview(bufferLines);
      let previewDiv = document.getElementById("preview");
      previewDiv.textContent = "";
      previewDiv.insertAdjacentHTML("afterbegin", renderedPreviewHTML);
    }
    else if (isChanged === "setting") {
      let charperline = message["settings"]["charperline"];
      let height = message["settings"]["height"];
      document.getElementById("preview").style.height = message["settings"]["height"] + '%';
      document.getElementById("preview").style.fontSize = height/charperline + 'vh';
      document.getElementById("preview").style.backgroundImage = `repeating-linear-gradient( to left, #333, #333 1px, transparent 1px, transparent ${height/charperline*1.5}vh)`;
      console.log(message["fontsize"])
    }
    else if (isChanged === "cursor") {
      // 何らかの変更があった場合、cursorPositionに画面をスクロールする
      const content_ = message["content"];
      const cursorPosition = content_["curPos"];
      document.getElementById(`line${cursorPosition[1] - 1}`).scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
    }
  }
};

window.setInterval(() => {
  conn.send("Send me buffer");
}, 30000);

function renderPreview(
  bufferLines,
) {
  let bufferContentList = JSON.parse(JSON.stringify(bufferLines)); // deep copy

  const bufferContent =
    bufferContentList.map((x, i) =>
      `<p class="honbun" id="line${i}">` + pixivFormatter(x) + "</p>"
    ).join("") +
    "<p>　</p>".repeat(15); // add many endline for viewing

  return bufferContent;
}
function pixivFormatter(x) {
  //ルビ記法をHTMLに変換
  x = x.replace(
    /\[\[rb:(\S*?) *> *(\S*?)\]\]/g,
    "<ruby>$1<rt>$2</rt></ruby>",
  );
  // newpageをわかりやすく示す
  x = x.replace(
    "[newpage]",
    `◇ 　　◇ 　　◇<br>
改ページ<br>
◇ 　　◇ 　　◇`,
  );
  // ダッシュを罫線に
  x = x.replace(
    /――/g,
    "──",
  );
  // ！？を1文字に
  x = x.replace(
    /！？/g,
    "⁉",
  );
  x = x.replace(
    /！！/g,
    "‼",
  );
  // 半角濁点をUTF-8濁点に変換して付記する
  x = x.replace(
    /(\S)ﾞ/g,
    "$1゙",
  );
  // 空行が無視されてしまうので、全角空白を加えることで空行にする
  if (x === "") {
    x = "　";
  }
  // //でスタートする行は消す
  if (x.startsWith("//") || x.startsWith("　//")) {
    x = "";
  }
  return x;
}
