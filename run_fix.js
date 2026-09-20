
const fs = require("fs");
const path = "/var/www/matka-backend/src/dataStore.json";
if (fs.existsSync(path)) {
  const data = JSON.parse(fs.readFileSync(path, "utf8"));
  let changed = false;
  if (data.memoryBets) {
    data.memoryBets.forEach(b => {
      if (b.number === 100 || b.number === "100") {
        b.number = 0;
        changed = true;
      }
    });
  }
  if (changed) {
    fs.writeFileSync(path, JSON.stringify(data, null, 2));
    console.log("Fixed memoryBets in dataStore.json");
  }
}
require("dotenv").config({ path: "/var/www/matka-backend/.env" });
const mongoose = require("mongoose");
const Bet = require("/var/www/matka-backend/src/models/Bet.js");
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(async () => {
    const result = await Bet.updateMany({ number: 100 }, { $set: { number: 0 } });
    console.log("Updated DB:", result);
    process.exit(0);
  }).catch(e => { console.error(e); process.exit(1); });
