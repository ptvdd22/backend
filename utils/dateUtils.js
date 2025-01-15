// ✅ Datumformaat converteren (DD-MM-YYYY → YYYY-MM-DD)
function convertDate(dateStr) {
    const regex = /^\d{2}-\d{2}-\d{4}$/; // Verwacht DD-MM-YYYY
    if (!regex.test(dateStr)) {
        console.warn(`⚠️ Ongeldig datumformaat: ${dateStr}`);
        return null; // Ongeldige datum wordt overgeslagen
    }
    const [day, month, year] = dateStr.split('-');
    return `${year}-${month}-${day}`; // Omschakelen naar YYYY-MM-DD
}

module.exports = { convertDate };
