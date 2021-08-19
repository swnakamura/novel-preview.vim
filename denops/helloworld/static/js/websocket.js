var conn = new WebSocket("ws://localhost:8900/ws")
conn.onopen = function() {
    console.log("connection opened!");
}
conn.onmessage = function(event) {
    document.getElementById("eventType").innerHTML = "メッセージ受信";
    document.getElementById("dispMsg").innerHTML = event.data;
    console.log(event.data);
}
conn.send("HI!");
