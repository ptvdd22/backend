const express = require("express");
const router = express.Router();
const upload = require("../middlewares/multerConfig"); // ✅ Controleer of deze bestaat
const importController = require("../controllers/importController");

// ✅ Correcte route voor het uploaden van een bestand
router.post("/", upload.single("file"), importController.importTransactions);

module.exports = router;
