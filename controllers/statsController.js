const pool = require('../db');


// Query voor categorieën en uitgaven per maand

exports.getCategoryExpenses = async (req, res) => {
  try {
      const query = `
        SELECT 
            c.naam AS category,
            COALESCE(SUM(CASE 
                WHEN DATE_PART('month', t.transactiedatum) = DATE_PART('month', CURRENT_DATE) 
                THEN CASE 
                        WHEN c.type = 'kosten' AND t.creditdebet = 'D' THEN t.bedrag 
                        WHEN c.type = 'kosten' AND t.creditdebet = 'C' THEN -t.bedrag 
                        WHEN c.type = 'opbrengsten' AND t.creditdebet = 'C' THEN t.bedrag 
                        WHEN c.type = 'opbrengsten' AND t.creditdebet = 'D' THEN -t.bedrag 
                        ELSE 0 
                    END 
                ELSE 0 
            END), 0)::NUMERIC AS current_month,
            COALESCE(SUM(CASE 
                WHEN DATE_PART('month', t.transactiedatum) = DATE_PART('month', CURRENT_DATE) - 1 
                THEN CASE 
                        WHEN c.type = 'kosten' AND t.creditdebet = 'D' THEN t.bedrag 
                        WHEN c.type = 'kosten' AND t.creditdebet = 'C' THEN -t.bedrag 
                        WHEN c.type = 'opbrengsten' AND t.creditdebet = 'C' THEN t.bedrag 
                        WHEN c.type = 'opbrengsten' AND t.creditdebet = 'D' THEN -t.bedrag 
                        ELSE 0 
                    END 
                ELSE 0 
            END), 0)::NUMERIC AS previous_month,
            COALESCE(SUM(CASE 
                WHEN c.type = 'kosten' AND t.creditdebet = 'D' THEN t.bedrag 
                WHEN c.type = 'kosten' AND t.creditdebet = 'C' THEN -t.bedrag 
                WHEN c.type = 'opbrengsten' AND t.creditdebet = 'C' THEN t.bedrag 
                WHEN c.type = 'opbrengsten' AND t.creditdebet = 'D' THEN -t.bedrag 
                ELSE 0 
            END) / NULLIF(EXTRACT(YEAR FROM AGE(MIN(t.transactiedatum))) * 12 
                + EXTRACT(MONTH FROM AGE(MIN(t.transactiedatum))), 0), 0)::NUMERIC AS average_per_month
        FROM categories c
        LEFT JOIN transactions t ON c.id = t.category_id
        GROUP BY c.naam
        ORDER BY c.naam;

      `;

      const { rows } = await pool.query(query);
      res.status(200).json(rows);
  } catch (err) {
      console.error('❌ Fout bij ophalen categorie-uitgaven:', err.message);
      res.status(500).json({ error: 'Serverfout bij ophalen categorie-uitgaven.' });
  }
};

// Alle categorie-uitgaven waarvan het rekeningnummer eindigt op '11'

exports.getExpensesEndingIn11 = async (req, res) => {
  try {
    const query = `
      SELECT 
          c.naam AS category,
          COALESCE(
              SUM(
                  CASE 
                      WHEN date_trunc('month', t.transactiedatum) = date_trunc('month', CURRENT_DATE)
                      THEN CASE
                              WHEN c.type = 'kosten' AND t.creditdebet = 'D' THEN t.bedrag
                              WHEN c.type = 'kosten' AND t.creditdebet = 'C' THEN -t.bedrag
                              WHEN c.type = 'opbrengsten' AND t.creditdebet = 'C' THEN t.bedrag
                              WHEN c.type = 'opbrengsten' AND t.creditdebet = 'D' THEN -t.bedrag
                              ELSE 0
                          END
                      ELSE 0
                  END
              ),
              0
          )::NUMERIC AS current_month,
          COALESCE(
              SUM(
                  CASE 
                      WHEN date_trunc('month', t.transactiedatum) = date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'
                      THEN CASE
                              WHEN c.type = 'kosten' AND t.creditdebet = 'D' THEN t.bedrag
                              WHEN c.type = 'kosten' AND t.creditdebet = 'C' THEN -t.bedrag
                              WHEN c.type = 'opbrengsten' AND t.creditdebet = 'C' THEN t.bedrag
                              WHEN c.type = 'opbrengsten' AND t.creditdebet = 'D' THEN -t.bedrag
                              ELSE 0
                          END
                      ELSE 0
                  END
              ),
              0
          )::NUMERIC AS previous_month,
          COALESCE(
              SUM(
                  CASE
                      WHEN c.type = 'kosten' AND t.creditdebet = 'D' THEN t.bedrag
                      WHEN c.type = 'kosten' AND t.creditdebet = 'C' THEN -t.bedrag
                      WHEN c.type = 'opbrengsten' AND t.creditdebet = 'C' THEN t.bedrag
                      WHEN c.type = 'opbrengsten' AND t.creditdebet = 'D' THEN -t.bedrag
                      ELSE 0
                  END
              ) 
              / NULLIF(
                  EXTRACT(YEAR FROM AGE(MIN(t.transactiedatum))) * 12 
                  + EXTRACT(MONTH FROM AGE(MIN(t.transactiedatum))),
                  0
              ),
              0
          )::NUMERIC AS average_per_month
      FROM categories c
      INNER JOIN transactions t 
          ON c.id = t.category_id
        AND t.rekeningnummer LIKE '%11'
      GROUP BY c.naam
      ORDER BY c.naam;


    `;
        
    const result = await pool.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};

// Alle categorie-uitgaven waarvan het rekeningnummer eindigt op '90'

exports.getExpensesEndingIn90 = async (req, res) => {
  try {
    const query = `
    SELECT 
        c.naam AS category,
        COALESCE(
            SUM(
                CASE 
                    WHEN date_trunc('month', t.transactiedatum) = date_trunc('month', CURRENT_DATE)
                    THEN CASE
                            WHEN c.type = 'kosten' AND t.creditdebet = 'D' THEN t.bedrag
                            WHEN c.type = 'kosten' AND t.creditdebet = 'C' THEN -t.bedrag
                            WHEN c.type = 'opbrengsten' AND t.creditdebet = 'C' THEN t.bedrag
                            WHEN c.type = 'opbrengsten' AND t.creditdebet = 'D' THEN -t.bedrag
                            ELSE 0
                        END
                    ELSE 0
                END
            ),
            0
        )::NUMERIC AS current_month,
        COALESCE(
            SUM(
                CASE 
                    WHEN date_trunc('month', t.transactiedatum) = date_trunc('month', CURRENT_DATE) - INTERVAL '1 month'
                    THEN CASE
                            WHEN c.type = 'kosten' AND t.creditdebet = 'D' THEN t.bedrag
                            WHEN c.type = 'kosten' AND t.creditdebet = 'C' THEN -t.bedrag
                            WHEN c.type = 'opbrengsten' AND t.creditdebet = 'C' THEN t.bedrag
                            WHEN c.type = 'opbrengsten' AND t.creditdebet = 'D' THEN -t.bedrag
                            ELSE 0
                        END
                    ELSE 0
                END
            ),
            0
        )::NUMERIC AS previous_month,
        COALESCE(
            SUM(
                CASE
                    WHEN c.type = 'kosten' AND t.creditdebet = 'D' THEN t.bedrag
                    WHEN c.type = 'kosten' AND t.creditdebet = 'C' THEN -t.bedrag
                    WHEN c.type = 'opbrengsten' AND t.creditdebet = 'C' THEN t.bedrag
                    WHEN c.type = 'opbrengsten' AND t.creditdebet = 'D' THEN -t.bedrag
                    ELSE 0
                END
            ) 
            / NULLIF(
                EXTRACT(YEAR FROM AGE(MIN(t.transactiedatum))) * 12 
                + EXTRACT(MONTH FROM AGE(MIN(t.transactiedatum))),
                0
            ),
            0
        )::NUMERIC AS average_per_month
    FROM categories c
    INNER JOIN transactions t 
        ON c.id = t.category_id
      AND t.rekeningnummer LIKE '%90'
    GROUP BY c.naam
    ORDER BY c.naam;

    `;
    
    const result = await pool.query(query);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
};
