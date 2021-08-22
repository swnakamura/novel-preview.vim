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
      bufferLines = content_["bufferLines"];
      const cursorPosition = content_["curPos"];
      renderedPreviewHTML = renderPreview(bufferLines, cursorPosition);
    } else if (isChanged === "cursor") {
      // cursorPositionのみ更新する
      const cursorPosition = content_["curPos"];
      renderedPreviewHTML = renderPreview(bufferLines, cursorPosition);
    }
    if (renderedPreviewHTML != null) {
      let previewDiv = document.getElementById("preview");
      previewDiv.textContent = "";
      previewDiv.insertAdjacentHTML("afterbegin", renderedPreviewHTML);
    }
    document.getElementById("cursor").scrollIntoView({
      behavior: "smooth",
      block: "center",
      inline: "center",
    });
  }
};

window.setInterval(() => {
  conn.send("Send me buffer");
}, 10000);

function renderPreview(
  bufferLines,
  curPos,
) {
  const linNum = curPos[1];
  const colNum = curPos[2];
  let bufferContentList = JSON.parse(JSON.stringify(bufferLines)); // deep copy
  let targetLine = bufferContentList[linNum - 1];
  if (targetLine[colNum] !== undefined) {
    bufferContentList[linNum - 1] = targetLine.substr(0, colNum) +
      '<span id="cursor">' +
      targetLine[colNum] + "</span>" + targetLine.substr(colNum + 1);
  } else {
    bufferContentList[linNum - 1] = targetLine + '<span id="cursor">　</span>';
  }

  const bufferContent = bufferContentList.map((x) =>
    '<p class="honbun">' + pixivFormatter(x) + "</p>"
  ).join("");

  return bufferContent;
}
function pixivFormatter(x) {
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
