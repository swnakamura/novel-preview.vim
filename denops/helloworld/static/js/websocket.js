var conn = new WebSocket("ws://localhost:8900/ws");
conn.onopen = function () {
  console.log("connection opened!");
};
conn.onmessage = function (event) {
  if (event.data !== "Unchanged") {
    document.getElementById("preview").innerHTML = event.data;
  }
console.log(event.data);
};

window.setInterval(() => {
  conn.send("HI");
}, 3000);
