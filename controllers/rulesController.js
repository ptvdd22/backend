const pool = require('../db');

// Voeg een regel toe
exports.addRule = async (req, res) => {
    const { tegenrekeningnummer, tegenrekeninghouder, categoryId, labelId, type } = req.body;

    if (!tegenrekeningnummer || !tegenrekeninghouder || !categoryId || !type) {
        return res.status(400).json({ error: '❌ Tegenrekeningnummer, tegenrekeninghouder en categorie zijn verplicht.' });
    }

    try {
        await pool.query(
            `INSERT INTO rules (tegenrekeningnummer, tegenrekeninghouder, category_id, label_id, type)
            VALUES ($1, $2, $3, $4, $5)`,
           [tegenrekeningnummer, tegenrekeninghouder, categoryId, labelId || null, type]
       );

        res.status(201).json({ message: '✅ Regel succesvol toegevoegd!' });
    } catch (err) {
        console.error('❌ Fout bij toevoegen van regel:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij toevoegen van regel' });
    }
};


// Pas regels toe op transacties
exports.applyRules = async (req, res) => {
    try {
        const rules = await pool.query(`
            SELECT 
                r.id, 
                r.tegenrekeningnummer, 
                r.tegenrekeninghouder, 
                r.category_id, 
                r.type,
                r.label_id
            FROM rules r
        `);

        console.log('📊 Regels opgehaald:', rules.rows);

        for (const rule of rules.rows) {
            const categoryId = rule.category_id || null;
            const labelId = rule.label_id || null;

            await pool.query(
                `UPDATE transactions
                 SET category_id = $1, 
                     label_id = $2,
                     type = $3
                 WHERE (tegenrekeninghouder = $4 OR tegenrekeningnummer = $5)`,
                [rule.category_id, rule.label_id, rule.type || null, rule.tegenrekeninghouder, rule.tegenrekeningnummer]
            );
            

            console.log(`✅ Regel toegepast voor ID: ${rule.id}`);
        }

        res.status(200).json({ message: '✅ Regels succesvol toegepast!' });
    } catch (err) {
        console.error('❌ Fout bij toepassen van regels:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij toepassen van regels' });
    }
};

// Haal alle regels op
exports.getRules = async (req, res) => {
    try {
        const result = await pool.query(`
           SELECT 
                r.id, 
                r.tegenrekeningnummer, 
                r.tegenrekeninghouder, 
                COALESCE(c.naam, '') AS categorie, 
                COALESCE(l.naam, '') AS label,
                r.type
            FROM rules r
            LEFT JOIN categories c ON r.category_id = c.id
            LEFT JOIN labels l ON r.label_id = l.id
        `);

        res.status(200).json(result.rows || []);
    } catch (err) {
        console.error('❌ Fout bij ophalen van regels:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij ophalen regels' });
    }
};


// Verwijder een regel
exports.deleteRule = async (req, res) => {
    const { id } = req.params;

    try {
        const result = await pool.query('DELETE FROM rules WHERE id = $1', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '❌ Regel niet gevonden' });
        }

        res.status(200).json({ message: '✅ Regel succesvol verwijderd!' });
    } catch (err) {
        console.error('❌ Fout bij verwijderen van regel:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij verwijderen van regel' });
    }
};

// Update een regel
exports.updateRule = async (req, res) => {
    const { id } = req.params;
    const { tegenrekeningnummer, tegenrekeninghouder, categorie, label, type } = req.body;

    if (!tegenrekeningnummer || !tegenrekeninghouder || !categorie || !type) {
        return res.status(400).json({ error: '❌ Alle velden zijn verplicht.' });
    }

    try {
        const categoryResult = await pool.query('SELECT id FROM categories WHERE naam = $1', [categorie]);
        const categoryId = categoryResult.rows[0]?.id;

        const labelResult = await pool.query('SELECT id FROM labels WHERE naam = $1', [label]);
        const labelId = labelResult.rows[0]?.id || null;

        const result = await pool.query(
            `UPDATE rules 
             SET tegenrekeningnummer = $1, tegenrekeninghouder = $2, category_id = $3, label_id = $4, type = $5 
             WHERE id = $6`,
            [tegenrekeningnummer, tegenrekeninghouder, categoryId, labelId, type, id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({ error: '❌ Regel niet gevonden' });
        }

        res.status(200).json({ message: '✅ Regel succesvol bijgewerkt' });
    } catch (err) {
        console.error('❌ Fout bij bijwerken van regel:', err.message);
        res.status(500).json({ error: '❌ Serverfout bij bijwerken van regel' });
    }
};


// checkt of er regels zijn voor import
exports.applyRules = async (req, res) => {
    try {
        const rules = await pool.query(`
            SELECT 
                r.id, 
                r.tegenrekeningnummer, 
                r.tegenrekeninghouder, 
                r.category_id, 
                r.type,
                r.label_id
            FROM rules r
        `);

        console.log('📊 Regels opgehaald:', rules.rows);

        let rulesApplied = 0;

        for (const rule of rules.rows) {
            const result = await pool.query(
                `UPDATE transactions
                 SET category_id = $1, 
                     label_id = $2,
                     type = $3
                 WHERE (tegenrekeninghouder = $4 OR tegenrekeningnummer = $5)`,
                [rule.category_id, rule.label_id, rule.type || null, rule.tegenrekeninghouder, rule.tegenrekeningnummer]
            );
            rulesApplied += result.rowCount; // Tel het aantal bijgewerkte transacties
        }
        
        res.status(200).json({
            message: '✅ Regels succesvol toegepast!',
            rulesApplied, // Dit moet het totaal aantal toegepaste regels bevatten
        });
        
    } catch (err) {
        console.error('❌ Fout bij toepassen van regels:', err.message);
        res.status(500).json({ error: '❌ Fout bij toepassen van regels' });
    }
};

