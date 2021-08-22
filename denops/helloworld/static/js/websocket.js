var conn = new WebSocket("ws://localhost:8899/ws");
conn.onopen = function () {
  console.log("connection opened!");
};
conn.onmessage = function (event) {
  if (event.data !== "Unchanged") {
    const message = JSON.parse(event.data);
    const isChanged = message["isChanged"];
    if (isChanged === "buffer") {
      const content = message["content"];
      const bufferLines = content["bufferLines"];
      let previewDiv = document.getElementById("preview");
      previewDiv.textContent = "";
      previewDiv.insertAdjacentHTML("afterbegin", bufferLines);
    } else if (isChanged === "cursor") {
      let previewDiv = document.getElementById("preview");
      previewDiv.textContent = "";
      previewDiv.insertAdjacentHTML("afterbegin", message["content"]);
    }
    // let colPos = message["getCurPos"][2];
    console.log(message["getCurPos"]);
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
