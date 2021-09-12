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
    const content_ = message["content"];
    let renderedPreviewHTML = null;
    if (isChanged === "buffer") {
      // bufferの内容が変わっていた場合、送られてきた最新のバッファの内容でHTMLの内容を更新する
      bufferLines = content_["bufferLines"];
      renderedPreviewHTML = renderPreview(bufferLines);
      let previewDiv = document.getElementById("preview");
      previewDiv.textContent = "";
      previewDiv.insertAdjacentHTML("afterbegin", renderedPreviewHTML);
    }
    if (isChanged !== null) {
      // 何らかの変更が会った場合、cursorPositionに画面をスクロールする
      const cursorPosition = content_["curPos"];
      console.log(cursorPosition);
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

  const bufferContent = bufferContentList.map((x, i) =>
    `<p class="honbun" id="line${i}">` + pixivFormatter(x) + "</p>"
  ).join("");

  return bufferContent;
}
function pixivFormatter(x) {
  //ルビ記法をHTMLに変換
  x = x.replace(
    /\[\[rb:(\S*) *> *(\S*)\]\]/g,
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
    "――",
    "──",
  );
  // 空行が無視されてしまうので、全角空白を加えることで空行にする
  if (x === "") {
    x = "　";
  }
  return x;
}
