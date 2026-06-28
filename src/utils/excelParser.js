const ExcelJS = require('exceljs');
const { mapRoleGroup } = require('./constants');

function parseListString(val) {
  if (!val) return [];
  const str = String(val).replace(/[\[\]"']/g, '');
  if (!str.trim()) return [];
  return str.split(',').map((s) => s.trim()).filter(Boolean);
}

function cellValue(cell) {
  if (!cell) return '';
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object' && v.result !== undefined) return v.result;
  if (typeof v === 'object' && v.text !== undefined) return v.text;
  return v;
}

/**
 * Parse an Excel file buffer into normalized player objects.
 * @param {Buffer} buffer     - Raw file buffer from multer
 * @param {object} minRatings - { GK, DF, CM, ST } optional rating floors
 * @returns {Promise<object[]>}
 */
async function parseExcelBuffer(buffer, minRatings = {}) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('No worksheets found in the uploaded file.');

  // Build header map from row 1
  const headers = {};
  worksheet.getRow(1).eachCell((cell, colNumber) => {
    headers[colNumber] = String(cellValue(cell) || '').trim();
  });

  const getCol = (row, ...names) => {
    for (const name of names) {
      for (const [col, header] of Object.entries(headers)) {
        if (header.toLowerCase() === name.toLowerCase()) {
          return cellValue(row.getCell(Number(col)));
        }
      }
    }
    return '';
  };

  const players = [];

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // skip header

    const name = String(getCol(row, 'Name', 'Player Name') || 'Unknown').trim();
    const rating = parseInt(getCol(row, 'Rating', 'OVR') || 0, 10);
    const rawPos = String(getCol(row, 'Position') || 'CM').toUpperCase().trim();
    const roleGroup = mapRoleGroup(rawPos);
    const playstyleRaw = getCol(row, 'play style', 'Playstyles', 'Playstyles+');
    const altPosRaw = getCol(row, 'Alternative positions', 'Alt Positions');

    if (!name || name === 'Unknown') return;

    const floor = minRatings[roleGroup] ?? 0;
    if (rating < floor) return;

    players.push({
      Name: name,
      Rating: rating,
      Position: rawPos,
      RoleGroup: roleGroup,
      AltPositions: parseListString(altPosRaw),
      Playstyles: parseListString(playstyleRaw),
      Pac: parseInt(getCol(row, 'PAC', 'Pace') || 75, 10),
      Sho: parseInt(getCol(row, 'SHO', 'Shooting') || 75, 10),
      Pas: parseInt(getCol(row, 'PAS', 'Passing') || 75, 10),
      Dri: parseInt(getCol(row, 'DRI', 'Dribbling') || 75, 10),
      Def: parseInt(getCol(row, 'DEF', 'Defending') || 75, 10),
      Phy: parseInt(getCol(row, 'PHY', 'Physicality') || 75, 10),
    });
  });

  return players;
}

module.exports = { parseExcelBuffer };
