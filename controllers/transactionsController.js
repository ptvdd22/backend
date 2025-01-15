const pool = require('../db');
const fs = require('fs');
const csvParser = require('csv-parser');

// Haal alle transacties op
exports.getAllTransactions = async (req, res) => {
    try {
        const query = `
            SELECT 
                t.id,
                t.rekeningnummer,
                TO_CHAR(t.transactiedatum, 'DD-MM-YYYY') AS transactiedatum,
                t.creditdebet,
                CAST(t.bedrag AS FLOAT) AS bedrag,
                t.tegenrekeningnummer,
                t.tegenrekeninghouder,
                t.betaalwijze,
                t.omschrijving,
                t.type,
                c.naam AS categorie,
                l.naam AS label
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN labels l ON t.label_id = l.id
            ORDER BY t.transactiedatum DESC;
        `;
        const { rows } = await pool.query(query);
        res.status(200).json(rows);
    } catch (err) {
        console.error('❌ Fout bij ophalen van transacties:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij ophalen transacties' });
    }
};

// Haal transacties zonder categorie op
exports.getUncategorizedTransactions = async (req, res) => {
    try {
        const query = `
            SELECT 
                id,
                rekeningnummer,
                TO_CHAR(transactiedatum, 'DD-MM-YYYY') AS transactiedatum,
                creditdebet,
                CAST(bedrag AS FLOAT) AS bedrag,
                tegenrekeningnummer,
                tegenrekeninghouder,
                betaalwijze,
                omschrijving,
                category_id
            FROM transactions
            WHERE category_id IS NULL
            ORDER BY transactiedatum DESC;
        `;
        const { rows } = await pool.query(query);
        res.status(200).json(rows);
    } catch (err) {
        console.error('❌ Fout bij ophalen transacties zonder categorie:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij ophalen transacties zonder categorie' });
    }
};

// Haal transacties zonder label op
exports.getTransactionsWithoutLabel = async (req, res) => {
    try {
        const query = `
            SELECT 
                id,
                rekeningnummer,
                TO_CHAR(transactiedatum, 'DD-MM-YYYY') AS transactiedatum,
                creditdebet,
                CAST(bedrag AS FLOAT) AS bedrag,
                tegenrekeningnummer,
                tegenrekeninghouder,
                betaalwijze,
                omschrijving,
                label_id
            FROM transactions
            WHERE label_id IS NULL
            ORDER BY transactiedatum DESC;
        `;
        const { rows } = await pool.query(query);
        res.status(200).json(rows);
    } catch (err) {
        console.error('❌ Fout bij ophalen transacties zonder label:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij ophalen transacties zonder label' });
    }
};

// Update transactie
exports.updateTransaction = async (req, res) => {
    const { id } = req.params;
    const { category_id, label_id, type } = req.body;

    try {
        console.log('📥 Ontvangen data:', { category_id, label_id, type });

        const query = `
            UPDATE transactions
            SET 
                category_id = COALESCE($1, category_id),
                label_id = COALESCE($2, label_id),
                type = COALESCE($3, type)
            WHERE id = $4
            RETURNING *;
        `;
        const values = [category_id, label_id, type, id];

        const { rows } = await pool.query(query, values); // ✅ Gebruik "pool.query"

        if (rows.length === 0) {
            return res.status(404).json({ error: 'Transactie niet gevonden' });
        }

        res.status(200).json(rows[0]);
    } catch (err) {
        console.error('❌ Fout bij bijwerken transactie:', err.message);
        res.status(500).json({ error: 'Serverfout bij bijwerken transactie' });
    }
};

function parseDate(dateStr) {
    if (!dateStr) return null;
    const regex = /^\d{2}-\d{2}-\d{4}$/; // Verwacht formaat: DD-MM-YYYY
    if (!regex.test(dateStr)) {
        console.warn(`⚠️ Ongeldig datumformaat: ${dateStr}`);
        return null;
    }
    const [day, month, year] = dateStr.split('-');
    return `${year}-${month}-${day}`; // YYYY-MM-DD
}

// Haal categorieën op
exports.getCategories = async (req, res) => {
    try {
        const query = `
            SELECT id, naam 
            FROM categories
            ORDER BY naam;
        `;
        const { rows } = await pool.query(query);
        res.status(200).json(rows);
    } catch (err) {
        console.error('❌ Fout bij ophalen categorieën:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij ophalen categorieën' });
    }
};

// Haal labels op
exports.getLabels = async (req, res) => {
    try {
        const query = `
            SELECT id, naam 
            FROM labels
            ORDER BY naam;
        `;
        const { rows } = await pool.query(query);
        res.status(200).json(rows);
    } catch (err) {
        console.error('❌ Fout bij ophalen labels:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij ophalen labels' });
    }
};

// Importeer transacties vanuit een CSV-bestand met duplicate check
exports.importTransactions = async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: '❌ Geen bestand geüpload.' });
    }

    const filePath = req.file.path;
    let transactionsImported = 0;
    let skippedRows = 0;
    let duplicateReferences = [];
    let allReferences = [];
    const validTransactions = [];

    try {
        const stream = fs.createReadStream(filePath).pipe(csvParser({ separator: ';' }));

        // Stap 1: Lees en valideer alle rijen uit het bestand
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

            if (!referentie || !rekeningnummer || !transactiedatum || !bedrag) {
                skippedRows++;
                console.warn('⚠️ Rij overgeslagen vanwege ontbrekende verplichte velden:', row);
                continue;
            }

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

        // Stap 2: Controleer op dubbele referenties in de database
        const { rows: existingRows } = await pool.query(
            `SELECT referentie FROM transactions WHERE referentie = ANY($1)`,
            [allReferences]
        );

        const existingReferences = existingRows.map(row => row.referentie);

        // Stap 3: Voeg unieke transacties toe
        const promises = validTransactions.map(async (transaction) => {
            if (existingReferences.includes(transaction.referentie)) {
                skippedRows++;
                duplicateReferences.push(transaction.referentie);
                console.warn(`⚠️ Dubbele transactie overgeslagen: Referentie ${transaction.referentie}`);
                return;
            }

            try {
                await pool.query(
                    `INSERT INTO transactions (
                        rekeningnummer, transactiedatum, valutacode, creditdebet, bedrag,
                        tegenrekeningnummer, tegenrekeninghouder, valutadatum, betaalwijze,
                        omschrijving, type_betaling, machtigingsnummer, incassant_id,
                        adres, referentie, boekdatum
                    ) VALUES (
                        $1, $2, $3, $4, $5,
                        $6, $7, $8, $9,
                        $10, $11, $12, $13,
                        $14, $15, $16
                    )`,
                    [
                        transaction.rekeningnummer, transaction.transactiedatum, transaction.valutacode,
                        transaction.creditdebet, transaction.bedrag, transaction.tegenrekeningnummer,
                        transaction.tegenrekeninghouder, transaction.valutadatum, transaction.betaalwijze,
                        transaction.omschrijving, transaction.typeBetaling, transaction.machtigingsnummer,
                        transaction.incassantId, transaction.adres, transaction.referentie,
                        transaction.boekdatum,
                    ]
                );
                transactionsImported++;
                console.log(`✅ Transactie toegevoegd: ${transaction.referentie}`);
            } catch (err) {
                skippedRows++;
                console.error('❌ Database-insert fout:', err.message);
            }
        });

        await Promise.all(promises);
        fs.unlinkSync(filePath); // Verwijder tijdelijk bestand

        console.log(`✅ Transacties geïmporteerd: ${transactionsImported}`);
        console.log(`⚠️ Overgeslagen transacties: ${skippedRows}`);

        res.status(200).json({
            message: '✅ Import succesvol voltooid',
            transactionsImported,
            skippedRows,
            duplicateReferences,
        });
    } catch (err) {
        console.error('❌ Fout bij CSV-import:', err.message);
        res.status(500).json({ error: `❌ Serverfout bij verwerken bestand: ${err.message}` });
    }
};

//  Opslaan split transactie

const handleSaveSplit = async () => {
    const originalTransaction = transactions.find((txn) => txn.id === splitTransactionId);
    if (!originalTransaction) {
        console.error('❌ Geen originele transactie gevonden');
        return;
    }

    const totalSplitAmount = splitData.reduce((sum, split) => sum + split.bedrag, 0);
    if (totalSplitAmount > originalTransaction.bedrag) {
        console.error('❌ Totaalbedrag overschrijdt originele bedrag:', {
            totalSplitAmount,
            originalAmount: originalTransaction.bedrag,
        });
        alert('Het totaalbedrag van de splitsingen mag niet hoger zijn dan het originele bedrag.');
        return;
    }

    try {
        console.log('🔄 Verzenden van splitsgegevens:', {
            originalId: splitTransactionId,
            splits: splitData,
        });

        const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/transactions/split`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                originalId: splitTransactionId,
                splits: splitData,
            }),
        });

        console.log('🔄 API-response status:', response.status);

        if (!response.ok) {
            const errorResponse = await response.text();
            throw new Error(`Fout bij splitsen transactie: ${response.status} - ${errorResponse}`);
        }

        const updatedTransactions = await response.json();
        console.log('✅ Splitsingen opgeslagen:', updatedTransactions);

        setTransactions((prev) =>
            [...prev.filter((txn) => txn.id !== splitTransactionId), ...updatedTransactions]
        );
        setSplitTransactionId(null);
    } catch (error) {
        console.error('❌ Fout bij splitsen transactie:', error.message);
        alert(`Fout bij splitsen transactie: ${error.message}`);
    }
};

// split transactie

exports.splitTransaction = async (req, res) => {
    const { originalId, splits } = req.body;

    if (!originalId || !Array.isArray(splits) || splits.length < 2) {
        return res.status(400).json({ error: 'Ongeldige invoer: Vereist originalId en minstens twee splits.' });
    }

    try {
        console.log('🔄 Ontvangen gegevens voor splitsen:', { originalId, splits });

        // Haal de originele transactie op
        const { rows: originalTransaction } = await pool.query(
            'SELECT * FROM transactions WHERE id = $1',
            [originalId]
        );

        if (originalTransaction.length === 0) {
            return res.status(404).json({ error: 'Originele transactie niet gevonden.' });
        }

        const originalData = originalTransaction[0];

        const totalSplitAmount = splits.reduce((sum, split) => sum + parseFloat(split.bedrag), 0);
        if (totalSplitAmount > parseFloat(originalData.bedrag)) {
            return res.status(400).json({ error: 'Het totaalbedrag van de splitsingen overschrijdt het originele bedrag.' });
        }

        // Verwijder de originele transactie
        await pool.query('DELETE FROM transactions WHERE id = $1', [originalId]);

        // Voeg de gesplitste transacties toe
        const insertedTransactions = [];
        for (const [index, split] of splits.entries()) {
            const newId = `${originalId}.${index + 1}`; // Nieuw ID zoals "3085.1"
            const newReference = `${originalData.referentie}.${index + 1}`; // Nieuwe referentie zoals "ABC123.1"

            const { rows } = await pool.query(
                `INSERT INTO transactions (
                    id,
                    transactiedatum,
                    creditdebet,
                    bedrag,
                    tegenrekeninghouder,
                    category_id,
                    label_id,
                    rekeningnummer,
                    valutacode,
                    tegenrekeningnummer,
                    valutadatum,
                    betaalwijze,
                    omschrijving,
                    type_betaling,
                    machtigingsnummer,
                    incassant_id,
                    adres,
                    referentie, -- Hernoemde referentie
                    boekdatum
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19) RETURNING *`,
                [
                    newId,                          // Nieuw ID
                    originalData.transactiedatum,  // Datum van originele transactie
                    originalData.creditdebet,      // "Credit" of "Debet"
                    parseFloat(split.bedrag),      // Bedrag van de splitsing
                    originalData.tegenrekeninghouder, // Tegenrekeninghouder
                    split.category_id || null,     // Categorie ID
                    split.label_id || null,        // Label ID
                    originalData.rekeningnummer,   // Rekeningnummer
                    originalData.valutacode,       // Valutacode
                    originalData.tegenrekeningnummer, // Tegenrekeningnummer
                    originalData.valutadatum,      // Valutadatum
                    originalData.betaalwijze,      // Betaalwijze
                    originalData.omschrijving,     // Omschrijving
                    originalData.type_betaling,    // Type betaling
                    originalData.machtigingsnummer,  // Machtingsnummer
                    originalData.incassant_id,     // Incassant ID
                    originalData.adres,            // Adres
                    newReference,                  // Nieuwe referentie
                    originalData.boekdatum         // Boekdatum
                ]
            );
            insertedTransactions.push(rows[0]);
        }

        console.log('✅ Gesplitste transacties toegevoegd:', insertedTransactions);
        res.status(200).json(insertedTransactions);
    } catch (error) {
        console.error('❌ Backendfout bij splitsen transactie:', error.message);
        res.status(500).json({ error: `❌ Serverfout bij splitsen transactie: ${error.message}` });
    }
};