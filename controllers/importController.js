const pool = require('../db');
const fs = require('fs');
const csvParser = require('csv-parser');
const { parseDate } = require("../utils/dateUtils");

exports.importTransactions = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '❌ Geen bestand geüpload.' });
  }

  const filePath = req.file.path;
  let transactionsImported = 0;
  let skippedRows = 0;
  let duplicateReferences = [];
  const validTransactions = [];
  const allReferences = [];

  try {
    // Stap 1: Lees het CSV-bestand en verzamel transacties
    const stream = fs.createReadStream(filePath).pipe(csvParser({ separator: ';' }));
    for await (const row of stream) {
      const referentie = row['Referentie']?.trim() || null;
      // Controleer of referentie aanwezig is
      if (!referentie) {
        skippedRows++;
        console.warn(`⚠️ Rij zonder referentie overgeslagen.`);
        continue;
      }

      const rekeningnummer = row['Rekeningnummer']?.trim() || null;
      const transactiedatum = parseDate(row['Transactiedatum']) || null;
      const valutacode = row['Valutacode']?.trim() || null;
      const creditdebet = row['CreditDebet']?.trim() || null;
      const bedrag = row['Bedrag'] ? parseFloat(row['Bedrag'].replace(',', '.')) : null;
      const tegenrekeningnummer = row['Tegenrekeningnummer']?.trim() || null;
      const tegenrekeninghouder = row['Tegenrekeninghouder']?.trim() || null;
      const valutadatum = parseDate(row['Valutadatum']) || null;
      const betaalwijze = row['Betaalwijze']?.trim() || null;
      const omschrijving = row['Omschrijving']?.trim() || null;
      const typeBetaling = row['Type betaling']?.trim() || null;
      const machtigingsnummer = row['Machtigingsnummer']?.trim() || null;
      const incassantId = row['Incassant ID']?.trim() || null;
      const adres = row['Adres']?.trim() || null;
      const boekdatum = parseDate(row['Boekdatum']) || null;

      allReferences.push(referentie);
      validTransactions.push({
        referentie,
        rekeningnummer,
        transactiedatum,
        valutacode,
        creditdebet,
        bedrag,
        tegenrekeningnummer,
        tegenrekeninghouder,
        valutadatum,
        betaalwijze,
        omschrijving,
        typeBetaling,
        machtigingsnummer,
        incassantId,
        adres,
        boekdatum,
      });
    }

    // Stap 2: Controleer op dubbele transacties (aan de hand van referentie)
    const { rows: existingRows } = await pool.query(
      `SELECT referentie FROM transactions WHERE referentie = ANY($1)`,
      [allReferences]
    );
    const existingReferences = existingRows.map(row => row.referentie);

    // Stap 3: Haal alle unieke tegenrekeninghouders op om de rules in één keer op te halen
    const uniqueTegenrekeninghouders = Array.from(
      new Set(validTransactions.map(tx => tx.tegenrekeninghouder).filter(Boolean))
    );

    let rulesMap = {};
    if (uniqueTegenrekeninghouders.length > 0) {
      const { rows: rulesRows } = await pool.query(
        `SELECT DISTINCT ON (tegenrekeninghouder) tegenrekeninghouder, category_id, label_id, person
         FROM rules
         WHERE tegenrekeninghouder = ANY($1)`,
        [uniqueTegenrekeninghouders]
      );
      // Maak een mapping van tegenrekeninghouder naar de regel
      for (const rule of rulesRows) {
        rulesMap[rule.tegenrekeninghouder] = rule;
      }
    }

    // Stap 4: Verrijk transacties met regels en filter dubbele transacties
    const enrichedTransactions = [];
    let rulesApplied = 0;
    for (const transaction of validTransactions) {
      // Sla transactie over als de referentie al bestaat
      if (existingReferences.includes(transaction.referentie)) {
        skippedRows++;
        duplicateReferences.push(transaction.referentie);
        console.warn(`⚠️ Dubbele transactie overgeslagen: Referentie ${transaction.referentie}`);
        continue;
      }

      // Verrijk de transactie indien er een regel is voor de tegenrekeninghouder
      if (transaction.tegenrekeninghouder && rulesMap[transaction.tegenrekeninghouder]) {
        const { category_id, label_id, person } = rulesMap[transaction.tegenrekeninghouder];
        enrichedTransactions.push({ ...transaction, category_id, label_id, person });
        rulesApplied++;
        console.log(`✅ Regel toegepast op transactie ${transaction.referentie}:`, { category_id, label_id, person });
      } else {
        enrichedTransactions.push(transaction);
      }
    }

    // Stap 5: Voeg de verrijkte transacties toe aan de database
    const insertPromises = enrichedTransactions.map(async (transaction) => {
      try {
        await pool.query(
          `INSERT INTO transactions (
            rekeningnummer, transactiedatum, valutacode, creditdebet, bedrag,
            tegenrekeningnummer, tegenrekeninghouder, valutadatum, betaalwijze,
            omschrijving, type_betaling, machtigingsnummer, incassant_id,
            adres, referentie, boekdatum, category_id, label_id, person, imported
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            $10, $11, $12, $13,
            $14, $15, $16, $17, $18, $19, true
          )`,
          [
            transaction.rekeningnummer, transaction.transactiedatum, transaction.valutacode,
            transaction.creditdebet, transaction.bedrag, transaction.tegenrekeningnummer,
            transaction.tegenrekeninghouder, transaction.valutadatum, transaction.betaalwijze,
            transaction.omschrijving, transaction.typeBetaling, transaction.machtigingsnummer,
            transaction.incassantId, transaction.adres, transaction.referentie,
            transaction.boekdatum, transaction.category_id, transaction.label_id, transaction.person
          ]
        );
        transactionsImported++;
        console.log(`✅ Transactie toegevoegd: ${transaction.referentie}`);
      } catch (err) {
        skippedRows++;
        console.error(`❌ Fout bij toevoegen transactie ${transaction.referentie}:`, err.message);
      }
    });
    await Promise.all(insertPromises);

    // Verwijder het tijdelijke CSV-bestand asynchroon
    await fs.promises.unlink(filePath);

    res.status(200).json({
      message: '✅ Import succesvol voltooid',
      transactionsImported,
      rulesApplied,
      skippedRows,
      duplicateReferences,
    });
  } catch (err) {
    console.error('❌ Fout bij CSV-import:', err.message);
    res.status(500).json({ error: `❌ Serverfout bij verwerken bestand: ${err.message}` });
  }
};
