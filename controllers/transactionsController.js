const pool = require('../db');

// Haal alle transacties op met filters
exports.getAllTransactions = async (req, res) => {
    const { startDate, endDate, category, label, person, rekeningnummer } = req.query;

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
                t.person,
                c.naam AS categorie,
                l.naam AS label
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN labels l ON t.label_id = l.id
            WHERE 
                ($1::DATE IS NULL OR t.transactiedatum >= $1) AND
                ($2::DATE IS NULL OR t.transactiedatum <= $2) AND
                ($3::TEXT IS NULL OR 
                    ($3 = 'no-category' AND t.category_id IS NULL) OR 
                    (LOWER(c.naam) = LOWER($3))) AND
                ($4::TEXT IS NULL OR 
                    ($4 = 'no-label' AND t.label_id IS NULL) OR 
                    (LOWER(l.naam) = LOWER($4))) AND
                ($5::TEXT IS NULL OR 
                    ($5 = 'no-person' AND t.person IS NULL) OR 
                    (LOWER(t.person) LIKE LOWER($5))) AND
                ($6::TEXT IS NULL OR t.rekeningnummer = $6)
                ORDER BY t.transactiedatum DESC;
        `;

        const values = [
            startDate || null,
            endDate || null,
            category || null,
            label || null,
            person === 'no-person' ? 'no-person' : person ? `%${person}%` : null,
            rekeningnummer || null
        ];

        const { rows } = await pool.query(query, values);
        res.status(200).json(rows);
    } catch (err) {
        console.error('❌ Fout bij ophalen van transacties:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij ophalen transacties' });
    }
};

// Update transactie
exports.updateTransaction = async (req, res) => {
    const { id } = req.params;
    const { category_id, label_id, person } = req.body;

    try {
        console.log('📥 Ontvangen data:', { category_id, label_id, person });

        const query = `
            UPDATE transactions
            SET 
                category_id = COALESCE($1, category_id),
                label_id = COALESCE($2, label_id),
                person = COALESCE($3, person)
            WHERE id = $4
            RETURNING *;
        `;
        const values = [category_id, label_id, person, id];

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
            const newId = `${originalId}.${index + 1}`; 
            const newReference = `${originalData.referentie}.${index + 1}`; 

            const { rows } = await pool.query(
                `INSERT INTO transactions (
                    id,
                    transactiedatum,
                    creditdebet,
                    bedrag,
                    tegenrekeninghouder,
                    category_id,
                    label_id,
                    person,
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
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20) RETURNING *`,
                [
                    newId,                          // Nieuw ID
                    originalData.transactiedatum,  // Datum van originele transactie
                    originalData.creditdebet,      // "Credit" of "Debet"
                    parseFloat(split.bedrag),      // Bedrag van de splitsing
                    originalData.tegenrekeninghouder, // Tegenrekeninghouder
                    split.category_id || null,     // Categorie ID
                    split.label_id || null,         // Label ID
                    split.person || null,           // Persoon
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
        res.status(200).json({
            deletedId: originalId,
            newTransactions: insertedTransactions
        });
    } catch (error) {
        console.error('❌ Backendfout bij splitsen transactie:', error.message);
        res.status(500).json({ error: `❌ Serverfout bij splitsen transactie: ${error.message}` });
    }
};


// transacties zonder categorie
exports.getUncategorizedTransactions = async (req, res) => {
    try {
        const result = await pool.query(`
           SELECT 
            t.id,
            t.rekeningnummer,
            TO_CHAR(t.transactiedatum, 'DD-MM-YYYY') AS transactiedatum, -- Datum formatteren
            t.creditdebet,
            CAST(t.bedrag AS FLOAT) AS bedrag,
            t.tegenrekeningnummer,
            t.tegenrekeninghouder,
            t.betaalwijze,
            t.omschrijving,
            t.person
            FROM transactions t
            WHERE t.category_id IS NULL
            ORDER BY t.transactiedatum DESC;

        `);
        res.status(200).json(result.rows);
    } catch (err) {
        console.error('❌ Fout bij ophalen transacties zonder categorie:', err.message);
        res.status(500).json({ error: 'Serverfout bij ophalen transacties zonder categorie.' });
    }
};
