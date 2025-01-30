const pool = require('../db');
const fs = require('fs');
const csvParser = require('csv-parser');
const { parseDate } = require("../utils/dateUtils");

{/*
// functie datum omzetten

function parseDate(dateStr) {
    if (!dateStr) return null;
    const regex = /^\d{2}-\d{2}-\d{4}$/; // Verwacht formaat: DD-MM-YYYY
    if (!regex.test(dateStr)) {
        console.warn(`⚠️ Ongeldig datumformaat: ${dateStr}`);
        return null;
    }
    const [day, month, year] = dateStr.split('-');
    return `${year}-${month}-${day}`; // YYYY-MM-DD
} */}

// Importeer transacties vanuit een CSV-bestand met duplicate check en regels
exports.importTransactions = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: '❌ Geen bestand geüpload.' });
    }

    const filePath = req.file.path;
    let transactionsImported = 0;
    let skippedRows = 0;
    let duplicateReferences = [];
    let allReferences = [];
    let rulesApplied = 0; 
    const validTransactions = [];

    try {
        const stream = fs.createReadStream(filePath).pipe(csvParser({ separator: ';' }));

        // Stap 1: Lees en valideer de CSV
        for await (const row of stream) {
            const referentie = row['Referentie']?.trim() || null;
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

            // Controleer verplichte velden: referentie, transactiedatum, bedrag
            if (!referentie || !transactiedatum || !bedrag) {
                skippedRows++;
                console.warn('⚠️ Rij overgeslagen vanwege ontbrekende verplichte velden:', row);
                continue;
            }

            // Voeg transactie toe, zelfs als tegenrekeningnummer of tegenrekeninghouder ontbreekt
            allReferences.push(referentie);
            validTransactions.push({
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
                referentie,
                boekdatum,
            });
        }

        // Stap 2: Controleer op dubbele referenties
        const { rows: existingRows } = await pool.query(
            `SELECT referentie FROM transactions WHERE referentie = ANY($1)`,
            [allReferences]
        );

        const existingReferences = existingRows.map(row => row.referentie);

        // Stap 3: Pas regels toe
            const enrichedTransactions = []; // ✅ Correct geïnitialiseerd
            let rulesApplied = 0; // ✅ Houd het aantal toegepaste regels bij

            for (const transaction of validTransactions) {
                if (existingReferences.includes(transaction.referentie)) {
                    skippedRows++;
                    duplicateReferences.push(transaction.referentie);
                    console.warn(`⚠️ Dubbele transactie overgeslagen: Referentie ${transaction.referentie}`);
                    continue;
                }

                const { rows: matchingRules } = await pool.query(
                    `SELECT category_id, label_id, person 
                    FROM rules 
                    WHERE tegenrekeninghouder = $1 
                    LIMIT 1`,  // ✅ Zorgt ervoor dat maximaal 1 regel wordt toegepast
                    [transaction.tegenrekeninghouder]
                );

                console.log(`🔍 Aantal gevonden regels voor transactie ${transaction.referentie}: ${matchingRules.length}`);

                if (matchingRules.length === 1) {
                    const { category_id, label_id, person } = matchingRules[0];
                    enrichedTransactions.push({ ...transaction, category_id, label_id, person });
                    rulesApplied++; // ✅ Alleen verhogen als er exact één regel wordt toegepast
                    console.log(`✅ Regel toegepast op transactie ${transaction.referentie}:`, matchingRules[0]);
                } else {
                    enrichedTransactions.push(transaction);
                }
            }

                
        // Stap 4: Voeg verrijkte transacties toe aan de database
        const promises = enrichedTransactions.map(async (transaction) => {
            try {
                await pool.query(
                    `INSERT INTO transactions (
                        rekeningnummer, transactiedatum, valutacode, creditdebet, bedrag,
                        tegenrekeningnummer, tegenrekeninghouder, valutadatum, betaalwijze,
                        omschrijving, type_betaling, machtigingsnummer, incassant_id,
                        adres, referentie, boekdatum, category_id, label_id, imported
                    ) VALUES (
                         $1, $2, $3, $4, $5,
                        $6, $7, $8, $9,
                        $10, $11, $12, $13,
                        $14, $15, $16, $17, $18, true
                    )`,
                    [
                        transaction.rekeningnummer, transaction.transactiedatum, transaction.valutacode,
                        transaction.creditdebet, transaction.bedrag, transaction.tegenrekeningnummer,
                        transaction.tegenrekeninghouder, transaction.valutadatum, transaction.betaalwijze,
                        transaction.omschrijving, transaction.typeBetaling, transaction.machtigingsnummer,
                        transaction.incassantId, transaction.adres, transaction.referentie,
                        transaction.boekdatum, transaction.category_id, transaction.label_id
                    ]
                );
                transactionsImported++;
                console.log(`✅ Transactie toegevoegd: ${transaction.referentie}`);
            } catch (err) {
                skippedRows++;
                console.error(`❌ Fout bij toevoegen transactie ${transaction.referentie}:`, err.message);
            }
        });

        await Promise.all(promises);
        fs.unlinkSync(filePath); // Verwijder tijdelijk bestand

        res.status(200).json({
            message: '✅ Import succesvol voltooid',
            transactionsImported,
            rulesApplied, // Voeg de telling van toegepaste regels toe
            skippedRows,
            duplicateReferences,
        });

    } catch (err) {
        console.error('❌ Fout bij CSV-import:', err.message);
        res.status(500).json({ error: `❌ Serverfout bij verwerken bestand: ${err.message}` });
    }
};