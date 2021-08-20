var conn = new WebSocket("ws://localhost:8900/ws");
conn.onopen = function () {
  console.log("connection opened!");
};
conn.onmessage = function (event) {
  if (event.data !== "Unchanged") {
    let message = JSON.parse(event.data);
    let previewDiv = document.getElementById("preview");
    previewDiv.textContent = "";
    previewDiv.insertAdjacentHTML("afterbegin", message["content"]);
    // let colPos = message["getCurPos"][2];
    console.log(message["getCurPos"]);
    document.getElementById("cursor").scrollIntoView({ behavior: "smooth" });
  }
};

window.setInterval(() => {
  conn.send("HI");
}, 300);
