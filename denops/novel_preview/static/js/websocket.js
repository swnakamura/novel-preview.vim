const conn = new WebSocket("ws://localhost:8899/ws");
let bufferLines = null;
conn.onopen = function () {
  console.log("connection opened!");
  conn.send("Send me buffer");
};
conn.onmessage = function (event) {
    console.log("Receiving message");
  if (event.data !== "Unchanged") {
    const message = JSON.parse(event.data);
    const isChanged = message["isChanged"];
    console.log(isChanged);
    let renderedPreviewHTML = null;
    if (isChanged === null) {
      return;
    }
    const content_ = message["content"];
    if (isChanged === "line") {
      // 変更が行内にとどまっている場合、その行以外を変更する必要はない
      const lnum = message["content"]["curPos"][1];
      console.log(lnum)
      console.log(message["content"]["bufferLines"])
      console.log(message["content"]["bufferLines"][lnum-1])
      const renderedPreviewHTML = bufferLine2Paragraph(content_["bufferLines"][lnum-1], lnum-1);
      const lineParagraph = document.getElementById(`line${lnum-1}`);
      lineParagraph.outerHTML = renderedPreviewHTML;
    }
    if (isChanged === "buffer") {
      // bufferの内容が変わっていた場合、送られてきた最新のバッファの内容でHTMLの内容を更新する
      bufferLines = content_["bufferLines"];
      renderedPreviewHTML = renderBufferLines(bufferLines);
      const previewDiv = document.getElementById("preview");
      previewDiv.textContent = "";
      previewDiv.insertAdjacentHTML("afterbegin", renderedPreviewHTML);
    }
    else if (isChanged === "setting") {
      const charperline = message["settings"]["charperline"];
      const height = message["settings"]["height"];
      document.getElementById("preview").style.height = message["settings"]["height"] + '%';
      document.getElementById("preview").style.fontSize = height/charperline + 'vh';
      document.getElementById("preview").style.backgroundImage = `repeating-linear-gradient( to left, #333, #333 1px, transparent 1px, transparent ${height/charperline*1.5}vh)`;
      console.log(message["fontsize"])
    }
    else if (isChanged === "cursor") {
      // カーソル位置に変更があった場合
      // cursorPositionに画面をスクロールする
      const cursorPosition = content_["curPos"];
      document.getElementById(`line${cursorPosition[1] - 1}`).scrollIntoView({
        behavior: "smooth",
        block: "center",
        inline: "center",
      });
    }
    if (["cursor", "buffer", "line"].includes(isChanged)) {
      const cursorPosition = content_["curPos"];
      // カーソル位置に変更がありうる場合はカーソル位置のspanタグを作り直す
      // すでにあるspanタグを消す
      const cursorElement = document.getElementById('cursor');
      if (cursorElement != null) {
        const cursorText = cursorElement.textContent || cursorElement.innerText;
        const parentNode = cursorElement.parentNode;
        parentNode.replaceChild(document.createTextNode(cursorText), cursorElement);
      }
      // spanタグを作る
      const textElement = document.getElementById(`line${cursorPosition[1] - 1}`);
      const text = textElement.innerText;
      let newText = "";
      for (let i = 0; i < text.length; i++) {
        if (i == cursorPosition[2]-1)  {
          newText += '<span id="cursor">' + text[i] + "</span>";
        } else {
          newText += text[i];
        }
      }
      textElement.innerHTML = newText;
    }
  }
};
conn.onclose = function () {
    globalThis.close();
}
window.setInterval(() => {
  conn.send("Send me buffer");
}, 5000);

function renderBufferLines(
  bufferLines,
) {
  const bufferContentList = JSON.parse(JSON.stringify(bufferLines)); // deep copy


  const bufferContent =
    bufferContentList.map((line, i) =>
      bufferLine2Paragraph(line, i)
    ).join("") +
    "<p>　</p>".repeat(15); // add many endline for viewing

  return bufferContent;
}

function bufferLine2Paragraph(line, i) {
  return `<p class="honbun" id="line${i}">` + pixivFormatter(line) + "</p>"
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
  x = x.replace(
    /<summary/g,'&ltsummary'
  )
  x = x.replace(
    /<details/g,'&ltdetails'
  )
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
